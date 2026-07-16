-- Atomic Phase 0A: fail-closed CRM delivery freeze
-- Freezes automatic client CRM enqueue + claim + dispatcher cron in one
-- transaction under bounded locks. Does not touch Edge Functions, Vault,
-- secrets, measurement outbox, OTP, scoring, reveal, routing, or RLS.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- 1. Fixed lock order
LOCK TABLE public.leads IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.webhook_deliveries IN ACCESS EXCLUSIVE MODE;

-- 2. Queue precondition (every failed row blocks)
DO $$
DECLARE
  v_pending    integer;
  v_processing integer;
  v_failed     integer;
BEGIN
  SELECT
    count(*) FILTER (WHERE status = 'pending'),
    count(*) FILTER (WHERE status = 'processing'),
    count(*) FILTER (WHERE status = 'failed')
  INTO v_pending, v_processing, v_failed
  FROM public.webhook_deliveries;

  IF v_pending > 0 OR v_processing > 0 OR v_failed > 0 THEN
    RAISE EXCEPTION
      USING
        ERRCODE = 'P0001',
        MESSAGE = 'crm_delivery_freeze_queue_not_empty',
        DETAIL  = format(
          'blocking_counts pending=%s processing=%s failed=%s',
          v_pending, v_processing, v_failed
        );
  END IF;
END
$$;

-- Snapshot terminal rows for post-change integrity assertion (ids + statuses only).
CREATE TEMP TABLE tmp_phase0a_terminal_snapshot ON COMMIT DROP AS
SELECT id, status, updated_at
FROM public.webhook_deliveries
WHERE status IN ('dead_letter', 'unroutable', 'delivered', 'mock_delivered');

-- 3. Producer no-op
CREATE OR REPLACE FUNCTION public.fire_crm_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fire_crm_handoff() IS
  'Phase 0A freeze: automatic CRM enqueue intentionally no-op. Reactivation requires a new approved migration after manual delivery controls exist.';

REVOKE ALL ON FUNCTION public.fire_crm_handoff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fire_crm_handoff() FROM anon;
REVOKE ALL ON FUNCTION public.fire_crm_handoff() FROM authenticated;
REVOKE ALL ON FUNCTION public.fire_crm_handoff() FROM authenticator;
REVOKE ALL ON FUNCTION public.fire_crm_handoff() FROM service_role;

