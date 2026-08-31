# Audit 04 — Restricted Data-Profiling SQL Pack Generation

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 04 — Restricted Data-Profiling SQL Pack Generation |
| UTC execution time | `2026-08-31T01:20:30Z` |
| Execution environment | CODEX; local evidence review and SQL-text generation only |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status before Audit 04 | No tracked or staged change was identified; Audits 00–03F were pre-existing untracked Markdown artifacts |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity actually verified | `NO`; no network request was made |
| Database environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD`; Supabase branch `forensic_report_v1` |
| Database project identifier | Branch ref `zgsofkgddpcntdvpckdq`; parent ref `wkrcyxcnzhwjtdpmfpaf` is prohibited |
| PostgreSQL version | `17.6`, validated deployed metadata from `SB-MD-001` |
| Reviewed execution role | `postgres`; non-superuser; `BYPASSRLS=true`, validated by `SB-MD-022` |
| Production read authorization | SQL-pack generation only; SQL execution is not authorized |
| Network authorization used | None |
| Applicable governance | `AGENTS.md`; Audits 00–03F; the operator's standalone Audit 04 authorization |
| Audit status | `COMPLETE_WITH_BLOCKERS` — pack generated; human SQL/security/privacy review and execution authorization remain outstanding |
| Auditor limitations | No SQL, database connection, application row, raw JSON value, Storage object, log, function, service, build, test, migration, deployment, or external provider was accessed or invoked |

## 2. Frozen binding manifest

### Gate state

| Gate | Frozen result |
|---|---|
| `NEEDS_SCHEMA_BINDING` | `RESOLVED_FOR_RESTRICTED_PROFILE_GENERATION_ONLY` |
| `GATE_CONTRACT` | `SATISFIED_WITH_RESTRICTED_PROFILEABLE_SUBSET` |
| `GATE_DATABASE` | `SATISFIED_FOR_RESTRICTED_PROFILE_GENERATION` |
| SQL-pack generation | `AUTHORIZED` |
| SQL execution | `NOT_AUTHORIZED` |
| Deep-pack generation | `NOT_AUTHORIZED` |

### Target and role

- Target project display: `WMProd`.
- Target environment: `LIVE_ACTIVE / PRODUCTION WORKLOAD`.
- Target Supabase branch: `forensic_report_v1`.
- Target branch ref: `zgsofkgddpcntdvpckdq`.
- Prohibited parent ref: `wkrcyxcnzhwjtdpmfpaf`.
- Expected database name: `postgres`.
- Expected PostgreSQL version: `17.6` / `170006`.
- Expected current and session role: `postgres`.
- Expected role attributes: non-superuser, inherits roles, `BYPASSRLS=true`.
- Because this role bypasses RLS, no query relies on RLS for output safety.

### Frozen application source allowlist

Application profiling SQL may read values only from:

- `public.analyses AS a`
- `public.scan_sessions AS s`
- `public.quote_files AS qf`
- `public.leads AS l`

Catalog preflights may read only the bounded `pg_catalog` and `information_schema` metadata shown in their exact SQL. No application value from another relation is authorized.

### Date binding

All application queries use:

```text
a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
```

This is an operational analysis-persistence interval. It is not a quote date, contract date, project date, effective date, or revision date.

### Frozen restricted-quality predicate

Queries that claim membership in the restricted quality population use this predicate without broadening it:

```sql
a.analysis_status = 'complete'
AND a.document_is_window_door_related IS TRUE
AND a.confidence_score BETWEEN 0.4 AND 1
AND a.document_type IS NOT NULL
AND btrim(a.document_type) <> ''
AND lower(btrim(a.document_type)) <> 'unknown'
AND s.id = a.scan_session_id
AND s.status IN ('preview_ready', 'awaiting_verification', 'revealed')
AND qf.id = s.quote_file_id
AND l.id = a.lead_id
AND l.is_test IS FALSE
AND a.full_json IS NOT NULL
AND jsonb_typeof(a.full_json) = 'object'
AND jsonb_typeof(a.full_json -> 'extraction') = 'object'
AND jsonb_typeof(a.full_json -> 'extraction' -> 'line_items') = 'array'
AND jsonb_array_length(a.full_json -> 'extraction' -> 'line_items') >= 1
AND a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
```

The predicate supports restricted pipeline-health and extraction-shape quality assessment only. Semantic and market eligibility remain false.

### Frozen field and meaning restrictions

| Binding | Frozen rule |
|---|---|
| Supported identities | Lead, uploaded-document row, scan-session row, and mutable analysis row only; identifiers may be used internally for joins and approved distinct counts |
| Unsupported identities | Project, quote, revision, immutable attempt, duplicate, current quote, and supersession |
| Structured quality fields | `a.analysis_status`, `a.document_is_window_door_related`, `a.confidence_score`, `a.document_type`, `a.created_at` |
| Restricted JSON branch | `a.full_json -> 'extraction' -> 'line_items'` and each element's `description` only |
| Array meaning | Array length may be called only `extracted_line_item_count`; it is not an opening, product, unit, or quote-item count |
| Description meaning | Presence, JSON type, zero-length/nonempty state, and frozen nonempty length buckets only; content is prohibited |
| Test rule | Only `l.is_test IS FALSE`; missing lead linkage is not non-test |
| Historical records | Quality and pipeline-health counts only; no version-comparability claim |
| Monetary fields | None; all current monetary fields are excluded |
| Other fact-like tables | Not authoritative for this pack and not referenced |

### Operational limits

- `statement_timeout = '10s'`
- `lock_timeout = '1s'`
- `idle_in_transaction_session_timeout = '15s'`
- Maximum estimated rows per source relation: `10,000`
- Maximum combined estimated bytes for the four source relations: `50,000,000`
- A negative or unavailable catalog row estimate is a hard stop.
- Maximum output rows/groups per query: `100`
- Small-cell threshold: `5`
- Query inventory: 6 preflights, 10 application profiles, 16 total.

## 3. Authorization matrix

| Action | Status | Condition |
|---|---|---|
| Read Audits 00–03F | Authorized and completed | Local read-only evidence review |
| Generate this Markdown SQL pack | Authorized and completed | Exactly this artifact only |
| Execute any `A04-PF-*` query | `NOT_AUTHORIZED` | Requires separate explicit authorization and exact human review |
| Execute any `A04-PR-*` query | `NOT_AUTHORIZED` | Requires all preflights to pass, separate exact-query approval, and separate execution authorization |
| Modify generated SQL ad hoc | Prohibited | Regenerate and re-review instead |
| Generate or execute a deep pack | Prohibited | Deep-pack authorization is absent |
| Inspect application rows or raw JSON | Prohibited | Aggregate-only outputs are mandatory |
| Modify database, Storage, functions, configuration, source, migrations, deployment, or Git | Prohibited | Outside Phase 0 authority |

## 4. Prohibited-data manifest

No query may read for meaning, compute, group by, or output:

- monetary values, prices, amounts, deposits, percentages, taxes, fees, discounts, financing, allowances, optional work, or `_cents` fields;
- opening counts, quantities, dimensions, united inches, per-opening calculations, products, contractors, geography, markets, or benchmarks;
- quote, project, revision, immutable-attempt, duplicate, current-record, or supersession identities or metrics;
- values from fact-like relations outside the four-table allowlist;
- arbitrary or non-runtime-enforced `full_json` paths;
- raw JSON, source text, description content, names, addresses, phone numbers, emails, filenames, Storage paths, contractor names, free text, snippets, tokens, distinct text, identifiers, hashes, or sample values.

The expected output columns listed for each query are positive allowlists. Any additional or differently named output column is an execution hard stop.

## 5. Query inventory and mandatory execution sequence

| Order | Query ID | Class | Purpose | Output rows max | Current status |
|---:|---|---|---|---:|---|
| 1 | `A04-PF-001` | PREFLIGHT | Database, PostgreSQL, role, and role-attribute identity | 1 | NOT_REVIEWED / NOT_AUTHORIZED |
| 2 | `A04-PF-002` | PREFLIGHT | Exact relation presence, kind, and RLS flags | 4 | NOT_REVIEWED / NOT_AUTHORIZED |
| 3 | `A04-PF-003` | PREFLIGHT | Exact required columns, types, and nullability | 15 | NOT_REVIEWED / NOT_AUTHORIZED |
| 4 | `A04-PF-004` | PREFLIGHT | Required PK, unique, and FK bindings | 8 | NOT_REVIEWED / NOT_AUTHORIZED |
| 5 | `A04-PF-005` | PREFLIGHT | Bounded relevant index inventory and health | 100 | NOT_REVIEWED / NOT_AUTHORIZED |
| 6 | `A04-PF-006` | PREFLIGHT | Relation estimates, bytes, and size gate | 4 | NOT_REVIEWED / NOT_AUTHORIZED |
| 7 | `A04-PR-001` | APPLICATION_PROFILE | Date-bounded supported-entity operational totals | 1 | NOT_REVIEWED / NOT_AUTHORIZED |
| 8 | `A04-PR-002` | APPLICATION_PROFILE | Analysis lifecycle distribution | 7 | NOT_REVIEWED / NOT_AUTHORIZED |
| 9 | `A04-PR-003` | APPLICATION_PROFILE | Scan-session lifecycle distribution | 9 | NOT_REVIEWED / NOT_AUTHORIZED |
| 10 | `A04-PR-004` | APPLICATION_PROFILE | Mutually exclusive restricted-population exclusion funnel | 19 | NOT_REVIEWED / NOT_AUTHORIZED |
| 11 | `A04-PR-005` | APPLICATION_PROFILE | Restricted-population supported-entity counts | 1 | NOT_REVIEWED / NOT_AUTHORIZED |
| 12 | `A04-PR-006` | APPLICATION_PROFILE | Frozen confidence-state distribution | 4 | NOT_REVIEWED / NOT_AUTHORIZED |
| 13 | `A04-PR-007` | APPLICATION_PROFILE | Frozen document-type validity-state distribution | 4 | NOT_REVIEWED / NOT_AUTHORIZED |
| 14 | `A04-PR-008` | APPLICATION_PROFILE | Frozen line-item array-state distribution | 8 | NOT_REVIEWED / NOT_AUTHORIZED |
| 15 | `A04-PR-009` | APPLICATION_PROFILE | Frozen description-shape distribution | 4 | NOT_REVIEWED / NOT_AUTHORIZED |
| 16 | `A04-PR-010` | APPLICATION_PROFILE | Frozen nonempty description-length distribution | 4 | NOT_REVIEWED / NOT_AUTHORIZED |

Later manual execution must stop after each query for result review. `A04-PR-*` execution remains disabled unless the operator records every `A04-PF-*` query as `PASS`, obtains human security/privacy review of the exact application SQL, and separately authorizes execution.

## 6. Preflight queries

### A04-PF-001 — Database, PostgreSQL, and role identity

1. **Stable ID:** `A04-PF-001`
2. **Query class:** `PREFLIGHT`
3. **Purpose:** Confirm the reviewed database name, PostgreSQL 17.6 version number, current/session role, and role attributes without reading application rows.
4. **Confirmed source bindings:** `pg_catalog.pg_roles`; built-in session settings.
5. **Required earlier preflight IDs:** None.
6. **Expected output columns:** `database_name`, `current_role_name`, `session_role_name`, `server_version`, `server_version_num`, `is_superuser`, `inherits_roles`, `bypasses_rls`, `binding_status`.
7. **Positive output-column allowlist:** Exactly the nine expected columns above.
8. **Estimated scan scope:** One exact `pg_roles` row; one output row.
9. **Index/constraint dependency:** `pg_roles.rolname` catalog identity lookup.
10. **Safety rationale:** Catalog/session metadata only; read-only, bounded, timeout-protected, and low-impact.
11. **Suppression behavior:** Not applicable; no application data.
12. **Hard-stop conditions:** No row; more than one row; any output-column mismatch; database other than `postgres`; role mismatch; version other than `170006`; superuser true; inheritance false; or `BYPASSRLS` false.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH role_metadata AS (
  SELECT
    r.rolsuper,
    r.rolinherit,
    r.rolbypassrls
  FROM pg_catalog.pg_roles AS r
  WHERE r.rolname = current_user
)
SELECT
  current_database() AS database_name,
  current_user::text AS current_role_name,
  session_user::text AS session_role_name,
  current_setting('server_version') AS server_version,
  current_setting('server_version_num') AS server_version_num,
  role_metadata.rolsuper AS is_superuser,
  role_metadata.rolinherit AS inherits_roles,
  role_metadata.rolbypassrls AS bypasses_rls,
  CASE
    WHEN current_database() = 'postgres'
     AND current_user = 'postgres'
     AND session_user = 'postgres'
     AND current_setting('server_version_num') = '170006'
     AND role_metadata.rolsuper IS FALSE
     AND role_metadata.rolinherit IS TRUE
     AND role_metadata.rolbypassrls IS TRUE
    THEN 'PASS'
    ELSE 'HARD_STOP_IDENTITY_OR_ROLE_MISMATCH'
  END AS binding_status
FROM role_metadata
LIMIT 1;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PF-002 — Exact relation presence, kind, and RLS flags

1. **Stable ID:** `A04-PF-002`
2. **Query class:** `PREFLIGHT`
3. **Purpose:** Confirm that the four exact allowlisted objects remain ordinary public tables with RLS enabled and forced RLS disabled.
4. **Confirmed source bindings:** `pg_catalog.pg_namespace`, `pg_catalog.pg_class`; exact expected-object `VALUES` list.
5. **Required earlier preflight IDs:** `A04-PF-001` must pass.
6. **Expected output columns:** `schema_name`, `relation_name`, `relation_kind`, `rls_enabled`, `forced_rls`, `binding_status`.
7. **Positive output-column allowlist:** Exactly the six expected columns above.
8. **Estimated scan scope:** Four exact catalog lookups; four output rows.
9. **Index/constraint dependency:** PostgreSQL system-catalog object-name indexes.
10. **Safety rationale:** Exact metadata allowlist; no wildcard object search or application-row access.
11. **Suppression behavior:** Not applicable.
12. **Hard-stop conditions:** Not exactly four rows; missing relation; non-table kind; RLS disabled; forced-RLS state differs; unexpected output.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH expected(schema_name, relation_name) AS (
  VALUES
    ('public'::text, 'analyses'::text),
    ('public'::text, 'scan_sessions'::text),
    ('public'::text, 'quote_files'::text),
    ('public'::text, 'leads'::text)
)
SELECT
  expected.schema_name,
  expected.relation_name,
  CASE catalog_class.relkind
    WHEN 'r' THEN 'TABLE'
    WHEN 'p' THEN 'PARTITIONED_TABLE'
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED_VIEW'
    ELSE 'MISSING_OR_UNEXPECTED'
  END AS relation_kind,
  catalog_class.relrowsecurity AS rls_enabled,
  catalog_class.relforcerowsecurity AS forced_rls,
  CASE
    WHEN catalog_class.oid IS NOT NULL
     AND catalog_class.relkind = 'r'
     AND catalog_class.relrowsecurity IS TRUE
     AND catalog_class.relforcerowsecurity IS FALSE
    THEN 'PASS'
    ELSE 'HARD_STOP_RELATION_OR_RLS_DRIFT'
  END AS binding_status
FROM expected
LEFT JOIN pg_catalog.pg_namespace AS catalog_namespace
  ON catalog_namespace.nspname = expected.schema_name
LEFT JOIN pg_catalog.pg_class AS catalog_class
  ON catalog_class.relnamespace = catalog_namespace.oid
 AND catalog_class.relname = expected.relation_name
ORDER BY expected.relation_name
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PF-003 — Required columns, types, and nullability

1. **Stable ID:** `A04-PF-003`
2. **Query class:** `PREFLIGHT`
3. **Purpose:** Compare every column required by the generated application SQL with the deployed physical type and nullability frozen from Audit 03C.
4. **Confirmed source bindings:** `pg_catalog.pg_namespace`, `pg_catalog.pg_class`, `pg_catalog.pg_attribute`, `pg_catalog.format_type`; exact column `VALUES` list.
5. **Required earlier preflight IDs:** `A04-PF-001`, `A04-PF-002` must pass.
6. **Expected output columns:** `schema_name`, `relation_name`, `column_name`, `expected_type`, `actual_type`, `expected_nullable`, `actual_nullable`, `binding_status`.
7. **Positive output-column allowlist:** Exactly the eight expected columns above.
8. **Estimated scan scope:** Fifteen exact catalog column bindings; fifteen output rows.
9. **Index/constraint dependency:** PostgreSQL system-catalog attribute indexes.
10. **Safety rationale:** Catalog metadata only; no application values.
11. **Suppression behavior:** Not applicable.
12. **Hard-stop conditions:** Missing/extra output row; any `binding_status` other than `PASS`; `analyses.created_at` not `timestamp with time zone`; unexpected output.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH expected(schema_name, relation_name, column_name, expected_type, expected_nullable) AS (
  VALUES
    ('public'::text, 'analyses'::text, 'id'::text, 'uuid'::text, false),
    ('public'::text, 'analyses'::text, 'scan_session_id'::text, 'uuid'::text, true),
    ('public'::text, 'analyses'::text, 'lead_id'::text, 'uuid'::text, true),
    ('public'::text, 'analyses'::text, 'analysis_status'::text, 'text'::text, false),
    ('public'::text, 'analyses'::text, 'document_is_window_door_related'::text, 'boolean'::text, true),
    ('public'::text, 'analyses'::text, 'confidence_score'::text, 'numeric'::text, true),
    ('public'::text, 'analyses'::text, 'document_type'::text, 'text'::text, true),
    ('public'::text, 'analyses'::text, 'full_json'::text, 'jsonb'::text, true),
    ('public'::text, 'analyses'::text, 'created_at'::text, 'timestamp with time zone'::text, false),
    ('public'::text, 'scan_sessions'::text, 'id'::text, 'uuid'::text, false),
    ('public'::text, 'scan_sessions'::text, 'quote_file_id'::text, 'uuid'::text, true),
    ('public'::text, 'scan_sessions'::text, 'status'::text, 'text'::text, false),
    ('public'::text, 'quote_files'::text, 'id'::text, 'uuid'::text, false),
    ('public'::text, 'leads'::text, 'id'::text, 'uuid'::text, false),
    ('public'::text, 'leads'::text, 'is_test'::text, 'boolean'::text, false)
), actual AS (
  SELECT
    catalog_namespace.nspname AS schema_name,
    catalog_class.relname AS relation_name,
    catalog_attribute.attname AS column_name,
    pg_catalog.format_type(catalog_attribute.atttypid, catalog_attribute.atttypmod) AS actual_type,
    NOT catalog_attribute.attnotnull AS actual_nullable
  FROM pg_catalog.pg_namespace AS catalog_namespace
  JOIN pg_catalog.pg_class AS catalog_class
    ON catalog_class.relnamespace = catalog_namespace.oid
  JOIN pg_catalog.pg_attribute AS catalog_attribute
    ON catalog_attribute.attrelid = catalog_class.oid
  WHERE catalog_namespace.nspname = 'public'
    AND catalog_class.relname IN ('analyses', 'scan_sessions', 'quote_files', 'leads')
    AND catalog_attribute.attnum > 0
    AND NOT catalog_attribute.attisdropped
)
SELECT
  expected.schema_name,
  expected.relation_name,
  expected.column_name,
  expected.expected_type,
  actual.actual_type,
  expected.expected_nullable,
  actual.actual_nullable,
  CASE
    WHEN actual.column_name IS NOT NULL
     AND actual.actual_type = expected.expected_type
     AND actual.actual_nullable = expected.expected_nullable
    THEN 'PASS'
    ELSE 'HARD_STOP_COLUMN_BINDING_DRIFT'
  END AS binding_status
FROM expected
LEFT JOIN actual
  ON actual.schema_name = expected.schema_name
 AND actual.relation_name = expected.relation_name
 AND actual.column_name = expected.column_name
ORDER BY expected.relation_name, expected.column_name
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PF-004 — Required constraints

1. **Stable ID:** `A04-PF-004`
2. **Query class:** `PREFLIGHT`
3. **Purpose:** Confirm only the primary, unique, and foreign-key constraints required for the approved entity labels and join chain.
4. **Confirmed source bindings:** `pg_catalog.pg_constraint`, `pg_catalog.pg_namespace`, `pg_catalog.pg_class`, `pg_catalog.pg_attribute`; exact expected bindings.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-003` must pass.
6. **Expected output columns:** `binding_name`, `relation_name`, `constraint_kind`, `local_columns`, `referenced_relation`, `referenced_columns`, `matched_constraint_name`, `binding_status`.
7. **Positive output-column allowlist:** Exactly the eight expected columns above.
8. **Estimated scan scope:** Constraints on four exact relations; eight output rows. The unique `analyses.scan_session_id` binding is a unique-index binding and is reviewed in `A04-PF-005`, not misclassified here as a unique constraint.
9. **Index/constraint dependency:** PostgreSQL system catalogs; no application relation scan.
10. **Safety rationale:** Constraint metadata only; definitions and application values are not returned.
11. **Suppression behavior:** Not applicable.
12. **Hard-stop conditions:** Not exactly eight rows; any missing/mismatched binding; unexpected output.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH expected(
  binding_name,
  relation_name,
  constraint_kind,
  local_columns,
  referenced_relation,
  referenced_columns
) AS (
  VALUES
    ('analyses_primary_key', 'analyses', 'p', ARRAY['id']::text[], NULL::text, NULL::text[]),
    ('analyses_scan_session_fk', 'analyses', 'f', ARRAY['scan_session_id']::text[], 'scan_sessions', ARRAY['id']::text[]),
    ('analyses_lead_fk', 'analyses', 'f', ARRAY['lead_id']::text[], 'leads', ARRAY['id']::text[]),
    ('scan_sessions_primary_key', 'scan_sessions', 'p', ARRAY['id']::text[], NULL::text, NULL::text[]),
    ('scan_sessions_quote_file_unique', 'scan_sessions', 'u', ARRAY['quote_file_id']::text[], NULL::text, NULL::text[]),
    ('scan_sessions_quote_file_fk', 'scan_sessions', 'f', ARRAY['quote_file_id']::text[], 'quote_files', ARRAY['id']::text[]),
    ('quote_files_primary_key', 'quote_files', 'p', ARRAY['id']::text[], NULL::text, NULL::text[]),
    ('leads_primary_key', 'leads', 'p', ARRAY['id']::text[], NULL::text, NULL::text[])
), actual AS (
  SELECT
    source_class.relname AS relation_name,
    source_constraint.conname AS constraint_name,
    source_constraint.contype::text AS constraint_kind,
    ARRAY(
      SELECT source_attribute.attname::text
      FROM unnest(source_constraint.conkey) WITH ORDINALITY AS source_key(attnum, ordinal_position)
      JOIN pg_catalog.pg_attribute AS source_attribute
        ON source_attribute.attrelid = source_constraint.conrelid
       AND source_attribute.attnum = source_key.attnum
      ORDER BY source_key.ordinal_position
    ) AS local_columns,
    referenced_class.relname AS referenced_relation,
    CASE
      WHEN source_constraint.contype = 'f' THEN ARRAY(
        SELECT referenced_attribute.attname::text
        FROM unnest(source_constraint.confkey) WITH ORDINALITY AS referenced_key(attnum, ordinal_position)
        JOIN pg_catalog.pg_attribute AS referenced_attribute
          ON referenced_attribute.attrelid = source_constraint.confrelid
         AND referenced_attribute.attnum = referenced_key.attnum
        ORDER BY referenced_key.ordinal_position
      )
      ELSE NULL::text[]
    END AS referenced_columns
  FROM pg_catalog.pg_constraint AS source_constraint
  JOIN pg_catalog.pg_class AS source_class
    ON source_class.oid = source_constraint.conrelid
  JOIN pg_catalog.pg_namespace AS source_namespace
    ON source_namespace.oid = source_class.relnamespace
  LEFT JOIN pg_catalog.pg_class AS referenced_class
    ON referenced_class.oid = source_constraint.confrelid
  WHERE source_namespace.nspname = 'public'
    AND source_class.relname IN ('analyses', 'scan_sessions', 'quote_files', 'leads')
    AND source_constraint.contype IN ('p', 'u', 'f')
)
SELECT
  expected.binding_name,
  expected.relation_name,
  expected.constraint_kind,
  array_to_string(expected.local_columns, ',') AS local_columns,
  expected.referenced_relation,
  array_to_string(expected.referenced_columns, ',') AS referenced_columns,
  actual.constraint_name AS matched_constraint_name,
  CASE
    WHEN actual.constraint_name IS NOT NULL THEN 'PASS'
    ELSE 'HARD_STOP_REQUIRED_CONSTRAINT_MISSING'
  END AS binding_status
