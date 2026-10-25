import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONFIG } from "../lib/types";
import { PosterColorControls } from "./poster-color-controls";

test("color controls expose styles and palettes with custom colors behind more options", () => {
  const html = renderToStaticMarkup(<PosterColorControls config={DEFAULT_CONFIG} onChange={() => {}} />);
  for (const label of ["Style", "Palette", "Minimal", "Retro", "More options", "Water", "Roads", "Text"]) {
    assert.ok(html.includes(label), `missing ${label}`);
  }
});
