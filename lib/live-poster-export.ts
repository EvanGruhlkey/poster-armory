import type { PosterConfig } from "@/lib/types";
import { STYLE_PRESETS } from "@/lib/types";
import { jpegToPdf } from "@/lib/jpeg-pdf";
import { getPosterPalette } from "@/lib/poster-renderer/adapter";
import { getPosterMapDimensions, renderPosterMapCanvas } from "@/lib/poster-renderer/export";

/** Long edge of a high-resolution digital poster, in pixels. */
export const EXPORT_LONG_EDGE = 4800;

export function getDigitalPosterDimensions(widthInches: number, heightInches: number) {
  const aspect = widthInches > 0 && heightInches > 0 ? widthInches / heightInches : 3 / 4;
  return aspect <= 1
    ? { width: Math.round(EXPORT_LONG_EDGE * aspect), height: EXPORT_LONG_EDGE }
    : { width: EXPORT_LONG_EDGE, height: Math.round(EXPORT_LONG_EDGE / aspect) };
}

function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then((buf) => new Uint8Array(buf));
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Could not encode the poster image."));
        else resolve(blob);
      },
      type,
      quality
    );
  });
}

function drawPosterCopy(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: PosterConfig,
  textColor: string
) {
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const cx = width / 2;
  const titleSize = Math.round(width * 0.05);
  const subSize = Math.round(width * 0.024);
  const metaSize = Math.round(width * 0.019);
  const lines: Array<{ text: string; size: number; tracking: number; weight: string }> =
    [];

  if (config.title?.trim() || config.city) {
    lines.push({
      text: (config.title.trim() || config.city).toUpperCase(),
      size: titleSize,
      tracking: width * 0.007,
      weight: "600",
    });
  }
  if (config.subtitle?.trim() || config.country) {
    lines.push({
      text: (config.subtitle.trim() || config.country).toUpperCase(),
      size: subSize,
      tracking: width * 0.005,
      weight: "500",
    });
  }
  if (config.date_line?.trim()) {
    lines.push({
      text: config.date_line.trim().toUpperCase(),
      size: metaSize,
      tracking: width * 0.007,
      weight: "500",
    });
  }
  if (config.show_coordinates) {
    const ns = config.lat >= 0 ? "N" : "S";
    const ew = config.lon >= 0 ? "E" : "W";
    lines.push({
      text: `${Math.abs(config.lat).toFixed(4)}° ${ns}  ·  ${Math.abs(config.lon).toFixed(4)}° ${ew}`,
      size: metaSize,
      tracking: width * 0.006,
      weight: "500",
    });
  }

  const gap = Math.round(height * 0.009);
  const block = lines.reduce((sum, line) => sum + line.size + gap, 0) - gap;
  let y = height * 0.875 - block / 2;

  for (const line of lines) {
    ctx.font = `${line.weight} ${line.size}px Inter, ui-sans-serif, system-ui, sans-serif`;
    if ("letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${Math.round(line.tracking)}px`;
    }
    ctx.fillText(line.text, cx, y, width * 0.86);
    y += line.size + gap;
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.globalAlpha = 0.45;
  ctx.font = `500 ${Math.max(12, Math.round(width * 0.009))}px Inter, ui-sans-serif, system-ui, sans-serif`;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  }
  ctx.fillText("© OpenStreetMap contributors · OpenFreeMap", width * 0.065, height * 0.765);
  ctx.globalAlpha = 1;
}

export interface LivePosterFiles {
  png: Blob;
  pdf: Blob;
  width: number;
  height: number;
}

export async function composeLivePosterFiles(
  mapCanvas: HTMLCanvasElement,
  config: PosterConfig,
  bgColor: string
): Promise<LivePosterFiles> {
  if (mapCanvas.width < 32 || mapCanvas.height < 32) {
    throw new Error("The live map is not ready to capture yet.");
  }

  await document.fonts?.ready.catch(() => undefined);

  const { width, height } = getDigitalPosterDimensions(config.width, config.height);

  const png = await renderPosterPNG(config, width, height);
  const bitmap = await createImageBitmap(png);
  const pdfCanvas = document.createElement("canvas");
  pdfCanvas.width = width;
  pdfCanvas.height = height;
  pdfCanvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();
  const jpeg = await canvasToBlob(pdfCanvas, "image/jpeg", 0.92);
  const pdf = jpegToPdf(await blobToBytes(jpeg), width, height);
  return { png, pdf, width, height };
}

export async function renderPosterPNG(config: PosterConfig, width: number, height: number): Promise<Blob> {
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Could not create a drawing context.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = getPosterPalette(config).background || STYLE_PRESETS.warm_beige.bgColor;
  ctx.fillRect(0, 0, width, height);
  const { x: mapX, y: mapY, width: mapWidth, height: mapHeight } = getPosterMapDimensions(width, height);
  const printMap = await renderPosterMapCanvas(config, mapWidth, mapHeight);
  ctx.drawImage(printMap, mapX, mapY);
  const textColor = getPosterPalette(config).text;
  ctx.strokeStyle = `${textColor}33`;
  ctx.lineWidth = Math.max(1, width * 0.001);
  ctx.strokeRect(mapX, mapY, mapWidth, mapHeight);
  drawPosterCopy(ctx, width, height, config, textColor);

  return canvasToBlob(out, "image/png");
}
