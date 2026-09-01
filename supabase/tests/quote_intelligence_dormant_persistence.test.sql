-- pgTAP for 20260901120000_quote_intelligence_dormant_persistence_v1.sql
-- Run: npx supabase test db supabase/tests/quote_intelligence_dormant_persistence.test.sql --local
-- Requires the migration already applied to a disposable local database.
-- True simultaneous winner-race proof remains NEEDS REPO VERIFICATION.
-- Do not add a dblink/two-session harness in this file unless later required.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(78);

SELECT has_table('public', 'wm_quote_intelligence_jobs', 'jobs table exists');
SELECT has_table('public', 'wm_quote_intelligence_extractions', 'extractions table exists');
SELECT has_table('public', 'wm_quote_intelligence_content_leases', 'content leases table exists');
SELECT has_table('public', 'wm_quote_intelligence_field_observations', 'field observations table exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'wm_quote_intelligence_jobs'),
  'jobs RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'wm_quote_intelligence_extractions'),
  'extractions RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'wm_quote_intelligence_content_leases'),
  'content leases RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'wm_quote_intelligence_field_observations'),
  'field observations RLS enabled'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.wm_quote_intelligence_jobs', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.wm_quote_intelligence_jobs', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.wm_quote_intelligence_jobs', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.wm_quote_intelligence_jobs', 'INSERT'),
  'browser roles cannot read or write jobs'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.wm_quote_intelligence_extractions', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.wm_quote_intelligence_extractions', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.wm_quote_intelligence_extractions', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.wm_quote_intelligence_extractions', 'INSERT'),
  'browser roles cannot read or write extractions'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.wm_quote_intelligence_content_leases', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.wm_quote_intelligence_content_leases', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.wm_quote_intelligence_content_leases', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.wm_quote_intelligence_content_leases', 'INSERT'),
  'browser roles cannot read or write content leases'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.wm_quote_intelligence_field_observations', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.wm_quote_intelligence_field_observations', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.wm_quote_intelligence_field_observations', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.wm_quote_intelligence_field_observations', 'INSERT'),
  'browser roles cannot read or write field observations'
);

SELECT ok(
  has_table_privilege('service_role', 'public.wm_quote_intelligence_jobs', 'SELECT')
  AND has_table_privilege('service_role', 'public.wm_quote_intelligence_extractions', 'SELECT')
  AND has_table_privilege('service_role', 'public.wm_quote_intelligence_content_leases', 'SELECT')
  AND has_table_privilege('service_role', 'public.wm_quote_intelligence_field_observations', 'SELECT'),
  'service_role can SELECT all quote-intelligence tables'
);

SELECT has_index(
  'public', 'wm_quote_intelligence_jobs', 'wm_qi_jobs_identity_key',
  'job identity unique exists'
);
SELECT has_index(
  'public', 'wm_quote_intelligence_extractions', 'wm_qi_extractions_identity_key',
  'extraction identity unique exists'
);
SELECT has_index(
  'public', 'wm_quote_intelligence_content_leases', 'wm_qi_content_leases_identity_key',
  'content lease identity unique exists'
);
SELECT has_index(
  'public', 'wm_quote_intelligence_field_observations', 'wm_qi_field_obs_identity_key',
  'observation identity unique exists'
);

SELECT ok(
  (
    SELECT i.indpred IS NOT NULL
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = 'idx_wm_qi_jobs_claim_due'
  ),
  'claim-due index is partial'
);

