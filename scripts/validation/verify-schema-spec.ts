#!/usr/bin/env -S npx tsx
/**
 * verify-schema-spec.ts
 *
 * Verifies that the deployed Supabase schema matches the canonical
 * WindowMan.PRO spec — required tables, required columns, and key
 * RLS / RBAC policies — and prints a pass/fail report.
 *
 * USAGE
 *   DATABASE_URL=postgres://... npx tsx scripts/validation/verify-schema-spec.ts
 *
 *   - DATABASE_URL must point at the target Supabase Postgres instance
 *     (read-only role is fine; the script only runs SELECTs against
 *     information_schema and pg_catalog).
 *   - Exit code 0 = all checks passed. Exit code 1 = at least one failure.
 *
 * SCOPE — this script is read-only. It does NOT mutate any data, schema,
 * RLS policy, edge function, or storage object. It only inspects:
 *   - information_schema.tables
 *   - information_schema.columns
 *   - pg_class.relrowsecurity (RLS enabled flag)
 *   - pg_policies (policy names + commands + roles)
 *
 * The canonical spec below is intentionally a SUBSET of the deployed
 * schema — it asserts the contract documented in:
 *   - AGENTS.md (sections 6, 7, 8)
 *   - docs/db/TABLE_ACCESS_MODEL.md
 *   - docs/COPILOT_LOVABLE_INTEGRATION_SPEC.md
 *   - .github/workflows/supabase-migration-integrity.yml (Check 3)
 *
 * Adding columns/tables to the live DB beyond this spec is fine and will
 * NOT cause a failure. Removing or renaming spec'd objects WILL fail.
 */

import { Client } from "pg";

// ---------------------------------------------------------------------------
// Canonical spec
// ---------------------------------------------------------------------------

type ColumnSpec = { name: string; required: true };
type TableSpec = {
  schema: string;
  table: string;
  columns: string[];
  rlsEnabled: true;
  /** Policy names that MUST exist (any command/role). */
  requiredPolicies?: string[];
};

const TABLE_SPECS: TableSpec[] = [
  // --- Core scanner pipeline (mirrors CI Check 3) -------------------------
  {
    schema: "public",
    table: "leads",
    columns: ["id", "email", "phone_e164", "created_at"],
    rlsEnabled: true,
  },
  {
    schema: "public",
    table: "analyses",
    columns: [
      "id",
      "lead_id",
      "scan_session_id",
      "grade",
      "analysis_status",
      "full_json",
      "preview_json",
      "flags",
      "created_at",
    ],
    rlsEnabled: true,
    requiredPolicies: ["analyses_select_internal", "analyses_service_role_all"],
  },

  // --- Identity / verification -------------------------------------------
  {
    schema: "public",
    table: "event_logs",
    columns: ["id", "event_name", "created_at"],
    rlsEnabled: true,
    requiredPolicies: ["anon_insert_event_logs"],
  },

  // --- Tenant / client config --------------------------------------------
  {
    schema: "public",
    table: "clients",
    columns: ["id", "name", "slug", "is_active"],
    rlsEnabled: true,
    requiredPolicies: ["clients_anon_select_active"],
  },
  {
    schema: "public",
    table: "client_platform_configs",
    columns: [
      "id",
      "client_id",
      "platform_name",
      "token_secret_id",
      "config_state",
      "validation_status",
    ],
    rlsEnabled: true,
    requiredPolicies: ["client_platform_configs_select_internal"],
  },

  // --- Contractor surface (RBAC critical) --------------------------------
  {
    schema: "public",
    table: "contractor_accounts",
    columns: [
      "id",
      "auth_user_id",
      "client_slug",
      "display_name",
      "is_active",
      "access_status",
      "portal_role",
    ],
    rlsEnabled: true,
    requiredPolicies: [
      "contractor_accounts_select_own",
      "contractor_accounts_select_internal",
    ],
  },
  {
    schema: "public",
    table: "contractors",
    columns: ["id", "company_name", "status"],
    rlsEnabled: true,
    requiredPolicies: ["contractors_select_internal"],
  },
  {
    schema: "public",
    table: "contractor_opportunities",
    columns: ["id", "analysis_id", "lead_id", "scan_session_id", "status"],
    rlsEnabled: true,
    requiredPolicies: ["contractor_opportunities_select_internal"],
  },
  {
    schema: "public",
    table: "contractor_outcomes",
    columns: [
      "id",
      "opportunity_id",
      "outcome_integrity_status",
      "disposition_state",
    ],
    rlsEnabled: true,
    requiredPolicies: ["contractor_outcomes_select_internal"],
  },
  {
    schema: "public",
    table: "lead_assignments",
    columns: [
      "id",
      "client_slug",
      "contractor_account_id",
      "status",
      "is_current",
    ],
    rlsEnabled: true,
    requiredPolicies: [
      "lead_assignments_select_own_contractor",
      "lead_assignments_select_internal",
    ],
  },

  // --- Billing / monetization --------------------------------------------
  {
    schema: "public",
    table: "billable_intros",
    columns: [
      "id",
      "lead_id",
      "contractor_id",
      "opportunity_id",
      "billing_status",
    ],
    rlsEnabled: true,
    requiredPolicies: ["billable_intros_select_internal"],
  },
];

