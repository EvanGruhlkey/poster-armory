import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fulfillCheckoutSessionWebhook,
  stripePeriodEnd,
  stripePeriodStart,
} from "@/lib/stripe-fulfill";
import type Stripe from "stripe";

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
        await fulfillCheckoutSessionWebhook(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      }

      // Renewals move current_period_start forward, which starts a fresh
      // download allowance window without any cron job.
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "invoice.payment_succeeded": {
        const stripeSubId =
          event.type === "invoice.payment_succeeded"
            ? resolveInvoiceSubscriptionId(event.data.object as Stripe.Invoice)
            : (event.data.object as Stripe.Subscription).id;

        if (!stripeSubId) break;

        const liveSub = await stripe.subscriptions.retrieve(stripeSubId);
        const status =
          liveSub.status === "active"
            ? "active"
            : liveSub.status === "canceled"
              ? "cancelled"
              : liveSub.status === "past_due"
                ? "past_due"
                : "inactive";

        await admin
          .from("subscriptions")
          .update({
            status,
            current_period_start: stripePeriodStart(liveSub),
            current_period_end: stripePeriodEnd(liveSub),
          })
          .eq("stripe_sub_id", stripeSubId);
        break;
      }

      case "invoice.payment_failed": {
        const subId = resolveInvoiceSubscriptionId(
          event.data.object as Stripe.Invoice
        );
        if (subId) {
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

function resolveInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = (invoice as unknown as { subscription?: string | { id: string } })
    .subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}
