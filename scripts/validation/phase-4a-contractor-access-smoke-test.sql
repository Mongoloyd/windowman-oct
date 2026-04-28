-- Phase 4A Contractor Access Smoke Test
-- Purpose: document non-destructive validation probes for the contractor portal access model.
-- This script intentionally avoids inserting fake contractor accounts or mutating production data.

-- 1) Verify contractor_accounts has RLS enabled and own-account policy exists.
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
  and c.relname = 'contractor_accounts'
order by p.polname;

-- Expected:
-- - rls_enabled = true
-- - contractor_accounts_select_own uses auth_user_id = auth.uid()
-- - no anon select policy exists

-- 2) Verify 4A access metadata columns exist.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'contractor_accounts'
  and column_name in ('auth_user_id', 'client_slug', 'display_name', 'is_active', 'access_status', 'portal_role', 'last_portal_login_at')
order by ordinal_position;

-- 3) Runtime fixture requirements before claiming cross-contractor proof:
-- - contractor_user_a authenticated JWT
-- - contractor_user_b authenticated JWT
-- - contractor_account_a.auth_user_id = contractor_user_a
-- - contractor_account_b.auth_user_id = contractor_user_b
-- - contractor_account_a.client_slug != contractor_account_b.client_slug

-- 4) With anon REST key, contractor_accounts read should be denied or return zero rows.
-- 5) With contractor_user_a JWT, selecting contractor_accounts should return only account A.
-- 6) With contractor_user_b JWT, selecting contractor_accounts should return only account B.
-- 7) /partner/portal must not query leads, quote_files, analyses.full_json, contractor_outcomes, or storage.
