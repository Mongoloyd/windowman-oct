#!/usr/bin/env bash
# verify-schema-spec.sh
#
# Read-only verification that the deployed Supabase schema matches the
# canonical WindowMan.PRO contract: required tables, required columns,
# RLS-enabled flags, critical RLS policy names, and critical SECURITY
# DEFINER function names.
#
# This script is READ-ONLY. It only runs SELECT against information_schema,
# pg_class, pg_policies, and pg_proc. It will NEVER mutate the database,
# RLS, edge functions, storage, or any production object.
#
# USAGE
#   DATABASE_URL='postgres://postgres:<password>@db.<ref>.supabase.co:5432/postgres' \
#     bash scripts/validation/verify-schema-spec.sh
#
# Exit codes:
#   0  all checks pass
#   1  at least one spec violation
#   2  script error (e.g. DATABASE_URL missing, psql not installed)
#
# The spec is intentionally a SUBSET — extra columns/tables in the live
# DB do NOT fail the check; only missing/renamed spec'd objects do.
#
# References:
#   - AGENTS.md sections 6, 7, 8
#   - docs/db/TABLE_ACCESS_MODEL.md
#   - docs/COPILOT_LOVABLE_INTEGRATION_SPEC.md
#   - .github/workflows/supabase-migration-integrity.yml (Check 3)

set -uo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL is not set." >&2
  echo "   Provide a Postgres connection string for the target Supabase project." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "❌ psql is not installed or not on PATH." >&2
  exit 2
fi

PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -q -t -A -F $'\t')

PASS=0
FAIL=0
FAILURES=()

record_pass() { PASS=$((PASS + 1)); }
record_fail() {
  FAIL=$((FAIL + 1))
  FAILURES+=("$1")
  echo "   ✗ $1"
}

# ---------------------------------------------------------------------------
# Snapshot live schema
# ---------------------------------------------------------------------------
echo
echo "=== WindowMan Schema Spec Verification ==="
echo "Snapshotting live schema (read-only)…"

TABLES_RLS=$("${PSQL[@]}" <<'SQL'
select n.nspname || '.' || c.relname || E'\t' || c.relrowsecurity::text
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'public';
SQL
) || { echo "❌ failed to read pg_class"; exit 2; }

COLUMNS=$("${PSQL[@]}" <<'SQL'
select table_schema || '.' || table_name || '.' || column_name
from information_schema.columns
where table_schema = 'public';
SQL
) || { echo "❌ failed to read information_schema.columns"; exit 2; }

POLICIES=$("${PSQL[@]}" <<'SQL'
select schemaname || '.' || tablename || '.' || policyname
from pg_policies
where schemaname = 'public';
SQL
) || { echo "❌ failed to read pg_policies"; exit 2; }

FUNCTIONS=$("${PSQL[@]}" <<'SQL'
select n.nspname || '.' || p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';
SQL
) || { echo "❌ failed to read pg_proc"; exit 2; }

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
has_table() {
  echo "$TABLES_RLS" | awk -F'\t' -v t="$1" '$1==t {found=1} END{exit !found}'
}
table_rls_enabled() {
  echo "$TABLES_RLS" | awk -F'\t' -v t="$1" '$1==t {print $2}' | grep -qx t
}
has_column() {
  echo "$COLUMNS" | grep -Fxq "$1"
}
has_policy() {
  echo "$POLICIES" | grep -Fxq "$1"
}
has_function() {
  echo "$FUNCTIONS" | grep -Fxq "$1"
}

check_table() {
  local key="$1"; shift
  local -a cols=()
  local -a pols=()
  local mode="cols"
  for arg in "$@"; do
    if [ "$arg" = "--policies" ]; then mode="pols"; continue; fi
    if [ "$mode" = "cols" ]; then cols+=("$arg"); else pols+=("$arg"); fi
  done

  if ! has_table "$key"; then
    record_fail "table missing: $key"
    return
  fi
  record_pass

  if ! table_rls_enabled "$key"; then
    record_fail "RLS disabled: $key"
  else
    record_pass
  fi

  for col in "${cols[@]}"; do
    if has_column "$key.$col"; then record_pass
    else record_fail "column missing: $key.$col"; fi
  done

  for pol in "${pols[@]}"; do
    if has_policy "$key.$pol"; then record_pass
    else record_fail "policy missing: $key.$pol"; fi
  done
}

check_function() {
  if has_function "$1"; then record_pass
  else record_fail "function missing: $1"; fi
}

# ---------------------------------------------------------------------------
# Canonical spec
# ---------------------------------------------------------------------------
echo "Running spec checks…"
echo

# Core scanner pipeline (mirrors CI Check 3)
check_table "public.leads" \
  id email phone_e164 created_at

check_table "public.analyses" \
  id lead_id scan_session_id grade analysis_status full_json preview_json flags created_at \
  --policies analyses_select_internal analyses_service_role_all

# Identity / verification
check_table "public.event_logs" \
  id event_name created_at \
  --policies anon_insert_event_logs

# Tenant / client config
check_table "public.clients" \
  id name slug is_active \
  --policies clients_anon_select_active

check_table "public.client_platform_configs" \
  id client_id platform_name token_secret_id config_state validation_status \
  --policies client_platform_configs_select_internal

# Contractor surface (RBAC critical)
check_table "public.contractor_accounts" \
  id auth_user_id client_slug display_name is_active access_status portal_role \
  --policies contractor_accounts_select_own contractor_accounts_select_internal

check_table "public.contractors" \
  id company_name status \
  --policies contractors_select_internal

check_table "public.contractor_opportunities" \
  id analysis_id lead_id scan_session_id status \
  --policies contractor_opportunities_select_internal

check_table "public.contractor_outcomes" \
  id opportunity_id outcome_integrity_status disposition_state \
  --policies contractor_outcomes_select_internal

check_table "public.lead_assignments" \
  id client_slug contractor_account_id status is_current \
  --policies lead_assignments_select_own_contractor lead_assignments_select_internal

# Billing / monetization
check_table "public.billable_intros" \
  id lead_id contractor_id opportunity_id billing_status \
  --policies billable_intros_select_internal

# Critical SECURITY DEFINER guards
check_function "public.is_internal_operator"
check_function "public.get_analysis_full"

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
TOTAL=$((PASS + FAIL))
echo
echo "Totals: $PASS pass, $FAIL fail, $TOTAL checks"
if [ "$FAIL" -gt 0 ]; then
  echo
  echo "❌ SCHEMA SPEC: FAIL"
  exit 1
fi
echo
echo "✅ SCHEMA SPEC: PASS"
exit 0
