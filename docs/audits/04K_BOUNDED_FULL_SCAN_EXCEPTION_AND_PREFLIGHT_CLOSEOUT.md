# Audit 04K — Bounded Full-Scan Exception and Preflight Closeout

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 04K — Bounded Full-Scan Exception and Preflight Closeout |
| UTC execution time | 2026-08-31T05:14:46Z |
| Execution environment | CODEX, local read-only repository inspection plus one authorized Markdown write |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status at entry | DIRTY; pre-existing modified and untracked files listed below |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity actually verified | UNKNOWN; no network operation was authorized or performed |
| Database environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD` (operator-confirmed; not accessed by the audit agent) |
| Database project identifier | Supabase branch ref `zgsofkgddpcntdvpckdq`; project display `WMProd`; branch `forensic_report_v1` |
| Prohibited database target | Parent/main ref `wkrcyxcnzhwjtdpmfpaf` |
| PostgreSQL version | `17.6`, validated by operator-executed A04-PF-001 |
| Reviewed SQL Editor role | `postgres`; non-superuser; `BYPASSRLS=true`, validated by operator-executed A04-PF-001 |
| Production read authorization | Metadata preflights were manually authorized and completed; application SQL remains NOT_AUTHORIZED |
| Network authorization | No network access used by the audit agent |
| Applicable governance | Root `AGENTS.md`; Audit 00 protocol; frozen Audits 04F–04J |
| Audit status | COMPLETE_WITH_BOUNDED_EXCEPTION |
| Auditor limitations | No SQL execution, database access, query-plan proof, application-row inspection, production-quiescence proof, or current remote-parity verification |

### Initial Git status

The entry `git status --short` exited successfully, with warnings that the process could not read the user-level Git ignore file. The following repository state pre-dated Audit 04K and was not modified by this audit:

```text
 M supabase/functions/generate-contractor-brief/index.ts
