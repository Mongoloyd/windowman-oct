# Audit 04J — Preflight Reauthorization After Procedural Hard Stop

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 04J — Preflight Reauthorization After Procedural Hard Stop |
| UTC authorization/artifact time | `2026-08-31T04:18:52Z` |
| Execution environment | CODEX desktop; local read-only inspection plus this authorized Markdown creation |
| Working directory/repository root | `C:\Projects\wm-mvp-github-clean` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| SQL executed by agent | `NO` |
| Database/Supabase accessed by agent | `NO` |
| Builds/tests/type checks/linters | `NO — NOT APPLICABLE` |

## 2. Entry-validation record

| Gate | Observed evidence | Result |
|---|---|---|
| Audit 04H identity | 38,888 bytes; 748 lines; SHA-256 `0CA207CCA02D0F7068A6FBFFB81F77D4DBD1CAC9E25733B8E3FBE67E9EB325A7` | PASS |
| Audit 04I identity | 13,514 bytes; 202 lines; SHA-256 `A37B0118D52FD59FBE1A002F2D602FC8336029EDCE0E7968DFE8682739B5823F` | PASS |
| Audit 04I PF-001 database values | One row and nine values matched the frozen PASS values | PASS — value level only |
| Audit 04I PF-001 classification | `INSUFFICIENT_RESULT_EVIDENCE` | CONFIRMED |
| Audit 04I later-query state | PF-002 through PF-006 not released or executed | CONFIRMED |
| Audit 04I authorization state | Prior preflight authorization expired on hard stop | CONFIRMED |
| Audit 04I application boundary | Application SQL remained `NOT_AUTHORIZED` | CONFIRMED |
| Audit 04J pre-existence | File absent before creation | PASS |

Audit 04I remains immutable evidence of the first procedural stop. This artifact supersedes only the expired preflight execution authority; it does not reverse, erase, amend, or reinterpret Audit 04I.

## 3. Authorized-input identities

| Input | SHA-256 | Identity basis |
|---|---|---|
| `docs/audits/04F_DIRECT_JSON_GUARD_CORRECTED_QUERY_PACK.md` | `60A894F2D86F763367D5FA06045DFBAA345D0223488ADEF53C501797D7F7A237` | Frozen reviewed-pack identity |
| `docs/audits/04G_DIRECT_JSON_GUARD_PACK_INDEPENDENT_REVIEW.md` | `9CFB42B3AD8E387C809AC87D47F6F83B511D18C98227C3F8EB80DEC38682191C` | Frozen independent-review identity |
| `docs/audits/04H_PREFLIGHT_OPERATOR_DECISION_AND_EXECUTION_RUNBOOK.md` | `0CA207CCA02D0F7068A6FBFFB81F77D4DBD1CAC9E25733B8E3FBE67E9EB325A7` | Independently rehashed at Audit 04J entry |
| `docs/audits/04I_PREFLIGHT_EXECUTION_RESULTS_AND_VALIDATION.md` | `A37B0118D52FD59FBE1A002F2D602FC8336029EDCE0E7968DFE8682739B5823F` | Independently rehashed at Audit 04J entry |

All four authorized inputs were read completely. No existing artifact was modified.

## 4. Initial repository status

Repository identity commands exited successfully. The initial working tree was already dirty: `supabase/functions/generate-contractor-brief/index.ts` was modified; `supabase/functions/generate-contractor-brief/index.test.ts` and the audit artifacts through Audit 04I were untracked. These pre-existing or independently arising changes were not modified by Audit 04J. Git emitted its known read-only global-ignore permission warning and still returned exit code 0.

## 5. New operator authorization

| Field | Recorded value |
|---|---|
| Founder/operator | `WindowMan Founder and Product Owner` |
| Decision | `AUTHORIZED_NEW_PREFLIGHT_SEQUENCE` |
| Reason | `Prior sequence stopped solely because required execution-record fields were omitted` |
| UTC authorization time | `2026-08-31T04:18:52Z` |
| Target project | `WMProd` |
| Target branch | `forensic_report_v1` |
| Target branch ref | `zgsofkgddpcntdvpckdq` |
| Prohibited parent ref | `wkrcyxcnzhwjtdpmfpaf` |
| Authorized method | Manual Supabase Dashboard SQL Editor |
| PF-001 rerun allowance | Exactly once under Audit 04J |
| Conditionally authorized later IDs | `A04-PF-002`, `A04-PF-003`, `A04-PF-004`, `A04-PF-005`, `A04-PF-006` |
| Application authorization | `NONE` |
| Ad hoc edits | `PROHIBITED` |
| Batching | `PROHIBITED` |
| Additional retries | `PROHIBITED` |

Authorization expires after one complete preflight sequence or at the first hard stop, error, timeout, cleanup event, edited query, batch execution, duplicate execution, or target uncertainty.

## 6. Required operator record for A04-PF-001

Record every field immediately before and after executing PF-001. Placeholders are not acceptable. `NOT DISPLAYED` is acceptable only for duration.

```markdown
- Project visually confirmed: WMProd
- Branch visually confirmed: forensic_report_v1
- Branch ref visually confirmed: zgsofkgddpcntdvpckdq
- Prohibited parent not selected: YES
- Visual-verification UTC: [CONCRETE UTC TIMESTAMP]
- Exact SQL used unchanged: YES
- Query executed once under Audit 04J: YES
- Batched with another query: NO
- SQL Editor status: SUCCESS or ERROR
- Execution duration: [DISPLAYED DURATION or NOT DISPLAYED]
```

A concrete timestamp may be obtained immediately before execution with this read-only local command:

```powershell
Get-Date -AsUTC -Format "yyyy-MM-ddTHH:mm:ssZ"
```

## 7. A04-PF-001 — exact reauthorized SQL

This is the only query released by Audit 04J. Copy it unchanged into a new blank SQL Editor query on the visually confirmed target and execute it exactly once.

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

## 8. Expected output and PASS conditions

Expected columns, in order:

1. `database_name`
2. `current_role_name`
3. `session_role_name`
4. `server_version`
5. `server_version_num`
6. `is_superuser`
7. `inherits_roles`
8. `bypasses_rls`
9. `binding_status`

PASS requires exactly one row, exactly those nine columns, and all of the following:

- `database_name = postgres`
- `current_role_name = postgres`
- `session_role_name = postgres`
- `server_version_num = 170006`
- `is_superuser = false`
- `inherits_roles = true`
- `bypasses_rls = true`
- `binding_status = PASS`
- Concrete visual-verification UTC
- SQL Editor status `SUCCESS`
- Displayed duration or explicit `NOT DISPLAYED`
- SQL unchanged, executed once under Audit 04J, and not batched

## 9. Hard stops and boundary

Stop immediately and release no later query if any required field is missing, a placeholder remains, target identity is uncertain, SQL was edited or batched, PF-001 was executed more than once under Audit 04J, Supabase reports an error or timeout, output shape or values differ, or unexpected/sensitive data appears.

A04-PF-002 is not displayed or released here. It may be released only after complete PF-001 evidence receives an unambiguous PASS. Every application query remains unauthorized regardless of preflight outcome.

PREFLIGHT_REAUTHORIZATION: AUTHORIZED
A04-PF-001_RERUN: AUTHORIZED_ONCE
A04-PF-002_THROUGH_PF-006: CONDITIONAL_ON_PRIOR_PASS
APPLICATION_SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED
PREFLIGHT_PROGRESS: A04-PF-001_REAUTHORIZED_AWAITING_OPERATOR_RESULT
