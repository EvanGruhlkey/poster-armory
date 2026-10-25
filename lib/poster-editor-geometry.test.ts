import { test } from "node:test";
import assert from "node:assert/strict";
import { fitPosterInStage } from "./poster-editor-geometry";

test("portrait poster fits within the available stage", () => {
  const result = fitPosterInStage(900, 720, 2 / 3, 24);
  assert.ok(result.width <= 852);
  assert.ok(result.height <= 672);
  assert.equal(result.width / result.height, 2 / 3);
});

test("landscape poster fits a narrow mobile stage without cropping", () => {
  const result = fitPosterInStage(390, 630, 3 / 2, 16);
  assert.ok(result.width <= 358);
  assert.ok(result.height <= 598);
  assert.equal(result.width / result.height, 3 / 2);
});