?? docs/audits/00_AUDIT_PROTOCOL_AND_SEQUENCE.md
?? docs/audits/01_REPOSITORY_AND_INGESTION_AUDIT.md
?? docs/audits/02_DATABASE_AND_EXTRACTION_MODEL_AUDIT.md
?? docs/audits/03A_SCHEMA_BINDING_PHASE_A.md
?? docs/audits/03B_SCHEMA_BINDING_METADATA_QUERY_PACK.md
?? docs/audits/03C_SCHEMA_BINDING_EXECUTION_RESULTS.md
?? docs/audits/03D_DEPLOYED_EXTRACTION_CONTRACT_AUDIT.md
?? docs/audits/03E_SEMANTIC_BINDING_DECISION_REGISTER.md
?? docs/audits/03F_SEMANTIC_BINDING_APPROVAL_AND_SPECIALIST_REVIEW.md
?? docs/audits/03_SECURITY_AND_INTEGRATION_BOUNDARY_AUDIT.md
?? docs/audits/04A_TECHNICAL_SQL_REVIEW_AND_OPERATOR_DECISION_RECORD.md
?? docs/audits/04B_CORRECTED_DATA_PROFILING_QUERY_PACK.md
?? docs/audits/04C_CORRECTED_PACK_TECHNICAL_REVIEW.md
?? docs/audits/04D_PRIVACY_HARDENED_DATA_PROFILING_QUERY_PACK.md
?? docs/audits/04E_PRIVACY_HARDENED_PACK_INDEPENDENT_REVIEW.md
?? docs/audits/04F_DIRECT_JSON_GUARD_CORRECTED_QUERY_PACK.md
?? docs/audits/04G_DIRECT_JSON_GUARD_PACK_INDEPENDENT_REVIEW.md
?? docs/audits/04H_PREFLIGHT_OPERATOR_DECISION_AND_EXECUTION_RUNBOOK.md
?? docs/audits/04I_PREFLIGHT_EXECUTION_RESULTS_AND_VALIDATION.md
?? docs/audits/04J_PREFLIGHT_REAUTHORIZATION_AFTER_PROCEDURAL_STOP.md
?? docs/audits/04_DATA_PROFILING_QUERY_GENERATOR.md
?? supabase/functions/generate-contractor-brief/index.test.ts
```

The authorized 04K path did not exist at entry. These unrelated working-tree changes were not inspected beyond the read-only status listing and did not overlap this artifact.

## 2. Relevant input hashes

All hashes were computed locally with SHA-256 before creating this artifact.

| Input | SHA-256 | Verification |
|---|---|---|
| `docs/audits/04F_DIRECT_JSON_GUARD_CORRECTED_QUERY_PACK.md` | `60A894F2D86F763367D5FA06045DFBAA345D0223488ADEF53C501797D7F7A237` | CONFIRMED |
| `docs/audits/04G_DIRECT_JSON_GUARD_PACK_INDEPENDENT_REVIEW.md` | `9CFB42B3AD8E387C809AC87D47F6F83B511D18C98227C3F8EB80DEC38682191C` | CONFIRMED |
| `docs/audits/04H_PREFLIGHT_OPERATOR_DECISION_AND_EXECUTION_RUNBOOK.md` | `0CA207CCA02D0F7068A6FBFFB81F77D4DBD1CAC9E25733B8E3FBE67E9EB325A7` | CONFIRMED |
| `docs/audits/04I_PREFLIGHT_EXECUTION_RESULTS_AND_VALIDATION.md` | `A37B0118D52FD59FBE1A002F2D602FC8336029EDCE0E7968DFE8682739B5823F` | CONFIRMED |
| `docs/audits/04J_PREFLIGHT_REAUTHORIZATION_AFTER_PROCEDURAL_STOP.md` | `0D72DFA477EFBE9BCB0A80F3D3F8E38571B9C74D17E71BB2D76996855F2B24D4` | CONFIRMED |

The operator-supplied PF-001 through PF-006 records and the current bounded-exception decision are task-history evidence, not repository files, and therefore have no file hash in this register.

## 3. Operator decision

The WindowMan Founder and Product Owner approved:

`A04_BOUNDED_FULL_SCAN_EXCEPTION: APPROVE_FOR_SEPARATE_APPLICATION_AUTHORIZATION_REVIEW`

This decision closes the metadata-preflight phase with a narrow exception for the absent simple `public.analyses.created_at` index. It permits the exact reviewed application-query pack to advance only to a separate application-authorization review. It does not authorize execution of any application query.

## 4. PF-001 through PF-006 closeout ledger

| Query ID | Purpose | Operator execution evidence | Result validation | Closeout status | Limitation |
|---|---|---|---|---|---|
| A04-PF-001 | Database, PostgreSQL version, and role identity | Exact SQL; executed once; not batched; SQL Editor SUCCESS; supplemental target re-verification at `2026-08-31T04:34:01Z` | One row, nine expected columns; database and roles `postgres`; version number `170006`; non-superuser; inheritance and BYPASSRLS true; binding PASS | PASS | Original pre-execution visual-verification timestamp was not recorded and is not inferred; supplemental target re-verification was explicitly accepted by the operator |
| A04-PF-002 | Exact four-table presence, kind, and RLS state | Exact SQL; executed once; not batched; SQL Editor SUCCESS; visual verification at `2026-08-31T04:38:38Z` | Four rows and six expected columns; all four `public` TABLE relations present; RLS true; forced RLS false; all bindings PASS | PASS | Metadata does not prove application-row visibility or data quality |
| A04-PF-003 | Required columns, types, and nullability | Exact SQL; executed once; not batched; SQL Editor SUCCESS; accepted verification at `2026-08-31T04:46:32Z` | Fifteen rows and eight expected columns; every type/nullability pair matched; `analyses.created_at` is timestamptz; all bindings PASS | PASS | Confirms deployed metadata bindings only, not value semantics |
| A04-PF-004 | Required PK, FK, and unique-constraint bindings | Exact SQL; executed once; not batched; SQL Editor SUCCESS; visual verification at `2026-08-31T05:00:50Z` | Eight rows and eight expected columns; all required constraints matched; all bindings PASS | PASS | Does not prove date-index support or runtime plans |
| A04-PF-005 | Index inventory, validity/readiness, and date-index evidence | Exact SQL; executed once; not batched; SQL Editor SUCCESS; visual verification at `2026-08-31T05:02:57Z` | Seventeen rows and nine expected columns; required PK and unique indexes present; returned indexes valid and ready; no simple `analyses.created_at` index | HARD_STOP_ACCEPTED_FOR_ONE_BOUNDED_REVIEW | PF-005 does not become PASS; exception is one-run and non-recurring |
| A04-PF-006 | Catalog row estimates and relation-size gates | Exact SQL; executed once; not batched; SQL Editor SUCCESS; supplemental target re-verification at `2026-08-31T05:10:30Z` | Four rows and seven expected columns; estimates available and nonnegative; every relation, combined, and overall gate PASS | PASS | Catalog estimates are not exact counts and do not prove runtime, planner behavior, or quiescence |

The current closeout supersedes only the procedural incompleteness recorded in Audit 04I through the operator's later Audit 04J reauthorization and supplemental evidence. Audit 04I remains historically accurate for the sequence it closed and was not modified.

## 5. PF-005 missing-index finding

PF-005 returned 17 index-inventory rows. All returned indexes were valid and ready. The required primary-key and unique index evidence included:

- `analyses_pkey`;
- `analyses_scan_session_id_unique` on `analyses.scan_session_id`;
- `leads_pkey`;
- `quote_files_pkey`;
- `scan_sessions_pkey`; and
- `scan_sessions_quote_file_id_key` on `scan_sessions.quote_file_id`.

No simple supporting index on `public.analyses.created_at` was present. The frozen pack and runbook define this as `HARD_STOP_PENDING_FULL_SCAN_REVIEW`. The operator has now accepted that hard stop for one bounded review; PF-005 is not reclassified as PASS.

## 6. PF-006 size evidence

| Relation | Estimated rows | Total bytes | Relation gate | Combined bytes | Combined gate | Overall gate |
|---|---:|---:|---|---:|---|---|
| `public.analyses` | 18 | 4,333,568 | PASS | 5,750,784 | PASS | PASS |
| `public.leads` | 63 | 688,128 | PASS | 5,750,784 | PASS | PASS |
| `public.quote_files` | 19 | 237,568 | PASS | 5,750,784 | PASS | PASS |
| `public.scan_sessions` | 28 | 491,520 | PASS | 5,750,784 | PASS | PASS |

Validation:

- exactly four relations and seven expected output columns;
- no unavailable, missing, or negative estimate;
- largest estimate is 63 rows, below the 10,000-row ceiling;
- `analyses` is estimated at 18 rows and 4,333,568 bytes;
- component bytes sum to 5,750,784;
- combined bytes equal approximately 11.5% of the 50,000,000-byte ceiling; and
- every returned gate is PASS.

## 7. Bounded-full-scan rationale

Without a simple `analyses.created_at` index, the date-bounded predicates in the reviewed application pack may require a sequential scan of `public.analyses`. The missing index therefore remains a substantive operational limitation.

The exception is reasonable for a single restricted Phase 0 review because PF-006 places all four allowlisted relations well below the approved metadata ceilings. In particular, `analyses` is estimated at 18 rows and the combined physical footprint reported for all four relations is 5,750,784 bytes. Each application query is separately constrained by a read-only transaction, a 10-second statement timeout, a 1-second lock timeout, a 15-second idle-in-transaction timeout, exact source allowlisting, a frozen operational date interval, output restrictions, and manual one-at-a-time execution.

This rationale is conditional, not runtime proof. Catalog estimates can be stale; relation size is not a query plan; ten application queries may repeat scans in separate transactions; and neither execution duration nor planner behavior has been observed. The exception therefore cannot support recurring profiling, materially larger relations, edited SQL, retries, or productionized analytics.

## 8. Exact exception scope

The bounded exception applies only to all of the following together:

- one restricted Phase 0 profiling sequence;
- project display `WMProd`;
- Supabase branch `forensic_report_v1`;
- branch ref `zgsofkgddpcntdvpckdq`;
- exact SQL in the hashed `docs/audits/04F_DIRECT_JSON_GUARD_CORRECTED_QUERY_PACK.md` input;
- `public.analyses.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'`;
- `public.analyses.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'`;
- source allowlist: `public.analyses`, `public.scan_sessions`, `public.quote_files`, and `public.leads`;
- one application query at a time, in one uninterrupted adjacent run if separately authorized;
- `statement_timeout = '10s'`;
- `lock_timeout = '1s'`;
- `idle_in_transaction_session_timeout = '15s'`; and
- immediate stop and whole-run invalidation after any timeout, SQL error, permission error, target or role drift, unexpected output, sensitive output, suspected source write, session reset, or schema drift.

