# Audit 04C — Independent Technical Review of the Corrected Profiling Pack

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 04C — Independent Technical Review of the Corrected Profiling Pack |
| UTC execution time | `2026-08-31T02:10:30Z` |
| Execution environment | CODEX; local read-only evidence inspection and static SQL review |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status before Audit 04C | No tracked or staged changes; Audits 00–04B were pre-existing untracked Markdown artifacts |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity actually verified | `NO`; no network request was made |
| Database environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD`; branch `forensic_report_v1` |
| Database project identifier | `zgsofkgddpcntdvpckdq`; prohibited parent `wkrcyxcnzhwjtdpmfpaf` |
| PostgreSQL version | `17.6` from Audit 03C |
| Reviewed role | `postgres`; non-superuser; `BYPASSRLS=true` |
| Database/network authorization used | None; SQL execution and network access were prohibited |
| Applicable governance | `AGENTS.md`; Audits 00, 03C–04B; operator Audit 04C prompt |
| Audit status | `COMPLETE_WITH_BLOCKERS` |
| Auditor limitations | Static text review only; no parser, planner, permission, timeout, data, database, service, Storage, log, network, build, test, or runtime proof |

## 2. Scope and proof limitations

This review independently challenges all sixteen Audit 04B queries. Static PostgreSQL compatibility means only that no incompatibility was identified by source inspection. It is not parser, planner, permission, timeout, transaction-cleanup, or runtime proof. The Supabase/PostgreSQL review guidance reinforced short read-only transactions, exact privilege awareness, index review, bounded scans, and safe JSON handling; network documentation lookup was not used because this task prohibited network access and froze PostgreSQL at 17.6.

## 3. Input file identity and hashes

| Input | Bytes | Lines | SHA-256 |
|---|---:|---:|---|
| `docs\audits\00_AUDIT_PROTOCOL_AND_SEQUENCE.md` | 14222 | 436 | `B690A53F0D3A32076F337F10E4EB8A652E2E98018EF7A601425A2FE866DD0383` |
| `docs\audits\03C_SCHEMA_BINDING_EXECUTION_RESULTS.md` | 35303 | 323 | `5B43395FF47EDE83855A9F5EE6ECE7CED82BC8A634784FC8557A4F7FF2DB7564` |
| `docs\audits\03D_DEPLOYED_EXTRACTION_CONTRACT_AUDIT.md` | 57961 | 476 | `3EECD8FEE831B25D9EBBDD8821AC447F89CBB7E44386B916AE0D822213C84317` |
| `docs\audits\03E_SEMANTIC_BINDING_DECISION_REGISTER.md` | 52438 | 662 | `092152A16619BFF99A33D9DCF53900871D89B4EBFB2A9D3A7B700F75988C9805` |
| `docs\audits\03F_SEMANTIC_BINDING_APPROVAL_AND_SPECIALIST_REVIEW.md` | 35846 | 534 | `EBF60210AC29BCE10B52089751D07307BF6D0F61D769AA02ADA1C9CB3F60090B` |
| `docs\audits\04_DATA_PROFILING_QUERY_GENERATOR.md` | 86612 | 1586 | `618BDF0124D90952859C56B1F077336DB4BC0A762BED996D64DA7C8965742CFC` |
| `docs\audits\04A_TECHNICAL_SQL_REVIEW_AND_OPERATOR_DECISION_RECORD.md` | 44383 | 575 | `85BE6C446B253D992370E48531878395846B0A00F9CE7236FEC3CD1646B48D29` |
| `docs\audits\04B_CORRECTED_DATA_PROFILING_QUERY_PACK.md` | 97777 | 1778 | `E0FD036C406DBC751CBBD5221E75A7DA643DDA5348E32940A2D7BE94316BA78E` |

## 4. Entry-validation results

| Gate | Result |
|---|---|
| Eight authorized inputs exist and were read completely | PASS |
| Audit 04B SHA-256 matches the required value | PASS |
| Six unique preflight and ten unique application packages | PASS |
| No expected package ID missing or duplicated | PASS |
| Required Audit 04B terminal state | PASS |
| Fourteen preserved SQL blocks match Audit 04 | PASS |
| PR-005 and PR-010 match complete Audit 04A proposals | PASS |
| Audit 04C output absent before creation | PASS |
| No tracked or staged changes before review | PASS |

## 5. Query inventory

- Preflights: `A04-PF-001`–`A04-PF-006`.
- Application profiles: `A04-PR-001`–`A04-PR-010`.
- All sixteen use the read-only wrapper, three frozen timeouts, frozen search path, and terminal `ROLLBACK`.
- Application SQL references only `public.analyses`, `public.scan_sessions`, `public.quote_files`, and `public.leads`.
- JSON keys are limited to `extraction`, `line_items`, and `description`.
- No DDL, DML, prohibited command, user-defined function, RPC, service, Storage, log, network, filesystem, or raw application-row projection was identified.

## 6. Query-by-query review table

| Query ID | Purpose | Status | Static assessment | Privacy/suppression assessment | Required action |
|---|---|---|---|---|---|
| A04-PF-001 | Identity/version/role preflight | APPROVED_AS_WRITTEN | PG17.6-compatible by inspection; catalog-only; one row | No defect identified | Execute only after separate authorization |
| A04-PF-002 | Relation/RLS preflight | APPROVED_AS_WRITTEN | Exact four-object catalog check | No defect identified | Require exactly four PASS rows |
| A04-PF-003 | Column/type preflight | APPROVED_AS_WRITTEN | Exact 15-column metadata check | No defect identified | Require exactly fifteen PASS rows |
| A04-PF-004 | Constraint preflight | APPROVED_AS_WRITTEN | Ordered key comparison is coherent | No defect identified | Require exactly eight PASS rows |
| A04-PF-005 | Index preflight | APPROVED_AS_WRITTEN | Catalog-only and bounded | Exactly 100 rows is truncation-ambiguous | Treat exactly 100 rows as a hard stop |
| A04-PF-006 | Size preflight | APPROVED_AS_WRITTEN | Catalog estimates/bytes only | Estimates may be stale; zero rows remains a hard stop | Require exactly four PASS rows |
| A04-PR-001 | Operational identity totals | APPROVED_AS_WRITTEN | Scalar aggregate; four allowed sources | Safe alone; exposes universal denominators | Retain; related subset queries must self-gate |
| A04-PR-002 | Analysis lifecycle distribution | REQUIRES_CORRECTION | Syntax appears valid | Does not suppress all/joined and nested-population complements | Use proposed related-population gate |
| A04-PR-003 | Session lifecycle distribution | REQUIRES_CORRECTION | Syntax appears valid | Does not suppress analysis/session/document complements | Use proposed related-population gate |
| A04-PR-004 | Exclusion funnel | APPROVED_AS_WRITTEN | CASE guards JSON safely and partitions once | Safe alone; universal denominator affects other queries | Retain; subset queries must self-gate |
| A04-PR-005 | Restricted entity totals | REQUIRES_CORRECTION | Local PR-004 gate is correct | Cross-population identity complements remain; AND ordering does not safely guard jsonb_array_length | Use proposed global gate and CASE guard |
| A04-PR-006 | Confidence distribution | REQUIRES_CORRECTION | Fixed buckets are coherent | Quality-precursor total enables multiple small complements | Use proposed related-population gate |
| A04-PR-007 | Document validity distribution | REQUIRES_CORRECTION | Fixed validity states are coherent | Same quality-precursor complement defect | Use proposed related-population gate |
| A04-PR-008 | Line-item array distribution | REQUIRES_CORRECTION | CASE ordering safely guards array length | Same quality-precursor complement defect | Use proposed related-population gate |
| A04-PR-009 | Description shape distribution | REQUIRES_CORRECTION | Shape CASE is coherent | Restricted WHERE relies on non-guaranteed AND evaluation before jsonb_array_length | Use proposed CASE guard and population gate |
| A04-PR-010 | Description length distribution | REQUIRES_CORRECTION | Shape/length coordination is logically correct | Same unsafe parent WHERE guard; separate-snapshot control remains | Use proposed CASE guard and population gate |

Eight queries are `APPROVED_AS_WRITTEN`, eight are `REQUIRES_CORRECTION`, and none are `REJECTED`. These are technical-review statuses only.

## 7. Detailed PR-005 review

1. PR-005 reproduces PR-004's complete first-failure `CASE` logic exactly; no classification-order difference was found.
2. Its funnel and restricted metrics use the same frozen date interval and source graph under one SQL statement snapshot.
3. It suppresses when any nonzero PR-004 funnel bucket is 1–4 and when any returned entity metric is 1–4.
4. Its suppressed row contains only the suppression flag, threshold, and four `NULL` metrics.
5. Zero restricted rows produce one unsuppressed row of zero metrics; this is safe because the eligible bucket is absent/zero.
6. The local PR-004/005 reconstruction defect is fixed for analysis-row counts.
7. It still exposes exact same-identity complements with PR-001, PR-002, PR-003, PR-006, PR-007, and PR-008. The session, document, and lead complements with PR-001 are not protected by the funnel's analysis-row partition.
8. Its restricted `WHERE` clause uses `jsonb_typeof(...) = 'array' AND jsonb_array_length(...)`. PostgreSQL does not guarantee Boolean expression evaluation order, so malformed non-array JSON can reach `jsonb_array_length` and raise an error. The proposed replacement uses `CASE` to enforce the guard.
9. Identifiers remain internal and no unsupported quote/project/revision claim is output.

Conclusion: the 04A repair is locally correct but incomplete at complete-pack scope. `A04-PR-005` is `REQUIRES_CORRECTION`.

## 8. Detailed PR-010 review

1. PR-010 reproduces PR-009's description-shape logic exactly and uses the same restricted population, date range, relations, and `line_items[].description` path.
2. Description content never appears in grouping or output.
3. Its shape gate suppresses whenever any nonzero shape bucket is 1–4; its length gate does the same for length buckets.
4. Under one snapshot, visible length buckets cannot reconstruct a suppressed PR-009 `nonempty` count.
5. Malformed line-item values become `wrong_type`; missing, wrong-type, empty, nonempty, and oversized descriptions are handled by fixed states/buckets.
6. Empty arrays are excluded from the restricted parent population.
7. With no restricted parents or no nonempty descriptions, `length_bucket_counts` is empty and the query returns zero rows. This is safe and must be recorded as `SUCCESSFUL_EMPTY`, not failure or suppression.
8. The same non-guaranteed parent `AND` guard around `jsonb_array_length` can raise on malformed JSON before expansion. The proposed replacement enforces the guard with `CASE`.
9. Separate execution from PR-009 still requires a no-write consistency control; the SQL provides no cross-query snapshot.

Conclusion: the coordinated disclosure logic is sound, but the parent JSON guard requires correction. `A04-PR-010` is `REQUIRES_CORRECTION`.

## 9. Empty-population and zero-row analysis

| Condition | PR-009 result | PR-010 result | Classification |
|---|---|---|---|
| No restricted parents | Zero rows unless the proposed related-population gate suppresses | Zero rows unless the gate suppresses | SAFE_SUCCESSFUL_EMPTY |
| Restricted arrays empty | Excluded before expansion | Excluded before expansion | SAFE_EXCLUSION |
| Malformed line-item value | `wrong_type` element | `wrong_type` element | SAFE_FIXED_STATE |
| Missing description | `missing` | Excluded from length buckets | SAFE |
| Wrong-type description | `wrong_type` | Excluded from length buckets | SAFE |
| Empty string | `empty` | Excluded from length buckets | SAFE |
| No nonempty descriptions | Shape distribution may be visible | Zero rows | SAFE_SUCCESSFUL_EMPTY |
| Description length 501+ | `nonempty` | `oversized_501_plus` | SAFE_FIXED_BUCKET |

A zero-row output must match the four expected columns and be logged as `SUCCESSFUL_EMPTY`. It conveys only that no reportable bucket exists after the approved filters; it does not authorize a parent-count inference.

## 10. Catalog-object and built-in-function inventory

| Query set | Catalog/base objects | Built-ins/operators | Finding |
|---|---|---|---|
| PF-001 | `pg_roles` | `current_database`, `current_setting`, current/session user | Approved metadata-only |
| PF-002 | `pg_namespace`, `pg_class` | fixed `VALUES`, `CASE` | Approved metadata-only |
| PF-003 | plus `pg_attribute` | `format_type` | Approved metadata-only |
| PF-004 | plus `pg_constraint` | `unnest`, ordinality, `array_to_string` | Approved metadata-only |
| PF-005 | `pg_index`, class/namespace/attribute | `unnest`, ordinality, `array_to_string` | Approved; exactly 100 rows is a hard stop |
| PF-006 | `pg_class`, `pg_namespace` | `pg_total_relation_size`, aggregates | Approved estimates only |
| PR-001–008 | Four allowlisted public tables | aggregates, `FILTER`, `CASE`, `btrim`, `lower`, JSON type/length functions | No user-defined function identified |
| PR-009–010 | Same four tables | `jsonb_array_elements`, `jsonb_typeof`, `jsonb_array_length`, `length` | Array type must be enforced with `CASE` before length/expansion |

## 11. Complete 45-pair disclosure matrix

| Pair | Classification | Shared relationship and finding |
|---|---|---|
| A04-PR-001 / A04-PR-002 | CONFIRMED_RECONSTRUCTION_DEFECT | All-analysis total minus fully joined non-test analysis total exposes the excluded complement. |
| A04-PR-001 / A04-PR-003 | CONFIRMED_RECONSTRUCTION_DEFECT | All analysis/session/document totals minus joined non-test session total expose small complements under one-to-one bindings. |
| A04-PR-001 / A04-PR-004 | NO_RECONSTRUCTION_PATH_IDENTIFIED | PR-004 either suppresses all buckets or releases a complete partition whose nonzero cells are each at least five. |
| A04-PR-001 / A04-PR-005 | CONFIRMED_RECONSTRUCTION_DEFECT | PR-005 protects the analysis complement but not all session/document/lead complements visible in PR-001. |
| A04-PR-001 / A04-PR-006 | CONFIRMED_RECONSTRUCTION_DEFECT | All-population identity totals minus quality-precursor analysis total can reveal a 1–4 complement. |
| A04-PR-001 / A04-PR-007 | CONFIRMED_RECONSTRUCTION_DEFECT | Same quality-precursor total relationship as PR-006. |
| A04-PR-001 / A04-PR-008 | CONFIRMED_RECONSTRUCTION_DEFECT | Same quality-precursor total relationship as PR-006. |
| A04-PR-001 / A04-PR-009 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Parent identity totals and extracted-line-item shape counts use different units; no exact subtraction is established. |
| A04-PR-001 / A04-PR-010 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Parent identity totals and nonempty line-item length counts use different units. |
| A04-PR-002 / A04-PR-003 | CONDITIONAL_EXECUTION_CONTROL_REQUIRED | Totals coincide under the one-analysis-per-session binding, but separate snapshots can create a misleading difference. |
| A04-PR-002 / A04-PR-004 | CONFIRMED_RECONSTRUCTION_DEFECT | An unsuppressed PR-004 sum is the all-analysis total; subtracting PR-002's joined non-test total reveals the excluded complement. |
| A04-PR-002 / A04-PR-005 | CONFIRMED_RECONSTRUCTION_DEFECT | Joined non-test total minus restricted total exposes the joined-but-ineligible complement. |
| A04-PR-002 / A04-PR-006 | CONFIRMED_RECONSTRUCTION_DEFECT | PR-002 complete count minus quality-precursor total exposes complete rows with a non-success session state. |
| A04-PR-002 / A04-PR-007 | CONFIRMED_RECONSTRUCTION_DEFECT | Same quality-precursor complement as PR-006. |
| A04-PR-002 / A04-PR-008 | CONFIRMED_RECONSTRUCTION_DEFECT | Same quality-precursor complement as PR-006. |
| A04-PR-002 / A04-PR-009 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Analysis-status counts and line-item shape counts differ in unit and scope. |
| A04-PR-002 / A04-PR-010 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Analysis-status counts and line-item length counts differ in unit and scope. |
| A04-PR-003 / A04-PR-004 | CONFIRMED_RECONSTRUCTION_DEFECT | PR-003 joined session total equals the joined analysis cardinality; PR-004's released total permits the excluded complement. |
| A04-PR-003 / A04-PR-005 | CONFIRMED_RECONSTRUCTION_DEFECT | Joined session total minus restricted session total exposes the joined-but-ineligible complement. |
| A04-PR-003 / A04-PR-006 | CONFIRMED_RECONSTRUCTION_DEFECT | Successful-session counts minus quality-precursor total expose successful sessions whose analysis is not complete. |
| A04-PR-003 / A04-PR-007 | CONFIRMED_RECONSTRUCTION_DEFECT | Same quality-precursor complement as PR-006. |
| A04-PR-003 / A04-PR-008 | CONFIRMED_RECONSTRUCTION_DEFECT | Same quality-precursor complement as PR-006. |
| A04-PR-003 / A04-PR-009 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Session-state counts and line-item shape counts do not have an exact algebraic denominator. |
| A04-PR-003 / A04-PR-010 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Session-state counts and line-item length counts do not have an exact algebraic denominator. |
| A04-PR-004 / A04-PR-005 | CONDITIONAL_EXECUTION_CONTROL_REQUIRED | The recomputed funnel gate protects the stable-snapshot pair, but separate transactions can observe different states. |
| A04-PR-004 / A04-PR-006 | CONFIRMED_RECONSTRUCTION_DEFECT | Released all-analysis total minus quality-precursor total can reveal a 1–4 complement. |
| A04-PR-004 / A04-PR-007 | CONFIRMED_RECONSTRUCTION_DEFECT | Same quality-precursor complement as PR-006. |
| A04-PR-004 / A04-PR-008 | CONFIRMED_RECONSTRUCTION_DEFECT | Same quality-precursor complement as PR-006. |
| A04-PR-004 / A04-PR-009 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | First-failure analysis counts and restricted line-item counts use different units. |
| A04-PR-004 / A04-PR-010 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | First-failure analysis counts and restricted length counts use different units. |
| A04-PR-005 / A04-PR-006 | CONFIRMED_RECONSTRUCTION_DEFECT | Quality-precursor total minus restricted total exposes the quality-but-ineligible complement. |
| A04-PR-005 / A04-PR-007 | CONFIRMED_RECONSTRUCTION_DEFECT | Same quality-to-restricted complement as PR-006/PR-005. |
| A04-PR-005 / A04-PR-008 | CONFIRMED_RECONSTRUCTION_DEFECT | Same quality-to-restricted complement as PR-006/PR-005. |
| A04-PR-005 / A04-PR-009 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Restricted parent counts and line-item shape counts overlap but do not exactly reconstruct a hidden cell. |
| A04-PR-005 / A04-PR-010 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Restricted parent counts and line-item length counts overlap but use different units. |
| A04-PR-006 / A04-PR-007 | CONDITIONAL_EXECUTION_CONTROL_REQUIRED | Both partition the same precursor population; separate snapshots can create inconsistent totals. |
| A04-PR-006 / A04-PR-008 | CONDITIONAL_EXECUTION_CONTROL_REQUIRED | Both partition the same precursor population; separate snapshots can create inconsistent totals. |
| A04-PR-006 / A04-PR-009 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Precursor analysis counts and restricted line-item counts use different units and nested populations. |
| A04-PR-006 / A04-PR-010 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Precursor analysis counts and restricted length counts use different units and nested populations. |
| A04-PR-007 / A04-PR-008 | CONDITIONAL_EXECUTION_CONTROL_REQUIRED | Both partition the same precursor population; separate snapshots can create inconsistent totals. |
| A04-PR-007 / A04-PR-009 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Document-validity analysis counts and line-item shape counts are not algebraically equivalent. |
| A04-PR-007 / A04-PR-010 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Document-validity analysis counts and line-item length counts are not algebraically equivalent. |
| A04-PR-008 / A04-PR-009 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Analysis-level array states do not determine restricted element-level description states. |
| A04-PR-008 / A04-PR-010 | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | Analysis-level array states do not determine nonempty element length buckets. |
| A04-PR-009 / A04-PR-010 | CONDITIONAL_EXECUTION_CONTROL_REQUIRED | Coordinated gates protect one snapshot; separate executions still require a no-write consistency control. |

Summary: 22 pairs have a confirmed static reconstruction defect, six require execution-time consistency controls, one has no reconstruction path identified, and sixteen overlap without an exact reconstruction identified.

## 12. Execution-time consistency analysis

Every application query opens and rolls back its own transaction. The pack therefore provides no common snapshot. The historical upper timestamp prevents ordinary newly created analyses after that bound from entering, but it does not prevent updates, deletes, backfills, reprocessing, status changes, linkage changes, `is_test` changes, or `full_json` changes inside the interval.

A later runbook must require all of the following:

1. a confirmed quiescent window with no writes to the four source relations affecting the interval;
2. one uninterrupted application run after all preflights pass;
3. related queries executed adjacently;
4. no isolated retry of one query from a related pair;
5. immediate invalidation of the complete application result set after any timeout, permission error, unexpected output, session reset, or possible write;
6. no combination of outputs from different runs; and
7. if quiescence cannot be guaranteed, application execution remains blocked.

These controls are necessary even after SQL correction. They do not authorize execution.

## 13. Operational-limit analysis

- The 10-second statement timeout and 15-second idle-in-transaction timeout bound each statement/session only when successfully applied.
- A timeout or error can leave the SQL Editor transaction aborted before the textual `ROLLBACK` executes. The future runbook must issue a separately reviewed `ROLLBACK;` or discard the session before any next query.
- PF-005 caps output at 100, so exactly 100 rows cannot prove completeness; treat exactly 100 as a hard stop.
- PF-006 uses catalog estimates, not exact counts. Negative/unavailable, over-10,000, missing relation, or over-50,000,000-byte results stop the pack.
- A missing `analyses.created_at` index requires explicit bounded-full-scan acceptance after PF-006.
- JSON expansion may multiply rows; source-size limits and timeout are the operative bounds.
- Because the reviewed role has `BYPASSRLS=true`, exact SQL and output allowlists—not RLS—are the privacy boundary.

## 14. Findings ordered by severity

| Evidence ID | Severity | Finding | Affected queries | Required action |
|---|---|---|---|---|
| A04C-001 | CRITICAL | Twenty-two query pairs expose an exact 1–4 nested-population complement by subtraction despite within-query bucket suppression | PR-001–008 relationships | Add a shared population-count and complement gate to every affected subset query |
| A04C-002 | HIGH | PR-005, PR-009, and PR-010 rely on non-guaranteed `AND` evaluation before `jsonb_array_length` | PR-005, PR-009, PR-010 | Enforce type with `CASE` before calling array length |
| A04C-003 | HIGH | Separate query transactions provide no common snapshot | All application queries; especially PR-004/005 and PR-009/010 | Require quiescence and whole-run invalidation controls |
| A04C-004 | MEDIUM | PR-010 can return zero rows when no nonempty length bucket exists | PR-010 | Record as `SUCCESSFUL_EMPTY`; do not treat as failure or suppression |
| A04C-005 | MEDIUM | PF-005 cannot distinguish a complete 100-row result from truncation at its limit | PF-005 | Treat exactly 100 rows as a hard stop |
| A04C-006 | MEDIUM | Timeout/error may prevent the terminal rollback statement from running | All queries | Require explicit cleanup/session-discard procedure |
| A04C-007 | LOW | Static compatibility does not prove parsing, planning, permission, or runtime behavior | All queries | Preserve the proof limitation |
| A04C-008 | INFORMATIONAL | The local PR-004/005 and PR-009/010 coordinated suppression logic is internally coherent under one snapshot | PR-004/005, PR-009/010 | Preserve while adding broader gates and safe JSON guards |

## 15. Complete proposed replacement SQL

All replacements below are review proposals only. They are not incorporated into Audit 04B and are not authorized for execution.

### A04-PR-002

`PROPOSED_REPLACEMENT_SQL_NOT_AUTHORIZED`

This replacement adds a shared nested-population small-cell/complement gate. It preserves the frozen date, sources, output labels, and query purpose. Where JSON array length is used to establish restricted membership, a `CASE` expression enforces the type guard.

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

### A04-PR-003

`PROPOSED_REPLACEMENT_SQL_NOT_AUTHORIZED`

This replacement adds a shared nested-population small-cell/complement gate. It preserves the frozen date, sources, output labels, and query purpose. Where JSON array length is used to establish restricted membership, a `CASE` expression enforces the type guard.

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

### A04-PR-005

`PROPOSED_REPLACEMENT_SQL_NOT_AUTHORIZED`

This replacement adds a shared nested-population small-cell/complement gate. It preserves the frozen date, sources, output labels, and query purpose. Where JSON array length is used to establish restricted membership, a `CASE` expression enforces the type guard.

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

### A04-PR-006

`PROPOSED_REPLACEMENT_SQL_NOT_AUTHORIZED`

This replacement adds a shared nested-population small-cell/complement gate. It preserves the frozen date, sources, output labels, and query purpose. Where JSON array length is used to establish restricted membership, a `CASE` expression enforces the type guard.

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

### A04-PR-007

`PROPOSED_REPLACEMENT_SQL_NOT_AUTHORIZED`

This replacement adds a shared nested-population small-cell/complement gate. It preserves the frozen date, sources, output labels, and query purpose. Where JSON array length is used to establish restricted membership, a `CASE` expression enforces the type guard.

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

### A04-PR-008

`PROPOSED_REPLACEMENT_SQL_NOT_AUTHORIZED`

This replacement adds a shared nested-population small-cell/complement gate. It preserves the frozen date, sources, output labels, and query purpose. Where JSON array length is used to establish restricted membership, a `CASE` expression enforces the type guard.

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

### A04-PR-009

`PROPOSED_REPLACEMENT_SQL_NOT_AUTHORIZED`

This replacement adds a shared nested-population small-cell/complement gate. It preserves the frozen date, sources, output labels, and query purpose. Where JSON array length is used to establish restricted membership, a `CASE` expression enforces the type guard.

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

### A04-PR-010

`PROPOSED_REPLACEMENT_SQL_NOT_AUTHORIZED`

This replacement adds a shared nested-population small-cell/complement gate. It preserves the frozen date, sources, output labels, and query purpose. Where JSON array length is used to establish restricted membership, a `CASE` expression enforces the type guard.

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

## 16. Preflight recommendation

PF-001 through PF-006 are technically `APPROVED_AS_WRITTEN` for inclusion in a future corrected pack. They are not approved for execution in the current pack. A future operator runbook must add the exactly-100-row PF-005 hard stop and explicit timeout/error cleanup.

## 17. Application-query recommendation

Do not execute any Audit 04B application query. Create a successor corrected candidate containing the eight proposed replacements, preserve PR-001 and PR-004 as the only application queries approved as written, independently re-review all 45 pairs, then seek an operator decision only if no defect remains.

## 18. Remaining blockers

| Blocker | Severity | Condition | Resolution evidence |
|---|---|---|---|
| A04C-B-001 | CRITICAL | Complete-pack complementary disclosure remains | Corrected pack with shared gates and independent 45-pair re-review |
| A04C-B-002 | HIGH | Unsafe JSON array-length guard remains | `CASE`-guarded replacement review |
| A04C-B-003 | HIGH | No enforceable cross-query snapshot/quiescence procedure | Approved runbook or execution remains blocked |
| A04C-B-004 | MEDIUM | No parser/planner/permission/runtime evidence | Later separately authorized preflight/application execution |
| A04C-B-005 | MEDIUM | Operator decision absent | Separate post-review decision |

## 19. Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Build implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|
| A04C-001 | CONFIRMED | Twenty-two exact complement paths remain | Audit 04B SQL | Section 11 matrix | Nested population totals can differ by 1–4 while both outputs are visible | Current pack not privacy-safe | High | Regenerate/re-review |
| A04C-002 | CONFIRMED | Boolean predicate order does not enforce the array type guard | PR-005, PR-009, PR-010 | Restricted membership `WHERE` predicates | `jsonb_array_length` can receive a non-array | Runtime failure risk | High | Use `CASE` |
| A04C-003 | CONFIRMED | PR-004/005 classification and PR-009/010 shape logic match | In-memory source comparison | Audit 04B packages | The two prior local corrections are faithful | Preserve local logic | High | Add broader fixes |
| A04C-004 | CONFIRMED | PR-010 zero-row behavior is safe successful-empty | Static CTE flow | Empty `length_bucket_counts` | Decision row exists but no unsuppressed bucket row exists | Ledger must distinguish empty | High | Document in runbook |
| A04C-005 | CONFIRMED | Each query has an independent transaction snapshot | Audit 04B SQL | Sixteen wrappers | No cross-query snapshot exists | Quiescence required | High | Runbook control |
| A04C-006 | CONFIRMED | All six preflights are metadata-only and statically coherent | Audit 04B | PF-001–006 | No application rows projected | Future corrected-pack candidates | Medium-high | No execution yet |
| A04C-007 | CONFIRMED | No SQL or external service was executed | Current task activity | Tool record | Local reads, static analysis, one authorized Markdown write only | Production unchanged | High | None |
| A04C-008 | UNKNOWN | Actual parse/plan/permission/timeout behavior | No execution authorized | All queries | Static review cannot prove runtime | Execution remains gated | High | Later authorization only |

## 20. Operator decision section

| Field | Value |
|---|---|
| Founder/operator identity or role | `NOT_RECORDED` |
| Decision | `NOT_RECORDED` |
| UTC decision time | `NOT_RECORDED` |
| Approved query IDs | `NONE` |
| Approved target branch ref | `NOT_RECORDED` |
| Approved execution method | `NOT_RECORDED` |
| Additional restrictions | `NOT_RECORDED` |

TECHNICAL_SQL_REVIEW: CORRECTIONS_REQUIRED
OPERATOR_DECISION: NOT_RECORDED
SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED

