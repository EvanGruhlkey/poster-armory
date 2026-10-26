import type { PosterConfig } from "@/lib/types";
import { STYLE_PRESETS } from "@/lib/types";
import { jpegToPdf } from "@/lib/jpeg-pdf";
import { getPosterPalette } from "@/lib/poster-renderer/adapter";
import { getPosterMapDimensions, renderPosterMapCanvas } from "@/lib/poster-renderer/export";
import { getOuterPosterFrameStrokes, getPosterFrameStrokes } from "@/lib/poster-frame";
import { resolvePosterTypography } from "@/lib/poster-typography";
import { getPosterTextBackdrop, getPosterTextLayout, getPosterTextMetrics } from "@/lib/poster-text-layout";
import { getPosterScaleBar } from "@/lib/poster-labels";
import { getMapAttributionLayout } from "@/lib/map-attribution";

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
  const typography = resolvePosterTypography(config);
  const layout = getPosterTextLayout(config, width, height);
  const metrics = getPosterTextMetrics(config, width, height);
  const backdrop = getPosterTextBackdrop(config);
  const paper = getPosterPalette(config).background;
  if (backdrop.kind === "strong") {
    ctx.globalAlpha = backdrop.alpha;
    ctx.fillStyle = paper;
    ctx.fillRect(layout.text.x, layout.text.y, layout.text.width, layout.text.height);
    ctx.globalAlpha = 1;
  } else if (backdrop.kind === "gradient") {
    const fade = ctx.createLinearGradient(0, layout.text.y, 0, layout.text.y + layout.text.height);
    fade.addColorStop(0, "transparent");
    fade.addColorStop(0.5, paper);
    fade.addColorStop(1, "transparent");
    ctx.globalAlpha = backdrop.alpha;
    ctx.fillStyle = fade;
    ctx.fillRect(layout.text.x, layout.text.y, layout.text.width, layout.text.height);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const cx = width / 2;
  const titleSize = metrics.titleSize;
  const subSize = metrics.subtitleSize;
  const metaSize = metrics.metaSize;
  const lines: Array<{ text: string; size: number; tracking: number; weight: string; font: string }> =
    [];

  if (config.title?.trim() || config.city) {
    lines.push({
      text: typography.titleAllCaps ? (config.title.trim() || config.city).toUpperCase() : (config.title.trim() || config.city),
      size: titleSize,
      tracking: titleSize * typography.titleTracking,
      weight: String(typography.titleWeight),
      font: typography.titleFont,
    });
  }
  if (config.subtitle?.trim() || config.country) {
    lines.push({
      text: (config.subtitle.trim() || config.country).toUpperCase(),
      size: subSize,
      tracking: subSize * typography.subtitleTracking,
      weight: String(typography.subtitleWeight),
      font: typography.subtitleFont,
    });
  }
  if (config.date_line?.trim()) {
    lines.push({
      text: config.date_line.trim().toUpperCase(),
      size: metaSize,
      tracking: width * 0.007,
      weight: "500",
      font: "Inter",
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
      font: "Inter",
    });
  }

  const gap = metrics.gap;
  let y = layout.text.y + (layout.text.height - metrics.blockHeight) / 2;
  if (backdrop.kind === "subtle") {
    ctx.shadowColor = paper;
    ctx.shadowBlur = Math.max(2, titleSize * 0.2);
  }

  for (const line of lines) {
    ctx.font = `${line.weight} ${line.size}px "${line.font}", sans-serif`;
    if ("letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${Math.round(line.tracking)}px`;
    }
    ctx.fillText(line.text, cx, y + line.size / 2, layout.maxTextWidth);
    y += line.size + gap;
  }
  ctx.shadowBlur = 0;

  const attribution = getMapAttributionLayout(width, height);
  ctx.save();
  ctx.fillStyle = textColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.globalAlpha = 0.45;
  ctx.font = `500 ${attribution.fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  }
  ctx.fillText(attribution.text, attribution.x, attribution.y);
  ctx.restore();
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
  const pdf = jpegToPdf(await blobToBytes(jpeg), width, height, config.width * 2, config.height * 2);
  return { png, pdf, width, height };
}

export async function renderPosterPNG(config: PosterConfig, width: number, height: number): Promise<Blob> {
  const typography = resolvePosterTypography(config);
  await document.fonts?.load(`${typography.titleWeight} 24px "${typography.titleFont}"`).catch(() => undefined);
  await document.fonts?.load(`${typography.subtitleWeight} 24px "${typography.subtitleFont}"`).catch(() => undefined);
  await document.fonts?.load('500 24px "Inter"').catch(() => undefined);
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Could not create a drawing context.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = getPosterPalette(config).background || STYLE_PRESETS.warm_beige.bgColor;
  ctx.fillRect(0, 0, width, height);
  const { x: mapX, y: mapY, width: mapWidth, height: mapHeight } = getPosterMapDimensions(width, height, config.map_bounds);
  const printMap = await renderPosterMapCanvas(config, mapWidth, mapHeight);
  ctx.drawImage(printMap, mapX, mapY);
  if (config.show_scale) {
    const scale = getPosterScaleBar(config, mapWidth);
    const right = mapX + mapWidth - mapWidth * 0.035;
    const bottom = mapY + mapHeight - mapWidth * 0.035;
    ctx.save();
    ctx.strokeStyle = getPosterPalette(config).text;
    ctx.fillStyle = getPosterPalette(config).text;
    ctx.lineWidth = Math.max(1, mapWidth * 0.003);
    ctx.textAlign = "right";
    ctx.font = `${Math.max(8, mapWidth * 0.018)}px Inter, sans-serif`;
    ctx.fillText(scale.label, right, bottom - mapWidth * 0.012);
    ctx.beginPath();
    ctx.moveTo(right - scale.widthPx, bottom - mapWidth * 0.008);
    ctx.lineTo(right - scale.widthPx, bottom);
    ctx.lineTo(right, bottom);
    ctx.lineTo(right, bottom - mapWidth * 0.008);
    ctx.stroke();
    ctx.restore();
  }
  const textColor = getPosterPalette(config).text;
  ctx.strokeStyle = `${textColor}55`;
  for (const stroke of getPosterFrameStrokes(typography.frameStyle, width, height, config.map_bounds)) {
    ctx.lineWidth = stroke.lineWidth;
    ctx.strokeRect(stroke.x, stroke.y, stroke.width, stroke.height);
  }
  drawPosterCopy(ctx, width, height, config, textColor);
  ctx.strokeStyle = textColor;
  for (const stroke of getOuterPosterFrameStrokes(config.outer_border_style ?? "none", width, height)) {
    ctx.lineWidth = stroke.lineWidth;
    ctx.strokeRect(stroke.x, stroke.y, stroke.width, stroke.height);
  }

  return canvasToBlob(out, "image/png");
}
