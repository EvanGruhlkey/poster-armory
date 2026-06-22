-- 011: Anonymous preview support
--
-- Supabase anonymous sign-in lets guests preview posters without signing
-- up. Anonymous users have no email, so:
--   1. profiles.email becomes nullable
--   2. handle_new_user() falls back to NULL email + no profile FK breakage
--
-- Anonymous users still receive a free subscription via the same trigger
-- so the existing quota / RPC / RLS pipeline works unchanged.
--
-- NOTE: Anonymous sign-in must also be ENABLED in the Supabase dashboard
-- (Authentication → Sign In/Up → Anonymous Sign-Ins). This migration only
-- relaxes the DB-side constraints; it does not flip the project setting.

ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

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
    new.email,                              -- NULL for anonymous users
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;              -- defensive; trigger should fire once

  INSERT INTO public.subscriptions (
    user_id, plan_slug, status, current_period_end, current_period_start,
    stripe_customer_id, stripe_sub_id
  )
  VALUES (new.id, 'free', 'active', NULL, NULL, NULL, NULL)
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$;
