import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyRateLimit } from "@/lib/rate-limit";
import { getClientIp, getGuestUserId } from "@/lib/guest-user";
import type { PosterJobOutput } from "@/lib/types";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Unauthenticated callers may only read jobs that belong to the
    // shared guest user AND are previews. This lets the design page poll
    // preview status without signup but never leaks a paying user's
    // high-res render to the public.
    if (!user) {
      const ip = getClientIp(request);
      const limited = applyRateLimit(ip, "job-status-guest", {
        windowMs: 60_000,
        max: 120,
      });
      if (limited) return limited;

      const guestId = await getGuestUserId();
      if (!guestId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const admin = createAdminClient();
      const { data: guestJob } = await admin
        .from("poster_jobs")
        .select("id, status, output, error, created_at, is_preview, user_id, input")
        .eq("id", params.id)
        .single();

      if (
        !guestJob ||
        guestJob.user_id !== guestId ||
        guestJob.is_preview !== true
      ) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return await respondWithSignedUrls(guestJob);
    }

    const limited = applyRateLimit(user.id, "job-status", { windowMs: 60_000, max: 60 });
    if (limited) return limited;

    // Try own job first; else allow if user has a poster record (cached dedup)
    let job: {
      id: string;
      status: string;
      output: unknown;
      error: string | null;
      created_at: string;
      input?: unknown;
    } | null = null;
    const { data: ownJob } = await supabase
      .from("poster_jobs")
      .select("id, status, output, error, created_at, input")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (ownJob) {
      job = ownJob;
    } else {
      const admin = createAdminClient();
      const { data: posterLink } = await admin
        .from("posters")
        .select("id")
        .eq("user_id", user.id)
        .eq("job_id", params.id)
        .limit(1)
        .single();

      if (posterLink) {
        const { data: linkedJob, error: linkedError } = await admin
          .from("poster_jobs")
          .select("id, status, output, error, created_at, input")
          .eq("id", params.id)
          .single();
        if (!linkedError && linkedJob) job = linkedJob;
      }
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return await respondWithSignedUrls(job);
  } catch (err) {
    console.error("GET /api/jobs/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function respondWithSignedUrls(job: {
  id: string;
  status: string;
  output: unknown;
  error: string | null;
  created_at: string;
  input?: unknown;
}) {
  let downloadUrls: Record<string, string> | null = null;

  if (job.status === "done" && job.output) {
    const admin = createAdminClient();
    const output = job.output as PosterJobOutput;
    downloadUrls = {};

    for (const [key, path] of Object.entries(output)) {
      if (path && typeof path === "string") {
        const { data } = await admin.storage
          .from("posters")
          .createSignedUrl(path, 3600); // 1 hour expiry
        if (data?.signedUrl) {
          downloadUrls[key] = data.signedUrl;
        }
      }
    }
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    output: job.output,
    error: job.error,
    downloadUrls,
    created_at: job.created_at,
    input: job.input ?? null,
  });
}
