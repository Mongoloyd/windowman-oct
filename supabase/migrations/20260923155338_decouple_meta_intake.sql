-- Meta intake decoupling. Definition-only: no registration/backfill, queue work,
-- Vault writes, cron activation, outbound switch change, or vendor request.
-- Requires the reviewed 20260922200843 package and its existing cron/net/Vault.
-- Registered forms use ONLY the intake registry, including inactive rows.
-- Registering a legacy form is an explicit operator policy change, never a seed.
-- Delivery remains governed by meta_form_destinations and existing consent rules.
--
-- Separate, later activation prerequisites (NOT provisioned here):
--   Intake: Vault meta_lead_worker_url + meta_worker_secret.
--   Outbox: Vault meta_outbox_worker_url + meta_worker_secret.
--   meta_worker_secret must match the Edge Function META_WORKER_SECRET.
--   Each URL must equal its exact approved production endpoint below.
--   Outbox activation does NOT enable the independent GHL/CAPI master switches.
--
-- Rollback: any failed assertion rolls back this entire transaction. After an
-- authorized deployment, pause only the affected lane and allow in-flight work
-- to finish before a separately reviewed, fingerprint-guarded receipt-body
-- restoration. Preserve approvals, receipts, canonical leads and history; do not
-- DROP TABLE or reset migration history. Unscheduling does not cancel HTTP work.
-- Existing combined activation/emergency-stop routines are deliberately unchanged.
-- A second manual application fails closed; it is NOT a silent no-op migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
DECLARE
  v_receipt pg_catalog.pg_proc%ROWTYPE;
  v_name text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('meta-lead-ads-worker-schedules', 0)
  );
  IF pg_catalog.to_regclass('public.meta_intake_form_approvals') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_proc p
       JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname IN (
         'meta_activate_intake_schedule', 'meta_deactivate_intake_schedule',
         'meta_activate_outbox_schedule', 'meta_deactivate_outbox_schedule'
       )
     ) THEN
    RAISE EXCEPTION 'meta_intake_decoupling_object_already_exists'
      USING ERRCODE = '42710';
  END IF;
  FOREACH v_name IN ARRAY ARRAY[
    'public.meta_webhook_receipts', 'public.meta_lead_inbox',
    'public.meta_form_destinations', 'cron.job', 'vault.decrypted_secrets'
  ] LOOP
    IF pg_catalog.to_regclass(v_name) IS NULL THEN
      RAISE EXCEPTION 'meta_intake_decoupling_prerequisite_missing: %', v_name
        USING ERRCODE = '55000';
    END IF;
  END LOOP;
  IF pg_catalog.to_regprocedure('cron.schedule(text,text,text)') IS NULL
     OR pg_catalog.to_regprocedure('cron.unschedule(bigint)') IS NULL
     OR pg_catalog.to_regprocedure('public.meta_activate_worker_schedules()') IS NULL
     OR pg_catalog.to_regprocedure('public.meta_deactivate_worker_schedules()') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_roles
       WHERE rolname = 'service_role' AND rolbypassrls
     ) THEN
    RAISE EXCEPTION 'meta_intake_decoupling_prerequisite_missing'
      USING ERRCODE = '55000';
  END IF;
  SELECT * INTO v_receipt FROM pg_catalog.pg_proc
  WHERE oid = pg_catalog.to_regprocedure(
    'public.meta_complete_webhook_receipt(uuid,uuid,jsonb,jsonb,integer)'
  );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'meta_receipt_function_missing' USING ERRCODE = '55000';
  END IF;
  IF pg_catalog.md5(pg_catalog.replace(v_receipt.prosrc, E'\r\n', E'\n'))
       IS DISTINCT FROM '9c518e40c653db099aba917f569288ac'
     OR v_receipt.prokind <> 'f' OR v_receipt.prosecdef OR v_receipt.proretset
     OR v_receipt.prorettype <> 'text'::pg_catalog.regtype
     OR v_receipt.prolang <> (
       SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql'
     )
     OR v_receipt.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
     OR v_receipt.proowner <> current_user::pg_catalog.regrole::oid
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_proc
       WHERE oid IN (
         'public.meta_activate_worker_schedules()'::pg_catalog.regprocedure,
         'public.meta_deactivate_worker_schedules()'::pg_catalog.regprocedure
       ) AND proowner <> v_receipt.proowner
     )
     OR pg_catalog.has_function_privilege('anon', v_receipt.oid, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_receipt.oid, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', v_receipt.oid, 'EXECUTE')
  THEN
    RAISE EXCEPTION 'meta_receipt_function_contract_drift' USING ERRCODE = '55000';
  END IF;
END;
$preflight$;

CREATE TABLE public.meta_intake_form_approvals (
  page_id text NOT NULL CHECK (
    page_id = btrim(page_id) AND length(page_id) BETWEEN 1 AND 255
  ),
  form_id text NOT NULL CHECK (
    form_id = btrim(form_id) AND length(form_id) BETWEEN 1 AND 255
  ),
  active boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (page_id, form_id),
  CHECK (NOT active OR approved_at IS NOT NULL)
);
CREATE INDEX meta_intake_form_approvals_form_idx
  ON public.meta_intake_form_approvals (form_id);
ALTER TABLE public.meta_intake_form_approvals ENABLE ROW LEVEL SECURITY;
-- Remove Supabase default grants, including any service-role ALL grant, before
-- granting narrow rights. No DELETE/TRUNCATE or identity-column UPDATE permits
-- routine callers to erase registration and accidentally restore legacy fallback.
-- Database owners retain their inherent administrative authority.
REVOKE ALL ON public.meta_intake_form_approvals
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.meta_intake_form_approvals TO service_role;
GRANT UPDATE (active, approved_at) ON public.meta_intake_form_approvals TO service_role;

DO $patch$
DECLARE
  v_before pg_catalog.pg_proc%ROWTYPE;
  v_after pg_catalog.pg_proc%ROWTYPE;
  v_definition text;
  v_old text := $old$    SELECT EXISTS (
      SELECT 1 FROM public.meta_form_destinations d
      WHERE d.form_id = v_form_id AND d.active AND d.approved_at IS NOT NULL
    ) INTO v_live_approved;$old$;
  v_new text := $new$    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM public.meta_intake_form_approvals a
        WHERE a.form_id = v_form_id
      ) THEN EXISTS (
        SELECT 1 FROM public.meta_intake_form_approvals a
        WHERE a.page_id = v_page_id AND a.form_id = v_form_id
          AND a.active AND a.approved_at IS NOT NULL
          AND a.approved_at <= v_receipt.received_at
      )
      ELSE EXISTS (
        SELECT 1 FROM public.meta_form_destinations d
        WHERE d.form_id = v_form_id AND d.active AND d.approved_at IS NOT NULL
      )
    END INTO v_live_approved;$new$;