FROM expected
LEFT JOIN actual
  ON actual.relation_name = expected.relation_name
 AND actual.constraint_kind = expected.constraint_kind
 AND actual.local_columns = expected.local_columns
 AND actual.referenced_relation IS NOT DISTINCT FROM expected.referenced_relation
 AND actual.referenced_columns IS NOT DISTINCT FROM expected.referenced_columns
ORDER BY expected.binding_name
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PF-005 — Relevant index inventory and health

1. **Stable ID:** `A04-PF-005`
2. **Query class:** `PREFLIGHT`
3. **Purpose:** Inventory indexes on the four exact relations, verify index validity/readiness, and determine whether `analyses.created_at` has a simple supporting index.
4. **Confirmed source bindings:** `pg_catalog.pg_index`, `pg_catalog.pg_class`, `pg_catalog.pg_namespace`, `pg_catalog.pg_attribute`.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-004` must pass.
6. **Expected output columns:** `relation_name`, `index_name`, `is_unique`, `is_valid`, `is_ready`, `index_columns`, `is_partial`, `has_expression`, `index_health_status`.
7. **Positive output-column allowlist:** Exactly the nine expected columns above.
8. **Estimated scan scope:** Index catalog rows for four exact relations; at most 100 output rows.
9. **Index/constraint dependency:** System catalog indexes only.
10. **Safety rationale:** Bounded catalog metadata; expression/predicate text and application values are not returned.
11. **Suppression behavior:** Not applicable.
12. **Hard-stop conditions:** Any invalid/not-ready required index; missing PK/unique backing indexes from `A04-PF-004`; more than 100 rows; unexpected output. Absence of a simple `analyses.created_at` index requires explicit full-scan acceptance after `A04-PF-006`; it is not silently treated as indexed.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

SELECT
  table_class.relname AS relation_name,
  index_class.relname AS index_name,
  index_metadata.indisunique AS is_unique,
  index_metadata.indisvalid AS is_valid,
  index_metadata.indisready AS is_ready,
  array_to_string(
    ARRAY(
      SELECT table_attribute.attname
      FROM unnest(index_metadata.indkey) WITH ORDINALITY AS index_key(attnum, ordinal_position)
      LEFT JOIN pg_catalog.pg_attribute AS table_attribute
        ON table_attribute.attrelid = table_class.oid
       AND table_attribute.attnum = index_key.attnum
      WHERE index_key.attnum > 0
      ORDER BY index_key.ordinal_position
    ),
    ','
  ) AS index_columns,
  index_metadata.indpred IS NOT NULL AS is_partial,
  index_metadata.indexprs IS NOT NULL AS has_expression,
  CASE
    WHEN index_metadata.indisvalid IS TRUE
     AND index_metadata.indisready IS TRUE
    THEN 'PASS'
    ELSE 'HARD_STOP_INDEX_NOT_VALID_OR_READY'
  END AS index_health_status
FROM pg_catalog.pg_index AS index_metadata
JOIN pg_catalog.pg_class AS table_class
  ON table_class.oid = index_metadata.indrelid
JOIN pg_catalog.pg_namespace AS table_namespace
  ON table_namespace.oid = table_class.relnamespace
JOIN pg_catalog.pg_class AS index_class
  ON index_class.oid = index_metadata.indexrelid
WHERE table_namespace.nspname = 'public'
  AND table_class.relname IN ('analyses', 'scan_sessions', 'quote_files', 'leads')
ORDER BY table_class.relname, index_class.relname
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PF-006 — Relation estimates and size gate

1. **Stable ID:** `A04-PF-006`
2. **Query class:** `PREFLIGHT`
3. **Purpose:** Recheck catalog row estimates and total relation bytes for the four exact sources before any application scan.
4. **Confirmed source bindings:** `pg_catalog.pg_class`, `pg_catalog.pg_namespace`, `pg_catalog.pg_total_relation_size`.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-005` must pass.
6. **Expected output columns:** `relation_name`, `estimated_rows`, `total_bytes`, `relation_gate`, `combined_bytes`, `combined_gate`, `overall_size_gate`.
7. **Positive output-column allowlist:** Exactly the seven expected columns above.
8. **Estimated scan scope:** Four catalog relation rows; four output rows; no application table scan.
9. **Index/constraint dependency:** Exact catalog relation OIDs established by earlier preflights.
10. **Safety rationale:** Catalog statistics and relation-size metadata only; estimates are not exact application counts.
11. **Suppression behavior:** Not applicable.
12. **Hard-stop conditions:** Not exactly four rows; any `estimated_rows < 0` or unavailable; any relation estimate above 10,000; combined bytes above 50,000,000; unexpected output. A missing date index also requires reviewer acceptance of a possible bounded full scan.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH measured AS (
  SELECT
    catalog_class.relname AS relation_name,
    catalog_class.reltuples::numeric AS estimated_rows,
    pg_catalog.pg_total_relation_size(catalog_class.oid) AS total_bytes
  FROM pg_catalog.pg_class AS catalog_class
  JOIN pg_catalog.pg_namespace AS catalog_namespace
    ON catalog_namespace.oid = catalog_class.relnamespace
  WHERE catalog_namespace.nspname = 'public'
    AND catalog_class.relname IN ('analyses', 'scan_sessions', 'quote_files', 'leads')
    AND catalog_class.relkind = 'r'
), summary AS (
  SELECT
    COUNT(*) AS relation_count,
    SUM(total_bytes) AS combined_bytes,
    COALESCE(bool_or(estimated_rows < 0 OR estimated_rows > 10000), true) AS row_gate_failed
  FROM measured
)
SELECT
  measured.relation_name,
  measured.estimated_rows,
  measured.total_bytes,
  CASE
    WHEN measured.estimated_rows < 0 THEN 'HARD_STOP_UNKNOWN_OR_NEGATIVE_ESTIMATE'
    WHEN measured.estimated_rows > 10000 THEN 'HARD_STOP_RELATION_ROW_ESTIMATE_EXCEEDED'
    ELSE 'PASS'
  END AS relation_gate,
  summary.combined_bytes,
  CASE
    WHEN summary.combined_bytes > 50000000 THEN 'HARD_STOP_COMBINED_BYTES_EXCEEDED'
    ELSE 'PASS'
  END AS combined_gate,
  CASE
    WHEN summary.relation_count <> 4 THEN 'HARD_STOP_RELATION_COUNT_MISMATCH'
    WHEN summary.row_gate_failed THEN 'HARD_STOP_ROW_ESTIMATE_GATE'
    WHEN summary.combined_bytes > 50000000 THEN 'HARD_STOP_COMBINED_BYTES_EXCEEDED'
    ELSE 'PASS'
  END AS overall_size_gate
