# Schema Binding Metadata Query Pack

## Execution identity

| Field | Value |
|---|---|
| Artifact | `03B_SCHEMA_BINDING_METADATA_QUERY_PACK.md` |
| Generation time | `2026-08-30T22:14:33.2264322Z` |
| Generation environment | `CODEX`, local Windows PowerShell |
| Canonical repository | `C:\Projects\wm-mvp-github-clean` |
| Git branch | `forensic_report_v2` |
| Commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Supabase organization/project display name | `WMProd` — operator-confirmed |
| Parent/main project ref | `wkrcyxcnzhwjtdpmfpaf` — dormant and explicitly out of scope |
| Target branch name | `forensic_report_v1` — operator-confirmed |
| Target branch instance ref | `zgsofkgddpcntdvpckdq` — operator-confirmed |
| Target API hostname | `https://zgsofkgddpcntdvpckdq.supabase.co` — operator-confirmed |
| Target operational environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD` — operator-confirmed |
| SQL execution in this task | `NOT_AUTHORIZED / NOT_EXECUTED` |
| Pack purpose | Human review and later one-query-at-a-time manual execution in the target branch SQL Editor |
| Pack scope | PostgreSQL/Supabase metadata only; no Audit 04 data profiling |

## Corrected target-identity binding

The target is an independently addressable Supabase branch database inside the `WMProd` project. It is not the parent/main database.

Only the SQL Editor already opened on branch instance `zgsofkgddpcntdvpckdq` / `forensic_report_v1` is authorized. The parent/main ref `wkrcyxcnzhwjtdpmfpaf` must not be inspected, queried, compared, modified, merged, or used as a fallback.

PostgreSQL catalog SQL cannot independently prove the Supabase project or branch ref. The operator must verify the selected Dashboard branch and browser hostname before every execution session. A mismatch is a hard stop.

## Authorization and safety contract

Authorized later, after human review:

- manual execution by the operator in the exact target branch SQL Editor;
- metadata-only, aggregate-only, bounded, read-only queries;
- one reviewed query block at a time.

Not authorized:

- agent or connector database execution;
- DDL, DML, migration execution, deployment, or configuration changes;
- application-table row retrieval or profiling;
- JSON or `full_json` inspection;
- function, RPC, Edge Function, webhook, queue, or external-service invocation;
- Storage object listing or object-name/path retrieval;
- logs, customer records, PII, secrets, credentials, connection strings, or keys;
- queries against the dormant parent/main database;
- Audit 04 execution or generation.

Every executable block below:

- begins `BEGIN TRANSACTION READ ONLY`;
- sets `statement_timeout` to 10 seconds;
- sets `lock_timeout` to 1 second;
- sets `idle_in_transaction_session_timeout` to 15 seconds;
- pins transaction-local `search_path` to `pg_catalog, information_schema`;
- returns at most 500 metadata rows;
- uses catalog, information-schema, Supabase metadata, Storage metadata, or Cron metadata only;
- ends with `ROLLBACK`.

## Manual execution protocol

Before each query:

1. Confirm the Dashboard is on `WMProd` → branch `forensic_report_v1`.
2. Confirm the branch/API ref visible in the browser is `zgsofkgddpcntdvpckdq`.
3. Confirm the SQL text exactly matches the reviewed query block.
4. Execute only that one block.
5. Save only its metadata result and execution status in the audit results record.
6. Stop on a timeout, permission error, missing dependency, unexpected output shape, more than 500 rows, sensitive output, or identity uncertainty.

Do not edit failed SQL ad hoc. Record the failure, stop, and regenerate the affected query for renewed review.

## Allowlisted application objects

The public-object queries use only this exact allowlist:

```text
leads
quote_files
scan_sessions
analyses
phone_verifications
wm_quote_facts
quote_observations
quote_line_items
normalization_failures
wm_quote_reviews
wm_pricing_index_snapshots
county_benchmarks
quote_intelligence_facts
wm_event_log
lead_events
event_logs
contractor_outcomes
```

The only non-public metadata relations directly queried are:

```text
supabase_migrations.schema_migrations
storage.buckets
cron.job
```

`storage.objects`, `cron.job_run_details`, application rows, and function bodies are never selected.

## Query ledger

| Query ID | Purpose | Maximum rows | Dependency | Initial status |
|---|---|---:|---|---|
| `SB-MD-001` | Execution role and PostgreSQL version | 1 | Manual branch identity check | `NOT_EXECUTED` |
| `SB-MD-002` | Relevant schema existence and ownership | 10 | `SB-MD-001` accepted | `NOT_EXECUTED` |
| `SB-MD-003` | Exact allowlisted relation existence, kind, owner, and RLS flags | 25 | `SB-MD-002` | `NOT_EXECUTED` |
| `SB-MD-004` | Bounded public view/materialized-view inventory | 500 | `SB-MD-002` | `NOT_EXECUTED` |
| `SB-MD-005` | Allowlisted columns and PostgreSQL types | 500 | `SB-MD-003` | `NOT_EXECUTED` |
| `SB-MD-006` | Primary, unique, and foreign-key constraints | 500 | `SB-MD-003` | `NOT_EXECUTED` |
| `SB-MD-007` | Index metadata without definitions or predicates | 500 | `SB-MD-003` | `NOT_EXECUTED` |
| `SB-MD-008` | Catalog row estimates and relation sizes | 500 | `SB-MD-003` | `NOT_EXECUTED` |
| `SB-MD-009` | Sanitized public-table RLS policy metadata | 500 | `SB-MD-003` | `NOT_EXECUTED` |
| `SB-MD-010` | Allowlisted table/view grants | 500 | `SB-MD-003` | `NOT_EXECUTED` |
| `SB-MD-011` | Named function/RPC signatures, owners, and security modes | 500 | `SB-MD-002` | `NOT_EXECUTED` |
| `SB-MD-012` | Named function/RPC execute grants | 500 | `SB-MD-011` | `NOT_EXECUTED` |
| `SB-MD-013` | Trigger names, enablement, events, and handler identity | 500 | `SB-MD-003` | `NOT_EXECUTED` |
| `SB-MD-014` | Migration-history relation column preflight | 500 | `SB-MD-003` confirms relation | `NOT_EXECUTED` |
| `SB-MD-015` | Applied migration ledger without SQL statements | 500 | `SB-MD-014` confirms `version` and `name` | `NOT_EXECUTED` |
| `SB-MD-016` | Storage bucket relation column preflight | 500 | `SB-MD-003` confirms relation | `NOT_EXECUTED` |
| `SB-MD-017` | `quotes` bucket metadata without object rows | 1 | `SB-MD-016` confirms selected columns | `NOT_EXECUTED` |
| `SB-MD-018` | Sanitized Storage policy metadata | 500 | `SB-MD-003` confirms Storage relations | `NOT_EXECUTED` |
| `SB-MD-019` | `pg_cron` extension and `cron.job` relation gate | 10 | `SB-MD-002` | `NOT_EXECUTED` |
| `SB-MD-020` | `cron.job` column preflight | 500 | `SB-MD-019` confirms relation | `NOT_EXECUTED` |
| `SB-MD-021` | Scheduled-job names and enabled state only | 500 | `SB-MD-020` confirms selected columns | `NOT_EXECUTED` |

## `SB-MD-001` — Execution identity and PostgreSQL version

Purpose: record the database name, SQL role visibility, and PostgreSQL version. This query does not prove the Supabase branch ref; the Dashboard branch check remains mandatory.

Expected columns: `database_name`, `current_role`, `session_role`, `server_version`, `server_version_num`.

Estimated scope: one settings/identity row; no relation scan.

Safety rationale: uses built-in session and settings functions only.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

SELECT
  current_database()::text AS database_name,
  current_user::text AS current_role,
  session_user::text AS session_role,
  current_setting('server_version') AS server_version,
  current_setting('server_version_num') AS server_version_num
LIMIT 1;

ROLLBACK;
```

