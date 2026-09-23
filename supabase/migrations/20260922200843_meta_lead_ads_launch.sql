-- Meta Lead Ads pilot: all new data is server-only. This migration does not
-- schedule workers or send data to Meta/HighLevel on application.
BEGIN;

CREATE TABLE public.meta_webhook_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body_base64 text NOT NULL CHECK (length(body_base64) BETWEEN 0 AND 1400000),
  body_sha256 text NOT NULL UNIQUE CHECK (body_sha256 ~ '^[0-9a-f]{64}$'),
  global_test_mode boolean NOT NULL,
  test_form_ids text[] NOT NULL DEFAULT '{}'::text[],
  test_page_ids text[] NOT NULL DEFAULT '{}'::text[],
  routing_config_valid boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'retry', 'complete', 'quarantined', 'dead')
  ),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(issues) = 'array'),
  issue_count integer NOT NULL DEFAULT 0 CHECK (issue_count >= 0),
  last_error_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meta_webhook_receipts_due_idx
  ON public.meta_webhook_receipts (next_attempt_at, received_at)
  WHERE status IN ('pending', 'retry');
CREATE INDEX meta_webhook_receipts_lease_idx
  ON public.meta_webhook_receipts (lease_expires_at)
  WHERE status = 'processing';
CREATE INDEX meta_webhook_receipts_dead_idx
  ON public.meta_webhook_receipts (updated_at)
  WHERE status IN ('quarantined', 'dead');

CREATE TABLE public.meta_lead_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_lead_id text NOT NULL UNIQUE CHECK (length(btrim(platform_lead_id)) BETWEEN 1 AND 255),
  page_id text,
  form_id text,
  ad_id text,
  platform_created_time timestamptz,
  graph_payload jsonb CHECK (graph_payload IS NULL OR jsonb_typeof(graph_payload) = 'object'),
  source_receipt_id uuid REFERENCES public.meta_webhook_receipts(id) ON DELETE RESTRICT,
  consent_submission_id uuid NOT NULL DEFAULT gen_random_uuid(),
  source_kind text NOT NULL DEFAULT 'webhook' CHECK (source_kind IN ('webhook', 'trusted_import')),
  is_test boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'retry', 'done', 'quarantined', 'dead')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  attribution_id uuid REFERENCES public.lead_attribution_details(id) ON DELETE SET NULL,
  mapping_revision_id bigint,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX meta_lead_inbox_due_idx
  ON public.meta_lead_inbox (next_attempt_at, received_at)
  WHERE status IN ('pending', 'retry');
CREATE INDEX meta_lead_inbox_lease_idx
  ON public.meta_lead_inbox (lease_expires_at)
  WHERE status = 'processing';
CREATE INDEX meta_lead_inbox_dead_idx
  ON public.meta_lead_inbox (updated_at)
  WHERE status = 'dead';

CREATE TABLE public.meta_form_mapping_revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  form_id text NOT NULL CHECK (length(btrim(form_id)) BETWEEN 1 AND 255),
  mappings jsonb NOT NULL CHECK (jsonb_typeof(mappings) = 'array'),
  approved_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meta_form_mapping_revisions_form_idx
  ON public.meta_form_mapping_revisions (form_id, id DESC);
ALTER TABLE public.meta_lead_inbox
  ADD CONSTRAINT meta_lead_inbox_mapping_revision_fkey
  FOREIGN KEY (mapping_revision_id) REFERENCES public.meta_form_mapping_revisions(id);

CREATE TABLE public.meta_form_destinations (
  form_id text PRIMARY KEY CHECK (length(btrim(form_id)) BETWEEN 1 AND 255),
  client_slug text NOT NULL REFERENCES public.clients(slug) CHECK (length(btrim(client_slug)) BETWEEN 1 AND 80),
  location_id text NOT NULL CHECK (length(btrim(location_id)) BETWEEN 1 AND 255),
  active boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  CHECK (NOT active OR approved_at IS NOT NULL)
);

CREATE TABLE public.meta_form_consent_rules (
  form_id text NOT NULL CHECK (length(btrim(form_id)) BETWEEN 1 AND 255),
  purpose text NOT NULL CHECK (purpose IN (
    'marketing_communications', 'contractor_sharing', 'advertising_measurement'
  )),
  question_label text NOT NULL CHECK (length(btrim(question_label)) BETWEEN 1 AND 500),
  granted_values text[] NOT NULL CHECK (cardinality(granted_values) BETWEEN 1 AND 10),
  declined_values text[] NOT NULL DEFAULT '{}'::text[],
  consent_schema_version text NOT NULL,
  privacy_policy_version text NOT NULL,
  disclosure_version text NOT NULL,
  approved_at timestamptz NOT NULL,
  PRIMARY KEY (form_id, purpose)
);

CREATE TABLE public.meta_qualification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  attribution_id uuid NOT NULL REFERENCES public.lead_attribution_details(id) ON DELETE RESTRICT,
  platform_lead_id text NOT NULL,
  form_id text,
  client_slug text NOT NULL,
  location_id text NOT NULL,
  event_id text NOT NULL UNIQUE,
  qualified_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meta_stage_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  actor_id uuid NOT NULL,
  decision_kind text NOT NULL CHECK (decision_kind IN ('transition', 'reconciliation')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meta_stage_transitions_qualified_idx
  ON public.meta_stage_transitions (lead_id, occurred_at, id)
  WHERE to_stage = 'qualified';

CREATE TABLE public.meta_integration_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES public.meta_qualification_events(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  job_kind text NOT NULL CHECK (job_kind IN ('ghl_contact', 'meta_qualified')),
  event_id text NOT NULL UNIQUE,
  location_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'retry', 'delivered', 'dead')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  last_http_status integer,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (qualification_id, job_kind),
  CHECK ((job_kind = 'ghl_contact' AND location_id IS NOT NULL) OR (job_kind = 'meta_qualified' AND location_id IS NULL))
);
CREATE INDEX meta_integration_outbox_due_idx
  ON public.meta_integration_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending', 'retry');
CREATE INDEX meta_integration_outbox_lease_idx
  ON public.meta_integration_outbox (lease_expires_at)
  WHERE status = 'processing';
CREATE INDEX meta_integration_outbox_dead_idx
  ON public.meta_integration_outbox (updated_at)
  WHERE status = 'dead';

CREATE TABLE public.meta_ghl_contact_links (
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  location_id text NOT NULL,
  contact_id text NOT NULL,
  qualification_id uuid NOT NULL REFERENCES public.meta_qualification_events(id) ON DELETE RESTRICT,
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, location_id),
  UNIQUE (location_id, contact_id)
);