SELECT has_function(
  'public', 'wm_claim_quote_intelligence_jobs',
  ARRAY['integer', 'text', 'integer'],
  'claim RPC exists'
);
SELECT has_function(
  'public', 'wm_acquire_quote_intelligence_content_lease',
  ARRAY['text', 'text', 'text', 'text', 'text', 'integer'],
  'lease acquire RPC exists'
);
SELECT has_function(
  'public', 'wm_release_quote_intelligence_content_lease',
  ARRAY['text', 'text', 'text', 'text', 'text', 'uuid'],
  'lease release RPC exists'
);
SELECT has_function(
  'public', 'wm_cas_complete_quote_intelligence_job',
  ARRAY['uuid', 'text', 'uuid', 'text', 'text', 'uuid', 'text', 'text', 'text', 'timestamptz'],
  'CAS complete RPC exists'
);
SELECT has_function(
  'public', 'wm_persist_quote_intelligence_extraction',
  ARRAY['text', 'text', 'text', 'text', 'text', 'text', 'jsonb', 'jsonb', 'jsonb', 'jsonb', 'jsonb', 'jsonb'],
  'atomic persistence RPC exists'
);
SELECT has_function(
  'public', 'wm_discover_quote_intelligence_jobs',
  ARRAY['integer', 'text', 'text', 'text'],
  'discover/enqueue RPC exists'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.wm_discover_quote_intelligence_jobs(integer, text, text, text)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.wm_discover_quote_intelligence_jobs(integer, text, text, text)',
    'EXECUTE'
  ),
  'discover RPC not executable by browser roles'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.wm_discover_quote_intelligence_jobs(integer, text, text, text)',
    'EXECUTE'
  ),
  'discover RPC executable by service_role'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'wm_discover_quote_intelligence_jobs'
      AND p.prosecdef
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE split_part(cfg, '=', 1) = 'search_path'
          AND btrim(split_part(cfg, '=', 2), '"') = 'public'
      )
  ),
  'discover RPC is SECURITY DEFINER with search_path=public'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.wm_claim_quote_intelligence_jobs(integer, text, integer)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.wm_claim_quote_intelligence_jobs(integer, text, integer)',
    'EXECUTE'
  ),
  'claim RPC not executable by anon/authenticated'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.wm_claim_quote_intelligence_jobs(integer, text, integer)',
    'EXECUTE'
  ),
  'claim RPC executable by service_role'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.wm_acquire_quote_intelligence_content_lease(text, text, text, text, text, integer)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.wm_acquire_quote_intelligence_content_lease(text, text, text, text, text, integer)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'anon',
    'public.wm_release_quote_intelligence_content_lease(text, text, text, text, text, uuid)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.wm_cas_complete_quote_intelligence_job(uuid, text, uuid, text, text, uuid, text, text, text, timestamptz)',
    'EXECUTE'
  ),
  'lease/CAS RPCs not executable by browser roles'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'wm_claim_quote_intelligence_jobs'
      AND p.prosecdef
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE split_part(cfg, '=', 1) = 'search_path'
          AND btrim(split_part(cfg, '=', 2), '"') = 'public'
      )
  ),
  'claim RPC is SECURITY DEFINER with search_path=public'
);

SELECT col_is_unique(
  'public',
  'wm_quote_intelligence_jobs',
  ARRAY['quote_file_id', 'module_key', 'schema_version', 'prompt_version'],
  'duplicate job identity is rejected'
);
SELECT col_is_unique(
  'public',
  'wm_quote_intelligence_extractions',
  ARRAY['content_sha256', 'module_key', 'schema_version', 'prompt_version'],
  'duplicate extraction identity is rejected'
);
SELECT col_is_unique(
  'public',
  'wm_quote_intelligence_content_leases',
  ARRAY['content_sha256', 'module_key', 'schema_version', 'prompt_version'],
  'duplicate content-lease identity is rejected'
);
SELECT col_is_unique(
  'public',
  'wm_quote_intelligence_field_observations',
  ARRAY['extraction_id', 'field_key'],
  'duplicate observation field_key per extraction is rejected'
);

-- Sequential contract fixtures (rolled back). Superuser bypasses RLS.
CREATE TEMP TABLE qi_ctx (
  sha text NOT NULL,
  quote_file_id uuid,
  extraction_id uuid,
  job_id uuid,
  exhaust_job_id uuid,
  lease_token_1 uuid,
  lease_token_2 uuid,
  claim_token_1 uuid,
  claim_token_2 uuid
);

