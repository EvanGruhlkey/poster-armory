import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyRateLimit } from "@/lib/rate-limit";
import { stripe } from "@/lib/stripe";
import { resolveQuotaPeriod } from "@/lib/subscription-period";
import { POSTER_SIZES, type PosterConfig, type PosterJobOutput } from "@/lib/types";

const ALLOWED_KEYS = new Set<string>([
  "preview",
  "pdf",
  "svg",
  ...POSTER_SIZES.map((size) => size.key),
]);

export async function POST(
  request: Request,
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

    const limited = applyRateLimit(user.id, "job-complete", {
      windowMs: 60_000,
      max: 20,
    });
    if (limited) return limited;

    const body = (await request.json()) as {
      output?: Record<string, string>;
      error?: string;
    };

    const admin = createAdminClient();
    const { data: job, error } = await admin
      .from("poster_jobs")
      .select("id, user_id, status, is_preview, input, config_hash")
      .eq("id", params.id)
      .single();

    if (error || !job || job.user_id !== user.id || job.is_preview) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const config = (job.input || {}) as PosterConfig;
    if (config.render_engine !== "webgl") {
      return NextResponse.json(
        { error: "This job is rendered on the worker." },
        { status: 400 }
      );
    }

    if (job.status === "done") {
      return NextResponse.json({ ok: true, status: "done" });
    }
    if (job.status !== "queued" && job.status !== "running") {
      return NextResponse.json(
        { error: "This download can no longer be completed." },
        { status: 409 }
      );
    }

    if (body.error) {
      await admin
        .from("poster_jobs")
        .update({
          status: "failed",
          error: String(body.error).slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      await admin.rpc("settle_download_reservation", {
        p_job_id: job.id,
        p_succeeded: false,
      });
      return NextResponse.json({ ok: true, status: "failed" });
    }

    const output: PosterJobOutput = {};
    for (const [key, path] of Object.entries(body.output || {})) {
      if (!ALLOWED_KEYS.has(key) || typeof path !== "string") continue;
      if (!path.startsWith(`${user.id}/${job.id}/`)) continue;
      (output as Record<string, string>)[key] = path;
    }

    if (!output.preview || !output.pdf) {
      return NextResponse.json(
        { error: "Missing exported poster files." },
        { status: 400 }
      );
    }

    await admin
      .from("poster_jobs")
      .update({
        status: "done",
        output,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    const { data: existingPoster } = await admin
      .from("posters")
      .select("id")
      .eq("job_id", job.id)
      .limit(1)
      .maybeSingle();

    if (!existingPoster) {
      await admin.from("posters").insert({
        user_id: user.id,
        job_id: job.id,
        title: config.title || config.city,
        subtitle: config.subtitle || null,
        location_text: `${config.city}, ${config.country}`,
        config,
        config_hash: job.config_hash,
        storage_paths: output,
      });
    }

    const { data: userSub } = await admin
      .from("subscriptions")
      .select(
        "id, plan_slug, current_period_start, current_period_end, stripe_sub_id, created_at"
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (userSub) {
      const { start, end } = await resolveQuotaPeriod(admin, stripe, userSub);
      await admin.rpc("increment_usage", {
        p_user_id: user.id,
        p_period_start: start.toISOString().split("T")[0],
        p_period_end: end.toISOString().split("T")[0],
      });
    }

    await admin.rpc("settle_download_reservation", {
      p_job_id: job.id,
      p_succeeded: true,
    });

    return NextResponse.json({ ok: true, status: "done" });
  } catch (err) {
    console.error("POST /api/jobs/[id]/complete error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
