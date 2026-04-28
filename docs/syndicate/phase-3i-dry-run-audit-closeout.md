# Phase 3I-D — Dry-Run Audit Closeout

## 1. Goal

Validate and close Phase 3I by proving the revenue signal dry-run audit path is safe, non-dispatching, privacy-preserving, and operator-ready for the next internal phase.

## 2. North Star

The system must answer two operator-control questions with evidence:

- If this dry-run says nothing was sent, can we prove nothing was sent?
- If this dry-run says candidates are blocked or duplicate-protected, can we prove the reason is correct?

## 3. What Was Validated

- Git state and previous sprint diff were reconciled from commit `51b858ad Added Revenue Dry-Run Audit`.
- The 3I-C Admin Dry-Run Command Center UI was inspected for service usage, mounted tab behavior, safe states, and privacy boundaries.
- Connected Supabase object/function presence was verified with read-only catalog queries.
- A protected dry-run was executed through the `admin-sync-revenue-signals` Edge Function using the sandbox dev-admin bypass path.
- Before/after no-write counters were compared for sold event logs, dry-run audits, dispatch outbox, and dispatch attempts.
- The dry-run/audit files were scanned for provider endpoints, raw provider URLs, direct provider sends, live sync controls, fake UI, TODO placeholders, and raw JSON primary rendering.

## 4. 3I-A/B/C Artifact Verification

| Artifact | Result | Evidence |
| --- | --- | --- |
| `public.revenue_signal_dry_run_audits` | Pass | `to_regclass` returned `revenue_signal_dry_run_audits`. |
| `public.admin_sync_revenue_signals(integer, boolean)` | Pass | `to_regprocedure` returned `admin_sync_revenue_signals(integer,boolean)`. |
| `public.admin_revenue_signal_eligibility()` | Pass | `to_regprocedure` returned `admin_revenue_signal_eligibility()`. |
| `public.revenue_lifecycle_signal_key(...)` | Pass with signature note | Connected DB exposes `revenue_lifecycle_signal_key(text, uuid, uuid, uuid, uuid, uuid, uuid, text)`. The prompt’s placeholder `...` maps to this concrete signature. |
| `public.revenue_lifecycle_signal_key_from_metadata(jsonb)` | Pass | `to_regprocedure` returned `revenue_lifecycle_signal_key_from_metadata(jsonb)`. |
| Supabase generated types | Pass | `src/integrations/supabase/types.ts` includes `revenue_signal_dry_run_audits` and `admin_sync_revenue_signals`. |
| 3I-C UI component | Pass | `src/components/admin/RevenueSignalDryRunAudit.tsx` exists. |
| Admin tab mount | Pass | `AdminPrimaryTabs` includes `Dry-Run Audit`; `AdminDashboard` mounts `RevenueSignalDryRunAudit` under `revenue-dry-run`. |
| UI service usage | Pass | UI calls only `runRevenueSignalDryRun({ limit })`; direct Edge invocation is isolated inside `src/services/revenueSignalDryRunAudit.ts`. |
| Live sync controls | Pass | No live sync button, disabled live sync teaser, or `dry_run: false` UI path exists. |

## 5. Dry-Run No-Write Proof

Before protected dry-run:

| Counter | Before |
| --- | ---: |
| `event_logs` sold/purchase-derived rows | 0 |
| `revenue_signal_dry_run_audits` rows | 0 |
| `platform_dispatch_outbox` rows | 0 |
| `platform_dispatch_attempts` rows | 0 |

Dry-run request:

```json
{"dry_run": true, "limit": 100}
```

Dry-run response:

```json
{
  "ok": true,
  "dry_run": true,
  "run_id": "4732f40a-602c-4106-888a-02e4d97c39a1",
  "candidate_count": 0,
  "would_insert": 0,
  "inserted": 0,
  "blocked": 0,
  "duplicate_protected": 0,
  "weak_lifecycle_key": 0,
  "lifecycle_duplicate_claim": 0,
  "duplicate_revenue_signal_key": 0,
  "external_dispatch": false,
  "dispatch_created": false
}
```

