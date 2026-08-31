# Audit 04L — Application Execution Plan and Quiescence Attestation

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 04L — Application Execution Plan and Quiescence Attestation |
| UTC artifact-generation time | 2026-08-31T05:20:13Z |
| Execution environment | CODEX; local repository inspection and one authorized Markdown write |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active Git branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity verified | UNKNOWN; no network access was authorized or performed |
| Working-tree status at entry | DIRTY from pre-existing modified and untracked files; the authorized 04L path did not exist |
| Database access by audit agent | NONE |
| SQL execution by audit agent | NONE |
| Applicable governance | Root `AGENTS.md`; Audit 00 protocol; authoritative Audits 04F, 04G, and 04K |
| Artifact status | READY_FOR_OPERATOR_ATTESTATION |
| Auditor limitation | No database-enforced snapshot, production quiescence, query execution, runtime, planner behavior, or application result was observed |

The entry Git status contained one pre-existing modified TypeScript file, one pre-existing untracked test, and the existing untracked audit packet. Those files are outside this artifact's authorized path and were not modified. The Git command also reported that the user-level Git ignore file was inaccessible; the command otherwise exited successfully.

## 2. Authoritative inputs and hashes

All three required inputs existed and were hashed locally before this artifact was created.

| Input | SHA-256 | Role |
|---|---|---|
| `docs/audits/04F_DIRECT_JSON_GUARD_CORRECTED_QUERY_PACK.md` | `60A894F2D86F763367D5FA06045DFBAA345D0223488ADEF53C501797D7F7A237` | Exact reviewed application-query source; SQL must remain unchanged and is not reproduced here |
| `docs/audits/04G_DIRECT_JSON_GUARD_PACK_INDEPENDENT_REVIEW.md` | `9CFB42B3AD8E387C809AC87D47F6F83B511D18C98227C3F8EB80DEC38682191C` | Independent technical review; requires quiescence, uninterrupted execution, no isolated retry, and whole-run invalidation |
| `docs/audits/04K_BOUNDED_FULL_SCAN_EXCEPTION_AND_PREFLIGHT_CLOSEOUT.md` | `155B574B0F1AE1DDC0D7AEF56590B326283F2B3DDBB45847915BEB5EE04944FD` | Metadata-preflight closeout and one-run bounded full-scan exception |

Repository evidence directly supports the supplied gate state. No input artifact was edited during Audit 04L.

## 3. Current gate status

| Gate or finding | Status |
|---|---|
| Metadata-preflight closeout | COMPLETE_WITH_BOUNDED_EXCEPTION |
| A04-PF-001 through A04-PF-004 | PASS |
| A04-PF-005 | Simple `public.analyses.created_at` index absent; PF-005 remains non-PASS |
| A04-PF-005 exception | Accepted only for one bounded Phase 0 profiling review |
| A04-PF-006 | PASS |
| Estimated rows | analyses 18; leads 63; quote_files 19; scan_sessions 28 |
| Combined estimated bytes | 5,750,784 |
| Quiescence | TECHNICALLY_SPECIFIED_AWAITING_OPERATOR_PROOF |
| Application SQL execution | NOT_AUTHORIZED |
| Audit 05 | BLOCKED |

Catalog estimates are not exact counts and do not establish quiescence, runtime, selectivity, or query plans.

## 4. Exact target identity

| Target field | Required value |
|---|---|
| Supabase project display | `WMProd` |
| Supabase branch | `forensic_report_v1` |
| Branch ref | `zgsofkgddpcntdvpckdq` |
| Prohibited parent ref | `wkrcyxcnzhwjtdpmfpaf` |
| Database | `postgres` |
| SQL Editor role | `postgres` |
| PostgreSQL version | `17.6` |

The operator must visually reconfirm the exact project, branch, and branch ref immediately before any separately authorized application run. Any uncertainty is a whole-run hard stop. The prohibited parent must never be selected, inspected, or used.

## 5. Prospective ten-query execution plan

The following order is frozen. This plan names the application set but does not display, release, approve, or execute its SQL:

1. `A04-PR-001`
2. `A04-PR-002`
3. `A04-PR-003`
4. `A04-PR-004`
5. `A04-PR-005`
6. `A04-PR-006`
7. `A04-PR-007`
8. `A04-PR-008`
9. `A04-PR-009`
10. `A04-PR-010`

If a later artifact separately authorizes execution, the operator must apply all of these controls:

