-- NOT RUN as part of the file-creation sprint. This is an isolated SQL contract
-- test, not a production smoke test, a worker test, or concurrency/load proof.
-- Future execution requires separate authorization and an EMPTY disposable DB
-- named wm_meta_step2_test with both Meta migrations and their prerequisites.
-- Before connecting, verify network egress is blocked outside PostgreSQL and
-- pg_cron starts with cron.launch_active_jobs=off and cron.database_name pointing
-- to this disposable DB. SQL cannot prove the external network restriction.
-- Fake Vault entries below contain no real credentials. Schedule commands are
-- inspected as text ONLY; the cron launcher must remain disabled throughout.
-- ROLLBACK is cleanup, not the safeguard against outbound HTTP execution.
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SET LOCAL request.headers = '{}';

DO $guard$
DECLARE
  v_name text;
  v_has_rows boolean;
BEGIN
  IF current_database() IS DISTINCT FROM 'wm_meta_step2_test'
     OR current_setting('cron.database_name', true) IS DISTINCT FROM 'wm_meta_step2_test'
     OR current_setting('cron.launch_active_jobs', true) IS DISTINCT FROM 'off' THEN
    RAISE EXCEPTION 'isolated_meta_test_database_and_disabled_cron_required';
  END IF;
  FOREACH v_name IN ARRAY ARRAY[
    'public.meta_webhook_receipts', 'public.meta_lead_inbox',
    'public.meta_form_mapping_revisions', 'public.meta_form_destinations',
    'public.meta_form_consent_rules', 'public.meta_qualification_events',
    'public.meta_stage_transitions', 'public.meta_integration_outbox',
    'public.meta_ghl_contact_links', 'public.meta_intake_form_approvals',
    'public.leads', 'public.lead_consent_events', 'cron.job', 'vault.secrets'
  ] LOOP
    IF to_regclass(v_name) IS NULL THEN
      RAISE EXCEPTION 'isolated_meta_test_prerequisite_missing: %', v_name;
    END IF;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s)', v_name::regclass) INTO v_has_rows;
    IF v_has_rows THEN RAISE EXCEPTION 'isolated_meta_test_requires_empty_table: %', v_name; END IF;
  END LOOP;
END;
$guard$;

-- Temporary fixture helper calls only SQL RPCs; no Edge Functions or vendors.
CREATE FUNCTION pg_temp.meta_admit_fixture(
  p_key text, p_page text, p_form text, p_global_test boolean DEFAULT false,
  p_test_forms text[] DEFAULT ARRAY['reserved-test-form'],
  p_older_receipt boolean DEFAULT false
)
RETURNS public.meta_lead_inbox LANGUAGE plpgsql AS $$
DECLARE
  v_body bytea := convert_to(jsonb_build_object('fixture', p_key)::text, 'UTF8');
  v_id uuid;
  v_receipt public.meta_webhook_receipts%ROWTYPE;
  v_inbox public.meta_lead_inbox%ROWTYPE;
BEGIN
  v_id := public.meta_receive_webhook_receipt(
    encode(v_body, 'base64'), encode(sha256(v_body), 'hex'),
    p_global_test, p_test_forms, '{}'::text[], true
  );
  IF p_older_receipt THEN
    UPDATE public.meta_webhook_receipts SET received_at = now() - interval '2 minutes'
    WHERE id = v_id;
  END IF;
  SELECT * INTO STRICT v_receipt FROM public.meta_claim_webhook_receipts(1);
  IF v_receipt.id IS DISTINCT FROM v_id THEN RAISE EXCEPTION 'fixture_claim_wrong_receipt'; END IF;
  PERFORM public.meta_complete_webhook_receipt(
    v_id, v_receipt.lease_token,
    jsonb_build_array(jsonb_build_object(
      'leadgen_id', p_key, 'page_id', p_page, 'form_id', p_form,
      'entry_index', 0, 'change_index', 0
    )), '[]'::jsonb, 0
  );
  SELECT * INTO STRICT v_inbox FROM public.meta_lead_inbox WHERE platform_lead_id = p_key;
  RETURN v_inbox;
END;
$$;