## `SB-MD-002` — Relevant schema existence and ownership

Purpose: confirm only the schemas needed for the binding pack.

Expected columns: `schema_name`, `schema_owner`.

Estimated scope: at most six `pg_namespace` rows.

Safety rationale: exact-name catalog filter; no application relation access.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

SELECT
  n.nspname AS schema_name,
  pg_get_userbyid(n.nspowner) AS schema_owner
FROM pg_catalog.pg_namespace AS n
WHERE n.nspname IN (
  'public',
  'storage',
  'auth',
  'supabase_migrations',
  'cron',
  'extensions'
)
ORDER BY n.nspname
LIMIT 500;

ROLLBACK;
```

## `SB-MD-003` — Exact allowlisted relation inventory and RLS state

Purpose: return one row for every required relation candidate, including explicit `ABSENT` results.

Expected columns: `schema_name`, `object_name`, `object_kind`, `object_owner`, `rls_enabled`, `rls_forced`, `persistence`.

Estimated scope: 21 exact catalog lookups.

Safety rationale: exact object allowlist; no relation contents are read.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

WITH allowlisted(schema_name, object_name) AS (
  VALUES
    ('public', 'leads'),
    ('public', 'quote_files'),
    ('public', 'scan_sessions'),
    ('public', 'analyses'),
    ('public', 'phone_verifications'),
    ('public', 'wm_quote_facts'),
    ('public', 'quote_observations'),
    ('public', 'quote_line_items'),
    ('public', 'normalization_failures'),
    ('public', 'wm_quote_reviews'),
    ('public', 'wm_pricing_index_snapshots'),
    ('public', 'county_benchmarks'),
    ('public', 'quote_intelligence_facts'),
    ('public', 'wm_event_log'),
    ('public', 'lead_events'),
    ('public', 'event_logs'),
    ('public', 'contractor_outcomes'),
    ('storage', 'buckets'),
    ('storage', 'objects'),
    ('supabase_migrations', 'schema_migrations'),
    ('cron', 'job')
)
SELECT
  a.schema_name,
  a.object_name,
  CASE c.relkind
    WHEN 'r' THEN 'TABLE'
    WHEN 'p' THEN 'PARTITIONED_TABLE'
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED_VIEW'
    WHEN 'f' THEN 'FOREIGN_TABLE'
    ELSE 'ABSENT'
  END AS object_kind,
  CASE WHEN c.oid IS NULL THEN NULL ELSE pg_get_userbyid(c.relowner) END AS object_owner,
  CASE WHEN c.relkind IN ('r', 'p') THEN c.relrowsecurity ELSE NULL END AS rls_enabled,
  CASE WHEN c.relkind IN ('r', 'p') THEN c.relforcerowsecurity ELSE NULL END AS rls_forced,
  CASE c.relpersistence
    WHEN 'p' THEN 'PERMANENT'
    WHEN 'u' THEN 'UNLOGGED'
    WHEN 't' THEN 'TEMPORARY'
    ELSE NULL
  END AS persistence
FROM allowlisted AS a
LEFT JOIN pg_catalog.pg_namespace AS n
  ON n.nspname = a.schema_name
LEFT JOIN pg_catalog.pg_class AS c
  ON c.relnamespace = n.oid
 AND c.relname = a.object_name
 AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
ORDER BY a.schema_name, a.object_name
LIMIT 500;

ROLLBACK;
```

