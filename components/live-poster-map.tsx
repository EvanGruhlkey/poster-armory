"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { LocateFixed, Minus, Plus, RotateCcw } from "lucide-react";
import { Map as MapLibre, setWorkerUrl } from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { PosterConfig } from "@/lib/types";
import { getPosterMapStyle } from "@/lib/poster-renderer/adapter";
import { updatePosterMapStyle } from "@/lib/poster-renderer/update-style";
import { DEFAULT_POSTER_MAP_BOUNDS, zoomForExportWidth } from "@/lib/poster-renderer/export";
import { MAPLIBRE_WORKER_URL } from "@/lib/generated/maplibre-worker";
import { fitTitleScale, resolvePosterTypography } from "@/lib/poster-typography";
import { getPosterTextBackdrop, getPosterTextLayout, getPosterTextMetrics } from "@/lib/poster-text-layout";
import { getPosterScaleBar } from "@/lib/poster-labels";
import {
  distanceToZoom,
  MAX_POSTER_ZOOM,
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
  const posterRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const applyingViewRef = useRef(false);
  const userMoveRef = useRef(false);
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
  const subtitleBoxRef = useRef<HTMLDivElement | null>(null);
  const subtitleTextRef = useRef<HTMLSpanElement | null>(null);
  const [subtitleScale, setSubtitleScale] = useState(1);
  const [posterSize, setPosterSize] = useState({ width: 330, height: 440 });

  useEffect(() => {
    const element = posterRef.current;
    if (!element) return;
    const measure = () => setPosterSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
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
    setWorkerUrl(MAPLIBRE_WORKER_URL);
    const map = new MapLibre({
      container: containerRef.current,
      style: getPosterMapStyle(config),
      center: [config.lon, config.lat],
      zoom: previewZoom(config.distance),
      maxZoom: MAX_POSTER_ZOOM,
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
    const armUserMove = () => { userMoveRef.current = true; };
    map.getCanvas().addEventListener("pointerdown", armUserMove);
    map.getCanvas().addEventListener("wheel", armUserMove);
    map.getCanvas().addEventListener("keydown", armUserMove);
    let previousWidth = viewportWidth();
    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = viewportWidth();
      const nextZoom = map.getZoom() + Math.log2(nextWidth / previousWidth);
      previousWidth = nextWidth;
      applyingViewRef.current = true;
      try {
        map.resize();
        map.jumpTo({ zoom: nextZoom });
      } finally {
        applyingViewRef.current = false;
      }
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
      if (applyingViewRef.current || !userMoveRef.current) return;
      userMoveRef.current = false;
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
      map.getCanvas().removeEventListener("pointerdown", armUserMove);
      map.getCanvas().removeEventListener("wheel", armUserMove);
      map.getCanvas().removeEventListener("keydown", armUserMove);
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The initial camera is captured once; later updates use jumpTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    updatePosterMapStyle(map, getPosterMapStyle(config));
  }, [
    config.style_id,
    config.palette_id,
    config.custom_colors,
    config.map_layers,
    config.road_weight,
    config.terrain_exaggeration,
    config.building_height_scale,
    config.pitch,
    config.show_labels,
    config.show_water,
    config.show_parks,
    config.major_roads_only,
    config.label_admin,
    config.label_cities,
    config.label_streets,
    config.label_size,
    config.label_style,
    config.show_grid,
    config.grid_density,
    config.grid_weight,
    config.lat,
    config.lon,
    config.center_marker,
    config.markers,
    config.connect_markers,
    config.marker_path_color,
    config.marker_path_width,
    config.marker_path_style,
    config.show_segment_lengths,
    config.marker_fill_color,
    ready,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyingViewRef.current = true;
    try { map.jumpTo({ bearing: config.rotation, pitch }); }
    finally { applyingViewRef.current = false; }
  }, [config.rotation, pitch, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const center = map.getCenter();
    const zoom = previewZoom(config.distance);
    if (
      Math.abs(center.lat - config.lat) < 0.00001 &&
      Math.abs(center.lng - config.lon) < 0.00001 &&
      Math.abs(map.getZoom() - zoom) < 0.01 &&
      Math.abs(map.getBearing() - config.rotation) < 0.1 &&
      Math.abs(map.getPitch() - pitch) < 0.1
    ) return;
    applyingViewRef.current = true;
    try { map.jumpTo({
      center: [config.lon, config.lat],
      zoom,
      bearing: config.rotation,
      pitch,
    }); }
    finally { applyingViewRef.current = false; }
  }, [config.lat, config.lon, config.distance, config.rotation, pitch, ready]);

  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    userMoveRef.current = true;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 220 });
  }, []);

  const resetView = useCallback(() => {
    const initial = initialViewRef.current;
    userMoveRef.current = true;
    mapRef.current?.easeTo({
      center: [initial.lon, initial.lat],
      zoom: previewZoom(initial.distance),
      bearing: initial.rotation,
      pitch: initial.pitch,
      duration: 450,
    });
  }, []);

  const recenter = useCallback(() => {
    userMoveRef.current = true;
    mapRef.current?.easeTo({ center: [config.lon, config.lat], duration: 350 });
  }, [config.lat, config.lon]);

  const posterTitle = config.title.trim() || config.city;
  const posterSubtitle = config.subtitle.trim() || config.country;
  const typography = resolvePosterTypography(config);
  const layout = getPosterTextLayout(config, posterSize.width, posterSize.height);
  const metrics = getPosterTextMetrics(config, posterSize.width, posterSize.height);
  const backdrop = getPosterTextBackdrop(config);
  const titleShadow = backdrop.kind === "subtle" ? `0 0 ${Math.max(2, metrics.titleSize * 0.2)}px ${bgColor}` : undefined;

  type ResizeEdge = "top" | "right" | "bottom" | "left" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  const beginMapResize = useCallback((edge: ResizeEdge, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = config.map_bounds ?? DEFAULT_POSTER_MAP_BOUNDS;
    const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / Math.max(1, posterSize.width);
      const dy = (moveEvent.clientY - startY) / Math.max(1, posterSize.height);
      const next = { ...start };
      if (edge.includes("left")) next.left = clamp(start.left + dx, 0.85 - start.right);
      if (edge.includes("right")) next.right = clamp(start.right - dx, 0.85 - start.left);
      if (edge.includes("top")) next.top = clamp(start.top + dy, 0.85 - start.bottom);
      if (edge.includes("bottom")) next.bottom = clamp(start.bottom - dy, 0.85 - start.top);
      onViewChangeRef.current?.({
        map_bounds: {
          left: Number(next.left.toFixed(4)),
          top: Number(next.top.toFixed(4)),
          right: Number(next.right.toFixed(4)),
          bottom: Number(next.bottom.toFixed(4)),
        },
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    const cursor = edge === "left" || edge === "right" ? "ew-resize"
      : edge === "top" || edge === "bottom" ? "ns-resize"
      : edge === "top-right" || edge === "bottom-left" ? "nesw-resize"
      : "nwse-resize";
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  }, [config.map_bounds, posterSize.height, posterSize.width]);

  const beginTextInteraction = useCallback((action: ResizeEdge | "move", event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = config.text_bounds ?? {
      x: layout.text.x / Math.max(1, posterSize.width),
      y: layout.text.y / Math.max(1, posterSize.height),
      width: layout.text.width / Math.max(1, posterSize.width),
      height: layout.text.height / Math.max(1, posterSize.height),
    };
    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / Math.max(1, posterSize.width);
      const dy = (moveEvent.clientY - startY) / Math.max(1, posterSize.height);
      const next = { ...start };
      if (action === "move") {
        next.x = Math.min(1 - start.width, Math.max(0, start.x + dx));
        next.y = Math.min(1 - start.height, Math.max(0, start.y + dy));
      } else {
        if (action.includes("left")) {
          const right = start.x + start.width;
          next.x = Math.min(right - 0.12, Math.max(0, start.x + dx));
          next.width = right - next.x;
        }
        if (action.includes("right")) next.width = Math.min(1 - start.x, Math.max(0.12, start.width + dx));
        if (action.includes("top")) {
          const bottom = start.y + start.height;
          next.y = Math.min(bottom - 0.06, Math.max(0, start.y + dy));
          next.height = bottom - next.y;
        }
        if (action.includes("bottom")) next.height = Math.min(1 - start.y, Math.max(0.06, start.height + dy));
      }
      onViewChangeRef.current?.({
        text_bounds: {
          x: Number(next.x.toFixed(4)),
          y: Number(next.y.toFixed(4)),
          width: Number(next.width.toFixed(4)),
          height: Number(next.height.toFixed(4)),
        },
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = action === "move" ? "move"
      : action === "left" || action === "right" ? "ew-resize"
      : action === "top" || action === "bottom" ? "ns-resize"
      : action === "top-right" || action === "bottom-left" ? "nesw-resize"
      : "nwse-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  }, [config.text_bounds, layout.text.height, layout.text.width, layout.text.x, layout.text.y, posterSize.height, posterSize.width]);

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
  }, [posterTitle, typography.titleFont, typography.titleSize, typography.titleTracking, typography.titleAllCaps, metrics.titleSize]);

  useEffect(() => {
    const box = subtitleBoxRef.current;
    const subtitle = subtitleTextRef.current;
    if (!box || !subtitle) return;
    const measure = () => setSubtitleScale(fitTitleScale(subtitle.offsetWidth, box.clientWidth));
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(subtitle);
    void document.fonts?.ready.then(measure);
    measure();
    return () => observer.disconnect();
  }, [posterSubtitle, typography.subtitleFont, typography.subtitleSize, typography.subtitleTracking, metrics.subtitleSize]);

  return (
    <div ref={posterRef} className="relative h-full w-full overflow-hidden" style={{ backgroundColor: bgColor, color: textColor, containerType: "inline-size" }}>
      {(config.outer_border_style ?? "none") !== "none" && (
        <div className="pointer-events-none absolute inset-[2.5%] z-40" aria-hidden="true" style={{
          boxShadow: config.outer_border_style === "double"
            ? `inset 0 0 0 0.14cqw ${textColor}, inset 0 0 0 1.05cqw ${bgColor}, inset 0 0 0 1.2cqw ${textColor}`
            : `inset 0 0 0 0.14cqw ${textColor}`,
        }} />
      )}
      <div className="absolute overflow-hidden" style={{
        left: layout.map.x,
        top: layout.map.y,
        width: layout.map.width,
        height: layout.map.height,
      }}>
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

      {config.show_scale && (() => {
        const scale = getPosterScaleBar(config, posterSize.width * 0.88);
        return <div className="pointer-events-none absolute bottom-2 right-3 rounded bg-background/80 px-1.5 py-1 text-right text-[9px] font-medium shadow-sm" style={{ color: textColor }}>
          <span>{scale.label}</span>
          <div className="mt-0.5 border-b-2 border-x-2" style={{ width: scale.widthPx, height: 5, borderColor: textColor }} />
        </div>;
      })()}
      {interactive && (
        <div className="group pointer-events-none absolute inset-0 z-20">
          <span aria-hidden="true" className="absolute inset-0 border border-white/80 opacity-0 shadow-[inset_0_0_0_1px_rgba(24,52,75,0.35)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
          {([
            ["top", "left-4 right-4 top-0 h-3 cursor-ns-resize"],
            ["right", "bottom-4 right-0 top-4 w-3 cursor-ew-resize"],
            ["bottom", "bottom-0 left-4 right-4 h-3 cursor-ns-resize"],
            ["left", "bottom-4 left-0 top-4 w-3 cursor-ew-resize"],
            ["top-left", "left-0 top-0 h-5 w-5 cursor-nwse-resize"],
            ["top-right", "right-0 top-0 h-5 w-5 cursor-nesw-resize"],
            ["bottom-left", "bottom-0 left-0 h-5 w-5 cursor-nesw-resize"],
            ["bottom-right", "bottom-0 right-0 h-5 w-5 cursor-nwse-resize"],
          ] as const).map(([edge, classes]) => (
            <button
              key={edge}
              type="button"
              aria-label={`Resize map from ${edge} edge`}
              title="Drag to resize map"
              onPointerDown={(event) => beginMapResize(edge, event)}
              className={`pointer-events-auto absolute touch-none bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${classes}`}
            />
          ))}
          {[
            "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
            "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
            "right-0 top-0 translate-x-1/2 -translate-y-1/2",
            "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
            "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
            "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
            "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
            "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
          ].map((position) => (
            <span key={position} aria-hidden="true" className={`absolute h-2.5 w-2.5 rounded-sm border border-white bg-[#18344b] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${position}`} />
          ))}
        </div>
      )}
      </div>

      <div className="pointer-events-none absolute flex flex-col items-center justify-center text-center" style={{
        left: layout.text.x, top: layout.text.y, width: layout.text.width, height: layout.text.height,
        gap: metrics.gap,
      }}>
        {interactive && (
          <div className="group pointer-events-none absolute inset-0 z-30">
            <span aria-hidden="true" className="absolute inset-0 border border-[#18344b]/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
            <button type="button" aria-label="Move text block" title="Drag to move text"
              onPointerDown={(event) => beginTextInteraction("move", event)}
              className="pointer-events-auto absolute inset-3 cursor-move touch-none bg-transparent" />
            {([
              ["top", "left-4 right-4 top-0 h-3 cursor-ns-resize"],
              ["right", "bottom-4 right-0 top-4 w-3 cursor-ew-resize"],
              ["bottom", "bottom-0 left-4 right-4 h-3 cursor-ns-resize"],
              ["left", "bottom-4 left-0 top-4 w-3 cursor-ew-resize"],
              ["top-left", "left-0 top-0 h-5 w-5 cursor-nwse-resize"],
              ["top-right", "right-0 top-0 h-5 w-5 cursor-nesw-resize"],
              ["bottom-left", "bottom-0 left-0 h-5 w-5 cursor-nesw-resize"],
              ["bottom-right", "bottom-0 right-0 h-5 w-5 cursor-nwse-resize"],
            ] as const).map(([edge, classes]) => (
              <button key={edge} type="button" aria-label={`Resize text from ${edge} edge`} title="Drag to resize text"
                onPointerDown={(event) => beginTextInteraction(edge, event)}
                className={`pointer-events-auto absolute touch-none bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18344b] ${classes}`} />
            ))}
            {[
              "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
              "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
              "right-0 top-0 translate-x-1/2 -translate-y-1/2",
              "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
              "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
              "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
              "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
              "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
            ].map((position) => (
              <span key={position} aria-hidden="true" className={`absolute h-2.5 w-2.5 rounded-sm border border-white bg-[#18344b] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${position}`} />
            ))}
          </div>
        )}
        {backdrop.kind === "strong" && <div className="absolute inset-0" style={{ backgroundColor: bgColor, opacity: backdrop.alpha }} />}
        {backdrop.kind === "gradient" && <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent, ${bgColor}c7, transparent)` }} />}
        <div ref={titleBoxRef} className="relative flex justify-center overflow-x-clip overflow-y-visible whitespace-nowrap" style={{ width: "98%" }}>
          <span ref={titleTextRef} className="inline-block shrink-0" style={{ fontFamily: `"${typography.titleFont}", sans-serif`, fontWeight: typography.titleWeight, fontSize: metrics.titleSize, lineHeight: 1, letterSpacing: `${typography.titleTracking}em`, textTransform: typography.titleAllCaps ? "uppercase" : "none", textShadow: titleShadow, transform: `scaleX(${titleScale})`, transformOrigin: "center" }}>{posterTitle}</span>
        </div>
        {posterSubtitle && <div ref={subtitleBoxRef} className="relative flex justify-center overflow-x-clip overflow-y-visible whitespace-nowrap opacity-75" style={{ width: "98%" }}>
          <span ref={subtitleTextRef} className="inline-block shrink-0 uppercase" style={{ fontFamily: `"${typography.subtitleFont}", sans-serif`, fontWeight: typography.subtitleWeight, fontSize: metrics.subtitleSize, lineHeight: 1, letterSpacing: `${typography.subtitleTracking}em`, textShadow: titleShadow, transform: `scaleX(${subtitleScale})`, transformOrigin: "center" }}>{posterSubtitle}</span>
        </div>}
        {config.date_line && <p className="relative max-w-full truncate uppercase opacity-70" style={{ fontSize: metrics.metaSize, lineHeight: 1, letterSpacing: "0.7cqw", textShadow: titleShadow }}>{config.date_line}</p>}
        {config.show_coordinates && (
          <p className="relative opacity-65" style={{ fontSize: metrics.metaSize, lineHeight: 1, letterSpacing: "0.6cqw", textShadow: titleShadow }}>
            {Math.abs(config.lat).toFixed(4)}° {config.lat >= 0 ? "N" : "S"} ·{" "}
            {Math.abs(config.lon).toFixed(4)}° {config.lon >= 0 ? "E" : "W"}
          </p>
        )}
      </div>
    </div>
  );
});
