# Audit 04N — Fresh Application Sequence Reauthorization

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 04N — Fresh Application Sequence Reauthorization |
| Window start / artifact authorization UTC | `2026-08-31T05:42:26Z` |
| Window end UTC | `2026-08-31T06:42:26Z` |
| Execution environment | CODEX; local read-only repository inspection and one authorized Markdown write |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Repository root | `C:\Projects\wm-mvp-github-clean` |
| Git branch | `forensic_report_v2` |
| Git commit | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working tree at entry | DIRTY from pre-existing modified and untracked files; 04N path absent |
| SQL executed by agent | NO |
| Database accessed by agent | NO |
| Authorization status | `AUTHORIZED_MANUAL_ONCE` |

The start is the system UTC captured immediately before this artifact was created. The end is exactly 60 minutes later. The existing working-tree changes were not modified.

## 2. Authoritative input identities

| Input | SHA-256 | Status |
|---|---|---|
| `docs/audits/04F_DIRECT_JSON_GUARD_CORRECTED_QUERY_PACK.md` | `60A894F2D86F763367D5FA06045DFBAA345D0223488ADEF53C501797D7F7A237` | UNCHANGED |
| `docs/audits/04G_DIRECT_JSON_GUARD_PACK_INDEPENDENT_REVIEW.md` | `9CFB42B3AD8E387C809AC87D47F6F83B511D18C98227C3F8EB80DEC38682191C` | UNCHANGED |
| `docs/audits/04K_BOUNDED_FULL_SCAN_EXCEPTION_AND_PREFLIGHT_CLOSEOUT.md` | `155B574B0F1AE1DDC0D7AEF56590B326283F2B3DDBB45847915BEB5EE04944FD` | UNCHANGED |
| `docs/audits/04L_APPLICATION_EXECUTION_PLAN_AND_QUIESCENCE_ATTESTATION.md` | `A035FC598DA19948D99C55ACEDA67D1031BD5C5C9EA392CEBC34C588E078DEFF` | UNCHANGED |
| `docs/audits/04M_QUIESCENCE_ATTESTATION_AND_APPLICATION_EXECUTION_AUTHORIZATION.md` | `A4A1BC1151C5C285CAA02054110EA3C5E140F19E851C6373658E50B49B7711D5` | UNCHANGED; prior authorization superseded after procedural invalidation |

Exact SQL authority remains Audit 04F. No SQL is copied into this artifact and no query may be edited.

## 3. Prior-sequence disposition

The prior sequence was procedurally invalidated after an inconsistent operator submission. No reported database error, sensitive output, mutation, or query defect is carried into this determination.

All prior application results are `INVALIDATED_AND_NOT_REUSABLE`. They must not be cited, combined, reconciled, or incorporated into this fresh sequence. The new sequence starts from its first query and must stand alone.

## 4. Operator attestation

The WindowMan Founder and Product Owner attests:

- project `WMProd` is the intended target;
- branch `forensic_report_v1` and ref `zgsofkgddpcntdvpckdq` are the intended target;
- prohibited parent ref `wkrcyxcnzhwjtdpmfpaf` is not selected;
- other Cursor or agent work affecting the repository remains paused;
- no known upload, scan, reprocessing, deployment, migration, backfill, import, administrative write, scheduled writer, or teammate write is active;
- execution will stop immediately if a relevant write or interruption is observed;
- the operator authorizes the 60-minute window recorded in section 1;
- quiescence is operator-attested and is not a database-enforced cross-query snapshot; and
- prior results will not be incorporated into the new sequence.

Attestation completeness: PASS. Quiescence status: `OPERATOR_ATTESTED_FOR_STATED_WINDOW`.

## 5. Frozen target and scope

| Field | Authorized value |
|---|---|
| Supabase project | `WMProd` |
| Branch | `forensic_report_v1` |
| Branch ref | `zgsofkgddpcntdvpckdq` |
| Prohibited parent ref | `wkrcyxcnzhwjtdpmfpaf` |
| Database | `postgres` |
| SQL Editor role | `postgres` |
| PostgreSQL version | `17.6` |
| Method | Manual Supabase Dashboard SQL Editor |
| Sequence count | One fresh uninterrupted sequence |
| Window | Start inclusive at `2026-08-31T05:42:26Z`; end exclusive at `2026-08-31T06:42:26Z` |

The one-time bounded full-scan exception remains limited to this single Phase 0 sequence. It does not authorize recurring profiling, retries, edited SQL, schema changes, indexes, migrations, or Audit 05.