## `SB-MD-004` — Bounded public view and materialized-view inventory

Purpose: identify public read models that could affect Data API exposure or Audit 04 source selection. Definitions are deliberately excluded.

Expected columns: `schema_name`, `view_name`, `view_kind`, `view_owner`, `security_invoker_setting`.

Estimated scope: all public views/materialized views, capped at 500 rows.

Safety rationale: catalog names/options only; no view is selected and no definition is returned.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

SELECT
  n.nspname AS schema_name,
  c.relname AS view_name,
  CASE c.relkind
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED_VIEW'
  END AS view_kind,
  pg_get_userbyid(c.relowner) AS view_owner,
  COALESCE(
    (
      SELECT string_agg(opt, ', ' ORDER BY opt)
      FROM unnest(c.reloptions) AS opt
      WHERE split_part(opt, '=', 1) = 'security_invoker'
    ),
    'NOT_SET'
  ) AS security_invoker_setting
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('v', 'm')
ORDER BY c.relkind, c.relname
LIMIT 500;

ROLLBACK;
```

## `SB-MD-005` — Allowlisted columns and PostgreSQL data types

Purpose: bind exact column names, ordering, nullability, and PostgreSQL types for Audit 04 candidates.

Expected columns: schema/table/column identity, ordinal position, data/UDT type, length/precision, nullability, identity, and generated-column metadata.

Estimated scope: allowlisted relation columns only, capped at 500 rows.

Safety rationale: `information_schema.columns` metadata only; defaults and application values are omitted.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

WITH allowlisted(schema_name, object_name) AS (
  VALUES
    ('public', 'leads'),
    ('public', 'quote_files'),
    ('public', 'scan_sessions'),
    ('public', 'analyses'),
    ('public', 'phone_verifications'),
    ('public', 'wm_quote_facts'),
    ('public', 'quote_observations'),
    ('public', 'quote_line_items'),
    ('public', 'normalization_failures'),
    ('public', 'wm_quote_reviews'),
    ('public', 'wm_pricing_index_snapshots'),
    ('public', 'county_benchmarks'),
    ('public', 'quote_intelligence_facts'),
    ('public', 'wm_event_log'),
    ('public', 'lead_events'),
    ('public', 'event_logs'),
    ('public', 'contractor_outcomes')
)
SELECT
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_schema,
  c.udt_name,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale,
  c.datetime_precision,
  c.is_nullable,
  c.is_identity,
  c.identity_generation,
  c.is_generated
FROM information_schema.columns AS c
JOIN allowlisted AS a
  ON a.schema_name = c.table_schema
 AND a.object_name = c.table_name
ORDER BY c.table_schema, c.table_name, c.ordinal_position
LIMIT 500;

ROLLBACK;
```

## `SB-MD-006` — Primary, unique, and foreign-key constraints

Purpose: bind identity, uniqueness, and join paths without returning check expressions or constraint definitions.

Expected columns: relation, constraint name/type, ordered columns, referenced relation/columns, update/delete actions, deferrability, and validation state.

Estimated scope: constraints on the exact public allowlist, capped at 500 rows.

Safety rationale: catalog OIDs and attribute names only; no application values or expression text.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

