# CAPI Client Go-Live Acceptance Gate

> **Companion to:** [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md), [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md), [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md), [`MEASUREMENT_DEPLOYMENT_CHECKLIST.md`](./MEASUREMENT_DEPLOYMENT_CHECKLIST.md)

---

## 1. Purpose

This is the **single decision gate** for promoting a newly onboarded client Meta pixel from staged to production traffic.

**Use this doc when:** a new client (or a re-keyed existing client) has been added to `meta_configurations` and an operator must decide whether live conversion traffic can begin flowing to that pixel.

**Do NOT use this doc for:**
- Routine production health (use [`MEASUREMENT_OPERATOR_RUNBOOK.md`](./MEASUREMENT_OPERATOR_RUNBOOK.md))
- Active incident response (use [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md))
- New conversion event design (out of scope — separate sprint)
- Browser PageView, OTP, reveal, or Twilio (frozen)

**Audience:** measurement operator, on-call backend engineer, launch reviewer.

---

## 2. The Decision Model

Every check below resolves to **PASS**, **FAIL**, or **WARN**.

| Outcome | Definition |
|---|---|
| **READY** | Every Section 3 check is PASS. Live traffic may begin. |
| **READY WITH KNOWN FALLBACK RISK** | All Section 3 checks PASS **except** an explicit, accepted fallback (e.g. operator has chosen to launch with `test_event_code` set, or with a documented degraded-fallback rollback plan). Must be recorded in §6. |
| **NOT READY** | Any Section 3 check is FAIL. Do not promote. |

**Hard rule:** if any check returns FAIL, the gate is **NOT READY**. WARN never promotes to FAIL on its own but must be acknowledged in §6.

---

## 3. The Six Checks (in order)

Run these sequentially. Stop at the first FAIL.

### 3.1 Config validity

**Goal:** the row exists and is structurally launch-capable.

| Check | Pass criteria | How to verify |
|---|---|---|
| Client row exists | `clients.id` returned | `select id, slug, is_active from clients where slug = '<slug>'` |
| Client is active | `is_active = true` | same query |
| `meta_configurations` row exists for this `client_id` | exactly 1 row, not default | `select id, pixel_id, length(access_token) > 0 as has_token, is_default from meta_configurations where client_id = '<client_id>'` |
| `pixel_id` non-empty | string length > 0 | same query |
| `access_token` non-empty | length > 0 (raw value never displayed) | same query |
| Row is **not** flagged `is_default` | `is_default = false` | same query |

**FAIL if:** client missing, `is_active = false`, no config row, empty `pixel_id`, empty `access_token`, or row is the default row.

**WARN if:** multiple config rows exist for this client (DB partial-unique index should make this impossible — investigate).

### 3.2 Routing proof

**Goal:** the controller will pick this client's pixel for this client's slug, deterministically.

**Run:** `admin-data` action `preview_meta_route` with `{ client_slug: '<slug>' }`.

**Pass criteria:**
- `tier === "client"`
- Returned `pixel_id` matches §3.1's `pixel_id`
- `client_id` matches §3.1's `client_id`
- No `missing_fields` reported
- `reasons` does not include `default_fallback`, `env_fallback`, or `degraded`

**FAIL if:** `tier` is `default`, `env`, or `degraded`. Stop. Diagnose with [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md) §3.1–3.4.

**WARN if:** `tier === "client"` but `test_event_code` is populated and operator did not intend that (test mode would suppress live attribution).

### 3.3 Smoke-send proof

**Goal:** end-to-end delivery to **this client's pixel** is currently working.

**Run:** `admin-data` action `smoke_send_meta_event` with `{ client_slug: '<slug>', event_name: 'PageView' }` (or another safe non-conversion event the client expects).

**Pass criteria:**
- HTTP 2xx response from Meta
- Returned `pixel_id` matches §3.1
- No `classifyMetaError` classification (`token_invalid_or_revoked`, `pixel_token_mismatch`, `meta_rejected_payload`)
- Event visible in Meta **Test Events** tab within 60 seconds when `test_event_code` is set

**FAIL if:** non-2xx, classifier reports any failure mode, or pixel_id mismatch.

**WARN if:** Meta returns 2xx but the event does not appear in Test Events within 60s (network, propagation lag — re-run before launch).

### 3.4 Token hygiene

**Goal:** the token is present, valid, and matched to the pixel; no fallback masking the real state.

**Run:** `admin-data` action `diagnose_token_health` for this `client_id`.

**Pass criteria:**
- `token_present === true`
- `token_classification === "healthy"` (or equivalent — no `missing`, `invalid_or_revoked`, `pixel_token_mismatch`)
- Response shows masked token only (`first4…last4`); raw token never appears
- No env-fallback reported as "in use" for this client

**FAIL if:** any failure classification surfaces, or response contains an unmasked token (escalate immediately — leak).

**WARN if:** token is present and healthy but rotation is overdue per Meta's System User policy (operator decision).

### 3.5 Operational observability

**Goal:** the operator can see what happens after launch.

| Check | Pass criteria |
|---|---|
| `capi_signal_logs` table queryable, recent rows visible from §3.3 smoke-send | Yes |
| Edge Function logs for `capi-event` accessible in Supabase dashboard | Yes |
| Operator knows which `pixel_id` and `client_slug` to filter by | Yes |
| Meta Events Manager → Overview / Test Events for this pixel is reachable by the operator | Yes |

