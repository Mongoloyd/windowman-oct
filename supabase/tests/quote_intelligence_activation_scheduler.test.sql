-- pgTAP for 20260901140000_prepare_quote_intelligence_schedules_v1.sql
-- Run: npx supabase test db supabase/tests/quote_intelligence_activation_scheduler.test.sql --local
-- Requires the activation migration already applied to a disposable local database.
-- Inspects stored scheduler definitions only. Does not fire cron, call net.http_post,
-- or invoke the LIVE_ACTIVE worker URL.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(82);

-- ---------------------------------------------------------------------------
-- Installation and object security
-- ---------------------------------------------------------------------------

SELECT ok(
  to_regprocedure('public.activate_quote_intelligence_schedules_v1(integer)') IS NOT NULL,
  'activation function exists'
);

SELECT ok(
  to_regprocedure('public.deactivate_quote_intelligence_schedules_v1()') IS NOT NULL,
  'deactivation function exists'
);

SELECT is(
  pg_get_function_result(
    to_regprocedure('public.activate_quote_intelligence_schedules_v1(integer)')
  ),
  'TABLE(discovery_jobid bigint, worker_jobid bigint, discovery_limit integer)',
  'activate return shape'
);

SELECT is(
  pg_get_function_result(
    to_regprocedure('public.deactivate_quote_intelligence_schedules_v1()')
  ),
  'TABLE(discovery_jobs_removed integer, worker_jobs_removed integer)',
  'deactivate return shape'
);

SELECT ok(
  pg_get_functiondef(
    to_regprocedure('public.activate_quote_intelligence_schedules_v1(integer)')
  ) ~ 'p_discovery_limit integer DEFAULT 3',
  'discovery limit default is 3'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'quote-intelligence-discover-v1'
  ),
  0,
  'migration application created zero discovery cron rows'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ),
  0,
  'migration application created zero worker cron rows'
);

SELECT is(
  (
    SELECT r.rolname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE n.nspname = 'public'
      AND p.proname = 'activate_quote_intelligence_schedules_v1'
      AND pg_get_function_identity_arguments(p.oid) = 'p_discovery_limit integer'
  ),
  'postgres',
  'activate is owned by postgres'
);

SELECT is(
  (
    SELECT r.rolname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE n.nspname = 'public'
      AND p.proname = 'deactivate_quote_intelligence_schedules_v1'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ),
  'postgres',
  'deactivate is owned by postgres'
);

SELECT ok(
  (
    SELECT p.prosecdef
    FROM pg_proc p
    WHERE p.oid = to_regprocedure(
      'public.activate_quote_intelligence_schedules_v1(integer)'
    )
  ),
  'activate is SECURITY DEFINER'
);

SELECT ok(
  (
    SELECT p.prosecdef
    FROM pg_proc p
    WHERE p.oid = to_regprocedure(
      'public.deactivate_quote_intelligence_schedules_v1()'
    )
  ),
  'deactivate is SECURITY DEFINER'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(value)
    WHERE p.oid = to_regprocedure(
      'public.activate_quote_intelligence_schedules_v1(integer)'
    )
      AND split_part(cfg.value, '=', 1) = 'search_path'
      AND btrim(split_part(cfg.value, '=', 2), '"') = ''
  ),
  'activate has locked empty search_path'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(value)
    WHERE p.oid = to_regprocedure(
      'public.deactivate_quote_intelligence_schedules_v1()'
    )
      AND split_part(cfg.value, '=', 1) = 'search_path'
      AND btrim(split_part(cfg.value, '=', 2), '"') = ''
  ),
  'deactivate has locked empty search_path'
);

SELECT ok(
  NOT has_function_privilege(
    'public',
    'public.activate_quote_intelligence_schedules_v1(integer)',
    'EXECUTE'
  ),
  'PUBLIC cannot execute activate'
);

