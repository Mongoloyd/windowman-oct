-- Phase 3H-B — Lifecycle revenue signal key repair + duplicate sold outcome guard
-- No data deletion. No external dispatch. No RLS weakening.

CREATE OR REPLACE FUNCTION public.revenue_lifecycle_signal_key_basis(
  p_lead_assignment_id uuid,
  p_opportunity_id uuid,
  p_lead_id uuid,
  p_scan_session_id uuid,
  p_analysis_id uuid,
  p_contractor_outcome_id uuid
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_lead_assignment_id IS NOT NULL THEN 'lead_assignment_id'
    WHEN p_opportunity_id IS NOT NULL THEN 'opportunity_id'
    WHEN p_lead_id IS NOT NULL THEN 'lead_id'
    WHEN p_scan_session_id IS NOT NULL THEN 'scan_session_id'
    WHEN p_analysis_id IS NOT NULL THEN 'analysis_id'
    WHEN p_contractor_outcome_id IS NOT NULL THEN 'contractor_outcome_id'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.revenue_lifecycle_signal_key(
  p_client_slug text,
  p_lead_assignment_id uuid,
  p_opportunity_id uuid,
  p_lead_id uuid,
  p_scan_session_id uuid,
  p_analysis_id uuid,
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
      OR NULLIF(BTRIM(COALESCE(p_disposition_state, '')), '') IS NULL
      OR public.revenue_lifecycle_signal_key_basis(p_lead_assignment_id, p_opportunity_id, p_lead_id, p_scan_session_id, p_analysis_id, p_contractor_outcome_id) IS NULL
    THEN NULL
    ELSE concat_ws(
      ':',
      'revenue-signal-key-v2',
      lower(BTRIM(p_client_slug)),
      public.revenue_lifecycle_signal_key_basis(p_lead_assignment_id, p_opportunity_id, p_lead_id, p_scan_session_id, p_analysis_id, p_contractor_outcome_id),
      COALESCE(p_lead_assignment_id::text, p_opportunity_id::text, p_lead_id::text, p_scan_session_id::text, p_analysis_id::text, p_contractor_outcome_id::text),
      lower(BTRIM(p_disposition_state))
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.revenue_lifecycle_signal_key_from_metadata(p_metadata jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_metadata IS NULL THEN NULL
    WHEN NULLIF(BTRIM(COALESCE(p_metadata->>'revenue_signal_key', '')), '') IS NOT NULL
      AND COALESCE(p_metadata->>'revenue_signal_key_version', '') = 'v2_lifecycle'
    THEN p_metadata->>'revenue_signal_key'
    ELSE public.revenue_lifecycle_signal_key(
      p_metadata->>'client_slug',
      CASE WHEN COALESCE(p_metadata->>'lead_assignment_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (p_metadata->>'lead_assignment_id')::uuid ELSE NULL END,
      CASE WHEN COALESCE(p_metadata->>'opportunity_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (p_metadata->>'opportunity_id')::uuid ELSE NULL END,
      CASE WHEN COALESCE(p_metadata->>'lead_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (p_metadata->>'lead_id')::uuid ELSE NULL END,
      CASE WHEN COALESCE(p_metadata->>'scan_session_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (p_metadata->>'scan_session_id')::uuid ELSE NULL END,
      CASE WHEN COALESCE(p_metadata->>'analysis_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (p_metadata->>'analysis_id')::uuid ELSE NULL END,
      CASE WHEN COALESCE(p_metadata->>'contractor_outcome_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (p_metadata->>'contractor_outcome_id')::uuid ELSE NULL END,
      p_metadata->>'disposition_state'
    )
  END;
$$;

DROP FUNCTION IF EXISTS public.admin_revenue_signal_eligibility();
CREATE OR REPLACE FUNCTION public.admin_revenue_signal_eligibility()
RETURNS TABLE (
  outcome_id uuid,
  revenue_signal_key text,
  revenue_signal_key_version text,
  revenue_signal_key_basis text,
  revenue_signal_key_reasons text[],
  lifecycle_duplicate_detected boolean,
  lifecycle_duplicate_count integer,
  weak_lifecycle_key boolean,
  duplicate_revenue_signal_key boolean,
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
      public.revenue_lifecycle_signal_key(COALESCE(co.client_slug, la.client_slug, opp.client_slug), co.lead_assignment_id, co.opportunity_id, opp.lead_id, opp.scan_session_id, opp.analysis_id, co.id, co.disposition_state) AS lifecycle_revenue_signal_key,
      public.revenue_lifecycle_signal_key_basis(co.lead_assignment_id, co.opportunity_id, opp.lead_id, opp.scan_session_id, opp.analysis_id, co.id) AS lifecycle_key_basis,
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
      co.outcome_integrity_reasons
    FROM public.contractor_outcomes co
    LEFT JOIN public.contractor_opportunities opp ON opp.id = co.opportunity_id
    LEFT JOIN public.lead_assignments la ON la.id = co.lead_assignment_id
    WHERE co.disposition_state = 'sold_closed'
  ),
  duplicate_lifecycle AS (
    SELECT lifecycle_revenue_signal_key, COUNT(*)::integer AS duplicate_count
    FROM candidates
    WHERE lifecycle_revenue_signal_key IS NOT NULL
      AND lifecycle_key_basis <> 'contractor_outcome_id'
    GROUP BY lifecycle_revenue_signal_key
    HAVING COUNT(*) > 1
  ),
  enriched AS (
    SELECT
      c.*,
      COALESCE(dl.duplicate_count, 1)::integer AS lifecycle_duplicate_count,
      COALESCE(dl.duplicate_count, 1) > 1 AS lifecycle_duplicate_detected,
      c.lifecycle_key_basis = 'contractor_outcome_id' AS weak_lifecycle_key,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN c.lifecycle_revenue_signal_key IS NULL THEN 'missing_lifecycle_key' END,
        CASE WHEN c.client_slug IS NULL OR BTRIM(c.client_slug) = '' THEN 'missing_client_slug' END,
        CASE WHEN c.lifecycle_key_basis = 'contractor_outcome_id' THEN 'weak_lifecycle_key' END,
        CASE WHEN COALESCE(dl.duplicate_count, 1) > 1 THEN 'duplicate_sold_lifecycle_claim' END,
        CASE WHEN c.final_value_cents IS NULL OR c.final_value_cents <= 0 THEN 'sold_missing_or_invalid_value' END,
        CASE WHEN c.value_basis IS NULL OR c.value_basis = 'unknown' THEN 'sold_missing_value_basis' END,
        CASE WHEN c.outcome_integrity_status IN ('blocked','invalid','manual_review','needs_review') THEN 'outcome_integrity_not_valid' END,
        CASE WHEN c.outcome_integrity_reasons && ARRAY['sold_missing_value','sold_invalid_value','sold_missing_value_basis','value_basis_unknown','missing_client_slug','assignment_client_mismatch','contractor_client_mismatch','outcome_disputed','manual_review_required']::text[] THEN 'outcome_integrity_blocked' END
      ]::text[], NULL) AS lifecycle_reason_codes
    FROM candidates c
    LEFT JOIN duplicate_lifecycle dl ON dl.lifecycle_revenue_signal_key = c.lifecycle_revenue_signal_key
  )
  SELECT
    e.outcome_id,
    e.lifecycle_revenue_signal_key AS revenue_signal_key,
    'v2_lifecycle'::text AS revenue_signal_key_version,
    e.lifecycle_key_basis AS revenue_signal_key_basis,
    CASE WHEN ev.id IS NOT NULL THEN ARRAY_APPEND(e.lifecycle_reason_codes, 'duplicate_active_sold_signal') ELSE e.lifecycle_reason_codes END AS revenue_signal_key_reasons,
    e.lifecycle_duplicate_detected,
    e.lifecycle_duplicate_count,
    e.weak_lifecycle_key,
    ev.id IS NOT NULL AS duplicate_revenue_signal_key,
    e.lead_id,
    e.scan_session_id,
    e.analysis_id,
    e.lead_assignment_id,
    e.client_slug,
    e.contractor_account_id,
    e.contractor_id,
    e.opportunity_id,
    e.disposition_state,
    e.final_value_cents,
    e.final_value_usd,
    e.sold_currency,
    e.value_basis,
    e.outcome_integrity_status,
    e.outcome_integrity_reasons,
    e.lifecycle_revenue_signal_key IS NOT NULL
      AND NOT e.lifecycle_duplicate_detected
      AND NOT e.weak_lifecycle_key
      AND ev.id IS NULL
      AND e.final_value_cents IS NOT NULL
      AND e.final_value_cents > 0
      AND e.value_basis IS NOT NULL
      AND e.value_basis <> 'unknown'
      AND e.client_slug IS NOT NULL
      AND BTRIM(e.client_slug) <> ''
      AND NOT (e.outcome_integrity_status IN ('blocked','invalid','manual_review','needs_review'))
      AND NOT (e.outcome_integrity_reasons && ARRAY['sold_missing_value','sold_invalid_value','sold_missing_value_basis','value_basis_unknown','missing_client_slug','assignment_client_mismatch','contractor_client_mismatch','outcome_disputed','manual_review_required']::text[])
      AS eligible_for_revenue_signal,
    ev.id AS existing_signal_id,
    ev.metadata->>'event_id' AS existing_event_id,
    ev.id IS NOT NULL AS duplicate_protected,
    false AS external_dispatch
  FROM enriched e
  LEFT JOIN public.event_logs ev
    ON ev.event_name = 'sold'
   AND ev.metadata->>'revenue_truth_source' = 'contractor_outcomes'
   AND COALESCE(public.revenue_lifecycle_signal_key_from_metadata(ev.metadata), ev.metadata->>'revenue_signal_key', public.revenue_signal_key_from_metadata(ev.metadata)) = e.lifecycle_revenue_signal_key
  ORDER BY e.outcome_id DESC
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

  FOR v_candidate IN SELECT * FROM public.admin_revenue_signal_eligibility() LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  LOOP
    IF v_candidate.revenue_signal_key IS NULL OR v_candidate.weak_lifecycle_key OR v_candidate.lifecycle_duplicate_detected OR NOT v_candidate.eligible_for_revenue_signal THEN
      v_blocked := v_blocked + 1;
      CONTINUE;
    END IF;

    IF v_candidate.duplicate_protected OR v_candidate.duplicate_revenue_signal_key THEN
      v_duplicate := v_duplicate + 1;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.event_logs ev
      WHERE ev.event_name = 'sold'
        AND ev.metadata->>'revenue_truth_source' = 'contractor_outcomes'
        AND COALESCE(public.revenue_lifecycle_signal_key_from_metadata(ev.metadata), ev.metadata->>'revenue_signal_key', public.revenue_signal_key_from_metadata(ev.metadata)) = v_candidate.revenue_signal_key
    ) THEN
      v_duplicate := v_duplicate + 1;
      CONTINUE;
    END IF;

    IF p_dry_run THEN
      CONTINUE;
    END IF;

    v_event_id := 'wmc_sold_' || md5(v_candidate.revenue_signal_key);

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
        'revenue_signal_key_version', v_candidate.revenue_signal_key_version,
        'revenue_signal_key_basis', v_candidate.revenue_signal_key_basis,
        'revenue_signal_key_reasons', to_jsonb(v_candidate.revenue_signal_key_reasons),
        'lifecycle_duplicate_detected', v_candidate.lifecycle_duplicate_detected,
        'lifecycle_duplicate_count', v_candidate.lifecycle_duplicate_count,
        'weak_lifecycle_key', v_candidate.weak_lifecycle_key,
        'event_timestamp', now(),
        'schema_version', 'phase-3h-b-lifecycle-revenue-signal-v3',
        'revenue_truth_source', 'contractor_outcomes',
        'revenue_rollup_target', 'leads',
        'source_system', 'admin-sync-revenue-signals',
        'disposition_state', 'sold_closed',
        'contractor_outcome_id', v_candidate.outcome_id,
        'opportunity_id', v_candidate.opportunity_id,
        'contractor_id', v_candidate.contractor_id,
        'contractor_account_id', v_candidate.contractor_account_id,
        'lead_assignment_id', v_candidate.lead_assignment_id,
        'lead_id', v_candidate.lead_id,
        'scan_session_id', v_candidate.scan_session_id,
        'analysis_id', v_candidate.analysis_id,
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

    IF FOUND THEN v_inserted := v_inserted + 1; ELSE v_duplicate := v_duplicate + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'dry_run', p_dry_run, 'external_dispatch', false, 'dispatch_created', false, 'inserted', v_inserted, 'duplicate_protected', v_duplicate, 'blocked', v_blocked);
END;
$$;

DROP INDEX IF EXISTS event_logs_revenue_lifecycle_signal_key_unique;
CREATE UNIQUE INDEX event_logs_revenue_lifecycle_signal_key_unique
  ON public.event_logs ((public.revenue_lifecycle_signal_key_from_metadata(metadata)))
  WHERE event_name = 'sold'
    AND metadata->>'revenue_truth_source' = 'contractor_outcomes'
    AND COALESCE(metadata->>'external_dispatch', 'false') = 'false'
    AND COALESCE(metadata->>'dispatch_created', 'false') = 'false'
    AND COALESCE(metadata->>'revenue_signal_key_version', '') = 'v2_lifecycle'
    AND public.revenue_lifecycle_signal_key_from_metadata(metadata) IS NOT NULL
    AND COALESCE(metadata->>'signal_lifecycle_action', 'active') = 'active';

DROP INDEX IF EXISTS contractor_outcomes_active_sold_assignment_unique;
CREATE UNIQUE INDEX contractor_outcomes_active_sold_assignment_unique
  ON public.contractor_outcomes (lower(BTRIM(client_slug)), lead_assignment_id)
  WHERE disposition_state = 'sold_closed'
    AND lead_assignment_id IS NOT NULL
    AND NULLIF(BTRIM(COALESCE(client_slug, '')), '') IS NOT NULL
    AND outcome_integrity_status IN ('valid','warning')
    AND final_value_cents IS NOT NULL
    AND final_value_cents > 0;

DROP INDEX IF EXISTS contractor_outcomes_active_sold_opportunity_unique;
CREATE UNIQUE INDEX contractor_outcomes_active_sold_opportunity_unique
  ON public.contractor_outcomes (lower(BTRIM(client_slug)), opportunity_id)
  WHERE disposition_state = 'sold_closed'
    AND opportunity_id IS NOT NULL
    AND lead_assignment_id IS NULL
    AND NULLIF(BTRIM(COALESCE(client_slug, '')), '') IS NOT NULL
    AND outcome_integrity_status IN ('valid','warning')
    AND final_value_cents IS NOT NULL
    AND final_value_cents > 0;

REVOKE ALL ON FUNCTION public.revenue_lifecycle_signal_key_basis(uuid, uuid, uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revenue_lifecycle_signal_key(text, uuid, uuid, uuid, uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revenue_lifecycle_signal_key_from_metadata(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revenue_signal_eligibility() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_sync_revenue_signals(integer, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.revenue_lifecycle_signal_key_basis(uuid, uuid, uuid, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revenue_lifecycle_signal_key(text, uuid, uuid, uuid, uuid, uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revenue_lifecycle_signal_key_from_metadata(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_revenue_signal_eligibility() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_sync_revenue_signals(integer, boolean) TO authenticated, service_role;