WITH allowlisted(object_name) AS (
  VALUES
    ('leads'), ('quote_files'), ('scan_sessions'), ('analyses'),
    ('phone_verifications'), ('wm_quote_facts'), ('quote_observations'),
    ('quote_line_items'), ('normalization_failures'), ('wm_quote_reviews'),
    ('wm_pricing_index_snapshots'), ('county_benchmarks'),
    ('quote_intelligence_facts'), ('wm_event_log'), ('lead_events'),
    ('event_logs'), ('contractor_outcomes')
)
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  con.conname AS constraint_name,
  CASE con.contype
    WHEN 'p' THEN 'PRIMARY_KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN_KEY'
  END AS constraint_type,
  ARRAY(
    SELECT a.attname
    FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_catalog.pg_attribute AS a
      ON a.attrelid = con.conrelid
     AND a.attnum = k.attnum
    ORDER BY k.ord
  ) AS columns,
  rn.nspname AS referenced_schema,
  rc.relname AS referenced_table,
  ARRAY(
    SELECT a.attname
    FROM unnest(con.confkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_catalog.pg_attribute AS a
      ON a.attrelid = con.confrelid
     AND a.attnum = k.attnum
    ORDER BY k.ord
  ) AS referenced_columns,
  CASE con.confupdtype
    WHEN 'a' THEN 'NO_ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET_NULL'
    WHEN 'd' THEN 'SET_DEFAULT'
    ELSE NULL
  END AS update_action,
  CASE con.confdeltype
    WHEN 'a' THEN 'NO_ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET_NULL'
    WHEN 'd' THEN 'SET_DEFAULT'
    ELSE NULL
  END AS delete_action,
  con.condeferrable AS is_deferrable,
  con.condeferred AS initially_deferred,
  con.convalidated AS is_validated
FROM pg_catalog.pg_constraint AS con
JOIN pg_catalog.pg_class AS c
  ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = c.relnamespace
JOIN allowlisted AS x
  ON x.object_name = c.relname
LEFT JOIN pg_catalog.pg_class AS rc
  ON rc.oid = con.confrelid
LEFT JOIN pg_catalog.pg_namespace AS rn
  ON rn.oid = rc.relnamespace
WHERE n.nspname = 'public'
  AND con.contype IN ('p', 'u', 'f')
ORDER BY c.relname, constraint_type, con.conname
LIMIT 500;

ROLLBACK;
```

## `SB-MD-007` — Index metadata

Purpose: identify primary, unique, supporting, partial, and expression indexes without returning definitions or predicate expressions.

Expected columns: relation, index name, uniqueness/primary/valid/ready flags, simple key columns, expression/partial flags.

Estimated scope: indexes on the exact public allowlist, capped at 500 rows.

Safety rationale: catalog metadata only; no index definitions, expression text, predicates, or application rows.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

WITH allowlisted(object_name) AS (
  VALUES
    ('leads'), ('quote_files'), ('scan_sessions'), ('analyses'),
    ('phone_verifications'), ('wm_quote_facts'), ('quote_observations'),
    ('quote_line_items'), ('normalization_failures'), ('wm_quote_reviews'),
    ('wm_pricing_index_snapshots'), ('county_benchmarks'),
    ('quote_intelligence_facts'), ('wm_event_log'), ('lead_events'),
    ('event_logs'), ('contractor_outcomes')
)
SELECT
  n.nspname AS schema_name,
  tbl.relname AS table_name,
  idx.relname AS index_name,
  i.indisprimary AS is_primary,
  i.indisunique AS is_unique,
  i.indisvalid AS is_valid,
  i.indisready AS is_ready,
  ARRAY(
    SELECT a.attname
    FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_catalog.pg_attribute AS a
      ON a.attrelid = i.indrelid
     AND a.attnum = k.attnum
    WHERE k.attnum > 0
      AND k.ord <= i.indnkeyatts
    ORDER BY k.ord
  ) AS simple_key_columns,
  (i.indexprs IS NOT NULL) AS has_expression_keys,
  (i.indpred IS NOT NULL) AS is_partial
FROM pg_catalog.pg_index AS i
JOIN pg_catalog.pg_class AS tbl
  ON tbl.oid = i.indrelid
JOIN pg_catalog.pg_class AS idx
  ON idx.oid = i.indexrelid
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = tbl.relnamespace
JOIN allowlisted AS x
  ON x.object_name = tbl.relname
WHERE n.nspname = 'public'
ORDER BY tbl.relname, idx.relname
LIMIT 500;

ROLLBACK;
```

## `SB-MD-008` — Catalog row estimates and relation sizes

Purpose: provide Audit 04 preflight size gates without counting or scanning application rows.

Expected columns: relation, catalog-estimated rows, heap/index/total bytes, and human-readable sizes.

Estimated scope: exact allowlisted public base/partitioned/materialized relations, capped at 500 rows.

Safety rationale: uses `pg_class.reltuples` and built-in relation-size metadata only; no application-table `SELECT` occurs.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

WITH allowlisted(object_name) AS (
  VALUES
    ('leads'), ('quote_files'), ('scan_sessions'), ('analyses'),
    ('phone_verifications'), ('wm_quote_facts'), ('quote_observations'),
    ('quote_line_items'), ('normalization_failures'), ('wm_quote_reviews'),
    ('wm_pricing_index_snapshots'), ('county_benchmarks'),
    ('quote_intelligence_facts'), ('wm_event_log'), ('lead_events'),
    ('event_logs'), ('contractor_outcomes')
)
SELECT
  n.nspname AS schema_name,
  c.relname AS relation_name,
  c.reltuples::bigint AS estimated_rows,
  pg_relation_size(c.oid) AS heap_bytes,
  pg_indexes_size(c.oid) AS index_bytes,
  pg_total_relation_size(c.oid) AS total_bytes,
  pg_size_pretty(pg_relation_size(c.oid)) AS heap_size,
  pg_size_pretty(pg_indexes_size(c.oid)) AS index_size,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = c.relnamespace
JOIN allowlisted AS x
  ON x.object_name = c.relname
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'm')
ORDER BY pg_total_relation_size(c.oid) DESC, c.relname
LIMIT 500;

