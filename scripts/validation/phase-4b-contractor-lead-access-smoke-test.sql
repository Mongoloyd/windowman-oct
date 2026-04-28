-- Phase 4B Contractor Lead Access Smoke Test
-- Non-destructive validation script. Do not claim runtime pass without isolated fixtures and JWTs.

-- 1) Verify lead_assignments own-contractor RLS policy exists.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  p.polname as policy_name,
  p.polcmd as command,
  pg_get_expr(p.polqual, p.polrelid) as using_expression
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relname in ('contractor_accounts', 'lead_assignments')
order by c.relname, p.polname;

-- Expected:
-- - contractor_accounts_select_own uses auth_user_id = auth.uid()
-- - lead_assignments_select_own_contractor joins contractor_accounts.auth_user_id = auth.uid()
-- - no anon read policy on lead_assignments

-- 2) Verify 4B safe data source columns only.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'lead_assignments'
  and column_name in (
    'id', 'assigned_at', 'accepted_at', 'released_at', 'recycled_at',
    'status', 'client_slug', 'contractor_account_id', 'reason_code',
    'is_current', 'metadata', 'created_at', 'updated_at'
  )
order by ordinal_position;

-- 3) Runtime fixture requirements before claiming cross-contractor proof:
-- - contractor_user_a authenticated JWT
-- - contractor_user_b authenticated JWT
-- - contractor_account_a.auth_user_id = contractor_user_a
-- - contractor_account_b.auth_user_id = contractor_user_b
-- - lead_assignment_a.contractor_account_id = contractor_account_a
-- - lead_assignment_b.contractor_account_id = contractor_account_b
-- - client_slug_a != client_slug_b

-- 4) With anon REST key: lead_assignments read should be denied or return zero rows.
-- 5) With contractor_user_a JWT: list should return only assignment A.
-- 6) With contractor_user_a JWT: detail fetch for assignment B should return not_found/forbidden and no data.
-- 7) With suspended/revoked account: service should return no assignments.
-- 8) Safe service output must not include phone, email, full name, quote file URL, full_json, raw attribution IDs, tokens, or vault IDs.
