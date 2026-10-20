"use client";

import React from "react";

import type { PosterConfig } from "@/lib/types";
import {
  applyTextPlacement,
  applyTypographyPreset,
  POSTER_TYPOGRAPHY_PRESETS,
  REFERENCE_TEXT_PRESETS,
  resolvePosterTypography,
  type TextPlacement,
  type TypographyPreset,
} from "@/lib/poster-typography";

const PLACEMENTS: { id: TextPlacement; label: string }[] = [
  { id: "below", label: "Below map" },
  { id: "top", label: "Top" },
  { id: "center", label: "Center" },
  { id: "bottom", label: "Bottom" },
];
const STYLES: { id: TypographyPreset; label: string }[] = [
  { id: "gallery", label: "Gallery" },
  ...REFERENCE_TEXT_PRESETS,
];

export function PosterTextChoices({ config, onChange }: {
  config: PosterConfig;
  onChange: (updates: Partial<PosterConfig>) => void;
}) {
  const selected = resolvePosterTypography(config);
  return (
    <div className="min-w-0 space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium">Placement</p>
        <div className="grid grid-cols-4 gap-1.5" aria-label="Text placement">
          {PLACEMENTS.map(({ id, label }) => (
            <button key={id} type="button" aria-pressed={selected.textPlacement === id}
              onClick={() => onChange(applyTextPlacement(config, id))}
              className={`rounded-md border px-1 py-2 text-[11px] transition-colors ${selected.textPlacement === id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium">Text style</p>
        <div className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-2" aria-label="Text styles">
          {STYLES.map(({ id, label }) => {
            const font = POSTER_TYPOGRAPHY_PRESETS[id].titleFont;
            return (
              <button key={id} type="button" aria-pressed={selected.preset === id}
                onClick={() => onChange(applyTypographyPreset(config, id))}
                className={`min-w-24 shrink-0 rounded-md border px-2 py-3 text-center transition-colors ${selected.preset === id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"}`}>
                <span className="block text-xl leading-none" style={{ fontFamily: `"${font}", sans-serif` }}>Aa</span>
                <span className="mt-2 block text-[10px] font-medium leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
