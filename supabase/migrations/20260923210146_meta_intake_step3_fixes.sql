-- Step 3: local forward-migration artifact; execution requires separate approval.
-- Only the legacy receipt admission predicate changes. No data, grants or schedules change.
-- Failed assertions roll back the transaction. After application, retain the stricter
-- predicate while workers remain disabled; any reverse patch requires separate review.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $step3$
DECLARE
  v_oid oid := to_regprocedure(
    'public.meta_complete_webhook_receipt(uuid,uuid,jsonb,jsonb,integer)'
  );
  v_before pg_catalog.pg_proc%ROWTYPE;
  v_after pg_catalog.pg_proc%ROWTYPE;
  v_definition text;
  v_old text :=
    E'        WHERE d.form_id = v_form_id AND d.active AND d.approved_at IS NOT NULL\n';
  v_new text :=
    E'        WHERE d.form_id = v_form_id AND d.active AND d.approved_at IS NOT NULL\n          AND d.approved_at <= v_receipt.received_at\n';
  v_snapshot_before jsonb;
  v_snapshot_after jsonb;
  v_snapshot_sql text := $snapshot$
    WITH ns AS (
      SELECT oid FROM pg_catalog.pg_namespace
      WHERE nspname IN (
        'public', 'auth', 'storage', 'extensions', 'cron', 'net',
        'vault', 'supabase_migrations'
      )
    ), rels AS (
      SELECT oid FROM pg_catalog.pg_class
      WHERE relnamespace IN (SELECT oid FROM ns)
    )
    SELECT jsonb_build_object(
      'namespaces', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid)
        FROM pg_catalog.pg_namespace x WHERE x.oid IN (SELECT oid FROM ns)),
      'functions', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid)
        FROM pg_catalog.pg_proc x
        WHERE x.pronamespace IN (SELECT oid FROM ns) AND x.oid <> $1),
      'relations', (SELECT jsonb_agg(
        to_jsonb(x) - ARRAY[
          'relpages','reltuples','relallvisible','relallfrozen',
          'relfrozenxid','relminmxid'
        ]::text[] ORDER BY x.oid)
        FROM pg_catalog.pg_class x WHERE x.oid IN (SELECT oid FROM rels)),
      'columns', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.attrelid, x.attnum)
        FROM pg_catalog.pg_attribute x WHERE x.attrelid IN (SELECT oid FROM rels)),
      'defaults', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid)
        FROM pg_catalog.pg_attrdef x WHERE x.adrelid IN (SELECT oid FROM rels)),
      'constraints', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid)
        FROM pg_catalog.pg_constraint x WHERE x.connamespace IN (SELECT oid FROM ns)),
      'indexes', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.indexrelid)
        FROM pg_catalog.pg_index x WHERE x.indrelid IN (SELECT oid FROM rels)),
      'triggers', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid)
        FROM pg_catalog.pg_trigger x WHERE x.tgrelid IN (SELECT oid FROM rels)),
      'policies', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid)
        FROM pg_catalog.pg_policy x WHERE x.polrelid IN (SELECT oid FROM rels)),
      'types', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid)
        FROM pg_catalog.pg_type x WHERE x.typnamespace IN (SELECT oid FROM ns)),
      'enums', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid)
        FROM pg_catalog.pg_enum x JOIN pg_catalog.pg_type t ON t.oid = x.enumtypid
        WHERE t.typnamespace IN (SELECT oid FROM ns)),
      'sequences', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.seqrelid)
        FROM pg_catalog.pg_sequence x WHERE x.seqrelid IN (SELECT oid FROM rels)),
      'rules', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid)
        FROM pg_catalog.pg_rewrite x WHERE x.ev_class IN (SELECT oid FROM rels)),
      'default_privileges', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid)
        FROM pg_catalog.pg_default_acl x),
      'comments', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.classoid, x.objoid, x.objsubid)
        FROM pg_catalog.pg_description x),
      'extensions', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.oid)
        FROM pg_catalog.pg_extension x),
      'history', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.version)
        FROM supabase_migrations.schema_migrations x),
      'schedules', (SELECT jsonb_agg(to_jsonb(x) ORDER BY x.jobid)
        FROM cron.job x)
    )
  $snapshot$;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'STOP: receipt function missing';
  END IF;
  IF NOT pg_try_advisory_xact_lock(
    hashtextextended('meta-lead-ads-worker-schedules', 0)
  ) THEN
    RAISE EXCEPTION 'STOP: concurrent Meta schedule operation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE active AND (
      jobname IN ('meta-lead-inbox-v1', 'meta-lead-outbox-v1')
      OR command LIKE '%process-meta-lead%'
      OR command LIKE '%process-meta-outbox%'
    )
  ) OR EXISTS (
    SELECT 1 FROM public.meta_webhook_receipts WHERE status = 'processing'
  ) OR EXISTS (
    SELECT 1 FROM public.meta_lead_inbox WHERE status = 'processing'
  ) OR EXISTS (
    SELECT 1 FROM public.meta_integration_outbox WHERE status = 'processing'
  ) THEN
    RAISE EXCEPTION 'STOP: Meta processing must remain dormant';
  END IF;
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations
      WHERE version IN ('20260922200843', '20260923155338')) <> 2
     OR to_regclass('public.meta_intake_form_approvals') IS NULL THEN
    RAISE EXCEPTION 'STOP: installed prerequisites missing';
  END IF;

  SELECT * INTO STRICT v_before FROM pg_catalog.pg_proc WHERE oid = v_oid;
  IF md5(replace(v_before.prosrc, E'\r\n', E'\n'))
       IS DISTINCT FROM '66d8854b29c05cc025aa16f677685dfa'
     OR v_before.prosecdef OR v_before.proretset
     OR v_before.prokind <> 'f'
     OR v_before.prorettype <> 'text'::regtype
     OR v_before.prolang IS DISTINCT FROM (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
     OR v_before.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
     OR has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'STOP: post-Step-2 receipt contract mismatch';
  END IF;

  EXECUTE v_snapshot_sql INTO v_snapshot_before USING v_oid;
  v_definition := replace(pg_get_functiondef(v_oid), E'\r\n', E'\n');
  IF (length(v_definition) - length(replace(v_definition, v_old, '')))
       / length(v_old) <> 1 THEN
    RAISE EXCEPTION 'STOP: patch anchor must occur exactly once';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);

  SELECT * INTO STRICT v_after FROM pg_catalog.pg_proc WHERE oid = v_oid;
  IF md5(replace(v_after.prosrc, E'\r\n', E'\n'))
       IS DISTINCT FROM '9cef12bf2ca2b0a737297f2801caae70' THEN
    RAISE EXCEPTION 'STOP: patched receipt fingerprint mismatch';
  END IF;
  IF (to_jsonb(v_before) - 'prosrc')
       IS DISTINCT FROM (to_jsonb(v_after) - 'prosrc') THEN
    RAISE EXCEPTION 'STOP: receipt metadata changed';
  END IF;
  EXECUTE v_snapshot_sql INTO v_snapshot_after USING v_oid;
  IF v_snapshot_after IS DISTINCT FROM v_snapshot_before THEN
    RAISE EXCEPTION 'STOP: preserved object changed';
  END IF;

  PERFORM set_config('wm.step3_preserved_hash', md5(v_snapshot_after::text), true);
END;
$step3$;

SELECT jsonb_build_object(
  'status', 'STEP3_SCHEMA_APPLY_PASS',
  'receipt_before_md5', '66d8854b29c05cc025aa16f677685dfa',
  'receipt_after_md5', '9cef12bf2ca2b0a737297f2801caae70',
  'preserved_catalog_and_history', 'PASS',
  'preserved_hash', current_setting('wm.step3_preserved_hash'),
  'outbound_switches', 'NOT_READ_KEEP_DISABLED',
  'semantic_behavior', 'NOT_EXECUTED'
) AS result;
COMMIT;
