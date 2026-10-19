import type { PosterConfig } from "./types";

export type TypographyPreset = Exclude<NonNullable<PosterConfig["typography_preset"]>, "custom">;
export type ResolvedPosterTypography = {
  preset: NonNullable<PosterConfig["typography_preset"]>;
  titleFont: NonNullable<PosterConfig["title_font"]>;
  titleSize: number;
  titleTracking: number;
  frameStyle: NonNullable<PosterConfig["frame_style"]>;
  titleWeight: number;
};

export const POSTER_TYPOGRAPHY_PRESETS: Record<TypographyPreset, Omit<ResolvedPosterTypography, "preset">> = {
  gallery: { titleFont: "Inter", titleSize: 5, titleTracking: 0.14, frameStyle: "fine", titleWeight: 600 },
  editorial: { titleFont: "Playfair Display", titleSize: 5.5, titleTracking: 0.06, frameStyle: "double", titleWeight: 700 },
  modern: { titleFont: "Oswald", titleSize: 5.5, titleTracking: 0.12, frameStyle: "none", titleWeight: 600 },
};

export function resolvePosterTypography(config: PosterConfig): ResolvedPosterTypography {
  const preset = config.typography_preset ?? "gallery";
  const base = POSTER_TYPOGRAPHY_PRESETS[preset === "custom" ? "gallery" : preset];
  return {
    preset,
    titleFont: config.title_font ?? base.titleFont,
    titleSize: config.title_size ?? base.titleSize,
    titleTracking: config.title_tracking ?? base.titleTracking,
    frameStyle: config.frame_style ?? base.frameStyle,
    titleWeight: (config.title_font ?? base.titleFont) === "Playfair Display" ? 700 : base.titleWeight,
  };
}

export function applyTypographyPreset(_config: PosterConfig, preset: TypographyPreset): Partial<PosterConfig> {
  const values = POSTER_TYPOGRAPHY_PRESETS[preset];
  return {
    typography_preset: preset,
    title_font: values.titleFont,
    title_size: values.titleSize,
    title_tracking: values.titleTracking,
    frame_style: values.frameStyle,
  };
}

export function applyTypographyCustomization(
  _config: PosterConfig,
  changes: Pick<Partial<PosterConfig>, "title_font" | "title_size" | "title_tracking" | "frame_style">,
): Partial<PosterConfig> {
  return { typography_preset: "custom", ...changes };
}