FROM measured
CROSS JOIN summary
ORDER BY measured.relation_name
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

## 7. Application profiling queries

Every query in this section remains text-only and unauthorized. All six preflights must first be manually executed under separate authorization and recorded as passing. A human must then review the exact application query, its positive output allowlist, suppression behavior, and scan scope before separate execution authorization can be requested.

### A04-PR-001 — Date-bounded supported-entity operational totals

1. **Stable ID:** `A04-PR-001`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Return one unsegmented operational row counting date-bounded mutable analysis rows and linked supported entity rows by their actual names.
4. **Confirmed source bindings:** The four allowlisted relations; `a.id`, `a.scan_session_id`, `a.lead_id`, `a.created_at`, `s.id`, `s.quote_file_id`, `qf.id`, `l.id`.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `mutable_analysis_row_count`, `scan_session_count`, `uploaded_document_count`, `lead_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded `analyses` scan plus indexed UUID joins; possible bounded full scan if no `created_at` index; one output row.
9. **Index/constraint dependency:** Analysis/session and session/document constraints; PK indexes; `analyses.lead_id` index; date-index presence reviewed in `A04-PF-005`; size gate `A04-PF-006`.
10. **Safety rationale:** Aggregate distinct counts only; identifiers are never projected; no JSON access.
11. **Suppression behavior:** Not applicable. This is an approved unsegmented operational total with no sensitive dimension.
12. **Hard-stop conditions:** Any preflight not passed; full-scan risk not accepted; timeout; output mismatch; row other than one; any identifier or prohibited value appears.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

SELECT
  COUNT(DISTINCT a.id) AS mutable_analysis_row_count,
  COUNT(DISTINCT s.id) AS scan_session_count,
  COUNT(DISTINCT qf.id) AS uploaded_document_count,
  COUNT(DISTINCT l.id) AS lead_count
FROM public.analyses AS a
LEFT JOIN public.scan_sessions AS s
  ON s.id = a.scan_session_id
LEFT JOIN public.quote_files AS qf
  ON qf.id = s.quote_file_id
LEFT JOIN public.leads AS l
  ON l.id = a.lead_id
WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
  AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z';

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-002 — Analysis lifecycle distribution

1. **Stable ID:** `A04-PR-002`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Count the six confirmed analysis statuses plus `other_unexpected` for date-bounded, fully joined, non-test records.
4. **Confirmed source bindings:** Four allowlisted relations; analysis/session/document/lead joins; `l.is_test`; `a.analysis_status`; `a.created_at`.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `analysis_status_state`, `mutable_analysis_row_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded analyses and indexed joins; at most seven unsuppressed rows or one suppressed row.
9. **Index/constraint dependency:** Same as `A04-PR-001`.
10. **Safety rationale:** Fixed lifecycle states only; no raw/unexpected status value is returned.
11. **Suppression behavior:** Zero cells are omitted. If any nonzero state has 1–4 rows, the whole distribution becomes exactly one control row with the state and count columns `NULL`.
12. **Hard-stop conditions:** Any preflight/review failure; unexpected label or output; suppression contract failure; timeout; more than 100 rows.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH classified AS (
  SELECT
    CASE
      WHEN a.analysis_status IN (
        'pending', 'processing', 'complete', 'failed',
        'invalid_document', 'needs_better_upload'
      ) THEN a.analysis_status
      ELSE 'other_unexpected'
    END AS analysis_status_state
  FROM public.analyses AS a
  JOIN public.scan_sessions AS s
    ON s.id = a.scan_session_id
  JOIN public.quote_files AS qf
    ON qf.id = s.quote_file_id
  JOIN public.leads AS l
    ON l.id = a.lead_id
   AND l.is_test IS FALSE
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), bucket_counts AS (
  SELECT analysis_status_state, COUNT(*) AS mutable_analysis_row_count
  FROM classified
  GROUP BY analysis_status_state
  HAVING COUNT(*) > 0
), decision AS (
  SELECT COALESCE(bool_or(mutable_analysis_row_count BETWEEN 1 AND 4), false) AS suppress_distribution
  FROM bucket_counts
), output_rows AS (
  SELECT
    true AS distribution_suppressed,
    5 AS suppression_threshold,
    NULL::text AS analysis_status_state,
    NULL::bigint AS mutable_analysis_row_count
  FROM decision
  WHERE suppress_distribution
  UNION ALL
  SELECT
    false,
    5,
    bucket_counts.analysis_status_state,
    bucket_counts.mutable_analysis_row_count
  FROM bucket_counts
  CROSS JOIN decision
  WHERE NOT suppress_distribution
)
SELECT
  distribution_suppressed,
  suppression_threshold,
  analysis_status_state,
  mutable_analysis_row_count
