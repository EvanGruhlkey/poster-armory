import type { PosterConfig } from "@/lib/types";
import { STYLE_PRESETS } from "@/lib/types";
import { jpegToPdf } from "@/lib/jpeg-pdf";

/** Long edge of the exported poster, in pixels (18x24in at 100dpi). */
export const EXPORT_LONG_EDGE = 2400;

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
  config: PosterConfig
) {
  const gradient = ctx.createLinearGradient(0, height * 0.62, 0, height);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.45, "rgba(0,0,0,0.15)");
  gradient.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height * 0.62, width, height * 0.38);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = Math.max(8, width * 0.008);
  ctx.shadowOffsetY = Math.max(1, width * 0.002);

  const cx = width / 2;
  const titleSize = Math.round(width * 0.048);
  const subSize = Math.round(width * 0.022);
  const metaSize = Math.round(width * 0.018);
  const lines: Array<{ text: string; size: number; tracking: number; weight: string }> =
    [];

  if (config.title?.trim()) {
    lines.push({
      text: config.title.trim().toUpperCase(),
      size: titleSize,
      tracking: width * 0.012,
      weight: "700",
    });
  }
  if (config.subtitle?.trim()) {
    lines.push({
      text: config.subtitle.trim().toUpperCase(),
      size: subSize,
      tracking: width * 0.008,
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

  const gap = Math.round(height * 0.018);
  const block = lines.reduce((sum, line) => sum + line.size + gap, 0) - gap;
  let y = height * 0.9 - block / 2;

  for (const line of lines) {
    ctx.font = `${line.weight} ${line.size}px Inter, ui-sans-serif, system-ui, sans-serif`;
    if ("letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${Math.round(line.tracking)}px`;
    }
    ctx.fillText(line.text, cx, y);
    y += line.size + gap;
  }

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.globalAlpha = 0.35;
  ctx.font = `500 ${Math.max(10, Math.round(width * 0.01))}px Inter, ui-sans-serif, system-ui, sans-serif`;
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  }
  ctx.fillText("© OpenStreetMap contributors · OpenFreeMap", width * 0.02, height * 0.985);
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

  const scale = EXPORT_LONG_EDGE / Math.max(mapCanvas.width, mapCanvas.height);
  const width = Math.max(1, Math.round(mapCanvas.width * scale));
  const height = Math.max(1, Math.round(mapCanvas.height * scale));

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Could not create a drawing context.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = bgColor || STYLE_PRESETS.warm_beige.bgColor;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(mapCanvas, 0, 0, width, height);
  drawPosterCopy(ctx, width, height, config);

  const png = await canvasToBlob(out, "image/png");
  const jpeg = await canvasToBlob(out, "image/jpeg", 0.92);
  const pdf = jpegToPdf(await blobToBytes(jpeg), width, height);
  return { png, pdf, width, height };
}
