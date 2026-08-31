# Audit 04H — Preflight-Only Operator Decision and Manual Execution Runbook

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 04H — Preflight-Only Operator Decision and Manual Execution Runbook |
| UTC decision/artifact time | `2026-08-31T03:46:00Z` |
| Execution environment | CODEX; local read-only artifact inspection and runbook preparation |
| Working directory/repository root | `C:\Projects\wm-mvp-github-clean` |
| Branch | `forensic_report_v2` |
| Commit | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Upstream | `origin/forensic_report_v2` |
| Remote parity | `NO`; network prohibited |
| Initial Git status | No tracked/staged changes; 18 pre-existing untracked audit artifacts |
| SQL executed by agent | `NO` |
| Database/Supabase accessed by agent | `NO` |
| Operator decision | `AUTHORIZED_PREFLIGHT_ONLY` |
| Application authorization | `NOT_AUTHORIZED` |

## 2. Input manifest and hashes

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
| `docs\audits\04D_PRIVACY_HARDENED_DATA_PROFILING_QUERY_PACK.md` | 133,770 | 2,694 | `EC10D1A689042DAA82839FF8DFAEB33320BC9A46672A014DCE61F526C051B6FD` |
| `docs\audits\04E_PRIVACY_HARDENED_PACK_INDEPENDENT_REVIEW.md` | 49,955 | 811 | `592E2440D14E4D22D3746BA2F40C478022BE177B7D606E9C625733994056A8B6` |
| `docs\audits\04F_DIRECT_JSON_GUARD_CORRECTED_QUERY_PACK.md` | 137,809 | 2,751 | `60A894F2D86F763367D5FA06045DFBAA345D0223488ADEF53C501797D7F7A237` |
| `docs\audits\04G_DIRECT_JSON_GUARD_PACK_INDEPENDENT_REVIEW.md` | 59,181 | 371 | `9CFB42B3AD8E387C809AC87D47F6F83B511D18C98227C3F8EB80DEC38682191C` |

All thirteen inputs existed and were read completely.

## 3. Entry-validation record

| Gate | Result |
|---|---|
| Thirteen inputs present and identified | PASS |
| Audit 04F required SHA-256 | PASS |
| Audit 04G exact size, lines, and SHA-256 | PASS |
| Audit 04G: 16 approved; 0 correction; 0 rejected | PASS |
| Direct JSON defect resolved; eight gates PASS_STATIC | PASS |
| Forty-five pairs; zero confirmed defects | PASS |
| Audit 04G operator-decision terminal state | PASS |
| Six exact Audit 04F preflight packages | PASS |
| Initial Git status captured | PASS |
| Audit 04H absent before creation | PASS |

## 4. Operator authorization record

| Field | Recorded value |
|---|---|
| Founder/operator identity | `WindowMan Founder and Product Owner` |
| Personal name | `NOT_RECORDED` |
| Decision | `AUTHORIZED_PREFLIGHT_ONLY` |
| Decision source | Explicit operator declaration in this prompt |
| UTC decision time | `2026-08-31T03:46:00Z` |
| Authorized IDs | `A04-PF-001` through `A04-PF-006` only |
| Authorized target ref | `zgsofkgddpcntdvpckdq` |
| Method | Manual Supabase Dashboard SQL Editor; one exact query at a time |
| Authorized executor | WindowMan Founder/Product Owner or directly supervised operator |
| Application query authorization | `NONE` |
| DDL/DML authorization | `NONE` |
| Authorization expiry | Immediately after one complete preflight sequence or any hard stop |
| Retry authorization | `NONE` |
| Ad hoc SQL edits | `PROHIBITED` |

`PREFLIGHT_SQL_EXECUTION_AUTHORIZATION: AUTHORIZED_MANUAL_ONLY`

`APPLICATION_SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED`

## 5. Authorized target

- Project display: `WMProd`.
- Environment: `LIVE_ACTIVE / PRODUCTION WORKLOAD`.
- Branch: `forensic_report_v1`.
- Branch ref: `zgsofkgddpcntdvpckdq`.
- Prohibited parent ref: `wkrcyxcnzhwjtdpmfpaf`.
- Expected PostgreSQL version: `17.6` / `server_version_num=170006`.
- Expected role: `postgres`, non-superuser, inheritance true, `BYPASSRLS=true`.

