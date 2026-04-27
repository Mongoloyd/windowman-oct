-- Phase 3H — Revenue Signal Idempotency + Platform Readiness Hardening
-- No external dispatch. No RLS weakening.

CREATE OR REPLACE FUNCTION public.revenue_signal_key(
  p_client_slug text,
  p_contractor_outcome_id uuid,
  p_disposition_state text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN NULLIF(BTRIM(COALESCE(p_client_slug, '')), '') IS NULL
      OR p_contractor_outcome_id IS NULL
      OR NULLIF(BTRIM(COALESCE(p_disposition_state, '')), '') IS NULL
    THEN NULL
    ELSE md5(lower(concat_ws(':', BTRIM(p_client_slug), p_contractor_outcome_id::text, BTRIM(p_disposition_state))))
  END;
$$;

CREATE OR REPLACE FUNCTION public.revenue_signal_key_from_metadata(p_metadata jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_metadata IS NULL
      OR NULLIF(BTRIM(COALESCE(p_metadata->>'client_slug', '')), '') IS NULL
      OR NOT (COALESCE(p_metadata->>'contractor_outcome_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      OR NULLIF(BTRIM(COALESCE(p_metadata->>'disposition_state', '')), '') IS NULL
    THEN NULL
    ELSE public.revenue_signal_key(
      p_metadata->>'client_slug',
      (p_metadata->>'contractor_outcome_id')::uuid,
      p_metadata->>'disposition_state'
    )
  END;
$$;

ALTER TABLE public.contractor_outcomes
  ADD COLUMN IF NOT EXISTS revenue_signal_key text GENERATED ALWAYS AS (
    CASE
      WHEN disposition_state = 'sold_closed'
       AND NULLIF(BTRIM(COALESCE(client_slug, '')), '') IS NOT NULL
      THEN public.revenue_signal_key(client_slug, id, disposition_state)
      ELSE NULL
    END
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS contractor_outcomes_revenue_signal_key_unique
  ON public.contractor_outcomes (revenue_signal_key)
  WHERE revenue_signal_key IS NOT NULL;

DROP INDEX IF EXISTS event_logs_contractor_outcome_sold_signal_unique;
CREATE UNIQUE INDEX IF NOT EXISTS event_logs_revenue_signal_key_unique
  ON public.event_logs ((COALESCE(metadata->>'revenue_signal_key', public.revenue_signal_key_from_metadata(metadata))))
  WHERE event_name = 'sold'
    AND metadata->>'revenue_truth_source' = 'contractor_outcomes'
    AND COALESCE(metadata->>'revenue_signal_key', public.revenue_signal_key_from_metadata(metadata)) IS NOT NULL;

DROP FUNCTION IF EXISTS public.admin_revenue_signal_eligibility();
CREATE OR REPLACE FUNCTION public.admin_revenue_signal_eligibility()
RETURNS TABLE (
  outcome_id uuid,
  revenue_signal_key text,
  lead_id uuid,
  scan_session_id uuid,
  analysis_id uuid,
  lead_assignment_id uuid,
  client_slug text,
  contractor_account_id uuid,
  contractor_id uuid,
  opportunity_id uuid,
  disposition_state text,
  final_value_cents integer,
  final_value_usd numeric,
  sold_currency text,
  value_basis text,
  outcome_integrity_status text,
  outcome_integrity_reasons text[],
  eligible_for_revenue_signal boolean,
  existing_signal_id uuid,
  existing_event_id text,
  duplicate_protected boolean,
  external_dispatch boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_internal_operator() AND auth.role() <> 'service_role' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      co.id AS outcome_id,
      public.revenue_signal_key(COALESCE(co.client_slug, la.client_slug, opp.client_slug), co.id, co.disposition_state) AS canonical_revenue_signal_key,
      opp.lead_id,
      opp.scan_session_id,
      opp.analysis_id,
      co.lead_assignment_id,
      COALESCE(co.client_slug, la.client_slug, opp.client_slug) AS client_slug,
      co.contractor_account_id,
      co.contractor_id,
      co.opportunity_id,
      co.disposition_state,
      co.final_value_cents,
      (co.final_value_cents::numeric / 100) AS final_value_usd,
      co.sold_currency,
      co.value_basis,
      co.outcome_integrity_status,
      co.outcome_integrity_reasons,
      co.disposition_state = 'sold_closed'
        AND co.final_value_cents IS NOT NULL
        AND co.final_value_cents > 0
        AND co.value_basis IS NOT NULL
        AND co.value_basis <> 'unknown'
        AND COALESCE(co.client_slug, la.client_slug, opp.client_slug) IS NOT NULL
        AND NOT (co.outcome_integrity_reasons && ARRAY['sold_missing_value','sold_invalid_value','sold_missing_value_basis','value_basis_unknown','missing_client_slug','assignment_client_mismatch','contractor_client_mismatch','outcome_disputed','manual_review_required']::text[])
        AS eligible_for_revenue_signal
    FROM public.contractor_outcomes co
    LEFT JOIN public.contractor_opportunities opp ON opp.id = co.opportunity_id
    LEFT JOIN public.lead_assignments la ON la.id = co.lead_assignment_id
    WHERE co.disposition_state = 'sold_closed'
  )
  SELECT
    c.outcome_id,
    c.canonical_revenue_signal_key AS revenue_signal_key,
    c.lead_id,
    c.scan_session_id,
    c.analysis_id,
    c.lead_assignment_id,
    c.client_slug,
    c.contractor_account_id,
    c.contractor_id,
    c.opportunity_id,
    c.disposition_state,
    c.final_value_cents,
    c.final_value_usd,
    c.sold_currency,
    c.value_basis,
    c.outcome_integrity_status,
    c.outcome_integrity_reasons,
    c.eligible_for_revenue_signal,
    ev.id AS existing_signal_id,
    ev.metadata->>'event_id' AS existing_event_id,
    ev.id IS NOT NULL AS duplicate_protected,
    false AS external_dispatch
  FROM candidates c
  LEFT JOIN public.event_logs ev
    ON ev.event_name = 'sold'
   AND ev.metadata->>'revenue_truth_source' = 'contractor_outcomes'
   AND COALESCE(ev.metadata->>'revenue_signal_key', public.revenue_signal_key_from_metadata(ev.metadata)) = c.canonical_revenue_signal_key
  ORDER BY c.outcome_id DESC
  LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_sync_revenue_signals(p_limit integer DEFAULT 100, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
  v_duplicate integer := 0;
  v_blocked integer := 0;
  v_candidate record;
  v_event_id text;
BEGIN
  IF NOT public.is_internal_operator() AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  FOR v_candidate IN
    SELECT *
    FROM public.admin_revenue_signal_eligibility()
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  LOOP
    IF v_candidate.revenue_signal_key IS NULL THEN
      v_blocked := v_blocked + 1;
      CONTINUE;
    END IF;

    IF v_candidate.duplicate_protected THEN
      v_duplicate := v_duplicate + 1;
      CONTINUE;
    END IF;

    IF NOT v_candidate.eligible_for_revenue_signal THEN
      v_blocked := v_blocked + 1;
      CONTINUE;
    END IF;

    IF p_dry_run THEN
      CONTINUE;
    END IF;

    v_event_id := 'wmc_sold_' || v_candidate.revenue_signal_key;

    INSERT INTO public.event_logs (lead_id, session_id, user_id, event_name, flow_type, route, metadata)
    VALUES (
      v_candidate.lead_id,
      v_candidate.scan_session_id::text,
      NULL,
      'sold',
      'revenue_truth',
      'admin-sync-revenue-signals',
      jsonb_build_object(
        'event_id', v_event_id,
        'revenue_signal_key', v_candidate.revenue_signal_key,
        'event_timestamp', now(),
        'schema_version', 'phase-3h-revenue-signal-v2',
        'revenue_truth_source', 'contractor_outcomes',
        'revenue_rollup_target', 'leads',
        'source_system', 'admin-sync-revenue-signals',
        'disposition_state', 'sold_closed',
        'contractor_outcome_id', v_candidate.outcome_id,
        'opportunity_id', v_candidate.opportunity_id,
        'contractor_id', v_candidate.contractor_id,
        'contractor_account_id', v_candidate.contractor_account_id,
        'lead_assignment_id', v_candidate.lead_assignment_id,
        'client_slug', v_candidate.client_slug,
        'final_value_cents', v_candidate.final_value_cents,
        'final_value_usd', v_candidate.final_value_usd,
        'currency', v_candidate.sold_currency,
        'optimization_value_basis', v_candidate.value_basis,
        'true_margin_available', v_candidate.value_basis = 'true_margin',
        'margin_model_version', CASE WHEN v_candidate.value_basis = 'true_margin' THEN 'contractor_outcomes-v1' ELSE NULL END,
        'external_dispatch', false,
        'dispatch_created', false
      )
    )
    ON CONFLICT DO NOTHING;

    IF FOUND THEN
      v_inserted := v_inserted + 1;
    ELSE
      v_duplicate := v_duplicate + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'dry_run', p_dry_run,
    'external_dispatch', false,
    'dispatch_created', false,
    'inserted', v_inserted,
    'duplicate_protected', v_duplicate,
    'blocked', v_blocked
  );
END;
$$;

DROP FUNCTION IF EXISTS public.admin_revenue_dispatch_readiness();
CREATE OR REPLACE FUNCTION public.admin_revenue_dispatch_readiness()
RETURNS TABLE (
  event_row_id uuid,
  event_id text,
  revenue_signal_key text,
  event_name text,
  event_timestamp timestamptz,
  created_at timestamptz,
  lead_id uuid,
  scan_session_id uuid,
  analysis_id uuid,
  client_slug text,
  payload_is_object boolean,
  payload_metadata jsonb,
  raw_payload_metadata jsonb,
  optimization_value_usd numeric,
  final_value_cents numeric,
  final_value_usd numeric,
  disposition_state text,
  revenue_truth_source text,
  revenue_rollup_target text,
  source_system text,
  optimization_value_basis text,
  true_margin_available boolean,
  margin_model_version text,
  contractor_outcome_id uuid,
  opportunity_id uuid,
  contractor_id uuid,
  has_fbclid boolean,
  has_fbc boolean,
  has_fbp boolean,
  has_gclid boolean,
  has_wbraid boolean,
  has_gbraid boolean,
  has_ttclid boolean,
  has_ttp boolean,
  has_msclkid boolean,
  has_utm_source boolean,
  has_utm_campaign boolean,
  tenant_resolved boolean,
  active_platform_config_count integer,
  active_destination_configs_total integer,
  platform_configs jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_internal_operator() AND auth.role() <> 'service_role' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH event_rows AS (
    SELECT
      ev.id AS event_row_id,
      COALESCE(ev.metadata->>'event_id', ev.id::text) AS event_id,
      COALESCE(ev.metadata->>'revenue_signal_key', public.revenue_signal_key_from_metadata(ev.metadata)) AS revenue_signal_key,
      ev.event_name,
      COALESCE((ev.metadata->>'event_timestamp')::timestamptz, ev.created_at) AS event_timestamp,
      ev.created_at,
      ev.lead_id,
      CASE WHEN ev.session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN ev.session_id::uuid ELSE NULL END AS scan_session_id,
      CASE WHEN ev.metadata->>'analysis_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (ev.metadata->>'analysis_id')::uuid ELSE NULL END AS analysis_id,
      NULLIF(BTRIM(COALESCE(ev.metadata->>'client_slug', l.client_slug)), '') AS client_slug,
      true AS payload_is_object,
      COALESCE(ev.metadata, '{}'::jsonb) AS payload_metadata,
      '{}'::jsonb AS raw_payload_metadata,
      CASE WHEN (ev.metadata->>'final_value_usd') ~ '^[0-9]+(\.[0-9]+)?$' THEN (ev.metadata->>'final_value_usd')::numeric ELSE NULL END AS optimization_value_usd,
      CASE WHEN (ev.metadata->>'final_value_cents') ~ '^[0-9]+(\.[0-9]+)?$' THEN (ev.metadata->>'final_value_cents')::numeric ELSE NULL END AS final_value_cents,
      CASE WHEN (ev.metadata->>'final_value_usd') ~ '^[0-9]+(\.[0-9]+)?$' THEN (ev.metadata->>'final_value_usd')::numeric ELSE NULL END AS final_value_usd,
      ev.metadata->>'disposition_state' AS disposition_state,
      ev.metadata->>'revenue_truth_source' AS revenue_truth_source,
      ev.metadata->>'revenue_rollup_target' AS revenue_rollup_target,
      ev.metadata->>'source_system' AS source_system,
      ev.metadata->>'optimization_value_basis' AS optimization_value_basis,
      CASE WHEN ev.metadata->>'true_margin_available' IN ('true','false') THEN (ev.metadata->>'true_margin_available')::boolean ELSE NULL END AS true_margin_available,
      ev.metadata->>'margin_model_version' AS margin_model_version,
      CASE WHEN ev.metadata->>'contractor_outcome_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (ev.metadata->>'contractor_outcome_id')::uuid ELSE NULL END AS contractor_outcome_id,
      CASE WHEN ev.metadata->>'opportunity_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (ev.metadata->>'opportunity_id')::uuid ELSE NULL END AS opportunity_id,
      CASE WHEN ev.metadata->>'contractor_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (ev.metadata->>'contractor_id')::uuid ELSE NULL END AS contractor_id,
      ev.metadata ? 'fbclid' AS has_fbclid,
      ev.metadata ? 'fbc' AS has_fbc,
      ev.metadata ? 'fbp' AS has_fbp,
      ev.metadata ? 'gclid' AS has_gclid,
      ev.metadata ? 'wbraid' AS has_wbraid,
      ev.metadata ? 'gbraid' AS has_gbraid,
      ev.metadata ? 'ttclid' AS has_ttclid,
      ev.metadata ? 'ttp' AS has_ttp,
      ev.metadata ? 'msclkid' AS has_msclkid,
      ev.metadata ? 'utm_source' AS has_utm_source,
      ev.metadata ? 'utm_campaign' AS has_utm_campaign
    FROM public.event_logs ev
    LEFT JOIN public.leads l ON l.id = ev.lead_id
    WHERE ev.event_name ILIKE '%sold%'
       OR ev.event_name ILIKE '%purchase%'
       OR ev.metadata->>'disposition_state' = 'sold_closed'
  ),
  config_by_slug AS (
    SELECT
      c.slug AS client_slug,
      c.id AS client_id,
      COUNT(cpc.id)::integer AS active_platform_config_count,
      COALESCE(jsonb_agg(jsonb_build_object(
        'platform_name', cpc.platform_name::text,
        'is_active', cpc.is_active,
        'config_state', cpc.config_state,
        'validation_status', cpc.validation_status,
        'token_present', cpc.token_secret_id IS NOT NULL,
        'pixel_id_present', NULLIF(BTRIM(cpc.pixel_id), '') IS NOT NULL,
        'dataset_id_present', NULLIF(BTRIM(cpc.dataset_id), '') IS NOT NULL,
        'conversion_id_present', NULLIF(BTRIM(cpc.conversion_id), '') IS NOT NULL,
        'conversion_label_present', NULLIF(BTRIM(cpc.conversion_label), '') IS NOT NULL,
        'endpoint_url_present', NULLIF(BTRIM(cpc.endpoint_url), '') IS NOT NULL,
        'readiness', jsonb_build_object(
          'matrix_version', 'phase-3h-platform-readiness-v1',
          'exact_platform_match', cpc.platform_name::text IN ('meta','tiktok','google_ads','ga4','gtm_server','crm_webhook','internal','other')
        )
      ) ORDER BY cpc.platform_name::text) FILTER (WHERE cpc.id IS NOT NULL), '[]'::jsonb) AS platform_configs
    FROM public.clients c
    LEFT JOIN public.client_platform_configs cpc ON cpc.client_id = c.id AND cpc.is_active = true
    WHERE c.is_active = true
    GROUP BY c.slug, c.id
  ),
  config_stats AS (
    SELECT COUNT(*)::integer AS active_destination_configs_total FROM public.client_platform_configs WHERE is_active = true
  )
  SELECT
    e.event_row_id, e.event_id, e.revenue_signal_key, e.event_name, e.event_timestamp, e.created_at, e.lead_id, e.scan_session_id, e.analysis_id, e.client_slug,
    e.payload_is_object, e.payload_metadata, e.raw_payload_metadata, e.optimization_value_usd, e.final_value_cents, e.final_value_usd,
    e.disposition_state, e.revenue_truth_source, e.revenue_rollup_target, e.source_system, e.optimization_value_basis, e.true_margin_available,
    e.margin_model_version, e.contractor_outcome_id, e.opportunity_id, e.contractor_id, e.has_fbclid, e.has_fbc, e.has_fbp, e.has_gclid,
    e.has_wbraid, e.has_gbraid, e.has_ttclid, e.has_ttp, e.has_msclkid, e.has_utm_source, e.has_utm_campaign,
    (c.client_id IS NOT NULL) AS tenant_resolved,
    COALESCE(c.active_platform_config_count, 0)::integer AS active_platform_config_count,
    s.active_destination_configs_total,
    COALESCE(c.platform_configs, '[]'::jsonb) AS platform_configs
  FROM event_rows e
  CROSS JOIN config_stats s
  LEFT JOIN config_by_slug c ON c.client_slug = e.client_slug
  ORDER BY e.event_timestamp DESC NULLS LAST, e.created_at DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.revenue_signal_key(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revenue_signal_key_from_metadata(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revenue_signal_eligibility() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_sync_revenue_signals(integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revenue_dispatch_readiness() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revenue_signal_key(text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revenue_signal_key_from_metadata(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_revenue_signal_eligibility() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_sync_revenue_signals(integer, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_revenue_dispatch_readiness() TO authenticated, service_role;