ROLLBACK;
```

## `SB-MD-009` — Sanitized RLS policy metadata

Purpose: identify policy names, commands, roles, permissiveness, and predicate presence for allowlisted public tables.

Expected columns: relation, policy name, command, roles, permissiveness, `has_using`, `has_with_check`.

Estimated scope: policies on the exact public allowlist, capped at 500 rows.

Safety rationale: policy expressions are not returned, preventing sensitive literal or predicate disclosure.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

WITH allowlisted(object_name) AS (
  VALUES
    ('leads'), ('quote_files'), ('scan_sessions'), ('analyses'),
    ('phone_verifications'), ('wm_quote_facts'), ('quote_observations'),
    ('quote_line_items'), ('normalization_failures'), ('wm_quote_reviews'),
    ('wm_pricing_index_snapshots'), ('county_benchmarks'),
    ('quote_intelligence_facts'), ('wm_event_log'), ('lead_events'),
    ('event_logs'), ('contractor_outcomes')
)
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  p.polname AS policy_name,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS command,
  ARRAY(
    SELECT CASE
      WHEN role_oid = 0 THEN 'PUBLIC'
      ELSE pg_get_userbyid(role_oid)
    END
    FROM unnest(p.polroles) AS role_oid
    ORDER BY 1
  ) AS roles,
  p.polpermissive AS is_permissive,
  (p.polqual IS NOT NULL) AS has_using,
  (p.polwithcheck IS NOT NULL) AS has_with_check
FROM pg_catalog.pg_policy AS p
JOIN pg_catalog.pg_class AS c
  ON c.oid = p.polrelid
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = c.relnamespace
JOIN allowlisted AS x
  ON x.object_name = c.relname
WHERE n.nspname = 'public'
ORDER BY c.relname, p.polname
LIMIT 500;

ROLLBACK;
```

## `SB-MD-010` — Sanitized relation grants

Purpose: identify grants on allowlisted tables/views and the two Storage metadata relations.

Expected columns: schema, relation, grantee, privilege, grantable flag, hierarchy flag.

Estimated scope: exact allowlisted relation grants, capped at 500 rows.

Safety rationale: grant metadata only; grantors, passwords, credentials, role attributes, and relation rows are omitted.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

WITH allowlisted(schema_name, object_name) AS (
  VALUES
    ('public', 'leads'), ('public', 'quote_files'),
    ('public', 'scan_sessions'), ('public', 'analyses'),
    ('public', 'phone_verifications'), ('public', 'wm_quote_facts'),
    ('public', 'quote_observations'), ('public', 'quote_line_items'),
    ('public', 'normalization_failures'), ('public', 'wm_quote_reviews'),
    ('public', 'wm_pricing_index_snapshots'), ('public', 'county_benchmarks'),
    ('public', 'quote_intelligence_facts'), ('public', 'wm_event_log'),
    ('public', 'lead_events'), ('public', 'event_logs'),
    ('public', 'contractor_outcomes'),
    ('storage', 'buckets'), ('storage', 'objects')
)
SELECT
  g.table_schema,
  g.table_name,
  g.grantee,
  g.privilege_type,
  g.is_grantable,
  g.with_hierarchy
FROM information_schema.table_privileges AS g
JOIN allowlisted AS a
  ON a.schema_name = g.table_schema
 AND a.object_name = g.table_name
ORDER BY g.table_schema, g.table_name, g.grantee, g.privilege_type
LIMIT 500;