PostgreSQL session metadata does not prove the Supabase branch ref.

## 6. Authorized query IDs

1. `A04-PF-001`
2. `A04-PF-002`
3. `A04-PF-003`
4. `A04-PF-004`
5. `A04-PF-005`
6. `A04-PF-006`

No other query is authorized.

## 7. Explicit prohibited scope

All `A04-PR-*` application queries; application profiling; DDL; DML; migrations; RPCs; Edge Functions; Storage; Auth; logs; jobs; queues; webhooks; deployments; quiescence claims; Audit 05; retries; edited SQL; batched or simultaneous execution; any other target or query.

## 8. Target-verification checklist

Before every preflight, the operator must visually verify and record:

- [ ] Project display is `WMProd`.
- [ ] Branch is `forensic_report_v1`.
- [ ] Branch ref is `zgsofkgddpcntdvpckdq`.
- [ ] Prohibited parent `wkrcyxcnzhwjtdpmfpaf` is not selected.
- [ ] SQL Editor is connected to the intended branch.
- [ ] Current query ID is the next authorized preflight.
- [ ] Query text is unchanged from this runbook.
- [ ] Visual verification UTC: `NOT_RECORDED`.

Any uncertainty is an immediate hard stop.

## 9. Sequential six-query runbook

Execute in the numbered order only. Use a new blank SQL Editor query for each step. Run once, wait, record the result, compare every PASS condition, and stop before the next query. Continue only after an unambiguous PASS.

### 1. A04-PF-001

1. **Query ID:** `A04-PF-001`
2. **Purpose:** Confirm the reviewed database name, PostgreSQL 17.6 version number, current/session role, and role attributes without reading application rows.
3. **What it proves:** The SQL Editor session reports the expected database name, PostgreSQL version number, current/session role, and role attributes.
4. **What it does not prove:** It does not prove the Supabase branch ref, application schema health beyond identity, data quality, quiescence, or execution safety.
5. **Expected output columns:** `database_name`, `current_role_name`, `session_role_name`, `server_version`, `server_version_num`, `is_superuser`, `inherits_roles`, `bypasses_rls`, `binding_status`.
6. **Expected row shape/maximum:** Exactly 1 row. Source package scope: One exact `pg_roles` row; one output row.
7. **Exact SQL copied from Audit 04F:**

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

8. **Positive output allowlist:** Exactly the nine expected columns above.
9. **PASS conditions:** One row; exact nine columns; `database_name=postgres`; current/session role `postgres`; `server_version_num=170006`; non-superuser; inheritance true; `bypasses_rls=true`; `binding_status=PASS`.
10. **Hard-stop conditions:** No/multiple row; output mismatch; wrong database/version/role; superuser true; inheritance false; BYPASSRLS false; any non-PASS binding. Common hard stops also apply.
11. **Result placeholder:** `NOT_EXECUTED`
12. **UTC execution time:** `NOT_RECORDED`
13. **Duration:** `NOT_RECORDED`
14. **SQL Editor result status:** `NOT_EXECUTED`
15. **Operator notes:** `NOT_RECORDED`
16. **Authorization status:** `AUTHORIZED_MANUAL_ONLY`
17. **Application authorization:** `NOT_AUTHORIZED`

### 2. A04-PF-002

1. **Query ID:** `A04-PF-002`
2. **Purpose:** Confirm that the four exact allowlisted objects remain ordinary public tables with RLS enabled and forced RLS disabled.
3. **What it proves:** The four allowlisted objects exist as ordinary `public` tables with the reviewed RLS and forced-RLS states.
4. **What it does not prove:** It does not prove policies, grants, application data, row visibility, or branch identity.
5. **Expected output columns:** `schema_name`, `relation_name`, `relation_kind`, `rls_enabled`, `forced_rls`, `binding_status`.
6. **Expected row shape/maximum:** Exactly 4 rows. Source package scope: Four exact catalog lookups; four output rows.
7. **Exact SQL copied from Audit 04F:**

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

