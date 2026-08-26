export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PosterJobOutput } from "@/lib/types";
import { applyRateLimit } from "@/lib/rate-limit";

/**
 * Serves a finished high-resolution file.
 *
 * The allowance is charged once, when the render job is created in
 * `/api/jobs`. Fetching the resulting file again — a retry, a second format,
 * a re-download months later — must never cost another download. So the
 * authorization boundary here is ownership of a completed non-preview job,
 * which can only exist if the allowance was already spent on it.
 */
export async function GET(
  _request: Request,
  { params }: { params: { jobId: string; fileKey: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = applyRateLimit(user.id, "download", {
      windowMs: 60_000,
      max: 30,
    });
    if (limited) return limited;

    const admin = createAdminClient();

    const { data: job, error: jobError } = await admin
      .from("poster_jobs")
      .select("id, user_id, status, output, is_preview")
      .eq("id", params.jobId)
      .single();

    if (jobError || !job || job.status !== "done" || !job.output) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Previews are watermark-free low-res renders shown in the editor; they
    // are never served through the high-resolution download path.
    if (job.is_preview) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner = job.user_id === user.id;
    if (!isOwner) {
      const { data: posterLink } = await admin
        .from("posters")
        .select("id")
        .eq("user_id", user.id)
        .eq("job_id", params.jobId)
        .limit(1)
        .maybeSingle();

      if (!posterLink) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const output = job.output as PosterJobOutput;
    const storagePath = output[params.fileKey as keyof PosterJobOutput];

    if (!storagePath || typeof storagePath !== "string") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const { data } = await admin.storage
      .from("posters")
      .createSignedUrl(storagePath, 60);

    if (!data?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate download URL" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (err) {
    console.error("Download error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