ROLLBACK;
```

## `SB-MD-011` — Named function and RPC metadata

Purpose: bind only function/RPC names identified by Audits 02–03, including overload signatures, ownership, security mode, volatility, and explicit function-level search-path settings.

Expected columns: schema, name, identity arguments, result type, kind, owner, security mode, volatility, leakproof/parallel flags, search-path setting.

Estimated scope: named public routines only, capped at 500 rows.

Safety rationale: no function body, source code, default argument expression, or execution occurs.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

WITH allowlisted(function_name) AS (
  VALUES
    ('get_analysis_preview'),
    ('get_analysis_full'),
    ('get_scan_status'),
    ('get_lead_by_session'),
    ('persist_lead_consent_batch'),
    ('set_latest_complete_analysis_pointer'),
    ('is_internal_operator'),
    ('update_updated_at')
)
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_get_function_result(p.oid) AS result_type,
  CASE p.prokind
    WHEN 'f' THEN 'FUNCTION'
    WHEN 'p' THEN 'PROCEDURE'
    WHEN 'a' THEN 'AGGREGATE'
    WHEN 'w' THEN 'WINDOW'
  END AS routine_kind,
  pg_get_userbyid(p.proowner) AS owner,
  CASE WHEN p.prosecdef THEN 'SECURITY_DEFINER' ELSE 'SECURITY_INVOKER' END AS security_mode,
  CASE p.provolatile
    WHEN 'i' THEN 'IMMUTABLE'
    WHEN 's' THEN 'STABLE'
    WHEN 'v' THEN 'VOLATILE'
  END AS volatility,
  p.proleakproof AS is_leakproof,
  p.proparallel AS parallel_mode,
  COALESCE(
    (
      SELECT string_agg(cfg, ', ' ORDER BY cfg)
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
      WHERE split_part(cfg, '=', 1) = 'search_path'
    ),
    'NOT_SET'
  ) AS search_path_setting
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = p.pronamespace
JOIN allowlisted AS a
  ON a.function_name = p.proname
WHERE n.nspname = 'public'
ORDER BY p.proname, identity_arguments
LIMIT 500;

ROLLBACK;
```

## `SB-MD-012` — Named function and RPC execute grants

Purpose: expose effective default/explicit ACL entries for the named routines without invoking them.

Expected columns: schema, function, identity arguments, grantee, privilege, grantable flag.

Estimated scope: ACL rows for named public routines, capped at 500 rows.

Safety rationale: catalog ACL expansion only; no function body or call.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

WITH allowlisted(function_name) AS (
  VALUES
    ('get_analysis_preview'),
    ('get_analysis_full'),
    ('get_scan_status'),
    ('get_lead_by_session'),
    ('persist_lead_consent_batch'),
    ('set_latest_complete_analysis_pointer'),
    ('is_internal_operator'),
    ('update_updated_at')
)
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  CASE
    WHEN acl.grantee = 0 THEN 'PUBLIC'
    ELSE pg_get_userbyid(acl.grantee)
  END AS grantee,
  acl.privilege_type,
  acl.is_grantable
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = p.pronamespace
JOIN allowlisted AS a
  ON a.function_name = p.proname
CROSS JOIN LATERAL aclexplode(
  COALESCE(p.proacl, acldefault('f', p.proowner))
) AS acl
WHERE n.nspname = 'public'
ORDER BY p.proname, identity_arguments, grantee, acl.privilege_type
LIMIT 500;

ROLLBACK;
```

## `SB-MD-013` — Trigger metadata without definitions

Purpose: identify trigger enablement, event classes, row/statement level, and handler identity on the exact public allowlist.

Expected columns: relation, trigger name, enablement, timing/event flags, handler schema/name/signature.

Estimated scope: non-internal triggers on allowlisted public tables, capped at 500 rows.

Safety rationale: returns no trigger definition and no function body; triggers are not invoked.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

WITH allowlisted(object_name) AS (
  VALUES
    ('leads'), ('quote_files'), ('scan_sessions'), ('analyses'),
    ('phone_verifications'), ('wm_quote_facts'), ('quote_observations'),
    ('quote_line_items'), ('normalization_failures'), ('wm_quote_reviews'),
    ('wm_pricing_index_snapshots'), ('county_benchmarks'),
    ('quote_intelligence_facts'), ('wm_event_log'), ('lead_events'),
    ('event_logs'), ('contractor_outcomes')
)
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  CASE t.tgenabled
    WHEN 'O' THEN 'ORIGIN'
    WHEN 'D' THEN 'DISABLED'
    WHEN 'R' THEN 'REPLICA'
    WHEN 'A' THEN 'ALWAYS'
  END AS enabled_mode,
  ((t.tgtype::integer & 1) <> 0) AS is_row_level,
  ((t.tgtype::integer & 2) <> 0) AS is_before,
  ((t.tgtype::integer & 64) <> 0) AS is_instead_of,
  ((t.tgtype::integer & 4) <> 0) AS on_insert,
  ((t.tgtype::integer & 8) <> 0) AS on_delete,
  ((t.tgtype::integer & 16) <> 0) AS on_update,
  ((t.tgtype::integer & 32) <> 0) AS on_truncate,
  pn.nspname AS handler_schema,
  p.proname AS handler_name,
  pg_get_function_identity_arguments(p.oid) AS handler_identity_arguments
FROM pg_catalog.pg_trigger AS t
JOIN pg_catalog.pg_class AS c
  ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = c.relnamespace
JOIN allowlisted AS a
  ON a.object_name = c.relname
JOIN pg_catalog.pg_proc AS p
  ON p.oid = t.tgfoid
JOIN pg_catalog.pg_namespace AS pn
  ON pn.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname
LIMIT 500;

ROLLBACK;
```

