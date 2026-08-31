# Audit 04M — Quiescence Attestation and Application Execution Authorization

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 04M — Quiescence Attestation and Application Execution Authorization |
| Authorization-review UTC | `2026-08-31T05:30:02Z` |
| Execution environment | CODEX; local read-only repository inspection and one authorized Markdown write |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active Git branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity verified | UNKNOWN; no network operation was performed |
| Working-tree status at entry | DIRTY from pre-existing modified and untracked files; authorized 04M path absent |
| Database access by audit agent | NONE |
| SQL execution by audit agent | NONE |
| Audit status | COMPLETE_WITH_WINDOW_BOUND_AUTHORIZATION |
| Auditor limitation | Quiescence is operator-attested, not database-enforced or independently observed |

The pre-existing working-tree changes did not overlap the authorized 04M path and were not modified. The local Git status command emitted a user-level ignore-file permission warning but otherwise exited successfully.

## 2. Authoritative inputs and hashes

All required inputs existed and were hashed before this authorization review.

| Input | SHA-256 | Validation |
|---|---|---|
| `docs/audits/04F_DIRECT_JSON_GUARD_CORRECTED_QUERY_PACK.md` | `60A894F2D86F763367D5FA06045DFBAA345D0223488ADEF53C501797D7F7A237` | UNCHANGED |
| `docs/audits/04G_DIRECT_JSON_GUARD_PACK_INDEPENDENT_REVIEW.md` | `9CFB42B3AD8E387C809AC87D47F6F83B511D18C98227C3F8EB80DEC38682191C` | UNCHANGED |
| `docs/audits/04K_BOUNDED_FULL_SCAN_EXCEPTION_AND_PREFLIGHT_CLOSEOUT.md` | `155B574B0F1AE1DDC0D7AEF56590B326283F2B3DDBB45847915BEB5EE04944FD` | UNCHANGED |
| `docs/audits/04L_APPLICATION_EXECUTION_PLAN_AND_QUIESCENCE_ATTESTATION.md` | `A035FC598DA19948D99C55ACEDA67D1031BD5C5C9EA392CEBC34C588E078DEFF` | UNCHANGED |

Audit 04G independently records 16 `APPROVED_AS_WRITTEN`, zero `REQUIRES_CORRECTION`, and zero `REJECTED`. Audit 04K approves the missing-date-index exception only for one bounded Phase 0 execution review. Audit 04L defines the prospective sequence, quiescence standard, invalidation rules, and separate-authorization requirement.

No SQL is copied into this artifact. Exact SQL authority remains the hashed Audit 04F input.

## 3. Operator quiescence attestation

The WindowMan Founder and Product Owner supplied the following contemporaneous attestation. The planned end was explicitly requested as 20 minutes after the supplied start and is therefore calculated as `2026-08-31T05:48:11Z`.

| Attestation field | Attested value |
|---|---|
| Founder/operator role | WindowMan Founder and Product Owner |
| Project visually confirmed | `WMProd` |
| Branch visually confirmed | `forensic_report_v1` |
| Branch ref visually confirmed | `zgsofkgddpcntdvpckdq` |
| Prohibited parent ref `wkrcyxcnzhwjtdpmfpaf` not selected | YES |
| Quiescence window start UTC | `2026-08-31T05:28:11Z` |
| Planned quiescence window end UTC | `2026-08-31T05:48:11Z` |
| Other Cursor/agent tasks affecting repository paused | YES |
| Stable Supabase SQL Editor session available | YES |
| No known operator or administrator database writes | YES |
| No known homeowner upload or scan activity | YES |
| No known scan, rescan, or report reprocessing activity | YES |
| No known migration, deployment, backfill, repair, or import | YES |
| No known scheduled writer affecting allowlisted relations | YES |
| No known teammate activity affecting allowlisted relations | YES |
| Will stop if any relevant write or activity is observed | YES |
| Understands operator-attested quiescence is not a database-enforced cross-query snapshot | YES |
| Approves one query at a time with no edits, batching, skips, or retries | YES |
| Accepts complete-run invalidation after any hard stop | YES |

Attestation completeness: PASS. Target identity: PASS. The authorization review occurred inside the stated window. Quiescence remains a founder/operator attestation; the audit agent did not independently observe production activity.

