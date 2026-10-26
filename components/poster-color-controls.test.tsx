import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CONFIG } from "../lib/types";
import { PosterColorControls } from "./poster-color-controls";

test("one theme picker includes every map look and keeps custom colors collapsed", () => {
  const html = renderToStaticMarkup(<PosterColorControls config={DEFAULT_CONFIG} onChange={() => {}} />);
  for (const label of ["Theme", "Minimal", "Retro", "Custom colors", "Water", "Roads", "Text"]) {
    assert.ok(html.includes(label), `missing ${label}`);
  }
  assert.equal((html.match(/<select\b/g) ?? []).length, 1);
  assert.ok(html.includes('value="minimal:minimal-navy"'));
  assert.ok(!html.includes(">Palette</label>"));
});
