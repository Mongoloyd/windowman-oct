# Sprint 1T Attempt Simulation Runbook

## Goal

The Dispatch Attempt Simulator lets internal operators preview and write dry-run-only attempt ledger rows for `platform_dispatch_outbox` records without sending anything to Meta, TikTok, Google, GTM Server, CRM webhooks, generic endpoints, browser pixels, or any external API.

## North Star

When an operator previews or simulates an attempt, the system must show what would have happened, what was written, what was blocked, what was hashed, and whether any external response exists — while proving that no external send occurred.

## Current Files

- Edge Function: `supabase/functions/admin-simulate-dispatch-attempt/index.ts`
- Frontend service: `src/services/dispatchAttempts.ts`
- Admin UI: `src/components/admin/DispatchAttemptReconciliation.tsx`
- Admin tab wiring: `src/components/AdminDashboard.tsx`, `src/components/admin/shell/AdminPrimaryTabs.tsx`

## Modes

| Mode | Writes attempts? | Confirmation required? | Scope |
| --- | --- | --- | --- |
| `preview_attempt` | No | No | One outbox row |
| `simulate_attempt` | Yes | `SIMULATE_DRY_RUN_ATTEMPT_ONLY` | One outbox row |
| `simulate_selected` | Yes | `SIMULATE_DRY_RUN_ATTEMPT_ONLY` | Up to 25 selected outbox rows |

Response fields distinguish write intent from actual writes:

- `write_requested`: true only for simulate modes.
- `preview_only`: true only for preview mode.
- `attempts_written`: true only when at least one insert succeeded.
- `attempts_written_count`: exact inserted attempt row count.

## Statuses

The simulator writes only these attempt statuses:

- `simulated`
- `failed_preflight`
- `blocked_by_gate`

It must not write live-like states such as `sent`, `delivered`, `failed`, `retrying`, `processing`, or `queued`.

## No-Send Guarantee

The Edge Function performs local database reads and optional inserts into `platform_dispatch_attempts` only. It does not call external network destinations, provider SDKs, GTM Server, CRM webhooks, endpoint URLs, DNS probes, or browser pixels.

The database also enforces no-live-dispatch behavior:

- `platform_dispatch_outbox.send_enabled` must remain `false`.
- `platform_dispatch_outbox.dry_run_only` must remain `true`.
- `platform_dispatch_outbox.sent_at` must remain `null`.
- `platform_dispatch_outbox.external_event_id` must remain `null`.
- worker lock and retry scheduling fields remain unavailable for live dispatch.

## Preview vs Simulate Behavior

Preview mode returns a simulated result payload but writes zero attempt rows. Simulate modes write only dry-run attempt ledger rows after typed confirmation. Outbox rows are not updated; visible attempt counts should be derived from `platform_dispatch_attempts`, not `platform_dispatch_outbox.attempt_count`.

Duplicate protection remains an outbox concern through idempotency keys and unique outbox constraints. Repeated simulated attempts are audit records and cannot create live duplicate sends because no external send path exists in this simulator.

## Provider Response Fields Rule

Attempt inserts must always set:

- `response_status_code = null`
- `response_excerpt = null`

Admin labels must describe these as provider/external response fields, not Edge Function HTTP responses. The Edge Function may return HTTP success or errors to the browser, but that is not a provider response.

## Payload Hash Rule

`request_payload_hash` is computed from the sanitized `redacted_payload_snapshot` only, using stable key ordering before SHA-256. It must not hash raw provider payloads, secrets, tokens, raw click IDs, endpoint URLs, IP addresses, user agents, raw email, or raw phone.

## Redaction Rules

`redacted_request_snapshot` may include:

- platform name
- `client_slug`
- masked IDs
- boolean presence fields
- value/currency already present in the redacted outbox snapshot
- payload hash presence
- no-send debug proof

It must not include:

- raw token or Vault secret value
- Vault secret ID
- raw email or phone
- raw full `fbc`, `fbp`, `fbclid`, `ttclid`, `ttp`, `gclid`, `gbraid`, or `wbraid`
- raw endpoint URL, webhook URL, or full URL query string
- raw IP address
- raw user agent
- Authorization header or bearer token

## Remaining Limitations Before Live Dispatch

- No live dispatch worker exists in this sprint.
- No retry processor or scheduler exists.
- No provider token validation or endpoint health check is performed.
- Provider response fields intentionally remain blank.
- Attempt ledger rows are dry-run audit records, not delivery records.
- Any future live dispatch must introduce separate guarded workers, stricter provider-specific response storage rules, and explicit database migrations that preserve no-live-dispatch safety until intentionally lifted.