INSERT INTO qi_ctx (sha)
VALUES ('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

INSERT INTO public.wm_quote_intelligence_extractions (
  content_sha256, module_key, schema_version, prompt_version,
  provider, runtime_model_id, validated_payload, normalized_payload
)
SELECT
  sha, 'qi_pgtap_obs', 's1', 'p1',
  'test', 'test-model', '{}'::jsonb, '{}'::jsonb
FROM qi_ctx;

UPDATE qi_ctx
SET extraction_id = e.id
FROM public.wm_quote_intelligence_extractions e
WHERE e.module_key = 'qi_pgtap_obs';

SELECT throws_ok(
  $$
  INSERT INTO public.wm_quote_intelligence_extractions (
    content_sha256, module_key, schema_version, prompt_version,
    provider, runtime_model_id, validated_payload, normalized_payload
  )
  SELECT
    sha, 'qi_pgtap_obs', 's1', 'p1',
    'test', 'test-model', '{}'::jsonb, '{}'::jsonb
  FROM qi_ctx
  $$,
  '23505',
  NULL,
  'extraction uniqueness rejects same content/version identity'
);

SELECT throws_ok(
  $$
  UPDATE public.wm_quote_intelligence_extractions
  SET provider = 'mutated'
  WHERE module_key = 'qi_pgtap_obs'
  $$,
  '23001',
  NULL,
  'successful extractions cannot be updated'
);

SELECT throws_ok(
  $$
  INSERT INTO public.wm_quote_intelligence_field_observations (
    extraction_id, field_key, observation_status, provenance
  )
  SELECT extraction_id, 'contract_total_cents', 'present', 'QUOTED'
  FROM qi_ctx
  $$,
  '23514',
  NULL,
  'present observations require a typed value'
);

SELECT throws_ok(
  $$
  INSERT INTO public.wm_quote_intelligence_field_observations (
    extraction_id, field_key, observation_status, provenance, value_cents
  )
  SELECT extraction_id, 'contract_total_cents', 'unknown', 'QUOTED', 120000
  FROM qi_ctx
  $$,
  '23514',
  NULL,
  'unknown observations cannot carry a typed value'
);

SELECT lives_ok(
  $$
  INSERT INTO public.wm_quote_intelligence_field_observations (
    extraction_id, field_key, observation_status, provenance, value_cents
  )
  SELECT extraction_id, 'contract_total_cents', 'present', 'QUOTED', 0
  FROM qi_ctx
  $$,
  'explicit zero cents is allowed and distinct from NULL'
);

SELECT throws_ok(
  $$
  INSERT INTO public.wm_quote_intelligence_field_observations (
    extraction_id, field_key, observation_status, provenance, value_boolean
  )
  SELECT extraction_id, 'has_noa', 'present', 'VERIFIED_SOLD', true
  FROM qi_ctx
  $$,
  '23514',
  NULL,
  'non-QUOTED provenance is rejected'
);

SELECT throws_ok(
  $$
  INSERT INTO public.wm_quote_intelligence_field_observations (
    extraction_id, field_key, observation_status, provenance,
    value_boolean, value_integer
  )
  SELECT extraction_id, 'opening_count', 'present', 'QUOTED', true, 4
  FROM qi_ctx
  $$,
  '23514',
  NULL,
  'at most one typed value column may be set'
);

SELECT ok(
  (
    SELECT acquired AND NOT already_extracted
    FROM public.wm_acquire_quote_intelligence_content_lease(
      (SELECT sha FROM qi_ctx),
      'qi_pgtap_lease', 's1', 'p1', 'qi-worker-a', 300
    )
  ),
  'first content-lease acquire succeeds'
);

UPDATE qi_ctx
SET lease_token_1 = l.claim_token
FROM public.wm_quote_intelligence_content_leases l
WHERE l.module_key = 'qi_pgtap_lease';

SELECT ok(
  (
    SELECT NOT acquired AND NOT already_extracted
    FROM public.wm_acquire_quote_intelligence_content_lease(
      (SELECT sha FROM qi_ctx),
      'qi_pgtap_lease', 's1', 'p1', 'qi-worker-b', 300
    )
  ),
  'second worker cannot acquire an unexpired content lease'
);

SELECT ok(
  (
    SELECT NOT acquired AND NOT already_extracted
    FROM public.wm_acquire_quote_intelligence_content_lease(
      (SELECT sha FROM qi_ctx),
      'qi_pgtap_lease', 's1', 'p1', 'qi-worker-a', 300
    )
  ),
  'same worker cannot steal its own unexpired content lease'
);

UPDATE public.wm_quote_intelligence_content_leases
SET lease_expires_at = now() - interval '1 second'
WHERE module_key = 'qi_pgtap_lease';

SELECT ok(
  (
    SELECT acquired AND NOT already_extracted
    FROM public.wm_acquire_quote_intelligence_content_lease(
      (SELECT sha FROM qi_ctx),
      'qi_pgtap_lease', 's1', 'p1', 'qi-worker-b', 300
    )
  ),
  'expired content lease is reclaimable'
);

UPDATE qi_ctx
SET lease_token_2 = l.claim_token
FROM public.wm_quote_intelligence_content_leases l
WHERE l.module_key = 'qi_pgtap_lease';

SELECT ok(
  NOT public.wm_release_quote_intelligence_content_lease(
    (SELECT sha FROM qi_ctx),
    'qi_pgtap_lease', 's1', 'p1', 'qi-worker-a',
    (SELECT lease_token_1 FROM qi_ctx)
  ),
  'stale content-lease token cannot release newer ownership'
);

INSERT INTO public.wm_quote_intelligence_extractions (
  content_sha256, module_key, schema_version, prompt_version,
  provider, runtime_model_id, validated_payload, normalized_payload
)
SELECT
  sha, 'qi_pgtap_lease', 's1', 'p1',
  'test', 'test-model', '{}'::jsonb, '{}'::jsonb
FROM qi_ctx;

SELECT ok(
  (
    SELECT NOT acquired AND already_extracted AND existing_extraction_id IS NOT NULL
    FROM public.wm_acquire_quote_intelligence_content_lease(
      (SELECT sha FROM qi_ctx),
      'qi_pgtap_lease', 's1', 'p1', 'qi-worker-c', 300
    )
  ),
  'completed extraction is the final authority over a new provider lease'
);

INSERT INTO public.quote_files (storage_path)
VALUES ('qi-pgtap/claim.pdf');

UPDATE qi_ctx
SET quote_file_id = q.id
FROM public.quote_files q
WHERE q.storage_path = 'qi-pgtap/claim.pdf';

INSERT INTO public.wm_quote_intelligence_jobs (
  quote_file_id, module_key, schema_version, prompt_version, max_attempts
)
SELECT quote_file_id, 'qi_pgtap_claim', 's1', 'p1', 5
FROM qi_ctx;

SELECT throws_ok(
  $$
  INSERT INTO public.wm_quote_intelligence_jobs (
    quote_file_id, module_key, schema_version, prompt_version
  )
  SELECT quote_file_id, 'qi_pgtap_claim', 's1', 'p1'
  FROM qi_ctx
  $$,
  '23505',
  NULL,
  'duplicate job identity insert is rejected'
);

WITH claimed AS (
  SELECT *
  FROM public.wm_claim_quote_intelligence_jobs(1, 'qi-job-worker-a', 300)
)
UPDATE qi_ctx
SET
  job_id = claimed.job_id,
  claim_token_1 = claimed.claim_token
FROM claimed
WHERE claimed.module_key = 'qi_pgtap_claim';

SELECT ok(
  (
    SELECT attempt_count = 1
      AND status = 'processing'
      AND worker_id = 'qi-job-worker-a'
      AND claim_token IS NOT NULL
      AND claimed_at IS NOT NULL
      AND lease_expires_at > now()
    FROM public.wm_quote_intelligence_jobs
    WHERE module_key = 'qi_pgtap_claim'
  ),
  'pending job claim assigns worker, token, attempt, and lease atomically'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.wm_claim_quote_intelligence_jobs(5, 'qi-job-worker-b', 300)
  ),
  'unexpired processing job is not reclaimable'
);

