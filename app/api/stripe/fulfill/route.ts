export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { applyRateLimit } from "@/lib/rate-limit";
import { fulfillCheckoutSession } from "@/lib/stripe-fulfill";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = applyRateLimit(user.id, "fulfill", {
      windowMs: 60_000,
      max: 10,
    });
    if (limited) return limited;

    const { sessionId } = await request.json();
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      );
    }

    const result = await fulfillCheckoutSession(session, user.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message === "Missing plan metadata" || message === "Missing order_id in session metadata") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Stripe fulfill error:", err);
    return NextResponse.json(
      { error: "Failed to fulfill checkout" },
      { status: 500 }
    );
  }
}
