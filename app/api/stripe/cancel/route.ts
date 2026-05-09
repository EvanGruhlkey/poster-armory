export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = applyRateLimit(user.id, "cancel", {
      windowMs: 60_000,
      max: 5,
    });
    if (limited) return limited;

    const admin = createAdminClient();

    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, stripe_sub_id, current_period_end, plan_slug")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!sub) {
      return NextResponse.json(
        { error: "No active subscription to cancel" },
        { status: 404 }
      );
    }

    // The free plan is the permanent fallback every user keeps. Cancelling
    // it would leave them with no plan at all, so refuse the request.
    if (sub.plan_slug === "free") {
      return NextResponse.json(
        { error: "You're on the free plan — nothing to cancel." },
        { status: 400 }
      );
    }

    if (sub.stripe_sub_id) {
      // Recurring subscription — cancel at period end so user keeps access
      // until the billing cycle finishes
      await stripe.subscriptions.update(sub.stripe_sub_id, {
        cancel_at_period_end: true,
      });

      return NextResponse.json({
        status: "cancelled",
        cancelAt: sub.current_period_end,
      });
    }

    // Non-recurring (one-time payment) — cancel immediately in DB
    await admin
      .from("subscriptions")
      .update({ status: "cancelled" })
      .eq("id", sub.id);

    return NextResponse.json({ status: "cancelled" });
  } catch (err) {
    console.error("Cancel subscription error:", err);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}
