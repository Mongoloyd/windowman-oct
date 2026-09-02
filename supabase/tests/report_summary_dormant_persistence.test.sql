-- pgTAP for 20260902193000_report_summary_dormant_persistence_v1.sql
-- plus 20260902200000_fix_report_summary_claim_token_ambiguity.sql
-- plus 20260902210000_fix_report_summary_candidate_starvation.sql
-- Run: npx supabase test db supabase/tests/report_summary_dormant_persistence.test.sql --local

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(42);

SELECT has_table('public', 'wm_report_summaries', 'summaries table exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'wm_report_summaries'),
  'summaries RLS enabled'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.wm_report_summaries', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.wm_report_summaries', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.wm_report_summaries', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.wm_report_summaries', 'INSERT'),
  'browser roles cannot read or write summaries'
);

SELECT ok(
  has_table_privilege('service_role', 'public.wm_report_summaries', 'SELECT'),
  'service_role can SELECT summaries'
);

SELECT has_index(
  'public', 'wm_report_summaries', 'wm_report_summaries_identity_key',
  'summary identity unique exists'
);

SELECT has_function(
  'public', 'wm_pick_report_summary_candidate', ARRAY['text'],
  'pick candidate RPC exists'
);
SELECT has_function(
  'public', 'wm_claim_report_summary_generation',
  ARRAY['uuid', 'text', 'text', 'text', 'integer'],
  'claim RPC exists'
);
SELECT has_function(
  'public', 'wm_complete_report_summary',
  ARRAY['uuid', 'uuid', 'text', 'uuid', 'text', 'jsonb', 'text', 'text'],
  'complete RPC exists'
);

SELECT ok(
  NOT has_function_privilege(
    'anon', 'public.wm_pick_report_summary_candidate(text)', 'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated', 'public.wm_pick_report_summary_candidate(text)', 'EXECUTE'
  ),
  'browser roles cannot execute pick candidate RPC'
);

SELECT ok(
  has_function_privilege(
    'service_role', 'public.wm_pick_report_summary_candidate(text)', 'EXECUTE'
  ),
  'service_role can execute pick candidate RPC'
);

SELECT ok(
  (
    SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'wm_report_summaries'
      AND c.conname = 'wm_report_summaries_status_check'
  ) LIKE '%ready%'
  AND (
    SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'wm_report_summaries'
      AND c.conname = 'wm_report_summaries_status_check'
  ) LIKE '%insufficient_facts%'
  AND (
    SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'wm_report_summaries'
      AND c.conname = 'wm_report_summaries_status_check'
  ) LIKE '%failed%',
  'status check includes ready, insufficient_facts, failed'
);

SELECT ok(
  (
    SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'wm_report_summaries'
      AND c.conname = 'wm_report_summaries_identity_key'
  ) LIKE '%analysis_id%'
  AND (
    SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'wm_report_summaries'
      AND c.conname = 'wm_report_summaries_identity_key'
  ) LIKE '%prompt_version%'
  AND (
    SELECT pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'wm_report_summaries'
      AND c.conname = 'wm_report_summaries_identity_key'
  ) LIKE '%input_pack_hash%',
  'identity unique covers analysis_id + prompt_version + input_pack_hash'
);