After protected dry-run:

| Counter | After | Result |
| --- | ---: | --- |
| `event_logs` sold/purchase-derived rows | 0 | Pass — no sold event row inserted. |
| `revenue_signal_dry_run_audits` rows | 1 | Pass — dry-run audit row persisted as expected. |
| `platform_dispatch_outbox` rows | 0 | Pass — no outbox row created. |
| `platform_dispatch_attempts` rows | 0 | Pass — no attempt row created. |

The latest persisted audit row has `dry_run = true`, `inserted = 0`, `external_dispatch = false`, and `dispatch_created = false`.

## 6. Dispatch / Outbox No-Write Proof

Connected dispatch tables present:

- `public.platform_dispatch_outbox`
- `public.platform_dispatch_attempts`

Connected dispatch/dead-letter tables absent:

- `public.dispatch_attempts`
- `public.dispatch_dead_letters`
- `public.wm_platform_dispatch_log`
- `public.wm_event_log`

For present tables, before and after counts stayed at `0`. No dispatch outbox or attempt mutation occurred during the dry-run.

## 7. Forbidden Endpoint Scan

Scanned files/directories:

- `src/services/revenueSignalDryRunAudit.ts`
- `src/components/admin/RevenueSignalDryRunAudit.tsx`
- `src/components/admin/revenue-dry-run/*`
- `src/services/revenueSignalIntegration.ts`
- `src/services/revenueDispatchReadiness.ts`
- `supabase/functions/admin-sync-revenue-signals/index.ts`
- `docs/syndicate/phase-3i-*`

Search terms included provider endpoints and send primitives: `graph.facebook.com`, `business-api.tiktok.com`, `googleads.googleapis.com`, `google-analytics.com/mp/collect`, `collect?v=2`, `gtm`, `webhook`, raw `fetch(`, raw provider endpoint URLs, and sensitive click/token terms.

Result:

- Pass for provider endpoint calls: no Meta, Google, TikTok, GTM Server, CRM webhook, or provider endpoint call exists in the dry-run/audit path.
- Allowed documentation-only mention: Phase 3I-B docs state that CRM webhooks are not called.
- Reviewed non-provider `fetch(`: `src/services/revenueSignalIntegration.ts` contains a dev-bypass Edge Function fetch to `admin-sync-revenue-signals`, still forcing `dry_run: true` and rejecting `dryRun !== true`. This is outside the 3I-C UI path and is not a provider endpoint call.
- Reviewed attribution readiness fields: `src/services/revenueDispatchReadiness.ts` contains boolean click-id presence fields only; it does not expose raw click IDs.

## 8. Duplicate Lifecycle Scenario

Status: statically validated; live adversarial rows unavailable in the connected dataset.

Evidence:

- `admin_revenue_signal_eligibility()` defines duplicate lifecycle detection by grouping non-fallback lifecycle keys and setting `lifecycle_duplicate_detected` when duplicate count is greater than 1.
- `admin_sync_revenue_signals(..., true)` classifies `lifecycle_duplicate_detected = true` as blocked.
- `by_reason_code` includes `duplicate_sold_lifecycle_claim` when duplicate lifecycle claims are present.
- No destructive or permanent duplicate production rows were created for this validation.

Context Debt:

- A seeded, isolated duplicate lifecycle fixture should be added in a future non-production harness or transactional test environment.

## 9. Weak Lifecycle Key Scenario

Status: statically validated; live adversarial rows unavailable in the connected dataset.

Evidence:

- `admin_revenue_signal_eligibility()` sets `weak_lifecycle_key = true` when lifecycle key basis is `contractor_outcome_id`.
- `admin_sync_revenue_signals(..., true)` excludes weak lifecycle keys from `would_insert`, includes them in `blocked`, increments `weak_lifecycle_key`, and includes `weak_lifecycle_key` in reason rollups.
- The UI marks `contractor_outcome_id` and `missing_key_basis` as `blocked_weak` in the Lifecycle Key-Basis Breakdown.

Context Debt:

- A seeded, isolated weak-key fixture should be added in a future non-production harness or transactional test environment.

