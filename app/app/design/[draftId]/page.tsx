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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Download,
  Eye,
  Lock,
  Crown,
  Package,
  LogIn,
  Map,
  Layers3,
  Type,
  Palette,
  Rotate3D,
} from "lucide-react";
import { toast } from "sonner";
import {
  STYLE_PRESETS,
  POSTER_SIZES,
  type PosterConfig,
  DEFAULT_CONFIG,
} from "@/lib/types";
import { ProtectedImage } from "@/components/protected-image";
import {
  LivePosterMap,
  type MapLayerPreset,
} from "@/components/live-poster-map";
import {
  PLAN_ENTITLEMENTS,
  STANDARD_THEMES,
  DEFAULT_SIZE,
  getPlanTier,
  type PlanTier,
} from "@/lib/plan-config";

const PREVIEW_STAGES = [
  { threshold: 0, label: "Waiting for available worker..." },
  { threshold: 10, label: "Job picked up, initializing..." },
  { threshold: 25, label: "Fetching map data from OpenStreetMap..." },
  { threshold: 45, label: "Processing roads and features..." },
  { threshold: 65, label: "Rendering map layers..." },
  { threshold: 80, label: "Applying theme and styling..." },
  { threshold: 92, label: "Uploading preview..." },
];

function getPreviewStageLabel(progress: number): string {
  let label = PREVIEW_STAGES[0].label;
  for (const stage of PREVIEW_STAGES) {
    if (progress >= stage.threshold) label = stage.label;
  }
  return label;
}

type PreviewJobStatus = "queued" | "running" | null;
type EditorMode = "quick" | "standard" | "advanced";
type EditorTool = "location" | "layers" | "type" | "style";

const EDITOR_TOOLS = [
  { id: "location" as const, label: "Location", icon: Map },
  { id: "layers" as const, label: "Layers", icon: Layers3 },
  { id: "type" as const, label: "Words", icon: Type },
  { id: "style" as const, label: "Style", icon: Palette },
];

const LAYER_PRESETS: Array<{ id: MapLayerPreset; label: string }> = [
  { id: "everything", label: "Everything" },
  { id: "city", label: "City life" },
  { id: "nature", label: "Nature" },
  { id: "minimal", label: "Minimal" },
  { id: "transit", label: "Transit" },
];

