"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ProtectedImage } from "@/components/protected-image";
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
import type { PosterJobOutput } from "@/lib/types";

interface JobStatusResponse {
  id: string;
  status: string;
  output: PosterJobOutput | null;
  error: string | null;
  downloadUrls: Record<string, string> | null;
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

function getStageLabel(progress: number): string {
  let label = PROGRESS_STAGES[0].label;
  for (const stage of PROGRESS_STAGES) {
    if (progress >= stage.threshold) label = stage.label;
  }
  return label;
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

  // Smooth progress animation based on elapsed time
  useEffect(() => {
    const status = job?.status;
    if (status === "done" || status === "failed") {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      return;
    }

    function tick() {
      const elapsed = (Date.now() - startTime.current) / 1000;
      let target: number;

      if (!job || job.status === "queued") {
        // 0-10% over first 5 seconds
        target = Math.min(10, elapsed * 2);
      } else {
        // running: asymptotically approach 95% (never reaches it until done)
        target = 10 + 85 * (1 - Math.exp(-elapsed / 60));
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
      title: "In Queue",
      desc: "Your poster is waiting to be generated...",
    },
    running: {
      icon: <Loader2 className="h-8 w-8 animate-spin text-primary" />,
      title: "Generating...",
      desc: "Your poster is being created.",
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
  const ui = STATUS_UI[status];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="mx-auto max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-12">
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </button>

        {(cachedPreview || (job?.downloadUrls as Record<string, string>)?.preview) && (
          <div className="mb-6 flex justify-center">
            <ProtectedImage
              src={(job?.downloadUrls as Record<string, string>)?.preview || cachedPreview!}
              alt="Poster preview"
              className="max-h-[min(400px,60vh)] w-full max-w-sm rounded-lg border shadow-md sm:w-auto"
              containerClassName="w-full max-w-sm"
              textColor={textColor}
            />
          </div>
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
                      {getStageLabel(progress)}
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
