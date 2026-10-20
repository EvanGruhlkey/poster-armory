import type { PosterConfig } from "./types";

export interface ResolvedPosterCustomization {
  paletteId: string | null;
  customColors: Record<string, string>;
  mapLayers: Record<string, boolean>;
  roadWeight: number;
  terrainExaggeration: number;
  terrainLightAzimuth: number;
  terrainLightAltitude: number;
  buildingHeightScale: number;
  buildingDefaultHeight: number;
}

export function resolvePosterCustomization(config: PosterConfig): ResolvedPosterCustomization {
  return {
    paletteId: config.palette_id ?? null,
    customColors: config.custom_colors ?? {},
    mapLayers: config.map_layers ?? {},
    roadWeight: config.road_weight ?? 1,
    terrainExaggeration: config.terrain_exaggeration ?? 1.5,
    terrainLightAzimuth: config.terrain_light_azimuth ?? 315,
    terrainLightAltitude: config.terrain_light_altitude ?? 45,
    buildingHeightScale: config.building_height_scale ?? 1,
    buildingDefaultHeight: config.building_default_height ?? 10,
  };
}

export function applyPosterPalette(_config: PosterConfig, paletteId: string): Partial<PosterConfig> {
  return { palette_id: paletteId, custom_colors: {} };
}