SELECT ok(
  NOT has_function_privilege(
    'public',
    'public.deactivate_quote_intelligence_schedules_v1()',
    'EXECUTE'
  ),
  'PUBLIC cannot execute deactivate'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.activate_quote_intelligence_schedules_v1(integer)',
    'EXECUTE'
  ),
  'anon cannot execute activate'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.deactivate_quote_intelligence_schedules_v1()',
    'EXECUTE'
  ),
  'anon cannot execute deactivate'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.activate_quote_intelligence_schedules_v1(integer)',
    'EXECUTE'
  ),
  'authenticated cannot execute activate'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.deactivate_quote_intelligence_schedules_v1()',
    'EXECUTE'
  ),
  'authenticated cannot execute deactivate'
);

SELECT ok(
  NOT has_function_privilege(
    'service_role',
    'public.activate_quote_intelligence_schedules_v1(integer)',
    'EXECUTE'
  ),
  'service_role cannot execute activate'
);

SELECT ok(
  NOT has_function_privilege(
    'service_role',
    'public.deactivate_quote_intelligence_schedules_v1()',
    'EXECUTE'
  ),
  'service_role cannot execute deactivate'
);

SELECT ok(
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator')
      THEN NOT has_function_privilege(
        'authenticator',
        'public.activate_quote_intelligence_schedules_v1(integer)',
        'EXECUTE'
      )
    ELSE true
  END,
  'authenticator cannot execute activate when role exists'
);

SELECT ok(
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator')
      THEN NOT has_function_privilege(
        'authenticator',
        'public.deactivate_quote_intelligence_schedules_v1()',
        'EXECUTE'
      )
    ELSE true
  END,
  'authenticator cannot execute deactivate when role exists'
);

-- ---------------------------------------------------------------------------
-- Vault uniqueness is structural; do not weaken it to fabricate duplicates
-- ---------------------------------------------------------------------------

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_class tbl ON tbl.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tbl.relnamespace
    WHERE n.nspname = 'vault'
      AND tbl.relname = 'secrets'
      AND idx.relname = 'secrets_name_idx'
      AND i.indisunique
      AND pg_get_indexdef(i.indexrelid) ILIKE '%(name)%'
  ),
  'vault.secrets.name has a unique index'
);

SELECT vault.create_secret(
  'QI_LOCAL_VAULT_UNIQUENESS_PROBE_SECRET_NOT_A_REAL_CREDENTIAL',
  'qi_vault_uniqueness_probe_v1',
  'local uniqueness probe'
);

SELECT throws_ok(
  $sql$
  SELECT vault.create_secret(
    'QI_LOCAL_VAULT_UNIQUENESS_PROBE_SECRET_NOT_A_REAL_CREDENTIAL',
    'qi_vault_uniqueness_probe_v1',
    'duplicate name must fail'
  );
  $sql$,
  '23505',
  NULL,
  'vault.secrets.name unique index rejects duplicate names'
);

-- ---------------------------------------------------------------------------
-- Discovery-limit validation (before Vault)
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $sql$SELECT * FROM public.activate_quote_intelligence_schedules_v1(0);$sql$,
  '22023',
  NULL,
  'limit 0 is rejected'
);

SELECT throws_ok(
  $sql$SELECT * FROM public.activate_quote_intelligence_schedules_v1(26);$sql$,
  '22023',
  NULL,
  'limit 26 is rejected'
);

-- ---------------------------------------------------------------------------
-- Vault URL / secret validation
-- ---------------------------------------------------------------------------

DELETE FROM vault.secrets
WHERE name IN (
  'quote_intelligence_worker_url',
  'quote_intelligence_worker_secret'
);

SELECT vault.create_secret(
  'QI_LOCAL_SYNTHETIC_WORKER_SECRET_NOT_A_REAL_CREDENTIAL_DO_NOT_SHIP',
  'quote_intelligence_worker_secret',
  'local qi activation test secret'
);

SELECT throws_ok(
  $sql$SELECT * FROM public.activate_quote_intelligence_schedules_v1(3);$sql$,
  'P0001',
  NULL,
  'missing URL is rejected'
);

DELETE FROM vault.secrets
WHERE name IN (
  'quote_intelligence_worker_url',
  'quote_intelligence_worker_secret'
);

SELECT vault.create_secret(
  '   ',
  'quote_intelligence_worker_url',
  'local qi activation blank url'
);

SELECT vault.create_secret(
  'QI_LOCAL_SYNTHETIC_WORKER_SECRET_NOT_A_REAL_CREDENTIAL_DO_NOT_SHIP',
  'quote_intelligence_worker_secret',
  'local qi activation test secret'
);

