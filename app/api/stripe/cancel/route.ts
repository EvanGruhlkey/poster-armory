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
        { error: "No active membership to cancel" },
        { status: 404 }
      );
    }

    // Free is the permanent fallback every account keeps — designing stays
    // free forever, so there is nothing to cancel.
    if (sub.plan_slug === "free") {
      return NextResponse.json(
        { error: "Designing is already free. There's no membership to cancel." },
        { status: 400 }
      );
    }

    if (sub.stripe_sub_id) {
      // Recurring subscription — cancel at period end so the member keeps
      // downloads until the billing cycle they already paid for finishes.
      try {
        await stripe.subscriptions.update(sub.stripe_sub_id, {
          cancel_at_period_end: true,
        });
      } catch (err) {
        // A subscription that no longer exists in Stripe cannot be scheduled.
        // End it here so the member is not stuck with a cancel button that
        // always fails.
        const missing =
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code?: string }).code === "resource_missing";
        if (!missing) throw err;

        await admin
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("id", sub.id);

        return NextResponse.json({ status: "cancelled", immediate: true });
      }

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
