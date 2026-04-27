-- ============================================================================
-- Sprint 1E — Admin Outcome Inspector (read-only RPC)
-- ----------------------------------------------------------------------------
-- Internal operator visibility into contractor-reported outcomes joined with
-- contractor_opportunities, contractors, and the leads rollup row. Detects
-- four rollup states: ok / no_lead_linked / lead_rollup_missing /
-- lead_rollup_mismatch.
--
-- Authoritative truth still lives in `public.contractor_outcomes`; this RPC
-- never writes. Identity gate uses the existing `public.is_internal_operator()`
-- helper (operator/admin/super_admin app_metadata role).
--
-- Pairs with `src/components/admin/AdminOutcomeInspector.tsx` (read-only UI).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_outcomes_inspector()
RETURNS TABLE (
  outcome_id                uuid,
  opportunity_id            uuid,
  lead_id                   uuid,
  analysis_id               uuid,
  contractor_id             uuid,
  contractor_company_name   text,
  contractor_contact_name   text,
  homeowner_first_name      text,
  homeowner_last_name       text,
  city                      text,
  county                    text,
  client_slug               text,
  disposition_state         text,
  disposition_reason_code   text,
  outcome_notes             text,
  projected_value_cents     integer,
  final_value_cents         integer,
  signed_contract_url       text,
  last_partner_action_at    timestamptz,
  outcome_created_at        timestamptz,
  outcome_updated_at        timestamptz,
  outcome_closed_at         timestamptz,
  lead_deal_status          text,
  lead_deal_value           numeric,
  lead_revenue_amount       numeric,
  lead_closed_at            timestamptz,
  rollup_status             text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Hard gate: only internal operators may read this surface. Same pattern as
  -- partner_outcome_summary / partner_outcomes_with_lead_context, but scoped
  -- to is_internal_operator() instead of contractor identity.
  IF NOT public.is_internal_operator() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH terminal_states AS (
    -- Single source of truth for terminal disposition states. Referenced by
    -- both the sibling stats CTE and the rollup detector below so a future
    -- terminal state (e.g. 'cancelled') only has to be added in one place.
    SELECT unnest(ARRAY['sold_closed', 'lost_dead']::text[]) AS state
  ),
  lead_outcome_stats AS (
    -- Per-lead sibling outcome counts. Two facets matter for the audit:
    --   active_count — non-terminal siblings; the lost_dead missing-rollup
    --     detector cannot fire while any sibling is still in motion because
    --     partner-update-disposition only writes leads.deal_status='lost'
    --     once every sibling is terminal.
    --   sold_count — terminal-sold siblings; if any sibling is sold, the
    --     lead is rightly 'won' (partner-update-disposition prefers a sold
    --     write at the lead level), and a lost_dead row on the same lead is
    --     consistent with the rollup, NOT a missing rollup.
    SELECT
      opp_inner.lead_id                                                       AS lead_id,
      COUNT(*) FILTER (
        WHERE co_inner.disposition_state NOT IN (SELECT state FROM terminal_states)
      )                                                                       AS active_count,
      COUNT(*) FILTER (
        WHERE co_inner.disposition_state = 'sold_closed'
      )                                                                       AS sold_count
    FROM public.contractor_outcomes      co_inner
    JOIN public.contractor_opportunities opp_inner
      ON opp_inner.id = co_inner.opportunity_id
    GROUP BY opp_inner.lead_id
  )
  SELECT
    co.id                              AS outcome_id,
    co.opportunity_id,
    opp.lead_id,
    opp.analysis_id,
    co.contractor_id,
    c.company_name                     AS contractor_company_name,
    c.contact_name                     AS contractor_contact_name,
    l.first_name                       AS homeowner_first_name,
    l.last_name                        AS homeowner_last_name,
    l.city,
    l.county,
    l.client_slug,
    co.disposition_state,
    co.disposition_reason_code,
    co.outcome_notes,
    co.projected_value_cents,
    co.final_value_cents,
    co.signed_contract_url,
    co.last_partner_action_at,
    co.created_at                      AS outcome_created_at,
    co.updated_at                      AS outcome_updated_at,
    co.closed_at                       AS outcome_closed_at,
    l.deal_status                      AS lead_deal_status,
    l.deal_value                       AS lead_deal_value,
    l.revenue_amount                   AS lead_revenue_amount,
    l.closed_at                        AS lead_closed_at,
    -- ── Rollup status detector ──────────────────────────────────────────────
    -- Order of precedence (first match wins):
    --   1. no_lead_linked       — opportunity has no lead_id
    --   2. lead_rollup_missing  — terminal outcome but rollup not consistent:
    --        a. sold_closed and lead.deal_status <> 'won' or lead.closed_at IS NULL
    --        b. sold_closed and either rollup value (deal_value / revenue_amount)
    --           is NULL — the rollup row was never populated
    --        c. lost_dead with no active siblings AND no sold siblings AND
    --           (lead.deal_status <> 'lost' OR lead.closed_at IS NULL)
    --        Note 2c: if any sibling is sold, the lead is rightly 'won' and a
    --        lost_dead row on the same lead is consistent — NOT missing.
    --   3. lead_rollup_mismatch — sold_closed final value disagrees with
    --                             leads.deal_value AND/OR leads.revenue_amount
    --                             (only evaluated when both rollup fields are
    --                             non-null; NULL-rollup falls into 2b above).
    --   4. ok                   — everything else, including non-terminal
    --                             outcomes (rollup writes haven't happened yet
    --                             by design).
    CASE
      WHEN opp.lead_id IS NULL THEN 'no_lead_linked'
      WHEN co.disposition_state = 'sold_closed' AND (
             l.deal_status IS DISTINCT FROM 'won'
             OR l.closed_at IS NULL
           )
        THEN 'lead_rollup_missing'
      WHEN co.disposition_state = 'sold_closed'
           AND co.final_value_cents IS NOT NULL
           AND (l.deal_value IS NULL OR l.revenue_amount IS NULL)
        THEN 'lead_rollup_missing'
      WHEN co.disposition_state = 'lost_dead'
           AND COALESCE(los.active_count, 0) = 0
           AND COALESCE(los.sold_count, 0)   = 0
           AND (
             l.deal_status IS DISTINCT FROM 'lost'
             OR l.closed_at IS NULL
           )
        THEN 'lead_rollup_missing'
      WHEN co.disposition_state = 'sold_closed'
           AND co.final_value_cents IS NOT NULL
           AND l.deal_value     IS NOT NULL
           AND l.revenue_amount IS NOT NULL
           AND (
             -- Compare in cents to avoid float drift. Tolerance 0 — partner
             -- edge function writes leads.deal_value = final_value_cents/100
             -- exactly, so any drift is a real mismatch.
             ROUND(l.deal_value::numeric * 100)
               IS DISTINCT FROM co.final_value_cents
             OR ROUND(l.revenue_amount::numeric * 100)
               IS DISTINCT FROM co.final_value_cents
           )
        THEN 'lead_rollup_mismatch'
      ELSE 'ok'
    END                                AS rollup_status
  FROM public.contractor_outcomes      co
  JOIN public.contractor_opportunities opp ON opp.id = co.opportunity_id
  LEFT JOIN public.contractors         c   ON c.id   = co.contractor_id
  LEFT JOIN public.leads               l   ON l.id   = opp.lead_id
  LEFT JOIN lead_outcome_stats         los ON los.lead_id = opp.lead_id
  ORDER BY co.last_partner_action_at DESC NULLS LAST,
           co.created_at              DESC;
END;
$$;

-- Lock execution down: anon and unauthenticated callers cannot invoke this.
-- The body's is_internal_operator() check is the actual gate; revoking
-- EXECUTE from PUBLIC and anon makes the surface unreachable from the
-- public schema regardless of search_path.
REVOKE ALL ON FUNCTION public.admin_outcomes_inspector() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_outcomes_inspector() TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_outcomes_inspector() IS
  'Sprint 1E: read-only admin-scoped outcome inspector. Joins contractor_outcomes ⇄ contractor_opportunities ⇄ contractors ⇄ leads and returns one row per outcome with a computed rollup_status (ok / no_lead_linked / lead_rollup_missing / lead_rollup_mismatch). Gated by public.is_internal_operator(); never writes.';
