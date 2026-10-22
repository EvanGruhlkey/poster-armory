export type MapLayerPreset = "everything" | "city" | "nature" | "minimal" | "transit";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function distanceToZoom(distance: number) {
  return clamp(13 - Math.log2(Math.max(distance, 1000) / 2500), 3, 17);
}

export function zoomToDistance(zoom: number) {
  return clamp(Math.round(2500 * 2 ** (13 - zoom)), 1000, 50000);
}