/**
 * Functions that MUST exist as SECURITY DEFINER guards. These are the
 * RBAC backbones referenced by RLS policies above; if any goes missing
 * the entire access model collapses.
 */
const REQUIRED_FUNCTIONS: { schema: string; name: string }[] = [
  { schema: "public", name: "is_internal_operator" },
  { schema: "public", name: "get_analysis_full" },
];

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------

type CheckResult = {
  category: "table" | "column" | "rls" | "policy" | "function";
  target: string;
  status: "PASS" | "FAIL";
  detail?: string;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(
      "❌ DATABASE_URL is not set.\n" +
        "   Provide a Postgres connection string for the target Supabase project.\n" +
        "   Example: DATABASE_URL=postgres://postgres:...@db.<ref>.supabase.co:5432/postgres",
    );
    process.exit(2);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const results: CheckResult[] = [];

  try {
    // 1) Tables + RLS flag
    const { rows: tableRows } = await client.query<{
      table_schema: string;
      table_name: string;
      rls_enabled: boolean;
    }>(`
      select n.nspname as table_schema,
             c.relname as table_name,
             c.relrowsecurity as rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r'
        and n.nspname = 'public'
    `);
    const tableMap = new Map(
      tableRows.map((r) => [`${r.table_schema}.${r.table_name}`, r]),
    );

    // 2) Columns
    const { rows: columnRows } = await client.query<{
      table_schema: string;
      table_name: string;
      column_name: string;
    }>(`
      select table_schema, table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
    `);
    const columnSet = new Set(
      columnRows.map(
        (r) => `${r.table_schema}.${r.table_name}.${r.column_name}`,
      ),
    );

    // 3) Policies
    const { rows: policyRows } = await client.query<{
      schemaname: string;
      tablename: string;
      policyname: string;
    }>(`
      select schemaname, tablename, policyname
      from pg_policies
      where schemaname = 'public'
    `);
    const policySet = new Set(
      policyRows.map(
        (r) => `${r.schemaname}.${r.tablename}.${r.policyname}`,
      ),
    );

    // 4) Functions
    const { rows: fnRows } = await client.query<{
      schema: string;
      name: string;
    }>(`
      select n.nspname as schema, p.proname as name
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
    `);
    const fnSet = new Set(fnRows.map((r) => `${r.schema}.${r.name}`));

    // ---- Run spec checks ------------------------------------------------
    for (const spec of TABLE_SPECS) {
      const key = `${spec.schema}.${spec.table}`;
      const tbl = tableMap.get(key);

      if (!tbl) {
        results.push({
          category: "table",
          target: key,
          status: "FAIL",
          detail: "table missing",
        });
        continue;
      }
      results.push({ category: "table", target: key, status: "PASS" });

      if (spec.rlsEnabled && !tbl.rls_enabled) {
        results.push({
          category: "rls",
          target: key,
          status: "FAIL",
          detail: "RLS disabled — expected enabled",
        });
      } else {
        results.push({ category: "rls", target: key, status: "PASS" });
      }

      for (const col of spec.columns) {
        const colKey = `${key}.${col}`;
        results.push({
          category: "column",
          target: colKey,
          status: columnSet.has(colKey) ? "PASS" : "FAIL",
          detail: columnSet.has(colKey) ? undefined : "column missing",
        });
      }

      for (const policy of spec.requiredPolicies ?? []) {
        const polKey = `${key}.${policy}`;
        results.push({
          category: "policy",
          target: polKey,
          status: policySet.has(polKey) ? "PASS" : "FAIL",
          detail: policySet.has(polKey) ? undefined : "policy missing",
        });
      }
    }

    for (const fn of REQUIRED_FUNCTIONS) {
      const key = `${fn.schema}.${fn.name}`;
      results.push({
        category: "function",
        target: key,
        status: fnSet.has(key) ? "PASS" : "FAIL",
        detail: fnSet.has(key) ? undefined : "function missing",
      });
    }
  } finally {
    await client.end();
  }

  // ---- Render report ----------------------------------------------------
  const failed = results.filter((r) => r.status === "FAIL");
  const passed = results.filter((r) => r.status === "PASS");

  const grouped: Record<string, CheckResult[]> = {};
  for (const r of results) (grouped[r.category] ??= []).push(r);

  console.log("\n=== WindowMan Schema Spec Verification ===\n");
  for (const [cat, items] of Object.entries(grouped)) {
    const fails = items.filter((i) => i.status === "FAIL").length;
    const total = items.length;
    console.log(
      `[${cat}] ${total - fails}/${total} pass${fails > 0 ? `  (${fails} FAIL)` : ""}`,
    );
    for (const item of items) {
      if (item.status === "FAIL") {
        console.log(`   ✗ ${item.target}  — ${item.detail ?? "fail"}`);
      }
    }
  }

  console.log(
    `\nTotals: ${passed.length} pass, ${failed.length} fail, ${results.length} checks`,
  );

  if (failed.length > 0) {
    console.log("\n❌ SCHEMA SPEC: FAIL");
    process.exit(1);
  }
  console.log("\n✅ SCHEMA SPEC: PASS");
  process.exit(0);
}

main().catch((err) => {
  console.error("Verification script crashed:", err);
  process.exit(2);
});
