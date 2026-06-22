-- 010: Pricing v2 — Free Preview / Single Download / Starter / Pro
--
-- New tier model:
--   free          : unlimited previews, 0 downloads (auto-granted on signup)
--   starter       : $10/mo recurring — unlimited previews + 5 downloads/month
--   pro           : $20/mo recurring — unlimited previews + unlimited downloads + commercial use
--   single_download: $9 one-time — grants ONE non-expiring download credit (NOT a subscription)
--
-- Legacy basic / pro_plus tiers are deprecated. Existing subscriptions on
-- those slugs are left intact so users grandfathered onto them keep their
-- entitlements until cancellation. The application layer maps the legacy
-- slugs to the closest new tier (basic -> starter, pro_plus -> pro) in
-- lib/plan-config.ts.

-- ============================================================
-- 1. Update plans table
-- ============================================================

-- Free: previously 5 designs/month, now unlimited previews.
UPDATE public.plans
SET name = 'Free Preview',
    price_monthly = 0.00,
    monthly_quota = NULL,           -- NULL = unlimited previews
    monthly_download_quota = 0
WHERE slug = 'free';

-- Starter: brand new tier (replaces "basic" going forward).
INSERT INTO public.plans (slug, name, price_monthly, monthly_quota, monthly_download_quota, day_pass_hours)
VALUES ('starter', 'Starter', 10.00, NULL, 5, NULL)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  monthly_quota = EXCLUDED.monthly_quota,
  monthly_download_quota = EXCLUDED.monthly_download_quota;

-- Pro: same slug, repriced to $20 with unlimited downloads.
UPDATE public.plans
SET name = 'Pro',
    price_monthly = 20.00,
    monthly_quota = NULL,           -- unlimited previews
    monthly_download_quota = NULL   -- unlimited downloads
WHERE slug = 'pro';

-- Single Download is intentionally NOT a row in `plans` — it never grants
-- a subscription. It only mints a row in `download_credits` (below).

-- ============================================================
-- 2. download_credits — one-time purchase ledger
-- ============================================================
-- One row = one usable high-res download. Created when a $9 Single
-- Download checkout succeeds; consumed atomically when a non-preview
-- render job is created for a user whose plan would otherwise block it.

CREATE TABLE IF NOT EXISTS public.download_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('purchase', 'gift', 'refund')),
  stripe_checkout_session_id text,
  stripe_payment_intent text,
  amount_cents integer,
  currency text,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  used_job_id uuid REFERENCES public.poster_jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_download_credits_user_unused
  ON public.download_credits (user_id, created_at)
  WHERE used = false;

-- Idempotency: never double-credit a single Stripe session.
CREATE UNIQUE INDEX IF NOT EXISTS idx_download_credits_session
  ON public.download_credits (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

ALTER TABLE public.download_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits"
  ON public.download_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Note: writes to download_credits go through the service-role admin
-- client (Stripe webhook + RPC), which bypasses RLS. We deliberately do
-- not add an authenticated INSERT/UPDATE policy.

-- ============================================================
-- 3. RPC: create_job_with_quota_or_credit
-- ============================================================
-- Wraps create_job_with_quota_check with a fallback: if the user is
-- creating a download job (is_preview=false) and their monthly download
-- quota is exhausted (or zero), atomically consume one unused
-- download_credit instead of failing. Returns the new job id, or raises
-- QUOTA_EXCEEDED if neither quota nor credits are available.

CREATE OR REPLACE FUNCTION public.create_job_with_quota_or_credit(
  p_user_id uuid,
  p_input jsonb,
  p_config_hash text,
  p_is_preview boolean,
  p_quota integer,
  p_period_start timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
  v_job_id uuid;
  v_credit_id uuid;
  v_period_start timestamptz;
BEGIN
  v_period_start := coalesce(
    p_period_start,
    date_trunc('month', timezone('utc', now()))
  );

  -- Serialize per-user so concurrent calls cannot both pass the quota
  -- check or both consume the same credit.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Quota check: NULL = unlimited.
  IF p_quota IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM public.poster_jobs
    WHERE user_id = p_user_id
      AND is_preview = p_is_preview
      AND status IN ('queued', 'running', 'done')
      AND created_at >= v_period_start;

    IF v_count >= p_quota THEN
      -- Previews are always quota-gated; we never spend credits on them.
      IF p_is_preview THEN
        RAISE EXCEPTION 'QUOTA_EXCEEDED:Monthly design limit reached. Upgrade for more.';
      END IF;

      -- Try to consume a download credit instead. SKIP LOCKED so two
      -- concurrent callers race for separate credits rather than block.
      UPDATE public.download_credits
      SET used = true, used_at = now()
      WHERE id = (
        SELECT id
        FROM public.download_credits
        WHERE user_id = p_user_id AND used = false
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id INTO v_credit_id;

      IF v_credit_id IS NULL THEN
        RAISE EXCEPTION 'QUOTA_EXCEEDED:Monthly download limit reached. Buy a single download or upgrade for more.';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.poster_jobs (user_id, status, input, config_hash, is_preview)
  VALUES (p_user_id, 'queued', p_input, p_config_hash, p_is_preview)
  RETURNING id INTO v_job_id;

  -- Link the credit to the job we just created so support can audit "what
  -- did this $9 buy?". Best-effort: a missing link is non-fatal.
  IF v_credit_id IS NOT NULL THEN
    UPDATE public.download_credits
    SET used_job_id = v_job_id
    WHERE id = v_credit_id;
  END IF;

  RETURN v_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_job_with_quota_or_credit(
  uuid, jsonb, text, boolean, integer, timestamptz
) TO authenticated, service_role;
