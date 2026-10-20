"use client";

import React, { type ReactNode } from "react";

export type PosterEditorTool = "map" | "type" | "style" | "finish";

const tools: { id: PosterEditorTool; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "type", label: "Text" },
  { id: "style", label: "Colors" },
  { id: "finish", label: "Finish" },
];

export function PosterEditorSidebar({ activeTool, onToolChange, children }: {
  activeTool: PosterEditorTool;
  onToolChange: (tool: PosterEditorTool) => void;
  children: ReactNode;
}) {
  return <div className="min-w-0 overflow-hidden rounded-lg border bg-card shadow-sm">
    <nav className="grid grid-cols-4 gap-1 border-b bg-muted/20 p-2" aria-label="Editor tools">
      {tools.map(({ id, label }) => <button
        key={id} type="button" onClick={() => onToolChange(id)} aria-pressed={activeTool === id}
        className={`rounded-md px-1 py-2.5 text-xs font-medium transition-colors ${activeTool === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
      >{label}</button>)}
    </nav>
    <div className="min-w-0 p-4 sm:p-5">{children}</div>
  </div>;
}
