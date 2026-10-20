import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "./types";
import { posterConfigSchema } from "./validations";
import { applyPosterPalette, applyPosterStyle, resolvePosterCustomization } from "./poster-customization";

test("old configs resolve to their existing palette and map defaults", () => {
  const resolved = resolvePosterCustomization(DEFAULT_CONFIG);
  assert.equal(resolved.paletteId, null);
  assert.equal(resolved.roadWeight, 1);
  assert.deepEqual(resolved.customColors, {});
});

test("palette selection preserves unrelated poster settings", () => {
  const config = { ...DEFAULT_CONFIG, title: "Home", rotation: 20 };
  const updated = { ...config, ...applyPosterPalette(config, "minimal-navy") };
  assert.equal(updated.title, "Home");
  assert.equal(updated.rotation, 20);
  assert.equal(updated.palette_id, "minimal-navy");
});

test("custom colors and map detail ranges are validated", () => {
  const base = { ...DEFAULT_CONFIG, city: "Chicago" };
  assert.equal(posterConfigSchema.safeParse({ ...base, custom_colors: { water: "#123456" }, road_weight: 2 }).success, true);
  assert.equal(posterConfigSchema.safeParse({ ...base, custom_colors: { water: "oops" } }).success, false);
  assert.equal(posterConfigSchema.safeParse({ ...base, road_weight: 9 }).success, false);
  assert.equal(posterConfigSchema.safeParse({ ...base, terrain_exaggeration: -1 }).success, false);
});

test("changing style clears its palette but preserves poster copy", () => {
  const config = { ...DEFAULT_CONFIG, city: "Chicago", title: "Home", palette_id: "minimal-navy" };
  const updated = { ...config, ...applyPosterStyle(config, "retro") };
  assert.equal(updated.title, "Home");
  assert.equal(updated.style_id, "retro");
  assert.equal(updated.palette_id, undefined);
  assert.equal(posterConfigSchema.safeParse(updated).success, true);
});
