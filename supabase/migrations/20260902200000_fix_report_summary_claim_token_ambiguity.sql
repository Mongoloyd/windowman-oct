-- Additive repair for wm_claim_report_summary_generation first-insert path.
-- The RETURNS TABLE output column claim_token collided with the unqualified
-- INSERT RETURNING claim_token column reference (42702).
-- Existing-row UPDATE path was already table-qualified and is unchanged.
-- Public signature, SECURITY DEFINER, search_path, validation, lease,
-- attempt, terminal, and grant semantics are preserved.

CREATE OR REPLACE FUNCTION public.wm_claim_report_summary_generation(
  p_analysis_id uuid,
  p_prompt_version text,
  p_input_pack_hash text,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 300
)
RETURNS TABLE (
  summary_id uuid,
  claim_token uuid,
  prior_status text,
  already_terminal boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prompt_version text := NULLIF(btrim(COALESCE(p_prompt_version, '')), '');
  v_input_pack_hash text := NULLIF(btrim(COALESCE(p_input_pack_hash, '')), '');
  v_worker_id text := NULLIF(btrim(COALESCE(p_worker_id, '')), '');
  v_lease_seconds integer := GREATEST(COALESCE(p_lease_seconds, 300), 1);
  v_existing public.wm_report_summaries%ROWTYPE;
  v_claim_token uuid := gen_random_uuid();
BEGIN
  IF p_analysis_id IS NULL THEN
    RAISE EXCEPTION 'p_analysis_id is required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_prompt_version IS NULL THEN
    RAISE EXCEPTION 'p_prompt_version is required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_input_pack_hash IS NULL OR v_input_pack_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'p_input_pack_hash must be a 64-char hex sha256'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'p_worker_id is required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.analyses a
    WHERE a.id = p_analysis_id
      AND a.analysis_status = 'complete'
  ) THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_existing
  FROM public.wm_report_summaries s
  WHERE s.analysis_id = p_analysis_id
    AND s.prompt_version = v_prompt_version
    AND s.input_pack_hash = v_input_pack_hash
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status IN ('ready', 'insufficient_facts') THEN
      RETURN QUERY
      SELECT v_existing.id, v_existing.claim_token, v_existing.status, true;
      RETURN;
    END IF;

    IF v_existing.status = 'processing'
       AND v_existing.lease_expires_at IS NOT NULL
       AND v_existing.lease_expires_at > now()
       AND v_existing.worker_id IS DISTINCT FROM v_worker_id THEN
      RETURN;
    END IF;

    IF v_existing.attempt_count >= v_existing.max_attempts
       AND v_existing.status = 'failed' THEN
      RETURN;
    END IF;

    UPDATE public.wm_report_summaries s
    SET
      status = 'processing',
      worker_id = v_worker_id,
      claim_token = v_claim_token,
      claimed_at = now(),
      lease_expires_at = now() + make_interval(secs => v_lease_seconds),
      attempt_count = s.attempt_count + 1,
      failure_class = NULL,
      updated_at = now()
    WHERE s.id = v_existing.id
    RETURNING s.id, s.claim_token
    INTO summary_id, claim_token;

    prior_status := v_existing.status;
    already_terminal := false;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.wm_report_summaries AS ins (
    analysis_id,
    prompt_version,
    input_pack_hash,
    status,
    worker_id,
    claim_token,
    claimed_at,
    lease_expires_at,
    attempt_count
  )
  VALUES (
    p_analysis_id,
    v_prompt_version,
    v_input_pack_hash,
    'processing',
    v_worker_id,
    v_claim_token,
    now(),
    now() + make_interval(secs => v_lease_seconds),
    1
  )
  RETURNING ins.id, ins.claim_token
  INTO summary_id, claim_token;

  prior_status := NULL;
  already_terminal := false;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.wm_claim_report_summary_generation(
  uuid, text, text, text, integer
) IS
  'Service-role-only atomic claim for one analysis + prompt + input_pack_hash. Terminal ready/insufficient_facts rows are idempotent no-ops.';

REVOKE ALL ON FUNCTION public.wm_claim_report_summary_generation(
  uuid, text, text, text, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wm_claim_report_summary_generation(
  uuid, text, text, text, integer
) TO service_role;
