import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/lib/types";

/**
 * Map a Gelato fulfillmentStatus to our internal order status. Returns null for
 * statuses we don't surface (e.g. created/uploading) so we leave the order as-is.
 * Docs: https://dashboard.gelato.com/docs/orders/order_details/
 */
function mapStatus(gelatoStatus: string | undefined): OrderStatus | null {
  switch (gelatoStatus) {
    case "passed":
    case "in_production":
    case "printed":
    case "digitizing":
      return "in_production";
    case "shipped":
    case "in_transit":
      return "shipped";
    case "delivered":
      return "delivered";
    case "failed":
    case "returned":
      return "failed";
    case "canceled":
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

/** Best-effort extraction of a tracking URL from the webhook payload. */
function extractTrackingUrl(payload: Record<string, unknown>): string | null {
  const items = (payload.items as Array<Record<string, unknown>>) || [];
  for (const item of items) {
    const fulfillments =
      (item.fulfillments as Array<Record<string, unknown>>) || [];
    for (const f of fulfillments) {
      const url = (f.trackingUrl || f.trackingCodeUrl) as string | undefined;
      if (url) return url;
    }
  }
  return null;
}

export async function POST(request: Request) {
  const expected = process.env.GELATO_WEBHOOK_SECRET;
  if (expected) {
    const token = new URL(request.url).searchParams.get("token");
    if (token !== expected) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const event = payload.event as string | undefined;
  const orderReferenceId = payload.orderReferenceId as string | undefined;

  // We only care about status updates that carry our order reference id.
  if (
    !orderReferenceId ||
    (event !== "order_status_updated" &&
      event !== "order_item_status_updated")
  ) {
    return NextResponse.json({ received: true });
  }

  // order-level uses `fulfillmentStatus`; item-level uses `status`.
  const gelatoStatus =
    (payload.fulfillmentStatus as string | undefined) ||
    (payload.status as string | undefined);
  const mapped = mapStatus(gelatoStatus);

  if (!mapped) {
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();
  const update: Record<string, unknown> = {
    status: mapped,
    updated_at: new Date().toISOString(),
  };

  const tracking = extractTrackingUrl(payload);
  if (tracking) update.tracking_url = tracking;

  await admin
    .from("poster_orders")
    .update(update)
    .eq("gelato_order_reference_id", orderReferenceId);

  return NextResponse.json({ received: true });
}