BEGIN
  -- Git on Windows may check this migration out with CRLF line endings.
  v_old := pg_catalog.replace(v_old, E'\r\n', E'\n');
  v_new := pg_catalog.replace(v_new, E'\r\n', E'\n');
  SELECT * INTO STRICT v_before FROM pg_catalog.pg_proc
  WHERE oid = 'public.meta_complete_webhook_receipt(uuid,uuid,jsonb,jsonb,integer)'::pg_catalog.regprocedure;
  IF pg_catalog.md5(pg_catalog.replace(v_before.prosrc, E'\r\n', E'\n'))
       IS DISTINCT FROM '9c518e40c653db099aba917f569288ac' THEN
    RAISE EXCEPTION 'meta_receipt_function_contract_drift' USING ERRCODE = '55000';
  END IF;
  v_definition := pg_catalog.replace(
    pg_catalog.pg_get_functiondef(v_before.oid), E'\r\n', E'\n'
  );
  IF length(v_definition) - length(replace(v_definition, v_old, '')) <> length(v_old) THEN
    RAISE EXCEPTION 'meta_receipt_patch_target_not_unique' USING ERRCODE = '55000';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);
  SELECT * INTO STRICT v_after FROM pg_catalog.pg_proc WHERE oid = v_before.oid;
  IF pg_catalog.md5(pg_catalog.replace(v_after.prosrc, E'\r\n', E'\n'))
       IS DISTINCT FROM '66d8854b29c05cc025aa16f677685dfa'
     OR (to_jsonb(v_before) - 'prosrc') IS DISTINCT FROM (to_jsonb(v_after) - 'prosrc')
  THEN
    RAISE EXCEPTION 'meta_receipt_patch_postcondition_failed' USING ERRCODE = '55000';
  END IF;
