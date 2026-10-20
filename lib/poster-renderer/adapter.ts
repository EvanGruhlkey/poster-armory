import type { StyleSpecification } from "maplibre-gl";
import type { PosterConfig } from "@/lib/types";
import type { PosterConfig as RendererConfig, PosterStyle, ColorPalette } from "./types";
import { getDefaultStyle, getStyleById } from "./styles";

const STYLE_MAP: Record<string, string> = {
  warm_beige: "minimal", terracotta: "vintage", noir: "dark-mode",
  blueprint: "blueprint", midnight_blue: "midnight", ocean: "minimal",
  forest: "organic", sunset: "vintage", autumn: "vintage",
  emerald: "midnight", copper_patina: "vintage", japanese_ink: "minimal",
  pastel_dream: "watercolor", monochrome_blue: "blueprint",
  neon_cyberpunk: "midnight", contrast_zones: "dark-mode",
  gradient_roads: "abstract",
};

function selectStyle(config: PosterConfig): PosterStyle {
  return getStyleById(STYLE_MAP[config.style_id] ?? config.style_id) ?? getDefaultStyle();
}

function selectPalette(style: PosterStyle, config: PosterConfig): ColorPalette {
  const preferred: Record<string, string> = {
    warm_beige: "minimal-navy",
    ocean: "minimal-navy",
    japanese_ink: "minimal-ink",
  };
  const selected = style.palettes.find((palette) => palette.id === config.palette_id)
    ?? style.palettes.find((palette) => palette.id === preferred[config.style_id])
    ?? style.defaultPalette;
  const colors = config.custom_colors ?? {};
  const palette = structuredClone(selected);
  for (const key of ["background", "text", "border", "water", "waterLine", "greenSpace", "landuse", "buildings", "accent", "contour", "hillshade"] as const) {
    if (colors[key]) (palette as unknown as Record<string, string>)[key] = colors[key];
  }
  for (const key of ["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "service", "railroad"] as const) {
    if (colors[`roads.${key}`]) palette.roads[key] = colors[`roads.${key}`];
  }
  return palette;
}

function recolorStyle(mapStyle: StyleSpecification, from: ColorPalette, to: ColorPalette) {
  const colors = new Map<string, string>();
  for (const key of ["background", "text", "border", "water", "waterLine", "greenSpace", "landuse", "buildings", "accent", "contour", "hillshade"] as const) {
    if (from[key] && to[key]) colors.set(from[key]!.toLowerCase(), to[key]!);
  }
  for (const key of ["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "service", "railroad"] as const) {
    if (from.roads[key] && to.roads[key]) colors.set(from.roads[key]!.toLowerCase(), to.roads[key]!);
  }
  const replace = (value: unknown): unknown => {
    if (typeof value === "string") return colors.get(value.toLowerCase()) ?? value;
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replace(child)]));
    return value;
  };
  for (const layer of mapStyle.layers) {
    if ("paint" in layer && layer.paint) layer.paint = replace(layer.paint) as typeof layer.paint;
  }
}

function scaleZoomStops(value: unknown, factor: number): unknown {
  if (typeof value === "number") return value * factor;
  if (!Array.isArray(value) || !Array.isArray(value[2]) || value[2][0] !== "zoom") return value;
  if (value[0] !== "interpolate" && value[0] !== "step") return value;
  const scaled = [...value];
  for (let index = value[0] === "step" ? 2 : 4; index < scaled.length; index += 2) {
    scaled[index] = typeof scaled[index] === "number"
      ? scaled[index] * factor
      : ["*", scaled[index], factor];
  }
  return scaled;
}

export function getPosterPalette(config: PosterConfig): ColorPalette {
  return selectPalette(selectStyle(config), config);
}