## 10. Missing Value Scenario

Status: statically validated; live adversarial rows unavailable in the connected dataset.

Evidence:

- `admin_revenue_signal_eligibility()` emits `sold_missing_or_invalid_value` when `final_value_cents` is null or less than/equal to zero.
- The dry-run UI classifies `sold_missing_or_invalid_value` as critical and gives a safe operator remediation message.
- No live dispatch or sold event insert occurred during dry-run.

Context Debt:

- A seeded, isolated missing-value fixture should be added in a future non-production harness or transactional test environment.

## 11. Missing Client Slug Scenario

Status: statically validated; live adversarial rows unavailable in the connected dataset.

Evidence:

- `admin_sync_revenue_signals(..., true)` rolls null/blank client slugs into `missing_client_slug` for `by_client_slug`.
- `admin_revenue_signal_eligibility()` emits `missing_client_slug` as a reason code when client slug is null or blank.
- The dry-run UI classifies `missing_client_slug` as critical and does not expose homeowner PII.

Context Debt:

- A seeded, isolated missing-client fixture should be added in a future non-production harness or transactional test environment.

## 12. Duplicate Revenue Signal Key Scenario

Status: statically validated; live adversarial rows unavailable in the connected dataset.

Evidence:

- `admin_revenue_signal_eligibility()` returns `duplicate_revenue_signal_key` and `duplicate_protected` fields.
- `admin_sync_revenue_signals(..., true)` excludes duplicate revenue signal keys from `would_insert`, increments `duplicate_revenue_signal_key`, and includes them in duplicate protection counts.
- The Edge Function and service require `external_dispatch: false` and `dispatch_created: false` before returning a normalized report.

Context Debt:

- A seeded, isolated duplicate-key fixture should be added in a future non-production harness or transactional test environment.

## 13. UI Safety Review

Pass.

Verified UI properties:

- `Dry-Run Audit` tab exists.
- `RevenueSignalDryRunAudit` is mounted in the Admin dashboard.
- The component calls only `runRevenueSignalDryRun({ limit })`.
- No direct RPC call exists in UI components.
- No direct Edge Function call exists in UI components.
- No live sync control exists.
- No raw JSON dump is rendered as the primary UI.
- Empty, error, warning, and critical states are implemented.
- No fake report rows or placeholder TODO logic were found.
- Sample candidates render only service-normalized masked IDs.
- Error messages use `formatDryRunError(error)` instead of raw response JSON.

## 14. Privacy / Redaction Review

Pass.

- The dry-run report contains counts, rollups, run metadata, and masked sample IDs only.
- The UI does not render homeowner names, emails, phones, quote URLs, Vault IDs, raw click IDs, token secret IDs, endpoint URLs, or provider payloads.
- `revenueDispatchReadiness` contains boolean click-id presence fields, not raw click IDs.
- The service masks candidate IDs longer than 12 characters before UI consumption.

## 15. No External Dispatch Proof

Pass.

Proof layers:

- Database contract returns `external_dispatch: false` and `dispatch_created: false`.
- Edge Function rejects any response where those flags are not false.
- Frontend service rejects malformed or unsafe responses and exposes only `externalDispatch: false` and `dispatchCreated: false` in its typed report.
- Protected smoke test returned both flags false.
- Dispatch/outbox counters did not increase.
- Forbidden endpoint scan found no provider endpoint calls in the dry-run/audit path.
- A protected `dry_run: false` request was rejected with `live_sync_not_available_from_dry_run_service`.

## 16. Validation Commands

Executed:

```bash
git log -n 1 --oneline
git diff HEAD~1 --name-only
git diff HEAD~1
git status --short --untracked-files=all
rg -n "Dry-Run Audit|RevenueSignalDryRunAudit|runRevenueSignalDryRun|supabase\.rpc|functions\.invoke|fetch\(|TODO|any|JSON\.stringify|live sync|Live Sync|dispatch|externalDispatch|dispatchCreated" ...
rg -n "graph\.facebook\.com|business-api\.tiktok\.com|googleads\.googleapis\.com|google-analytics\.com/mp/collect|collect\?v=2|gtm|webhook|fetch\(|https?://|SUPABASE_SERVICE_ROLE_KEY|token_secret|vault|fbclid|gclid|ttclid|JSON\.stringify" ...
bun run build                                # pass
npx tsc --noEmit                             # pass
deno check supabase/functions/admin-sync-revenue-signals/index.ts # pass
deno fmt --check supabase/functions/admin-sync-revenue-signals/index.ts # pass
deno lint supabase/functions/admin-sync-revenue-signals/index.ts # pass after zod import-map repair
```

Database/catalog checks executed through Supabase read-only tools:

```sql
select to_regclass(...), to_regprocedure(...);
select count(*) counters before and after dry-run;
select latest row from public.revenue_signal_dry_run_audits;
select pg_get_functiondef(...) for core 3I functions;
```

Protected Edge Function checks executed:

```bash
curl -X POST /functions/v1/admin-sync-revenue-signals --data '{"dry_run":true,"limit":100}'
curl -X POST /functions/v1/admin-sync-revenue-signals --data '{"dry_run":false,"limit":1}'
```

## 17. Pass / Fail Matrix

| Check | Result | Notes |
| --- | --- | --- |
| 3I-C UI integrity | Pass | Tab, mount, service-only UI call verified. |
| DB/RPC object presence | Pass | Required table and functions exist; concrete lifecycle key signature differs from prompt placeholder but is present. |
| Types in sync | Pass | Types include audit table and RPC. No 3I-D migration added, so no regeneration required. |
| Dry-run no-write proof | Pass | Sold event count stayed `0`; audit count increased by `1`. |
| Dispatch/outbox no-write proof | Pass | Present dispatch tables stayed at `0`; absent tables documented. |
| Forbidden endpoint scan | Pass | No provider endpoint calls in 3I dry-run/audit path. |
| Duplicate lifecycle behavior | Simulated/static pass | Logic blocks duplicate lifecycle claims; live fixture not present. |
| Weak lifecycle behavior | Simulated/static pass | Logic blocks fallback outcome keys; live fixture not present. |
| Missing value behavior | Simulated/static pass | Logic emits missing/invalid value reason; live fixture not present. |
| Missing client slug behavior | Simulated/static pass | Logic groups under `missing_client_slug`; live fixture not present. |
| Duplicate revenue signal behavior | Simulated/static pass | Logic duplicate-protects existing keys; live fixture not present. |
| UI safety review | Pass | No raw JSON primary UI, fake states, TODOs, or live controls. |
| Privacy/redaction | Pass | No PII/token/Vault/click-ID exposure found. |
| Live sync rejection | Pass | `dry_run:false` rejected by Edge Function. |
| Build/typecheck/Deno | Pass | Build, TypeScript, Deno check, Deno fmt, and Deno lint passed. |

## 18. Phase 4 Readiness Verdict

`phase_4_allowed_for_internal_pilot_only`

Reason:

- Phase 3I dry-run audit path is safe under available no-write, endpoint, UI, and static adversarial validation.
- Full contractor-access RLS smoke tests and seeded adversarial fixtures remain deferred, so this is not a broad production-contractor readiness claim.

## 19. Remaining Risks

- Seeded duplicate lifecycle, weak lifecycle key, missing value, missing client slug, and duplicate revenue signal key fixtures were not created against production data. This validation used static logic review plus an empty-candidate protected smoke test.
- Full contractor-access RLS smoke tests remain deferred to 3J/4A.
- Live dispatch remains disabled.
- Contractor portal exposure remains not approved by this closeout.
- Provider attribution acceptance is not validated by this closeout.
- The connected dataset currently returned zero dry-run candidates, so rollup arithmetic was not live-tested against a non-empty candidate set.

## 20. Handoff To 3J / 4A

3J or 4A may proceed only as an internal pilot planning/build phase. Before production contractor exposure or live materialization, add a non-production adversarial fixture harness that proves duplicate lifecycle, weak key, missing client slug, missing/invalid value, duplicate revenue signal key, and rollup arithmetic against known seeded rows.
