# CAPI Fleet Health View

> **Companion to:** [`CAPI_POST_LAUNCH_WATCHTOWER.md`](./CAPI_POST_LAUNCH_WATCHTOWER.md), [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md), [`CAPI_CLIENT_GO_LIVE_GATE.md`](./CAPI_CLIENT_GO_LIVE_GATE.md), [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md)

---

## 1. Purpose

A **single cross-client view** of every Meta CAPI route in the fleet, so an operator can answer in one call:

- Which clients are routing to their own pixel correctly?
- Which clients are unexpectedly falling back to default?
- Which clients are degrading or generating Meta rejects?
- Which clients need action *now* vs. can be ignored?

**Scope:** read-only aggregation of `capi_signal_logs` joined with `clients` + `meta_configurations`. No mutations. No live sends. No tokens returned.

**Use this doc when:** you want a portfolio-wide pulse — daily standup, after a deploy, before a launch, or when a single-client incident makes you wonder "is anyone else affected?"

**Do NOT use this doc for:**
- Per-client deep dives (use `preview_meta_route` + `diagnose_token_health` + `smoke_send_meta_event`)
- Active incident triage (use the recovery runbook)
- Launch decisions (use the go-live gate)
- New-launch monitoring T+0 → T+72h (use the watchtower)

---

## 2. Invocation

Admin-only via `admin-data`:

```
POST /functions/v1/admin-data
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "action": "summarize_meta_fleet_health",
  "payload": { "window_hours": 24 }
}
```

| Param | Type | Default | Range |
|---|---|---|---|
| `window_hours` | number | `24` | 1–168 |

**Roles:** `super_admin`, `operator`, `viewer` (read-only — viewers may inspect).

---

## 3. Response shape

```jsonc
{
  "data": {
    "window_hours": 24,
    "window_start": "2026-04-18T00:00:00.000Z",
    "generated_at": "2026-04-19T00:00:00.000Z",
    "fleet_summary": {
      "client_count": 12,
      "healthy": 9,
      "warning": 2,
      "incident": 1,
      "total_events_observed": 8421
    },
    "default_tier": {
      "tier": "default",
      "config_present": true,
      "expected_pixel_masked": "…1234",
      "token_present": true,
      "health_state": "healthy",
      "recent_total_count": 412,
      "recent_success_count": 410,
      "recent_non_2xx_count": 2,
      "recent_token_failure_count": 0,
      "recent_meta_reject_count": 0,
      "last_seen_at": "2026-04-18T23:58:00Z",
      "suspected_issue_class": "none",
      "recommended_next_step": "Default tier healthy."
    },
    "clients": [
      {
        "client_slug": "acme-windows",
        "is_active": true,
        "config_present": true,
        "expected_pixel_masked": "…5678",
        "token_present": true,
        "health_state": "incident",
        "dominant_route": "default",
        "recent_total_count": 240,
        "recent_success_count": 240,
        "recent_non_2xx_count": 0,
        "recent_fallback_count": 240,
        "recent_token_failure_count": 0,
        "recent_meta_reject_count": 0,
        "recent_rate_limited_count": 0,
        "recent_meta_server_error_count": 0,
        "last_seen_at": "2026-04-18T23:55:00Z",
        "suspected_issue_class": "unexpected_fallback",
        "recommended_next_step": "Live traffic hitting non-expected pixel. Run preview_meta_route. See CAPI_PRODUCTION_RECOVERY_RUNBOOK §3."
      }
      // … sorted incident → warning → healthy
    ],
    "contract": {
      "tokens_returned": false,
      "pixel_mask_format": "…last4",
      "smoke_traffic_excluded": true,
      "data_source": "capi_signal_logs"
    }
  }
}
```

**Tokens are never returned.** Pixel IDs are masked to last 4. Smoke traffic (`client_slug LIKE 'smoke:%'`) is excluded so it cannot inflate production health.

---

## 4. Health states

| State | Meaning | Operator action |
|---|---|---|
| **healthy** | Active, configured, dominant route = expected pixel, non-2xx <1%, no token failures | Ignore. Continue scheduled checks. |
| **warning** | Inactive client, no recent traffic, non-2xx 1–5%, transient Meta errors, or rate limits | Watch on next pass. Cross-check with watchtower §4.3. |
| **incident** | Missing/incomplete config, unexpected fallback, token rejection, non-2xx ≥5%, or Meta-side rejects | Open recovery runbook §3 immediately. |

