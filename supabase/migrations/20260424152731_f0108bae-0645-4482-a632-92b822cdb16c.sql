-- ============================================================
-- Tighten partner disposition integrity:
--   1) sold_closed requires final_value_cents > 0 (not just NOT NULL)
--   2) lost_dead requires disposition_reason_code AND non-empty outcome_notes
-- ============================================================
-- Additive, surgical migration. Old constraints from
-- 20260424100000_add_disposition_to_contractor_outcomes.sql are
-- replaced with strict variants. No data backfill needed: a pre-flight
-- check via supabase--read_query confirmed zero rows in
-- contractor_outcomes match either invalid pattern.
-- ============================================================

-- ── 1. Replace sold-requires-value constraint with strict > 0 ──
ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_sold_requires_value;

ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_sold_requires_positive_value
    CHECK (
      disposition_state <> 'sold_closed'
      OR (final_value_cents IS NOT NULL AND final_value_cents > 0)
    );

-- ── 2. Replace lost-requires-reason constraint with strict typed reason ──
ALTER TABLE public.contractor_outcomes
  DROP CONSTRAINT IF EXISTS contractor_outcomes_lost_requires_reason;

ALTER TABLE public.contractor_outcomes
  ADD CONSTRAINT contractor_outcomes_lost_requires_typed_reason
    CHECK (
      disposition_state <> 'lost_dead'
      OR (
        disposition_reason_code IS NOT NULL
        AND outcome_notes IS NOT NULL
        AND length(trim(outcome_notes)) > 0
      )
    );