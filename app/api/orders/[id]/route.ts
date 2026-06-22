export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyRateLimit } from "@/lib/rate-limit";
import { getPhysicalSize } from "@/lib/poster-products";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = applyRateLimit(user.id, "order-status", {
      windowMs: 60_000,
      max: 60,
    });
    if (limited) return limited;

    const { data: order } = await supabase
      .from("poster_orders")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Best-effort preview thumbnail from the linked render job.
    let previewUrl: string | null = null;
    if (order.job_id) {
      const admin = createAdminClient();
      const { data: job } = await admin
        .from("poster_jobs")
        .select("output")
        .eq("id", order.job_id)
        .single();
      const output = job?.output as Record<string, string> | null;
      const path = output?.preview || output?.print;
      if (path) {
        const { data: signed } = await admin.storage
          .from("posters")
          .createSignedUrl(path, 3600);
        previewUrl = signed?.signedUrl ?? null;
      }
    }

    const size = getPhysicalSize(order.size_key);

    return NextResponse.json({
      id: order.id,
      status: order.status,
      size_key: order.size_key,
      size_label: size?.label ?? order.size_key,
      quantity: order.quantity,
      currency: order.currency,
      amount_total: order.amount_total,
      amount_product: order.amount_product,
      amount_shipping: order.amount_shipping,
      country: order.country,
      tracking_url: order.tracking_url,
      gelato_order_id: order.gelato_order_id,
      error: order.error,
      created_at: order.created_at,
      preview_url: previewUrl,
    });
  } catch (err) {
    console.error("GET /api/orders/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