UPDATE public.wm_quote_intelligence_jobs
SET lease_expires_at = now() - interval '1 second'
WHERE module_key = 'qi_pgtap_claim';

WITH claimed AS (
  SELECT *
  FROM public.wm_claim_quote_intelligence_jobs(1, 'qi-job-worker-b', 300)
)
UPDATE qi_ctx
SET claim_token_2 = claimed.claim_token
FROM claimed
WHERE claimed.module_key = 'qi_pgtap_claim';

SELECT ok(
  (
    SELECT attempt_count = 2
      AND worker_id = 'qi-job-worker-b'
      AND claim_token = (SELECT claim_token_2 FROM qi_ctx)
      AND claim_token IS DISTINCT FROM (SELECT claim_token_1 FROM qi_ctx)
    FROM public.wm_quote_intelligence_jobs
    WHERE module_key = 'qi_pgtap_claim'
  ),
  'expired processing job is reclaimable with a new claim token'
);

SELECT ok(
  NOT public.wm_cas_complete_quote_intelligence_job(
    (SELECT job_id FROM qi_ctx),
    'qi-job-worker-a',
    (SELECT claim_token_1 FROM qi_ctx),
    'completed',
    'extracted'
  ),
  'zombie worker cannot CAS-complete after losing the claim token'
);

SELECT ok(
  public.wm_cas_complete_quote_intelligence_job(
    (SELECT job_id FROM qi_ctx),
    'qi-job-worker-b',
    (SELECT claim_token_2 FROM qi_ctx),
    'completed',
    'extracted'
  ),
  'current owner can CAS-complete with matching worker and claim token'
);

INSERT INTO public.wm_quote_intelligence_jobs (
  quote_file_id, module_key, schema_version, prompt_version, max_attempts
)
SELECT quote_file_id, 'qi_pgtap_exhaust', 's1', 'p1', 1
FROM qi_ctx;

WITH claimed AS (
  SELECT *
  FROM public.wm_claim_quote_intelligence_jobs(1, 'qi-job-worker-a', 300)
)
UPDATE qi_ctx
SET exhaust_job_id = claimed.job_id
FROM claimed
WHERE claimed.module_key = 'qi_pgtap_exhaust';

UPDATE public.wm_quote_intelligence_jobs
SET lease_expires_at = now() - interval '1 second'
WHERE module_key = 'qi_pgtap_exhaust';

CREATE TEMP TABLE qi_exhaust_reclaim AS
SELECT *
FROM public.wm_claim_quote_intelligence_jobs(5, 'qi-job-worker-b', 300);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM qi_exhaust_reclaim
    WHERE module_key = 'qi_pgtap_exhaust'
  )
  AND EXISTS (
    SELECT 1
    FROM public.wm_quote_intelligence_jobs
    WHERE module_key = 'qi_pgtap_exhaust'
      AND status = 'terminal_failed'
      AND error_code = 'lease_exhausted'
  ),
  'exhausted expired processing jobs are dead-lettered and not claimable'
);

