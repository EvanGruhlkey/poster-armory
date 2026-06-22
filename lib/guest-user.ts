import { createAdminClient } from "@/lib/supabase/admin";

// All unauthenticated /api/jobs previews are attributed to a single
// shared auth.users row (provisioned in migration 012). This lets the
// existing worker / poster_jobs / storage path code stay unchanged while
// giving guests a working preview button without any Supabase project
// settings to flip on.
//
// The id is cached for the lifetime of the Node process. The first
// guest preview after a deploy hits the RPC; everything after that is
// in-memory.

let cachedId: string | null = null;
let inFlight: Promise<string | null> | null = null;

export async function getGuestUserId(): Promise<string | null> {
  if (cachedId) return cachedId;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("get_guest_user_id");
    if (error) {
      console.error("get_guest_user_id RPC failed:", error);
      return null;
    }
    const id = (data as string | null) ?? null;
    if (id) cachedId = id;
    return id;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/**
 * Best-effort extraction of the client IP for IP-based rate limiting of
 * guest endpoints. Falls back to "anon" so the rate limiter still
 * scopes per process when no proxy headers are present (e.g. local dev).
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "anon";
}
