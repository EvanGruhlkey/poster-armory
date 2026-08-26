import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { submitOrderToGelato } from "@/lib/orders";
import { MEMBERSHIP_SLUG } from "@/lib/plan-config";
import type Stripe from "stripe";

export function stripePeriodStart(sub: Stripe.Subscription): string {
  const ts =
    (sub as any).current_period_start ??
    (sub.items?.data?.[0] as any)?.current_period_start;
  if (ts) return new Date(ts * 1000).toISOString();
  return new Date().toISOString();
}

export function stripePeriodEnd(sub: Stripe.Subscription): string {
  const ts =
    (sub as any).current_period_end ??
    (sub.items?.data?.[0] as any)?.current_period_end;
  if (ts) return new Date(ts * 1000).toISOString();
  return new Date(Date.now() + 30 * 86400_000).toISOString();
}

/** Mark a physical order paid and attempt Gelato submission (idempotent). */
export async function fulfillPhysicalOrder(
  session: Stripe.Checkout.Session,
  actorUserId?: string
): Promise<{ status: string }> {
  const orderId = session.metadata?.order_id;
  if (!orderId) {
    throw new Error("Missing order_id in session metadata");
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("poster_orders")
    .select("id, user_id, status, stripe_checkout_session_id")
    .eq("id", orderId)
    .single();

  if (!order) {
    throw new Error("Order not found");
  }

  if (actorUserId && order.user_id !== actorUserId) {
    throw new Error("Unauthorized");
  }

  if (
    order.stripe_checkout_session_id &&
    order.stripe_checkout_session_id !== session.id
  ) {
    throw new Error("Session does not match this order");
  }

  if (order.status !== "created" && order.status !== "paid") {
    return { status: "already_processed" };
  }

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  if (order.status === "created") {
    await admin
      .from("poster_orders")
      .update({
        status: "paid",
        stripe_payment_intent: paymentIntent,
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("status", "created");
  }

  await submitOrderToGelato(orderId);
  return { status: "order_paid" };
}

/**
 * Activate the membership from a paid Checkout session.
 *
 * The permanent `free` subscription row is never touched — it is the fallback
 * a user drops back to when the membership ends. Any other active paid row is
 * cancelled in Stripe first so a user can never be double-billed.
 */
export async function fulfillMembership(
  session: Stripe.Checkout.Session,
  userId: string
): Promise<{ status: string }> {
  const admin = createAdminClient();

  const { data: existingFromSession } = await admin
    .from("subscriptions")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .limit(1)
    .maybeSingle();

  if (existingFromSession) {
    return { status: "already_active" };
  }

  if (session.mode !== "subscription" || !session.subscription) {
    throw new Error("Membership checkout must be a subscription");
  }

  const subId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const stripeSub = await stripe.subscriptions.retrieve(subId);

  const { data: oldSubs } = await admin
    .from("subscriptions")
    .select("stripe_sub_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .neq("plan_slug", "free");

  for (const old of oldSubs ?? []) {
    if (old.stripe_sub_id && old.stripe_sub_id !== stripeSub.id) {
      try {
        await stripe.subscriptions.cancel(old.stripe_sub_id);
      } catch (e) {
        console.warn("Failed to cancel superseded subscription:", old.stripe_sub_id, e);
      }
    }
  }

  await admin
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("user_id", userId)
    .eq("status", "active")
    .neq("plan_slug", "free");

  const { error: insertErr } = await admin.from("subscriptions").insert({
    user_id: userId,
    plan_slug: MEMBERSHIP_SLUG,
    status: stripeSub.status === "active" ? "active" : "inactive",
    current_period_start: stripePeriodStart(stripeSub),
    current_period_end: stripePeriodEnd(stripeSub),
    stripe_checkout_session_id: session.id,
    stripe_customer_id:
      typeof stripeSub.customer === "string"
        ? stripeSub.customer
        : stripeSub.customer.id,
    stripe_sub_id: stripeSub.id,
  });

  if (insertErr?.code === "23505") {
    return { status: "already_active" };
  }
  if (insertErr) throw insertErr;

  return { status: "activated" };
}

/** Route a paid Checkout session to the correct fulfilment handler. */
export async function fulfillCheckoutSession(
  session: Stripe.Checkout.Session,
  actorUserId: string
): Promise<{ status: string }> {
  if (session.metadata?.kind === "physical_order") {
    return fulfillPhysicalOrder(session, actorUserId);
  }

  const userId = session.metadata?.user_id;
  if (!userId || userId !== actorUserId) {
    throw new Error("Unauthorized");
  }

  return fulfillMembership(session, userId);
}

/** Webhook entry point — trusts Stripe signature verification, not a session. */
export async function fulfillCheckoutSessionWebhook(
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.metadata?.kind === "physical_order") {
    await fulfillPhysicalOrder(session);
    return;
  }

  const userId = session.metadata?.user_id;
  if (!userId) return;

  await fulfillMembership(session, userId);
}