END;
$patch$;

-- These four routines are DEFINITIONS ONLY. SECURITY DEFINER is necessary to
-- read Vault and manage cron under the existing scheduler owner's identity.
-- Service-role-only EXECUTE is granted below, in the same transaction.
CREATE FUNCTION public.meta_activate_intake_schedule()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_url text;
  v_secret text;
  v_url_count bigint;
  v_secret_count bigint;
  v_job_id bigint;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('meta-lead-ads-worker-schedules', 0)
  );
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'meta-lead-inbox-v1') THEN
    RAISE EXCEPTION 'meta_intake_schedule_already_exists' USING ERRCODE = '42710';
  END IF;
  SELECT count(*), min(decrypted_secret) INTO v_url_count, v_url
  FROM vault.decrypted_secrets WHERE name = 'meta_lead_worker_url';
  SELECT count(*), min(decrypted_secret) INTO v_secret_count, v_secret
  FROM vault.decrypted_secrets WHERE name = 'meta_worker_secret';
  IF v_url_count <> 1 OR v_secret_count <> 1
     OR v_url IS DISTINCT FROM
       'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/process-meta-lead'
     OR NULLIF(btrim(v_secret), '') IS NULL THEN
    RAISE EXCEPTION 'meta_intake_vault_config_missing_or_wrong_target'
      USING ERRCODE = '55000';
  END IF;
  SELECT cron.schedule('meta-lead-inbox-v1', '* * * * *', $cron$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets
              WHERE name = 'meta_lead_worker_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-meta-worker-secret', (SELECT decrypted_secret
          FROM vault.decrypted_secrets WHERE name = 'meta_worker_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    ) AS request_id;
  $cron$) INTO v_job_id;
  RETURN v_job_id;
END;
$function$;

CREATE FUNCTION public.meta_deactivate_intake_schedule()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job_id bigint;
  v_count integer := 0;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('meta-lead-ads-worker-schedules', 0)
  );
  FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'meta-lead-inbox-v1' LOOP
    IF cron.unschedule(v_job_id) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'meta_intake_unschedule_failed' USING ERRCODE = '55000';
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE FUNCTION public.meta_activate_outbox_schedule()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_url text;
  v_secret text;
  v_url_count bigint;
  v_secret_count bigint;
  v_job_id bigint;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('meta-lead-ads-worker-schedules', 0)
  );
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'meta-lead-outbox-v1') THEN
    RAISE EXCEPTION 'meta_outbox_schedule_already_exists' USING ERRCODE = '42710';
  END IF;
  SELECT count(*), min(decrypted_secret) INTO v_url_count, v_url
  FROM vault.decrypted_secrets WHERE name = 'meta_outbox_worker_url';
  SELECT count(*), min(decrypted_secret) INTO v_secret_count, v_secret
  FROM vault.decrypted_secrets WHERE name = 'meta_worker_secret';
  IF v_url_count <> 1 OR v_secret_count <> 1
     OR v_url IS DISTINCT FROM
       'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/process-meta-outbox'
     OR NULLIF(btrim(v_secret), '') IS NULL THEN
    RAISE EXCEPTION 'meta_outbox_vault_config_missing_or_wrong_target'
      USING ERRCODE = '55000';
  END IF;
  SELECT cron.schedule('meta-lead-outbox-v1', '* * * * *', $cron$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets
              WHERE name = 'meta_outbox_worker_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-meta-worker-secret', (SELECT decrypted_secret
          FROM vault.decrypted_secrets WHERE name = 'meta_worker_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    ) AS request_id;
  $cron$) INTO v_job_id;
  RETURN v_job_id;
END;
$function$;

CREATE FUNCTION public.meta_deactivate_outbox_schedule()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job_id bigint;
  v_count integer := 0;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('meta-lead-ads-worker-schedules', 0)
  );
  FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'meta-lead-outbox-v1' LOOP
    IF cron.unschedule(v_job_id) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'meta_outbox_unschedule_failed' USING ERRCODE = '55000';
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.meta_activate_intake_schedule(),
  public.meta_deactivate_intake_schedule(), public.meta_activate_outbox_schedule(),
  public.meta_deactivate_outbox_schedule() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_activate_intake_schedule(),
  public.meta_deactivate_intake_schedule(), public.meta_activate_outbox_schedule(),
  public.meta_deactivate_outbox_schedule() TO service_role;