SELECT ok(
  NOT has_function_privilege(
    'public',
    'public.wm_persist_quote_intelligence_extraction(text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)',
    'EXECUTE'
  ),
  'PUBLIC cannot execute persistence RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.wm_persist_quote_intelligence_extraction(text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.wm_persist_quote_intelligence_extraction(text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)',
    'EXECUTE'
  ),
  'persistence RPC not executable by anon/authenticated'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.wm_persist_quote_intelligence_extraction(text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)',
    'EXECUTE'
  ),
  'persistence RPC executable by service_role'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'wm_persist_quote_intelligence_extraction'
      AND p.prosecdef
      AND EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE split_part(cfg, '=', 1) = 'search_path'
          AND btrim(split_part(cfg, '=', 2), '"') = 'public'
      )
  ),
  'persistence RPC is SECURITY DEFINER with search_path=public'
);

CREATE TEMP TABLE qi_persist_fixtures (
  persist_sha text NOT NULL,
  valid_obs jsonb NOT NULL,
  zero_cents_obs jsonb NOT NULL,
  unknown_money_obs jsonb NOT NULL
);

INSERT INTO qi_persist_fixtures (persist_sha, valid_obs, zero_cents_obs, unknown_money_obs)
VALUES (
  '0000000000000000000000000000000000000000000000000000000000000001',
  $json$
  [
    {"field_key":"document_type","observation_status":"present","provenance":"QUOTED","value_canonical_text":"contractor_quote"},
    {"field_key":"is_window_door_related","observation_status":"present","provenance":"QUOTED","value_boolean":true},
    {"field_key":"extraction_confidence","observation_status":"present","provenance":"QUOTED","value_numeric":0.92},
    {"field_key":"contractor_raw_name","observation_status":"present","provenance":"QUOTED","value_text":"Acme Windows"},
    {"field_key":"contract_total_cents","observation_status":"present","provenance":"QUOTED","value_cents":120000},
    {"field_key":"total_openings","observation_status":"present","provenance":"QUOTED","value_integer":12},
    {"field_key":"county_name","observation_status":"unknown","provenance":"QUOTED"},
    {"field_key":"zip_code","observation_status":"present","provenance":"QUOTED","value_text":"33401"}
  ]
  $json$::jsonb,
  $json$
  [
    {"field_key":"document_type","observation_status":"present","provenance":"QUOTED","value_canonical_text":"contractor_quote"},
    {"field_key":"is_window_door_related","observation_status":"present","provenance":"QUOTED","value_boolean":true},
    {"field_key":"extraction_confidence","observation_status":"present","provenance":"QUOTED","value_numeric":0.92},
    {"field_key":"contractor_raw_name","observation_status":"present","provenance":"QUOTED","value_text":"Acme Windows"},
    {"field_key":"contract_total_cents","observation_status":"present","provenance":"QUOTED","value_cents":0},
    {"field_key":"total_openings","observation_status":"present","provenance":"QUOTED","value_integer":12},
    {"field_key":"county_name","observation_status":"unknown","provenance":"QUOTED"},
    {"field_key":"zip_code","observation_status":"present","provenance":"QUOTED","value_text":"33401"}
  ]
  $json$::jsonb,
  $json$
  [
    {"field_key":"document_type","observation_status":"present","provenance":"QUOTED","value_canonical_text":"contractor_quote"},
    {"field_key":"is_window_door_related","observation_status":"present","provenance":"QUOTED","value_boolean":true},
    {"field_key":"extraction_confidence","observation_status":"present","provenance":"QUOTED","value_numeric":0.92},
    {"field_key":"contractor_raw_name","observation_status":"present","provenance":"QUOTED","value_text":"Acme Windows"},
    {"field_key":"contract_total_cents","observation_status":"unknown","provenance":"QUOTED"},
    {"field_key":"total_openings","observation_status":"present","provenance":"QUOTED","value_integer":12},
    {"field_key":"county_name","observation_status":"unknown","provenance":"QUOTED"},
    {"field_key":"zip_code","observation_status":"present","provenance":"QUOTED","value_text":"33401"}
  ]
  $json$::jsonb
);

SELECT ok(
  (
    SELECT created AND extraction_id IS NOT NULL
    FROM public.wm_persist_quote_intelligence_extraction(
      (SELECT persist_sha FROM qi_persist_fixtures),
      'qi_pgtap_persist', 's1', 'p1',
      'test', 'test-model',
      '{"document_type":"contractor_quote"}'::jsonb,
      '{"contract_total_cents":120000}'::jsonb,
      '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
      (SELECT valid_obs FROM qi_persist_fixtures)
    )
  ),
  'persistence RPC creates extraction and observations atomically'
);

