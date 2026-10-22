"use client";

import React from "react";
import type { PosterConfig, PosterMarker } from "@/lib/types";

export function PosterMarkerControls({ config, onChange }: {
  config: PosterConfig;
  onChange: (changes: Partial<PosterConfig>) => void;
}) {
  const markers = config.markers ?? [];
  const update = (index: number, changes: Partial<PosterMarker>) => onChange({ markers: markers.map((marker, item) => item === index ? { ...marker, ...changes } : marker) });
  return <div className="space-y-2 border-t pt-3">
    <p className="text-xs font-medium">Places</p>
    <label className="flex items-center justify-between text-xs">Pin this place
      <input type="checkbox" checked={config.center_marker ?? false} onChange={(event) => onChange({ center_marker: event.target.checked })} />
    </label>
    <button type="button" onClick={() => onChange({ markers: [...markers, { lat: config.lat, lon: config.lon, label: "New place" }] })}
      className="w-full rounded-md border px-3 py-2 text-xs hover:bg-muted">+ Add a place</button>
    {markers.map((marker, index) => <div key={marker.id ?? index} className="space-y-2 rounded-md border p-2">
      <div className="flex gap-2">
        <input aria-label={`Place ${index + 1} label`} value={marker.label} onChange={(event) => update(index, { label: event.target.value })}
          className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs" />
        <button type="button" aria-label={`Remove place ${index + 1}`} onClick={() => onChange({ markers: markers.filter((_, item) => item !== index) })}
          className="rounded-md border px-2 text-xs">Remove</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px]">Latitude<input type="number" min={-90} max={90} step="any" value={marker.lat} onChange={(event) => update(index, { lat: Number(event.target.value) })} className="mt-1 w-full rounded-md border px-2 py-1" /></label>
        <label className="text-[11px]">Longitude<input type="number" min={-180} max={180} step="any" value={marker.lon} onChange={(event) => update(index, { lon: Number(event.target.value) })} className="mt-1 w-full rounded-md border px-2 py-1" /></label>
      </div>
    </div>)}
    <details className="rounded-md border px-3 py-2.5">
      <summary className="cursor-pointer text-xs font-medium">More marker options</summary>
      <div className="space-y-3 pt-3">
        <label className="flex items-center justify-between text-xs">Route
          <input type="checkbox" disabled={markers.length < 2} checked={config.connect_markers ?? false} onChange={(event) => onChange({ connect_markers: event.target.checked })} />
        </label>
        {config.connect_markers && <>
          <label className="block text-xs">Route color<input type="color" value={config.marker_path_color ?? "#c64a38"} onChange={(event) => onChange({ marker_path_color: event.target.value })} className="ml-2 align-middle" /></label>
          <label className="block text-xs">Route weight · {config.marker_path_width ?? 2}<input type="range" min={0.5} max={8} step={0.5} value={config.marker_path_width ?? 2} onChange={(event) => onChange({ marker_path_width: Number(event.target.value) })} className="mt-2 w-full" /></label>
          <label className="block text-xs">Route line<select value={config.marker_path_style ?? "solid"} onChange={(event) => onChange({ marker_path_style: event.target.value as PosterConfig["marker_path_style"] })} className="mt-1 w-full rounded-md border bg-background px-2 py-1"><option value="solid">Solid</option><option value="dashed">Dashed</option></select></label>
          <label className="flex items-center justify-between text-xs">Show distances<input type="checkbox" checked={config.show_segment_lengths ?? false} onChange={(event) => onChange({ show_segment_lengths: event.target.checked })} /></label>
          {markers.length >= 3 && <label className="flex items-center justify-between text-xs">Fill area<input type="checkbox" checked={!!config.marker_fill_color} onChange={(event) => onChange({ marker_fill_color: event.target.checked ? "#c64a38" : undefined })} /></label>}
          {config.marker_fill_color && <label className="block text-xs">Area color<input type="color" value={config.marker_fill_color} onChange={(event) => onChange({ marker_fill_color: event.target.value })} className="ml-2 align-middle" /></label>}
        </>}
        {markers.map((marker, index) => <div key={marker.id ?? index} className="grid grid-cols-3 gap-2 text-xs">
          <label className="col-span-2">Symbol<select value={marker.type ?? "pin"} onChange={(event) => update(index, { type: event.target.value as PosterMarker["type"] })} className="mt-1 w-full rounded-md border bg-background px-1 py-1">
            {["pin", "crosshair", "dot", "ring", "heart", "home"].map(type => <option key={type} value={type}>{type}</option>)}
          </select></label>
          <label>Color<input type="color" value={marker.color ?? "#c64a38"} onChange={(event) => update(index, { color: event.target.value })} className="mt-1 block" /></label>
          <label className="col-span-3">Size · {marker.size ?? 20}<input type="range" min={8} max={48} step={1} value={marker.size ?? 20} onChange={(event) => update(index, { size: Number(event.target.value) })} className="mt-1 w-full" /></label>
        </div>)}
      </div>
    </details>
  </div>;
}
