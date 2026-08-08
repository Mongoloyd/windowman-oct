-- pgTAP tests for 20260808170000_monotonic_latest_analysis_pointer_rpc.sql
-- Run: npx supabase test db supabase/tests/monotonic_latest_analysis_pointer.test.sql --local

\set ON_ERROR_STOP on
\pset pager off

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA extensions;

SELECT plan(41);

BEGIN;

INSERT INTO public.clients (slug, name, is_active)
VALUES ('direct', 'Direct / Organic', false)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.mlap_contract_ok()
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_oid oid;
  v_owner oid;
BEGIN
  v_oid := pg_catalog.to_regprocedure(
    'public.set_latest_complete_analysis_pointer(uuid,uuid)'
  );
  IF v_oid IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.proowner INTO v_owner
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = v_oid;

  IF pg_catalog.pg_get_function_identity_arguments(v_oid)
       <> 'p_lead_id uuid, p_analysis_id uuid'
     OR pg_catalog.pg_get_function_result(v_oid)
       <> 'TABLE(updated boolean, outcome text, latest_analysis_id uuid)'
     OR (SELECT p.prosecdef FROM pg_catalog.pg_proc AS p WHERE p.oid = v_oid)
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_proc AS p,
         pg_catalog.unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(value)
       WHERE p.oid = v_oid
         AND pg_catalog.split_part(cfg.value, '=', 1) = 'search_path'
         AND pg_catalog.btrim(pg_catalog.split_part(cfg.value, '=', 2), '"') = ''
     ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        (SELECT p.proacl FROM pg_catalog.pg_proc AS p WHERE p.oid = v_oid),
        pg_catalog.acldefault('f', v_owner)
      )
    ) AS acl
    LEFT JOIN pg_catalog.pg_roles AS role_grantee
      ON role_grantee.oid = acl.grantee
    WHERE acl.privilege_type = 'EXECUTE'
      AND acl.grantee <> v_owner
      AND COALESCE(role_grantee.rolname, 'PUBLIC') <> 'service_role'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        (SELECT p.proacl FROM pg_catalog.pg_proc AS p WHERE p.oid = v_oid),
        pg_catalog.acldefault('f', v_owner)
      )
    ) AS acl
    JOIN pg_catalog.pg_roles AS role_grantee
      ON role_grantee.oid = acl.grantee
    WHERE acl.privilege_type = 'EXECUTE'
      AND role_grantee.rolname = 'service_role'
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.mlap_seed_lead(
  p_lead_id uuid,
  p_session_id text,
  p_latest_analysis_id uuid DEFAULT NULL,
  p_funnel_stage text DEFAULT 'intake'
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.leads (
    id, session_id, client_slug, status, funnel_stage, latest_analysis_id
  ) VALUES (
    p_lead_id, p_session_id, 'direct', 'new', p_funnel_stage, p_latest_analysis_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.mlap_seed_analysis(
  p_analysis_id uuid,
  p_lead_id uuid,
  p_status text,
  p_created_at timestamptz DEFAULT pg_catalog.now()
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.analyses (
    id, lead_id, analysis_status, created_at
  ) VALUES (
    p_analysis_id, p_lead_id, p_status, p_created_at
  );
END;
$$;

SELECT ok(
  pg_temp.mlap_contract_ok(),
  'exact function signature, SECURITY INVOKER, empty search_path, and ACL contract'
);

SELECT ok(
  to_regprocedure('public.set_latest_complete_analysis_pointer(uuid,uuid)') IS NOT NULL,
  'set_latest_complete_analysis_pointer(uuid,uuid) exists'
);

SELECT ok(
  NOT (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure(
    'public.set_latest_complete_analysis_pointer(uuid,uuid)'
  )),
  'function is SECURITY INVOKER'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.set_latest_complete_analysis_pointer(uuid,uuid)',
    'EXECUTE'
  ),
  'service_role has EXECUTE'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.set_latest_complete_analysis_pointer(uuid,uuid)',
    'EXECUTE'
  ),
  'anon is denied EXECUTE'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.set_latest_complete_analysis_pointer(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated is denied EXECUTE'
);

SELECT ok(
  NOT has_function_privilege(
    'public',
    'public.set_latest_complete_analysis_pointer(uuid,uuid)',
    'EXECUTE'
  ),
  'PUBLIC is denied EXECUTE'
);

SELECT ok(
  has_table_privilege('service_role', 'public.leads', 'SELECT')
  AND has_table_privilege('service_role', 'public.leads', 'UPDATE'),
  'migration grants service_role SELECT and UPDATE on public.leads'
);

SELECT ok(
  has_table_privilege('service_role', 'public.analyses', 'SELECT')
  AND has_table_privilege('service_role', 'public.analyses', 'UPDATE'),
  'migration grants service_role SELECT and UPDATE on public.analyses'
);

-- Real invocation as service_role (trusted caller path)
SELECT pg_temp.mlap_seed_lead(
  'cb000000-0000-0000-0000-000000000001'::uuid,
  'mlap-test-service-role-lead'
);
SELECT pg_temp.mlap_seed_analysis(
  'ab000000-0000-0000-0000-000000000001'::uuid,
  'cb000000-0000-0000-0000-000000000001'::uuid,
  'complete'
);

SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    v_outcome text;
  BEGIN
    SET LOCAL ROLE service_role;
    SELECT r.outcome
      INTO v_outcome
    FROM public.set_latest_complete_analysis_pointer(
      'cb000000-0000-0000-0000-000000000001'::uuid,
      'ab000000-0000-0000-0000-000000000001'::uuid
    ) AS r;
    IF v_outcome IS DISTINCT FROM 'updated' THEN
      RAISE EXCEPTION 'service_role invocation unexpected outcome: %', v_outcome;
    END IF;
    RESET ROLE;
  END;
  $do$;
  $sql$,
  'service_role invocation succeeds under SET LOCAL ROLE'
);

SELECT is(
  (
    SELECT latest_analysis_id
    FROM public.leads
    WHERE id = 'cb000000-0000-0000-0000-000000000001'::uuid
  ),
  'ab000000-0000-0000-0000-000000000001'::uuid,
  'service_role invocation stamps latest_analysis_id'
);

-- Fixture ids
-- lead L1: c1000000-0000-0000-0000-000000000001
-- lead L2: c2000000-0000-0000-0000-000000000002
-- analysis A-old: a1000000-0000-0000-0000-000000000001
-- analysis A-new: a2000000-0000-0000-0000-000000000002

SELECT pg_temp.mlap_seed_lead(
  'c1000000-0000-0000-0000-000000000001'::uuid,
  'mlap-test-lead-1'
);
SELECT pg_temp.mlap_seed_analysis(
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'c1000000-0000-0000-0000-000000000001'::uuid,
  'complete',
  '2026-01-01 10:00:00+00'::timestamptz
);
SELECT pg_temp.mlap_seed_analysis(
  'a2000000-0000-0000-0000-000000000002'::uuid,
  'c1000000-0000-0000-0000-000000000001'::uuid,
  'complete',
  '2026-01-02 10:00:00+00'::timestamptz
);

SELECT is(
  (
    SELECT outcome
    FROM public.set_latest_complete_analysis_pointer(
      'c1000000-0000-0000-0000-000000000001'::uuid,
      'a1000000-0000-0000-0000-000000000001'::uuid
    )
  ),
  'updated',
  'null pointer accepts first valid completed candidate'
);

SELECT is(
  (
    SELECT latest_analysis_id
    FROM public.leads
    WHERE id = 'c1000000-0000-0000-0000-000000000001'::uuid
  ),
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'pointer stamped after null acceptance'
);

SELECT is(
  (
    SELECT outcome
    FROM public.set_latest_complete_analysis_pointer(
      'c1000000-0000-0000-0000-000000000001'::uuid,
      'a2000000-0000-0000-0000-000000000002'::uuid
    )
  ),
  'updated',
  'newer completed candidate replaces older pointer'
);

SELECT is(
  (
    SELECT outcome
    FROM public.set_latest_complete_analysis_pointer(
      'c1000000-0000-0000-0000-000000000001'::uuid,
      'a1000000-0000-0000-0000-000000000001'::uuid
    )
  ),
  'kept_newer',
  'older candidate is successful no-op'
);

SELECT is(
  (
    SELECT latest_analysis_id
    FROM public.leads
    WHERE id = 'c1000000-0000-0000-0000-000000000001'::uuid
  ),
  'a2000000-0000-0000-0000-000000000002'::uuid,
  'pointer unchanged after older candidate'
);

SELECT is(
  (
    SELECT outcome
    FROM public.set_latest_complete_analysis_pointer(
      'c1000000-0000-0000-0000-000000000001'::uuid,
      'a2000000-0000-0000-0000-000000000002'::uuid
    )
  ),
  'already_current',
  'repeating selected candidate returns already_current'
);

-- Equal created_at tie-break: higher id wins
SELECT pg_temp.mlap_seed_lead(
  'c1000000-0000-0000-0000-000000000099'::uuid,
  'mlap-test-tie-lead'
);
SELECT pg_temp.mlap_seed_analysis(
  'a1000000-0000-0000-0000-000000000099'::uuid,
  'c1000000-0000-0000-0000-000000000099'::uuid,
  'complete',
  '2026-03-01 12:00:00+00'::timestamptz
);
SELECT pg_temp.mlap_seed_analysis(
  'a2000000-0000-0000-0000-000000000099'::uuid,
  'c1000000-0000-0000-0000-000000000099'::uuid,
  'complete',
  '2026-03-01 12:00:00+00'::timestamptz
);

SELECT lives_ok(
  $sql$
  SELECT *
  FROM public.set_latest_complete_analysis_pointer(
    'c1000000-0000-0000-0000-000000000099'::uuid,
    'a1000000-0000-0000-0000-000000000099'::uuid
  )
  $sql$,
  'tie-break lower id accepted first'
);

SELECT is(
  (
    SELECT outcome
    FROM public.set_latest_complete_analysis_pointer(
      'c1000000-0000-0000-0000-000000000099'::uuid,
      'a2000000-0000-0000-0000-000000000099'::uuid
    )
  ),
  'updated',
  'equal created_at uses id DESC deterministically'
);

SELECT is(
  (
    SELECT latest_analysis_id
    FROM public.leads
    WHERE id = 'c1000000-0000-0000-0000-000000000099'::uuid
  ),
  'a2000000-0000-0000-0000-000000000099'::uuid,
  'tie-break selects higher analysis id'
);

-- Cross-lead rejection
SELECT pg_temp.mlap_seed_lead(
  'c2000000-0000-0000-0000-000000000002'::uuid,
  'mlap-test-lead-2'
);
SELECT pg_temp.mlap_seed_analysis(
  'a3000000-0000-0000-0000-000000000003'::uuid,
  'c2000000-0000-0000-0000-000000000002'::uuid,
  'complete'
);

SELECT throws_ok(
  $sql$
  SELECT *
  FROM public.set_latest_complete_analysis_pointer(
    'c1000000-0000-0000-0000-000000000001'::uuid,
    'a3000000-0000-0000-0000-000000000003'::uuid
  )
  $sql$,
  '22023',
  'analysis_lead_mismatch',
  'cross-lead candidate is rejected'
);

SELECT is(
  (
    SELECT latest_analysis_id
    FROM public.leads
    WHERE id = 'c1000000-0000-0000-0000-000000000001'::uuid
  ),
  'a2000000-0000-0000-0000-000000000002'::uuid,
  'cross-lead rejection leaves pointer unchanged'
);

-- Non-complete statuses
SELECT pg_temp.mlap_seed_lead(
  'c3000000-0000-0000-0000-000000000003'::uuid,
  'mlap-test-status-lead'
);
SELECT pg_temp.mlap_seed_analysis(
  'a4000000-0000-0000-0000-000000000004'::uuid,
  'c3000000-0000-0000-0000-000000000003'::uuid,
  'pending'
);
SELECT pg_temp.mlap_seed_analysis(
  'a4000000-0000-0000-0000-000000000005'::uuid,
  'c3000000-0000-0000-0000-000000000003'::uuid,
  'processing'
);
SELECT pg_temp.mlap_seed_analysis(
  'a4000000-0000-0000-0000-000000000006'::uuid,
  'c3000000-0000-0000-0000-000000000003'::uuid,
  'failed'
);
SELECT pg_temp.mlap_seed_analysis(
  'a4000000-0000-0000-0000-000000000007'::uuid,
  'c3000000-0000-0000-0000-000000000003'::uuid,
  'invalid_document'
);

SELECT throws_ok(
  $sql$
  SELECT * FROM public.set_latest_complete_analysis_pointer(
    'c3000000-0000-0000-0000-000000000003'::uuid,
    'a4000000-0000-0000-0000-000000000004'::uuid
  )
  $sql$,
  '22023',
  'analysis_not_complete',
  'pending candidate rejected'
);
SELECT throws_ok(
  $sql$
  SELECT * FROM public.set_latest_complete_analysis_pointer(
    'c3000000-0000-0000-0000-000000000003'::uuid,
    'a4000000-0000-0000-0000-000000000005'::uuid
  )
  $sql$,
  '22023',
  'analysis_not_complete',
  'processing candidate rejected'
);
SELECT throws_ok(
  $sql$
  SELECT * FROM public.set_latest_complete_analysis_pointer(
    'c3000000-0000-0000-0000-000000000003'::uuid,
    'a4000000-0000-0000-0000-000000000006'::uuid
  )
  $sql$,
  '22023',
  'analysis_not_complete',
  'failed candidate rejected'
);
SELECT throws_ok(
  $sql$
  SELECT * FROM public.set_latest_complete_analysis_pointer(
    'c3000000-0000-0000-0000-000000000003'::uuid,
    'a4000000-0000-0000-0000-000000000007'::uuid
  )
  $sql$,
  '22023',
  'analysis_not_complete',
  'invalid_document candidate rejected'
);

SELECT throws_ok(
  $sql$
  SELECT * FROM public.set_latest_complete_analysis_pointer(
    'c1000000-0000-0000-0000-000000000001'::uuid,
    'f0000000-0000-0000-0000-000000000099'::uuid
  )
  $sql$,
  '22023',
  'analysis_not_found',
  'missing candidate rejected'
);

SELECT throws_ok(
  $sql$
  SELECT * FROM public.set_latest_complete_analysis_pointer(
    'f0000000-0000-0000-0000-000000000099'::uuid,
    'a1000000-0000-0000-0000-000000000001'::uuid
  )
  $sql$,
  '22023',
  'lead_not_found',
  'missing lead rejected'
);

-- Repair invalid pointers
SELECT pg_temp.mlap_seed_lead(
  'c4000000-0000-0000-0000-000000000004'::uuid,
  'mlap-test-repair-missing',
  'f0000000-0000-0000-0000-000000000001'::uuid
);
SELECT pg_temp.mlap_seed_analysis(
  'a5000000-0000-0000-0000-000000000008'::uuid,
  'c4000000-0000-0000-0000-000000000004'::uuid,
  'complete'
);

SELECT is(
  (
    SELECT outcome
    FROM public.set_latest_complete_analysis_pointer(
      'c4000000-0000-0000-0000-000000000004'::uuid,
      'a5000000-0000-0000-0000-000000000008'::uuid
    )
  ),
  'repaired_invalid_current',
  'missing existing pointer row is repaired'
);

SELECT pg_temp.mlap_seed_lead(
  'c5000000-0000-0000-0000-000000000005'::uuid,
  'mlap-test-repair-cross',
  'a3000000-0000-0000-0000-000000000003'::uuid
);
SELECT pg_temp.mlap_seed_analysis(
  'a5000000-0000-0000-0000-000000000009'::uuid,
  'c5000000-0000-0000-0000-000000000005'::uuid,
  'complete'
);

SELECT is(
  (
    SELECT outcome
    FROM public.set_latest_complete_analysis_pointer(
      'c5000000-0000-0000-0000-000000000005'::uuid,
      'a5000000-0000-0000-0000-000000000009'::uuid
    )
  ),
  'repaired_invalid_current',
  'cross-lead existing pointer is repaired'
);

SELECT pg_temp.mlap_seed_lead(
  'c6000000-0000-0000-0000-000000000006'::uuid,
  'mlap-test-repair-pending',
  'a4000000-0000-0000-0000-000000000004'::uuid
);
SELECT pg_temp.mlap_seed_analysis(
  'a5000000-0000-0000-0000-000000000010'::uuid,
  'c6000000-0000-0000-0000-000000000006'::uuid,
  'complete'
);

SELECT is(
  (
    SELECT outcome
    FROM public.set_latest_complete_analysis_pointer(
      'c6000000-0000-0000-0000-000000000006'::uuid,
      'a5000000-0000-0000-0000-000000000010'::uuid
    )
  ),
  'repaired_invalid_current',
  'non-complete existing pointer is repaired'
);

-- Only latest_analysis_id changes on lead row
SELECT pg_temp.mlap_seed_lead(
  'c7000000-0000-0000-0000-000000000007'::uuid,
  'mlap-test-immutable',
  NULL,
  'quoted'
);
SELECT pg_temp.mlap_seed_analysis(
  'a6000000-0000-0000-0000-000000000011'::uuid,
  'c7000000-0000-0000-0000-000000000007'::uuid,
  'complete'
);

CREATE TEMP TABLE mlap_before_immutable AS
SELECT status, funnel_stage, session_id, client_slug
FROM public.leads
WHERE id = 'c7000000-0000-0000-0000-000000000007'::uuid;

SELECT lives_ok(
  $sql$
  SELECT * FROM public.set_latest_complete_analysis_pointer(
    'c7000000-0000-0000-0000-000000000007'::uuid,
    'a6000000-0000-0000-0000-000000000011'::uuid
  )
  $sql$,
  'pointer update succeeds for immutability check'
);

SELECT ok(
  (
    SELECT l.status = b.status
       AND l.funnel_stage = b.funnel_stage
       AND l.session_id = b.session_id
       AND l.client_slug = b.client_slug
       AND l.latest_analysis_id = 'a6000000-0000-0000-0000-000000000011'::uuid
    FROM public.leads AS l
    CROSS JOIN mlap_before_immutable AS b
    WHERE l.id = 'c7000000-0000-0000-0000-000000000007'::uuid
  ),
  'no lead columns other than latest_analysis_id change'
);

-- Opposite call order converges on newest
SELECT pg_temp.mlap_seed_lead(
  'c8000000-0000-0000-0000-000000000008'::uuid,
  'mlap-test-order-a'
);
SELECT pg_temp.mlap_seed_analysis(
  'a7000000-0000-0000-0000-000000000012'::uuid,
  'c8000000-0000-0000-0000-000000000008'::uuid,
  'complete',
  '2026-04-01 08:00:00+00'::timestamptz
);
SELECT pg_temp.mlap_seed_analysis(
  'a8000000-0000-0000-0000-000000000013'::uuid,
  'c8000000-0000-0000-0000-000000000008'::uuid,
  'complete',
  '2026-04-02 08:00:00+00'::timestamptz
);

SELECT lives_ok(
  $sql$
  SELECT * FROM public.set_latest_complete_analysis_pointer(
    'c8000000-0000-0000-0000-000000000008'::uuid,
    'a8000000-0000-0000-0000-000000000013'::uuid
  );
  SELECT * FROM public.set_latest_complete_analysis_pointer(
    'c8000000-0000-0000-0000-000000000008'::uuid,
    'a7000000-0000-0000-0000-000000000012'::uuid
  )
  $sql$,
  'newest-first then older order succeeds'
);

SELECT pg_temp.mlap_seed_lead(
  'c9000000-0000-0000-0000-000000000009'::uuid,
  'mlap-test-order-b'
);
SELECT pg_temp.mlap_seed_analysis(
  'a7000000-0000-0000-0000-000000000014'::uuid,
  'c9000000-0000-0000-0000-000000000009'::uuid,
  'complete',
  '2026-04-01 08:00:00+00'::timestamptz
);
SELECT pg_temp.mlap_seed_analysis(
  'a8000000-0000-0000-0000-000000000015'::uuid,
  'c9000000-0000-0000-0000-000000000009'::uuid,
  'complete',
  '2026-04-02 08:00:00+00'::timestamptz
);

SELECT lives_ok(
  $sql$
  SELECT * FROM public.set_latest_complete_analysis_pointer(
    'c9000000-0000-0000-0000-000000000009'::uuid,
    'a7000000-0000-0000-0000-000000000014'::uuid
  );
  SELECT * FROM public.set_latest_complete_analysis_pointer(
    'c9000000-0000-0000-0000-000000000009'::uuid,
    'a8000000-0000-0000-0000-000000000015'::uuid
  )
  $sql$,
  'older-first then newest order succeeds'
);

SELECT is(
  (
    SELECT latest_analysis_id
    FROM public.leads
    WHERE id = 'c8000000-0000-0000-0000-000000000008'::uuid
  ),
  'a8000000-0000-0000-0000-000000000013'::uuid,
  'newest-first order leaves newest pointer'
);

SELECT is(
  (
    SELECT latest_analysis_id
    FROM public.leads
    WHERE id = 'c9000000-0000-0000-0000-000000000009'::uuid
  ),
  'a8000000-0000-0000-0000-000000000015'::uuid,
  'older-first order leaves newest pointer'
);

ROLLBACK;

-- Two-session concurrency (commits via dblink; cleaned up explicitly)
BEGIN;

CREATE TEMP TABLE mlap_concurrency_results (
  connection_name text PRIMARY KEY,
  outcome text,
  latest_analysis_id uuid
);

SELECT ok(
  pg_catalog.inet_server_addr() IS NOT NULL,
  'concurrency harness requires TCP inet_server_addr()'
);

SELECT extensions.dblink_connect(
  'mlap_a',
  pg_catalog.format(
    'host=%s port=%s dbname=%I user=postgres password=postgres',
    pg_catalog.inet_server_addr(),
    pg_catalog.current_setting('port'),
    pg_catalog.current_database()
  )
);
SELECT extensions.dblink_connect(
  'mlap_b',
  pg_catalog.format(
    'host=%s port=%s dbname=%I user=postgres password=postgres',
    pg_catalog.inet_server_addr(),
    pg_catalog.current_setting('port'),
    pg_catalog.current_database()
  )
);

SELECT extensions.dblink_exec(
  'mlap_a',
  $remote$
  DELETE FROM public.analyses
  WHERE id IN (
    'a9000000-0000-0000-0000-000000000016'::uuid,
    'a9000000-0000-0000-0000-000000000017'::uuid
  );
  DELETE FROM public.leads
  WHERE id = 'ca000000-0000-0000-0000-000000000010'::uuid;
  INSERT INTO public.leads (
    id, session_id, client_slug, status, funnel_stage, latest_analysis_id
  ) VALUES (
    'ca000000-0000-0000-0000-000000000010'::uuid,
    'mlap-conc-lead',
    'direct',
    'new',
    'intake',
    NULL
  );
  INSERT INTO public.analyses (id, lead_id, analysis_status, created_at) VALUES
    (
      'a9000000-0000-0000-0000-000000000016'::uuid,
      'ca000000-0000-0000-0000-000000000010'::uuid,
      'complete',
      '2026-05-01 09:00:00+00'::timestamptz
    ),
    (
      'a9000000-0000-0000-0000-000000000017'::uuid,
      'ca000000-0000-0000-0000-000000000010'::uuid,
      'complete',
      '2026-05-02 09:00:00+00'::timestamptz
    );
  $remote$
);

SELECT ok(
  extensions.dblink_send_query(
    'mlap_a',
    $remote$
    SELECT pg_catalog.row_to_json(r)::text
    FROM public.set_latest_complete_analysis_pointer(
      'ca000000-0000-0000-0000-000000000010'::uuid,
      'a9000000-0000-0000-0000-000000000016'::uuid
    ) AS r
    $remote$
  ) = 1,
  'concurrency session A accepted async older candidate'
);

SELECT pg_catalog.pg_sleep(0.05);

SELECT ok(
  extensions.dblink_send_query(
    'mlap_b',
    $remote$
    SELECT pg_catalog.row_to_json(r)::text
    FROM public.set_latest_complete_analysis_pointer(
      'ca000000-0000-0000-0000-000000000010'::uuid,
      'a9000000-0000-0000-0000-000000000017'::uuid
    ) AS r
    $remote$
  ) = 1,
  'concurrency session B accepted async newer candidate'
);

INSERT INTO mlap_concurrency_results (connection_name, outcome, latest_analysis_id)
SELECT 'A', (result::jsonb ->> 'outcome'), (result::jsonb ->> 'latest_analysis_id')::uuid
FROM extensions.dblink_get_result('mlap_a') AS t(result text);

INSERT INTO mlap_concurrency_results (connection_name, outcome, latest_analysis_id)
SELECT 'B', (result::jsonb ->> 'outcome'), (result::jsonb ->> 'latest_analysis_id')::uuid
FROM extensions.dblink_get_result('mlap_b') AS t(result text);

SELECT *
FROM extensions.dblink_get_result('mlap_a') AS drained(result text);
SELECT *
FROM extensions.dblink_get_result('mlap_b') AS drained(result text);

SELECT is(
  (
    SELECT latest_analysis_id
    FROM public.leads
    WHERE id = 'ca000000-0000-0000-0000-000000000010'::uuid
  ),
  'a9000000-0000-0000-0000-000000000017'::uuid,
  'concurrent opposite-order calls leave newest completed pointer'
);

SELECT extensions.dblink_exec(
  'mlap_a',
  $remote$
  DELETE FROM public.analyses
  WHERE lead_id = 'ca000000-0000-0000-0000-000000000010'::uuid;
  DELETE FROM public.leads
  WHERE id = 'ca000000-0000-0000-0000-000000000010'::uuid;
  $remote$
);

SELECT extensions.dblink_disconnect('mlap_a');
SELECT extensions.dblink_disconnect('mlap_b');

SELECT * FROM finish();
ROLLBACK;
