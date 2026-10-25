import { test } from "node:test";
import assert from "node:assert/strict";
import { printPixelSize, isClientRenderedJob } from "./render-poster";

test("converts physical render dimensions to 300 DPI pixels", () => {
  assert.deepEqual(printPixelSize(13.33, 20), { width: 3999, height: 6000 });
});

test("physical print jobs run in the worker even when based on a webgl design", () => {
  assert.equal(isClientRenderedJob({ render_engine: "webgl", print_size_key: "24x36" }), false);
  assert.equal(isClientRenderedJob({ render_engine: "webgl" }), true);
});
