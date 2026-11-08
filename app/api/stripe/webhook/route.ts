import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  ensureMembershipFromStripe,
  fulfillCheckoutSessionWebhook,
  syncSubscriptionFromStripe,
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

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        await fulfillCheckoutSessionWebhook(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      }

      // Renewals and failures both follow the live subscription. A late
      // payment_failed must not mark a member past_due after Stripe has
      // already collected the invoice.
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const stripeSubId = event.type.startsWith("invoice.")
          ? resolveInvoiceSubscriptionId(event.data.object as Stripe.Invoice)
          : (event.data.object as Stripe.Subscription).id;

        if (!stripeSubId) break;

        const live = await syncSubscriptionFromStripe(stripeSubId);
        if (
          live &&
          (event.type === "customer.subscription.updated" ||
            event.type === "invoice.payment_succeeded")
        ) {
          await ensureMembershipFromStripe(live);
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

function subscriptionIdOf(
  value: string | { id: string } | null | undefined
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function resolveInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  // Older API versions put the id on `invoice.subscription`. The live webhook
  // is pinned to a version that nests it under `parent.subscription_details`.
  const raw = invoice as unknown as {
    subscription?: string | { id: string } | null;
    parent?: {
      subscription_details?: {
        subscription?: string | { id: string } | null;
      } | null;
    } | null;
    lines?: { data?: Array<{ subscription?: string | { id: string } | null }> };
  };

  return (
    subscriptionIdOf(raw.subscription) ??
    subscriptionIdOf(raw.parent?.subscription_details?.subscription) ??
    subscriptionIdOf(raw.lines?.data?.[0]?.subscription)
  );
}
