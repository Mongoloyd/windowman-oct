-- quote-intelligence-schema-v1
-- Additive dormant persistence for a future async quote-intelligence lane.
-- Does not enqueue work, alter scan-quote/analyses, Storage, OTP, tracking, or grants
-- on existing tables.

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

CREATE TABLE public.wm_quote_intelligence_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_file_id uuid NOT NULL
    REFERENCES public.quote_files(id)
    ON DELETE RESTRICT,
  scan_session_id uuid NULL
    REFERENCES public.scan_sessions(id)
    ON DELETE SET NULL,
  analysis_id uuid NULL
    REFERENCES public.analyses(id)
    ON DELETE SET NULL,
  lead_id uuid NULL
    REFERENCES public.leads(id)
    ON DELETE SET NULL,
  module_key text NOT NULL,
  schema_version text NOT NULL,
  prompt_version text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  worker_id text NULL,
  claim_token uuid NULL,
  claimed_at timestamptz NULL,
  lease_expires_at timestamptz NULL,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  error_code text NULL,
  error_detail text NULL,
  content_sha256 text NULL,
  extraction_id uuid NULL,
  result_disposition text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wm_qi_jobs_module_key_check
    CHECK (char_length(module_key) BETWEEN 1 AND 128),
  CONSTRAINT wm_qi_jobs_schema_version_check
    CHECK (char_length(schema_version) BETWEEN 1 AND 64),
  CONSTRAINT wm_qi_jobs_prompt_version_check
    CHECK (char_length(prompt_version) BETWEEN 1 AND 64),
  CONSTRAINT wm_qi_jobs_status_check
    CHECK (
      status IN (
        'pending',
        'processing',
        'retryable_failed',
        'completed',
        'terminal_failed',
        'manual_review'
      )
    ),
  CONSTRAINT wm_qi_jobs_attempts_check
    CHECK (attempt_count >= 0 AND max_attempts >= 1 AND attempt_count <= max_attempts + 1),
  CONSTRAINT wm_qi_jobs_error_code_len_check
    CHECK (error_code IS NULL OR char_length(error_code) <= 64),
  CONSTRAINT wm_qi_jobs_error_detail_len_check
    CHECK (error_detail IS NULL OR char_length(error_detail) <= 500),
  CONSTRAINT wm_qi_jobs_content_sha256_check
    CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT wm_qi_jobs_result_disposition_check
    CHECK (
      result_disposition IS NULL
      OR result_disposition IN (
        'extracted',
        'skipped_existing_extraction',
        'skipped_lease_held',
        'retryable_error',
        'terminal_error',
        'manual_review'
      )
    ),
  CONSTRAINT wm_qi_jobs_identity_key
    UNIQUE (quote_file_id, module_key, schema_version, prompt_version),
  CONSTRAINT wm_qi_jobs_processing_ownership_check
    CHECK (
      status <> 'processing'
      OR (
        worker_id IS NOT NULL
        AND claim_token IS NOT NULL
        AND claimed_at IS NOT NULL
        AND lease_expires_at IS NOT NULL
      )
    )
);

COMMENT ON TABLE public.wm_quote_intelligence_jobs IS
  'Dormant durable jobs for the async quote-intelligence lane. Independent of scan-quote. One job per quote_file + module + schema + prompt.';

COMMENT ON COLUMN public.wm_quote_intelligence_jobs.claim_token IS
  'Rotated on every successful claim. Later workers must CAS-complete with this token so zombie owners cannot finalize.';

CREATE INDEX idx_wm_qi_jobs_claim_due
  ON public.wm_quote_intelligence_jobs (status, next_attempt_at)
  WHERE status IN ('pending', 'retryable_failed');

CREATE INDEX idx_wm_qi_jobs_processing_lease
  ON public.wm_quote_intelligence_jobs (lease_expires_at)
  WHERE status = 'processing';

CREATE INDEX idx_wm_qi_jobs_content_sha256
  ON public.wm_quote_intelligence_jobs (content_sha256)
  WHERE content_sha256 IS NOT NULL;

CREATE INDEX idx_wm_qi_jobs_analysis_id
  ON public.wm_quote_intelligence_jobs (analysis_id)
  WHERE analysis_id IS NOT NULL;

CREATE INDEX idx_wm_qi_jobs_scan_session_id
  ON public.wm_quote_intelligence_jobs (scan_session_id)
  WHERE scan_session_id IS NOT NULL;

CREATE TRIGGER trg_wm_qi_jobs_updated_at
  BEFORE UPDATE ON public.wm_quote_intelligence_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Immutable extractions
-- ---------------------------------------------------------------------------

