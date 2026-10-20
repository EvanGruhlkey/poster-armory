import type { PosterConfig } from "./types";

export type TypographyPreset = Exclude<NonNullable<PosterConfig["typography_preset"]>, "custom">;
export type PosterFont = NonNullable<PosterConfig["title_font"]>;
export type TextPlacement = NonNullable<PosterConfig["text_placement"]>;
export type TextBackdrop = NonNullable<PosterConfig["text_backdrop"]>;
export type ResolvedPosterTypography = {
  preset: NonNullable<PosterConfig["typography_preset"]>;
  textPlacement: TextPlacement;
  titleFont: PosterFont;
  titleSize: number;
  titleWeight: number;
  titleTracking: number;
  titleAllCaps: boolean;
  subtitleFont: PosterFont;
  subtitleSize: number;
  subtitleWeight: number;
  subtitleTracking: number;
  textBackdrop: TextBackdrop;
  frameStyle: NonNullable<PosterConfig["frame_style"]>;
};

type PresetValues = Omit<ResolvedPosterTypography, "preset" | "textPlacement">;
const base = (values: Partial<PresetValues>): PresetValues => ({
  titleFont: "Inter", titleSize: 5, titleWeight: 600, titleTracking: 0.14,
  titleAllCaps: true, subtitleFont: "Inter", subtitleSize: 2.4,
  subtitleWeight: 500, subtitleTracking: 0.16, textBackdrop: "none",
  frameStyle: "fine", ...values,
});

export const POSTER_TYPOGRAPHY_PRESETS: Record<TypographyPreset, PresetValues> = {
  gallery: base({}),
  editorial: base({ titleFont: "Playfair Display", titleSize: 5.5, titleWeight: 700, titleTracking: 0.06, frameStyle: "double" }),
  modern: base({ titleFont: "Oswald", titleSize: 5.5, titleWeight: 600, titleTracking: 0.12, frameStyle: "none" }),
  "modern-bold": base({ titleFont: "Inter", titleSize: 8, titleWeight: 700, titleTracking: -0.02, subtitleFont: "Inter", subtitleSize: 2.5, subtitleWeight: 400, subtitleTracking: 0.05, textBackdrop: "subtle" }),
  "classic-serif": base({ titleFont: "Playfair Display", titleSize: 7.5, titleWeight: 600, titleTracking: 0, titleAllCaps: false, subtitleFont: "Montserrat", subtitleSize: 2, subtitleWeight: 300, subtitleTracking: 0.08, textBackdrop: "gradient" }),
  "minimal-clean": base({ titleFont: "Inter", titleSize: 6, titleWeight: 400, titleTracking: 0.02, titleAllCaps: false, subtitleFont: "Inter", subtitleSize: 1.8, subtitleWeight: 300, subtitleTracking: 0.1, textBackdrop: "none" }),
  "editorial-strong": base({ titleFont: "Montserrat", titleSize: 9.5, titleWeight: 900, titleTracking: -0.04, subtitleFont: "Crimson Text", subtitleSize: 2.2, subtitleWeight: 400, subtitleTracking: 0.03, textBackdrop: "strong" }),
  "vintage-elegant": base({ titleFont: "Crimson Text", titleSize: 7, titleWeight: 600, titleTracking: 0.01, titleAllCaps: false, subtitleFont: "Crimson Text", subtitleSize: 2.5, subtitleWeight: 400, subtitleTracking: 0.12, textBackdrop: "subtle" }),
  "technical-mono": base({ titleFont: "JetBrains Mono", titleSize: 6.5, titleWeight: 700, titleTracking: 0, subtitleFont: "JetBrains Mono", subtitleSize: 1.5, subtitleWeight: 400, subtitleTracking: 0.05, textBackdrop: "none" }),
  "geometric-modern": base({ titleFont: "Poppins", titleSize: 8.5, titleWeight: 600, titleTracking: -0.01, titleAllCaps: false, subtitleFont: "Poppins", subtitleSize: 2.3, subtitleWeight: 300, subtitleTracking: 0.06, textBackdrop: "gradient" }),
  "condensed-impact": base({ titleFont: "Montserrat", titleSize: 10, titleWeight: 800, titleTracking: -0.03, subtitleFont: "Inter", subtitleSize: 1.6, subtitleWeight: 400, subtitleTracking: 0.15, textBackdrop: "strong" }),
};

export const REFERENCE_TEXT_PRESETS: { id: TypographyPreset; label: string }[] = [
  { id: "modern-bold", label: "Modern Bold" },
  { id: "classic-serif", label: "Classic Serif" },
  { id: "minimal-clean", label: "Minimal Clean" },
  { id: "editorial-strong", label: "Editorial Strong" },
  { id: "vintage-elegant", label: "Vintage Elegant" },
  { id: "technical-mono", label: "Technical Mono" },
  { id: "geometric-modern", label: "Geometric Modern" },
  { id: "condensed-impact", label: "Condensed Impact" },
];

export function fitTitleScale(textWidth: number, maxWidth: number): number {
  return textWidth > 0 ? Math.min(1, maxWidth / textWidth) : 1;
}

export function resolvePosterTypography(config: PosterConfig): ResolvedPosterTypography {
  const preset = config.typography_preset ?? "gallery";
  const values = POSTER_TYPOGRAPHY_PRESETS[preset === "custom" ? "gallery" : preset];
  return {
    preset, textPlacement: config.text_placement ?? "below",
    titleFont: config.title_font ?? values.titleFont,
    titleSize: config.title_size ?? values.titleSize,
    titleWeight: config.title_weight ?? values.titleWeight,
    titleTracking: config.title_tracking ?? values.titleTracking,
    titleAllCaps: config.title_all_caps ?? values.titleAllCaps,
    subtitleFont: config.subtitle_font ?? values.subtitleFont,
    subtitleSize: config.subtitle_size ?? values.subtitleSize,
    subtitleWeight: config.subtitle_weight ?? values.subtitleWeight,
    subtitleTracking: config.subtitle_tracking ?? values.subtitleTracking,
    textBackdrop: config.text_backdrop ?? values.textBackdrop,
    frameStyle: config.frame_style ?? values.frameStyle,
  };
}

export function applyTypographyPreset(_config: PosterConfig, preset: TypographyPreset): Partial<PosterConfig> {
  const values = POSTER_TYPOGRAPHY_PRESETS[preset];
  return {
    typography_preset: preset,
    title_font: values.titleFont, title_size: values.titleSize, title_weight: values.titleWeight,
    title_tracking: values.titleTracking, title_all_caps: values.titleAllCaps,
    subtitle_font: values.subtitleFont, subtitle_size: values.subtitleSize,
    subtitle_weight: values.subtitleWeight, subtitle_tracking: values.subtitleTracking,
    text_backdrop: values.textBackdrop, frame_style: values.frameStyle,
  };
}

export function applyTextPlacement(_config: PosterConfig, placement: TextPlacement): Partial<PosterConfig> {
  return { text_placement: placement };
}

export function applyTypographyCustomization(
  _config: PosterConfig,
  changes: Pick<Partial<PosterConfig>, "title_font" | "title_size" | "title_weight" | "title_tracking" | "title_all_caps" | "subtitle_font" | "subtitle_size" | "subtitle_weight" | "subtitle_tracking" | "text_backdrop" | "frame_style">,
): Partial<PosterConfig> {
  return { typography_preset: "custom", ...changes };
}
