-- ==========================================================================
-- Sprint 1N — Dispatch Eligibility Gate + Outbox Contract
-- Adapted to deployed canonical event ledger: public.event_logs.
-- ========================================================================== 

CREATE TABLE IF NOT EXISTS public.platform_dispatch_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  canonical_event_log_id uuid NOT NULL REFERENCES public.event_logs(id) ON DELETE CASCADE,
  canonical_event_id text NULL,
  canonical_event_name text NOT NULL,
  canonical_event_timestamp timestamptz NULL,

  client_id uuid NULL REFERENCES public.clients(id),
  client_slug text NOT NULL,
  platform_config_id uuid NOT NULL REFERENCES public.client_platform_configs(id) ON DELETE RESTRICT,
  platform_name public.wm_platform_name NOT NULL,

  dispatch_event_name text NOT NULL,
  mapper_version text NOT NULL,
  payload_version text NOT NULL DEFAULT 'outbox-contract-v1',
  idempotency_key text NOT NULL,
  payload_hash text NULL,
  redacted_payload_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  eligibility_status text NOT NULL DEFAULT 'eligible_not_sent',
  eligibility_reasons text[] NOT NULL DEFAULT '{}',
  readiness_status text NULL,
  dry_run_only boolean NOT NULL DEFAULT true,
  send_enabled boolean NOT NULL DEFAULT false,

  eligibility_version text NOT NULL DEFAULT 'dispatch-eligibility-v1',
  candidate_fingerprint text NOT NULL,
  decision_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  value_usd numeric NULL,
  currency text NOT NULL DEFAULT 'USD',
  value_basis text NULL,
  true_margin_available boolean NULL,

  attribution_strength text NULL,
  token_present boolean NOT NULL DEFAULT false,
  destination_present boolean NOT NULL DEFAULT false,
  config_state text NULL,
  validation_status text NULL,

  lifecycle_status text NOT NULL DEFAULT 'disabled_dry_run',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz NULL,
  locked_at timestamptz NULL,
  locked_by text NULL,
  sent_at timestamptz NULL,
  external_event_id text NULL,
  last_error text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT platform_dispatch_outbox_idempotency_key_key UNIQUE (idempotency_key),
  CONSTRAINT platform_dispatch_outbox_event_config_key UNIQUE (canonical_event_log_id, platform_config_id),
  CONSTRAINT platform_dispatch_outbox_currency_check CHECK (currency = 'USD'),
  CONSTRAINT platform_dispatch_outbox_send_disabled_check CHECK (send_enabled = false),
  CONSTRAINT platform_dispatch_outbox_dry_run_only_check CHECK (dry_run_only = true),
  CONSTRAINT platform_dispatch_outbox_value_check CHECK (value_usd IS NULL OR value_usd >= 0),
  CONSTRAINT platform_dispatch_outbox_attempt_count_check CHECK (attempt_count >= 0),
  CONSTRAINT platform_dispatch_outbox_max_attempts_check CHECK (max_attempts >= 0),
  CONSTRAINT platform_dispatch_outbox_eligibility_status_check CHECK (eligibility_status IN ('eligible_not_sent','warning_not_sent','blocked','duplicate_protected','skipped','superseded')),
  CONSTRAINT platform_dispatch_outbox_lifecycle_status_check CHECK (lifecycle_status IN ('disabled_dry_run','candidate','materialized_not_sendable','blocked','superseded','cancelled')),
  CONSTRAINT platform_dispatch_outbox_no_sent_at_check CHECK (sent_at IS NULL),
  CONSTRAINT platform_dispatch_outbox_no_external_event_id_check CHECK (external_event_id IS NULL),
  CONSTRAINT platform_dispatch_outbox_no_worker_lock_check CHECK (locked_at IS NULL AND locked_by IS NULL AND next_attempt_at IS NULL)
);

