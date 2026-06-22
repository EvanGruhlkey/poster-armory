import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit } from "@/lib/rate-limit";
import { orderQuoteSchema } from "@/lib/validations";
import { getQuote, gelatoConfigured } from "@/lib/gelato";
import { computeAmounts, getCurrency } from "@/lib/order-pricing";
import { getProductUid, normalizeOrientation } from "@/lib/poster-products";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = applyRateLimit(user.id, "order-quote", {
      windowMs: 60_000,
      max: 30,
    });
    if (limited) return limited;

    if (!gelatoConfigured()) {
      return NextResponse.json(
        { error: "Physical ordering is not available right now." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = orderQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      size_key,
      orientation,
      quantity,
      country,
      state,
      post_code,
      city,
    } = parsed.data;
    const productOrientation = normalizeOrientation(orientation);
    const productUid = getProductUid(size_key, productOrientation);
    if (!productUid) {
      return NextResponse.json(
        { error: "That size is not available." },
        { status: 400 }
      );
    }

    const quote = await getQuote({
      productUid,
      quantity,
      currency: getCurrency(),
      customerReferenceId: user.id,
      recipient: {
        country,
        state: state || undefined,
        postCode: post_code || undefined,
        city: city || undefined,
      },
    });
    const amounts = computeAmounts(quote);

    return NextResponse.json({
      currency: amounts.currency,
      amount_product: amounts.amount_product,
      amount_shipping: amounts.amount_shipping,
      amount_total: amounts.amount_total,
      min_delivery_days: amounts.minDeliveryDays ?? null,
      max_delivery_days: amounts.maxDeliveryDays ?? null,
    });
  } catch (err) {
    console.error("POST /api/orders/quote error:", err);
    return NextResponse.json(
      { error: "Failed to get a price quote. Please try again." },
      { status: 502 }
    );
  }
}
