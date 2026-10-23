import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

import { MAPLIBRE_WORKER_URL } from "../lib/generated/maplibre-worker";

test("MapLibre worker uses one immutable versioned module pair", async () => {
  await promisify(execFile)(process.execPath, ["scripts/copy-maplibre-worker.mjs"]);
  assert.match(MAPLIBRE_WORKER_URL, /^\/maplibre\/[^/]+\/maplibre-gl-worker\.mjs$/);
  const publicPath = new URL(`../public${MAPLIBRE_WORKER_URL}`, import.meta.url);
  const worker = await readFile(publicPath, "utf8");
  assert.match(worker, /from"\.\/maplibre-gl-shared\.mjs"/);
  await readFile(new URL("./maplibre-gl-shared.mjs", publicPath), "utf8");
});