DO $contracts$
DECLARE
  v_name text;
  v_role text;
  v_function pg_catalog.pg_proc%ROWTYPE;
  v_denied boolean;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.meta_intake_form_approvals'::regclass)
     OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.meta_intake_form_approvals'::regclass)
     OR EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.meta_intake_form_approvals'::regclass AND contype = 'f')
     OR to_regclass('public.meta_intake_form_approvals_form_idx') IS NULL THEN
    RAISE EXCEPTION 'intake_registry_schema_contract_failed';
  END IF;
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, 'public.meta_intake_form_approvals', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege(v_role, 'public.meta_intake_form_approvals', 'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'intake_registry_browser_grant';
    END IF;
  END LOOP;
  IF NOT has_table_privilege('service_role', 'public.meta_intake_form_approvals', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.meta_intake_form_approvals', 'INSERT')
     OR has_table_privilege('service_role', 'public.meta_intake_form_approvals', 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR NOT has_column_privilege('service_role', 'public.meta_intake_form_approvals', 'active', 'UPDATE')
     OR NOT has_column_privilege('service_role', 'public.meta_intake_form_approvals', 'approved_at', 'UPDATE') THEN
    RAISE EXCEPTION 'intake_registry_service_grant_failed';
  END IF;
  FOREACH v_name IN ARRAY ARRAY['page_id', 'form_id', 'created_at'] LOOP
    IF has_column_privilege('service_role', 'public.meta_intake_form_approvals', v_name, 'UPDATE') THEN
      RAISE EXCEPTION 'intake_registry_identity_mutable';
    END IF;
  END LOOP;
  FOREACH v_name IN ARRAY ARRAY[
    'meta_activate_intake_schedule', 'meta_deactivate_intake_schedule',
    'meta_activate_outbox_schedule', 'meta_deactivate_outbox_schedule'
  ] LOOP
    SELECT * INTO STRICT v_function FROM pg_proc
    WHERE oid = to_regprocedure('public.' || v_name || '()');
    IF NOT v_function.prosecdef OR v_function.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
       OR v_function.pronargs <> 0 OR v_function.proretset
       OR v_function.prorettype <> (CASE WHEN v_name LIKE 'meta_activate_%' THEN 'bigint'::regtype ELSE 'integer'::regtype END)
       OR has_function_privilege('anon', v_function.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', v_function.oid, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_function.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'lane_function_contract_failed: %', v_name;
    END IF;
  END LOOP;
  IF (SELECT md5(replace(prosrc, E'\r\n', E'\n')) FROM pg_proc
      WHERE oid = 'public.meta_complete_webhook_receipt(uuid,uuid,jsonb,jsonb,integer)'::regprocedure)
       IS DISTINCT FROM '66d8854b29c05cc025aa16f677685dfa' THEN
    RAISE EXCEPTION 'receipt_function_fingerprint_failed';
  END IF;
  v_denied := false;
  BEGIN
    INSERT INTO public.meta_intake_form_approvals(page_id, form_id, active)
    VALUES ('invalid-page', 'invalid-form', true);
  EXCEPTION WHEN check_violation THEN v_denied := true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'active_approval_without_timestamp_accepted'; END IF;
END;
$contracts$;

DO $intake$
DECLARE
  v_inbox public.meta_lead_inbox%ROWTYPE;
  v_claim public.meta_lead_inbox%ROWTYPE;
  v_lead_id uuid;
  v_live_lead uuid;
  v_test_lead uuid;
  v_no_consent_lead uuid;
  v_actor uuid := gen_random_uuid();
  v_consents jsonb;
  v_lead jsonb;
  v_attribution jsonb;
  v_graph jsonb;
  v_count integer := 0;
  v_denied boolean;
BEGIN
  INSERT INTO public.meta_intake_form_approvals(page_id, form_id, active, approved_at)
  VALUES ('intake-page', 'intake-form', true, now() - interval '1 minute');
  INSERT INTO public.meta_form_consent_rules(
    form_id, purpose, question_label, granted_values, declined_values,
    consent_schema_version, privacy_policy_version, disclosure_version, approved_at
  )
  SELECT 'intake-form', purpose, 'I agree', ARRAY['Yes'], ARRAY['No'],
    'fixture-v1', 'fixture-v1', 'fixture-v1', now() - interval '1 minute'
  FROM unnest(ARRAY['marketing_communications', 'contractor_sharing', 'advertising_measurement']) AS purpose;

  SELECT * INTO v_inbox FROM pg_temp.meta_admit_fixture('step2-live', 'intake-page', 'intake-form');
  IF v_inbox.is_test OR v_inbox.status <> 'pending' THEN RAISE EXCEPTION 'intake_without_destination_failed'; END IF;
  SELECT * INTO v_inbox FROM pg_temp.meta_admit_fixture('step2-no-consent', 'intake-page', 'intake-form');
  IF v_inbox.is_test OR v_inbox.status <> 'pending' THEN RAISE EXCEPTION 'intake_no_consent_admission_failed'; END IF;
  SELECT * INTO v_inbox FROM pg_temp.meta_admit_fixture('step2-test', 'intake-page', 'intake-form', true);
  IF NOT v_inbox.is_test OR v_inbox.status <> 'pending' THEN RAISE EXCEPTION 'global_test_isolation_failed'; END IF;
  SELECT * INTO v_inbox FROM pg_temp.meta_admit_fixture('step2-wrong-page', 'other-page', 'intake-form');
  IF NOT v_inbox.is_test OR v_inbox.status <> 'quarantined' THEN RAISE EXCEPTION 'wrong_page_admitted'; END IF;
  SELECT * INTO v_inbox FROM pg_temp.meta_admit_fixture('step2-old', 'intake-page', 'intake-form', false, ARRAY['reserved-test-form'], true);
  IF NOT v_inbox.is_test OR v_inbox.status <> 'quarantined' THEN RAISE EXCEPTION 'approval_retroactively_admitted_receipt'; END IF;
  SELECT * INTO v_inbox FROM pg_temp.meta_admit_fixture('step2-collision', 'intake-page', 'intake-form', false, ARRAY['intake-form']);
  IF NOT v_inbox.is_test OR v_inbox.status IS DISTINCT FROM 'quarantined'
     OR v_inbox.last_error_code IS DISTINCT FROM 'test_live_identifier_conflict' THEN
    RAISE EXCEPTION 'test_live_collision_not_quarantined';
  END IF;
  SELECT * INTO v_inbox FROM pg_temp.meta_admit_fixture('step2-missing-config', 'intake-page', 'intake-form', false, '{}'::text[]);
  IF NOT v_inbox.is_test OR v_inbox.status IS DISTINCT FROM 'quarantined'
     OR v_inbox.last_error_code IS DISTINCT FROM 'routing_config_missing' THEN
    RAISE EXCEPTION 'missing_test_identifiers_not_quarantined';
  END IF;

  -- Only the three approved pending cases are claimable. The rest stay isolated.
  FOR v_claim IN SELECT * FROM public.meta_claim_lead_inbox(10) LOOP
    v_count := v_count + 1;
    IF v_claim.platform_lead_id NOT IN ('step2-live', 'step2-test', 'step2-no-consent') THEN
      RAISE EXCEPTION 'quarantined_inbox_was_claimed';
    END IF;
    v_lead := jsonb_build_object(
      'session_id', 'fbla_' || v_claim.platform_lead_id,
      'first_name', 'Synthetic', 'last_name', 'Fixture',
      'email', v_claim.platform_lead_id || '@example.test'
    );
    v_attribution := jsonb_build_object(
      'source_platform', 'meta', 'source_channel', 'lead_ads',
      'platform_lead_id', v_claim.platform_lead_id, 'form_id', v_claim.form_id,
      'raw_payload', jsonb_build_object('inbox_id', v_claim.id)
    );
    v_graph := jsonb_build_object('id', v_claim.platform_lead_id, 'form_id', v_claim.form_id,
      'field_data', '[{"name":"Unmapped fixture question","values":["Retain privately"]}]'::jsonb);
    v_consents := '[]'::jsonb;
    IF v_claim.platform_lead_id = 'step2-live' THEN
      SELECT jsonb_agg(jsonb_build_object('purpose', purpose, 'question_label', 'I agree', 'answer_value', 'Yes'))
      INTO v_consents FROM unnest(ARRAY['marketing_communications', 'contractor_sharing', 'advertising_measurement']) AS purpose;
      -- Invalid consent raises AFTER native persistence; the nested transaction
      -- must roll that persistence back, retaining the lease for safe recovery.
      v_denied := false;
      BEGIN
        PERFORM public.meta_complete_lead_inbox(v_claim.id, v_claim.lease_token, v_lead,
          v_attribution, NULL, '[{"purpose":"marketing_communications","question_label":"Unknown disclosure","answer_value":"Yes"}]'::jsonb, v_graph);
      EXCEPTION WHEN invalid_parameter_value THEN v_denied := true;
      END;
      IF NOT v_denied
         OR EXISTS (SELECT 1 FROM public.leads WHERE session_id = v_lead ->> 'session_id')
         OR EXISTS (SELECT 1 FROM public.lead_attribution_details WHERE platform_lead_id = v_claim.platform_lead_id)
         OR NOT EXISTS (SELECT 1 FROM public.meta_lead_inbox WHERE id = v_claim.id AND status = 'processing' AND lease_token = v_claim.lease_token) THEN
        RAISE EXCEPTION 'failed_completion_was_not_atomic';
      END IF;
    END IF;
    v_lead_id := public.meta_complete_lead_inbox(v_claim.id, v_claim.lease_token,
      v_lead, v_attribution, NULL, v_consents, v_graph);
    IF NOT EXISTS (
      SELECT 1 FROM public.meta_lead_inbox i
      JOIN public.leads l ON l.id = i.lead_id
      JOIN public.lead_attribution_details a ON a.id = i.attribution_id AND a.lead_id = l.id
      WHERE i.id = v_claim.id AND i.status = 'done' AND l.id = v_lead_id
        AND l.client_slug = 'direct' AND l.is_test = v_claim.is_test
        AND a.platform_lead_id = v_claim.platform_lead_id AND i.graph_payload = v_graph
    ) THEN RAISE EXCEPTION 'canonical_intake_persistence_failed'; END IF;
    PERFORM public.meta_set_lead_funnel_stage(v_lead_id, 'qualified', v_actor);
    IF EXISTS (SELECT 1 FROM public.meta_qualification_events WHERE lead_id = v_lead_id)
       OR EXISTS (SELECT 1 FROM public.meta_integration_outbox WHERE lead_id = v_lead_id) THEN
      RAISE EXCEPTION 'intake_only_created_delivery_work';
    END IF;
    IF v_claim.platform_lead_id = 'step2-live' THEN v_live_lead := v_lead_id;
    ELSIF v_claim.platform_lead_id = 'step2-test' THEN v_test_lead := v_lead_id;
    ELSE v_no_consent_lead := v_lead_id;
    END IF;
  END LOOP;
  IF v_count <> 3 OR (SELECT count(*) FROM public.leads) <> 3
     OR (SELECT count(*) FROM public.lead_consent_events WHERE lead_id = v_live_lead AND decision = 'granted') <> 3
     OR EXISTS (SELECT 1 FROM public.lead_consent_events WHERE lead_id = v_no_consent_lead)
     OR EXISTS (SELECT 1 FROM public.meta_form_destinations) THEN
    RAISE EXCEPTION 'intake_client_independence_or_consent_contract_failed';
  END IF;

  -- Future GHL onboarding: route creation alone must not enqueue historical
  -- qualifications. Explicit reconciliation may enqueue only eligible live leads.
  INSERT INTO public.clients(name, slug, is_active) VALUES ('Step 2 fixture', 'step2-fixture', true);
  INSERT INTO public.meta_form_destinations(form_id, client_slug, location_id, active, approved_at)
  VALUES ('intake-form', 'step2-fixture', 'fixture-location', true, now());
  IF EXISTS (SELECT 1 FROM public.meta_integration_outbox) THEN RAISE EXCEPTION 'destination_created_work_implicitly'; END IF;
  PERFORM public.meta_set_lead_funnel_stage(v_test_lead, 'qualified', v_actor);
  PERFORM public.meta_set_lead_funnel_stage(v_no_consent_lead, 'qualified', v_actor);
  IF EXISTS (SELECT 1 FROM public.meta_qualification_events WHERE lead_id = v_test_lead)
     OR EXISTS (SELECT 1 FROM public.meta_integration_outbox WHERE lead_id IN (v_test_lead, v_no_consent_lead)) THEN
    RAISE EXCEPTION 'test_or_consent_gap_reached_outbox';
  END IF;
  PERFORM public.meta_queue_qualification(v_live_lead, v_actor, true);
  PERFORM public.meta_queue_qualification(v_live_lead, v_actor, true);
  IF (SELECT count(*) FROM public.meta_integration_outbox WHERE lead_id = v_live_lead) <> 2
     OR (SELECT count(DISTINCT job_kind) FROM public.meta_integration_outbox WHERE lead_id = v_live_lead) <> 2
     OR (SELECT count(*) FROM public.meta_qualification_events WHERE lead_id = v_live_lead) <> 1 THEN
    RAISE EXCEPTION 'future_onboarding_reconciliation_not_deduplicated';
  END IF;

  SELECT * INTO v_inbox FROM pg_temp.meta_admit_fixture('step2-wrong-page-after-route', 'other-page', 'intake-form');
  IF NOT v_inbox.is_test OR v_inbox.status <> 'quarantined' THEN RAISE EXCEPTION 'destination_bypassed_page_restriction'; END IF;
  UPDATE public.meta_intake_form_approvals SET active = false WHERE form_id = 'intake-form';
  SELECT * INTO v_inbox FROM pg_temp.meta_admit_fixture('step2-inactive', 'intake-page', 'intake-form');
  IF NOT v_inbox.is_test OR v_inbox.status <> 'quarantined' THEN RAISE EXCEPTION 'inactive_registration_fell_back'; END IF;
  UPDATE public.meta_intake_form_approvals SET active = true, approved_at = now() + interval '1 minute' WHERE form_id = 'intake-form';
  SELECT * INTO v_inbox FROM pg_temp.meta_admit_fixture('step2-future', 'intake-page', 'intake-form');
  IF NOT v_inbox.is_test OR v_inbox.status <> 'quarantined' THEN RAISE EXCEPTION 'future_approval_fell_back'; END IF;
  UPDATE public.meta_intake_form_approvals SET approved_at = now() WHERE form_id = 'intake-form';
  SELECT * INTO v_inbox FROM pg_temp.meta_admit_fixture('step2-equal-time', 'intake-page', 'intake-form');
  IF v_inbox.is_test OR v_inbox.status <> 'pending' THEN RAISE EXCEPTION 'equal_approval_time_not_admitted'; END IF;
  INSERT INTO public.meta_form_destinations(form_id, client_slug, location_id, active, approved_at)
  VALUES ('legacy-form', 'step2-fixture', 'fixture-location', true, now());
  SELECT * INTO v_inbox FROM pg_temp.meta_admit_fixture('step2-legacy', 'legacy-page', 'legacy-form');
  IF v_inbox.is_test OR v_inbox.status <> 'pending' THEN RAISE EXCEPTION 'unregistered_legacy_fallback_failed'; END IF;
  -- Even an inactive row for a DIFFERENT Page makes this form registered.
  INSERT INTO public.meta_intake_form_approvals(page_id, form_id) VALUES ('registered-other-page', 'legacy-form');
  SELECT * INTO v_inbox FROM pg_temp.meta_admit_fixture('step2-legacy-now-registered', 'legacy-page', 'legacy-form');
  IF NOT v_inbox.is_test OR v_inbox.status <> 'quarantined' THEN RAISE EXCEPTION 'registration_did_not_override_legacy'; END IF;
END;
$intake$;

CREATE FUNCTION pg_temp.meta_assert_job(p_id bigint, p_lane text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_job cron.job%ROWTYPE;
  v_url_key text := CASE p_lane WHEN 'intake' THEN 'meta_lead_worker_url' ELSE 'meta_outbox_worker_url' END;
  v_job_name text := CASE p_lane WHEN 'intake' THEN 'meta-lead-inbox-v1' ELSE 'meta-lead-outbox-v1' END;
  v_command text;
  v_owner text;
BEGIN
  SELECT * INTO STRICT v_job FROM cron.job WHERE jobid = p_id;
  SELECT pg_get_userbyid(proowner) INTO STRICT v_owner FROM pg_proc
  WHERE oid = to_regprocedure('public.meta_activate_' || p_lane || '_schedule()');
  v_command := format($command$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = %L),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-meta-worker-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'meta_worker_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    ) AS request_id;
  $command$, v_url_key);
  IF v_job.jobname IS DISTINCT FROM v_job_name OR v_job.schedule IS DISTINCT FROM '* * * * *'
     OR v_job.database IS DISTINCT FROM current_database() OR NOT v_job.active
     OR v_job.username IS DISTINCT FROM v_owner
     OR regexp_replace(v_job.command, '\s+', '', 'g') IS DISTINCT FROM regexp_replace(v_command, '\s+', '', 'g')
     OR position('step2-fake-worker-secret' IN v_job.command) <> 0 THEN
    RAISE EXCEPTION 'lane_job_contract_failed: %', p_lane;
  END IF;
  RETURN to_jsonb(v_job);
END;
$$;

DO $schedules$
DECLARE
  v_lane text;
  v_other text;
  v_url_key text;
  v_url text;
  v_other_key text;
  v_other_url text;
  v_job bigint;
  v_other_job bigint;
  v_count integer;
  v_before jsonb;
  v_other_before jsonb;
  v_denied boolean;
  v_combined record;
BEGIN
  FOREACH v_lane IN ARRAY ARRAY['intake', 'outbox'] LOOP
    v_other := CASE v_lane WHEN 'intake' THEN 'outbox' ELSE 'intake' END;
    v_url_key := CASE v_lane WHEN 'intake' THEN 'meta_lead_worker_url' ELSE 'meta_outbox_worker_url' END;
    v_url := 'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/' ||
      CASE v_lane WHEN 'intake' THEN 'process-meta-lead' ELSE 'process-meta-outbox' END;
    v_other_key := CASE v_lane WHEN 'intake' THEN 'meta_outbox_worker_url' ELSE 'meta_lead_worker_url' END;
    v_other_url := 'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/' ||
      CASE v_lane WHEN 'intake' THEN 'process-meta-outbox' ELSE 'process-meta-lead' END;

    -- Each subcase rolls its fake Vault rows/jobs back with a dedicated sentinel.
    -- No other exception is swallowed; a failed assertion aborts the whole test.
    BEGIN
      IF EXISTS (SELECT 1 FROM cron.job) OR EXISTS (SELECT 1 FROM vault.secrets) THEN
        RAISE EXCEPTION 'scheduler_fixture_not_empty';
      END IF;
      v_denied := false;
      BEGIN
        EXECUTE format('SELECT public.meta_activate_%s_schedule()', v_lane);
      EXCEPTION WHEN object_not_in_prerequisite_state THEN v_denied := true;
      END;
      IF NOT v_denied OR EXISTS (SELECT 1 FROM cron.job) THEN RAISE EXCEPTION 'missing_vault_config_not_rejected'; END IF;

      BEGIN
        PERFORM vault.create_secret('step2-fake-worker-secret', 'meta_worker_secret');
        PERFORM vault.create_secret('https://wrong-target.invalid/functions/v1/no-worker', v_url_key);
        v_denied := false;
        BEGIN
          EXECUTE format('SELECT public.meta_activate_%s_schedule()', v_lane);
        EXCEPTION WHEN object_not_in_prerequisite_state THEN v_denied := true;
        END;
        IF NOT v_denied OR EXISTS (SELECT 1 FROM cron.job) THEN RAISE EXCEPTION 'wrong_vault_target_not_rejected'; END IF;
        RAISE EXCEPTION 'rollback_wrong_target_fixture' USING ERRCODE = 'PZ001';
      EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
      END;
      BEGIN
        PERFORM vault.create_secret('   ', 'meta_worker_secret');
        PERFORM vault.create_secret(v_url, v_url_key);
        v_denied := false;
        BEGIN
          EXECUTE format('SELECT public.meta_activate_%s_schedule()', v_lane);
        EXCEPTION WHEN object_not_in_prerequisite_state THEN v_denied := true;
        END;
        IF NOT v_denied OR EXISTS (SELECT 1 FROM cron.job) THEN RAISE EXCEPTION 'blank_worker_secret_not_rejected'; END IF;
        RAISE EXCEPTION 'rollback_blank_secret_fixture' USING ERRCODE = 'PZ001';
      EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
      END;

      PERFORM vault.create_secret('step2-fake-worker-secret', 'meta_worker_secret');
      PERFORM vault.create_secret(v_url, v_url_key);
      IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = v_other_key) THEN
        RAISE EXCEPTION 'independence_case_has_other_lane_url';
      END IF;
      EXECUTE format('SELECT public.meta_activate_%s_schedule()', v_lane) INTO v_job;
      v_before := pg_temp.meta_assert_job(v_job, v_lane);
      IF (SELECT count(*) FROM cron.job) <> 1 THEN RAISE EXCEPTION 'single_activation_created_other_lane'; END IF;
      v_denied := false;
      BEGIN
        EXECUTE format('SELECT public.meta_activate_%s_schedule()', v_lane);
      EXCEPTION WHEN duplicate_object THEN v_denied := true;
      END;
      IF NOT v_denied OR v_before IS DISTINCT FROM pg_temp.meta_assert_job(v_job, v_lane) THEN
        RAISE EXCEPTION 'duplicate_activation_mutated_job';
      END IF;
      PERFORM vault.create_secret(v_other_url, v_other_key);
      -- The original combined activation deliberately still rejects a partial
      -- configuration. The new opposite-lane activator resolves that dependency.
      v_denied := false;
      BEGIN
        PERFORM public.meta_activate_worker_schedules();
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'meta_worker_schedule_already_exists' THEN RAISE; END IF;
        v_denied := true;
      END;
      IF NOT v_denied OR (SELECT count(*) FROM cron.job) <> 1
         OR v_before IS DISTINCT FROM pg_temp.meta_assert_job(v_job, v_lane) THEN
        RAISE EXCEPTION 'combined_partial_activation_changed_existing_lane';
      END IF;
      EXECUTE format('SELECT public.meta_activate_%s_schedule()', v_other) INTO v_other_job;
      v_other_before := pg_temp.meta_assert_job(v_other_job, v_other);
      IF v_before IS DISTINCT FROM pg_temp.meta_assert_job(v_job, v_lane) OR (SELECT count(*) FROM cron.job) <> 2 THEN
        RAISE EXCEPTION 'opposite_activation_changed_existing_lane';
      END IF;
      EXECUTE format('SELECT public.meta_deactivate_%s_schedule()', v_other) INTO v_count;
      IF v_count <> 1 OR v_before IS DISTINCT FROM pg_temp.meta_assert_job(v_job, v_lane)
         OR EXISTS (SELECT 1 FROM cron.job WHERE jobid = v_other_job) THEN
        RAISE EXCEPTION 'opposite_deactivation_changed_existing_lane';
      END IF;
      EXECUTE format('SELECT public.meta_deactivate_%s_schedule()', v_other) INTO v_count;
      IF v_count <> 0 OR v_before IS DISTINCT FROM pg_temp.meta_assert_job(v_job, v_lane) THEN
        RAISE EXCEPTION 'repeated_deactivation_changed_existing_lane';
      END IF;

      EXECUTE format('SELECT public.meta_activate_%s_schedule()', v_other) INTO v_other_job;
      v_other_before := pg_temp.meta_assert_job(v_other_job, v_other);
      EXECUTE format('SELECT public.meta_deactivate_%s_schedule()', v_lane) INTO v_count;
      IF v_count <> 1 OR v_other_before IS DISTINCT FROM pg_temp.meta_assert_job(v_other_job, v_other) THEN
        RAISE EXCEPTION 'original_lane_deactivation_changed_opposite_lane';
      END IF;
      EXECUTE format('SELECT public.meta_activate_%s_schedule()', v_lane) INTO v_job;
      PERFORM pg_temp.meta_assert_job(v_job, v_lane);
      v_count := public.meta_deactivate_worker_schedules();
      IF v_count <> 2 OR EXISTS (SELECT 1 FROM cron.job) THEN
        RAISE EXCEPTION 'combined_emergency_stop_failed';
      END IF;
      SELECT * INTO STRICT v_combined FROM public.meta_activate_worker_schedules();
      PERFORM pg_temp.meta_assert_job(v_combined.inbox_jobid, 'intake');
      PERFORM pg_temp.meta_assert_job(v_combined.outbox_jobid, 'outbox');
      v_count := public.meta_deactivate_worker_schedules();
      IF v_count <> 2 OR EXISTS (SELECT 1 FROM cron.job) THEN
        RAISE EXCEPTION 'legacy_combined_schedule_compatibility_failed';
      END IF;
      RAISE EXCEPTION 'rollback_scheduler_lane_fixture' USING ERRCODE = 'PZ001';
    EXCEPTION WHEN SQLSTATE 'PZ001' THEN NULL;
    END;
    IF EXISTS (SELECT 1 FROM cron.job) OR EXISTS (SELECT 1 FROM vault.secrets) THEN
      RAISE EXCEPTION 'scheduler_fixture_rollback_failed';
    END IF;
  END LOOP;
END;
$schedules$;

SELECT 'META_INTAKE_DECOUPLING_SQL_CONTRACTS_PASS' AS result;
ROLLBACK;
