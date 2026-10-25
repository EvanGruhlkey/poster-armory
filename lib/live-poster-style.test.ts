import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceToZoom, MAX_POSTER_ZOOM, zoomToDistance } from "./live-poster-style";
import { posterConfigSchema } from "./validations";
import { DEFAULT_CONFIG } from "./types";

test("close map zooms round-trip without snapping back to the old minimum", () => {
  const distance = zoomToDistance(MAX_POSTER_ZOOM);

  assert.ok(distance < 1000);
  assert.ok(Math.abs(distanceToZoom(distance) - MAX_POSTER_ZOOM) < 0.01);
  assert.equal(
    posterConfigSchema.safeParse({ ...DEFAULT_CONFIG, city: "Test City", distance }).success,
    true,
  );
});
