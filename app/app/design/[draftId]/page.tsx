"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Download, Eye, MapPin, Lock, Crown } from "lucide-react";
import { toast } from "sonner";
import {
  STYLE_PRESETS,
  POSTER_SIZES,
  type PosterConfig,
  DEFAULT_CONFIG,
} from "@/lib/types";
import { ProtectedImage } from "@/components/protected-image";
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

export default function CustomizePosterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const city = searchParams.get("city") || "";
  const country = searchParams.get("country") || "";
  const lat = parseFloat(searchParams.get("lat") || "0");
  const lon = parseFloat(searchParams.get("lon") || "0");

  const [planTier, setPlanTier] = useState<PlanTier>("none");
  const [planLoading, setPlanLoading] = useState(true);
  const entitlements = PLAN_ENTITLEMENTS[planTier];

  const [config, setConfig] = useState<PosterConfig>({
    ...DEFAULT_CONFIG,
    city,
    country,
    lat,
    lon,
    title: city,
    subtitle: "",
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

  useEffect(() => {
    async function loadPlan() {
      try {
        const res = await fetch("/api/subscription");
        if (res.ok) {
          const data = await res.json();
          if (data.active && data.subscription?.plan_slug) {
            setPlanTier(getPlanTier(data.subscription.plan_slug));
          }
        }
      } catch {
        // fall through to "none"
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
          ? "An earlier preview for this design is still rendering — picking it up."
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

  async function handleDownloadPoster() {
    if (!config.city) {
      toast.error("Please go back and pick a location first.");
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
        toast.success("Already generated — opening your download page.");
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

  const currentStyle = STYLE_PRESETS[config.style_id] || STYLE_PRESETS.warm_beige;

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Customize Your Poster</h1>
        <p className="mt-2 text-muted-foreground">
          Personalize your map design.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* Controls */}
        <div className="space-y-6">
          {/* Style */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Style
                {!entitlements.allThemes && (
                  <span className="text-xs font-normal text-muted-foreground">
                    More themes with Pro
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
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
                      className={`relative rounded-lg border-2 p-3 text-center transition-all ${
                        config.style_id === id
                          ? "border-primary ring-2 ring-primary/20"
                          : isLocked
                            ? "border-transparent opacity-50"
                            : "border-transparent hover:border-muted-foreground/20"
                      }`}
                    >
                      {isLocked && (
                        <Lock className="absolute right-1 top-1 h-3 w-3 text-muted-foreground" />
                      )}
                      <div
                        className="mx-auto mb-2 h-8 w-8 rounded"
                        style={{ backgroundColor: preset.bgColor }}
                      />
                      <span className="text-xs font-medium">{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Map Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Map Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Zoom / radius */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Radius: {(config.distance / 1000).toFixed(0)} km</Label>
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
                  <div className="relative">
                    <Slider value={[10000]} min={2000} max={30000} step={1000} disabled />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Fixed at 10 km on Basic. Upgrade for zoom control.
                    </p>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>

          {/* Print Size */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Print Size
                {!entitlements.multipleSizes && <UpgradeBadge />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entitlements.multipleSizes ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                  {POSTER_SIZES.map((size) => (
                    <button
                      key={size.key}
                      onClick={() => setSelectedSize(size)}
                      className={`rounded-lg border-2 p-2 text-center text-sm transition-all ${
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
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-sm font-medium">{DEFAULT_SIZE.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upgrade to Pro for all 5 print sizes.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Text Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Text Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Paris"
                  value={config.title}
                  onChange={(e) => updateConfig({ title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  placeholder="Where We Met"
                  value={config.subtitle}
                  onChange={(e) => updateConfig({ subtitle: e.target.value })}
                />
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                {lat >= 0 ? lat.toFixed(4) : Math.abs(lat).toFixed(4)}&deg;{" "}
                {lat >= 0 ? "N" : "S"},{" "}
                {Math.abs(lon).toFixed(4)}&deg;{" "}
                {lon >= 0 ? "E" : "W"}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleGeneratePreview}
              disabled={previewLoading || planTier === "none"}
              className="flex-1"
            >
              {previewLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Generate Preview
            </Button>
            <Button
              onClick={handleDownloadPoster}
              disabled={generateLoading || planTier === "none"}
              className="flex-1"
            >
              {generateLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download Poster
            </Button>
          </div>

          {planTier === "free" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-xs text-amber-900">
                You're on the free plan — previews only. Upgrade to download
                print-ready files.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-7 text-amber-900 hover:bg-amber-100 hover:text-amber-900"
                onClick={() => router.push("/app/billing")}
              >
                <Crown className="mr-1 h-3 w-3" />
                See plans
              </Button>
            </div>
          )}

          {planTier === "none" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-sm font-medium text-amber-900">
                You need a plan to generate posters.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => router.push("/app/billing")}
              >
                <Crown className="mr-2 h-4 w-4" />
                Choose a Plan
              </Button>
            </div>
          )}
        </div>

        {/* Preview panel */}
        <div className="lg:sticky lg:top-24">
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
                  bgColor={currentStyle.bgColor}
                  textColor={currentStyle.textColor}
                />
              ) : previewLoading ? (
                <div className="w-full max-w-xs px-8 text-center">
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
                    style={{
                      backgroundColor: `${currentStyle.textColor}20`,
                    }}
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
                <div className="flex flex-col items-center p-8 w-full h-full">
                  <div
                    className="flex-1 w-full rounded flex items-center justify-center"
                    style={{
                      backgroundColor: `${currentStyle.textColor}10`,
                    }}
                  >
                    <MapPin
                      className="h-16 w-16"
                      style={{ color: `${currentStyle.textColor}30` }}
                    />
                  </div>
                  <div className="mt-4 text-center space-y-1">
                    <div
                      className="h-px w-12 mx-auto"
                      style={{
                        backgroundColor: `${currentStyle.textColor}40`,
                      }}
                    />
                    <p
                      className="text-base font-bold tracking-[0.15em]"
                      style={{ color: currentStyle.textColor }}
                    >
                      {config.title
                        ? config.title.toUpperCase().split("").join(" ")
                        : "YOUR CITY"}
                    </p>
                    {config.subtitle && (
                      <p
                        className="text-xs"
                        style={{ color: currentStyle.textColor }}
                      >
                        {config.subtitle}
                      </p>
                    )}
                    <p
                      className="text-[10px] opacity-60"
                      style={{ color: currentStyle.textColor }}
                    >
                      {lat.toFixed(4)}&deg; {lat >= 0 ? "N" : "S"},{" "}
                      {Math.abs(lon).toFixed(4)}&deg; {lon >= 0 ? "E" : "W"}
                    </p>
                    <p
                      className="text-[10px] opacity-40 mt-1"
                      style={{ color: currentStyle.textColor }}
                    >
                      {selectedSize.label}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
