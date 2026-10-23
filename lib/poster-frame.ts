import type { PosterConfig } from "./types";
import { getPosterMapDimensions, type PosterMapBounds } from "./poster-renderer/export";

export type FrameStroke = { x: number; y: number; width: number; height: number; lineWidth: number };

export function getPosterFrameStrokes(
  style: NonNullable<PosterConfig["frame_style"]>,
  width: number,
  height: number,
  mapBounds?: PosterMapBounds,
): FrameStroke[] {
  if (style === "none") return [];
  const map = getPosterMapDimensions(width, height, mapBounds);
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

export function getOuterPosterFrameStrokes(
  style: NonNullable<PosterConfig["outer_border_style"]>,
  width: number,
  height: number,
): FrameStroke[] {
  if (style === "none") return [];
  const inset = Math.round(Math.min(width, height) * 0.025);
  const lineWidth = Math.max(1, Math.round(width * 0.0015));
  const outer = {
    x: inset,
    y: inset,
    width: width - inset * 2,
    height: height - inset * 2,
    lineWidth,
  };
  if (style === "fine") return [outer];
  const secondInset = Math.round(Math.min(width, height) * 0.01);
  return [outer, {
    x: outer.x + secondInset,
    y: outer.y + secondInset,
    width: outer.width - secondInset * 2,
    height: outer.height - secondInset * 2,
    lineWidth,
  }];
}
