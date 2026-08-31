# Audit 04D — Privacy-Hardened Data-Profiling Query Pack

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 04D — Privacy-Hardened Data-Profiling Query Pack |
| UTC assembly time | `2026-08-31T02:43:12Z` |
| Execution environment | CODEX; local artifact inspection and in-memory structural assembly |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity actually verified | `NO`; network access was prohibited |
| Working-tree status before creation | No tracked or staged changes; authorized audit artifacts were pre-existing untracked files |
| Database environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD` |
| Supabase branch | `forensic_report_v1` |
| Target branch ref | `zgsofkgddpcntdvpckdq` |
| Prohibited parent ref | `wkrcyxcnzhwjtdpmfpaf` |
| PostgreSQL version | `17.6` from Audit 03C |
| Expected SQL Editor role | `postgres`; non-superuser; `BYPASSRLS=true` |
| SQL execution | `NOT_EXECUTED` |
| Technical-review status | `NOT_COMPLETED` |
| Operator decision | `NOT_RECORDED` |
| Execution authorization | `NOT_AUTHORIZED` |
| Applicable governance | `AGENTS.md`; Audits 00, 03C–04C; operator Audit 04D prompt |
| Artifact status | `ASSEMBLED_AWAITING_INDEPENDENT_REVIEW` |

## 2. Scope and proof limitations

This artifact is a second corrected candidate assembled from frozen source packages. It authorizes neither SQL execution nor an operator decision. The SQL was not sent to PostgreSQL, Supabase, a parser, a planner, a permissions check, a test harness, or any service. Structural equality and text inspection do not prove runtime behavior, workload, timeout compliance, permissions, output shape, suppression behavior on data, or branch identity.

The Supabase/PostgreSQL review guidance reinforces least privilege, short timeout-protected transactions, explicit JSON type safety, and index review. Because the reviewed role has `BYPASSRLS=true`, privacy depends on exact query text, source allowlisting, aggregate-only projections, suppression, human review, and disciplined execution controls—not RLS.

## 3. Authorized-input manifest

| Input | Bytes | Lines | SHA-256 |
|---|---:|---:|---|
| `docs\audits\00_AUDIT_PROTOCOL_AND_SEQUENCE.md` | 14,222 | 436 | `B690A53F0D3A32076F337F10E4EB8A652E2E98018EF7A601425A2FE866DD0383` |
| `docs\audits\03C_SCHEMA_BINDING_EXECUTION_RESULTS.md` | 35,303 | 323 | `5B43395FF47EDE83855A9F5EE6ECE7CED82BC8A634784FC8557A4F7FF2DB7564` |
| `docs\audits\03D_DEPLOYED_EXTRACTION_CONTRACT_AUDIT.md` | 57,961 | 476 | `3EECD8FEE831B25D9EBBDD8821AC447F89CBB7E44386B916AE0D822213C84317` |
| `docs\audits\03E_SEMANTIC_BINDING_DECISION_REGISTER.md` | 52,438 | 662 | `092152A16619BFF99A33D9DCF53900871D89B4EBFB2A9D3A7B700F75988C9805` |
| `docs\audits\03F_SEMANTIC_BINDING_APPROVAL_AND_SPECIALIST_REVIEW.md` | 35,846 | 534 | `EBF60210AC29BCE10B52089751D07307BF6D0F61D769AA02ADA1C9CB3F60090B` |
| `docs\audits\04_DATA_PROFILING_QUERY_GENERATOR.md` | 86,612 | 1,586 | `618BDF0124D90952859C56B1F077336DB4BC0A762BED996D64DA7C8965742CFC` |
| `docs\audits\04A_TECHNICAL_SQL_REVIEW_AND_OPERATOR_DECISION_RECORD.md` | 44,383 | 575 | `85BE6C446B253D992370E48531878395846B0A00F9CE7236FEC3CD1646B48D29` |
| `docs\audits\04B_CORRECTED_DATA_PROFILING_QUERY_PACK.md` | 97,777 | 1,778 | `E0FD036C406DBC751CBBD5221E75A7DA643DDA5348E32940A2D7BE94316BA78E` |
| `docs\audits\04C_CORRECTED_PACK_TECHNICAL_REVIEW.md` | 91,722 | 1,850 | `3AC8CE43C7ACDF9337C282938089AFA100D5166A418796F208673583C6845ADC` |

All nine inputs existed and were read in full before assembly. Their hashes are rechecked after artifact creation.

## 4. Correction provenance and pack authority

| Query set | Source | Assembly action | Authority after assembly |
|---|---|---|---|
| `A04-PF-001`–`A04-PF-006`, `A04-PR-001`, `A04-PR-004` | Audit 04B | SQL preserved exactly | `NOT_REVIEWED` in this assembled pack |
| `A04-PR-002`, `A04-PR-003`, `A04-PR-005`–`A04-PR-010` | Audit 04C proposed replacements | SQL incorporated exactly | `NOT_REVIEWED` in this assembled pack |

Pack lineage:

- Audit 04 is the immutable original pack.
- Audit 04A is the first technical review.
- Audit 04B is the first corrected candidate.
- Audit 04C is the independent review that rejected Audit 04B.
- Audit 04D is the second corrected candidate.
- Audit 04D remains unreviewed and unauthorized.
- No SQL from Audits 04 through 04D is currently authorized.

The eight Audit 04C replacements are incorporated as candidates only. Their inclusion does not establish that Audit 04C's 22 confirmed disclosure paths are resolved.

## 5. Frozen operator inputs

| Input | Frozen value |
|---|---|
| SQL-pack generation | Authorized for this artifact only |
| SQL execution | `NOT_AUTHORIZED` |
| Deep profiling | `NOT_AUTHORIZED` |
| Human SQL review | Required on this exact assembled artifact |
| Security/privacy review | Required on this exact assembled artifact |
| Later execution method | Operator-manual, one reviewed query at a time, only after separate authorization |
| Small-cell threshold | 5 |
| Maximum output rows/groups | 100 |
| Maximum application relations | Four allowlisted relations |
| Maximum estimated rows per source relation | 10,000 |
| Maximum combined estimated bytes | 50,000,000 |

## 6. Frozen environment and branch identity

- Project display: `WMProd`.
- Environment: `LIVE_ACTIVE / PRODUCTION WORKLOAD`.
- Supabase branch: `forensic_report_v1`.
- Target branch ref: `zgsofkgddpcntdvpckdq`.
- PostgreSQL: `17.6`.
- Expected SQL Editor role: `postgres`, non-superuser, `BYPASSRLS=true`.
- Prohibited and out-of-scope parent ref: `wkrcyxcnzhwjtdpmfpaf`.

PostgreSQL session metadata cannot independently prove the Supabase branch ref. The operator must confirm the exact Dashboard branch immediately before any later authorized action.

## 7. Frozen date binding

- Field: `public.analyses.created_at`.
- Lower bound: `TIMESTAMPTZ '2026-01-01T00:00:00Z'`, inclusive.
- Upper bound: `TIMESTAMPTZ '2026-08-31T00:35:24Z'`, exclusive.
- Meaning: operational analysis-persistence interval only.

It is not a quote, project, contract, effective, revision, or immutable-attempt date.

## 8. Frozen relation allowlist

Application queries may read only:

- `public.analyses`
- `public.scan_sessions`
- `public.quote_files`
- `public.leads`

Preflights may use only the PostgreSQL catalog and information-schema objects and built-ins already present in their preserved SQL. User-defined functions, RPCs, Edge Functions, Storage, logs, jobs, queues, triggers, webhooks, network, filesystem, and foreign-server access are prohibited.

## 9. Frozen restricted-population definition

The approved restricted quality predicate is:

```text
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

The 04C replacements implement array membership with explicit `CASE` enforcement so `jsonb_array_length` is not protected merely by textual `AND` ordering. This remains restricted quality profiling only. It does not establish quote, project, revision, duplicate, monetary, opening, semantic, market, or benchmark eligibility.

## 10. Frozen operational limits

Every query contains:

```text
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;
...
ROLLBACK;
```

Additional gates:

- Any source relation estimate above 10,000 is a hard stop.
- Any negative or unavailable relation estimate is a hard stop.
- Combined source bytes above 50,000,000 is a hard stop.
- Every output is capped at 100 rows.
- PF-005 returning exactly 100 rows is a hard stop because truncation cannot be excluded.
- A missing `analyses.created_at` index requires explicit bounded-full-scan review after PF-006.
- A timeout or SQL error requires a separately reviewed explicit `ROLLBACK;` or complete SQL Editor session discard before another query.
- Limits based on estimates and indexes depend on accepted preflight evidence and human stopping; generation does not satisfy them.

## 11. Allowed and prohibited outputs

Allowed outputs are metadata preflight results, unsegmented operational totals, fixed-domain aggregate distributions, suppression control rows, and the exact aggregate columns positively allowlisted by each package.

No query may output or enable reconstruction of:

- PII, identifiers, stable hashes, raw rows, raw JSON, filenames, Storage paths, source text, raw descriptions, free text, snippets, tokens, or distinct text values.
- Contractor names or customer records.
- Monetary values, price, amount, tax, fees, deposits, financing, allowances, discounts, or `_cents` fields.
- Opening count, quantity, dimensions, united inches, price-per-opening, product, contractor, geography, market, quote, project, revision, duplicate, current-record, supersession, benchmark, or historical-model claims.
- Any arbitrary or non-runtime-enforced JSON path.

For a segmented distribution, any nonzero cell of 1–4 suppresses the entire distribution. A suppressed result exposes only `distribution_suppressed=true`, `suppression_threshold=5`, and `NULL` metric/dimension columns.

## 12. Query manifest

| Sequence | Query ID | Class | Provenance | Result | Technical review | Operator decision | Execution |
|---:|---|---|---|---|---|---|---|
| 1 | `A04-PF-001` | PREFLIGHT | Preserved from 04B | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 2 | `A04-PF-002` | PREFLIGHT | Preserved from 04B | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 3 | `A04-PF-003` | PREFLIGHT | Preserved from 04B | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 4 | `A04-PF-004` | PREFLIGHT | Preserved from 04B | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 5 | `A04-PF-005` | PREFLIGHT | Preserved from 04B | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 6 | `A04-PF-006` | PREFLIGHT | Preserved from 04B | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 7 | `A04-PR-001` | APPLICATION_PROFILE | Preserved from 04B | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 8 | `A04-PR-002` | APPLICATION_PROFILE | Incorporated from 04C | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 9 | `A04-PR-003` | APPLICATION_PROFILE | Incorporated from 04C | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 10 | `A04-PR-004` | APPLICATION_PROFILE | Preserved from 04B | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 11 | `A04-PR-005` | APPLICATION_PROFILE | Incorporated from 04C | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 12 | `A04-PR-006` | APPLICATION_PROFILE | Incorporated from 04C | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 13 | `A04-PR-007` | APPLICATION_PROFILE | Incorporated from 04C | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 14 | `A04-PR-008` | APPLICATION_PROFILE | Incorporated from 04C | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 15 | `A04-PR-009` | APPLICATION_PROFILE | Incorporated from 04C | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |
| 16 | `A04-PR-010` | APPLICATION_PROFILE | Incorporated from 04C | NOT_EXECUTED | NOT_REVIEWED | NOT_RECORDED | NOT_AUTHORIZED |

Mandatory later order is PF-001 through PF-006, complete human acceptance, then separately authorized application queries in numeric order. Application execution remains blocked now.

