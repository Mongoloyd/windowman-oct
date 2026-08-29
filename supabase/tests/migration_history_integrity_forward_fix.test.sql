-- Regression proof for 20260829000939_repair_enqueue_lead_summary_http_post.sql.
-- Run: npx supabase test db supabase/tests/migration_history_integrity_forward_fix.test.sql --local

\set ON_ERROR_STOP on
\pset pager off

SELECT plan(15);

SELECT isnt(
  pg_catalog.to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)'),
  NULL::regprocedure,
  'the exact pg_net http_post overload resolves'
);

SELECT is(
  pg_catalog.pg_get_function_identity_arguments(
    pg_catalog.to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)')
  ),
  'url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer',
  'pg_net http_post identity arguments remain compatible with named notation'
);

SELECT is(
  (
    SELECT p.proargnames
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = pg_catalog.to_regprocedure(
      'net.http_post(text,jsonb,jsonb,jsonb,integer)'
    )
  ),
  ARRAY['url', 'body', 'params', 'headers', 'timeout_milliseconds']::text[],
  'pg_net http_post exposes the expected argument names'
);

SELECT is(
  pg_catalog.pg_get_function_result(
    pg_catalog.to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)')
  ),
  'bigint',
  'pg_net http_post returns the request id as bigint'
);

SELECT isnt(
  pg_catalog.to_regprocedure('public.enqueue_lead_summary()'),
  NULL::regprocedure,
  'enqueue_lead_summary trigger function exists'
);

SELECT is(
  pg_catalog.pg_get_function_result(
    pg_catalog.to_regprocedure('public.enqueue_lead_summary()')
  ),
  'trigger',
  'enqueue_lead_summary retains its trigger return type'
);

SELECT is(
  (
    SELECT l.lanname
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_language AS l ON l.oid = p.prolang
    WHERE p.oid = pg_catalog.to_regprocedure('public.enqueue_lead_summary()')
  ),
  'plpgsql',
  'enqueue_lead_summary remains a plpgsql function'
);

SELECT ok(
  (
    SELECT p.prosecdef
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = pg_catalog.to_regprocedure('public.enqueue_lead_summary()')
  ),
  'enqueue_lead_summary remains SECURITY DEFINER'
);

SELECT is(
  (
    SELECT p.proconfig
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = pg_catalog.to_regprocedure('public.enqueue_lead_summary()')
  ),
  ARRAY['search_path=""']::text[],
  'enqueue_lead_summary retains an empty search_path'
);

SELECT is(
  (
    SELECT r.rolname
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_roles AS r ON r.oid = p.proowner
    WHERE p.oid = pg_catalog.to_regprocedure('public.enqueue_lead_summary()')
  ),
  'postgres',
  'enqueue_lead_summary owner is unchanged'
);

SELECT ok(
  pg_catalog.has_function_privilege(
    'public',
    'public.enqueue_lead_summary()',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'postgres',
    'public.enqueue_lead_summary()',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'anon',
    'public.enqueue_lead_summary()',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'authenticated',
    'public.enqueue_lead_summary()',
    'EXECUTE'
  )
  AND pg_catalog.has_function_privilege(
    'service_role',
    'public.enqueue_lead_summary()',
    'EXECUTE'
  ),
  'enqueue_lead_summary effective EXECUTE privileges are unchanged'
);

SELECT ok(
  pg_catalog.strpos(
    pg_catalog.lower(
      pg_catalog.pg_get_functiondef(
        pg_catalog.to_regprocedure('public.enqueue_lead_summary()')
      )
    ),
    'perform net.http_post('
  ) > 0,
  'enqueue_lead_summary resolves the existing net.http_post function'
);

SELECT ok(
  pg_catalog.strpos(
    pg_catalog.pg_get_functiondef(
      pg_catalog.to_regprocedure('public.enqueue_lead_summary()')
    ),
    '"extensions"."net"."http_post"'
  ) = 0,
  'installed function no longer contains the historical three-part qualifier'
);

SELECT ok(
  pg_catalog.strpos(
    pg_catalog.lower(
      pg_catalog.pg_get_functiondef(
        pg_catalog.to_regprocedure('public.enqueue_lead_summary()')
      )
    ),
    'perform extensions.http_post('
  ) = 0,
  'installed function does not use the nonexistent extensions.http_post function'
);

SELECT ok(
  (
    SELECT
      pg_catalog.strpos(pg_catalog.lower(definition), 'if new.is_test then') > 0
      AND pg_catalog.strpos(
        pg_catalog.lower(definition),
        $needle$to_jsonb(new) - 'ai_summary' - 'updated_at'$needle$
      ) > 0
      AND pg_catalog.strpos(
        pg_catalog.lower(definition),
        $needle$current_setting('request.headers', true)$needle$
      ) > 0
      AND pg_catalog.strpos(definition, 'from "vault"."decrypted_secrets"') > 0
      AND pg_catalog.strpos(definition, '/functions/v1/summarize-row') > 0
      AND pg_catalog.strpos(pg_catalog.lower(definition), 'exception') > 0
      AND pg_catalog.strpos(pg_catalog.lower(definition), 'when others then') > 0
    FROM (
      SELECT pg_catalog.pg_get_functiondef(
        pg_catalog.to_regprocedure('public.enqueue_lead_summary()')
      ) AS definition
    ) AS installed
  ),
  'all non-resolution guards, payload handoff, and safe exception behavior remain present'
);

SELECT * FROM finish();
