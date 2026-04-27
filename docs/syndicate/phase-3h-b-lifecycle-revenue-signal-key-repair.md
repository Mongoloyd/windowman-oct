# Phase 3H-B — Lifecycle Revenue Signal Key Repair

## 1. Goal

Repair Phase 3H idempotency so sold revenue truth is protected at the business-opportunity lifecycle level, not merely at the individual `contractor_outcomes.id` row level.

## 2. North Star

One clean active sold signal is allowed for one real business opportunity per client. Retries, duplicate outcome rows, or competing claims must not inflate downstream revenue truth.

## 3. What Was Wrong With Outcome-Level Keys

Phase 3H generated `revenue_signal_key` from:

- `client_slug`
- `contractor_outcome_id`
- `disposition_state`

That protected duplicate event logs for the same outcome row. It did not prevent two separate sold outcome rows for the same assignment/opportunity from producing two distinct revenue signal keys.

## 4. Lifecycle Key Contract

Phase 3H-B adds `public.revenue_lifecycle_signal_key(...)`.

Output format:

`revenue-signal-key-v2:{client_slug}:{basis}:{id}:{disposition_state}`

Normalization:

- `client_slug` is trimmed and lowercased.
- `disposition_state` is trimmed and lowercased.
- The key contains only platform IDs already present in the internal revenue lifecycle; it does not include PII, tokens, endpoints, click IDs, or vault secret IDs.
- The function returns `NULL` when tenant, disposition, or usable lifecycle identity is missing.

## 5. Business Opportunity Fallback Order

The key chooses the first available identity in this order:

1. `lead_assignment_id`
2. `opportunity_id`
3. `lead_id`
4. `scan_session_id`
5. `analysis_id`
6. `contractor_outcome_id`

`contractor_outcome_id` is explicitly last resort only.

## 6. Weak Key Policy

A key using `contractor_outcome_id` is classified as `weak_lifecycle_key`.

Current policy:

- Weak keys are exposed for audit visibility.
- Weak keys are blocked from sync.
- Weak keys are not treated as strong lifecycle duplicate protection.

## 7. Duplicate Sold Outcome Audit

Preflight audit before uniqueness:

- Sold outcomes grouped by `client_slug + lead_assignment_id`: **0 duplicate groups**
- Sold outcomes grouped by `client_slug + opportunity_id`: **0 duplicate groups**
- Sold outcomes grouped by `client_slug + lead_id`: **0 duplicate groups**
- Sold outcomes grouped by `client_slug + scan_session_id`: **0 duplicate groups**
- Sold outcomes grouped by `client_slug + analysis_id`: **0 duplicate groups**

Existing sold event audit:

- Sold event rows: **0**
- Missing `contractor_outcome_id`: **0**
- Missing `revenue_signal_key`: **0**
- Missing `client_slug`: **0**
- Missing `disposition_state`: **0**
- Duplicate groups by revenue key/outcome/lifecycle identity: **0**

No data was deleted, merged, rewritten, or winner-selected.

## 8. Eligibility RPC Changes

`public.admin_revenue_signal_eligibility()` now returns lifecycle details:

- `revenue_signal_key`
- `revenue_signal_key_version`
- `revenue_signal_key_basis`
- `revenue_signal_key_reasons`
- `lifecycle_duplicate_detected`
- `lifecycle_duplicate_count`
- `weak_lifecycle_key`
- `duplicate_revenue_signal_key`

Eligibility is blocked when:

- no lifecycle key can be derived
- duplicate active sold lifecycle claim exists
- a sold signal already exists for the lifecycle key
- the key is weak/outcome-only
- outcome integrity is invalid, blocked, manual-review, or needs-review
- value is missing/invalid
- value basis is missing/unknown
- client slug is missing
- disputed/manual-review reason codes are present

## 9. Sync RPC Changes

`public.admin_sync_revenue_signals(integer, boolean)` now:

- computes the lifecycle key server-side through the eligibility RPC
- never accepts a frontend-supplied key
- rechecks event-log duplicate lifecycle key before insert
- writes lifecycle key metadata into `event_logs.metadata`
- preserves response counts: `inserted`, `duplicate_protected`, `blocked`, `dry_run`, `external_dispatch`, `dispatch_created`
- blocks weak lifecycle keys and duplicate lifecycle claims

## 10. DB Uniqueness Enforcement

Added safe physical protections:

- `event_logs_revenue_lifecycle_signal_key_unique` for active, internal, non-dispatched lifecycle sold signals with `revenue_signal_key_version = 'v2_lifecycle'`.
- `contractor_outcomes_active_sold_assignment_unique` for clean active sold rows keyed by `client_slug + lead_assignment_id`.
- `contractor_outcomes_active_sold_opportunity_unique` for clean active sold rows keyed by `client_slug + opportunity_id` only when no assignment id exists.

The contractor outcome indexes are intentionally narrow and exclude non-clean/manual-review/disputed/invalid rows so corrections, reversals, lost outcomes, and non-terminal records are not broadly blocked.

## 11. Backward Compatibility

The old Phase 3H functions remain in place:

- `public.revenue_signal_key(text, uuid, text)`
- `public.revenue_signal_key_from_metadata(jsonb)`

Existing event metadata remains readable. New lifecycle metadata is additive and uses `revenue_signal_key_version = 'v2_lifecycle'`.

## 12. No External Dispatch Proof

This phase does not create dispatch attempts, mark outbox rows sent, or call provider endpoints.

Sync output remains:

- `external_dispatch: false`
- `dispatch_created: false`

Event metadata written by sync also sets:

- `external_dispatch = false`
- `dispatch_created = false`

No Meta, Google, TikTok, GTM Server, CRM webhook, or provider sender code was added.

## 13. Remaining Context Debt

- Existing Phase 3H generated column `contractor_outcomes.revenue_signal_key` remains outcome-id based for backward compatibility.
- The stronger lifecycle key is enforced through new functions, RPC logic, and narrow indexes rather than destructively rewriting historical/generated key values.
- Phase 3I should add operator-facing dry-run observability with run IDs and per-client breakdowns; it should not alter the lifecycle key contract.

## 14. Handoff To 3I Dry-Run Audit Report

Phase 3I may proceed after validation. It should consume the new lifecycle eligibility fields and report:

- blocked duplicate lifecycle claims
- weak fallback keys
- duplicate existing sold signals
- client/platform readiness blockers
- dry-run counts by client and reason code