The dormant parent/main ref `wkrcyxcnzhwjtdpmfpaf` remains prohibited.

## 9. Prohibited scope

This closeout does not authorize:

- any `A04-PR-*` execution;
- any SQL edit, retry, batching, or execution by the audit agent;
- an index, migration, schema, configuration, generated-type, source, Git, database, Storage, Function, or deployment change;
- recurring, scheduled, productionized, or materially larger profiling;
- application-row inspection, raw JSON, PII, source text, filenames, Storage paths, logs, identifiers, or other prohibited output;
- use of any database target other than the exact branch ref if later separately authorized;
- reliance on RLS as the output-safety mechanism for the BYPASSRLS execution role; or
- Audit 05.

The exception does not convert catalog estimates into exact counts, establish query-plan behavior, prove production quiescence, or authorize application execution.

## 10. Quiescence blocker

`QUIESCENCE_STATUS: TECHNICALLY_SPECIFIED_AWAITING_OPERATOR_PROOF`

Production quiescence remains unproven. Before any application execution can be considered, the operator must establish and document:

1. exact project, branch ref, database, and execution-role reconfirmation immediately before the run;
2. a no-write interval covering all four allowlisted source relations;
3. one uninterrupted adjacent execution sequence in a stable SQL Editor session;
4. invalidation of the whole run after any source write, session reset, timeout, SQL error, permission error, target/role/schema drift, unexpected result shape, or sensitive output; and
5. a stop without isolated retry or combination of results across runs.