export function getPosterMapStyle(config: PosterConfig): StyleSpecification {
  const style = selectStyle(config);
  const palette = selectPalette(style, config);
  const mapStyle = structuredClone(style.mapStyle) as StyleSpecification;
  recolorStyle(mapStyle, style.defaultPalette, palette);
  mapStyle.sources = { ...mapStyle.sources };
  if ((config.pitch ?? 0) > 0 && config.map_layers?.terrain !== false && mapStyle.sources.terrain) {
    mapStyle.terrain = { source: "terrain", exaggeration: config.terrain_exaggeration ?? 1.5 };
  } else {
    delete mapStyle.terrain;
  }
  // These optional sources require upstream-only routes or protocols.
  delete mapStyle.sources.contours;
  delete mapStyle.sources.population;
  delete mapStyle.sources.spaceports;
  const hiddenLayerIds = new Set(style.layerToggles
    .filter((toggle) => config.map_layers?.[toggle.id] === false)
    .flatMap((toggle) => toggle.layerIds));
  mapStyle.layers = mapStyle.layers.filter((layer) => {
    if (hiddenLayerIds.has(layer.id)) return false;
    const source = "source" in layer ? layer.source : undefined;
    if (source === "contours" || source === "population" || source === "spaceports") return false;
    if (!config.show_water && /water|river|lake/.test(layer.id)) return false;
    if (!config.show_parks && /park|green|forest|landcover/.test(layer.id)) return false;
    if (!config.show_labels && /labels|street-name/.test(layer.id)) return false;
    if (config.major_roads_only && /^(road|bridge)-(service|residential|tertiary|secondary)(-|$)/.test(layer.id)) return false;
    return true;
  });
  // Preserve the imported layer ordering and road hierarchy while using its palette.
  const background = mapStyle.layers.find((layer) => layer.id === "background");
  if (background?.type === "background") background.paint = { ...background.paint, "background-color": palette.background };
  for (const layer of mapStyle.layers) {
    if (layer.type === "line" && /^(road|bridge)-/.test(layer.id) && config.road_weight && config.road_weight !== 1) {
      const width = layer.paint?.["line-width"];
      if (width !== undefined) {
        layer.paint = { ...layer.paint, "line-width": scaleZoomStops(width, config.road_weight) as typeof width };
      }
    }
    if (layer.type === "hillshade" && config.terrain_exaggeration !== undefined) {
      layer.paint = { ...layer.paint, "hillshade-exaggeration": config.terrain_exaggeration };
    }
    if (layer.type === "fill-extrusion" && layer.id === "buildings-3d") {
      const height = layer.paint?.["fill-extrusion-height"];
      if (height !== undefined && config.building_height_scale !== undefined) {
        layer.paint = { ...layer.paint, "fill-extrusion-height": scaleZoomStops(height, config.building_height_scale) as typeof height };
      }
    }
  }
  return mapStyle;
}

export function toRendererConfig(config: PosterConfig): RendererConfig {
  const style = selectStyle(config);
  const palette = selectPalette(style, config);
  return {
    location: {
      name: config.title?.trim() || config.city,
      city: config.city,
      subtitle: config.subtitle?.trim() || config.country,
      center: [config.lon, config.lat],
      bounds: [[config.lon, config.lat], [config.lon, config.lat]],
      zoom: 12,
    },
    style,
    palette,
    typography: {
      titleFont: "Inter", titleSize: 48, titleWeight: 600,
      subtitleFont: "Inter", subtitleSize: 22, position: "bottom",
      showCoordinates: config.show_coordinates,
      showTitle: true, showSubtitle: true,
    },
    format: {
      aspectRatio: "3:4", orientation: config.orientation === "landscape" ? "landscape" : "portrait",
      margin: 8, borderStyle: config.show_border ? "thin" : "none",
    },
    layers: {
      streets: true, buildings: true, water: config.show_water,
      parks: config.show_parks, terrain: true, terrainUnderWater: false,
      hillshadeExaggeration: 0.6, contours: false, contourDensity: 100,
      population: false, labels: config.show_labels, labelSize: 1,
      labelMaxWidth: 10, marker: false, roadWeight: 1,
      railroads: true, buildings3D: true,
      buildings3DPitch: config.pitch ?? 0,
      buildings3DBearing: config.rotation ?? 0,
    },
  };
}
