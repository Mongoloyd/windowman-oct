# Audit 04A — Technical SQL Review and Operator Decision Record

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 04A — Technical SQL Review and Operator Decision Record |
| UTC execution time | `2026-08-31T01:44:11Z` |
| Execution environment | CODEX; local, static, read-only SQL and evidence review plus one authorized Markdown artifact write |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity actually verified | `NO`; network access was prohibited and not used |
| Database environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD`; Supabase branch `forensic_report_v1` |
| Database project identifier | Target branch ref `zgsofkgddpcntdvpckdq`; dormant parent ref `wkrcyxcnzhwjtdpmfpaf` remains prohibited |
| PostgreSQL version under review | `17.6` / `170006`, from Audit 03C operator-supplied deployed metadata |
| Reviewed execution role | `postgres`; non-superuser; inherits roles; `BYPASSRLS=true` |
| Database or SQL access in this task | `NONE` |
| Applicable governance | `AGENTS.md`; Audits 00, 03C–03F, and 04; operator Audit 04A instructions |
| Audit status | `COMPLETE_WITH_BLOCKERS` — two original application queries require correction; no execution decision is recorded |
| Auditor limitations | Static inspection only. SQL was not parsed by a PostgreSQL server, planned, executed, or tested. No database, network, Storage, log, service, function, RPC, job, queue, webhook, build, test, or external provider was accessed. |

## 2. Scope and proof limitations

This review determines whether each exact Audit 04 query is suitable to be presented for a later human execution decision. It does not authorize execution, certify live database behavior, or substitute for a PostgreSQL parse/plan/run. The review keeps deployed metadata, deployed scanner evidence, founder semantic decisions, generated SQL, and operator authorization as distinct evidence domains.

The static review found no obvious PostgreSQL 17.6 syntax incompatibility in the 16 original query blocks. That statement means only that constructs, casts, catalog fields, CTEs, JSONB operators, aggregates, transaction commands, and `LATERAL` expansion appear coherent by inspection. It is not proof that PostgreSQL accepted any statement.

Every block has one normal-path `BEGIN TRANSACTION READ ONLY`, the three required `SET LOCAL` statements, one query statement, and terminal `ROLLBACK`. A SQL error or timeout can prevent a terminal statement from being processed depending on SQL Editor batch/session behavior. Before any later execution, the human procedure must require an explicit session cleanup check: after any error or timeout, stop, issue or confirm `ROLLBACK` in that same session through an independently reviewed operator step, or discard the session before another query. No result in this audit proves SQL Editor cleanup behavior.

## 3. Authorized files reviewed

All authorized files existed and were read completely. The 04A output did not exist before creation.

| Artifact | Bytes | Lines | SHA-256 |
|---|---:|---:|---|
| `docs/audits/00_AUDIT_PROTOCOL_AND_SEQUENCE.md` | 14,222 | 436 | `B690A53F0D3A32076F337F10E4EB8A652E2E98018EF7A601425A2FE866DD0383` |
| `docs/audits/03C_SCHEMA_BINDING_EXECUTION_RESULTS.md` | 35,303 | 323 | `5B43395FF47EDE83855A9F5EE6ECE7CED82BC8A634784FC8557A4F7FF2DB7564` |
| `docs/audits/03D_DEPLOYED_EXTRACTION_CONTRACT_AUDIT.md` | 57,961 | 476 | `3EECD8FEE831B25D9EBBDD8821AC447F89CBB7E44386B916AE0D822213C84317` |
| `docs/audits/03E_SEMANTIC_BINDING_DECISION_REGISTER.md` | 52,438 | 662 | `092152A16619BFF99A33D9DCF53900871D89B4EBFB2A9D3A7B700F75988C9805` |
| `docs/audits/03F_SEMANTIC_BINDING_APPROVAL_AND_SPECIALIST_REVIEW.md` | 35,846 | 534 | `EBF60210AC29BCE10B52089751D07307BF6D0F61D769AA02ADA1C9CB3F60090B` |
| `docs/audits/04_DATA_PROFILING_QUERY_GENERATOR.md` | 86,612 | 1,586 | `618BDF0124D90952859C56B1F077336DB4BC0A762BED996D64DA7C8965742CFC` |

## 4. Audit 04 structural validation

| Check | Result | Evidence |
|---|---|---|
| Required Audit 04 terminal line 1 | PASS | `AUDIT_04_SQL_PACK_GENERATED_AWAITING_HUMAN_REVIEW` |
| Required Audit 04 terminal line 2 | PASS | `SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED` |
| Preflight query count | PASS — exactly 6 | `A04-PF-001` through `A04-PF-006` |
| Application-profile query count | PASS — exactly 10 | `A04-PR-001` through `A04-PR-010` |
| Missing query IDs | None | Contiguous expected sequences |
| Duplicate query IDs | None | 16 IDs, 16 unique |
| Per-query transaction wrapper | PASS on normal path | Each block has exactly one required `BEGIN`, each timeout/search-path statement, and `ROLLBACK` |
| Application source allowlist | PASS | Only `public.analyses`, `public.scan_sessions`, `public.quote_files`, and `public.leads` |
| Prohibited SQL verbs/actions | None found | No DDL, DML, `COPY`, `CALL`, `DO`, row lock, RPC, service, external, or mutation call |
| Frozen date bounds | PASS | All 10 application queries use the exact inclusive/exclusive `analyses.created_at` interval |
| Exact restricted predicate | PASS where restricted membership is claimed | `A04-PR-005`, `009`, and `010`; `A04-PR-004` implements the same conditions as a first-failure partition |
| Output-row maximum | PASS by fixed groups, aggregate semantics, and/or `LIMIT 100` | No query can intentionally exceed 100 documented rows |
| Pack-level privacy | FAIL pending correction | Two direct cross-query reconstruction paths exist; A04A-F-001 and A04A-F-002 |

## 5. Query inventory

| Query ID | Class | Purpose | Original status |
|---|---|---|---|
| A04-PF-001 | PREFLIGHT | Database, PostgreSQL, and role identity | APPROVED_AS_WRITTEN |
| A04-PF-002 | PREFLIGHT | Relation presence, kind, and RLS flags | APPROVED_AS_WRITTEN |
| A04-PF-003 | PREFLIGHT | Required columns, types, and nullability | APPROVED_AS_WRITTEN |
| A04-PF-004 | PREFLIGHT | Required PK, unique-constraint, and FK bindings | APPROVED_AS_WRITTEN |
| A04-PF-005 | PREFLIGHT | Relevant index inventory and health | APPROVED_AS_WRITTEN |
| A04-PF-006 | PREFLIGHT | Relation estimates and size gate | APPROVED_AS_WRITTEN |
| A04-PR-001 | APPLICATION_PROFILE | Date-bounded supported-entity operational totals | APPROVED_AS_WRITTEN |
| A04-PR-002 | APPLICATION_PROFILE | Analysis lifecycle distribution | APPROVED_AS_WRITTEN |
| A04-PR-003 | APPLICATION_PROFILE | Scan-session lifecycle distribution | APPROVED_AS_WRITTEN |
| A04-PR-004 | APPLICATION_PROFILE | Mutually exclusive restricted-population exclusion funnel | APPROVED_AS_WRITTEN |
| A04-PR-005 | APPLICATION_PROFILE | Restricted-population supported-entity counts | REQUIRES_CORRECTION |
| A04-PR-006 | APPLICATION_PROFILE | Confidence-state distribution | APPROVED_AS_WRITTEN |
| A04-PR-007 | APPLICATION_PROFILE | Document-type validity-state distribution | APPROVED_AS_WRITTEN |
| A04-PR-008 | APPLICATION_PROFILE | Line-item array-state distribution | APPROVED_AS_WRITTEN |
| A04-PR-009 | APPLICATION_PROFILE | Description-shape distribution | APPROVED_AS_WRITTEN |
| A04-PR-010 | APPLICATION_PROFILE | Nonempty description-length distribution | REQUIRES_CORRECTION |

No original query is `REJECTED`; the restricted objective remains feasible. An approved subset of the original pack is not executable or operator-approved during this review.

## 6. Query-by-query technical and privacy review

“Syntax appears compatible” below is static inspection only. Every application query depends on all six preflights passing and on a later exact-query human review and execution authorization.

| Query ID | Purpose | Status | Static syntax assessment | Source relations | Output allowlist assessment | Privacy assessment | Suppression assessment | Dependency | Finding IDs | Required action |
|---|---|---|---|---|---|---|---|---|---|---|
| A04-PF-001 | Identity/version/role | APPROVED_AS_WRITTEN | Appears PG17.6-compatible | `pg_catalog.pg_roles`; session settings | Exact 9 metadata columns | No application rows, secrets, connection strings, or paths | N/A | First | A04A-001, A04A-003 | Human review only; do not execute |
| A04-PF-002 | Exact relations/RLS | APPROVED_AS_WRITTEN | Appears PG17.6-compatible | `pg_namespace`, `pg_class` | Exact 6 metadata columns; 4 rows | No application values or policy expressions | N/A | PF-001 | A04A-003 | Continue only on exactly four `PASS` rows |
| A04-PF-003 | Columns/types/nullability | APPROVED_AS_WRITTEN | Appears PG17.6-compatible | `pg_namespace`, `pg_class`, `pg_attribute` | Exact 8 metadata columns; 15 rows | Column metadata only; no values | N/A | PF-001–002 | A04A-003 | Continue only on exactly fifteen `PASS` rows |
| A04-PF-004 | Required constraints | APPROVED_AS_WRITTEN | Appears PG17.6-compatible; ordered `conkey`/`confkey` expansion is coherent | `pg_constraint`, `pg_class`, `pg_namespace`, `pg_attribute` | Exact 8 metadata columns; 8 rows | Constraint names/column metadata only | N/A | PF-001–003 | A04A-003 | Continue only on exactly eight `PASS` rows |
| A04-PF-005 | Index inventory/health | APPROVED_AS_WRITTEN | Appears PG17.6-compatible; `indkey` expansion is catalog-only | `pg_index`, `pg_class`, `pg_namespace`, `pg_attribute` | Exact 9 metadata columns; capped at 100 | Index names/columns only; expression and predicate text excluded | N/A | PF-001–004 | A04A-003, A04A-006 | Human must confirm every required index is present/valid/ready; date-index absence needs explicit bounded-full-scan acceptance |
| A04-PF-006 | Estimate/byte gate | APPROVED_AS_WRITTEN | Appears PG17.6-compatible | `pg_class`, `pg_namespace` | Exact 7 metadata columns; 4 rows | Estimates/sizes only; no application values | N/A | PF-001–005 | A04A-003, A04A-006 | Continue only on exactly four rows with every gate `PASS` |
| A04-PR-001 | Operational entity totals | APPROVED_AS_WRITTEN | Appears PG17.6-compatible | Four allowed application relations | Exact 4 aggregate columns; one row | Identifiers used only inside `COUNT(DISTINCT)` and joins | Approved unsegmented operational totals; no identifying dimension | PF-001–006 | A04A-003, A04A-006 | Human review only; do not execute |
| A04-PR-002 | Analysis lifecycle | APPROVED_AS_WRITTEN | Appears PG17.6-compatible | Four allowed relations | Exact 4 columns; fixed labels only | No raw status value; `other_unexpected` absorbs drift | Whole-distribution suppression is internally sound | PF-001–006 | A04A-003 | Human review only; do not execute |
| A04-PR-003 | Scan-session lifecycle | APPROVED_AS_WRITTEN | Appears PG17.6-compatible | Four allowed relations | Exact 4 columns; fixed labels only | Session ID remains internal; no raw unexpected value | Whole-distribution suppression is internally sound | PF-001–006 | A04A-003 | Human review only; do not execute |
| A04-PR-004 | Exclusion funnel | APPROVED_AS_WRITTEN | Appears PG17.6-compatible; CASE order is parent-first for JSON | Four allowed relations | Exact 4 columns; fixed first-failure labels | No row identifier/value/JSON/text output | Internally sound, but another original query reconstructs its eligible bucket | PF-001–006 | A04A-004 | Retain only with corrected PR-005; do not execute current pack |
| A04-PR-005 | Restricted entity totals | REQUIRES_CORRECTION | Original syntax appears PG17.6-compatible | Four allowed relations | Original 4 aggregate columns are otherwise allowed | Exact restricted predicate and internal IDs are safe in isolation | Defective across queries: its analysis count exactly reveals PR-004's hidden `restricted_quality_eligible` bucket; distinct lead count can also be 1–4 without suppression | PF-001–006 and coordinated PR-004 privacy gate | A04A-004 | Replace with proposed coordinated-suppression SQL; regenerate/re-review |
| A04-PR-006 | Confidence buckets | APPROVED_AS_WRITTEN | Appears PG17.6-compatible | Four allowed relations | Exact 4 columns; four frozen buckets | Numeric values never output | Whole-distribution suppression is internally sound; no exact algebraic reconstruction found | PF-001–006 | A04A-003 | Human review only; do not execute |
| A04-PR-007 | Document-type validity | APPROVED_AS_WRITTEN | Appears PG17.6-compatible | Four allowed relations | Exact 4 columns; no raw type labels | No distinct/free text output | Whole-distribution suppression is internally sound | PF-001–006 | A04A-003 | Human review only; do not execute |
| A04-PR-008 | Line-item array states | APPROVED_AS_WRITTEN | Appears PG17.6-compatible; parent-first guards precede array length | Four allowed relations; approved JSON branch | Exact 4 columns; eight frozen states | No JSON or element output; count is not labeled opening/quantity | Whole-distribution suppression is internally sound | PF-001–006; timeout/size gates | A04A-003, A04A-007 | Human review array-expansion dependencies before later description queries |
| A04-PR-009 | Description shape | APPROVED_AS_WRITTEN | Appears PG17.6-compatible; guarded `LATERAL` expansion | Four allowed relations; approved JSON branch/description only | Exact 4 columns; four frozen shape states | Content is never projected/grouped; only type and zero length | Internally sound, but original PR-010 reconstructs `nonempty` | PF-001–006; exact restricted predicate | A04A-005, A04A-007 | Retain only with corrected PR-010; do not execute current pack |
| A04-PR-010 | Description lengths | REQUIRES_CORRECTION | Original syntax appears PG17.6-compatible | Four allowed relations; approved JSON branch/description only | Original 4 columns and buckets are allowed | Length-only handling is safe in isolation | Defective across queries: sum of visible length buckets exactly equals PR-009's `nonempty` count even when PR-009 suppresses its whole distribution | PF-001–006 and coordinated PR-009 privacy gate | A04A-005 | Replace with proposed coordinated-suppression SQL; regenerate/re-review |

## 7. Detailed findings ordered by severity

### A04A-F-001 — PR-005 reconstructs a suppressed PR-004 cell

**Severity:** HIGH  
**Classification:** CONFIRMED static defect  
**Affected queries:** `A04-PR-004` + `A04-PR-005`

`A04-PR-004` classifies every date-bounded analysis into one mutually exclusive state, including `restricted_quality_eligible`, and suppresses its entire distribution when any nonzero state has 1–4 records. `A04-PR-005` independently applies the exact restricted predicate and always returns `mutable_analysis_row_count`. That count is exactly the value of PR-004's `restricted_quality_eligible` bucket. Therefore PR-005 can reveal a bucket that PR-004 intentionally hid. Its `lead_count` can also disclose a 1–4 restricted lead population because the original query declares suppression not applicable.

**Required action:** Replace PR-005 with a version that recomputes the PR-004 first-failure suppression gate in the same transaction and suppresses all entity metrics when either that gate or any nonzero entity metric is below five.

### A04A-F-002 — PR-010 reconstructs PR-009 `nonempty`

**Severity:** HIGH  
**Classification:** CONFIRMED static defect  
**Affected queries:** `A04-PR-009` + `A04-PR-010`

PR-009's `nonempty` description count is exactly the sum of PR-010's four nonempty length buckets. PR-009 suppresses its whole distribution if any shape bucket has 1–4 elements, but original PR-010 considers only small length buckets. Example: one missing description and 100 nonempty descriptions can suppress PR-009 while PR-010 returns length buckets summing to 100. The hidden `nonempty` value is reconstructed exactly.

**Required action:** Replace PR-010 with a query that computes the same description-shape suppression gate as PR-009 and suppresses its length distribution whenever either the shape gate or the length gate requires suppression.

### A04A-F-003 — Operational scan limits are preflight/human gates, not application-SQL enforcement

**Severity:** MEDIUM  
**Classification:** CONFIRMED limitation, not a query rejection

The 10,000-row estimate and 50,000,000-byte maximums are evaluated by PF-006. Application queries do not recheck them atomically, and catalog estimates can change or be stale. The limits are enforced only by the mandatory sequence and human stop decision. This is consistent with the generated pack, but it must not be described as direct application-query enforcement.

### A04A-F-004 — Date-index and JSON-expansion safety remain review-time dependencies

**Severity:** MEDIUM  
**Classification:** CONFIRMED limitation

PF-005 inventories indexes but cannot force a date index to exist. If no simple `analyses.created_at` index is present, the operator must explicitly accept a possible full scan only after PF-006 passes. PR-009 and PR-010 can multiply rows through `jsonb_array_elements`; no approved maximum array length exists. Their bounded controls are the relation-size gate, small current estimates, 10-second timeout, exact parent filtering, fixed aggregation, and immediate stop on timeout. These are conditional controls, not proof of execution cost.

### A04A-F-005 — Error-path transaction cleanup is client/session dependent

**Severity:** MEDIUM  
**Classification:** UNKNOWN execution behavior

The normal path ends in `ROLLBACK`. A query error or timeout can prevent the terminal command from being processed depending on Dashboard SQL Editor batch behavior. Before execution authorization, the operator procedure must require stopping and explicitly clearing or discarding the session. This static audit did not test the client.

### A04A-F-006 — RLS is not an output-safety control for the reviewed role

**Severity:** MEDIUM  
**Classification:** CONFIRMED

The reviewed `postgres` role has `BYPASSRLS=true`. The generated SQL correctly relies on exact source allowlists, aggregate-only projections, fixed labels, type guards, suppression, output allowlists, timeouts, and human review rather than RLS. Any role/attribute mismatch is a hard stop.

### A04A-F-007 — Static compatibility is not parse, plan, or execution proof

**Severity:** LOW  
**Classification:** CONFIRMED limitation

All 16 original blocks appear syntactically coherent for PostgreSQL 17.6, but no server parser, planner, permissions check, or runtime evaluation occurred. The first admissible proof would be separately authorized, one-at-a-time preflight execution after operator review.

## 8. Complete proposed replacement SQL

The following replacements are review artifacts only. They do not amend Audit 04, authorize execution, or become part of an executable pack until incorporated into a separately reviewed corrected pack or operator-approved amendment.

### Replacement for A04-PR-005 — Coordinated restricted entity counts

`PROPOSED_REPLACEMENT_SQL_NOT_AUTHORIZED`

1. **Stable ID:** `A04-PR-005`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Count approved supported entities in the exact restricted population while preventing reconstruction of any PR-004 suppressed cell and suppressing nonzero entity counts below five.
4. **Confirmed source bindings:** Only `public.analyses`, `public.scan_sessions`, `public.quote_files`, and `public.leads`; exact frozen date and restricted predicate; approved JSON branch only.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS` after separate authorization; exact corrected-pack review.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `mutable_analysis_row_count`, `scan_session_count`, `uploaded_document_count`, `lead_count`.
7. **Positive output-column allowlist:** Exactly the six expected columns above.
8. **Estimated scan scope:** Two bounded passes over the date-filtered four-relation join graph; one output row; possible bounded full scan if the date index is absent.
9. **Index/constraint dependency:** Same joins and size/index gates as original PR-004/005.
10. **Safety rationale:** Identifiers remain internal to exact joins and distinct aggregates; coordinated suppression blocks direct reconstruction of PR-004 eligibility and low distinct-entity counts.
11. **Suppression behavior:** Return one control row with all four metrics `NULL` when any PR-004 first-failure bucket or any nonzero entity metric is 1–4; otherwise return one aggregate row.
12. **Hard-stop conditions:** Any preflight/review failure, output mismatch, timeout, role/target drift, raw value, identifier, prohibited field, or suppression mismatch.
13. **Exact replacement SQL:**

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH funnel_classified AS (
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
  LEFT JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  LEFT JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  LEFT JOIN public.leads AS l ON l.id = a.lead_id
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), funnel_bucket_counts AS (
  SELECT population_state, COUNT(*) AS mutable_analysis_row_count
  FROM funnel_classified
  GROUP BY population_state
  HAVING COUNT(*) > 0
), funnel_gate AS (
  SELECT COALESCE(bool_or(mutable_analysis_row_count BETWEEN 1 AND 4), false) AS suppress_funnel
  FROM funnel_bucket_counts
), restricted_population AS (
  SELECT
    a.id AS analysis_id,
    s.id AS scan_session_id,
    qf.id AS uploaded_document_id,
    l.id AS lead_id
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
), metric_counts AS (
  SELECT
    COUNT(DISTINCT analysis_id) AS mutable_analysis_row_count,
    COUNT(DISTINCT scan_session_id) AS scan_session_count,
    COUNT(DISTINCT uploaded_document_id) AS uploaded_document_count,
    COUNT(DISTINCT lead_id) AS lead_count
  FROM restricted_population
), decision AS (
  SELECT
    funnel_gate.suppress_funnel
    OR metric_counts.mutable_analysis_row_count BETWEEN 1 AND 4
    OR metric_counts.scan_session_count BETWEEN 1 AND 4
    OR metric_counts.uploaded_document_count BETWEEN 1 AND 4
    OR metric_counts.lead_count BETWEEN 1 AND 4 AS suppress_output
  FROM funnel_gate
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
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

### Replacement for A04-PR-010 — Shape-coordinated description-length distribution

`PROPOSED_REPLACEMENT_SQL_NOT_AUTHORIZED`

1. **Stable ID:** `A04-PR-010`
2. **Query class:** `APPLICATION_PROFILE`
3. **Purpose:** Return frozen nonempty description-length buckets only when both the PR-009 description-shape distribution and the length distribution have no nonzero cell below five.
4. **Confirmed source bindings:** Four allowlisted relations; exact frozen restricted predicate; only `line_items[].description` type and character length.
5. **Required earlier preflight IDs:** `A04-PF-001` through `A04-PF-006`, all recorded `PASS` after separate authorization; exact corrected-pack review.
6. **Expected output columns:** `distribution_suppressed`, `suppression_threshold`, `description_length_state`, `extracted_line_item_count`.
7. **Positive output-column allowlist:** Exactly the four expected columns above.
8. **Estimated scan scope:** One restricted parent scan followed by one guarded array expansion reused for shape and length gates; at most four unsuppressed rows or one suppressed row.
9. **Index/constraint dependency:** Same as original PR-009/010; relation-size and timeout gates remain mandatory.
10. **Safety rationale:** Description content never leaves the query; shape-coordinated suppression prevents reconstruction of PR-009 `nonempty`.
11. **Suppression behavior:** Suppress the whole length distribution if any nonzero description-shape count or any nonzero length-bucket count is 1–4.
12. **Hard-stop conditions:** Any preflight/review failure, wrong JSON path, raw content, unexpected label, output mismatch, timeout, or suppression mismatch.
13. **Exact replacement SQL:**

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
  SELECT shape_gate.suppress_shape OR length_gate.suppress_length AS suppress_distribution
  FROM shape_gate
  CROSS JOIN length_gate
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
15. **Human-review status:** `NOT_REVIEWED`
16. **Execution authorization:** `NOT_AUTHORIZED`

## 9. Catalog-object and built-in-function inventory

| Query | Catalog/information-schema relations | Built-in functions or session forms | Necessity | Can return prohibited application content? |
|---|---|---|---|---|
| A04-PF-001 | `pg_catalog.pg_roles` | `current_database()`, `current_setting(text)`, `current_user`, `session_user` | Verify database, version, role, and attributes | No application rows, policy expressions, secrets, connection strings, or paths; role name/version metadata only |
| A04-PF-002 | `pg_catalog.pg_namespace`, `pg_catalog.pg_class` | None beyond ordinary CASE/order operations | Exact object kind and RLS flags | No application rows or policy expressions; schema/table names are fixed by the allowlist |
| A04-PF-003 | `pg_catalog.pg_namespace`, `pg_catalog.pg_class`, `pg_catalog.pg_attribute` | `pg_catalog.format_type(oid,integer)` | Exact columns, physical types, and nullability | No application values; column/type metadata only |
| A04-PF-004 | `pg_catalog.pg_constraint`, `pg_catalog.pg_class`, `pg_catalog.pg_namespace`, `pg_catalog.pg_attribute` | `unnest(anyarray)`, `array_to_string(anyarray,text)` | Ordered local/referenced constraint-column matching | No application values, constraint bodies, policy expressions, or secrets; names only |
| A04-PF-005 | `pg_catalog.pg_index`, `pg_catalog.pg_class`, `pg_catalog.pg_namespace`, `pg_catalog.pg_attribute` | `unnest(anyarray)`, `array_to_string(anyarray,text)` | Index columns, uniqueness, validity/readiness, partial/expression flags | No application values or index expressions/predicates; names and flags only |
| A04-PF-006 | `pg_catalog.pg_class`, `pg_catalog.pg_namespace` | `pg_catalog.pg_total_relation_size(oid)`, `COUNT`, `SUM`, `COALESCE`, `bool_or` | Catalog estimate and physical-size gate | No application rows or business values; aggregate relation metadata only |

No preflight accesses policy definitions, environment variables, credentials, connection settings beyond server version, Storage objects, object paths, logs, function bodies, or user-defined functions. `information_schema` is included in the frozen `search_path` but no preflight references an information-schema relation.

Application queries use only PostgreSQL built-ins necessary for approved aggregation and shape checks: `COUNT`, `COUNT(DISTINCT ...)`, `COALESCE`, `bool_or`, `btrim`, `lower`, `length`, `jsonb_typeof`, `jsonb_array_length`, and `jsonb_array_elements`. No user-defined function is invoked.

## 10. Cross-query complementary-disclosure matrix

Codes:

- `—`: same query.
- `N`: no direct algebraic reconstruction path identified.
- `D`: populations overlap or share a denominator, but whole-distribution suppression leaves no visible cell that the other query exactly partitions; overall totals have no identifying dimension.
- `X`: confirmed direct reconstruction defect in the original pack.

| Query | PR-001 | PR-002 | PR-003 | PR-004 | PR-005 | PR-006 | PR-007 | PR-008 | PR-009 | PR-010 |
|---|---|---|---|---|---|---|---|---|---|---|
| PR-001 | — | D | D | D | D | D | D | D | N | N |
| PR-002 | D | — | D | D | N | D | D | D | N | N |
| PR-003 | D | D | — | D | N | D | D | D | N | N |
| PR-004 | D | D | D | — | **X** | D | D | D | D | D |
| PR-005 | D | N | N | **X** | — | D | D | D | D | D |
| PR-006 | D | D | D | D | D | — | D | D | N | N |
| PR-007 | D | D | D | D | D | D | — | D | N | N |
| PR-008 | D | D | D | D | D | D | D | — | D | D |
| PR-009 | N | N | N | D | D | N | N | D | — | **X** |
| PR-010 | N | N | N | D | D | N | N | D | **X** | — |

The PR-005 replacement converts the PR-004/005 `X` relationship to coordinated suppression. The PR-010 replacement converts the PR-009/010 `X` relationship to coordinated suppression. Results from different execution times must not be treated as one simultaneous snapshot; if the underlying population changes between related queries, the operator must invalidate the pair rather than combine it.

## 11. Dependency and execution-order review

| Order | Query | What it proves | What it does not prove | Later dependency | Exact continue condition | Hard stop |
|---:|---|---|---|---|---|---|
| 1 | A04-PF-001 | Database name, PG version, current/session role, role attributes | Supabase branch ref; future session identity | Every later query | Exactly 1 row and `binding_status='PASS'`; Dashboard independently shows exact branch ref | Missing/extra row, mismatch, superuser, no RLS bypass, wrong version/role/database/target |
| 2 | A04-PF-002 | Four exact ordinary tables and RLS flags | Policy behavior, Data API exposure, row visibility | PF-003–006 and all applications | Exactly 4 rows; every `binding_status='PASS'` | Missing/extra object, kind/RLS drift, unexpected output |
| 3 | A04-PF-003 | Fifteen required columns, exact type/nullability | Business meaning or row values | PF-004–006 and all applications | Exactly 15 rows; every `binding_status='PASS'` | Missing/extra column, type/nullability drift |
| 4 | A04-PF-004 | Eight required constraint bindings | Data quality, active writer, date-index availability | PF-005–006 and all applications | Exactly 8 rows; every `binding_status='PASS'` | Missing/mismatched constraint |
| 5 | A04-PF-005 | Existing relevant indexes and validity/readiness | Actual plan use; absent index as a returned row | PF-006 and all applications | All returned indexes valid/ready; required PK/unique/join indexes visibly present; date-index result explicitly reviewed | Missing required index, invalid/not-ready index, >100 rows, unresolved date/full-scan decision |
| 6 | A04-PF-006 | Catalog estimates and relation sizes under approved limits | Exact row counts, fresh statistics, future unchanged size | All applications | Exactly 4 rows; every relation, combined, and overall gate `PASS`; no negative estimate | Missing row, estimate <0 or >10,000, combined bytes >50,000,000, any non-PASS gate |

No preflight result has been obtained in this task. Generation and technical review are not preflight execution.

## 12. Operational-limit enforcement assessment

| Limit | Enforcement class | Assessment |
|---|---|---|
| `statement_timeout='10s'` | Direct per query after `SET LOCAL` succeeds | Enforced by PostgreSQL for the following statement; timeout error cleanup remains session-dependent |
| `lock_timeout='1s'` | Direct per query | Enforced for lock acquisition waits; does not mean queries are “non-locking” |
| `idle_in_transaction_session_timeout='15s'` | Direct per query/session transaction | Helps terminate idle transactions; not a substitute for explicit rollback cleanup |
| 10,000 estimated rows per source relation | PF-006 + human stop | Not atomically enforced inside application queries; catalog estimate only |
| 50,000,000 combined source bytes | PF-006 + human stop | Not atomically enforced inside application queries |
| 100 output groups/rows | Direct by fixed finite states, aggregate semantics, and/or `LIMIT 100` | Satisfied by each query's shape |
| At most 20 application queries | Generation-time structural control | 10 generated; not a runtime database control |
| Exact date interval | Direct application predicate | Present in every application query |
| Four-relation source allowlist | Direct SQL text + human review | No application query references another relation |
| Minimum segmented cell 5 | Direct inside each segmented query | Original pack still fails two cross-query coordination cases |

## 13. Preflight execution recommendation

**Recommendation for the original pack: DO NOT EXECUTE.**

All six preflight queries are individually `APPROVED_AS_WRITTEN` as static technical recommendations, but the correction policy prohibits treating an approved subset as executable while the pack verdict is `CORRECTIONS_REQUIRED`. Before any operator execution decision:

1. incorporate both proposed replacements into a corrected Audit 04 pack or separately controlled amendment;
2. statically review the corrected exact SQL and output allowlists;
3. record human security/privacy review;
4. record an explicit preflight-only execution decision for exact IDs and target;
5. verify the Dashboard branch ref immediately before each query; and
6. define error/timeout transaction cleanup for the SQL Editor session.

## 14. Application-profile execution recommendation

**Recommendation: DO NOT EXECUTE ANY ORIGINAL `A04-PR-*` QUERY.**

The original pack has two privacy defects. The proposed replacements are also unauthorized and must not be executed from this report. Application-query execution can be considered only after a corrected pack passes review, all preflights pass under separate authorization, target/role/schema/size remain unchanged, and the operator records a separate application-query decision.

## 15. Remaining blockers

| Blocker ID | Condition | Resolution evidence required |
|---|---|---|
| A04A-B-001 | Original PR-005 directly reconstructs a potentially suppressed PR-004 bucket | Corrected pack/amendment incorporating and reviewing coordinated PR-005 suppression |
| A04A-B-002 | Original PR-010 directly reconstructs PR-009 `nonempty` | Corrected pack/amendment incorporating and reviewing shape-coordinated PR-010 suppression |
| A04A-B-003 | No human SQL/security/privacy review is recorded | Named review record for exact corrected SQL |
| A04A-B-004 | No SQL execution authorization exists | Separate operator decision naming target, phase, query IDs, method, and restrictions |
| A04A-B-005 | No preflight result exists | Later separately authorized, one-at-a-time preflight ledger |
| A04A-B-006 | SQL Editor error/timeout cleanup is unverified | Operator procedure for explicit rollback/session discard after error |

## 16. Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|
| A04A-001 | CONFIRMED | All six authorized inputs existed, were completely read, and matched the recorded hashes | Local artifacts | Section 3 | Entry gate passed; 04A did not exist | Review could proceed | Very high | Preserve hashes |
| A04A-002 | CONFIRMED | Audit 04 contains exactly 6 unique PF and 10 unique PR queries and required terminal lines | Audit 04 | Structural scan; lines 178–1400 and terminal lines | No missing/duplicate IDs | Structural gate passed | Very high | None |
| A04A-003 | CONFIRMED | Every original query uses the normal-path read-only wrapper, exact local limits, bounded sources, and documented output columns | Audit 04 | All 16 exact SQL blocks | No prohibited SQL action or relation found | Static SQL core is coherent | High | Server proof remains absent |
| A04A-004 | CONFIRMED | Original PR-005 exactly reveals PR-004 `restricted_quality_eligible` | Audit 04 | PR-004 lines 881–935; PR-005 lines 968–997 | Same exact predicate/population count | PR-005 requires correction | Very high | Use coordinated replacement |
| A04A-005 | CONFIRMED | Original PR-010 length buckets exactly partition PR-009 `nonempty` | Audit 04 | PR-009 lines 1243–1299; PR-010 lines 1332–1393 | Sum of length buckets equals hidden shape bucket | PR-010 requires correction | Very high | Use shape-coordinated replacement |
| A04A-006 | CONFIRMED | Size/index limits depend on preflight results and human stopping, not atomic application SQL | Audit 04 | PF-005/006; application dependencies | Documented limits are not all direct runtime gates | Must be described accurately | High | Human preflight review |
| A04A-007 | CONFIRMED | Description queries use only approved guarded JSON paths but can expand arrays | Audits 03D/04 | A03D-014; PR-009/010 | No content output; workload depends on array cardinality | Timeout/size gate mandatory | High | Stop on timeout/size concern |
| A04A-008 | CONFIRMED | No SQL, database connection, service, network request, source edit, or earlier-audit edit occurred | This task | Tool/activity record | Only this authorized Markdown artifact was created | Execution authority remains unused | High | None |

## 17. Operator decision section

| Decision field | Value |
|---|---|
| Founder/operator identity or role | `NOT_RECORDED` |
| Decision | `NOT_RECORDED` |
| UTC decision time | `NOT_RECORDED` |
| Approved query IDs | `NONE` |
| Approved target branch ref | `NOT_RECORDED` |
| Approved execution method | `NOT_RECORDED` |
| Additional restrictions | `NOT_RECORDED` |

This prompt and report do not imply operator approval. The proposed replacement SQL remains review-only and unauthorized.

TECHNICAL_SQL_REVIEW: CORRECTIONS_REQUIRED
OPERATOR_DECISION: NOT_RECORDED
SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED
