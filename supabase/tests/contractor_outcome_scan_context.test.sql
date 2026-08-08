-- pgTAP tests for 20260808180000_contractor_outcome_scan_context.sql
-- Run: npx supabase test db supabase/tests/contractor_outcome_scan_context.test.sql --local
--
-- Proves public.admin_contractor_outcome_integrity() derives scan_session_id
-- from the outcome's owning contractor opportunity
-- (contractor_outcomes.opportunity_id -> contractor_opportunities.scan_session_id)
-- instead of the nonexistent leads.latest_scan_session_id, while preserving the
-- return contract, internal-operator gate, grants, and privacy boundaries.

\set ON_ERROR_STOP on
\pset pager off

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

SELECT plan(36);

-- ---------------------------------------------------------------------------
-- 1. Function contract: signature, return shape, definition, security model
-- ---------------------------------------------------------------------------

SELECT ok(
  to_regprocedure('public.admin_contractor_outcome_integrity()') IS NOT NULL,
  'admin_contractor_outcome_integrity() exists with zero-argument signature'
);

SELECT is(
  pg_get_function_identity_arguments(
    to_regprocedure('public.admin_contractor_outcome_integrity()')
  ),
  '',
  'function takes no arguments'
);

SELECT is(
  pg_get_function_result(
    to_regprocedure('public.admin_contractor_outcome_integrity()')
  ),
  'TABLE(outcome_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, outcome_timestamp timestamp with time zone, opportunity_id uuid, lead_id uuid, scan_session_id uuid, analysis_id uuid, lead_assignment_id uuid, assignment_client_slug text, contractor_id uuid, contractor_account_id uuid, contractor_account_name text, contractor_account_client_slug text, contractor_company_name text, client_slug text, outcome_status text, sold_amount_cents integer, sold_amount numeric, sold_currency text, value_basis text, lost_reason text, lost_reason_code text, outcome_source text, outcome_verified boolean, outcome_verified_at timestamp with time zone, outcome_integrity_status text, outcome_integrity_reasons text[], eligible_for_future_signal boolean, safe_metadata jsonb)',
  'return columns, types, and column order are unchanged'
);

SELECT ok(
  pg_get_functiondef(
    to_regprocedure('public.admin_contractor_outcome_integrity()')
  ) NOT ILIKE '%latest_scan_session_id%',
  'installed definition no longer references latest_scan_session_id'
);

SELECT ok(
  pg_get_functiondef(
    to_regprocedure('public.admin_contractor_outcome_integrity()')
  ) ILIKE '%opp.scan_session_id AS scan_session_id%',
  'installed definition derives scan_session_id from the opportunity'
);

SELECT ok(
  (
    SELECT p.prosecdef
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = to_regprocedure('public.admin_contractor_outcome_integrity()')
  ),
  'function remains SECURITY DEFINER'
);

SELECT ok(
  (
    SELECT 'search_path=public' = ANY(COALESCE(p.proconfig, ARRAY[]::text[]))
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = to_regprocedure('public.admin_contractor_outcome_integrity()')
  ),
  'function keeps SET search_path = public'
);

SELECT ok(
  NOT has_function_privilege(
    'anon', 'public.admin_contractor_outcome_integrity()', 'EXECUTE'
  ),
  'anon is denied EXECUTE'
);

SELECT ok(
  NOT has_function_privilege(
    'public', 'public.admin_contractor_outcome_integrity()', 'EXECUTE'
  ),
  'PUBLIC is denied EXECUTE'
);

SELECT ok(
  has_function_privilege(
    'authenticated', 'public.admin_contractor_outcome_integrity()', 'EXECUTE'
  ),
  'authenticated keeps EXECUTE (gated inside by is_internal_operator)'
);

SELECT ok(
  has_function_privilege(
    'service_role', 'public.admin_contractor_outcome_integrity()', 'EXECUTE'
  ),
  'service_role keeps EXECUTE'
);

SELECT ok(
  (
    SELECT r NOT ILIKE '%full_json%'
       AND r NOT ILIKE '%email%'
       AND r NOT ILIKE '%phone%'
       AND r NOT ILIKE '%outcome_notes%'
       AND r NOT ILIKE '%outcome_metadata%'
    FROM pg_get_function_result(
      to_regprocedure('public.admin_contractor_outcome_integrity()')
    ) AS r
  ),
  'return contract adds no raw PII, full_json, notes, or raw metadata columns'
);

-- ---------------------------------------------------------------------------
-- 2. Fixtures
--    lead L1 -> scan sessions S1/S2 -> analyses A1/A2 -> opportunities O1/O2
--    -> outcomes X1 (sold) / X2 (lost), assignments LA1/LA2, account CA1,
--    contractor C1, tenant 'direct'
-- ---------------------------------------------------------------------------

