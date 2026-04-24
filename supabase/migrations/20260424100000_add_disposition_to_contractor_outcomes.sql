-- ============================================================
-- Add partner disposition workflow fields to contractor_outcomes
-- ============================================================
-- Extends the existing contractor_outcomes table with a disposition
-- state machine so contractors can record what happened with each
-- lead (new → attempting_contact → meeting_scheduled → quote_delivered
-- → sold_closed | lost_dead).
--
-- RLS is NOT changed — table remains service-role only.
--
-- Order matters:
--   1. Add columns (no cross-column constraints yet)
--   2. Backfill existing terminal rows from deal_status
--   3. Add constraints (backfill satisfies them)
-- ============================================================

-- ── Step 1: Add columns ───────────────────────────────────────

ALTER TABLE public.contractor_outcomes
  ADD COLUMN IF NOT EXISTS disposition_state        TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS disposition_reason_code  TEXT,
  ADD COLUMN IF NOT EXISTS projected_value_cents    INTEGER,
  ADD COLUMN IF NOT EXISTS final_value_cents        INTEGER,
  ADD COLUMN IF NOT EXISTS signed_contract_url      TEXT,
  ADD COLUMN IF NOT EXISTS last_partner_action_at   TIMESTAMPTZ;

-- ── Step 2: Backfill from existing deal_status ────────────────
-- Won deals → sold_closed; copy deal_value into final_value_cents (cents)
UPDATE public.contractor_outcomes
SET
  disposition_state = 'sold_closed',
  final_value_cents = COALESCE(ROUND(deal_value * 100)::integer, 0)
WHERE deal_status = 'won';

-- Lost/dead deals → lost_dead; use 'other' as legacy reason code
UPDATE public.contractor_outcomes
SET
  disposition_state = 'lost_dead',
  disposition_reason_code = 'other'
WHERE deal_status IN ('lost', 'dead');

-- ── Step 3: Constraints (safe to add after backfill) ──────────

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

-- Reason code required when lost
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_lost_requires_reason
    CHECK (
      disposition_state <> 'lost_dead'
      OR disposition_reason_code IS NOT NULL
    );

-- Final value required when sold
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_sold_requires_value
    CHECK (
      disposition_state <> 'sold_closed'
      OR final_value_cents IS NOT NULL
    );

-- Non-negative value guards
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_projected_value_non_negative
    CHECK (projected_value_cents IS NULL OR projected_value_cents >= 0);

ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_final_value_non_negative
    CHECK (final_value_cents IS NULL OR final_value_cents >= 0);

-- Reason code must be a known value when present (secondary safeguard;
-- primary validation happens in the edge function)
ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_disposition_reason_code_check
    CHECK (
      disposition_reason_code IS NULL
      OR disposition_reason_code IN (
        'price_too_high',
        'chose_competitor',
        'no_longer_interested',
        'unresponsive',
        'project_canceled',
        'out_of_service_area',
        'other'
      )
    );

-- ── Indexes ───────────────────────────────────────────────────

-- Composite index for the common partner-scoped query: outcomes for a
-- contractor filtered by state (e.g. all 'new' leads for contractor X)
CREATE INDEX IF NOT EXISTS idx_contractor_outcomes_contractor_disposition
  ON public.contractor_outcomes (contractor_id, disposition_state);

CREATE INDEX IF NOT EXISTS idx_contractor_outcomes_last_partner_action
  ON public.contractor_outcomes (last_partner_action_at DESC NULLS LAST);