8. **Positive output allowlist:** Exactly the six expected columns above.
9. **PASS conditions:** Exactly four expected relations; exact six columns; each is an ordinary table; reviewed RLS/forced-RLS values match; every `binding_status=PASS`.
10. **Hard-stop conditions:** Not four rows; missing/extra relation; wrong kind/RLS state; output mismatch; any non-PASS binding. Common hard stops also apply.
11. **Result placeholder:** `NOT_EXECUTED`
12. **UTC execution time:** `NOT_RECORDED`
13. **Duration:** `NOT_RECORDED`
14. **SQL Editor result status:** `NOT_EXECUTED`
15. **Operator notes:** `NOT_RECORDED`
16. **Authorization status:** `AUTHORIZED_MANUAL_ONLY`
17. **Application authorization:** `NOT_AUTHORIZED`

### 3. A04-PF-003

1. **Query ID:** `A04-PF-003`
2. **Purpose:** Compare every column required by the generated application SQL with the deployed physical type and nullability frozen from Audit 03C.
3. **What it proves:** Every application-query column binding retains the reviewed deployed type and nullability.
4. **What it does not prove:** It does not prove values, constraints, indexes, data quality, or application-query runtime behavior.
5. **Expected output columns:** `schema_name`, `relation_name`, `column_name`, `expected_type`, `actual_type`, `expected_nullable`, `actual_nullable`, `binding_status`.
6. **Expected row shape/maximum:** Exactly 15 rows. Source package scope: Fifteen exact catalog column bindings; fifteen output rows.
7. **Exact SQL copied from Audit 04F:**

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

8. **Positive output allowlist:** Exactly the eight expected columns above.
9. **PASS conditions:** Exactly fifteen expected bindings; exact eight columns; every expected/actual type and nullability pair matches; `analyses.created_at` is `timestamp with time zone`; every `binding_status=PASS`.
10. **Hard-stop conditions:** Not fifteen rows; missing/extra column; type/nullability mismatch; wrong `created_at` type; output mismatch; any non-PASS binding. Common hard stops also apply.
11. **Result placeholder:** `NOT_EXECUTED`
12. **UTC execution time:** `NOT_RECORDED`
13. **Duration:** `NOT_RECORDED`
14. **SQL Editor result status:** `NOT_EXECUTED`
15. **Operator notes:** `NOT_RECORDED`
16. **Authorization status:** `AUTHORIZED_MANUAL_ONLY`
17. **Application authorization:** `NOT_AUTHORIZED`

### 4. A04-PF-004

1. **Query ID:** `A04-PF-004`
2. **Purpose:** Confirm only the primary, unique, and foreign-key constraints required for the approved entity labels and join chain.
3. **What it proves:** The eight required primary-key and foreign-key/constraint bindings match the frozen schema.
4. **What it does not prove:** It does not prove unique-index bindings delegated to PF-005, data validity, index health, or application runtime.
5. **Expected output columns:** `binding_name`, `relation_name`, `constraint_kind`, `local_columns`, `referenced_relation`, `referenced_columns`, `matched_constraint_name`, `binding_status`.
6. **Expected row shape/maximum:** Exactly 8 rows. Source package scope: Constraints on four exact relations; eight output rows. The unique `analyses.scan_session_id` binding is a unique-index binding and is reviewed in `A04-PF-005`, not misclassified here as a unique constraint.
7. **Exact SQL copied from Audit 04F:**

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

8. **Positive output allowlist:** Exactly the eight expected columns above.
9. **PASS conditions:** Exactly eight bindings; exact eight columns; all local/referenced columns and constraint kinds match; every `binding_status=PASS`.
10. **Hard-stop conditions:** Not eight rows; missing/mismatched constraint; wrong columns/reference/kind; output mismatch; any non-PASS binding. Common hard stops also apply.
11. **Result placeholder:** `NOT_EXECUTED`
12. **UTC execution time:** `NOT_RECORDED`
13. **Duration:** `NOT_RECORDED`
14. **SQL Editor result status:** `NOT_EXECUTED`
15. **Operator notes:** `NOT_RECORDED`
16. **Authorization status:** `AUTHORIZED_MANUAL_ONLY`
17. **Application authorization:** `NOT_AUTHORIZED`