INSERT INTO public.clients (slug, name, is_active)
VALUES ('direct', 'Direct / Organic', false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.leads (id, session_id, client_slug, status, funnel_stage)
VALUES (
  '1e000000-0000-0000-0000-000000000001'::uuid,
  'cosc-test-lead-1',
  'direct',
  'new',
  'intake'
);

INSERT INTO public.scan_sessions (id, lead_id)
VALUES
  ('5c000000-0000-0000-0000-000000000001'::uuid, '1e000000-0000-0000-0000-000000000001'::uuid),
  ('5c000000-0000-0000-0000-000000000002'::uuid, '1e000000-0000-0000-0000-000000000001'::uuid);

INSERT INTO public.analyses (id, lead_id, scan_session_id, analysis_status, created_at)
VALUES
  (
    'aa000000-0000-0000-0000-000000000001'::uuid,
    '1e000000-0000-0000-0000-000000000001'::uuid,
    '5c000000-0000-0000-0000-000000000001'::uuid,
    'complete',
    '2026-07-01 10:00:00+00'::timestamptz
  ),
  (
    'aa000000-0000-0000-0000-000000000002'::uuid,
    '1e000000-0000-0000-0000-000000000001'::uuid,
    '5c000000-0000-0000-0000-000000000002'::uuid,
    'complete',
    '2026-07-02 10:00:00+00'::timestamptz
  );

INSERT INTO public.contractors (id, company_name)
VALUES ('c0000000-0000-0000-0000-000000000001'::uuid, 'Sprint5 Contractor Co');

INSERT INTO public.contractor_accounts (id, client_slug, display_name)
VALUES (
  'ca000000-0000-0000-0000-000000000001'::uuid,
  'direct',
  'Sprint5 Test Account'
);

INSERT INTO public.lead_assignments (
  id, lead_id, scan_session_id, analysis_id, client_slug,
  contractor_account_id, is_current
)
VALUES
  (
    '1a000000-0000-0000-0000-000000000001'::uuid,
    '1e000000-0000-0000-0000-000000000001'::uuid,
    '5c000000-0000-0000-0000-000000000001'::uuid,
    'aa000000-0000-0000-0000-000000000001'::uuid,
    'direct',
    'ca000000-0000-0000-0000-000000000001'::uuid,
    true
  ),
  (
    '1a000000-0000-0000-0000-000000000002'::uuid,
    '1e000000-0000-0000-0000-000000000001'::uuid,
    '5c000000-0000-0000-0000-000000000002'::uuid,
    'aa000000-0000-0000-0000-000000000002'::uuid,
    'direct',
    'ca000000-0000-0000-0000-000000000001'::uuid,
    false
  );

INSERT INTO public.contractor_opportunities (id, lead_id, scan_session_id, analysis_id)
VALUES
  (
    '0b000000-0000-0000-0000-000000000001'::uuid,
    '1e000000-0000-0000-0000-000000000001'::uuid,
    '5c000000-0000-0000-0000-000000000001'::uuid,
    'aa000000-0000-0000-0000-000000000001'::uuid
  ),
  (
    '0b000000-0000-0000-0000-000000000002'::uuid,
    '1e000000-0000-0000-0000-000000000001'::uuid,
    '5c000000-0000-0000-0000-000000000002'::uuid,
    'aa000000-0000-0000-0000-000000000002'::uuid
  );

INSERT INTO public.contractor_outcomes (
  id, opportunity_id, lead_assignment_id, contractor_account_id, contractor_id,
  disposition_state, final_value_cents, value_basis, outcome_notes,
  disposition_reason_code, last_partner_action_at
)
VALUES
  (
    '0c000000-0000-0000-0000-000000000001'::uuid,
    '0b000000-0000-0000-0000-000000000001'::uuid,
    '1a000000-0000-0000-0000-000000000001'::uuid,
    'ca000000-0000-0000-0000-000000000001'::uuid,
    'c0000000-0000-0000-0000-000000000001'::uuid,
    'sold_closed',
    500000,
    'contract_total',
    'internal sold note that must never surface as lost_reason',
    NULL,
    '2026-08-01 10:00:00+00'::timestamptz
  ),
  (
    '0c000000-0000-0000-0000-000000000002'::uuid,
    '0b000000-0000-0000-0000-000000000002'::uuid,
    '1a000000-0000-0000-0000-000000000002'::uuid,
    'ca000000-0000-0000-0000-000000000001'::uuid,
    'c0000000-0000-0000-0000-000000000001'::uuid,
    'lost_dead',
    NULL,
    NULL,
    'homeowner chose competitor',
    'price_too_high',
    '2026-08-02 10:00:00+00'::timestamptz
  );

-- ---------------------------------------------------------------------------
-- 3. Behavior with internal-operator context
-- ---------------------------------------------------------------------------

SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"role":"admin"}}',
  true
);

SELECT is(
  (SELECT count(*) FROM public.admin_contractor_outcome_integrity()),
  2::bigint,
  'internal operator sees both seeded outcomes'
);