DO $postconditions$
DECLARE
  v_function pg_catalog.pg_proc%ROWTYPE;
  v_service oid := 'service_role'::pg_catalog.regrole;
  v_owner oid := current_user::pg_catalog.regrole;
  v_table oid := 'public.meta_intake_form_approvals'::pg_catalog.regclass;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = v_table)
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid = v_table)
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_class c,
         LATERAL pg_catalog.aclexplode(c.relacl) a
       WHERE c.oid = v_table AND a.grantee NOT IN (v_owner, v_service)
     )
     OR pg_catalog.has_table_privilege('anon', v_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR pg_catalog.has_table_privilege('authenticated', v_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR NOT pg_catalog.has_table_privilege('service_role', v_table, 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', v_table, 'INSERT')
     OR pg_catalog.has_table_privilege('service_role', v_table, 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR pg_catalog.has_column_privilege('service_role', v_table, 'page_id', 'UPDATE')
     OR pg_catalog.has_column_privilege('service_role', v_table, 'form_id', 'UPDATE')
     OR pg_catalog.has_column_privilege('service_role', v_table, 'created_at', 'UPDATE')
     OR NOT pg_catalog.has_column_privilege('service_role', v_table, 'active', 'UPDATE')
     OR NOT pg_catalog.has_column_privilege('service_role', v_table, 'approved_at', 'UPDATE')
  THEN
    RAISE EXCEPTION 'meta_intake_approval_privilege_postcondition_failed' USING ERRCODE = '55000';
  END IF;
  FOR v_function IN
    SELECT p.* FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'meta_activate_intake_schedule', 'meta_deactivate_intake_schedule',
      'meta_activate_outbox_schedule', 'meta_deactivate_outbox_schedule'
    )
  LOOP
    IF NOT v_function.prosecdef OR v_function.proowner <> v_owner
       OR v_function.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
       OR pg_catalog.has_function_privilege('anon', v_function.oid, 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', v_function.oid, 'EXECUTE')
       OR NOT pg_catalog.has_function_privilege('service_role', v_function.oid, 'EXECUTE')
       OR EXISTS (
         SELECT 1 FROM pg_catalog.aclexplode(v_function.proacl) a
         WHERE a.grantee NOT IN (v_owner, v_service)
       ) THEN
      RAISE EXCEPTION 'meta_lane_function_privilege_postcondition_failed' USING ERRCODE = '55000';
    END IF;
  END LOOP;
END;
$postconditions$;
COMMIT;
