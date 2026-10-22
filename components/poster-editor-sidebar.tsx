"use client";

import React, { type ReactNode, useEffect, useRef } from "react";
import { Layers3, Map, Palette, Type, X } from "lucide-react";

export type PosterEditorTool = "map" | "type" | "style" | "finish";

const tools = [
  { id: "map", label: "Map", icon: Map },
  { id: "type", label: "Text", icon: Type },
  { id: "style", label: "Colors", icon: Palette },
  { id: "finish", label: "Finish", icon: Layers3 },
] as const;

export function nextPosterTool(current: PosterEditorTool | null, chosen: PosterEditorTool): PosterEditorTool | null {
  return current === chosen ? null : chosen;
}

export function PosterEditorSidebar({ activeTool, onToolChange, children }: {
  activeTool: PosterEditorTool | null;
  onToolChange: (tool: PosterEditorTool | null) => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const activeLabel = tools.find(tool => tool.id === activeTool)?.label;

  useEffect(() => {
    if (!activeTool) return;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onToolChange(null);
      requestAnimationFrame(() => {
        const buttons = document.querySelectorAll<HTMLButtonElement>(`[data-poster-tool="${activeTool}"]`);
        Array.from(buttons).find(button => button.getClientRects().length)?.focus();
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTool, onToolChange]);

  const close = () => {
    const tool = activeTool;
    onToolChange(null);
    requestAnimationFrame(() => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(`[data-poster-tool="${tool}"]`);
      Array.from(buttons).find(button => button.getClientRects().length)?.focus();
    });
  };

  const toolButtons = tools.map(({ id, label, icon: Icon }) => (
    <button key={id} type="button" data-poster-tool={id} aria-label={`${label} settings`}
      aria-pressed={activeTool === id} aria-expanded={activeTool === id}
      aria-controls="poster-settings-panel"
      onClick={() => onToolChange(nextPosterTool(activeTool, id))}
      className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-[10px] font-medium transition-colors motion-reduce:transition-none ${activeTool === id ? "bg-[#18344b] text-white" : "text-[#18344b] hover:bg-[#edf0ef]"}`}
    ><Icon className="h-5 w-5" strokeWidth={1.7} /><span>{label}</span></button>
  ));

  return <>
    <nav aria-label="Editor tools" className="fixed right-4 top-1/2 z-50 hidden -translate-y-1/2 grid-cols-1 gap-1 rounded-xl border border-stone-200 bg-white/95 p-1.5 shadow-lg backdrop-blur lg:absolute lg:top-1/2 lg:grid">
      {toolButtons}
    </nav>
    <nav aria-label="Editor tools" className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 gap-1 rounded-xl border border-stone-200 bg-white/95 p-1.5 shadow-lg backdrop-blur lg:hidden">
      {toolButtons}
    </nav>
    {activeTool && <section id="poster-settings-panel" ref={panelRef} tabIndex={-1} role="dialog" aria-label={`${activeLabel} settings`}
      className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[50dvh] flex-col rounded-t-2xl border border-stone-200 bg-white shadow-2xl outline-none lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-24 lg:top-4 lg:max-h-[calc(100%-2rem)] lg:w-[350px] lg:rounded-xl">
      <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-stone-300 lg:hidden" aria-hidden="true" />
      <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-[#18344b]">{activeLabel}</h2>
        <button type="button" onClick={close} aria-label={`Close ${activeLabel} settings`} className="rounded-md p-1.5 text-slate-500 hover:bg-stone-100 hover:text-[#18344b]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto p-4 sm:p-5">{children}</div>
    </section>}
  </>;
}
