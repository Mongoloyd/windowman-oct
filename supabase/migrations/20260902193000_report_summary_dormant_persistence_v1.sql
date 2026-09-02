-- report-summary-dormant-persistence-v1
-- Additive dormant persistence for async Truth Report Executive Summary V1.
-- Does not alter scan-quote, report-access, analyses semantics, OTP, tracking, or QI.

-- ---------------------------------------------------------------------------
-- Versioned summary records (derived artifact — not analysis truth)
-- ---------------------------------------------------------------------------

CREATE TABLE public.wm_report_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL
    REFERENCES public.analyses(id)
    ON DELETE CASCADE,
  summary_version text NOT NULL DEFAULT 'report_summary_v1',
  prompt_version text NOT NULL,
  input_pack_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  summary_json jsonb NULL,
  runtime_model_id text NULL,
  generated_at timestamptz NULL,
  failure_class text NULL,
  worker_id text NULL,
  claim_token uuid NULL,
  claimed_at timestamptz NULL,
  lease_expires_at timestamptz NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wm_report_summaries_summary_version_check
    CHECK (char_length(summary_version) BETWEEN 1 AND 64),
  CONSTRAINT wm_report_summaries_prompt_version_check
    CHECK (char_length(prompt_version) BETWEEN 1 AND 64),
  CONSTRAINT wm_report_summaries_input_pack_hash_check
    CHECK (input_pack_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT wm_report_summaries_status_check
    CHECK (
      status IN (
        'pending',
        'processing',
        'ready',
        'insufficient_facts',
        'failed'
      )
    ),
  CONSTRAINT wm_report_summaries_attempts_check
    CHECK (attempt_count >= 0 AND max_attempts >= 1 AND attempt_count <= max_attempts + 1),
  CONSTRAINT wm_report_summaries_failure_class_len_check
    CHECK (failure_class IS NULL OR char_length(failure_class) <= 128),
  CONSTRAINT wm_report_summaries_ready_payload_check
    CHECK (
      status <> 'ready'
      OR (
        summary_json IS NOT NULL
        AND generated_at IS NOT NULL
      )
    ),
  CONSTRAINT wm_report_summaries_processing_ownership_check
    CHECK (
      status <> 'processing'
      OR (
        worker_id IS NOT NULL
        AND claim_token IS NOT NULL
        AND claimed_at IS NOT NULL
        AND lease_expires_at IS NOT NULL
      )
    ),
  CONSTRAINT wm_report_summaries_identity_key
    UNIQUE (analysis_id, prompt_version, input_pack_hash)
);

COMMENT ON TABLE public.wm_report_summaries IS
  'Dormant durable Truth Report Executive Summary V1 records. Derived explanatory data only — not reveal authority or analysis truth.';

COMMENT ON COLUMN public.wm_report_summaries.summary_json IS
  'Validated ReportSummaryV1 JSON. Only status=ready rows are display-eligible in future report-access projection.';

COMMENT ON COLUMN public.wm_report_summaries.claim_token IS
  'Rotated on every successful claim. Completion must CAS with this token.';

CREATE INDEX idx_wm_report_summaries_analysis_prompt
  ON public.wm_report_summaries (analysis_id, prompt_version);

CREATE INDEX idx_wm_report_summaries_processing_lease
  ON public.wm_report_summaries (lease_expires_at)
  WHERE status = 'processing';

CREATE TRIGGER trg_wm_report_summaries_updated_at
  BEFORE UPDATE ON public.wm_report_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- RLS / grants — service_role only
-- ---------------------------------------------------------------------------

ALTER TABLE public.wm_report_summaries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.wm_report_summaries FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.wm_report_summaries TO service_role;

CREATE POLICY wm_report_summaries_service_role_all
  ON public.wm_report_summaries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Pick one eligible completed analysis (no hash — computed in worker)
-- ---------------------------------------------------------------------------

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
  ORDER BY a.updated_at ASC, a.created_at ASC
  LIMIT 1
  FOR UPDATE OF a SKIP LOCKED;
END;
$$;

COMMENT ON FUNCTION public.wm_pick_report_summary_candidate(text) IS
  'Service-role-only bounded discovery. Returns at most one complete analysis without an active summary processing lease.';

