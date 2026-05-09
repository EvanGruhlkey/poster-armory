import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

function getPeriodStart(sub: Stripe.Subscription): string {
  const ts =
    (sub as any).current_period_start ??
    (sub.items?.data?.[0] as any)?.current_period_start;
  if (ts) return new Date(ts * 1000).toISOString();
  return new Date().toISOString();
}

function getPeriodEnd(sub: Stripe.Subscription): string {
  const ts =
    (sub as any).current_period_end ??
    (sub.items?.data?.[0] as any)?.current_period_end;
  if (ts) return new Date(ts * 1000).toISOString();
  return new Date(Date.now() + 30 * 86400_000).toISOString();
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const planSlug = session.metadata?.plan_slug;

        if (!userId || !planSlug) break;

        // Idempotency: skip if this checkout session was already fulfilled
        const { data: alreadyFulfilled } = await admin
          .from("subscriptions")
          .select("id")
          .eq("stripe_checkout_session_id", session.id)
          .limit(1)
          .single();

        if (alreadyFulfilled) break;

        // Cancel old PAID Stripe subscriptions and deactivate their DB rows.
        // The user's free sub is intentionally left active so it can serve
        // as a permanent fallback when the new paid plan eventually ends.
        const { data: oldSubs } = await admin
          .from("subscriptions")
          .select("stripe_sub_id, plan_slug")
          .eq("user_id", userId)
          .eq("status", "active")
          .neq("plan_slug", "free");

        if (oldSubs) {
          for (const old of oldSubs) {
            if (old.stripe_sub_id) {
              try {
                await stripe.subscriptions.cancel(old.stripe_sub_id);
              } catch (e) {
                console.warn("Failed to cancel old Stripe subscription:", old.stripe_sub_id, e);
              }
            }
          }
        }

        await admin
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("user_id", userId)
          .eq("status", "active")
          .neq("plan_slug", "free");

        if (session.mode === "payment") {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24);

          const { error: insertErr } = await admin.from("subscriptions").insert({
            user_id: userId,
            plan_slug: planSlug,
            status: "active",
            current_period_end: expiresAt.toISOString(),
            stripe_checkout_session_id: session.id,
            stripe_customer_id:
              typeof session.customer === "string"
                ? session.customer
                : session.customer?.id || null,
          });
          if (insertErr?.code === "23505") break;
        }

        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          const sub = await stripe.subscriptions.retrieve(subId);

          const { error: insertErr } = await admin.from("subscriptions").insert({
            user_id: userId,
            plan_slug: planSlug,
            status: sub.status === "active" ? "active" : "inactive",
            current_period_start: getPeriodStart(sub),
            current_period_end: getPeriodEnd(sub),
            stripe_checkout_session_id: session.id,
            stripe_customer_id:
              typeof sub.customer === "string"
                ? sub.customer
                : sub.customer.id,
            stripe_sub_id: sub.id,
          });
          if (insertErr?.code === "23505") break;
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const liveSub = await stripe.subscriptions.retrieve(
          (event.data.object as Stripe.Subscription).id
        );
        const stripeSubId = liveSub.id;

        const status =
          liveSub.status === "active"
            ? "active"
            : liveSub.status === "canceled"
              ? "cancelled"
              : "inactive";

        await admin
          .from("subscriptions")
          .update({
            status,
            current_period_start: getPeriodStart(liveSub),
            current_period_end: getPeriodEnd(liveSub),
          })
          .eq("stripe_sub_id", stripeSubId);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription.id;

          const sub = await stripe.subscriptions.retrieve(subId);
          await admin
            .from("subscriptions")
            .update({
              status: sub.status === "active" ? "active" : "inactive",
              current_period_start: getPeriodStart(sub),
              current_period_end: getPeriodEnd(sub),
            })
            .eq("stripe_sub_id", subId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subId =
            typeof invoice.subscription === "string"
              ? invoice.subscription
              : invoice.subscription.id;

          await admin
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("stripe_sub_id", subId);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
