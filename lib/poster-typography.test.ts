import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "./types";
import { posterConfigSchema } from "./validations";
import { applyTextPlacement, applyTypographyCustomization, applyTypographyPreset, fitTitleScale, resolvePosterTypography } from "./poster-typography";

test("old poster configs use Gallery typography", () => {
  const typography = resolvePosterTypography(DEFAULT_CONFIG);
  assert.equal(typography.preset, "gallery");
  assert.equal(typography.titleFont, "Inter");
  assert.equal(typography.frameStyle, "fine");
  assert.equal(typography.subtitleSize * typography.subtitleTracking, 0.5);
});

test("saved custom Playfair posters retain their original title weight", () => {
  const typography = resolvePosterTypography({ ...DEFAULT_CONFIG, typography_preset: "custom", title_font: "Playfair Display" });
  assert.equal(typography.titleWeight, 700);
});

test("presets set a complete look without changing poster words", () => {
  const config = { ...DEFAULT_CONFIG, title: "Our City" };
  const editorial = { ...config, ...applyTypographyPreset(config, "editorial") };
  assert.equal(editorial.title, "Our City");
  assert.equal(resolvePosterTypography(editorial).titleFont, "Playfair Display");
  assert.equal(resolvePosterTypography(editorial).titleSize, 5.5);
  assert.equal(resolvePosterTypography(editorial).frameStyle, "double");
  const modern = { ...config, ...applyTypographyPreset(config, "modern") };
  assert.equal(resolvePosterTypography(modern).titleFont, "Oswald");
  assert.equal(resolvePosterTypography(modern).frameStyle, "none");
});

test("reference presets carry their title and subtitle looks", () => {
  const cases = [
    ["modern-bold", "Inter", 8, 700, "Inter", 2.5, true, "subtle"],
    ["classic-serif", "Playfair Display", 7.5, 600, "Montserrat", 2, false, "gradient"],
    ["minimal-clean", "Inter", 6, 400, "Inter", 1.8, false, "none"],
    ["editorial-strong", "Montserrat", 9.5, 900, "Crimson Text", 2.2, true, "strong"],
    ["vintage-elegant", "Crimson Text", 7, 600, "Crimson Text", 2.5, false, "subtle"],
    ["technical-mono", "JetBrains Mono", 6.5, 700, "JetBrains Mono", 1.5, true, "none"],
    ["geometric-modern", "Poppins", 8.5, 600, "Poppins", 2.3, false, "gradient"],
    ["condensed-impact", "Montserrat", 10, 800, "Inter", 1.6, true, "strong"],
  ] as const;
  for (const [preset, titleFont, titleSize, titleWeight, subtitleFont, subtitleSize, allCaps, backdrop] of cases) {
    const config = { ...DEFAULT_CONFIG, title: "Home", text_placement: "top" as const };
    const styled = { ...config, ...applyTypographyPreset(config, preset) };
    const type = resolvePosterTypography(styled);
    assert.equal(styled.title, "Home");
    assert.equal(styled.text_placement, "top");
    assert.deepEqual([type.titleFont, type.titleSize, type.titleWeight, type.subtitleFont, type.subtitleSize, type.titleAllCaps, type.textBackdrop],
      [titleFont, titleSize, titleWeight, subtitleFont, subtitleSize, allCaps, backdrop]);
  }
});

test("placement changes independently of style and defaults below the map", () => {
  assert.equal(resolvePosterTypography(DEFAULT_CONFIG).textPlacement, "below");
  const updates = applyTextPlacement(DEFAULT_CONFIG, "center");
  assert.deepEqual(updates, { text_placement: "center", text_bounds: undefined });
  assert.equal(({ ...DEFAULT_CONFIG, ...updates }).title, DEFAULT_CONFIG.title);
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
  assert.equal(posterConfigSchema.safeParse({ ...config, text_placement: "left" }).success, false);
  assert.equal(posterConfigSchema.safeParse({ ...config, subtitle_font: "Unknown" }).success, false);
});

test("long titles fit the same maximum width as canvas output", () => {
  assert.equal(fitTitleScale(400, 300), 0.75);
  assert.equal(fitTitleScale(200, 300), 1);
});