SELECT ok(
  (
    SELECT COUNT(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wm_report_summaries'
      AND roles::text LIKE '%service_role%'
  ) >= 1,
  'service_role policy exists on summaries'
);

SELECT ok(
  (
    SELECT obj_description(c.oid, 'pg_class')
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'wm_report_summaries'
  ) LIKE '%not reveal authority%',
  'table comment documents non-authority semantics'
);

SELECT ok(
  (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'wm_complete_report_summary'
  ) LIKE '%s.analysis_id = p_analysis_id%',
  'complete RPC binds writes to exact analysis_id'
);

SELECT ok(
  (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'wm_complete_report_summary'
  ) LIKE '%s.claim_token = p_claim_token%',
  'complete RPC requires claim_token CAS'
);

SELECT ok(
  (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'wm_pick_report_summary_candidate'
  ) LIKE '%FOR UPDATE%SKIP LOCKED%',
  'pick candidate uses SKIP LOCKED'
);

SELECT ok(
  (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'wm_pick_report_summary_candidate'
  ) LIKE '%LIMIT 1%',
  'pick candidate returns at most one analysis'
);

SELECT is(
  pg_get_function_identity_arguments(
    to_regprocedure(
      'public.wm_claim_report_summary_generation(uuid,text,text,text,integer)'
    )
  ),
  'p_analysis_id uuid, p_prompt_version text, p_input_pack_hash text, p_worker_id text, p_lease_seconds integer',
  'claim RPC arguments remain unchanged'
);

SELECT is(
  pg_get_function_result(
    to_regprocedure(
      'public.wm_claim_report_summary_generation(uuid,text,text,text,integer)'
    )
  ),
  'TABLE(summary_id uuid, claim_token uuid, prior_status text, already_terminal boolean)',
  'claim RPC return shape remains unchanged'
);

SELECT ok(
  (
    SELECT p.prosecdef
    FROM pg_proc p
    WHERE p.oid = to_regprocedure(
      'public.wm_claim_report_summary_generation(uuid,text,text,text,integer)'
    )
  ),
  'claim RPC remains SECURITY DEFINER'
);

SELECT ok(
  (
    SELECT 'search_path=public' = ANY(COALESCE(p.proconfig, ARRAY[]::text[]))
    FROM pg_proc p
    WHERE p.oid = to_regprocedure(
      'public.wm_claim_report_summary_generation(uuid,text,text,text,integer)'
    )
  ),
  'claim RPC keeps SET search_path = public'
);

SELECT ok(
  (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'wm_claim_report_summary_generation'
  ) LIKE '%RETURNING ins.id, ins.claim_token%',
  'first-insert RETURNING qualifies persisted claim_token via INSERT alias'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.wm_claim_report_summary_generation(uuid,text,text,text,integer)',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.wm_claim_report_summary_generation(uuid,text,text,text,integer)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'service_role',
    'public.wm_claim_report_summary_generation(uuid,text,text,text,integer)',
    'EXECUTE'
  ),
  'claim RPC execute remains service_role only'
);