FROM output_rows
ORDER BY analysis_status_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-003 — Scan-session lifecycle distribution

1. **Stable ID:** `A04-PR-003`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Count the eight confirmed scan-session states plus `other_unexpected` for sessions linked to date-bounded, non-test analyses.
4. **Confirmed source bindings:** Four allowlisted relations; `s.status`; approved joins; `l.is_test`; `a.created_at`.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `scan_session_status_state`, `scan_session_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded analyses and indexed joins; at most nine unsuppressed rows or one suppressed row.
9. **Index/constraint dependency:** Same as `A04-PR-001`.
10. **Safety rationale:** Fixed lifecycle states only; no raw unexpected status value.
11. **Suppression behavior:** Whole-distribution suppression at threshold 5 exactly as frozen.
12. **Hard-stop conditions:** Any preflight/review failure; suppression/output mismatch; timeout; more than 100 rows.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH classified AS (
  SELECT DISTINCT
    s.id,
    CASE
      WHEN s.status IN (
        'idle', 'uploading', 'processing', 'preview_ready',
        'awaiting_verification', 'revealed', 'invalid_document',
        'needs_better_upload'
      ) THEN s.status
      ELSE 'other_unexpected'
    END AS scan_session_status_state
  FROM public.analyses AS a
  JOIN public.scan_sessions AS s
    ON s.id = a.scan_session_id
  JOIN public.quote_files AS qf
    ON qf.id = s.quote_file_id
  JOIN public.leads AS l
    ON l.id = a.lead_id
   AND l.is_test IS FALSE
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), bucket_counts AS (
  SELECT scan_session_status_state, COUNT(*) AS scan_session_count
  FROM classified
  GROUP BY scan_session_status_state
  HAVING COUNT(*) > 0
), decision AS (
  SELECT COALESCE(bool_or(scan_session_count BETWEEN 1 AND 4), false) AS suppress_distribution
  FROM bucket_counts
), output_rows AS (
  SELECT true AS distribution_suppressed, 5 AS suppression_threshold,
         NULL::text AS scan_session_status_state, NULL::bigint AS scan_session_count
  FROM decision
  WHERE suppress_distribution
  UNION ALL
  SELECT false, 5, bucket_counts.scan_session_status_state, bucket_counts.scan_session_count
  FROM bucket_counts
  CROSS JOIN decision
  WHERE NOT suppress_distribution
)
SELECT distribution_suppressed, suppression_threshold, scan_session_status_state, scan_session_count
FROM output_rows
ORDER BY scan_session_status_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-004 — Restricted-population exclusion funnel

1. **Stable ID:** `A04-PR-004`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Assign each date-bounded analysis row to exactly one first-failure state or `restricted_quality_eligible`, providing auditable join, test, classification, and restricted-shape coverage without overlapping stage totals.
4. **Confirmed source bindings:** Four allowlisted relations; exact frozen predicate fields; only the approved JSON branch.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `population_state`, `mutable_analysis_row_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded analyses; three indexed joins; parent-first JSON guards; at most nineteen unsuppressed rows or one suppressed row.
9. **Index/constraint dependency:** Same as `A04-PR-001`; JSON access occurs only after relation/date filtering.
10. **Safety rationale:** Mutually exclusive fixed QA states; no row identifier, raw field value, raw JSON, or text content is returned.
11. **Suppression behavior:** Whole-distribution suppression at threshold 5; a suppressed result returns no state, count, or total.
12. **Hard-stop conditions:** Any preflight/review failure; non-fixed state; suppression/output mismatch; timeout; prohibited value.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH classified AS (
  SELECT
    CASE
      WHEN a.analysis_status IS DISTINCT FROM 'complete' THEN 'analysis_not_complete'
      WHEN a.document_is_window_door_related IS DISTINCT FROM true THEN 'not_confirmed_window_door_related'
      WHEN a.confidence_score IS NULL OR a.confidence_score NOT BETWEEN 0.4 AND 1 THEN 'confidence_invalid_or_missing'
      WHEN a.document_type IS NULL THEN 'document_type_missing'
      WHEN btrim(a.document_type) = '' THEN 'document_type_blank'
      WHEN lower(btrim(a.document_type)) = 'unknown' THEN 'document_type_unknown'
      WHEN s.id IS NULL THEN 'scan_session_missing'
      WHEN s.status NOT IN ('preview_ready', 'awaiting_verification', 'revealed') THEN 'scan_session_status_not_success'
      WHEN qf.id IS NULL THEN 'uploaded_document_missing'
      WHEN l.id IS NULL THEN 'lead_missing'
      WHEN l.is_test IS NOT FALSE THEN 'test_or_unclassified_lead'
      WHEN a.full_json IS NULL THEN 'full_json_missing'
      WHEN jsonb_typeof(a.full_json) <> 'object' THEN 'full_json_wrong_type'
      WHEN a.full_json -> 'extraction' IS NULL THEN 'extraction_missing'
      WHEN jsonb_typeof(a.full_json -> 'extraction') <> 'object' THEN 'extraction_wrong_type'
      WHEN a.full_json -> 'extraction' -> 'line_items' IS NULL THEN 'line_items_missing'
      WHEN jsonb_typeof(a.full_json -> 'extraction' -> 'line_items') <> 'array' THEN 'line_items_wrong_type'
      WHEN jsonb_array_length(a.full_json -> 'extraction' -> 'line_items') < 1 THEN 'line_items_empty'
      ELSE 'restricted_quality_eligible'
    END AS population_state
  FROM public.analyses AS a
  LEFT JOIN public.scan_sessions AS s
    ON s.id = a.scan_session_id
  LEFT JOIN public.quote_files AS qf
    ON qf.id = s.quote_file_id
  LEFT JOIN public.leads AS l
    ON l.id = a.lead_id
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), bucket_counts AS (
  SELECT population_state, COUNT(*) AS mutable_analysis_row_count
  FROM classified
  GROUP BY population_state
  HAVING COUNT(*) > 0
), decision AS (
  SELECT COALESCE(bool_or(mutable_analysis_row_count BETWEEN 1 AND 4), false) AS suppress_distribution
  FROM bucket_counts
), output_rows AS (
  SELECT true AS distribution_suppressed, 5 AS suppression_threshold,
         NULL::text AS population_state, NULL::bigint AS mutable_analysis_row_count
  FROM decision
  WHERE suppress_distribution
  UNION ALL
  SELECT false, 5, bucket_counts.population_state, bucket_counts.mutable_analysis_row_count
  FROM bucket_counts
  CROSS JOIN decision
  WHERE NOT suppress_distribution
)
SELECT distribution_suppressed, suppression_threshold, population_state, mutable_analysis_row_count
FROM output_rows
ORDER BY population_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-005 — Restricted-population supported-entity counts

