import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PosterEditorSidebar, nextPosterTool } from "./poster-editor-sidebar";

test("tools start collapsed and do not show settings until chosen", () => {
  const html = renderToStaticMarkup(
    <PosterEditorSidebar activeTool={null} onToolChange={() => {}}>
      <p>Hidden settings</p>
    </PosterEditorSidebar>,
  );
  for (const label of ["Map", "Text", "Colors", "Finish"]) {
    assert.ok(html.includes(label), `missing ${label}`);
  }
  assert.ok(!html.includes("Hidden settings"));
  assert.ok(!html.includes('role="dialog"'));
  assert.equal(nextPosterTool(null, "map"), "map");
  assert.equal(nextPosterTool("map", "map"), null);
  assert.equal(nextPosterTool("map", "type"), "type");
});

test("selected tool opens a labelled, closeable settings panel", () => {
  const html = renderToStaticMarkup(
    <PosterEditorSidebar activeTool="type" onToolChange={() => {}}>
      <p>Text settings</p>
    </PosterEditorSidebar>,
  );
  assert.ok(html.includes('aria-pressed="true"'));
  assert.ok(html.includes('aria-expanded="true"'));
  assert.ok(html.includes('aria-label="Close Text settings"'));
  assert.ok(html.includes("Text settings"));
});
