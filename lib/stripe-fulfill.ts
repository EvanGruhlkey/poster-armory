import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { submitOrderToGelato } from "@/lib/orders";
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

/** Grant a single-download credit (idempotent on checkout session id). */
export async function fulfillSingleDownloadCredit(
  session: Stripe.Checkout.Session,
  userId: string
): Promise<{ status: string }> {
  const admin = createAdminClient();
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  const { error: creditErr } = await admin.from("download_credits").insert({
    user_id: userId,
    source: "purchase",
    stripe_checkout_session_id: session.id,
    stripe_payment_intent: paymentIntent,
    amount_cents: session.amount_total ?? null,
    currency: session.currency ?? null,
  });

  if (creditErr && creditErr.code !== "23505") {
    throw creditErr;
  }

  return {
    status: creditErr?.code === "23505" ? "already_granted" : "credit_granted",
  };
}

/** Activate a subscription plan from a paid Checkout session. */
export async function fulfillSubscriptionPlan(
  session: Stripe.Checkout.Session,
  userId: string,
  planSlug: string
): Promise<{ status: string }> {
  const admin = createAdminClient();

  const { data: existingFromSession } = await admin
    .from("subscriptions")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .limit(1)
    .single();

  if (existingFromSession) {
    return { status: "already_active" };
  }

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
          console.warn(
            "Failed to cancel old Stripe subscription:",
            old.stripe_sub_id,
            e
          );
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
        typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_sub_id: sub.id,
    });
    if (insertErr?.code === "23505") {
      return { status: "already_active" };
    }
    if (insertErr) throw insertErr;
  } else if (session.mode === "payment") {
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
    if (insertErr?.code === "23505") {
      return { status: "already_active" };
    }
    if (insertErr) throw insertErr;
  }

  return { status: "activated" };
}

/** Route a paid Checkout session to the correct fulfilment handler. */
export async function fulfillCheckoutSession(
  session: Stripe.Checkout.Session,
  actorUserId: string
): Promise<{ status: string }> {
  const kind = session.metadata?.kind;

  if (kind === "single_download") {
    const creditUserId = session.metadata?.user_id;
    if (!creditUserId || creditUserId !== actorUserId) {
      throw new Error("Unauthorized");
    }
    return fulfillSingleDownloadCredit(session, creditUserId);
  }

  if (kind === "physical_order") {
    return fulfillPhysicalOrder(session, actorUserId);
  }

  const planSlug = session.metadata?.plan_slug;
  if (!planSlug || planSlug === "single_download") {
    throw new Error("Missing plan metadata");
  }

  const userId = session.metadata?.user_id;
  if (!userId || userId !== actorUserId) {
    throw new Error("Unauthorized");
  }

  return fulfillSubscriptionPlan(session, userId, planSlug);
}

/** Webhook entry point — trusts Stripe signature verification, not a user session. */
export async function fulfillCheckoutSessionWebhook(
  session: Stripe.Checkout.Session
): Promise<void> {
  const kind = session.metadata?.kind;

  if (kind === "single_download") {
    const creditUserId = session.metadata?.user_id;
    if (!creditUserId) return;
    await fulfillSingleDownloadCredit(session, creditUserId);
    return;
  }

  if (kind === "physical_order") {
    await fulfillPhysicalOrder(session);
    return;
  }

  const userId = session.metadata?.user_id;
  const planSlug = session.metadata?.plan_slug;
  if (!userId || !planSlug) return;

  await fulfillSubscriptionPlan(session, userId, planSlug);
}