This artifact records the required procedure but supplies no operator proof that the interval exists.

## 11. Recurring-profile index blocker

`RECURRING_PROFILE_INDEX_REQUIREMENT: OPEN_BUILD_BLOCKER`

Before recurring, scheduled, productionized, or materially larger profiling is considered, a separate implementation plan must evaluate an appropriate index for the approved `analyses.created_at` access pattern. That later evaluation must consider the actual recurring queries, selectivity, write overhead, relation growth, migration safety, rollback, deployment target, and production verification.

No index, migration, or implementation is authorized or created during Phase 0.

## 12. Remaining authorization gates

Application execution remains blocked until every item below is separately evidenced:

| Gate | Current status | Required evidence |
|---|---|---|
| Exact target and role reconfirmation | PENDING | Operator record immediately before application execution |
| Bounded full-scan exception | SATISFIED_FOR_SEPARATE_REVIEW | This Audit 04K decision; PF-005 remains non-PASS |
| Exact SQL integrity | PENDING_AT_EXECUTION | Reconfirm the approved Audit 04F artifact hash and no edits |
| Security/privacy review of execution plan | PENDING | Explicit approval against the exact application query IDs and run procedure |
| Production no-write interval | BLOCKED_AWAITING_OPERATOR_PROOF | Documented quiescence procedure and contemporaneous proof |
| Uninterrupted adjacent-run procedure | PENDING | Operator acceptance of whole-run invalidation and no isolated retry |
| Exact application-query authorization | NOT_AUTHORIZED | Separate operator decision naming each authorized `A04-PR-*` ID |
| Audit 05 | BLOCKED | Completed, valid application execution ledger and aggregate evidence packet |

