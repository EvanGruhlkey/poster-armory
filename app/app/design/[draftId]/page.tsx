"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
            bgColor={currentStyle.bgColor}
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
          <div className="flex h-full w-full flex-col items-center p-6 sm:p-8">
            <div
              className="flex flex-1 w-full items-center justify-center rounded"
              style={{ backgroundColor: `${currentStyle.textColor}10` }}
            >
              <MapPin
                className="h-12 w-12 sm:h-16 sm:w-16"
                style={{ color: `${currentStyle.textColor}30` }}
              />
            </div>
            <div className="mt-4 space-y-1 text-center">
              <p
                className="text-sm font-bold tracking-[0.12em] sm:text-base sm:tracking-[0.15em]"
                style={{ color: currentStyle.textColor }}
              >
                {config.title
                  ? config.title.toUpperCase().split("").join(" ")
                  : "YOUR CITY"}
              </p>
              {config.subtitle && (
                <p className="text-xs" style={{ color: currentStyle.textColor }}>
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
            </div>
          </div>
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

          {/* Desktop actions */}
          <div className="hidden gap-3 sm:flex">
            <Button
              variant="outline"
              onClick={handleGeneratePreview}
              disabled={previewLoading || planTier === "none"}
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
              onClick={handleDownloadPoster}
              disabled={generateLoading || planTier === "none"}
              className="flex-1"
            >
              {generateLoading ? (
                <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" />
              ) : (
                <Download className="mr-2 h-5 w-5 shrink-0" />
              )}
              Download
            </Button>
          </div>

          {planTier === "free" && (
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

          {planTier === "none" && (
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
          disabled={previewLoading || planTier === "none"}
          className="h-11 min-w-11 flex-1 shrink-0 px-3"
        >
          {previewLoading ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          ) : (
            <Eye className="h-5 w-5 shrink-0" />
          )}
        </Button>
        <Button
          onClick={handleDownloadPoster}
          disabled={generateLoading || planTier === "none"}
          className="h-11 min-w-0 flex-[2] gap-2"
        >
          {generateLoading ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          ) : (
            <Download className="h-5 w-5 shrink-0" />
          )}
          Download
        </Button>
      </div>
    </div>
  );
}
