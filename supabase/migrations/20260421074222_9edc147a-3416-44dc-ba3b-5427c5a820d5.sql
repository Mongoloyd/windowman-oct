-- ============================================================================
-- Sprint 3 — Tenant Ownership Propagation
-- ============================================================================
-- DB-level guardrail: analyses and contractor_opportunities inherit
-- client_slug from their parent lead. Lead is the single source of truth.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Generic propagation function (shared by both triggers)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inherit_client_slug_from_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_slug text;
BEGIN
  -- No parent lead → nothing to propagate. Leave NEW.client_slug as-is
  -- (caller may have explicitly passed one for legacy/edge cases).
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT l.client_slug
    INTO v_lead_slug
  FROM public.leads l
  WHERE l.id = NEW.lead_id;

  -- Parent lead has no slug → respect that (do not invent ownership).
  IF v_lead_slug IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lead is the source of truth. Always inherit. If the caller passed
  -- a different slug, the lead's slug wins. This is intentional —
  -- it prevents downstream writers from minting fake tenant ownership.
  NEW.client_slug := v_lead_slug;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.inherit_client_slug_from_lead() IS
'Sprint 3: Propagates client_slug from leads to downstream rows
(analyses, contractor_opportunities). Lead is source of truth.';

-- ---------------------------------------------------------------------------
-- 2. Trigger on public.analyses
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_analyses_inherit_client_slug ON public.analyses;

CREATE TRIGGER trg_analyses_inherit_client_slug
BEFORE INSERT OR UPDATE OF lead_id, client_slug ON public.analyses
FOR EACH ROW
EXECUTE FUNCTION public.inherit_client_slug_from_lead();

-- ---------------------------------------------------------------------------
-- 3. Trigger on public.contractor_opportunities
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_opps_inherit_client_slug ON public.contractor_opportunities;

CREATE TRIGGER trg_opps_inherit_client_slug
BEFORE INSERT OR UPDATE OF lead_id, client_slug ON public.contractor_opportunities
FOR EACH ROW
EXECUTE FUNCTION public.inherit_client_slug_from_lead();

-- ---------------------------------------------------------------------------
-- 4. Backfill — safe, idempotent, no data loss
-- ---------------------------------------------------------------------------
-- Only touches rows where parent lead has a slug AND child slug is null.
-- (No-op for rows where lead has no slug — those stay null on purpose.)

UPDATE public.analyses a
SET client_slug = l.client_slug
FROM public.leads l
WHERE a.lead_id        = l.id
  AND a.client_slug    IS NULL
  AND l.client_slug    IS NOT NULL;

UPDATE public.contractor_opportunities o
SET client_slug = l.client_slug
FROM public.leads l
WHERE o.lead_id        = l.id
  AND o.client_slug    IS NULL
  AND l.client_slug    IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Admin debug views (security_invoker so RLS still applies on base tables)
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS public.v_admin_analyses_slug_mismatch CASCADE;
CREATE VIEW public.v_admin_analyses_slug_mismatch
WITH (security_invoker = true) AS
SELECT
  a.id              AS analysis_id,
  a.lead_id,
  a.client_slug     AS analysis_slug,
  l.client_slug     AS lead_slug,
  a.created_at
FROM public.analyses a
JOIN public.leads    l ON l.id = a.lead_id
WHERE a.client_slug IS DISTINCT FROM l.client_slug
ORDER BY a.created_at DESC;

COMMENT ON VIEW public.v_admin_analyses_slug_mismatch IS
'Sprint 3: analyses whose client_slug does not match their parent lead. Should always be empty.';

DROP VIEW IF EXISTS public.v_admin_opportunities_slug_mismatch CASCADE;
CREATE VIEW public.v_admin_opportunities_slug_mismatch
WITH (security_invoker = true) AS
SELECT
  o.id              AS opportunity_id,
  o.lead_id,
  o.client_slug     AS opportunity_slug,
  l.client_slug     AS lead_slug,
  o.created_at
FROM public.contractor_opportunities o
JOIN public.leads                    l ON l.id = o.lead_id
WHERE o.client_slug IS DISTINCT FROM l.client_slug
ORDER BY o.created_at DESC;

COMMENT ON VIEW public.v_admin_opportunities_slug_mismatch IS
'Sprint 3: opportunities whose client_slug does not match their parent lead. Should always be empty.';

DROP VIEW IF EXISTS public.v_admin_slug_backfill_pending CASCADE;
CREATE VIEW public.v_admin_slug_backfill_pending
WITH (security_invoker = true) AS
SELECT 'analyses'::text AS table_name, COUNT(*)::bigint AS pending_count
FROM public.analyses a
JOIN public.leads    l ON l.id = a.lead_id
WHERE a.client_slug IS NULL AND l.client_slug IS NOT NULL
UNION ALL
SELECT 'contractor_opportunities'::text, COUNT(*)::bigint
FROM public.contractor_opportunities o
JOIN public.leads                    l ON l.id = o.lead_id
WHERE o.client_slug IS NULL AND l.client_slug IS NOT NULL;

COMMENT ON VIEW public.v_admin_slug_backfill_pending IS
'Sprint 3: rows still missing client_slug despite parent lead having one. Should always be 0/0 once triggers are live.';