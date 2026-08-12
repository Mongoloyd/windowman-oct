BEGIN;

-- Additive table-ACL repair for browser telemetry, canonical event persistence,
-- and service-role OTP observability. Existing RLS policies remain unchanged.
GRANT INSERT ON TABLE public.event_logs TO anon;
GRANT SELECT, INSERT ON TABLE public.wm_event_log TO service_role;
GRANT SELECT, INSERT ON TABLE public.otp_lifecycle_events TO service_role;
GRANT SELECT, INSERT ON TABLE public.twilio_message_events TO service_role;

DO $assert$
BEGIN
  IF NOT pg_catalog.has_table_privilege('anon', 'public.event_logs', 'INSERT') THEN
    RAISE EXCEPTION 'INSTALL ASSERT: anon lacks INSERT on public.event_logs';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.wm_event_log', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.wm_event_log', 'INSERT') THEN
    RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks required public.wm_event_log privileges';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.otp_lifecycle_events', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.otp_lifecycle_events', 'INSERT') THEN
    RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks required public.otp_lifecycle_events privileges';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.twilio_message_events', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.twilio_message_events', 'INSERT') THEN
    RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks required public.twilio_message_events privileges';
  END IF;
END;
$assert$;

COMMIT;

-- Local rollback (revoke only the privilege delta introduced here):
-- REVOKE INSERT ON TABLE public.event_logs FROM anon;
-- REVOKE SELECT, INSERT ON TABLE public.wm_event_log FROM service_role;
-- REVOKE SELECT, INSERT ON TABLE public.otp_lifecycle_events FROM service_role;
-- REVOKE SELECT, INSERT ON TABLE public.twilio_message_events FROM service_role;