## 4. Frozen target and execution scope

| Field | Authorized value |
|---|---|
| Supabase project | `WMProd` |
| Branch | `forensic_report_v1` |
| Branch ref | `zgsofkgddpcntdvpckdq` |
| Database | `postgres` |
| SQL Editor role | `postgres` |
| PostgreSQL version | `17.6` |
| Prohibited parent ref | `wkrcyxcnzhwjtdpmfpaf` |
| Window start | `2026-08-31T05:28:11Z` inclusive |
| Window end | `2026-08-31T05:48:11Z` exclusive for starting or continuing execution |
| Execution method | Manual Supabase Dashboard SQL Editor only |
| Execution count | One uninterrupted sequence only |
| SQL source | Exact, unedited SQL from the hashed Audit 04F artifact |

Allowlisted application relations only:

- `public.analyses`
- `public.scan_sessions`
- `public.quote_files`
- `public.leads`

The bounded full-scan exception applies only to this single Phase 0 sequence and expires with the window, any invalidation event, or completion of the sequence. It does not make A04-PF-005 PASS and does not support recurring, scheduled, productionized, retried, edited, or materially larger profiling.

## 5. Exact authorized application query set and order

The following IDs are authorized once, in this exact order:

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

Authorization decision: `AUTHORIZED_MANUAL_ONCE`.

Only the first query is released initially. Each later query remains conditionally withheld until the immediately preceding result receives complete validation. Displaying or authorizing the set here does not permit all SQL bodies to be released simultaneously.

## 6. Static authorization review

| Requirement | Evidence | Result |
|---|---|---|
| Operator attestation complete | Section 3 contains every supplied field and the calculated 20-minute end | PASS |
| Target matches frozen identity | Operator values equal Audits 04K and 04L | PASS |
| Four input hashes unchanged | Section 2 pre-write hashes | PASS |
| One-run bounded exception | Audit 04K and section 4 | PASS |
| All application queries statically reviewed | Audit 04G records 16 packages approved as written | PASS |
| Read-only, timeout-protected, capped, privacy-reviewed, rollback-terminated | Audit 04G common findings and query-by-query review | PASS_STATIC |
| Exact numerical order | Section 5 | PASS |
| One stable session, one query at a time | Operator attestation and section 7 | PASS |
| No edits, batching, retries, skips, duplication, or target change | Operator attestation and section 8 | PASS |
| Window validity at review | Review UTC `2026-08-31T05:30:02Z` is within the attested interval | PASS |
| Runtime behavior and actual quiescence | Not independently observed | OPERATOR_ATTESTED_ONLY |

Every requirement necessary for a narrowly scoped manual-once release passes at authorization time. This conclusion does not predict runtime success and does not waive any hard stop.

## 7. Mandatory manual execution controls

The operator must:

1. visually reconfirm the exact target and role immediately before the first query;
2. retain the same stable SQL Editor session throughout;
3. copy only the exact currently released SQL from Audit 04F;
4. execute one query at a time in the exact order in section 5;
5. make no edit, batch, skip, duplicate execution, or retry;
6. preserve the 10-second statement timeout, 1-second lock timeout, 15-second idle-in-transaction timeout, read-only transaction, fixed search path, output caps, and terminal `ROLLBACK`;
7. capture the complete permitted aggregate result, expected columns, row count, UTC execution time, status, and duration or `NOT DISPLAYED`;
8. omit and never reproduce any sensitive or unexpected value;
9. submit each result for validation before the next query is released; and
10. stop before the end of the stated window, even if the sequence is incomplete.

No application query may start or continue at or after `2026-08-31T05:48:11Z`.

## 8. Whole-run invalidation rules

Stop immediately and invalidate the complete sequence if:

- target project, branch, ref, database, or role becomes uncertain;
- a query is edited, batched, skipped, duplicated, or run out of order;
- a query errors or times out;
- a retry appears necessary;
- schema or contract drift is discovered;
- sensitive or unexpected output appears;
- a known write occurs against an allowlisted relation;
- relevant upload, scan, reprocessing, administrative, deployment, or teammate activity is observed;
- the SQL Editor session changes unexpectedly;
- the execution window is interrupted or expires; or
- a query reaches a safety cap defined by its frozen hard-stop contract.

