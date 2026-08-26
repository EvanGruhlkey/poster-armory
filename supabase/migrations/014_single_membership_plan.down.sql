-- Rollback for 014_single_membership_plan.sql
--
-- Restores the pricing-v2 tier layout (free / starter / pro + legacy slugs)
-- and the download-credit redemption path. Safe to run more than once.
--
-- Apply manually — Supabase CLI does not run *.down.sql automatically:
--   supabase db execute -f supabase/migrations/014_single_membership_plan.down.sql
--
-- NOTE: run this BEFORE redeploying the previous application release, so the
-- old code never sees a `membership` plan slug it cannot resolve.

-- ============================================================
-- 1. Restore every subscription to the plan it had before 014
-- ============================================================

-- The audit table is kept (and its rows are kept) so the history of the
-- re-point survives the rollback. Reverted rows are marked, not deleted, which
-- also makes re-running this file a no-op.
ALTER TABLE public.subscription_plan_migrations
  ADD COLUMN IF NOT EXISTS reverted_at timestamptz;

UPDATE public.subscriptions s
SET plan_slug = m.from_plan_slug
FROM public.subscription_plan_migrations m
WHERE m.subscription_id = s.id
  AND m.migration = '014_single_membership_plan'
  AND m.reverted_at IS NULL
  AND s.plan_slug = 'membership';

UPDATE public.subscription_plan_migrations
SET reverted_at = now()
WHERE migration = '014_single_membership_plan'
  AND reverted_at IS NULL;

-- ============================================================
-- 2. Restore the pricing-v2 plan catalogue
-- ============================================================

UPDATE public.plans SET is_active = true;

UPDATE public.plans
SET name = 'Free Preview',
    price_monthly = 0.00,
    monthly_quota = NULL,
    monthly_download_quota = 0
WHERE slug = 'free';

INSERT INTO public.plans (slug, name, price_monthly, monthly_quota, monthly_download_quota)
VALUES ('starter', 'Starter', 10.00, NULL, 5)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  monthly_quota = EXCLUDED.monthly_quota,
  monthly_download_quota = EXCLUDED.monthly_download_quota;

UPDATE public.plans
SET name = 'Pro',
    price_monthly = 20.00,
    monthly_quota = NULL,
    monthly_download_quota = NULL
WHERE slug = 'pro';

-- Leave the `membership` row in place but unsellable, so any subscription row
-- that was created while 014 was live still resolves its FK.
UPDATE public.plans SET is_active = false WHERE slug = 'membership';

-- ============================================================
-- 3. Un-retire unused download credits
-- ============================================================

UPDATE public.download_credits
SET retired_at = NULL
WHERE used = false;

ALTER TABLE public.download_credits DROP COLUMN IF EXISTS retired_at;

-- ============================================================
-- 4. Drop the ledger and its RPCs
-- ============================================================
-- `create_job_with_quota_or_credit` was never dropped by 014, so the previous
-- release's quota path is already intact once these are gone.

DROP FUNCTION IF EXISTS public.settle_download_reservation(uuid, boolean);
DROP FUNCTION IF EXISTS public.create_download_job(
  uuid, jsonb, text, integer, timestamptz, timestamptz, uuid
);
DROP FUNCTION IF EXISTS public.release_stale_download_reservations(uuid, interval);

-- The ledger only records post-014 usage, which the previous release cannot
-- read. Dropping it returns quota accounting to counting `poster_jobs` rows.
DROP TABLE IF EXISTS public.download_ledger;

ALTER TABLE public.plans DROP COLUMN IF EXISTS price_annual;
ALTER TABLE public.plans DROP COLUMN IF EXISTS is_active;
