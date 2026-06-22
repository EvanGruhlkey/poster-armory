import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { createJobSchema } from "@/lib/validations";
import { computeConfigHash } from "@/lib/config-hash";
import { applyRateLimit } from "@/lib/rate-limit";
import { resolveQuotaPeriodStartIso } from "@/lib/subscription-period";
import { getClientIp, getGuestUserId } from "@/lib/guest-user";

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

    // Unauthenticated callers: previews only. We attribute the job to a
    // shared "guest" auth.users row (migration 012) so the existing
    // pipeline (poster_jobs FK, worker, storage paths) stays unchanged.
    // Downloads always require sign-up.
    let effectiveUserId: string;
    let isGuest = false;

    if (!user) {
      if (!is_preview) {
        return NextResponse.json(
          { error: "Sign up to download a high-resolution copy of this poster." },
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

      // IP-scoped limiter for unauthenticated callers. Higher window so
      // a single visitor isn't blocked mid-design, but tight enough to
      // make crawler abuse expensive.
      const ip = getClientIp(request);
      const limited = applyRateLimit(ip, "jobs-guest", {
        windowMs: 60_000,
        max: 10,
      });
      if (limited) return limited;
    } else {
      // Same defense as before for any Supabase anonymous sessions —
      // they may not buy downloads even if anon sign-in is enabled.
      if (!is_preview && user.is_anonymous) {
        return NextResponse.json(
          { error: "Sign up to download a high-resolution copy of this poster." },
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
    const admin = createAdminClient();

    // Dedup: never re-render or re-charge a user for the same config. Match
    // only the calling user (cross-user reuse would bypass quota), the same
    // is_preview kind (preview and download produce different files), and
    // pick the most recent job in any non-failed state.
    //
    //  - status='done' on the matching job → return its jobId; the worker
    //    already rendered the assets and we just rehydrate the library row
    //    if it's missing (e.g. user deleted from library and is redownloading).
    //  - status='queued' or 'running' → an earlier click is still in flight;
    //    return the same jobId so the client polls the existing job rather
    //    than creating a second one (rage-click double-charge protection).
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
          // Ensure the library record exists for downloads. Previews don't
          // get a posters row by design — the library only tracks downloads.
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

        // Job is still queued/running — frontend will poll the same jobId.
        return NextResponse.json({
          jobId: existing.id,
          cached: true,
          status: "pending",
        });
      }
    }

    // Guests share one free-plan subscription (provisioned in migration
    // 012). Skip the per-user sub fetch / quota RPC for them — previews
    // are always allowed and they can never reach the download path
    // because we gated that above.
    if (isGuest) {
      const { data: guestJob, error: guestErr } = await admin
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

      if (guestErr || !guestJob) {
        console.error("guest preview insert failed:", guestErr);
        return NextResponse.json(
          { error: "Failed to start preview" },
          { status: 500 }
        );
      }
      return NextResponse.json({ jobId: guestJob.id });
    }

    // Check subscription (must be active AND not expired)
    const { data: sub } = await admin
      .from("subscriptions")
      .select(
        "id, plan_slug, status, current_period_end, current_period_start, stripe_sub_id, created_at"
      )
      .eq("user_id", effectiveUserId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!sub) {
      return NextResponse.json(
        { error: "No active subscription. Please choose a plan." },
        { status: 403 }
      );
    }

    // Reject expired subscriptions
    if (
      sub.current_period_end &&
      new Date(sub.current_period_end) < new Date()
    ) {
      await admin
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("user_id", effectiveUserId)
        .eq("status", "active")
        .lte("current_period_end", new Date().toISOString());

      return NextResponse.json(
        { error: "Your subscription has expired. Please renew." },
        { status: 403 }
      );
    }

    // Pricing v2: NULL in the plans row means unlimited. The legacy
    // pro_plus carve-out is gone because both pro and pro_plus already
    // resolve to NULL after migration 010.
    const { data: plan } = await admin
      .from("plans")
      .select("monthly_quota, monthly_download_quota")
      .eq("slug", sub.plan_slug)
      .single();

    const quota: number | null = is_preview
      ? (plan?.monthly_quota ?? null)
      : (plan?.monthly_download_quota ?? null);

    const periodStartIso = await resolveQuotaPeriodStartIso(admin, stripe, sub);

    // Atomically: enforce quota and, for downloads only, fall back to one
    // unused download_credit if the plan's quota is exhausted. See
    // migration 010_pricing_v2.sql for the function body.
    const { data: jobId, error: rpcError } = await admin.rpc(
      "create_job_with_quota_or_credit",
      {
        p_user_id: effectiveUserId,
        p_input: config,
        p_config_hash: configHash,
        p_is_preview: is_preview,
        p_quota: quota,
        p_period_start: periodStartIso,
      }
    );

    if (rpcError) {
      if (rpcError.message?.includes("QUOTA_EXCEEDED")) {
        let msg =
          rpcError.message.split("QUOTA_EXCEEDED:")[1] ||
          "Quota exceeded. Upgrade for more.";
        if (!is_preview && quota === 0) {
          msg =
            "Downloads aren't included in your plan. Buy a single download ($9) or upgrade for monthly downloads.";
        } else if (!is_preview) {
          msg =
            "You've used all of this month's downloads. Buy a single download ($9) or upgrade to Pro for unlimited.";
        }
        return NextResponse.json({ error: msg }, { status: 403 });
      }

      if (
        rpcError.message?.includes("could not find") ||
        rpcError.code === "PGRST202"
      ) {
        console.warn(
          "create_job_with_quota_or_credit RPC not found, using inline fallback"
        );
        return await inlineCreateJob(
          admin,
          supabase,
          effectiveUserId,
          config,
          configHash,
          is_preview,
          quota,
          periodStartIso
        );
      }

      console.error("create_job_with_quota_or_credit error:", rpcError);
      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 }
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

/**
 * Fallback when `create_job_with_quota_or_credit` isn't available in the
 * database (e.g. migration 010 not yet applied). Performs the same
 * quota-then-credit check as the RPC but without an advisory lock, so
 * concurrent calls may briefly over-spend. The atomic RPC is the
 * production path; this is only here so a missing migration is loud-by-log
 * rather than silently 500ing.
 */
async function inlineCreateJob(
  admin: ReturnType<typeof createAdminClient>,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  config: Record<string, unknown>,
  configHash: string,
  isPreview: boolean,
  quota: number | null,
  periodStartIso: string
) {
  let creditId: string | null = null;

  if (quota !== null) {
    const { count } = await admin
      .from("poster_jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_preview", isPreview)
      .in("status", ["queued", "running", "done"])
      .gte("created_at", periodStartIso);

    if ((count || 0) >= quota) {
      if (isPreview) {
        return NextResponse.json(
          { error: "Monthly design limit reached. Upgrade for more." },
          { status: 403 }
        );
      }

      const { data: credit } = await admin
        .from("download_credits")
        .update({ used: true, used_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("used", false)
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!credit) {
        const msg =
          quota === 0
            ? "Downloads aren't included in your plan. Buy a single download ($9) or upgrade for monthly downloads."
            : "You've used all of this month's downloads. Buy a single download ($9) or upgrade to Pro for unlimited.";
        return NextResponse.json({ error: msg }, { status: 403 });
      }
      creditId = credit.id;
    }
  }

  const { data: job, error } = await supabase
    .from("poster_jobs")
    .insert({
      user_id: userId,
      status: "queued",
      input: config,
      config_hash: configHash,
      is_preview: isPreview,
    })
    .select("id")
    .single();

  if (error) {
    // Best-effort refund of the credit we just consumed.
    if (creditId) {
      await admin
        .from("download_credits")
        .update({ used: false, used_at: null })
        .eq("id", creditId);
    }
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 }
    );
  }

  if (creditId) {
    await admin
      .from("download_credits")
      .update({ used_job_id: job.id })
      .eq("id", creditId);
  }

  return NextResponse.json({ jobId: job.id });
}