-- 4. Claim empty exact-contract replacement
CREATE OR REPLACE FUNCTION public.claim_pending_deliveries(p_limit integer DEFAULT 25)
RETURNS TABLE (
  delivery_id          uuid,
  lead_id              uuid,
  client_slug          text,
  contractor_id        uuid,
  assignment_id        uuid,
  dispatch_method      text,
  destination_snapshot jsonb,
  attempt_count        integer,
  payload_json         jsonb,
  webhook_url          text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Fail-closed: ignore p_limit; perform no queue I/O.
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.claim_pending_deliveries(integer) IS
  'Phase 0A freeze: claim_pending_deliveries returns zero rows and performs no webhook_deliveries access. Reactivation requires a new approved migration.';

REVOKE ALL ON FUNCTION public.claim_pending_deliveries(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_pending_deliveries(integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_pending_deliveries(integer) FROM authenticated;
REVOKE ALL ON FUNCTION public.claim_pending_deliveries(integer) FROM authenticator;
GRANT EXECUTE ON FUNCTION public.claim_pending_deliveries(integer) TO service_role;

-- 5. Unschedule exact dispatcher cron only
DO $$
DECLARE
  v_count integer;
  v_jobid bigint;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'cron.job absent — dispatcher cron already fail-closed';
  ELSE
    SELECT count(*)::integer INTO v_count
    FROM cron.job
    WHERE jobname = 'dispatch-lead-every-minute';

    IF v_count > 1 THEN
      RAISE EXCEPTION
        USING
          ERRCODE = 'P0001',
          MESSAGE = 'crm_delivery_freeze_duplicate_dispatch_cron',
          DETAIL  = format('matching_jobs=%s', v_count);
    ELSIF v_count = 1 THEN
      SELECT jobid INTO v_jobid
      FROM cron.job
      WHERE jobname = 'dispatch-lead-every-minute'
      LIMIT 1;
      PERFORM cron.unschedule(v_jobid);
    END IF;
  END IF;
END
$$;

-- 6. Install-time catalog assertions
DO $$
DECLARE
  v_fire_oid   oid;
  v_claim_oid  oid;
  v_fire_owner oid;
  v_claim_owner oid;
  v_result     text;
  v_empty_sp   boolean;
  v_tgenabled  char;
  v_overloads  integer;
  v_blocking   integer;
  v_term_drift integer;
  v_cron_left  integer;
BEGIN
  v_fire_oid := to_regprocedure('public.fire_crm_handoff()');
  IF v_fire_oid IS NULL THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_fire_missing';
  END IF;

  v_claim_oid := to_regprocedure('public.claim_pending_deliveries(integer)');
  IF v_claim_oid IS NULL THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_claim_missing';
  END IF;

  IF pg_get_function_identity_arguments(v_fire_oid) <> '' THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_fire_signature';
  END IF;

  IF pg_get_function_result(v_fire_oid) <> 'trigger' THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_fire_return';
  END IF;

  IF pg_get_function_identity_arguments(v_claim_oid) <> 'p_limit integer' THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_claim_signature';
  END IF;

  v_result := pg_get_function_result(v_claim_oid);
  IF v_result <> 'TABLE(delivery_id uuid, lead_id uuid, client_slug text, contractor_id uuid, assignment_id uuid, dispatch_method text, destination_snapshot jsonb, attempt_count integer, payload_json jsonb, webhook_url text)' THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_claim_return'
      USING DETAIL = v_result;
  END IF;

  IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_fire_oid) THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_fire_security';
  END IF;
  IF NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = v_claim_oid) THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_claim_security';
  END IF;

  SELECT p.proowner INTO v_fire_owner FROM pg_proc p WHERE p.oid = v_fire_oid;
  SELECT p.proowner INTO v_claim_owner FROM pg_proc p WHERE p.oid = v_claim_oid;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(value)
    WHERE p.oid = v_fire_oid
      AND split_part(cfg.value, '=', 1) = 'search_path'
      AND btrim(split_part(cfg.value, '=', 2), '"') = ''
  ) INTO v_empty_sp;
  IF NOT v_empty_sp THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_fire_search_path';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p, unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(value)
    WHERE p.oid = v_claim_oid
      AND split_part(cfg.value, '=', 1) = 'search_path'
      AND btrim(split_part(cfg.value, '=', 2), '"') = ''
  ) INTO v_empty_sp;
  IF NOT v_empty_sp THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_claim_search_path';
  END IF;

  -- fire_crm_handoff: no API-role EXECUTE (skip roles that do not exist locally)
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['anon', 'authenticated', 'authenticator', 'service_role']) AS r(rolname)
    JOIN pg_roles pr ON pr.rolname = r.rolname
    WHERE has_function_privilege(pr.oid, v_fire_oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_fire_acl';
  END IF;

  -- claim: service_role only among API roles
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'service_role'
  ) OR NOT has_function_privilege('service_role', v_claim_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_claim_service_role';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY['anon', 'authenticated', 'authenticator']) AS r(rolname)
    JOIN pg_roles pr ON pr.rolname = r.rolname
    WHERE has_function_privilege(pr.oid, v_claim_oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_claim_acl';
  END IF;

  -- trigger still present and enabled (O = origin/enabled)
  SELECT t.tgenabled INTO v_tgenabled
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'leads'
    AND t.tgname = 'trg_fire_crm_handoff'
    AND NOT t.tgisinternal;
  IF v_tgenabled IS NULL OR v_tgenabled NOT IN ('O', 'A') THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_trigger'
      USING DETAIL = coalesce(v_tgenabled::text, 'missing');
  END IF;

  -- no claim overload
  SELECT count(*)::integer INTO v_overloads
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'claim_pending_deliveries';
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_claim_overload'
      USING DETAIL = format('count=%s', v_overloads);
  END IF;

  SELECT count(*)::integer INTO v_overloads
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'fire_crm_handoff';
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_fire_overload'
      USING DETAIL = format('count=%s', v_overloads);
  END IF;

  -- still no blocking queue rows
  SELECT count(*)::integer INTO v_blocking
  FROM public.webhook_deliveries
  WHERE status IN ('pending', 'processing', 'failed');
  IF v_blocking <> 0 THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_queue_dirty'
      USING DETAIL = format('blocking=%s', v_blocking);
  END IF;

  -- terminal rows unmodified by this migration
  SELECT count(*)::integer INTO v_term_drift
  FROM tmp_phase0a_terminal_snapshot s
  FULL OUTER JOIN (
    SELECT id, status, updated_at
    FROM public.webhook_deliveries
    WHERE status IN ('dead_letter', 'unroutable', 'delivered', 'mock_delivered')
  ) t ON t.id = s.id
  WHERE s.id IS NULL
     OR t.id IS NULL
     OR s.status IS DISTINCT FROM t.status
     OR s.updated_at IS DISTINCT FROM t.updated_at;
  IF v_term_drift <> 0 THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_terminal_modified'
      USING DETAIL = format('drift=%s', v_term_drift);
  END IF;

  -- dispatcher cron absent
  IF to_regclass('cron.job') IS NOT NULL THEN
    SELECT count(*)::integer INTO v_cron_left
    FROM cron.job
    WHERE jobname = 'dispatch-lead-every-minute';
    IF v_cron_left <> 0 THEN
      RAISE EXCEPTION 'crm_delivery_freeze_assert_cron_present'
        USING DETAIL = format('count=%s', v_cron_left);
    END IF;
  END IF;

  -- silence unused-variable lint for owners (ownership preserved by CREATE OR REPLACE)
  IF v_fire_owner IS NULL OR v_claim_owner IS NULL THEN
    RAISE EXCEPTION 'crm_delivery_freeze_assert_owner';
  END IF;
END
$$;

COMMIT;
