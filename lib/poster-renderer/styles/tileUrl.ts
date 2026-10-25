// Tile URL generation for map tiles
export function getOpenFreeMapPlanetTileJsonUrl(_styleId?: string): string {
  return 'https://tiles.openfreemap.org/planet';
}

export function getContourTileJsonUrl(styleId?: string): string {
  return '/api/tiles/contour/' + styleId + '.json';
}

export function getPopulationTileUrl(styleId?: string): string {
  return '/api/tiles/population/' + styleId + '.json';
}

export function getAwsTerrariumTileUrl(_styleId?: string): string {
  return 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
}

export function getSpaceportsGeoJsonUrl(): string {
  return '/api/spaceports';
}
