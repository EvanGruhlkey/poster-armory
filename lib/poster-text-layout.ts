import type { PosterConfig } from "./types";
import { getPosterMapDimensions } from "./poster-renderer/export";
import { resolvePosterTypography } from "./poster-typography";

type Rect = { x: number; y: number; width: number; height: number };

export function getPosterTextLayout(config: PosterConfig, width: number, height: number): {
  map: Rect;
  text: Rect;
  maxTextWidth: number;
} {
  const map = getPosterMapDimensions(width, height, config.map_bounds);
  const placement = resolvePosterTypography(config).textPlacement;
  const text = config.text_bounds
    ? {
      x: width * config.text_bounds.x,
      y: height * config.text_bounds.y,
      width: width * config.text_bounds.width,
      height: height * config.text_bounds.height,
    }
    : placement === "below"
    ? { x: width * 0.06, y: height * 0.79, width: width * 0.88, height: height * 0.17 }
    : {
      x: width * 0.12,
      y: map.y + map.height * (placement === "top" ? 0.05 : placement === "center" ? 0.34 : 0.67),
      width: width * 0.76,
      height: map.height * (placement === "top" ? 0.26 : placement === "center" ? 0.32 : 0.28),
    };
  return { map, text, maxTextWidth: text.width * 0.98 };
}

export function getPosterTextBackdrop(config: PosterConfig): { kind: NonNullable<PosterConfig["text_backdrop"]>; alpha: number } {
  const kind = resolvePosterTypography(config).textPlacement === "below" && !config.text_bounds ? "none" : resolvePosterTypography(config).textBackdrop;
  return { kind, alpha: kind === "strong" ? 0.88 : kind === "gradient" ? 0.78 : kind === "subtle" ? 0.75 : 0 };
}

export function getPosterTextMetrics(config: PosterConfig, width: number, height: number) {
  const typography = resolvePosterTypography(config);
  const box = getPosterTextLayout(config, width, height).text;
  const sizes = [
    width * typography.titleSize / 100,
    (config.subtitle?.trim() || config.country) ? width * typography.subtitleSize / 100 : 0,
    config.date_line?.trim() ? width * 0.019 : 0,
    config.show_coordinates ? width * 0.019 : 0,
  ];
  const count = sizes.filter(Boolean).length;
  const gap = height * 0.009;
  const rawBlock = sizes.reduce((total, size) => total + size, 0) + Math.max(0, count - 1) * gap;
  const scale = rawBlock > 0 ? Math.min(1, box.height * 0.82 / rawBlock) : 1;
  return {
    titleSize: sizes[0] * scale,
    subtitleSize: sizes[1] * scale,
    metaSize: width * 0.019 * scale,
    gap: gap * scale,
    blockHeight: rawBlock * scale,
  };
}
