import { test } from "node:test";
import assert from "node:assert/strict";
import { fitMapToGpu, getPosterMapDimensions, zoomForExportWidth } from "./export";

test("calculates native-resolution map dimensions for the poster frame", () => {
  assert.deepEqual(getPosterMapDimensions(1800, 2400), {
    x: 108, y: 120, width: 1584, height: 1728,
  });
});

test("preserves preview framing at print resolution", () => {
  assert.equal(zoomForExportWidth(13, 660), 14);
});

test("fits the widest print map into a safe WebGL canvas", () => {
  assert.deepEqual(fitMapToGpu(4224, 4320), { width: 4000, height: 4091 });
});
