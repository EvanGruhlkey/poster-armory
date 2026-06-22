"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { MapPin, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { type Poster, type PosterJob, type JobStatus, STYLE_PRESETS } from "@/lib/types";
import { ProtectedImage } from "@/components/protected-image";

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  queued: {
    label: "Queued",
    icon: <Clock className="h-3 w-3" />,
    variant: "secondary",
  },
  running: {
    label: "Generating",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    variant: "outline",
  },
  done: {
    label: "Ready",
    icon: <CheckCircle className="h-3 w-3" />,
    variant: "default",
  },
  failed: {
    label: "Failed",
    icon: <XCircle className="h-3 w-3" />,
    variant: "destructive",
  },
};

interface PosterCardProps {
  poster?: Poster;
  job?: PosterJob;
}

export function PosterCard({ poster, job }: PosterCardProps) {
  const status = job?.status ?? "done";
  const config = STATUS_CONFIG[status];
  const title = poster?.title || (job?.input as { city?: string })?.city || "Untitled";
  const subtitle = poster?.location_text || `${(job?.input as { city?: string })?.city}, ${(job?.input as { country?: string })?.country}`;
  const href = poster ? `/download/${poster.job_id}` : job ? `/download/${job.id}` : "#";
  const previewUrl = poster?.preview_url;
  const styleId = poster?.config?.style_id || (job?.input as { style_id?: string })?.style_id || "warm_beige";
  const style = STYLE_PRESETS[styleId] || STYLE_PRESETS.warm_beige;

  return (
    <Link href={href}>
      <Card className="group overflow-hidden transition-shadow hover:shadow-md">
        <div
          className="relative aspect-[3/4] flex items-center justify-center"
          style={{ backgroundColor: style.bgColor }}
        >
          {previewUrl ? (
            <ProtectedImage
              src={previewUrl}
              alt={title}
              className="h-full w-full object-cover"
              containerClassName="h-full w-full"
              textColor={style.textColor}
            />
          ) : (
            <MapPin className="h-12 w-12 text-muted-foreground/30" />
          )}
          <div className="absolute right-2 top-2">
            <Badge variant={config.variant} className="gap-1">
              {config.icon}
              {config.label}
            </Badge>
          </div>
        </div>
        <CardContent className="p-3">
          <p className="font-medium text-sm truncate">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
