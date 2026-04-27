# Sprint 1Q Runtime Validation Report

## Goal

Sprint 1Q validates WindowMan's dispatch control plane before any live platform sender exists. The goal is to prove, with source inspection, read-only database evidence, safe runtime probes, and documented manual guard checks, that preview, materialization, duplicate protection, warning gating, mapper continuity, PII redaction, and no-send guarantees are observable and safe.

## North Star

WindowMan can inspect and materialize dry-run dispatch intent while live dispatch remains impossible by database design.

## Definition of Success

- Required dispatch-control-plane source files and database objects exist.
- Preview selected and preview filtered paths are proven no-write by code path, and runtime count checks are documented.
- Materialization requires exact typed confirmation: `MATERIALIZE_DRY_RUN_ONLY`.
- Server-side candidate recomputation is used; frontend candidate bodies are not trusted.
- Eligible candidates can become dry-run-only outbox rows when explicitly materialized.
- Warning candidates require `include_warnings = true`.
- Blocked and duplicate candidates are skipped rather than inserted.
- Inserted rows are non-sendable and preserve decision/fingerprint evidence.
- `platform_dispatch_attempts` remains untouched by materialization.
- DB guard checks are documented with rollback-only SQL.
- Meta/TikTok dry-run payloads remain redaction-safe and mapped to `Purchase`.
- No external Meta, TikTok, Google, GTM, or webhook API calls are added or executed.

## Prerequisite Audit

| item | expected location/object | found/not found | notes |
|---|---|---:|---|
| Dry-Run Queue component | `src/components/admin/DispatchDryRunQueue.tsx` | Found | Displays simulator, mapper summaries, and no-external-API banner. |
| dispatch simulator service | `src/services/dispatchSimulator.ts` | Found | Contains dry-run mappers and payload builders. |
| Dispatch Outbox admin component | `src/components/admin/DispatchOutboxControl.tsx` | Found | Contains filters, selected/filtered preview, materialization controls, drawers, and safety copy. |
| dispatch outbox service | `src/services/dispatchOutbox.ts` | Found | Fetches candidates/outbox rows and invokes `admin-materialize-dispatch-outbox`. |
| materialization Edge Function | `supabase/functions/admin-materialize-dispatch-outbox/index.ts` | Found | Validates request, requires admin/operator auth, recomputes candidates, writes only outbox rows in materialize modes. |
| outbox table | `public.platform_dispatch_outbox` | Found | Read-only validation returned `to_regclass = platform_dispatch_outbox`. |
| attempts table | `public.platform_dispatch_attempts` | Found | Read-only validation returned `to_regclass = platform_dispatch_attempts`. |
| candidates RPC | `public.admin_dispatch_outbox_candidates()` | Found | Function exists; direct read-query execution was denied for current tool role. |
| idempotency helper | `public.compute_platform_dispatch_idempotency_key(...)` | Found | Function exists; migration defines `wm_dispatch:v1:` key formula. |
| outbox safety trigger | `trg_platform_dispatch_outbox_no_live_guard` | Found | Read-only trigger existence check returned true. |
| attempts safety trigger | `trg_platform_dispatch_attempts_no_live_guard` | Found | Read-only trigger existence check returned true. |
| TikTok mapper version | `TIKTOK_DRY_RUN_MAPPER_VERSION` | Found | `tiktok-dry-run-v1`. |
| Meta mapper version | `META_CAPI_DRY_RUN_MAPPER_VERSION` | Found | `meta-capi-dry-run-v1` in simulator. |

## Execution Classification

- **Class A — safe now:** file inspection, code-path inspection, local build/typecheck, report generation, read-only table/function/trigger/count checks, unauthenticated fail-closed Edge Function probe.
- **Class B — approval required:** authenticated preview/materialization calls, durable dry-run outbox row creation, duplicate materialization tests. These can persist rows in `platform_dispatch_outbox` and should use the smallest possible candidate set.
- **Class C — approval required + rollback only:** DB guard mutation probes that attempt forbidden `UPDATE`/`INSERT` statements. These must run inside `BEGIN; ... ROLLBACK;` and must not write permanent rows.

## Runtime Path

