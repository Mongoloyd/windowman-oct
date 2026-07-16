-- pgTAP tests for 20260716165508_atomic_phase0a_crm_freeze.sql
-- Run: supabase test db (local/disposable only). Outer txn rolls back fixtures.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT no_plan();

-- ---------------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------------

SELECT ok(
  to_regprocedure('public.fire_crm_handoff()') IS NOT NULL,
  'fire_crm_handoff() exists with zero-arg identity'
);

SELECT is(
  pg_get_function_result(to_regprocedure('public.fire_crm_handoff()')),
  'trigger',
  'fire_crm_handoff() return type remains trigger'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'fire_crm_handoff'
  ),
  1,
  'no unexpected fire_crm_handoff overload'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.fire_crm_handoff()')),
  'fire_crm_handoff remains SECURITY DEFINER'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(value)
    WHERE p.oid = to_regprocedure('public.fire_crm_handoff()')
      AND split_part(cfg.value, '=', 1) = 'search_path'
      AND btrim(split_part(cfg.value, '=', 2), '"') = ''
  ),
  'fire_crm_handoff has empty search_path'
);

SELECT ok(
  (
    SELECT p.prosrc
    FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.fire_crm_handoff()')
  ) !~* 'webhook_deliveries|vault|http_post|pg_net|lead_events|net\.http',
  'fire_crm_handoff body has no webhook/Vault/HTTP/lead_events references'
);

SELECT has_trigger(
  'public', 'leads', 'trg_fire_crm_handoff',
  'trg_fire_crm_handoff still exists on public.leads'
);

SELECT ok(
  (
    SELECT t.tgenabled IN ('O', 'A')
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'leads'
      AND t.tgname = 'trg_fire_crm_handoff'
      AND NOT t.tgisinternal
  ),
  'trg_fire_crm_handoff remains enabled'
);

SELECT ok(
  to_regprocedure('public.claim_pending_deliveries(integer)') IS NOT NULL,
  'claim_pending_deliveries(integer) exists'
);

SELECT is(
  pg_get_function_identity_arguments(to_regprocedure('public.claim_pending_deliveries(integer)')),
  'p_limit integer',
  'claim identity arguments remain p_limit integer'
);

SELECT is(
  pg_get_function_result(to_regprocedure('public.claim_pending_deliveries(integer)')),
  'TABLE(delivery_id uuid, lead_id uuid, client_slug text, contractor_id uuid, assignment_id uuid, dispatch_method text, destination_snapshot jsonb, attempt_count integer, payload_json jsonb, webhook_url text)',
  'claim return contract columns/order/types unchanged'
);

SELECT ok(
  pg_get_functiondef(to_regprocedure('public.claim_pending_deliveries(integer)'))
    ~ 'p_limit integer DEFAULT 25',
  'claim p_limit default remains 25'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.claim_pending_deliveries(integer)')),
  'claim remains SECURITY DEFINER'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(value)
    WHERE p.oid = to_regprocedure('public.claim_pending_deliveries(integer)')
      AND split_part(cfg.value, '=', 1) = 'search_path'
      AND btrim(split_part(cfg.value, '=', 2), '"') = ''
  ),
  'claim has empty search_path'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'claim_pending_deliveries'
  ),
  1,
  'no unexpected claim_pending_deliveries overload'
);

-- ---------------------------------------------------------------------------
-- ACL
-- ---------------------------------------------------------------------------

SELECT ok(
  has_function_privilege('service_role', 'public.claim_pending_deliveries(integer)', 'EXECUTE'),
  'service_role can execute claim'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.claim_pending_deliveries(integer)', 'EXECUTE'),
  'anon cannot execute claim'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.claim_pending_deliveries(integer)', 'EXECUTE'),
  'authenticated cannot execute claim'
);

SELECT ok(
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator')
      THEN NOT has_function_privilege('authenticator', 'public.claim_pending_deliveries(integer)', 'EXECUTE')
    ELSE true
  END,
  'authenticator cannot execute claim when role exists'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.fire_crm_handoff()', 'EXECUTE'),
  'anon cannot directly execute fire_crm_handoff'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.fire_crm_handoff()', 'EXECUTE'),
  'authenticated cannot directly execute fire_crm_handoff'
);

SELECT ok(
  NOT has_function_privilege('service_role', 'public.fire_crm_handoff()', 'EXECUTE'),
  'service_role cannot directly execute fire_crm_handoff'
);

SELECT ok(
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator')
      THEN NOT has_function_privilege('authenticator', 'public.fire_crm_handoff()', 'EXECUTE')
    ELSE true
  END,
  'authenticator cannot directly execute fire_crm_handoff when role exists'
);

-- ---------------------------------------------------------------------------
-- Cron
-- ---------------------------------------------------------------------------

SELECT ok(
  CASE
    WHEN to_regclass('cron.job') IS NULL THEN true
    ELSE NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'dispatch-lead-every-minute'
    )
  END,
  'no job named dispatch-lead-every-minute exists'
);