CREATE TABLE public.wm_quote_intelligence_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_sha256 text NOT NULL,
  module_key text NOT NULL,
  schema_version text NOT NULL,
  prompt_version text NOT NULL,
  provider text NOT NULL,
  runtime_model_id text NOT NULL,
  validated_payload jsonb NOT NULL,
  normalized_payload jsonb NOT NULL,
  field_confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_completion_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  usage_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wm_qi_extractions_sha256_check
    CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT wm_qi_extractions_module_key_check
    CHECK (char_length(module_key) BETWEEN 1 AND 128),
  CONSTRAINT wm_qi_extractions_schema_version_check
    CHECK (char_length(schema_version) BETWEEN 1 AND 64),
  CONSTRAINT wm_qi_extractions_prompt_version_check
    CHECK (char_length(prompt_version) BETWEEN 1 AND 64),
  CONSTRAINT wm_qi_extractions_provider_check
    CHECK (char_length(provider) BETWEEN 1 AND 64),
  CONSTRAINT wm_qi_extractions_model_check
    CHECK (char_length(runtime_model_id) BETWEEN 1 AND 128),
  CONSTRAINT wm_qi_extractions_identity_key
    UNIQUE (content_sha256, module_key, schema_version, prompt_version)
);

COMMENT ON TABLE public.wm_quote_intelligence_extractions IS
  'Immutable successful extraction results keyed by content SHA-256 + module + schema + prompt. Not browser-readable.';

ALTER TABLE public.wm_quote_intelligence_jobs
  ADD CONSTRAINT wm_qi_jobs_extraction_id_fkey
  FOREIGN KEY (extraction_id)
  REFERENCES public.wm_quote_intelligence_extractions(id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.wm_qi_forbid_extraction_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'wm_quote_intelligence_extractions are immutable after insert'
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER trg_wm_qi_extractions_immutable
  BEFORE UPDATE OR DELETE ON public.wm_quote_intelligence_extractions
  FOR EACH ROW
  EXECUTE FUNCTION public.wm_qi_forbid_extraction_mutation();

REVOKE ALL ON FUNCTION public.wm_qi_forbid_extraction_mutation() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Content/version execution leases (same-byte provider-call mutex)
-- ---------------------------------------------------------------------------

CREATE TABLE public.wm_quote_intelligence_content_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_sha256 text NOT NULL,
  module_key text NOT NULL,
  schema_version text NOT NULL,
  prompt_version text NOT NULL,
  worker_id text NOT NULL,
  claim_token uuid NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'held',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wm_qi_content_leases_sha256_check
    CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT wm_qi_content_leases_module_key_check
    CHECK (char_length(module_key) BETWEEN 1 AND 128),
  CONSTRAINT wm_qi_content_leases_schema_version_check
    CHECK (char_length(schema_version) BETWEEN 1 AND 64),
  CONSTRAINT wm_qi_content_leases_prompt_version_check
    CHECK (char_length(prompt_version) BETWEEN 1 AND 64),
  CONSTRAINT wm_qi_content_leases_status_check
    CHECK (status IN ('held', 'released')),
  CONSTRAINT wm_qi_content_leases_identity_key
    UNIQUE (content_sha256, module_key, schema_version, prompt_version)
);

COMMENT ON TABLE public.wm_quote_intelligence_content_leases IS
  'At most one unexpired held execution lease per content SHA-256 + module + schema + prompt. Not a second job queue.';

CREATE INDEX idx_wm_qi_content_leases_held_expiry
  ON public.wm_quote_intelligence_content_leases (lease_expires_at)
  WHERE status = 'held';

CREATE TRIGGER trg_wm_qi_content_leases_updated_at
  BEFORE UPDATE ON public.wm_quote_intelligence_content_leases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Normalized quoted field observations (EAV; distinct from quote_observations)
-- ---------------------------------------------------------------------------

CREATE TABLE public.wm_quote_intelligence_field_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id uuid NOT NULL
    REFERENCES public.wm_quote_intelligence_extractions(id)
    ON DELETE CASCADE,
  field_key text NOT NULL,
  observation_status text NOT NULL,
  provenance text NOT NULL DEFAULT 'QUOTED',
  value_boolean boolean NULL,
  value_integer bigint NULL,
  value_cents bigint NULL,
  value_numeric numeric NULL,
  value_text text NULL,
  value_canonical_text text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wm_qi_field_obs_field_key_check
    CHECK (char_length(field_key) BETWEEN 1 AND 128),
  CONSTRAINT wm_qi_field_obs_status_check
    CHECK (
      observation_status IN (
        'present',
        'unknown',
        'low_confidence',
        'invalid'
      )
    ),
  CONSTRAINT wm_qi_field_obs_provenance_check
    CHECK (provenance = 'QUOTED'),
  CONSTRAINT wm_qi_field_obs_value_arity_check
    CHECK (
      (
        (value_boolean IS NOT NULL)::integer
        + (value_integer IS NOT NULL)::integer
        + (value_cents IS NOT NULL)::integer
        + (value_numeric IS NOT NULL)::integer
        + (value_text IS NOT NULL)::integer
        + (value_canonical_text IS NOT NULL)::integer
      ) <= 1
    ),
  CONSTRAINT wm_qi_field_obs_present_requires_value_check
    CHECK (
      observation_status <> 'present'
      OR (
        (value_boolean IS NOT NULL)::integer
        + (value_integer IS NOT NULL)::integer
        + (value_cents IS NOT NULL)::integer
        + (value_numeric IS NOT NULL)::integer
        + (value_text IS NOT NULL)::integer
        + (value_canonical_text IS NOT NULL)::integer
      ) = 1
    ),
  CONSTRAINT wm_qi_field_obs_unknown_null_values_check
    CHECK (
      observation_status <> 'unknown'
      OR (
        value_boolean IS NULL
        AND value_integer IS NULL
        AND value_cents IS NULL
        AND value_numeric IS NULL
        AND value_text IS NULL
        AND value_canonical_text IS NULL
      )
    ),
  CONSTRAINT wm_qi_field_obs_identity_key
    UNIQUE (extraction_id, field_key)
);