## 13. Six complete preflight query packages

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
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

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
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

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
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

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
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

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
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

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
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

## 14. Ten complete application-query packages

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
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-002 — Analysis lifecycle distribution

`INCORPORATED_FROM_04C_AWAITING_INDEPENDENT_REVIEW`

1. **Stable ID:** `A04-PR-002`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Count the six confirmed analysis statuses plus `other_unexpected` for the date-bounded, fully joined, non-test population only when all exposed nested-population cells and complements pass the frozen threshold.
4. **Confirmed source bindings:** Four allowlisted relations; analysis/session/document/lead joins; `l.is_test`; `a.analysis_status`; `a.created_at`.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `analysis_status_state`, `mutable_analysis_row_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded four-relation source graph, fixed population-count/complement CTEs, and at most seven unsuppressed rows or one suppressed control row.
9. **Index/constraint dependency:** Same as `A04-PR-001`.
10. **Safety rationale:** Fixed lifecycle labels only; a shared nested-population and complement gate prevents release when an exposed count or adjacent-population difference is 1–4.
11. **Suppression behavior:** Suppress the entire distribution when any nonzero lifecycle bucket, exposed nested-population count, or adjacent-population complement is 1–4; the control row carries no state or metric.
12. **Hard-stop conditions:** Any preflight/review failure; unexpected label or output; suppression contract failure; timeout; more than 100 rows.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH date_population AS (
  SELECT
    a.id AS analysis_id,
    a.analysis_status,
    a.document_is_window_door_related,
    a.confidence_score,
    a.document_type,
    a.full_json,
    s.id AS scan_session_id,
    s.status AS scan_session_status,
    qf.id AS uploaded_document_id,
    l.id AS lead_id,
    l.is_test
  FROM public.analyses AS a
  LEFT JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  LEFT JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  LEFT JOIN public.leads AS l ON l.id = a.lead_id
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), joined_flagged AS (
  SELECT
    date_population.*,
    (
      scan_session_id IS NOT NULL
      AND uploaded_document_id IS NOT NULL
      AND lead_id IS NOT NULL
      AND is_test IS FALSE
    ) AS is_joined_non_test
  FROM date_population
), quality_flagged AS (
  SELECT
    joined_flagged.*,
    (
      is_joined_non_test
      AND analysis_status = 'complete'
      AND scan_session_status IN ('preview_ready', 'awaiting_verification', 'revealed')
    ) AS is_quality_precursor
  FROM joined_flagged
), population_flagged AS (
  SELECT
    quality_flagged.*,
    (
      is_quality_precursor
      AND document_is_window_door_related IS TRUE
      AND confidence_score BETWEEN 0.4 AND 1
      AND document_type IS NOT NULL
      AND btrim(document_type) <> ''
      AND lower(btrim(document_type)) <> 'unknown'
      AND full_json IS NOT NULL
      AND jsonb_typeof(full_json) = 'object'
      AND jsonb_typeof(full_json -> 'extraction') = 'object'
      AND CASE
        WHEN jsonb_typeof(full_json -> 'extraction' -> 'line_items') = 'array'
        THEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') >= 1
        ELSE false
      END
    ) AS is_restricted
  FROM quality_flagged
), population_counts AS (
  SELECT
    COUNT(*) AS all_analysis_count,
    COUNT(DISTINCT scan_session_id) AS all_session_count,
    COUNT(DISTINCT uploaded_document_id) AS all_document_count,
    COUNT(DISTINCT lead_id) AS all_lead_count,
    COUNT(*) FILTER (WHERE is_joined_non_test) AS joined_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_joined_non_test) AS joined_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_joined_non_test) AS joined_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_joined_non_test) AS joined_lead_count,
    COUNT(*) FILTER (WHERE is_quality_precursor) AS quality_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_quality_precursor) AS quality_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_quality_precursor) AS quality_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_quality_precursor) AS quality_lead_count,
    COUNT(*) FILTER (WHERE is_restricted) AS restricted_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_restricted) AS restricted_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_restricted) AS restricted_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_restricted) AS restricted_lead_count
  FROM population_flagged
), privacy_values AS (
  SELECT privacy_value
  FROM population_counts AS pc
  CROSS JOIN LATERAL (
    VALUES
      (pc.all_analysis_count), (pc.all_session_count), (pc.all_document_count), (pc.all_lead_count),
      (pc.joined_analysis_count), (pc.joined_session_count), (pc.joined_document_count), (pc.joined_lead_count),
      (pc.quality_analysis_count), (pc.quality_session_count), (pc.quality_document_count), (pc.quality_lead_count),
      (pc.restricted_analysis_count), (pc.restricted_session_count), (pc.restricted_document_count), (pc.restricted_lead_count),
      (pc.all_analysis_count - pc.joined_analysis_count),
      (pc.all_session_count - pc.joined_session_count),
      (pc.all_document_count - pc.joined_document_count),
      (pc.all_lead_count - pc.joined_lead_count),
      (pc.all_analysis_count - pc.quality_analysis_count),
      (pc.all_session_count - pc.quality_session_count),
      (pc.all_document_count - pc.quality_document_count),
      (pc.all_lead_count - pc.quality_lead_count),
      (pc.all_analysis_count - pc.restricted_analysis_count),
      (pc.all_session_count - pc.restricted_session_count),
      (pc.all_document_count - pc.restricted_document_count),
      (pc.all_lead_count - pc.restricted_lead_count),
      (pc.joined_analysis_count - pc.quality_analysis_count),
      (pc.joined_session_count - pc.quality_session_count),
      (pc.joined_document_count - pc.quality_document_count),
      (pc.joined_lead_count - pc.quality_lead_count),
      (pc.joined_analysis_count - pc.restricted_analysis_count),
      (pc.joined_session_count - pc.restricted_session_count),
      (pc.joined_document_count - pc.restricted_document_count),
      (pc.joined_lead_count - pc.restricted_lead_count),
      (pc.quality_analysis_count - pc.restricted_analysis_count),
      (pc.quality_session_count - pc.restricted_session_count),
      (pc.quality_document_count - pc.restricted_document_count),
      (pc.quality_lead_count - pc.restricted_lead_count)
  ) AS protected_values(privacy_value)
), related_population_gate AS (
  SELECT
    COALESCE(bool_or(privacy_value BETWEEN 1 AND 4), false)
      AS suppress_related_population
  FROM privacy_values
),
classified AS (
  SELECT
    CASE
      WHEN analysis_status IN (
        'pending', 'processing', 'complete', 'failed',
        'invalid_document', 'needs_better_upload'
      ) THEN analysis_status
      ELSE 'other_unexpected'
    END AS analysis_status_state
  FROM population_flagged
  WHERE is_joined_non_test
), bucket_counts AS (
  SELECT analysis_status_state, COUNT(*) AS mutable_analysis_row_count
  FROM classified
  GROUP BY analysis_status_state
  HAVING COUNT(*) > 0
), bucket_gate AS (
  SELECT COALESCE(bool_or(mutable_analysis_row_count BETWEEN 1 AND 4), false) AS suppress_bucket
  FROM bucket_counts
), decision AS (
  SELECT
    bucket_gate.suppress_bucket
    OR related_population_gate.suppress_related_population AS suppress_distribution
  FROM bucket_gate
  CROSS JOIN related_population_gate
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
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-003 — Scan-session lifecycle distribution

`INCORPORATED_FROM_04C_AWAITING_INDEPENDENT_REVIEW`

1. **Stable ID:** `A04-PR-003`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Count the five confirmed scan-session statuses plus `other_unexpected` for the date-bounded, fully joined, non-test population only when all exposed nested-population cells and complements pass the frozen threshold.
4. **Confirmed source bindings:** Four allowlisted relations; `s.status`; approved joins; `l.is_test`; `a.created_at`.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `scan_session_status_state`, `scan_session_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded four-relation source graph, fixed population-count/complement CTEs, and at most six unsuppressed rows or one suppressed control row.
9. **Index/constraint dependency:** Same as `A04-PR-001`.
10. **Safety rationale:** Fixed session-state labels only; a shared nested-population and complement gate prevents release when an exposed count or adjacent-population difference is 1–4.
11. **Suppression behavior:** Suppress the entire distribution when any nonzero session bucket, exposed nested-population count, or adjacent-population complement is 1–4; the control row carries no state or metric.
12. **Hard-stop conditions:** Any preflight/review failure; suppression/output mismatch; timeout; more than 100 rows.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH date_population AS (
  SELECT
    a.id AS analysis_id,
    a.analysis_status,
    a.document_is_window_door_related,
    a.confidence_score,
    a.document_type,
    a.full_json,
    s.id AS scan_session_id,
    s.status AS scan_session_status,
    qf.id AS uploaded_document_id,
    l.id AS lead_id,
    l.is_test
  FROM public.analyses AS a
  LEFT JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  LEFT JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  LEFT JOIN public.leads AS l ON l.id = a.lead_id
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), joined_flagged AS (
  SELECT
    date_population.*,
    (
      scan_session_id IS NOT NULL
      AND uploaded_document_id IS NOT NULL
      AND lead_id IS NOT NULL
      AND is_test IS FALSE
    ) AS is_joined_non_test
  FROM date_population
), quality_flagged AS (
  SELECT
    joined_flagged.*,
    (
      is_joined_non_test
      AND analysis_status = 'complete'
      AND scan_session_status IN ('preview_ready', 'awaiting_verification', 'revealed')
    ) AS is_quality_precursor
  FROM joined_flagged
), population_flagged AS (
  SELECT
    quality_flagged.*,
    (
      is_quality_precursor
      AND document_is_window_door_related IS TRUE
      AND confidence_score BETWEEN 0.4 AND 1
      AND document_type IS NOT NULL
      AND btrim(document_type) <> ''
      AND lower(btrim(document_type)) <> 'unknown'
      AND full_json IS NOT NULL
      AND jsonb_typeof(full_json) = 'object'
      AND jsonb_typeof(full_json -> 'extraction') = 'object'
      AND CASE
        WHEN jsonb_typeof(full_json -> 'extraction' -> 'line_items') = 'array'
        THEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') >= 1
        ELSE false
      END
    ) AS is_restricted
  FROM quality_flagged
), population_counts AS (
  SELECT
    COUNT(*) AS all_analysis_count,
    COUNT(DISTINCT scan_session_id) AS all_session_count,
    COUNT(DISTINCT uploaded_document_id) AS all_document_count,
    COUNT(DISTINCT lead_id) AS all_lead_count,
    COUNT(*) FILTER (WHERE is_joined_non_test) AS joined_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_joined_non_test) AS joined_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_joined_non_test) AS joined_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_joined_non_test) AS joined_lead_count,
    COUNT(*) FILTER (WHERE is_quality_precursor) AS quality_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_quality_precursor) AS quality_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_quality_precursor) AS quality_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_quality_precursor) AS quality_lead_count,
    COUNT(*) FILTER (WHERE is_restricted) AS restricted_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_restricted) AS restricted_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_restricted) AS restricted_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_restricted) AS restricted_lead_count
  FROM population_flagged
), privacy_values AS (
  SELECT privacy_value
  FROM population_counts AS pc
  CROSS JOIN LATERAL (
    VALUES
      (pc.all_analysis_count), (pc.all_session_count), (pc.all_document_count), (pc.all_lead_count),
      (pc.joined_analysis_count), (pc.joined_session_count), (pc.joined_document_count), (pc.joined_lead_count),
      (pc.quality_analysis_count), (pc.quality_session_count), (pc.quality_document_count), (pc.quality_lead_count),
      (pc.restricted_analysis_count), (pc.restricted_session_count), (pc.restricted_document_count), (pc.restricted_lead_count),
      (pc.all_analysis_count - pc.joined_analysis_count),
      (pc.all_session_count - pc.joined_session_count),
      (pc.all_document_count - pc.joined_document_count),
      (pc.all_lead_count - pc.joined_lead_count),
      (pc.all_analysis_count - pc.quality_analysis_count),
      (pc.all_session_count - pc.quality_session_count),
      (pc.all_document_count - pc.quality_document_count),
      (pc.all_lead_count - pc.quality_lead_count),
      (pc.all_analysis_count - pc.restricted_analysis_count),
      (pc.all_session_count - pc.restricted_session_count),
      (pc.all_document_count - pc.restricted_document_count),
      (pc.all_lead_count - pc.restricted_lead_count),
      (pc.joined_analysis_count - pc.quality_analysis_count),
      (pc.joined_session_count - pc.quality_session_count),
      (pc.joined_document_count - pc.quality_document_count),
      (pc.joined_lead_count - pc.quality_lead_count),
      (pc.joined_analysis_count - pc.restricted_analysis_count),
      (pc.joined_session_count - pc.restricted_session_count),
      (pc.joined_document_count - pc.restricted_document_count),
      (pc.joined_lead_count - pc.restricted_lead_count),
      (pc.quality_analysis_count - pc.restricted_analysis_count),
      (pc.quality_session_count - pc.restricted_session_count),
      (pc.quality_document_count - pc.restricted_document_count),
      (pc.quality_lead_count - pc.restricted_lead_count)
  ) AS protected_values(privacy_value)
), related_population_gate AS (
  SELECT
    COALESCE(bool_or(privacy_value BETWEEN 1 AND 4), false)
      AS suppress_related_population
  FROM privacy_values
),
classified AS (
  SELECT DISTINCT
    scan_session_id,
    CASE
      WHEN scan_session_status IN (
        'idle', 'uploading', 'processing', 'preview_ready',
        'awaiting_verification', 'revealed', 'invalid_document',
        'needs_better_upload'
      ) THEN scan_session_status
      ELSE 'other_unexpected'
    END AS scan_session_status_state
  FROM population_flagged
  WHERE is_joined_non_test
), bucket_counts AS (
  SELECT scan_session_status_state, COUNT(*) AS scan_session_count
  FROM classified
  GROUP BY scan_session_status_state
  HAVING COUNT(*) > 0
), bucket_gate AS (
  SELECT COALESCE(bool_or(scan_session_count BETWEEN 1 AND 4), false) AS suppress_bucket
  FROM bucket_counts
), decision AS (
  SELECT
    bucket_gate.suppress_bucket
    OR related_population_gate.suppress_related_population AS suppress_distribution
  FROM bucket_gate
  CROSS JOIN related_population_gate
), output_rows AS (
  SELECT
    true AS distribution_suppressed,
    5 AS suppression_threshold,
    NULL::text AS scan_session_status_state,
    NULL::bigint AS scan_session_count
  FROM decision
  WHERE suppress_distribution
  UNION ALL
  SELECT
    false,
    5,
    bucket_counts.scan_session_status_state,
    bucket_counts.scan_session_count
  FROM bucket_counts
  CROSS JOIN decision
  WHERE NOT suppress_distribution
)
SELECT
  distribution_suppressed,
  suppression_threshold,
  scan_session_status_state,
  scan_session_count
