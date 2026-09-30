-- Signed webhook consent is bounded by the original durable receipt time.
-- Trusted imports retain their inbox-time contract. No tables or grants change.
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

DO $patch$
DECLARE
  v_oid oid := to_regprocedure(
    'public.meta_complete_lead_inbox(uuid,uuid,jsonb,jsonb,bigint,jsonb,jsonb)'
  );
  v_before pg_catalog.pg_proc%ROWTYPE;
  v_after pg_catalog.pg_proc%ROWTYPE;
  v_original text;
  v_expected text;
  v_definition text;
  v_anchor text;
  v_old_decl text := $old_decl$  v_rule public.meta_form_consent_rules%ROWTYPE;
  v_answer text;$old_decl$;
  v_new_decl text := $new_decl$  v_rule public.meta_form_consent_rules%ROWTYPE;
  v_consent_cutoff timestamptz;
  v_answer text;$new_decl$;
  v_old_gate text := $old_gate$    RAISE EXCEPTION 'meta_inbox_lease_invalid' USING ERRCODE = '40001';
  END IF;
  IF p_lead IS NULL$old_gate$;
  v_new_gate text := $new_gate$    RAISE EXCEPTION 'meta_inbox_lease_invalid' USING ERRCODE = '40001';
  END IF;
  IF v_inbox.source_kind = 'webhook' THEN
    IF v_inbox.source_receipt_id IS NULL THEN
      RAISE EXCEPTION 'meta_receipt_context_missing' USING ERRCODE = '22023';
    END IF;
    SELECT r.received_at INTO v_consent_cutoff
    FROM public.meta_webhook_receipts r
    WHERE r.id = v_inbox.source_receipt_id;
    IF v_consent_cutoff IS NULL THEN
      RAISE EXCEPTION 'meta_receipt_context_missing' USING ERRCODE = '22023';
    END IF;
  ELSIF v_inbox.source_kind = 'trusted_import' THEN
    v_consent_cutoff := v_inbox.received_at;
  ELSE
    RAISE EXCEPTION 'meta_inbox_source_invalid' USING ERRCODE = '22023';
  END IF;
  IF p_lead IS NULL$new_gate$;
  v_old_rule text := $old_rule$      AND approved_at <= v_inbox.received_at;$old_rule$;
  v_new_rule text := $new_rule$      AND approved_at <= v_consent_cutoff;$new_rule$;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'STOP: meta_complete_lead_inbox signature missing';
  END IF;
  IF NOT pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended('meta-lead-ads-worker-schedules', 0)
  ) OR EXISTS (
    SELECT 1 FROM cron.job
    WHERE active AND (
      command LIKE '%process-meta-lead%'
      OR command LIKE '%process-meta-outbox%'
    )
  ) OR EXISTS (
    SELECT 1 FROM public.meta_lead_inbox WHERE status = 'processing'
  ) THEN
    RAISE EXCEPTION 'STOP: Meta processing must be paused';
  END IF;
  SELECT * INTO STRICT v_before FROM pg_catalog.pg_proc WHERE oid = v_oid;
  v_original := pg_catalog.replace(v_before.prosrc, E'\r\n', E'\n');
  IF pg_catalog.md5(v_original) IS DISTINCT FROM '745115e8dbf4f61e0a9db0daa4731214'
     OR NOT v_before.prosecdef OR v_before.proretset
     OR v_before.prokind <> 'f'
     OR v_before.prorettype <> 'uuid'::regtype
     OR v_before.prolang IS DISTINCT FROM (
       SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql'
     )
     OR v_before.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
     OR pg_catalog.has_function_privilege('anon', v_oid, 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', v_oid, 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'STOP: meta_complete_lead_inbox contract drift';
  END IF;

  v_definition := pg_catalog.replace(
    pg_catalog.pg_get_functiondef(v_oid), E'\r\n', E'\n'
  );
  v_expected := v_original;
  FOREACH v_anchor IN ARRAY ARRAY[v_old_decl, v_old_gate, v_old_rule] LOOP
    IF length(v_original) - length(pg_catalog.replace(v_original, v_anchor, ''))
       <> length(v_anchor) THEN
      RAISE EXCEPTION 'STOP: consent patch anchor missing or repeated';
    END IF;
  END LOOP;
  v_expected := pg_catalog.replace(v_expected, v_old_decl, v_new_decl);
  v_expected := pg_catalog.replace(v_expected, v_old_gate, v_new_gate);
  v_expected := pg_catalog.replace(v_expected, v_old_rule, v_new_rule);
  v_definition := pg_catalog.replace(v_definition, v_old_decl, v_new_decl);
  v_definition := pg_catalog.replace(v_definition, v_old_gate, v_new_gate);
  v_definition := pg_catalog.replace(v_definition, v_old_rule, v_new_rule);
  EXECUTE v_definition;

  SELECT * INTO STRICT v_after FROM pg_catalog.pg_proc WHERE oid = v_oid;
  IF pg_catalog.replace(v_after.prosrc, E'\r\n', E'\n')
       IS DISTINCT FROM v_expected
     OR pg_catalog.md5(pg_catalog.replace(v_after.prosrc, E'\r\n', E'\n'))
       IS DISTINCT FROM '4ace58a9c6c4c6dc480ddb389dd90506'
     OR (to_jsonb(v_before) - 'prosrc')
       IS DISTINCT FROM (to_jsonb(v_after) - 'prosrc') THEN
    RAISE EXCEPTION 'STOP: consent patch postcondition failed';
  END IF;
END;
$patch$;

COMMIT;
