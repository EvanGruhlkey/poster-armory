import { test } from "node:test";
import assert from "node:assert/strict";
import type { PosterConfig } from "../types";
import { toRendererConfig, getPosterMapStyle } from "./adapter";

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