FROM output_rows
ORDER BY scan_session_status_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

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
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-005 — Coordinated restricted entity counts

`INCORPORATED_FROM_04C_AWAITING_INDEPENDENT_REVIEW`

1. **Stable ID:** `A04-PR-005`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Count approved supported entities in the exact restricted population only when the full nested-population, complement, funnel-bucket, and entity-metric gates permit release.
4. **Confirmed source bindings:** Only `public.analyses`, `public.scan_sessions`, `public.quote_files`, and `public.leads`; exact frozen date and restricted predicate; approved JSON branch only.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS` after separate authorization; exact corrected-pack review.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `mutable_analysis_row_count`, `scan_session_count`, `uploaded_document_count`, `lead_count`.
7. **Positive output-column allowlist:** Exactly the six expected columns above.
8. **Estimated scan scope:** Date-bounded four-relation source graph with funnel and distinct-entity aggregates; one output row; bounded only after accepted PF-005/PF-006 results.
9. **Index/constraint dependency:** Same joins and size/index gates as original PR-004/005.
10. **Safety rationale:** Identifiers remain internal to joins and distinct aggregates; shared population/complement gates, the complete PR-004 funnel gate, and metric gates jointly control release.
11. **Suppression behavior:** Suppress all metrics when any PR-004 first-failure bucket, entity metric, exposed nested-population count, or adjacent-population complement is 1–4.
12. **Hard-stop conditions:** Any preflight/review failure, output mismatch, timeout, role/target drift, raw value, identifier, prohibited field, or suppression mismatch.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH date_population AS (
  SELECT
    a.id AS analysis_id,
    a.analysis_status,
    a.document_is_window_door_related,
    a.confidence_score,
    a.document_type,
    a.full_json,
    s.id AS scan_session_id,
    s.status AS scan_session_status,
    qf.id AS uploaded_document_id,
    l.id AS lead_id,
    l.is_test
  FROM public.analyses AS a
  LEFT JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  LEFT JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  LEFT JOIN public.leads AS l ON l.id = a.lead_id
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), joined_flagged AS (
  SELECT
    date_population.*,
    (
      scan_session_id IS NOT NULL
      AND uploaded_document_id IS NOT NULL
      AND lead_id IS NOT NULL
      AND is_test IS FALSE
    ) AS is_joined_non_test
  FROM date_population
), quality_flagged AS (
  SELECT
    joined_flagged.*,
    (
      is_joined_non_test
      AND analysis_status = 'complete'
      AND scan_session_status IN ('preview_ready', 'awaiting_verification', 'revealed')
    ) AS is_quality_precursor
  FROM joined_flagged
), population_flagged AS (
  SELECT
    quality_flagged.*,
    (
      is_quality_precursor
      AND document_is_window_door_related IS TRUE
      AND confidence_score BETWEEN 0.4 AND 1
      AND document_type IS NOT NULL
      AND btrim(document_type) <> ''
      AND lower(btrim(document_type)) <> 'unknown'
      AND full_json IS NOT NULL
      AND jsonb_typeof(full_json) = 'object'
      AND jsonb_typeof(full_json -> 'extraction') = 'object'
      AND CASE
        WHEN jsonb_typeof(full_json -> 'extraction' -> 'line_items') = 'array'
        THEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') >= 1
        ELSE false
      END
    ) AS is_restricted
  FROM quality_flagged
), population_counts AS (
  SELECT
    COUNT(*) AS all_analysis_count,
    COUNT(DISTINCT scan_session_id) AS all_session_count,
    COUNT(DISTINCT uploaded_document_id) AS all_document_count,
    COUNT(DISTINCT lead_id) AS all_lead_count,
    COUNT(*) FILTER (WHERE is_joined_non_test) AS joined_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_joined_non_test) AS joined_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_joined_non_test) AS joined_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_joined_non_test) AS joined_lead_count,
    COUNT(*) FILTER (WHERE is_quality_precursor) AS quality_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_quality_precursor) AS quality_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_quality_precursor) AS quality_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_quality_precursor) AS quality_lead_count,
    COUNT(*) FILTER (WHERE is_restricted) AS restricted_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_restricted) AS restricted_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_restricted) AS restricted_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_restricted) AS restricted_lead_count
  FROM population_flagged
), privacy_values AS (
  SELECT privacy_value
  FROM population_counts AS pc
  CROSS JOIN LATERAL (
    VALUES
      (pc.all_analysis_count), (pc.all_session_count), (pc.all_document_count), (pc.all_lead_count),
      (pc.joined_analysis_count), (pc.joined_session_count), (pc.joined_document_count), (pc.joined_lead_count),
      (pc.quality_analysis_count), (pc.quality_session_count), (pc.quality_document_count), (pc.quality_lead_count),
      (pc.restricted_analysis_count), (pc.restricted_session_count), (pc.restricted_document_count), (pc.restricted_lead_count),
      (pc.all_analysis_count - pc.joined_analysis_count),
      (pc.all_session_count - pc.joined_session_count),
      (pc.all_document_count - pc.joined_document_count),
      (pc.all_lead_count - pc.joined_lead_count),
      (pc.all_analysis_count - pc.quality_analysis_count),
      (pc.all_session_count - pc.quality_session_count),
      (pc.all_document_count - pc.quality_document_count),
      (pc.all_lead_count - pc.quality_lead_count),
      (pc.all_analysis_count - pc.restricted_analysis_count),
      (pc.all_session_count - pc.restricted_session_count),
      (pc.all_document_count - pc.restricted_document_count),
      (pc.all_lead_count - pc.restricted_lead_count),
      (pc.joined_analysis_count - pc.quality_analysis_count),
      (pc.joined_session_count - pc.quality_session_count),
      (pc.joined_document_count - pc.quality_document_count),
      (pc.joined_lead_count - pc.quality_lead_count),
      (pc.joined_analysis_count - pc.restricted_analysis_count),
      (pc.joined_session_count - pc.restricted_session_count),
      (pc.joined_document_count - pc.restricted_document_count),
      (pc.joined_lead_count - pc.restricted_lead_count),
      (pc.quality_analysis_count - pc.restricted_analysis_count),
      (pc.quality_session_count - pc.restricted_session_count),
      (pc.quality_document_count - pc.restricted_document_count),
      (pc.quality_lead_count - pc.restricted_lead_count)
  ) AS protected_values(privacy_value)
), related_population_gate AS (
  SELECT
    COALESCE(bool_or(privacy_value BETWEEN 1 AND 4), false)
      AS suppress_related_population
  FROM privacy_values
),
funnel_classified AS (
  SELECT
    CASE
      WHEN analysis_status IS DISTINCT FROM 'complete' THEN 'analysis_not_complete'
      WHEN document_is_window_door_related IS DISTINCT FROM true THEN 'not_confirmed_window_door_related'
      WHEN confidence_score IS NULL OR confidence_score NOT BETWEEN 0.4 AND 1 THEN 'confidence_invalid_or_missing'
      WHEN document_type IS NULL THEN 'document_type_missing'
      WHEN btrim(document_type) = '' THEN 'document_type_blank'
      WHEN lower(btrim(document_type)) = 'unknown' THEN 'document_type_unknown'
      WHEN scan_session_id IS NULL THEN 'scan_session_missing'
      WHEN scan_session_status NOT IN ('preview_ready', 'awaiting_verification', 'revealed') THEN 'scan_session_status_not_success'
      WHEN uploaded_document_id IS NULL THEN 'uploaded_document_missing'
      WHEN lead_id IS NULL THEN 'lead_missing'
      WHEN is_test IS NOT FALSE THEN 'test_or_unclassified_lead'
      WHEN full_json IS NULL THEN 'full_json_missing'
      WHEN jsonb_typeof(full_json) <> 'object' THEN 'full_json_wrong_type'
      WHEN full_json -> 'extraction' IS NULL THEN 'extraction_missing'
      WHEN jsonb_typeof(full_json -> 'extraction') <> 'object' THEN 'extraction_wrong_type'
      WHEN full_json -> 'extraction' -> 'line_items' IS NULL THEN 'line_items_missing'
      WHEN jsonb_typeof(full_json -> 'extraction' -> 'line_items') <> 'array' THEN 'line_items_wrong_type'
      WHEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') < 1 THEN 'line_items_empty'
      ELSE 'restricted_quality_eligible'
    END AS population_state
  FROM population_flagged
), funnel_bucket_counts AS (
  SELECT population_state, COUNT(*) AS mutable_analysis_row_count
  FROM funnel_classified
  GROUP BY population_state
  HAVING COUNT(*) > 0
), funnel_gate AS (
  SELECT COALESCE(bool_or(mutable_analysis_row_count BETWEEN 1 AND 4), false) AS suppress_funnel
  FROM funnel_bucket_counts
), metric_counts AS (
  SELECT
    COUNT(DISTINCT analysis_id) AS mutable_analysis_row_count,
    COUNT(DISTINCT scan_session_id) AS scan_session_count,
    COUNT(DISTINCT uploaded_document_id) AS uploaded_document_count,
    COUNT(DISTINCT lead_id) AS lead_count
  FROM population_flagged
  WHERE is_restricted
), decision AS (
  SELECT
    funnel_gate.suppress_funnel
    OR related_population_gate.suppress_related_population
    OR metric_counts.mutable_analysis_row_count BETWEEN 1 AND 4
    OR metric_counts.scan_session_count BETWEEN 1 AND 4
    OR metric_counts.uploaded_document_count BETWEEN 1 AND 4
    OR metric_counts.lead_count BETWEEN 1 AND 4 AS suppress_output
  FROM funnel_gate
  CROSS JOIN related_population_gate
  CROSS JOIN metric_counts
), output_rows AS (
  SELECT
    true AS distribution_suppressed,
    5 AS suppression_threshold,
    NULL::bigint AS mutable_analysis_row_count,
    NULL::bigint AS scan_session_count,
    NULL::bigint AS uploaded_document_count,
    NULL::bigint AS lead_count
  FROM decision
  WHERE suppress_output
  UNION ALL
  SELECT
    false,
    5,
    metric_counts.mutable_analysis_row_count,
    metric_counts.scan_session_count,
    metric_counts.uploaded_document_count,
    metric_counts.lead_count
  FROM metric_counts
  CROSS JOIN decision
  WHERE NOT suppress_output
)
SELECT
  distribution_suppressed,
  suppression_threshold,
  mutable_analysis_row_count,
  scan_session_count,
  uploaded_document_count,
  lead_count
FROM output_rows
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-006 — Confidence-state distribution

`INCORPORATED_FROM_04C_AWAITING_INDEPENDENT_REVIEW`

1. **Stable ID:** `A04-PR-006`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Return the frozen confidence-state distribution for the quality-precursor population only when bucket and nested-population complement gates permit release.
4. **Confirmed source bindings:** Four allowlisted relations; `a.confidence_score`, lifecycle/join/test/date fields.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `confidence_state`, `mutable_analysis_row_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded four-relation source graph and fixed confidence buckets; at most four unsuppressed rows or one suppressed control row.
9. **Index/constraint dependency:** Same as `A04-PR-001`.
10. **Safety rationale:** Only frozen confidence buckets are projected; bucket and shared population/complement gates control release.
11. **Suppression behavior:** Suppress the entire distribution when any nonzero confidence bucket, exposed nested-population count, or adjacent-population complement is 1–4.
12. **Hard-stop conditions:** Any label outside the four frozen states; suppression/output mismatch; preflight/review failure; timeout.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH date_population AS (
  SELECT
    a.id AS analysis_id,
    a.analysis_status,
    a.document_is_window_door_related,
    a.confidence_score,
    a.document_type,
    a.full_json,
    s.id AS scan_session_id,
    s.status AS scan_session_status,
    qf.id AS uploaded_document_id,
    l.id AS lead_id,
    l.is_test
  FROM public.analyses AS a
  LEFT JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  LEFT JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  LEFT JOIN public.leads AS l ON l.id = a.lead_id
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), joined_flagged AS (
  SELECT
    date_population.*,
    (
      scan_session_id IS NOT NULL
      AND uploaded_document_id IS NOT NULL
      AND lead_id IS NOT NULL
      AND is_test IS FALSE
    ) AS is_joined_non_test
  FROM date_population
), quality_flagged AS (
  SELECT
    joined_flagged.*,
    (
      is_joined_non_test
      AND analysis_status = 'complete'
      AND scan_session_status IN ('preview_ready', 'awaiting_verification', 'revealed')
    ) AS is_quality_precursor
  FROM joined_flagged
), population_flagged AS (
  SELECT
    quality_flagged.*,
    (
      is_quality_precursor
      AND document_is_window_door_related IS TRUE
      AND confidence_score BETWEEN 0.4 AND 1
      AND document_type IS NOT NULL
      AND btrim(document_type) <> ''
      AND lower(btrim(document_type)) <> 'unknown'
      AND full_json IS NOT NULL
      AND jsonb_typeof(full_json) = 'object'
      AND jsonb_typeof(full_json -> 'extraction') = 'object'
      AND CASE
        WHEN jsonb_typeof(full_json -> 'extraction' -> 'line_items') = 'array'
        THEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') >= 1
        ELSE false
      END
    ) AS is_restricted
  FROM quality_flagged
), population_counts AS (
  SELECT
    COUNT(*) AS all_analysis_count,
    COUNT(DISTINCT scan_session_id) AS all_session_count,
    COUNT(DISTINCT uploaded_document_id) AS all_document_count,
    COUNT(DISTINCT lead_id) AS all_lead_count,
    COUNT(*) FILTER (WHERE is_joined_non_test) AS joined_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_joined_non_test) AS joined_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_joined_non_test) AS joined_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_joined_non_test) AS joined_lead_count,
    COUNT(*) FILTER (WHERE is_quality_precursor) AS quality_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_quality_precursor) AS quality_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_quality_precursor) AS quality_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_quality_precursor) AS quality_lead_count,
    COUNT(*) FILTER (WHERE is_restricted) AS restricted_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_restricted) AS restricted_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_restricted) AS restricted_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_restricted) AS restricted_lead_count
  FROM population_flagged
), privacy_values AS (
  SELECT privacy_value
  FROM population_counts AS pc
  CROSS JOIN LATERAL (
    VALUES
      (pc.all_analysis_count), (pc.all_session_count), (pc.all_document_count), (pc.all_lead_count),
      (pc.joined_analysis_count), (pc.joined_session_count), (pc.joined_document_count), (pc.joined_lead_count),
      (pc.quality_analysis_count), (pc.quality_session_count), (pc.quality_document_count), (pc.quality_lead_count),
      (pc.restricted_analysis_count), (pc.restricted_session_count), (pc.restricted_document_count), (pc.restricted_lead_count),
      (pc.all_analysis_count - pc.joined_analysis_count),
      (pc.all_session_count - pc.joined_session_count),
      (pc.all_document_count - pc.joined_document_count),
      (pc.all_lead_count - pc.joined_lead_count),
      (pc.all_analysis_count - pc.quality_analysis_count),
      (pc.all_session_count - pc.quality_session_count),
      (pc.all_document_count - pc.quality_document_count),
      (pc.all_lead_count - pc.quality_lead_count),
      (pc.all_analysis_count - pc.restricted_analysis_count),
      (pc.all_session_count - pc.restricted_session_count),
      (pc.all_document_count - pc.restricted_document_count),
      (pc.all_lead_count - pc.restricted_lead_count),
      (pc.joined_analysis_count - pc.quality_analysis_count),
      (pc.joined_session_count - pc.quality_session_count),
      (pc.joined_document_count - pc.quality_document_count),
      (pc.joined_lead_count - pc.quality_lead_count),
      (pc.joined_analysis_count - pc.restricted_analysis_count),
      (pc.joined_session_count - pc.restricted_session_count),
      (pc.joined_document_count - pc.restricted_document_count),
      (pc.joined_lead_count - pc.restricted_lead_count),
      (pc.quality_analysis_count - pc.restricted_analysis_count),
      (pc.quality_session_count - pc.restricted_session_count),
      (pc.quality_document_count - pc.restricted_document_count),
      (pc.quality_lead_count - pc.restricted_lead_count)
  ) AS protected_values(privacy_value)
), related_population_gate AS (
  SELECT
    COALESCE(bool_or(privacy_value BETWEEN 1 AND 4), false)
      AS suppress_related_population
  FROM privacy_values
),
classified AS (
  SELECT
    CASE
      WHEN confidence_score IS NULL OR confidence_score < 0.4 OR confidence_score > 1
        THEN 'invalid_or_missing'
      WHEN confidence_score < 0.6 THEN '0.40_to_less_than_0.60'
      WHEN confidence_score < 0.8 THEN '0.60_to_less_than_0.80'
      ELSE '0.80_to_1.00'
    END AS confidence_state
  FROM population_flagged
  WHERE is_quality_precursor
), bucket_counts AS (
  SELECT confidence_state, COUNT(*) AS mutable_analysis_row_count
  FROM classified
  GROUP BY confidence_state
  HAVING COUNT(*) > 0
), bucket_gate AS (
  SELECT COALESCE(bool_or(mutable_analysis_row_count BETWEEN 1 AND 4), false) AS suppress_bucket
  FROM bucket_counts
), decision AS (
  SELECT
    bucket_gate.suppress_bucket
    OR related_population_gate.suppress_related_population AS suppress_distribution
  FROM bucket_gate
  CROSS JOIN related_population_gate
), output_rows AS (
  SELECT
    true AS distribution_suppressed,
    5 AS suppression_threshold,
    NULL::text AS confidence_state,
    NULL::bigint AS mutable_analysis_row_count
  FROM decision
  WHERE suppress_distribution
  UNION ALL
  SELECT
    false,
    5,
    bucket_counts.confidence_state,
    bucket_counts.mutable_analysis_row_count
  FROM bucket_counts
  CROSS JOIN decision
  WHERE NOT suppress_distribution
)
SELECT
  distribution_suppressed,
  suppression_threshold,
  confidence_state,
  mutable_analysis_row_count
