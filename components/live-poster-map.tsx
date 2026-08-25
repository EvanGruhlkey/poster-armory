"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed, Minus, Plus, RotateCcw } from "lucide-react";
import { Map as MapLibre, setWorkerUrl } from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { PosterConfig } from "@/lib/types";

export type MapLayerPreset =
  | "everything"
  | "city"
  | "nature"
  | "minimal"
  | "transit";

interface LivePosterMapProps {
  config: PosterConfig;
  bgColor: string;
  textColor: string;
  layerPreset: MapLayerPreset;
  pitch: number;
  onViewChange: (updates: Partial<PosterConfig> & { pitch?: number }) => void;
}

const OPEN_FREE_MAP_STYLE = "https://tiles.openfreemap.org/styles/bright";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distanceToZoom(distance: number) {
  return clamp(13 - Math.log2(Math.max(distance, 1000) / 2500), 3, 17);
}

function zoomToDistance(zoom: number) {
  return clamp(Math.round(2500 * 2 ** (13 - zoom)), 1000, 50000);
}

function mixHex(background: string, foreground: string, amount: number) {
  const parse = (color: string) => {
    const normalized = color.replace("#", "");
    return [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16));
  };
  const [br, bg, bb] = parse(background);
  const [fr, fg, fb] = parse(foreground);
  const channel = (a: number, b: number) =>
    Math.round(a + (b - a) * amount)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(br, fr)}${channel(bg, fg)}${channel(bb, fb)}`;
}

function safeSetPaint(
  map: MapLibreMap,
  layerId: string,
  property: string,
  value: string | number
) {
  try {
    const setPaint = map.setPaintProperty.bind(map) as (
      id: string,
      name: string,
      nextValue: string | number
    ) => void;
    setPaint(layerId, property, value);
  } catch {
    // Upstream styles expose different paint properties by layer type.
  }
}

function safeSetVisibility(map: MapLibreMap, layerId: string, visible: boolean) {
  try {
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  } catch {
    // Ignore layers that do not support a visibility layout property.
  }
}

function applyPosterStyle(
  map: MapLibreMap,
  bgColor: string,
  textColor: string,
  config: PosterConfig,
  layerPreset: MapLayerPreset
) {
  const style = map.getStyle();
  if (!style?.layers) return;

  const waterColor = mixHex(bgColor, textColor, 0.12);
  const parkColor = mixHex(bgColor, textColor, 0.08);
  const secondaryColor = mixHex(bgColor, textColor, 0.34);
  const preset = {
    everything: { labels: true, water: true, parks: true, minorRoads: true },
    city: { labels: true, water: true, parks: false, minorRoads: true },
    nature: { labels: false, water: true, parks: true, minorRoads: false },
    minimal: { labels: false, water: true, parks: false, minorRoads: false },
    transit: { labels: true, water: true, parks: false, minorRoads: false },
  }[layerPreset];

  for (const layer of style.layers) {
    const id = layer.id.toLowerCase();
    const isWater = /water|ocean|lake|river/.test(id);
    const isPark = /park|green|wood|forest|grass|landcover/.test(id);
    const isMinorRoad = /minor|residential|service|path|track|foot|pedestrian/.test(id);
    const isTransit = /rail|transit|subway|tram|ferry/.test(id);
    const isLabel = layer.type === "symbol";

    let visible = true;
    if (isLabel && (!config.show_labels || !preset.labels)) visible = false;
    if (isWater && (!config.show_water || !preset.water)) visible = false;
    if (isPark && (!config.show_parks || !preset.parks)) visible = false;
    if (isMinorRoad && (config.major_roads_only || !preset.minorRoads)) visible = false;
    if (layerPreset === "transit" && layer.type === "line" && !isTransit && isMinorRoad) {
      visible = false;
    }
    safeSetVisibility(map, layer.id, visible);

    if (layer.type === "background") {
      safeSetPaint(map, layer.id, "background-color", bgColor);
    } else if (layer.type === "fill") {
      safeSetPaint(
        map,
        layer.id,
        "fill-color",
        isWater ? waterColor : isPark ? parkColor : bgColor
      );
      safeSetPaint(map, layer.id, "fill-outline-color", secondaryColor);
    } else if (layer.type === "line") {
      safeSetPaint(map, layer.id, "line-color", isWater ? waterColor : textColor);
      safeSetPaint(map, layer.id, "line-opacity", isMinorRoad ? 0.42 : 0.72);
    } else if (layer.type === "symbol") {
      safeSetPaint(map, layer.id, "text-color", textColor);
      safeSetPaint(map, layer.id, "text-halo-color", bgColor);
      safeSetPaint(map, layer.id, "text-halo-width", 1.2);
      safeSetPaint(map, layer.id, "icon-color", textColor);
    } else if (layer.type === "circle") {
      safeSetPaint(map, layer.id, "circle-color", textColor);
      safeSetPaint(map, layer.id, "circle-stroke-color", bgColor);
    }
  }
}

export function LivePosterMap({
  config,
  bgColor,
  textColor,
  layerPreset,
  pitch,
  onViewChange,
}: LivePosterMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onViewChangeRef = useRef(onViewChange);
  const initialViewRef = useRef({
    lat: config.lat,
    lon: config.lon,
    distance: config.distance,
    rotation: config.rotation,
    pitch,
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;

    setWorkerUrl("/maplibre-gl-worker.mjs");
    const map = new MapLibre({
        container: containerRef.current,
        style: OPEN_FREE_MAP_STYLE,
        center: [config.lon, config.lat],
        zoom: distanceToZoom(config.distance),
        bearing: config.rotation,
        pitch,
        attributionControl: false,
      });

      mapRef.current = map;
      const markReady = () => {
        if (disposed) return;
        map.resize();
        map.triggerRepaint();
        setReady(true);
        try {
          applyPosterStyle(map, bgColor, textColor, config, layerPreset);
        } catch {
          // Keep the upstream map visible if a style does not accept a customization.
        }
      };
      map.once("style.load", markReady);
      map.once("load", markReady);
      map.on("error", () => setError(true));
      map.on("moveend", () => {
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
  }, [bgColor, textColor, config.show_labels, config.show_water, config.show_parks, config.major_roads_only, layerPreset, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.jumpTo({ bearing: config.rotation, pitch });
  }, [config.rotation, pitch, ready]);

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
          <p className="text-xs">The live map could not load. Your high-resolution preview is still available.</p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/45 via-black/15 to-transparent" />
      <div className="pointer-events-none absolute inset-x-6 bottom-7 text-center text-white drop-shadow-md sm:inset-x-8 sm:bottom-9">
        <p className="text-base font-bold tracking-[0.2em] sm:text-xl">
          {(config.title || config.city || "YOUR CITY").toUpperCase()}
        </p>
        {(config.subtitle || config.country) && (
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] opacity-90 sm:text-xs">
            {config.subtitle || config.country}
          </p>
        )}
        {config.date_line && (
          <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] opacity-80">
            {config.date_line}
          </p>
        )}
        <p className="mt-1.5 text-[9px] tracking-[0.12em] opacity-75">
          {Math.abs(config.lat).toFixed(4)}° {config.lat >= 0 ? "N" : "S"} ·{" "}
          {Math.abs(config.lon).toFixed(4)}° {config.lon >= 0 ? "E" : "W"}
        </p>
      </div>

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

      <div className="pointer-events-none absolute bottom-1.5 left-2 rounded bg-background/75 px-1.5 py-0.5 text-[8px] text-muted-foreground backdrop-blur">
        © OpenStreetMap · OpenFreeMap
      </div>
    </div>
  );
}