1. Internal operator opens `DispatchOutboxControl`.
2. The UI calls `fetchDispatchOutboxControl()` in `src/services/dispatchOutbox.ts`.
3. The service reads `admin_dispatch_outbox_candidates()` and current `platform_dispatch_outbox` rows.
4. For preview/materialization actions, the UI calls `runDispatchOutboxMaterialization()`.
5. The service invokes Supabase Edge Function `admin-materialize-dispatch-outbox` with an authenticated session token or development secret.
6. The Edge Function validates method, auth role, body schema, selected-mode candidate IDs, and materialization confirmation.
7. The Edge Function recomputes candidates server-side from `admin_dispatch_outbox_candidates()`; it does not trust frontend candidate bodies.
8. Preview modes classify and return candidates before the insert branch.
9. Materialize modes insert only into `platform_dispatch_outbox` with `dry_run_only = true`, `send_enabled = false`, no worker locks, no sent fields, and `lifecycle_status = materialized_not_sendable`.
10. Database guards `platform_dispatch_outbox_no_live_guard()` and `platform_dispatch_attempts_no_live_guard()` plus check constraints prevent live-send states.
11. The UI refreshes outbox rows and shows result summary evidence.

## Validation Matrix

| scenario | method | result | evidence | fix applied |
|---|---|---:|---|---|
| preview selected no-write | code-path inspection + unauthenticated runtime count probe | Partially pass | Preview branch returns before insert when `!isMaterializeMode`; unauthenticated API probe left counts at outbox `0`, attempts `0`. Authenticated candidate preview not runnable in current tool role. | None |
| preview filtered no-write | code-path inspection | Partially pass | Same preview branch covers `preview_filtered`; no insert is reachable before materialize mode. Authenticated runtime candidate preview not runnable. | None |
| materialize selected requires confirmation | schema/code inspection | Pass | Edge Function rejects materialize modes unless `confirmation === "MATERIALIZE_DRY_RUN_ONLY"`. | None |
| materialize filtered requires confirmation | schema/code inspection | Pass | Same confirmation guard covers `materialize_filtered`. | None |
| eligible candidate insert | code-path inspection | Not runnable | Insert branch creates dry-run payload for classified eligible candidates. No authenticated candidate ID available in current environment. | None |
| warning candidate requires include_warnings | code-path inspection | Pass | `classifyCandidate` returns invalid with `warning_requires_explicit_include_warnings` unless `includeWarnings` is true. | None |
| blocked candidate skipped | code-path inspection | Pass | `blocked` classification increments `skipped_blocked` and continues before insert. | None |
| duplicate candidate duplicate-protected | code-path inspection | Pass | Existing outbox or `duplicate_protected` status skips; unique conflict `23505` returns `duplicate_protected`. Runtime duplicate test not runnable without durable insert. | None |
| inserted row dry-run-only | code-path + DB constraints | Pass by design | Insert payload sets `dry_run_only: true`, `send_enabled: false`; DB check constraints enforce both. No inserted rows currently exist. | None |
| attempts table untouched | code-path + read-only count | Pass for current run | Edge Function has no `platform_dispatch_attempts` insert path; current attempts count is `0`; unauthenticated API probe kept attempts count `0`. | None |
| outbox guard rejects live state | constraint/trigger inspection | Not runnable | Trigger and constraints exist. Rollback mutation probes require direct DB transaction access not available here. | None |
| attempt guard rejects live state | constraint/trigger inspection | Not runnable | Trigger and constraints exist. Rollback mutation probes require direct DB transaction access not available here. | None |
| Meta dry-run payload intact | source inspection | Pass | Simulator builds `event_name: "Purchase"`, `dry_run: true`, `mapper_version: meta-capi-dry-run-v1`, presence booleans, masked IDs. | None |
| TikTok dry-run payload intact | source inspection | Pass | Simulator builds `event: "Purchase"`, `dry_run: true`, `mapper_version: tiktok-dry-run-v1`, presence booleans, masked IDs. | None |
| no raw PII/secrets | source/UI inspection | Pass by inspected surfaces | UI/result payloads show token presence, destination presence, masked IDs, and no raw emails/phones/tokens/click IDs in mapper snapshots. Runtime live-row inspection not available. | None |
| no external APIs | source/log inspection | Pass | Materialization function only calls Supabase RPC/table APIs; simulator builds local payloads only; Edge logs show auth diagnostics only. | None |

## Runtime Evidence Captured

Read-only prerequisite query result:

```text
outbox_table: platform_dispatch_outbox
attempts_table: platform_dispatch_attempts
candidates_rpc_exists: true
idempotency_helper_exists: true
outbox_guard_trigger_exists: true
attempts_guard_trigger_exists: true
outbox_count: 0
attempts_count: 0
```

Read-only unsafe row scan:

```text
unsafe_outbox_rows: 0
```

Unauthenticated Edge Function probe:

```json
{
  "ok": false,
  "code": "unauthorized",
  "error": "Missing or invalid Authorization header"
}
```

Count check after unauthenticated probe:

```text
outbox_count_after_unauth_api: 0
attempts_count_after_unauth_api: 0
```