### 5. A04-PF-005

1. **Query ID:** `A04-PF-005`
2. **Purpose:** Inventory indexes on the four exact relations, verify index validity/readiness, and determine whether `analyses.created_at` has a simple supporting index.
3. **What it proves:** The visible index inventory is valid/ready and supplies unambiguous required PK/unique/date-index evidence without truncation.
4. **What it does not prove:** It does not prove planner use, query cost, data quality, or safe full-scan performance; exactly 100 rows is ambiguous.
5. **Expected output columns:** `relation_name`, `index_name`, `is_unique`, `is_valid`, `is_ready`, `index_columns`, `is_partial`, `has_expression`, `index_health_status`.
6. **Expected row shape/maximum:** At least the required index rows and fewer than 100 total rows; exactly 100 is a hard stop. Source package scope: Index catalog rows for four exact relations; at most 100 output rows.
7. **Exact SQL copied from Audit 04F:**

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

8. **Positive output allowlist:** Exactly the nine expected columns above.
9. **PASS conditions:** Fewer than 100 rows; exact nine columns; all required PK/unique backing indexes appear; every required index is valid and ready; simple `analyses.created_at` index evidence is present and unambiguous; no unexpected relation/index state.
10. **Hard-stop conditions:** Exactly 100 rows; zero/ambiguous inventory; invalid/unready required index; missing required PK/unique backing index; missing or ambiguous simple `analyses.created_at` index evidence; output mismatch. Common hard stops also apply.
11. **Result placeholder:** `NOT_EXECUTED`
12. **UTC execution time:** `NOT_RECORDED`
13. **Duration:** `NOT_RECORDED`
14. **SQL Editor result status:** `NOT_EXECUTED`
15. **Operator notes:** `NOT_RECORDED`
16. **Authorization status:** `AUTHORIZED_MANUAL_ONLY`
17. **Application authorization:** `NOT_AUTHORIZED`

### 6. A04-PF-006

1. **Query ID:** `A04-PF-006`
2. **Purpose:** Recheck catalog row estimates and total relation bytes for the four exact sources before any application scan.
3. **What it proves:** Catalog estimates and relation sizes remain within the approved preflight thresholds.
4. **What it does not prove:** Catalog estimates may be stale; this does not scan rows, prove index use, performance, data quality, or quiescence.
5. **Expected output columns:** `relation_name`, `estimated_rows`, `total_bytes`, `relation_gate`, `combined_bytes`, `combined_gate`, `overall_size_gate`.
6. **Expected row shape/maximum:** Exactly 4 rows. Source package scope: Four catalog relation rows; four output rows; no application table scan.
7. **Exact SQL copied from Audit 04F:**

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

8. **Positive output allowlist:** Exactly the seven expected columns above.
9. **PASS conditions:** Exactly four relations and seven columns; each estimate is available, nonnegative, and ≤10,000; combined bytes ≤50,000,000; every relation and combined/overall gate is `PASS`.
10. **Hard-stop conditions:** Not four rows; missing/negative/unavailable estimate; any estimate >10,000; combined bytes >50,000,000; non-PASS gate; output mismatch. Common hard stops also apply.
11. **Result placeholder:** `NOT_EXECUTED`
12. **UTC execution time:** `NOT_RECORDED`
13. **Duration:** `NOT_RECORDED`
14. **SQL Editor result status:** `NOT_EXECUTED`
15. **Operator notes:** `NOT_RECORDED`
16. **Authorization status:** `AUTHORIZED_MANUAL_ONLY`
17. **Application authorization:** `NOT_AUTHORIZED`

## 10. Exact-SQL integrity and manual execution procedure

Static comparison confirms all six SQL fence bodies are identical to Audit 04F after line-ending normalization. No `A04-PR-*` SQL appears in this artifact. Every preflight retains `BEGIN TRANSACTION READ ONLY`, the three local timeouts, fixed search path, bounded output, and terminal `ROLLBACK;`.

For each authorized preflight:

