-- ═══════════════════════════════════════════════════════════════════════════
-- Sprint 4 — Deterministic Routing Resolver (mapping only, no delivery)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Single-route resolver for a lead ─────────────────────────────────
-- Returns exactly ONE row (chosen receiver OR explicit no_route_reason).
-- Order of preference:
--   1) is_primary = true
--   2) lowest priority number (ASC)
--   3) oldest created_at (ASC) — deterministic tie-break
--
-- Validates destination: webhook needs crm_webhook_url, email needs crm_email.
-- If the chosen assignment is missing its destination, returns
-- no_route_reason='assignment_missing_destination' rather than a half-route.
--
-- NOTE: spec uses "lowest priority number" as preference. Sprint 2's
-- resolve_contractors_for_client_slug used DESC; Sprint 4 spec is explicit
-- ASC. Both functions coexist — the multi-row Sprint 2 helper keeps DESC
-- for backward compatibility with any caller already wired to it; the new
-- single-route Sprint 4 function uses ASC per this sprint's contract.

CREATE OR REPLACE FUNCTION public.resolve_route_for_lead(p_lead_id uuid)
RETURNS TABLE (
  lead_id              uuid,
  client_slug          text,
  client_id            uuid,
  client_name          text,
  assignment_id        uuid,
  contractor_id        uuid,
  company_name         text,
  is_primary           boolean,
  priority             integer,
  dispatch_method      text,
  crm_webhook_url      text,
  crm_email            text,
  resolved             boolean,
  no_route_reason      text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead          public.leads%ROWTYPE;
  v_client        public.clients%ROWTYPE;
  v_chosen        record;
  v_dest_ok       boolean;
BEGIN
  -- 1. Lead exists?
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      p_lead_id, NULL::text, NULL::uuid, NULL::text,
      NULL::uuid, NULL::uuid, NULL::text,
      NULL::boolean, NULL::integer,
      NULL::text, NULL::text, NULL::text,
      false, 'lead_not_found'::text;
    RETURN;
  END IF;

  -- 2. Lead has a slug?
  IF v_lead.client_slug IS NULL THEN
    RETURN QUERY SELECT
      p_lead_id, NULL::text, NULL::uuid, NULL::text,
      NULL::uuid, NULL::uuid, NULL::text,
      NULL::boolean, NULL::integer,
      NULL::text, NULL::text, NULL::text,
      false, 'lead_has_no_slug'::text;
    RETURN;
  END IF;

  -- 3. Slug exists in clients table?
  SELECT * INTO v_client FROM public.clients WHERE slug = v_lead.client_slug;
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      p_lead_id, v_lead.client_slug, NULL::uuid, NULL::text,
      NULL::uuid, NULL::uuid, NULL::text,
      NULL::boolean, NULL::integer,
      NULL::text, NULL::text, NULL::text,
      false, 'slug_not_in_clients'::text;
    RETURN;
  END IF;

  -- 4. Client is active?
  IF v_client.is_active = false THEN
    RETURN QUERY SELECT
      p_lead_id, v_client.slug, v_client.id, v_client.name,
      NULL::uuid, NULL::uuid, NULL::text,
      NULL::boolean, NULL::integer,
      NULL::text, NULL::text, NULL::text,
      false, 'client_inactive'::text;
    RETURN;
  END IF;

  -- 5. Pick the single best active assignment.
  SELECT
    a.id              AS assignment_id,
    ct.id             AS contractor_id,
    ct.company_name,
    a.is_primary,
    a.priority,
    a.dispatch_method,
    a.crm_webhook_url,
    a.crm_email
  INTO v_chosen
  FROM public.contractor_client_assignments a
  JOIN public.contractors ct ON ct.id = a.contractor_id
  WHERE a.client_id        = v_client.id
    AND a.status           = 'active'
    AND a.receives_leads   = true
    AND ct.status          = 'active'
  ORDER BY
    a.is_primary DESC,    -- primary first
    a.priority   ASC,     -- lowest priority number wins (Sprint 4 contract)
    a.created_at ASC      -- deterministic tie-break: oldest assignment
  LIMIT 1;

  IF v_chosen IS NULL THEN
    RETURN QUERY SELECT
      p_lead_id, v_client.slug, v_client.id, v_client.name,
      NULL::uuid, NULL::uuid, NULL::text,
      NULL::boolean, NULL::integer,
      NULL::text, NULL::text, NULL::text,
      false, 'no_active_assignment'::text;
    RETURN;
  END IF;

  -- 6. Validate destination matches dispatch_method.
  v_dest_ok := CASE v_chosen.dispatch_method
    WHEN 'webhook' THEN v_chosen.crm_webhook_url IS NOT NULL
    WHEN 'email'   THEN v_chosen.crm_email       IS NOT NULL
    WHEN 'manual'  THEN true   -- manual = operator handles it; no destination required
    WHEN 'none'    THEN true   -- explicit "do not deliver"
    ELSE false
  END;

  IF NOT v_dest_ok THEN
    RETURN QUERY SELECT
      p_lead_id, v_client.slug, v_client.id, v_client.name,
      v_chosen.assignment_id, v_chosen.contractor_id, v_chosen.company_name,
      v_chosen.is_primary, v_chosen.priority,
      v_chosen.dispatch_method, v_chosen.crm_webhook_url, v_chosen.crm_email,
      false, 'assignment_missing_destination'::text;
    RETURN;
  END IF;

  -- 7. Resolved.
  RETURN QUERY SELECT
    p_lead_id, v_client.slug, v_client.id, v_client.name,
    v_chosen.assignment_id, v_chosen.contractor_id, v_chosen.company_name,
    v_chosen.is_primary, v_chosen.priority,
    v_chosen.dispatch_method, v_chosen.crm_webhook_url, v_chosen.crm_email,
    true, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.resolve_route_for_lead(uuid) IS
'Sprint 4 deterministic single-route resolver. Returns exactly one row: the chosen contractor receiver for the lead, or a row with no_route_reason explaining why nothing routes. Read-only — no delivery side effects.';

-- ─── 2. Resolver-by-slug helper (operator convenience) ───────────────────
-- Same logic but starts from a slug instead of a lead_id.

CREATE OR REPLACE FUNCTION public.resolve_route_for_slug(p_client_slug text)
RETURNS TABLE (
  client_slug          text,
  client_id            uuid,
  client_name          text,
  assignment_id        uuid,
  contractor_id        uuid,
  company_name         text,
  is_primary           boolean,
  priority             integer,
  dispatch_method      text,
  crm_webhook_url      text,
  crm_email            text,
  resolved             boolean,
  no_route_reason      text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client        public.clients%ROWTYPE;
  v_chosen        record;
  v_dest_ok       boolean;
BEGIN
  IF p_client_slug IS NULL THEN
    RETURN QUERY SELECT
      NULL::text, NULL::uuid, NULL::text,
      NULL::uuid, NULL::uuid, NULL::text,
      NULL::boolean, NULL::integer,
      NULL::text, NULL::text, NULL::text,
      false, 'lead_has_no_slug'::text;
    RETURN;
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE slug = p_client_slug;
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      p_client_slug, NULL::uuid, NULL::text,
      NULL::uuid, NULL::uuid, NULL::text,
      NULL::boolean, NULL::integer,
      NULL::text, NULL::text, NULL::text,
      false, 'slug_not_in_clients'::text;
    RETURN;
  END IF;

  IF v_client.is_active = false THEN
    RETURN QUERY SELECT
      v_client.slug, v_client.id, v_client.name,
      NULL::uuid, NULL::uuid, NULL::text,
      NULL::boolean, NULL::integer,
      NULL::text, NULL::text, NULL::text,
      false, 'client_inactive'::text;
    RETURN;
  END IF;

  SELECT
    a.id, ct.id AS contractor_id, ct.company_name,
    a.is_primary, a.priority, a.dispatch_method,
    a.crm_webhook_url, a.crm_email
  INTO v_chosen
  FROM public.contractor_client_assignments a
  JOIN public.contractors ct ON ct.id = a.contractor_id
  WHERE a.client_id      = v_client.id
    AND a.status         = 'active'
    AND a.receives_leads = true
    AND ct.status        = 'active'
  ORDER BY a.is_primary DESC, a.priority ASC, a.created_at ASC
  LIMIT 1;

  IF v_chosen IS NULL THEN
    RETURN QUERY SELECT
      v_client.slug, v_client.id, v_client.name,
      NULL::uuid, NULL::uuid, NULL::text,
      NULL::boolean, NULL::integer,
      NULL::text, NULL::text, NULL::text,
      false, 'no_active_assignment'::text;
    RETURN;
  END IF;

  v_dest_ok := CASE v_chosen.dispatch_method
    WHEN 'webhook' THEN v_chosen.crm_webhook_url IS NOT NULL
    WHEN 'email'   THEN v_chosen.crm_email       IS NOT NULL
    WHEN 'manual'  THEN true
    WHEN 'none'    THEN true
    ELSE false
  END;

  IF NOT v_dest_ok THEN
    RETURN QUERY SELECT
      v_client.slug, v_client.id, v_client.name,
      v_chosen.id, v_chosen.contractor_id, v_chosen.company_name,
      v_chosen.is_primary, v_chosen.priority,
      v_chosen.dispatch_method, v_chosen.crm_webhook_url, v_chosen.crm_email,
      false, 'assignment_missing_destination'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_client.slug, v_client.id, v_client.name,
    v_chosen.id, v_chosen.contractor_id, v_chosen.company_name,
    v_chosen.is_primary, v_chosen.priority,
    v_chosen.dispatch_method, v_chosen.crm_webhook_url, v_chosen.crm_email,
    true, NULL::text;
END;
$$;

COMMENT ON FUNCTION public.resolve_route_for_slug(text) IS
'Sprint 4 slug-only resolver. Operator convenience for previewing routing for a given client_slug.';

-- ─── 3. Admin view: routing resolution per active client ─────────────────

CREATE OR REPLACE VIEW public.v_admin_routing_resolution
WITH (security_invoker = true) AS
SELECT
  c.id           AS client_id,
  c.slug         AS client_slug,
  c.name         AS client_name,
  c.is_active    AS client_is_active,
  r.assignment_id,
  r.contractor_id,
  r.company_name,
  r.is_primary,
  r.priority,
  r.dispatch_method,
  r.crm_webhook_url IS NOT NULL  AS has_webhook_url,
  r.crm_email       IS NOT NULL  AS has_crm_email,
  r.resolved,
  r.no_route_reason
FROM public.clients c
CROSS JOIN LATERAL public.resolve_route_for_slug(c.slug) r
ORDER BY c.is_active DESC, c.slug ASC;

COMMENT ON VIEW public.v_admin_routing_resolution IS
'Sprint 4: for every client, shows the deterministically chosen route (or unresolved reason).';

-- ─── 4. Admin view: leads with no active route ───────────────────────────
-- Surfaces operational gaps: verified leads whose slug yields no destination.

CREATE OR REPLACE VIEW public.v_admin_leads_unrouted
WITH (security_invoker = true) AS
SELECT
  l.id              AS lead_id,
  l.created_at,
  l.client_slug,
  l.phone_verified,
  l.latest_analysis_id,
  r.no_route_reason,
  r.client_id,
  r.client_name
FROM public.leads l
CROSS JOIN LATERAL public.resolve_route_for_lead(l.id) r
WHERE r.resolved = false
  AND l.phone_verified = true       -- only count verified leads as operational gaps
ORDER BY l.created_at DESC;

COMMENT ON VIEW public.v_admin_leads_unrouted IS
'Sprint 4: verified leads whose client_slug yields no active route. Each row carries no_route_reason.';

-- ─── 5. Admin view: legacy vs new routing coexistence audit ──────────────
-- Shows where the legacy fire_crm_handoff queue and the new resolver agree
-- or diverge. Sprint 4 does NOT change delivery — this view is the bridge
-- to plan Sprint 5's hard guard against double-fire.

CREATE OR REPLACE VIEW public.v_admin_legacy_vs_new_routing
WITH (security_invoker = true) AS
SELECT
  wd.id                    AS legacy_delivery_id,
  wd.lead_id,
  wd.event_type            AS legacy_event_type,
  wd.status                AS legacy_status,
  wd.created_at            AS legacy_created_at,
  l.client_slug,
  r.resolved               AS new_resolver_resolved,
  r.no_route_reason        AS new_resolver_reason,
  r.contractor_id          AS new_chosen_contractor_id,
  r.company_name           AS new_chosen_company,
  r.dispatch_method        AS new_dispatch_method,
  CASE
    WHEN r.resolved IS TRUE THEN 'BOTH_PATHS_ACTIVE'   -- Sprint 5 must dedupe
    WHEN r.resolved IS FALSE THEN 'LEGACY_ONLY'        -- new resolver has nothing
    ELSE 'UNKNOWN'
  END AS coexistence_state
FROM public.webhook_deliveries wd
JOIN public.leads l ON l.id = wd.lead_id
CROSS JOIN LATERAL public.resolve_route_for_lead(wd.lead_id) r
ORDER BY wd.created_at DESC;

COMMENT ON VIEW public.v_admin_legacy_vs_new_routing IS
'Sprint 4: audits coexistence between legacy webhook_deliveries and the new resolver. coexistence_state=BOTH_PATHS_ACTIVE flags rows that Sprint 5 must dedupe before delivery.';

-- ─── 6. Grants (RLS handles authorization on underlying tables) ──────────
GRANT EXECUTE ON FUNCTION public.resolve_route_for_lead(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_route_for_slug(text) TO authenticated, service_role;
GRANT SELECT ON public.v_admin_routing_resolution     TO authenticated, service_role;
GRANT SELECT ON public.v_admin_leads_unrouted         TO authenticated, service_role;
GRANT SELECT ON public.v_admin_legacy_vs_new_routing  TO authenticated, service_role;