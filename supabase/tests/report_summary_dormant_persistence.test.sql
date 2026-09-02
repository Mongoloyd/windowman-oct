-- pgTAP for 20260902193000_report_summary_dormant_persistence_v1.sql
-- Run: npx supabase test db supabase/tests/report_summary_dormant_persistence.test.sql --local

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(18);

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

SELECT * FROM finish();
ROLLBACK;