**Sort order:** the `clients[]` array is pre-sorted `incident → warning → healthy` so the operator's eye lands on what matters first.

---

## 5. Suspected issue classes

| `suspected_issue_class` | Meaning | First action |
|---|---|---|
| `none` | Healthy | — |
| `client_inactive` | `clients.is_active = false` | Confirm intentional. Re-run go-live gate before re-enable. |
| `config_missing` | Active client has no `meta_configurations` row | `create_meta_client_config` |
| `config_incomplete` | Config row missing `pixel_id` or `access_token` | `create_meta_client_config` (full payload) |
| `no_recent_traffic` | Active + configured, but zero events in window | `preview_meta_route` then `smoke_send_meta_event`. Confirm caller traffic. |
| `token_failure` | Meta returned `token_invalid_or_revoked` / `pixel_token_mismatch` / `token_permission_denied` | `diagnose_token_health` then rotate via `create_meta_client_config` |
| `unexpected_fallback` | Live events landing on a `pixel_id` that is **not** the expected client pixel | `preview_meta_route`; check controller precedence per `CAPI_CONTROL_PLANE_SETUP.md` §2 |
| `meta_reject` | Meta classified ≥1 event as `meta_rejected_payload` / `unknown_failure` | Inspect raw `capi_signal_logs.response`; recovery runbook §3.7 |
| `elevated_errors` | Non-2xx rate above threshold without a more specific class | Edge Function logs + `capi_signal_logs` for this slug |
| `rate_limited` | Meta returned 429 in window | Throttle caller; investigate volume spike |
| `meta_transient` | Meta 5xx in window | Watch — Meta-side, retry-safe |
| `default_config_incomplete` | **Default tier** missing pixel/token (breaks every fallback) | Repair immediately — fleet-wide impact |

---

## 6. Dominant route field

| `dominant_route` | Meaning |
|---|---|
| `client` | Every observed `pixel_id` matches this client's expected pixel. Routing is correct. |
| `default` | No observed `pixel_id` matches the expected client pixel. Traffic is silently falling back. |
| `mixed` | Some events on the right pixel, some on another. Investigate caller path / controller precedence. |
| `unknown` | No traffic in window. Look at `recent_total_count = 0`. |

`mixed` and `default` on an active client are **always** an incident.

---

## 7. Recommended cadence

| Trigger | Window |
|---|---|
| Daily standup pulse | `window_hours = 24` |
| After a deploy of `capi-event` or `_shared/capiRouting.ts` | `window_hours = 1` then `24` |
| Before launching a new client | `window_hours = 24` (baseline neighbours) |
| During an incident | `window_hours = 1` to scope blast radius |
| Weekly fleet review | `window_hours = 168` |

---

## 8. What this view does NOT do

- ❌ Does not send Meta traffic (use `smoke_send_meta_event`)
- ❌ Does not mutate config (use `create_meta_client_config` / `set_meta_client_active`)
- ❌ Does not return tokens (ever)
- ❌ Does not include smoke traffic in counts
- ❌ Does not replace per-client tools — it tells you *which* client to drill into, not *why* in detail
- ❌ Does not report on browser PageView (out of scope; server-side only)

---

## 9. Forbidden surfaces

- ❌ Do **not** expose this action via a public endpoint
- ❌ Do **not** add a browser-side fleet-health widget that calls this without admin auth
- ❌ Do **not** broaden browser Meta beyond `init` + `PageView` to "improve" reporting
- ❌ Do **not** touch `PostScanReportSwitcher.tsx`, `PhoneVerifyModal.tsx`, `VerifyGate.tsx`, OTP, reveal, or Twilio
- ❌ Do **not** treat smoke-prefixed counts as live traffic — they are excluded by design

---

## 10. References

- [`CAPI_POST_LAUNCH_WATCHTOWER.md`](./CAPI_POST_LAUNCH_WATCHTOWER.md) — per-launch monitoring T+0 → T+72h
- [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md) — incident triage by failure class
- [`CAPI_CLIENT_GO_LIVE_GATE.md`](./CAPI_CLIENT_GO_LIVE_GATE.md) — promotion decision
- [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md) — token rotation
- [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md) — routing precedence
- `supabase/functions/admin-data/index.ts` — `summarize_meta_fleet_health` action
- `supabase/functions/_shared/capiRouting.ts` — `classifyMetaError`, used to bucket failures
