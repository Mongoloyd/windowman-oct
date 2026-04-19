# CAPI Post-Launch Watchtower

> **Companion to:** [`CAPI_CLIENT_GO_LIVE_GATE.md`](./CAPI_CLIENT_GO_LIVE_GATE.md), [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md), [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md), [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md)

---

## 1. Purpose

This is the **monitoring plan for the first 72 hours** after a new client Meta pixel is promoted to production traffic via the go-live gate.

**Use this doc when:** a client has just passed `CAPI_CLIENT_GO_LIVE_GATE.md` and `is_active = true` is now serving live conversion traffic.

**Do NOT use this doc for:**
- The promotion decision itself (use the go-live gate)
- Active incident triage (use the recovery runbook)
- Routine steady-state operations (use the operator runbook)
- Browser PageView, OTP, reveal, or Twilio (frozen)

**Audience:** measurement operator, on-call backend engineer.

**Hard scope:** read-only inspection. The watchtower never sends live events, never mutates config, and never exposes raw tokens.

---

## 2. Watchtower Windows

Four windows, each with explicit checks and triggers.

| Window | Wall-clock | Operator presence | Default cadence |
|---|---|---|---|
| **W0** Immediately after enable | T+0 → T+5 min | Active, hands-on | One-shot |
| **W1** First hour | T+5 min → T+1 h | Foreground monitoring | Every 10–15 min |
| **W24** First 24 hours | T+1 h → T+24 h | Background, scheduled checks | Every 1–2 h, then hourly |
| **W72** Stability watch | T+24 h → T+72 h | Light-touch | Every 4–6 h |

After T+72 h with no warnings, the client transitions to steady-state and is governed by the operator runbook only.

---

## 3. Health States (used by every window)

Every check resolves to one of:

| State | Meaning | Operator action |
|---|---|---|
| **HEALTHY** | Signal matches the go-live gate's PASS expectation | Continue monitoring on cadence |
| **WARNING** | Signal deviates but does not yet justify rollback. Examples: single transient non-2xx, brief test-mode lag, single missing match-quality signal | Increase cadence, log the deviation in §7, re-check at next interval |
| **INCIDENT** | Signal proves the launch is unsafe or the controller is mis-routing | Open recovery runbook §3 immediately. Decide: patch in place vs. rollback (§5) |
| **ROLLBACK** | INCIDENT meets a §5 trigger | Disable client per §5, then escalate per §6 |

**Hard rule:** two consecutive WARNING readings on the same check escalate to INCIDENT.

---

## 4. The Checks (per window)

All commands are admin-only via `admin-data`. All payloads return masked tokens only (`first4…last4`).

### 4.1 W0 — Immediately after enable (T+0 → T+5 min)

Purpose: prove the controller still resolves to this client *after* `is_active = true` and that nothing degraded between gate-pass and live cutover.

| Check | Command | HEALTHY | WARNING | INCIDENT |
|---|---|---|---|---|
| Route preview | `preview_meta_route { client_slug }` | `tier === "client"`, `pixel_id` matches gate, no `default_fallback`/`env_fallback`/`degraded` in `reasons` | `tier === "client"` but `test_event_code` set unintentionally | `tier` is `default`, `env`, or `degraded` |
| Smoke-send | `smoke_send_meta_event { client_slug, event_name: "PageView" }` | HTTP 2xx, `pixel_id` matches, no `classifyMetaError` classification | 2xx but Test Events tab lag >60s | Non-2xx, classifier reports any failure mode, or `pixel_id` mismatch |
| Token health | `diagnose_token_health { client_id }` | `token_present === true`, `token_classification === "healthy"`, masked token only | Healthy but rotation overdue per Meta System User policy | Any `missing` / `invalid_or_revoked` / `pixel_token_mismatch`, or unmasked token in payload (escalate as leak) |

**Exit W0 only when all three are HEALTHY.** Any INCIDENT here → §5 rollback candidate; this is the cheapest moment to revert.

### 4.2 W1 — First hour (T+5 min → T+1 h)

Purpose: prove live caller traffic (not just smoke-send) is landing on the right pixel, with no token failures and no silent fallback.

Cadence: every 10–15 min.

| Check | Source | HEALTHY | WARNING | INCIDENT |
|---|---|---|---|---|
| Live events appearing on this pixel | `select count(*), max(fired_at) from capi_signal_logs where client_slug = '<slug>' and pixel_id = '<expected>' and fired_at > now() - interval '15 minutes'` | Count > 0 (matches expected traffic shape), `max(fired_at)` recent | Count = 0 but expected traffic is naturally bursty | Count = 0 across two consecutive intervals when traffic is expected |
| No silent fallback | `select pixel_id, count(*) from capi_signal_logs where client_slug = '<slug>' and fired_at > now() - interval '15 minutes' group by pixel_id` | Only the expected `pixel_id` appears | A second `pixel_id` appears occasionally (possible default-tier leak) | Any row with `pixel_id` ≠ expected pixel for this slug |
| Status-code distribution | `select status_code, count(*) from capi_signal_logs where client_slug = '<slug>' and fired_at > now() - interval '15 minutes' group by status_code` | All 2xx | One isolated 4xx/5xx, no repeat | Repeated non-2xx, or any 401/403 (token), or any pattern matching a `classifyMetaError` failure mode |
| Edge Function logs (`capi-event`) | Supabase dashboard, filter by pixel_id / client_slug | No `classifyMetaError` classifications, no degraded-route reasons | One transient log entry, no repeat | Any `token_invalid_or_revoked`, `pixel_token_mismatch`, `meta_rejected_payload`, or `degraded` |

