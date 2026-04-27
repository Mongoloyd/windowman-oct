-- ============================================================================
-- Sprint 1G — Revenue Dispatch Readiness Matrix
-- ----------------------------------------------------------------------------
-- Read-only internal-operator RPC for auditing canonical sold/revenue events
-- before any future external platform dispatch. This function does not mutate
-- data, enqueue dispatch, call external APIs, or expose Vault secret values.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_revenue_dispatch_readiness()
RETURNS TABLE (
  event_row_id uuid,
  event_id text,
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
      w.id AS event_row_id,
      w.event_id,
      w.event_name::text AS event_name,
      w.event_timestamp,
      w.created_at,
      w.lead_id,
      w.scan_session_id,
      w.analysis_id,
      NULLIF(BTRIM(COALESCE(w.client_slug, l.client_slug, ss.client_slug, w.payload #>> '{metadata,client_slug}')), '') AS client_slug,
      (jsonb_typeof(w.payload) = 'object') AS payload_is_object,
      CASE WHEN jsonb_typeof(w.payload #> '{metadata}') = 'object' THEN w.payload #> '{metadata}' ELSE '{}'::jsonb END AS payload_metadata,
      CASE WHEN jsonb_typeof(w.raw_payload #> '{metadata}') = 'object' THEN w.raw_payload #> '{metadata}' ELSE '{}'::jsonb END AS raw_payload_metadata,
      w.optimization_value_usd,
      CASE
        WHEN (w.payload #>> '{metadata,final_value_cents}') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN (w.payload #>> '{metadata,final_value_cents}')::numeric
        WHEN (w.raw_payload #>> '{metadata,final_value_cents}') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN (w.raw_payload #>> '{metadata,final_value_cents}')::numeric
        ELSE NULL
      END AS final_value_cents,
      CASE
        WHEN (w.payload #>> '{metadata,final_value_usd}') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN (w.payload #>> '{metadata,final_value_usd}')::numeric
        WHEN (w.raw_payload #>> '{metadata,final_value_usd}') ~ '^[0-9]+(\.[0-9]+)?$'
          THEN (w.raw_payload #>> '{metadata,final_value_usd}')::numeric
        ELSE NULL
      END AS final_value_usd,
      COALESCE(w.payload #>> '{metadata,disposition_state}', w.raw_payload #>> '{metadata,disposition_state}') AS disposition_state,
      COALESCE(w.payload #>> '{metadata,revenue_truth_source}', w.raw_payload #>> '{metadata,revenue_truth_source}') AS revenue_truth_source,
      COALESCE(w.payload #>> '{metadata,revenue_rollup_target}', w.raw_payload #>> '{metadata,revenue_rollup_target}') AS revenue_rollup_target,
      COALESCE(w.payload #>> '{metadata,source_system}', w.raw_payload #>> '{metadata,source_system}') AS source_system,
      COALESCE(w.payload #>> '{metadata,optimization_value_basis}', w.raw_payload #>> '{metadata,optimization_value_basis}') AS optimization_value_basis,
      CASE
        WHEN COALESCE(w.payload #>> '{metadata,true_margin_available}', w.raw_payload #>> '{metadata,true_margin_available}') IN ('true', 'false')
          THEN COALESCE(w.payload #>> '{metadata,true_margin_available}', w.raw_payload #>> '{metadata,true_margin_available}')::boolean
        ELSE NULL
      END AS true_margin_available,
      COALESCE(w.payload #>> '{metadata,margin_model_version}', w.raw_payload #>> '{metadata,margin_model_version}') AS margin_model_version,
      CASE WHEN COALESCE(w.payload #>> '{metadata,contractor_outcome_id}', w.raw_payload #>> '{metadata,contractor_outcome_id}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN COALESCE(w.payload #>> '{metadata,contractor_outcome_id}', w.raw_payload #>> '{metadata,contractor_outcome_id}')::uuid ELSE NULL END AS contractor_outcome_id,
      CASE WHEN COALESCE(w.payload #>> '{metadata,opportunity_id}', w.raw_payload #>> '{opportunity_id}', w.raw_payload #>> '{metadata,opportunity_id}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN COALESCE(w.payload #>> '{metadata,opportunity_id}', w.raw_payload #>> '{opportunity_id}', w.raw_payload #>> '{metadata,opportunity_id}')::uuid ELSE NULL END AS opportunity_id,
      CASE WHEN COALESCE(w.payload #>> '{metadata,contractor_id}', w.raw_payload #>> '{contractor_id}', w.raw_payload #>> '{metadata,contractor_id}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN COALESCE(w.payload #>> '{metadata,contractor_id}', w.raw_payload #>> '{contractor_id}', w.raw_payload #>> '{metadata,contractor_id}')::uuid ELSE NULL END AS contractor_id,
      COALESCE(w.attribution ? 'fbclid', w.query_params ? 'fbclid', w.payload ? 'fbclid') AS has_fbclid,
      COALESCE(w.attribution ? 'fbc', w.query_params ? 'fbc', w.payload ? 'fbc') AS has_fbc,
      COALESCE(w.attribution ? 'fbp', w.query_params ? 'fbp', w.payload ? 'fbp') AS has_fbp,
      COALESCE(w.attribution ? 'gclid', w.query_params ? 'gclid', w.payload ? 'gclid') AS has_gclid,
      COALESCE(w.attribution ? 'wbraid', w.query_params ? 'wbraid', w.payload ? 'wbraid') AS has_wbraid,
      COALESCE(w.attribution ? 'gbraid', w.query_params ? 'gbraid', w.payload ? 'gbraid') AS has_gbraid,
      COALESCE(w.attribution ? 'ttclid', w.query_params ? 'ttclid', w.payload ? 'ttclid') AS has_ttclid,
      COALESCE(w.attribution ? 'ttp', w.query_params ? 'ttp', w.payload ? 'ttp') AS has_ttp,
      COALESCE(w.attribution ? 'msclkid', w.query_params ? 'msclkid', w.payload ? 'msclkid') AS has_msclkid,
      COALESCE(w.attribution ? 'utm_source', w.query_params ? 'utm_source', (w.attribution #> '{utm}') ? 'source') AS has_utm_source,
      COALESCE(w.attribution ? 'utm_campaign', w.query_params ? 'utm_campaign', (w.attribution #> '{utm}') ? 'campaign') AS has_utm_campaign
    FROM public.wm_event_log w
    LEFT JOIN public.leads l ON l.id = w.lead_id
    LEFT JOIN public.scan_sessions ss ON ss.id = w.scan_session_id
    WHERE
      w.event_name::text ILIKE '%sold%'
      OR w.event_name::text ILIKE '%purchase%'
      OR w.payload #>> '{metadata,disposition_state}' = 'sold_closed'
      OR w.raw_payload #>> '{metadata,disposition_state}' = 'sold_closed'
  ),
  config_by_slug AS (
    SELECT
      c.slug AS client_slug,
      c.id AS client_id,
      COUNT(cpc.id)::integer AS active_platform_config_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'platform_name', cpc.platform_name::text,
            'is_active', cpc.is_active,
            'token_present', cpc.token_secret_id IS NOT NULL,
            'pixel_id_present', NULLIF(BTRIM(cpc.pixel_id), '') IS NOT NULL,
            'dataset_id_present', NULLIF(BTRIM(cpc.dataset_id), '') IS NOT NULL,
            'conversion_id_present', NULLIF(BTRIM(cpc.conversion_id), '') IS NOT NULL,
            'conversion_label_present', NULLIF(BTRIM(cpc.conversion_label), '') IS NOT NULL,
            'endpoint_url_present', NULLIF(BTRIM(cpc.endpoint_url), '') IS NOT NULL
          ) ORDER BY cpc.platform_name::text
        ) FILTER (WHERE cpc.id IS NOT NULL),
        '[]'::jsonb
      ) AS platform_configs
    FROM public.clients c
    LEFT JOIN public.client_platform_configs cpc
      ON cpc.client_id = c.id
     AND cpc.is_active = true
    WHERE c.is_active = true
    GROUP BY c.slug, c.id
  ),
  config_stats AS (
    SELECT COUNT(*)::integer AS active_destination_configs_total
    FROM public.client_platform_configs
    WHERE is_active = true
  )
  SELECT
    e.event_row_id,
    e.event_id,
    e.event_name,
    e.event_timestamp,
    e.created_at,
    e.lead_id,
    e.scan_session_id,
    e.analysis_id,
    e.client_slug,
    e.payload_is_object,
    e.payload_metadata,
    e.raw_payload_metadata,
    e.optimization_value_usd,
    e.final_value_cents,
    e.final_value_usd,
    e.disposition_state,
    e.revenue_truth_source,
    e.revenue_rollup_target,
    e.source_system,
    e.optimization_value_basis,
    e.true_margin_available,
    e.margin_model_version,
    e.contractor_outcome_id,
    e.opportunity_id,
    e.contractor_id,
    e.has_fbclid,
    e.has_fbc,
    e.has_fbp,
    e.has_gclid,
    e.has_wbraid,
    e.has_gbraid,
    e.has_ttclid,
    e.has_ttp,
    e.has_msclkid,
    e.has_utm_source,
    e.has_utm_campaign,
    (c.client_id IS NOT NULL) AS tenant_resolved,
    COALESCE(c.active_platform_config_count, 0)::integer AS active_platform_config_count,
    s.active_destination_configs_total,
    COALESCE(c.platform_configs, '[]'::jsonb) AS platform_configs
  FROM event_rows e
  CROSS JOIN config_stats s
  LEFT JOIN config_by_slug c ON c.client_slug = e.client_slug
  ORDER BY e.event_timestamp DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revenue_dispatch_readiness() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revenue_dispatch_readiness() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_revenue_dispatch_readiness() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revenue_dispatch_readiness() TO service_role;
