import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "./types";
import { getPosterMapDimensions } from "./poster-renderer/export";
import { getPosterTextLayout, getPosterTextBackdrop, getPosterTextMetrics } from "./poster-text-layout";

test("placement changes text box without changing map crop", () => {
  const map = getPosterMapDimensions(900, 1200);
  const layouts = (["below", "top", "center", "bottom"] as const).map((text_placement) =>
    getPosterTextLayout({ ...DEFAULT_CONFIG, text_placement }, 900, 1200));
  for (const layout of layouts) assert.deepEqual(layout.map, map);
  assert.ok(layouts[0].text.y > map.y + map.height);
  assert.ok(layouts[1].text.y < layouts[2].text.y);
  assert.ok(layouts[2].text.y < layouts[3].text.y);
  for (const layout of layouts.slice(1)) {
    assert.ok(layout.text.x >= map.x);
    assert.ok(layout.text.y + layout.text.height <= map.y + map.height);
    assert.ok(layout.maxTextWidth <= layout.text.width);
  }
});

test("landscape on-map text remains inside the map", () => {
  const layout = getPosterTextLayout({ ...DEFAULT_CONFIG, text_placement: "bottom" }, 1200, 900);
  assert.ok(layout.text.y + layout.text.height <= layout.map.y + layout.map.height);
  const metrics = getPosterTextMetrics({ ...DEFAULT_CONFIG, text_placement: "bottom", typography_preset: "condensed-impact" }, 1200, 900);
  assert.ok(metrics.blockHeight <= layout.text.height * 0.82);
});

test("uses saved freeform text bounds", () => {
  const layout = getPosterTextLayout({
    ...DEFAULT_CONFIG,
    text_bounds: { x: 0.1, y: 0.2, width: 0.8, height: 0.3 },
  }, 1000, 1200);
  assert.deepEqual(layout.text, { x: 100, y: 240, width: 800, height: 360 });
});

test("backdrop follows preset unless manually overridden", () => {
  const strong = { ...DEFAULT_CONFIG, typography_preset: "editorial-strong" as const, text_placement: "top" as const };
  assert.equal(getPosterTextBackdrop(strong).kind, "strong");
  assert.equal(getPosterTextBackdrop({ ...strong, text_backdrop: "none" }).kind, "none");
});
