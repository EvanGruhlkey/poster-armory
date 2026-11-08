import { test } from "node:test";
import assert from "node:assert/strict";
import { fitMapToGpu, getPosterMapDimensions, zoomForExportWidth } from "./export";

test("calculates native-resolution map dimensions for the poster frame", () => {
  assert.deepEqual(getPosterMapDimensions(1800, 2400), {
    x: 108, y: 120, width: 1584, height: 1728,
  });
});

test("supports a freely resized inner map", () => {
  assert.deepEqual(getPosterMapDimensions(1800, 2400, { left: 0, top: 0, right: 0.1, bottom: 0.2 }), {
    x: 0, y: 0, width: 1620, height: 1920,
  });
});

test("preserves preview framing at print resolution", () => {
  assert.equal(zoomForExportWidth(13, 660), 14);
});

test("draws print maps at full size through an 18x24 file", () => {
  assert.deepEqual(fitMapToGpu(4224, 4320), { width: 4224, height: 4320 });
  assert.deepEqual(fitMapToGpu(4752, 5184), { width: 4752, height: 5184 });
});

test("scales a map that exceeds the WebGL edge", () => {
  assert.deepEqual(fitMapToGpu(10000, 5000), { width: 8192, height: 4096 });
});
