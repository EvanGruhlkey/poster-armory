-- Skip live-map (WebGL) digital downloads in the Python worker.
-- Those jobs are captured in the browser and completed via /api/jobs/:id/complete.

CREATE OR REPLACE FUNCTION public.claim_next_job()
RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  SELECT id INTO v_job_id
  FROM public.poster_jobs
  WHERE status = 'queued'
    AND coalesce(input->>'render_engine', '') IS DISTINCT FROM 'webgl'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NOT NULL THEN
    UPDATE public.poster_jobs
    SET status = 'running', updated_at = now()
    WHERE id = v_job_id;
  END IF;

  RETURN v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_job() TO service_role;