FROM output_rows
ORDER BY confidence_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-007 — Document-type validity-state distribution

`INCORPORATED_FROM_04C_AWAITING_INDEPENDENT_REVIEW`

1. **Stable ID:** `A04-PR-007`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Return the frozen document-type validity distribution for the quality-precursor population only when bucket and nested-population complement gates permit release.
4. **Confirmed source bindings:** Four allowlisted relations; `a.document_type`, lifecycle/join/test/date fields.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `document_type_validity_state`, `mutable_analysis_row_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded four-relation source graph and fixed validity states; at most four unsuppressed rows or one suppressed control row.
9. **Index/constraint dependency:** Same as `A04-PR-001`.
10. **Safety rationale:** Only frozen validity labels are projected; bucket and shared population/complement gates control release.
11. **Suppression behavior:** Suppress the entire distribution when any nonzero validity bucket, exposed nested-population count, or adjacent-population complement is 1–4.
12. **Hard-stop conditions:** Raw document type appears; unknown label appears; suppression/output mismatch; timeout; preflight/review failure.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH date_population AS (
  SELECT
    a.id AS analysis_id,
    a.analysis_status,
    a.document_is_window_door_related,
    a.confidence_score,
    a.document_type,
    a.full_json,
    s.id AS scan_session_id,
    s.status AS scan_session_status,
    qf.id AS uploaded_document_id,
    l.id AS lead_id,
    l.is_test
  FROM public.analyses AS a
  LEFT JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  LEFT JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  LEFT JOIN public.leads AS l ON l.id = a.lead_id
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), joined_flagged AS (
  SELECT
    date_population.*,
    (
      scan_session_id IS NOT NULL
      AND uploaded_document_id IS NOT NULL
      AND lead_id IS NOT NULL
      AND is_test IS FALSE
    ) AS is_joined_non_test
  FROM date_population
), quality_flagged AS (
  SELECT
    joined_flagged.*,
    (
      is_joined_non_test
      AND analysis_status = 'complete'
      AND scan_session_status IN ('preview_ready', 'awaiting_verification', 'revealed')
    ) AS is_quality_precursor
  FROM joined_flagged
), population_flagged AS (
  SELECT
    quality_flagged.*,
    (
      is_quality_precursor
      AND document_is_window_door_related IS TRUE
      AND confidence_score BETWEEN 0.4 AND 1
      AND document_type IS NOT NULL
      AND btrim(document_type) <> ''
      AND lower(btrim(document_type)) <> 'unknown'
      AND full_json IS NOT NULL
      AND jsonb_typeof(full_json) = 'object'
      AND jsonb_typeof(full_json -> 'extraction') = 'object'
      AND CASE
        WHEN jsonb_typeof(full_json -> 'extraction' -> 'line_items') = 'array'
        THEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') >= 1
        ELSE false
      END
    ) AS is_restricted
  FROM quality_flagged
), population_counts AS (
  SELECT
    COUNT(*) AS all_analysis_count,
    COUNT(DISTINCT scan_session_id) AS all_session_count,
    COUNT(DISTINCT uploaded_document_id) AS all_document_count,
    COUNT(DISTINCT lead_id) AS all_lead_count,
    COUNT(*) FILTER (WHERE is_joined_non_test) AS joined_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_joined_non_test) AS joined_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_joined_non_test) AS joined_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_joined_non_test) AS joined_lead_count,
    COUNT(*) FILTER (WHERE is_quality_precursor) AS quality_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_quality_precursor) AS quality_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_quality_precursor) AS quality_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_quality_precursor) AS quality_lead_count,
    COUNT(*) FILTER (WHERE is_restricted) AS restricted_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_restricted) AS restricted_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_restricted) AS restricted_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_restricted) AS restricted_lead_count
  FROM population_flagged
), privacy_values AS (
  SELECT privacy_value
  FROM population_counts AS pc
  CROSS JOIN LATERAL (
    VALUES
      (pc.all_analysis_count), (pc.all_session_count), (pc.all_document_count), (pc.all_lead_count),
      (pc.joined_analysis_count), (pc.joined_session_count), (pc.joined_document_count), (pc.joined_lead_count),
      (pc.quality_analysis_count), (pc.quality_session_count), (pc.quality_document_count), (pc.quality_lead_count),
      (pc.restricted_analysis_count), (pc.restricted_session_count), (pc.restricted_document_count), (pc.restricted_lead_count),
      (pc.all_analysis_count - pc.joined_analysis_count),
      (pc.all_session_count - pc.joined_session_count),
      (pc.all_document_count - pc.joined_document_count),
      (pc.all_lead_count - pc.joined_lead_count),
      (pc.all_analysis_count - pc.quality_analysis_count),
      (pc.all_session_count - pc.quality_session_count),
      (pc.all_document_count - pc.quality_document_count),
      (pc.all_lead_count - pc.quality_lead_count),
      (pc.all_analysis_count - pc.restricted_analysis_count),
      (pc.all_session_count - pc.restricted_session_count),
      (pc.all_document_count - pc.restricted_document_count),
      (pc.all_lead_count - pc.restricted_lead_count),
      (pc.joined_analysis_count - pc.quality_analysis_count),
      (pc.joined_session_count - pc.quality_session_count),
      (pc.joined_document_count - pc.quality_document_count),
      (pc.joined_lead_count - pc.quality_lead_count),
      (pc.joined_analysis_count - pc.restricted_analysis_count),
      (pc.joined_session_count - pc.restricted_session_count),
      (pc.joined_document_count - pc.restricted_document_count),
      (pc.joined_lead_count - pc.restricted_lead_count),
      (pc.quality_analysis_count - pc.restricted_analysis_count),
      (pc.quality_session_count - pc.restricted_session_count),
      (pc.quality_document_count - pc.restricted_document_count),
      (pc.quality_lead_count - pc.restricted_lead_count)
  ) AS protected_values(privacy_value)
), related_population_gate AS (
  SELECT
    COALESCE(bool_or(privacy_value BETWEEN 1 AND 4), false)
      AS suppress_related_population
  FROM privacy_values
),
classified AS (
  SELECT
    CASE
      WHEN document_type IS NULL THEN 'missing'
      WHEN btrim(document_type) = '' THEN 'blank'
      WHEN lower(btrim(document_type)) = 'unknown' THEN 'unknown'
      ELSE 'nonblank_nonunknown'
    END AS document_type_validity_state
  FROM population_flagged
  WHERE is_quality_precursor
), bucket_counts AS (
  SELECT document_type_validity_state, COUNT(*) AS mutable_analysis_row_count
  FROM classified
  GROUP BY document_type_validity_state
  HAVING COUNT(*) > 0
), bucket_gate AS (
  SELECT COALESCE(bool_or(mutable_analysis_row_count BETWEEN 1 AND 4), false) AS suppress_bucket
  FROM bucket_counts
), decision AS (
  SELECT
    bucket_gate.suppress_bucket
    OR related_population_gate.suppress_related_population AS suppress_distribution
  FROM bucket_gate
  CROSS JOIN related_population_gate
), output_rows AS (
  SELECT
    true AS distribution_suppressed,
    5 AS suppression_threshold,
    NULL::text AS document_type_validity_state,
    NULL::bigint AS mutable_analysis_row_count
  FROM decision
  WHERE suppress_distribution
  UNION ALL
  SELECT
    false,
    5,
    bucket_counts.document_type_validity_state,
    bucket_counts.mutable_analysis_row_count
  FROM bucket_counts
  CROSS JOIN decision
  WHERE NOT suppress_distribution
)
SELECT
  distribution_suppressed,
  suppression_threshold,
  document_type_validity_state,
  mutable_analysis_row_count
FROM output_rows
ORDER BY document_type_validity_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-008 — Line-item array-state distribution

`INCORPORATED_FROM_04C_AWAITING_INDEPENDENT_REVIEW`

1. **Stable ID:** `A04-PR-008`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Return the frozen line-item array-state distribution for the quality-precursor population only when bucket and nested-population complement gates permit release.
4. **Confirmed source bindings:** Four allowlisted relations; exact JSON branch `a.full_json -> 'extraction' -> 'line_items'` with parent-first guards.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `line_item_array_state`, `mutable_analysis_row_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded four-relation source graph and guarded array-state classification; at most eight unsuppressed rows or one suppressed control row.
9. **Index/constraint dependency:** Same as `A04-PR-001`; no JSON index is assumed.
10. **Safety rationale:** Only frozen array-state labels are projected; explicit `CASE` guards precede array-length calls, and bucket plus shared population/complement gates control release.
11. **Suppression behavior:** Suppress the entire distribution when any nonzero array-state bucket, exposed nested-population count, or adjacent-population complement is 1–4.
12. **Hard-stop conditions:** Any non-frozen state; label suggesting openings/products/units/quote items; raw JSON; suppression/output mismatch; timeout.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH date_population AS (
  SELECT
    a.id AS analysis_id,
    a.analysis_status,
    a.document_is_window_door_related,
    a.confidence_score,
    a.document_type,
    a.full_json,
    s.id AS scan_session_id,
    s.status AS scan_session_status,
    qf.id AS uploaded_document_id,
    l.id AS lead_id,
    l.is_test
  FROM public.analyses AS a
  LEFT JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  LEFT JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  LEFT JOIN public.leads AS l ON l.id = a.lead_id
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), joined_flagged AS (
  SELECT
    date_population.*,
    (
      scan_session_id IS NOT NULL
      AND uploaded_document_id IS NOT NULL
      AND lead_id IS NOT NULL
      AND is_test IS FALSE
    ) AS is_joined_non_test
  FROM date_population
), quality_flagged AS (
  SELECT
    joined_flagged.*,
    (
      is_joined_non_test
      AND analysis_status = 'complete'
      AND scan_session_status IN ('preview_ready', 'awaiting_verification', 'revealed')
    ) AS is_quality_precursor
  FROM joined_flagged
), population_flagged AS (
  SELECT
    quality_flagged.*,
    (
      is_quality_precursor
      AND document_is_window_door_related IS TRUE
      AND confidence_score BETWEEN 0.4 AND 1
      AND document_type IS NOT NULL
      AND btrim(document_type) <> ''
      AND lower(btrim(document_type)) <> 'unknown'
      AND full_json IS NOT NULL
      AND jsonb_typeof(full_json) = 'object'
      AND jsonb_typeof(full_json -> 'extraction') = 'object'
      AND CASE
        WHEN jsonb_typeof(full_json -> 'extraction' -> 'line_items') = 'array'
        THEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') >= 1
        ELSE false
      END
    ) AS is_restricted
  FROM quality_flagged
), population_counts AS (
  SELECT
    COUNT(*) AS all_analysis_count,
    COUNT(DISTINCT scan_session_id) AS all_session_count,
    COUNT(DISTINCT uploaded_document_id) AS all_document_count,
    COUNT(DISTINCT lead_id) AS all_lead_count,
    COUNT(*) FILTER (WHERE is_joined_non_test) AS joined_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_joined_non_test) AS joined_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_joined_non_test) AS joined_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_joined_non_test) AS joined_lead_count,
    COUNT(*) FILTER (WHERE is_quality_precursor) AS quality_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_quality_precursor) AS quality_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_quality_precursor) AS quality_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_quality_precursor) AS quality_lead_count,
    COUNT(*) FILTER (WHERE is_restricted) AS restricted_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_restricted) AS restricted_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_restricted) AS restricted_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_restricted) AS restricted_lead_count
  FROM population_flagged
), privacy_values AS (
  SELECT privacy_value
  FROM population_counts AS pc
  CROSS JOIN LATERAL (
    VALUES
      (pc.all_analysis_count), (pc.all_session_count), (pc.all_document_count), (pc.all_lead_count),
      (pc.joined_analysis_count), (pc.joined_session_count), (pc.joined_document_count), (pc.joined_lead_count),
      (pc.quality_analysis_count), (pc.quality_session_count), (pc.quality_document_count), (pc.quality_lead_count),
      (pc.restricted_analysis_count), (pc.restricted_session_count), (pc.restricted_document_count), (pc.restricted_lead_count),
      (pc.all_analysis_count - pc.joined_analysis_count),
      (pc.all_session_count - pc.joined_session_count),
      (pc.all_document_count - pc.joined_document_count),
      (pc.all_lead_count - pc.joined_lead_count),
      (pc.all_analysis_count - pc.quality_analysis_count),
      (pc.all_session_count - pc.quality_session_count),
      (pc.all_document_count - pc.quality_document_count),
      (pc.all_lead_count - pc.quality_lead_count),
      (pc.all_analysis_count - pc.restricted_analysis_count),
      (pc.all_session_count - pc.restricted_session_count),
      (pc.all_document_count - pc.restricted_document_count),
      (pc.all_lead_count - pc.restricted_lead_count),
      (pc.joined_analysis_count - pc.quality_analysis_count),
      (pc.joined_session_count - pc.quality_session_count),
      (pc.joined_document_count - pc.quality_document_count),
      (pc.joined_lead_count - pc.quality_lead_count),
      (pc.joined_analysis_count - pc.restricted_analysis_count),
      (pc.joined_session_count - pc.restricted_session_count),
      (pc.joined_document_count - pc.restricted_document_count),
      (pc.joined_lead_count - pc.restricted_lead_count),
      (pc.quality_analysis_count - pc.restricted_analysis_count),
      (pc.quality_session_count - pc.restricted_session_count),
      (pc.quality_document_count - pc.restricted_document_count),
      (pc.quality_lead_count - pc.restricted_lead_count)
  ) AS protected_values(privacy_value)
), related_population_gate AS (
  SELECT
    COALESCE(bool_or(privacy_value BETWEEN 1 AND 4), false)
      AS suppress_related_population
  FROM privacy_values
),
classified AS (
  SELECT
    CASE
      WHEN full_json IS NULL THEN 'missing'
      WHEN jsonb_typeof(full_json) <> 'object' THEN 'wrong_type'
      WHEN full_json -> 'extraction' IS NULL THEN 'missing'
      WHEN jsonb_typeof(full_json -> 'extraction') <> 'object' THEN 'wrong_type'
      WHEN full_json -> 'extraction' -> 'line_items' IS NULL THEN 'missing'
      WHEN jsonb_typeof(full_json -> 'extraction' -> 'line_items') <> 'array' THEN 'wrong_type'
      WHEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') = 0 THEN 'empty'
      WHEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') = 1 THEN 'count_1'
      WHEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') BETWEEN 2 AND 5 THEN 'count_2_to_5'
      WHEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') BETWEEN 6 AND 10 THEN 'count_6_to_10'
      WHEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') BETWEEN 11 AND 20 THEN 'count_11_to_20'
      ELSE 'count_21_plus'
    END AS line_item_array_state
  FROM population_flagged
  WHERE is_quality_precursor
), bucket_counts AS (
  SELECT line_item_array_state, COUNT(*) AS mutable_analysis_row_count
  FROM classified
  GROUP BY line_item_array_state
  HAVING COUNT(*) > 0
), bucket_gate AS (
  SELECT COALESCE(bool_or(mutable_analysis_row_count BETWEEN 1 AND 4), false) AS suppress_bucket
  FROM bucket_counts
), decision AS (
  SELECT
    bucket_gate.suppress_bucket
    OR related_population_gate.suppress_related_population AS suppress_distribution
  FROM bucket_gate
  CROSS JOIN related_population_gate
), output_rows AS (
  SELECT
    true AS distribution_suppressed,
    5 AS suppression_threshold,
    NULL::text AS line_item_array_state,
    NULL::bigint AS mutable_analysis_row_count
  FROM decision
  WHERE suppress_distribution
  UNION ALL
  SELECT
    false,
    5,
    bucket_counts.line_item_array_state,
    bucket_counts.mutable_analysis_row_count
  FROM bucket_counts
  CROSS JOIN decision
  WHERE NOT suppress_distribution
)
SELECT
  distribution_suppressed,
  suppression_threshold,
  line_item_array_state,
  mutable_analysis_row_count
