# Phase 3I-C — Admin Dry-Run Command Center UI

## 1. Goal

Create an internal Admin UI for running and reading revenue signal dry-run audits through the Phase 3I-B service wrapper.

## 2. North Star

Operators should be able to answer: “If I run revenue signal sync, what exactly would happen — and why?” without creating dispatch attempts, sending provider events, exposing PII, or reading raw RPC JSON.

## 3. What Was Built

- Added a `Dry-Run Audit` admin tab mounted as `revenue-dry-run`.
- Added `RevenueSignalDryRunAudit`, which calls only `runRevenueSignalDryRun({ limit })`.
- Added compact admin sections for KPIs, client rollups, reason-code severity, lifecycle key-basis strength, sample masked IDs, and no-dispatch proof.
- Did not add live sync controls, provider calls, dispatch attempts, outbox mutations, scanner changes, OTP changes, report reveal changes, contractor portal changes, or homeowner funnel changes.

## 4. UI Sections

- Safety banner and state banner.
- Limit selector with 50, 100, 250, and 500.
- `Run Dry-Run` command.
- Run metadata: run ID, operator ID if available, and timestamp.
- KPI strip.
- Client breakdown table.
- Reason-code breakdown table.
- Lifecycle key-basis table.
- Sample masked candidate IDs panel.
- No-dispatch proof panel.

## 5. KPI Definitions

- Candidate Count: total evaluated candidates.
- Would Insert: eligible internal sold signal candidates if this were not dry-run.
- Blocked: candidates prevented by eligibility, key, value, or integrity reasons.
- Duplicate Protected: candidates already protected by an existing signal.
- Weak Lifecycle Key: candidates using weak fallback identity.
- Duplicate Lifecycle Claim: competing active sold lifecycle claims.
- Duplicate Revenue Signal Key: existing matching revenue signal key.

## 6. Client Breakdown

The table displays `client_slug`, candidate count, would insert, blocked, duplicate protected, weak lifecycle key, lifecycle duplicate claim, and duplicate revenue signal key. It uses only the normalized dry-run report from the frontend service.

## 7. Reason Code Severity Model

Critical:

- `duplicate_sold_lifecycle_claim`
- `duplicate_active_sold_signal`
- `missing_client_slug`
- `missing_lifecycle_key`
- `sold_missing_or_invalid_value`
- `outcome_integrity_blocked`

Warning:

- `weak_lifecycle_key`
- `sold_missing_value_basis`
- `outcome_integrity_not_valid`

Manual review:

- `blocked_unknown_reason`
- unknown or unmapped reason codes

The UI uses `formatDryRunReason(code)` for explanations and never claims unsupported meaning for unknown reason codes.

## 8. Key Basis Strength Model

Strong:

- `lead_assignment_id`
- `opportunity_id`

Medium:

- `lead_id`
- `scan_session_id`

Weak:

- `analysis_id`

Blocked weak:

- `contractor_outcome_id`
- `missing_key_basis`

Unknown:

- unmapped basis values

The UI uses `formatDryRunBasis(basis)` for readable labels.

## 9. No-Dispatch Proof

The UI shows and requires the normalized service report flags:

- `externalDispatch: false`
- `dispatchCreated: false`

It also states that no provider calls, dispatch attempts, outbox sent status, or non-service execution path is used.

## 10. Operator Workflow

1. Open Admin → Dry-Run Audit.
2. Select a limit.
3. Click `Run Dry-Run`.
4. Review state, KPIs, blockers, lifecycle key strength, masked samples, and no-dispatch proof.
5. Resolve critical blockers before any later materialization sprint.

## 11. Empty/Error States

Empty state copy: “No revenue signal candidates were found. This may be expected if no contractor outcomes have been marked sold.”

Error state copy: “Dry-run audit failed safely. No external dispatch was attempted.”

Errors are displayed with `formatDryRunError(error)` rather than raw JSON.

## 12. Privacy / Redaction Rules

- Sample candidate IDs are displayed only as already-normalized/masked IDs from the service.
- The UI does not unmask, refetch, join, or expose homeowner names, email, phone, quote URLs, tokens, Vault secret IDs, raw click IDs, endpoint URLs, or provider payloads.
- Raw RPC JSON is not displayed as the primary UI.

## 13. Known Deferrals

- Authenticated admin smoke test if still unavailable.
- Adversarial duplicate lifecycle testing.
- Forbidden endpoint scan.
- Phase 4 contractor portal access.

## 14. Handoff To 3I-D Validation

3I-D can validate the command center against live admin auth, adversarial lifecycle duplicates, forbidden direct endpoint usage, and no-dispatch invariants. It should not add live sync controls unless a later sprint explicitly authorizes materialization.