export default function CustomizePosterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const city = searchParams.get("city") || "";
  const country = searchParams.get("country") || "";
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lon = parseFloat(searchParams.get("lon") || "0");
  const occasion = searchParams.get("occasion") || "";

  const [planTier, setPlanTier] = useState<PlanTier>("none");
  const [planLoading, setPlanLoading] = useState(true);
  // Guests get an anonymous Supabase session so previews work without
  // signing up. We still treat them as logged-out for any action that
  // touches money or persistence (Download / Order Physical).
  const [isGuest, setIsGuest] = useState(false);
  const entitlements = PLAN_ENTITLEMENTS[planTier];

  const [config, setConfig] = useState<PosterConfig>({
    ...DEFAULT_CONFIG,
    city,
    country,
    lat,
    lon,
    title: city,
    subtitle: occasion,
    date_line: "",
    style_id: "warm_beige",
    distance: 10000,
    show_labels: true,
    show_water: true,
    show_parks: true,
  });

  const [selectedSize, setSelectedSize] = useState(DEFAULT_SIZE);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewJobStatus, setPreviewJobStatus] =
    useState<PreviewJobStatus>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("quick");
  const [activeTool, setActiveTool] = useState<EditorTool>("location");
  const [layerPreset, setLayerPreset] =
    useState<MapLayerPreset>("everything");
  const [pitch, setPitch] = useState(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const previewStartTime = useRef<number | null>(null);
  const previewAnimFrame = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (previewAnimFrame.current)
        cancelAnimationFrame(previewAnimFrame.current);
    };
  }, []);

  // Smooth progress bar driven by elapsed time. Mirrors the download page:
  // 0–10% during queued, then asymptotically approaches ~95% during running
  // so the bar keeps moving without ever pretending to be done. Tuned for
  // preview (~30s typical) since it only renders one small PNG, unlike the
  // full download path which also produces a PDF and optional SVG.
  useEffect(() => {
    if (!previewJobStatus) {
      if (previewAnimFrame.current) {
        cancelAnimationFrame(previewAnimFrame.current);
        previewAnimFrame.current = null;
      }
      return;
    }

    const tick = () => {
      if (previewStartTime.current === null) return;
      const elapsed = (Date.now() - previewStartTime.current) / 1000;
      const target =
        previewJobStatus === "queued"
          ? Math.min(10, elapsed * 2)
          : 10 + 85 * (1 - Math.exp(-elapsed / 30));

      setPreviewProgress((prev) => {
        if (prev >= 100) return 100;
        return Math.max(prev, Math.round(target));
      });

      previewAnimFrame.current = requestAnimationFrame(tick);
    };

    previewAnimFrame.current = requestAnimationFrame(tick);
    return () => {
      if (previewAnimFrame.current) {
        cancelAnimationFrame(previewAnimFrame.current);
        previewAnimFrame.current = null;
      }
    };
  }, [previewJobStatus]);

  // Restore a design that the user stashed before being bounced through
  // the sign-up flow (see redirectToSignup). This runs once on mount and
  // discards the cache so a hard reload doesn't keep re-restoring it.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("poster-design-resume");
      if (!raw) return;
      sessionStorage.removeItem("poster-design-resume");
      const saved = JSON.parse(raw) as {
        config?: PosterConfig;
        selectedSize?: typeof DEFAULT_SIZE;
        previewUrl?: string | null;
        city?: string;
        country?: string;
        action?: "download" | "order";
      };
      if (saved.config) setConfig(saved.config);
      if (saved.selectedSize) setSelectedSize(saved.selectedSize);
      if (saved.previewUrl) setPreviewUrl(saved.previewUrl);
      if (saved.action === "download") {
        toast.success("Welcome back — finish your download below.");
      } else if (saved.action === "order") {
        toast.success("Welcome back — finish your order below.");
      }
    } catch {
      // Corrupt or unavailable sessionStorage — silently ignore.
    }
  }, []);

  useEffect(() => {
    async function loadPlan() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        const signedIn = !!data.user;

        // Guests have no session — previews are served by a shared
        // guest user on the server. The UI just needs to know they
        // can't download or order until they sign up.
        setIsGuest(!signedIn);

        if (signedIn) {
          const res = await fetch("/api/subscription");
          if (res.ok) {
            const subData = await res.json();
            if (subData.active && subData.subscription?.plan_slug) {
              setPlanTier(getPlanTier(subData.subscription.plan_slug));
            }
          }
        }
      } catch {
        // fall through to defaults
      } finally {
        setPlanLoading(false);
      }
    }
    loadPlan();
  }, []);

  const updateConfig = useCallback(
    (updates: Partial<PosterConfig>) => {
      setConfig((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  async function handleGeneratePreview() {
    if (!config.city) {
      toast.error("Please go back and pick a location first.");
      return;
    }
    if (pollRef.current) clearInterval(pollRef.current);
    setPreviewLoading(true);
    setPreviewProgress(0);
    setPreviewJobStatus("queued");
    previewStartTime.current = Date.now();
    try {
      const submitConfig = {
        ...config,
        width: selectedSize.width,
        height: selectedSize.height,
      };
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: submitConfig, is_preview: true }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 403) {
          toast.error(err.error, {
            action: { label: "Upgrade", onClick: () => router.push("/app/billing") },
            duration: 8000,
          });
          setPreviewLoading(false);
          setPreviewJobStatus(null);
          return;
        }
        const msg = err.error || "Failed to create preview job";
        if (err.details?.fieldErrors) {
          const fields = Object.entries(err.details.fieldErrors)
            .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
            .join("; ");
          throw new Error(`${msg} (${fields})`);
        }
        throw new Error(msg);
      }

      const { jobId, cached, status: cachedStatus } = await res.json();

      // Cached + already done → fetch the existing signed URL once and skip
      // polling so the user sees the preview instantly without a 3s gap.
      if (cached && cachedStatus === "done") {
        const r = await fetch(`/api/jobs/${jobId}`);
        if (r.ok) {
          const data = await r.json();
          setPreviewUrl(data.downloadUrls?.preview || null);
        }
        setPreviewLoading(false);
        setPreviewJobStatus(null);
        setPreviewProgress(100);
        toast.success("Showing your existing preview for this design.");
        return;
      }

      toast.success(
        cached
          ? "An earlier preview for this design is still rendering. Picking it up."
          : "Preview generation started!"
      );

      // Fire one immediate poll so cached-pending and brand-new jobs both
      // resolve as fast as the worker finishes, instead of always waiting 3s.
      const pollOnce = async () => {
        try {
          const r = await fetch(`/api/jobs/${jobId}`);
          if (!r.ok) return;
          const data = await r.json();
          if (data.status === "done") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setPreviewUrl(data.downloadUrls?.preview || null);
            setPreviewLoading(false);
            setPreviewJobStatus(null);
            setPreviewProgress(100);
          } else if (data.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            toast.error(data.error || "Preview generation failed");
            setPreviewLoading(false);
            setPreviewJobStatus(null);
            setPreviewProgress(0);
          } else if (data.status === "running" || data.status === "queued") {
            setPreviewJobStatus(data.status);
          }
        } catch {
          // network blip, keep polling
        }
      };
      pollOnce();
      pollRef.current = setInterval(pollOnce, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(msg);
      setPreviewLoading(false);
      setPreviewJobStatus(null);
      setPreviewProgress(0);
    }
  }

  function redirectToSignup(reason: "download" | "order") {
    // Stash the current design so the user lands back in the editor with
    // their work intact after signing up.
    try {
      sessionStorage.setItem(
        "poster-design-resume",
        JSON.stringify({
          config,
          selectedSize,
          previewUrl,
          city,
          country,
          action: reason,
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
    setGenerateLoading(true);
    try {
      const submitConfig = {
        ...config,
        width: selectedSize.width,
        height: selectedSize.height,
      };
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: submitConfig, is_preview: false }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 403) {
          toast.error(err.error || "You need an active plan to generate posters.", {
            action: { label: "Upgrade", onClick: () => router.push("/app/billing") },
            duration: 8000,
          });
          setGenerateLoading(false);
          return;
        }
        throw new Error(err.error || "Failed to create job");
      }

      const { jobId, cached, status: cachedStatus } = await res.json();

      if (cached && cachedStatus === "done") {
        toast.success("Already generated. Opening your download page.");
      } else if (cached) {
        toast.success("Picking up your in-flight render.");
      } else {
        toast.success("Poster generation started! Redirecting to download page...");
      }

      const params = new URLSearchParams();
      if (previewUrl) params.set("preview", previewUrl);
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
    };
    try {
      sessionStorage.setItem(
        "poster-order-draft",
        JSON.stringify({
          config: submitConfig,
          previewUrl,
          style: {
            bgColor: currentStyle.bgColor,
            textColor: currentStyle.textColor,
          },
          city,
          country,
        })
      );
    } catch {
      // sessionStorage may be unavailable; the order page falls back gracefully.
    }
    router.push("/app/order");
  }

  const currentStyle = STYLE_PRESETS[config.style_id] || STYLE_PRESETS.warm_beige;

  function chooseLayerPreset(preset: MapLayerPreset) {
    setLayerPreset(preset);
    const updates: Record<MapLayerPreset, Partial<PosterConfig>> = {
      everything: {
        show_labels: true,
        show_water: true,
        show_parks: true,
        major_roads_only: false,
      },
      city: {
        show_labels: true,
        show_water: true,
        show_parks: false,
        major_roads_only: false,
      },
      nature: {
        show_labels: false,
        show_water: true,
        show_parks: true,
        major_roads_only: true,
      },
      minimal: {
        show_labels: false,
        show_water: true,
        show_parks: false,
        major_roads_only: true,
      },
      transit: {
        show_labels: true,
        show_water: true,
        show_parks: false,
        major_roads_only: true,
      },
    };
    updateConfig(updates[preset]);
    setPreviewUrl(null);
  }

  function UpgradeBadge() {
    return (
      <button
        onClick={() => router.push("/app/billing")}
        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-200 transition-colors"
      >
        <Crown className="h-3 w-3" />
        Pro
      </button>
    );
  }

  if (planLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const previewPanel = (
    <Card className="overflow-hidden">
      <div
        className="aspect-[3/4] flex items-center justify-center"
        style={{ backgroundColor: currentStyle.bgColor }}
      >
        {previewUrl ? (
          <ProtectedImage
            src={previewUrl}
            alt="Poster preview"
            className="h-full w-full object-cover"
            containerClassName="h-full w-full"
            textColor={currentStyle.textColor}
          />
        ) : previewLoading ? (
          <div className="w-full max-w-xs px-6 text-center sm:px-8">
            <Loader2
              className="mx-auto h-8 w-8 animate-spin"
              style={{ color: currentStyle.textColor }}
            />
            <p
              className="mt-3 text-sm font-medium"
              style={{ color: currentStyle.textColor }}
            >
              Generating preview
            </p>
            <div
              className="mt-4 h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: `${currentStyle.textColor}20` }}
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${previewProgress}%`,
                  backgroundColor: currentStyle.textColor,
                }}
              />
            </div>
            <div
              className="mt-2 flex items-center justify-between text-xs"
              style={{ color: `${currentStyle.textColor}b3` }}
            >
              <span className="truncate pr-2 text-left">
                {getPreviewStageLabel(previewProgress)}
              </span>
              <span className="tabular-nums">{previewProgress}%</span>
            </div>
          </div>
        ) : (
          <LivePosterMap
            config={config}
            bgColor={currentStyle.bgColor}
            textColor={currentStyle.textColor}
            layerPreset={layerPreset}
            pitch={pitch}
            onViewChange={({ pitch: nextPitch, ...updates }) => {
              if (typeof nextPitch === "number") setPitch(nextPitch);
              updateConfig(updates);
              setPreviewUrl(null);
            }}
          />
        )}
      </div>
    </Card>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 pb-32 sm:px-6 sm:py-8 sm:pb-8 lg:px-8">
      <div className="mb-5 sm:mb-8">
        <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">
          Customize poster
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {city}
          {country ? `, ${country}` : ""}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:gap-8 xl:grid-cols-[1fr_380px]">
        {/* Controls */}
        <div className="order-2 space-y-4 lg:order-1">
          <Card className="overflow-hidden">
            <div className="flex border-b bg-muted/30 p-1.5">
              {(["quick", "standard", "advanced"] as EditorMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setEditorMode(mode)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    editorMode === mode
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[76px_1fr] sm:grid-cols-[92px_1fr]">
              <nav className="space-y-1 border-r bg-muted/20 p-2" aria-label="Editor tools">
                {EDITOR_TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setActiveTool(tool.id)}
                    className={`flex w-full flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] font-medium transition-colors sm:text-xs ${
                      activeTool === tool.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <tool.icon className="h-4 w-4" aria-hidden="true" />
                    {tool.label}
                  </button>
                ))}
              </nav>

              <div className="min-w-0 p-4 sm:p-5">
                {activeTool === "location" && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold">Frame your map</h2>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Drag the live map to reposition it. Scroll or pinch to change the map area.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/50 p-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Center</p>
                        <p className="mt-0.5 font-medium tabular-nums">
                          {config.lat.toFixed(3)}, {config.lon.toFixed(3)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Map area</p>
                        <p className="mt-0.5 font-medium">{(config.distance / 1000).toFixed(1)} km</p>
                      </div>
                    </div>
                    {editorMode !== "quick" && (
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
                            onValueChange={([value]) => {
                              updateConfig({ rotation: value });
                              setPreviewUrl(null);
                            }}
                            min={-180}
                            max={180}
                            step={1}
                          />
                        </div>
                        {editorMode === "advanced" && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium">Tilt</span>
                              <span className="tabular-nums text-muted-foreground">{Math.round(pitch)}°</span>
                            </div>
                            <Slider value={[pitch]} onValueChange={([value]) => setPitch(value)} min={0} max={60} step={1} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTool === "layers" && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold">Map layers</h2>
                      <p className="mt-1 text-xs text-muted-foreground">Start with a preset, then fine-tune the details.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {LAYER_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => chooseLayerPreset(preset.id)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            layerPreset === preset.id
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    {editorMode !== "quick" && (
                      <div className="space-y-3 border-t pt-4">
                        {[
                          ["show_labels", "Map labels", config.show_labels],
                          ["show_water", "Water", config.show_water],
                          ["show_parks", "Parks & green areas", config.show_parks],
                          ["major_roads_only", "Major roads only", config.major_roads_only],
                        ].map(([key, label, checked]) => (
                          <div key={String(key)} className="flex items-center justify-between gap-4">
                            <Label htmlFor={`layer-${String(key)}`} className="text-xs font-normal">{String(label)}</Label>
                            <Switch
                              id={`layer-${String(key)}`}
                              checked={Boolean(checked)}
                              onCheckedChange={(value) => {
                                updateConfig({ [String(key)]: value } as Partial<PosterConfig>);
                                setPreviewUrl(null);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTool === "type" && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold">Poster words</h2>
                      <p className="mt-1 text-xs text-muted-foreground">Changes appear instantly on the live poster.</p>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="live-title" className="text-xs">Title</Label>
                        <Input id="live-title" value={config.title} onChange={(event) => updateConfig({ title: event.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="live-subtitle" className="text-xs">Subtitle or dedication</Label>
                        <Input id="live-subtitle" placeholder="Where our story began" value={config.subtitle} onChange={(event) => updateConfig({ subtitle: event.target.value })} />
                      </div>
                      {editorMode === "advanced" && (
                        <div className="space-y-1.5">
                          <Label htmlFor="live-date" className="text-xs">Date line</Label>
                          <Input id="live-date" placeholder="EST. 2026" value={config.date_line} onChange={(event) => updateConfig({ date_line: event.target.value })} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTool === "style" && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold">Poster style</h2>
                      <p className="mt-1 text-xs text-muted-foreground">Choose a palette and watch the WebGL map redraw.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {Object.entries(STYLE_PRESETS)
                        .slice(0, editorMode === "quick" ? 5 : undefined)
                        .map(([id, preset]) => {
                          const isLocked = !entitlements.allThemes && !STANDARD_THEMES.includes(id);
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                if (isLocked) {
                                  toast("Upgrade to unlock this theme.");
                                  return;
                                }
                                updateConfig({ style_id: id });
                                setPreviewUrl(null);
                              }}
                              className={`relative rounded-md border p-2 text-center ${
                                config.style_id === id ? "border-primary ring-2 ring-primary/15" : "hover:bg-muted"
                              } ${isLocked ? "opacity-45" : ""}`}
                            >
                              <span className="mx-auto mb-1 block h-7 w-7 rounded" style={{ backgroundColor: preset.bgColor }} />
                              <span className="block truncate text-[10px] font-medium">{preset.name}</span>
                              {isLocked && <Lock className="absolute right-1 top-1 h-3 w-3" />}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold sm:text-base">
                Theme
                {!entitlements.allThemes && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Pro unlocks all
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-5">
                {Object.entries(STYLE_PRESETS).map(([id, preset]) => {
                  const isStandard = STANDARD_THEMES.includes(id);
                  const isLocked = !entitlements.allThemes && !isStandard;

                  return (
                    <button
                      key={id}
                      onClick={() => {
                        if (isLocked) {
                          toast("Upgrade to Pro to unlock all themes.", {
                            action: { label: "Upgrade", onClick: () => router.push("/app/billing") },
                          });
                          return;
                        }
                        updateConfig({ style_id: id });
                        setPreviewUrl(null);
                      }}
                      className={`relative rounded-md border-2 p-2.5 text-center transition-all sm:rounded-lg sm:p-3 ${
                        config.style_id === id
                          ? "border-primary ring-2 ring-primary/20"
                          : isLocked
                            ? "border-transparent opacity-50"
                            : "border-transparent hover:border-muted-foreground/20"
                      }`}
                    >
                      {isLocked && (
                        <Lock className="absolute right-1 top-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <div
                        className="mx-auto mb-1.5 h-7 w-7 shrink-0 rounded sm:mb-2 sm:h-9 sm:w-9"
                        style={{ backgroundColor: preset.bgColor }}
                      />
                      <span className="text-[10px] font-medium leading-tight sm:text-xs">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">
                    Map radius: {(config.distance / 1000).toFixed(0)} km
                  </Label>
                  {!entitlements.zoomControls && <UpgradeBadge />}
                </div>
                {entitlements.zoomControls ? (
                  <Slider
                    value={[config.distance]}
                    onValueChange={([v]) => updateConfig({ distance: v })}
                    min={2000}
                    max={30000}
                    step={1000}
                  />
                ) : (
                  <div>
                    <Slider value={[10000]} min={2000} max={30000} step={1000} disabled />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Fixed at 10 km on Basic.
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Print size</Label>
                  {!entitlements.multipleSizes && <UpgradeBadge />}
                </div>
                {entitlements.multipleSizes ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {POSTER_SIZES.map((size) => (
                      <button
                        key={size.key}
                        onClick={() => setSelectedSize(size)}
                        className={`rounded-md border-2 px-2 py-1.5 text-center text-xs transition-all sm:text-sm ${
                          selectedSize.key === size.key
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-transparent hover:border-muted-foreground/20"
                        }`}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{DEFAULT_SIZE.label}</p>
                )}
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-sm">
                    Title
                  </Label>
                  <Input
                    id="title"
                    placeholder="Paris"
                    value={config.title}
                    onChange={(e) => updateConfig({ title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subtitle" className="text-sm">
                    Subtitle
                  </Label>
                  <Input
                    id="subtitle"
                    placeholder="Where We Met"
                    value={config.subtitle}
                    onChange={(e) => updateConfig({ subtitle: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Text labels */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold sm:text-base">
                Text labels
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="labels" className="text-sm">
                    Show text labels
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Off = clean map, no city/coordinates text.
                  </p>
                </div>
                <Switch
                  id="labels"
                  checked={config.show_labels}
                  onCheckedChange={(v) => updateConfig({ show_labels: v })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Desktop actions */}
          <div className="hidden flex-col gap-3 sm:flex">
            <Button
              size="lg"
              onClick={handleOrderPhysical}
              disabled={!config.city}
              className="w-full"
            >
              <Package className="mr-2 h-5 w-5 shrink-0" />
              Order Physical Poster
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleGeneratePreview}
                disabled={previewLoading || (planTier === "none" && !isGuest)}
                className="flex-1"
              >
                {previewLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" />
                ) : (
                  <Eye className="mr-2 h-5 w-5 shrink-0" />
                )}
                Preview
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadPoster}
                disabled={generateLoading || (planTier === "none" && !isGuest)}
                className="flex-1"
              >
                {generateLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" />
                ) : isGuest ? (
                  <LogIn className="mr-2 h-5 w-5 shrink-0" />
                ) : (
                  <Download className="mr-2 h-5 w-5 shrink-0" />
                )}
                {isGuest ? "Sign Up to Download" : "Download"}
              </Button>
            </div>
          </div>

          {isGuest && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
              <p className="text-sm text-blue-900">
                Browsing as a guest — previews are unlimited. Create an
                account to download or order a print.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => redirectToSignup("download")}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Create Free Account
              </Button>
            </div>
          )}

          {!isGuest && planTier === "free" && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
              Free plan: previews only.{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => router.push("/app/billing")}
              >
                Upgrade to download
              </button>
            </p>
          )}

          {!isGuest && planTier === "none" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-sm text-amber-900">Choose a plan to get started.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => router.push("/app/billing")}
              >
                <Crown className="mr-2 h-4 w-4" />
                View Plans
              </Button>
            </div>
          )}
        </div>

        {/* Preview — above controls on mobile, right column on desktop */}
        <div className="order-1 mx-auto w-full max-w-sm lg:sticky lg:top-20 lg:order-2 lg:max-w-none">
          {previewPanel}
        </div>
      </div>

      {/* Mobile sticky actions */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t bg-background/95 p-3 backdrop-blur sm:hidden">
        <Button
          variant="outline"
          onClick={handleGeneratePreview}
          disabled={previewLoading || (planTier === "none" && !isGuest)}
          className="h-11 min-w-11 shrink-0 px-3"
          aria-label="Preview"
        >
          {previewLoading ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          ) : (
            <Eye className="h-5 w-5 shrink-0" />
          )}
        </Button>
        <Button
          variant="outline"
          onClick={handleDownloadPoster}
          disabled={generateLoading || (planTier === "none" && !isGuest)}
          className="h-11 min-w-11 shrink-0 px-3"
          aria-label={isGuest ? "Sign up to download" : "Download"}
        >
          {generateLoading ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          ) : isGuest ? (
            <LogIn className="h-5 w-5 shrink-0" />
          ) : (
            <Download className="h-5 w-5 shrink-0" />
          )}
        </Button>
        <Button
          onClick={handleOrderPhysical}
          disabled={!config.city}
          className="h-11 min-w-0 flex-1 gap-2"
        >
          <Package className="h-5 w-5 shrink-0" />
          Order
        </Button>
      </div>
    </div>
  );
}