After invalidation, no further query is authorized. No automatic retry, ad hoc correction, isolated rerun, or result combination across windows or sessions is permitted. A fresh review, attestation, and authorization would be required.

## 9. Sensitive-output handling

No identifier, PII, raw JSON, description, filename, object or Storage path, source text, free text, contractor name, credential, secret, or other prohibited value may be copied into an audit artifact.

If such output appears, the operator must stop, omit the value, record only a safe incident marker and affected query ID, invalidate the whole run, and seek new security/privacy review. Because the role has `BYPASSRLS=true`, safety depends on exact SQL, projections, suppression, output allowlists, execution controls, and human review—not RLS.

## 10. Initial result template

This template applies only to the first released query:

| Field | Operator entry |
|---|---|
| Project visually confirmed | ________________________________ |
| Branch visually confirmed | ________________________________ |
| Branch ref visually confirmed | ________________________________ |
| Prohibited parent not selected | ________________________________ |
| Query ID | ________________________________ |
| Exact Audit 04F SQL used without edits | ________________________________ |
| Executed once | ________________________________ |
| Batched with another query | ________________________________ |
| Retry performed | ________________________________ |
| Execution UTC | ________________________________ |
| SQL Editor status | ________________________________ |
| Duration or `NOT DISPLAYED` | ________________________________ |
| Observed columns | ________________________________ |
| Observed row count | ________________________________ |
| Complete permitted aggregate result | ________________________________ |
| Unexpected or sensitive output observed | ________________________________ |
| Relevant write or interruption observed | ________________________________ |

Expected output is exactly one row with exactly these four columns: `mutable_analysis_row_count`, `scan_session_count`, `uploaded_document_count`, and `lead_count`. Any other shape is a whole-run hard stop. Values must be nonnegative aggregate counts; no identifier or other value is permitted.

## 11. Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Consequence | Follow-up |
|---|---|---|---|---|---|---|
| A04M-001 | CONFIRMED | Authoritative artifacts are unchanged | Local SHA-256 verification | Section 2 | Exact reviewed pack remains the SQL authority | Rehash if any later drift is suspected |
| A04M-002 | CONFIRMED | Audit 04G approved all 16 packages as written | Audit 04G | Lines 68–112 | Static technical review prerequisite is satisfied | Runtime validation remains sequential |
| A04M-003 | CONFIRMED | One-time bounded full-scan exception is approved | Audit 04K | Sections 7–12 and terminal status | Missing date index is accepted only for this sequence | Keep recurring index blocker open |
| A04M-004 | CONFIRMED | Operator supplied all required quiescence statements | Current operator attestation | Section 3 | Quiescence gate is attested for stated window | Stop on any observed write or expiry |
| A04M-005 | INFERRED | No relevant writes are occurring | Operator's reasonable contemporaneous observation | Section 3 | Supports manual-once authorization but is not a database snapshot | Preserve whole-run invalidation controls |
| A04M-006 | CONFIRMED | Exact target matches frozen target | Operator attestation and Audits 04K–04L | Sections 3–4 | No target substitution is permitted | Visually reconfirm before execution |
| A04M-007 | CONFIRMED | Audit agent executed no SQL and accessed no database | Audit 04M action ledger | This task | Production state was not changed by the agent | Manual operator execution only |

## 12. Remaining blockers and handoff

Audit 05 remains blocked until all ten results are executed within this window, validated sequentially, recorded without prohibited output, and assembled into a complete Audit 04 evidence packet.

The recurring-profile index requirement remains an open build blocker. This authorization creates no index, migration, recurring permission, retry permission, or production analytics approval.

The immediate handoff is limited to manual execution of the first released query using the exact SQL displayed in the assistant response accompanying this artifact. The next SQL body may be released only after a complete, valid first result is supplied and validated before window expiry.

APPLICATION_EXECUTION_AUTHORIZATION: AUTHORIZED_MANUAL_ONCE
QUIESCENCE_STATUS: OPERATOR_ATTESTED_FOR_STATED_WINDOW
NEXT_QUERY: A04-PR-001
AUDIT_05_STATUS: BLOCKED