1. Select one short execution window.
2. Visually confirm one exact Supabase project, branch, and branch ref.
3. Use one stable SQL Editor session from start to finish.
4. Execute the application set sequentially in the frozen order above.
5. Execute one query at a time.
6. Do not batch queries.
7. Copy the exact SQL from the hashed Audit 04F input without editing it.
8. Do not retry any query without a new review and explicit authorization.
9. Preserve the 10-second statement timeout, 1-second lock timeout, and 15-second idle-in-transaction timeout exactly.
10. Preserve each query's read-only transaction and terminal `ROLLBACK` exactly.
11. Capture each permitted result using the record in section 8.
12. Stop and invalidate the whole run on any condition in section 9.

The run must be one uninterrupted adjacent sequence. Results from different sessions, windows, retries, or partial sequences must not be combined.

## 6. Quiescence definition

For this one-time run, quiescence means the operator has reasonable contemporaneous evidence that no known process is writing to any of these four relations during the complete ten-query sequence:

- `public.analyses`
- `public.scan_sessions`
- `public.quote_files`
- `public.leads`

The operator's attestation must establish all of the following for the complete window:

- no operator or administrator is editing relevant records;
- no migration, deployment, backfill, repair, import, or manual database operation is running;
- no known scan, rescan, upload, report-processing, or reprocessing operation is active;
- no known scheduled job is writing to the four relations;
- no teammate is knowingly performing an operation that writes to the four relations; and
- the operator will stop immediately if a homeowner upload, scan, administrative change, deployment, or other relevant write is observed.

The operator is not required to disable the live site or change production configuration. Absence of observed writes is an operator attestation, not a database-enforced snapshot across ten independent transactions. Low row estimates do not prove quiescence.

## 7. Operator-attestation template

All fields below are intentionally blank. The audit agent has not prefilled identity, observations, timestamps, confirmation, or decision.

| Attestation field | Operator entry |
|---|---|
| Founder/operator name or role | ________________________________ |
| Project visually confirmed | ________________________________ |
| Branch visually confirmed | ________________________________ |
| Branch ref visually confirmed | ________________________________ |
| Prohibited parent not selected | ________________________________ |
| Quiescence window start UTC | ________________________________ |
| Quiescence window end UTC | ________________________________ |
| Stable SQL Editor session confirmed | ________________________________ |
| No known operator/admin writes | ________________________________ |
| No known upload or scan activity | ________________________________ |
| No known migrations, deployments, backfills, or imports | ________________________________ |
| No known scheduled writer activity | ________________________________ |
| Teammate coordination completed or not applicable | ________________________________ |
| Exact Audit 04F hash confirmed | ________________________________ |
| Exact approved query IDs | ________________________________ |
| Decision | ________________________________ |
| Decision UTC | ________________________________ |
| Additional restrictions | ________________________________ |

Permitted decision values are:

- `ATTESTED_READY_FOR_SEPARATE_APPLICATION_AUTHORIZATION`
- `NOT_ATTESTED`

Any other value is invalid. A completed attestation is evidence for a later authorization decision; it does not itself authorize SQL execution.

## 8. Prospective result-capture record

Create one record per query only after separate execution authorization. Do not paste prohibited output.

| Result field | Operator entry |
|---|---|
| Query ID | ________________________________ |
| Visual target confirmation UTC | ________________________________ |
| Execution UTC | ________________________________ |
| SQL Editor status | ________________________________ |
| Duration or `NOT DISPLAYED` | ________________________________ |
| Expected output columns confirmed | ________________________________ |
| Observed row count | ________________________________ |
| Complete permitted aggregate result | ________________________________ |
| Sensitive or unexpected output observed | ________________________________ |
| Result accepted or whole run invalidated | ________________________________ |

Each record must identify the query, UTC time, status, displayed duration or `NOT DISPLAYED`, expected-column validation, row count, and the complete permitted aggregate result. Safety-cap results must be evaluated against the exact query's frozen hard-stop contract.

## 9. Result-invalidation rules

Stop immediately and mark the complete ten-query result set invalid if any of these occurs:

- target project, branch, ref, database, or role becomes uncertain;
- a query is edited, batched, skipped, duplicated, or run out of order;
- a query errors or times out;
- a retry appears necessary;
- schema or deployed-contract drift is discovered;
- sensitive or unexpected output appears;
- a known write occurs against any allowlisted relation;
- the SQL Editor session changes unexpectedly;
- the execution window is interrupted; or
- any query returns exactly its safety cap where the frozen query contract defines that condition as a hard stop.

No automatic retry, isolated retry, ad hoc correction, query substitution, or combination of partial runs is permitted. After invalidation, a new review, new contemporaneous attestation, and new explicit authorization are required.

## 10. Sensitive-output handling

