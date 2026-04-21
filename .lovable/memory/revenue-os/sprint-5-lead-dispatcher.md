---
name: Sprint 5 — Automated Lead Dispatcher with Immutable Proof
description: dispatch-lead edge function drains webhook_deliveries (claimed via SKIP LOCKED) and delivers to Sprint-4-resolved contractor destinations (webhook or Resend email). Every attempt writes one row to append-only webhook_delivery_attempts. fire_crm_handoff trigger now stamps the routing snapshot at enqueue time and pg_net→ wakes the dispatcher.
type: feature
---

# Sprint 5 — Automated Lead Dispatcher (2026-04-21)

## What changed

### Schema
1. **`webhook_deliveries`** evolved into the per-lead state row with the Sprint-4 routing snapshot stamped onto it at enqueue time:
   - new columns: `client_slug`, `contractor_id`, `assignment_id`, `dispatch_method`, `destination_snapshot` (jsonb), `no_route_reason`, `resolved_at`, `terminal_at`
   - allowed statuses: `pending | processing | delivered | failed | dead_letter | unroutable | mock_delivered`
   - 65 legacy `mock_delivered` test rows wiped per operator decision
2. **NEW `webhook_delivery_attempts`** — append-only audit log:
   - one row per HTTP/email attempt, never updated, never deleted
   - `BEFORE UPDATE/DELETE` triggers raise `check_violation` (defense in depth)
   - captures destination snapshot, status code, response snippet (≤2KB), duration, success bool, typed `outcome`, error class+message
   - RLS: `authenticated` operators read; only `service_role` writes

### Functions
3. **`fire_crm_handoff` upgraded** to call `resolve_route_for_lead()`:
   - resolved → row enqueued as `pending` with destination snapshot
   - unresolved → row enqueued as `unroutable` with typed `no_route_reason` (no silent drop)
   - emits `crm_handoff_queued` or `crm_handoff_unroutable` to `lead_events`
   - on `pending` only, calls `extensions.http_post` to `dispatch-lead` for low-latency delivery (cron is the safety net later)

4. **`claim_pending_deliveries(p_limit)`** — `SECURITY DEFINER` worker claim function. Uses `SELECT … FOR UPDATE SKIP LOCKED` so concurrent workers never collide. Flips claimed rows to `processing` atomically. Granted to `service_role` only.

5. **`vault_upsert_dispatch_secrets(url, secret)`** — `SECURITY DEFINER` helper. Lets the edge function self-register its URL+secret into Vault on cold boot so the trigger pg_net call works without hardcoded SQL secrets.

### Edge function
6. **NEW `dispatch-lead`** (verify_jwt=false, header `x-dispatch-secret` = env `DISPATCH_LEAD_SECRET`):
   - two invocation modes: `{ delivery_id }` (single, used by trigger) or `{ limit }` (drain batch, used by cron/manual)
   - **per-attempt contract:** ALWAYS writes one row to `webhook_delivery_attempts` then updates the queue row's terminal/transitional state — even for `unsupported_dispatch_method` / `missing_destination` / worker `exception`
   - retry policy: 5 attempts max, backoff 1m → 5m → 30m → 2h, then `dead_letter`
   - retryable: 5xx, 408, 429, timeouts, network errors. Non-retryable: 4xx (except 408/429), redirects, config errors
   - HTTP timeout 8s; response bodies truncated to 2KB before logging (no secret leakage)
   - email path uses Lovable connector gateway → Resend with `RESEND_API_KEY` + `LOVABLE_API_KEY`; sender = `REPORT_FROM_EMAIL`
   - `crm_handoff_delivered` / `crm_handoff_dead_letter` emitted to `lead_events` on terminal outcomes

### Admin queries (four views, all `security_invoker=true`)
7. `v_admin_recent_deliveries` — last 200 deliveries with contractor + lead context
8. `v_admin_failed_deliveries` — `failed | dead_letter | unroutable` with attempt log count
9. `v_admin_deliveries_by_client` — counts grouped by `client_slug` with status histogram
10. `v_admin_deliveries_by_contractor` — counts grouped by `contractor_id` with `distinct_clients`

### TS service layer
- `src/types/leadDelivery.ts` — `DeliveryStatus`, `AttemptOutcome`, view row types, `DeliveryAttemptRow`
- `src/services/leadDelivery.ts` — read-only fetchers for the four views + `fetchAttemptsForDelivery(deliveryId)`

## Hard requirements respected
- ✅ No silent failures — every code path writes an attempt row (even `unsupported_dispatch_method` / `missing_destination`)
- ✅ No global destination assumptions — destination is read off `destination_snapshot` stamped at enqueue from `resolve_route_for_lead`
- ✅ Every delivery attempt leaves an immutable record — `webhook_delivery_attempts` is append-only at the trigger level
- ✅ Payloads safe — response bodies truncated to 2KB, no secret env vars ever logged
- ✅ Did NOT touch OTP/Twilio/auth/UI

## Operational notes
- The `dispatch-lead` URL and `DISPATCH_LEAD_SECRET` are auto-seeded into Vault on first edge function boot via `vault_upsert_dispatch_secrets`. After that, the trigger can pg_net wake the dispatcher.
- Cron is intentionally NOT wired in Sprint 5. Sprint 6 should add a 1-minute pg_cron job calling `dispatch-lead` with `{ limit: 25 }` as the safety net behind the trigger pg_net call.
- The legacy Sprint 3 `dispatch-platform-events` function (Meta/Google CAPI) is a different lane and was not touched.

## Linter notes
Two warnings remain post-migration. **Both are pre-existing**, not regressions:
- `0024_permissive_rls_policy` — the `*_service_role_all` pattern shared across every table
- `Leaked Password Protection Disabled` — Supabase Auth project setting, unrelated
