import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, membershipPriceId } from "@/lib/stripe";
import { MEMBERSHIP_SLUG } from "@/lib/plan-config";
import { z } from "zod";
import { applyRateLimit } from "@/lib/rate-limit";

// One paid plan, two billing cadences. Annual is the same membership with the
// same 20 downloads per billing month, billed yearly.
const checkoutSchema = z.object({
  interval: z.enum(["monthly", "annual"]).default("monthly"),
});

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Checkout creates a Stripe Customer; never tie one to an expiring
    // anonymous Supabase session.
    if (user.is_anonymous) {
      return NextResponse.json(
        { error: "Create a free account to subscribe." },
        { status: 401 }
      );
    }

    const limited = applyRateLimit(user.id, "checkout", {
      windowMs: 60_000,
      max: 5,
    });
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
    }

    const { interval } = parsed.data;
    const priceId = membershipPriceId(interval);
    if (!priceId) {
      return NextResponse.json(
        { error: "Membership checkout is not configured. Please contact support." },
        { status: 503 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const admin = createAdminClient();

    // Reuse the existing Stripe customer so billing history stays on one record.
    const { data: existingSub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sessionParams: Record<string, unknown> = {
      mode: "subscription",
      metadata: {
        user_id: user.id,
        plan_slug: MEMBERSHIP_SLUG,
        kind: "membership",
        interval,
      },
      subscription_data: {
        metadata: { user_id: user.id, plan_slug: MEMBERSHIP_SLUG, interval },
      },
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${appUrl}/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/app/billing?checkout=cancelled`,
    };

    if (existingSub?.stripe_customer_id) {
      sessionParams.customer = existingSub.stripe_customer_id;
    } else {
      sessionParams.customer_email = user.email || undefined;
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to start checkout" },
      { status: 500 }
    );
  }
}
