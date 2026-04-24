-- Sprint 1C — Partner-safe per-row outcomes feed for the Revenue Dashboard.
-- Read-only, additive. Identity resolution mirrors partner-update-disposition
-- and partner_outcome_summary: auth.uid() -> contractors.auth_user_id -> contractors.id.

CREATE OR REPLACE FUNCTION public.partner_outcomes_with_lead_context()
RETURNS TABLE (
  outcome_id              uuid,
  opportunity_id          uuid,
  lead_id                 uuid,
  analysis_id             uuid,
  disposition_state       text,
  disposition_reason_code text,
  projected_value_cents   integer,
  final_value_cents       integer,
  signed_contract_url     text,
  last_partner_action_at  timestamptz,
  outcome_created_at      timestamptz,
  outcome_updated_at      timestamptz,
  closed_at               timestamptz,
  appointment_booked_at   timestamptz,
  homeowner_first_name    text,
  city                    text,
  county                  text,
  project_type            text,
  window_count            integer,
  quote_range             text,
  grade                   text,
  red_flag_count          integer,
  amber_flag_count        integer,
  flag_count              integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid      uuid := auth.uid();
  v_contractor_id uuid;
BEGIN
  IF v_auth_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT c.id INTO v_contractor_id
  FROM public.contractors c
  WHERE c.auth_user_id = v_auth_uid
  LIMIT 1;

  IF v_contractor_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    co.id                              AS outcome_id,
    co.opportunity_id,
    opp.lead_id,
    opp.analysis_id,
    co.disposition_state,
    co.disposition_reason_code,
    co.projected_value_cents,
    co.final_value_cents,
    co.signed_contract_url,
    co.last_partner_action_at,
    co.created_at                      AS outcome_created_at,
    co.updated_at                      AS outcome_updated_at,
    co.closed_at,
    co.appointment_booked_at,
    l.first_name                       AS homeowner_first_name,
    l.city,
    l.county,
    opp.project_type,
    opp.window_count,
    opp.quote_range,
    opp.grade,
    opp.red_flag_count,
    opp.amber_flag_count,
    opp.flag_count
  FROM public.contractor_outcomes      co
  JOIN public.contractor_opportunities opp ON opp.id = co.opportunity_id
  LEFT JOIN public.leads               l   ON l.id   = opp.lead_id
  WHERE co.contractor_id = v_contractor_id;
END;
$$;

COMMENT ON FUNCTION public.partner_outcomes_with_lead_context() IS
  'Sprint 1C: partner-safe per-row outcomes feed for the Revenue Dashboard. Resolves caller via contractors.auth_user_id; returns only their own contractor_outcomes joined with lead/opportunity context.';