-- Corrective migration for environments where 008 was applied with the
-- permissive "Service role can manage orders" policy. The service role bypasses
-- RLS, so that ALL policy (USING true / WITH CHECK true for every role) was
-- both redundant and unsafe. Safe no-op if the policy was never created.
drop policy if exists "Service role can manage orders" on public.poster_orders;
