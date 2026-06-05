-- Wave A: additive return columns on wm_claim_dispatch_rows for tenant ownership
-- propagation to the dispatch worker without breaking existing callers.
--
-- Source of truth for prior body: supabase/migrations/20260414170000_wm_dispatch_worker.sql

CREATE OR REPLACE FUNCTION public.wm_claim_dispatch_rows(
  p_limit integer DEFAULT 25,
  p_lock_stale_minutes integer DEFAULT 10
)
RETURNS TABLE (
  dispatch_id uuid,
  event_log_id uuid,
  platform_name public.wm_platform_name,
  dispatch_status public.wm_dispatch_status,
  attempt_count integer,
  event_id text,
  event_name public.wm_event_name,
  event_timestamp timestamptz,
  event_payload jsonb,
  event_raw_payload jsonb,
  event_schema_version text,
  event_model_version text,
  event_rubric_version text,
  event_identity_quality text,
  should_send_meta boolean,
  should_send_google boolean,
  event_client_slug text,
  event_lead_id uuid,
  event_scan_session_id uuid,
  event_analysis_id uuid,
  event_quote_file_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Dead-letter any stale processing rows that have exhausted all attempts to
  -- prevent them from being permanently stuck when a worker crashes mid-flight.
  UPDATE public.wm_platform_dispatch_log
  SET
    dispatch_status = 'dead_letter',
    error_message   = 'Worker crashed after final attempt; row auto-dead-lettered',
    updated_at      = now()
  WHERE dispatch_status = 'processing'
    AND last_attempt_at IS NOT NULL
    AND last_attempt_at <= (now() - make_interval(mins => p_lock_stale_minutes))
    AND COALESCE(attempt_count, 0) >= 5;

  RETURN QUERY
  WITH eligible AS (
    SELECT d.id
    FROM public.wm_platform_dispatch_log d
    JOIN public.wm_event_log e ON e.id = d.event_log_id
    WHERE (
        -- Stale locked rows (worker crashed before final attempt)
        d.dispatch_status = 'processing'
          AND d.last_attempt_at IS NOT NULL
          AND d.last_attempt_at <= (now() - make_interval(mins => p_lock_stale_minutes))
        -- New/unscheduled pending rows
        OR d.dispatch_status = 'pending'
          AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= now())
        -- Retryable failed rows with a scheduled retry time that has arrived
        OR d.dispatch_status = 'failed'
          AND d.next_attempt_at IS NOT NULL
          AND d.next_attempt_at <= now()
      )
      AND COALESCE(d.attempt_count, 0) < 5
    ORDER BY COALESCE(d.next_attempt_at, d.created_at) ASC
    FOR UPDATE OF d SKIP LOCKED
    LIMIT GREATEST(COALESCE(p_limit, 25), 1)
  ), claimed AS (
    UPDATE public.wm_platform_dispatch_log d
    SET
      dispatch_status = 'processing',
      last_attempt_at = now(),
      next_attempt_at = NULL,
      attempt_count = COALESCE(d.attempt_count, 0) + 1,
      updated_at = now()
    FROM eligible
    WHERE d.id = eligible.id
    RETURNING d.id, d.event_log_id, d.platform_name, d.dispatch_status, d.attempt_count
  )
  SELECT
    c.id AS dispatch_id,
    c.event_log_id,
    c.platform_name,
    c.dispatch_status,
    c.attempt_count,
    e.event_id,
    e.event_name,
    e.event_timestamp,
    e.payload AS event_payload,
    e.raw_payload AS event_raw_payload,
    e.schema_version AS event_schema_version,
    e.model_version AS event_model_version,
    e.rubric_version AS event_rubric_version,
    COALESCE(e.payload->'identity'->>'identityQuality', e.payload->>'identityQuality', 'unknown') AS event_identity_quality,
    COALESCE((e.payload->>'shouldSendMeta')::boolean, e.approved_for_ads, false) AS should_send_meta,
    COALESCE((e.payload->>'shouldSendGoogle')::boolean, e.approved_for_index, false) AS should_send_google,
    e.client_slug AS event_client_slug,
    e.lead_id AS event_lead_id,
    e.scan_session_id AS event_scan_session_id,
    e.analysis_id AS event_analysis_id,
    e.quote_file_id AS event_quote_file_id
  FROM claimed c
  JOIN public.wm_event_log e ON e.id = c.event_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.wm_claim_dispatch_rows(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wm_claim_dispatch_rows(integer, integer) TO service_role;