FROM output_rows
ORDER BY line_item_array_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-009 — Description-shape distribution

`INCORPORATED_FROM_04C_AWAITING_INDEPENDENT_REVIEW`

1. **Stable ID:** `A04-PR-009`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Return the frozen description-shape distribution for guarded restricted line items only when bucket and nested-population complement gates permit release.
4. **Confirmed source bindings:** Four allowlisted relations; exact frozen restricted predicate; `line_items[].description` only.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS`.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `description_shape_state`, `extracted_line_item_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded four-relation source graph followed by guarded expansion of the approved line-items array; at most four unsuppressed rows or one suppressed control row.
9. **Index/constraint dependency:** Same as `A04-PR-005`; no JSON index assumed.
10. **Safety rationale:** Description content never leaves the query; explicit `CASE` type enforcement protects the parent array, and bucket plus shared population/complement gates control release.
11. **Suppression behavior:** Suppress the entire distribution when any nonzero description-shape bucket, exposed nested-population count, or adjacent-population complement is 1–4.
12. **Hard-stop conditions:** Description content/snippet/hash/token appears; wrong path; suppression/output mismatch; timeout; unexpected expansion behavior.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH date_population AS (
  SELECT
    a.id AS analysis_id,
    a.analysis_status,
    a.document_is_window_door_related,
    a.confidence_score,
    a.document_type,
    a.full_json,
    s.id AS scan_session_id,
    s.status AS scan_session_status,
    qf.id AS uploaded_document_id,
    l.id AS lead_id,
    l.is_test
  FROM public.analyses AS a
  LEFT JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  LEFT JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  LEFT JOIN public.leads AS l ON l.id = a.lead_id
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), joined_flagged AS (
  SELECT
    date_population.*,
    (
      scan_session_id IS NOT NULL
      AND uploaded_document_id IS NOT NULL
      AND lead_id IS NOT NULL
      AND is_test IS FALSE
    ) AS is_joined_non_test
  FROM date_population
), quality_flagged AS (
  SELECT
    joined_flagged.*,
    (
      is_joined_non_test
      AND analysis_status = 'complete'
      AND scan_session_status IN ('preview_ready', 'awaiting_verification', 'revealed')
    ) AS is_quality_precursor
  FROM joined_flagged
), population_flagged AS (
  SELECT
    quality_flagged.*,
    (
      is_quality_precursor
      AND document_is_window_door_related IS TRUE
      AND confidence_score BETWEEN 0.4 AND 1
      AND document_type IS NOT NULL
      AND btrim(document_type) <> ''
      AND lower(btrim(document_type)) <> 'unknown'
      AND full_json IS NOT NULL
      AND jsonb_typeof(full_json) = 'object'
      AND jsonb_typeof(full_json -> 'extraction') = 'object'
      AND CASE
        WHEN jsonb_typeof(full_json -> 'extraction' -> 'line_items') = 'array'
        THEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') >= 1
        ELSE false
      END
    ) AS is_restricted
  FROM quality_flagged
), population_counts AS (
  SELECT
    COUNT(*) AS all_analysis_count,
    COUNT(DISTINCT scan_session_id) AS all_session_count,
    COUNT(DISTINCT uploaded_document_id) AS all_document_count,
    COUNT(DISTINCT lead_id) AS all_lead_count,
    COUNT(*) FILTER (WHERE is_joined_non_test) AS joined_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_joined_non_test) AS joined_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_joined_non_test) AS joined_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_joined_non_test) AS joined_lead_count,
    COUNT(*) FILTER (WHERE is_quality_precursor) AS quality_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_quality_precursor) AS quality_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_quality_precursor) AS quality_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_quality_precursor) AS quality_lead_count,
    COUNT(*) FILTER (WHERE is_restricted) AS restricted_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_restricted) AS restricted_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_restricted) AS restricted_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_restricted) AS restricted_lead_count
  FROM population_flagged
), privacy_values AS (
  SELECT privacy_value
  FROM population_counts AS pc
  CROSS JOIN LATERAL (
    VALUES
      (pc.all_analysis_count), (pc.all_session_count), (pc.all_document_count), (pc.all_lead_count),
      (pc.joined_analysis_count), (pc.joined_session_count), (pc.joined_document_count), (pc.joined_lead_count),
      (pc.quality_analysis_count), (pc.quality_session_count), (pc.quality_document_count), (pc.quality_lead_count),
      (pc.restricted_analysis_count), (pc.restricted_session_count), (pc.restricted_document_count), (pc.restricted_lead_count),
      (pc.all_analysis_count - pc.joined_analysis_count),
      (pc.all_session_count - pc.joined_session_count),
      (pc.all_document_count - pc.joined_document_count),
      (pc.all_lead_count - pc.joined_lead_count),
      (pc.all_analysis_count - pc.quality_analysis_count),
      (pc.all_session_count - pc.quality_session_count),
      (pc.all_document_count - pc.quality_document_count),
      (pc.all_lead_count - pc.quality_lead_count),
      (pc.all_analysis_count - pc.restricted_analysis_count),
      (pc.all_session_count - pc.restricted_session_count),
      (pc.all_document_count - pc.restricted_document_count),
      (pc.all_lead_count - pc.restricted_lead_count),
      (pc.joined_analysis_count - pc.quality_analysis_count),
      (pc.joined_session_count - pc.quality_session_count),
      (pc.joined_document_count - pc.quality_document_count),
      (pc.joined_lead_count - pc.quality_lead_count),
      (pc.joined_analysis_count - pc.restricted_analysis_count),
      (pc.joined_session_count - pc.restricted_session_count),
      (pc.joined_document_count - pc.restricted_document_count),
      (pc.joined_lead_count - pc.restricted_lead_count),
      (pc.quality_analysis_count - pc.restricted_analysis_count),
      (pc.quality_session_count - pc.restricted_session_count),
      (pc.quality_document_count - pc.restricted_document_count),
      (pc.quality_lead_count - pc.restricted_lead_count)
  ) AS protected_values(privacy_value)
), related_population_gate AS (
  SELECT
    COALESCE(bool_or(privacy_value BETWEEN 1 AND 4), false)
      AS suppress_related_population
  FROM privacy_values
),
restricted_parent AS (
  SELECT full_json
  FROM population_flagged
  WHERE is_restricted
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
), bucket_gate AS (
  SELECT COALESCE(bool_or(extracted_line_item_count BETWEEN 1 AND 4), false) AS suppress_bucket
  FROM bucket_counts
), decision AS (
  SELECT
    bucket_gate.suppress_bucket
    OR related_population_gate.suppress_related_population AS suppress_distribution
  FROM bucket_gate
  CROSS JOIN related_population_gate
), output_rows AS (
  SELECT
    true AS distribution_suppressed,
    5 AS suppression_threshold,
    NULL::text AS description_shape_state,
    NULL::bigint AS extracted_line_item_count
  FROM decision
  WHERE suppress_distribution
  UNION ALL
  SELECT
    false,
    5,
    bucket_counts.description_shape_state,
    bucket_counts.extracted_line_item_count
  FROM bucket_counts
  CROSS JOIN decision
  WHERE NOT suppress_distribution
)
SELECT
  distribution_suppressed,
  suppression_threshold,
  description_shape_state,
  extracted_line_item_count