ALTER TABLE public.meta_webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_lead_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_form_mapping_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_form_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_form_consent_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_qualification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_stage_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_integration_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ghl_contact_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.meta_webhook_receipts, public.meta_lead_inbox,
  public.meta_form_mapping_revisions,
  public.meta_form_destinations, public.meta_form_consent_rules,
  public.meta_qualification_events, public.meta_stage_transitions,
  public.meta_integration_outbox, public.meta_ghl_contact_links
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.meta_form_mapping_revisions_id_seq
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.meta_webhook_receipts, public.meta_lead_inbox,
  public.meta_form_mapping_revisions,
  public.meta_form_destinations, public.meta_form_consent_rules,
  public.meta_qualification_events, public.meta_stage_transitions,
  public.meta_integration_outbox, public.meta_ghl_contact_links
  TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.meta_form_mapping_revisions_id_seq
  TO service_role;

-- The existing admin role gate is the only application caller. The database
-- function is service-role-only and serializes revisions for each form.
CREATE FUNCTION public.meta_save_form_mapping(
  p_form_id text, p_question_label text, p_mapping_action text,
  p_canonical_key text
)
RETURNS public.field_mapping_overrides
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_mapping public.field_mapping_overrides%ROWTYPE;
  v_form_id text := NULLIF(btrim(p_form_id), '');
  v_question_label text := NULLIF(btrim(p_question_label), '');
BEGIN
  IF v_form_id IS NULL OR length(v_form_id) > 255
     OR v_question_label IS NULL OR length(v_question_label) > 500
     OR p_mapping_action NOT IN ('map', 'ignore') THEN
    RAISE EXCEPTION 'meta_mapping_input_invalid' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('meta-form-mapping:' || v_form_id, 0)
  );
  INSERT INTO public.field_mapping_overrides (
    form_id, question_label, mapping_action, canonical_key
  ) VALUES (
    v_form_id, v_question_label, p_mapping_action, p_canonical_key
  ) ON CONFLICT (form_id, question_label) DO UPDATE
    SET mapping_action = EXCLUDED.mapping_action,
        canonical_key = EXCLUDED.canonical_key,
        updated_at = now()
  RETURNING * INTO v_mapping;
  INSERT INTO public.meta_form_mapping_revisions (form_id, mappings)
  SELECT v_form_id, COALESCE(jsonb_agg(jsonb_build_object(
    'question_label', question_label,
    'mapping_action', mapping_action,
    'canonical_key', canonical_key
  ) ORDER BY question_label), '[]'::jsonb)
  FROM public.field_mapping_overrides
  WHERE form_id = v_form_id;
  RETURN v_mapping;
