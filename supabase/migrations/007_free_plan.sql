-- 007: Free plan
--
-- Adds a `free` plan with 5 designs/month and 0 downloads, makes signup
-- automatically grant a free subscription, and backfills every existing
-- user who has no active subscription.
--
-- Free subscriptions intentionally have stripe_sub_id = NULL and
-- current_period_end = NULL. The application code (resolveQuotaPeriodStartIso)
-- treats `plan_slug = 'free'` as a rolling UTC calendar-month window, so
-- the 5/month quota resets without any cron job. Auto-expire logic in
-- /api/subscription and /api/jobs already skips rows with NULL
-- current_period_end, so a free sub never silently expires.

-- ============================================================
-- 1. Add the free plan
-- ============================================================
INSERT INTO public.plans (slug, name, price_monthly, monthly_quota, monthly_download_quota, day_pass_hours)
VALUES ('free', 'Free', 0.00, 5, 0, NULL)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  monthly_quota = EXCLUDED.monthly_quota,
  monthly_download_quota = EXCLUDED.monthly_download_quota;

-- ============================================================
-- 2. Update signup trigger to also grant a free subscription
-- ============================================================
-- The trigger runs as service_role (SECURITY DEFINER) so it bypasses RLS.
-- We pin search_path explicitly to defend against search_path injection
-- (matches the pattern from migration 006).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );

  -- Auto-grant a free subscription. NULL period bounds → handled as a
  -- rolling calendar-month window in application code.
  INSERT INTO public.subscriptions (
    user_id, plan_slug, status, current_period_end, current_period_start,
    stripe_customer_id, stripe_sub_id
  )
  VALUES (new.id, 'free', 'active', NULL, NULL, NULL, NULL);

  RETURN new;
END;
$$;

-- ============================================================
-- 3. Backfill: every user gets a free sub as a permanent fallback
-- ============================================================
-- We grant a free sub to every user who doesn't already have one. Paid
-- users keep their paid sub (which is newer, so order_by created_at desc
-- picks it up first). When the paid sub ends, the free sub is still
-- there and the app rolls back to free entitlements automatically.
-- The fulfill / webhook flows are responsible for NOT touching the free
-- sub when activating a paid plan (see app/api/stripe/*).
INSERT INTO public.subscriptions (
  user_id, plan_slug, status, current_period_end, current_period_start,
  stripe_customer_id, stripe_sub_id
)
SELECT
  u.id, 'free', 'active', NULL, NULL, NULL, NULL
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscriptions s
  WHERE s.user_id = u.id
    AND s.plan_slug = 'free'
    AND s.status = 'active'
);
