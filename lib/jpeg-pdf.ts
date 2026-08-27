/**
 * Wrap a JPEG in a one-page PDF whose page matches the image aspect ratio.
 * Used so the live WebGL poster can be downloaded as a print-ready PDF
 * without a heavy PDF library.
 */
export function jpegToPdf(jpeg: Uint8Array, imgWidth: number, imgHeight: number): Blob {
  const longInches = 18;
  const longPts = longInches * 72;
  const portrait = imgHeight >= imgWidth;
  const pageW = portrait ? Math.round((longPts * imgWidth) / imgHeight) : longPts;
  const pageH = portrait ? longPts : Math.round((longPts * imgHeight) / imgWidth);

  const encoder = new TextEncoder();
  const header = encoder.encode("%PDF-1.4\n");
  const parts: Uint8Array[] = [];
  const offsets: number[] = [0];
  let cursor = header.length;

  const push = (chunk: Uint8Array) => {
    parts.push(chunk);
    cursor += chunk.length;
  };

  const obj = (id: number, body: string, stream?: Uint8Array) => {
    offsets[id] = cursor;
    push(encoder.encode(`${id} 0 obj\n${body}`));
    if (stream) {
      push(encoder.encode("stream\n"));
      push(stream);
      push(encoder.encode("\nendstream\n"));
    }
    push(encoder.encode("endobj\n"));
  };

  const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>\n");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n");
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\n`
  );
  obj(4, `<< /Length ${content.length} >>\n`, encoder.encode(content));
  obj(
    5,
    `<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\n`,
    jpeg
  );

  const xrefStart = cursor;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  push(encoder.encode(xref));
  push(
    encoder.encode(
      `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
    )
  );

  const out = new Uint8Array(cursor);
  let offset = 0;
  out.set(header, 0);
  offset = header.length;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return new Blob([out], { type: "application/pdf" });
}
