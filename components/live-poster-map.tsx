"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { LocateFixed, Minus, Plus, RotateCcw } from "lucide-react";
import { Map as MapLibre, setWorkerUrl } from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { PosterConfig } from "@/lib/types";
import { getPosterMapStyle } from "@/lib/poster-renderer/adapter";
import { zoomForExportWidth } from "@/lib/poster-renderer/export";
import { fitTitleScale, resolvePosterTypography } from "@/lib/poster-typography";
import {
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
  const titleBoxRef = useRef<HTMLDivElement | null>(null);
  const titleTextRef = useRef<HTMLSpanElement | null>(null);
  const [titleScale, setTitleScale] = useState(1);
  const viewportWidth = () => containerRef.current?.clientWidth || 330;
  const previewZoom = (distance: number) => zoomForExportWidth(distanceToZoom(distance), viewportWidth());
  const previewDistance = (zoom: number) => zoomToDistance(zoom - Math.log2(viewportWidth() / 330));

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
      style: getPosterMapStyle(config),
      center: [config.lon, config.lat],
      zoom: previewZoom(config.distance),
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
    let previousWidth = containerRef.current.clientWidth || 330;
    const resizeObserver = new ResizeObserver(() => {
      const oldWidth = previousWidth;
      map.resize();
      const newWidth = map.getContainer().clientWidth || 330;
      if (Math.abs(newWidth - oldWidth) > 1) map.setZoom(map.getZoom() + Math.log2(newWidth / oldWidth));
      previousWidth = newWidth;
    });
    resizeObserver.observe(containerRef.current);
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
        distance: previewDistance(map.getZoom()),
        rotation: Number(map.getBearing().toFixed(1)),
        pitch: Number(map.getPitch().toFixed(1)),
      });
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The initial camera is captured once; later updates use jumpTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setStyle(getPosterMapStyle(config));
  }, [
    config.style_id,
    config.show_labels,
    config.show_water,
    config.show_parks,
    config.major_roads_only,
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
      zoom: previewZoom(config.distance),
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
      zoom: previewZoom(initial.distance),
      bearing: initial.rotation,
      pitch: initial.pitch,
      duration: 450,
    });
  }, []);

  const recenter = useCallback(() => {
    mapRef.current?.easeTo({ center: [config.lon, config.lat], duration: 350 });
  }, [config.lat, config.lon]);

  const posterTitle = config.title.trim() || config.city;
  const posterSubtitle = config.subtitle.trim() || config.country;
  const typography = resolvePosterTypography(config);

  useEffect(() => {
    const box = titleBoxRef.current;
    const title = titleTextRef.current;
    if (!box || !title) return;
    const measure = () => setTitleScale(fitTitleScale(title.offsetWidth, box.clientWidth));
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(title);
    void document.fonts?.ready.then(measure);
    measure();
    return () => observer.disconnect();
  }, [posterTitle, typography.titleFont, typography.titleSize, typography.titleTracking]);

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ backgroundColor: bgColor, color: textColor, containerType: "inline-size" }}>
      <div className="absolute inset-x-[6%] bottom-[23%] top-[5%] overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      {typography.frameStyle !== "none" && (
        <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true" style={{
          boxShadow: typography.frameStyle === "double"
            ? `inset 0 0 0 0.1cqw ${textColor}55, inset 0 0 0 0.7cqw ${bgColor}, inset 0 0 0 0.8cqw ${textColor}55`
            : `inset 0 0 0 0.1cqw ${textColor}55`,
        }} />
      )}

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

      <div className="pointer-events-none absolute bottom-1 left-1 right-1 w-fit max-w-[98%] px-1 py-0.5 text-[7px] font-medium leading-tight text-white/60 mix-blend-difference">
        © OpenStreetMap contributors · OpenFreeMap
      </div>
      </div>

      <div className="pointer-events-none absolute inset-x-[6%] bottom-[4%] top-[79%] flex flex-col items-center justify-center text-center">
        <div ref={titleBoxRef} className="flex justify-center overflow-hidden whitespace-nowrap" style={{ width: "97.7%" }}>
          <span ref={titleTextRef} className="inline-block shrink-0 uppercase" style={{ fontFamily: `"${typography.titleFont}", sans-serif`, fontWeight: typography.titleWeight, fontSize: `${typography.titleSize}cqw`, letterSpacing: `${typography.titleTracking}em`, transform: `scaleX(${titleScale})`, transformOrigin: "center" }}>{posterTitle}</span>
        </div>
        {posterSubtitle && <p className="mt-1 max-w-full truncate uppercase opacity-75" style={{ fontSize: "2.4cqw", letterSpacing: "0.5cqw" }}>{posterSubtitle}</p>}
        {config.date_line && <p className="mt-1 max-w-full truncate uppercase opacity-70" style={{ fontSize: "1.9cqw", letterSpacing: "0.7cqw" }}>{config.date_line}</p>}
        {config.show_coordinates && (
          <p className="mt-1 opacity-65" style={{ fontSize: "1.9cqw", letterSpacing: "0.6cqw" }}>
            {Math.abs(config.lat).toFixed(4)}° {config.lat >= 0 ? "N" : "S"} ·{" "}
            {Math.abs(config.lon).toFixed(4)}° {config.lon >= 0 ? "E" : "W"}
          </p>
        )}
      </div>
    </div>
  );
});
