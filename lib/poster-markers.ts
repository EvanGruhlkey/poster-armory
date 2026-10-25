import type { PosterConfig, PosterMarker } from "./types";

type PointFeature = { type: "Feature"; properties: { label: string; type: string; color: string; size: number }; geometry: { type: "Point"; coordinates: number[] } };

function splitAtDateline(markers: PosterMarker[]): number[][][] {
  if (markers.length < 2) return [];
  const lines: number[][][] = [];
  let current = [[markers[0].lon, markers[0].lat]];
  for (let index = 1; index < markers.length; index++) {
    const from = markers[index - 1];
    const to = markers[index];
    const difference = to.lon - from.lon;
    if (Math.abs(difference) > 180) {
      const endLon = difference < 0 ? 180 : -180;
      const unwrappedLon = to.lon + (difference < 0 ? 360 : -360);
      const fraction = (endLon - from.lon) / (unwrappedLon - from.lon);
      const latitude = from.lat + (to.lat - from.lat) * fraction;
      current.push([endLon, latitude]);
      lines.push(current);
      current = [[-endLon, latitude]];
    }
    current.push([to.lon, to.lat]);
  }
  lines.push(current);
  return lines;
}

function distanceKm(from: PosterMarker, to: PosterMarker): number {
  const radians = Math.PI / 180;
  const deltaLat = (to.lat - from.lat) * radians;
  const deltaLon = (to.lon - from.lon) * radians;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(from.lat * radians) * Math.cos(to.lat * radians) * Math.sin(deltaLon / 2) ** 2;
  return 12_742 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getPosterMarkerOverlay(config: PosterConfig) {
  const markers = config.markers ?? [];
  const pointMarkers: PosterMarker[] = config.center_marker
    ? [{ lat: config.lat, lon: config.lon, label: "", type: "pin", color: "#c64a38", size: 24 }, ...markers]
    : markers;
  const features: PointFeature[] = pointMarkers.map((marker) => ({
    type: "Feature",
    properties: { label: marker.label.trim(), type: marker.type ?? "pin", color: marker.color ?? "#c64a38", size: marker.size ?? 20 },
    geometry: { type: "Point", coordinates: [marker.lon, marker.lat] },
  }));
  const route = config.connect_markers ? splitAtDateline(markers) : [];
  const segmentFeatures = config.connect_markers && config.show_segment_lengths
    ? markers.slice(1).flatMap((marker, index) => Math.abs(marker.lon - markers[index].lon) > 180 ? [] : [{
      type: "Feature" as const,
      properties: { label: `${Number(distanceKm(markers[index], marker).toFixed(1))} km` },
      geometry: { type: "Point" as const, coordinates: [(markers[index].lon + marker.lon) / 2, (markers[index].lat + marker.lat) / 2] },
    }]) : [];
  const fill = config.connect_markers && config.marker_fill_color && markers.length >= 3 && route.length === 1
    ? { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const,
      coordinates: [[...markers.map(marker => [marker.lon, marker.lat]), [markers[0].lon, markers[0].lat]]] } }
    : null;
  return {
    points: { type: "FeatureCollection" as const, features },
    route: { type: "MultiLineString" as const, coordinates: route },
    segmentLabels: { type: "FeatureCollection" as const, features: segmentFeatures },
    fill,
  };
}
