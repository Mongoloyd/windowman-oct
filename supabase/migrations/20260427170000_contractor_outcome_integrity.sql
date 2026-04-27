-- Phase 3E — Contractor Outcome Feedback Hardening
-- Contractor outcomes are the sold/lost revenue source of truth.

ALTER TABLE public.contractor_outcomes
  ADD COLUMN IF NOT EXISTS lead_assignment_id uuid NULL REFERENCES public.lead_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_slug text NULL,
  ADD COLUMN IF NOT EXISTS contractor_account_id uuid NULL REFERENCES public.contractor_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sold_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS value_basis text NULL,
  ADD COLUMN IF NOT EXISTS outcome_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS outcome_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS outcome_source text NOT NULL DEFAULT 'operator_or_partner',
  ADD COLUMN IF NOT EXISTS outcome_integrity_status text NOT NULL DEFAULT 'needs_review',
  ADD COLUMN IF NOT EXISTS outcome_integrity_reasons text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS outcome_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_disposition_state_check;
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_disposition_state_check
  CHECK (disposition_state IN (
    'new',
    'attempting_contact',
    'contacted',
    'meeting_scheduled',
    'scheduled',
    'quote_delivered',
    'sold_closed',
    'lost_dead',
    'disputed',
    'manual_review',
    'invalid'
  ));

ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_sold_currency_not_blank;
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_sold_currency_not_blank
  CHECK (BTRIM(sold_currency) <> '');

ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_value_basis_check;
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_value_basis_check
  CHECK (value_basis IN (
    'contract_total',
    'gross_sale_value',
    'true_margin',
    'estimated_contract_value',
    'unknown'
  ));

ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_integrity_status_check;
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_integrity_status_check
  CHECK (outcome_integrity_status IN ('valid', 'warning', 'blocked', 'needs_review'));

ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_sold_requires_positive_value;
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_sold_requires_positive_value
  CHECK (
    disposition_state <> 'sold_closed'
    OR (final_value_cents IS NOT NULL AND final_value_cents > 0)
  ) NOT VALID;

ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_sold_requires_explicit_value_basis;
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_sold_requires_explicit_value_basis
  CHECK (
    disposition_state <> 'sold_closed'
    OR (value_basis IS NOT NULL AND value_basis <> 'unknown')
  ) NOT VALID;

ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_lost_requires_typed_reason;
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_lost_requires_typed_reason
  CHECK (
    disposition_state <> 'lost_dead'
    OR (
      disposition_reason_code IS NOT NULL
      AND BTRIM(COALESCE(outcome_notes, '')) <> ''
    )
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS contractor_outcomes_client_slug_idx
  ON public.contractor_outcomes (client_slug);
CREATE INDEX IF NOT EXISTS contractor_outcomes_assignment_idx
  ON public.contractor_outcomes (lead_assignment_id);
CREATE INDEX IF NOT EXISTS contractor_outcomes_integrity_idx
  ON public.contractor_outcomes (outcome_integrity_status, disposition_state);
CREATE INDEX IF NOT EXISTS contractor_outcomes_value_basis_idx
  ON public.contractor_outcomes (value_basis);

CREATE OR REPLACE FUNCTION public.contractor_outcome_integrity_reasons(
  p_disposition_state text,
  p_final_value_cents integer,
  p_value_basis text,
  p_disposition_reason_code text,
  p_outcome_notes text,
  p_client_slug text,
  p_lead_assignment_id uuid,
  p_contractor_account_id uuid,
  p_assignment_client_slug text DEFAULT NULL,
  p_contractor_account_client_slug text DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reasons text[] := ARRAY[]::text[];
BEGIN
  IF NULLIF(BTRIM(COALESCE(p_client_slug, '')), '') IS NULL THEN
    v_reasons := array_append(v_reasons, 'missing_client_slug');
  END IF;

  IF p_lead_assignment_id IS NULL THEN
    v_reasons := array_append(v_reasons, 'missing_assignment');
  END IF;

  IF p_contractor_account_id IS NULL THEN
    v_reasons := array_append(v_reasons, 'missing_contractor_account');
  END IF;

  IF p_disposition_state = 'sold_closed' THEN
    IF p_final_value_cents IS NULL THEN
      v_reasons := array_append(v_reasons, 'sold_missing_value');
    ELSIF p_final_value_cents <= 0 THEN
      v_reasons := array_append(v_reasons, 'sold_invalid_value');
    END IF;

    IF p_value_basis IS NULL THEN
      v_reasons := array_append(v_reasons, 'sold_missing_value_basis');
    ELSIF p_value_basis = 'unknown' THEN
      v_reasons := array_append(v_reasons, 'value_basis_unknown');
    ELSIF p_value_basis = 'gross_sale_value' THEN
      v_reasons := array_append(v_reasons, 'value_basis_gross_proxy');
    END IF;
  END IF;

  IF p_disposition_state = 'lost_dead'
     AND (p_disposition_reason_code IS NULL OR BTRIM(COALESCE(p_outcome_notes, '')) = '') THEN
    v_reasons := array_append(v_reasons, 'lost_missing_reason');
  END IF;

  IF p_disposition_state = 'disputed' THEN
    v_reasons := array_append(v_reasons, 'outcome_disputed');
  END IF;

  IF p_disposition_state IN ('manual_review', 'invalid') THEN
    v_reasons := array_append(v_reasons, 'manual_review_required');
  END IF;

  IF p_disposition_state NOT IN ('sold_closed', 'lost_dead') THEN
    v_reasons := array_append(v_reasons, 'outcome_not_terminal');
  END IF;

  IF p_client_slug IS NOT NULL
     AND p_assignment_client_slug IS NOT NULL
     AND p_client_slug IS DISTINCT FROM p_assignment_client_slug THEN
    v_reasons := array_append(v_reasons, 'assignment_client_mismatch');
  END IF;

  IF p_client_slug IS NOT NULL
     AND p_contractor_account_client_slug IS NOT NULL
     AND p_client_slug IS DISTINCT FROM p_contractor_account_client_slug THEN
    v_reasons := array_append(v_reasons, 'contractor_client_mismatch');
  END IF;

  IF p_disposition_state = 'sold_closed'
     AND p_final_value_cents IS NOT NULL
     AND p_final_value_cents > 0
     AND p_value_basis IS NOT NULL
     AND p_value_basis <> 'unknown'
     AND NOT ('assignment_client_mismatch' = ANY(v_reasons))
     AND NOT ('contractor_client_mismatch' = ANY(v_reasons))
     AND NOT ('missing_client_slug' = ANY(v_reasons)) THEN
    v_reasons := array_append(v_reasons, 'eligible_for_future_signal');
  ELSE
    v_reasons := array_append(v_reasons, 'not_eligible_for_signal');
  END IF;

  RETURN v_reasons;
END;
$$;

CREATE OR REPLACE FUNCTION public.contractor_outcome_integrity_status(p_reasons text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_reasons && ARRAY[
      'sold_missing_value',
      'sold_invalid_value',
      'lost_missing_reason',
      'assignment_client_mismatch',
      'contractor_client_mismatch',
      'outcome_disputed'
    ]::text[] THEN 'blocked'
    WHEN p_reasons && ARRAY[
      'missing_client_slug',
      'missing_assignment',
      'missing_contractor_account',
      'sold_missing_value_basis',
      'value_basis_unknown',
      'manual_review_required'
    ]::text[] THEN 'needs_review'
    WHEN p_reasons && ARRAY['value_basis_gross_proxy', 'outcome_not_terminal']::text[] THEN 'warning'
    ELSE 'valid'
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_contractor_outcome_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_client_slug text;
  v_contractor_account_client_slug text;
  v_reasons text[];
BEGIN
  NEW.sold_currency := UPPER(BTRIM(COALESCE(NEW.sold_currency, 'USD')));
  NEW.value_basis := NULLIF(BTRIM(NEW.value_basis), '');
  NEW.outcome_source := COALESCE(NULLIF(BTRIM(NEW.outcome_source), ''), 'operator_or_partner');
  NEW.outcome_metadata := COALESCE(NEW.outcome_metadata, '{}'::jsonb);

  IF NEW.lead_assignment_id IS NOT NULL THEN
    SELECT la.client_slug INTO v_assignment_client_slug
    FROM public.lead_assignments la
    WHERE la.id = NEW.lead_assignment_id;
  END IF;

  IF NEW.contractor_account_id IS NOT NULL THEN
    SELECT ca.client_slug INTO v_contractor_account_client_slug
    FROM public.contractor_accounts ca
    WHERE ca.id = NEW.contractor_account_id;
  END IF;

  IF NEW.client_slug IS NULL THEN
    NEW.client_slug := v_assignment_client_slug;
  END IF;

  v_reasons := public.contractor_outcome_integrity_reasons(
    NEW.disposition_state,
    NEW.final_value_cents,
    NEW.value_basis,
    NEW.disposition_reason_code,
    NEW.outcome_notes,
    NEW.client_slug,
    NEW.lead_assignment_id,
    NEW.contractor_account_id,
    v_assignment_client_slug,
    v_contractor_account_client_slug
  );

  NEW.outcome_integrity_reasons := v_reasons;
  NEW.outcome_integrity_status := public.contractor_outcome_integrity_status(v_reasons);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_contractor_outcome_integrity ON public.contractor_outcomes;
CREATE TRIGGER set_contractor_outcome_integrity
BEFORE INSERT OR UPDATE ON public.contractor_outcomes
FOR EACH ROW
EXECUTE FUNCTION public.set_contractor_outcome_integrity();

DROP POLICY IF EXISTS "authenticated_select_outcomes" ON public.contractor_outcomes;
DROP POLICY IF EXISTS "operator_select_outcomes" ON public.contractor_outcomes;
DROP POLICY IF EXISTS "operator_insert_outcomes" ON public.contractor_outcomes;
DROP POLICY IF EXISTS "operator_update_outcomes" ON public.contractor_outcomes;
DROP POLICY IF EXISTS "internal_operator_select_outcomes" ON public.contractor_outcomes;
DROP POLICY IF EXISTS "internal_operator_insert_outcomes" ON public.contractor_outcomes;
DROP POLICY IF EXISTS "internal_operator_update_outcomes" ON public.contractor_outcomes;

CREATE POLICY "internal_operator_select_outcomes"
  ON public.contractor_outcomes
  FOR SELECT
  TO authenticated
  USING (public.is_internal_operator());

CREATE POLICY "internal_operator_insert_outcomes"
  ON public.contractor_outcomes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_operator());

CREATE POLICY "internal_operator_update_outcomes"
  ON public.contractor_outcomes
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_operator())
  WITH CHECK (public.is_internal_operator());

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
      l.latest_scan_session_id AS scan_session_id,
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

COMMENT ON TABLE public.contractor_outcomes IS
  'Authoritative contractor outcome truth table for sold/lost business results. Leads are rollups only; lead_assignments are operational ownership only.';
COMMENT ON COLUMN public.contractor_outcomes.value_basis IS
  'Explicit basis for sold value: contract_total, gross_sale_value, true_margin, estimated_contract_value, or unknown. Gross sale value is a proxy, not true margin.';
COMMENT ON COLUMN public.contractor_outcomes.outcome_integrity_status IS
  'Computed integrity posture for internal inspection: valid, warning, blocked, or needs_review.';
COMMENT ON FUNCTION public.admin_contractor_outcome_integrity() IS
  'Phase 3E internal operator read surface for contractor outcome integrity. Redacts raw PII and proves no external dispatch occurs.';
