import { test } from "node:test";
import assert from "node:assert/strict";
import { getPhysicalSize, getRenderDimensions } from "./poster-products";

function printPixels(widthInches: number, heightInches: number) {
  return {
    width: Math.round(widthInches * 300),
    height: Math.round(heightInches * 300),
  };
}

test("prints at 300 DPI or better on every size", () => {
  for (const key of ["8x10", "12x16", "18x24"]) {
    const size = getPhysicalSize(key);
    if (!size) throw new Error(`Missing size ${key}`);
    for (const orientation of ["portrait", "landscape"] as const) {
      const inches = getRenderDimensions(size, orientation);
      const pixels = printPixels(inches.width, inches.height);
      const physicalWidth = orientation === "landscape" ? size.inches.h : size.inches.w;
      const physicalHeight = orientation === "landscape" ? size.inches.w : size.inches.h;
      assert.ok(pixels.width / physicalWidth >= 300, `${key} ${orientation} width`);
      assert.ok(pixels.height / physicalHeight >= 300, `${key} ${orientation} height`);
    }
  }
});

test("renders an 18x24 at its real 300 DPI size", () => {
  const size = getPhysicalSize("18x24");
  if (!size) throw new Error("Missing 18x24");
  assert.deepEqual(getRenderDimensions(size, "portrait"), { width: 18, height: 24 });
  assert.deepEqual(printPixels(18, 24), { width: 5400, height: 7200 });
});