FROM output_rows
ORDER BY description_shape_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

### A04-PR-010 — Shape-coordinated description-length distribution

`INCORPORATED_FROM_04C_AWAITING_INDEPENDENT_REVIEW`

1. **Stable ID:** `A04-PR-010`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Return the frozen nonempty description-length distribution only when description-shape, length-bucket, and nested-population complement gates all permit release.
4. **Confirmed source bindings:** Four allowlisted relations; exact frozen restricted predicate; only `line_items[].description` type and character length.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS` after separate authorization; exact corrected-pack review.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `description_length_state`, `extracted_line_item_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** Date-bounded four-relation source graph followed by one guarded line-item expansion reused for shape and length gates; at most four unsuppressed rows, one suppressed control row, or a documented successful-empty result.
9. **Index/constraint dependency:** Same as original PR-009/010; relation-size and timeout gates remain mandatory.
10. **Safety rationale:** Description content never leaves the query; explicit `CASE` type enforcement, coordinated shape/length gates, and the shared population/complement gate jointly control release.
11. **Suppression behavior:** Suppress the entire distribution when any nonzero shape bucket, length bucket, exposed nested-population count, or adjacent-population complement is 1–4; no nonempty bucket row is released when suppressed.
12. **Hard-stop conditions:** Any preflight/review failure, wrong JSON path, raw content, unexpected label, output mismatch, timeout, or suppression mismatch.
13. **Exact SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH date_population AS (
  SELECT
    a.id AS analysis_id,
    a.analysis_status,
    a.document_is_window_door_related,
    a.confidence_score,
    a.document_type,
    a.full_json,
    s.id AS scan_session_id,
    s.status AS scan_session_status,
    qf.id AS uploaded_document_id,
    l.id AS lead_id,
    l.is_test
  FROM public.analyses AS a
  LEFT JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  LEFT JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  LEFT JOIN public.leads AS l ON l.id = a.lead_id
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), joined_flagged AS (
  SELECT
    date_population.*,
    (
      scan_session_id IS NOT NULL
      AND uploaded_document_id IS NOT NULL
      AND lead_id IS NOT NULL
      AND is_test IS FALSE
    ) AS is_joined_non_test
  FROM date_population
), quality_flagged AS (
  SELECT
    joined_flagged.*,
    (
      is_joined_non_test
      AND analysis_status = 'complete'
      AND scan_session_status IN ('preview_ready', 'awaiting_verification', 'revealed')
    ) AS is_quality_precursor
  FROM joined_flagged
), population_flagged AS (
  SELECT
    quality_flagged.*,
    (
      is_quality_precursor
      AND document_is_window_door_related IS TRUE
      AND confidence_score BETWEEN 0.4 AND 1
      AND document_type IS NOT NULL
      AND btrim(document_type) <> ''
      AND lower(btrim(document_type)) <> 'unknown'
      AND full_json IS NOT NULL
      AND jsonb_typeof(full_json) = 'object'
      AND jsonb_typeof(full_json -> 'extraction') = 'object'
      AND CASE
        WHEN jsonb_typeof(full_json -> 'extraction' -> 'line_items') = 'array'
        THEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') >= 1
        ELSE false
      END
    ) AS is_restricted
  FROM quality_flagged
), population_counts AS (
  SELECT
    COUNT(*) AS all_analysis_count,
    COUNT(DISTINCT scan_session_id) AS all_session_count,
    COUNT(DISTINCT uploaded_document_id) AS all_document_count,
    COUNT(DISTINCT lead_id) AS all_lead_count,
    COUNT(*) FILTER (WHERE is_joined_non_test) AS joined_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_joined_non_test) AS joined_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_joined_non_test) AS joined_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_joined_non_test) AS joined_lead_count,
    COUNT(*) FILTER (WHERE is_quality_precursor) AS quality_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_quality_precursor) AS quality_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_quality_precursor) AS quality_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_quality_precursor) AS quality_lead_count,
    COUNT(*) FILTER (WHERE is_restricted) AS restricted_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_restricted) AS restricted_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_restricted) AS restricted_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_restricted) AS restricted_lead_count
  FROM population_flagged
), privacy_values AS (
  SELECT privacy_value
  FROM population_counts AS pc
  CROSS JOIN LATERAL (
    VALUES
      (pc.all_analysis_count), (pc.all_session_count), (pc.all_document_count), (pc.all_lead_count),
      (pc.joined_analysis_count), (pc.joined_session_count), (pc.joined_document_count), (pc.joined_lead_count),
      (pc.quality_analysis_count), (pc.quality_session_count), (pc.quality_document_count), (pc.quality_lead_count),
      (pc.restricted_analysis_count), (pc.restricted_session_count), (pc.restricted_document_count), (pc.restricted_lead_count),
      (pc.all_analysis_count - pc.joined_analysis_count),
      (pc.all_session_count - pc.joined_session_count),
      (pc.all_document_count - pc.joined_document_count),
      (pc.all_lead_count - pc.joined_lead_count),
      (pc.all_analysis_count - pc.quality_analysis_count),
      (pc.all_session_count - pc.quality_session_count),
      (pc.all_document_count - pc.quality_document_count),
      (pc.all_lead_count - pc.quality_lead_count),
      (pc.all_analysis_count - pc.restricted_analysis_count),
      (pc.all_session_count - pc.restricted_session_count),
      (pc.all_document_count - pc.restricted_document_count),
      (pc.all_lead_count - pc.restricted_lead_count),
      (pc.joined_analysis_count - pc.quality_analysis_count),
      (pc.joined_session_count - pc.quality_session_count),
      (pc.joined_document_count - pc.quality_document_count),
      (pc.joined_lead_count - pc.quality_lead_count),
      (pc.joined_analysis_count - pc.restricted_analysis_count),
      (pc.joined_session_count - pc.restricted_session_count),
      (pc.joined_document_count - pc.restricted_document_count),
      (pc.joined_lead_count - pc.restricted_lead_count),
      (pc.quality_analysis_count - pc.restricted_analysis_count),
      (pc.quality_session_count - pc.restricted_session_count),
      (pc.quality_document_count - pc.restricted_document_count),
      (pc.quality_lead_count - pc.restricted_lead_count)
  ) AS protected_values(privacy_value)
), related_population_gate AS (
  SELECT
    COALESCE(bool_or(privacy_value BETWEEN 1 AND 4), false)
      AS suppress_related_population
  FROM privacy_values
),
restricted_parent AS (
  SELECT full_json
  FROM population_flagged
  WHERE is_restricted
), expanded AS (
  SELECT
    CASE
      WHEN jsonb_typeof(line_item.value) <> 'object' THEN 'wrong_type'
      WHEN line_item.value -> 'description' IS NULL THEN 'missing'
      WHEN jsonb_typeof(line_item.value -> 'description') <> 'string' THEN 'wrong_type'
      WHEN length(line_item.value ->> 'description') = 0 THEN 'empty'
      ELSE 'nonempty'
    END AS description_shape_state,
    CASE
      WHEN jsonb_typeof(line_item.value) = 'object'
       AND jsonb_typeof(line_item.value -> 'description') = 'string'
       AND length(line_item.value ->> 'description') >= 1
      THEN length(line_item.value ->> 'description')
      ELSE NULL::integer
    END AS description_length
  FROM restricted_parent
  CROSS JOIN LATERAL jsonb_array_elements(
    restricted_parent.full_json -> 'extraction' -> 'line_items'
  ) AS line_item(value)
), shape_bucket_counts AS (
  SELECT description_shape_state, COUNT(*) AS extracted_line_item_count
  FROM expanded
  GROUP BY description_shape_state
  HAVING COUNT(*) > 0
), shape_gate AS (
  SELECT COALESCE(bool_or(extracted_line_item_count BETWEEN 1 AND 4), false) AS suppress_shape
  FROM shape_bucket_counts
), length_bucket_counts AS (
  SELECT
    CASE
      WHEN description_length <= 80 THEN 'short_1_to_80'
      WHEN description_length <= 240 THEN 'medium_81_to_240'
      WHEN description_length <= 500 THEN 'long_241_to_500'
      ELSE 'oversized_501_plus'
    END AS description_length_state,
    COUNT(*) AS extracted_line_item_count
  FROM expanded
  WHERE description_length IS NOT NULL
  GROUP BY description_length_state
  HAVING COUNT(*) > 0
), length_gate AS (
  SELECT COALESCE(bool_or(extracted_line_item_count BETWEEN 1 AND 4), false) AS suppress_length
  FROM length_bucket_counts
), decision AS (
  SELECT
    shape_gate.suppress_shape
    OR length_gate.suppress_length
    OR related_population_gate.suppress_related_population AS suppress_distribution
  FROM shape_gate
  CROSS JOIN length_gate
  CROSS JOIN related_population_gate
), output_rows AS (
  SELECT
    true AS distribution_suppressed,
    5 AS suppression_threshold,
    NULL::text AS description_length_state,
    NULL::bigint AS extracted_line_item_count
  FROM decision
  WHERE suppress_distribution
  UNION ALL
  SELECT
    false,
    5,
    length_bucket_counts.description_length_state,
    length_bucket_counts.extracted_line_item_count
  FROM length_bucket_counts
  CROSS JOIN decision
  WHERE NOT suppress_distribution
)
SELECT
  distribution_suppressed,
  suppression_threshold,
  description_length_state,
  extracted_line_item_count
