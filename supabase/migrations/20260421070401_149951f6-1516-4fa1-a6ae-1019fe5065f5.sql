-- ═══════════════════════════════════════════════════════════════════════════
-- Sprint 2 — Contractor ↔ Client Bridge Table
-- ═══════════════════════════════════════════════════════════════════════════
-- Canonical source of truth for "which contractor is authorized to receive
-- leads for which paying tenant (client)". This is the foundation for
-- multi-tenant lead routing.
--
-- Per the spec: NO speculative backfill. Audit shows 1 active client + 2
-- active contractors → no unambiguous 1:1 match. Operators must assign.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Bridge table
CREATE TABLE public.contractor_client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  is_primary boolean NOT NULL DEFAULT false,
  receives_leads boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  dispatch_method text NOT NULL DEFAULT 'webhook',
  crm_webhook_url text NULL,
  crm_email text NULL,
  notes text NULL,
  CONSTRAINT contractor_client_assignments_unique_pair
    UNIQUE (client_id, contractor_id),
  CONSTRAINT contractor_client_assignments_status_check
    CHECK (status IN ('active', 'paused', 'archived')),
  CONSTRAINT contractor_client_assignments_dispatch_check
    CHECK (dispatch_method IN ('webhook', 'email', 'manual', 'none'))
);

COMMENT ON TABLE public.contractor_client_assignments IS
  'Sprint 2 bridge: maps paying tenants (clients) to operating contractors. '
  'A contractor may serve multiple clients; a client may dispatch to multiple '
  'contractors. Resolver path: lead.client_slug → clients.id → active '
  'contractor_client_assignments rows where receives_leads = true.';

-- 2. Safe indexes
CREATE INDEX idx_cca_client_id        ON public.contractor_client_assignments (client_id);
CREATE INDEX idx_cca_contractor_id    ON public.contractor_client_assignments (contractor_id);
CREATE INDEX idx_cca_status           ON public.contractor_client_assignments (status);
CREATE INDEX idx_cca_receives_leads   ON public.contractor_client_assignments (receives_leads);
CREATE INDEX idx_cca_is_primary       ON public.contractor_client_assignments (is_primary);
CREATE INDEX idx_cca_priority         ON public.contractor_client_assignments (priority);

-- Composite index for the canonical dispatch query path:
-- "give me active receivers for this client, ordered by priority desc"
CREATE INDEX idx_cca_dispatch_lookup
  ON public.contractor_client_assignments (client_id, status, receives_leads, priority DESC);

-- Only one primary per client (when is_primary = true)
CREATE UNIQUE INDEX idx_cca_one_primary_per_client
  ON public.contractor_client_assignments (client_id)
  WHERE is_primary = true;

-- 3. updated_at trigger (uses existing public.set_updated_at())
CREATE TRIGGER trg_cca_set_updated_at
  BEFORE UPDATE ON public.contractor_client_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. RLS
ALTER TABLE public.contractor_client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY cca_service_role_all
  ON public.contractor_client_assignments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY cca_select_internal
  ON public.contractor_client_assignments
  FOR SELECT
  TO authenticated
  USING (public.is_internal_operator());

CREATE POLICY cca_insert_internal
  ON public.contractor_client_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_operator());

CREATE POLICY cca_update_internal
  ON public.contractor_client_assignments
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_operator())
  WITH CHECK (public.is_internal_operator());

CREATE POLICY cca_delete_internal
  ON public.contractor_client_assignments
  FOR DELETE
  TO authenticated
  USING (public.is_internal_operator());

