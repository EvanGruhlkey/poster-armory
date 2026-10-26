import { test } from "node:test";
import assert from "node:assert/strict";
import { getDigitalPosterDimensions, getPosterAttributionDpi } from "./live-poster-export";
import { MAP_ATTRIBUTION_TEXT, getMapAttributionLayout } from "./map-attribution";
import { DEFAULT_CONFIG } from "./types";

test("exports an 18x24 digital poster at 4800px on its long edge", () => {
  assert.deepEqual(getDigitalPosterDimensions(9, 12), { width: 3600, height: 4800 });
});

test("export attribution uses the shared copy and one-point layout", () => {
  const dpi = getPosterAttributionDpi({ ...DEFAULT_CONFIG, width: 9, height: 12 }, 3600, 4800);
  const layout = getMapAttributionLayout(3600, 4800, dpi);

  assert.equal(layout.text, MAP_ATTRIBUTION_TEXT);
  assert.equal(layout.fontSize, 200 / 72);
});

test("physical print attribution uses the product size to stay at one point", () => {
  const dpi = getPosterAttributionDpi(
    { ...DEFAULT_CONFIG, width: 15, height: 20, print_size_key: "18x24" },
    4500,
    6000,
  );

  assert.equal(dpi, 250);
  assert.equal(getMapAttributionLayout(4500, 6000, dpi).fontSize, 250 / 72);
});
