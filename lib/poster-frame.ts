import type { PosterConfig } from "./types";
import { getPosterMapDimensions } from "./poster-renderer/export";

export type FrameStroke = { x: number; y: number; width: number; height: number; lineWidth: number };

export function getPosterFrameStrokes(
  style: NonNullable<PosterConfig["frame_style"]>,
  width: number,
  height: number,
): FrameStroke[] {
  if (style === "none") return [];
  const map = getPosterMapDimensions(width, height);
  const lineWidth = Math.max(1, Math.round(width * 0.001));
  const outer = { ...map, lineWidth };
  if (style === "fine") return [outer];
  const inset = Math.round(width * 0.006);
  return [outer, {
    x: map.x + inset,
    y: map.y + inset,
    width: map.width - inset * 2,
    height: map.height - inset * 2,
    lineWidth,
  }];
}
