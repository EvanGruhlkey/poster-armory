import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, MEMBERSHIP_PRICE_IDS } from "@/lib/stripe";
import { resolveQuotaPeriod } from "@/lib/subscription-period";
import { reconcileMembershipAccess } from "@/lib/stripe-fulfill";
import { addUtcMonths, resolveQuotaWindow } from "@/lib/billing-period";
import { downloadsPerPeriod, getPlanTier, type PlanTier } from "@/lib/plan-config";
import type Stripe from "stripe";

export interface SubscriptionSummary {
  active: boolean;
  expired: boolean;
  planTier: PlanTier;
  planSlug: string | null;
  planName: string | null;
  interval: "monthly" | "annual" | null;
  cancelAtPeriodEnd: boolean;
  downloadQuota: number | null;
  downloadsUsed: number;
  downloadsRemaining: number | null;
  /** When the download allowance refills. */
  periodEnd: string | null;
  /** When Stripe next bills, or when access ends after cancellation. */
  renewsAt: string | null;
}

export const SIGNED_OUT_SUMMARY: SubscriptionSummary = {
  active: false,
  expired: false,
  planTier: "none",
  planSlug: null,
  planName: null,
  interval: null,
  cancelAtPeriodEnd: false,
  downloadQuota: 0,
  downloadsUsed: 0,
  downloadsRemaining: 0,
  periodEnd: null,
  renewsAt: null,
};

interface Options {
  /**
   * Call Stripe to resolve `cancelAtPeriodEnd` and the billing interval.
   * Skipped for the initial server render so page loads don't pay for a
   * Stripe round-trip; the client refreshes those fields afterwards.
   */
  withStripe?: boolean;
}

/**
 * Everything the UI needs to describe a user's membership and their remaining
 * high-resolution downloads for the current billing month.
 */
export async function getSubscriptionSummary(
  userId: string,
  { withStripe = false }: Options = {}
): Promise<SubscriptionSummary> {
  const admin = createAdminClient();

  const { data: loadedSub } = await admin
    .from("subscriptions")
    .select(
      "id, plan_slug, status, current_period_end, current_period_start, created_at, stripe_sub_id"
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sub = loadedSub;

  if (!sub) {
    const { data: pastSub } = await admin
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .in("status", ["expired", "cancelled", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { ...SIGNED_OUT_SUMMARY, expired: pastSub?.status === "expired" };
  }

  const planTier = getPlanTier(sub.plan_slug);

  // A stored period end in the past is reconciled with Stripe first. A renewal
  // that already happened, or a Stripe outage, must not expire a paying member.
  // Grants with no Stripe subscription expire from the stored date.
  if (planTier === "membership") {
    const reconciled = await reconcileMembershipAccess(sub);
    if (reconciled.access === "ended") {
      return { ...SIGNED_OUT_SUMMARY, expired: true };
    }
    if (reconciled.access === "past_due") {
      return SIGNED_OUT_SUMMARY;
    }
    sub = reconciled.sub;
  }

  const { data: plan } = await admin
    .from("plans")
    .select("name, monthly_download_quota")
    .eq("slug", sub.plan_slug)
    .maybeSingle();

  let cancelAtPeriodEnd = false;
  let interval: "monthly" | "annual" | null = null;
  let stripeSubCached: Stripe.Subscription | undefined;

  if (withStripe && sub.stripe_sub_id) {
    try {
      stripeSubCached = await stripe.subscriptions.retrieve(sub.stripe_sub_id);
      if (
        stripeSubCached.status === "canceled" ||
        stripeSubCached.status === "incomplete_expired"
      ) {
        await admin
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("id", sub.id)
          .eq("status", "active");
        return { ...SIGNED_OUT_SUMMARY, expired: true };
      }
      cancelAtPeriodEnd = stripeSubCached.cancel_at_period_end;
      const priceId = stripeSubCached.items?.data?.[0]?.price?.id;
      if (priceId === MEMBERSHIP_PRICE_IDS.annual) interval = "annual";
      else if (priceId === MEMBERSHIP_PRICE_IDS.monthly) interval = "monthly";
    } catch {
      // A Stripe outage must never break the billing UI.
    }
  }

  let periodStart: Date;
  let periodEnd: Date;
  if (withStripe) {
    ({ start: periodStart, end: periodEnd } = await resolveQuotaPeriod(
      admin,
      stripe,
      sub,
      stripeSubCached
    ));
  } else {
    const start = new Date(sub.current_period_start ?? sub.created_at);
    const end = sub.current_period_end
      ? new Date(sub.current_period_end)
      : addUtcMonths(start, 1);
    ({ start: periodStart, end: periodEnd } = resolveQuotaWindow(start, end));
  }

  // The plans row is authoritative so the allowance can change without a
  // redeploy; the code constant is the fallback. NULL means unlimited.
  const downloadQuota =
    plan?.monthly_download_quota ?? downloadsPerPeriod(planTier);

  let downloadsUsed = 0;
  if (downloadQuota !== null) {
    // Window containment, matching `create_download_job`.
    const windowStartIso = periodStart.toISOString();
    try {
      const { count } = await admin
        .from("download_ledger")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .lte("period_start", windowStartIso)
        .gt("period_end", windowStartIso)
        .neq("status", "released");
      downloadsUsed = count || 0;
    } catch (e) {
      console.error("download ledger count:", e);
    }
  }

  return {
    active: true,
    expired: false,
    planTier,
    planSlug: sub.plan_slug,
    planName: plan?.name ?? null,
    interval,
    cancelAtPeriodEnd,
    downloadQuota,
    downloadsUsed,
    downloadsRemaining:
      downloadQuota === null ? null : Math.max(0, downloadQuota - downloadsUsed),
    periodEnd: periodEnd.toISOString(),
    renewsAt: sub.current_period_end,
  };
}