SELECT throws_ok(
  $sql$SELECT * FROM public.activate_quote_intelligence_schedules_v1(3);$sql$,
  'P0001',
  NULL,
  'blank URL is rejected'
);

DELETE FROM vault.secrets
WHERE name IN (
  'quote_intelligence_worker_url',
  'quote_intelligence_worker_secret'
);

SELECT vault.create_secret(
  'https://example.invalid/functions/v1/quote-intelligence-worker',
  'quote_intelligence_worker_url',
  'local qi activation wrong url'
);

SELECT vault.create_secret(
  'QI_LOCAL_SYNTHETIC_WORKER_SECRET_NOT_A_REAL_CREDENTIAL_DO_NOT_SHIP',
  'quote_intelligence_worker_secret',
  'local qi activation test secret'
);

SELECT throws_ok(
  $sql$SELECT * FROM public.activate_quote_intelligence_schedules_v1(3);$sql$,
  'P0001',
  NULL,
  'wrong URL is rejected'
);

DELETE FROM vault.secrets
WHERE name IN (
  'quote_intelligence_worker_url',
  'quote_intelligence_worker_secret'
);

SELECT vault.create_secret(
  'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/quote-intelligence-worker',
  'quote_intelligence_worker_url',
  'local qi activation approved url'
);

SELECT throws_ok(
  $sql$SELECT * FROM public.activate_quote_intelligence_schedules_v1(3);$sql$,
  'P0001',
  NULL,
  'missing secret is rejected'
);

DELETE FROM vault.secrets
WHERE name IN (
  'quote_intelligence_worker_url',
  'quote_intelligence_worker_secret'
);

SELECT vault.create_secret(
  'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/quote-intelligence-worker',
  'quote_intelligence_worker_url',
  'local qi activation approved url'
);

SELECT vault.create_secret(
  repeat('s', 63),
  'quote_intelligence_worker_secret',
  'local qi activation short secret'
);

SELECT throws_ok(
  $sql$SELECT * FROM public.activate_quote_intelligence_schedules_v1(3);$sql$,
  'P0001',
  NULL,
  'short secret is rejected'
);

-- ---------------------------------------------------------------------------
-- Unrelated cron fixture + valid Vault + successful activation
-- ---------------------------------------------------------------------------

SELECT cron.schedule(
  'wm-inert-unrelated-qi-activation-v1',
  '0 0 1 1 *',
  'SELECT 1;'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'wm-inert-unrelated-qi-activation-v1'
  ),
  1,
  'unrelated inert cron fixture exists'
);

DELETE FROM vault.secrets
WHERE name IN (
  'quote_intelligence_worker_url',
  'quote_intelligence_worker_secret'
);

SELECT vault.create_secret(
  'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/quote-intelligence-worker',
  'quote_intelligence_worker_url',
  'local qi activation approved url'
);

SELECT vault.create_secret(
  'QI_LOCAL_SYNTHETIC_WORKER_SECRET_NOT_A_REAL_CREDENTIAL_DO_NOT_SHIP',
  'quote_intelligence_worker_secret',
  'local qi activation test secret'
);

SELECT lives_ok(
  $sql$SELECT * FROM public.activate_quote_intelligence_schedules_v1(1);$sql$,
  'limit 1 succeeds'
);

SELECT lives_ok(
  $sql$SELECT * FROM public.activate_quote_intelligence_schedules_v1(25);$sql$,
  'limit 25 succeeds'
);

CREATE TEMP TABLE qi_activate_3 AS
SELECT * FROM public.activate_quote_intelligence_schedules_v1(3);

SELECT is(
  (SELECT discovery_limit FROM qi_activate_3),
  3,
  'activate(3) returns discovery_limit 3'
);

SELECT ok(
  (SELECT discovery_jobid FROM qi_activate_3) IS NOT NULL,
  'activate(3) returns discovery_jobid'
);

SELECT ok(
  (SELECT worker_jobid FROM qi_activate_3) IS NOT NULL,
  'activate(3) returns worker_jobid'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'quote-intelligence-discover-v1'
  ),
  1,
  'first activate created exactly one discovery cron'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ),
  1,
  'first activate created exactly one worker cron'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'wm-inert-unrelated-qi-activation-v1'
  ),
  1,
  'unrelated cron survives first activation'
);

