-- Phase 3J — Tenant Isolation / RLS Smoke Test
-- Validation-only. Intended for a non-production SQL session or a transaction that can be rolled back.
-- This script performs read-only probes except SET ROLE / RESET ROLE and does not mutate tenant records.

BEGIN;

-- Object presence: required Phase 3C/3D/3E/3F/3I tables and RPCs.
SELECT
  to_regclass('public.syndicates') AS syndicates,
  to_regclass('public.syndicate_clients') AS syndicate_clients,
  to_regclass('public.contractor_accounts') AS contractor_accounts,
  to_regclass('public.lead_assignments') AS lead_assignments,
  to_regclass('public.lead_routing_events') AS lead_routing_events,
  to_regclass('public.contractor_outcomes') AS contractor_outcomes,
  to_regclass('public.event_logs') AS event_logs,
  to_regclass('public.revenue_signal_dry_run_audits') AS revenue_signal_dry_run_audits,
  to_regprocedure('public.admin_route_lead_assignment(text,uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,jsonb)') AS admin_route_lead_assignment,
  to_regprocedure('public.admin_revenue_signal_eligibility()') AS admin_revenue_signal_eligibility,
  to_regprocedure('public.admin_sync_revenue_signals(integer,boolean)') AS admin_sync_revenue_signals;

-- RLS posture and policies for protected control-plane tables.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  p.polname AS policy_name,
  p.polcmd AS command,
  pg_get_expr(p.polqual, p.polrelid) AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relname IN (
    'syndicates',
    'syndicate_clients',
    'contractor_accounts',
    'lead_assignments',
    'lead_routing_events',
    'contractor_outcomes',
    'event_logs',
    'revenue_signal_dry_run_audits'
  )
ORDER BY c.relname, p.polname;

-- Function execute grants. A broad EXECUTE grant is not sufficient for data access if the function body fails closed,
-- but it should be reviewed before real contractor access.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  grantee.rolname AS grantee,
  has_function_privilege(grantee.rolname, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS grantee(rolname)
WHERE n.nspname = 'public'
  AND p.proname IN (
    'admin_route_lead_assignment',
    'admin_revenue_signal_eligibility',
    'admin_sync_revenue_signals'
  )
ORDER BY p.proname, grantee.rolname;

-- Runtime anon probes for direct table reads. Expected: protected tables return permission-denied or zero rows.
-- event_logs has anon INSERT only; SELECT should return zero rows due no SELECT policy.
SET LOCAL ROLE anon;
SELECT 'syndicates' AS table_name, count(*) AS visible_rows FROM public.syndicates;
SELECT 'syndicate_clients' AS table_name, count(*) AS visible_rows FROM public.syndicate_clients;
SELECT 'contractor_accounts' AS table_name, count(*) AS visible_rows FROM public.contractor_accounts;
SELECT 'lead_assignments' AS table_name, count(*) AS visible_rows FROM public.lead_assignments;
SELECT 'lead_routing_events' AS table_name, count(*) AS visible_rows FROM public.lead_routing_events;
SELECT 'contractor_outcomes' AS table_name, count(*) AS visible_rows FROM public.contractor_outcomes;
SELECT 'event_logs' AS table_name, count(*) AS visible_rows FROM public.event_logs;
SELECT 'revenue_signal_dry_run_audits' AS table_name, count(*) AS visible_rows FROM public.revenue_signal_dry_run_audits;
RESET ROLE;

-- Integrity snapshots. These do not mutate data.
SELECT
  count(*) FILTER (WHERE client_slug IS NULL OR btrim(client_slug) = '') AS outcomes_missing_client_slug,
  count(*) FILTER (WHERE disposition_state = 'sold_closed' AND coalesce(final_value_cents, 0) <= 0) AS sold_invalid_value,
  count(*) FILTER (WHERE disposition_state = 'sold_closed' AND (value_basis IS NULL OR value_basis = 'unknown')) AS sold_missing_or_unknown_basis,
  count(*) FILTER (WHERE disposition_state = 'lost_dead' AND (disposition_reason_code IS NULL OR btrim(coalesce(outcome_notes, '')) = '')) AS lost_missing_reason,
  count(*) FILTER (WHERE outcome_integrity_status IN ('blocked', 'needs_review')) AS blocked_or_review_outcomes,
  count(*) AS total_outcomes
FROM public.contractor_outcomes;

-- Revenue eligibility is read-only and fail-closed for non-internal actors.
SELECT count(*) AS eligible_revenue_signal_rows FROM public.admin_revenue_signal_eligibility();
SELECT public.admin_sync_revenue_signals(1, true) AS dry_run_one_candidate;

ROLLBACK;
