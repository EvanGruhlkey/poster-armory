/**
 * Physical poster catalog: maps our print sizes to Gelato product UIDs and to
 * the render dimensions the Python CLI should use.
 *
 * IMPORTANT: the default product UIDs below are best-effort placeholders. Pull
 * the exact UIDs for the poster line you want to sell from your Gelato catalog
 * (https://dashboard.gelato.com/catalogue/categories) and override them via env
 * (e.g. GELATO_PRODUCT_UID_18X24_PORTRAIT). Resolution happens server-side, so
 * the client only ever needs the labels/keys exported here.
 */

export type ProductOrientation = "portrait" | "landscape";

export interface PhysicalSize {
  key: string;
  label: string;
  /** Physical print size in inches, expressed portrait (w < h). */
  inches: { w: number; h: number };
}

export const PHYSICAL_SIZES: PhysicalSize[] = [
  { key: "8x10", label: '8" x 10"', inches: { w: 8, h: 10 } },
  { key: "12x16", label: '12" x 16"', inches: { w: 12, h: 16 } },
  { key: "18x24", label: '18" x 24"', inches: { w: 18, h: 24 } },
];

const DEFAULT_PRODUCT_UIDS: Record<
  string,
  Record<ProductOrientation, string>
> = {
  "8x10": {
    portrait: "flat_200x250-mm-8x10-inch_200-gsm-80lb-uncoated_4-0_ver",
    landscape: "flat_200x250-mm-8x10-inch_200-gsm-80lb-uncoated_4-0_hor",
  },
  "12x16": {
    portrait: "flat_300x400-mm-12x16-inch_200-gsm-80lb-uncoated_4-0_ver",
    landscape: "flat_300x400-mm-12x16-inch_200-gsm-80lb-uncoated_4-0_hor",
  },
  "18x24": {
    portrait: "flat_18x24-inch-450x600-mm_200-gsm-80lb-uncoated_4-0_ver",
    landscape: "flat_18x24-inch-450x600-mm_200-gsm-80lb-uncoated_4-0_hor",
  },
};

export function getPhysicalSize(sizeKey: string): PhysicalSize | null {
  return PHYSICAL_SIZES.find((s) => s.key === sizeKey) ?? null;
}

export function normalizeOrientation(
  orientation: string | undefined | null
): ProductOrientation {
  // Square designs are printed on the portrait product variant.
  return orientation === "landscape" ? "landscape" : "portrait";
}

/**
 * Resolve the Gelato product UID for a size + orientation, preferring an env
 * override of the form GELATO_PRODUCT_UID_<SIZEKEY>_<ORIENTATION>
 * (e.g. GELATO_PRODUCT_UID_18X24_PORTRAIT). Server-side only.
 */
export function getProductUid(
  sizeKey: string,
  orientation: ProductOrientation
): string | null {
  const envKey = `GELATO_PRODUCT_UID_${sizeKey.toUpperCase()}_${orientation.toUpperCase()}`;
  const override = process.env[envKey];
  if (override && override.trim()) return override.trim();
  return DEFAULT_PRODUCT_UIDS[sizeKey]?.[orientation] ?? null;
}

/** Max canvas edge the Python CLI accepts (inches). */
const MAX_RENDER_EDGE = 20;

/**
 * Compute the figure dimensions (in inches) for the CLI so the rendered image
 * matches the product aspect ratio while staying within the CLI's 20-inch cap.
 * The long edge is pinned to 20in; at 300 DPI that yields ~6000px on the long
 * edge, which keeps even a 24x36 print at or above Gelato's 150 DPI minimum.
 */
export function getRenderDimensions(
  size: PhysicalSize,
  orientation: ProductOrientation
): { width: number; height: number } {
  const { w, h } = size.inches; // portrait reference (w < h)
  const shortToLong = w / h; // < 1
  const round = (n: number) => Math.round(n * 100) / 100;

  if (orientation === "landscape") {
    return { width: MAX_RENDER_EDGE, height: round(MAX_RENDER_EDGE * shortToLong) };
  }
  return { width: round(MAX_RENDER_EDGE * shortToLong), height: MAX_RENDER_EDGE };
}
