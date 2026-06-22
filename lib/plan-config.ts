// Pricing v2 (see supabase/migrations/010_pricing_v2.sql)
//
//   free    : unlimited previews, 0 downloads
//   starter : $10/mo — unlimited previews + 5 downloads/month
//   pro     : $20/mo — unlimited previews + unlimited downloads + commercial use
//
// Single Download ($9 one-time) does NOT change planTier — it grants one
// row in `download_credits` that the worker consumes on demand. The legacy
// `basic` and `pro_plus` slugs are still honoured for grandfathered DB rows
// and silently mapped to the closest current tier.

export type PlanTier = "free" | "starter" | "pro" | "none";

export type DownloadFormat = "png" | "pdf" | "svg";

export interface PlanEntitlements {
  allThemes: boolean;
  zoomControls: boolean;
  rotationControls: boolean;
  multipleSizes: boolean;
  posterLibrary: boolean;
  /** Includes commercial use rights for downloaded files. */
  commercialUse: boolean;
  /** null = unlimited; numeric value enforced by RPC + UI. */
  designsPerMonth: number | null;
  downloadsPerMonth: number | null;
  formats: DownloadFormat[];
}

export const PLAN_ENTITLEMENTS: Record<PlanTier, PlanEntitlements> = {
  none: {
    allThemes: false,
    zoomControls: false,
    rotationControls: false,
    multipleSizes: false,
    posterLibrary: false,
    commercialUse: false,
    designsPerMonth: 0,
    downloadsPerMonth: 0,
    formats: [],
  },
  free: {
    allThemes: false,
    zoomControls: false,
    rotationControls: false,
    multipleSizes: false,
    posterLibrary: false,
    commercialUse: false,
    designsPerMonth: null,
    downloadsPerMonth: 0,
    formats: [],
  },
  starter: {
    allThemes: true,
    zoomControls: true,
    rotationControls: true,
    multipleSizes: true,
    posterLibrary: true,
    commercialUse: false,
    designsPerMonth: null,
    downloadsPerMonth: 5,
    formats: ["png", "pdf"],
  },
  pro: {
    allThemes: true,
    zoomControls: true,
    rotationControls: true,
    multipleSizes: true,
    posterLibrary: true,
    commercialUse: true,
    designsPerMonth: null,
    downloadsPerMonth: null,
    formats: ["png", "pdf", "svg"],
  },
};

export const STANDARD_THEMES = ["warm_beige", "terracotta", "noir", "blueprint", "ocean"];
export const PREMIUM_THEMES = [
  "midnight_blue", "forest", "sunset", "autumn", "emerald",
  "copper_patina", "japanese_ink", "pastel_dream", "monochrome_blue",
  "neon_cyberpunk", "contrast_zones", "gradient_roads",
];

export const DEFAULT_SIZE = { label: '18"x24"', width: 9, height: 12, key: "png_18x24" };

/**
 * Map a `plans.slug` value (including grandfathered legacy slugs) to the
 * narrow `PlanTier` union the rest of the app consumes.
 *
 * Legacy mapping:
 *   - "basic"    → "starter" (closest equivalent: 5 downloads/month tier)
 *   - "pro_plus" → "pro"     (already unlimited)
 */
export function getPlanTier(planSlug: string | null | undefined): PlanTier {
  if (planSlug === "free") return "free";
  if (planSlug === "starter") return "starter";
  if (planSlug === "pro") return "pro";
  if (planSlug === "basic") return "starter";
  if (planSlug === "pro_plus") return "pro";
  return "none";
}

export function fileKeyToFormat(fileKey: string): DownloadFormat {
  if (fileKey === "pdf") return "pdf";
  if (fileKey === "svg") return "svg";
  return "png";
}

export function isFormatAllowed(planTier: PlanTier, fileKey: string): boolean {
  const format = fileKeyToFormat(fileKey);
  return PLAN_ENTITLEMENTS[planTier].formats.includes(format);
}
