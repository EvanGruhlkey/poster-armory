import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyRateLimit } from "@/lib/rate-limit";
import { POSTER_SIZES, type PosterConfig } from "@/lib/types";

const PNG_KEYS = new Set(POSTER_SIZES.map((size) => size.key));

function pngKeyForConfig(config: PosterConfig): string {
  const match = POSTER_SIZES.find(
    (size) => size.width === config.width && size.height === config.height
  );
  return match?.key ?? "png_18x24";
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = applyRateLimit(user.id, "job-export-urls", {
      windowMs: 60_000,
      max: 20,
    });
    if (limited) return limited;

    const admin = createAdminClient();
    const { data: job, error } = await admin
      .from("poster_jobs")
      .select("id, user_id, status, is_preview, input")
      .eq("id", params.id)
      .single();

    if (error || !job || job.user_id !== user.id || job.is_preview) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (job.status !== "queued" && job.status !== "running") {
      return NextResponse.json(
        { error: "This download is no longer waiting for export." },
        { status: 409 }
      );
    }

    const config = (job.input || {}) as PosterConfig;
    if (config.render_engine !== "webgl") {
      return NextResponse.json(
        { error: "This job is rendered on the worker." },
        { status: 400 }
      );
    }

    const pngKey = pngKeyForConfig(config);
    const files = [
      { key: "preview" as const, path: `${user.id}/${job.id}/preview.png` },
      { key: pngKey, path: `${user.id}/${job.id}/${pngKey}.png` },
      { key: "pdf" as const, path: `${user.id}/${job.id}/poster.pdf` },
    ];

    const uploads: Record<string, { path: string; token: string; signedUrl: string }> =
      {};

    for (const file of files) {
      const { data, error: signError } = await admin.storage
        .from("posters")
        .createSignedUploadUrl(file.path, { upsert: true });
      if (signError || !data) {
        console.error("signed upload url failed:", signError);
        return NextResponse.json(
          { error: "Could not prepare file upload." },
          { status: 500 }
        );
      }
      uploads[file.key] = {
        path: file.path,
        token: data.token,
        signedUrl: data.signedUrl,
      };
    }

    return NextResponse.json({ uploads, pngKey });
  } catch (err) {
    console.error("POST /api/jobs/[id]/export-urls error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
