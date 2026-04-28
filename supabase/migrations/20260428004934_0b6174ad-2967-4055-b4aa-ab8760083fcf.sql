CREATE TABLE IF NOT EXISTS public.lead_contact_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lead_assignment_id uuid NOT NULL REFERENCES public.lead_assignments(id) ON DELETE CASCADE,
  contractor_account_id uuid NOT NULL REFERENCES public.contractor_accounts(id) ON DELETE CASCADE,
  client_slug text NOT NULL,
  release_status text NOT NULL DEFAULT 'not_released',
  released_at timestamp with time zone NULL,
  released_by uuid NULL,
  revoked_at timestamp with time zone NULL,
  revoked_by uuid NULL,
  hold_reason text NULL,
  block_reason text NULL,
  release_notes text NULL,
  allowed_contact_fields text[] NOT NULL DEFAULT '{}'::text[],
  audit_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT lead_contact_releases_status_check CHECK (release_status IN ('not_released', 'held', 'approved', 'revoked', 'blocked', 'manual_review')),
  CONSTRAINT lead_contact_releases_allowed_fields_check CHECK (allowed_contact_fields <@ ARRAY['first_name','last_name','phone','email','city','county']::text[]),
  CONSTRAINT lead_contact_releases_unique_assignment_contractor UNIQUE (lead_assignment_id, contractor_account_id)
);

CREATE INDEX IF NOT EXISTS idx_lcr_assignment ON public.lead_contact_releases(lead_assignment_id);
CREATE INDEX IF NOT EXISTS idx_lcr_contractor_account ON public.lead_contact_releases(contractor_account_id);
CREATE INDEX IF NOT EXISTS idx_lcr_status ON public.lead_contact_releases(release_status);

CREATE OR REPLACE FUNCTION public.validate_lead_contact_release_match()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.lead_assignments la
    WHERE la.id = NEW.lead_assignment_id
      AND la.contractor_account_id = NEW.contractor_account_id
      AND la.client_slug = NEW.client_slug
  ) THEN
    RAISE EXCEPTION 'lead_contact_release assignment/contractor/client mismatch';
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_lead_contact_release_match_trigger ON public.lead_contact_releases;
CREATE TRIGGER validate_lead_contact_release_match_trigger
BEFORE INSERT OR UPDATE ON public.lead_contact_releases
FOR EACH ROW
EXECUTE FUNCTION public.validate_lead_contact_release_match();

ALTER TABLE public.lead_contact_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_contact_releases_select_internal ON public.lead_contact_releases;
CREATE POLICY lead_contact_releases_select_internal
ON public.lead_contact_releases
FOR SELECT
TO authenticated
USING (is_internal_operator());

DROP POLICY IF EXISTS lead_contact_releases_select_own_contractor ON public.lead_contact_releases;
CREATE POLICY lead_contact_releases_select_own_contractor
ON public.lead_contact_releases
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.contractor_accounts ca
    WHERE ca.id = lead_contact_releases.contractor_account_id
      AND ca.auth_user_id = auth.uid()
      AND ca.is_active = true
      AND ca.access_status = 'active'
  )
);

DROP POLICY IF EXISTS lead_contact_releases_insert_internal ON public.lead_contact_releases;
CREATE POLICY lead_contact_releases_insert_internal
ON public.lead_contact_releases
FOR INSERT
TO authenticated
WITH CHECK (is_internal_operator());

DROP POLICY IF EXISTS lead_contact_releases_update_internal ON public.lead_contact_releases;
CREATE POLICY lead_contact_releases_update_internal
ON public.lead_contact_releases
FOR UPDATE
TO authenticated
USING (is_internal_operator())
WITH CHECK (is_internal_operator());