## 13. Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Build implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|
| A04K-001 | CONFIRMED | Repository identity was established before the 04K write | Read-only local Git commands | WORKING_TREE; root, branch, and HEAD commands at 2026-08-31T05:14:46Z | Root, branch, SHA, upstream, and initial dirty status were recorded | Artifact is tied to one local checkout state | High | Preserve final status and diff evidence |
| A04K-002 | CONFIRMED | The five frozen 04F–04J inputs have the recorded hashes | Local `Get-FileHash -Algorithm SHA256` | WORKING_TREE; paths and hashes in section 2 | All five files were present and hashed before creation | Prevents silent substitution of the reviewed pack or runbook | High | Rehash Audit 04F before any later execution authorization |
| A04K-003 | CONFIRMED | PF-001 passed identity, PostgreSQL-version, and role checks | Operator-supplied result and supplemental record | A04-PF-001; supplemental target re-verification `2026-08-31T04:34:01Z` | One row and nine columns matched all frozen criteria | Database/session identity preflight is closed | High | Reconfirm target and role immediately before any application run |
| A04K-004 | CONFIRMED | PF-002 through PF-004 passed deployed metadata bindings | Operator-supplied result records | A04-PF-002 through A04-PF-004 | Required relations, RLS flags, columns/types/nullability, and constraints matched | Deployed metadata bindings needed by the restricted pack are closed | High | Stop on later schema drift |
| A04K-005 | CONFIRMED | PF-005 found valid required indexes but no simple `analyses.created_at` index | Operator-supplied PF-005 result; frozen runbook | Audit 04H lines 452–513 and 620–640; 17-row operator result | Date-index requirement failed while returned required indexes were valid and ready | Possible full scan requires explicit exception; recurring profiling remains blocked | High | Keep PF-005 non-PASS and evaluate an index only in a later implementation plan |
| A04K-006 | CONFIRMED | PF-006 passed all metadata size gates | Operator-supplied PF-006 result and supplemental record | A04-PF-006; supplemental target re-verification `2026-08-31T05:10:30Z` | Four relations; maximum estimate 63; combined bytes 5,750,784; all gates PASS | A one-time bounded exception can advance to separate authorization review | High | Treat estimates as non-exact and stop on drift |
| A04K-007 | CONFIRMED | Founder approved the one-run bounded-full-scan exception | Current operator decision | `A04_BOUNDED_FULL_SCAN_EXCEPTION: APPROVE_FOR_SEPARATE_APPLICATION_AUTHORIZATION_REVIEW` | Missing index accepted only for one bounded Phase 0 review | Resolves the PF-005 exception decision but grants no execution authority | High | Obtain separate exact application-query authorization |
| A04K-008 | CONFIRMED | Application SQL remains unauthorized | Current operator decision and Audits 04F–04J | Audit 04J lines 171–177; current instruction | No `A04-PR-*` query is released for execution by this artifact | Profiling cannot begin automatically | High | Separate security/privacy and operator authorization required |
| A04K-009 | UNKNOWN | Production quiescence during a future application run | Audit 04G and current task evidence | Audit 04G lines 267 and 366; Audit 04F lines 2540–2571 | Procedure is specified, but no no-write interval has been proven | Cross-query aggregates could drift and invalidate disclosure controls | High | Obtain contemporaneous operator proof before execution |
| A04K-010 | CONFIRMED | Recurring profiling requires separate index evaluation | Current operator decision | `RECURRING_PROFILE_INDEX_REQUIREMENT: OPEN_BUILD_BLOCKER` | One-time exception does not approve recurring unindexed scans | Recurring profiling remains a build blocker | High | Later approved implementation plan; no Phase 0 mutation |
| A04K-011 | CONFIRMED | The audit agent did not execute SQL or access the database | Tool/action ledger for this task | Audit 04K execution | Only local read-only repository commands and the authorized Markdown write were used | Database and production state were not changed by the agent | High | None for this closeout |

## 14. Next-step handoff

The next step is a separate operator-controlled prompt that:

1. defines the exact no-write/quiescence proof procedure for the four allowlisted relations;
2. revalidates the target, role, frozen Audit 04F hash, schema assumptions, and stop conditions;
3. obtains explicit security/privacy approval of the exact application execution plan;
4. names the exact ten application query IDs proposed for authorization;
5. authorizes, if approved, one manual execution per exact query in one uninterrupted adjacent run; and
6. preserves whole-run invalidation with no retries or combination across runs.

This handoff is permission to conduct that authorization review only. No application query is authorized by Audit 04K.

## 15. Audit 05 handoff

`AUDIT_05_STATUS: BLOCKED`

Audit 05 cannot begin because application SQL execution is not authorized, production quiescence has not been proven, no application profiling result exists, and no completed aggregate execution ledger is available. Audit 05 may receive this artifact as preflight-closeout evidence only after the remaining Audit 04 execution and validation packet is complete.

PREFLIGHT_CLOSEOUT: COMPLETE_WITH_BOUNDED_EXCEPTION
A04-PF-005_STATUS: HARD_STOP_ACCEPTED_FOR_ONE_BOUNDED_REVIEW
A04-PF-006_STATUS: PASS
BOUNDED_FULL_SCAN_EXCEPTION: APPROVED_FOR_SEPARATE_APPLICATION_AUTHORIZATION_REVIEW
QUIESCENCE_STATUS: TECHNICALLY_SPECIFIED_AWAITING_OPERATOR_PROOF
APPLICATION_SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED
RECURRING_PROFILE_INDEX_REQUIREMENT: OPEN_BUILD_BLOCKER
AUDIT_05_STATUS: BLOCKED