-- Contractor self-read: a contractor can see their own assignment rows.
-- This lets the partner portal show "you are dispatched for these clients"
-- without exposing other contractors' assignments.
CREATE POLICY cca_contractor_select_own
  ON public.contractor_client_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contractors c
      WHERE c.id = contractor_client_assignments.contractor_id
        AND c.auth_user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Canonical resolver: lead.client_slug → active receivers
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.resolve_contractors_for_client_slug(p_client_slug text)
RETURNS TABLE (
  assignment_id    uuid,
  client_id        uuid,
  client_slug      text,
  client_name      text,
  contractor_id    uuid,
  company_name     text,
  is_primary       boolean,
  priority         integer,
  dispatch_method  text,
  crm_webhook_url  text,
  crm_email        text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id              AS assignment_id,
    c.id              AS client_id,
    c.slug            AS client_slug,
    c.name            AS client_name,
    ct.id             AS contractor_id,
    ct.company_name,
    a.is_primary,
    a.priority,
    a.dispatch_method,
    a.crm_webhook_url,
    a.crm_email
  FROM public.contractor_client_assignments a
  JOIN public.clients     c  ON c.id  = a.client_id
  JOIN public.contractors ct ON ct.id = a.contractor_id
  WHERE c.slug             = p_client_slug
    AND a.status           = 'active'
    AND a.receives_leads   = true
    AND ct.status          = 'active'
  ORDER BY a.is_primary DESC, a.priority DESC, a.created_at ASC;
$$;

COMMENT ON FUNCTION public.resolve_contractors_for_client_slug(text) IS
  'Sprint 2 canonical resolver. Given a lead.client_slug, returns the ordered '
  'list of active contractors authorized to receive that lead. Ordering: '
  'primary first, then priority DESC, then assignment age. SECURITY DEFINER '
  'so it can resolve the inactive ''direct'' sentinel client cleanly.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Admin debug views (security_invoker so they honor caller RLS)
-- ═══════════════════════════════════════════════════════════════════════════

-- a) Active assignments by client
CREATE OR REPLACE VIEW public.v_admin_assignments_by_client
WITH (security_invoker = true) AS
SELECT
  c.id                                  AS client_id,
  c.slug                                AS client_slug,
  c.name                                AS client_name,
  c.is_active                           AS client_is_active,
  count(a.id) FILTER (WHERE a.status = 'active' AND a.receives_leads)
                                        AS active_receivers,
  count(a.id)                           AS total_assignments,
  bool_or(a.is_primary AND a.status = 'active')
                                        AS has_primary,
  jsonb_agg(
    jsonb_build_object(
      'assignment_id',   a.id,
      'contractor_id',   ct.id,
      'company_name',    ct.company_name,
      'status',          a.status,
      'is_primary',      a.is_primary,
      'receives_leads',  a.receives_leads,
      'priority',        a.priority,
      'dispatch_method', a.dispatch_method
    )
    ORDER BY a.is_primary DESC, a.priority DESC
  ) FILTER (WHERE a.id IS NOT NULL)     AS assignments
FROM public.clients c
LEFT JOIN public.contractor_client_assignments a ON a.client_id = c.id
LEFT JOIN public.contractors ct                  ON ct.id = a.contractor_id
GROUP BY c.id, c.slug, c.name, c.is_active
ORDER BY c.is_active DESC, c.slug;

-- b) Active assignments by contractor
CREATE OR REPLACE VIEW public.v_admin_assignments_by_contractor
WITH (security_invoker = true) AS
SELECT
  ct.id                                 AS contractor_id,
  ct.company_name,
  ct.status                             AS contractor_status,
  ct.is_vetted,
  count(a.id) FILTER (WHERE a.status = 'active' AND a.receives_leads)
                                        AS active_client_count,
  count(a.id)                           AS total_assignments,
  jsonb_agg(
    jsonb_build_object(
      'assignment_id',   a.id,
      'client_id',       c.id,
      'client_slug',     c.slug,
      'client_name',     c.name,
      'status',          a.status,
      'is_primary',      a.is_primary,
      'receives_leads',  a.receives_leads,
      'priority',        a.priority,
      'dispatch_method', a.dispatch_method
    )
    ORDER BY a.is_primary DESC, a.priority DESC
  ) FILTER (WHERE a.id IS NOT NULL)     AS assignments
FROM public.contractors ct
LEFT JOIN public.contractor_client_assignments a ON a.contractor_id = ct.id
LEFT JOIN public.clients c                       ON c.id = a.client_id
GROUP BY ct.id, ct.company_name, ct.status, ct.is_vetted
ORDER BY ct.status, ct.company_name;

-- c) Unassigned active clients (paying tenants with no active receiver)
CREATE OR REPLACE VIEW public.v_admin_unassigned_active_clients
WITH (security_invoker = true) AS
SELECT
  c.id                AS client_id,
  c.slug              AS client_slug,
  c.name              AS client_name,
  c.created_at,
  (
    SELECT count(*) FROM public.leads l
    WHERE l.client_slug = c.slug
  )                   AS lead_count
FROM public.clients c
WHERE c.is_active = true
  AND c.slug <> 'direct'
  AND NOT EXISTS (
    SELECT 1 FROM public.contractor_client_assignments a
    WHERE a.client_id       = c.id
      AND a.status          = 'active'
      AND a.receives_leads  = true
  )
ORDER BY c.created_at;

-- d) Active contractors with no active assignments
CREATE OR REPLACE VIEW public.v_admin_active_contractors_unassigned
WITH (security_invoker = true) AS
SELECT
  ct.id          AS contractor_id,
  ct.company_name,
  ct.is_vetted,
  ct.created_at,
  ct.email,
  ct.auth_user_id IS NOT NULL AS has_auth_user
FROM public.contractors ct
WHERE ct.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.contractor_client_assignments a
    WHERE a.contractor_id = ct.id
      AND a.status        = 'active'
  )
ORDER BY ct.is_vetted DESC, ct.created_at;