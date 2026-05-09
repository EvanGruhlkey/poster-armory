export type PlanTier = "free" | "basic" | "pro" | "pro_plus" | "none";

export type DownloadFormat = "png" | "pdf" | "svg";

export interface PlanEntitlements {
  allThemes: boolean;
  zoomControls: boolean;
  rotationControls: boolean;
  multipleSizes: boolean;
  posterLibrary: boolean;
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
    designsPerMonth: 5,
    downloadsPerMonth: 0,
    formats: [],
  },
  basic: {
    allThemes: false,
    zoomControls: false,
    rotationControls: false,
    multipleSizes: false,
    posterLibrary: false,
    designsPerMonth: 10,
    downloadsPerMonth: 2,
    formats: ["png"],
  },
  pro: {
    allThemes: true,
    zoomControls: true,
    rotationControls: true,
    multipleSizes: true,
    posterLibrary: true,
    designsPerMonth: 25,
    downloadsPerMonth: 10,
    formats: ["png", "pdf"],
  },
  pro_plus: {
    allThemes: true,
    zoomControls: true,
    rotationControls: true,
    multipleSizes: true,
    posterLibrary: true,
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

export function getPlanTier(planSlug: string | null | undefined): PlanTier {
  if (
    planSlug === "free" ||
    planSlug === "basic" ||
    planSlug === "pro" ||
    planSlug === "pro_plus"
  ) {
    return planSlug;
  }
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
