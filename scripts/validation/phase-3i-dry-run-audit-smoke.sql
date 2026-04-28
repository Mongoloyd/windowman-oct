-- Phase 3I-D dry-run audit smoke checks
-- Read-only unless the final admin_sync_revenue_signals(..., true) call is executed by an authenticated internal operator/service role.
-- Do not change p_dry_run to false.

select
  to_regclass('public.revenue_signal_dry_run_audits') as revenue_signal_dry_run_audits,
  to_regprocedure('public.admin_sync_revenue_signals(integer, boolean)') as admin_sync_revenue_signals,
  to_regprocedure('public.admin_revenue_signal_eligibility()') as admin_revenue_signal_eligibility,
  to_regprocedure('public.revenue_lifecycle_signal_key(text, uuid, uuid, uuid, uuid, uuid, uuid, text)') as revenue_lifecycle_signal_key,
  to_regprocedure('public.revenue_lifecycle_signal_key_from_metadata(jsonb)') as revenue_lifecycle_signal_key_from_metadata,
  to_regclass('public.platform_dispatch_outbox') as platform_dispatch_outbox,
  to_regclass('public.platform_dispatch_attempts') as platform_dispatch_attempts,
  to_regclass('public.dispatch_attempts') as dispatch_attempts,
  to_regclass('public.dispatch_dead_letters') as dispatch_dead_letters;

select
  (select count(*) from public.event_logs where event_name ~* '(sold|purchase)' or metadata::text ~* 'sold_closed') as sold_event_logs,
  (select count(*) from public.revenue_signal_dry_run_audits) as dry_run_audits,
  (select count(*) from public.platform_dispatch_outbox) as platform_dispatch_outbox,
  (select count(*) from public.platform_dispatch_attempts) as platform_dispatch_attempts;

-- Requires internal operator/service role. Expected to persist one audit row and no dispatch/event rows.
-- select public.admin_sync_revenue_signals(100, true);

select
  run_id,
  dry_run,
  candidate_count,
  would_insert,
  inserted,
  blocked,
  duplicate_protected,
  weak_lifecycle_key,
  lifecycle_duplicate_claim,
  duplicate_revenue_signal_key,
  by_client_slug,
  by_reason_code,
  by_key_basis,
  external_dispatch,
  dispatch_created,
  created_at
from public.revenue_signal_dry_run_audits
order by created_at desc
limit 1;
