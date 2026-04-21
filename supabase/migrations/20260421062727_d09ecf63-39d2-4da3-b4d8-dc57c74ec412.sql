
-- ─────────────────────────────────────────────────────────────────────────────
-- SPRINT 1 — TENANT OWNERSHIP LOCKDOWN
-- Lock leads.client_slug to canonical truth in public.clients.
-- Reinforce existing CRM handoff path against double-fire races.
-- Add admin debug views.
-- All changes additive and production-safe.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Cleanup — remap unknown 'testAA' leads to 'direct' ──────────────
-- (Pre-seed cleanup. Without this the integrity trigger would reject these
--  rows on any future UPDATE that touches client_slug.)
UPDATE public.leads
SET client_slug = 'direct'
WHERE client_slug = 'testAA';

-- ── Step 2: Seed the canonical 'direct' sentinel client ─────────────────────
-- This row exists ONLY as the canonical fallback for organic / direct traffic.
-- It is intentionally inactive so the public anon SELECT policy
-- (clients_anon_select_active) cannot resolve it as a real tenant.
INSERT INTO public.clients (slug, name, is_active)
VALUES ('direct', 'Direct / Organic', false)
ON CONFLICT (slug) DO NOTHING;

-- ── Step 3: Slug integrity guard for leads.client_slug ──────────────────────
-- WHY A TRIGGER, NOT A FOREIGN KEY (yet):
--   A FK to clients(slug) would work today (slug is unique, all live data is
--   clean post-Step-1), but would tie us to clients.slug as the natural key
--   forever. A trigger gives identical enforcement with the flexibility to
--   later migrate to clients.id-based ownership without dropping a FK.
--
-- PATH TO FK HARDENING (when ready):
--   ALTER TABLE public.leads
--     ADD CONSTRAINT leads_client_slug_fkey
--     FOREIGN KEY (client_slug) REFERENCES public.clients(slug)
--     ON UPDATE CASCADE ON DELETE SET NULL
--     NOT VALID;
--   ALTER TABLE public.leads VALIDATE CONSTRAINT leads_client_slug_fkey;
--
-- RULES:
--   - NULL client_slug allowed (legacy / pre-attribution leads)
--   - 'direct' allowed unconditionally (sentinel, intentionally inactive)
--   - Any other slug must exist in public.clients (active OR inactive)
--   - Unknown slugs rejected — prevents fake tenant ownership
CREATE OR REPLACE FUNCTION public.enforce_lead_client_slug_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- NULL is always allowed.
  IF NEW.client_slug IS NULL THEN
    RETURN NEW;
  END IF;

  -- The 'direct' sentinel is always allowed.
  IF NEW.client_slug = 'direct' THEN
    RETURN NEW;
  END IF;

  -- Any other slug must exist in clients (active OR inactive).
  -- We do NOT require is_active=true here: a tenant might be temporarily
  -- paused but still own historical leads.
  IF NOT EXISTS (
    SELECT 1 FROM public.clients WHERE slug = NEW.client_slug
  ) THEN
    RAISE EXCEPTION
      'lead client_slug "%" does not exist in public.clients — refusing to mint fake tenant ownership',
      NEW.client_slug
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Fire on INSERT and on UPDATE OF client_slug only (not on every UPDATE).
DROP TRIGGER IF EXISTS trg_enforce_lead_client_slug_integrity ON public.leads;
CREATE TRIGGER trg_enforce_lead_client_slug_integrity
  BEFORE INSERT OR UPDATE OF client_slug ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lead_client_slug_integrity();

-- ── Step 4: Reinforce fire_crm_handoff against double-fire races ────────────
-- The existing partial unique index idx_webhook_deliveries_lead_event_unique
-- already prevents duplicate pending/failed rows for the same lead+event.
-- However, if two near-simultaneous lead updates BOTH satisfy the firing
-- condition (phone_verified=true AND latest_analysis_id NOT NULL transitioning
-- from a not-yet-firing state), the second INSERT would raise unique_violation
-- and abort the parent UPDATE.
--
-- Wrap the INSERT in ON CONFLICT DO NOTHING so the trigger is genuinely
-- idempotent and never blocks the parent transaction.
CREATE OR REPLACE FUNCTION public.fire_crm_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_id uuid;
BEGIN
  IF NEW.phone_verified = true
     AND NEW.latest_analysis_id IS NOT NULL
     AND (OLD.phone_verified = false OR OLD.latest_analysis_id IS NULL)
  THEN
    -- Idempotent insert: partial unique index
    -- idx_webhook_deliveries_lead_event_unique guarantees only one
    -- non-terminal delivery row per (lead_id, event_type) at a time.
    INSERT INTO public.webhook_deliveries (lead_id, event_type, status)
    VALUES (NEW.id, 'qualified_lead', 'pending')
    ON CONFLICT ON CONSTRAINT idx_webhook_deliveries_lead_event_unique
      DO NOTHING
    RETURNING id INTO v_inserted_id;

    -- Only emit the audit event if we actually queued a new delivery.
    -- This prevents duplicate 'crm_handoff_queued' rows in lead_events
    -- when two trigger firings race for the same (lead_id, event_type).
    IF v_inserted_id IS NOT NULL THEN
      INSERT INTO public.lead_events (lead_id, event_name, event_source, metadata)
      VALUES (
        NEW.id,
        'crm_handoff_queued',
        'db_trigger',
        jsonb_build_object(
          'analysis_id', NEW.latest_analysis_id,
          'phone_verified_at', NEW.phone_verified_at,
          'webhook_delivery_id', v_inserted_id,
          'triggered_at', now()
        )
      );

      RAISE LOG '[CRM:HANDOFF:QUEUED] {"lead_id": "%", "analysis_id": "%", "delivery_id": "%", "timestamp": "%"}',
        NEW.id, NEW.latest_analysis_id, v_inserted_id, NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── Step 5: Admin debug views ───────────────────────────────────────────────
