import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAP_ATTRIBUTION_FONT_POINTS,
  MAP_ATTRIBUTION_TEXT,
  getMapAttributionLayout,
  pointsToPixels,
} from "./map-attribution";

test("defines the shared map attribution copy and one-point print size", () => {
  assert.equal(MAP_ATTRIBUTION_TEXT, "Map data © OpenStreetMap · OpenFreeMap");
  assert.equal(MAP_ATTRIBUTION_FONT_POINTS, 1);
  assert.equal(pointsToPixels(1), 300 / 72);
});

test("falls back to 300 DPI when DPI is invalid", () => {
  assert.equal(pointsToPixels(1, 0), 300 / 72);
  assert.equal(pointsToPixels(1, Number.NaN), 300 / 72);
});

test("places a one-point credit inside the safe area for portrait and landscape exports", () => {
  for (const [width, height] of [[3600, 4800], [4800, 3600]]) {
    const layout = getMapAttributionLayout(width, height);

    assert.equal(layout.fontSize, 300 / 72);
    assert.ok(layout.x >= width * 0.01);
    assert.ok(layout.y <= height - height * 0.01);
    assert.ok(layout.x < width);
    assert.ok(layout.y > 0);
  }
});

test("keeps attribution coordinates nonnegative on small valid canvases", () => {
  const layout = getMapAttributionLayout(1, 1);

  assert.ok(layout.x >= 0);
  assert.ok(layout.y >= 0);
});
