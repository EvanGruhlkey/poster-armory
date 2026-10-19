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
  return style.palettes.find((palette) => palette.id === preferred[config.style_id]) ?? style.defaultPalette;
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

export function getPosterPalette(config: PosterConfig): ColorPalette {
  return selectPalette(selectStyle(config), config);
}

export function getPosterMapStyle(config: PosterConfig): StyleSpecification {
  const style = selectStyle(config);
  const palette = selectPalette(style, config);
  const mapStyle = structuredClone(style.mapStyle) as StyleSpecification;
  recolorStyle(mapStyle, style.defaultPalette, palette);
  mapStyle.sources = { ...mapStyle.sources };
  // These optional sources require upstream-only routes or protocols.
  delete mapStyle.sources.contours;
  delete mapStyle.sources.population;
  delete mapStyle.sources.spaceports;
  mapStyle.layers = mapStyle.layers.filter((layer) => {
    const source = "source" in layer ? layer.source : undefined;
    if (source === "contours" || source === "population" || source === "spaceports") return false;
    if (!config.show_water && /water|river|lake/.test(layer.id)) return false;
    if (!config.show_parks && /park|green|forest|landcover/.test(layer.id)) return false;
    if (!config.show_labels && /labels|street-name/.test(layer.id)) return false;
    return true;
  });
  // Preserve the imported layer ordering and road hierarchy while using its palette.
  const background = mapStyle.layers.find((layer) => layer.id === "background");
  if (background?.type === "background") background.paint = { ...background.paint, "background-color": palette.background };
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
