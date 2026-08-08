-- PR173 Sprint 5 — Contractor Outcome Canonical Scan Context
--
-- Repairs the final known stale database reference: the Phase 3E read model
-- public.admin_contractor_outcome_integrity() selected
-- l.latest_scan_session_id AS scan_session_id, but public.leads has never
-- defined a latest_scan_session_id column in this repository schema.
--
-- The canonical scan-session context for a contractor outcome is the
-- contractor opportunity that owns it:
--   contractor_outcomes.opportunity_id
--     -> contractor_opportunities.id
--     -> contractor_opportunities.scan_session_id
--       (uuid NOT NULL REFERENCES public.scan_sessions(id), UNIQUE)
--
-- This migration recreates the function with that single functional change.
-- Signature, return columns and order, the internal-operator authorization
-- gate, integrity calculations, tenant/client resolution, revenue semantics,
-- safe metadata, ordering, grants, and comments are all preserved verbatim
-- from 20260427170000_contractor_outcome_integrity.sql.
-- The leads join is retained because resolved_client_slug still falls back to
-- l.client_slug.

CREATE OR REPLACE FUNCTION public.admin_contractor_outcome_integrity()
RETURNS TABLE (
  outcome_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  outcome_timestamp timestamptz,
  opportunity_id uuid,
  lead_id uuid,
  scan_session_id uuid,
  analysis_id uuid,
  lead_assignment_id uuid,
  assignment_client_slug text,
  contractor_id uuid,
  contractor_account_id uuid,
  contractor_account_name text,
  contractor_account_client_slug text,
  contractor_company_name text,
  client_slug text,
  outcome_status text,
  sold_amount_cents integer,
  sold_amount numeric,
  sold_currency text,
  value_basis text,
  lost_reason text,
  lost_reason_code text,
  outcome_source text,
  outcome_verified boolean,
  outcome_verified_at timestamptz,
  outcome_integrity_status text,
  outcome_integrity_reasons text[],
  eligible_for_future_signal boolean,
  safe_metadata jsonb
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
  WITH base AS (
    SELECT
      co.id AS outcome_id,
      co.created_at,
      co.updated_at,
      COALESCE(co.last_partner_action_at, co.updated_at, co.created_at) AS outcome_timestamp,
      co.opportunity_id,
      opp.lead_id,
      opp.scan_session_id AS scan_session_id,
      opp.analysis_id,
      co.lead_assignment_id,
      la.client_slug AS assignment_client_slug,
      co.contractor_id,
      co.contractor_account_id,
      ca.display_name AS contractor_account_name,
      ca.client_slug AS contractor_account_client_slug,
      c.company_name AS contractor_company_name,
      COALESCE(co.client_slug, la.client_slug, l.client_slug) AS resolved_client_slug,
      co.disposition_state AS outcome_status,
      co.final_value_cents AS sold_amount_cents,
      CASE WHEN co.final_value_cents IS NULL THEN NULL ELSE (co.final_value_cents::numeric / 100) END AS sold_amount,
      co.sold_currency,
      co.value_basis,
      co.outcome_notes AS lost_reason,
      co.disposition_reason_code AS lost_reason_code,
      co.outcome_source,
      co.outcome_verified,
      co.outcome_verified_at,
      co.signed_contract_url,
      co.projected_value_cents,
      co.outcome_metadata,
      public.contractor_outcome_integrity_reasons(
        co.disposition_state,
        co.final_value_cents,
        co.value_basis,
        co.disposition_reason_code,
        co.outcome_notes,
        COALESCE(co.client_slug, la.client_slug, l.client_slug),
        co.lead_assignment_id,
        co.contractor_account_id,
        la.client_slug,
        ca.client_slug
      ) AS reasons
    FROM public.contractor_outcomes co
    JOIN public.contractor_opportunities opp ON opp.id = co.opportunity_id
    LEFT JOIN public.leads l ON l.id = opp.lead_id
    LEFT JOIN public.lead_assignments la ON la.id = co.lead_assignment_id
    LEFT JOIN public.contractor_accounts ca ON ca.id = co.contractor_account_id
    LEFT JOIN public.contractors c ON c.id = co.contractor_id
  )
  SELECT
    base.outcome_id,
    base.created_at,
    base.updated_at,
    base.outcome_timestamp,
    base.opportunity_id,
    base.lead_id,
    base.scan_session_id,
    base.analysis_id,
    base.lead_assignment_id,
    base.assignment_client_slug,
    base.contractor_id,
    base.contractor_account_id,
    base.contractor_account_name,
    base.contractor_account_client_slug,
    base.contractor_company_name,
    base.resolved_client_slug AS client_slug,
    base.outcome_status,
    base.sold_amount_cents,
    base.sold_amount,
    base.sold_currency,
    base.value_basis,
    CASE WHEN base.outcome_status = 'lost_dead' THEN base.lost_reason ELSE NULL END AS lost_reason,
    base.lost_reason_code,
    base.outcome_source,
    base.outcome_verified,
    base.outcome_verified_at,
    public.contractor_outcome_integrity_status(base.reasons) AS outcome_integrity_status,
    base.reasons AS outcome_integrity_reasons,
    'eligible_for_future_signal' = ANY(base.reasons) AS eligible_for_future_signal,
    jsonb_build_object(
      'revenue_truth_source', 'contractor_outcomes',
      'lead_rollup_only', true,
      'assignment_operational_only', true,
      'external_dispatch', false,
      'dispatch_created', false,
      'metadata_keys', COALESCE((SELECT jsonb_agg(key ORDER BY key) FROM jsonb_object_keys(base.outcome_metadata) AS key), '[]'::jsonb),
      'notes_present', base.lost_reason IS NOT NULL AND BTRIM(base.lost_reason) <> '',
      'signed_contract_attached', base.signed_contract_url IS NOT NULL,
      'projected_value_present', base.projected_value_cents IS NOT NULL
    ) AS safe_metadata
  FROM base
  ORDER BY base.outcome_timestamp DESC NULLS LAST, base.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_contractor_outcome_integrity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_contractor_outcome_integrity() TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_contractor_outcome_integrity() IS
  'Phase 3E internal operator read surface for contractor outcome integrity. Redacts raw PII and proves no external dispatch occurs.';
