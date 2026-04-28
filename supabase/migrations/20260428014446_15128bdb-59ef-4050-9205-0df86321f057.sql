ALTER TABLE public.contractor_outcomes
  ALTER COLUMN billable_intro_id DROP NOT NULL,
  ALTER COLUMN opportunity_id DROP NOT NULL;

DROP INDEX IF EXISTS contractor_outcomes_current_assignment_unique;
CREATE UNIQUE INDEX contractor_outcomes_current_assignment_unique
  ON public.contractor_outcomes (lower(BTRIM(client_slug)), lead_assignment_id, contractor_account_id)
  WHERE lead_assignment_id IS NOT NULL
    AND contractor_account_id IS NOT NULL
    AND COALESCE(outcome_metadata->>'signal_lifecycle_action', 'active') = 'active';