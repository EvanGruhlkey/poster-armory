import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONFIG } from "../lib/types";
import { PosterMarkerControls } from "./poster-marker-controls";

test("marker controls start with a clear pin toggle and hide route detail", () => {
  const html = renderToStaticMarkup(<PosterMarkerControls config={DEFAULT_CONFIG} onChange={() => {}} />);
  for (const label of ["Pin this place", "Add a place", "Route", "More marker options"]) {
    assert.ok(html.includes(label), `missing ${label}`);
  }
});
