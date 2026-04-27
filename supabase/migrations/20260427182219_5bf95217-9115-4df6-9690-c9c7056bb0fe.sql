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
    SELECT
      co.id AS outcome_id,
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
        AS eligible_for_revenue_signal,
      ev.id AS existing_signal_id,
      ev.id IS NOT NULL AS duplicate_protected
    FROM public.contractor_outcomes co
    LEFT JOIN public.contractor_opportunities opp ON opp.id = co.opportunity_id
    LEFT JOIN public.lead_assignments la ON la.id = co.lead_assignment_id
    LEFT JOIN public.event_logs ev
      ON ev.event_name = 'sold'
     AND ev.metadata->>'revenue_truth_source' = 'contractor_outcomes'
     AND ev.metadata->>'contractor_outcome_id' = co.id::text
    WHERE co.disposition_state = 'sold_closed'
    ORDER BY co.last_partner_action_at DESC NULLS LAST, co.updated_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
  LOOP
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

    v_event_id := 'wmc_sold_outcome_' || v_candidate.outcome_id::text;

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
        'event_timestamp', now(),
        'schema_version', 'phase-3f-revenue-signal-v1',
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

REVOKE ALL ON FUNCTION public.admin_sync_revenue_signals(integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_sync_revenue_signals(integer, boolean) TO authenticated, service_role;