No audit artifact may contain identifiers, PII, raw JSON, descriptions, filenames, object or Storage paths, source text, free text, contractor names, credentials, secrets, or any other prohibited value.

If unexpected or sensitive output appears:

1. stop the sequence immediately;
2. do not copy, quote, summarize, hash, transform, or preserve the sensitive value;
3. record only that a sensitive-output incident occurred, the affected query ID, UTC time, and the safe output category if it can be named without disclosure;
4. invalidate the complete result set; and
5. require new technical, security/privacy, and operator review before any further execution.

The SQL Editor role has BYPASSRLS. Output safety therefore depends on exact reviewed SQL, source allowlisting, aggregate-only projections, suppression, output-column allowlists, the stable run procedure, and human review—not on RLS.

## 11. Remaining blockers and authorization gates

| Requirement | Current status | Required next evidence |
|---|---|---|
| Contemporaneous quiescence attestation | PENDING | Completed section 7 with one permitted decision value |
| Exact target and role confirmation | PENDING_AT_EXECUTION | Visual operator record immediately before a separately authorized run |
| Exact Audit 04F integrity | PENDING_AT_EXECUTION | Recomputed hash matching section 2 |
| Security/privacy approval of execution plan | PENDING | Explicit human review of the exact plan and query set |
| Application execution authorization | NOT_AUTHORIZED | Separate operator artifact naming the exact IDs and one-run limits |
| Runtime and plan behavior | UNKNOWN | May be observed only through a separately authorized run; stop on timeout or error |
| Audit 05 | BLOCKED | Valid complete aggregate execution packet after all preceding gates |

Audit 04L prepares the controls and blank attestation record only. It grants no permission to execute any application query.

## 12. Recurring-profile index blocker

`RECURRING_PROFILE_INDEX_REQUIREMENT: OPEN_BUILD_BLOCKER`

The bounded full-scan exception applies to one restricted Phase 0 run only. It does not support recurring, scheduled, productionized, materially larger, retried, or edited profiling. Before any such use is considered, a separately authorized implementation plan must evaluate an appropriate index for the approved `public.analyses.created_at` access pattern. Phase 0 does not authorize creating that index or a migration.

## 13. Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Consequence | Required follow-up |
|---|---|---|---|---|---|---|---|
| A04L-001 | CONFIRMED | Exact corrected pack identity is frozen | Audit 04F file hash | Section 2 | Required input exists with recorded SHA-256 | No SQL may be edited or reproduced here | Rehash before later authorization |
| A04L-002 | CONFIRMED | Independent review requires quiescence and one uninterrupted run | Audit 04G | Lines 222–229, 267, 297–307, and 366 | Separate transactions can drift and defeat coordinated disclosure controls | Contemporaneous operator attestation is mandatory |
| A04L-003 | CONFIRMED | Metadata preflights closed with a one-run exception | Audit 04K | Sections 4–12 and terminal status | PF-005 remains non-PASS; PF-006 passed the size gate | Preserve narrow exception and recurring-index blocker |
| A04L-004 | UNKNOWN | No relevant source write will occur during the future run | No contemporaneous operator evidence supplied | Section 7 remains blank | Quiescence is not proven | Operator must complete attestation |
| A04L-005 | CONFIRMED | Audit 04L authorizes neither SQL release nor execution | Current operator instruction and this artifact | Sections 5, 11, and 14 | Plan contains no application SQL | Separate authorization artifact required |
| A04L-006 | CONFIRMED | Audit agent did not access the database or execute SQL | Tool/action ledger | Audit 04L generation | Only local read-only checks and one Markdown write occurred | Production state unchanged by agent |

## 14. Handoff for separate application authorization

After the operator supplies a fully completed attestation, a separate artifact must:

1. validate every attestation field and permitted decision value;
2. confirm the attested window is prospective or contemporaneous with the intended run and not stale;
3. rehash Audit 04F and confirm no target, role, schema, contract, or authorization drift;
4. record explicit security/privacy approval;
5. either refuse authorization or name the exact application IDs authorized for one run;
6. preserve exact order, no edits, no batching, no retries, one stable session, whole-run invalidation, and sensitive-output rules; and
7. keep Audit 05 blocked until a complete valid aggregate execution ledger has been reviewed.

Audit 04L is not that authorization artifact. No application SQL is authorized, displayed, released, or executed here.

APPLICATION_EXECUTION_PLAN: READY_FOR_OPERATOR_ATTESTATION
QUIESCENCE_STATUS: AWAITING_CONTEMPORANEOUS_OPERATOR_ATTESTATION
APPLICATION_SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED
AUDIT_05_STATUS: BLOCKED
