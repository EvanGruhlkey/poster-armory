export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit } from "@/lib/rate-limit";
import { getSubscriptionSummary } from "@/lib/subscription-summary";

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = applyRateLimit(user.id, "subscription", {
      windowMs: 60_000,
      max: 30,
    });
    if (limited) return limited;

    // Authoritative read: resolves cancellation state and the billing
    // interval from Stripe, and backfills period bounds if they're missing.
    const summary = await getSubscriptionSummary(user.id, { withStripe: true });
    return NextResponse.json(summary);
  } catch (err) {
    console.error("GET /api/subscription error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
