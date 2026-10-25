import { test } from "node:test";
import assert from "node:assert/strict";
import { jpegToPdf } from "./jpeg-pdf";

test("PDF media box uses the selected physical poster size", async () => {
  const pdf = jpegToPdf(new Uint8Array([1, 2, 3]), 3600, 4800, 18, 24);
  assert.match(await pdf.text(), /\/MediaBox \[0 0 1296 1728\]/);
});
