"use client";

import React, { type ReactNode } from "react";

export type PosterViewMode = "map" | "room";

export function PosterRoomStage({ mode, onModeChange, children }: {
  mode: PosterViewMode;
  onModeChange: (mode: PosterViewMode) => void;
  children: ReactNode;
}) {
  return <div data-room-scene={mode === "room"} className={`relative flex h-full w-full items-center justify-center overflow-hidden ${mode === "room" ? "bg-[#dccbb7] bg-cover bg-center" : ""}`}
    style={mode === "room" ? { backgroundImage: "url('/images/poster-room-scene.png')" } : undefined}>
    <div className={`relative transition-transform duration-300 motion-reduce:transition-none ${mode === "room" ? "pointer-events-none scale-[.78] outline outline-[10px] outline-[#ae8b65] shadow-[0_18px_30px_rgba(57,37,21,.3)] sm:scale-[.82]" : ""}`}>
      {children}
    </div>
    <div role="group" aria-label="Preview view" className="absolute bottom-20 right-4 z-20 flex rounded-lg border border-stone-200 bg-white/95 p-1 text-xs shadow-md lg:bottom-4 lg:right-4">
      {(["map", "room"] as const).map(view => <button key={view} type="button" aria-pressed={mode === view} onClick={() => onModeChange(view)}
        className={`rounded-md px-3 py-2 font-medium transition-colors motion-reduce:transition-none ${mode === view ? "bg-[#18344b] text-white" : "text-[#18344b] hover:bg-stone-100"}`}>{view === "map" ? "Map" : "Room"}</button>)}
    </div>
  </div>;
}
