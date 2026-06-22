import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { applyRateLimit } from "@/lib/rate-limit";
import { createOrderSchema } from "@/lib/validations";
import { computeConfigHash } from "@/lib/config-hash";
import { getQuote, gelatoConfigured } from "@/lib/gelato";
import { computeAmounts, getCurrency } from "@/lib/order-pricing";
import {
  getPhysicalSize,
  getProductUid,
  getRenderDimensions,
  normalizeOrientation,
} from "@/lib/poster-products";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.is_anonymous) {
      return NextResponse.json(
        { error: "Sign up to order a physical poster." },
        { status: 401 }
      );
    }

    const limited = applyRateLimit(user.id, "order-create", {
      windowMs: 60_000,
      max: 10,
    });
    if (limited) return limited;

    if (!gelatoConfigured()) {
      return NextResponse.json(
        { error: "Physical ordering is not available right now." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { config, size_key, orientation, quantity, shipping } = parsed.data;

    const size = getPhysicalSize(size_key);
    const productOrientation = normalizeOrientation(orientation);
    const productUid = getProductUid(size_key, productOrientation);
    if (!size || !productUid) {
      return NextResponse.json(
        { error: "That size is not available." },
        { status: 400 }
      );
    }

    // Re-quote on the server — never trust client-supplied prices.
    const quote = await getQuote({
      productUid,
      quantity,
      currency: getCurrency(),
      customerReferenceId: user.id,
      recipient: {
        country: shipping.country,
        firstName: shipping.first_name,
        lastName: shipping.last_name,
        addressLine1: shipping.address_line1,
        addressLine2: shipping.address_line2 || undefined,
        city: shipping.city,
        state: shipping.state || undefined,
        postCode: shipping.post_code,
        email: shipping.email || undefined,
        phone: shipping.phone || undefined,
      },
    });
    const amounts = computeAmounts(quote);

    // Build the print render config. print_size_key signals the worker to
    // produce a single high-DPI print PNG instead of the download bundle, and
    // makes the config hash distinct from preview/download renders.
    const renderDims = getRenderDimensions(size, productOrientation);
    const renderConfig = {
      ...config,
      width: renderDims.width,
      height: renderDims.height,
      orientation,
      format: "png" as const,
      print_size_key: size_key,
    };
    const configHash = computeConfigHash(renderConfig as never);

    const admin = createAdminClient();

    // Reuse an existing print render for the same design so re-orders don't
    // re-render. Only match non-preview jobs in a non-failed state.
    let jobId: string;
    const { data: existingJob } = await admin
      .from("poster_jobs")
      .select("id")
      .eq("user_id", user.id)
      .eq("config_hash", configHash)
      .eq("is_preview", false)
      .in("status", ["queued", "running", "done"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingJob) {
      jobId = existingJob.id;
    } else {
      const { data: newJob, error: jobErr } = await admin
        .from("poster_jobs")
        .insert({
          user_id: user.id,
          status: "queued",
          input: renderConfig,
          config_hash: configHash,
          is_preview: false,
        })
        .select("id")
        .single();
      if (jobErr || !newJob) {
        console.error("Failed to create print job:", jobErr);
        return NextResponse.json(
          { error: "Failed to start poster rendering." },
          { status: 500 }
        );
      }
      jobId = newJob.id;
    }

    const { data: order, error: orderErr } = await admin
      .from("poster_orders")
      .insert({
        user_id: user.id,
        job_id: jobId,
        config: renderConfig,
        config_hash: configHash,
        size_key,
        product_uid: productUid,
        quantity,
        first_name: shipping.first_name,
        last_name: shipping.last_name,
        email: shipping.email || null,
        phone: shipping.phone || null,
        address_line1: shipping.address_line1,
        address_line2: shipping.address_line2 || null,
        city: shipping.city,
        state: shipping.state || null,
        post_code: shipping.post_code,
        country: shipping.country,
        currency: amounts.currency,
        amount_total: amounts.amount_total,
        amount_product: amounts.amount_product,
        amount_shipping: amounts.amount_shipping,
        markup: amounts.markup,
        status: "created",
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("Failed to create order:", orderErr);
      return NextResponse.json(
        { error: "Failed to create order." },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Reuse an existing Stripe customer if the user has one.
    const { data: existingSub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const productName = `Poster print — ${config.title || config.city || "Custom"} (${size.label})`;

    const sessionParams: Record<string, unknown> = {
      mode: "payment",
      metadata: { kind: "physical_order", order_id: order.id },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: amounts.currency.toLowerCase(),
            product_data: { name: productName },
            unit_amount: Math.round(amounts.amount_total * 100),
          },
        },
      ],
      success_url: `${appUrl}/order/${order.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/order/${order.id}?checkout=cancelled`,
    };

    if (existingSub?.stripe_customer_id) {
      sessionParams.customer = existingSub.stripe_customer_id;
    } else {
      sessionParams.customer_email = shipping.email || user.email || undefined;
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]
    );

    await admin
      .from("poster_orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", order.id);

    return NextResponse.json({ url: session.url, orderId: order.id });
  } catch (err) {
    console.error("POST /api/orders error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = applyRateLimit(user.id, "order-list", {
      windowMs: 60_000,
      max: 60,
    });
    if (limited) return limited;

    const { data: orders } = await supabase
      .from("poster_orders")
      .select(
        "id, status, size_key, quantity, currency, amount_total, country, tracking_url, gelato_order_id, created_at, config"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    return NextResponse.json({ orders: orders ?? [] });
  } catch (err) {
    console.error("GET /api/orders error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
