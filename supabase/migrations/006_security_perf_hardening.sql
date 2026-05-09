-- 006: Security + performance hardening
-- Addresses Supabase advisor findings (security_definer exposure, mutable
-- search_path, RLS init-plan re-evaluation, unindexed foreign keys) and
-- closes a critical storage policy hole that exposed every user's poster
-- files to all authenticated roles.

-- ============================================================
-- 1. Storage: lock down the posters bucket
-- ============================================================
-- The previous "Service role full access to posters bucket" policy used
-- USING (bucket_id = 'posters') WITH CHECK (bucket_id = 'posters') with no
-- role restriction, granting ALL operations to PUBLIC (anon + authenticated).
-- service_role already bypasses RLS, so this policy was unnecessary AND
-- security-critical. Drop it and restrict insert/delete to user-owned files.
DROP POLICY IF EXISTS "Service role full access to posters bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload posters" ON storage.objects;

CREATE POLICY "Users can upload to own poster folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'posters'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own poster files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'posters'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'posters'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own poster files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'posters'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can read own poster files" ON storage.objects;
CREATE POLICY "Users can read own poster files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'posters'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- 2. Lock down SECURITY DEFINER functions + pin search_path
-- ============================================================
-- Set explicit search_path so a malicious schema in the user's path can't
-- shadow pg_catalog/public objects, and revoke EXECUTE from anon/authenticated
-- roles since these RPCs are only invoked server-side via the service_role.
ALTER FUNCTION public.handle_new_user()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.claim_next_job()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.increment_usage(uuid, date, date)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.recover_stuck_jobs(integer)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.create_job_with_quota_check(
  uuid, jsonb, text, boolean, integer, timestamptz
) SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_next_job() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_usage(uuid, date, date)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recover_stuck_jobs(integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_job_with_quota_check(
  uuid, jsonb, text, boolean, integer, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_next_job() TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_usage(uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.recover_stuck_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_job_with_quota_check(
  uuid, jsonb, text, boolean, integer, timestamptz
) TO service_role;

-- ============================================================
-- 3. Performance: rewrite RLS policies to evaluate auth.uid() once
-- ============================================================
-- Wrapping auth.<fn>() in (select ...) lets Postgres evaluate it as an
-- InitPlan once per query instead of once per row.

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert geocode cache"
  ON public.geocode_cache;
CREATE POLICY "Authenticated users can insert geocode cache"
  ON public.geocode_cache FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Users can view own jobs" ON public.poster_jobs;
CREATE POLICY "Users can view own jobs"
  ON public.poster_jobs FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own jobs" ON public.poster_jobs;
CREATE POLICY "Users can insert own jobs"
  ON public.poster_jobs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own posters" ON public.posters;
CREATE POLICY "Users can view own posters"
  ON public.posters FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own posters" ON public.posters;
CREATE POLICY "Users can insert own posters"
  ON public.posters FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own posters" ON public.posters;
CREATE POLICY "Users can delete own posters"
  ON public.posters FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own usage" ON public.usage;
CREATE POLICY "Users can view own usage"
  ON public.usage FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- 4. Performance: cover unindexed foreign keys
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posters_job_id
  ON public.posters (job_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_slug
  ON public.subscriptions (plan_slug);

-- Common predicate: WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status_created
  ON public.subscriptions (user_id, status, created_at DESC);
