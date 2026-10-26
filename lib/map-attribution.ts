export const MAP_ATTRIBUTION_TEXT = "Map data © OpenStreetMap · OpenFreeMap";
export const MAP_ATTRIBUTION_FONT_POINTS = 1;
export const DEFAULT_PRINT_DPI = 300;

export function pointsToPixels(points: number, dpi = DEFAULT_PRINT_DPI): number {
  const resolvedDpi = Number.isFinite(dpi) && dpi > 0 ? dpi : DEFAULT_PRINT_DPI;
  return (points * resolvedDpi) / 72;
}
