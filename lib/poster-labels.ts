import type { PosterConfig } from "./types";
import { distanceToZoom } from "./live-poster-style";

export interface ResolvedPosterLabels {
  show: boolean;
  admin: boolean;
  cities: boolean;
  streets: boolean;
  size: number;
  style: NonNullable<PosterConfig["label_style"]>;
  scale: boolean;
  grid: boolean;
  gridDensity: NonNullable<PosterConfig["grid_density"]>;
  gridWeight: number;
}

export function resolvePosterLabels(config: PosterConfig): ResolvedPosterLabels {
  return {
    show: config.show_labels,
    admin: config.label_admin ?? true,
    cities: config.label_cities ?? true,
    streets: config.label_streets ?? true,
    size: config.label_size ?? 16,
    style: config.label_style ?? "standard",
    scale: config.show_scale ?? false,
    grid: config.show_grid ?? false,
    gridDensity: config.grid_density ?? 10,
    gridWeight: config.grid_weight ?? 1,
  };
}

export function getPosterGrid(config: PosterConfig) {
  const step = 1 / (config.grid_density ?? 10);
  const latMin = Math.max(-85, config.lat - 1);
  const latMax = Math.min(85, config.lat + 1);
  const lonMin = Math.max(-180, config.lon - 1);
  const lonMax = Math.min(180, config.lon + 1);
  const features: Array<{ type: "Feature"; properties: Record<string, never>; geometry: { type: "LineString"; coordinates: number[][] } }> = [];
  for (let lat = Math.ceil(latMin / step) * step; lat <= latMax; lat += step) {
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[lonMin, lat], [lonMax, lat]] } });
  }
  for (let lon = Math.ceil(lonMin / step) * step; lon <= lonMax; lon += step) {
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[lon, latMin], [lon, latMax]] } });
  }
  return { type: "FeatureCollection" as const, features };
}

export function getPosterScaleBar(config: PosterConfig, mapWidthPx: number): { widthPx: number; label: string } {
  const zoom = distanceToZoom(config.distance);
  const metersPerPixel = Math.cos(config.lat * Math.PI / 180) * 40_075_017 / (512 * 2 ** zoom);
  const targetMeters = metersPerPixel * 330 * 0.25;
  const magnitude = 10 ** Math.floor(Math.log10(targetMeters));
  const mantissa = targetMeters / magnitude;
  const nice = mantissa >= 5 ? 5 : mantissa >= 2 ? 2 : 1;
  const meters = nice * magnitude;
  return {
    widthPx: meters / (metersPerPixel * 330) * mapWidthPx,
    label: meters >= 1000 ? `${Number((meters / 1000).toFixed(1))} km` : `${Math.round(meters)} m`,
  };
}
