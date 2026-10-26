import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MapAttribution } from "./map-attribution";

test("renders linked map providers outside the artwork", () => {
  const html = renderToStaticMarkup(<MapAttribution />);

  assert.match(html, /Map data ©/);
  assert.match(html, /href="https:\/\/www\.openstreetmap\.org\/copyright"/);
  assert.match(html, /href="https:\/\/openfreemap\.org\/"/);
});

test("the live poster map does not embed attribution in the artwork", () => {
  const source = readFileSync(new URL("./live-poster-map.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /OpenStreetMap contributors|OpenFreeMap/);
});