END;
$$;
REVOKE ALL ON FUNCTION public.meta_save_form_mapping(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_save_form_mapping(text, text, text, text)
  TO service_role;

-- Existing admin-approved overrides should work without requiring an operator
-- to edit each form after deployment.
INSERT INTO public.meta_form_mapping_revisions (form_id, mappings)
SELECT form_id, jsonb_agg(jsonb_build_object(
  'question_label', question_label,
  'mapping_action', mapping_action,
  'canonical_key', canonical_key
) ORDER BY question_label)
FROM public.field_mapping_overrides
GROUP BY form_id;

-- Native signed bytes are committed before the callback is acknowledged.
-- The service role is the only caller and owns the protected receipt table.
CREATE FUNCTION public.meta_receive_webhook_receipt(
  p_body_base64 text, p_body_sha256 text, p_global_test_mode boolean,
  p_test_form_ids text[], p_test_page_ids text[],
  p_routing_config_valid boolean
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_existing public.meta_webhook_receipts%ROWTYPE;
BEGIN
  IF p_body_base64 IS NULL OR length(p_body_base64) NOT BETWEEN 0 AND 1400000
     OR octet_length(decode(p_body_base64, 'base64')) > 1000000
     OR p_body_sha256 !~ '^[0-9a-f]{64}$'
     OR p_global_test_mode IS NULL OR p_routing_config_valid IS NULL
     OR cardinality(COALESCE(p_test_form_ids, '{}'::text[])) > 100
     OR cardinality(COALESCE(p_test_page_ids, '{}'::text[])) > 100 THEN
    RAISE EXCEPTION 'invalid_meta_webhook_receipt' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.meta_webhook_receipts (
    body_base64, body_sha256, global_test_mode, test_form_ids,
    test_page_ids, routing_config_valid
  ) VALUES (
    p_body_base64, p_body_sha256, p_global_test_mode,
    COALESCE(p_test_form_ids, '{}'::text[]),
    COALESCE(p_test_page_ids, '{}'::text[]), p_routing_config_valid
  ) ON CONFLICT (body_sha256) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT * INTO v_existing FROM public.meta_webhook_receipts
  WHERE body_sha256 = p_body_sha256 FOR UPDATE;
  IF v_existing.body_base64 IS DISTINCT FROM p_body_base64
     OR v_existing.global_test_mode IS DISTINCT FROM p_global_test_mode
     OR v_existing.test_form_ids IS DISTINCT FROM COALESCE(p_test_form_ids, '{}'::text[])
     OR v_existing.test_page_ids IS DISTINCT FROM COALESCE(p_test_page_ids, '{}'::text[])
     OR v_existing.routing_config_valid IS DISTINCT FROM p_routing_config_valid THEN
    UPDATE public.meta_webhook_receipts
    SET status = 'quarantined', issue_count = 1,
        issues = '[{"code":"duplicate_routing_conflict","entry_index":null,"change_index":null}]'::jsonb,
        last_error_code = 'duplicate_routing_conflict', updated_at = now()
    WHERE id = v_existing.id;
    UPDATE public.meta_lead_inbox
    SET status = 'quarantined', is_test = true,
        last_error_code = 'duplicate_routing_conflict', updated_at = now()
    WHERE source_receipt_id = v_existing.id;
  END IF;
  RETURN v_existing.id;
END;
$$;
REVOKE ALL ON FUNCTION public.meta_receive_webhook_receipt(
  text, text, boolean, text[], text[], boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_receive_webhook_receipt(
  text, text, boolean, text[], text[], boolean
) TO service_role;

CREATE FUNCTION public.meta_claim_webhook_receipts(p_limit integer DEFAULT 10)
RETURNS SETOF public.meta_webhook_receipts
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  WITH due AS (
    SELECT id FROM public.meta_webhook_receipts
    WHERE (status IN ('pending', 'retry') AND next_attempt_at <= now())
       OR (status = 'processing' AND lease_expires_at < now())
    ORDER BY received_at, id
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 25)
  )
  UPDATE public.meta_webhook_receipts AS r
  SET status = 'processing', attempt_count = r.attempt_count + 1,
      lease_token = gen_random_uuid(),
      lease_expires_at = now() + interval '5 minutes', updated_at = now()
  FROM due WHERE r.id = due.id
  RETURNING r.*;
$$;
REVOKE ALL ON FUNCTION public.meta_claim_webhook_receipts(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_claim_webhook_receipts(integer)
  TO service_role;

CREATE FUNCTION public.meta_fail_webhook_receipt(
  p_id uuid, p_lease_token uuid, p_error_code text, p_retryable boolean
)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_status text;
BEGIN
  UPDATE public.meta_webhook_receipts
  SET status = CASE WHEN p_retryable AND attempt_count < 8 THEN 'retry' ELSE 'dead' END,
      next_attempt_at = now() + make_interval(secs => LEAST(3600, (power(2, attempt_count) * 30)::integer)),
      lease_token = NULL, lease_expires_at = NULL,
      last_error_code = left(COALESCE(p_error_code, 'unknown'), 120), updated_at = now()
  WHERE id = p_id AND status = 'processing' AND lease_token = p_lease_token
  RETURNING status INTO v_status;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'meta_receipt_lease_invalid' USING ERRCODE = '40001';
  END IF;
  RETURN v_status;
END;
$$;
REVOKE ALL ON FUNCTION public.meta_fail_webhook_receipt(uuid, uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_fail_webhook_receipt(uuid, uuid, text, boolean)
  TO service_role;

CREATE FUNCTION public.meta_replay_webhook_receipt(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  UPDATE public.meta_webhook_receipts
  SET status = 'pending', attempt_count = 0, next_attempt_at = now(),
      last_error_code = NULL, lease_token = NULL, lease_expires_at = NULL,
      updated_at = now()
  WHERE id = p_id AND status IN ('dead', 'quarantined');
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.meta_replay_webhook_receipt(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_replay_webhook_receipt(uuid)
  TO service_role;

CREATE FUNCTION public.meta_complete_webhook_receipt(
  p_id uuid, p_lease_token uuid, p_events jsonb, p_issues jsonb,
  p_issue_count integer
)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_receipt public.meta_webhook_receipts%ROWTYPE;
  v_event jsonb;
  v_issue jsonb;
  v_issues jsonb := p_issues;
  v_issue_count integer := p_issue_count;
  v_lead_id text;
  v_form_id text;
  v_page_id text;
  v_created_at timestamptz;
  v_is_test boolean;
  v_status text;
  v_error_code text;
  v_saved_status text;
  v_saved_error text;
  v_live_approved boolean;
  v_test_form boolean;
  v_test_page boolean;
  v_final_status text;
BEGIN
  SELECT * INTO v_receipt FROM public.meta_webhook_receipts
  WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_receipt.status <> 'processing'
     OR v_receipt.lease_token IS DISTINCT FROM p_lease_token
     OR v_receipt.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'meta_receipt_lease_invalid' USING ERRCODE = '40001';
  END IF;
  IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array'
     OR jsonb_array_length(p_events) > 30000
     OR octet_length(p_events::text) > 3000000
     OR p_issues IS NULL OR jsonb_typeof(p_issues) <> 'array'
     OR jsonb_array_length(p_issues) > 100
     OR octet_length(p_issues::text) > 16000
     OR p_issue_count IS NULL OR p_issue_count < jsonb_array_length(p_issues)
     OR p_issue_count > 1000000 THEN
    RAISE EXCEPTION 'meta_receipt_completion_invalid' USING ERRCODE = '22023';
  END IF;
  FOR v_issue IN SELECT value FROM jsonb_array_elements(p_issues) LOOP
    IF jsonb_typeof(v_issue) <> 'object'
       OR v_issue ->> 'code' NOT IN (
         'invalid_json', 'invalid_envelope', 'invalid_entry',
         'invalid_change', 'invalid_leadgen_id', 'invalid_identifier'
       ) OR EXISTS (
         SELECT 1 FROM jsonb_object_keys(v_issue) AS k(field_key)
         WHERE k.field_key NOT IN ('code', 'entry_index', 'change_index')
       ) THEN
      RAISE EXCEPTION 'meta_receipt_issue_invalid' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  FOR v_event IN SELECT value FROM jsonb_array_elements(p_events) LOOP
    IF jsonb_typeof(v_event) <> 'object' OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(v_event) AS k(field_key)
      WHERE k.field_key NOT IN (
        'leadgen_id', 'page_id', 'form_id', 'ad_id', 'created_time',
        'entry_index', 'change_index'
      )
    ) THEN
      RAISE EXCEPTION 'meta_receipt_event_invalid' USING ERRCODE = '22023';
    END IF;
    v_lead_id := NULLIF(btrim(v_event ->> 'leadgen_id'), '');
    v_form_id := NULLIF(btrim(v_event ->> 'form_id'), '');
    v_page_id := NULLIF(btrim(v_event ->> 'page_id'), '');
    IF v_lead_id IS NULL OR length(v_lead_id) > 255
       OR length(COALESCE(v_form_id, '')) > 255
       OR length(COALESCE(v_page_id, '')) > 255
       OR length(COALESCE(v_event ->> 'ad_id', '')) > 255 THEN
      RAISE EXCEPTION 'meta_receipt_event_invalid' USING ERRCODE = '22023';
    END IF;
    v_created_at := NULL;
    BEGIN
      v_created_at := NULLIF(btrim(v_event ->> 'created_time'), '')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      v_created_at := NULL;
    END;
    SELECT EXISTS (
      SELECT 1 FROM public.meta_form_destinations d
      WHERE d.form_id = v_form_id AND d.active AND d.approved_at IS NOT NULL
    ) INTO v_live_approved;
    v_test_form := COALESCE(v_form_id = ANY(v_receipt.test_form_ids), false);
    v_test_page := COALESCE(v_page_id = ANY(v_receipt.test_page_ids), false);
    v_error_code := NULL;
    IF v_receipt.global_test_mode THEN
      v_is_test := true;
      v_status := 'pending';
    ELSIF NOT v_receipt.routing_config_valid
       OR (cardinality(v_receipt.test_form_ids) = 0
           AND cardinality(v_receipt.test_page_ids) = 0) THEN
      v_is_test := true;
      v_status := 'quarantined';
      v_error_code := 'routing_config_missing';
    ELSIF (v_test_form OR v_test_page) AND v_live_approved THEN
      v_is_test := true;
      v_status := 'quarantined';
      v_error_code := 'test_live_identifier_conflict';
    ELSIF v_test_form OR v_test_page THEN
      v_is_test := true;
      v_status := 'pending';
    ELSIF v_form_id IS NOT NULL AND v_page_id IS NOT NULL
       AND v_live_approved THEN
      v_is_test := false;
      v_status := 'pending';
    ELSE
      v_is_test := true;
      v_status := 'quarantined';
      v_error_code := 'unapproved_identifier';
    END IF;
    INSERT INTO public.meta_lead_inbox AS i (
      platform_lead_id, page_id, form_id, ad_id, platform_created_time,
      source_receipt_id, source_kind, is_test, status, last_error_code
    ) VALUES (
      v_lead_id, v_page_id, v_form_id,
      NULLIF(btrim(v_event ->> 'ad_id'), ''), v_created_at,
      v_receipt.id, 'webhook', v_is_test, v_status, v_error_code
    ) ON CONFLICT (platform_lead_id) DO UPDATE
      SET status = CASE WHEN i.status = 'quarantined'
          OR EXCLUDED.status = 'quarantined'
          OR i.is_test IS DISTINCT FROM EXCLUDED.is_test
          OR i.form_id IS DISTINCT FROM EXCLUDED.form_id
          OR i.page_id IS DISTINCT FROM EXCLUDED.page_id
          THEN 'quarantined' ELSE i.status END,
        is_test = CASE WHEN i.status = 'quarantined'
          OR EXCLUDED.status = 'quarantined'
          OR i.is_test IS DISTINCT FROM EXCLUDED.is_test
          OR i.form_id IS DISTINCT FROM EXCLUDED.form_id
          OR i.page_id IS DISTINCT FROM EXCLUDED.page_id
          THEN true ELSE i.is_test END,
        last_error_code = CASE WHEN i.status = 'quarantined'
          OR EXCLUDED.status = 'quarantined'
          OR i.is_test IS DISTINCT FROM EXCLUDED.is_test
          OR i.form_id IS DISTINCT FROM EXCLUDED.form_id
          OR i.page_id IS DISTINCT FROM EXCLUDED.page_id
          THEN 'classification_conflict' ELSE i.last_error_code END,
        updated_at = now()
    RETURNING status, last_error_code INTO v_saved_status, v_saved_error;
    IF v_saved_status = 'quarantined' THEN
      v_issue_count := v_issue_count + 1;
      IF jsonb_array_length(v_issues) < 100 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object(
          'entry_index', v_event -> 'entry_index',
          'change_index', v_event -> 'change_index',
          'code', COALESCE(v_saved_error, 'unapproved_identifier')
        ));
      END IF;
    END IF;
  END LOOP;
  v_final_status := CASE WHEN v_issue_count > 0 THEN 'quarantined' ELSE 'complete' END;
  UPDATE public.meta_webhook_receipts
  SET status = v_final_status, issues = v_issues, issue_count = v_issue_count,
      processed_at = now(), lease_token = NULL, lease_expires_at = NULL,
      last_error_code = CASE WHEN v_issue_count > 0 THEN 'receipt_quarantined' ELSE NULL END,
      updated_at = now()
  WHERE id = p_id;
  RETURN v_final_status;
END;
$$;
REVOKE ALL ON FUNCTION public.meta_complete_webhook_receipt(
  uuid, uuid, jsonb, jsonb, integer
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_complete_webhook_receipt(
  uuid, uuid, jsonb, jsonb, integer
) TO service_role;

CREATE FUNCTION public.meta_claim_lead_inbox(p_limit integer DEFAULT 10)
RETURNS SETOF public.meta_lead_inbox
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH due AS (
    SELECT id FROM public.meta_lead_inbox
    WHERE (status IN ('pending', 'retry') AND next_attempt_at <= now())
       OR (status = 'processing' AND lease_expires_at < now())
    ORDER BY received_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 25)
  )
  UPDATE public.meta_lead_inbox AS i
  SET status = 'processing', attempt_count = i.attempt_count + 1,
      lease_token = gen_random_uuid(), lease_expires_at = now() + interval '5 minutes',
      updated_at = now()
  FROM due WHERE i.id = due.id
  RETURNING i.*;
$$;

CREATE FUNCTION public.meta_complete_lead_inbox(
  p_id uuid, p_lease_token uuid, p_lead jsonb, p_attribution jsonb,
  p_mapping_revision_id bigint DEFAULT NULL,
  p_consents jsonb DEFAULT '[]'::jsonb,
  p_graph_payload jsonb DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_inbox public.meta_lead_inbox%ROWTYPE;
  v_result record;
  v_lead_id uuid;
  v_attribution_id uuid;
  v_existing_lead_id uuid;
  v_existing_is_test boolean;
  v_form_id text;
  v_consent jsonb;
  v_rule public.meta_form_consent_rules%ROWTYPE;
  v_answer text;
  v_decision text;
BEGIN
  SELECT * INTO v_inbox FROM public.meta_lead_inbox
  WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_inbox.status <> 'processing'
     OR v_inbox.lease_token IS DISTINCT FROM p_lease_token
     OR v_inbox.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'meta_inbox_lease_invalid' USING ERRCODE = '40001';
  END IF;
  IF p_lead IS NULL OR jsonb_typeof(p_lead) <> 'object'
     OR p_attribution IS NULL OR jsonb_typeof(p_attribution) <> 'object'
     OR p_attribution ->> 'platform_lead_id' IS DISTINCT FROM v_inbox.platform_lead_id
     OR p_attribution ->> 'source_platform' IS DISTINCT FROM 'meta'
     OR (v_inbox.form_id IS NOT NULL AND
         p_attribution ->> 'form_id' IS DISTINCT FROM v_inbox.form_id) THEN
    RAISE EXCEPTION 'meta_inbox_payload_invalid' USING ERRCODE = '22023';
  END IF;
  v_form_id := COALESCE(v_inbox.form_id, NULLIF(btrim(p_attribution ->> 'form_id'), ''));
  IF p_mapping_revision_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.meta_form_mapping_revisions
    WHERE id = p_mapping_revision_id AND form_id = v_form_id
  ) THEN
    RAISE EXCEPTION 'meta_mapping_revision_invalid' USING ERRCODE = '22023';
  END IF;
  IF p_consents IS NULL OR jsonb_typeof(p_consents) <> 'array'
     OR jsonb_array_length(p_consents) > 3 THEN
    RAISE EXCEPTION 'meta_consent_evidence_invalid' USING ERRCODE = '22023';
  END IF;
  IF (v_inbox.graph_payload IS NULL AND p_graph_payload IS NULL)
     OR (p_graph_payload IS NOT NULL AND (
       jsonb_typeof(p_graph_payload) <> 'object'
       OR octet_length(p_graph_payload::text) > 1048576
     )) THEN
    RAISE EXCEPTION 'meta_graph_payload_invalid' USING ERRCODE = '22023';
  END IF;

  IF v_inbox.is_test THEN
    SELECT a.id, a.lead_id, l.is_test
      INTO v_attribution_id, v_existing_lead_id, v_existing_is_test
    FROM public.lead_attribution_details a
    JOIN public.leads l ON l.id = a.lead_id
    WHERE a.platform_lead_id = v_inbox.platform_lead_id
      AND a.source_platform IN ('meta', 'facebook')
    ORDER BY a.created_at LIMIT 1 FOR UPDATE OF a;
    IF v_existing_lead_id IS NOT NULL AND NOT v_existing_is_test THEN
      RAISE EXCEPTION 'meta_test_identity_conflict' USING ERRCODE = '22023';
    END IF;
    IF v_existing_lead_id IS NOT NULL THEN
      v_lead_id := v_existing_lead_id;
    ELSE
      INSERT INTO public.leads (
        session_id, client_slug, status, phone_verified, is_test,
        first_name, last_name, email, phone_e164, county, source, lead_source
      ) VALUES (
        'fbla_' || v_inbox.platform_lead_id, 'direct', 'new', false, true,
        p_lead ->> 'first_name', p_lead ->> 'last_name',
        p_lead ->> 'email', p_lead ->> 'phone_e164', p_lead ->> 'county',
        'facebook_lead_ads', 'facebook_lead_ads'
      ) RETURNING id INTO v_lead_id;
      INSERT INTO public.lead_attribution_details (
        lead_id, source_platform, source_channel, source_detail,
        platform_lead_id, platform_created_time, form_id, ad_id,
        campaign_id, campaign_name, adset_id, adset_name,
        fbclid, fbc, fbp, utm_source, utm_medium, utm_campaign,
        raw_payload, import_source
      ) VALUES (
        v_lead_id, 'meta', 'lead_ads', 'facebook_lead_ads',
        v_inbox.platform_lead_id,
        NULLIF(p_attribution ->> 'platform_created_time', '')::timestamptz,
        p_attribution ->> 'form_id', p_attribution ->> 'ad_id',
        p_attribution ->> 'campaign_id', p_attribution ->> 'campaign_name',
        p_attribution ->> 'adset_id', p_attribution ->> 'adset_name',
        p_attribution ->> 'fbclid', p_attribution ->> 'fbc', p_attribution ->> 'fbp',
        p_attribution ->> 'utm_source', p_attribution ->> 'utm_medium',
        p_attribution ->> 'utm_campaign',
        COALESCE(p_attribution -> 'raw_payload', '{}'::jsonb),
        'process-meta-lead'
      ) RETURNING id INTO v_attribution_id;
    END IF;
  ELSE
    SELECT * INTO v_result
    FROM public.upsert_native_lead_with_attribution(p_lead, p_attribution);
    v_lead_id := v_result.lead_id;
    v_attribution_id := v_result.attribution_id;
    IF EXISTS (SELECT 1 FROM public.leads WHERE id = v_lead_id AND is_test) THEN
      RAISE EXCEPTION 'meta_live_test_identity_conflict' USING ERRCODE = '22023';
    END IF;
  END IF;

  FOR v_consent IN SELECT value FROM jsonb_array_elements(p_consents) LOOP
    SELECT * INTO v_rule FROM public.meta_form_consent_rules
    WHERE form_id = v_form_id
      AND purpose = v_consent ->> 'purpose'
      AND lower(btrim(question_label)) = lower(btrim(v_consent ->> 'question_label'))
      AND approved_at <= v_inbox.received_at;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'meta_consent_rule_unapproved' USING ERRCODE = '22023';
    END IF;
    v_answer := lower(btrim(v_consent ->> 'answer_value'));
    IF EXISTS (
      SELECT 1 FROM unnest(v_rule.granted_values) AS x
      WHERE lower(btrim(x)) = v_answer
    ) THEN
      v_decision := 'granted';
    ELSIF EXISTS (
      SELECT 1 FROM unnest(v_rule.declined_values) AS x
      WHERE lower(btrim(x)) = v_answer
    ) THEN
      v_decision := 'declined';
    ELSE
      RAISE EXCEPTION 'meta_consent_answer_unrecognized' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.lead_consent_events e
      WHERE e.lead_id = v_lead_id
        AND e.submission_id = v_inbox.consent_submission_id
        AND e.purpose = v_rule.purpose
        AND (
          e.decision IS DISTINCT FROM v_decision
          OR e.disclosure_version IS DISTINCT FROM v_rule.disclosure_version
          OR e.privacy_policy_version IS DISTINCT FROM v_rule.privacy_policy_version
        )
    ) THEN
      RAISE EXCEPTION 'meta_consent_conflict' USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.lead_consent_events (
      lead_id, session_id, submission_id, purpose, decision,
      consent_schema_version, privacy_policy_version, disclosure_version,
      source, metadata
    ) VALUES (
      v_lead_id, 'fbla_' || v_inbox.platform_lead_id,
      v_inbox.consent_submission_id, v_rule.purpose, v_decision,
      v_rule.consent_schema_version, v_rule.privacy_policy_version,
      v_rule.disclosure_version, 'meta_lead_ads',
      jsonb_build_object(
        'form_id', v_form_id,
        'platform_lead_id', v_inbox.platform_lead_id,
        'question_label', v_rule.question_label
      )
    ) ON CONFLICT (lead_id, submission_id, purpose) DO NOTHING;
  END LOOP;

  UPDATE public.meta_lead_inbox
  SET status = 'done', form_id = v_form_id,
      graph_payload = COALESCE(v_inbox.graph_payload, p_graph_payload),
      lead_id = v_lead_id,
      attribution_id = v_attribution_id, mapping_revision_id = p_mapping_revision_id,
      processed_at = now(), lease_token = NULL, lease_expires_at = NULL,
      last_error_code = NULL, updated_at = now()
  WHERE id = p_id;
  RETURN v_lead_id;
END;
$$;

CREATE FUNCTION public.meta_fail_lead_inbox(
  p_id uuid, p_lease_token uuid, p_error_code text, p_retryable boolean
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_status text;
BEGIN
  UPDATE public.meta_lead_inbox
  SET status = CASE WHEN p_retryable AND attempt_count < 8 THEN 'retry' ELSE 'dead' END,
      next_attempt_at = now() + make_interval(secs => LEAST(3600, (power(2, attempt_count) * 30)::integer)),
      lease_token = NULL, lease_expires_at = NULL,
      last_error_code = left(COALESCE(p_error_code, 'unknown'), 120), updated_at = now()
  WHERE id = p_id AND status = 'processing' AND lease_token = p_lease_token
  RETURNING status INTO v_status;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'meta_inbox_lease_invalid' USING ERRCODE = '40001';
  END IF;
  RETURN v_status;
END;
$$;

-- Authenticated trusted imports synchronously create/claim the same inbox row
-- and complete canonical persistence in one database transaction.
CREATE FUNCTION public.meta_import_trusted_lead(
  p_platform_lead_id text, p_graph_payload jsonb, p_is_test boolean,
  p_lead jsonb, p_attribution jsonb,
  p_mapping_revision_id bigint DEFAULT NULL,
  p_consents jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE(lead_id uuid, attribution_id uuid, reused boolean, error_code text)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_inbox public.meta_lead_inbox%ROWTYPE;
  v_platform_lead_id text := NULLIF(btrim(p_platform_lead_id), '');
  v_form_id text := NULLIF(btrim(p_attribution ->> 'form_id'), '');
  v_lease uuid := gen_random_uuid();
  v_reused boolean;
  v_attribution jsonb;
BEGIN
  IF v_platform_lead_id IS NULL OR length(v_platform_lead_id) > 255
     OR p_is_test IS NULL OR p_graph_payload IS NULL
     OR jsonb_typeof(p_graph_payload) <> 'object'
     OR octet_length(p_graph_payload::text) > 1000000
     OR p_lead IS NULL OR jsonb_typeof(p_lead) <> 'object'
     OR p_attribution IS NULL OR jsonb_typeof(p_attribution) <> 'object'
     OR p_attribution ->> 'platform_lead_id' IS DISTINCT FROM v_platform_lead_id
     OR p_attribution ->> 'source_platform' IS DISTINCT FROM 'meta' THEN
    RAISE EXCEPTION 'meta_trusted_import_invalid' USING ERRCODE = '22023';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.lead_attribution_details a
    WHERE a.platform_lead_id = v_platform_lead_id
      AND a.source_platform IN ('meta', 'facebook')
  ) INTO v_reused;
  INSERT INTO public.meta_lead_inbox (
    platform_lead_id, form_id, ad_id, graph_payload, source_kind,
    is_test, status, attempt_count, lease_token, lease_expires_at
  ) VALUES (
    v_platform_lead_id, v_form_id,
    NULLIF(btrim(p_attribution ->> 'ad_id'), ''), p_graph_payload,
    'trusted_import', p_is_test, 'processing', 0, v_lease,
    now() + interval '5 minutes'
  ) ON CONFLICT (platform_lead_id) DO NOTHING;
  SELECT * INTO v_inbox FROM public.meta_lead_inbox
  WHERE platform_lead_id = v_platform_lead_id FOR UPDATE;
  IF v_inbox.is_test IS DISTINCT FROM p_is_test
     OR (v_inbox.form_id IS NOT NULL AND v_form_id IS NOT NULL
         AND v_inbox.form_id IS DISTINCT FROM v_form_id) THEN
    UPDATE public.meta_lead_inbox
    SET status = 'quarantined', is_test = true,
        last_error_code = 'classification_conflict', updated_at = now()
    WHERE id = v_inbox.id;
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'classification_conflict'::text;
    RETURN;
  END IF;
  IF v_inbox.status = 'quarantined' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'trusted_import_quarantined'::text;
    RETURN;
  END IF;
  IF v_inbox.status = 'done' THEN
    RETURN QUERY SELECT v_inbox.lead_id, v_inbox.attribution_id, true, NULL::text;
    RETURN;
  END IF;
  IF v_inbox.status = 'processing' AND v_inbox.lease_token <> v_lease
     AND v_inbox.lease_expires_at > now() THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false, 'trusted_import_busy'::text;
    RETURN;
  END IF;
  UPDATE public.meta_lead_inbox
  SET status = 'processing', attempt_count = attempt_count + 1,
      lease_token = v_lease, lease_expires_at = now() + interval '5 minutes',
      graph_payload = COALESCE(graph_payload, p_graph_payload),
      form_id = COALESCE(form_id, v_form_id), updated_at = now()
  WHERE id = v_inbox.id;
  v_attribution := jsonb_set(
    p_attribution, '{raw_payload}',
    COALESCE(p_attribution -> 'raw_payload', '{}'::jsonb)
      || jsonb_build_object('meta_lead_inbox_id', v_inbox.id), true
  );
  lead_id := public.meta_complete_lead_inbox(
    v_inbox.id, v_lease, p_lead, v_attribution,
    p_mapping_revision_id, p_consents, p_graph_payload
  );
  SELECT i.attribution_id INTO attribution_id
  FROM public.meta_lead_inbox i WHERE i.id = v_inbox.id;
  reused := v_reused;
  error_code := NULL;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.meta_import_trusted_lead(
  text, jsonb, boolean, jsonb, jsonb, bigint, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_import_trusted_lead(
  text, jsonb, boolean, jsonb, jsonb, bigint, jsonb
) TO service_role;

CREATE FUNCTION public.meta_replay_lead_inbox(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.meta_lead_inbox
  SET status = 'pending', attempt_count = 0, next_attempt_at = now(),
      last_error_code = NULL, lease_token = NULL, lease_expires_at = NULL,
      updated_at = now()
  WHERE id = p_id AND status = 'dead';
  RETURN FOUND;
END;
$$;

-- Qualification is WindowMan-owned. The existing admin role gate calls this
-- service-role-only RPC, so stage/audit/outbox state commits together.
CREATE FUNCTION public.meta_queue_qualification(
  p_lead_id uuid, p_actor_id uuid, p_reconcile boolean DEFAULT true
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_source record;
  v_qualification public.meta_qualification_events%ROWTYPE;
  v_qualified_at timestamptz;
  v_qualified_actor uuid;
  v_marketing_granted boolean := false;
  v_sharing_granted boolean := false;
  v_measurement_granted boolean := false;
BEGIN
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND OR v_lead.is_test OR v_lead.funnel_stage IS DISTINCT FROM 'qualified' THEN
    RETURN NULL;
  END IF;
  SELECT i.attribution_id, i.platform_lead_id, i.form_id, i.received_at,
         d.client_slug, d.location_id
    INTO v_source
  FROM public.meta_lead_inbox i
  JOIN public.meta_form_destinations d ON d.form_id = i.form_id
  JOIN public.clients c ON c.slug = d.client_slug AND c.is_active
  WHERE i.lead_id = p_lead_id AND i.status = 'done' AND NOT i.is_test
    AND d.active AND d.approved_at IS NOT NULL
    AND v_lead.client_slug IN ('direct', d.client_slug)
  ORDER BY i.received_at, i.id LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT occurred_at, actor_id INTO v_qualified_at, v_qualified_actor
  FROM public.meta_stage_transitions
  WHERE lead_id = p_lead_id AND to_stage = 'qualified'
    AND occurred_at >= v_source.received_at
  ORDER BY occurred_at ASC, id ASC LIMIT 1;
  IF v_qualified_at IS NULL AND p_reconcile AND p_actor_id IS NOT NULL THEN
    INSERT INTO public.meta_stage_transitions (
      lead_id, from_stage, to_stage, actor_id, decision_kind
    ) VALUES (
      p_lead_id, v_lead.funnel_stage, 'qualified', p_actor_id, 'reconciliation'
    ) RETURNING occurred_at, actor_id INTO v_qualified_at, v_qualified_actor;
  END IF;
  IF v_qualified_at IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.meta_qualification_events (
    lead_id, attribution_id, platform_lead_id, form_id,
    client_slug, location_id, event_id, qualified_at, actor_id
  ) VALUES (
    p_lead_id, v_source.attribution_id, v_source.platform_lead_id,
    v_source.form_id, v_source.client_slug, v_source.location_id,
    'wm_meta_qualified_' || p_lead_id::text,
    v_qualified_at, v_qualified_actor
  ) ON CONFLICT (lead_id) DO NOTHING;
  SELECT * INTO v_qualification FROM public.meta_qualification_events
  WHERE lead_id = p_lead_id;

  SELECT decision = 'granted' INTO v_marketing_granted
  FROM public.lead_consent_events WHERE lead_id = p_lead_id
    AND purpose = 'marketing_communications'
    AND source = 'meta_lead_ads'
    AND metadata ->> 'form_id' = v_source.form_id
    AND metadata ->> 'platform_lead_id' = v_source.platform_lead_id
  ORDER BY created_at DESC, id DESC LIMIT 1;
  SELECT decision = 'granted' INTO v_sharing_granted
  FROM public.lead_consent_events WHERE lead_id = p_lead_id
    AND purpose = 'contractor_sharing'
    AND source = 'meta_lead_ads'
    AND metadata ->> 'form_id' = v_source.form_id
    AND metadata ->> 'platform_lead_id' = v_source.platform_lead_id
  ORDER BY created_at DESC, id DESC LIMIT 1;
  SELECT decision = 'granted' INTO v_measurement_granted
  FROM public.lead_consent_events WHERE lead_id = p_lead_id
    AND purpose = 'advertising_measurement'
    AND source = 'meta_lead_ads'
    AND metadata ->> 'form_id' = v_source.form_id
    AND metadata ->> 'platform_lead_id' = v_source.platform_lead_id
  ORDER BY created_at DESC, id DESC LIMIT 1;

  IF COALESCE(v_marketing_granted, false) AND COALESCE(v_sharing_granted, false) THEN
    INSERT INTO public.meta_integration_outbox (
      qualification_id, lead_id, job_kind, event_id, location_id
    ) VALUES (
      v_qualification.id, p_lead_id, 'ghl_contact',
      v_qualification.event_id || '_ghl', v_qualification.location_id
    ) ON CONFLICT (qualification_id, job_kind) DO NOTHING;
  END IF;
  IF COALESCE(v_measurement_granted, false) THEN
    INSERT INTO public.meta_integration_outbox (
      qualification_id, lead_id, job_kind, event_id
    ) VALUES (
      v_qualification.id, p_lead_id, 'meta_qualified',
      v_qualification.event_id
    ) ON CONFLICT (qualification_id, job_kind) DO NOTHING;
  END IF;
  RETURN v_qualification.id;
END;
$$;

CREATE FUNCTION public.meta_set_lead_funnel_stage(
  p_lead_id uuid, p_funnel_stage text, p_actor_id uuid
)
RETURNS public.leads LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_previous_stage text;
BEGIN
  IF p_actor_id IS NULL OR p_funnel_stage NOT IN (
    'new', 'qualified', 'analyzing', 'routed', 'contacted',
    'booked', 'closed', 'stale', 'ghost'
  ) THEN
    RAISE EXCEPTION 'invalid_meta_stage_request' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_lead.funnel_stage IS DISTINCT FROM p_funnel_stage THEN
    v_previous_stage := v_lead.funnel_stage;
    UPDATE public.leads SET funnel_stage = p_funnel_stage, updated_at = now()
    WHERE id = p_lead_id RETURNING * INTO v_lead;
    INSERT INTO public.meta_stage_transitions (
      lead_id, from_stage, to_stage, actor_id, decision_kind
    ) VALUES (
      p_lead_id, v_previous_stage, p_funnel_stage, p_actor_id, 'transition'
    );
  END IF;
  IF p_funnel_stage = 'qualified' THEN
    PERFORM public.meta_queue_qualification(p_lead_id, p_actor_id, false);
  END IF;
  RETURN v_lead;
END;
$$;

CREATE FUNCTION public.meta_claim_integration_outbox(
  p_job_kind text, p_limit integer DEFAULT 10
)
RETURNS SETOF public.meta_integration_outbox
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH due AS (
    SELECT id FROM public.meta_integration_outbox
    WHERE job_kind = p_job_kind AND (
      (status IN ('pending', 'retry') AND next_attempt_at <= now())
       OR (status = 'processing' AND lease_expires_at < now())
    )
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 25)
  )
  UPDATE public.meta_integration_outbox AS o
  SET status = 'processing', attempt_count = o.attempt_count + 1,
      lease_token = gen_random_uuid(), lease_expires_at = now() + interval '5 minutes',
      updated_at = now()
  FROM due WHERE o.id = due.id
  RETURNING o.*;
$$;

CREATE FUNCTION public.meta_complete_integration_outbox(
  p_id uuid, p_lease_token uuid, p_http_status integer,
  p_contact_id text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job public.meta_integration_outbox%ROWTYPE;
  v_existing_contact_id text;
BEGIN
  SELECT * INTO v_job FROM public.meta_integration_outbox
  WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_job.status <> 'processing'
     OR v_job.lease_token IS DISTINCT FROM p_lease_token
     OR v_job.lease_expires_at <= now() THEN
    RAISE EXCEPTION 'meta_outbox_lease_invalid' USING ERRCODE = '40001';
  END IF;
  IF v_job.job_kind = 'ghl_contact' THEN
    IF NULLIF(btrim(p_contact_id), '') IS NULL THEN
      RAISE EXCEPTION 'ghl_contact_id_required' USING ERRCODE = '22023';
    END IF;
    SELECT contact_id INTO v_existing_contact_id
    FROM public.meta_ghl_contact_links
    WHERE lead_id = v_job.lead_id AND location_id = v_job.location_id
    FOR UPDATE;
    IF v_existing_contact_id IS NOT NULL AND v_existing_contact_id <> p_contact_id THEN
      RAISE EXCEPTION 'ghl_contact_link_diverged' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.meta_ghl_contact_links (
      lead_id, location_id, contact_id, qualification_id
    ) VALUES (
      v_job.lead_id, v_job.location_id, p_contact_id, v_job.qualification_id
    ) ON CONFLICT (lead_id, location_id) DO NOTHING;
  END IF;
  UPDATE public.meta_integration_outbox
  SET status = 'delivered', delivered_at = now(), last_http_status = p_http_status,
      last_error_code = NULL, lease_token = NULL, lease_expires_at = NULL,
      updated_at = now()
  WHERE id = p_id;
  RETURN true;
END;
$$;

CREATE FUNCTION public.meta_fail_integration_outbox(
  p_id uuid, p_lease_token uuid, p_error_code text,
  p_http_status integer, p_retryable boolean
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_status text;
BEGIN
  UPDATE public.meta_integration_outbox
  SET status = CASE WHEN p_retryable AND attempt_count < 8 THEN 'retry' ELSE 'dead' END,
      next_attempt_at = now() + make_interval(secs => LEAST(3600, (power(2, attempt_count) * 30)::integer)),
      lease_token = NULL, lease_expires_at = NULL,
      last_error_code = left(COALESCE(p_error_code, 'unknown'), 120),
      last_http_status = p_http_status, updated_at = now()
  WHERE id = p_id AND status = 'processing' AND lease_token = p_lease_token
  RETURNING status INTO v_status;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'meta_outbox_lease_invalid' USING ERRCODE = '40001';
  END IF;
  RETURN v_status;
END;
$$;

CREATE FUNCTION public.meta_replay_integration_outbox(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.meta_integration_outbox
  SET status = 'pending', attempt_count = 0, next_attempt_at = now(),
      last_error_code = NULL, lease_token = NULL, lease_expires_at = NULL,
      updated_at = now()
  WHERE id = p_id AND status = 'dead';
  RETURN FOUND;
END;
$$;

-- Schedules are prepared but not activated by migration application. Operators
-- must deploy both functions, provision the exact Vault URLs/secret, then call
-- meta_activate_worker_schedules(). meta_deactivate_worker_schedules() is the
-- outbound/inbox kill switch; it preserves every receipt and job.
CREATE FUNCTION public.meta_activate_worker_schedules()
RETURNS TABLE(inbox_jobid bigint, outbox_jobid bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_inbox_url text;
  v_outbox_url text;
  v_secret text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('meta-lead-ads-worker-schedules', 0)
  );
  SELECT decrypted_secret INTO v_inbox_url FROM vault.decrypted_secrets
  WHERE name = 'meta_lead_worker_url';
  SELECT decrypted_secret INTO v_outbox_url FROM vault.decrypted_secrets
  WHERE name = 'meta_outbox_worker_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
  WHERE name = 'meta_worker_secret';
  IF v_inbox_url IS DISTINCT FROM
       'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/process-meta-lead'
     OR v_outbox_url IS DISTINCT FROM
       'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/process-meta-outbox'
     OR NULLIF(btrim(v_secret), '') IS NULL THEN
    RAISE EXCEPTION 'meta_worker_vault_config_missing_or_wrong_target';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname IN ('meta-lead-inbox-v1', 'meta-lead-outbox-v1')
  ) THEN
    RAISE EXCEPTION 'meta_worker_schedule_already_exists';
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
  $cron$) INTO inbox_jobid;
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
  $cron$) INTO outbox_jobid;
  RETURN NEXT;
END;
$function$;

CREATE FUNCTION public.meta_deactivate_worker_schedules()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_job_id bigint;
  v_count integer := 0;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('meta-lead-ads-worker-schedules', 0)
  );
  FOR v_job_id IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('meta-lead-inbox-v1', 'meta-lead-outbox-v1')
  LOOP
    IF cron.unschedule(v_job_id) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'meta_worker_unschedule_failed';
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Every privileged callable function is limited to the service role. No new
-- browser/table grants or RLS policies are introduced by this migration.
REVOKE ALL ON FUNCTION public.meta_claim_lead_inbox(integer),
  public.meta_complete_lead_inbox(uuid, uuid, jsonb, jsonb, bigint, jsonb, jsonb),
  public.meta_fail_lead_inbox(uuid, uuid, text, boolean),
  public.meta_replay_lead_inbox(uuid),
  public.meta_queue_qualification(uuid, uuid, boolean),
  public.meta_set_lead_funnel_stage(uuid, text, uuid),
  public.meta_claim_integration_outbox(text, integer),
  public.meta_complete_integration_outbox(uuid, uuid, integer, text),
  public.meta_fail_integration_outbox(uuid, uuid, text, integer, boolean),
  public.meta_replay_integration_outbox(uuid),
  public.meta_activate_worker_schedules(),
  public.meta_deactivate_worker_schedules()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_claim_lead_inbox(integer),
  public.meta_complete_lead_inbox(uuid, uuid, jsonb, jsonb, bigint, jsonb, jsonb),
  public.meta_fail_lead_inbox(uuid, uuid, text, boolean),
  public.meta_replay_lead_inbox(uuid),
  public.meta_queue_qualification(uuid, uuid, boolean),
  public.meta_set_lead_funnel_stage(uuid, text, uuid),
  public.meta_claim_integration_outbox(text, integer),
  public.meta_complete_integration_outbox(uuid, uuid, integer, text),
  public.meta_fail_integration_outbox(uuid, uuid, text, integer, boolean),
  public.meta_replay_integration_outbox(uuid),
  public.meta_activate_worker_schedules(),
  public.meta_deactivate_worker_schedules()
  TO service_role;

COMMIT;
