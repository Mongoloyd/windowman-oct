# Phase 3I-B — Dry-Run Audit Service + Edge Function Wrapper

## 1. Goal

Create a safe admin-only service path for running revenue signal dry-run audits and consuming the Phase 3I-A database/RPC contract from future UI code.

## 2. North Star

The Admin UI should be able to ask, “What would happen if we ran revenue signal sync?” and receive a typed, normalized answer without exposing provider dispatch, homeowner PII, tokens, Vault IDs, raw click IDs, or frontend-spoofable truth.

## 3. What Was Built

- Repaired the existing `admin-sync-revenue-signals` Edge Function as the canonical dry-run wrapper for app callers.
- Added `src/services/revenueSignalDryRunAudit.ts` with typed report models, normalization, safe errors, reason formatting, basis formatting, and no-dispatch assertions.
- Kept the existing Phase 3I-A RPC and audit table as the database source of truth.
- Did not create UI, provider senders, dispatch attempts, or outbox mutations.

## 4. Edge Function Contract

Endpoint:

`POST /functions/v1/admin-sync-revenue-signals`

Accepted body:

```json
{
  "limit": 100,
  "dry_run": true
}
```

Rules:

- JWT/admin validation is required through the shared admin auth pattern.
- Allowed roles are `super_admin` and `operator`.
- `dry_run` defaults to `true`.
- `dry_run: false` is rejected with `live_sync_not_available_from_dry_run_service`.
- `limit` is bounded from 1 to 500.
- Unknown fields are rejected by the strict request schema.
- The function calls `admin_sync_revenue_signals(p_limit, true)` server-side after authorization.
- Response fields are sanitized before returning to the frontend.

## 5. Frontend Service Contract

Primary call:

```ts
runRevenueSignalDryRun({ limit: 100 })
```

The service:

- Calls the Edge Function, not the RPC directly.
- Always sends `dry_run: true`.
- Bounds limit client-side.
- Normalizes raw snake_case response fields into a camelCase `RevenueSignalDryRunReport`.
- Throws `RevenueSignalDryRunError` on malformed or unsafe responses.
- Does not expose a live sync method.

## 6. Report Field Definitions

- `runId`: Server-generated audit run identifier.
- `operatorId`: Server-derived operator identity when available.
- `startedAt`: Server timestamp for the run.
- `candidateCount`: Number of candidate sold outcomes considered.
- `wouldInsert`: Candidates that would insert in a real internal sync.
- `inserted`: Always expected to be `0` for dry-run calls.
- `blocked`: Candidates blocked by eligibility, weak keys, lifecycle duplicates, or missing keys.
- `duplicateProtected`: Candidates protected by an existing active sold signal or duplicate signal key.
- `weakLifecycleKey`: Candidates using the contractor outcome fallback key.
- `lifecycleDuplicateClaim`: Candidates with duplicate active lifecycle claims.
- `duplicateRevenueSignalKey`: Candidates with an existing matching revenue signal key.
- `byClientSlug`: Per-client operational breakdown.
- `byReasonCode`: Blocker reason count map.
- `byKeyBasis`: Lifecycle key basis breakdown.
- `sampleCandidateIds`: Redacted sample IDs for audit orientation.
- `externalDispatch`: Must be `false`.
- `dispatchCreated`: Must be `false`.

## 7. Reason Code Formatter

The service includes friendly labels for:

- `missing_client_slug`
- `missing_lifecycle_key`
- `weak_lifecycle_key`
- `duplicate_sold_lifecycle_claim`
- `duplicate_active_sold_signal`
- `sold_missing_or_invalid_value`
- `sold_missing_value_basis`
- `outcome_integrity_not_valid`
- `outcome_integrity_blocked`
- `blocked_unknown_reason`

Unknown reason codes render as an unmapped safe fallback without claiming unsupported meaning.

## 8. Basis Formatter

The service formats lifecycle key bases:

- `lead_assignment_id`
- `opportunity_id`
- `lead_id`
- `scan_session_id`
- `analysis_id`
- `contractor_outcome_id`
- `missing_key_basis`

Unknown bases render as an unmapped safe fallback.

## 9. Safety Boundaries

- Frontend callers cannot supply `operator_id`, `run_id`, candidate counts, client slug truth, revenue signal keys, or eligibility state.
- The Edge Function rejects unknown request fields.
- The Edge Function rejects non-dry-run requests from this service path.
- The frontend service fails closed on malformed responses.
- UI work is deferred to Phase 3I-C.

## 10. No External Dispatch Proof

This phase does not add provider APIs or external calls.

It does not:

- send Meta events
- send Google events
- send TikTok events
- call GTM Server
- call CRM webhooks
- create dispatch attempts
- mark outbox rows sent
- mutate outbox delivery status

Both the Edge Function and frontend service require `external_dispatch: false` and `dispatch_created: false`.

## 11. Privacy / Redaction Rules

- Raw RPC JSON is not exposed directly to UI consumers.
- Sample candidate IDs are masked/truncated by the frontend service.
- No raw homeowner PII is added.
- No tokens, endpoint URLs, Vault secret IDs, raw click IDs, or provider payloads are returned by the service contract.

## 12. Known Deferrals

- Admin UI command center
- Adversarial duplicate lifecycle tests
- Forbidden endpoint scan
- Phase 4 contractor portal access

## 13. Handoff To 3I-C Admin UI

Phase 3I-C can consume `runRevenueSignalDryRun({ limit: 100 })` to render a dry-run command center. It should not add live sync controls unless a later sprint explicitly opens that path with separate authorization, UX, and no-dispatch review.
