/**
 * Download allowance windows.
 *
 * The membership includes 20 high-resolution downloads *per billing month*,
 * and the allowance resets on the real Stripe billing boundary rather than on
 * a calendar-month approximation.
 *
 * A monthly subscription has exactly one window per billing period, so the
 * window is the Stripe period itself. An annual subscription has one Stripe
 * period of twelve months, so we roll forward in whole months from the
 * period's anchor date — the subscriber still gets 20 downloads each month
 * instead of 240 to burn on day one.
 */

export type BillingPeriodRow = {
  current_period_start: string | null;
  current_period_end: string | null;
  stripe_sub_id: string | null;
  created_at: string;
};

export interface QuotaWindow {
  start: Date;
  end: Date;
}

const MONTH_MS = 31 * 24 * 60 * 60 * 1000;
/** Guard against a runaway loop if period bounds are corrupt. */
const MAX_WINDOWS = 600;

/**
 * Add whole months in UTC, clamping the day so that e.g. Jan 31 + 1 month
 * lands on Feb 28/29 rather than rolling into March. Mirrors how Stripe
 * anchors recurring invoices.
 */
export function addUtcMonths(base: Date, months: number): Date {
  const day = base.getUTCDate();
  const shifted = new Date(base.getTime());
  shifted.setUTCDate(1);
  shifted.setUTCMonth(shifted.getUTCMonth() + months);
  const daysInTargetMonth = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)
  ).getUTCDate();
  shifted.setUTCDate(Math.min(day, daysInTargetMonth));
  return shifted;
}

/**
 * The monthly allowance window containing `now`, derived from a Stripe
 * billing period. Returns the whole period for monthly plans and the current
 * month-slice for annual plans.
 */
export function resolveQuotaWindow(
  periodStart: Date,
  periodEnd: Date,
  now: Date = new Date()
): QuotaWindow {
  // Corrupt or missing bounds: fall back to a single month from the start.
  if (
    Number.isNaN(periodStart.getTime()) ||
    Number.isNaN(periodEnd.getTime()) ||
    periodEnd.getTime() <= periodStart.getTime()
  ) {
    return { start: periodStart, end: addUtcMonths(periodStart, 1) };
  }

  // Monthly (or shorter) term — the Stripe period is already the window.
  if (periodEnd.getTime() - periodStart.getTime() <= MONTH_MS) {
    return { start: periodStart, end: periodEnd };
  }

  for (let month = 0; month < MAX_WINDOWS; month++) {
    const start = addUtcMonths(periodStart, month);
    const rawEnd = addUtcMonths(periodStart, month + 1);
    const end = rawEnd.getTime() > periodEnd.getTime() ? periodEnd : rawEnd;

    if (now.getTime() < end.getTime() || end.getTime() >= periodEnd.getTime()) {
      return { start, end };
    }
  }

  return { start: periodStart, end: periodEnd };
}

/** Bounds for analytics rollups (`usage` table). */
export function usageStatsPeriodBounds(sub: BillingPeriodRow): QuotaWindow {
  const end = sub.current_period_end
    ? new Date(sub.current_period_end)
    : new Date(sub.created_at);
  let start: Date;
  if (sub.current_period_start) {
    start = new Date(sub.current_period_start);
  } else if (!sub.stripe_sub_id) {
    start = new Date(sub.created_at);
  } else {
    start = addUtcMonths(end, -1);
  }
  return { start, end };
}
