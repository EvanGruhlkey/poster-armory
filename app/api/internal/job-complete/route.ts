import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitOrderToGelato } from "@/lib/orders";
import { z } from "zod";

const bodySchema = z.object({
  jobId: z.string().uuid(),
  secret: z.string().min(1),
});

/**
 * Called by the render worker when a job finishes. If a paid physical order is
 * waiting on that render, this advances it to Gelato. Secured by a shared
 * secret since it runs with service-role privileges and has no user session.
 */
export async function POST(request: Request) {
  const expected = process.env.WORKER_CALLBACK_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Worker callback not configured" },
      { status: 503 }
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (parsed.secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: orders } = await admin
    .from("poster_orders")
    .select("id")
    .eq("job_id", parsed.jobId)
    .eq("status", "paid");

  for (const order of orders ?? []) {
    await submitOrderToGelato(order.id);
  }

  return NextResponse.json({ ok: true, processed: orders?.length ?? 0 });
}