CREATE TABLE IF NOT EXISTS public.platform_dispatch_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id uuid NOT NULL REFERENCES public.platform_dispatch_outbox(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  attempt_number integer NOT NULL,
  dry_run boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'not_sent',
  request_payload_hash text NULL,
  redacted_request_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_status_code integer NULL,
  response_excerpt text NULL,
  error_code text NULL,
  error_message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT platform_dispatch_attempts_attempt_number_check CHECK (attempt_number >= 0),
  CONSTRAINT platform_dispatch_attempts_dry_run_check CHECK (dry_run = true),
  CONSTRAINT platform_dispatch_attempts_status_check CHECK (status IN ('not_sent','simulated','failed_preflight','blocked_by_gate')),
  CONSTRAINT platform_dispatch_attempts_no_external_response_check CHECK (response_status_code IS NULL AND response_excerpt IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_platform_dispatch_outbox_event_log ON public.platform_dispatch_outbox (canonical_event_log_id);
CREATE INDEX IF NOT EXISTS idx_platform_dispatch_outbox_client_created ON public.platform_dispatch_outbox (client_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_dispatch_outbox_platform_status ON public.platform_dispatch_outbox (platform_name, eligibility_status);
CREATE INDEX IF NOT EXISTS idx_platform_dispatch_outbox_platform_config ON public.platform_dispatch_outbox (platform_config_id);
CREATE INDEX IF NOT EXISTS idx_platform_dispatch_outbox_idempotency_key ON public.platform_dispatch_outbox (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_platform_dispatch_outbox_lifecycle_created ON public.platform_dispatch_outbox (lifecycle_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_dispatch_attempts_outbox_attempt ON public.platform_dispatch_attempts (outbox_id, attempt_number);

DROP TRIGGER IF EXISTS trg_platform_dispatch_outbox_updated_at ON public.platform_dispatch_outbox;
CREATE TRIGGER trg_platform_dispatch_outbox_updated_at
  BEFORE UPDATE ON public.platform_dispatch_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.compute_platform_dispatch_idempotency_key(
  p_canonical_event_log_id uuid,
  p_canonical_event_id text,
  p_platform_config_id uuid,
  p_platform_name text,
  p_client_slug text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'wm_dispatch:v1:' || md5(concat_ws('|', COALESCE(p_canonical_event_log_id::text, ''), COALESCE(p_canonical_event_id, ''), COALESCE(p_platform_config_id::text, ''), COALESCE(p_platform_name, ''), COALESCE(p_client_slug, '')));
$$;

CREATE OR REPLACE FUNCTION public.platform_dispatch_outbox_no_live_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.send_enabled IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'live_dispatch_disabled: send_enabled must remain false in Sprint 1N';
  END IF;
  IF NEW.dry_run_only IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'live_dispatch_disabled: dry_run_only must remain true in Sprint 1N';
  END IF;
  IF NEW.sent_at IS NOT NULL THEN
    RAISE EXCEPTION 'sent_at_forbidden: outbox rows cannot be marked sent in Sprint 1N';
  END IF;
  IF NEW.external_event_id IS NOT NULL THEN
    RAISE EXCEPTION 'external_event_id_forbidden: external IDs cannot be stored before live dispatch is enabled';
  END IF;
  IF NEW.locked_at IS NOT NULL OR NEW.locked_by IS NOT NULL OR NEW.next_attempt_at IS NOT NULL THEN
    RAISE EXCEPTION 'worker_lock_forbidden: worker locking and retry scheduling are disabled in Sprint 1N';
  END IF;
  IF NEW.lifecycle_status NOT IN ('disabled_dry_run','candidate','materialized_not_sendable','blocked','superseded','cancelled') THEN
    RAISE EXCEPTION 'live_dispatch_disabled: lifecycle_status % is not allowed in Sprint 1N', NEW.lifecycle_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_dispatch_outbox_no_live_guard ON public.platform_dispatch_outbox;
CREATE TRIGGER trg_platform_dispatch_outbox_no_live_guard
  BEFORE INSERT OR UPDATE ON public.platform_dispatch_outbox
  FOR EACH ROW EXECUTE FUNCTION public.platform_dispatch_outbox_no_live_guard();

CREATE OR REPLACE FUNCTION public.platform_dispatch_attempts_no_live_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.dry_run IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'live_dispatch_disabled: attempt dry_run must remain true in Sprint 1N';
  END IF;
  IF NEW.status NOT IN ('not_sent','simulated','failed_preflight','blocked_by_gate') THEN
    RAISE EXCEPTION 'live_attempt_status_forbidden: attempt status % is not allowed in Sprint 1N', NEW.status;
  END IF;
  IF NEW.response_status_code IS NOT NULL OR NEW.response_excerpt IS NOT NULL THEN
    RAISE EXCEPTION 'external_response_forbidden: external response fields cannot be populated in Sprint 1N';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_dispatch_attempts_no_live_guard ON public.platform_dispatch_attempts;
CREATE TRIGGER trg_platform_dispatch_attempts_no_live_guard
  BEFORE INSERT OR UPDATE ON public.platform_dispatch_attempts
  FOR EACH ROW EXECUTE FUNCTION public.platform_dispatch_attempts_no_live_guard();

ALTER TABLE public.platform_dispatch_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_dispatch_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_dispatch_outbox_service_role_all ON public.platform_dispatch_outbox;
CREATE POLICY platform_dispatch_outbox_service_role_all ON public.platform_dispatch_outbox FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS platform_dispatch_outbox_select_internal ON public.platform_dispatch_outbox;
CREATE POLICY platform_dispatch_outbox_select_internal ON public.platform_dispatch_outbox FOR SELECT TO authenticated USING (public.is_internal_operator());
DROP POLICY IF EXISTS platform_dispatch_attempts_service_role_all ON public.platform_dispatch_attempts;
CREATE POLICY platform_dispatch_attempts_service_role_all ON public.platform_dispatch_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS platform_dispatch_attempts_select_internal ON public.platform_dispatch_attempts;
CREATE POLICY platform_dispatch_attempts_select_internal ON public.platform_dispatch_attempts FOR SELECT TO authenticated USING (public.is_internal_operator());

CREATE OR REPLACE FUNCTION public.admin_dispatch_outbox_candidates()
RETURNS TABLE (
  candidate_id text,
  event_row_id uuid,
  canonical_event_id text,
  canonical_event_name text,
  canonical_event_timestamp timestamptz,
  client_id uuid,
  client_slug text,
  platform_config_id uuid,
  platform_name text,
  dispatch_event_name text,
  mapper_version text,
  idempotency_key text,
  candidate_fingerprint text,
  eligibility_version text,
  eligibility_status text,
  eligibility_reasons text[],
  readiness_status text,
  outbox_row_exists boolean,
  outbox_id uuid,
  value_usd numeric,
  currency text,
  value_basis text,
  true_margin_available boolean,
  attribution_strength text,
  token_present boolean,
  destination_present boolean,
  config_state text,
  validation_status text,
  decision_snapshot jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_internal_operator() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH event_rows AS (
    SELECT
      e.id AS event_row_id,
      COALESCE(NULLIF(BTRIM(e.metadata->>'event_id'), ''), e.id::text) AS canonical_event_id,
      e.event_name AS canonical_event_name,
      e.created_at AS canonical_event_timestamp,
      NULLIF(BTRIM(COALESCE(e.metadata->>'client_slug', l.client_slug)), '') AS resolved_client_slug,
      true AS payload_is_object,
      COALESCE(e.metadata->>'disposition_state', l.deal_status, l.status) AS disposition_state,
      COALESCE(e.metadata->>'optimization_value_basis', 'gross_sale_value') AS value_basis,
      CASE WHEN e.metadata->>'true_margin_available' IN ('true','false') THEN (e.metadata->>'true_margin_available')::boolean ELSE NULL END AS true_margin_available,
      COALESCE(
        CASE WHEN (e.metadata->>'final_value_usd') ~ '^[0-9]+(\.[0-9]+)?$' THEN (e.metadata->>'final_value_usd')::numeric ELSE NULL END,
        CASE WHEN (e.metadata->>'final_value_cents') ~ '^[0-9]+(\.[0-9]+)?$' THEN (e.metadata->>'final_value_cents')::numeric / 100 ELSE NULL END,
        CASE WHEN (e.metadata->>'value_usd') ~ '^[0-9]+(\.[0-9]+)?$' THEN (e.metadata->>'value_usd')::numeric ELSE NULL END,
        l.revenue_amount,
        l.deal_value,
        l.quote_amount
      ) AS value_usd,
      e.lead_id,
      COALESCE(e.metadata ? 'fbclid', false) AS has_fbclid,
      COALESCE(e.metadata ? 'fbc', false) AS has_fbc,
      COALESCE(e.metadata ? 'fbp', false) AS has_fbp,
      COALESCE(e.metadata ? 'gclid', false) AS has_gclid,
      COALESCE(e.metadata ? 'wbraid', false) AS has_wbraid,
      COALESCE(e.metadata ? 'gbraid', false) AS has_gbraid,
      COALESCE(e.metadata ? 'ttclid', false) AS has_ttclid,
      COALESCE(e.metadata ? 'ttp', false) AS has_ttp,
      COALESCE(e.metadata ? 'msclkid', false) AS has_msclkid,
      COALESCE(e.metadata ? 'utm_source', false) AS has_utm_source,
      COALESCE(e.metadata ? 'utm_campaign', false) AS has_utm_campaign
    FROM public.event_logs e
    LEFT JOIN public.leads l ON l.id = e.lead_id
    WHERE
      e.event_name ILIKE '%sold%'
      OR e.event_name ILIKE '%purchase%'
      OR e.event_name IN ('sold','sold_closed','purchase','Purchase','wm_sold')
      OR e.metadata->>'disposition_state' = 'sold_closed'
  ),
  enriched AS (
    SELECT
      e.*,
      c.id AS resolved_client_id,
      c.is_active AS client_is_active,
      EXISTS (SELECT 1 FROM public.client_platform_configs any_cpc WHERE any_cpc.client_id = c.id) AS has_any_platform_config
    FROM event_rows e
    LEFT JOIN public.clients c ON c.slug = e.resolved_client_slug
  ),
  candidates AS (
    SELECT
      e.*,
      cpc.id AS platform_config_id,
      cpc.platform_name,
      cpc.token_secret_id IS NOT NULL AS token_present,
      cpc.config_state,
      cpc.validation_status,
      CASE
        WHEN cpc.platform_name::text IN ('meta','tiktok') THEN NULLIF(BTRIM(COALESCE(cpc.pixel_id, cpc.dataset_id)), '') IS NOT NULL
        WHEN cpc.platform_name::text IN ('google_ads','ga4') THEN NULLIF(BTRIM(COALESCE(cpc.conversion_id, cpc.conversion_label)), '') IS NOT NULL
        WHEN cpc.platform_name::text IN ('gtm_server','crm_webhook','other') THEN NULLIF(BTRIM(cpc.endpoint_url), '') IS NOT NULL
        ELSE cpc.id IS NOT NULL
      END AS destination_present
    FROM enriched e
    LEFT JOIN public.client_platform_configs cpc ON cpc.client_id = e.resolved_client_id AND cpc.is_active = true
  ),
  computed AS (
    SELECT
      c.*,
      'Purchase'::text AS dispatch_event_name,
      CASE
        WHEN c.platform_name::text = 'tiktok' THEN 'tiktok-dry-run-v1'
        WHEN c.platform_name::text = 'meta' THEN 'meta-draft-simulation'
        WHEN c.platform_name::text IN ('google_ads','ga4') THEN 'google-draft-simulation'
        WHEN c.platform_name::text IN ('gtm_server','crm_webhook') THEN 'endpoint-draft-simulation'
        ELSE 'platform-draft-simulation'
      END AS mapper_version,
      CASE
        WHEN (c.has_fbclid OR c.has_fbc OR c.has_fbp OR c.has_gclid OR c.has_wbraid OR c.has_gbraid OR c.has_ttclid OR c.has_ttp OR c.has_msclkid) AND c.lead_id IS NOT NULL THEN 'strong'
        WHEN (c.has_utm_source OR c.has_utm_campaign) AND c.lead_id IS NOT NULL THEN 'medium'
        ELSE 'weak'
      END AS attribution_strength,
      public.compute_platform_dispatch_idempotency_key(c.event_row_id, c.canonical_event_id, c.platform_config_id, c.platform_name::text, c.resolved_client_slug) AS idempotency_key
    FROM candidates c
  ),
  reasoned AS (
    SELECT
      c.*,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN c.canonical_event_id IS NULL OR BTRIM(c.canonical_event_id) = '' THEN 'missing_event_id' END,
        CASE WHEN c.resolved_client_slug IS NULL THEN 'missing_client_slug' END,
        CASE WHEN c.resolved_client_slug IS NOT NULL AND c.resolved_client_id IS NULL THEN 'tenant_not_resolved' END,
        CASE WHEN c.resolved_client_id IS NOT NULL AND c.platform_config_id IS NULL THEN 'no_active_platform_config' END,
        CASE WHEN c.resolved_client_id IS NOT NULL AND c.platform_config_id IS NULL AND c.has_any_platform_config THEN 'platform_config_inactive' END,
        CASE WHEN c.platform_config_id IS NOT NULL AND c.validation_status <> 'validation_passed' THEN 'platform_config_not_validated' END,
        CASE WHEN c.platform_config_id IS NOT NULL AND c.platform_name::text IN ('meta','tiktok','google_ads','ga4') AND NOT c.token_present THEN 'token_missing' END,
        CASE WHEN c.platform_config_id IS NOT NULL AND NOT c.destination_present THEN 'destination_missing' END,
        CASE WHEN c.value_usd IS NULL OR c.value_usd <= 0 THEN 'value_missing' END,
        CASE WHEN NOT c.payload_is_object THEN 'payload_malformed' END,
        CASE WHEN COALESCE(c.true_margin_available, false) = false THEN 'gross_value_used_not_true_margin' END,
        'dry_run_only',
        'send_disabled_by_design'
      ], NULL)::text[] AS base_reasons
    FROM computed c
  ),
  with_existing AS (
    SELECT r.*, o.id AS outbox_id, o.id IS NOT NULL AS outbox_row_exists
    FROM reasoned r
    LEFT JOIN public.platform_dispatch_outbox o ON o.canonical_event_log_id = r.event_row_id AND o.platform_config_id = r.platform_config_id
  ),
  final_rows AS (
    SELECT
      w.*,
      CASE WHEN w.outbox_row_exists THEN ARRAY_APPEND(w.base_reasons, 'duplicate_outbox_row_exists') ELSE w.base_reasons END AS eligibility_reasons,
      CASE
        WHEN w.outbox_row_exists THEN 'duplicate_protected'
        WHEN w.platform_config_id IS NULL OR w.resolved_client_slug IS NULL OR w.resolved_client_id IS NULL OR w.canonical_event_id IS NULL OR NOT w.payload_is_object THEN 'blocked'
        WHEN (w.value_usd IS NULL OR w.value_usd <= 0 OR NOT w.destination_present OR (w.platform_name::text IN ('meta','tiktok','google_ads','ga4') AND NOT w.token_present) OR w.validation_status <> 'validation_passed' OR COALESCE(w.true_margin_available, false) = false) THEN 'warning_not_sent'
        ELSE 'eligible_not_sent'
      END AS eligibility_status,
      CASE
        WHEN w.platform_config_id IS NULL OR w.resolved_client_slug IS NULL OR w.resolved_client_id IS NULL OR w.canonical_event_id IS NULL OR NOT w.payload_is_object THEN 'blocked'
        WHEN (w.value_usd IS NULL OR w.value_usd <= 0 OR NOT w.destination_present OR (w.platform_name::text IN ('meta','tiktok','google_ads','ga4') AND NOT w.token_present) OR w.validation_status <> 'validation_passed' OR COALESCE(w.true_margin_available, false) = false) THEN 'warning'
        ELSE 'ready'
      END AS readiness_status
    FROM with_existing w
  )
  SELECT
    md5(concat_ws('|', f.event_row_id::text, COALESCE(f.platform_config_id::text, 'no_config'))) AS candidate_id,
    f.event_row_id,
    f.canonical_event_id,
    f.canonical_event_name,
    f.canonical_event_timestamp,
    f.resolved_client_id AS client_id,
    f.resolved_client_slug AS client_slug,
    f.platform_config_id,
    f.platform_name::text,
    f.dispatch_event_name,
    f.mapper_version,
    f.idempotency_key,
    md5(concat_ws('|', f.event_row_id::text, COALESCE(f.canonical_event_id, ''), COALESCE(f.resolved_client_slug, ''), COALESCE(f.platform_config_id::text, ''), COALESCE(f.platform_name::text, ''), COALESCE(f.value_usd::text, ''), 'USD', f.eligibility_status, array_to_string(f.eligibility_reasons, ','), COALESCE(f.config_state, ''), COALESCE(f.validation_status, ''), COALESCE(f.token_present::text, ''), COALESCE(f.destination_present::text, ''), f.attribution_strength)) AS candidate_fingerprint,
    'dispatch-eligibility-v1'::text AS eligibility_version,
    f.eligibility_status,
    f.eligibility_reasons,
    f.readiness_status,
    f.outbox_row_exists,
    f.outbox_id,
    f.value_usd,
    'USD'::text AS currency,
    f.value_basis,
    f.true_margin_available,
    f.attribution_strength,
    COALESCE(f.token_present, false),
    COALESCE(f.destination_present, false),
    f.config_state,
    f.validation_status,
    jsonb_build_object(
      'eligibility_version', 'dispatch-eligibility-v1',
      'canonical_event', jsonb_build_object('event_log_id', f.event_row_id, 'event_id_present', f.canonical_event_id IS NOT NULL, 'event_id_masked', CASE WHEN f.canonical_event_id IS NULL THEN NULL WHEN length(f.canonical_event_id) <= 12 THEN f.canonical_event_id ELSE left(f.canonical_event_id, 8) || '…' || right(f.canonical_event_id, 4) END, 'event_name', f.canonical_event_name, 'event_timestamp', f.canonical_event_timestamp),
      'routing', jsonb_build_object('client_id', f.resolved_client_id, 'client_slug', f.resolved_client_slug, 'platform_config_id', f.platform_config_id, 'platform_name', f.platform_name::text),
      'config_snapshot', jsonb_build_object('config_state', f.config_state, 'validation_status', f.validation_status, 'token_present', COALESCE(f.token_present, false), 'destination_present', COALESCE(f.destination_present, false)),
      'value_snapshot', jsonb_build_object('value_usd', f.value_usd, 'currency', 'USD', 'value_basis', f.value_basis, 'true_margin_available', f.true_margin_available),
      'attribution_strength', f.attribution_strength,
      'reason_codes', f.eligibility_reasons,
      'idempotency_key', f.idempotency_key,
      'safety', jsonb_build_object('dry_run_only', true, 'send_enabled', false, 'external_dispatch', false)
    ) AS decision_snapshot
  FROM final_rows f
  ORDER BY f.canonical_event_timestamp DESC NULLS LAST, f.event_row_id DESC, f.platform_name::text NULLS LAST
  LIMIT 1000;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_platform_dispatch_idempotency_key(uuid, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_platform_dispatch_idempotency_key(uuid, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_platform_dispatch_idempotency_key(uuid, text, uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.admin_dispatch_outbox_candidates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_dispatch_outbox_candidates() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_dispatch_outbox_candidates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dispatch_outbox_candidates() TO service_role;

COMMENT ON TABLE public.platform_dispatch_outbox IS 'Dry-run-only platform dispatch outbox contract. Live dispatch fields are blocked by constraints and triggers until a future explicit migration.';
COMMENT ON TABLE public.platform_dispatch_attempts IS 'Future attempt audit table constrained to non-sending statuses for Sprint 1N.';
COMMENT ON COLUMN public.platform_dispatch_outbox.idempotency_key IS 'Stable key: wm_dispatch:v1:md5(canonical_event_log_id|canonical_event_id|platform_config_id|platform_name|client_slug). Mapper/payload versions are intentionally excluded.';
COMMENT ON COLUMN public.platform_dispatch_outbox.decision_snapshot IS 'Immutable redacted eligibility proof; must not contain raw PII, click IDs, Vault tokens, or full payload bodies.';
COMMENT ON FUNCTION public.admin_dispatch_outbox_candidates() IS 'Read-only internal operator eligibility gate for canonical sold/revenue events. Does not insert, update, send, ping, or expose secrets.';