-- Behavioral claim fixtures (rolled back with this transaction).
INSERT INTO public.clients (slug, name, is_active)
VALUES ('direct', 'Direct / Organic', false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.leads (id, session_id, client_slug, status, funnel_stage)
VALUES (
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'pgtap-summary-claim-lead-a',
  'direct',
  'new',
  'intake'
);

INSERT INTO public.scan_sessions (id, lead_id)
VALUES
  (
    'a2000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    'a2000000-0000-4000-8000-000000000002'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid
  );

INSERT INTO public.analyses (id, lead_id, scan_session_id, analysis_status)
VALUES
  (
    'a3000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'a2000000-0000-4000-8000-000000000001'::uuid,
    'complete'
  ),
  (
    'a3000000-0000-4000-8000-000000000002'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'a2000000-0000-4000-8000-000000000002'::uuid,
    'complete'
  );

CREATE TEMP TABLE claim_first (
  summary_id uuid,
  claim_token uuid,
  prior_status text,
  already_terminal boolean
);

SELECT lives_ok(
  $$
  INSERT INTO claim_first
  SELECT *
  FROM public.wm_claim_report_summary_generation(
    'a3000000-0000-4000-8000-000000000001'::uuid,
    'pgtap_claim_ambiguity_p1',
    repeat('ab', 32),
    'pgtap-worker-1',
    300
  )
  $$,
  'first claim on empty identity does not raise claim_token ambiguity'
);

SELECT ok(
  (
    SELECT COUNT(*) = 1
      AND bool_and(status = 'processing')
      AND bool_and(attempt_count = 1)
      AND bool_and(worker_id = 'pgtap-worker-1')
      AND bool_and(claim_token IS NOT NULL)
      AND bool_and(lease_expires_at IS NOT NULL)
    FROM public.wm_report_summaries
    WHERE analysis_id = 'a3000000-0000-4000-8000-000000000001'::uuid
      AND prompt_version = 'pgtap_claim_ambiguity_p1'
      AND input_pack_hash = repeat('ab', 32)
  )
  AND (
    SELECT COUNT(*) = 1
      AND bool_and(summary_id IS NOT NULL)
      AND bool_and(claim_token IS NOT NULL)
      AND bool_and(already_terminal IS FALSE)
      AND bool_and(prior_status IS NULL)
    FROM claim_first
  )
  AND (
    SELECT c.summary_id = s.id AND c.claim_token = s.claim_token
    FROM claim_first c
    JOIN public.wm_report_summaries s
      ON s.id = c.summary_id
  ),
  'first claim creates one processing row and returns summary_id plus claim_token'
);

UPDATE public.wm_report_summaries
SET
  status = 'ready',
  summary_json = '{"status":"ready"}'::jsonb,
  generated_at = now(),
  lease_expires_at = NULL
WHERE analysis_id = 'a3000000-0000-4000-8000-000000000001'::uuid
  AND prompt_version = 'pgtap_claim_ambiguity_p1'
  AND input_pack_hash = repeat('ab', 32);

CREATE TEMP TABLE claim_ready AS
SELECT *
FROM public.wm_claim_report_summary_generation(
  'a3000000-0000-4000-8000-000000000001'::uuid,
  'pgtap_claim_ambiguity_p1',
  repeat('ab', 32),
  'pgtap-worker-2',
  300
);

SELECT ok(
  (
    SELECT COUNT(*) = 1
      AND bool_and(already_terminal IS TRUE)
      AND bool_and(prior_status = 'ready')
      AND bool_and(summary_id = (SELECT summary_id FROM claim_first))
      AND bool_and(claim_token = (SELECT claim_token FROM claim_first))
    FROM claim_ready
  )
  AND (
    SELECT COUNT(*) = 1
      AND bool_and(status = 'ready')
      AND bool_and(attempt_count = 1)
      AND bool_and(worker_id = 'pgtap-worker-1')
    FROM public.wm_report_summaries
    WHERE analysis_id = 'a3000000-0000-4000-8000-000000000001'::uuid
      AND prompt_version = 'pgtap_claim_ambiguity_p1'
      AND input_pack_hash = repeat('ab', 32)
  ),
  'ready identity remains idempotent and does not rotate claim or increment attempts'
);

CREATE TEMP TABLE claim_insufficient_first (
  summary_id uuid,
  claim_token uuid,
  prior_status text,
  already_terminal boolean
);

INSERT INTO claim_insufficient_first
SELECT *
FROM public.wm_claim_report_summary_generation(
  'a3000000-0000-4000-8000-000000000001'::uuid,
  'pgtap_claim_ambiguity_p1',
  repeat('ef', 32),
  'pgtap-worker-1',
  300
);

UPDATE public.wm_report_summaries
SET
  status = 'insufficient_facts',
  lease_expires_at = NULL
WHERE analysis_id = 'a3000000-0000-4000-8000-000000000001'::uuid
  AND prompt_version = 'pgtap_claim_ambiguity_p1'
  AND input_pack_hash = repeat('ef', 32);

CREATE TEMP TABLE claim_insufficient AS
SELECT *
FROM public.wm_claim_report_summary_generation(
  'a3000000-0000-4000-8000-000000000001'::uuid,
  'pgtap_claim_ambiguity_p1',
  repeat('ef', 32),
  'pgtap-worker-2',
  300
);

SELECT ok(
  (
    SELECT COUNT(*) = 1
      AND bool_and(already_terminal IS TRUE)
      AND bool_and(prior_status = 'insufficient_facts')
    FROM claim_insufficient
  )
  AND (
    SELECT COUNT(*) = 1
      AND bool_and(status = 'insufficient_facts')
      AND bool_and(attempt_count = 1)
      AND bool_and(worker_id = 'pgtap-worker-1')
    FROM public.wm_report_summaries
    WHERE analysis_id = 'a3000000-0000-4000-8000-000000000001'::uuid
      AND prompt_version = 'pgtap_claim_ambiguity_p1'
      AND input_pack_hash = repeat('ef', 32)
  ),
  'insufficient_facts identity remains idempotent'
);

CREATE TEMP TABLE claim_b_first (
  summary_id uuid,
  claim_token uuid,
  prior_status text,
  already_terminal boolean
);

INSERT INTO claim_b_first
SELECT *
FROM public.wm_claim_report_summary_generation(
  'a3000000-0000-4000-8000-000000000002'::uuid,
  'pgtap_claim_ambiguity_p1',
  repeat('cd', 32),
  'pgtap-worker-1',
  300
);

CREATE TEMP TABLE claim_b_competitor (
  summary_id uuid,
  claim_token uuid,
  prior_status text,
  already_terminal boolean
);

INSERT INTO claim_b_competitor
SELECT *
FROM public.wm_claim_report_summary_generation(
  'a3000000-0000-4000-8000-000000000002'::uuid,
  'pgtap_claim_ambiguity_p1',
  repeat('cd', 32),
  'pgtap-worker-2',
  300
);

SELECT ok(
  (SELECT COUNT(*) FROM claim_b_first) = 1
  AND (SELECT COUNT(*) FROM claim_b_competitor) = 0
  AND (
    SELECT COUNT(*) = 1
      AND bool_and(worker_id = 'pgtap-worker-1')
      AND bool_and(attempt_count = 1)
      AND bool_and(claim_token = (SELECT claim_token FROM claim_b_first))
    FROM public.wm_report_summaries
    WHERE analysis_id = 'a3000000-0000-4000-8000-000000000002'::uuid
      AND prompt_version = 'pgtap_claim_ambiguity_p1'
      AND input_pack_hash = repeat('cd', 32)
  ),
  'active competing lease cannot steal a live claim'
);

UPDATE public.wm_report_summaries
SET lease_expires_at = now() - interval '1 second'
WHERE analysis_id = 'a3000000-0000-4000-8000-000000000002'::uuid
  AND prompt_version = 'pgtap_claim_ambiguity_p1'
  AND input_pack_hash = repeat('cd', 32);

CREATE TEMP TABLE claim_b_reclaim AS
SELECT *
FROM public.wm_claim_report_summary_generation(
  'a3000000-0000-4000-8000-000000000002'::uuid,
  'pgtap_claim_ambiguity_p1',
  repeat('cd', 32),
  'pgtap-worker-2',
  300
);

SELECT ok(
  (
    SELECT COUNT(*) = 1
      AND bool_and(summary_id = (SELECT summary_id FROM claim_b_first))
      AND bool_and(claim_token IS NOT NULL)
      AND bool_and(claim_token IS DISTINCT FROM (SELECT claim_token FROM claim_b_first))
      AND bool_and(already_terminal IS FALSE)
    FROM claim_b_reclaim
  )
  AND (
    SELECT COUNT(*) = 1
      AND bool_and(worker_id = 'pgtap-worker-2')
      AND bool_and(attempt_count = 2)
      AND bool_and(status = 'processing')
      AND bool_and(claim_token = (SELECT claim_token FROM claim_b_reclaim))
    FROM public.wm_report_summaries
    WHERE analysis_id = 'a3000000-0000-4000-8000-000000000002'::uuid
      AND prompt_version = 'pgtap_claim_ambiguity_p1'
      AND input_pack_hash = repeat('cd', 32)
  ),
  'expired lease reclaim returns a new claim_token and transfers ownership'
);

SELECT ok(
  (
    SELECT COUNT(*) = 2
    FROM public.wm_report_summaries
    WHERE analysis_id = 'a3000000-0000-4000-8000-000000000001'::uuid
      AND prompt_version = 'pgtap_claim_ambiguity_p1'
  )
  AND (
    SELECT COUNT(*) = 1
      AND bool_and(status = 'ready')
      AND bool_and(attempt_count = 1)
      AND bool_and(worker_id = 'pgtap-worker-1')
      AND bool_and(claim_token = (SELECT claim_token FROM claim_first))
    FROM public.wm_report_summaries
    WHERE analysis_id = 'a3000000-0000-4000-8000-000000000001'::uuid
      AND prompt_version = 'pgtap_claim_ambiguity_p1'
      AND input_pack_hash = repeat('ab', 32)
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.wm_report_summaries
    WHERE analysis_id = 'a3000000-0000-4000-8000-000000000002'::uuid
      AND (
        prompt_version IS DISTINCT FROM 'pgtap_claim_ambiguity_p1'
        OR input_pack_hash IS DISTINCT FROM repeat('cd', 32)
      )
  ),
  'claim for analysis B never mutates analysis A summary rows'
);

-- ---------------------------------------------------------------------------
-- Candidate picker starvation regressions (Option B freshness)
-- ---------------------------------------------------------------------------

INSERT INTO public.scan_sessions (id, lead_id)
VALUES
  (
    'b2000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    'b2000000-0000-4000-8000-000000000002'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    'b2000000-0000-4000-8000-000000000003'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    'b2000000-0000-4000-8000-000000000004'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    'b2000000-0000-4000-8000-000000000005'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    'b2000000-0000-4000-8000-000000000006'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    'b2000000-0000-4000-8000-000000000007'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    'b2000000-0000-4000-8000-000000000008'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    'b2000000-0000-4000-8000-000000000009'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid
  ),
  (
    'b2000000-0000-4000-8000-00000000000a'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid
  );

INSERT INTO public.analyses (
  id,
  lead_id,
  scan_session_id,
  analysis_status,
  full_json,
  created_at,
  updated_at
)
VALUES
  (
    'b3000000-0000-4000-8000-000000000001'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'b2000000-0000-4000-8000-000000000001'::uuid,
    'complete',
    '{"picker":"a"}'::jsonb,
    '2026-01-01 00:00:01+00'::timestamptz,
    '2026-01-01 00:00:01+00'::timestamptz
  ),
  (
    'b3000000-0000-4000-8000-000000000002'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'b2000000-0000-4000-8000-000000000002'::uuid,
    'complete',
    '{"picker":"b"}'::jsonb,
    '2026-01-01 00:00:02+00'::timestamptz,
    '2026-01-01 00:00:02+00'::timestamptz
  ),
  (
    'b3000000-0000-4000-8000-000000000003'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'b2000000-0000-4000-8000-000000000003'::uuid,
    'complete',
    '{"picker":"c"}'::jsonb,
    '2026-01-01 00:00:03+00'::timestamptz,
    '2026-01-01 00:00:03+00'::timestamptz
  ),
  (
    'b3000000-0000-4000-8000-000000000004'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'b2000000-0000-4000-8000-000000000004'::uuid,
    'complete',
    '{"picker":"d"}'::jsonb,
    '2026-01-01 00:00:04+00'::timestamptz,
    '2026-01-01 00:00:04+00'::timestamptz
  ),
  (
    'b3000000-0000-4000-8000-000000000005'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'b2000000-0000-4000-8000-000000000005'::uuid,
    'complete',
    '{"picker":"e"}'::jsonb,
    '2026-01-01 00:00:05+00'::timestamptz,
    '2026-01-01 00:00:05+00'::timestamptz
  ),
  (
    'b3000000-0000-4000-8000-000000000006'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'b2000000-0000-4000-8000-000000000006'::uuid,
    'complete',
    '{"picker":"f"}'::jsonb,
    '2026-01-01 00:00:06+00'::timestamptz,
    '2026-01-01 00:00:06+00'::timestamptz
  ),
  (
    'b3000000-0000-4000-8000-000000000007'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'b2000000-0000-4000-8000-000000000007'::uuid,
    'complete',
    '{"picker":"g"}'::jsonb,
    '2026-01-01 00:00:07+00'::timestamptz,
    '2026-01-01 00:00:07+00'::timestamptz
  ),
  (
    'b3000000-0000-4000-8000-000000000008'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'b2000000-0000-4000-8000-000000000008'::uuid,
    'complete',
    '{"picker":"h"}'::jsonb,
    '2026-01-01 00:00:08+00'::timestamptz,
    '2026-01-01 00:00:08+00'::timestamptz
  ),
  (
    'b3000000-0000-4000-8000-000000000009'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'b2000000-0000-4000-8000-000000000009'::uuid,
    'complete',
    '{"picker":"i"}'::jsonb,
    '2026-01-01 00:00:09+00'::timestamptz,
    '2026-01-01 00:00:09+00'::timestamptz
  ),
  (
    'b3000000-0000-4000-8000-00000000000a'::uuid,
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'b2000000-0000-4000-8000-00000000000a'::uuid,
    'complete',
    '{"picker":"j"}'::jsonb,
    '2026-01-01 00:00:10+00'::timestamptz,
    '2026-01-01 00:00:10+00'::timestamptz
  );

-- Isolate picker cases from earlier claim fixtures (those lack full_json).
UPDATE public.analyses
SET analysis_status = 'failed'
WHERE id IN (
  'a3000000-0000-4000-8000-000000000001'::uuid,
  'a3000000-0000-4000-8000-000000000002'::uuid
);

-- A. Basic unsummarized → A
SELECT is(
  (
    SELECT analysis_id::text
    FROM public.wm_pick_report_summary_candidate('pgtap_picker_starvation_p1')
  ),
  'b3000000-0000-4000-8000-000000000001',
  'A: unsummarized complete analysis remains eligible'
);

-- B. Ready starvation: A ready current, B eligible → B
INSERT INTO public.wm_report_summaries (
  analysis_id,
  prompt_version,
  input_pack_hash,
  status,
  summary_json,
  generated_at,
  attempt_count,
  created_at,
  updated_at
)
VALUES (
  'b3000000-0000-4000-8000-000000000001'::uuid,
  'pgtap_picker_starvation_p1',
  repeat('11', 32),
  'ready',
  '{"status":"ready"}'::jsonb,
  '2026-01-01 00:00:01.5+00'::timestamptz,
  1,
  '2026-01-01 00:00:01.5+00'::timestamptz,
  '2026-01-01 00:00:01.5+00'::timestamptz
);

SELECT is(
  (
    SELECT analysis_id::text
    FROM public.wm_pick_report_summary_candidate('pgtap_picker_starvation_p1')
  ),
  'b3000000-0000-4000-8000-000000000002',
  'B: current ready summary does not starve the next eligible analysis'
);

-- C. insufficient_facts starvation: B blocked, C eligible → C
INSERT INTO public.wm_report_summaries (
  analysis_id,
  prompt_version,
  input_pack_hash,
  status,
  summary_json,
  generated_at,
  attempt_count,
  created_at,
  updated_at
)
VALUES (
  'b3000000-0000-4000-8000-000000000002'::uuid,
  'pgtap_picker_starvation_p1',
  repeat('22', 32),
  'insufficient_facts',
  '{"status":"insufficient_facts"}'::jsonb,
  '2026-01-01 00:00:02.5+00'::timestamptz,
  1,
  '2026-01-01 00:00:02.5+00'::timestamptz,
  '2026-01-01 00:00:02.5+00'::timestamptz
);

SELECT is(
  (
    SELECT analysis_id::text
    FROM public.wm_pick_report_summary_candidate('pgtap_picker_starvation_p1')
  ),
  'b3000000-0000-4000-8000-000000000003',
  'C: current insufficient_facts summary does not starve the queue'
);

-- D. Active lease on C, D eligible → D
INSERT INTO public.wm_report_summaries (
  analysis_id,
  prompt_version,
  input_pack_hash,
  status,
  worker_id,
  claim_token,
  claimed_at,
  lease_expires_at,
  attempt_count,
  created_at,
  updated_at
)
VALUES (
  'b3000000-0000-4000-8000-000000000003'::uuid,
  'pgtap_picker_starvation_p1',
  repeat('33', 32),
  'processing',
  'pgtap-picker-worker',
  'b4000000-0000-4000-8000-000000000003'::uuid,
  now(),
  now() + interval '5 minutes',
  1,
  '2026-01-01 00:00:03.5+00'::timestamptz,
  '2026-01-01 00:00:03.5+00'::timestamptz
);

SELECT is(
  (
    SELECT analysis_id::text
    FROM public.wm_pick_report_summary_candidate('pgtap_picker_starvation_p1')
  ),
  'b3000000-0000-4000-8000-000000000004',
  'D: active processing lease is skipped'
);

-- E. Expired lease on D remains recoverable
INSERT INTO public.wm_report_summaries (
  analysis_id,
  prompt_version,
  input_pack_hash,
  status,
  worker_id,
  claim_token,
  claimed_at,
  lease_expires_at,
  attempt_count,
  created_at,
  updated_at
)
VALUES (
  'b3000000-0000-4000-8000-000000000004'::uuid,
  'pgtap_picker_starvation_p1',
  repeat('44', 32),
  'processing',
  'pgtap-picker-worker',
  'b4000000-0000-4000-8000-000000000004'::uuid,
  now() - interval '10 minutes',
  now() - interval '1 second',
  1,
  '2026-01-01 00:00:04.5+00'::timestamptz,
  '2026-01-01 00:00:04.5+00'::timestamptz
);

SELECT is(
  (
    SELECT analysis_id::text
    FROM public.wm_pick_report_summary_candidate('pgtap_picker_starvation_p1')
  ),
  'b3000000-0000-4000-8000-000000000004',
  'E: expired processing lease remains eligible'
);

-- F. Retryable failure remains eligible (block D with current ready first)
UPDATE public.wm_report_summaries
SET
  status = 'ready',
  summary_json = '{"status":"ready"}'::jsonb,
  generated_at = '2026-01-01 00:00:04.5+00'::timestamptz,
  worker_id = NULL,
  claim_token = NULL,
  claimed_at = NULL,
  lease_expires_at = NULL
WHERE analysis_id = 'b3000000-0000-4000-8000-000000000004'::uuid
  AND prompt_version = 'pgtap_picker_starvation_p1'
  AND input_pack_hash = repeat('44', 32);

INSERT INTO public.wm_report_summaries (
  analysis_id,
  prompt_version,
  input_pack_hash,
  status,
  failure_class,
  attempt_count,
  max_attempts,
  created_at,
  updated_at
)
VALUES (
  'b3000000-0000-4000-8000-000000000005'::uuid,
  'pgtap_picker_starvation_p1',
  repeat('55', 32),
  'failed',
  'provider_timeout',
  2,
  5,
  '2026-01-01 00:00:05.5+00'::timestamptz,
  '2026-01-01 00:00:05.5+00'::timestamptz
);

SELECT is(
  (
    SELECT analysis_id::text
    FROM public.wm_pick_report_summary_candidate('pgtap_picker_starvation_p1')
  ),
  'b3000000-0000-4000-8000-000000000005',
  'F: retryable failed summary remains eligible'
);

-- G. Exhausted failure starvation: E blocked, F eligible → F
UPDATE public.wm_report_summaries
SET
  attempt_count = 5,
  max_attempts = 5,
  updated_at = '2026-01-01 00:00:05.5+00'::timestamptz
WHERE analysis_id = 'b3000000-0000-4000-8000-000000000005'::uuid
  AND prompt_version = 'pgtap_picker_starvation_p1'
  AND input_pack_hash = repeat('55', 32);

SELECT is(
  (
    SELECT analysis_id::text
    FROM public.wm_pick_report_summary_candidate('pgtap_picker_starvation_p1')
  ),
  'b3000000-0000-4000-8000-000000000006',
  'G: permanently exhausted failed summary does not starve the queue'
);

-- H. Old prompt version terminal does not block current prompt
INSERT INTO public.wm_report_summaries (
  analysis_id,
  prompt_version,
  input_pack_hash,
  status,
  summary_json,
  generated_at,
  attempt_count,
  created_at,
  updated_at
)
VALUES (
  'b3000000-0000-4000-8000-000000000006'::uuid,
  'pgtap_picker_starvation_old',
  repeat('66', 32),
  'ready',
  '{"status":"ready"}'::jsonb,
  '2026-01-01 00:00:06.5+00'::timestamptz,
  1,
  '2026-01-01 00:00:06.5+00'::timestamptz,
  '2026-01-01 00:00:06.5+00'::timestamptz
);

SELECT is(
  (
    SELECT analysis_id::text
    FROM public.wm_pick_report_summary_candidate('pgtap_picker_starvation_p1')
  ),
  'b3000000-0000-4000-8000-000000000006',
  'H: terminal summary for another prompt_version does not block current prompt'
);

-- I. Stale analysis after terminal summary becomes eligible again (Option B)
INSERT INTO public.wm_report_summaries (
  analysis_id,
  prompt_version,
  input_pack_hash,
  status,
  summary_json,
  generated_at,
  attempt_count,
  created_at,
  updated_at
)
VALUES (
  'b3000000-0000-4000-8000-000000000006'::uuid,
  'pgtap_picker_starvation_p1',
  repeat('67', 32),
  'ready',
  '{"status":"ready"}'::jsonb,
  '2026-01-01 00:00:06.5+00'::timestamptz,
  1,
  '2026-01-01 00:00:06.5+00'::timestamptz,
  '2026-01-01 00:00:06.5+00'::timestamptz
);

SELECT is(
  (
    SELECT analysis_id::text
    FROM public.wm_pick_report_summary_candidate('pgtap_picker_starvation_p1')
  ),
  'b3000000-0000-4000-8000-000000000007',
  'I-pre: current ready summary skips analysis until canonical update'
);

-- Bypass updated_at trigger so we can simulate a later canonical mutation with
-- a controlled timestamp (production path uses the same trigger → now()).
ALTER TABLE public.analyses DISABLE TRIGGER trg_analyses_updated_at;
UPDATE public.analyses
SET
  full_json = '{"picker":"i-stale"}'::jsonb,
  updated_at = '2026-01-01 00:00:06.75+00'::timestamptz
WHERE id = 'b3000000-0000-4000-8000-000000000006'::uuid;
ALTER TABLE public.analyses ENABLE TRIGGER trg_analyses_updated_at;

SELECT is(
  (
    SELECT analysis_id::text
    FROM public.wm_pick_report_summary_candidate('pgtap_picker_starvation_p1')
  ),
  'b3000000-0000-4000-8000-000000000006',
  'I: analysis updated after terminal summary becomes eligible again'
);

-- J. Among multiple eligible analyses, oldest wins.
-- Re-currentize 006, then force controlled timestamps on remaining eligibles.
INSERT INTO public.wm_report_summaries (
  analysis_id,
  prompt_version,
  input_pack_hash,
  status,
  summary_json,
  generated_at,
  attempt_count,
  created_at,
  updated_at
)
VALUES (
  'b3000000-0000-4000-8000-000000000006'::uuid,
  'pgtap_picker_starvation_p1',
  repeat('68', 32),
  'ready',
  '{"status":"ready"}'::jsonb,
  '2026-01-01 00:00:06.9+00'::timestamptz,
  1,
  '2026-01-01 00:00:06.9+00'::timestamptz,
  '2026-01-01 00:00:06.9+00'::timestamptz
);

ALTER TABLE public.analyses DISABLE TRIGGER trg_analyses_updated_at;
UPDATE public.analyses
SET
  updated_at = '2026-01-01 00:00:09+00'::timestamptz,
  created_at = '2026-01-01 00:00:09+00'::timestamptz
WHERE id = 'b3000000-0000-4000-8000-000000000007'::uuid;

UPDATE public.analyses
SET
  updated_at = '2026-01-01 00:00:10+00'::timestamptz,
  created_at = '2026-01-01 00:00:10+00'::timestamptz
WHERE id = 'b3000000-0000-4000-8000-000000000008'::uuid;

UPDATE public.analyses
SET
  updated_at = '2026-01-01 00:00:10.5+00'::timestamptz,
  created_at = '2026-01-01 00:00:10.5+00'::timestamptz
WHERE id = 'b3000000-0000-4000-8000-000000000009'::uuid;

UPDATE public.analyses
SET
  updated_at = '2026-01-01 00:00:11+00'::timestamptz,
  created_at = '2026-01-01 00:00:11+00'::timestamptz
WHERE id = 'b3000000-0000-4000-8000-00000000000a'::uuid;
ALTER TABLE public.analyses ENABLE TRIGGER trg_analyses_updated_at;

SELECT is(
  (
    SELECT analysis_id::text
    FROM public.wm_pick_report_summary_candidate('pgtap_picker_starvation_p1')
  ),
  'b3000000-0000-4000-8000-000000000007',
  'J: oldest eligible analysis wins among multiple candidates'
);

SELECT * FROM finish();
ROLLBACK;
