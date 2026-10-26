import { test } from "node:test";
import assert from "node:assert/strict";
import { getDigitalPosterDimensions } from "./live-poster-export";
import { MAP_ATTRIBUTION_TEXT, getMapAttributionLayout } from "./map-attribution";

test("exports an 18x24 digital poster at 4800px on its long edge", () => {
  assert.deepEqual(getDigitalPosterDimensions(9, 12), { width: 3600, height: 4800 });
});

test("export attribution uses the shared copy and one-point layout", () => {
  const layout = getMapAttributionLayout(3600, 4800);

  assert.equal(layout.text, MAP_ATTRIBUTION_TEXT);
  assert.equal(layout.fontSize, 300 / 72);
});
