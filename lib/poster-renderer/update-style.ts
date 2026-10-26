import type { StyleSpecification, TerrainSpecification } from "maplibre-gl";

interface PosterStyleTarget {
  getTerrain(): TerrainSpecification | null;
  setTerrain(terrain: null): unknown;
  setStyle(style: StyleSpecification): unknown;
}

export function updatePosterMapStyle(map: PosterStyleTarget, style: StyleSpecification): void {
  // MapLibre 6 can retain terrain while the replacement style has no projection
  // yet. Detach it first to prevent the terrain depth pass from crashing.
  if (map.getTerrain()) map.setTerrain(null);
  map.setStyle(style);
}