1. Open the visually confirmed Supabase Dashboard branch.
2. Open SQL Editor and create a new blank query.
3. Paste only the exact current preflight SQL.
4. Recheck branch/ref and query ID.
5. Click Run exactly once.
6. Wait for completion.
7. Record UTC time, duration, success/error, exact output columns, row count, and sanitized metadata result.
8. Compare all PASS and hard-stop conditions.
9. Stop before opening the next preflight.
10. Continue only on an unambiguous PASS.

Never batch queries, run concurrently, edit text, retry, change target, continue after a warning, or run application SQL.

## 11. PASS criteria

| Query | Required PASS |
|---|---|
| A04-PF-001 | Exactly one row; nine exact columns; database `postgres`; roles `postgres`; version `170006`; non-superuser; inheritance and BYPASSRLS true; binding PASS |
| A04-PF-002 | Exactly four expected table rows; six exact columns; relation kind/RLS/forced-RLS match; all bindings PASS |
| A04-PF-003 | Exactly fifteen rows; eight exact columns; all types/nullability match; `created_at` timestamptz; all bindings PASS |
| A04-PF-004 | Exactly eight rows; eight exact columns; all required constraint identities and columns match; all bindings PASS |
| A04-PF-005 | Fewer than 100 rows; nine exact columns; required PK/unique indexes valid/ready; simple `analyses.created_at` index evidence present and unambiguous |
| A04-PF-006 | Exactly four rows; seven exact columns; estimates available/nonnegative/≤10,000; combined bytes ≤50,000,000; all gates PASS |

Any condition not affirmatively proven is not a PASS.

## 12. Required hard stops

Stop the entire sequence immediately for:

- target/ref uncertainty or prohibited parent selection;
- PF-001 database, version, role, or role-attribute mismatch;
- PF-002 relation identity, kind, or RLS mismatch;
- PF-003 column, type, or nullability mismatch;
- PF-004 constraint mismatch;
- PF-005 exactly 100 rows (`HARD_STOP_TRUNCATION_AMBIGUOUS`);
- invalid, unready, missing, or ambiguous required-index evidence;
- missing or ambiguous simple `analyses.created_at` index (`HARD_STOP_PENDING_FULL_SCAN_REVIEW`);
- PF-006 missing, negative, or unavailable estimate;
- any relation estimate over 10,000;
- combined bytes over 50,000,000;
- output-column or row-shape mismatch;
- timeout, permission error, SQL error, warning, or unexpected result;
- any application value, identifier, PII, JSON, description, filename, path, secret, or unexpected text;
- session reset or renewed target uncertainty.

After a hard stop: run no further preflight; do not edit or retry; preserve only the safe result/error; record the stopped query; mark all later preflights `NOT_EXECUTED`; mark application execution `BLOCKED`. Authorization expires immediately.

## 13. Error and transaction cleanup procedure

If an error or timeout occurs before terminal rollback is confirmed:

1. Stop the sequence.
2. Do not rerun the failed query.
3. Use exactly one documented cleanup method:
   - manually execute exactly the following statement in the same SQL Editor session, or
   - discard/close the session and create a new session.
4. Record the cleanup method.
5. Do not continue without a new operator decision.

Emergency cleanup authorization is limited to:

```text
ROLLBACK;
```

It authorizes no other SQL.

## 14. Preflight result ledger template

| Query ID | Target visually confirmed | Branch ref | UTC execution time | Duration | SQL Editor status | Output columns | Row count | Expected shape matched | Classification | Sanitized result attached | Cleanup required | Cleanup completed | Later queries blocked | Operator notes |
|---|---|---|---|---|---|---|---:|---|---|---|---|---|---|---|
| A04-PF-001 | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_RECORDED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NO | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PF-002 | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_RECORDED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NO | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PF-003 | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_RECORDED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NO | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PF-004 | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_RECORDED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NO | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PF-005 | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_RECORDED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NO | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |
| A04-PF-006 | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NOT_RECORDED | NOT_EXECUTED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_EXECUTED | NO | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED | NOT_RECORDED |

Allowed classifications: `PASS`, `HARD_STOP`, `ERROR`, `TIMEOUT`, `NOT_EXECUTED`. Do not record application values or sensitive material.

## 15. Application boundary