REVOKE ALL ON FUNCTION public.wm_pick_report_summary_candidate(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wm_pick_report_summary_candidate(text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Claim generation for one analysis + hash + prompt version
-- ---------------------------------------------------------------------------

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

  INSERT INTO public.wm_report_summaries (
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
  RETURNING id, claim_token
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

-- ---------------------------------------------------------------------------
-- CAS completion — keyed to exact analysis_id + claim_token
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.wm_complete_report_summary(
  p_summary_id uuid,
  p_analysis_id uuid,
  p_worker_id text,
  p_claim_token uuid,
  p_status text,
  p_summary_json jsonb DEFAULT NULL,
  p_runtime_model_id text DEFAULT NULL,
  p_failure_class text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id text := NULLIF(btrim(COALESCE(p_worker_id, '')), '');
  v_status text := NULLIF(btrim(COALESCE(p_status, '')), '');
  v_updated integer;
BEGIN
  IF p_summary_id IS NULL OR p_analysis_id IS NULL OR p_claim_token IS NULL THEN
    RAISE EXCEPTION 'summary_id, analysis_id, and claim_token are required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'p_worker_id is required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_status IS NULL OR v_status NOT IN ('ready', 'insufficient_facts', 'failed') THEN
    RAISE EXCEPTION 'p_status must be ready, insufficient_facts, or failed'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.wm_report_summaries s
  SET
    status = v_status,
    summary_json = CASE
      WHEN v_status IN ('ready', 'insufficient_facts') THEN p_summary_json
      ELSE NULL
    END,
    runtime_model_id = p_runtime_model_id,
    generated_at = CASE
      WHEN v_status IN ('ready', 'insufficient_facts') THEN now()
      ELSE s.generated_at
    END,
    failure_class = CASE
      WHEN v_status = 'failed' THEN NULLIF(btrim(COALESCE(p_failure_class, '')), '')
      ELSE NULL
    END,
    worker_id = NULL,
    claim_token = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL,
    updated_at = now()
  WHERE s.id = p_summary_id
    AND s.analysis_id = p_analysis_id
    AND s.worker_id = v_worker_id
    AND s.claim_token = p_claim_token
    AND s.status = 'processing';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

COMMENT ON FUNCTION public.wm_complete_report_summary(
  uuid, uuid, text, uuid, text, jsonb, text, text
) IS
  'Service-role-only CAS completion for one claimed summary row. Cross-analysis writes are rejected by analysis_id binding.';

REVOKE ALL ON FUNCTION public.wm_complete_report_summary(
  uuid, uuid, text, uuid, text, jsonb, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wm_complete_report_summary(
  uuid, uuid, text, uuid, text, jsonb, text, text
) TO service_role;

-- ---------------------------------------------------------------------------
-- Install asserts (local schema only; no remote apply)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_rel text;
  v_fn text;
BEGIN
  FOREACH v_rel IN ARRAY ARRAY['wm_report_summaries']
  LOOP
    IF NOT (
      SELECT c.relrowsecurity
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_rel
    ) THEN
      RAISE EXCEPTION 'INSTALL ASSERT: RLS disabled on %', v_rel;
    END IF;

    IF has_table_privilege('anon', format('public.%I', v_rel), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', v_rel), 'SELECT')
       OR has_table_privilege('anon', format('public.%I', v_rel), 'INSERT')
       OR has_table_privilege('authenticated', format('public.%I', v_rel), 'INSERT')
       OR has_table_privilege('anon', format('public.%I', v_rel), 'UPDATE')
       OR has_table_privilege('authenticated', format('public.%I', v_rel), 'UPDATE')
       OR has_table_privilege('anon', format('public.%I', v_rel), 'DELETE')
       OR has_table_privilege('authenticated', format('public.%I', v_rel), 'DELETE') THEN
      RAISE EXCEPTION 'INSTALL ASSERT: browser role can access %', v_rel;
    END IF;

    IF NOT has_table_privilege('service_role', format('public.%I', v_rel), 'SELECT') THEN
      RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks SELECT on %', v_rel;
    END IF;
  END LOOP;

  FOREACH v_fn IN ARRAY ARRAY[
    'wm_pick_report_summary_candidate(text)',
    'wm_claim_report_summary_generation(uuid,text,text,text,integer)',
    'wm_complete_report_summary(uuid,uuid,text,uuid,text,jsonb,text,text)'
  ]
  LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'INSTALL ASSERT: browser role can execute %', v_fn;
    END IF;

    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks EXECUTE on %', v_fn;
    END IF;
  END LOOP;
END;
$$;
