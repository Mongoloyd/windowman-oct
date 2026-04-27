CREATE TABLE IF NOT EXISTS public.syndicates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  market text NULL,
  region text NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.syndicate_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  syndicate_id uuid NOT NULL REFERENCES public.syndicates(id) ON DELETE CASCADE,
  client_slug text NOT NULL REFERENCES public.clients(slug),
  role text NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  territory jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (syndicate_id, client_slug)
);

CREATE TABLE IF NOT EXISTS public.contractor_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  client_slug text NOT NULL REFERENCES public.clients(slug),
  display_name text NOT NULL,
  contact_email text NULL,
  contact_phone text NULL,
  auth_user_id uuid NULL UNIQUE,
  territory jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lead_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  lead_id uuid NULL REFERENCES public.leads(id),
  scan_session_id uuid NULL REFERENCES public.scan_sessions(id),
  analysis_id uuid NULL REFERENCES public.analyses(id),
  syndicate_id uuid NULL REFERENCES public.syndicates(id),
  client_slug text NOT NULL REFERENCES public.clients(slug),
  contractor_account_id uuid NULL REFERENCES public.contractor_accounts(id),
  status text NOT NULL DEFAULT 'assigned',
  is_current boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz NULL,
  released_at timestamptz NULL,
  recycled_at timestamptz NULL,
  reason_code text NOT NULL DEFAULT 'initial_assignment',
  assigned_by uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.lead_routing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  assignment_id uuid NULL REFERENCES public.lead_assignments(id) ON DELETE CASCADE,
  lead_id uuid NULL REFERENCES public.leads(id),
  scan_session_id uuid NULL REFERENCES public.scan_sessions(id),
  analysis_id uuid NULL REFERENCES public.analyses(id),
  event_type text NOT NULL,
  from_client_slug text NULL,
  to_client_slug text NULL,
  from_contractor_account_id uuid NULL REFERENCES public.contractor_accounts(id),
  to_contractor_account_id uuid NULL REFERENCES public.contractor_accounts(id),
  operator_id uuid NULL,
  reason_code text NOT NULL,
  note text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'syndicates_slug_not_blank' AND conrelid = 'public.syndicates'::regclass) THEN
    ALTER TABLE public.syndicates ADD CONSTRAINT syndicates_slug_not_blank CHECK (BTRIM(slug) <> '');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'syndicates_name_not_blank' AND conrelid = 'public.syndicates'::regclass) THEN
    ALTER TABLE public.syndicates ADD CONSTRAINT syndicates_name_not_blank CHECK (BTRIM(name) <> '');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'syndicate_clients_role_check' AND conrelid = 'public.syndicate_clients'::regclass) THEN
    ALTER TABLE public.syndicate_clients ADD CONSTRAINT syndicate_clients_role_check CHECK (role IN ('member','primary','exclusive','pooled','paused'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contractor_accounts_display_name_not_blank' AND conrelid = 'public.contractor_accounts'::regclass) THEN
    ALTER TABLE public.contractor_accounts ADD CONSTRAINT contractor_accounts_display_name_not_blank CHECK (BTRIM(display_name) <> '');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_assignments_identity_required' AND conrelid = 'public.lead_assignments'::regclass) THEN
    ALTER TABLE public.lead_assignments ADD CONSTRAINT lead_assignments_identity_required CHECK (lead_id IS NOT NULL OR scan_session_id IS NOT NULL OR analysis_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_assignments_status_check' AND conrelid = 'public.lead_assignments'::regclass) THEN
    ALTER TABLE public.lead_assignments ADD CONSTRAINT lead_assignments_status_check CHECK (status IN ('unassigned','assigned','accepted','contacted','scheduled','sold_closed','lost_dead','recycled','reassigned','disputed','manual_review'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_assignments_sold_closed_boundary' AND conrelid = 'public.lead_assignments'::regclass) THEN
    ALTER TABLE public.lead_assignments ADD CONSTRAINT lead_assignments_sold_closed_boundary CHECK (status <> 'sold_closed' OR metadata ? 'contractor_outcome_boundary_ack');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_routing_events_identity_required' AND conrelid = 'public.lead_routing_events'::regclass) THEN
    ALTER TABLE public.lead_routing_events ADD CONSTRAINT lead_routing_events_identity_required CHECK (assignment_id IS NOT NULL OR lead_id IS NOT NULL OR scan_session_id IS NOT NULL OR analysis_id IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_routing_events_event_type_check' AND conrelid = 'public.lead_routing_events'::regclass) THEN
    ALTER TABLE public.lead_routing_events ADD CONSTRAINT lead_routing_events_event_type_check CHECK (event_type IN ('created','assigned','accepted','contacted','scheduled','sold_closed','lost_dead','recycled','reassigned','disputed','manual_review','operator_note'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_syndicates_slug ON public.syndicates (slug);
CREATE INDEX IF NOT EXISTS idx_syndicate_clients_syndicate_id ON public.syndicate_clients (syndicate_id);
CREATE INDEX IF NOT EXISTS idx_syndicate_clients_client_slug ON public.syndicate_clients (client_slug);
CREATE INDEX IF NOT EXISTS idx_contractor_accounts_client_slug ON public.contractor_accounts (client_slug);
CREATE INDEX IF NOT EXISTS idx_contractor_accounts_auth_user_id ON public.contractor_accounts (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead_id ON public.lead_assignments (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_scan_session_id ON public.lead_assignments (scan_session_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_analysis_id ON public.lead_assignments (analysis_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_client_slug ON public.lead_assignments (client_slug);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_contractor_account_id ON public.lead_assignments (contractor_account_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_is_current ON public.lead_assignments (is_current) WHERE is_current = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_assignments_one_current_lead ON public.lead_assignments (lead_id) WHERE is_current = true AND lead_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_assignments_one_current_scan_session ON public.lead_assignments (scan_session_id) WHERE is_current = true AND scan_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_assignments_one_current_analysis ON public.lead_assignments (analysis_id) WHERE is_current = true AND analysis_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_routing_events_assignment_id ON public.lead_routing_events (assignment_id);
CREATE INDEX IF NOT EXISTS idx_lead_routing_events_lead_id ON public.lead_routing_events (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_routing_events_scan_session_id ON public.lead_routing_events (scan_session_id);
CREATE INDEX IF NOT EXISTS idx_lead_routing_events_analysis_id ON public.lead_routing_events (analysis_id);
CREATE INDEX IF NOT EXISTS idx_lead_routing_events_created_at ON public.lead_routing_events (created_at DESC);

DROP TRIGGER IF EXISTS trg_syndicates_updated_at ON public.syndicates;
CREATE TRIGGER trg_syndicates_updated_at BEFORE UPDATE ON public.syndicates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_syndicate_clients_updated_at ON public.syndicate_clients;
CREATE TRIGGER trg_syndicate_clients_updated_at BEFORE UPDATE ON public.syndicate_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_contractor_accounts_updated_at ON public.contractor_accounts;
CREATE TRIGGER trg_contractor_accounts_updated_at BEFORE UPDATE ON public.contractor_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_lead_assignments_updated_at ON public.lead_assignments;
CREATE TRIGGER trg_lead_assignments_updated_at BEFORE UPDATE ON public.lead_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.reject_lead_routing_events_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'lead_routing_events is immutable; % is not allowed', TG_OP USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_routing_events_reject_update ON public.lead_routing_events;
CREATE TRIGGER trg_lead_routing_events_reject_update BEFORE UPDATE ON public.lead_routing_events FOR EACH ROW EXECUTE FUNCTION public.reject_lead_routing_events_mutation();

DROP TRIGGER IF EXISTS trg_lead_routing_events_reject_delete ON public.lead_routing_events;
CREATE TRIGGER trg_lead_routing_events_reject_delete BEFORE DELETE ON public.lead_routing_events FOR EACH ROW EXECUTE FUNCTION public.reject_lead_routing_events_mutation();

ALTER TABLE public.syndicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syndicate_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_routing_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.syndicates FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.syndicate_clients FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.contractor_accounts FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.lead_assignments FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.lead_routing_events FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.syndicates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.syndicate_clients TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.contractor_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.lead_assignments TO authenticated;
GRANT SELECT, INSERT ON TABLE public.lead_routing_events TO authenticated;
GRANT ALL ON TABLE public.syndicates TO service_role;
GRANT ALL ON TABLE public.syndicate_clients TO service_role;
GRANT ALL ON TABLE public.contractor_accounts TO service_role;
GRANT ALL ON TABLE public.lead_assignments TO service_role;
GRANT ALL ON TABLE public.lead_routing_events TO service_role;

DROP POLICY IF EXISTS syndicates_service_role_all ON public.syndicates;
CREATE POLICY syndicates_service_role_all ON public.syndicates FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS syndicates_select_internal ON public.syndicates;
CREATE POLICY syndicates_select_internal ON public.syndicates FOR SELECT TO authenticated USING ((SELECT public.is_internal_operator()));
DROP POLICY IF EXISTS syndicates_insert_internal ON public.syndicates;
CREATE POLICY syndicates_insert_internal ON public.syndicates FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_internal_operator()));
DROP POLICY IF EXISTS syndicates_update_internal ON public.syndicates;
CREATE POLICY syndicates_update_internal ON public.syndicates FOR UPDATE TO authenticated USING ((SELECT public.is_internal_operator())) WITH CHECK ((SELECT public.is_internal_operator()));

DROP POLICY IF EXISTS syndicate_clients_service_role_all ON public.syndicate_clients;
CREATE POLICY syndicate_clients_service_role_all ON public.syndicate_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS syndicate_clients_select_internal ON public.syndicate_clients;
CREATE POLICY syndicate_clients_select_internal ON public.syndicate_clients FOR SELECT TO authenticated USING ((SELECT public.is_internal_operator()));
DROP POLICY IF EXISTS syndicate_clients_insert_internal ON public.syndicate_clients;
CREATE POLICY syndicate_clients_insert_internal ON public.syndicate_clients FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_internal_operator()));
DROP POLICY IF EXISTS syndicate_clients_update_internal ON public.syndicate_clients;
CREATE POLICY syndicate_clients_update_internal ON public.syndicate_clients FOR UPDATE TO authenticated USING ((SELECT public.is_internal_operator())) WITH CHECK ((SELECT public.is_internal_operator()));

DROP POLICY IF EXISTS contractor_accounts_service_role_all ON public.contractor_accounts;
CREATE POLICY contractor_accounts_service_role_all ON public.contractor_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS contractor_accounts_select_internal ON public.contractor_accounts;
CREATE POLICY contractor_accounts_select_internal ON public.contractor_accounts FOR SELECT TO authenticated USING ((SELECT public.is_internal_operator()));
DROP POLICY IF EXISTS contractor_accounts_insert_internal ON public.contractor_accounts;
CREATE POLICY contractor_accounts_insert_internal ON public.contractor_accounts FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_internal_operator()));
DROP POLICY IF EXISTS contractor_accounts_update_internal ON public.contractor_accounts;
CREATE POLICY contractor_accounts_update_internal ON public.contractor_accounts FOR UPDATE TO authenticated USING ((SELECT public.is_internal_operator())) WITH CHECK ((SELECT public.is_internal_operator()));
DROP POLICY IF EXISTS contractor_accounts_select_own ON public.contractor_accounts;
CREATE POLICY contractor_accounts_select_own ON public.contractor_accounts FOR SELECT TO authenticated USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS lead_assignments_service_role_all ON public.lead_assignments;
CREATE POLICY lead_assignments_service_role_all ON public.lead_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lead_assignments_select_internal ON public.lead_assignments;
CREATE POLICY lead_assignments_select_internal ON public.lead_assignments FOR SELECT TO authenticated USING ((SELECT public.is_internal_operator()));
DROP POLICY IF EXISTS lead_assignments_insert_internal ON public.lead_assignments;
CREATE POLICY lead_assignments_insert_internal ON public.lead_assignments FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_internal_operator()));
DROP POLICY IF EXISTS lead_assignments_update_internal ON public.lead_assignments;
CREATE POLICY lead_assignments_update_internal ON public.lead_assignments FOR UPDATE TO authenticated USING ((SELECT public.is_internal_operator())) WITH CHECK ((SELECT public.is_internal_operator()));
DROP POLICY IF EXISTS lead_assignments_select_own_contractor ON public.lead_assignments;
CREATE POLICY lead_assignments_select_own_contractor
  ON public.lead_assignments
  FOR SELECT
  TO authenticated
  USING (
    contractor_account_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.contractor_accounts ca
      WHERE ca.id = lead_assignments.contractor_account_id
        AND ca.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lead_routing_events_service_role_all ON public.lead_routing_events;
CREATE POLICY lead_routing_events_service_role_all ON public.lead_routing_events FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS lead_routing_events_select_internal ON public.lead_routing_events;
CREATE POLICY lead_routing_events_select_internal ON public.lead_routing_events FOR SELECT TO authenticated USING ((SELECT public.is_internal_operator()));
DROP POLICY IF EXISTS lead_routing_events_insert_internal ON public.lead_routing_events;
CREATE POLICY lead_routing_events_insert_internal ON public.lead_routing_events FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_internal_operator()));

COMMENT ON TABLE public.syndicates IS 'Phase 3C internal WindowMan syndicate market/routing groups. No anon access.';
COMMENT ON TABLE public.syndicate_clients IS 'Phase 3C membership map from existing client_slug clients into internal syndicates. Stores no platform tokens.';
COMMENT ON TABLE public.contractor_accounts IS 'Phase 3C contractor/company/branch actor accounts under a client_slug. Auth mapping is direct and scoped; no platform token storage.';
COMMENT ON TABLE public.lead_assignments IS 'Phase 3C auditable current and historical lead ownership records. Sold revenue truth remains in contractor_outcomes.';
COMMENT ON TABLE public.lead_routing_events IS 'Phase 3C immutable audit history for routing decisions. Internal/service role writes only; no anon access.';
COMMENT ON CONSTRAINT lead_assignments_sold_closed_boundary ON public.lead_assignments IS 'A sold_closed assignment is only an ownership state. Authoritative revenue must be represented by contractor_outcomes; metadata must acknowledge this boundary.';
