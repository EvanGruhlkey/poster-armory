import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAP_ATTRIBUTION_FONT_POINTS,
  MAP_ATTRIBUTION_TEXT,
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
