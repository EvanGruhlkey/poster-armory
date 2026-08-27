import type { Map as MapLibreMap } from "maplibre-gl";
import type { PosterConfig } from "@/lib/types";

export type MapLayerPreset =
  | "everything"
  | "city"
  | "nature"
  | "minimal"
  | "transit";

export const OPEN_FREE_MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function distanceToZoom(distance: number) {
  return clamp(13 - Math.log2(Math.max(distance, 1000) / 2500), 3, 17);
}

export function zoomToDistance(zoom: number) {
  return clamp(Math.round(2500 * 2 ** (13 - zoom)), 1000, 50000);
}

export function mixHex(background: string, foreground: string, amount: number) {
  const parse = (color: string) => {
    const normalized = color.replace("#", "");
    return [0, 2, 4].map((index) =>
      parseInt(normalized.slice(index, index + 2), 16)
    );
  };
  const [br, bg, bb] = parse(background);
  const [fr, fg, fb] = parse(foreground);
  const channel = (a: number, b: number) =>
    Math.round(a + (b - a) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(br, fr)}${channel(bg, fg)}${channel(bb, fb)}`;
}

function safeSetPaint(
  map: MapLibreMap,
  layerId: string,
  property: string,
  value: string | number
) {
  try {
    const setPaint = map.setPaintProperty.bind(map) as (
      id: string,
      name: string,
      nextValue: string | number
    ) => void;
    setPaint(layerId, property, value);
  } catch {
    // Upstream styles expose different paint properties by layer type.
  }
}

function safeSetVisibility(map: MapLibreMap, layerId: string, visible: boolean) {
  try {
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  } catch {
    // Ignore layers that do not support a visibility layout property.
  }
}

export function applyPosterStyle(
  map: MapLibreMap,
  bgColor: string,
  textColor: string,
  config: PosterConfig,
  layerPreset: MapLayerPreset
) {
  const style = map.getStyle();
  if (!style?.layers) return;

  const waterColor = mixHex(bgColor, textColor, 0.12);
  const parkColor = mixHex(bgColor, textColor, 0.08);
  const secondaryColor = mixHex(bgColor, textColor, 0.34);
  const preset = {
    everything: { labels: true, water: true, parks: true, minorRoads: true },
    city: { labels: true, water: true, parks: false, minorRoads: true },
    nature: { labels: false, water: true, parks: true, minorRoads: false },
    minimal: { labels: false, water: true, parks: false, minorRoads: false },
    transit: { labels: true, water: true, parks: false, minorRoads: false },
  }[layerPreset];

  for (const layer of style.layers) {
    const id = layer.id.toLowerCase();
    const isWater = /water|ocean|lake|river/.test(id);
    const isPark = /park|green|wood|forest|grass|landcover/.test(id);
    const isMinorRoad =
      /minor|residential|service|path|track|foot|pedestrian/.test(id);
    const isTransit = /rail|transit|subway|tram|ferry/.test(id);
    const isLabel = layer.type === "symbol";

    let visible = true;
    if (isLabel && (!config.show_labels || !preset.labels)) visible = false;
    if (isWater && (!config.show_water || !preset.water)) visible = false;
    if (isPark && (!config.show_parks || !preset.parks)) visible = false;
    if (isMinorRoad && (config.major_roads_only || !preset.minorRoads)) {
      visible = false;
    }
    if (layerPreset === "transit" && layer.type === "line" && !isTransit && isMinorRoad) {
      visible = false;
    }
    safeSetVisibility(map, layer.id, visible);

    if (layer.type === "background") {
      safeSetPaint(map, layer.id, "background-color", bgColor);
    } else if (layer.type === "fill") {
      safeSetPaint(
        map,
        layer.id,
        "fill-color",
        isWater ? waterColor : isPark ? parkColor : bgColor
      );
      safeSetPaint(map, layer.id, "fill-outline-color", secondaryColor);
    } else if (layer.type === "line") {
      safeSetPaint(map, layer.id, "line-color", isWater ? waterColor : textColor);
      safeSetPaint(map, layer.id, "line-opacity", isMinorRoad ? 0.42 : 0.72);
    } else if (layer.type === "symbol") {
      safeSetPaint(map, layer.id, "text-color", textColor);
      safeSetPaint(map, layer.id, "text-halo-color", bgColor);
      safeSetPaint(map, layer.id, "text-halo-width", 1.2);
      safeSetPaint(map, layer.id, "icon-color", textColor);
    } else if (layer.type === "circle") {
      safeSetPaint(map, layer.id, "circle-color", textColor);
      safeSetPaint(map, layer.id, "circle-stroke-color", bgColor);
    }
  }
}