CREATE TEMP TABLE qi_zero_persist AS
SELECT *
FROM public.wm_persist_quote_intelligence_extraction(
  '0000000000000000000000000000000000000000000000000000000000000007',
  'qi_pgtap_zero', 's1', 'p1',
  'test', 'test-model',
  '{}'::jsonb, '{"contract_total_cents":0}'::jsonb,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
  (SELECT zero_cents_obs FROM qi_persist_fixtures)
);

SELECT ok(
  (SELECT created FROM qi_zero_persist)
  AND EXISTS (
    SELECT 1
    FROM public.wm_quote_intelligence_field_observations o
    JOIN public.wm_quote_intelligence_extractions e ON e.id = o.extraction_id
    WHERE e.module_key = 'qi_pgtap_zero'
      AND o.field_key = 'contract_total_cents'
      AND o.value_cents = 0
  ),
  'persistence RPC persists explicit zero cents as 0'
);

CREATE TEMP TABLE qi_unknown_money_persist AS
SELECT *
FROM public.wm_persist_quote_intelligence_extraction(
  '0000000000000000000000000000000000000000000000000000000000000008',
  'qi_pgtap_unknown_money', 's1', 'p1',
  'test', 'test-model',
  '{}'::jsonb, '{"contract_total_cents":null}'::jsonb,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
  (SELECT unknown_money_obs FROM qi_persist_fixtures)
);

SELECT ok(
  (SELECT created FROM qi_unknown_money_persist)
  AND EXISTS (
    SELECT 1
    FROM public.wm_quote_intelligence_field_observations o
    JOIN public.wm_quote_intelligence_extractions e ON e.id = o.extraction_id
    WHERE e.module_key = 'qi_pgtap_unknown_money'
      AND o.field_key = 'contract_total_cents'
      AND o.observation_status = 'unknown'
      AND o.value_cents IS NULL
  ),
  'persistence RPC keeps missing money unknown with NULL cents'
);

SELECT throws_ok(
  $$
  SELECT *
  FROM public.wm_persist_quote_intelligence_extraction(
    '0000000000000000000000000000000000000000000000000000000000000002',
    'qi_pgtap_rollback', 's1', 'p1',
    'test', 'test-model',
    '{}'::jsonb, '{}'::jsonb,
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    (
      SELECT jsonb_agg(
        CASE
          WHEN obs ->> 'field_key' = 'contract_total_cents'
            THEN (obs - 'value_cents') || '{"observation_status":"present"}'::jsonb
          ELSE obs
        END
      )
      FROM jsonb_array_elements((SELECT valid_obs FROM qi_persist_fixtures)) AS obs
    )
  )
  $$,
  '22023',
  'present observations require exactly one typed value for contract_total_cents',
  'invalid observation rolls back entire persistence transaction'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.wm_quote_intelligence_extractions e
    WHERE e.module_key = 'qi_pgtap_rollback'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.wm_quote_intelligence_field_observations o
    JOIN public.wm_quote_intelligence_extractions e ON e.id = o.extraction_id
    WHERE e.module_key = 'qi_pgtap_rollback'
  ),
  'failed observation insert leaves no orphan extraction'
);

CREATE TEMP TABLE qi_reuse_first AS
SELECT *
FROM public.wm_persist_quote_intelligence_extraction(
  '0000000000000000000000000000000000000000000000000000000000000003',
  'qi_pgtap_reuse', 's1', 'p1',
  'test', 'winner-model',
  '{"winner":true}'::jsonb,
  '{"contract_total_cents":120000}'::jsonb,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
  (SELECT valid_obs FROM qi_persist_fixtures)
);

CREATE TEMP TABLE qi_reuse_second AS
SELECT *
FROM public.wm_persist_quote_intelligence_extraction(
  '0000000000000000000000000000000000000000000000000000000000000003',
  'qi_pgtap_reuse', 's1', 'p1',
  'test', 'loser-model',
  '{"loser":true}'::jsonb,
  '{"contract_total_cents":999999}'::jsonb,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
  (SELECT valid_obs FROM qi_persist_fixtures)
);

SELECT ok(
  (SELECT created FROM qi_reuse_first)
  AND (SELECT NOT created FROM qi_reuse_second)
  AND (SELECT extraction_id FROM qi_reuse_second)
    = (SELECT extraction_id FROM qi_reuse_first),
  'duplicate identical identity reuses existing extraction'
);

SELECT ok(
  (
    SELECT runtime_model_id = 'winner-model'
      AND validated_payload = '{"winner":true}'::jsonb
    FROM public.wm_quote_intelligence_extractions
    WHERE module_key = 'qi_pgtap_reuse'
  ),
  'duplicate persistence call does not rewrite immutable extraction payload'
);