COMMENT ON TABLE public.wm_quote_intelligence_field_observations IS
  'Queryable quoted-document field observations. Provenance is QUOTED only. value_cents is integer USD cents; NULL is not zero.';

COMMENT ON COLUMN public.wm_quote_intelligence_field_observations.value_cents IS
  'Integer USD cents. Explicit $0.00 is 0. Missing money remains NULL.';

CREATE INDEX idx_wm_qi_field_obs_field_status
  ON public.wm_quote_intelligence_field_observations (field_key, observation_status);

CREATE INDEX idx_wm_qi_field_obs_extraction_id
  ON public.wm_quote_intelligence_field_observations (extraction_id);

-- ---------------------------------------------------------------------------
-- RLS / grants — service_role only (no authenticated operator SELECT)
-- ---------------------------------------------------------------------------

ALTER TABLE public.wm_quote_intelligence_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wm_quote_intelligence_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wm_quote_intelligence_content_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wm_quote_intelligence_field_observations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.wm_quote_intelligence_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.wm_quote_intelligence_extractions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.wm_quote_intelligence_content_leases FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.wm_quote_intelligence_field_observations FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.wm_quote_intelligence_jobs TO service_role;
GRANT ALL ON TABLE public.wm_quote_intelligence_extractions TO service_role;
GRANT ALL ON TABLE public.wm_quote_intelligence_content_leases TO service_role;
GRANT ALL ON TABLE public.wm_quote_intelligence_field_observations TO service_role;

