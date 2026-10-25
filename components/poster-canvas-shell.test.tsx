import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PosterCanvasShell } from "./poster-canvas-shell";

test("poster canvas has no inset border between artwork and its outer edges", () => {
  const html = renderToStaticMarkup(
    <PosterCanvasShell aspectRatio="12 / 18">
      <span>Artwork</span>
    </PosterCanvasShell>,
  );

  assert.ok(html.includes('data-testid="poster-canvas-shell"'));
  assert.ok(html.includes("border-0"));
  assert.ok(html.includes("rounded-none"));
  assert.ok(html.includes("Artwork"));
});
