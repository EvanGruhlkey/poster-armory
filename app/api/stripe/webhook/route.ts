import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { fulfillCheckoutSessionWebhook } from "@/lib/stripe-fulfill";
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
        await fulfillCheckoutSessionWebhook(session);
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
