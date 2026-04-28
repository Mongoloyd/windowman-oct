-- Phase 4C-B Lead Release Queue + Contractor Contact Panel Smoke Test
-- Non-destructive checklist. Do not claim runtime pass without authenticated two-contractor fixtures.

-- 1) Required schema/RPC objects.
select 'contractor_accounts' as object_name, to_regclass('public.contractor_accounts') is not null as exists
union all select 'lead_assignments', to_regclass('public.lead_assignments') is not null
union all select 'lead_routing_events', to_regclass('public.lead_routing_events') is not null
union all select 'lead_contact_releases', to_regclass('public.lead_contact_releases') is not null
union all select 'lead_contact_release_events', to_regclass('public.lead_contact_release_events') is not null
union all select 'get_contractor_released_contact', exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_contractor_released_contact'
    and pg_get_function_identity_arguments(p.oid) = '_lead_assignment_id uuid'
);

-- 2) RLS and policy posture for release tables.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  p.polname as policy_name,
  p.polcmd as command,
  pg_get_expr(p.polqual, p.polrelid) as using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expression
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relname in ('lead_contact_releases', 'lead_contact_release_events')
order by c.relname, p.polname;

-- Expected:
-- - RLS enabled on both release tables.
-- - No anon policies.
-- - Contractors can read only own release rows/events.
-- - Contractors cannot insert/update/delete release rows.
-- - Internal operators can create/update release decisions.

-- 3) Allow-list and uniqueness constraints.
select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.lead_contact_releases'::regclass, 'public.lead_contact_release_events'::regclass)
order by table_name, conname;

-- Expected:
-- - release_status limited to not_released/held/approved/revoked/blocked/manual_review.
-- - allowed_contact_fields limited to first_name/last_name/phone/email/city/county.
-- - lead_contact_releases unique on lead_assignment_id + contractor_account_id.

-- 4) RPC shape and grants.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  pg_get_function_result(p.oid) as result_shape
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_contractor_released_contact';

select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'get_contractor_released_contact'
order by grantee, privilege_type;

-- 5) Runtime fixture requirements before claiming pass:
-- - contractor_user_a JWT and contractor_user_b JWT.
-- - contractor_account_a.auth_user_id = contractor_user_a, active, client A.
-- - contractor_account_b.auth_user_id = contractor_user_b, active, client B or separate contractor account.
-- - assignment_a belongs to contractor_account_a.
-- - assignment_b belongs to contractor_account_b.
-- - approved release for assignment_a with a narrow allowed_contact_fields list.
-- - approved release for assignment_b.
-- - held, blocked, revoked, manual_review, and missing-release assignments.

-- Authenticated runtime expectations:
-- - anon cannot read lead_contact_releases or lead_contact_release_events.
-- - contractor A can read only own release row metadata through RLS.
-- - contractor A cannot read contractor B release rows.
-- - contractor cannot update release rows.
-- - internal operator can create/update release decision rows.
-- - internal operator decision appends lead_contact_release_events audit row.
-- - get_contractor_released_contact(assignment_a) as contractor A returns only allow-listed fields.
-- - get_contractor_released_contact(assignment_b) as contractor A returns zero rows.
-- - revoked release hides contact by returning zero RPC rows.
-- - held release hides contact by returning zero RPC rows.
-- - blocked release hides contact by returning zero RPC rows.
-- - manual_review release hides contact by returning zero RPC rows.
-- - missing release hides contact by returning zero RPC rows.
-- - RPC never returns quote URLs, raw quote files, raw analysis JSON, raw report JSON, or attribution IDs.
