export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { applyRateLimit } from "@/lib/rate-limit";
import { resolveQuotaPeriodStartIso } from "@/lib/subscription-period";
import type Stripe from "stripe";

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = applyRateLimit(user.id, "subscription", { windowMs: 60_000, max: 30 });
    if (limited) return limited;

    const admin = createAdminClient();

    const { data: sub, error: subErr } = await admin
      .from("subscriptions")
      .select(
        "id, plan_slug, status, current_period_end, current_period_start, created_at, stripe_sub_id"
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) {
      console.error("subscriptions lookup error:", subErr);
      return NextResponse.json(
        { error: "Failed to load subscription" },
        { status: 500 }
      );
    }

    if (!sub) {
      // Check if there's a recently expired/cancelled sub for the expired banner
      const { data: expiredSub } = await admin
        .from("subscriptions")
        .select("id, plan_slug, status, current_period_end, created_at")
        .eq("user_id", user.id)
        .in("status", ["expired", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (expiredSub?.status === "expired") {
        const { data: expiredPlan } = await admin
          .from("plans")
          .select("name")
          .eq("slug", expiredSub.plan_slug)
          .single();

        return NextResponse.json({
          active: false,
          expired: true,
          subscription: expiredSub,
          plan: expiredPlan,
        });
      }

      return NextResponse.json({ active: false, subscription: null });
    }

    // Auto-expire only non-recurring subs (no stripe_sub_id).
    // Recurring subs are managed by Stripe webhooks.
    if (
      !sub.stripe_sub_id &&
      sub.current_period_end &&
      new Date(sub.current_period_end) < new Date()
    ) {
      await admin
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("id", sub.id);

      return NextResponse.json({
        active: false,
        expired: true,
        subscription: sub,
      });
    }

    // Fetch plan details
    const { data: plan } = await admin
      .from("plans")
      .select("name, monthly_quota, monthly_download_quota")
      .eq("slug", sub.plan_slug)
      .single();

    let cancelAtPeriodEnd = false;
    let stripeSubCached: Stripe.Subscription | undefined;
    if (sub.stripe_sub_id) {
      try {
        stripeSubCached = await stripe.subscriptions.retrieve(sub.stripe_sub_id);
        cancelAtPeriodEnd = stripeSubCached.cancel_at_period_end;
      } catch {
        // If Stripe lookup fails, don't block the response
      }
    }

    // Usage for current billing window — never fail the whole response if counts fail
    let designUsage = 0;
    let downloadUsage = 0;
    let periodStartIso: string;
    try {
      periodStartIso = await resolveQuotaPeriodStartIso(
        admin,
        stripe,
        sub,
        stripeSubCached
      );
    } catch (e) {
      console.error("resolveQuotaPeriodStartIso:", e);
      periodStartIso = sub.current_period_start
        ? new Date(sub.current_period_start).toISOString()
        : new Date(sub.created_at).toISOString();
    }

    try {
      const [designCount, downloadCount] = await Promise.all([
        admin
          .from("poster_jobs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "done")
          .eq("is_preview", true)
          .gte("created_at", periodStartIso),
        admin
          .from("poster_jobs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "done")
          .eq("is_preview", false)
          .gte("created_at", periodStartIso),
      ]);
      designUsage = designCount.count || 0;
      downloadUsage = downloadCount.count || 0;
    } catch (e) {
      console.error("subscription usage counts:", e);
    }

    return NextResponse.json({
      active: true,
      subscription: sub,
      plan,
      cancelAtPeriodEnd,
      designUsage,
      downloadUsage,
      designQuota: plan?.monthly_quota ?? null,
      downloadQuota: plan?.monthly_download_quota ?? null,
    });
  } catch (err) {
    console.error("GET /api/subscription error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
