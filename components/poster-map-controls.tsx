"use client";

import React from "react";
import type { PosterConfig } from "@/lib/types";

const cameraPresets = [
  { label: "Flat", pitch: 0, rotation: 0 },
  { label: "Bird's eye", pitch: 35, rotation: 0 },
  { label: "Isometric", pitch: 45, rotation: 45 },
] as const;

const detailLayers = [
  ["streets", "Streets"], ["buildings", "Buildings"], ["buildings3D", "3D buildings"],
  ["railroads", "Railroads"], ["pois", "Places of interest"],
  ["boundaries", "Boundaries"], ["landcoverWood", "Woods"],
  ["landcoverGrass", "Grass"], ["landcoverFarmland", "Farmland"],
  ["landcoverIce", "Ice"], ["terrain", "Terrain shading"],
] as const;

export function PosterMapControls({ config, pitch, onChange, onPitchChange }: {
  config: PosterConfig;
  pitch: number;
  onChange: (changes: Partial<PosterConfig>) => void;
  onPitchChange: (pitch: number) => void;
}) {
  return <div className="space-y-4">
    <div className="space-y-2">
      <p className="text-xs font-medium">View</p>
      <div className="grid grid-cols-3 gap-1.5">
        {cameraPresets.map((preset) => <button key={preset.label} type="button"
          aria-pressed={pitch === preset.pitch && config.rotation === preset.rotation}
          onClick={() => { onPitchChange(preset.pitch); onChange({ rotation: preset.rotation, pitch: preset.pitch }); }}
          className={`rounded-md border px-1 py-2 text-xs ${pitch === preset.pitch && config.rotation === preset.rotation ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          {preset.label}
        </button>)}
      </div>
    </div>
    <div className="space-y-2">
      {[["show_water", "Water"], ["show_parks", "Parks"], ["show_labels", "Map names"]] .map(([key, label]) =>
        <label key={key} className="flex items-center justify-between text-xs">
          {label}
          <input type="checkbox" checked={Boolean(config[key as keyof PosterConfig])}
            onChange={(event) => onChange({ [key]: event.target.checked } as Partial<PosterConfig>)} />
        </label>)}
    </div>
    <details className="rounded-md border px-3 py-2.5">
      <summary className="cursor-pointer text-xs font-medium">More options</summary>
      <div className="space-y-3 pt-4">
        <label className="flex items-center justify-between text-xs">Major roads only
          <input type="checkbox" checked={config.major_roads_only} onChange={(event) => onChange({ major_roads_only: event.target.checked })} />
        </label>
        {detailLayers.map(([key, label]) => <label key={key} className="flex items-center justify-between text-xs">
          {label}
          <input type="checkbox" checked={config.map_layers?.[key] !== false}
            onChange={(event) => onChange({ map_layers: { ...config.map_layers, [key]: event.target.checked } })} />
        </label>)}
        {config.show_labels && <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium">Map names</p>
          {([["label_admin", "State & country"], ["label_cities", "Cities"], ["label_streets", "Streets"]] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between text-xs">
            {label}<input type="checkbox" checked={config[key] !== false} onChange={(event) => onChange({ [key]: event.target.checked })} />
          </label>)}
          <label className="block text-xs">Name size · {config.label_size ?? 16}
            <input type="range" min={8} max={32} step={1} value={config.label_size ?? 16} onChange={(event) => onChange({ label_size: Number(event.target.value) })} className="mt-2 w-full" />
          </label>
          <label className="block text-xs">Name style
            <select value={config.label_style ?? "standard"} onChange={(event) => onChange({ label_style: event.target.value as PosterConfig["label_style"] })} className="mt-1 h-9 w-full rounded-md border bg-background px-2">
              <option value="standard">Standard</option><option value="elevated">Elevated</option><option value="glass">Glass</option><option value="vintage">Vintage</option>
            </select>
          </label>
        </div>}
        <div className="space-y-2 border-t pt-3">
          <label className="flex items-center justify-between text-xs">Scale bar
            <input type="checkbox" checked={config.show_scale ?? false} onChange={(event) => onChange({ show_scale: event.target.checked })} />
          </label>
          <label className="flex items-center justify-between text-xs">Latitude/longitude grid
            <input type="checkbox" checked={config.show_grid ?? false} onChange={(event) => onChange({ show_grid: event.target.checked })} />
          </label>
          {config.show_grid && <label className="block text-xs">Grid density
            <select value={config.grid_density ?? 10} onChange={(event) => onChange({ grid_density: Number(event.target.value) as PosterConfig["grid_density"] })} className="mt-1 h-9 w-full rounded-md border bg-background px-2">
              {[1, 2, 5, 10, 15, 20, 30].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>}
        </div>
        <label className="block text-xs">Road weight · {(config.road_weight ?? 1).toFixed(1)}×
          <input type="range" min={0.5} max={3} step={0.1} value={config.road_weight ?? 1}
            onChange={(event) => onChange({ road_weight: Number(event.target.value) })} className="mt-2 w-full" />
        </label>
        <label className="block text-xs">3D building height · {(config.building_height_scale ?? 1).toFixed(1)}×
          <input type="range" min={0.5} max={3} step={0.1} value={config.building_height_scale ?? 1}
            onChange={(event) => onChange({ building_height_scale: Number(event.target.value) })} className="mt-2 w-full" />
        </label>
        <label className="block text-xs">Terrain shade · {(config.terrain_exaggeration ?? 0.6).toFixed(1)}×
          <input type="range" min={0} max={5} step={0.1} value={config.terrain_exaggeration ?? 0.6}
            onChange={(event) => onChange({ terrain_exaggeration: Number(event.target.value) })} className="mt-2 w-full" />
        </label>
      </div>
    </details>
  </div>;
}
