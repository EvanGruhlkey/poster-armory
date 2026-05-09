import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

export type SubscriptionPeriodRow = {
  id: string;
  plan_slug: string;
  stripe_sub_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
};

/** Start of the current UTC calendar month (ISO timestamp). */
function currentUtcMonthStartIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();
}

/** ISO timestamp for `created_at >= period` quota queries and RPC. */
export async function resolveQuotaPeriodStartIso(
  admin: SupabaseClient,
  stripe: Stripe,
  sub: SubscriptionPeriodRow,
  cachedStripeSub?: Stripe.Subscription
): Promise<string> {
  // Free plan: rolling UTC calendar-month window. We intentionally ignore
  // any persisted period bounds so the 5/month quota resets every month
  // without needing a cron job to roll the row forward.
  if (sub.plan_slug === "free") {
    return currentUtcMonthStartIso();
  }

  if (sub.current_period_start) {
    return new Date(sub.current_period_start).toISOString();
  }
  if (!sub.stripe_sub_id) {
    return new Date(sub.created_at).toISOString();
  }

  try {
    const stripeSub =
      cachedStripeSub ??
      (await stripe.subscriptions.retrieve(sub.stripe_sub_id));
    const startIso = new Date(
      stripeSub.current_period_start * 1000
    ).toISOString();
    const endIso = new Date(stripeSub.current_period_end * 1000).toISOString();

    await admin
      .from("subscriptions")
      .update({
        current_period_start: startIso,
        current_period_end: endIso,
      })
      .eq("id", sub.id);

    return startIso;
  } catch {
    // Stripe mismatch / network / bad key — do not break subscription UI
    return new Date(sub.created_at).toISOString();
  }
}
