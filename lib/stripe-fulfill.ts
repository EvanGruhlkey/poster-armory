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

  if (!checkoutPaymentSettled(session)) {
    return { status: "pending_payment" };
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

export type MembershipAccess = "active" | "past_due" | "ended";

export interface MembershipPeriodRow {
  id: string;
  plan_slug: string;
  stripe_sub_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

/** Local status written from a live Stripe subscription. */
export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return "inactive";
  }
}

function checkoutPaymentSettled(session: Stripe.Checkout.Session): boolean {
  return (
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required"
  );
}

function subscriptionEntitled(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing";
}

function isStripeMissing(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "resource_missing"
  );
}

/**
 * Write the live Stripe status and period onto the local row.
 * A deleted subscription is marked cancelled. Network errors propagate so
 * the caller can retry instead of guessing.
 */
export async function syncSubscriptionFromStripe(
  stripeSubId: string
): Promise<Stripe.Subscription | null> {
  const admin = createAdminClient();
  let live: Stripe.Subscription;
  try {
    live = await stripe.subscriptions.retrieve(stripeSubId);
  } catch (err) {
    if (isStripeMissing(err)) {
      await admin
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("stripe_sub_id", stripeSubId);
      return null;
    }
    throw err;
  }

  await admin
    .from("subscriptions")
    .update({
      status: mapStripeSubscriptionStatus(live.status),
      current_period_start: stripePeriodStart(live),
      current_period_end: stripePeriodEnd(live),
    })
    .eq("stripe_sub_id", stripeSubId);

  return live;
}

/**
 * A stored period end in the past is not proof the membership ended.
 * Stripe may already have renewed, and a missed webhook would still be billing
 * them. Ask Stripe before taking access away. A grant with no Stripe
 * subscription expires from the stored date. If Stripe cannot be reached,
 * keep access.
 */
export async function reconcileMembershipAccess<T extends MembershipPeriodRow>(
  sub: T
): Promise<{ access: MembershipAccess; sub: T }> {
  const endedLocally =
    !!sub.current_period_end &&
    new Date(sub.current_period_end).getTime() < Date.now();
  if (!endedLocally) return { access: "active", sub };

  const admin = createAdminClient();

  if (!sub.stripe_sub_id) {
    await admin
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("id", sub.id)
      .eq("status", "active");
    return { access: "ended", sub };
  }

  let live: Stripe.Subscription;
  try {
    live = await stripe.subscriptions.retrieve(sub.stripe_sub_id);
  } catch (err) {
    if (isStripeMissing(err)) {
      await admin
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", sub.id)
        .eq("status", "active");
      return { access: "ended", sub };
    }
    console.warn(
      "Leaving membership active; Stripe could not be reached:",
      sub.stripe_sub_id,
      err
    );
    return { access: "active", sub };
  }

  const next: T = {
    ...sub,
    current_period_start: stripePeriodStart(live),
    current_period_end: stripePeriodEnd(live),
  };
  const status = mapStripeSubscriptionStatus(live.status);
  await admin
    .from("subscriptions")
    .update({
      status,
      current_period_start: next.current_period_start,
      current_period_end: next.current_period_end,
    })
    .eq("id", sub.id);

  if (subscriptionEntitled(live.status)) return { access: "active", sub: next };
  if (status === "past_due") return { access: "past_due", sub: next };
  return { access: "ended", sub: next };
}

/**
 * Insert the membership once Stripe is actually collecting.
 * The permanent free row is never touched. Other active paid rows are
 * cancelled only after this subscription is active, so an unpaid checkout
 * cannot replace a membership the user already has.
 */
async function activateMembership(args: {
  userId: string;
  stripeSub: Stripe.Subscription;
  checkoutSessionId: string | null;
}): Promise<{ status: string }> {
  const { userId, stripeSub, checkoutSessionId } = args;
  const admin = createAdminClient();

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
    status: "active",
    current_period_start: stripePeriodStart(stripeSub),
    current_period_end: stripePeriodEnd(stripeSub),
    stripe_checkout_session_id: checkoutSessionId,
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

/**
 * Create the local membership if a live, entitled Stripe subscription has
 * no row yet. Covers a bank debit that settles on
 * `checkout.session.async_payment_succeeded` after the first event was ignored.
 */
export async function ensureMembershipFromStripe(
  live: Stripe.Subscription
): Promise<void> {
  if (!subscriptionEntitled(live.status)) return;

  const userId = live.metadata?.user_id;
  if (!userId) return;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("stripe_sub_id", live.id)
    .limit(1)
    .maybeSingle();

  if (existing) return;
  await activateMembership({ userId, stripeSub: live, checkoutSessionId: null });
}

/**
 * Activate the membership from a Checkout session that has settled.
 * Unpaid or still-processing sessions return without changing any row.
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

  if (!checkoutPaymentSettled(session)) {
    return { status: "pending_payment" };
  }

  const subId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id;

  const stripeSub = await stripe.subscriptions.retrieve(subId);
  if (!subscriptionEntitled(stripeSub.status)) {
    return { status: "pending_payment" };
  }

  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("stripe_sub_id", stripeSub.id)
    .limit(1)
    .maybeSingle();

  if (existingSub) return { status: "already_active" };

  return activateMembership({
    userId,
    stripeSub,
    checkoutSessionId: session.id,
  });
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