## `SB-MD-014` — Migration-history column preflight

Purpose: confirm the exact deployed columns before selecting migration metadata.

Expected columns: ordinal position, column name, type, UDT type, nullability.

Estimated scope: columns of one metadata relation, capped at 500 rows.

Safety rationale: information-schema metadata only. If `version` and `name` are not both present, do not execute `SB-MD-015`.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

SELECT
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_schema,
  c.udt_name,
  c.is_nullable
FROM information_schema.columns AS c
WHERE c.table_schema = 'supabase_migrations'
  AND c.table_name = 'schema_migrations'
ORDER BY c.ordinal_position
LIMIT 500;

ROLLBACK;
```

## `SB-MD-015` — Applied migration ledger

Purpose: return applied migration versions and names only, newest first.

Expected columns: `version`, `name`, `total_visible_migrations`.

Estimated scope: latest 500 migration metadata rows; no migration SQL statements.

Safety rationale: reads only Supabase migration-history metadata. Execute only if `SB-MD-014` confirms the exact selected columns. Stop if more than 500 total migrations are reported because the ledger would be incomplete.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

SELECT
  version,
  name,
  count(*) OVER () AS total_visible_migrations
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 500;

ROLLBACK;
```

## `SB-MD-016` — Storage bucket column preflight

Purpose: verify the Storage metadata columns used by the next query.

Expected columns: ordinal position, column name, type, UDT type, nullability.

Estimated scope: columns of `storage.buckets`, capped at 500 rows.

Safety rationale: information-schema metadata only; no bucket or object rows.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

SELECT
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_schema,
  c.udt_name,
  c.is_nullable
FROM information_schema.columns AS c
WHERE c.table_schema = 'storage'
  AND c.table_name = 'buckets'
ORDER BY c.ordinal_position
LIMIT 500;

ROLLBACK;
```

## `SB-MD-017` — `quotes` bucket metadata

Purpose: confirm bucket identity, public/private flag, file-size limit, MIME restrictions, and metadata timestamps without listing objects.

Expected columns: bucket ID/name, public flag, file-size limit, allowed MIME types, created/updated timestamps.

Estimated scope: zero or one `storage.buckets` row.

Safety rationale: exact bucket-name filter; excludes owner identifiers and never accesses `storage.objects`. Execute only if `SB-MD-016` confirms every selected column.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

SELECT
  id AS bucket_id,
  name AS bucket_name,
  public AS is_public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets
WHERE id = 'quotes'
   OR name = 'quotes'
ORDER BY name
LIMIT 1;

ROLLBACK;
```

## `SB-MD-018` — Sanitized Storage policy metadata

Purpose: identify Storage policy names, operations, roles, permissiveness, and predicate presence without exposing expressions.

Expected columns: relation, policy name, command, roles, permissiveness, predicate-presence flags.

Estimated scope: policies on `storage.buckets` and `storage.objects`, capped at 500 rows.

Safety rationale: catalog policy metadata only; no policy expression, object row, object name, bucket path, or owner value.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  p.polname AS policy_name,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS command,
  ARRAY(
    SELECT CASE
      WHEN role_oid = 0 THEN 'PUBLIC'
      ELSE pg_get_userbyid(role_oid)
    END
    FROM unnest(p.polroles) AS role_oid
    ORDER BY 1
  ) AS roles,
  p.polpermissive AS is_permissive,
  (p.polqual IS NOT NULL) AS has_using,
  (p.polwithcheck IS NOT NULL) AS has_with_check
FROM pg_catalog.pg_policy AS p
JOIN pg_catalog.pg_class AS c
  ON c.oid = p.polrelid
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = c.relnamespace
WHERE n.nspname = 'storage'
  AND c.relname IN ('buckets', 'objects')
ORDER BY c.relname, p.polname
LIMIT 500;

ROLLBACK;
```

## `SB-MD-019` — Cron extension and relation gate

Purpose: determine whether `pg_cron` and `cron.job` exist before any scheduled-job metadata is selected.

Expected columns: `record_type`, `object_name`, `object_schema`, `version_or_kind`.

Estimated scope: at most two catalog rows.

Safety rationale: exact extension/relation catalog lookup; no job or run-history rows.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

SELECT
  'EXTENSION'::text AS record_type,
  e.extname AS object_name,
  n.nspname AS object_schema,
  e.extversion AS version_or_kind
FROM pg_catalog.pg_extension AS e
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = e.extnamespace
WHERE e.extname = 'pg_cron'

UNION ALL

SELECT
  'RELATION'::text AS record_type,
  c.relname AS object_name,
  n.nspname AS object_schema,
  CASE c.relkind
    WHEN 'r' THEN 'TABLE'
    WHEN 'p' THEN 'PARTITIONED_TABLE'
    WHEN 'v' THEN 'VIEW'
    ELSE c.relkind::text
  END AS version_or_kind
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = c.relnamespace
WHERE n.nspname = 'cron'
  AND c.relname = 'job'
ORDER BY record_type
LIMIT 500;

ROLLBACK;
```

