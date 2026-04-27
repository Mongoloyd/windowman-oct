-- Phase 3I-A — Revenue signal dry-run audit contract
-- Dry-run only observability. No external dispatch. No provider calls. No outbox mutation.

CREATE TABLE IF NOT EXISTS public.revenue_signal_dry_run_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  operator_id uuid NULL,
  run_id text NOT NULL UNIQUE,
  dry_run boolean NOT NULL DEFAULT true,
  candidate_count integer NOT NULL DEFAULT 0,
  would_insert integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  blocked integer NOT NULL DEFAULT 0,
  duplicate_protected integer NOT NULL DEFAULT 0,
  weak_lifecycle_key integer NOT NULL DEFAULT 0,
  lifecycle_duplicate_claim integer NOT NULL DEFAULT 0,
  duplicate_revenue_signal_key integer NOT NULL DEFAULT 0,
  by_client_slug jsonb NOT NULL DEFAULT '{}'::jsonb,
  by_reason_code jsonb NOT NULL DEFAULT '{}'::jsonb,
  by_key_basis jsonb NOT NULL DEFAULT '{}'::jsonb,
  sample_candidate_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_dispatch boolean NOT NULL DEFAULT false,
  dispatch_created boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.revenue_signal_dry_run_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS revenue_signal_dry_run_audits_select_internal ON public.revenue_signal_dry_run_audits;
CREATE POLICY revenue_signal_dry_run_audits_select_internal
ON public.revenue_signal_dry_run_audits
FOR SELECT
TO authenticated
USING (public.is_internal_operator());

