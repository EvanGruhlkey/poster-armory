-- 012: Shared guest user for unauthenticated previews
--
-- Lets visitors generate poster previews on /app/design without signing
-- up or having Supabase "Anonymous Sign-Ins" enabled. All guest jobs are
-- attributed to a single shared auth.users row so the existing pipeline
-- (poster_jobs FK, worker, storage paths, signed URLs) works unchanged.
--
-- Real authentication is still required to download high-res files or
-- order a physical print — the API routes enforce that and never expose
-- the guest user_id to a logged-in user.
--
-- IP-based rate limiting is applied in `/api/jobs` for unauthenticated
-- callers to defend against abuse.

-- auth.users.email is uniquely indexed *only* WHERE is_sso_user = false
-- (partial index), so a vanilla `ON CONFLICT (email)` can't target it.
-- A WHERE NOT EXISTS guard provides equivalent idempotency.
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'guest@poster-forge.internal',
  -- We never log in as this user. A random bcrypt hash satisfies the
  -- column without leaving a usable password on disk.
  crypt(gen_random_uuid()::text, gen_salt('bf')),
  now(),
  '{"provider":"shared_guest","providers":["shared_guest"],"is_shared_guest":true}'::jsonb,
  '{"is_shared_guest":true,"display_name":"Guest"}'::jsonb,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'guest@poster-forge.internal'
);

-- Helper RPC: returns the guest user's UUID. Server code caches the
-- result for the lifetime of the Node process; this RPC is only hit on
-- the first guest request after a deploy.
CREATE OR REPLACE FUNCTION public.get_guest_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT id FROM auth.users
  WHERE email = 'guest@poster-forge.internal'
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_guest_user_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_user_id() TO service_role;
