-- Adds a purpose for advertising attribution/measurement without conflating
-- it with permission to send marketing communications.

DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_catalog.pg_get_constraintdef(c.oid)
  INTO v_definition
  FROM pg_catalog.pg_constraint AS c
  WHERE c.conrelid = 'public.lead_consent_events'::pg_catalog.regclass
    AND c.conname = 'lead_consent_events_purpose_check'
    AND c.contype = 'c';

  -- A replay is a no-op once the distinct purpose is already accepted.
  IF v_definition IS NULL OR
     pg_catalog.strpos(v_definition, 'advertising_measurement') = 0 THEN
    ALTER TABLE public.lead_consent_events
      DROP CONSTRAINT IF EXISTS lead_consent_events_purpose_check;

    ALTER TABLE public.lead_consent_events
      ADD CONSTRAINT lead_consent_events_purpose_check
      CHECK (
        purpose IN (
          'service_communications',
          'advertising_measurement',
          'marketing_communications',
          'contractor_sharing'
        )
      );
  END IF;
END;
$migration$;

COMMENT ON CONSTRAINT lead_consent_events_purpose_check
  ON public.lead_consent_events IS
  'Separates advertising measurement consent from service, marketing communications, and contractor sharing.';

/*
MANUAL DOWN MIGRATION (schema rollback only; consent history is retained):

ALTER TABLE public.lead_consent_events
  DROP CONSTRAINT IF EXISTS lead_consent_events_purpose_check;

ALTER TABLE public.lead_consent_events
  ADD CONSTRAINT lead_consent_events_purpose_check
  CHECK (
    purpose IN (
      'service_communications',
      'marketing_communications',
      'contractor_sharing'
    )
  ) NOT VALID;

-- Only validate after confirming no advertising_measurement rows remain.
-- The launch rollback intentionally keeps immutable consent history, so the
-- normal rollback is to leave this additive purpose in place.
*/
