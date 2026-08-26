// Pricing (see supabase/migrations/014_single_membership_plan.sql)
//
//   free       : full designer, unlimited live previews, 0 high-res downloads
//   membership : $10/month or $100/year — full designer + 20 high-resolution
//                downloads per billing month
//
// There is exactly one paid plan. Physical prints are billed per order at
// checkout and never touch the download allowance.
//
// Migration 014 re-points every legacy slug (starter / pro / basic / pro_plus)
// onto `membership`. `getPlanTier` still recognises them so a subscription row
// that has not yet been migrated resolves to the correct entitlements.

export type PlanTier = "free" | "membership" | "none";

export type DownloadFormat = "png" | "pdf" | "svg";

export type BillingInterval = "monthly" | "annual";

/** Canonical slug of the single paid plan. */
export const MEMBERSHIP_SLUG = "membership";

/** High-resolution downloads included with the membership, per billing month. */
export const MEMBERSHIP_DOWNLOADS_PER_MONTH = 20;

export const MEMBERSHIP_PRICE_MONTHLY_USD = 10;
export const MEMBERSHIP_PRICE_ANNUAL_USD = 100;

export interface PlanEntitlements {
  posterLibrary: boolean;
  /** null = unlimited; numeric value enforced by RPC + UI. */
  designsPerMonth: number | null;
  downloadsPerMonth: number | null;
  formats: DownloadFormat[];
}

export const PLAN_ENTITLEMENTS: Record<PlanTier, PlanEntitlements> = {
  none: {
    posterLibrary: false,
    designsPerMonth: null,
    downloadsPerMonth: 0,
    formats: [],
  },
  free: {
    posterLibrary: true,
    designsPerMonth: null,
    downloadsPerMonth: 0,
    formats: [],
  },
  membership: {
    posterLibrary: true,
    designsPerMonth: null,
    downloadsPerMonth: MEMBERSHIP_DOWNLOADS_PER_MONTH,
    formats: ["png", "pdf", "svg"],
  },
};

export const DEFAULT_SIZE = { label: '18"x24"', width: 9, height: 12, key: "png_18x24" };

/** Slugs that resolve to the paid membership, including pre-014 rows. */
const MEMBERSHIP_SLUGS = new Set([
  MEMBERSHIP_SLUG,
  "starter",
  "pro",
  "basic",
  "pro_plus",
]);

export function getPlanTier(planSlug: string | null | undefined): PlanTier {
  if (!planSlug) return "none";
  if (planSlug === "free") return "free";
  if (MEMBERSHIP_SLUGS.has(planSlug)) return "membership";
  return "none";
}

export function isMembershipSlug(planSlug: string | null | undefined): boolean {
  return getPlanTier(planSlug) === "membership";
}

export function fileKeyToFormat(fileKey: string): DownloadFormat {
  if (fileKey === "pdf") return "pdf";
  if (fileKey === "svg") return "svg";
  return "png";
}

export function isFormatAllowed(planTier: PlanTier, fileKey: string): boolean {
  return PLAN_ENTITLEMENTS[planTier].formats.includes(fileKeyToFormat(fileKey));
}

/** Downloads included per billing month for a tier. null = unlimited. */
export function downloadsPerPeriod(planTier: PlanTier): number | null {
  return PLAN_ENTITLEMENTS[planTier].downloadsPerMonth;
}
