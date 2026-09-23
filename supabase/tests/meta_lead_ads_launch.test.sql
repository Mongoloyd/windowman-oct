-- Run only against a local database with the Meta migration present. All
-- synthetic rows are rolled back, including when run against an applied DB.
BEGIN;

DO $test$
DECLARE
  v_live public.meta_lead_inbox%ROWTYPE;
  v_test public.meta_lead_inbox%ROWTYPE;
  v_no_consent public.meta_lead_inbox%ROWTYPE;
  v_lead_id uuid;
  v_test_lead_id uuid;
  v_actor uuid := gen_random_uuid();
  v_qualification uuid;
  v_ghl public.meta_integration_outbox%ROWTYPE;
  v_meta public.meta_integration_outbox%ROWTYPE;
  v_receipt public.meta_webhook_receipts%ROWTYPE;
  v_receipt_id uuid;
  v_stale_lease uuid;
  v_trusted record;
  v_table_name text;
  v_count integer;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY[
    'meta_webhook_receipts', 'meta_lead_inbox', 'meta_form_mapping_revisions',
    'meta_form_destinations', 'meta_form_consent_rules', 'meta_qualification_events',
    'meta_stage_transitions', 'meta_integration_outbox', 'meta_ghl_contact_links'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v_table_name AND c.relrowsecurity
    ) OR has_table_privilege('anon', 'public.' || v_table_name, 'SELECT,INSERT,UPDATE,DELETE')
      OR has_table_privilege('authenticated', 'public.' || v_table_name, 'SELECT,INSERT,UPDATE,DELETE')
    THEN RAISE EXCEPTION 'meta_private_table_misconfigured: %', v_table_name; END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'meta_save_form_mapping', 'meta_receive_webhook_receipt',
      'meta_claim_webhook_receipts', 'meta_fail_webhook_receipt',
      'meta_replay_webhook_receipt', 'meta_complete_webhook_receipt',
      'meta_claim_lead_inbox', 'meta_complete_lead_inbox',
      'meta_fail_lead_inbox', 'meta_import_trusted_lead',
      'meta_replay_lead_inbox', 'meta_queue_qualification',
      'meta_set_lead_funnel_stage', 'meta_claim_integration_outbox',
      'meta_complete_integration_outbox', 'meta_fail_integration_outbox',
      'meta_replay_integration_outbox', 'meta_activate_worker_schedules',
      'meta_deactivate_worker_schedules'
    ) AND (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
      OR NOT ('search_path=""' = ANY(p.proconfig))
    )
  ) THEN RAISE EXCEPTION 'meta_private_function_misconfigured'; END IF;
  IF has_table_privilege('anon', 'public.meta_webhook_receipts', 'SELECT')
     OR has_table_privilege('authenticated', 'public.meta_stage_transitions', 'SELECT')
     OR has_function_privilege('anon', 'public.meta_receive_webhook_receipt(text,text,boolean,text[],text[],boolean)', 'EXECUTE')
     OR has_table_privilege('anon', 'public.meta_lead_inbox', 'SELECT')
     OR has_table_privilege('authenticated', 'public.meta_integration_outbox', 'SELECT')
     OR has_function_privilege(
       'anon', 'public.meta_set_lead_funnel_stage(uuid,text,uuid)', 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'meta_private_surface_exposed';
  END IF;
  INSERT INTO public.clients (name, slug, is_active)
  VALUES ('Meta SQL launch test', 'meta-sql-launch-test', true);
  INSERT INTO public.meta_form_destinations (
    form_id, client_slug, location_id, active, approved_at
  ) VALUES (
    'meta-sql-form', 'meta-sql-launch-test', 'meta-sql-location', true,
    now() - interval '1 minute'
  );
  PERFORM public.meta_save_form_mapping(
    'meta-sql-form', 'Where can we reach you?', 'map', 'email'
  );
  PERFORM public.meta_save_form_mapping(
    'meta-sql-form', 'How many openings?', 'map', 'qualification_openings'
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_form_mapping_revisions
    WHERE form_id = 'meta-sql-form'
      AND mappings @> '[{"question_label":"Where can we reach you?","mapping_action":"map","canonical_key":"email"},{"question_label":"How many openings?","mapping_action":"map","canonical_key":"qualification_openings"}]'::jsonb
  ) THEN RAISE EXCEPTION 'form_mapping_snapshot_missing'; END IF;
  IF (SELECT count(*) FROM public.meta_form_mapping_revisions WHERE form_id = 'meta-sql-form') <> 2 THEN
    RAISE EXCEPTION 'mapping_revision_count_wrong';
  END IF;
  INSERT INTO public.meta_form_consent_rules (
    form_id, purpose, question_label, granted_values, declined_values,
    consent_schema_version, privacy_policy_version, disclosure_version, approved_at
  )
  SELECT 'meta-sql-form', purpose, 'I agree', ARRAY['Yes'], ARRAY['No'],
    'test-v1', 'test-v1', 'test-v1', now() - interval '1 minute'
  FROM unnest(ARRAY[
    'marketing_communications', 'contractor_sharing', 'advertising_measurement'
  ]) AS purpose;

  v_receipt_id := public.meta_receive_webhook_receipt(
    encode(convert_to('{"case":"live-primary"}', 'UTF8'), 'base64'),
    repeat('a', 64), false, ARRAY['meta-sql-test-form'], '{}'::text[], true
  );
  IF public.meta_receive_webhook_receipt(
    encode(convert_to('{"case":"live-primary"}', 'UTF8'), 'base64'),
    repeat('a', 64), false, ARRAY['meta-sql-test-form'], '{}'::text[], true
  ) IS DISTINCT FROM v_receipt_id THEN RAISE EXCEPTION 'receipt_not_idempotent'; END IF;
  SELECT * INTO v_receipt FROM public.meta_claim_webhook_receipts(1);
  PERFORM public.meta_complete_webhook_receipt(
    v_receipt.id, v_receipt.lease_token,
    '[{"leadgen_id":"meta-sql-live-1","form_id":"meta-sql-form","page_id":"page-1","entry_index":0,"change_index":0}]'::jsonb,
    '[]'::jsonb, 0
  );
  SELECT count(*) INTO v_count FROM public.meta_lead_inbox
  WHERE platform_lead_id = 'meta-sql-live-1';
  IF v_count <> 1 THEN RAISE EXCEPTION 'receipt_not_idempotent'; END IF;

  SELECT * INTO v_live FROM public.meta_claim_lead_inbox(1);
  IF v_live.platform_lead_id <> 'meta-sql-live-1' THEN
    RAISE EXCEPTION 'inbox_claim_wrong';
  END IF;
  -- The approved form is known at receipt time and checked again after Graph.
  SELECT public.meta_complete_lead_inbox(
    v_live.id, v_live.lease_token,
    jsonb_build_object(
      'session_id', 'fbla_meta-sql-live-1', 'first_name', 'Test',
      'last_name', 'Lead', 'email', 'meta-sql-live@example.com'
    ),
    jsonb_build_object(
      'source_platform', 'meta', 'source_channel', 'lead_ads',
      'platform_lead_id', 'meta-sql-live-1', 'form_id', 'meta-sql-form',
      'raw_payload', jsonb_build_object('meta_lead_inbox_id', v_live.id)
    ),
    NULL,
    '[{"purpose":"marketing_communications","question_label":"I agree","answer_value":"Yes"},
      {"purpose":"contractor_sharing","question_label":"I agree","answer_value":"Yes"},
      {"purpose":"advertising_measurement","question_label":"I agree","answer_value":"Yes"}]'::jsonb,
    '{"id":"meta-sql-live-1","field_data":[{"name":"unknown_question","values":["review me"]}]}'::jsonb
  ) INTO v_lead_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_lead_inbox
    WHERE id = v_live.id AND status = 'done' AND form_id = 'meta-sql-form'
      AND lead_id = v_lead_id AND attribution_id IS NOT NULL
      AND graph_payload #>> '{field_data,0,values,0}' = 'review me'
  ) THEN RAISE EXCEPTION 'inbox_not_atomically_completed'; END IF;
  SELECT count(*) INTO v_count FROM public.lead_consent_events
  WHERE lead_id = v_lead_id AND decision = 'granted'
    AND source = 'meta_lead_ads';
  IF v_count <> 3 THEN RAISE EXCEPTION 'consent_evidence_missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.leads WHERE id = v_lead_id AND is_test) THEN
    RAISE EXCEPTION 'live_lead_marked_test';
  END IF;

  PERFORM public.meta_set_lead_funnel_stage(v_lead_id, 'qualified', v_actor);
  SELECT id INTO v_qualification FROM public.meta_qualification_events
  WHERE lead_id = v_lead_id;
  IF v_qualification IS NULL THEN RAISE EXCEPTION 'qualification_missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_stage_transitions t
    JOIN public.meta_lead_inbox i ON i.lead_id = t.lead_id
    WHERE t.lead_id = v_lead_id AND t.actor_id = v_actor
      AND t.decision_kind = 'transition' AND t.to_stage = 'qualified'
      AND t.occurred_at >= i.received_at
  ) THEN RAISE EXCEPTION 'stage_transition_audit_missing'; END IF;
  SELECT count(*) INTO v_count FROM public.meta_integration_outbox
  WHERE qualification_id = v_qualification;
  IF v_count <> 2 THEN RAISE EXCEPTION 'outbox_jobs_missing'; END IF;
  PERFORM public.meta_set_lead_funnel_stage(v_lead_id, 'qualified', v_actor);
  SELECT count(*) INTO v_count FROM public.meta_integration_outbox
  WHERE qualification_id = v_qualification;
  IF v_count <> 2 THEN RAISE EXCEPTION 'qualification_not_idempotent'; END IF;

  SELECT * INTO v_ghl FROM public.meta_claim_integration_outbox('ghl_contact', 1);
  IF v_ghl.job_kind <> 'ghl_contact' THEN RAISE EXCEPTION 'ghl_claim_wrong'; END IF;
  SELECT * INTO v_meta FROM public.meta_integration_outbox
  WHERE qualification_id = v_qualification AND job_kind = 'meta_qualified';
  IF public.meta_fail_integration_outbox(
    v_ghl.id, v_ghl.lease_token, 'ghl_rate_limited', 429, true
  ) <> 'retry' THEN RAISE EXCEPTION 'ghl_retry_missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_integration_outbox
    WHERE id = v_meta.id AND status = v_meta.status
      AND attempt_count = v_meta.attempt_count
      AND next_attempt_at = v_meta.next_attempt_at
  ) THEN RAISE EXCEPTION 'ghl_failure_changed_meta_lane'; END IF;
  UPDATE public.meta_integration_outbox SET next_attempt_at = now(), attempt_count = 7
  WHERE id = v_ghl.id;
  SELECT * INTO v_ghl FROM public.meta_claim_integration_outbox('ghl_contact', 1);
  IF public.meta_fail_integration_outbox(
    v_ghl.id, v_ghl.lease_token, 'ghl_retry_exhausted', 503, true
  ) <> 'dead' THEN RAISE EXCEPTION 'ghl_exhaustion_not_terminal'; END IF;
  IF (SELECT to_jsonb(j) FROM public.meta_integration_outbox j WHERE id = v_meta.id)
     IS DISTINCT FROM to_jsonb(v_meta) THEN
    RAISE EXCEPTION 'ghl_exhaustion_changed_meta_lane';
  END IF;
  PERFORM public.meta_replay_integration_outbox(v_ghl.id);
  SELECT * INTO v_ghl FROM public.meta_claim_integration_outbox('ghl_contact', 1);
  PERFORM public.meta_complete_integration_outbox(
    v_ghl.id, v_ghl.lease_token, 200, 'contact-1'
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_ghl_contact_links
    WHERE lead_id = v_lead_id AND location_id = 'meta-sql-location'
      AND contact_id = 'contact-1'
  ) THEN RAISE EXCEPTION 'ghl_contact_link_missing'; END IF;
  SELECT * INTO v_ghl FROM public.meta_integration_outbox WHERE id = v_ghl.id;
  UPDATE public.meta_integration_outbox SET next_attempt_at = now(), attempt_count = 7
  WHERE id = v_meta.id;
  SELECT * INTO v_meta FROM public.meta_claim_integration_outbox('meta_qualified', 1);
  IF public.meta_fail_integration_outbox(
    v_meta.id, v_meta.lease_token, 'meta_retry_exhausted', 503, true
  ) <> 'dead' THEN RAISE EXCEPTION 'meta_exhaustion_not_terminal'; END IF;
  IF (SELECT to_jsonb(j) FROM public.meta_integration_outbox j WHERE id = v_ghl.id)
     IS DISTINCT FROM to_jsonb(v_ghl) THEN
    RAISE EXCEPTION 'meta_exhaustion_changed_ghl_lane';
  END IF;
  PERFORM public.meta_replay_integration_outbox(v_meta.id);
  SELECT * INTO v_meta FROM public.meta_claim_integration_outbox('meta_qualified', 1);
  v_stale_lease := v_meta.lease_token;
  UPDATE public.meta_integration_outbox SET lease_expires_at = now() - interval '1 second'
  WHERE id = v_meta.id;
  SELECT * INTO v_meta FROM public.meta_claim_integration_outbox('meta_qualified', 1);
  BEGIN
    PERFORM public.meta_complete_integration_outbox(v_meta.id, v_stale_lease, 200, NULL);
    RAISE EXCEPTION 'stale_outbox_completion_accepted';
  EXCEPTION WHEN serialization_failure THEN NULL;
  END;
  PERFORM public.meta_complete_integration_outbox(v_meta.id, v_meta.lease_token, 200, NULL);

  PERFORM public.meta_receive_webhook_receipt(
    encode(convert_to('{"case":"test-primary"}', 'UTF8'), 'base64'),
    repeat('b', 64), true, '{}'::text[], '{}'::text[], true
  );
  SELECT * INTO v_receipt FROM public.meta_claim_webhook_receipts(1);
  PERFORM public.meta_complete_webhook_receipt(
    v_receipt.id, v_receipt.lease_token,
    '[{"leadgen_id":"meta-sql-test-1","form_id":"meta-sql-form","page_id":"page-1","entry_index":0,"change_index":0}]'::jsonb,
    '[]'::jsonb, 0
  );
  SELECT * INTO v_test FROM public.meta_claim_lead_inbox(1);
  SELECT public.meta_complete_lead_inbox(
    v_test.id, v_test.lease_token,
    '{"email":"meta-sql-test@example.com","first_name":"Test"}'::jsonb,
    '{"source_platform":"meta","source_channel":"lead_ads","platform_lead_id":"meta-sql-test-1","form_id":"meta-sql-form","raw_payload":{}}'::jsonb,
    NULL, '[]'::jsonb,
    '{"id":"meta-sql-test-1","field_data":[]}'::jsonb
  ) INTO v_test_lead_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.leads WHERE id = v_test_lead_id AND is_test
  ) THEN RAISE EXCEPTION 'test_lead_not_isolated'; END IF;
  PERFORM public.meta_set_lead_funnel_stage(v_test_lead_id, 'qualified', v_actor);
  IF EXISTS (
    SELECT 1 FROM public.meta_qualification_events WHERE lead_id = v_test_lead_id
  ) THEN RAISE EXCEPTION 'test_lead_qualified_outbound'; END IF;

  PERFORM public.meta_receive_webhook_receipt(
    encode(convert_to('{"case":"no-consent"}', 'UTF8'), 'base64'),
    repeat('c', 64), false, ARRAY['meta-sql-test-form'], '{}'::text[], true
  );
  SELECT * INTO v_receipt FROM public.meta_claim_webhook_receipts(1);
  PERFORM public.meta_complete_webhook_receipt(
    v_receipt.id, v_receipt.lease_token,
    '[{"leadgen_id":"meta-sql-no-consent-1","form_id":"meta-sql-form","page_id":"page-1","entry_index":0,"change_index":0}]'::jsonb,
    '[]'::jsonb, 0
  );
  SELECT * INTO v_no_consent FROM public.meta_claim_lead_inbox(1);
  SELECT public.meta_complete_lead_inbox(
    v_no_consent.id, v_no_consent.lease_token,
    '{"session_id":"fbla_meta-sql-no-consent-1","email":"meta-sql-no-consent@example.com","first_name":"Test"}'::jsonb,
    '{"source_platform":"meta","source_channel":"lead_ads","platform_lead_id":"meta-sql-no-consent-1","form_id":"meta-sql-form","raw_payload":{}}'::jsonb,
    NULL, '[]'::jsonb,
    '{"id":"meta-sql-no-consent-1","field_data":[]}'::jsonb
  ) INTO v_lead_id;
  PERFORM public.meta_set_lead_funnel_stage(v_lead_id, 'qualified', v_actor);
  IF EXISTS (
    SELECT 1 FROM public.meta_integration_outbox WHERE lead_id = v_lead_id
  ) THEN RAISE EXCEPTION 'lead_without_consent_queued'; END IF;

  SELECT * INTO v_trusted FROM public.meta_import_trusted_lead(
    'meta-sql-trusted-live',
    '{"id":"meta-sql-trusted-live","form_id":"meta-sql-form","field_data":[]}'::jsonb,
    false,
    '{"session_id":"fbla_meta-sql-trusted-live","email":"meta-sql-trusted-live@example.com","first_name":"Trusted"}'::jsonb,
    '{"source_platform":"meta","source_channel":"lead_ads","platform_lead_id":"meta-sql-trusted-live","form_id":"meta-sql-form","raw_payload":{}}'::jsonb,
    NULL, '[]'::jsonb
  );
  IF v_trusted.lead_id IS NULL OR v_trusted.attribution_id IS NULL OR v_trusted.reused THEN
    RAISE EXCEPTION 'trusted_live_sync_result_invalid';
  END IF;
  IF (SELECT attempt_count FROM public.meta_lead_inbox
      WHERE platform_lead_id = 'meta-sql-trusted-live') <> 1 THEN
    RAISE EXCEPTION 'trusted_first_import_attempt_count_invalid';
  END IF;
  SELECT * INTO v_trusted FROM public.meta_import_trusted_lead(
    'meta-sql-trusted-live',
    '{"id":"meta-sql-trusted-live","form_id":"meta-sql-form","field_data":[]}'::jsonb,
    false,
    '{"session_id":"fbla_meta-sql-trusted-live","email":"meta-sql-trusted-live@example.com","first_name":"Trusted"}'::jsonb,
    '{"source_platform":"meta","source_channel":"lead_ads","platform_lead_id":"meta-sql-trusted-live","form_id":"meta-sql-form","raw_payload":{}}'::jsonb,
    NULL, '[]'::jsonb
  );
  IF NOT v_trusted.reused OR v_trusted.lead_id IS NULL OR v_trusted.attribution_id IS NULL THEN
    RAISE EXCEPTION 'trusted_live_replay_invalid';
  END IF;
  SELECT * INTO v_trusted FROM public.meta_import_trusted_lead(
    'meta-sql-trusted-test',
    '{"id":"meta-sql-trusted-test","form_id":"meta-sql-form","field_data":[]}'::jsonb,
    true,
    '{"session_id":"fbla_meta-sql-trusted-test","email":"meta-sql-trusted-test@example.com","first_name":"Trusted"}'::jsonb,
    '{"source_platform":"meta","source_channel":"lead_ads","platform_lead_id":"meta-sql-trusted-test","form_id":"meta-sql-form","raw_payload":{}}'::jsonb,
    NULL, '[]'::jsonb
  );
  IF v_trusted.lead_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.leads WHERE id = v_trusted.lead_id AND is_test
  ) THEN RAISE EXCEPTION 'trusted_test_not_isolated'; END IF;
  PERFORM public.meta_set_lead_funnel_stage(v_trusted.lead_id, 'qualified', v_actor);
  IF EXISTS (SELECT 1 FROM public.meta_integration_outbox WHERE lead_id = v_trusted.lead_id) THEN
    RAISE EXCEPTION 'trusted_test_outbound_created';
  END IF;

  v_receipt_id := public.meta_receive_webhook_receipt(
    encode(convert_to('{"case":"test-form"}', 'UTF8'), 'base64'),
    repeat('1', 64), false, ARRAY['meta-sql-test-form'], '{}'::text[], true
  );
  IF public.meta_receive_webhook_receipt(
    encode(convert_to('{"case":"test-form"}', 'UTF8'), 'base64'),
    repeat('1', 64), false, ARRAY['meta-sql-test-form'], '{}'::text[], true
  ) IS DISTINCT FROM v_receipt_id THEN RAISE EXCEPTION 'raw_receipt_not_idempotent'; END IF;
  SELECT * INTO v_receipt FROM public.meta_claim_webhook_receipts(1);
  PERFORM public.meta_complete_webhook_receipt(
    v_receipt.id, v_receipt.lease_token,
    '[{"leadgen_id":"meta-sql-dedicated-test","form_id":"meta-sql-test-form","page_id":"page-1","entry_index":0,"change_index":0}]'::jsonb,
    '[]'::jsonb, 0
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_lead_inbox WHERE platform_lead_id = 'meta-sql-dedicated-test'
      AND is_test AND status = 'pending'
  ) THEN RAISE EXCEPTION 'dedicated_test_not_isolated'; END IF;

  PERFORM public.meta_receive_webhook_receipt(
    encode(convert_to('{"case":"live-form"}', 'UTF8'), 'base64'),
    repeat('2', 64), false, ARRAY['meta-sql-test-form'], '{}'::text[], true
  );
  SELECT * INTO v_receipt FROM public.meta_claim_webhook_receipts(1);
  PERFORM public.meta_complete_webhook_receipt(
    v_receipt.id, v_receipt.lease_token,
    '[{"leadgen_id":"meta-sql-classified-live","form_id":"meta-sql-form","page_id":"page-1","entry_index":0,"change_index":0}]'::jsonb,
    '[]'::jsonb, 0
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_lead_inbox WHERE platform_lead_id = 'meta-sql-classified-live'
      AND NOT is_test AND status = 'pending'
  ) THEN RAISE EXCEPTION 'approved_live_form_not_live'; END IF;

  PERFORM public.meta_receive_webhook_receipt(
    encode(convert_to('{"case":"unknown"}', 'UTF8'), 'base64'),
    repeat('3', 64), false, ARRAY['meta-sql-test-form'], '{}'::text[], true
  );
  SELECT * INTO v_receipt FROM public.meta_claim_webhook_receipts(1);
  PERFORM public.meta_complete_webhook_receipt(
    v_receipt.id, v_receipt.lease_token,
    '[{"leadgen_id":"meta-sql-unknown","form_id":null,"page_id":null,"entry_index":0,"change_index":0}]'::jsonb,
    '[]'::jsonb, 0
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_lead_inbox WHERE platform_lead_id = 'meta-sql-unknown'
      AND is_test AND status = 'quarantined'
  ) THEN RAISE EXCEPTION 'missing_identifiers_not_quarantined'; END IF;

  PERFORM public.meta_receive_webhook_receipt(
    encode(convert_to('{"case":"conflict"}', 'UTF8'), 'base64'),
    repeat('4', 64), false, ARRAY['meta-sql-form'], '{}'::text[], true
  );
  SELECT * INTO v_receipt FROM public.meta_claim_webhook_receipts(1);
  PERFORM public.meta_complete_webhook_receipt(
    v_receipt.id, v_receipt.lease_token,
    '[{"leadgen_id":"meta-sql-classified-live","form_id":"meta-sql-form","page_id":"page-1","entry_index":0,"change_index":0}]'::jsonb,
    '[]'::jsonb, 0
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_lead_inbox WHERE platform_lead_id = 'meta-sql-classified-live'
      AND is_test AND status = 'quarantined'
  ) THEN RAISE EXCEPTION 'duplicate_classification_not_quarantined'; END IF;

  PERFORM public.meta_receive_webhook_receipt(
    encode(convert_to('{"case":"missing-config"}', 'UTF8'), 'base64'),
    repeat('5', 64), false, '{}'::text[], '{}'::text[], true
  );
  SELECT * INTO v_receipt FROM public.meta_claim_webhook_receipts(1);
  PERFORM public.meta_complete_webhook_receipt(
    v_receipt.id, v_receipt.lease_token,
    '[{"leadgen_id":"meta-sql-missing-config","form_id":"meta-sql-form","page_id":"page-1","entry_index":0,"change_index":0}]'::jsonb,
    '[]'::jsonb, 0
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_lead_inbox WHERE platform_lead_id = 'meta-sql-missing-config'
      AND is_test AND status = 'quarantined'
  ) THEN RAISE EXCEPTION 'missing_test_config_not_quarantined'; END IF;

  PERFORM public.meta_receive_webhook_receipt(
    encode(convert_to('{"case":"mixed"}', 'UTF8'), 'base64'),
    repeat('6', 64), false, ARRAY['meta-sql-test-form'], '{}'::text[], true
  );
  SELECT * INTO v_receipt FROM public.meta_claim_webhook_receipts(1);
  PERFORM public.meta_complete_webhook_receipt(
    v_receipt.id, v_receipt.lease_token,
    '[{"leadgen_id":"meta-sql-valid-sibling","form_id":"meta-sql-form","page_id":"page-1","entry_index":0,"change_index":1}]'::jsonb,
    '[{"code":"invalid_leadgen_id","entry_index":0,"change_index":0}]'::jsonb, 1
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_webhook_receipts WHERE id = v_receipt.id
      AND status = 'quarantined' AND issue_count = 1
  ) OR NOT EXISTS (
    SELECT 1 FROM public.meta_lead_inbox WHERE platform_lead_id = 'meta-sql-valid-sibling'
      AND NOT is_test AND status = 'pending'
  ) THEN RAISE EXCEPTION 'mixed_batch_lost_valid_sibling'; END IF;

  PERFORM public.meta_receive_webhook_receipt(
    encode(convert_to('not-json', 'UTF8'), 'base64'),
    repeat('7', 64), false, ARRAY['meta-sql-test-form'], '{}'::text[], true
  );
  SELECT * INTO v_receipt FROM public.meta_claim_webhook_receipts(1);
  PERFORM public.meta_complete_webhook_receipt(
    v_receipt.id, v_receipt.lease_token, '[]'::jsonb,
    '[{"code":"invalid_json","entry_index":null,"change_index":null}]'::jsonb, 1
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_webhook_receipts WHERE id = v_receipt.id
      AND status = 'quarantined' AND issue_count = 1
  ) THEN RAISE EXCEPTION 'invalid_json_not_quarantined'; END IF;

  -- An empty signed body is malformed JSON, but must still survive receipt.
  -- Isolate its fixed SHA from an earlier local integration run; fixture rollback
  -- restores that receipt. An empty envelope has no leadgen children.
  DELETE FROM public.meta_webhook_receipts
  WHERE body_sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  v_receipt_id := public.meta_receive_webhook_receipt(
    '', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    false, ARRAY['meta-sql-test-form'], '{}'::text[], true
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.meta_webhook_receipts
    WHERE id = v_receipt_id AND body_base64 = '' AND status = 'pending'
  ) THEN RAISE EXCEPTION 'empty_signed_body_not_durable'; END IF;
END;
$test$;

ROLLBACK;