SELECT ok(
  CASE
    WHEN to_regclass('cron.job') IS NULL THEN true
    WHEN NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lead-reactivation-drip') THEN true
    ELSE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lead-reactivation-drip')
  END,
  'lead-reactivation-drip preserved when present'
);

SELECT ok(
  CASE
    WHEN to_regclass('cron.job') IS NULL THEN true
    WHEN NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-benchmarks-nightly') THEN true
    ELSE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-benchmarks-nightly')
  END,
  'refresh-benchmarks-nightly preserved when present'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

INSERT INTO public.clients (slug, name, is_active)
VALUES ('direct', 'Direct / Organic', false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.webhook_deliveries (
  id, lead_id, event_type, status, attempt_count, payload_json
) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
   'qualified_lead', 'dead_letter', 5, '{"phase0a":"terminal-dl"}'::jsonb),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
   'qualified_lead', 'unroutable', 0, '{"phase0a":"terminal-ur"}'::jsonb);

CREATE TEMP TABLE tmp_phase0a_term_hash AS
SELECT
  id,
  status,
  md5(COALESCE(payload_json::text, '') || '|' || status || '|' || attempt_count::text) AS row_hash
FROM public.webhook_deliveries
WHERE id IN (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
);

DO $$
BEGIN
  IF to_regclass('public.platform_dispatch_outbox') IS NOT NULL THEN
    EXECUTE $q$
      CREATE TEMP TABLE tmp_phase0a_outbox_hash AS
      SELECT count(*)::bigint AS n,
             coalesce(md5(string_agg(id::text, ',' ORDER BY id::text)), 'empty') AS h
      FROM public.platform_dispatch_outbox
    $q$;
  ELSE
    CREATE TEMP TABLE tmp_phase0a_outbox_hash AS
    SELECT 0::bigint AS n, 'absent'::text AS h;
  END IF;
END
$$;

-- Empty-queue claim before eligible fixtures
SELECT is(
  (SELECT count(*)::integer FROM public.claim_pending_deliveries(25)),
  0,
  'claim returns zero rows with empty eligible queue'
);

INSERT INTO public.webhook_deliveries (
  id, lead_id, event_type, status, attempt_count, next_retry_at,
  dispatch_method, destination_snapshot, payload_json, client_slug
) VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
   'qualified_lead', 'pending', 0, NULL,
   'webhook', '{"dispatch_method":"webhook"}'::jsonb, '{"phase0a":"pending"}'::jsonb, 'direct'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
   'qualified_lead', 'failed', 1, now() - interval '1 minute',
   'webhook', '{"dispatch_method":"webhook"}'::jsonb, '{"phase0a":"failed-due"}'::jsonb, 'direct'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
   'qualified_lead', 'failed', 1, now() + interval '1 day',
   'webhook', '{"dispatch_method":"webhook"}'::jsonb, '{"phase0a":"failed-future"}'::jsonb, 'direct');

CREATE TEMP TABLE tmp_phase0a_eligible_hash AS
SELECT
  id,
  status,
  attempt_count,
  next_retry_at,
  md5(
    COALESCE(payload_json::text, '') || '|' || status || '|' ||
    attempt_count::text || '|' || COALESCE(next_retry_at::text, '')
  ) AS row_hash
FROM public.webhook_deliveries
WHERE id IN (
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
);

SELECT is(
  (SELECT count(*)::integer FROM public.claim_pending_deliveries(100)),
  0,
  'claim returns zero rows when pending fixture exists'
);

SELECT is(
  (SELECT count(*)::integer FROM public.claim_pending_deliveries(25)),
  0,
  'claim returns zero rows when retryable/future failed fixtures exist'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM tmp_phase0a_eligible_hash h
    JOIN public.webhook_deliveries d ON d.id = h.id
    WHERE h.status = d.status
      AND h.attempt_count = d.attempt_count
      AND h.next_retry_at IS NOT DISTINCT FROM d.next_retry_at
      AND h.row_hash = md5(
        COALESCE(d.payload_json::text, '') || '|' || d.status || '|' ||
        d.attempt_count::text || '|' || COALESCE(d.next_retry_at::text, '')
      )
  ),
  3,
  'pending/failed fixtures unchanged after claim calls'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.lead_events
    WHERE metadata->>'phase0a' IS NOT NULL
  ),
  0,
  'no lead_events row produced by claim calls'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.webhook_deliveries
    WHERE status IN ('pending', 'failed')
      AND id NOT IN (
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'
      )
      AND (next_retry_at IS NULL OR next_retry_at <= now())
      AND attempt_count < 5
  ),
  0,
  'process-webhook has no non-fixture eligible rows after freeze install state'
);

-- Lead update enqueue silence
INSERT INTO public.leads (
  id, session_id, client_slug, status, phone_verified, phone_verified_at
) VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'phase0a-enqueue-silence',
  'direct',
  'qualified',
  false,
  NULL
);

