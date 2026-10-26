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
  const contentRef = useRef<HTMLDivElement>(null);
  const lastToolRef = useRef<PosterEditorTool>("map");
  const lastContentRef = useRef<ReactNode>(null);
  if (activeTool) {
    lastToolRef.current = activeTool;
    lastContentRef.current = children;
  }
  const activeLabel = tools.find(tool => tool.id === (activeTool ?? lastToolRef.current))?.label;

  useEffect(() => {
    if (panelRef.current) panelRef.current.inert = !activeTool;
    contentRef.current?.scrollTo({ top: 0 });
  }, [activeTool]);

  useEffect(() => {
    if (!activeTool) return;
    const focusTimer = window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 320);
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
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
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
    <nav aria-label="Editor tools" style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }} className="fixed inset-x-3 z-50 grid grid-cols-4 gap-1 rounded-xl border border-stone-200 bg-white/95 p-1.5 shadow-lg backdrop-blur lg:hidden">
      {toolButtons}
    </nav>
    <section id="poster-settings-panel" ref={panelRef} tabIndex={activeTool ? -1 : undefined} role="dialog" aria-label={`${activeLabel} settings`} aria-hidden={!activeTool}
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      className={`fixed inset-x-3 z-[60] flex max-h-[calc(50dvh-5.5rem)] flex-col rounded-2xl border border-stone-200 bg-white shadow-2xl outline-none transition-[opacity,transform,visibility] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none lg:absolute lg:inset-x-auto lg:!bottom-auto lg:right-24 lg:top-4 lg:max-h-[calc(100%-2rem)] lg:w-[350px] lg:rounded-xl ${activeTool ? "visible translate-y-0 opacity-100 lg:translate-x-0" : "invisible pointer-events-none translate-y-6 opacity-0 lg:translate-x-6 lg:translate-y-0"}`}>
      <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-stone-300 lg:hidden" aria-hidden="true" />
      <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-[#18344b]">{activeLabel}</h2>
        <button type="button" onClick={close} aria-label={`Close ${activeLabel} settings`} className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-stone-100 hover:text-[#18344b]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div ref={contentRef} className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">{activeTool ? children : lastContentRef.current}</div>
      <div className="h-[env(safe-area-inset-bottom)] shrink-0 lg:hidden" aria-hidden="true" />
    </section>
  </>;
}
