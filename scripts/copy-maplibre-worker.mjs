// MapLibre 6 loads its tile worker as a separate ES module, so the two files
// below have to be served from /public and handed to setWorkerUrl.
//
// They used to be checked in, which let them fall a major version behind the
// installed package: a v6 worker ran against a v5 bundle and no tile was ever
// requested, blanking every map. Copying them from node_modules on each build
// keeps the pair pinned to whatever version is actually installed.

import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("maplibre-gl/package.json");
const dist = join(dirname(pkgPath), "dist");
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

await mkdir(publicDir, { recursive: true });
for (const file of FILES) {
  await copyFile(join(dist, file), join(publicDir, file));
}

console.log(`Copied MapLibre ${require(pkgPath).version} worker files into public/`);