SELECT ok(
  (
    SELECT COUNT(*) = 8
    FROM public.wm_quote_intelligence_field_observations o
    JOIN public.wm_quote_intelligence_extractions e ON e.id = o.extraction_id
    WHERE e.module_key = 'qi_pgtap_reuse'
  ),
  'reuse does not duplicate observations'
);

SELECT throws_ok(
  $$
  SELECT *
  FROM public.wm_persist_quote_intelligence_extraction(
    '0000000000000000000000000000000000000000000000000000000000000004',
    'qi_pgtap_bad_prov', 's1', 'p1',
    'test', 'test-model',
    '{}'::jsonb, '{}'::jsonb,
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    (
      SELECT jsonb_agg(
        CASE
          WHEN obs ->> 'field_key' = 'county_name'
            THEN obs || '{"provenance":"VERIFIED_SOLD"}'::jsonb
          ELSE obs
        END
      )
      FROM jsonb_array_elements((SELECT valid_obs FROM qi_persist_fixtures)) AS obs
    )
  )
  $$,
  '22023',
  'provenance must be QUOTED for county_name',
  'persistence RPC rejects wrong provenance'
);

SELECT throws_ok(
  $$
  SELECT *
  FROM public.wm_persist_quote_intelligence_extraction(
    '0000000000000000000000000000000000000000000000000000000000000005',
    'qi_pgtap_bad_typed', 's1', 'p1',
    'test', 'test-model',
    '{}'::jsonb, '{}'::jsonb,
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    (
      SELECT jsonb_agg(
        CASE
          WHEN obs ->> 'field_key' = 'total_openings'
            THEN obs || '{"value_boolean":true}'::jsonb
          ELSE obs
        END
      )
      FROM jsonb_array_elements((SELECT valid_obs FROM qi_persist_fixtures)) AS obs
    )
  )
  $$,
  '22023',
  'at most one typed value may be set for total_openings',
  'persistence RPC rejects malformed typed observation'
);

SELECT throws_ok(
  $$
  SELECT *
  FROM public.wm_persist_quote_intelligence_extraction(
    '0000000000000000000000000000000000000000000000000000000000000006',
    'qi_pgtap_bad_key', 's1', 'p1',
    'test', 'test-model',
    '{}'::jsonb, '{}'::jsonb,
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
    (
      SELECT jsonb_agg(
        CASE
          WHEN obs ->> 'field_key' = 'zip_code'
            THEN obs || '{"field_key":"opening_count"}'::jsonb
          ELSE obs
        END
      )
      FROM jsonb_array_elements((SELECT valid_obs FROM qi_persist_fixtures)) AS obs
    )
  )
  $$,
  '22023',
  'unsupported field_key: opening_count',
  'persistence RPC rejects unsupported V1 field key'
);

-- Discovery / enqueue V1 fixtures (synthetic; rolled back with transaction).
CREATE TEMP TABLE qi_discovery_ctx (
  eligible_quote_file_id_1 uuid,
  eligible_quote_file_id_2 uuid,
  failed_quote_file_id uuid,
  orphan_quote_file_id uuid,
  preexisting_job_quote_file_id uuid
);

INSERT INTO qi_discovery_ctx DEFAULT VALUES;

INSERT INTO public.quote_files (storage_path)
VALUES
  ('qi-discovery/eligible-1.pdf'),
  ('qi-discovery/eligible-2.pdf'),
  ('qi-discovery/failed.pdf'),
  ('qi-discovery/orphan.pdf'),
  ('qi-discovery/preexisting.pdf');

UPDATE qi_discovery_ctx
SET
  eligible_quote_file_id_1 = q1.id,
  eligible_quote_file_id_2 = q2.id,
  failed_quote_file_id = q3.id,
  orphan_quote_file_id = q4.id,
  preexisting_job_quote_file_id = q5.id
FROM public.quote_files q1
JOIN public.quote_files q2 ON q2.storage_path = 'qi-discovery/eligible-2.pdf'
JOIN public.quote_files q3 ON q3.storage_path = 'qi-discovery/failed.pdf'
JOIN public.quote_files q4 ON q4.storage_path = 'qi-discovery/orphan.pdf'
JOIN public.quote_files q5 ON q5.storage_path = 'qi-discovery/preexisting.pdf'
WHERE q1.storage_path = 'qi-discovery/eligible-1.pdf';

INSERT INTO public.scan_sessions (quote_file_id, status)
SELECT eligible_quote_file_id_1, 'preview_ready' FROM qi_discovery_ctx
UNION ALL
SELECT eligible_quote_file_id_2, 'awaiting_verification' FROM qi_discovery_ctx
UNION ALL
SELECT failed_quote_file_id, 'preview_ready' FROM qi_discovery_ctx
UNION ALL
SELECT preexisting_job_quote_file_id, 'revealed' FROM qi_discovery_ctx;