CREATE POLICY wm_qi_jobs_service_role_all
  ON public.wm_quote_intelligence_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY wm_qi_extractions_service_role_all
  ON public.wm_quote_intelligence_extractions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY wm_qi_content_leases_service_role_all
  ON public.wm_quote_intelligence_content_leases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY wm_qi_field_obs_service_role_all
  ON public.wm_quote_intelligence_field_observations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Claim RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.wm_claim_quote_intelligence_jobs(
  p_limit integer DEFAULT 1,
  p_worker_id text DEFAULT NULL,
  p_lease_seconds integer DEFAULT 300
)
RETURNS TABLE (
  job_id uuid,
  quote_file_id uuid,
  scan_session_id uuid,
  analysis_id uuid,
  lead_id uuid,
  module_key text,
  schema_version text,
  prompt_version text,
  status text,
  attempt_count integer,
  max_attempts integer,
  worker_id text,
  claim_token uuid,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  content_sha256 text,
  extraction_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(COALESCE(p_limit, 1), 1);
  v_lease_seconds integer := GREATEST(COALESCE(p_lease_seconds, 300), 1);
  v_worker_id text := NULLIF(btrim(COALESCE(p_worker_id, '')), '');
BEGIN
  IF v_worker_id IS NULL THEN
    RAISE EXCEPTION 'p_worker_id is required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.wm_quote_intelligence_jobs j
  SET
    status = 'terminal_failed',
    error_code = 'lease_exhausted',
    error_detail = 'Processing lease expired after final attempt',
    result_disposition = 'terminal_error',
    completed_at = now(),
    updated_at = now()
  WHERE j.status = 'processing'
    AND j.lease_expires_at IS NOT NULL
    AND j.lease_expires_at <= now()
    AND j.attempt_count >= j.max_attempts;

  RETURN QUERY
  WITH eligible AS (
    SELECT j.id
    FROM public.wm_quote_intelligence_jobs j
    WHERE j.attempt_count < j.max_attempts
      AND (
        (j.status = 'pending' AND j.next_attempt_at <= now())
        OR (j.status = 'retryable_failed' AND j.next_attempt_at <= now())
        OR (
          j.status = 'processing'
          AND j.lease_expires_at IS NOT NULL
          AND j.lease_expires_at <= now()
        )
      )
    ORDER BY j.next_attempt_at ASC, j.created_at ASC
    FOR UPDATE OF j SKIP LOCKED
    LIMIT v_limit
  ), claimed AS (
    UPDATE public.wm_quote_intelligence_jobs j
    SET
      status = 'processing',
      worker_id = v_worker_id,
      claim_token = gen_random_uuid(),
      claimed_at = now(),
      lease_expires_at = now() + make_interval(secs => v_lease_seconds),
      attempt_count = j.attempt_count + 1,
      next_attempt_at = now() + make_interval(secs => v_lease_seconds),
      error_code = NULL,
      error_detail = NULL,
      result_disposition = NULL,
      updated_at = now()
    FROM eligible
    WHERE j.id = eligible.id
    RETURNING
      j.id,
      j.quote_file_id,
      j.scan_session_id,
      j.analysis_id,
      j.lead_id,
      j.module_key,
      j.schema_version,
      j.prompt_version,
      j.status,
      j.attempt_count,
      j.max_attempts,
      j.worker_id,
      j.claim_token,
      j.claimed_at,
      j.lease_expires_at,
      j.content_sha256,
      j.extraction_id
  )
  SELECT
    c.id,
    c.quote_file_id,
    c.scan_session_id,
    c.analysis_id,
    c.lead_id,
    c.module_key,
    c.schema_version,
    c.prompt_version,
    c.status,
    c.attempt_count,
    c.max_attempts,
    c.worker_id,
    c.claim_token,
    c.claimed_at,
    c.lease_expires_at,
    c.content_sha256,
    c.extraction_id
  FROM claimed c;
END;
$$;

REVOKE ALL ON FUNCTION public.wm_claim_quote_intelligence_jobs(integer, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wm_claim_quote_intelligence_jobs(integer, text, integer)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Content execution lease acquire / release
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.wm_acquire_quote_intelligence_content_lease(
  p_content_sha256 text,
  p_module_key text,
  p_schema_version text,
  p_prompt_version text,
  p_worker_id text,
  p_lease_seconds integer DEFAULT 300
)
RETURNS TABLE (
  acquired boolean,
  already_extracted boolean,
  lease_id uuid,
  claim_token uuid,
  lease_expires_at timestamptz,
  existing_extraction_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sha text := lower(btrim(COALESCE(p_content_sha256, '')));
  v_module text := btrim(COALESCE(p_module_key, ''));
  v_schema text := btrim(COALESCE(p_schema_version, ''));
  v_prompt text := btrim(COALESCE(p_prompt_version, ''));
  v_worker text := NULLIF(btrim(COALESCE(p_worker_id, '')), '');
  v_lease_seconds integer := GREATEST(COALESCE(p_lease_seconds, 300), 1);
  v_extraction_id uuid;
  v_lease_id uuid;
  v_token uuid;
  v_expires timestamptz;
BEGIN
  IF v_sha !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'p_content_sha256 must be 64 lowercase hex chars'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_worker IS NULL OR v_module = '' OR v_schema = '' OR v_prompt = '' THEN
    RAISE EXCEPTION 'module, schema, prompt, and worker_id are required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT e.id
  INTO v_extraction_id
  FROM public.wm_quote_intelligence_extractions e
  WHERE e.content_sha256 = v_sha
    AND e.module_key = v_module
    AND e.schema_version = v_schema
    AND e.prompt_version = v_prompt;

  IF v_extraction_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      false,
      true,
      NULL::uuid,
      NULL::uuid,
      NULL::timestamptz,
      v_extraction_id;
    RETURN;
  END IF;

  -- Atomic acquire: unique identity + UPDATE only when released or expired.
  -- worker_id is not a steal key; two processes sharing a worker_id cannot both
  -- receive acquired=true while a live lease exists. Concurrent ON CONFLICT
  -- waiters are serialized on the unique index.
  INSERT INTO public.wm_quote_intelligence_content_leases (
    content_sha256,
    module_key,
    schema_version,
    prompt_version,
    worker_id,
    claim_token,
    lease_expires_at,
    status
  )
  VALUES (
    v_sha,
    v_module,
    v_schema,
    v_prompt,
    v_worker,
    gen_random_uuid(),
    now() + make_interval(secs => v_lease_seconds),
    'held'
  )
  ON CONFLICT (content_sha256, module_key, schema_version, prompt_version)
  DO UPDATE SET
    worker_id = EXCLUDED.worker_id,
    claim_token = gen_random_uuid(),
    lease_expires_at = EXCLUDED.lease_expires_at,
    status = 'held',
    updated_at = now()
  WHERE public.wm_quote_intelligence_content_leases.status = 'released'
     OR public.wm_quote_intelligence_content_leases.lease_expires_at <= now()
  RETURNING
    public.wm_quote_intelligence_content_leases.id,
    public.wm_quote_intelligence_content_leases.claim_token,
    public.wm_quote_intelligence_content_leases.lease_expires_at
  INTO v_lease_id, v_token, v_expires;

  IF v_lease_id IS NULL THEN
    RETURN QUERY
    SELECT
      false,
      false,
      NULL::uuid,
      NULL::uuid,
      NULL::timestamptz,
      NULL::uuid;
    RETURN;
  END IF;

  -- Check-lock-check: a completed extraction may land after the first lookup
  -- and before this waiter acquired. Do not authorize a provider call.
  SELECT e.id
  INTO v_extraction_id
  FROM public.wm_quote_intelligence_extractions e
  WHERE e.content_sha256 = v_sha
    AND e.module_key = v_module
    AND e.schema_version = v_schema
    AND e.prompt_version = v_prompt;

  IF v_extraction_id IS NOT NULL THEN
    UPDATE public.wm_quote_intelligence_content_leases l
    SET
      status = 'released',
      lease_expires_at = now(),
      updated_at = now()
    WHERE l.id = v_lease_id
      AND l.worker_id = v_worker
      AND l.claim_token = v_token
      AND l.status = 'held';

    RETURN QUERY
    SELECT
      false,
      true,
      NULL::uuid,
      NULL::uuid,
      NULL::timestamptz,
      v_extraction_id;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    true,
    false,
    v_lease_id,
    v_token,
    v_expires,
    NULL::uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.wm_acquire_quote_intelligence_content_lease(text, text, text, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wm_acquire_quote_intelligence_content_lease(text, text, text, text, text, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.wm_release_quote_intelligence_content_lease(
  p_content_sha256 text,
  p_module_key text,
  p_schema_version text,
  p_prompt_version text,
  p_worker_id text,
  p_claim_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.wm_quote_intelligence_content_leases l
  SET
    status = 'released',
    lease_expires_at = now(),
    updated_at = now()
  WHERE l.content_sha256 = lower(btrim(p_content_sha256))
    AND l.module_key = btrim(p_module_key)
    AND l.schema_version = btrim(p_schema_version)
    AND l.prompt_version = btrim(p_prompt_version)
    AND l.worker_id = p_worker_id
    AND l.claim_token = p_claim_token
    AND l.status = 'held';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.wm_release_quote_intelligence_content_lease(text, text, text, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wm_release_quote_intelligence_content_lease(text, text, text, text, text, uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- CAS job completion (zombie-safe)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.wm_cas_complete_quote_intelligence_job(
  p_job_id uuid,
  p_worker_id text,
  p_claim_token uuid,
  p_status text,
  p_result_disposition text DEFAULT NULL,
  p_extraction_id uuid DEFAULT NULL,
  p_content_sha256 text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_detail text DEFAULT NULL,
  p_next_attempt_at timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
  v_sha text := NULLIF(lower(btrim(COALESCE(p_content_sha256, ''))), '');
BEGIN
  IF p_status NOT IN (
    'completed',
    'retryable_failed',
    'terminal_failed',
    'manual_review'
  ) THEN
    RAISE EXCEPTION 'invalid completion status'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_status = 'retryable_failed' AND p_next_attempt_at IS NULL THEN
    RAISE EXCEPTION 'retryable_failed requires p_next_attempt_at'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.wm_quote_intelligence_jobs j
  SET
    status = p_status,
    result_disposition = p_result_disposition,
    extraction_id = COALESCE(p_extraction_id, j.extraction_id),
    content_sha256 = COALESCE(v_sha, j.content_sha256),
    error_code = CASE
      WHEN p_status IN ('retryable_failed', 'terminal_failed', 'manual_review')
        THEN left(COALESCE(p_error_code, j.error_code), 64)
      ELSE NULL
    END,
    error_detail = CASE
      WHEN p_status IN ('retryable_failed', 'terminal_failed', 'manual_review')
        THEN left(COALESCE(p_error_detail, j.error_detail), 500)
      ELSE NULL
    END,
    next_attempt_at = CASE
      WHEN p_status = 'retryable_failed' THEN p_next_attempt_at
      ELSE j.next_attempt_at
    END,
    completed_at = CASE
      WHEN p_status IN ('completed', 'terminal_failed', 'manual_review') THEN now()
      ELSE NULL
    END,
    lease_expires_at = CASE
      WHEN p_status = 'processing' THEN j.lease_expires_at
      ELSE now()
    END,
    updated_at = now()
  WHERE j.id = p_job_id
    AND j.status = 'processing'
    AND j.worker_id = p_worker_id
    AND j.claim_token IS NOT NULL
    AND p_claim_token IS NOT NULL
    AND j.claim_token = p_claim_token;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.wm_cas_complete_quote_intelligence_job(uuid, text, uuid, text, text, uuid, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wm_cas_complete_quote_intelligence_job(uuid, text, uuid, text, text, uuid, text, text, text, timestamptz)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Atomic extraction + observation persistence (service-role only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.wm_persist_quote_intelligence_extraction(
  p_content_sha256 text,
  p_module_key text,
  p_schema_version text,
  p_prompt_version text,
  p_provider text,
  p_runtime_model_id text,
  p_validated_payload jsonb,
  p_normalized_payload jsonb,
  p_field_confidence jsonb DEFAULT '{}'::jsonb,
  p_provider_completion_metadata jsonb DEFAULT '{}'::jsonb,
  p_usage_metadata jsonb DEFAULT '{}'::jsonb,
  p_observations jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  extraction_id uuid,
  created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_keys constant text[] := ARRAY[
    'document_type',
    'is_window_door_related',
    'extraction_confidence',
    'contractor_raw_name',
    'contract_total_cents',
    'total_openings',
    'county_name',
    'zip_code'
  ];
  v_sha text := lower(btrim(COALESCE(p_content_sha256, '')));
  v_module text := btrim(COALESCE(p_module_key, ''));
  v_schema text := btrim(COALESCE(p_schema_version, ''));
  v_prompt text := btrim(COALESCE(p_prompt_version, ''));
  v_provider text := btrim(COALESCE(p_provider, ''));
  v_model text := btrim(COALESCE(p_runtime_model_id, ''));
  v_existing_id uuid;
  v_new_id uuid;
  v_obs jsonb;
  v_key text;
  v_status text;
  v_provenance text;
  v_seen text[] := ARRAY[]::text[];
  v_value_count integer;
  v_bool boolean;
  v_int bigint;
  v_cents bigint;
  v_num numeric;
  v_text text;
  v_canonical text;
BEGIN
  IF v_sha !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'p_content_sha256 must be 64 lowercase hex chars'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_module = '' OR v_schema = '' OR v_prompt = '' OR v_provider = '' OR v_model = '' THEN
    RAISE EXCEPTION 'module, schema, prompt, provider, and runtime_model_id are required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_validated_payload IS NULL OR p_normalized_payload IS NULL THEN
    RAISE EXCEPTION 'validated_payload and normalized_payload are required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_observations IS NULL OR jsonb_typeof(p_observations) <> 'array' THEN
    RAISE EXCEPTION 'p_observations must be a json array'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF jsonb_array_length(p_observations) <> 8 THEN
    RAISE EXCEPTION 'p_observations must contain exactly 8 V1 field observations'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT e.id
  INTO v_existing_id
  FROM public.wm_quote_intelligence_extractions e
  WHERE e.content_sha256 = v_sha
    AND e.module_key = v_module
    AND e.schema_version = v_schema
    AND e.prompt_version = v_prompt;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY
    SELECT v_existing_id, false;
    RETURN;
  END IF;

  FOR v_obs IN
    SELECT value
    FROM jsonb_array_elements(p_observations)
  LOOP
    v_key := btrim(COALESCE(v_obs ->> 'field_key', ''));
    IF v_key = '' OR NOT v_key = ANY (v_allowed_keys) THEN
      RAISE EXCEPTION 'unsupported field_key: %', v_key
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_key = ANY (v_seen) THEN
      RAISE EXCEPTION 'duplicate field_key: %', v_key
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_seen := array_append(v_seen, v_key);

    v_status := btrim(COALESCE(v_obs ->> 'observation_status', ''));
    IF v_status NOT IN ('present', 'unknown', 'low_confidence', 'invalid') THEN
      RAISE EXCEPTION 'invalid observation_status for %', v_key
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    v_provenance := btrim(COALESCE(v_obs ->> 'provenance', ''));
    IF v_provenance <> 'QUOTED' THEN
      RAISE EXCEPTION 'provenance must be QUOTED for %', v_key
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    v_bool := CASE
      WHEN v_obs -> 'value_boolean' IS NULL OR v_obs -> 'value_boolean' = 'null'::jsonb THEN NULL
      ELSE (v_obs ->> 'value_boolean')::boolean
    END;
    v_int := CASE
      WHEN v_obs -> 'value_integer' IS NULL OR v_obs -> 'value_integer' = 'null'::jsonb THEN NULL
      ELSE (v_obs ->> 'value_integer')::bigint
    END;
    v_cents := CASE
      WHEN v_obs -> 'value_cents' IS NULL OR v_obs -> 'value_cents' = 'null'::jsonb THEN NULL
      ELSE (v_obs ->> 'value_cents')::bigint
    END;
    v_num := CASE
      WHEN v_obs -> 'value_numeric' IS NULL OR v_obs -> 'value_numeric' = 'null'::jsonb THEN NULL
      ELSE (v_obs ->> 'value_numeric')::numeric
    END;
    v_text := CASE
      WHEN v_obs -> 'value_text' IS NULL OR v_obs -> 'value_text' = 'null'::jsonb THEN NULL
      ELSE NULLIF(btrim(v_obs ->> 'value_text'), '')
    END;
    v_canonical := CASE
      WHEN v_obs -> 'value_canonical_text' IS NULL OR v_obs -> 'value_canonical_text' = 'null'::jsonb THEN NULL
      ELSE NULLIF(btrim(v_obs ->> 'value_canonical_text'), '')
    END;

    v_value_count :=
      (v_bool IS NOT NULL)::integer
      + (v_int IS NOT NULL)::integer
      + (v_cents IS NOT NULL)::integer
      + (v_num IS NOT NULL)::integer
      + (v_text IS NOT NULL)::integer
      + (v_canonical IS NOT NULL)::integer;

    IF v_value_count > 1 THEN
      RAISE EXCEPTION 'at most one typed value may be set for %', v_key
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF v_status = 'present' AND v_value_count <> 1 THEN
      RAISE EXCEPTION 'present observations require exactly one typed value for %', v_key
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF v_status = 'unknown' AND v_value_count <> 0 THEN
      RAISE EXCEPTION 'unknown observations cannot carry typed values for %', v_key
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_allowed_keys) AS required_key
    WHERE NOT required_key = ANY (v_seen)
  ) THEN
    RAISE EXCEPTION 'p_observations must include all V1 field keys'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.wm_quote_intelligence_extractions (
    content_sha256,
    module_key,
    schema_version,
    prompt_version,
    provider,
    runtime_model_id,
    validated_payload,
    normalized_payload,
    field_confidence,
    provider_completion_metadata,
    usage_metadata
  )
  VALUES (
    v_sha,
    v_module,
    v_schema,
    v_prompt,
    v_provider,
    v_model,
    p_validated_payload,
    p_normalized_payload,
    COALESCE(p_field_confidence, '{}'::jsonb),
    COALESCE(p_provider_completion_metadata, '{}'::jsonb),
    COALESCE(p_usage_metadata, '{}'::jsonb)
  )
  ON CONFLICT (content_sha256, module_key, schema_version, prompt_version)
  DO NOTHING
  RETURNING id
  INTO v_new_id;

  IF v_new_id IS NULL THEN
    SELECT e.id
    INTO v_existing_id
    FROM public.wm_quote_intelligence_extractions e
    WHERE e.content_sha256 = v_sha
      AND e.module_key = v_module
      AND e.schema_version = v_schema
      AND e.prompt_version = v_prompt;

    IF v_existing_id IS NULL THEN
      RAISE EXCEPTION 'extraction identity conflict without winner row'
        USING ERRCODE = '55000';
    END IF;

    RETURN QUERY
    SELECT v_existing_id, false;
    RETURN;
  END IF;

  INSERT INTO public.wm_quote_intelligence_field_observations (
    extraction_id,
    field_key,
    observation_status,
    provenance,
    value_boolean,
    value_integer,
    value_cents,
    value_numeric,
    value_text,
    value_canonical_text
  )
  SELECT
    v_new_id,
    btrim(obs ->> 'field_key'),
    obs ->> 'observation_status',
    'QUOTED',
    CASE
      WHEN obs -> 'value_boolean' IS NULL OR obs -> 'value_boolean' = 'null'::jsonb THEN NULL
      ELSE (obs ->> 'value_boolean')::boolean
    END,
    CASE
      WHEN obs -> 'value_integer' IS NULL OR obs -> 'value_integer' = 'null'::jsonb THEN NULL
      ELSE (obs ->> 'value_integer')::bigint
    END,
    CASE
      WHEN obs -> 'value_cents' IS NULL OR obs -> 'value_cents' = 'null'::jsonb THEN NULL
      ELSE (obs ->> 'value_cents')::bigint
    END,
    CASE
      WHEN obs -> 'value_numeric' IS NULL OR obs -> 'value_numeric' = 'null'::jsonb THEN NULL
      ELSE (obs ->> 'value_numeric')::numeric
    END,
    CASE
      WHEN obs -> 'value_text' IS NULL OR obs -> 'value_text' = 'null'::jsonb THEN NULL
      ELSE NULLIF(btrim(obs ->> 'value_text'), '')
    END,
    CASE
      WHEN obs -> 'value_canonical_text' IS NULL OR obs -> 'value_canonical_text' = 'null'::jsonb THEN NULL
      ELSE NULLIF(btrim(obs ->> 'value_canonical_text'), '')
    END
  FROM jsonb_array_elements(p_observations) AS obs;

  RETURN QUERY
  SELECT v_new_id, true;
END;
$$;

COMMENT ON FUNCTION public.wm_persist_quote_intelligence_extraction(
  text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) IS
  'Service-role-only atomic persistence for immutable quote-intelligence extractions and their complete QUOTED observation set.';

REVOKE ALL ON FUNCTION public.wm_persist_quote_intelligence_extraction(
  text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wm_persist_quote_intelligence_extraction(
  text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Discovery / enqueue RPC (producer only; no extraction or worker execution)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.wm_discover_quote_intelligence_jobs(
  p_limit integer DEFAULT 100,
  p_module_key text DEFAULT 'quote_document_header',
  p_schema_version text DEFAULT 'v1',
  p_prompt_version text DEFAULT 'p1'
)
RETURNS TABLE (
  scanned_candidates bigint,
  eligible_candidates bigint,
  jobs_created bigint,
  jobs_already_present bigint,
  jobs_skipped bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 1000);
  v_module_key text := NULLIF(btrim(COALESCE(p_module_key, '')), '');
  v_schema_version text := NULLIF(btrim(COALESCE(p_schema_version, '')), '');
  v_prompt_version text := NULLIF(btrim(COALESCE(p_prompt_version, '')), '');
BEGIN
  IF v_module_key IS NULL OR v_schema_version IS NULL OR v_prompt_version IS NULL THEN
    RAISE EXCEPTION 'module_key, schema_version, and prompt_version are required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
  WITH bounded_scan AS (
    SELECT qf.id AS quote_file_id
    FROM public.quote_files qf
    ORDER BY qf.created_at DESC
    LIMIT v_limit
  ), bounded_eligible AS (
    SELECT DISTINCT ON (bs.quote_file_id)
      bs.quote_file_id,
      ss.id AS scan_session_id,
      a.id AS analysis_id,
      COALESCE(a.lead_id, ss.lead_id) AS lead_id
    FROM bounded_scan bs
    INNER JOIN public.quote_files qf
      ON qf.id = bs.quote_file_id
     AND btrim(COALESCE(qf.storage_path, '')) <> ''
    INNER JOIN public.scan_sessions ss
      ON ss.quote_file_id = bs.quote_file_id
     AND ss.status NOT IN ('invalid_document', 'needs_better_upload')
    INNER JOIN public.analyses a
      ON a.scan_session_id = ss.id
     AND a.analysis_status = 'complete'
    ORDER BY bs.quote_file_id, a.created_at DESC
  ), inserted AS (
    INSERT INTO public.wm_quote_intelligence_jobs (
      quote_file_id,
      scan_session_id,
      analysis_id,
      lead_id,
      module_key,
      schema_version,
      prompt_version
    )
    SELECT
      e.quote_file_id,
      e.scan_session_id,
      e.analysis_id,
      e.lead_id,
      v_module_key,
      v_schema_version,
      v_prompt_version
    FROM bounded_eligible e
    ON CONFLICT ON CONSTRAINT wm_qi_jobs_identity_key DO NOTHING
    RETURNING quote_file_id
  )
  SELECT
    (SELECT COUNT(*)::bigint FROM bounded_scan) AS scanned_candidates,
    (SELECT COUNT(*)::bigint FROM bounded_eligible) AS eligible_candidates,
    (SELECT COUNT(*)::bigint FROM inserted) AS jobs_created,
    GREATEST(
      (SELECT COUNT(*)::bigint FROM bounded_eligible)
        - (SELECT COUNT(*)::bigint FROM inserted),
      0
    ) AS jobs_already_present,
    GREATEST(
      (SELECT COUNT(*)::bigint FROM bounded_scan)
        - (SELECT COUNT(*)::bigint FROM bounded_eligible),
      0
    ) AS jobs_skipped;
END;
$$;

COMMENT ON FUNCTION public.wm_discover_quote_intelligence_jobs(
  integer, text, text, text
) IS
  'Service-role-only bounded discovery/enqueue producer. Finds retained quote_files with canonical complete analyses and idempotently inserts pending wm_quote_intelligence_jobs. Does not download files, call providers, or run the worker.';

REVOKE ALL ON FUNCTION public.wm_discover_quote_intelligence_jobs(
  integer, text, text, text
)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wm_discover_quote_intelligence_jobs(
  integer, text, text, text
)
  TO service_role;

-- ---------------------------------------------------------------------------
-- Install asserts (local schema only; no remote apply)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_rel text;
  v_fn text;
  v_oid oid;
BEGIN
  FOREACH v_rel IN ARRAY ARRAY[
    'wm_quote_intelligence_jobs',
    'wm_quote_intelligence_extractions',
    'wm_quote_intelligence_content_leases',
    'wm_quote_intelligence_field_observations'
  ]
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
    'wm_claim_quote_intelligence_jobs(integer,text,integer)',
    'wm_acquire_quote_intelligence_content_lease(text,text,text,text,text,integer)',
    'wm_release_quote_intelligence_content_lease(text,text,text,text,text,uuid)',
    'wm_cas_complete_quote_intelligence_job(uuid,text,uuid,text,text,uuid,text,text,text,timestamptz)',
    'wm_persist_quote_intelligence_extraction(text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'wm_discover_quote_intelligence_jobs(integer,text,text,text)'
  ]
  LOOP
    v_oid := to_regprocedure('public.' || v_fn);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'INSTALL ASSERT: missing function %', v_fn;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.aclexplode(
        COALESCE(
          (SELECT p.proacl FROM pg_catalog.pg_proc AS p WHERE p.oid = v_oid),
          pg_catalog.acldefault('f', (SELECT p.proowner FROM pg_catalog.pg_proc AS p WHERE p.oid = v_oid))
        )
      ) AS acl
      LEFT JOIN pg_catalog.pg_roles AS role_grantee
        ON role_grantee.oid = acl.grantee
      WHERE acl.privilege_type = 'EXECUTE'
        AND (
          acl.grantee = 0
          OR COALESCE(role_grantee.rolname, '') IN ('anon', 'authenticated', 'PUBLIC')
        )
    ) THEN
      RAISE EXCEPTION 'INSTALL ASSERT: unexpected EXECUTE on %', v_fn;
    END IF;
    IF NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks EXECUTE on %', v_fn;
    END IF;
  END LOOP;
END $$;