## `SB-MD-020` — Cron job column preflight

Purpose: confirm the exact safe columns before selecting job names and enablement.

Expected columns: ordinal position, column name, type, UDT type, nullability.

Estimated scope: columns of `cron.job`, capped at 500 rows.

Safety rationale: information-schema metadata only. Do not run if `SB-MD-019` does not confirm `cron.job`.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

SELECT
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_schema,
  c.udt_name,
  c.is_nullable
FROM information_schema.columns AS c
WHERE c.table_schema = 'cron'
  AND c.table_name = 'job'
ORDER BY c.ordinal_position
LIMIT 500;

ROLLBACK;
```

## `SB-MD-021` — Scheduled-job names and enabled state

Purpose: identify configured job names and active/inactive state without exposing commands, URLs, headers, secrets, schedules, databases, usernames, or run logs.

Expected columns: `job_id`, `job_name`, `is_active`.

Estimated scope: configured jobs, capped at 500 rows.

Safety rationale: selects only minimal `cron.job` metadata. It does not read `command` or `cron.job_run_details` and does not invoke a job. Execute only if `SB-MD-020` confirms `jobid`, `jobname`, and `active`. Stop if any job name itself appears sensitive.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema;

SELECT
  jobid AS job_id,
  jobname AS job_name,
  active AS is_active
FROM cron.job
ORDER BY jobid
LIMIT 500;

ROLLBACK;
```

## Bindings this pack cannot establish

The following require separate non-SQL Dashboard/Management API evidence or later semantic decisions and must remain unknown after this pack unless independently supplied:

- authoritative Supabase branch ref from inside PostgreSQL;
- Data API exposed-schema settings;
- deployed Edge Function inventory and deployment versions;
- Edge Function environment-variable values or secret presence;
- Storage object existence, names, paths, or lifecycle;
- application-row counts, date coverage, JSON paths, value types, data quality, duplicates, revisions, test-data prevalence, or cohort feasibility;
- currency, monetary basis, opening/quantity semantics, quote/revision identity, and current-record policy;
- policy predicate text and ownership semantics beyond the sanitized presence metadata;
- function bodies or runtime authorization behavior;
- any Audit 04 profiling result.

## Human-review checklist

### Whole-pack checks

- [ ] Every block is restricted to the target branch SQL Editor.
- [ ] The parent/main ref does not appear as a query target or connection.
- [ ] Every block begins a read-only transaction and ends in `ROLLBACK`.
- [ ] Every block contains all three approved timeout settings.
- [ ] Every result is capped at 500 rows.
- [ ] No query selects an application table row.
- [ ] No query accesses JSON, `full_json`, source text, filenames, Storage object paths, logs, customer records, credentials, or secrets.
- [ ] No query returns function bodies, view definitions, trigger definitions, policy expressions, index definitions, or scheduled-job commands.
- [ ] No query invokes a user-defined function, RPC, Edge Function, trigger, job, webhook, queue, or external service.
- [ ] No DDL, DML, `CALL`, `DO`, dynamic SQL, advisory lock, row lock, `EXPLAIN ANALYZE`, role change, or RLS bypass exists.

### Dependency checks

- [ ] `SB-MD-014` confirms `version` and `name` before `SB-MD-015`.
- [ ] `SB-MD-016` confirms every selected bucket column before `SB-MD-017`.
- [ ] `SB-MD-019` confirms both `pg_cron` and `cron.job` before `SB-MD-020`.
- [ ] `SB-MD-020` confirms `jobid`, `jobname`, and `active` before `SB-MD-021`.
- [ ] Missing or changed columns cause a stop and pack regeneration, not an inline edit.

### Results handling

- [ ] Record exact branch identity, execution role, UTC execution time, query ID, duration, row count, and status for each execution.
- [ ] Record `NOT_EXECUTED`, `SUCCEEDED`, `FAILED`, or `TIMED_OUT` without guessing.
- [ ] Stop if a query returns an unexpected schema, relation, role, object, or output shape.
- [ ] Stop if any output appears to contain sensitive data.
- [ ] Do not begin Audit 04 until all required deployed bindings and remaining semantic/security inputs are reviewed.

## Official Supabase references consulted

- [Database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [Storage schema](https://supabase.com/docs/guides/storage/schema/design)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Platform permissions](https://supabase.com/docs/guides/platform/permissions)
- [Branch migration troubleshooting](https://supabase.com/docs/guides/troubleshooting/branch-in-migrations-failed-status)

No SQL was executed while generating this artifact. No database, Storage, Edge Function, RPC, deployment, configuration, migration, generated type, application source, Git state, or prior audit artifact was modified.

METADATA_QUERY_PACK_AWAITING_MANUAL_EXECUTION
