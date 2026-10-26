"use client";

import React from "react";

import type { PosterConfig } from "@/lib/types";
import {
  applyTextPlacement,
  applyTypographyPreset,
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
        <label htmlFor="poster-text-style" className="text-xs font-medium">Text style</label>
        <select id="poster-text-style" value={selected.preset}
          onChange={(event) => onChange(applyTypographyPreset(config, event.target.value as TypographyPreset))}
          className="h-10 w-full rounded-md border bg-background px-2 text-sm">
          {!STYLES.some(style => style.id === selected.preset) && <option value={selected.preset}>Custom</option>}
          {STYLES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
    </div>
  );
}
