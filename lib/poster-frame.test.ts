import { test } from "node:test";
import assert from "node:assert/strict";
import { getOuterPosterFrameStrokes, getPosterFrameStrokes } from "./poster-frame";
import { getPosterMapDimensions } from "./poster-renderer/export";

test("frame styles decorate the existing map rectangle", () => {
  const map = getPosterMapDimensions(1800, 2400);
  assert.deepEqual(getPosterFrameStrokes("none", 1800, 2400), []);
  const fine = getPosterFrameStrokes("fine", 1800, 2400);
  assert.deepEqual(fine, [{ ...map, lineWidth: 2 }]);
  const double = getPosterFrameStrokes("double", 1800, 2400);
  assert.deepEqual(double[0], fine[0]);
  assert.ok(double[1].x > map.x);
  assert.ok(double[1].width < map.width);
});

test("outer border frames the complete poster", () => {
  assert.deepEqual(getOuterPosterFrameStrokes("none", 1800, 2400), []);
  assert.deepEqual(getOuterPosterFrameStrokes("fine", 1800, 2400), [
    { x: 45, y: 45, width: 1710, height: 2310, lineWidth: 3 },
  ]);
  assert.equal(getOuterPosterFrameStrokes("double", 1800, 2400).length, 2);
});