Not runnable in this environment:

- Direct `admin_dispatch_outbox_candidates()` query via the Supabase read-query tool failed with `permission denied for function admin_dispatch_outbox_candidates`.
- Direct `PGHOST` access is unavailable in the sandbox, so rollback-only mutation probes could not be executed here.
- Authenticated operator preview/materialization requires an internal operator session or approved dev-secret workflow.

## Manual SQL Checks

**Do not run on production without approval.** Each mutation probe must remain wrapped in `BEGIN; ... ROLLBACK;`.

### Baseline counts

```sql
SELECT
  (SELECT count(*) FROM public.platform_dispatch_outbox) AS outbox_count,
  (SELECT count(*) FROM public.platform_dispatch_attempts) AS attempts_count;
```

### Inserted row safety

```sql
SELECT
  count(*) AS unsafe_outbox_rows
FROM public.platform_dispatch_outbox
WHERE dry_run_only IS DISTINCT FROM true
   OR send_enabled IS DISTINCT FROM false
   OR lifecycle_status <> 'materialized_not_sendable'
   OR sent_at IS NOT NULL
   OR external_event_id IS NOT NULL
   OR locked_at IS NOT NULL
   OR locked_by IS NOT NULL
   OR next_attempt_at IS NOT NULL
   OR attempt_count <> 0
   OR decision_snapshot = '{}'::jsonb
   OR candidate_fingerprint IS NULL
   OR candidate_fingerprint = ''
   OR redacted_payload_snapshot = '{}'::jsonb;
```

### Outbox guard: `send_enabled = true`

```sql
BEGIN;

UPDATE public.platform_dispatch_outbox
SET send_enabled = true
WHERE id = (
  SELECT id FROM public.platform_dispatch_outbox ORDER BY created_at DESC LIMIT 1
);

ROLLBACK;
```

### Outbox guard: `dry_run_only = false`

```sql
BEGIN;

UPDATE public.platform_dispatch_outbox
SET dry_run_only = false
WHERE id = (
  SELECT id FROM public.platform_dispatch_outbox ORDER BY created_at DESC LIMIT 1
);

ROLLBACK;
```

### Outbox guard: `sent_at = now()`

```sql
BEGIN;

UPDATE public.platform_dispatch_outbox
SET sent_at = now()
WHERE id = (
  SELECT id FROM public.platform_dispatch_outbox ORDER BY created_at DESC LIMIT 1
);

ROLLBACK;
```

### Outbox guard: `external_event_id = 'test'`

```sql
BEGIN;

UPDATE public.platform_dispatch_outbox
SET external_event_id = 'test'
WHERE id = (
  SELECT id FROM public.platform_dispatch_outbox ORDER BY created_at DESC LIMIT 1
);

ROLLBACK;
```

### Outbox guard: worker lock fields

```sql
BEGIN;

UPDATE public.platform_dispatch_outbox
SET
  locked_at = now(),
  locked_by = 'test-worker',
  next_attempt_at = now()
WHERE id = (
  SELECT id FROM public.platform_dispatch_outbox ORDER BY created_at DESC LIMIT 1
);

ROLLBACK;
```

### Attempt guard: `dry_run = false`

```sql
BEGIN;

INSERT INTO public.platform_dispatch_attempts (
  outbox_id,
  attempt_number,
  dry_run,
  status,
  redacted_request_snapshot
)
VALUES (
  (SELECT id FROM public.platform_dispatch_outbox ORDER BY created_at DESC LIMIT 1),
  1,
  false,
  'not_sent',
  '{}'::jsonb
);

ROLLBACK;
```

### Attempt guard: live-ish status

```sql
BEGIN;

INSERT INTO public.platform_dispatch_attempts (
  outbox_id,
  attempt_number,
  dry_run,
  status,
  redacted_request_snapshot
)
VALUES (
  (SELECT id FROM public.platform_dispatch_outbox ORDER BY created_at DESC LIMIT 1),
  1,
  true,
  'sent',
  '{}'::jsonb
);

ROLLBACK;
```

### Attempt guard: external response fields

```sql
BEGIN;

INSERT INTO public.platform_dispatch_attempts (
  outbox_id,
  attempt_number,
  dry_run,
  status,
  response_status_code,
  response_excerpt,
  redacted_request_snapshot
)
VALUES (
  (SELECT id FROM public.platform_dispatch_outbox ORDER BY created_at DESC LIMIT 1),
  1,
  true,
  'simulated',
  200,
  'OK',
  '{}'::jsonb
);

ROLLBACK;
```

### If no outbox row exists

