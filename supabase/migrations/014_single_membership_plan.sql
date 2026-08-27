-- 014: Single membership plan + atomic download ledger
--
-- Pricing model after this migration:
--   free       : $0  — full designer, unlimited previews, 0 high-res downloads
--   membership : $10/mo (or $100/yr) — full designer + 20 high-res downloads
--                per billing month
--
-- Physical prints stay entirely separate: they are one-off Stripe payments
-- priced from the Gelato quote and must never consume download quota.
--
-- Nothing is deleted. Legacy plan rows stay in `plans` (subscriptions.plan_slug
-- has an FK to them and historical rows must keep resolving), legacy
-- subscriptions keep their full audit trail in `subscription_plan_migrations`,
-- and every `download_credits` row is preserved.
--
-- Rollback: supabase/migrations/014_single_membership_plan.down.sql

-- ============================================================
-- 1. plans: add lifecycle columns, seed `membership`, retire the rest
-- ============================================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Annual is the same plan on a different Stripe cadence, not a second tier.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS price_annual numeric(10,2);

INSERT INTO public.plans (
  slug, name, price_monthly, price_annual,
  monthly_quota, monthly_download_quota, day_pass_hours, is_active
)
VALUES ('membership', 'Membership', 10.00, 100.00, NULL, 20, NULL, true)
ON CONFLICT (slug) DO UPDATE SET
  name                   = EXCLUDED.name,
  price_monthly          = EXCLUDED.price_monthly,
  price_annual           = EXCLUDED.price_annual,
  monthly_quota          = EXCLUDED.monthly_quota,
  monthly_download_quota = EXCLUDED.monthly_download_quota,
  is_active              = true;

-- Free stays purchasable-by-default (auto-granted at signup) but explicitly
-- carries zero downloads.
UPDATE public.plans
SET name = 'Free',
    price_monthly = 0.00,
    price_annual = NULL,
    monthly_quota = NULL,          -- unlimited previews / live designs
    monthly_download_quota = 0,
    is_active = true
WHERE slug = 'free';

-- Every other slug is retired: kept for referential integrity and history,
-- but never offered and never selected by application code.
UPDATE public.plans
SET is_active = false
WHERE slug NOT IN ('free', 'membership');

-- ============================================================
-- 2. Audit trail for the subscription re-point (reversible)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscription_plan_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  from_plan_slug text NOT NULL,
  to_plan_slug text NOT NULL,
  migration text NOT NULL,
  migrated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plan_migrations_sub
  ON public.subscription_plan_migrations (subscription_id);

-- Written and read only by the service role; no policies granted.
ALTER TABLE public.subscription_plan_migrations ENABLE ROW LEVEL SECURITY;

-- Record, then re-point. Every active paid subscriber lands on `membership`
-- and therefore on 20 downloads / billing month. Their Stripe subscription and
-- price are untouched here — see PRODUCTION.md for the required Stripe-side
-- price migration.
INSERT INTO public.subscription_plan_migrations (
  subscription_id, user_id, from_plan_slug, to_plan_slug, migration
)
SELECT s.id, s.user_id, s.plan_slug, 'membership', '014_single_membership_plan'
FROM public.subscriptions s
WHERE s.plan_slug NOT IN ('free', 'membership')
  AND NOT EXISTS (
    SELECT 1 FROM public.subscription_plan_migrations m
    WHERE m.subscription_id = s.id
      AND m.migration = '014_single_membership_plan'
  );

UPDATE public.subscriptions
SET plan_slug = 'membership'
WHERE plan_slug NOT IN ('free', 'membership');

-- ============================================================
-- 3. download_ledger — explicit, atomic quota accounting
-- ============================================================
-- Replaces "count rows in poster_jobs" as the source of truth. That old
-- approach conflated three different things with a paid download:
--   * physical print renders (poster_orders inserts is_preview=false jobs)
--   * jobs that later failed
--   * re-renders of an identical design
-- A dedicated ledger makes each of those explicitly free.
--
-- One row = one reserved or consumed download against one billing window.
--   reserved : job queued, quota held
--   consumed : render finished successfully
--   released : render failed / was cancelled — quota returned to the user