1. **Stable ID:** `A04-PR-005`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Count only the approved supported entity classes inside the exact restricted-quality population.
4. **Confirmed source bindings:** Four allowlisted relations; exact frozen restricted predicate.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `mutable_analysis_row_count`, `scan_session_count`, `uploaded_document_count`, `lead_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded analyses, indexed joins, guarded JSON path; one output row.
9. **Index/constraint dependency:** Same as `A04-PR-001`.
10. **Safety rationale:** Aggregate distinct counts only; identifiers never leave the query.
11. **Suppression behavior:** Not applicable; approved unsegmented operational totals with no identifying dimension.
12. **Hard-stop conditions:** Any preflight/review failure; output mismatch; timeout; unexpected row count; prohibited value.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

SELECT
  COUNT(DISTINCT a.id) AS mutable_analysis_row_count,
  COUNT(DISTINCT s.id) AS scan_session_count,
  COUNT(DISTINCT qf.id) AS uploaded_document_count,
  COUNT(DISTINCT l.id) AS lead_count
FROM public.analyses AS a
JOIN public.scan_sessions AS s
  ON s.id = a.scan_session_id
JOIN public.quote_files AS qf
  ON qf.id = s.quote_file_id
JOIN public.leads AS l
  ON l.id = a.lead_id
WHERE a.analysis_status = 'complete'
  AND a.document_is_window_door_related IS TRUE
  AND a.confidence_score BETWEEN 0.4 AND 1
  AND a.document_type IS NOT NULL
  AND btrim(a.document_type) <> ''
  AND lower(btrim(a.document_type)) <> 'unknown'
  AND s.id = a.scan_session_id
  AND s.status IN ('preview_ready', 'awaiting_verification', 'revealed')
  AND qf.id = s.quote_file_id
  AND l.id = a.lead_id
  AND l.is_test IS FALSE
  AND a.full_json IS NOT NULL
  AND jsonb_typeof(a.full_json) = 'object'
  AND jsonb_typeof(a.full_json -> 'extraction') = 'object'
  AND jsonb_typeof(a.full_json -> 'extraction' -> 'line_items') = 'array'
  AND jsonb_array_length(a.full_json -> 'extraction' -> 'line_items') >= 1
  AND a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
  AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z';

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-006 — Confidence-state distribution

1. **Stable ID:** `A04-PR-006`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Measure confidence validity in the complete, successful-lifecycle, fully joined, non-test QA precursor population using only the four frozen buckets.
4. **Confirmed source bindings:** Four allowlisted relations; `a.confidence_score`, lifecycle/join/test/date fields.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `confidence_state`, `mutable_analysis_row_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded analyses with indexed joins; at most four unsuppressed rows or one suppressed row.
9. **Index/constraint dependency:** Same as `A04-PR-001`.
10. **Safety rationale:** Numeric field is never output; only frozen state labels and suppressed aggregate counts are returned.
11. **Suppression behavior:** Whole-distribution suppression at threshold 5.
12. **Hard-stop conditions:** Any label outside the four frozen states; suppression/output mismatch; preflight/review failure; timeout.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH classified AS (
  SELECT
    CASE
      WHEN a.confidence_score IS NULL OR a.confidence_score < 0.4 OR a.confidence_score > 1
        THEN 'invalid_or_missing'
      WHEN a.confidence_score < 0.6 THEN '0.40_to_less_than_0.60'
      WHEN a.confidence_score < 0.8 THEN '0.60_to_less_than_0.80'
      ELSE '0.80_to_1.00'
    END AS confidence_state
  FROM public.analyses AS a
  JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  JOIN public.leads AS l ON l.id = a.lead_id AND l.is_test IS FALSE
  WHERE a.analysis_status = 'complete'
    AND s.status IN ('preview_ready', 'awaiting_verification', 'revealed')
    AND a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), bucket_counts AS (
  SELECT confidence_state, COUNT(*) AS mutable_analysis_row_count
  FROM classified
  GROUP BY confidence_state
  HAVING COUNT(*) > 0
), decision AS (
  SELECT COALESCE(bool_or(mutable_analysis_row_count BETWEEN 1 AND 4), false) AS suppress_distribution
  FROM bucket_counts
), output_rows AS (
  SELECT true AS distribution_suppressed, 5 AS suppression_threshold,
         NULL::text AS confidence_state, NULL::bigint AS mutable_analysis_row_count
  FROM decision WHERE suppress_distribution
  UNION ALL
  SELECT false, 5, bucket_counts.confidence_state, bucket_counts.mutable_analysis_row_count
  FROM bucket_counts CROSS JOIN decision WHERE NOT suppress_distribution
)
SELECT distribution_suppressed, suppression_threshold, confidence_state, mutable_analysis_row_count
FROM output_rows
ORDER BY confidence_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-007 — Document-type validity-state distribution

