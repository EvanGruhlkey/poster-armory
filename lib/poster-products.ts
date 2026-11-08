/**
 * Physical poster catalog: maps our print sizes to Gelato product UIDs and to
 * the render dimensions the Python CLI should use.
 *
 * Unframed UIDs can be overridden with GELATO_PRODUCT_UID_<SIZE>_<ORIENTATION>.
 * Wood-frame UIDs are the activated Gelato framed-posters: 200 gsm uncoated
 * paper, a 12 mm wood face, and plexiglass. Resolution happens server-side, so
 * the client only ever needs the labels and keys exported here.
 */

export type ProductOrientation = "portrait" | "landscape";

export const FRAME_FINISH_KEYS = [
  "none",
  "natural-wood",
  "dark-wood",
  "black",
  "white",
] as const;

export type FrameFinish = (typeof FRAME_FINISH_KEYS)[number];

export interface FrameFinishOption {
  key: FrameFinish;
  label: string;
  /** Short description shown with the choice. */
  detail: string;
  /** Wood color for the preview border. Null is an unframed print. */
  swatch: string | null;
}

export const FRAME_FINISHES: FrameFinishOption[] = [
  { key: "none", label: "No frame", detail: "Print only", swatch: null },
  {
    key: "natural-wood",
    label: "Natural wood",
    detail: "Light wood, like the homepage",
    swatch: "#C4A574",
  },
  { key: "dark-wood", label: "Dark wood", detail: "Dark brown", swatch: "#5C3A21" },
  { key: "black", label: "Black", detail: "Black wood", swatch: "#1A1A1A" },
  { key: "white", label: "White", detail: "White wood", swatch: "#F4F1EA" },
];

export function getFrameFinish(key: string | null | undefined): FrameFinishOption | null {
  return FRAME_FINISHES.find((finish) => finish.key === key) ?? null;
}

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
 * Gelato framed-posters catalog slugs for the sizes we sell.
 * Confirmed activated products: 200 gsm uncoated, 12 mm wood face,
 * 22 mm deep, plexiglass. Natural wood is the light frame on the homepage.
 */
const FRAMED_SIZE_SLUGS: Record<string, string> = {
  "8x10": "8x10-inch-200x250-mm",
  "12x16": "12x16-inch-300x400-mm",
  "18x24": "18x24-inch-450x600-mm",
};

function framedProductUid(
  sizeKey: string,
  orientation: ProductOrientation,
  finish: Exclude<FrameFinish, "none">
): string | null {
  const slug = FRAMED_SIZE_SLUGS[sizeKey];
  if (!slug) return null;
  const gelatoOrientation = orientation === "landscape" ? "hor" : "ver";
  return `framed_poster_${slug}_${finish}_wood_w12xt22-mm_plexiglass_${slug}_200-gsm-80lb-uncoated_4-0_${gelatoOrientation}`;
}

/**
 * Resolve the Gelato product UID for a size, orientation, and frame.
 * Unframed prints still prefer GELATO_PRODUCT_UID_<SIZEKEY>_<ORIENTATION>.
 * Framed prints use the catalog UIDs above. Server-side only.
 */
export function getProductUid(
  sizeKey: string,
  orientation: ProductOrientation,
  finish: FrameFinish = "none"
): string | null {
  if (finish !== "none") return framedProductUid(sizeKey, orientation, finish);
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
