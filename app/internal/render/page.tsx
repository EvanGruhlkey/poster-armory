"use client";

import { useEffect } from "react";
import type { PosterConfig } from "@/lib/types";
import { renderPosterPNG } from "@/lib/live-poster-export";

declare global {
  interface Window {
    renderPosterForWorker?: (config: Record<string, unknown>, width: number, height: number) => Promise<string>;
  }
}

export default function InternalRenderPage() {
  useEffect(() => {
    window.renderPosterForWorker = async (input, width, height) => {
      const png = await renderPosterPNG(input as unknown as PosterConfig, width, height);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not encode print poster."));
        reader.readAsDataURL(png);
      });
    };
    return () => { delete window.renderPosterForWorker; };
  }, []);
  return null;
}
