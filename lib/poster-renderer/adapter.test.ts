import { test } from "node:test";
import assert from "node:assert/strict";
import type { PosterConfig } from "../types";
import { toRendererConfig, getPosterMapStyle, getPosterPalette } from "./adapter";

const saved = {
  style_id: "warm_beige",
  city: "El Paso",
  country: "United States",
  lat: 31.7601,
  lon: -106.487,
  distance: 8000,
  title: "Home",
  subtitle: "Texas",
  show_labels: true,
  show_water: true,
  show_parks: true,
} as PosterConfig;

test("maps a saved design into a renderable style without losing location or copy", () => {
  const converted = toRendererConfig(saved);
  assert.equal(converted.location.center[0], saved.lon);
  assert.equal(converted.location.center[1], saved.lat);
  assert.equal(converted.location.name, saved.title);
  assert.equal(converted.location.subtitle, saved.subtitle);
  assert.equal(converted.layers.buildings3DPitch, 0);
  assert.equal(converted.layers.buildings3DBearing, 0);
  assert.ok(getPosterMapStyle(saved).layers.length > 10);
});

test("unknown old style falls back to an available poster style", () => {
  assert.ok(toRendererConfig({ ...saved, style_id: "unknown" }).style.mapStyle.layers.length > 10);
});

test("chosen palette recolors the imported road hierarchy", () => {
  const motorway = getPosterMapStyle(saved).layers.find((layer) => layer.id === "road-motorway");
  assert.equal(motorway?.type, "line");
  if (motorway?.type === "line") assert.equal(motorway.paint?.["line-color"], "#0F2840");
});

test("selected palette and custom water color reach map style", () => {
  const config = { ...saved, palette_id: "minimal-charcoal", custom_colors: { water: "#123456" } };
  assert.equal(getPosterPalette(config).water, "#123456");
  const layer = getPosterMapStyle(config).layers.find((item) => item.id === "water");
  assert.equal(layer?.type, "fill");
  if (layer?.type === "fill") assert.equal(layer.paint?.["fill-color"], "#123456");
});

test("major roads only hides residential and service streets", () => {
  const ids = getPosterMapStyle({ ...saved, major_roads_only: true }).layers.map((layer) => layer.id);
  assert.ok(ids.includes("road-motorway"));
  assert.ok(!ids.includes("road-residential"));
  assert.ok(!ids.includes("road-service"));
});

test("individual imported layers can be hidden without removing roads", () => {
  const ids = getPosterMapStyle({ ...saved, map_layers: { railroads: false, buildings: false } }).layers.map((layer) => layer.id);
  assert.ok(!ids.includes("railroad-main"));
  assert.ok(!ids.includes("buildings"));
  assert.ok(ids.includes("road-primary"));
});

test("road weight changes generated street paint", () => {
  const normal = getPosterMapStyle(saved).layers.find((item) => item.id === "road-primary");
  const wide = getPosterMapStyle({ ...saved, road_weight: 2 }).layers.find((item) => item.id === "road-primary");
  assert.equal(wide?.type, "line");
  if (wide?.type !== "line" || normal?.type !== "line") return;
  const baseWidth = normal.paint?.["line-width"] as unknown[];
  const wideWidth = wide.paint?.["line-width"] as unknown[];
  assert.equal(wideWidth[0], "interpolate");
  assert.equal(wideWidth[4], Number(baseWidth[4]) * 2);
});

test("tilted view raises terrain while flat view remains top down", () => {
  const flat = getPosterMapStyle({ ...saved, pitch: 0 });
  const tilted = getPosterMapStyle({ ...saved, pitch: 45, terrain_exaggeration: 2 });
  assert.equal(flat.terrain, undefined);
  assert.equal(tilted.terrain?.source, "terrain");
  assert.equal(tilted.terrain?.exaggeration, 2);
});
