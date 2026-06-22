-- 013: Harden create_job_with_quota_or_credit — only service_role may call it.
-- The API route uses the admin (service_role) client. Direct PostgREST calls from
-- anon/authenticated would let a caller pass an arbitrary p_user_id and bypass
-- quota checks (Supabase security advisor lint 0028/0029).

REVOKE EXECUTE ON FUNCTION public.create_job_with_quota_or_credit(
  uuid, jsonb, text, boolean, integer, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_job_with_quota_or_credit(
  uuid, jsonb, text, boolean, integer, timestamptz
) TO service_role;
