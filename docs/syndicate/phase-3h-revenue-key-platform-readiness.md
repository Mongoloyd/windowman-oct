# Phase 3H — Revenue Signal Idempotency + Platform Readiness Hardening

## Status

Closed for implementation. No live dispatch was added.

## Revenue Signal Key

Revenue signals now use a canonical deterministic `revenue_signal_key` generated from:

- `client_slug`
- `contractor_outcome_id`
- `disposition_state`

The database exposes this through `public.revenue_signal_key(...)` and `public.revenue_signal_key_from_metadata(...)` so eligibility, sync, and readiness use the same fingerprint.

## Physical Duplicate Protection

Duplicate protection now exists at the database level:

- `contractor_outcomes.revenue_signal_key` is generated for sold outcomes with tenant context.
- `contractor_outcomes_revenue_signal_key_unique` prevents duplicate outcome lifecycle keys.
- `event_logs_revenue_signal_key_unique` prevents duplicate outcome-derived sold signals even when older metadata lacks the explicit key but can be derived.

`admin_sync_revenue_signals()` checks the canonical key before insert and writes it into event metadata. `ON CONFLICT DO NOTHING` remains as the final fail-closed guard.

## Platform Readiness Matrix

Platform readiness no longer relies on substring checks. The strict matrix covers:

| Platform | Required destination | Token required |
| --- | --- | --- |
| `meta` | `pixel_id` or `dataset_id` | Yes |
| `tiktok` | `pixel_id` | Yes |
| `google_ads` | `conversion_id` and `conversion_label` | Yes |
| `ga4` | `conversion_id` | Yes |
| `gtm_server` | `endpoint_url` | No |
| `crm_webhook` | `endpoint_url` | No |
| `internal` | None | No |
| `other` | At least one destination field | No |

The frontend service and admin platform config Edge Function both use the same TypeScript readiness semantics.

## Dispatch Safety

- `external_dispatch` remains `false`.
- `dispatch_created` remains `false`.
- No TikTok, Meta, Google, CRM, or webhook calls are created by this phase.

## Deferred

Prompt 3 remains the next layer: internal dry-run reporting with run IDs, operator IDs, per-client breakdown, and a dashboard fix list.

## Phase 3H-B Repair

Phase 3H-B supersedes the outcome-row key as the active sync contract. New sync and eligibility logic now use `public.revenue_lifecycle_signal_key(...)`, which prioritizes `lead_assignment_id`, then `opportunity_id`, `lead_id`, `scan_session_id`, `analysis_id`, and only falls back to `contractor_outcome_id` as a blocked weak key. See `docs/syndicate/phase-3h-b-lifecycle-revenue-signal-key-repair.md` for the full lifecycle idempotency contract.
