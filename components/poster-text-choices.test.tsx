import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONFIG } from "../lib/types";
import { PosterTextChoices } from "./poster-text-choices";

test("text controls expose four placements and nine style choices", () => {
  const html = renderToStaticMarkup(<PosterTextChoices config={DEFAULT_CONFIG} onChange={() => {}} />);
  for (const label of ["Below map", "Top", "Center", "Bottom", "Gallery", "Modern Bold", "Classic Serif", "Minimal Clean", "Editorial Strong", "Vintage Elegant", "Technical Mono", "Geometric Modern", "Condensed Impact"]) {
    assert.ok(html.includes(label), `missing ${label}`);
  }
  assert.match(html, /aria-pressed="true"[^>]*>Below map/);
});