1. **Stable ID:** `A04-PR-007`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Measure document-type validity without returning or grouping by a raw document-type value.
4. **Confirmed source bindings:** Four allowlisted relations; `a.document_type`, lifecycle/join/test/date fields.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `document_type_validity_state`, `mutable_analysis_row_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded analyses with indexed joins; at most four unsuppressed rows or one suppressed row.
9. **Index/constraint dependency:** Same as `A04-PR-001`.
10. **Safety rationale:** Uses exactly `missing`, `blank`, `unknown`, and `nonblank_nonunknown`; raw types and unexpected labels never appear.
11. **Suppression behavior:** Whole-distribution suppression at threshold 5.
12. **Hard-stop conditions:** Raw document type appears; unknown label appears; suppression/output mismatch; timeout; preflight/review failure.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH classified AS (
  SELECT
    CASE
      WHEN a.document_type IS NULL THEN 'missing'
      WHEN btrim(a.document_type) = '' THEN 'blank'
      WHEN lower(btrim(a.document_type)) = 'unknown' THEN 'unknown'
      ELSE 'nonblank_nonunknown'
    END AS document_type_validity_state
  FROM public.analyses AS a
  JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  JOIN public.leads AS l ON l.id = a.lead_id AND l.is_test IS FALSE
  WHERE a.analysis_status = 'complete'
    AND s.status IN ('preview_ready', 'awaiting_verification', 'revealed')
    AND a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), bucket_counts AS (
  SELECT document_type_validity_state, COUNT(*) AS mutable_analysis_row_count
  FROM classified
  GROUP BY document_type_validity_state
  HAVING COUNT(*) > 0
), decision AS (
  SELECT COALESCE(bool_or(mutable_analysis_row_count BETWEEN 1 AND 4), false) AS suppress_distribution
  FROM bucket_counts
), output_rows AS (
  SELECT true AS distribution_suppressed, 5 AS suppression_threshold,
         NULL::text AS document_type_validity_state, NULL::bigint AS mutable_analysis_row_count
  FROM decision WHERE suppress_distribution
  UNION ALL
  SELECT false, 5, bucket_counts.document_type_validity_state, bucket_counts.mutable_analysis_row_count
  FROM bucket_counts CROSS JOIN decision WHERE NOT suppress_distribution
)
SELECT distribution_suppressed, suppression_threshold, document_type_validity_state, mutable_analysis_row_count
FROM output_rows
ORDER BY document_type_validity_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-008 — Line-item array-state distribution

1. **Stable ID:** `A04-PR-008`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Profile only the approved `line_items` container shape and frozen array-length buckets in the complete, successful-lifecycle, fully joined, non-test QA precursor population.
4. **Confirmed source bindings:** Four allowlisted relations; exact JSON branch `a.full_json -> 'extraction' -> 'line_items'` with parent-first guards.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `line_item_array_state`, `mutable_analysis_row_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded analyses, indexed joins, guarded JSON container inspection; at most eight unsuppressed rows or one suppressed row.
9. **Index/constraint dependency:** Same as `A04-PR-001`; no JSON index is assumed.
10. **Safety rationale:** No array element or JSON value is output. Array length is used only to assign approved extracted-line-item-count states.
11. **Suppression behavior:** Whole-distribution suppression at threshold 5.
12. **Hard-stop conditions:** Any non-frozen state; label suggesting openings/products/units/quote items; raw JSON; suppression/output mismatch; timeout.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH classified AS (
  SELECT
    CASE
      WHEN a.full_json IS NULL THEN 'missing'
      WHEN jsonb_typeof(a.full_json) <> 'object' THEN 'wrong_type'
      WHEN a.full_json -> 'extraction' IS NULL THEN 'missing'
      WHEN jsonb_typeof(a.full_json -> 'extraction') <> 'object' THEN 'wrong_type'
      WHEN a.full_json -> 'extraction' -> 'line_items' IS NULL THEN 'missing'
      WHEN jsonb_typeof(a.full_json -> 'extraction' -> 'line_items') <> 'array' THEN 'wrong_type'
      WHEN jsonb_array_length(a.full_json -> 'extraction' -> 'line_items') = 0 THEN 'empty'
      WHEN jsonb_array_length(a.full_json -> 'extraction' -> 'line_items') = 1 THEN 'count_1'
      WHEN jsonb_array_length(a.full_json -> 'extraction' -> 'line_items') BETWEEN 2 AND 5 THEN 'count_2_to_5'
      WHEN jsonb_array_length(a.full_json -> 'extraction' -> 'line_items') BETWEEN 6 AND 10 THEN 'count_6_to_10'
      WHEN jsonb_array_length(a.full_json -> 'extraction' -> 'line_items') BETWEEN 11 AND 20 THEN 'count_11_to_20'
      ELSE 'count_21_plus'
    END AS line_item_array_state
  FROM public.analyses AS a
  JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  JOIN public.leads AS l ON l.id = a.lead_id AND l.is_test IS FALSE
  WHERE a.analysis_status = 'complete'
    AND s.status IN ('preview_ready', 'awaiting_verification', 'revealed')
    AND a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), bucket_counts AS (
  SELECT line_item_array_state, COUNT(*) AS mutable_analysis_row_count
  FROM classified
  GROUP BY line_item_array_state
  HAVING COUNT(*) > 0
), decision AS (
  SELECT COALESCE(bool_or(mutable_analysis_row_count BETWEEN 1 AND 4), false) AS suppress_distribution
  FROM bucket_counts
), output_rows AS (
  SELECT true AS distribution_suppressed, 5 AS suppression_threshold,
         NULL::text AS line_item_array_state, NULL::bigint AS mutable_analysis_row_count
  FROM decision WHERE suppress_distribution
  UNION ALL
  SELECT false, 5, bucket_counts.line_item_array_state, bucket_counts.mutable_analysis_row_count
  FROM bucket_counts CROSS JOIN decision WHERE NOT suppress_distribution
)
SELECT distribution_suppressed, suppression_threshold, line_item_array_state, mutable_analysis_row_count
FROM output_rows
ORDER BY line_item_array_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-009 — Description-shape distribution

1. **Stable ID:** `A04-PR-009`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Expand only the guarded approved `line_items` array and classify each element's `description` as `missing`, `wrong_type`, `empty`, or `nonempty` without returning content.
4. **Confirmed source bindings:** Four allowlisted relations; exact frozen restricted predicate; `line_items[].description` only.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `description_shape_state`, `extracted_line_item_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Exact restricted parent rows, then JSON expansion of the guarded nonempty array; at most four unsuppressed rows or one suppressed row. Expansion size is bounded operationally by the 10-second timeout and 50 MB source-size gate; no arbitrary source-row limit is used.
9. **Index/constraint dependency:** Same as `A04-PR-005`; no JSON index assumed.
10. **Safety rationale:** Description content never appears in grouping or output; only JSON type and zero-length state are used.
11. **Suppression behavior:** Whole-distribution suppression at threshold 5.
12. **Hard-stop conditions:** Description content/snippet/hash/token appears; wrong path; suppression/output mismatch; timeout; unexpected expansion behavior.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH restricted_parent AS (
  SELECT a.full_json
  FROM public.analyses AS a
  JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  JOIN public.leads AS l ON l.id = a.lead_id
  WHERE a.analysis_status = 'complete'
    AND a.document_is_window_door_related IS TRUE
    AND a.confidence_score BETWEEN 0.4 AND 1
    AND a.document_type IS NOT NULL
    AND btrim(a.document_type) <> ''
    AND lower(btrim(a.document_type)) <> 'unknown'
    AND s.id = a.scan_session_id
    AND s.status IN ('preview_ready', 'awaiting_verification', 'revealed')
    AND qf.id = s.quote_file_id
    AND l.id = a.lead_id
    AND l.is_test IS FALSE
    AND a.full_json IS NOT NULL
    AND jsonb_typeof(a.full_json) = 'object'
    AND jsonb_typeof(a.full_json -> 'extraction') = 'object'
    AND jsonb_typeof(a.full_json -> 'extraction' -> 'line_items') = 'array'
    AND jsonb_array_length(a.full_json -> 'extraction' -> 'line_items') >= 1
    AND a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), classified AS (
  SELECT
    CASE
      WHEN jsonb_typeof(line_item.value) <> 'object' THEN 'wrong_type'
      WHEN line_item.value -> 'description' IS NULL THEN 'missing'
      WHEN jsonb_typeof(line_item.value -> 'description') <> 'string' THEN 'wrong_type'
      WHEN length(line_item.value ->> 'description') = 0 THEN 'empty'
      ELSE 'nonempty'
    END AS description_shape_state
  FROM restricted_parent
  CROSS JOIN LATERAL jsonb_array_elements(
    restricted_parent.full_json -> 'extraction' -> 'line_items'
  ) AS line_item(value)
), bucket_counts AS (
  SELECT description_shape_state, COUNT(*) AS extracted_line_item_count
  FROM classified
  GROUP BY description_shape_state
  HAVING COUNT(*) > 0
), decision AS (
  SELECT COALESCE(bool_or(extracted_line_item_count BETWEEN 1 AND 4), false) AS suppress_distribution
  FROM bucket_counts
), output_rows AS (
  SELECT true AS distribution_suppressed, 5 AS suppression_threshold,
         NULL::text AS description_shape_state, NULL::bigint AS extracted_line_item_count
  FROM decision WHERE suppress_distribution
  UNION ALL
  SELECT false, 5, bucket_counts.description_shape_state, bucket_counts.extracted_line_item_count
  FROM bucket_counts CROSS JOIN decision WHERE NOT suppress_distribution
)
SELECT distribution_suppressed, suppression_threshold, description_shape_state, extracted_line_item_count
FROM output_rows
ORDER BY description_shape_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-010 — Nonempty description-length distribution

1. **Stable ID:** `A04-PR-010`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Assign runtime-string, nonempty descriptions to the four frozen character-length buckets without returning or grouping by content.
4. **Confirmed source bindings:** Four allowlisted relations; exact frozen restricted predicate; `line_items[].description` only.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `description_length_state`, `extracted_line_item_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Exact restricted parent rows and guarded array expansion; at most four unsuppressed rows or one suppressed row.
9. **Index/constraint dependency:** Same as `A04-PR-009`.
10. **Safety rationale:** Only character length is evaluated. No text, token, hash, sample, or distinct content leaves the query.
11. **Suppression behavior:** Whole-distribution suppression at threshold 5.
12. **Hard-stop conditions:** Any bucket outside the frozen four; content exposure; suppression/output mismatch; timeout; preflight/review failure.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH restricted_parent AS (
  SELECT a.full_json
  FROM public.analyses AS a
  JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  JOIN public.leads AS l ON l.id = a.lead_id
  WHERE a.analysis_status = 'complete'
    AND a.document_is_window_door_related IS TRUE
    AND a.confidence_score BETWEEN 0.4 AND 1
    AND a.document_type IS NOT NULL
    AND btrim(a.document_type) <> ''
    AND lower(btrim(a.document_type)) <> 'unknown'
    AND s.id = a.scan_session_id
    AND s.status IN ('preview_ready', 'awaiting_verification', 'revealed')
    AND qf.id = s.quote_file_id
    AND l.id = a.lead_id
    AND l.is_test IS FALSE
    AND a.full_json IS NOT NULL
    AND jsonb_typeof(a.full_json) = 'object'
    AND jsonb_typeof(a.full_json -> 'extraction') = 'object'
    AND jsonb_typeof(a.full_json -> 'extraction' -> 'line_items') = 'array'
    AND jsonb_array_length(a.full_json -> 'extraction' -> 'line_items') >= 1
    AND a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), measured AS (
  SELECT length(line_item.value ->> 'description') AS description_length
  FROM restricted_parent
  CROSS JOIN LATERAL jsonb_array_elements(
    restricted_parent.full_json -> 'extraction' -> 'line_items'
  ) AS line_item(value)
  WHERE jsonb_typeof(line_item.value) = 'object'
    AND jsonb_typeof(line_item.value -> 'description') = 'string'
    AND length(line_item.value ->> 'description') >= 1
), classified AS (
  SELECT
    CASE
      WHEN description_length <= 80 THEN 'short_1_to_80'
      WHEN description_length <= 240 THEN 'medium_81_to_240'
      WHEN description_length <= 500 THEN 'long_241_to_500'
      ELSE 'oversized_501_plus'
    END AS description_length_state
  FROM measured
), bucket_counts AS (
  SELECT description_length_state, COUNT(*) AS extracted_line_item_count
  FROM classified
  GROUP BY description_length_state
  HAVING COUNT(*) > 0
), decision AS (
  SELECT COALESCE(bool_or(extracted_line_item_count BETWEEN 1 AND 4), false) AS suppress_distribution
  FROM bucket_counts
), output_rows AS (
  SELECT true AS distribution_suppressed, 5 AS suppression_threshold,
         NULL::text AS description_length_state, NULL::bigint AS extracted_line_item_count
  FROM decision WHERE suppress_distribution
  UNION ALL
  SELECT false, 5, bucket_counts.description_length_state, bucket_counts.extracted_line_item_count
  FROM bucket_counts CROSS JOIN decision WHERE NOT suppress_distribution
)
SELECT distribution_suppressed, suppression_threshold, description_length_state, extracted_line_item_count
FROM output_rows
ORDER BY description_length_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

