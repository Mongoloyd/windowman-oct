# Schema Spec Verification

`verify-schema-spec.ts` is a **read-only** check that the deployed Supabase
schema matches the canonical WindowMan contract:

- Required public tables exist
- Required columns exist on each spec'd table
- RLS is enabled on each spec'd table
- Critical RLS policies exist by name (e.g. `analyses_select_internal`,
  `contractor_accounts_select_own`, `lead_assignments_select_own_contractor`,
  `clients_anon_select_active`, `anon_insert_event_logs`)
- Critical SECURITY DEFINER functions exist
  (`is_internal_operator`, `get_analysis_full`)

It only runs `SELECT` queries against `information_schema`, `pg_class`,
`pg_policies`, and `pg_proc`. It will **never** mutate the database, RLS,
edge functions, storage, or any production object.

## Run

```bash
DATABASE_URL='postgres://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres' \
  npx tsx scripts/validation/verify-schema-spec.ts
```

Exit codes:

- `0` — all checks pass
- `1` — at least one spec violation
- `2` — script error (e.g. missing `DATABASE_URL`)

## Adding to the spec

Edit `TABLE_SPECS` and `REQUIRED_FUNCTIONS` in
`scripts/validation/verify-schema-spec.ts`. The spec is intentionally a
**subset** — extra columns/tables in the live DB do not fail the check;
only missing/renamed spec'd objects do.

## Relationship to CI

`.github/workflows/supabase-migration-integrity.yml` (Check 3) runs a
similar set of assertions against an ephemeral CI database. This script
runs the same shape of check against a **deployed** project, including
RLS policy names that the CI workflow does not assert.
