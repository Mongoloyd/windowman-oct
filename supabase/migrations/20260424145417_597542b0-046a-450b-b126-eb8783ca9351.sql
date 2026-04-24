-- Sprint 1B — Extend contractor_outcomes with partner CRM disposition workflow.
-- Additive only: preserves all existing columns (appointment_status, quote_status,
-- deal_status, deal_value, closed_at, outcome_notes, etc.).

ALTER TABLE public.contractor_outcomes
  ADD COLUMN IF NOT EXISTS disposition_state         text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS disposition_reason_code   text,
  ADD COLUMN IF NOT EXISTS projected_value_cents     integer,
  ADD COLUMN IF NOT EXISTS final_value_cents         integer,
  ADD COLUMN IF NOT EXISTS signed_contract_url       text,
  ADD COLUMN IF NOT EXISTS last_partner_action_at    timestamptz;

-- Allowed disposition states (must match partner-update-disposition VALID_STATES).
ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_disposition_state_check;
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_disposition_state_check
  CHECK (disposition_state IN (
    'new',
    'attempting_contact',
    'meeting_scheduled',
    'quote_delivered',
    'sold_closed',
    'lost_dead'
  ));

-- Allowed reason codes (must match DISPOSITION_REASON_CODE in src/lib/statusConstants.ts
-- and VALID_REASON_CODES in partner-update-disposition).
ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_disposition_reason_code_check;
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_disposition_reason_code_check
  CHECK (disposition_reason_code IS NULL OR disposition_reason_code IN (
    'price_too_high',
    'chose_competitor',
    'no_longer_interested',
    'unresponsive',
    'project_canceled',
    'out_of_service_area',
    'other'
  ));

-- Non-negative monetary values (cents). Immutable comparison only — safe in CHECK.
ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_projected_value_nonneg;
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_projected_value_nonneg
  CHECK (projected_value_cents IS NULL OR projected_value_cents >= 0);

ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_final_value_nonneg;
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_final_value_nonneg
  CHECK (final_value_cents IS NULL OR final_value_cents >= 0);

-- Terminal-state integrity: lost_dead requires a reason code; sold_closed requires
-- a positive final value. These are immutable predicates (no time/now()), safe in CHECK.
ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_lost_requires_reason;
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_lost_requires_reason
  CHECK (
    disposition_state <> 'lost_dead'
    OR disposition_reason_code IS NOT NULL
  );

ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_sold_requires_value;
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_sold_requires_value
  CHECK (
    disposition_state <> 'sold_closed'
    OR (final_value_cents IS NOT NULL AND final_value_cents > 0)
  );

-- Helpful index for partner dashboard reads (filter rows owned by a contractor and
-- group by current disposition).
CREATE INDEX IF NOT EXISTS contractor_outcomes_contractor_disposition_idx
  ON public.contractor_outcomes (contractor_id, disposition_state);

CREATE INDEX IF NOT EXISTS contractor_outcomes_last_partner_action_idx
  ON public.contractor_outcomes (contractor_id, last_partner_action_at DESC NULLS LAST);

-- ── Partner-safe summary read (additive, smallest viable) ─────────────────
-- Returns a per-disposition rollup for the calling contractor's outcomes.
-- Identity resolution mirrors partner-update-disposition:
--   auth.uid() -> contractor_profiles.id -> contractors.auth_user_id -> contractors.id
-- SECURITY DEFINER so the function can read across contractor_outcomes (which has
-- no public RLS policies by design); the function itself enforces ownership.

CREATE OR REPLACE FUNCTION public.partner_outcome_summary()
RETURNS TABLE (
  disposition_state         text,
  outcome_count             bigint,
  total_final_value_cents   bigint,
  total_projected_value_cents bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid     uuid := auth.uid();
  v_contractor_id uuid;
BEGIN
  IF v_auth_uid IS NULL THEN
    RETURN;
  END IF;

  -- Bridge auth user -> marketplace contractor
  SELECT c.id INTO v_contractor_id
  FROM public.contractors c
  WHERE c.auth_user_id = v_auth_uid
  LIMIT 1;

  IF v_contractor_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    co.disposition_state,
    COUNT(*)::bigint                                AS outcome_count,
    COALESCE(SUM(co.final_value_cents), 0)::bigint  AS total_final_value_cents,
    COALESCE(SUM(co.projected_value_cents), 0)::bigint AS total_projected_value_cents
  FROM public.contractor_outcomes co
  WHERE co.contractor_id = v_contractor_id
  GROUP BY co.disposition_state;
END;
$$;

COMMENT ON FUNCTION public.partner_outcome_summary() IS
  'Sprint 1B: partner-safe per-disposition rollup. Resolves caller via contractors.auth_user_id and returns only their own contractor_outcomes summary.';