- Preflights inspect metadata only.
- Preflight success does not authorize application profiling.
- Preflight success does not prove data quality.
- Preflight success does not prove quiescence.
- Preflight success does not satisfy Audit 05.
- Every `A04-PR-*` query remains unauthorized.
- Quiescence proof is not required for these metadata preflights.
- Quiescence proof is mandatory before any application query.
- Application execution requires a separate operator decision after preflight-result validation.

`APPLICATION_SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED`

## 16. Remaining blockers

| Blocker | Scope | Resolution |
|---|---|---|
| Preflight results absent | Schema/size/index confirmation | Founder manually executes this authorized one-time sequence and supplies sanitized metadata results |
| Application authorization absent | Every application query | Separate decision after preflight validation |
| Quiescence unproven | Application queries only | Recorded no-write interval and uninterrupted-run control |
| Runtime/application data quality unknown | Audit 05 and implementation | Separately authorized profiling results and review |

## 17. Evidence ledger

| Evidence ID | Classification | Claim | Source | Observation | Implication | Follow-up |
|---|---|---|---|---|---|---|
| A04H-001 | CONFIRMED | Thirteen inputs matched entry identities | Local files | Paths, sizes, lines, hashes recorded | Entry passed | Rehash after creation |
| A04H-002 | CONFIRMED | Audit 04G approved pack for operator decision | Audit 04G | 16 approved; 0 defects; quiescence pending | Preflight-only decision permitted | Preserve boundary |
| A04H-003 | CONFIRMED | Operator explicitly authorized six preflights | This prompt | Exact IDs, target, method, expiry, no retries | Manual-only authorization recorded | Execute only as runbook permits |
| A04H-004 | CONFIRMED | Six SQL bodies equal Audit 04F | Normalized fence comparison | No query text changed | Exact reviewed preflights reproduced | Operator copy exact blocks |
| A04H-005 | CONFIRMED | No application SQL is reproduced or authorized | This artifact | Only PF SQL fences present | Profiling remains blocked | Separate decision required |
| A04H-006 | CONFIRMED | Cleanup scope is only `ROLLBACK;` or session discard | Section 13 | No other emergency SQL | Failure containment | New decision after cleanup |
| A04H-007 | CONFIRMED | Agent executed no SQL or external operation | Task record | Local reads and one Markdown creation only | No production impact | Preserve evidence |
| A04H-008 | UNKNOWN | Preflight results and runtime behavior | Not executed | All ledger values empty | Cannot validate schema/size yet | Operator supplies results |

### Read-only command and exit-code ledger

| Command/check | Exit code | Result |
|---|---:|---|
| `Get-Location` | N/A | Canonical directory |
| Repository identity Git commands | 0 | Root, branch, HEAD, upstream recorded |
| Initial `git status --short` | 0 | No tracked/staged changes; 18 untracked audit artifacts |
| `git remote -v` | 0 | Sanitized; no embedded credential |
| Thirteen-file read and hash inventory | 0 | Entry identities passed |
| Exact PF inventory and wrapper `rg` | 0 | Six exact PF headings and required shells found |
| Final input rehash | 0 | All thirteen inputs remained hash-identical |
| Final Git status/diff | 0 | Only Audit 04H was added relative to initial status; no tracked audit diff |

Git's inaccessible global-ignore warning is non-fatal when Git exits 0.

## 18. Next-step handoff

The founder/operator may manually execute PF-001 through PF-006 once, sequentially, against visually confirmed branch ref `zgsofkgddpcntdvpckdq`. Return the completed ledger and sanitized metadata-only results for validation. A hard stop or any cleanup ends this authorization and requires a new decision.

## 19. Audit 05 handoff — BLOCKED

Audit 05 remains blocked. Metadata preflights have not been executed; application queries remain unauthorized; no profiling result exists; quiescence is unproven.

PREFLIGHT_OPERATOR_DECISION: AUTHORIZED
PREFLIGHT_SQL_EXECUTION_AUTHORIZATION: AUTHORIZED_MANUAL_ONLY
AUTHORIZED_QUERY_IDS: A04-PF-001,A04-PF-002,A04-PF-003,A04-PF-004,A04-PF-005,A04-PF-006
APPLICATION_SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED
SQL_EXECUTION_STATUS: NOT_EXECUTED
AUDIT_05_STATUS: BLOCKED