INSERT INTO public.analyses (scan_session_id, analysis_status)
SELECT ss.id, 'complete'
FROM public.scan_sessions ss
WHERE ss.quote_file_id IN (
  SELECT eligible_quote_file_id_1 FROM qi_discovery_ctx
  UNION ALL SELECT eligible_quote_file_id_2 FROM qi_discovery_ctx
  UNION ALL SELECT preexisting_job_quote_file_id FROM qi_discovery_ctx
);

INSERT INTO public.analyses (scan_session_id, analysis_status)
SELECT ss.id, 'failed'
FROM public.scan_sessions ss
WHERE ss.quote_file_id = (SELECT failed_quote_file_id FROM qi_discovery_ctx);

INSERT INTO public.wm_quote_intelligence_jobs (
  quote_file_id, module_key, schema_version, prompt_version
)
SELECT preexisting_job_quote_file_id, 'quote_document_header', 'v1', 'p1'
FROM qi_discovery_ctx;

WITH first_run AS (
  SELECT *
  FROM public.wm_discover_quote_intelligence_jobs(
    1000, 'quote_document_header', 'v1', 'p1'
  )
)
SELECT ok(
  (
    SELECT jobs_created >= 2
      AND jobs_already_present >= 1
      AND eligible_candidates >= 3
    FROM first_run
  ),
  'first discovery creates pending jobs for eligible quotes and counts preexisting job'
);

SELECT ok(
  (
    SELECT COUNT(*) = 3
    FROM public.wm_quote_intelligence_jobs
    WHERE module_key = 'quote_document_header'
      AND schema_version = 'v1'
      AND prompt_version = 'p1'
      AND quote_file_id IN (
        SELECT eligible_quote_file_id_1 FROM qi_discovery_ctx
        UNION ALL SELECT eligible_quote_file_id_2 FROM qi_discovery_ctx
        UNION ALL SELECT preexisting_job_quote_file_id FROM qi_discovery_ctx
      )
  ),
  'eligible retained quotes plus preexisting fixture yield three V1 jobs total'
);

WITH second_run AS (
  SELECT *
  FROM public.wm_discover_quote_intelligence_jobs(
    1000, 'quote_document_header', 'v1', 'p1'
  )
)
SELECT ok(
  (
    SELECT jobs_created = 0
      AND jobs_already_present >= 3
    FROM second_run
  ),
  'repeated discovery is idempotent and creates no duplicate jobs'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.wm_quote_intelligence_jobs j
    WHERE j.quote_file_id = (SELECT failed_quote_file_id FROM qi_discovery_ctx)
      AND j.module_key = 'quote_document_header'
      AND j.schema_version = 'v1'
      AND j.prompt_version = 'p1'
  ),
  'failed analysis quote creates no intelligence job'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.wm_quote_intelligence_jobs j
    WHERE j.quote_file_id = (SELECT orphan_quote_file_id FROM qi_discovery_ctx)
  ),
  'quote without canonical scan/analysis relationship creates no job'
);

SELECT *
FROM public.wm_discover_quote_intelligence_jobs(
  1000, 'quote_document_header', 'v1', 'p2'
);

SELECT ok(
  (
    SELECT COUNT(*)::integer
    FROM public.wm_quote_intelligence_jobs j
    WHERE j.module_key = 'quote_document_header'
      AND j.schema_version = 'v1'
      AND j.prompt_version = 'p2'
      AND j.status = 'pending'
  ) >= 3,
  'different prompt version is independently eligible and creates separate pending jobs'
);

SELECT ok(
  (
    SELECT j.quote_file_id = (SELECT eligible_quote_file_id_1 FROM qi_discovery_ctx)
      AND j.scan_session_id IS NOT NULL
      AND j.analysis_id IS NOT NULL
      AND j.module_key = 'quote_document_header'
      AND j.schema_version = 'v1'
      AND j.prompt_version = 'p1'
      AND j.status = 'pending'
      AND j.attempt_count = 0
    FROM public.wm_quote_intelligence_jobs j
    WHERE j.quote_file_id = (SELECT eligible_quote_file_id_1 FROM qi_discovery_ctx)
      AND j.prompt_version = 'p1'
  ),
  'created job carries provenance FKs and frozen V1 identity with pending status'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.wm_claim_quote_intelligence_jobs(10, 'qi-discovery-worker', 300) c
    WHERE c.quote_file_id = (SELECT eligible_quote_file_id_2 FROM qi_discovery_ctx)
      AND c.module_key = 'quote_document_header'
      AND c.schema_version = 'v1'
      AND c.prompt_version = 'p1'
      AND c.status = 'processing'
      AND c.attempt_count = 1
  ),
  'discovery-created pending job is claimable by existing worker claim RPC'
);

SELECT * FROM finish();

ROLLBACK;
