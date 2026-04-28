-- Phase 4E Contractor Performance Smoke Test
-- This is a validation checklist SQL artifact. Replace fixture UUIDs/emails before runtime execution.

-- Fixture requirements:
-- 1. One internal operator user with user_roles.role in ('super_admin','operator','viewer').
-- 2. Contractor A auth user linked to contractor_accounts.id = :contractor_a_account_id.
-- 3. Contractor B auth user linked to contractor_accounts.id = :contractor_b_account_id.
-- 4. Lead assignments, approved lead_contact_releases, and contractor_outcomes for both contractors.
-- 5. At least one validated sold_closed outcome with final_value_cents and value_basis.

-- Source table posture checks: anon should not have direct performance source visibility.
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('contractor_accounts','lead_assignments','lead_contact_releases','lead_contact_release_events','contractor_outcomes')
order by tablename, policyname;

-- Verify aggregate source fields contain no homeowner phone/email/name/quote URL columns in the intended function projections.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('contractor_accounts','lead_assignments','lead_contact_releases','contractor_outcomes')
  and column_name ~* '(phone|email|first_name|last_name|quote|file|url|raw|json|token|secret|attribution|fbclid|gclid)'
order by table_name, column_name;

-- Sold value proof: only validated sold_closed rows with positive final_value_cents should contribute.
select contractor_account_id, client_slug,
       count(*) filter (where disposition_state = 'sold_closed') as raw_sold_rows,
       count(*) filter (where disposition_state = 'sold_closed' and final_value_cents > 0 and (outcome_verified = true or outcome_integrity_status in ('valid','verified'))) as validated_sold_rows,
       sum(final_value_cents) filter (where disposition_state = 'sold_closed' and final_value_cents > 0 and (outcome_verified = true or outcome_integrity_status in ('valid','verified')) and value_basis in ('contract_total','gross_sale_value')) as confirmed_sold_value_cents,
       sum(final_value_cents) filter (where disposition_state = 'sold_closed' and final_value_cents > 0 and (outcome_verified = true or outcome_integrity_status in ('valid','verified')) and value_basis = 'estimated_contract_value') as estimated_sold_value_cents,
       sum(final_value_cents) filter (where disposition_state = 'sold_closed' and final_value_cents > 0 and (outcome_verified = true or outcome_integrity_status in ('valid','verified')) and value_basis = 'true_margin') as margin_value_cents
from public.contractor_outcomes
group by contractor_account_id, client_slug;

-- Rate denominator proof: rows with zero approved releases must render rates as null/— in UI, never fake 0%.
select ca.id as contractor_account_id, ca.client_slug,
       count(lcr.id) filter (where lcr.release_status in ('approved','released')) as released_denominator
from public.contractor_accounts ca
left join public.lead_contact_releases lcr on lcr.contractor_account_id = ca.id and lcr.client_slug = ca.client_slug
group by ca.id, ca.client_slug
order by released_denominator asc;

-- Runtime edge-function checks to perform with authenticated requests:
-- 1. Unauthenticated admin-contractor-performance call returns 401.
-- 2. Non-admin authenticated user calling admin-contractor-performance returns 403.
-- 3. Internal operator calling admin-contractor-performance receives aggregate rows only.
-- 4. Contractor A calling contractor-performance-summary receives only contractor A aggregate metrics.
-- 5. Contractor A cannot request or see contractor B metrics because no contractor_account_id/client_slug is accepted in the request body.
-- 6. Responses include no phone/email/full-name/quote-file/report-json/analysis-json/token/platform-config fields.
