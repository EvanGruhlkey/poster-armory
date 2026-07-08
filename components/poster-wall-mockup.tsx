"use client";

import { Package } from "lucide-react";
import type { ReactNode } from "react";
import { ProtectedImage } from "@/components/protected-image";

type Orientation = "portrait" | "landscape" | "square";

interface PosterWallMockupProps {
  src?: string | null;
  alt?: string;
  bgColor?: string;
  textColor?: string;
  orientation?: Orientation;
  placeholder?: ReactNode;
  className?: string;
}

function posterAspect(orientation: Orientation): string {
  switch (orientation) {
    case "landscape":
      return "aspect-[4/3]";
    case "square":
      return "aspect-square";
    default:
      return "aspect-[3/4]";
  }
}

function posterWidth(orientation: Orientation): string {
  switch (orientation) {
    case "landscape":
      return "w-[80%]";
    case "square":
      return "w-[58%]";
    default:
      return "w-[50%]";
  }
}

export function PosterWallMockup({
  src,
  alt = "Poster preview",
  bgColor = "#f5f0e8",
  textColor,
  orientation = "portrait",
  placeholder,
  className = "",
}: PosterWallMockupProps) {
  const aspect = posterAspect(orientation);
  const width = posterWidth(orientation);

  return (
    <div
      className={`relative overflow-hidden rounded-md ${className}`}
      style={{ aspectRatio: "4 / 5" }}
    >
      {/* Wall */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#ebe4da] via-[#e8e1d6] to-[#ddd5c8]" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 80%, rgba(0,0,0,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3) 0%, transparent 40%)",
        }}
      />

      {/* Window-light wash */}
      <div className="absolute left-0 top-0 h-[55%] w-[45%] bg-gradient-to-br from-white/25 to-transparent" />

      {/* Lamp glow */}
      <div className="absolute right-0 top-[10%] h-[45%] w-[40%] bg-gradient-to-l from-amber-50/70 via-amber-100/20 to-transparent" />

      {/* Poster */}
      <div className="absolute left-1/2 top-[10%] z-10 -translate-x-1/2">
        {/* Nail */}
        <div className="mx-auto mb-0.5 h-1 w-1 rounded-full bg-neutral-400/60 shadow-sm" />
        <div className="mx-auto mb-1 h-2 w-px bg-neutral-400/40" />

        <div
          className={`relative ${width} ${aspect}`}
          style={{
            filter: "drop-shadow(0 12px 20px rgba(0,0,0,0.15)) drop-shadow(0 4px 8px rgba(0,0,0,0.08))",
          }}
        >
          {/* Wood frame outer */}
          <div className="absolute -inset-[5px] rounded-[3px] bg-gradient-to-br from-[#c9a96e] via-[#b8956a] to-[#8b6f4a]" />
          {/* Wood frame inner highlight */}
          <div className="absolute -inset-[3px] rounded-[2px] bg-gradient-to-br from-[#dcc9a0] to-[#a08050]" />

          {/* Mat + print */}
          <div className="relative h-full w-full overflow-hidden bg-white">
            <div className="flex h-full w-full items-center justify-center bg-white p-[5%]">
              <div
                className="relative h-full w-full overflow-hidden"
                style={{ backgroundColor: bgColor }}
              >
                {src ? (
                  <ProtectedImage
                    src={src}
                    alt={alt}
                    className="h-full w-full object-cover"
                    containerClassName="h-full w-full"
                    textColor={textColor}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    {placeholder ?? (
                      <Package
                        className="h-8 w-8"
                        style={{ color: `${textColor || "#6b5b4f"}40` }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Wall shadow beneath frame */}
        <div className="mx-auto mt-1 h-2 w-[85%] rounded-[50%] bg-black/[0.07] blur-[3px]" />
      </div>

      {/* Console table */}
      <div className="absolute inset-x-[6%] bottom-[6%] z-10 h-[14%]">
        <div className="h-full rounded-t-sm bg-gradient-to-b from-[#b8956a] to-[#9a7d55] shadow-md">
          <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
        </div>
        {/* Table legs hint */}
        <div className="absolute -bottom-[6%] left-[8%] h-[6%] w-[3%] bg-[#8b6f4a]/80" />
        <div className="absolute -bottom-[6%] right-[8%] h-[6%] w-[3%] bg-[#8b6f4a]/80" />
      </div>

      {/* Decor on console */}
      <div className="absolute bottom-[14%] left-[12%] z-20 flex items-end gap-2">
        <div className="h-8 w-3 rounded-full bg-emerald-700/30" />
        <div className="h-10 w-4 rounded-t-full bg-emerald-600/25" />
      </div>
      <div className="absolute bottom-[13%] right-[14%] z-20">
        <div className="h-10 w-8 rounded-t-full bg-amber-100/80 shadow-sm">
          <div className="absolute -top-1 left-1/2 h-1 w-[90%] -translate-x-1/2 rounded-full bg-amber-200/60" />
        </div>
        <div className="mx-auto mt-0.5 h-3 w-2 rounded-sm bg-amber-800/40" />
      </div>

      {/* Floor */}
      <div className="absolute inset-x-0 bottom-0 h-[6%] bg-gradient-to-t from-[#d4cdc3] to-transparent" />
    </div>
  );
}
