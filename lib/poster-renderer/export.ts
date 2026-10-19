import type { Map as MapLibreMap } from "maplibre-gl";
import type { PosterConfig } from "@/lib/types";
import { distanceToZoom } from "@/lib/live-poster-style";
import { getPosterMapStyle } from "./adapter";

export function getPosterMapDimensions(width: number, height: number) {
  return {
    x: Math.round(width * 0.06),
    y: Math.round(height * 0.05),
    width: Math.round(width * 0.88),
    height: Math.round(height * 0.72),
  };
}

/** Match the geographic framing of the editor's 330px-wide map viewport. */
export function zoomForExportWidth(previewZoom: number, exportWidth: number): number {
  return previewZoom + Math.log2(exportWidth / 330);
}

export function fitMapToGpu(width: number, height: number) {
  const scale = Math.min(1, 4000 / width, 4096 / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Renders a separate MapLibre map at the actual output size, never enlarging the preview. */
export async function renderPosterMapCanvas(
  config: PosterConfig,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  if (typeof document === "undefined") throw new Error("Poster rendering requires a browser.");
  if (width < 32 || height < 32) throw new Error("Invalid poster map dimensions.");
  const native = fitMapToGpu(width, height);

  const container = document.createElement("div");
  container.style.cssText = `position:fixed;left:-100000px;top:0;width:${native.width}px;height:${native.height}px;pointer-events:none`;
  document.body.appendChild(container);
  const { Map: MapLibre, setWorkerUrl } = await import("maplibre-gl");
  setWorkerUrl("/maplibre-gl-worker.mjs");

  let map: MapLibreMap | undefined;
  let stage = "constructing map";
  try {
    map = new MapLibre({
      container,
      style: getPosterMapStyle(config),
      center: [config.lon, config.lat],
      zoom: zoomForExportWidth(distanceToZoom(config.distance), native.width),
      bearing: config.rotation ?? 0,
      pitch: config.pitch ?? 0,
      interactive: false,
      attributionControl: false,
      maxCanvasSize: [native.width, native.height],
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    const currentMap = map;
    stage = "loading map tiles";
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Map tiles did not finish loading.")), 45_000);
      const done = () => {
        if (!currentMap.areTilesLoaded()) return;
        window.clearTimeout(timeout);
        resolve();
      };
      currentMap.on("idle", done);
      currentMap.once("error", (event) => {
        window.clearTimeout(timeout);
        reject(new Error(`${event.error?.message ?? "Map rendering failed."}\n${event.error?.stack ?? ""}`));
      });
    });
    stage = "copying map canvas";
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create poster map canvas.");
    ctx.drawImage(map.getCanvas(), 0, 0, width, height);
    return canvas;
  } catch (error) {
    throw new Error(`${stage}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    map?.remove();
    container.remove();
  }
}
