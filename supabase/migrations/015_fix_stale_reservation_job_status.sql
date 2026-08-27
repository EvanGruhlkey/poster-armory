-- 015: Don't compare job_status to a value the enum does not have.
--
-- poster_jobs.status is public.job_status = ('queued','running','done','failed').
-- release_stale_download_reservations used IN ('failed', 'cancelled'), and
-- Postgres casts those literals to the enum before evaluating the row.
-- 'cancelled' is not a valid label, so the call raised 22P02 and
-- create_download_job (which always runs the sweeper first) 503'd every download.

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
