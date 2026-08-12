-- ============================================================================
-- Diagnosis callback outbox — additive idempotency, enum, and least-privilege
-- grants for submit-diagnosis-intake orchestration.
--
-- Same-transaction safety:
--   ALTER TYPE ADD VALUE is committed as its own statement. This file does
--   not INSERT/CAST callback_requested. The install assert only inspects
--   pg_enum catalog labels.
--
-- wm_event_log privilege ownership:
--   SELECT + INSERT belong to 20260812201100_restore_tracking_event_log_grants.sql.
--   This migration adds UPDATE only. Rollback must not revoke SELECT/INSERT.
-- ============================================================================

ALTER TYPE public.wm_event_name
  ADD VALUE IF NOT EXISTS 'callback_requested';

ALTER TABLE public.diagnosis_intakes
  ADD COLUMN IF NOT EXISTS diagnosis_submission_id uuid;

ALTER TABLE public.voice_followups
  ADD COLUMN IF NOT EXISTS diagnosis_submission_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_diagnosis_intakes_diagnosis_submission_id
  ON public.diagnosis_intakes (diagnosis_submission_id)
  WHERE diagnosis_submission_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_followups_diagnosis_submission_id
  ON public.voice_followups (diagnosis_submission_id)
  WHERE diagnosis_submission_id IS NOT NULL;

GRANT SELECT, INSERT ON TABLE public.diagnosis_intakes TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.voice_followups TO service_role;
GRANT SELECT ON TABLE public.lead_consent_events TO service_role;
GRANT SELECT, INSERT ON TABLE public.lead_events TO service_role;
GRANT UPDATE ON TABLE public.wm_event_log TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.wm_platform_dispatch_log TO service_role;

DO $assert$
BEGIN
  IF NOT pg_catalog.has_table_privilege('service_role', 'public.diagnosis_intakes', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.diagnosis_intakes', 'INSERT') THEN
    RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks SELECT/INSERT on public.diagnosis_intakes';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.voice_followups', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.voice_followups', 'INSERT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.voice_followups', 'UPDATE') THEN
    RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks SELECT/INSERT/UPDATE on public.voice_followups';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.lead_consent_events', 'SELECT') THEN
    RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks SELECT on public.lead_consent_events';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.lead_events', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.lead_events', 'INSERT') THEN
    RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks SELECT/INSERT on public.lead_events';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.wm_event_log', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.wm_event_log', 'INSERT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.wm_event_log', 'UPDATE') THEN
    RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks SELECT/INSERT/UPDATE on public.wm_event_log';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.wm_platform_dispatch_log', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.wm_platform_dispatch_log', 'INSERT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.wm_platform_dispatch_log', 'UPDATE') THEN
    RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks SELECT/INSERT/UPDATE on public.wm_platform_dispatch_log';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_enum e
    JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'wm_event_name'
      AND e.enumlabel = 'callback_requested'
  ) THEN
    RAISE EXCEPTION 'INSTALL ASSERT: public.wm_event_name is missing callback_requested';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'diagnosis_intakes'
      AND column_name = 'diagnosis_submission_id'
  ) THEN
    RAISE EXCEPTION 'INSTALL ASSERT: diagnosis_intakes.diagnosis_submission_id is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'voice_followups'
      AND column_name = 'diagnosis_submission_id'
  ) THEN
    RAISE EXCEPTION 'INSTALL ASSERT: voice_followups.diagnosis_submission_id is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_diagnosis_intakes_diagnosis_submission_id'
  ) THEN
    RAISE EXCEPTION 'INSTALL ASSERT: idx_diagnosis_intakes_diagnosis_submission_id is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_voice_followups_diagnosis_submission_id'
  ) THEN
    RAISE EXCEPTION 'INSTALL ASSERT: idx_voice_followups_diagnosis_submission_id is missing';
  END IF;
END;
$assert$;

-- Rollback (delta introduced here only; requires a data audit before column/index
-- removal because diagnosis_submission_id may contain production rows):
--   REVOKE SELECT, INSERT ON TABLE public.diagnosis_intakes FROM service_role;
--   REVOKE SELECT, INSERT, UPDATE ON TABLE public.voice_followups FROM service_role;
--   REVOKE SELECT ON TABLE public.lead_consent_events FROM service_role;
--   REVOKE SELECT ON TABLE public.lead_events FROM service_role;
--     (do not REVOKE INSERT on lead_events if a prior migration granted it)
--   REVOKE UPDATE ON TABLE public.wm_event_log FROM service_role;
--     (do not REVOKE SELECT/INSERT — those belong to
--      20260812201100_restore_tracking_event_log_grants.sql)
--   REVOKE SELECT, INSERT, UPDATE ON TABLE public.wm_platform_dispatch_log FROM service_role;
--   DROP INDEX IF EXISTS public.idx_diagnosis_intakes_diagnosis_submission_id;
--   DROP INDEX IF EXISTS public.idx_voice_followups_diagnosis_submission_id;
--   Column removal for diagnosis_submission_id requires a data audit; do not
--   DROP COLUMN casually.
--   Enum value callback_requested is forward-only (Postgres cannot drop enum
--   values without recreating the type).
