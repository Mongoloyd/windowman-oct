
-- Recreate Sprint 1 debug views with explicit security_invoker so they
-- honor the caller's RLS context (not the view-owner's permissions).
-- This resolves linter rule 0010 (Security Definer View).

DROP VIEW IF EXISTS public.v_admin_leads_unknown_slug;
DROP VIEW IF EXISTS public.v_admin_active_clients;
DROP VIEW IF EXISTS public.v_admin_webhook_health_7d;
DROP VIEW IF EXISTS public.v_admin_leads_direct_sentinel;

CREATE VIEW public.v_admin_leads_unknown_slug
WITH (security_invoker = true) AS
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

CREATE VIEW public.v_admin_active_clients
WITH (security_invoker = true) AS
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

CREATE VIEW public.v_admin_webhook_health_7d
WITH (security_invoker = true) AS
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

CREATE VIEW public.v_admin_leads_direct_sentinel
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', l.created_at)::date AS day,
  count(*)                              AS direct_lead_count,
  count(*) FILTER (WHERE l.phone_verified = true) AS verified_count
FROM public.leads l
WHERE l.client_slug = 'direct'
GROUP BY date_trunc('day', l.created_at)::date
ORDER BY day DESC
LIMIT 30;
