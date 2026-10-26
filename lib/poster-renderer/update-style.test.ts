import assert from "node:assert/strict";
import { test } from "node:test";
import { updatePosterMapStyle } from "./update-style";

test("detaches terrain before replacing a style so the renderer cannot use its stale projection", () => {
  const calls: string[] = [];
  updatePosterMapStyle({
    getTerrain: () => ({ source: "terrain" }),
    setTerrain: (terrain) => { assert.equal(terrain, null); calls.push("detach terrain"); },
    setStyle: () => { calls.push("replace style"); },
  }, { version: 8, sources: {}, layers: [] });
  assert.deepEqual(calls, ["detach terrain", "replace style"]);
});
