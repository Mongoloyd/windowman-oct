-- Phase 4C Lead Release Access Smoke Test
-- Non-destructive validation checklist. Do not claim runtime pass without isolated JWT fixtures.

-- 1) Verify release tables, RLS, and policies exist.
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
-- - RLS enabled on both tables.
-- - No anon policies.
-- - Contractors have SELECT-only own-account policies.
-- - Internal operators can select/manage release decisions.
-- - No contractor INSERT/UPDATE/DELETE policies.

-- 2) Verify structural constraints.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.lead_contact_releases'::regclass, 'public.lead_contact_release_events'::regclass)
order by conrelid::regclass::text, conname;

-- Expected:
-- - valid release_status allow-list.
-- - valid allowed_contact_fields allow-list.
-- - unique lead_assignment_id + contractor_account_id on lead_contact_releases.

-- 3) Verify server contact envelope RPC exists and is executable by authenticated only.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as args,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_contractor_released_contact';

-- 4) Required runtime fixtures before claiming pass:
-- - contractor_user_a JWT and contractor_user_b JWT
-- - contractor_account_a.auth_user_id = contractor_user_a and access_status = active
-- - contractor_account_b.auth_user_id = contractor_user_b and access_status = active
-- - assignment_a.contractor_account_id = contractor_account_a
-- - assignment_b.contractor_account_id = contractor_account_b
-- - release_a approved for assignment_a + contractor_account_a
-- - release_b approved for assignment_b + contractor_account_b
-- - revoked/held/blocked rows for negative cases

-- Runtime expectations:
-- - anon cannot read lead_contact_releases or lead_contact_release_events.
-- - contractor A can read only release rows for contractor_account_a.
-- - contractor A cannot read contractor B release rows.
-- - contractor cannot update release rows.
-- - internal operator can create/update release decisions.
-- - get_contractor_released_contact(assignment_a) with contractor A returns only allowed fields.
-- - get_contractor_released_contact(assignment_b) with contractor A returns zero rows.
-- - revoked, held, blocked, manual_review, and missing release rows return zero contact rows.
-- - quote URLs, raw analysis JSON, raw report JSON, and attribution IDs are never returned.
