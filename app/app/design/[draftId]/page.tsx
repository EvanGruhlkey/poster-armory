"use client";

import { useState, useCallback, useEffect } from "react";
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
import {
  LivePosterMap,
  type MapLayerPreset,
} from "@/components/live-poster-map";
import { DEFAULT_SIZE, getPlanTier, type PlanTier } from "@/lib/plan-config";
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
  // Designing is free and instant. We only need auth/plan state when the
  // user asks for a high-resolution file or a physical print.
  const [isGuest, setIsGuest] = useState(false);

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
  const [generateLoading, setGenerateLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<EditorTool>("location");
  const [layerPreset, setLayerPreset] =
    useState<MapLayerPreset>("everything");
  const [pitch, setPitch] = useState(0);

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
        city?: string;
        country?: string;
        action?: "download" | "order";
      };
      if (saved.config) setConfig(saved.config);
      if (saved.selectedSize) setSelectedSize(saved.selectedSize);
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

        // Guests can design freely, but downloads and orders require an account.
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
  }

  const livePosterPanel = (
    <Card className="overflow-hidden">
      <div
        className="aspect-[3/4] flex items-center justify-center"
        style={{ backgroundColor: currentStyle.bgColor }}
      >
        <LivePosterMap
          config={config}
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
                        Drag the live map to reposition it. Use the controls on the poster to zoom.
                      </p>
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
                            <span className="font-medium">Tilt</span>
                            <span className="tabular-nums text-muted-foreground">{Math.round(pitch)}°</span>
                          </div>
                          <Slider value={[pitch]} onValueChange={([value]) => setPitch(value)} min={0} max={60} step={1} />
                        </div>
                      </div>
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
                              onCheckedChange={(value) =>
                                updateConfig({ [String(key)]: value } as Partial<PosterConfig>)
                              }
                            />
                          </div>
                        ))}
                    </div>
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
                      <div className="space-y-1.5">
                        <Label htmlFor="live-date" className="text-xs">Date line</Label>
                        <Input id="live-date" placeholder="EST. 2026" value={config.date_line} onChange={(event) => updateConfig({ date_line: event.target.value })} />
                      </div>
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
                      {Object.entries(STYLE_PRESETS).map(([id, preset]) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => updateConfig({ style_id: id })}
                              className={`relative rounded-md border p-2 text-center ${
                                config.style_id === id ? "border-primary ring-2 ring-primary/15" : "hover:bg-muted"
                              }`}
                            >
                              <span className="mx-auto mb-1 block h-7 w-7 rounded" style={{ backgroundColor: preset.bgColor }} />
                              <span className="block truncate text-[10px] font-medium">{preset.name}</span>
                            </button>
                          ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div>
                <h2 className="text-sm font-semibold">Choose your output</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Designing is free. Pay only when you download a high-resolution file or order a print.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
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

          {/* Desktop actions */}
          <div className="hidden grid-cols-2 gap-3 sm:grid">
            <Button
              size="lg"
              onClick={handleOrderPhysical}
              disabled={!config.city}
            >
              <Package className="mr-2 h-5 w-5 shrink-0" />
              Order a Print
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleDownloadPoster}
              disabled={generateLoading || (planTier === "none" && !isGuest)}
            >
              {generateLoading ? (
                <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" />
              ) : isGuest ? (
                <LogIn className="mr-2 h-5 w-5 shrink-0" />
              ) : (
                <Download className="mr-2 h-5 w-5 shrink-0" />
              )}
              {isGuest ? "Sign Up to Download" : "Download High-Res"}
            </Button>
          </div>

          {isGuest && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
              <p className="text-sm text-blue-900">
                Your live design is free. Create an account only when you are
                ready to download or order a print.
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
              Keep designing for free.{" "}
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

        {/* Automatic live poster — above controls on mobile, sticky on desktop */}
        <div className="order-1 mx-auto w-full max-w-sm lg:sticky lg:top-20 lg:order-2 lg:max-w-none">
          {livePosterPanel}
        </div>
      </div>

      {/* Mobile sticky actions */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2.5 border-t bg-background/95 p-3 backdrop-blur sm:hidden">
        <Button
          variant="outline"
          onClick={handleDownloadPoster}
          disabled={generateLoading || (planTier === "none" && !isGuest)}
          className="h-11 min-w-11 flex-1 px-3"
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
