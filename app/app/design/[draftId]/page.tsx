"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Loader2,
  Download,
  Package,
  LogIn,
  Rotate3D,
} from "lucide-react";
import { toast } from "sonner";
import { getPosterPalette } from "@/lib/poster-renderer/adapter";
import { fitPosterInStage } from "@/lib/poster-editor-geometry";
import { PosterRoomStage, type PosterViewMode } from "@/components/poster-room-stage";
import {
  applyTypographyCustomization,
  resolvePosterTypography,
} from "@/lib/poster-typography";
import { PosterTextChoices } from "@/components/poster-text-choices";
import { PosterColorControls } from "@/components/poster-color-controls";
import { PosterMapControls } from "@/components/poster-map-controls";
import { PosterEditorSidebar, type PosterEditorTool } from "@/components/poster-editor-sidebar";
import {
  POSTER_SIZES,
  type PosterConfig,
  DEFAULT_CONFIG,
} from "@/lib/types";
import {
  LivePosterMap,
  type MapLayerPreset,
} from "@/components/live-poster-map";
import {
  DEFAULT_SIZE,
  MEMBERSHIP_DOWNLOADS_PER_MONTH,
  MEMBERSHIP_PRICE_MONTHLY_USD,
} from "@/lib/plan-config";
import { useAuth } from "@/components/auth-provider";
import { useSubscription } from "@/components/subscription-provider";

interface SavedDesignState {
  config?: PosterConfig;
  selectedSize?: typeof DEFAULT_SIZE;
  layerPreset?: MapLayerPreset;
  pitch?: number;
}