SELECT ok(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-discover-v1'
  ) LIKE '%wm_discover_quote_intelligence_jobs%',
  'discovery command calls wm_discover_quote_intelligence_jobs'
);

SELECT is(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-discover-v1'
  ),
  $cmd$SELECT public.wm_discover_quote_intelligence_jobs(3, 'quote_document_header', 'v1', 'p1');$cmd$,
  'discovery command uses limit 3 and frozen worker identity'
);

SELECT is(
  (
    SELECT schedule
    FROM cron.job
    WHERE jobname = 'quote-intelligence-discover-v1'
  ),
  '*/15 * * * *',
  'discovery cadence is every 15 minutes'
);

SELECT ok(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ) LIKE '%net.http_post%',
  'worker command uses net.http_post'
);

SELECT ok(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ) LIKE '%vault.decrypted_secrets%',
  'worker command resolves values from vault.decrypted_secrets at fire time'
);

SELECT ok(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ) LIKE '%quote_intelligence_worker_url%',
  'worker command looks up quote_intelligence_worker_url at fire time'
);

SELECT ok(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ) LIKE '%quote_intelligence_worker_secret%',
  'worker command looks up quote_intelligence_worker_secret at fire time'
);

SELECT ok(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ) LIKE '%x-quote-intelligence-worker-secret%',
  'worker command sets x-quote-intelligence-worker-secret'
);

SELECT ok(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ) LIKE '%''{}''::jsonb%',
  'worker command body is empty JSON'
);

SELECT ok(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ) LIKE '%timeout_milliseconds := 55000%',
  'worker command timeout is 55000 milliseconds'
);

SELECT ok(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ) LIKE '%https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/quote-intelligence-worker%',
  'worker command pins the approved LIVE_ACTIVE endpoint'
);

SELECT is(
  (
    SELECT schedule
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ),
  '2-59/5 * * * *',
  'worker cadence is offset every 5 minutes'
);

SELECT ok(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ) NOT LIKE '%QI_LOCAL_SYNTHETIC_WORKER_SECRET_NOT_A_REAL_CREDENTIAL_DO_NOT_SHIP%',
  'synthetic worker secret is absent from cron.job.command'
);

SELECT ok(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ) !~* 'authorization',
  'worker command has no Authorization header'
);

SELECT ok(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ) !~* 'bearer',
  'worker command has no bearer token'
);

-- ---------------------------------------------------------------------------
-- Repeated activation replaces discovery limit and keeps one job per name
-- ---------------------------------------------------------------------------

SELECT lives_ok(
  $sql$SELECT * FROM public.activate_quote_intelligence_schedules_v1(7);$sql$,
  'second activate with limit 7 succeeds'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'quote-intelligence-discover-v1'
  ),
  1,
  'second activate left exactly one discovery cron'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ),
  1,
  'second activate left exactly one worker cron'
);

SELECT is(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-discover-v1'
  ),
  $cmd$SELECT public.wm_discover_quote_intelligence_jobs(7, 'quote_document_header', 'v1', 'p1');$cmd$,
  'latest discovery limit replaced the prior limit'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'wm-inert-unrelated-qi-activation-v1'
  ),
  1,
  'unrelated cron survives second activation'
);

-- ---------------------------------------------------------------------------
-- Vault failure after prior activation must not unschedule existing QI jobs
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE qi_prior_crons AS
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname IN (
  'quote-intelligence-discover-v1',
  'quote-intelligence-worker-v1'
);

DELETE FROM vault.secrets
WHERE name = 'quote_intelligence_worker_url';

SELECT throws_ok(
  $sql$SELECT * FROM public.activate_quote_intelligence_schedules_v1(9);$sql$,
  'P0001',
  NULL,
  're-activation with missing URL is rejected'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'quote-intelligence-discover-v1'
  ),
  1,
  'failed vault re-activation preserved the discovery cron'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ),
  1,
  'failed vault re-activation preserved the worker cron'
);