## 8. Human-review checklist

### Target and authority

- [ ] Dashboard shows project `WMProd`, branch `forensic_report_v1`, and branch ref `zgsofkgddpcntdvpckdq` immediately before each query.
- [ ] Prohibited parent ref `wkrcyxcnzhwjtdpmfpaf` is not selected or queried.
- [ ] A separate authorization explicitly permits the exact query about to be executed.
- [ ] The execution role and PostgreSQL version match `A04-PF-001`.

### Static SQL review

- [ ] Query ID and exact SQL match this artifact byte-for-byte; there are no ad hoc edits.
- [ ] Transaction is `BEGIN TRANSACTION READ ONLY` and ends with `ROLLBACK`.
- [ ] All three literal timeouts and the frozen `search_path` are present.
- [ ] Application SQL references only `public.analyses`, `public.scan_sessions`, `public.quote_files`, and `public.leads`.
- [ ] JSON access is limited to `full_json.extraction.line_items[]` and `description` with parent-first guards.
- [ ] Output columns exactly match the positive allowlist.
- [ ] No identifiers, raw JSON, raw text, PII, filenames, paths, contractor names, hashes, tokens, or other prohibited values can be output.
- [ ] No monetary, opening, quantity, dimension, cohort, market, benchmark, quote/revision, duplicate, current, or supersession metric is present.
- [ ] Every segmented output uses whole-distribution suppression; a 1–4 cell yields only one control row.

### Preflight gate

- [ ] `A04-PF-001` through `A04-PF-006` were executed one at a time under separate authorization.
- [ ] Every expected column and row count matched.
- [ ] Every binding and size status is `PASS`.
- [ ] Every required index is valid and ready.
- [ ] Date-index presence/absence is explicitly reviewed; any possible full scan is accepted only while the size gate remains under the approved limits.
- [ ] No relation estimate is negative/unavailable or above 10,000.
- [ ] Combined relation bytes do not exceed 50,000,000.

### Application-query gate

- [ ] All preflight results were evaluated and recorded before any `A04-PR-*` query.
- [ ] Human security and privacy review approved the exact application query.
- [ ] Separate application-query execution authorization was recorded.
- [ ] The operator will execute one query, inspect its output shape, record the result, and stop before the next query.

## 9. Manual execution ledger template

| Query ID | File | Purpose | Target/role reverified | Human review | Execution authorization | Execution time UTC | Status | Output columns valid | Output rows | Suppressed | Scan/full-scan note | Duration | Timed out | Build-blocking | Limitation |
|---|---|---|---|---|---|---|---|---|---:|---|---|---|---|---|---|
| A04-PF-001 | Audit 04 | Identity/version/role | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | N/A | Catalog only | NOT_EXECUTED | NOT_EXECUTED | YES until pass | |
| A04-PF-002 | Audit 04 | Relations/RLS | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | N/A | Catalog only | NOT_EXECUTED | NOT_EXECUTED | YES until pass | |
| A04-PF-003 | Audit 04 | Columns/types | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | N/A | Catalog only | NOT_EXECUTED | NOT_EXECUTED | YES until pass | |
| A04-PF-004 | Audit 04 | Constraints | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | N/A | Catalog only | NOT_EXECUTED | NOT_EXECUTED | YES until pass | |
| A04-PF-005 | Audit 04 | Indexes | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | N/A | Catalog only | NOT_EXECUTED | NOT_EXECUTED | YES until pass | |
| A04-PF-006 | Audit 04 | Size gate | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | N/A | Catalog only | NOT_EXECUTED | NOT_EXECUTED | YES until pass | |
| A04-PR-001 | Audit 04 | Entity totals | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | N/A | PENDING_PREFLIGHT | NOT_EXECUTED | NOT_EXECUTED | UNKNOWN | |
| A04-PR-002 | Audit 04 | Analysis lifecycle | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | PENDING_PREFLIGHT | NOT_EXECUTED | NOT_EXECUTED | UNKNOWN | |
| A04-PR-003 | Audit 04 | Session lifecycle | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | PENDING_PREFLIGHT | NOT_EXECUTED | NOT_EXECUTED | UNKNOWN | |
| A04-PR-004 | Audit 04 | Exclusion funnel | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | PENDING_PREFLIGHT | NOT_EXECUTED | NOT_EXECUTED | UNKNOWN | |
| A04-PR-005 | Audit 04 | Restricted entity totals | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | N/A | PENDING_PREFLIGHT | NOT_EXECUTED | NOT_EXECUTED | UNKNOWN | |
| A04-PR-006 | Audit 04 | Confidence states | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | PENDING_PREFLIGHT | NOT_EXECUTED | NOT_EXECUTED | UNKNOWN | |
| A04-PR-007 | Audit 04 | Document-type states | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | PENDING_PREFLIGHT | NOT_EXECUTED | NOT_EXECUTED | UNKNOWN | |
| A04-PR-008 | Audit 04 | Line-item array states | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | PENDING_PREFLIGHT | NOT_EXECUTED | NOT_EXECUTED | UNKNOWN | |
| A04-PR-009 | Audit 04 | Description shape | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | PENDING_PREFLIGHT | NOT_EXECUTED | NOT_EXECUTED | UNKNOWN | |
| A04-PR-010 | Audit 04 | Description length | NOT_RECORDED | NOT_REVIEWED | NOT_AUTHORIZED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | PENDING_PREFLIGHT | NOT_EXECUTED | NOT_EXECUTED | UNKNOWN | |

Allowed execution statuses are `NOT_EXECUTED`, `PASS`, `SUCCESSFUL_EMPTY`, `SUPPRESSED`, `FAILED`, `TIMED_OUT`, and `STOPPED`. Any changed SQL requires regeneration and new review.

## 10. Aggregate-result template

### Execution identity

| Item | Value |
|---|---|
| Environment/project/branch/ref | NOT_RECORDED |
| PostgreSQL version | NOT_EXECUTED |
| Execution role and RLS visibility | NOT_EXECUTED |
| Authorization reference | NOT_RECORDED |
| SQL-pack SHA-256 | NOT_RECORDED |
| Execution UTC interval | NOT_EXECUTED |
| Preflight gate | NOT_EXECUTED |
| Application execution authorization | NOT_AUTHORIZED |
| Deep pack | NOT_AUTHORIZED / NOT_GENERATED |

### Query results