FROM output_rows
ORDER BY description_length_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

14. **Result placeholder:** `NOT_EXECUTED`
15. **Corrected-pack technical-review status:** `NOT_REVIEWED`
16. **Operator decision:** `NOT_RECORDED`
17. **Execution authorization:** `NOT_AUTHORIZED`

## 15. Complementary-disclosure control summary

Audit 04C identified 22 exact nested-population reconstruction paths in Audit 04B. The eight incorporated replacement candidates contain the supplied shared population and adjacent-complement gates. Structural incorporation is confirmed; effectiveness is not.

Within-query bucket suppression alone is insufficient. A visible total must not permit subtraction that reveals a hidden 1–4 complement. Each affected replacement candidate suppresses its output when its local bucket gate or its supplied related-population gate activates. A suppressed row contains no bucket label, count, total, identifier, or sensitive dimension.

Do not state that the 22 defects are resolved until the complete Audit 04D pack receives an independent review of all 45 application-query pairs.

## 16. JSON-safety control summary

The incorporated `A04-PR-005`, `A04-PR-009`, and `A04-PR-010` SQL uses explicit `CASE` type enforcement before `jsonb_array_length` determines restricted membership. It does not rely on textual Boolean `AND` ordering for that operation.

`jsonb_array_elements` appears only in PR-009 and PR-010 after the corrected `restricted_parent` CTE has established array membership through the explicit `CASE` expression. This is structural inspection only—not parser, planner, malformed-data, or runtime proof.

## 17. Execution-consistency contract

Application execution remains prohibited unless the operator can establish all of the following:

1. A confirmed quiescent window with no relevant writes to `public.analyses`, `public.scan_sessions`, `public.quote_files`, or `public.leads`.
2. One uninterrupted application-query run.
3. All six preflights completed and accepted immediately beforehand.
4. Related queries executed adjacently, especially PR-004/PR-005 and PR-009/PR-010.
5. No isolated retry of one query from a related pair.
6. Complete result-set invalidation after any timeout, permission error, unexpected column or row, session reset, suspected write, target drift, or role drift.
7. No combination of outputs from different runs.
8. After an error or timeout, a separately reviewed explicit `ROLLBACK;` or complete SQL Editor session discard before another query.

`IF_QUIESCENCE_CANNOT_BE_CONFIRMED_APPLICATION_EXECUTION_IS_BLOCKED`

These controls are proposed prerequisites only. They are not currently proven, approved, or enforced by the SQL.

## 18. Human/operator review checklist

### Static assembly validation record

