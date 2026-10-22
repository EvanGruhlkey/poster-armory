import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONFIG } from "../lib/types";
import { PosterMapControls } from "./poster-map-controls";

test("map controls show simple camera choices and tuck detailed layers away", () => {
  const html = renderToStaticMarkup(<PosterMapControls config={DEFAULT_CONFIG} pitch={0} onChange={() => {}} onPitchChange={() => {}} />);
  for (const label of ["Flat", "Isometric", "Water", "Parks", "Map names", "More options", "Railroads", "Road weight"]) {
    assert.ok(html.includes(label), `missing ${label}`);
  }
  assert.match(html, /Bird(?:'|&#x27;)s eye/);
});
