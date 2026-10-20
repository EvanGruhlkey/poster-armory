import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PosterEditorSidebar } from "./poster-editor-sidebar";

test("poster sidebar keeps four simple tabs and one active section", () => {
  const html = renderToStaticMarkup(
    <PosterEditorSidebar activeTool="map" onToolChange={() => {}}>
      <details><summary>More options</summary>Fine controls</details>
    </PosterEditorSidebar>,
  );
  for (const label of ["Map", "Text", "Colors", "Finish", "More options"]) {
    assert.ok(html.includes(label), `missing ${label}`);
  }
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
});
