-- Least-privilege read required by start-upload-scan-session when it verifies
-- the latest durable WindowMan service-consent decision.
--
-- Dependency: 20260801143000_lead_consent_events.sql must be applied first.
-- Rollback: REVOKE SELECT ON TABLE public.lead_consent_events FROM service_role;

DO $$
BEGIN
  IF pg_catalog.to_regclass('public.lead_consent_events') IS NULL THEN
    RAISE EXCEPTION
      'INSTALL ASSERT: public.lead_consent_events must exist before granting service-role read access';
  END IF;
END;
$$;

GRANT SELECT ON TABLE public.lead_consent_events TO service_role;

DO $$
BEGIN
  IF NOT pg_catalog.has_table_privilege(
    'service_role',
    'public.lead_consent_events',
    'SELECT'
  ) THEN
    RAISE EXCEPTION
      'INSTALL ASSERT: service_role lacks SELECT on public.lead_consent_events';
  END IF;
END;
$$;
