import { test } from "node:test";
import assert from "node:assert/strict";
import { getDigitalPosterDimensions } from "./live-poster-export";

test("exports an 18x24 digital poster at 4800px on its long edge", () => {
  assert.deepEqual(getDigitalPosterDimensions(9, 12), { width: 3600, height: 4800 });
});
