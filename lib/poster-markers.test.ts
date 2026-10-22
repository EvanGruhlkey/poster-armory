import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "./types";
import { posterConfigSchema } from "./validations";
import { getPosterMarkerOverlay } from "./poster-markers";
import { getPosterMapStyle } from "./poster-renderer/adapter";

test("center pin and custom marker labels become map features", () => {
  const config = { ...DEFAULT_CONFIG, center_marker: true, markers: [
    { lat: 31.8, lon: -106.4, label: "", type: "ring" as const, color: "#ff0000", size: 18 },
    { lat: 31.7, lon: -106.5, label: "Home", type: "heart" as const, color: "#00ff00", size: 20 },
  ] };
  const overlay = getPosterMarkerOverlay(config);
  assert.equal(overlay.points.features.length, 3);
  assert.equal(overlay.points.features.filter(feature => feature.properties.label).length, 1);
  assert.ok(getPosterMapStyle(config).layers.some(layer => layer.id === "poster-marker-points"));
  assert.ok(getPosterMapStyle(config).layers.some(layer => layer.id === "poster-marker-icons"));
});

test("route crossing the antimeridian is split into short segments", () => {
  const config = { ...DEFAULT_CONFIG, connect_markers: true, markers: [
    { lat: 10, lon: 179, label: "A" }, { lat: 11, lon: -179, label: "B" },
  ] };
  const lines = getPosterMarkerOverlay(config).route.coordinates;
  assert.equal(lines.length, 2);
  assert.ok(lines.every(line => line.length < 2 || Math.abs(line[0][0] - line[1][0]) <= 180));
});

test("marker color, size and route settings are validated", () => {
  const base = { ...DEFAULT_CONFIG, city: "Chicago" };
  assert.equal(posterConfigSchema.safeParse({ ...base, markers: [{ lat: 1, lon: 2, label: "A", type: "pin", color: "#123456", size: 24 }] }).success, true);
  assert.equal(posterConfigSchema.safeParse({ ...base, markers: [{ lat: 1, lon: 2, label: "A", color: "oops" }] }).success, false);
  assert.equal(posterConfigSchema.safeParse({ ...base, marker_path_width: 99 }).success, false);
});

test("route can fill an area and label segment lengths", () => {
  const config = { ...DEFAULT_CONFIG, connect_markers: true, show_segment_lengths: true, marker_fill_color: "#123456", markers: [
    { lat: 10, lon: 10, label: "A" }, { lat: 10, lon: 11, label: "B" }, { lat: 11, lon: 11, label: "C" },
  ] };
  const overlay = getPosterMarkerOverlay(config);
  assert.equal(overlay.segmentLabels.features.length, 2);
  assert.ok(overlay.fill);
  const ids = getPosterMapStyle(config).layers.map(layer => layer.id);
  assert.ok(ids.includes("poster-marker-fill"));
  assert.ok(ids.includes("poster-marker-segments"));
});
