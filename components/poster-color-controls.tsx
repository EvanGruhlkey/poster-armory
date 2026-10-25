"use client";

import React from "react";
import type { PosterConfig } from "@/lib/types";
import { getPosterPalette, toRendererConfig } from "@/lib/poster-renderer/adapter";
import { styles } from "@/lib/poster-renderer/styles";
import { applyPosterPalette, applyPosterStyle } from "@/lib/poster-customization";

const colorFields = [
  ["background", "Paper"], ["roads.primary", "Roads"], ["water", "Water"],
  ["greenSpace", "Parks"], ["buildings", "Buildings"], ["text", "Text"],
] as const;

export function PosterColorControls({ config, onChange }: {
  config: PosterConfig;
  onChange: (changes: Partial<PosterConfig>) => void;
}) {
  const style = toRendererConfig(config).style;
  const palette = getPosterPalette(config);
  return <div className="space-y-4">
    <div className="space-y-2">
      <p className="text-xs font-medium">Style</p>
      <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Map styles">
        {styles.map((option) => <button key={option.id} type="button"
          aria-pressed={style.id === option.id}
          onClick={() => onChange(applyPosterStyle(config, option.id))}
          className={`min-w-20 shrink-0 rounded-md border p-2 text-center text-[11px] ${style.id === option.id ? "border-primary ring-1 ring-primary" : "hover:bg-muted"}`}>
          <span className="mx-auto mb-1 block h-7 w-7 rounded-full border" style={{ backgroundColor: option.defaultPalette.background, boxShadow: `inset 0 0 0 7px ${option.defaultPalette.roads.primary}` }} />
          {option.name}
        </button>)}
      </div>
    </div>
    <div className="space-y-1.5">
      <label htmlFor="poster-palette" className="text-xs font-medium">Palette</label>
      <select id="poster-palette" value={config.palette_id ?? palette.id}
        onChange={(event) => onChange(applyPosterPalette(config, event.target.value))}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm">
        {style.palettes.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </div>
    <details className="rounded-md border px-3 py-2.5">
      <summary className="cursor-pointer text-xs font-medium">More options</summary>
      <div className="grid grid-cols-2 gap-3 pt-4">
        {colorFields.map(([key, label]) => {
          const initial = key.startsWith("roads.") ? palette.roads.primary : (palette as unknown as Record<string, string>)[key];
          return <label key={key} className="flex items-center gap-2 text-xs">
            <input type="color" aria-label={label} value={config.custom_colors?.[key] ?? initial}
              onChange={(event) => onChange({ custom_colors: { ...config.custom_colors, [key]: event.target.value } })}
              className="h-8 w-8 shrink-0 rounded border p-0.5" />
            {label}
          </label>;
        })}
      </div>
    </details>
  </div>;
}