| Query ID | Expected result class | Aggregate result | Interpretation | Limitation | Status |
|---|---|---|---|---|---|
| A04-PF-001 | 1 metadata row | NOT_EXECUTED | No identity conclusion | Target ref still requires Dashboard verification | NOT_EXECUTED |
| A04-PF-002 | 4 metadata rows | NOT_EXECUTED | No relation/RLS conclusion | Catalog only | NOT_EXECUTED |
| A04-PF-003 | 15 metadata rows | NOT_EXECUTED | No column conclusion | Catalog only | NOT_EXECUTED |
| A04-PF-004 | 8 metadata rows | NOT_EXECUTED | No constraint conclusion | Catalog only | NOT_EXECUTED |
| A04-PF-005 | <=100 metadata rows | NOT_EXECUTED | No index conclusion | Catalog only | NOT_EXECUTED |
| A04-PF-006 | 4 metadata rows | NOT_EXECUTED | No size conclusion | Estimates, not exact counts | NOT_EXECUTED |
| A04-PR-001 | 1 aggregate row | NOT_EXECUTED | No operational conclusion | Persistence window only | NOT_EXECUTED |
| A04-PR-002 | Suppressed control or fixed distribution | NOT_EXECUTED | No lifecycle conclusion | Quality/operations only | NOT_EXECUTED |
| A04-PR-003 | Suppressed control or fixed distribution | NOT_EXECUTED | No lifecycle conclusion | Quality/operations only | NOT_EXECUTED |
| A04-PR-004 | Suppressed control or fixed distribution | NOT_EXECUTED | No eligibility conclusion | Predicate supports restricted quality only | NOT_EXECUTED |
| A04-PR-005 | 1 aggregate row | NOT_EXECUTED | No population conclusion | Not quote/project/market count | NOT_EXECUTED |
| A04-PR-006 | Suppressed control or fixed distribution | NOT_EXECUTED | No confidence-quality conclusion | No historical model comparability | NOT_EXECUTED |
| A04-PR-007 | Suppressed control or fixed distribution | NOT_EXECUTED | No document-type conclusion | Raw types prohibited | NOT_EXECUTED |
| A04-PR-008 | Suppressed control or fixed distribution | NOT_EXECUTED | No array-quality conclusion | Not opening/quantity count | NOT_EXECUTED |
| A04-PR-009 | Suppressed control or fixed distribution | NOT_EXECUTED | No description-shape conclusion | Content prohibited | NOT_EXECUTED |
| A04-PR-010 | Suppressed control or fixed distribution | NOT_EXECUTED | No description-length conclusion | Content prohibited | NOT_EXECUTED |

Results must remain tied to the exact target, role, SQL text, date interval, and execution time. A suppressed result supports no reconstruction or bucket-level interpretation.

## 11. Disabled and omitted query register

| Disabled or omitted area | Status | Reason |
|---|---|---|
| Deep profiling pack | `NOT_GENERATED` | Deep-pack generation was not authorized; no inert deep SQL is emitted |
| Monetary, price, deposit, tax, fee, discount, financing, allowance, optional-work, and `_cents` profiling | `DISABLED_UNBOUND_SEMANTICS` | Runtime contract, source unit, currency, basis, writer, and conversion are unbound |
| Arithmetic/reconciliation and tolerance hypotheses | `DISABLED_UNBOUND_SEMANTICS` | No monetary or quantity binding; no tolerance authority supplied |
| Opening, quantity, dimensions, united inches, and per-opening calculations | `DISABLED_UNBOUND_SEMANTICS` | Array length is only extracted line-item count |
| Product, contractor, geography, campaign, acquisition, outcome, and market cohorts | `DISABLED_UNSUPPORTED` | Restricted Phase 0 pack does not authorize these dimensions; privacy/concentration semantics are absent |
| Benchmark generation or assessment | `DISABLED_UNSUPPORTED` | No approved market population, quote identity, current-record rule, or benchmark authority |
| Quote/project/revision/immutable-attempt counts | `DISABLED_UNSUPPORTED_IDENTITY` | These identities are absent or unbound |
| Duplicate, re-analysis frequency, current-record, and supersession metrics | `DISABLED_UNSUPPORTED_IDENTITY` | No immutable attempt, duplicate, revision, or supersession rule |
| Historical model/prompt/parser/schema comparisons or trends | `DISABLED_UNVERSIONED` | Per-analysis versions are not persisted |
| Values from `wm_quote_facts`, `quote_observations`, `quote_line_items`, `normalization_failures`, `wm_quote_reviews`, `wm_pricing_index_snapshots`, event tables, or `contractor_outcomes` | `DISABLED_SOURCE_NOT_ALLOWLISTED` | Not authoritative restricted sources |
| `county_benchmarks` and `quote_intelligence_facts` | `DISABLED_CONFIRMED_ABSENT` | Exact deployed relations were absent in Audit 03C |
| Arbitrary `full_json` fields and key enumeration | `NOT_PROFILED_UNBOUND` | Deployed response validator is shallow and unknown keys survive |
| Non-runtime-enforced extraction fields | `NOT_PROFILED_UNBOUND` | Founder decision FD-03D-008 is `DEFER_UNSUPPORTED` |
| PII, source text, contractor names, addresses, filenames, Storage paths, raw JSON, descriptions, and free text | `NOT_PROFILED_PII` | Explicit privacy/security prohibition |
| Raw or distinct `document_type` values | `NOT_PROFILED_UNBOUND` | No category allowlist; only frozen validity states are authorized |
| Description content, snippets, tokens, hashes, normalized text, or inferred categories | `NOT_PROFILED_PII` | Only shape and character-length buckets are permitted |
| Additional test/demo/source marker rules | `DISABLED_UNBOUND` | `leads.is_test` is the only confirmed test indicator |
| Date min/max or quote-date coverage | `OMITTED_NOT_REQUIRED` | The approved field is persistence time, and the date interval is already frozen |

## 12. Hard stops

Stop immediately and do not edit SQL ad hoc when:

- the Dashboard target is not exactly branch ref `zgsofkgddpcntdvpckdq`, or the prohibited parent is selected;
- authorization is absent, expired, or does not name the exact query;
- database, PostgreSQL version, role, role attributes, relation, column, type, nullability, constraint, index, or RLS metadata differs;
- any relation estimate is negative/unavailable or exceeds 10,000, or combined bytes exceed 50,000,000;
- a full scan is possible and has not received explicit review after the size preflight;
- an output column or row count differs from the positive allowlist and documented maximum;
- any raw value, identifier, PII, free text, raw JSON, filename, Storage path, contractor name, hash, token, or prohibited metric appears;
- suppression fails, a suppressed distribution contains any bucket/count/total, or a small cell can be reconstructed from generated outputs;
- a timeout, permission error, unexpected result, or transaction-control mismatch occurs;
- a required preflight is not `PASS`; or
- anyone treats pack generation, review, or a preflight result as application-query execution authorization.

After a stop, preserve the evidence, record the exact query and result shape safely, and regenerate/re-review if a binding changed.

## 13. Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Build implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|
| A04-E-001 | CONFIRMED | Audit 00 was recovered exactly from the operator-marked canonical block | Current task and artifact | `docs/audits/00_AUDIT_PROTOCOL_AND_SEQUENCE.md`; SHA-256 `B690A53F0D3A32076F337F10E4EB8A652E2E98018EF7A601425A2FE866DD0383` | Protocol exists and was read back completely | Governs this pack | High | Preserve artifact |
| A04-E-002 | CONFIRMED | Exact deployed target, PostgreSQL version, role visibility, physical objects, keys, indexes, and size estimates were validated from manual metadata execution | Audit 03C | A03C-001–A03C-016; `SB-MD-001`–`023` | Target evidence supports bounded catalog preflights and four-relation bindings | Preflights must revalidate before any application query | High | Manual preflight review |
| A04-E-003 | CONFIRMED | Deployed extraction response has only a restricted runtime-enforced subset | Audit 03D | A03D-009–A03D-015 | Arbitrary or incorrectly typed fields can survive into `full_json.extraction` | Only approved line-item/description branch is referenced | Very high | Do not broaden |
| A04-E-004 | CONFIRMED | Founder approved the exact restricted predicate, source allowlist, exclusions, identity labels, and historical rule | Audits 03E–03F | FD-03D-001–008; A03F-001–A03F-008 | Unsupported semantics are disabled rather than inferred | Restricted generation gate satisfied | High | Preserve decisions |
| A04-E-005 | CONFIRMED | SQL generation is authorized and SQL execution is not | Operator standalone Audit 04 authorization | Current task | This artifact may be created; no query may be run | Human review and separate execution authorization required | High | Review only |
| A04-E-006 | CONFIRMED | No SQL, database connection, service, Storage object, build, test, migration, deployment, or external request occurred during generation | Current task activity | Tool record | Only local reads and authorized Markdown writes occurred | No production state changed | High | None |

## 14. Limitations

- No generated query has been reviewed or executed; every result remains `NOT_EXECUTED`.
- The Supabase branch ref cannot be independently proven by PostgreSQL session metadata; the operator must verify it in the Dashboard before every query.
- Catalog row estimates are estimates and may be stale; a negative estimate is a hard stop rather than zero.
- The reviewed role bypasses RLS, so exact query text and output restrictions—not RLS—must protect data.
- No current application-data distribution, join rate, test prevalence, restricted-population size, description shape, or timeout behavior is known.
- Historical scanner model, prompt, parser, and extraction-schema versions remain unavailable.
- `leads.is_test` completeness remains unvalidated.
- A missing `analyses.created_at` index may cause a bounded full scan. It requires explicit review and size-gate acceptance; it is not called indexed.
- JSON array expansion may multiply rows; the approved relation-size gate and 10-second timeout are the operative bounds. A timeout stops the pack.
- Quality-shape results do not establish semantic correctness, quote uniqueness, representativeness, market eligibility, or benchmark fitness.

## 15. Audit 05 handoff requirements

Audit 05 must not start until the evidence packet includes:

1. this exact artifact identity and SHA-256;
2. completed human SQL, security, and privacy review records;
3. separate execution authorizations for the preflight and application phases;
4. confirmed target and execution-role identity at execution time;
5. a complete query ledger for every generated query;
6. all preflight outputs and the recorded gate decision;
7. every application aggregate result, successful-empty result, suppressed result, failure, and timeout;
8. confirmation that no prohibited output occurred;
9. extraction-path coverage limited to the restricted runtime subset;
10. the disabled-query register, retained unknowns, and selection limitations; and
11. a statement that unsupported monetary, cohort, benchmark, quote/revision, duplicate, and market conclusions remain disabled.

Unexecuted, environment-mismatched, role-mismatched, suppressed, failed, or timed-out results remain unknown. `GATE_PROFILE` is not satisfied by this generation artifact.

AUDIT_04_SQL_PACK_GENERATED_AWAITING_HUMAN_REVIEW
SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED
