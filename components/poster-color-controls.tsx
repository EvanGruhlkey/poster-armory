"use client";

import React from "react";
import type { PosterConfig } from "@/lib/types";
import { getPosterPalette, toRendererConfig } from "@/lib/poster-renderer/adapter";
import { styles } from "@/lib/poster-renderer/styles";
import { applyPosterColor, applyPosterTheme } from "@/lib/poster-customization";

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
      <label htmlFor="poster-theme" className="text-xs font-medium">Theme</label>
      <select id="poster-theme" value={`${style.id}:${palette.id}`}
        onChange={(event) => {
          const [styleId, paletteId] = event.target.value.split(":");
          onChange(applyPosterTheme(config, styleId, paletteId));
        }}
        className="h-10 w-full rounded-md border bg-background px-2 text-sm">
        {styles.map((look) => <optgroup key={look.id} label={look.name.split(" / ")[0]}>
          {look.palettes.map((colors) => <option key={colors.id} value={`${look.id}:${colors.id}`}>{colors.name}</option>)}
        </optgroup>)}
      </select>
    </div>
    <details className="rounded-md border px-3 py-2.5">
      <summary className="cursor-pointer text-xs font-medium">Custom colors</summary>
      <div className="grid grid-cols-2 gap-3 pt-4">
        {colorFields.map(([key, label]) => {
          const initial = key.startsWith("roads.") ? palette.roads.primary : (palette as unknown as Record<string, string>)[key];
          return <label key={key} className="flex items-center gap-2 text-xs">
            <input type="color" aria-label={label} value={config.custom_colors?.[key] ?? initial}
              onChange={(event) => onChange(applyPosterColor(config, key, event.target.value))}
              className="h-8 w-8 shrink-0 rounded border p-0.5" />
            {label}
          </label>;
        })}
      </div>
    </details>
  </div>;
}
