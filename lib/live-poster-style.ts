export type MapLayerPreset = "everything" | "city" | "nature" | "minimal" | "transit";

export const MAX_POSTER_ZOOM = 17;
export const MIN_POSTER_DISTANCE = 100;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function distanceToZoom(distance: number) {
  return clamp(13 - Math.log2(Math.max(distance, MIN_POSTER_DISTANCE) / 2500), 3, MAX_POSTER_ZOOM);
}

export function zoomToDistance(zoom: number) {
  return clamp(Math.round(2500 * 2 ** (13 - zoom)), MIN_POSTER_DISTANCE, 50000);
}