**WARNING handling:** record in §7, re-check at next interval. Two consecutive WARNINGs on the same check → INCIDENT.

### 4.3 W24 — First 24 hours (T+1 h → T+24 h)

Purpose: prove the client route stays dominant, fallbacks are not creeping in, and Meta-side acceptance is stable.

Cadence: every 1–2 h for the first 6 h, then hourly.

| Check | Source | HEALTHY | WARNING | INCIDENT |
|---|---|---|---|---|
| Client route remains dominant | `select pixel_id, count(*) from capi_signal_logs where client_slug = '<slug>' and fired_at > now() - interval '1 hour' group by pixel_id order by count desc` | Expected `pixel_id` is ≥99% of rows | Expected `pixel_id` is 95–99% of rows | Expected `pixel_id` is <95% of rows, or a non-expected pixel takes the top slot |
| Non-2xx rate | `select 100.0 * sum(case when status_code >= 400 then 1 else 0 end) / nullif(count(*),0) as err_pct from capi_signal_logs where client_slug = '<slug>' and fired_at > now() - interval '1 hour'` | `err_pct < 1%` | `err_pct` 1–5% | `err_pct ≥ 5%` for two consecutive hourly windows |
| Meta Events Manager — Overview for this pixel | Meta UI | Events arriving with expected `event_source_url`, `client_ip_address`, `client_user_agent`, and at least one of `fbp`/`fbc`/hashed `em`/hashed `ph` | One field type missing on some events | Match-quality red banner from Meta, or systematic missing identifiers |
| Match quality (Meta UI) | Meta Events Manager → match-quality score | Stabilizing within expected band for the pixel's history | Score below previous baseline but not red | "Poor" or red — open recovery runbook §3.8 |
| No regression on default tier | `select count(*) from capi_signal_logs where client_slug is null and pixel_id = '<default_pixel>' and fired_at > now() - interval '1 hour'` (compare to pre-launch baseline) | Within ±10% of pre-launch baseline | ±10–25% drift | The new client has visibly absorbed traffic that should land on default |
| Token still healthy | `diagnose_token_health { client_id }` once per 6 h | `healthy` | — | Any non-`healthy` classification |

### 4.4 W72 — Stability watch (T+24 h → T+72 h)

Purpose: catch slow drift — stale-token symptoms, gradual fallback creep, match-quality decay.

Cadence: every 4–6 h.

| Check | Source | HEALTHY | WARNING | INCIDENT |
|---|---|---|---|---|
| Routing stability | Same as W24 dominance check, hourly bucket comparison across the window | Dominance stays ≥99% across all buckets | Single bucket dips to 95–99% | Persistent dip below 99% across ≥3 buckets |
| Token drift | `diagnose_token_health { client_id }` once per window | `healthy` for the whole window | One transient deviation | Any deviation reproducible at next check |
| Meta rejection drift | Edge Function logs filtered by pixel | No new `classifyMetaError` patterns | One isolated new pattern | Repeated new pattern |
| Match-quality drift | Meta Events Manager | Score stable or improving | Slow downward trend | Drop below the W24 floor |
| Open incidents from W0/W1/W24 | §7 log | All resolved | One open WARNING tracked | Any open INCIDENT |

**Exit W72:** if every check is HEALTHY at T+72 h, the client transitions to steady state. Watchtower closes.

---

## 5. Rollback / Disable Triggers

The operator **must** disable the client (`update clients set is_active = false where slug = '<slug>'`) when **any** of:

1. W0: any check resolves INCIDENT (cheapest moment to revert; do not negotiate).
2. W1: token classification is `invalid_or_revoked` or `pixel_token_mismatch` for two consecutive checks.
3. W1 or W24: live events land on a `pixel_id` other than the expected one for ≥5% of rows in any 15-min window.
4. W24: non-2xx rate ≥5% for two consecutive hourly windows.
5. W24: default-tier traffic visibly absorbed by the new client (per the regression check).
6. W72: any INCIDENT classification persists across two checks.
7. Any time: an unmasked token appears in any payload, log, or response (treat as security incident; escalate immediately and rotate per `CAPI_OPERATOR_ONBOARDING.md`).

