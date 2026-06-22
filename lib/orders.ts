import { createAdminClient } from "@/lib/supabase/admin";
import { createOrder, gelatoConfigured, type GelatoAddress } from "@/lib/gelato";

/** Days a Gelato print file URL stays valid; Gelato fetches it during intake. */
const PRINT_FILE_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Submit a paid order to Gelato once its print file has been rendered.
 *
 * This is the rendezvous between two independent events: Stripe payment
 * succeeding and the worker finishing the print render. It is called from both
 * the Stripe webhook and the worker's job-complete callback, and is safe to
 * call repeatedly: it only proceeds when the order is `paid` AND the render is
 * `done`, and it atomically claims the order (paid -> submitting) so concurrent
 * callers can't double-submit.
 */
export async function submitOrderToGelato(orderId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("poster_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (!order) return;
  if (order.status !== "paid") return; // not paid yet, or already past this stage
  if (!order.job_id) return;

  const { data: job } = await admin
    .from("poster_jobs")
    .select("status, output")
    .eq("id", order.job_id)
    .single();

  const printPath = (job?.output as Record<string, string> | null)?.print;
  if (!job || job.status !== "done" || !printPath) {
    // Render not ready; the worker callback will re-trigger this when it lands.
    return;
  }

  if (!gelatoConfigured()) {
    await admin
      .from("poster_orders")
      .update({
        error: "Gelato is not configured (missing GELATO_API_KEY).",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    return;
  }

  // Atomically claim: only one caller flips paid -> submitting.
  const { data: claimed } = await admin
    .from("poster_orders")
    .update({ status: "submitting", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "paid")
    .select("id")
    .maybeSingle();

  if (!claimed) return; // another caller is already handling it

  try {
    const { data: signed } = await admin.storage
      .from("posters")
      .createSignedUrl(printPath, PRINT_FILE_TTL_SECONDS);

    if (!signed?.signedUrl) {
      throw new Error("Failed to create signed URL for the print file.");
    }

    const shippingAddress: GelatoAddress = {
      firstName: order.first_name,
      lastName: order.last_name,
      addressLine1: order.address_line1,
      addressLine2: order.address_line2 || undefined,
      city: order.city,
      state: order.state || undefined,
      postCode: order.post_code,
      country: order.country,
      email: order.email || undefined,
      phone: order.phone || undefined,
    };

    const result = await createOrder({
      orderReferenceId: order.id,
      customerReferenceId: order.user_id,
      currency: order.currency,
      productUid: order.product_uid,
      fileUrl: signed.signedUrl,
      quantity: order.quantity,
      shippingAddress,
    });

    await admin
      .from("poster_orders")
      .update({
        status: "submitted",
        gelato_order_id: result.id,
        gelato_order_reference_id: order.id,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Revert to paid so a later trigger can retry without losing the payment.
    await admin
      .from("poster_orders")
      .update({
        status: "paid",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);
    console.error(`submitOrderToGelato(${orderId}) failed:`, message);
  }
}
