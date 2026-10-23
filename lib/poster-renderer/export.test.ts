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

test("fits the widest print map into a safe WebGL canvas", () => {
  assert.deepEqual(fitMapToGpu(4224, 4320), { width: 4000, height: 4091 });
});
