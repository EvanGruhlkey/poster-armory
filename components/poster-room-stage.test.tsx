import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PosterRoomStage } from "./poster-room-stage";

test("Map and Room use the same single live poster", () => {
  for (const mode of ["map", "room"] as const) {
    const html = renderToStaticMarkup(<PosterRoomStage mode={mode} onModeChange={() => {}}><div data-testid="live-poster">Artwork</div></PosterRoomStage>);
    assert.equal((html.match(/data-testid="live-poster"/g) ?? []).length, 1);
    assert.equal(html.includes('data-room-scene="true"'), mode === "room");
    assert.ok(html.includes('aria-pressed="true"'));
  }
});