DROP POLICY IF EXISTS lead_contact_releases_service_role_all ON public.lead_contact_releases;
CREATE POLICY lead_contact_releases_service_role_all
ON public.lead_contact_releases
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.lead_contact_release_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  release_id uuid NULL REFERENCES public.lead_contact_releases(id) ON DELETE SET NULL,
  lead_assignment_id uuid NOT NULL REFERENCES public.lead_assignments(id) ON DELETE CASCADE,
  contractor_account_id uuid NOT NULL REFERENCES public.contractor_accounts(id) ON DELETE CASCADE,
  client_slug text NOT NULL,
  event_type text NOT NULL,
  decision text NOT NULL,
  actor_id uuid NULL,
  allowed_contact_fields text[] NOT NULL DEFAULT '{}'::text[],
  reason text NULL,
  notes text NULL,
  audit_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT lead_contact_release_events_type_check CHECK (event_type IN ('created','updated','approved','held','blocked','revoked','manual_review')),
  CONSTRAINT lead_contact_release_events_decision_check CHECK (decision IN ('approve','hold','block','revoke','manual_review','seed_state')),
  CONSTRAINT lead_contact_release_events_allowed_fields_check CHECK (allowed_contact_fields <@ ARRAY['first_name','last_name','phone','email','city','county']::text[])
);

CREATE INDEX IF NOT EXISTS idx_lcre_assignment ON public.lead_contact_release_events(lead_assignment_id);
CREATE INDEX IF NOT EXISTS idx_lcre_release ON public.lead_contact_release_events(release_id);
CREATE INDEX IF NOT EXISTS idx_lcre_contractor_account ON public.lead_contact_release_events(contractor_account_id);

ALTER TABLE public.lead_contact_release_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_contact_release_events_select_internal ON public.lead_contact_release_events;
CREATE POLICY lead_contact_release_events_select_internal
ON public.lead_contact_release_events
FOR SELECT
TO authenticated
USING (is_internal_operator());

DROP POLICY IF EXISTS lead_contact_release_events_select_own_contractor ON public.lead_contact_release_events;
CREATE POLICY lead_contact_release_events_select_own_contractor
ON public.lead_contact_release_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.contractor_accounts ca
    WHERE ca.id = lead_contact_release_events.contractor_account_id
      AND ca.auth_user_id = auth.uid()
      AND ca.is_active = true
      AND ca.access_status = 'active'
  )
);

DROP POLICY IF EXISTS lead_contact_release_events_insert_internal ON public.lead_contact_release_events;
CREATE POLICY lead_contact_release_events_insert_internal
ON public.lead_contact_release_events
FOR INSERT
TO authenticated
WITH CHECK (is_internal_operator());

DROP POLICY IF EXISTS lead_contact_release_events_service_role_all ON public.lead_contact_release_events;
CREATE POLICY lead_contact_release_events_service_role_all
ON public.lead_contact_release_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.lead_contact_releases IS 'Controlled contractor contact release decisions for assigned leads. No quote files or raw report data.';
COMMENT ON TABLE public.lead_contact_release_events IS 'Append-only audit trail for lead contact release decisions.';

CREATE OR REPLACE FUNCTION public.get_contractor_released_contact(_lead_assignment_id uuid)
RETURNS TABLE(
  release_status text,
  allowed_contact_fields text[],
  first_name text,
  last_name text,
  phone text,
  email text,
  city text,
  county text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lcr.release_status,
    lcr.allowed_contact_fields,
    CASE WHEN 'first_name' = ANY(lcr.allowed_contact_fields) THEN l.first_name ELSE NULL END AS first_name,
    CASE WHEN 'last_name' = ANY(lcr.allowed_contact_fields) THEN l.last_name ELSE NULL END AS last_name,
    CASE WHEN 'phone' = ANY(lcr.allowed_contact_fields) THEN l.phone_e164 ELSE NULL END AS phone,
    CASE WHEN 'email' = ANY(lcr.allowed_contact_fields) THEN l.email ELSE NULL END AS email,
    CASE WHEN 'city' = ANY(lcr.allowed_contact_fields) THEN l.city ELSE NULL END AS city,
    CASE WHEN 'county' = ANY(lcr.allowed_contact_fields) THEN l.county ELSE NULL END AS county
  FROM public.lead_assignments la
  JOIN public.contractor_accounts ca ON ca.id = la.contractor_account_id
  JOIN public.lead_contact_releases lcr
    ON lcr.lead_assignment_id = la.id
   AND lcr.contractor_account_id = ca.id
   AND lcr.client_slug = la.client_slug
  LEFT JOIN public.leads l ON l.id = la.lead_id AND l.client_slug = la.client_slug
  WHERE la.id = _lead_assignment_id
    AND ca.auth_user_id = auth.uid()
    AND ca.is_active = true
    AND ca.access_status = 'active'
    AND lcr.release_status = 'approved'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_contractor_released_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contractor_released_contact(uuid) TO authenticated;