SELECT is(
  (
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'quote-intelligence-discover-v1'
  ),
  (
    SELECT jobid
    FROM qi_prior_crons
    WHERE jobname = 'quote-intelligence-discover-v1'
  ),
  'failed vault re-activation left discovery jobid unchanged'
);

SELECT is(
  (
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ),
  (
    SELECT jobid
    FROM qi_prior_crons
    WHERE jobname = 'quote-intelligence-worker-v1'
  ),
  'failed vault re-activation left worker jobid unchanged'
);

SELECT is(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-discover-v1'
  ),
  (
    SELECT command
    FROM qi_prior_crons
    WHERE jobname = 'quote-intelligence-discover-v1'
  ),
  'failed vault re-activation left discovery command unchanged'
);

SELECT is(
  (
    SELECT command
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ),
  (
    SELECT command
    FROM qi_prior_crons
    WHERE jobname = 'quote-intelligence-worker-v1'
  ),
  'failed vault re-activation left worker command unchanged'
);

-- ---------------------------------------------------------------------------
-- Deactivation
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE qi_deactivate_1 AS
SELECT * FROM public.deactivate_quote_intelligence_schedules_v1();

SELECT is(
  (SELECT discovery_jobs_removed FROM qi_deactivate_1),
  1,
  'first deactivate removed one discovery job'
);

SELECT is(
  (SELECT worker_jobs_removed FROM qi_deactivate_1),
  1,
  'first deactivate removed one worker job'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'quote-intelligence-discover-v1'
  ),
  0,
  'discovery cron is removed after deactivate'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'quote-intelligence-worker-v1'
  ),
  0,
  'worker cron is removed after deactivate'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'wm-inert-unrelated-qi-activation-v1'
  ),
  1,
  'unrelated cron survives first deactivation'
);

CREATE TEMP TABLE qi_deactivate_2 AS
SELECT * FROM public.deactivate_quote_intelligence_schedules_v1();

SELECT is(
  (SELECT discovery_jobs_removed FROM qi_deactivate_2),
  0,
  'second deactivate discovery count is 0'
);

SELECT is(
  (SELECT worker_jobs_removed FROM qi_deactivate_2),
  0,
  'second deactivate worker count is 0'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM cron.job
    WHERE jobname = 'wm-inert-unrelated-qi-activation-v1'
  ),
  1,
  'unrelated cron survives second deactivation'
);

-- ---------------------------------------------------------------------------
-- Effective ACL: SET LOCAL ROLE
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $sql$
  SET LOCAL ROLE anon;
  SELECT * FROM public.activate_quote_intelligence_schedules_v1(3);
  $sql$,
  '42501',
  NULL,
  'anon SET LOCAL ROLE cannot execute activate'
);
RESET ROLE;

SELECT throws_ok(
  $sql$
  SET LOCAL ROLE anon;
  SELECT * FROM public.deactivate_quote_intelligence_schedules_v1();
  $sql$,
  '42501',
  NULL,
  'anon SET LOCAL ROLE cannot execute deactivate'
);
RESET ROLE;

SELECT throws_ok(
  $sql$
  SET LOCAL ROLE authenticated;
  SELECT * FROM public.activate_quote_intelligence_schedules_v1(3);
  $sql$,
  '42501',
  NULL,
  'authenticated SET LOCAL ROLE cannot execute activate'
);
RESET ROLE;

SELECT throws_ok(
  $sql$
  SET LOCAL ROLE authenticated;
  SELECT * FROM public.deactivate_quote_intelligence_schedules_v1();
  $sql$,
  '42501',
  NULL,
  'authenticated SET LOCAL ROLE cannot execute deactivate'
);
RESET ROLE;

SELECT throws_ok(
  $sql$
  SET LOCAL ROLE service_role;
  SELECT * FROM public.activate_quote_intelligence_schedules_v1(3);
  $sql$,
  '42501',
  NULL,
  'service_role SET LOCAL ROLE cannot execute activate'
);
RESET ROLE;

SELECT throws_ok(
  $sql$
  SET LOCAL ROLE service_role;
  SELECT * FROM public.deactivate_quote_intelligence_schedules_v1();
  $sql$,
  '42501',
  NULL,
  'service_role SET LOCAL ROLE cannot execute deactivate'
);
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