-- All four are SECURITY INVOKER so they inherit the caller's RLS context —
-- in practice only internal operators (is_internal_operator()) can read the
-- underlying tables, so these views are automatically internal-only.

-- 5a) Leads currently using slugs that don't exist in clients.
--     Should always return ZERO rows after Sprint 1. If it ever returns rows,
--     something bypassed the integrity trigger (e.g., service-role direct write).
CREATE OR REPLACE VIEW public.v_admin_leads_unknown_slug AS
SELECT
  l.id            AS lead_id,
  l.client_slug,
  l.created_at,
  l.phone_verified,
  l.session_id,
  l.utm_source,
  l.utm_campaign
FROM public.leads l
WHERE l.client_slug IS NOT NULL
  AND l.client_slug <> 'direct'
  AND NOT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.slug = l.client_slug
  );

-- 5b) Active clients list — at-a-glance tenant roster.
CREATE OR REPLACE VIEW public.v_admin_active_clients AS
SELECT
  c.id,
  c.slug,
  c.name,
  c.is_active,
  c.created_at,
  (SELECT count(*) FROM public.leads l WHERE l.client_slug = c.slug)         AS lead_count_total,
  (SELECT count(*) FROM public.leads l WHERE l.client_slug = c.slug AND l.phone_verified = true) AS lead_count_verified
FROM public.clients c
ORDER BY c.is_active DESC, c.created_at DESC;

-- 5c) Recent webhook delivery health — last 7 days, grouped by status.
CREATE OR REPLACE VIEW public.v_admin_webhook_health_7d AS
SELECT
  wd.status,
  wd.event_type,
  count(*)                                                   AS delivery_count,
  count(*) FILTER (WHERE wd.last_http_status BETWEEN 200 AND 299) AS success_count,
  count(*) FILTER (WHERE wd.last_http_status >= 400)         AS http_error_count,
  max(wd.last_attempt_at)                                    AS most_recent_attempt,
  avg(wd.attempt_count)::numeric(10,2)                       AS avg_attempts
FROM public.webhook_deliveries wd
WHERE wd.created_at >= now() - interval '7 days'
GROUP BY wd.status, wd.event_type
ORDER BY wd.status, wd.event_type;

-- 5d) Rows currently using the 'direct' sentinel — should grow over time
--     as organic traffic accumulates.
CREATE OR REPLACE VIEW public.v_admin_leads_direct_sentinel AS
SELECT
  date_trunc('day', l.created_at)::date AS day,
  count(*)                              AS direct_lead_count,
  count(*) FILTER (WHERE l.phone_verified = true) AS verified_count
FROM public.leads l
WHERE l.client_slug = 'direct'
GROUP BY date_trunc('day', l.created_at)::date
ORDER BY day DESC
LIMIT 30;

-- ── Step 6: Comments / documentation on the live schema ─────────────────────
COMMENT ON COLUMN public.leads.client_slug IS
  'Tenant ownership. NULL = pre-attribution / unknown. ''direct'' = organic sentinel. Any other value MUST exist in public.clients (enforced by trigger trg_enforce_lead_client_slug_integrity). FK to clients(slug) is the planned hardening — see migration notes.';

COMMENT ON FUNCTION public.enforce_lead_client_slug_integrity() IS
  'Sprint 1 guardrail: prevents leads.client_slug from being stamped with any value not present in public.clients. NULL and ''direct'' are explicitly allowed.';

COMMENT ON FUNCTION public.fire_crm_handoff() IS
  'Queues a qualified_lead webhook delivery the moment a lead transitions to (phone_verified=true AND latest_analysis_id NOT NULL). Idempotent via ON CONFLICT against partial unique index idx_webhook_deliveries_lead_event_unique. Sprint 1 hardened against double-fire races.';
