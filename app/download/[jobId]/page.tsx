"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ProtectedImage } from "@/components/protected-image";
import { LivePosterMap, type LivePosterMapHandle } from "@/components/live-poster-map";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileText,
  Image,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
} from "lucide-react";
import type { PosterConfig, PosterJobOutput } from "@/lib/types";
import { STYLE_PRESETS } from "@/lib/types";
import { EXPORT_LONG_EDGE, composeLivePosterFiles } from "@/lib/live-poster-export";
import type { MapLayerPreset } from "@/lib/live-poster-style";

interface JobStatusResponse {
  id: string;
  status: string;
  output: PosterJobOutput | null;
  error: string | null;
  downloadUrls: Record<string, string> | null;
  input?: PosterConfig | null;
}

const PROGRESS_STAGES = [
  { threshold: 0, label: "Waiting for available worker..." },
  { threshold: 10, label: "Job picked up, initializing..." },
  { threshold: 20, label: "Fetching map data from OpenStreetMap..." },
  { threshold: 40, label: "Processing roads and features..." },
  { threshold: 55, label: "Rendering map layers..." },
  { threshold: 70, label: "Applying theme and styling..." },
  { threshold: 82, label: "Generating print-ready files..." },
  { threshold: 92, label: "Uploading files..." },
];

const LIVE_PROGRESS_STAGES = [
  { threshold: 0, label: "Loading the live map at print size..." },
  { threshold: 25, label: "Painting streets and labels..." },
  { threshold: 55, label: "Composing title and layout..." },
  { threshold: 80, label: "Saving your files..." },
];

function getStageLabel(progress: number, live: boolean): string {
  const stages = live ? LIVE_PROGRESS_STAGES : PROGRESS_STAGES;
  let label = stages[0].label;
  for (const stage of stages) {
    if (progress >= stage.threshold) label = stage.label;
  }
  return label;
}

function isLiveMapJob(job: JobStatusResponse | null) {
  return job?.input?.render_engine === "webgl";
}

async function uploadToSignedUrl(signedUrl: string, blob: Blob) {
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
}