Create a synthetic row only inside a rollback transaction, using a real candidate, then run the forbidden update probes before `ROLLBACK`. Do not use `event_logs`, `leads`, or `contractor_outcomes` mutations to create test candidates.

## API Request Payloads

Examples only. Use the smallest possible candidate set.

### `preview_selected`

```json
{
  "mode": "preview_selected",
  "candidate_ids": ["REPLACE_WITH_CANDIDATE_ID"],
  "filters": {},
  "include_warnings": false
}
```

### `preview_filtered`

```json
{
  "mode": "preview_filtered",
  "candidate_ids": [],
  "filters": {
    "platform_name": "meta",
    "eligibility_status": "eligible_not_sent"
  },
  "include_warnings": false
}
```

### `materialize_selected`

```json
{
  "mode": "materialize_selected",
  "candidate_ids": ["REPLACE_WITH_ELIGIBLE_CANDIDATE_ID"],
  "filters": {},
  "include_warnings": false,
  "confirmation": "MATERIALIZE_DRY_RUN_ONLY"
}
```

### `materialize_filtered`

```json
{
  "mode": "materialize_filtered",
  "candidate_ids": [],
  "filters": {
    "client_slug": "REPLACE_WITH_CLIENT_SLUG",
    "platform_name": "tiktok",
    "eligibility_status": "eligible_not_sent"
  },
  "include_warnings": false,
  "confirmation": "MATERIALIZE_DRY_RUN_ONLY"
}
```

### invalid selected mode with no candidate IDs

```json
{
  "mode": "preview_selected",
  "candidate_ids": [],
  "filters": {},
  "include_warnings": false
}
```

Expected: `candidate_ids_required`.

### invalid materialization without confirmation

```json
{
  "mode": "materialize_selected",
  "candidate_ids": ["REPLACE_WITH_CANDIDATE_ID"],
  "filters": {},
  "include_warnings": false
}
```

Expected: `confirmation_required`.

### warning candidate without `include_warnings`

```json
{
  "mode": "preview_selected",
  "candidate_ids": ["REPLACE_WITH_WARNING_CANDIDATE_ID"],
  "filters": {},
  "include_warnings": false
}
```

Expected item status: `skipped_invalid` with reason `warning_requires_explicit_include_warnings`.

## UX/CRO Improvements

| improvement | implemented/deferred | reason |
|---|---:|---|
| Preview vs Materialize Safety Split | Implemented | Separates zero-write previews from persistent dry-run outbox writes and labels each action group. |
| No-Live-Dispatch Seal | Implemented | Strengthens operator confidence that live dispatch is disabled and DB guards prevent send-enabled rows. |
| Before/After Count Summary | Implemented | Adds auditable result evidence for outbox/attempt counts plus inserted/duplicate/skipped summary. |

## Meta Mapper Version Mismatch

- The simulator mapper uses `meta-capi-dry-run-v1` and builds Meta CAPI-shaped dry-run `Purchase` payloads.
- The outbox candidate RPC, as defined in the Sprint 1N migration, emits Meta `mapper_version = 'meta-draft-simulation'`.
- This affects materialized outbox row `mapper_version` labels because Sprint 1O materialization copies the candidate row mapper version into the outbox row.
- This sprint documents the mismatch only. It was not fixed because the instruction explicitly deferred RPC/migration mapper-version rewrite to a later prompt.

## Risks / Unknowns

- Authenticated internal-operator preview/materialization could not be executed from the current tool context.
- Durable dry-run materialization, warning materialization, and duplicate materialization were not run because no authenticated candidate execution path was available.
- Rollback-only DB guard mutation probes were not executed because direct transaction-capable DB access is unavailable in the sandbox.
- Live-row PII validation remains limited while there are no outbox rows and candidate RPC execution is denied for the read-query tool role.
- Supabase linter reports many pre-existing project warnings; Sprint 1Q did not broaden scope to remediate unrelated warnings.

## Final Verdict

Sprint 1Q is **partially validated and requires manual DB/runtime validation**. Static/code-path safety, prerequisite object existence, fail-closed unauthorized API behavior, current zero attempts/outbox counts, mapper continuity, and no-external-dispatch source inspection passed. Authenticated preview/materialization, duplicate protection, warning materialization, and rollback-only DB guard probes still require an internal operator session or transaction-capable DB access.

## No External Dispatch Proof

No live dispatch worker was created. No Meta, TikTok, Google, GTM Server, or webhook client was added. The materialization Edge Function only authenticates, recomputes candidates through Supabase, and inserts dry-run outbox rows in materialize modes. The runtime probe returned `401 unauthorized` before candidate processing, and post-probe counts remained `platform_dispatch_outbox = 0` and `platform_dispatch_attempts = 0`.