SELECT is(
  (
    SELECT r.scan_session_id
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  '5c000000-0000-0000-0000-000000000001'::uuid,
  'sold outcome returns the exact contractor_opportunities.scan_session_id'
);

SELECT ok(
  (
    SELECT r.scan_session_id = opp.scan_session_id
    FROM public.admin_contractor_outcome_integrity() AS r
    JOIN public.contractor_opportunities AS opp ON opp.id = r.opportunity_id
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  'scan_session_id matches the owning opportunity row exactly'
);

SELECT is(
  (
    SELECT r.scan_session_id
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000002'::uuid
  ),
  '5c000000-0000-0000-0000-000000000002'::uuid,
  'second outcome maps to its own opportunity scan session (no cross-contamination)'
);

SELECT is(
  (
    SELECT r.lead_id
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  '1e000000-0000-0000-0000-000000000001'::uuid,
  'lead context joined via the opportunity'
);

SELECT is(
  (
    SELECT r.analysis_id
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  'aa000000-0000-0000-0000-000000000001'::uuid,
  'analysis context joined via the opportunity'
);

SELECT is(
  (
    SELECT r.opportunity_id
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  '0b000000-0000-0000-0000-000000000001'::uuid,
  'opportunity context preserved'
);

SELECT is(
  (
    SELECT r.lead_assignment_id
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  '1a000000-0000-0000-0000-000000000001'::uuid,
  'assignment context preserved'
);

SELECT is(
  (
    SELECT r.assignment_client_slug
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  'direct',
  'assignment tenant slug preserved'
);

SELECT is(
  (
    SELECT r.contractor_account_name
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  'Sprint5 Test Account',
  'contractor account context preserved'
);

SELECT is(
  (
    SELECT r.contractor_company_name
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  'Sprint5 Contractor Co',
  'contractor context preserved'
);

SELECT is(
  (
    SELECT r.client_slug
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  'direct',
  'tenant/client resolution preserved'
);

SELECT is(
  (
    SELECT r.outcome_status
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  'sold_closed',
  'outcome status preserved'
);

SELECT is(
  (
    SELECT r.sold_amount_cents
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  500000,
  'revenue semantics preserved (sold_amount_cents)'
);

-- Note: 20260427181911 renamed the reason token to eligible_for_revenue_signal,
-- while this read model's eligible_for_future_signal output intentionally keeps
-- its historical predicate verbatim. We assert the current integrity
-- calculation still marks the fully-attributed sold outcome eligible.
SELECT ok(
  (
    SELECT 'eligible_for_revenue_signal' = ANY(r.outcome_integrity_reasons)
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  'fully-attributed sold outcome remains eligible in integrity reasons'
);

SELECT ok(
  (
    SELECT r.lost_reason IS NULL
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  'sold outcome notes are not exposed as lost_reason'
);

SELECT is(
  (
    SELECT r.lost_reason
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000002'::uuid
  ),
  'homeowner chose competitor',
  'lost outcome keeps its typed lost_reason exposure'
);

SELECT is(
  (
    SELECT r.lost_reason_code
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000002'::uuid
  ),
  'price_too_high',
  'lost_reason_code preserved'
);

SELECT is(
  (
    SELECT r.safe_metadata ->> 'revenue_truth_source'
    FROM public.admin_contractor_outcome_integrity() AS r
    WHERE r.outcome_id = '0c000000-0000-0000-0000-000000000001'::uuid
  ),
  'contractor_outcomes',
  'safe_metadata shape preserved'
);

SELECT results_eq(
  $sql$
  SELECT r.outcome_id
  FROM public.admin_contractor_outcome_integrity() AS r
  $sql$,
  ARRAY[
    '0c000000-0000-0000-0000-000000000002'::uuid,
    '0c000000-0000-0000-0000-000000000001'::uuid
  ],
  'ordering by outcome_timestamp DESC preserved'
);

-- ---------------------------------------------------------------------------
-- 4. Authorization gate
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claims', '', true);

SELECT is(
  (SELECT count(*) FROM public.admin_contractor_outcome_integrity()),
  0::bigint,
  'no JWT context returns zero rows'
);

SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"role":"homeowner"}}',
  true
);

SELECT is(
  (SELECT count(*) FROM public.admin_contractor_outcome_integrity()),
  0::bigint,
  'authenticated non-operator returns zero rows'
);

SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    v_count bigint;
  BEGIN
    PERFORM set_config(
      'request.jwt.claims',
      '{"role":"authenticated","app_metadata":{"role":"admin"}}',
      true
    );
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_count FROM public.admin_contractor_outcome_integrity();
    IF v_count IS DISTINCT FROM 2 THEN
      RAISE EXCEPTION 'authenticated operator expected 2 rows, got %', v_count;
    END IF;
    RESET ROLE;
  END;
  $do$;
  $sql$,
  'authenticated role with operator claims still receives rows'
);

SELECT throws_ok(
  $sql$
  SET LOCAL ROLE anon;
  SELECT * FROM public.admin_contractor_outcome_integrity();
  $sql$,
  '42501',
  NULL,
  'anon role cannot execute the function at all'
);

SELECT * FROM finish();

ROLLBACK;