CREATE TABLE IF NOT EXISTS public.download_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  job_id uuid NOT NULL REFERENCES public.poster_jobs(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'consumed', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

-- A job can hold at most one live reservation, so a duplicate/retried request
-- for the same job can never be charged twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_download_ledger_job_live
  ON public.download_ledger (job_id)
  WHERE status <> 'released';

-- Covers the hot path: count live rows for a user whose window contains a
-- given instant.
CREATE INDEX IF NOT EXISTS idx_download_ledger_user_period_live
  ON public.download_ledger (user_id, period_start, period_end)
  WHERE status <> 'released';

-- Lets the stale-reservation sweeper find candidates cheaply.
CREATE INDEX IF NOT EXISTS idx_download_ledger_reserved_created
  ON public.download_ledger (created_at)
  WHERE status = 'reserved';

ALTER TABLE public.download_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own download ledger"
  ON public.download_ledger FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Writes go exclusively through the SECURITY DEFINER RPCs below, invoked by
-- the service role. No INSERT/UPDATE policy is granted on purpose.

-- ============================================================
-- 4. Backfill the ledger for the in-flight billing window
-- ============================================================
-- Without this, everyone's usage would reset to 0 on deploy (a free giveaway)
-- or be double-counted. We replay only downloads inside each subscriber's
-- current period, and we deliberately skip renders tied to a physical order.

INSERT INTO public.download_ledger (
  user_id, subscription_id, job_id, period_start, period_end, status, settled_at
)
SELECT
  j.user_id,
  s.id,
  j.id,
  coalesce(s.current_period_start, date_trunc('month', timezone('utc', now()))),
  coalesce(s.current_period_end, date_trunc('month', timezone('utc', now())) + interval '1 month'),
  CASE WHEN j.status = 'done' THEN 'consumed' ELSE 'reserved' END,
  CASE WHEN j.status = 'done' THEN j.updated_at ELSE NULL END
FROM public.poster_jobs j
JOIN LATERAL (
  SELECT s2.id, s2.current_period_start, s2.current_period_end
  FROM public.subscriptions s2
  WHERE s2.user_id = j.user_id
    AND s2.status = 'active'
  ORDER BY s2.created_at DESC
  LIMIT 1
) s ON true
WHERE j.is_preview = false
  AND j.status IN ('queued', 'running', 'done')
  AND j.created_at >= coalesce(
        s.current_period_start,
        date_trunc('month', timezone('utc', now()))
      )
  -- Physical print renders are paid for at checkout; they never cost quota.
  AND NOT EXISTS (
    SELECT 1 FROM public.poster_orders o WHERE o.job_id = j.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.download_ledger l WHERE l.job_id = j.id
  );

-- ============================================================
-- 5. RPC: release reservations that can never be settled
-- ============================================================
-- A reservation is settled by the worker callback. If the worker dies between
-- picking a job up and reporting on it, the hold would otherwise sit against
-- the user's allowance until the billing period rolls over. Two cases are
-- always safe to release:
--   * the job is already failed/cancelled — the user got nothing
--   * the job never reached 'done' and is older than the stall timeout
-- Both are idempotent, so this is called opportunistically on the write path
-- rather than needing a cron job.

CREATE OR REPLACE FUNCTION public.release_stale_download_reservations(
  p_user_id uuid DEFAULT NULL,
  p_stall_timeout interval DEFAULT interval '2 hours'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_released integer;
BEGIN
  WITH stale AS (
    SELECT l.id
    FROM public.download_ledger l
    JOIN public.poster_jobs j ON j.id = l.job_id
    WHERE l.status = 'reserved'
      AND (p_user_id IS NULL OR l.user_id = p_user_id)
      AND (
        -- Cast to text: job_status is ('queued','running','done','failed').
        -- An enum IN-list would try to cast 'cancelled' and raise 22P02,
        -- aborting every create_download_job call.
        j.status::text IN ('failed', 'cancelled')
        OR (j.status <> 'done' AND l.created_at < now() - p_stall_timeout)
      )
  )
  UPDATE public.download_ledger l
  SET status = 'released', settled_at = now()
  FROM stale
  WHERE l.id = stale.id;

  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

REVOKE ALL ON FUNCTION public.release_stale_download_reservations(uuid, interval)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_stale_download_reservations(uuid, interval)
  TO service_role;

-- ============================================================
-- 6. RPC: create a download job and reserve quota atomically
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_download_job(
  p_user_id uuid,
  p_input jsonb,
  p_config_hash text,
  p_quota integer,          -- NULL = unlimited
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_subscription_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_used integer;
  v_job_id uuid;
BEGIN
  IF p_quota IS NOT NULL AND p_quota <= 0 THEN
    RAISE EXCEPTION 'QUOTA_EXCEEDED:High-resolution downloads require a membership.';
  END IF;

  -- Serialize per user so two simultaneous requests cannot both observe
  -- "19 used" and both slip through. Released at commit/rollback.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  PERFORM public.release_stale_download_reservations(p_user_id);

  IF p_quota IS NOT NULL THEN
    -- Match on window containment rather than an exact period_start equality:
    -- the window is recomputed from Stripe on every request, so a boundary that
    -- shifts by a fraction of a second must not read as a fresh allowance.
    SELECT count(*) INTO v_used
    FROM public.download_ledger
    WHERE user_id = p_user_id
      AND status <> 'released'
      AND p_period_start >= period_start
      AND p_period_start < period_end;

    IF v_used >= p_quota THEN
      RAISE EXCEPTION
        'QUOTA_EXCEEDED:You have used all % high-resolution downloads for this billing period.',
        p_quota;
    END IF;
  END IF;

  INSERT INTO public.poster_jobs (user_id, status, input, config_hash, is_preview)
  VALUES (p_user_id, 'queued', p_input, p_config_hash, false)
  RETURNING id INTO v_job_id;

  INSERT INTO public.download_ledger (
    user_id, subscription_id, job_id, period_start, period_end, status
  )
  VALUES (
    p_user_id, p_subscription_id, v_job_id, p_period_start, p_period_end, 'reserved'
  );

  RETURN v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_download_job(
  uuid, jsonb, text, integer, timestamptz, timestamptz, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_download_job(
  uuid, jsonb, text, integer, timestamptz, timestamptz, uuid
) TO service_role;

-- ============================================================
-- 7. RPC: settle a reservation when the render finishes
-- ============================================================
-- Failed renders release the hold so a user is never charged for our error.
-- Both directions are idempotent, so duplicate worker callbacks are harmless.

CREATE OR REPLACE FUNCTION public.settle_download_reservation(
  p_job_id uuid,
  p_succeeded boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.download_ledger
  SET status = CASE WHEN p_succeeded THEN 'consumed' ELSE 'released' END,
      settled_at = now()
  WHERE job_id = p_job_id
    AND status = 'reserved';
END;
$$;

REVOKE ALL ON FUNCTION public.settle_download_reservation(uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_download_reservation(uuid, boolean)
  TO service_role;

-- ============================================================
-- 8. Retire the $9 single-download product
-- ============================================================
-- Rows are kept in full (payment history must survive). `retired_at` marks
-- credits that are no longer redeemable and makes the change reversible by
-- setting the column back to NULL.

ALTER TABLE public.download_credits
  ADD COLUMN IF NOT EXISTS retired_at timestamptz;

UPDATE public.download_credits
SET retired_at = now()
WHERE used = false
  AND retired_at IS NULL;

-- `create_job_with_quota_or_credit` (migration 010) is intentionally left in
-- place. It is already service_role-only and is no longer called by the app,
-- but keeping it means a rollback to the previous release still works.