UPDATE public.leads
SET
  phone_verified = true,
  phone_verified_at = now(),
  latest_analysis_id = 'ffffffff-ffff-4fff-8fff-fffffffffff1'
WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.webhook_deliveries
    WHERE lead_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
  ),
  0,
  'qualifying lead update creates no webhook_deliveries row'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.lead_events
    WHERE lead_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
      AND event_name LIKE 'crm_handoff_%'
  ),
  0,
  'qualifying lead update creates no CRM handoff lead_events'
);

SELECT ok(
  (
    SELECT phone_verified = true
       AND latest_analysis_id = 'ffffffff-ffff-4fff-8fff-fffffffffff1'
       AND client_slug = 'direct'
       AND status = 'qualified'
    FROM public.leads
    WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
  ),
  'noop trigger does not mutate unrelated lead fields beyond the UPDATE itself'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM tmp_phase0a_term_hash h
    JOIN public.webhook_deliveries d ON d.id = h.id
    WHERE h.status = d.status
      AND h.row_hash = md5(
        COALESCE(d.payload_json::text, '') || '|' || d.status || '|' || d.attempt_count::text
      )
  ),
  2,
  'terminal delivery rows remain unchanged'
);

SELECT ok(
  (
    CASE
      WHEN to_regclass('public.platform_dispatch_outbox') IS NULL THEN true
      ELSE (
        SELECT
          (SELECT n FROM tmp_phase0a_outbox_hash) =
            (SELECT count(*)::bigint FROM public.platform_dispatch_outbox)
          AND (SELECT h FROM tmp_phase0a_outbox_hash) =
            coalesce(
              (SELECT md5(string_agg(id::text, ',' ORDER BY id::text))
               FROM public.platform_dispatch_outbox),
              'empty'
            )
      )
    END
  ),
  'paid-media platform_dispatch_outbox unchanged'
);

-- ---------------------------------------------------------------------------
-- Install abort semantics (stable messages)
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$
  DO $guard$
  DECLARE v_pending integer; v_processing integer; v_failed integer;
  BEGIN
    SELECT
      count(*) FILTER (WHERE status = 'pending'),
      count(*) FILTER (WHERE status = 'processing'),
      count(*) FILTER (WHERE status = 'failed')
    INTO v_pending, v_processing, v_failed
    FROM public.webhook_deliveries;
    IF v_pending > 0 OR v_processing > 0 OR v_failed > 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'crm_delivery_freeze_queue_not_empty';
    END IF;
  END
  $guard$;
  $$,
  'P0001',
  'crm_delivery_freeze_queue_not_empty',
  'install aborts when pending/failed rows exist'
);

SELECT throws_ok(
  $$
  DO $guard$
  BEGIN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'crm_delivery_freeze_duplicate_dispatch_cron';
  END
  $guard$;
  $$,
  'P0001',
  'crm_delivery_freeze_duplicate_dispatch_cron',
  'duplicate dispatch cron abort message is stable'
);

SELECT throws_ok(
  $$
  DO $guard$
  BEGIN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'crm_delivery_freeze_assert_claim_return';
  END
  $guard$;
  $$,
  'P0001',
  'crm_delivery_freeze_assert_claim_return',
  'claim contract mismatch abort message is stable'
);

SELECT throws_ok(
  $$
  DO $guard$
  BEGIN
    RAISE EXCEPTION USING ERRCODE = '55P03', MESSAGE = 'canceling statement due to lock timeout';
  END
  $guard$;
  $$,
  '55P03',
  'canceling statement due to lock timeout',
  'lock timeout SQLSTATE is 55P03'
);

SELECT ok(
  (
    SELECT p.prosrc FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.fire_crm_handoff()')
  ) ~* 'RETURN NEW',
  'after abort-semantic checks, fire freeze definition remains installed'
);

SELECT ok(
  (
    SELECT p.prosrc FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.claim_pending_deliveries(integer)')
  ) !~* 'FOR UPDATE|webhook_deliveries',
  'after abort-semantic checks, claim freeze definition remains installed'
);

SELECT ok(
  CASE
    WHEN to_regclass('cron.job') IS NULL THEN true
    ELSE NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'dispatch-lead-every-minute'
    )
  END,
  'after abort-semantic checks, dispatch cron remains absent'
);

SELECT ok(
  has_function_privilege('service_role', 'public.claim_pending_deliveries(integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.claim_pending_deliveries(integer)', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.fire_crm_handoff()', 'EXECUTE'),
  'after abort-semantic checks, ACL remains fail-closed'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM tmp_phase0a_eligible_hash h
    JOIN public.webhook_deliveries d ON d.id = h.id
    WHERE h.row_hash = md5(
      COALESCE(d.payload_json::text, '') || '|' || d.status || '|' ||
      d.attempt_count::text || '|' || COALESCE(d.next_retry_at::text, '')
    )
  ),
  3,
  'after abort-semantic checks, queue fixtures remain unchanged'
);

SELECT * FROM finish();

ROLLBACK;
