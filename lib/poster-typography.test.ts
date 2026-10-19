import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "./types";
import { posterConfigSchema } from "./validations";
import { applyTypographyCustomization, applyTypographyPreset, fitTitleScale, resolvePosterTypography } from "./poster-typography";

test("old poster configs use Gallery typography", () => {
  const typography = resolvePosterTypography(DEFAULT_CONFIG);
  assert.equal(typography.preset, "gallery");
  assert.equal(typography.titleFont, "Inter");
  assert.equal(typography.frameStyle, "fine");
});

test("presets set a complete look without changing poster words", () => {
  const config = { ...DEFAULT_CONFIG, title: "Our City" };
  const editorial = { ...config, ...applyTypographyPreset(config, "editorial") };
  assert.equal(editorial.title, "Our City");
  assert.deepEqual(resolvePosterTypography(editorial), {
    preset: "editorial", titleFont: "Playfair Display", titleSize: 5.5,
    titleTracking: 0.06, frameStyle: "double", titleWeight: 700,
  });
  const modern = { ...config, ...applyTypographyPreset(config, "modern") };
  assert.equal(resolvePosterTypography(modern).titleFont, "Oswald");
  assert.equal(resolvePosterTypography(modern).frameStyle, "none");
});

test("manual customization switches to Custom while preserving content", () => {
  const config = { ...DEFAULT_CONFIG, title: "El Paso" };
  const updates = applyTypographyCustomization(config, { title_size: 6 });
  assert.equal(updates.typography_preset, "custom");
  assert.equal(updates.title_size, 6);
  assert.equal(({ ...config, ...updates }).title, "El Paso");
});

test("poster validation rejects unknown fonts and extreme type sizes", () => {
  const config = { ...DEFAULT_CONFIG, city: "Chicago" };
  assert.equal(posterConfigSchema.safeParse({ ...config, title_font: "Unknown" }).success, false);
  assert.equal(posterConfigSchema.safeParse({ ...config, title_size: 12 }).success, false);
  assert.equal(posterConfigSchema.safeParse({ ...config, title_tracking: 0.5 }).success, false);
});

test("long titles fit the same maximum width as canvas output", () => {
  assert.equal(fitTitleScale(400, 300), 0.75);
  assert.equal(fitTitleScale(200, 300), 1);
});