export default function CustomizePosterPage({
  params,
}: {
  params: { draftId: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { subscription, refresh: refreshSubscription } = useSubscription();

  const city = searchParams.get("city") || "";
  const country = searchParams.get("country") || "";
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lon = parseFloat(searchParams.get("lon") || "0");

  // Designing is free and instant. Membership state only gates the
  // high-resolution download; physical prints are bought per order.
  const isGuest = !user;
  const isMember = subscription.planTier === "membership";
  const downloadsRemaining = subscription.downloadsRemaining;
  const outOfDownloads = isMember && downloadsRemaining === 0;

  const [config, setConfig] = useState<PosterConfig>({
    ...DEFAULT_CONFIG,
    city,
    country,
    lat,
    lon,
    title: "",
    subtitle: "",
    date_line: "",
    show_coordinates: false,
    style_id: "warm_beige",
    distance: 1500,
    show_labels: false,
    show_water: true,
    show_parks: false,
  });

  const [selectedSize, setSelectedSize] = useState(DEFAULT_SIZE);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<PosterEditorTool | null>(null);
  const [viewMode, setViewMode] = useState<PosterViewMode>("map");
  const editorRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState(700);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [layerPreset, setLayerPreset] =
    useState<MapLayerPreset>("minimal");
  const [pitch, setPitch] = useState(0);
  const typography = resolvePosterTypography(config);
  const [draftHydrated, setDraftHydrated] = useState(false);

  useEffect(() => {
    const measure = () => {
      if (editorRef.current) setEditorHeight(Math.max(320, window.innerHeight - editorRef.current.getBoundingClientRect().top));
      if (stageRef.current) {
        const { width, height } = stageRef.current.getBoundingClientRect();
        setStageSize({ width, height });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (stageRef.current) observer.observe(stageRef.current);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  // Keep the live editor state attached to this draft ID. This preserves the
  // exact design across refreshes, browser-back from checkout, and auth flows.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`poster-design-draft:${params.draftId}`);
      if (raw) {
        const saved = JSON.parse(raw) as SavedDesignState;
        if (saved.config) setConfig(saved.config);
        if (saved.selectedSize) setSelectedSize(saved.selectedSize);
        if (saved.layerPreset) setLayerPreset(saved.layerPreset);
        if (typeof saved.pitch === "number") setPitch(saved.pitch);
      }
    } catch {
      // Ignore stale or corrupt browser storage and use URL defaults.
    } finally {
      setDraftHydrated(true);
    }
  }, [params.draftId]);

  useEffect(() => {
    if (!draftHydrated) return;
    try {
      sessionStorage.setItem(
        `poster-design-draft:${params.draftId}`,
        JSON.stringify({ config, selectedSize, layerPreset, pitch })
      );
    } catch {
      // The editor remains usable when browser storage is unavailable.
    }
  }, [config, draftHydrated, layerPreset, params.draftId, pitch, selectedSize]);

  // Restore a design that the user stashed before being bounced through
  // the sign-up flow (see redirectToSignup). This runs once on mount and
  // discards the cache so a hard reload doesn't keep re-restoring it.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("poster-design-resume");
      if (!raw) return;
      sessionStorage.removeItem("poster-design-resume");
      const saved = JSON.parse(raw) as SavedDesignState & {
        city?: string;
        country?: string;
        action?: "download" | "order";
      };
      if (saved.config) setConfig(saved.config);
      if (saved.selectedSize) setSelectedSize(saved.selectedSize);
      if (saved.layerPreset) setLayerPreset(saved.layerPreset);
      if (typeof saved.pitch === "number") setPitch(saved.pitch);
      if (saved.action === "download") {
        toast.success("Welcome back — finish your download below.");
      } else if (saved.action === "order") {
        toast.success("Welcome back — finish your order below.");
      }
    } catch {
      // Corrupt or unavailable sessionStorage — silently ignore.
    }
  }, []);

  const updateConfig = useCallback(
    (updates: Partial<PosterConfig>) => {
      setConfig((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  function redirectToSignup(reason: "download" | "order") {
    // Stash the current design so the user lands back in the editor with
    // their work intact after signing up.
    try {
      sessionStorage.setItem(
        "poster-design-resume",
        JSON.stringify({
          config,
          selectedSize,
          city,
          country,
          action: reason,
          layerPreset,
          pitch,
        })
      );
    } catch {
      // sessionStorage unavailable (rare) — sign-up still works, the
      // user just has to re-customize.
    }
    const currentPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/app";
    router.push(
      `/login?redirect=${encodeURIComponent(currentPath)}&reason=${reason}`
    );
  }

  async function handleDownloadPoster() {
    if (!config.city) {
      toast.error("Please go back and pick a location first.");
      return;
    }
    if (isGuest) {
      toast.info("Create a free account to download your poster.");
      redirectToSignup("download");
      return;
    }
    if (!isMember) {
      toast.info(
        `Designing is free. Subscribe for $${MEMBERSHIP_PRICE_MONTHLY_USD}/month to download high-resolution files.`,
        {
          action: {
            label: "See membership",
            onClick: () => router.push("/app/billing"),
          },
          duration: 8000,
        }
      );
      return;
    }
    setGenerateLoading(true);
    try {
      const submitConfig = {
        ...config,
        width: selectedSize.width,
        height: selectedSize.height,
        layer_preset: layerPreset,
        pitch,
        render_engine: "webgl" as const,
      };
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: submitConfig, is_preview: false }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 403) {
          // Quota or membership state changed server-side — resync so the
          // UI stops offering an action the backend just refused.
          void refreshSubscription();
          toast.error(
            err.error || "Subscribe to download high-resolution files.",
            {
              action: {
                label: "See membership",
                onClick: () => router.push("/app/billing"),
              },
              duration: 8000,
            }
          );
          setGenerateLoading(false);
          return;
        }
        throw new Error(err.error || "Failed to create job");
      }

      const { jobId, cached, status: cachedStatus } = await res.json();

      if (cached && cachedStatus === "done") {
        // Re-downloading a design you already rendered is always free.
        toast.success("Already generated. Opening your download page.");
      } else if (cached) {
        toast.success("Picking up your in-flight render.");
      } else {
        toast.success("Preparing your files from the live map...");
        void refreshSubscription();
      }

      const params = new URLSearchParams();
      params.set("bg", currentStyle.bgColor);
      params.set("tc", currentStyle.textColor);
      const qs = params.toString();
      router.push(`/download/${jobId}${qs ? `?${qs}` : ""}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(msg);
      setGenerateLoading(false);
    }
  }

  function handleOrderPhysical() {
    if (!config.city) {
      toast.error("Please go back and pick a location first.");
      return;
    }
    if (isGuest) {
      toast.info("Create a free account to ship your poster.");
      redirectToSignup("order");
      return;
    }
    const submitConfig = {
      ...config,
      width: selectedSize.width,
      height: selectedSize.height,
      pitch,
      layer_preset: layerPreset,
    };
    try {
      sessionStorage.setItem(
        "poster-order-draft",
        JSON.stringify({
          config: submitConfig,
          style: {
            bgColor: currentStyle.bgColor,
            textColor: currentStyle.textColor,
          },
          city,
          country,
          layerPreset,
          pitch,
        })
      );
    } catch {
      // sessionStorage may be unavailable; the order page falls back gracefully.
    }
    router.push("/app/order");
  }

  const posterPalette = getPosterPalette(config);
  const currentStyle = { bgColor: posterPalette.background, textColor: posterPalette.text };
  const posterFit = fitPosterInStage(stageSize.width, stageSize.height, selectedSize.width / selectedSize.height, 20);

  const livePosterPanel = (
    <Card className="overflow-hidden">
      <div
        className="flex items-center justify-center"
        style={{ backgroundColor: currentStyle.bgColor, aspectRatio: `${selectedSize.width} / ${selectedSize.height}` }}
      >
        <LivePosterMap
          config={config}
          showControls={viewMode === "map"}
          bgColor={currentStyle.bgColor}
          textColor={currentStyle.textColor}
          layerPreset={layerPreset}
          pitch={pitch}
          onViewChange={({ pitch: nextPitch, ...updates }) => {
            if (typeof nextPitch === "number") setPitch(nextPitch);
            updateConfig(updates);
          }}
        />
      </div>
    </Card>
  );

  return (
    <div ref={editorRef} className="flex w-full flex-col overflow-hidden bg-[#eee9e1]" style={{ height: editorHeight }}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#ded6cb] bg-[#faf8f5] px-4 sm:px-7">
        <div className="min-w-0 text-sm font-medium text-[#18344b]">
          <span className="truncate">{city}{country ? `, ${country}` : ""}</span>
          <span className="ml-2 hidden text-xs font-normal text-slate-500 sm:inline">Poster editor</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => {
            try { sessionStorage.setItem(`poster-design-draft:${params.draftId}`, JSON.stringify({ config, selectedSize, layerPreset, pitch })); toast.success("Design saved"); }
            catch { toast.error("Could not save this design"); }
          }}>Save</Button>
          <Button size="sm" className="hidden bg-[#18344b] text-white hover:bg-[#10283a] sm:inline-flex" onClick={handleOrderPhysical} disabled={!config.city}>Order Print →</Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="contents">
          <PosterEditorSidebar activeTool={activeTool} onToolChange={setActiveTool}>
                {activeTool === "map" && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold">Frame your map</h2>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Drag the preview to move the map. Zoom on the preview.</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-xs">
                      <p className="text-muted-foreground">Center</p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {config.lat.toFixed(3)}, {config.lon.toFixed(3)}
                      </p>
                    </div>
                    <div className="space-y-4 border-t pt-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <Rotate3D className="h-3.5 w-3.5" /> Rotation
                            </span>
                            <span className="tabular-nums text-muted-foreground">{Math.round(config.rotation)}°</span>
                          </div>
                          <Slider
                            value={[config.rotation]}
                            onValueChange={([value]) => updateConfig({ rotation: value })}
                            min={-180}
                            max={180}
                            step={1}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">3D angle</span>
                            <span className="tabular-nums text-muted-foreground">{Math.round(pitch)}°</span>
                          </div>
                          <Slider value={[pitch]} onValueChange={([value]) => { setPitch(value); updateConfig({ pitch: value }); }} min={0} max={60} step={1} />
                        </div>
                      </div>
                  </div>
                )}

                {activeTool === "map" && <div className="mt-5"><PosterMapControls config={config} pitch={pitch} onChange={updateConfig} onPitchChange={setPitch} /></div>}

                {activeTool === "type" && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold">Poster text</h2>
                    </div>
                    <PosterTextChoices config={config} onChange={updateConfig} />
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="live-title" className="text-xs">Title</Label>
                        <Input id="live-title" placeholder={config.city} value={config.title} onChange={(event) => updateConfig({ title: event.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="live-subtitle" className="text-xs">Subtitle or dedication</Label>
                        <Input id="live-subtitle" placeholder="Where our story began" value={config.subtitle} onChange={(event) => updateConfig({ subtitle: event.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="live-date" className="text-xs">Date line</Label>
                        <Input id="live-date" placeholder="EST. 2026" value={config.date_line} onChange={(event) => updateConfig({ date_line: event.target.value })} />
                      </div>
                      <div className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5">
                        <div>
                          <Label htmlFor="show-coordinates" className="text-xs">Coordinates</Label>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">Add latitude and longitude to the poster.</p>
                        </div>
                        <Switch
                          id="show-coordinates"
                          checked={Boolean(config.show_coordinates)}
                          onCheckedChange={(value) => updateConfig({ show_coordinates: value })}
                        />
                      </div>
                    </div>
                    <details className="rounded-md border px-3 py-2.5">
                      <summary className="cursor-pointer text-xs font-medium">More options{typography.preset === "custom" ? " · Custom" : ""}</summary>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="title-font" className="text-xs">Title font</Label>
                          <select id="title-font" value={typography.titleFont}
                            onChange={(event) => updateConfig(applyTypographyCustomization(config, { title_font: event.target.value as PosterConfig["title_font"] }))}
                            className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                            <option value="Inter">Inter</option>
                            <option value="Playfair Display">Playfair Display</option>
                            <option value="Oswald">Oswald</option>
                            <option value="Montserrat">Montserrat</option>
                            <option value="Crimson Text">Crimson Text</option>
                            <option value="JetBrains Mono">JetBrains Mono</option>
                            <option value="Poppins">Poppins</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="title-size" className="text-xs">Title size · {typography.titleSize.toFixed(1)}%</Label>
                          <Slider id="title-size" value={[typography.titleSize]} min={3.5} max={10} step={0.1}
                            onValueChange={([value]) => updateConfig(applyTypographyCustomization(config, { title_size: value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="title-weight" className="text-xs">Title weight · {typography.titleWeight}</Label>
                          <Slider id="title-weight" value={[typography.titleWeight]} min={300} max={900} step={100}
                            onValueChange={([value]) => updateConfig(applyTypographyCustomization(config, { title_weight: value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="title-spacing" className="text-xs">Letter spacing · {typography.titleTracking.toFixed(2)}</Label>
                          <Slider id="title-spacing" value={[typography.titleTracking]} min={-0.1} max={0.25} step={0.01}
                            onValueChange={([value]) => updateConfig(applyTypographyCustomization(config, { title_tracking: value }))} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="title-caps" className="text-xs">All caps title</Label>
                          <Switch id="title-caps" checked={typography.titleAllCaps}
                            onCheckedChange={(value) => updateConfig(applyTypographyCustomization(config, { title_all_caps: value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="subtitle-font" className="text-xs">Subtitle font</Label>
                          <select id="subtitle-font" value={typography.subtitleFont}
                            onChange={(event) => updateConfig(applyTypographyCustomization(config, { subtitle_font: event.target.value as PosterConfig["subtitle_font"] }))}
                            className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                            {["Inter", "Playfair Display", "Oswald", "Montserrat", "Crimson Text", "JetBrains Mono", "Poppins"].map((font) => <option key={font} value={font}>{font}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subtitle-size" className="text-xs">Subtitle size · {typography.subtitleSize.toFixed(1)}%</Label>
                          <Slider id="subtitle-size" value={[typography.subtitleSize]} min={1.2} max={5} step={0.1}
                            onValueChange={([value]) => updateConfig(applyTypographyCustomization(config, { subtitle_size: value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subtitle-weight" className="text-xs">Subtitle weight · {typography.subtitleWeight}</Label>
                          <Slider id="subtitle-weight" value={[typography.subtitleWeight]} min={300} max={900} step={100}
                            onValueChange={([value]) => updateConfig(applyTypographyCustomization(config, { subtitle_weight: value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="subtitle-spacing" className="text-xs">Subtitle spacing · {typography.subtitleTracking.toFixed(2)}</Label>
                          <Slider id="subtitle-spacing" value={[typography.subtitleTracking]} min={-0.1} max={0.25} step={0.01}
                            onValueChange={([value]) => updateConfig(applyTypographyCustomization(config, { subtitle_tracking: value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="text-backdrop" className="text-xs">Text backing</Label>
                          <select id="text-backdrop" value={typography.textBackdrop}
                            onChange={(event) => updateConfig(applyTypographyCustomization(config, { text_backdrop: event.target.value as PosterConfig["text_backdrop"] }))}
                            className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                            <option value="none">None</option>
                            <option value="subtle">Soft glow</option>
                            <option value="strong">Solid</option>
                            <option value="gradient">Fade</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="frame-style" className="text-xs">Frame</Label>
                          <select id="frame-style" value={typography.frameStyle}
                            onChange={(event) => updateConfig(applyTypographyCustomization(config, { frame_style: event.target.value as PosterConfig["frame_style"] }))}
                            className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                            <option value="none">None</option>
                            <option value="fine">Fine</option>
                            <option value="double">Double</option>
                          </select>
                        </div>
                      </div>
                    </details>
                  </div>
                )}

                {activeTool === "style" && (
                  <div className="space-y-4">
                    <PosterColorControls config={config} onChange={updateConfig} />
                  </div>
                )}
          {activeTool === "finish" && <>
          <Card>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div>
                <h2 className="text-sm font-semibold">Poster size</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choose a size before ordering or downloading.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {POSTER_SIZES.map((size) => (
                  <button
                    key={size.key}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={`rounded-md border px-2 py-2 text-center text-xs transition-colors ${
                      selectedSize.key === size.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 grid gap-2">
            <Button
              size="lg"
              onClick={handleOrderPhysical}
              disabled={!config.city}
            >
              {isGuest ? (
                <LogIn className="mr-2 h-5 w-5 shrink-0" />
              ) : (
                <Package className="mr-2 h-5 w-5 shrink-0" />
              )}
              {isGuest ? "Sign Up to Order" : "Order a Print"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleDownloadPoster}
              disabled={generateLoading || outOfDownloads}
            >
              {generateLoading ? (
                <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" />
              ) : isGuest ? (
                <LogIn className="mr-2 h-5 w-5 shrink-0" />
              ) : (
                <Download className="mr-2 h-5 w-5 shrink-0" />
              )}
              {isGuest
                ? "Sign Up to Download"
                : outOfDownloads
                  ? "No Downloads Left"
                  : "Download High-Res"}
            </Button>
          </div>

          {!isGuest && !isMember && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
              Keep designing for free. ${MEMBERSHIP_PRICE_MONTHLY_USD}/month
              adds {MEMBERSHIP_DOWNLOADS_PER_MONTH} high-resolution downloads
              per month.{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => router.push("/app/billing")}
              >
                See membership
              </button>
            </p>
          )}

          {isMember && downloadsRemaining !== null && (
            <p
              className={`rounded-lg border px-3 py-2 text-center text-xs ${
                outOfDownloads
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-muted bg-muted/40 text-muted-foreground"
              }`}
            >
              {outOfDownloads ? (
                <>
                  You&apos;ve used all {MEMBERSHIP_DOWNLOADS_PER_MONTH}{" "}
                  downloads for this billing period. Designing stays free, and
                  your allowance resets next period.
                </>
              ) : (
                <>
                  {downloadsRemaining} of {MEMBERSHIP_DOWNLOADS_PER_MONTH}{" "}
                  high-resolution downloads left this month.
                </>
              )}
            </p>
          )}
          </>}
          </PosterEditorSidebar>
        </div>

        <div ref={stageRef} data-testid="poster-stage"
          className={`flex min-h-0 min-w-0 flex-1 items-center justify-center transition-[width,padding] duration-200 motion-reduce:transition-none ${activeTool ? "lg:mr-[440px]" : "lg:mr-20"} pb-20 lg:pb-0`}
        >
          <PosterRoomStage mode={viewMode} onModeChange={setViewMode}>
            <div data-testid="poster-preview" style={{ width: posterFit.width, height: posterFit.height }} className="shrink-0 shadow-[0_16px_35px_rgba(39,31,23,0.16)]">
              {livePosterPanel}
            </div>
          </PosterRoomStage>
        </div>
      </div>
    </div>
  );
}