DROP POLICY IF EXISTS revenue_signal_dry_run_audits_service_role_all ON public.revenue_signal_dry_run_audits;
CREATE POLICY revenue_signal_dry_run_audits_service_role_all
ON public.revenue_signal_dry_run_audits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.admin_sync_revenue_signals(p_limit integer DEFAULT 100, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_run_id text := gen_random_uuid()::text;
  v_started_at timestamptz := now();
  v_operator_id uuid := auth.uid();
  v_inserted integer := 0;
  v_duplicate integer := 0;
  v_candidate_count integer := 0;
  v_would_insert integer := 0;
  v_blocked integer := 0;
  v_duplicate_preflight integer := 0;
  v_weak_lifecycle_key integer := 0;
  v_lifecycle_duplicate_claim integer := 0;
  v_duplicate_revenue_signal_key integer := 0;
  v_by_client_slug jsonb := '{}'::jsonb;
  v_by_reason_code jsonb := '{}'::jsonb;
  v_by_key_basis jsonb := '{}'::jsonb;
  v_sample_candidate_ids jsonb := '[]'::jsonb;
  v_candidate record;
  v_event_id text;
  v_result jsonb;
BEGIN
  IF NOT public.is_internal_operator() AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'external_dispatch', false, 'dispatch_created', false);
  END IF;

  CREATE TEMP TABLE revenue_signal_sync_candidates ON COMMIT DROP AS
  SELECT
    e.*,
    (
      e.eligible_for_revenue_signal = true
      AND e.duplicate_protected = false
      AND e.duplicate_revenue_signal_key = false
      AND e.lifecycle_duplicate_detected = false
      AND e.weak_lifecycle_key = false
      AND e.revenue_signal_key IS NOT NULL
    ) AS would_insert,
    (
      e.duplicate_protected = true
      OR e.duplicate_revenue_signal_key = true
    ) AS duplicate_protected_classified,
    (
      e.eligible_for_revenue_signal = false
      OR e.weak_lifecycle_key = true
      OR e.lifecycle_duplicate_detected = true
      OR e.revenue_signal_key IS NULL
    ) AS blocked_classified,
    CASE
      WHEN e.client_slug IS NULL OR BTRIM(e.client_slug) = '' THEN 'missing_client_slug'
      ELSE lower(BTRIM(e.client_slug))
    END AS client_slug_rollup,
    COALESCE(NULLIF(BTRIM(e.revenue_signal_key_basis), ''), 'missing_key_basis') AS key_basis_rollup,
    CASE
      WHEN (
        e.eligible_for_revenue_signal = false
        OR e.weak_lifecycle_key = true
        OR e.lifecycle_duplicate_detected = true
        OR e.revenue_signal_key IS NULL
      ) AND COALESCE(array_length(e.revenue_signal_key_reasons, 1), 0) = 0
      THEN ARRAY['blocked_unknown_reason']::text[]
      ELSE COALESCE(e.revenue_signal_key_reasons, ARRAY[]::text[])
    END AS reason_rollup
  FROM public.admin_revenue_signal_eligibility() e
  LIMIT v_limit;

  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE would_insert)::integer,
    COUNT(*) FILTER (WHERE blocked_classified)::integer,
    COUNT(*) FILTER (WHERE duplicate_protected_classified)::integer,
    COUNT(*) FILTER (WHERE weak_lifecycle_key)::integer,
    COUNT(*) FILTER (WHERE lifecycle_duplicate_detected)::integer,
    COUNT(*) FILTER (WHERE duplicate_revenue_signal_key)::integer
  INTO
    v_candidate_count,
    v_would_insert,
    v_blocked,
    v_duplicate_preflight,
    v_weak_lifecycle_key,
    v_lifecycle_duplicate_claim,
    v_duplicate_revenue_signal_key
  FROM revenue_signal_sync_candidates;

  SELECT COALESCE(jsonb_object_agg(client_slug_rollup, client_summary ORDER BY client_slug_rollup), '{}'::jsonb)
  INTO v_by_client_slug
  FROM (
    SELECT
      client_slug_rollup,
      jsonb_build_object(
        'candidate_count', COUNT(*),
        'would_insert', COUNT(*) FILTER (WHERE would_insert),
        'blocked', COUNT(*) FILTER (WHERE blocked_classified),
        'duplicate_protected', COUNT(*) FILTER (WHERE duplicate_protected_classified),
        'weak_lifecycle_key', COUNT(*) FILTER (WHERE weak_lifecycle_key),
        'lifecycle_duplicate_claim', COUNT(*) FILTER (WHERE lifecycle_duplicate_detected),
        'duplicate_revenue_signal_key', COUNT(*) FILTER (WHERE duplicate_revenue_signal_key)
      ) AS client_summary
    FROM revenue_signal_sync_candidates
    GROUP BY client_slug_rollup
  ) grouped_clients;

  SELECT COALESCE(jsonb_object_agg(reason_code, reason_count ORDER BY reason_code), '{}'::jsonb)
  INTO v_by_reason_code
  FROM (
    SELECT reason_code, COUNT(*) AS reason_count
    FROM revenue_signal_sync_candidates c
    CROSS JOIN LATERAL unnest(c.reason_rollup) AS reason_code
    WHERE c.blocked_classified
    GROUP BY reason_code
  ) grouped_reasons;

  SELECT COALESCE(jsonb_object_agg(key_basis_rollup, basis_summary ORDER BY key_basis_rollup), '{}'::jsonb)
  INTO v_by_key_basis
  FROM (
    SELECT
      key_basis_rollup,
      jsonb_build_object(
        'candidate_count', COUNT(*),
        'would_insert', COUNT(*) FILTER (WHERE would_insert),
        'blocked', COUNT(*) FILTER (WHERE blocked_classified),
        'duplicate_protected', COUNT(*) FILTER (WHERE duplicate_protected_classified),
        'weak_lifecycle_key', COUNT(*) FILTER (WHERE weak_lifecycle_key),
        'lifecycle_duplicate_claim', COUNT(*) FILTER (WHERE lifecycle_duplicate_detected),
        'duplicate_revenue_signal_key', COUNT(*) FILTER (WHERE duplicate_revenue_signal_key)
      ) AS basis_summary
    FROM revenue_signal_sync_candidates
    GROUP BY key_basis_rollup
  ) grouped_basis;

  SELECT COALESCE(jsonb_agg(outcome_id::text ORDER BY outcome_id DESC), '[]'::jsonb)
  INTO v_sample_candidate_ids
  FROM (
    SELECT outcome_id
    FROM revenue_signal_sync_candidates
    ORDER BY would_insert DESC, blocked_classified ASC, outcome_id DESC
    LIMIT 25
  ) sample_candidates;

  IF NOT p_dry_run THEN
    FOR v_candidate IN
      SELECT *
      FROM revenue_signal_sync_candidates
      WHERE would_insert
      ORDER BY outcome_id DESC
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.event_logs ev
        WHERE ev.event_name = 'sold'
          AND ev.metadata->>'revenue_truth_source' = 'contractor_outcomes'
          AND COALESCE(public.revenue_lifecycle_signal_key_from_metadata(ev.metadata), ev.metadata->>'revenue_signal_key', public.revenue_signal_key_from_metadata(ev.metadata)) = v_candidate.revenue_signal_key
      ) THEN
        v_duplicate := v_duplicate + 1;
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
          'run_id', v_run_id,
          'revenue_signal_key', v_candidate.revenue_signal_key,
          'revenue_signal_key_version', v_candidate.revenue_signal_key_version,
          'revenue_signal_key_basis', v_candidate.revenue_signal_key_basis,
          'revenue_signal_key_reasons', to_jsonb(v_candidate.revenue_signal_key_reasons),
          'lifecycle_duplicate_detected', v_candidate.lifecycle_duplicate_detected,
          'lifecycle_duplicate_count', v_candidate.lifecycle_duplicate_count,
          'weak_lifecycle_key', v_candidate.weak_lifecycle_key,
          'event_timestamp', now(),
          'schema_version', 'phase-3i-a-dry-run-audit-contract-v1',
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

      IF FOUND THEN
        v_inserted := v_inserted + 1;
      ELSE
        v_duplicate := v_duplicate + 1;
      END IF;
    END LOOP;
  END IF;

  IF p_dry_run THEN
    INSERT INTO public.revenue_signal_dry_run_audits (
      operator_id,
      run_id,
      dry_run,
      candidate_count,
      would_insert,
      inserted,
      blocked,
      duplicate_protected,
      weak_lifecycle_key,
      lifecycle_duplicate_claim,
      duplicate_revenue_signal_key,
      by_client_slug,
      by_reason_code,
      by_key_basis,
      sample_candidate_ids,
      external_dispatch,
      dispatch_created,
      metadata
    ) VALUES (
      v_operator_id,
      v_run_id,
      true,
      v_candidate_count,
      v_would_insert,
      0,
      v_blocked,
      v_duplicate_preflight,
      v_weak_lifecycle_key,
      v_lifecycle_duplicate_claim,
      v_duplicate_revenue_signal_key,
      v_by_client_slug,
      v_by_reason_code,
      v_by_key_basis,
      v_sample_candidate_ids,
      false,
      false,
      jsonb_build_object(
        'phase', '3I-A',
        'limit', v_limit,
        'dry_run_only', true,
        'external_dispatch', false,
        'dispatch_created', false
      )
    );
  END IF;

  v_result := jsonb_build_object(
    'ok', true,
    'dry_run', p_dry_run,
    'run_id', v_run_id,
    'operator_id', v_operator_id,
    'started_at', v_started_at,
    'candidate_count', v_candidate_count,
    'would_insert', v_would_insert,
    'inserted', v_inserted,
    'blocked', v_blocked,
    'duplicate_protected', v_duplicate_preflight + v_duplicate,
    'weak_lifecycle_key', v_weak_lifecycle_key,
    'lifecycle_duplicate_claim', v_lifecycle_duplicate_claim,
    'duplicate_revenue_signal_key', v_duplicate_revenue_signal_key,
    'by_client_slug', v_by_client_slug,
    'by_reason_code', v_by_reason_code,
    'by_key_basis', v_by_key_basis,
    'sample_candidate_ids', v_sample_candidate_ids,
    'external_dispatch', false,
    'dispatch_created', false
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON TABLE public.revenue_signal_dry_run_audits FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_sync_revenue_signals(integer, boolean) FROM PUBLIC;

GRANT SELECT ON TABLE public.revenue_signal_dry_run_audits TO authenticated;
GRANT ALL ON TABLE public.revenue_signal_dry_run_audits TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_sync_revenue_signals(integer, boolean) TO authenticated, service_role;