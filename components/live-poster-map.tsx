"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { LocateFixed, Minus, Plus, RotateCcw } from "lucide-react";
import { Map as MapLibre, setWorkerUrl } from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { PosterConfig } from "@/lib/types";
import {
  OPEN_FREE_MAP_STYLE,
  applyPosterStyle,
  distanceToZoom,
  zoomToDistance,
  type MapLayerPreset,
} from "@/lib/live-poster-style";

export type { MapLayerPreset };

export interface LivePosterMapHandle {
  getCanvas: () => HTMLCanvasElement | null;
  isReady: () => boolean;
}

interface LivePosterMapProps {
  config: PosterConfig;
  bgColor: string;
  textColor: string;
  layerPreset: MapLayerPreset;
  pitch: number;
  onViewChange?: (updates: Partial<PosterConfig> & { pitch?: number }) => void;
  interactive?: boolean;
  showControls?: boolean;
  onIdle?: () => void;
  /**
   * Render the canvas at this long edge in pixels rather than at the device
   * pixel ratio, so the export is print resolution instead of an upscale.
   */
  captureLongEdge?: number;
}

export const LivePosterMap = forwardRef<LivePosterMapHandle, LivePosterMapProps>(
  function LivePosterMap(
    {
      config,
      bgColor,
      textColor,
      layerPreset,
      pitch,
      onViewChange,
      interactive = true,
      showControls = interactive,
      onIdle,
      captureLongEdge,
    },
    ref
  ) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onViewChangeRef = useRef(onViewChange);
  const onIdleRef = useRef(onIdle);
  const initialViewRef = useRef({
    lat: config.lat,
    lon: config.lon,
    distance: config.distance,
    rotation: config.rotation,
    pitch,
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      getCanvas: () => mapRef.current?.getCanvas() ?? null,
      isReady: () => !!mapRef.current?.loaded(),
    }),
    []
  );

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;

    // Served from /public by scripts/copy-maplibre-worker.mjs.
    setWorkerUrl("/maplibre-gl-worker.mjs");
    const map = new MapLibre({
      container: containerRef.current,
      style: OPEN_FREE_MAP_STYLE,
      center: [config.lon, config.lat],
      zoom: distanceToZoom(config.distance),
      bearing: config.rotation,
      pitch,
      attributionControl: false,
      interactive,
      ...(captureLongEdge
        ? { maxCanvasSize: [captureLongEdge, captureLongEdge] as [number, number] }
        : {}),
      // Required to read pixels back off the canvas for the poster export;
      // MapLibre 5 clears the drawing buffer after each composite otherwise.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });

    mapRef.current = map;
    let idleNotified = false;
    const notifyIdle = () => {
      if (disposed || idleNotified) return;
      idleNotified = true;
      onIdleRef.current?.();
    };
    const markReady = () => {
      if (disposed) return;
      map.resize();
      setReady(true);
      try {
        applyPosterStyle(map, bgColor, textColor, config, layerPreset);
      } catch {
        // Keep the upstream map visible if a style does not accept a customization.
      }
      if (captureLongEdge && containerRef.current) {
        const cssLongEdge = Math.max(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight
        );
        if (cssLongEdge > 0) map.setPixelRatio(captureLongEdge / cssLongEdge);
      }
      map.triggerRepaint();
      map.once("idle", notifyIdle);
      // Only a safety net: capturing a half-drawn map is worse than waiting.
      window.setTimeout(notifyIdle, captureLongEdge ? 25_000 : 1_500);
    };
    map.once("style.load", markReady);
    map.on("error", () => setError(true));
    map.on("moveend", () => {
      if (!onViewChangeRef.current) return;
      const center = map.getCenter();
      onViewChangeRef.current({
        lat: Number(center.lat.toFixed(6)),
        lon: Number(center.lng.toFixed(6)),
        distance: zoomToDistance(map.getZoom()),
        rotation: Number(map.getBearing().toFixed(1)),
        pitch: Number(map.getPitch().toFixed(1)),
      });
    });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The initial camera is captured once; later updates use jumpTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyPosterStyle(map, bgColor, textColor, config, layerPreset);
  }, [
    bgColor,
    textColor,
    config.show_labels,
    config.show_water,
    config.show_parks,
    config.major_roads_only,
    layerPreset,
    ready,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.jumpTo({ bearing: config.rotation, pitch });
  }, [config.rotation, pitch, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || interactive) return;
    map.jumpTo({
      center: [config.lon, config.lat],
      zoom: distanceToZoom(config.distance),
      bearing: config.rotation,
      pitch,
    });
  }, [config.lat, config.lon, config.distance, config.rotation, pitch, ready, interactive]);

  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 220 });
  }, []);

  const resetView = useCallback(() => {
    const initial = initialViewRef.current;
    mapRef.current?.easeTo({
      center: [initial.lon, initial.lat],
      zoom: distanceToZoom(initial.distance),
      bearing: initial.rotation,
      pitch: initial.pitch,
      duration: 450,
    });
  }, []);

  const recenter = useCallback(() => {
    mapRef.current?.easeTo({ center: [config.lon, config.lat], duration: 350 });
  }, [config.lat, config.lon]);

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ backgroundColor: bgColor }}>
      <div ref={containerRef} className="absolute inset-0" />

      {!ready && !error && (
        <div className="absolute inset-0 grid place-items-center" style={{ color: textColor }}>
          <div className="text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <p className="mt-2 text-xs font-medium">Loading live map</p>
          </div>
        </div>
      )}

      {error && !ready && (
        <div className="absolute inset-0 grid place-items-center px-8 text-center" style={{ color: textColor }}>
          <p className="text-xs">The live map could not load. Try refreshing—the design settings are safe.</p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/45 via-black/15 to-transparent" />
      <div className="pointer-events-none absolute inset-x-6 bottom-7 text-center text-white drop-shadow-md sm:inset-x-8 sm:bottom-9">
        {config.title && (
          <p className="text-base font-bold tracking-[0.2em] sm:text-xl">
            {config.title.toUpperCase()}
          </p>
        )}
        {config.subtitle && (
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] opacity-90 sm:text-xs">
            {config.subtitle}
          </p>
        )}
        {config.date_line && (
          <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] opacity-80">
            {config.date_line}
          </p>
        )}
        {config.show_coordinates && (
          <p className="mt-1.5 text-[9px] tracking-[0.12em] opacity-75">
            {Math.abs(config.lat).toFixed(4)}° {config.lat >= 0 ? "N" : "S"} ·{" "}
            {Math.abs(config.lon).toFixed(4)}° {config.lon >= 0 ? "E" : "W"}
          </p>
        )}
      </div>

      {showControls && (
        <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-md border bg-background/90 shadow-sm backdrop-blur">
          <button type="button" onClick={() => zoomBy(1)} className="grid h-8 w-8 place-items-center hover:bg-muted" aria-label="Zoom in">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => zoomBy(-1)} className="grid h-8 w-8 place-items-center border-t hover:bg-muted" aria-label="Zoom out">
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" onClick={recenter} className="grid h-8 w-8 place-items-center border-t hover:bg-muted" aria-label="Recenter map">
            <LocateFixed className="h-4 w-4" />
          </button>
          <button type="button" onClick={resetView} className="grid h-8 w-8 place-items-center border-t hover:bg-muted" aria-label="Reset map view">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-1 left-1 text-[5px] font-medium leading-none text-white/30 mix-blend-difference">
        © OpenStreetMap contributors · OpenFreeMap
      </div>
    </div>
  );
});
