# Sprint 1U Dispatch Governance Console

## Goal

Create an internal governance layer that proves live dispatch is disabled, kill switches are engaged, dry-run controls remain intact, and pre-live requirements are visible before any real Meta, TikTok, Google, GTM Server, CRM, webhook, or endpoint dispatch worker exists.

## North Star

Before WindowMan sends any real event externally, an internal operator must be able to see exactly what is disabled, guarded, missing, simulated, and blocked — and why live dispatch remains impossible right now.

## Definition of Success

Sprint 1U is successful when Admin → Dispatch Governance shows:

- Global live dispatch disabled state.
- Kill switch engaged state.
- Dry-run required state.
- Platform governance matrix.
- Client governance matrix.
- Pre-live readiness checklist.
- Mapper version coverage.
- Outbox and attempt simulation health.
- DB no-live guard visibility.
- Future live-dispatch requirements.
- Explicit no-send proof.

## Files Created or Modified

Created:

- `src/services/dispatchGovernance.ts`
- `src/components/admin/DispatchGovernanceConsole.tsx`
- `docs/dispatch-control-plane/governance-1U.md`

Modified:

- `src/components/AdminDashboard.tsx`
- `src/components/admin/shell/AdminPrimaryTabs.tsx`

## Governance Model

Sprint 1U uses read-only computed governance. No governance table or migration was added.

The service reads existing internal admin data sources:

- platform config metadata
- dispatch outbox rows
- dispatch attempt ledger rows
- local dry-run mapper constants
- local migration source for no-live guard proof

The console does not write to source-of-truth event tables and does not expose a control that can enable live dispatch.

## Why Live Dispatch Remains Impossible

Live dispatch remains impossible because:

- The console is read-only and contains no live enable control.
- Global state is hard-coded to `liveDispatchEnabled: false`.
- Global state is hard-coded to `dryRunRequired: true`.
- Global state is hard-coded to `killSwitchEngaged: true`.
- Global state is hard-coded to `canSendExternally: false`.
- Outbox DB constraints require `send_enabled = false`.
- Outbox DB constraints require `dry_run_only = true`.
- Outbox DB constraints require `sent_at IS NULL`.
- Outbox DB constraints require `external_event_id IS NULL`.
- Attempt DB constraints require `dry_run = true`.
- Attempt DB constraints require provider response fields to remain null.
- No live worker, retry worker, scheduler, provider sender, endpoint caller, or webhook caller was created.

## Pre-Live Checklist

The console includes checklist items for:

- attribution capture implemented
- client_slug fallback exists
- platform configs exist
- mapper versions present
- dry-run queue exists
- outbox schema exists
- materialization function exists
- attempt simulation exists
- duplicate/idempotency contract exists
- no-live DB guards exist or require manual review
- runtime validation report exists
- attempt simulation documentation exists
- no external dispatch worker exists
- governance kill switch engaged
- live dispatch migration not approved

Checklist status values are:

- `passed`
- `warning`
- `blocked`
- `manual_review`

These statuses are audit-readiness states, not ready-to-send states.

## Platform and Client Matrices

The platform matrix shows:

- platform
- mapper version
- active config count
- token-present count
- destination-present count
- dry-run row count
- outbox row count
- simulated attempt count
- blockers
- warnings
- live enabled: false
- governance status

The client matrix groups by `client_slug` and shows:

- active config count
- platform count
- dry-run row count
- outbox row count
- simulated attempt count
- blockers
- warnings
- missing tokens
- missing destinations
- live enabled: false
- governance status

Missing or blank `client_slug` values are grouped as `unresolved_client_slug`.

## No-Send Guarantee

The governance console does not call Meta, TikTok, Google, GTM Server, CRM webhooks, generic endpoints, DNS probes, endpoint health checks, or browser pixels.

It reads internal Supabase-backed admin data and local code/migration metadata only. It does not mutate:

- `public.event_logs`
- `wm_event_log`
- `leads`
- `contractor_outcomes`
- scanner state
- OTP state
- report reveal state
- Partner CRM state

## Remaining Requirements Before Live Dispatch

A future live-dispatch sprint would require, at minimum:

- explicit migration relaxing dry-run-only DB constraints
- live worker with lock and idempotency contract
- platform-specific sender implementations
- token validation and rotation policy
- retry policy and dead-letter handling
- signed audit log for approvals
- manual approval gate
- provider-specific test event plan
- rollback and emergency disable plan

None of those were implemented in Sprint 1U.
