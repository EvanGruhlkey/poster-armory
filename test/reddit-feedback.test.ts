import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PRINT_DETAILS } from "../lib/print-details";
import { STYLE_PRESETS } from "../lib/types";

test("print details clearly describe the physical product before checkout", () => {
  assert.deepEqual(PRINT_DETAILS.sizes, ['8\" x 10\"', '12\" x 16\"', '18\" x 24\"']);
  assert.match(PRINT_DETAILS.paper, /200 gsm/i);
  assert.match(PRINT_DETAILS.resolution, /print.ready/i);
  assert.match(PRINT_DETAILS.payment, /before payment/i);
});

test("the editor offers four clearly named muted earth palettes", () => {
  for (const id of ["sand", "sage", "clay", "linen"]) {
    assert.ok(STYLE_PRESETS[id], `${id} palette is missing`);
  }
});

test("public navigation exposes support and opens the editor without login", async () => {
  const [navbar, footer, landing] = await Promise.all([
    readFile(new URL("../components/navbar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/footer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(navbar, /<Link href="\/app">Get Started<\/Link>/);
  assert.doesNotMatch(footer, /href="\/about"/);
  assert.match(footer, /href="mailto:posterarmory@gmail.com"/);
  assert.doesNotMatch(landing, /<h2[^>]*>Print details<\/h2>/);
  assert.match(landing, /all 21 themes/);
  assert.doesNotMatch(landing, /17 themes/);
  assert.match(landing, /Pick a place\.<br \/>We&apos;ll print it\./);
  assert.match(landing, /\/images\/hero-room-san-francisco-v2\.png/);
  assert.match(landing, /feedback-marquee/);
  assert.match(landing, /hero-room-photo/);
  assert.match(landing, /process\.env\.NODE_ENV === "development"/);
  assert.match(landing, />Review<\/span>/);
  assert.match(landing, /Maya R\./);
  assert.doesNotMatch(landing, /Early feedback from Reddit/);
  assert.doesNotMatch(landing, /<Star/);
});
