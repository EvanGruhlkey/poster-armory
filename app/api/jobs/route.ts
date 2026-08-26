import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { createJobSchema } from "@/lib/validations";
import { computeConfigHash } from "@/lib/config-hash";
import { applyRateLimit } from "@/lib/rate-limit";
import { resolveQuotaPeriod } from "@/lib/subscription-period";
import { getClientIp, getGuestUserId } from "@/lib/guest-user";
import {
  MEMBERSHIP_DOWNLOADS_PER_MONTH,
  downloadsPerPeriod,
  getPlanTier,
} from "@/lib/plan-config";

/**
 * Designing is free: previews are unmetered for everyone, signed in or not.
 * Only high-resolution renders (is_preview = false) consume the membership's
 * 20-downloads-per-billing-month allowance, and they do so atomically inside
 * `create_download_job`.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await request.json();
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { config, is_preview } = parsed.data;
    const admin = createAdminClient();

    // ── Resolve the acting user ────────────────────────────────────────────
    let effectiveUserId: string;
    let isGuest = false;

    if (!user) {
      if (!is_preview) {
        return NextResponse.json(
          {
            error:
              "Create a free account, then subscribe for $10/month to download high-resolution files.",
          },
          { status: 401 }
        );
      }
      const guestId = await getGuestUserId();
      if (!guestId) {
        return NextResponse.json(
          { error: "Guest preview is temporarily unavailable. Please sign in." },
          { status: 503 }
        );
      }
      effectiveUserId = guestId;
      isGuest = true;

      const limited = applyRateLimit(getClientIp(request), "jobs-guest", {
        windowMs: 60_000,
        max: 10,
      });
      if (limited) return limited;
    } else {
      // Anonymous Supabase sessions may design but never download.
      if (!is_preview && user.is_anonymous) {
        return NextResponse.json(
          {
            error:
              "Create a free account, then subscribe for $10/month to download high-resolution files.",
          },
          { status: 401 }
        );
      }
      effectiveUserId = user.id;

      const limited = applyRateLimit(user.id, "jobs", {
        windowMs: 60_000,
        max: 15,
      });
      if (limited) return limited;
    }

    const configHash = computeConfigHash(config);

    // ── Deduplicate ────────────────────────────────────────────────────────
    // Never re-render or re-charge for a design this user has already
    // rendered. Matching on the calling user, the same is_preview kind and a
    // non-failed status means:
    //   done            → hand back the finished job (re-downloads are free)
    //   queued/running  → an earlier click is still in flight; poll that one
    //                     instead of creating (and charging for) a second job
    {
      const { data: existing } = await admin
        .from("poster_jobs")
        .select("id, status, output")
        .eq("user_id", effectiveUserId)
        .eq("config_hash", configHash)
        .eq("is_preview", is_preview)
        .in("status", ["queued", "running", "done"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        if (existing.status === "done") {
          // Rehydrate the library row if the user deleted it and came back.
          if (!isGuest && !is_preview && existing.output) {
            const { data: existingPoster } = await admin
              .from("posters")
              .select("id")
              .eq("user_id", effectiveUserId)
              .eq("job_id", existing.id)
              .limit(1)
              .maybeSingle();

            if (!existingPoster) {
              await admin.from("posters").insert({
                user_id: effectiveUserId,
                job_id: existing.id,
                title: config.title || config.city,
                subtitle: config.subtitle || null,
                location_text: `${config.city}, ${config.country}`,
                config,
                config_hash: configHash,
                storage_paths: existing.output,
              });
            }
          }

          return NextResponse.json({
            jobId: existing.id,
            cached: true,
            status: "done",
          });
        }

        return NextResponse.json({
          jobId: existing.id,
          cached: true,
          status: "pending",
        });
      }
    }

    // ── Previews: always free, never metered ───────────────────────────────
    if (is_preview) {
      const { data: previewJob, error: previewErr } = await admin
        .from("poster_jobs")
        .insert({
          user_id: effectiveUserId,
          status: "queued",
          input: config,
          config_hash: configHash,
          is_preview: true,
        })
        .select("id")
        .single();

      if (previewErr || !previewJob) {
        console.error("preview job insert failed:", previewErr);
        return NextResponse.json(
          { error: "Failed to start preview" },
          { status: 500 }
        );
      }
      return NextResponse.json({ jobId: previewJob.id });
    }

    // ── Downloads: membership required, allowance enforced in Postgres ─────
    const { data: sub } = await admin
      .from("subscriptions")
      .select(
        "id, plan_slug, status, current_period_end, current_period_start, stripe_sub_id, created_at"
      )
      .eq("user_id", effectiveUserId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const planTier = getPlanTier(sub?.plan_slug);

    if (!sub || planTier !== "membership") {
      return NextResponse.json(
        {
          error: `Designing is free. Subscribe for $10/month to unlock ${MEMBERSHIP_DOWNLOADS_PER_MONTH} high-resolution downloads per month.`,
          reason: "membership_required",
        },
        { status: 403 }
      );
    }

    if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) {
      await admin
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("id", sub.id)
        .eq("status", "active");

      return NextResponse.json(
        {
          error: "Your membership has ended. Renew for $10/month to download again.",
          reason: "membership_required",
        },
        { status: 403 }
      );
    }

    const { start, end } = await resolveQuotaPeriod(admin, stripe, sub);
    const quota = downloadsPerPeriod(planTier);

    const { data: jobId, error: rpcError } = await admin.rpc("create_download_job", {
      p_user_id: effectiveUserId,
      p_input: config,
      p_config_hash: configHash,
      p_quota: quota,
      p_period_start: start.toISOString(),
      p_period_end: end.toISOString(),
      p_subscription_id: sub.id,
    });

    if (rpcError) {
      if (rpcError.message?.includes("QUOTA_EXCEEDED")) {
        return NextResponse.json(
          {
            error:
              rpcError.message.split("QUOTA_EXCEEDED:")[1]?.trim() ||
              `You have used all ${MEMBERSHIP_DOWNLOADS_PER_MONTH} downloads for this billing period.`,
            reason: "quota_exceeded",
            resetsAt: end.toISOString(),
          },
          { status: 403 }
        );
      }

      // The allowance is only safe when Postgres enforces it. If the RPC is
      // missing (migration not applied), refuse rather than fall back to a
      // non-atomic check that could let the allowance be exceeded.
      console.error("create_download_job failed:", rpcError);
      return NextResponse.json(
        {
          error:
            "Downloads are temporarily unavailable. Please try again in a few minutes.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ jobId });
  } catch (err) {
    console.error("POST /api/jobs error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
