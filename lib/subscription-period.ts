import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { addUtcMonths, resolveQuotaWindow, type QuotaWindow } from "./billing-period";

export type SubscriptionPeriodRow = {
  id: string;
  plan_slug: string;
  stripe_sub_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
};

/** Current UTC calendar month, used for rows with no Stripe billing period. */
function currentUtcMonthWindow(): QuotaWindow {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start, end: addUtcMonths(start, 1) };
}

function periodTimestamp(
  sub: Stripe.Subscription,
  key: "current_period_start" | "current_period_end"
): number | undefined {
  const onSub = (sub as unknown as Record<string, unknown>)[key];
  if (typeof onSub === "number") return onSub;
  const onItem = (sub.items?.data?.[0] as unknown as Record<string, unknown>)?.[key];
  return typeof onItem === "number" ? onItem : undefined;
}

/**
 * The download-allowance window a user's quota should be counted against.
 *
 * Persisted Stripe bounds are authoritative. If they are missing on a
 * Stripe-backed subscription we fetch them once and write them back, so the
 * allowance always tracks the real billing boundary instead of drifting onto
 * a calendar-month approximation.
 */
export async function resolveQuotaPeriod(
  admin: SupabaseClient,
  stripe: Stripe,
  sub: SubscriptionPeriodRow,
  cachedStripeSub?: Stripe.Subscription
): Promise<QuotaWindow> {
  // The free plan has a zero allowance, so the window only affects display.
  // A rolling calendar month avoids needing a cron job to advance the row.
  if (sub.plan_slug === "free") {
    return currentUtcMonthWindow();
  }

  if (sub.current_period_start && sub.current_period_end) {
    return resolveQuotaWindow(
      new Date(sub.current_period_start),
      new Date(sub.current_period_end)
    );
  }

  if (!sub.stripe_sub_id) {
    const start = new Date(sub.created_at);
    return resolveQuotaWindow(start, addUtcMonths(start, 1));
  }

  try {
    const stripeSub =
      cachedStripeSub ?? (await stripe.subscriptions.retrieve(sub.stripe_sub_id));

    const startTs = periodTimestamp(stripeSub, "current_period_start");
    const endTs = periodTimestamp(stripeSub, "current_period_end");
    if (!startTs || !endTs) throw new Error("Missing Stripe period bounds");

    const start = new Date(startTs * 1000);
    const end = new Date(endTs * 1000);

    await admin
      .from("subscriptions")
      .update({
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
      })
      .eq("id", sub.id);

    return resolveQuotaWindow(start, end);
  } catch {
    // Stripe mismatch / network / bad key — never break the billing UI.
    const start = new Date(sub.created_at);
    return resolveQuotaWindow(start, addUtcMonths(start, 1));
  }
}
