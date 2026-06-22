import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, PLAN_PRICE_MAP, SINGLE_DOWNLOAD_PRICE_ID } from "@/lib/stripe";
import { z } from "zod";
import { applyRateLimit } from "@/lib/rate-limit";

// "starter" / "pro" → recurring subscription via PLAN_PRICE_MAP.
// "single_download" → $9 one-time, fulfilled by webhook → download_credits.
const checkoutSchema = z.object({
  planSlug: z.enum(["starter", "pro", "single_download"]),
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

    // Stripe Checkout creates a Customer; we never want one tied to an
    // anonymous, expiring Supabase session. Force them to sign up first.
    if (user.is_anonymous) {
      return NextResponse.json(
        { error: "Sign up to purchase a plan or download." },
        { status: 401 }
      );
    }

    const limited = applyRateLimit(user.id, "checkout", { windowMs: 60_000, max: 5 });
    if (limited) return limited;

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400 }
      );
    }

    const { planSlug } = parsed.data;
    const isSingleDownload = planSlug === "single_download";
    const priceId = isSingleDownload
      ? SINGLE_DOWNLOAD_PRICE_ID
      : PLAN_PRICE_MAP[planSlug];
    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price not configured for this plan" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const price = await stripe.prices.retrieve(priceId);
    const isRecurring = price.type === "recurring";

    // Reuse existing Stripe customer if one exists
    const admin = createAdminClient();
    const { data: existingSub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const sessionParams: Record<string, unknown> = {
      metadata: {
        user_id: user.id,
        plan_slug: planSlug,
        // `kind` lets the webhook fan-out: physical_order / single_download /
        // (absent for legacy subscription flows).
        ...(isSingleDownload ? { kind: "single_download" } : {}),
      },
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
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
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
