-- One diagnosis callback request per scan session.
--
-- diagnosis_submission_id remains the intake/retry key. This additional
-- partial index prevents refreshes, second tabs, or new submission UUIDs from
-- creating another general_callback for the diagnosis_final_cta on the same
-- scan. Other callback intents and CTA sources are unaffected.

CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_followups_diagnosis_callback_scan_session
  ON public.voice_followups (scan_session_id)
  WHERE scan_session_id IS NOT NULL
    AND call_intent = 'general_callback'
    AND cta_source = 'diagnosis_final_cta';

DO $assert$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'voice_followups'
      AND indexname = 'idx_voice_followups_diagnosis_callback_scan_session'
  ) THEN
    RAISE EXCEPTION 'INSTALL ASSERT: diagnosis callback scan-session unique index is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_diagnosis_intakes_diagnosis_submission_id'
  ) THEN
    RAISE EXCEPTION 'INSTALL ASSERT: diagnosis_intakes submission-id unique index is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_voice_followups_diagnosis_submission_id'
  ) THEN
    RAISE EXCEPTION 'INSTALL ASSERT: voice_followups submission-id unique index is missing';
  END IF;

  IF NOT pg_catalog.has_table_privilege(
    'service_role',
    'public.voice_followups',
    'SELECT'
  )
     OR NOT pg_catalog.has_table_privilege(
       'service_role',
       'public.voice_followups',
       'INSERT'
     )
     OR NOT pg_catalog.has_table_privilege(
       'service_role',
       'public.voice_followups',
       'UPDATE'
     ) THEN
    RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks SELECT/INSERT/UPDATE on public.voice_followups';
  END IF;
END;
$assert$;

-- Rollback (this migration's delta only):
--   DROP INDEX IF EXISTS public.idx_voice_followups_diagnosis_callback_scan_session;