**FAIL if:** operator cannot inspect `capi_signal_logs`, cannot reach Edge Function logs, or does not have Meta Events Manager access for this pixel.

### 3.6 Rollback / safety

**Goal:** if launch fails, recovery is fast and known.

The operator must be able to answer all four:

1. **Disable path:** *"How do I take this client offline right now?"*
   → `update clients set is_active = false where slug = '<slug>'`. The controller then falls through to default-tier routing for any caller still passing this slug. Verify with §3.2.

2. **Fallback awareness:** *"What happens to in-flight traffic when I disable?"*
   → Traffic resolves to the **DB default** route (per [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md) §2 precedence). Confirm a healthy default exists: `select id, pixel_id from meta_configurations where is_default = true`.

3. **Re-enable path:** *"How do I re-enable safely after a fix?"*
   → Re-run §3.1–§3.4. Set `is_active = true` only after all PASS.

4. **Escalation trigger:** *"When do I open a sprint instead of patching?"*
   → See [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md) §6.

**FAIL if:** operator cannot answer any of the four, or no healthy DB default exists as a fallback.

---

## 4. Decision Worksheet

Fill this out per launch. Attach to the launch ticket.

```
Client slug:           ____________________
Client id:             ____________________
Config id:             ____________________
Pixel id:              ____________________
Operator:              ____________________
Date / time (UTC):     ____________________

3.1 Config validity            [ PASS / FAIL / WARN ]   Notes: __________
3.2 Routing proof              [ PASS / FAIL / WARN ]   Notes: __________
3.3 Smoke-send proof           [ PASS / FAIL / WARN ]   Notes: __________
3.4 Token hygiene              [ PASS / FAIL / WARN ]   Notes: __________
3.5 Operational observability  [ PASS / FAIL / WARN ]   Notes: __________
3.6 Rollback / safety          [ PASS / FAIL / WARN ]   Notes: __________

WARN acknowledgements (required if any WARN above):
  - ____________________________________________________

Final decision:  [ READY ]  [ READY WITH KNOWN FALLBACK RISK ]  [ NOT READY ]

If READY WITH KNOWN FALLBACK RISK, document the specific accepted risk
and the rollback trigger:
  - ____________________________________________________
```

---

## 5. Invocation Reference

All commands are admin-only via the `admin-data` Edge Function. Tokens are returned masked only.

| Step | Action | Inputs |
|---|---|---|
| §3.1 | `list_meta_configurations` (filter by `client_id`) | `{ client_id }` |
| §3.2 | `preview_meta_route` | `{ client_slug }` |
| §3.3 | `smoke_send_meta_event` | `{ client_slug, event_name: 'PageView' }` |
| §3.4 | `diagnose_token_health` | `{ client_id }` |
| §3.5 | `select * from capi_signal_logs where client_slug = '<slug>' order by fired_at desc limit 20` | — |

For onboarding/rotating a client config, see [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md) (uses `create_meta_client_config` atomic upsert).

---

## 6. Post-Launch Watch Items (first 24 hours)

After **READY** is recorded, monitor:

- `capi_signal_logs` filtered by `client_slug` and `pixel_id`: expect 2xx responses; investigate any non-2xx within 1 hour
- `capi-event` Edge Function logs: no `classifyMetaError` classifications for this pixel
- Meta Events Manager → Overview: events arriving with expected `event_source_url`, `client_ip_address`, `client_user_agent`, and at least one of `fbp`/`fbc`/hashed `em`/hashed `ph`
- Match-quality score in Events Manager: should stabilize within 24h; weak match quality → §3.8 of recovery runbook
- No regression in the default-tier traffic (check that the new client is not accidentally absorbing traffic that should land on default)

If any of the above degrades, follow the recovery runbook. **Do not** silently disable the new client without recording why.

---

## 7. Forbidden During Go-Live

- ❌ Do **not** broaden browser Meta beyond `init` + `PageView`
- ❌ Do **not** add a browser-side client pixel selector
- ❌ Do **not** call `/functions/v1/capi-event` from the browser
- ❌ Do **not** touch `PostScanReportSwitcher.tsx`, `PhoneVerifyModal.tsx`, `VerifyGate.tsx`, OTP, reveal, or Twilio code as part of a launch
- ❌ Do **not** paste raw access tokens anywhere (use masked previews only)
- ❌ Do **not** change routing precedence to "force" the new client to win — fix the caller
- ❌ Do **not** mark a client READY without a successful §3.3 smoke-send in the last 24 hours
- ❌ Do **not** bypass any check by trusting Meta Events Manager appearance alone — the controller is the source of truth

---

## 8. References

- [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md) — how to add/rotate a client config
- [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md) — routing precedence and config invariants
- [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md) — incident triage if any check fails
- [`MEASUREMENT_DEPLOYMENT_CHECKLIST.md`](./MEASUREMENT_DEPLOYMENT_CHECKLIST.md) — broader deploy verification
- [`CAPI_ROUTING_VALIDATION.md`](./CAPI_ROUTING_VALIDATION.md) — routing test contract
- [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md) — single source of truth
- `supabase/functions/capi-event/index.ts` — server dispatcher
- `supabase/functions/capi-event/index.test.ts` — regression suite (must be green on `main`)
