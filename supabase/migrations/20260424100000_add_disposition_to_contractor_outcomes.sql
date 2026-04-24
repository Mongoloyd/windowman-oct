-- ============================================================
-- Add partner disposition workflow fields to contractor_outcomes
-- ============================================================
-- Extends the existing contractor_outcomes table with a disposition
-- state machine so contractors can record what happened with each
-- lead (new → attempting_contact → meeting_scheduled → quote_delivered
-- → sold_closed | lost_dead).
--
-- RLS is NOT changed — table remains service-role only.
-- ============================================================

ALTER TABLE public.contractor_outcomes
  ADD COLUMN IF NOT EXISTS disposition_state        TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS disposition_reason_code  TEXT,
  ADD COLUMN IF NOT EXISTS projected_value_cents    INTEGER,
  ADD COLUMN IF NOT EXISTS final_value_cents        INTEGER,
  ADD COLUMN IF NOT EXISTS signed_contract_url      TEXT,
  ADD COLUMN IF NOT EXISTS last_partner_action_at   TIMESTAMPTZ;

-- ── Constraints ──────────────────────────────────────────────

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

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_contractor_outcomes_disposition_state
  ON public.contractor_outcomes (disposition_state);

CREATE INDEX IF NOT EXISTS idx_contractor_outcomes_last_partner_action
  ON public.contractor_outcomes (last_partner_action_at DESC NULLS LAST);