function DownloadPageInner() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cachedPreview = searchParams.get("preview");
  const textColor = searchParams.get("tc") || undefined;
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const startTime = useRef(Date.now());
  const animFrame = useRef<number | null>(null);
  const liveExportStarted = useRef(false);
  const liveMapRef = useRef<LivePosterMapHandle>(null);

  const triggerDownload = useCallback(
    (fileKey: string) => {
      const link = document.createElement("a");
      link.href = `/api/download/${jobId}/${fileKey}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [jobId]
  );

  useEffect(() => {
    if (!jobId) return;

    let interval: NodeJS.Timeout;
    let pollCount = 0;
    const MAX_POLLS = 200; // ~10 minutes at 3s intervals

    async function fetchStatus() {
      pollCount++;
      if (pollCount > MAX_POLLS) {
        clearInterval(interval);
        setJob((prev) =>
          prev
            ? { ...prev, status: "failed", error: "Job timed out. Please try again." }
            : { id: jobId, status: "failed", output: null, error: "Job timed out. Please try again.", downloadUrls: null }
        );
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const data: JobStatusResponse = await res.json();
        setJob(data);
        setLoading(false);

        if (data.status === "done") {
          setProgress(100);
          clearInterval(interval);
        } else if (data.status === "failed") {
          clearInterval(interval);
        }
      } catch {
        // retry
      }
    }

    fetchStatus();
    interval = setInterval(fetchStatus, 3000);

    return () => clearInterval(interval);
  }, [jobId]);

  const runLiveExport = useCallback(async (current: JobStatusResponse) => {
    if (liveExportStarted.current) return;
    if (current.status === "done" || current.status === "failed") return;
    if (!isLiveMapJob(current) || !current.input) return;
    liveExportStarted.current = true;

    const config = current.input;
    const style = STYLE_PRESETS[config.style_id] || STYLE_PRESETS.warm_beige;

    try {
      setProgress((prev) => Math.max(prev, 15));
      const canvas = liveMapRef.current?.getCanvas() ?? null;
      if (!canvas || canvas.width < 64 || canvas.height < 64) {
        throw new Error("The live map is not ready to capture yet.");
      }
      const files = await composeLivePosterFiles(canvas, config, style.bgColor);
      setProgress((prev) => Math.max(prev, 70));

      const urlsRes = await fetch(`/api/jobs/${current.id}/export-urls`, {
        method: "POST",
      });
      if (!urlsRes.ok) {
        const err = await urlsRes.json().catch(() => ({}));
        throw new Error(err.error || "Could not prepare uploads.");
      }
      const { uploads, pngKey } = (await urlsRes.json()) as {
        pngKey: string;
        uploads: Record<string, { path: string; signedUrl: string }>;
      };

      await uploadToSignedUrl(uploads.preview.signedUrl, files.png);
      await uploadToSignedUrl(uploads[pngKey].signedUrl, files.png);
      await uploadToSignedUrl(uploads.pdf.signedUrl, files.pdf);
      setProgress((prev) => Math.max(prev, 90));

      const doneRes = await fetch(`/api/jobs/${current.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          output: {
            preview: uploads.preview.path,
            [pngKey]: uploads[pngKey].path,
            pdf: uploads.pdf.path,
          },
        }),
      });
      if (!doneRes.ok) {
        const err = await doneRes.json().catch(() => ({}));
        throw new Error(err.error || "Could not finish the download.");
      }

      const statusRes = await fetch(`/api/jobs/${current.id}`);
      if (statusRes.ok) {
        setJob(await statusRes.json());
        setProgress(100);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not export the live poster.";
      await fetch(`/api/jobs/${current.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: message }),
      }).catch(() => undefined);
      setJob((prev) =>
        prev ? { ...prev, status: "failed", error: message } : prev
      );
    }
  }, []);

  // Smooth progress animation based on elapsed time
  useEffect(() => {
    const status = job?.status;
    if (status === "done" || status === "failed") {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      return;
    }

    function tick() {
      const elapsed = (Date.now() - startTime.current) / 1000;
      const liveExport = isLiveMapJob(job);
      let target: number;

      if (!job || job.status === "queued") {
        target = Math.min(liveExport ? 20 : 10, elapsed * (liveExport ? 8 : 2));
      } else {
        target =
          (liveExport ? 20 : 10) +
          (liveExport ? 70 : 85) * (1 - Math.exp(-elapsed / (liveExport ? 12 : 60)));
      }

      setProgress((prev) => {
        if (prev >= 100) return 100;
        return Math.max(prev, Math.round(target));
      });

      animFrame.current = requestAnimationFrame(tick);
    }

    animFrame.current = requestAnimationFrame(tick);
    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [job?.status, job]);

  const STATUS_UI = {
    queued: {
      icon: <Clock className="h-8 w-8 text-muted-foreground" />,
      title: isLiveMapJob(job) ? "Preparing files..." : "In Queue",
      desc: isLiveMapJob(job)
        ? "Capturing the live map you designed."
        : "Your poster is waiting to be generated...",
    },
    running: {
      icon: <Loader2 className="h-8 w-8 animate-spin text-primary" />,
      title: isLiveMapJob(job) ? "Saving your poster..." : "Generating...",
      desc: isLiveMapJob(job)
        ? "Capturing the live map you designed."
        : "Your poster is being created.",
    },
    done: {
      icon: <CheckCircle className="h-8 w-8 text-green-600" />,
      title: "Download Your Poster",
      desc: "Your print-ready files are here!",
    },
    failed: {
      icon: <XCircle className="h-8 w-8 text-destructive" />,
      title: "Generation Failed",
      desc: "Something went wrong. Please try again.",
    },
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const status = (job?.status as keyof typeof STATUS_UI) || "queued";
  const ui = STATUS_UI[status] || STATUS_UI.queued;
  const live = isLiveMapJob(job);
  const liveConfig = job?.input;
  const liveStyle =
    (liveConfig && STYLE_PRESETS[liveConfig.style_id]) || STYLE_PRESETS.warm_beige;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 justify-center px-4 py-6 sm:px-6 sm:py-12">
        <div className="flex w-full max-w-md flex-col">
          <button
            onClick={() => router.back()}
            className="mb-6 inline-flex items-center self-start text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </button>

          {(live && liveConfig) ? (
          <div className="mb-6 overflow-hidden rounded-lg border shadow-md">
            <div className="aspect-[3/4]" style={{ backgroundColor: liveStyle.bgColor }}>
              <LivePosterMap
                ref={liveMapRef}
                config={liveConfig}
                bgColor={liveStyle.bgColor}
                textColor={liveStyle.textColor}
                layerPreset={(liveConfig.layer_preset || "everything") as MapLayerPreset}
                pitch={liveConfig.pitch || 0}
                interactive={false}
                showControls={false}
                captureLongEdge={EXPORT_LONG_EDGE}
                onIdle={() => {
                  if (job) void runLiveExport(job);
                }}
              />
            </div>
          </div>
        ) : (
          (cachedPreview || (job?.downloadUrls as Record<string, string>)?.preview) && (
            <div className="mb-6 flex justify-center">
              <ProtectedImage
                src={(job?.downloadUrls as Record<string, string>)?.preview || cachedPreview!}
                alt="Poster preview"
                className="max-h-[min(400px,60vh)] w-full rounded-lg border shadow-md"
                containerClassName="w-full max-w-xs"
                textColor={textColor}
              />
            </div>
          )
        )}

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2">{ui.icon}</div>
              <CardTitle className="text-2xl">{ui.title}</CardTitle>
              <CardDescription>{ui.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              {status === "done" && job?.output && (
                <div className="space-y-3">
                  {Object.keys(job.output)
                    .filter((key) => key !== "preview")
                    .map((key) => {
                      const ext = key.includes("pdf")
                        ? "pdf"
                        : key.includes("svg")
                          ? "svg"
                          : "png";
                      const label = key
                        .replace(/_/g, " ")
                        .replace("png ", "PNG ")
                        .replace("pdf", "PDF")
                        .replace("svg", "SVG");
                      const Icon = ext === "pdf" ? FileText : Image;

                      return (
                        <button
                          key={key}
                          onClick={() => triggerDownload(key)}
                          className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                        >
                          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                          <p className="flex-1 text-sm font-medium capitalize">
                            {label}
                          </p>
                          <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      );
                    })}

                  {/* This download was already counted against the monthly
                      allowance when the render started. */}
                  <p className="pt-1 text-center text-xs text-muted-foreground">
                    Every format is included. Re-downloading these files never
                    uses another download.
                  </p>
                </div>
              )}

              {status === "failed" && (
                <div className="text-center">
                  <p className="mb-4 text-sm text-destructive">{job?.error}</p>
                  <Button onClick={() => router.back()}>Try Again</Button>
                </div>
              )}

              {(status === "queued" || status === "running") && (
                <div className="py-8">
                  <div className="mx-auto max-w-sm">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {getStageLabel(progress, live)}
                      </span>
                      <span className="font-medium tabular-nums">
                        {progress}%
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      }
    >
      <DownloadPageInner />
    </Suspense>
  );
}
