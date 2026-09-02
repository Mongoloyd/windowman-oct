-- Additive repair for wm_pick_report_summary_candidate queue starvation.
-- Prior picker only skipped active processing leases, so a current
-- ready / insufficient_facts / permanently exhausted failed summary for the
-- oldest complete analysis could be rediscovered forever (worker then
-- returns skipped_current / claim refuses).
--
-- Currentness rule = OPTION B (analyses.updated_at freshness):
-- completed analyses are not immutable (scan-quote upserts on
-- scan_session_id), and trg_analyses_updated_at advances updated_at on
-- every UPDATE. Terminal summaries are "current" when their completion
-- timestamp is >= analyses.updated_at for the same prompt_version.
-- Do not duplicate FullSummaryFactPackV1 / input_pack_hash in SQL.
--
-- Public signature, SECURITY DEFINER, search_path, service_role grants,
-- ordering, LIMIT 1, and FOR UPDATE SKIP LOCKED are preserved.

CREATE OR REPLACE FUNCTION public.wm_pick_report_summary_candidate(
  p_prompt_version text
)
RETURNS TABLE (
  analysis_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prompt_version text := NULLIF(btrim(COALESCE(p_prompt_version, '')), '');
BEGIN
  IF v_prompt_version IS NULL THEN
    RAISE EXCEPTION 'p_prompt_version is required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
  SELECT a.id
  FROM public.analyses a
  WHERE a.analysis_status = 'complete'
    AND a.full_json IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.wm_report_summaries s
      WHERE s.analysis_id = a.id
        AND s.prompt_version = v_prompt_version
        AND s.status = 'processing'
        AND s.lease_expires_at IS NOT NULL
        AND s.lease_expires_at > now()
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.wm_report_summaries s
      WHERE s.analysis_id = a.id
        AND s.prompt_version = v_prompt_version
        AND s.status IN ('ready', 'insufficient_facts')
        AND COALESCE(s.generated_at, s.updated_at) >= a.updated_at
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.wm_report_summaries s
      WHERE s.analysis_id = a.id
        AND s.prompt_version = v_prompt_version
        AND s.status = 'failed'
        AND s.attempt_count >= s.max_attempts
        AND s.updated_at >= a.updated_at
    )
  ORDER BY a.updated_at ASC, a.created_at ASC
  LIMIT 1
  FOR UPDATE OF a SKIP LOCKED;
END;
$$;

COMMENT ON FUNCTION public.wm_pick_report_summary_candidate(text) IS
  'Service-role-only bounded discovery. Returns at most one complete analysis that is not blocked by an active summary lease, a current terminal ready/insufficient_facts row, or a current permanently exhausted failed row for the requested prompt_version.';

REVOKE ALL ON FUNCTION public.wm_pick_report_summary_candidate(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wm_pick_report_summary_candidate(text)
  TO service_role;
