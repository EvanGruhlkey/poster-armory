import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "./types";
import { posterConfigSchema } from "./validations";
import { getPosterMapStyle } from "./poster-renderer/adapter";
import { getPosterGrid, getPosterScaleBar, resolvePosterLabels } from "./poster-labels";

test("old poster labels retain master visibility and default groups", () => {
  const labels = resolvePosterLabels(DEFAULT_CONFIG);
  assert.equal(labels.show, DEFAULT_CONFIG.show_labels);
  assert.equal(labels.admin, true);
  assert.equal(labels.cities, true);
  assert.equal(labels.streets, true);
});

test("individual map name groups affect generated style", () => {
  const config = { ...DEFAULT_CONFIG, show_labels: true, label_cities: false, label_streets: true };
  const ids = getPosterMapStyle(config).layers.map(layer => layer.id);
  assert.ok(!ids.includes("labels-city"));
  assert.ok(ids.includes("labels-streets"));
});

test("label sizes and grid density are bounded", () => {
  const base = { ...DEFAULT_CONFIG, city: "Chicago" };
  assert.equal(posterConfigSchema.safeParse({ ...base, label_size: 16, grid_density: 5 }).success, true);
  assert.equal(posterConfigSchema.safeParse({ ...base, label_size: 100 }).success, false);
  assert.equal(posterConfigSchema.safeParse({ ...base, grid_density: 3 }).success, false);
});

test("grid and scale remain tied to geographic map coordinates", () => {
  const config = { ...DEFAULT_CONFIG, show_grid: true, show_scale: true, grid_density: 10 as const };
  const grid = getPosterGrid(config);
  assert.ok(grid.features.length > 4);
  assert.equal(grid.features[0].geometry.type, "LineString");
  const scale = getPosterScaleBar(config, 330);
  assert.ok(scale.widthPx > 0 && scale.widthPx < 165);
  assert.ok(scale.label.endsWith("km") || scale.label.endsWith("m"));
  const map = getPosterMapStyle(config);
  assert.ok(map.sources["poster-grid"]);
  assert.ok(map.layers.some(layer => layer.id === "poster-grid-lines"));
});