**After disable:**
- Confirm rollback with `preview_meta_route { client_slug }` — `tier` should drop to `default` (per `CAPI_CONTROL_PLANE_SETUP.md` §2 precedence).
- Verify a healthy DB default exists: `select id, pixel_id from meta_configurations where is_default = true`.
- Open the recovery runbook §3 for the matching incident class.
- Do **not** silently re-enable. Re-launch must repeat the full go-live gate.

---

## 6. Escalation: when to stop patching and open a sprint

Open a dedicated sprint (do not patch in production) when:

- The same INCIDENT class recurs after a fix attempt within W24 or W72.
- Routing precedence itself appears wrong (the controller is picking a tier that contradicts `CAPI_CONTROL_PLANE_SETUP.md` §2). Per `CAPI_PRODUCTION_RECOVERY_RUNBOOK.md` §6, this is never a hot patch.
- Match-quality decay cannot be explained by identifier coverage (PII hashing, IP/UA, fbp/fbc) and points at upstream caller payload shape.
- A token leak is observed in any surface — even masked-by-accident logs need a sprint review of the masking pipeline.
- The fallback path itself becomes unreliable (DB default route also degraded).
- More than one client launched in the same week shows correlated incidents (suggests a controller-wide regression).

For all five, defer to the recovery runbook for triage and the go-live gate for relaunch.

---

## 7. Watchtower Log (per launch)

Attach to the launch ticket alongside the go-live gate worksheet.

```
Client slug:           ____________________
Client id:             ____________________
Pixel id:              ____________________
Operator:              ____________________
Go-live timestamp UTC: ____________________

W0  (T+0 → T+5 min)    [ HEALTHY / WARNING / INCIDENT / ROLLBACK ]   Notes: __________
W1  (T+5 min → T+1 h)  [ HEALTHY / WARNING / INCIDENT / ROLLBACK ]   Notes: __________
W24 (T+1 h → T+24 h)   [ HEALTHY / WARNING / INCIDENT / ROLLBACK ]   Notes: __________
W72 (T+24 h → T+72 h)  [ HEALTHY / WARNING / INCIDENT / ROLLBACK ]   Notes: __________

Open WARNINGs at T+72 h:
  - ____________________________________________________

Open INCIDENTs at T+72 h:
  - ____________________________________________________

Rollback fired? [ no / yes — at T+__ for trigger #__ from §5 ]

Steady-state handoff at T+72 h: [ yes / deferred — reason: __________ ]
```

---

## 8. Invocation Reference

All commands are admin-only via `admin-data`. Tokens are returned masked only.

| Window | Action | Inputs |
|---|---|---|
| W0 | `preview_meta_route` | `{ client_slug }` |
| W0 | `smoke_send_meta_event` | `{ client_slug, event_name: "PageView" }` |
| W0, W24, W72 | `diagnose_token_health` | `{ client_id }` |
| W1, W24, W72 | `select … from capi_signal_logs where client_slug = '<slug>' …` (see §4.2 / §4.3) | — |
| W1, W24, W72 | Supabase dashboard → Edge Functions → `capi-event` logs, filter by pixel/slug | — |
| W24, W72 | Meta Events Manager → Overview / Test Events / Match Quality for this pixel | — |

---

## 9. Forbidden During the Watchtower

- ❌ Do **not** broaden browser Meta beyond `init` + `PageView`
- ❌ Do **not** add a browser-side client pixel selector
- ❌ Do **not** call `/functions/v1/capi-event` from the browser to "test" live traffic
- ❌ Do **not** touch `PostScanReportSwitcher.tsx`, `PhoneVerifyModal.tsx`, `VerifyGate.tsx`, OTP, reveal, or Twilio
- ❌ Do **not** paste raw access tokens anywhere — masked previews only
- ❌ Do **not** change routing precedence to "explain away" a fallback observation; fix the caller or rollback
- ❌ Do **not** re-enable a rolled-back client without re-running the full go-live gate
- ❌ Do **not** mark a window HEALTHY when WARNINGs are unresolved — record them in §7
- ❌ Do **not** trust Meta Events Manager appearance alone — the controller and `capi_signal_logs` are the source of truth

---

## 10. References

- [`CAPI_CLIENT_GO_LIVE_GATE.md`](./CAPI_CLIENT_GO_LIVE_GATE.md) — promotion decision; this doc starts where that one ends
- [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md) — incident triage when a window resolves INCIDENT
- [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md) — token rotation if W0/W1 token check fails
- [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md) — routing precedence and fallback semantics
- [`MEASUREMENT_OPERATOR_RUNBOOK.md`](./MEASUREMENT_OPERATOR_RUNBOOK.md) — steady-state operations after T+72 h
- [`CAPI_ROUTING_VALIDATION.md`](./CAPI_ROUTING_VALIDATION.md) — routing test contract
- [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md) — single source of truth
- `supabase/functions/capi-event/index.ts` — server dispatcher
- `supabase/functions/capi-event/index.test.ts` — regression suite (must be green on `main`)