## 6. Authorized query order

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

Only the first query is initially released. Each later query remains withheld until the immediately preceding result is validated.

## 7. Improved timestamp procedure

For each query, the operator must:

1. record a pre-execution system UTC immediately before running the SQL;
2. run the exact released Audit 04F SQL once;
3. record a post-execution system UTC immediately after completion;
4. attest that SQL execution occurred between those two timestamps;
5. confirm both timestamps are at or after the window start and before the window end; and
6. record the SQL Editor duration when displayed, otherwise `NOT DISPLAYED`.

The system timestamps bracket the execution; neither is represented as an exact database execution timestamp. A missing, reversed, outside-window, or ambiguous timestamp invalidates the sequence.

## 8. Execution and invalidation controls

- Use one stable SQL Editor session.
- Execute one query at a time in exact order.
- No batching, editing, retry, skip, duplication, substitution, or out-of-order execution.
- Preserve the exact timeouts, read-only transaction, fixed search path, output caps, and terminal `ROLLBACK` from Audit 04F.
- Validate each result before release of the next query.
- Stop on any error, timeout, target uncertainty, unexpected or sensitive output, observed write, session change, interruption, safety-cap hard stop, or expired window.
- Any hard stop invalidates the complete fresh sequence. Results may not be reused in another run.

No query may start or continue at or after `2026-08-31T06:42:26Z`.

## 9. Operator result template

| Field | Operator entry |
|---|---|
| Project visually confirmed | ________________________________ |
| Branch visually confirmed | ________________________________ |
| Branch ref visually confirmed | ________________________________ |
| Prohibited parent not selected | ________________________________ |
| Query ID | ________________________________ |
| Exact Audit 04F SQL used without edits | ________________________________ |
| Pre-execution UTC | ________________________________ |
| Post-execution UTC | ________________________________ |
| SQL execution attested between those timestamps | ________________________________ |
| Both timestamps inside authorization window | ________________________________ |
| Query executed once | ________________________________ |
| Batched with another query | ________________________________ |
| Retry performed | ________________________________ |
| SQL Editor status | ________________________________ |
| Duration or `NOT DISPLAYED` | ________________________________ |
| Observed columns | ________________________________ |
| Observed row count | ________________________________ |
| Complete permitted aggregate result | ________________________________ |
| Unexpected or sensitive output observed | ________________________________ |
| Relevant write, session change, or interruption observed | ________________________________ |

## 10. Authorization review

| Requirement | Result |
|---|---|
| Exact frozen target supplied | PASS |
| Fresh operator quiescence attestation supplied | PASS |
| New 60-minute system-UTC window recorded | PASS |
| Authoritative inputs unchanged | PASS |
| Prior sequence excluded completely | PASS |
| Exact ten-query set and order preserved | PASS |
| One-at-a-time release and validation preserved | PASS |
| No SQL/database action by agent | PASS |

Decision: `AUTHORIZED_MANUAL_ONCE` for the exact target, sequence, window, and controls in this artifact.

## 11. Evidence ledger

| Evidence ID | Classification | Claim | Source | Consequence |
|---|---|---|---|---|
| A04N-001 | CONFIRMED | Frozen artifacts were unchanged at entry | Local SHA-256 checks | Exact Audit 04F remains SQL authority |
| A04N-002 | CONFIRMED | Prior sequence is invalid and non-reusable | Operator decision and preceding hard stop | New sequence starts from the first query |
| A04N-003 | CONFIRMED | Founder supplied a fresh quiescence attestation | Current operator statement | Supports one window-bound authorization |
| A04N-004 | INFERRED | No relevant writes are active | Operator's contemporaneous observation | Whole-run stop remains mandatory on observed activity |
| A04N-005 | CONFIRMED | Window is exactly 60 minutes | System UTC capture and deterministic calculation | Authorization expires at recorded end |
| A04N-006 | CONFIRMED | Agent did not execute SQL or access Supabase | Audit 04N action ledger | Manual operator execution only |

## 12. Handoff and Audit 05 status

The accompanying response releases only the exact first query and the improved timestamp result template. No later query is released. Audit 05 remains blocked until all ten fresh results are sequentially validated and recorded as one complete, uninterrupted evidence packet.

APPLICATION_EXECUTION_AUTHORIZATION: AUTHORIZED_MANUAL_ONCE
NEW_SEQUENCE_START_QUERY: A04-PR-001
PRIOR_SEQUENCE_RESULTS: INVALIDATED_AND_NOT_REUSABLE
AUDIT_05_STATUS: BLOCKED