| Check | Assembly result | Proof limit |
|---|---|---|
| Six unique preflight IDs | PASS | Text structure only |
| Ten unique application IDs | PASS | Text structure only |
| No missing, duplicate, renamed, or added ID | PASS | Text structure only |
| Eight preserved SQL blocks equal Audit 04B | PASS | Exact in-memory text comparison |
| Eight replacement SQL blocks equal Audit 04C | PASS | Exact in-memory text comparison |
| Sixteen read-only wrappers and terminal rollbacks | PASS | Static text only |
| Three frozen timeouts and search path in every block | PASS | Static text only |
| Frozen application date interval in every PR block | PASS | Static text only |
| Only four allowlisted public relations in PR blocks | PASS | Static text only |
| Every final output bounded to at most 100 rows | PASS | Static text only |
| Positive output allowlists present | PASS | Documentation check only |
| Explicit safe JSON enforcement in PR-005/009/010 | PASS | Structural text check only |
| Shared 04C gate logic in all eight replacements | PASS | Structural text check only |
| PF-005 exactly-100 hard stop documented | PASS | Documentation check only |
| PR-010 successful-empty behavior documented | PASS | Documentation check only |
| Execution-consistency contract present | PASS | Documentation check only |
| SQL or external operation occurred | PASS: NO | Local read-only inspection only |

### Required independent review

- [ ] Verify the exact Dashboard branch is `zgsofkgddpcntdvpckdq`.
- [ ] Rehash this artifact and every source artifact.
- [ ] Independently review all sixteen SQL blocks.
- [ ] Recompute all 45 application-query disclosure pairs.
- [ ] Verify output columns against each positive allowlist.
- [ ] Review query cost and index dependencies after accepted PF-005/PF-006 results.
- [ ] Confirm the quiescence control is operationally feasible.
- [ ] Record a human security/privacy review.
- [ ] Leave execution unauthorized until a separate operator decision.

## 19. Manual execution ledger template

| Query ID | Target verified | Role verified | Prior gates | UTC start | UTC end | Status | Output columns verified | Rows returned | Suppressed | Successful empty | Timeout/error cleanup | Operator |
|---|---|---|---|---|---|---|---|---:|---|---|---|---|
| A04-PF-001 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | N/A | N/A | N/A | NOT_RECORDED |
| A04-PF-002 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | N/A | N/A | N/A | NOT_RECORDED |
| A04-PF-003 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | N/A | N/A | N/A | NOT_RECORDED |
| A04-PF-004 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | N/A | N/A | N/A | NOT_RECORDED |
| A04-PF-005 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | N/A | N/A | N/A | NOT_RECORDED |
| A04-PF-006 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | N/A | N/A | N/A | NOT_RECORDED |
| A04-PR-001 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PR-002 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PR-003 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PR-004 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PR-005 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PR-006 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PR-007 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PR-008 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PR-009 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PR-010 | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_EXECUTED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |

This ledger is a template only and conveys no authorization.

## 20. Aggregate-result placeholders

| Query ID | Expected result category | Aggregate result | Interpretation | Limitation | Status |
|---|---|---|---|---|---|
| A04-PF-001 | Identity/role metadata | NOT_EXECUTED | NOT_RECORDED | Dashboard branch ref still requires operator confirmation | NOT_EXECUTED |
| A04-PF-002 | Relation/RLS metadata | NOT_EXECUTED | NOT_RECORDED | Static pack only | NOT_EXECUTED |
| A04-PF-003 | Column/type metadata | NOT_EXECUTED | NOT_RECORDED | Static pack only | NOT_EXECUTED |
| A04-PF-004 | Constraint metadata | NOT_EXECUTED | NOT_RECORDED | Static pack only | NOT_EXECUTED |
| A04-PF-005 | Index metadata | NOT_EXECUTED | NOT_RECORDED | Exactly 100 rows is a hard stop | NOT_EXECUTED |
| A04-PF-006 | Estimate/size metadata | NOT_EXECUTED | NOT_RECORDED | Catalog estimates may be stale | NOT_EXECUTED |
| A04-PR-001 | Unsegmented totals | NOT_EXECUTED | NOT_RECORDED | Operational persistence window only | NOT_EXECUTED |
| A04-PR-002 | Suppressed/fixed distribution | NOT_EXECUTED | NOT_RECORDED | Independent review pending | NOT_EXECUTED |
| A04-PR-003 | Suppressed/fixed distribution | NOT_EXECUTED | NOT_RECORDED | Independent review pending | NOT_EXECUTED |
| A04-PR-004 | Suppressed exclusion funnel | NOT_EXECUTED | NOT_RECORDED | Restricted quality only | NOT_EXECUTED |
| A04-PR-005 | Suppressed entity totals | NOT_EXECUTED | NOT_RECORDED | No quote/project/revision meaning | NOT_EXECUTED |
| A04-PR-006 | Suppressed confidence states | NOT_EXECUTED | NOT_RECORDED | No model comparison | NOT_EXECUTED |
| A04-PR-007 | Suppressed validity states | NOT_EXECUTED | NOT_RECORDED | No raw document types | NOT_EXECUTED |
| A04-PR-008 | Suppressed array states | NOT_EXECUTED | NOT_RECORDED | Not opening count | NOT_EXECUTED |
| A04-PR-009 | Suppressed description shapes | NOT_EXECUTED | NOT_RECORDED | No content output | NOT_EXECUTED |
| A04-PR-010 | Suppressed length states or successful empty | NOT_EXECUTED | NOT_RECORDED | Zero rows must be `SUCCESSFUL_EMPTY` | NOT_EXECUTED |

## 21. Successful-empty, suppression, failure, timeout, and hard-stop register

| Register ID | Query/scope | Condition | Required classification | Required action | Current state |
|---|---|---|---|---|---|
| A04D-R-001 | PR-010 | No restricted parents or no nonempty length bucket and no suppression condition | SUCCESSFUL_EMPTY | Record zero rows; do not relabel as suppression/failure | NOT_EXECUTED |
| A04D-R-002 | Any segmented PR | Any nonzero protected cell or supplied complement is 1–4 | SUPPRESSED | Accept only one documented control row | NOT_EXECUTED |
| A04D-R-003 | Any query | Timeout | TIMED_OUT / HARD_STOP | Invalidate run; reviewed rollback or discard session | NOT_EXECUTED |
| A04D-R-004 | Any query | SQL/permission/result-shape error | FAILED / HARD_STOP | Invalidate run; reviewed rollback or discard session | NOT_EXECUTED |
| A04D-R-005 | PF-005 | Exactly 100 rows | HARD_STOP_TRUNCATION_AMBIGUOUS | Do not continue; revise/re-review preflight | NOT_EXECUTED |
| A04D-R-006 | PF-006 | Negative/unavailable estimate or threshold breach | HARD_STOP_SIZE_OR_ESTIMATE | Do not continue | NOT_EXECUTED |
| A04D-R-007 | PF-005/PF-006 | Missing `analyses.created_at` index | HARD_STOP_PENDING_FULL_SCAN_REVIEW | Obtain explicit bounded-full-scan review | NOT_EXECUTED |
| A04D-R-008 | Application run | Quiescence cannot be confirmed | HARD_STOP_QUIESCENCE | Do not execute application queries | NOT_EXECUTED |
| A04D-R-009 | Any query | Unexpected raw value, identifier, PII, text, path, column, or suppression failure | SENSITIVE_OUTPUT_INCIDENT / HARD_STOP | Stop, do not copy further output, invalidate run | NOT_EXECUTED |

## 22. Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Build implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|
| A04D-001 | CONFIRMED | Nine authorized inputs matched frozen identities before assembly | Local files | Section 3 | Byte counts, line counts, and SHA-256 recorded | Entry gate passed | High | Rehash after creation |
| A04D-002 | CONFIRMED | Audit 04C required eight replacements and retained eight queries | Audit 04C | Query-review table and terminal state | Eight `APPROVED_AS_WRITTEN`; eight `REQUIRES_CORRECTION` | Second candidate required | High | Independent 04D review |
| A04D-003 | CONFIRMED | Eight preserved SQL blocks equal Audit 04B source text | In-memory comparison | PF-001–006, PR-001, PR-004 | Exact string equality | Preserved provenance established | High | Reconfirm artifact readback |
| A04D-004 | CONFIRMED | Eight incorporated SQL blocks equal Audit 04C proposal text | In-memory comparison | PR-002, PR-003, PR-005–010 | Exact string equality | Replacement provenance established | High | Reconfirm artifact readback |
| A04D-005 | CONFIRMED | Explicit JSON type enforcement is present in the three affected replacements | Audit 04C SQL | PR-005, PR-009, PR-010 | `CASE` precedes restricted-membership array length | Prior textual-AND defect structurally addressed | High | Runtime remains unproven |
| A04D-006 | CONFIRMED | Supplied shared population/complement gates are present | Audit 04C SQL | All eight replacements | `privacy_values` and `related_population_gate` retained | Candidate disclosure repair incorporated | High | Recompute all 45 pairs |
| A04D-007 | CONFIRMED | Every SQL package remains read-only and timeout-protected by text | Audit 04D | Sixteen SQL blocks | Wrapper, three timeouts, search path, limit, rollback present | Candidate meets structural shell | High | Parser/runtime review still required |
| A04D-008 | CONFIRMED | Independent transactions do not provide a shared application snapshot | Audit 04C and Audit 04D | Section 17 | Cross-query consistency depends on operational quiescence | Execution remains blocked | High | Prove feasible control |
| A04D-009 | CONFIRMED | No SQL or external operation occurred during assembly | Execution log | This task | Local reads and authorized Markdown creation only | No production-state impact | High | Preserve non-authorization |
| A04D-010 | UNKNOWN | PostgreSQL parsing, planning, permissions, workload, timeout, and data-dependent output behavior | Not executed | Entire pack | Static assembly cannot prove runtime | Execution cannot be approved here | High | Independent review and separately authorized preflights |

## 23. Limitations

- This is an assembled candidate, not an independent technical review.
- No database, Supabase, network, Storage, function, RPC, job, log, build, test, formatter, generator, or package tool was invoked.
- PostgreSQL 17.6 compatibility remains static-review evidence only.
- Catalog estimates can be stale and are not application profiling.
- Separate queries do not share a snapshot.
- Quiescence is a required proposed execution control but is not proven available.
- The exact eight incorporated replacements remain subject to independent review.
- The 22 prior disclosure defects must not be called resolved before a complete 45-pair review.
- No operator identity, decision, target approval, execution method, or execution authorization is recorded.

## 24. Audit 04E handoff

Audit 04E may begin only as a separately authorized independent review. It must receive:

- This exact artifact and SHA-256.
- All nine source hashes.
- The eight preserved and eight incorporated SQL provenance hashes.
- A fresh 16-query structural inventory.
- A complete independent 45-pair application disclosure matrix.
- Independent review of PR-005/PR-009/PR-010 JSON enforcement.
- Independent review of the execution-consistency and quiescence contract.
- PF-005 exactly-100 and PF-006 estimate/size hard stops.
- Confirmation that PR-010 zero rows are `SUCCESSFUL_EMPTY`.

Audit 04E must not infer permission to execute preflights. Any later preflight authorization and results validation require a distinct operator decision.

## 25. Audit 05 handoff — BLOCKED

Audit 05 is blocked. No profiling result exists, no query is authorized, no preflight has run, no application aggregate has been returned, and Audit 04D has not received independent review.

AUDIT_04D_PRIVACY_HARDENED_PACK_CREATED_AWAITING_INDEPENDENT_REVIEW
TECHNICAL_REVIEW: NOT_COMPLETED
OPERATOR_DECISION: NOT_RECORDED
SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED
