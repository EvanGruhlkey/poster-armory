import React, { type ReactNode } from "react";

export function PosterCanvasShell({
  aspectRatio,
  backgroundColor,
  children,
}: {
  aspectRatio: string;
  backgroundColor?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-testid="poster-canvas-shell"
      className="flex items-center justify-center overflow-hidden rounded-none border-0"
      style={{ aspectRatio, backgroundColor }}
    >
      {children}
    </div>
  );
}
