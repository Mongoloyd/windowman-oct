# CAPI Production Recovery Runbook

> **Companion to:** [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md), [`MEASUREMENT_OPERATOR_RUNBOOK.md`](./MEASUREMENT_OPERATOR_RUNBOOK.md), [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md), [`MEASUREMENT_DISCREPANCY_DECISION_TREE.md`](./MEASUREMENT_DISCREPANCY_DECISION_TREE.md)

---

## 1. Purpose

This is an **incident response runbook** for the server-side Meta CAPI control plane. Use it when something is *currently broken* and you need to triage, recover, or decide whether to escalate.

**This runbook IS for:**
- Diagnosing live CAPI delivery failures (routing, token, Meta reject, match quality)
- Recovering from a degraded / no-send state
- Distinguishing a routing failure from a token failure from a Meta-side rejection
- Deciding whether to fix inline vs. open a dedicated sprint

**This runbook IS NOT for:**
- Designing new conversion events (see [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md))
- Onboarding a new client pixel (see [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md))
- Routine browser pixel verification (see [`MEASUREMENT_OPERATOR_RUNBOOK.md`](./MEASUREMENT_OPERATOR_RUNBOOK.md))
- OTP, reveal, Twilio, or protected funnel files — **never touched during measurement incidents**

**Audience:** on-call engineer, measurement operator, incident responder.

---

## 2. Fast Triage (60 seconds)

Answer these in order. Stop at the first match and jump to the linked section.

| Question | If yes → |
|---|---|
| Is the problem **only** in the browser (PageView count wrong, pixel not loading)? | Stop here. Use [`MEASUREMENT_OPERATOR_RUNBOOK.md`](./MEASUREMENT_OPERATOR_RUNBOOK.md) §4. Not a CAPI incident. |
| Is `capi-event` returning errors / non-2xx? | Go to §3 by error class (routing, token, Meta reject) |
| Is `capi-event` returning success but events are not visible in Meta Events Manager? | §3.4 (degraded / no-send) and §3.8 (match quality) |
| Is route preview showing an unexpected pixel for a known client? | §3.1 / §3.2 |
| Did delivery break right after a token rotation? | §3.5 / §3.6 |
| Smoke-send works, live traffic doesn't? | §3.9 |
| Match quality dropped without a code change? | §3.8 |

**Universal rule:** if the symptom involves a protected file (`PostScanReportSwitcher.tsx`, `PhoneVerifyModal.tsx`, `VerifyGate.tsx`), **stop and open a dedicated sprint** (§7).

---

## 3. Common Incident Classes

Each class follows the same shape: **likely cause → first check → second check → likely fix → when not to patch → when to escalate.**

### 3.1 Active client route not being used

**Symptom:** A client's events are landing on the default pixel instead of their dedicated pixel.

| Step | Action |
|---|---|
| Likely cause | `client_slug` not propagated in payload, or `clients.is_active = false`, or no row in `meta_configurations` for this `client_id` |
| First check | Run `admin-data` action `preview_meta_route` with the affected `client_slug`; confirm which tier resolved (client / default / env) |
| Second check | Query: `select c.slug, c.is_active, mc.pixel_id, mc.id from clients c left join meta_configurations mc on mc.client_id = c.id where c.slug = '<slug>'` |
| Likely fix | If `is_active = false` → reactivate. If no `meta_configurations` row → onboard via [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md). If payload is missing slug → fix the **caller**, not the controller. |
| Do **not** | Hard-code a slug → pixel mapping in `capiRouting.ts`. Bypass `resolvePixelConfig`. |
| Escalate when | The slug is missing because of a protected funnel file, or the routing precedence itself looks wrong |

### 3.2 Default fallback being used unexpectedly

**Symptom:** Route preview reports `tier: "default"` for traffic that should be client-routed.

| Step | Action |
|---|---|
| Likely cause | Caller did not pass `client_slug`; OR client row exists but `meta_configurations` row is missing/inactive |
| First check | `preview_meta_route` with the slug — does it resolve to client tier in isolation? |
| Second check | Inspect `capi_signal_logs.payload` for the failing event — was `client_slug` present? |
| Likely fix | If preview resolves correctly but live traffic doesn't, the caller is omitting the slug. Fix the caller. |
| Do **not** | Disable the default route to "force" client routing. The default is the safety net. |
| Escalate when | The caller is a protected file or requires changing conversion taxonomy |

### 3.3 Env fallback being used unexpectedly

**Symptom:** `preview_meta_route` reports `tier: "env"` (or logs show env-pixel delivery).

| Step | Action |
|---|---|
| Likely cause | No DB default row exists, OR DB default row failed CHECK constraints (empty pixel/token), OR DB query failed transiently |
| First check | `select id, pixel_id, is_default from meta_configurations where is_default = true` |
| Second check | Edge Function logs for `resolvePixelConfig` errors |
| Likely fix | Restore a valid DB default per [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md). Env should be a last-resort safety net, not steady state. |
| Do **not** | Treat env-tier delivery as healthy — it bypasses the multi-tenant control plane |
| Escalate when | Env fallback persists after a valid DB default is in place (indicates `resolvePixelConfig` regression — open sprint) |

### 3.4 Degraded / no-send

**Symptom:** `capi-event` returns 200 but the body indicates the event was not dispatched (e.g. `dispatched: false`, `reason: "no_route"`).

| Step | Action |
|---|---|
| Likely cause | All three resolution tiers failed: no client config, no DB default, no env fallback |
| First check | `preview_meta_route` for the affected slug — what tiers are reported as available? |
| Second check | `select count(*) from meta_configurations where is_default = true`; check `META_CAPI_PIXEL_ID` / `META_CAPI_TOKEN` env presence |
| Likely fix | Restore at least one resolvable tier (preferably DB default) |
| Do **not** | Make `capi-event` return a fake success. Degraded must remain explicit. |
| Escalate when | Degraded persists despite a valid DB default — open a routing-resolution sprint |

### 3.5 Token invalid / revoked

**Symptom:** `classifyMetaError` reports `token_invalid_or_revoked`. Meta returns `OAuthException` with codes 190 / 200 / 102.

| Step | Action |
|---|---|
| Likely cause | Token expired, manually revoked in Meta Business, or rotated without updating `meta_configurations.access_token` |
| First check | Run `admin-data` action `diagnose_token_health` for the affected `client_id` (or default config) |
| Second check | Confirm in Meta Business → System Users → Access Tokens that the token is still valid |
| Likely fix | Mint a new token in Meta Business; update via `admin-data:create_meta_client_config` (atomic upsert). Then re-run `smoke_send_meta_event`. |
| Do **not** | Paste raw tokens into chat, logs, docs, or commit messages. Use masked previews only. |
| Escalate when | A rotation does not stop the failures — likely pixel/token mismatch (§3.6) |

### 3.6 Pixel/token mismatch

**Symptom:** `classifyMetaError` reports `pixel_token_mismatch`. Meta returns errors implying the token has no permission for the pixel.

| Step | Action |
|---|---|
| Likely cause | The token belongs to a different Business/Pixel than `pixel_id` in the same row |
| First check | `diagnose_token_health` — it surfaces this class explicitly |
| Second check | Cross-reference Meta Business: does this System User have access to this Pixel? |
| Likely fix | Either re-mint the token under the correct System User, or correct `pixel_id` in `meta_configurations`. Re-run `smoke_send_meta_event`. |
| Do **not** | Try multiple tokens by trial and error in production — use a non-default config or test pixel |
| Escalate when | The mismatch reflects a structural Business Manager problem (multi-account ownership) — coordinate with the client |

### 3.7 Meta rejected request

**Symptom:** `classifyMetaError` reports `meta_rejected_payload` (code 100, malformed event, etc.) — *not* a token issue.

| Step | Action |
|---|---|
| Likely cause | Payload schema regression: missing required field, malformed `user_data`, invalid `action_source`, bad `event_time` |
| First check | Edge Function logs for the rejected payload (tokens are masked); compare against `supabase/functions/capi-event/index.test.ts` fixtures |
| Second check | Run `deno test --allow-net --allow-env supabase/functions/capi-event/index.test.ts` — does the regression suite still pass? |
| Likely fix | If a caller is sending a malformed payload, fix the caller. If a code change broke the dispatcher, revert and open a sprint. |
| Do **not** | Modify the regression tests to make a failing build pass |
| Escalate when | The rejection requires a taxonomy change — **always a dedicated sprint** |

### 3.8 Weak match quality

**Symptom:** Meta Events Manager match-quality score drops; conversions are accepted but attribution is weak.

| Step | Action |
|---|---|
| Likely cause | Pre-hashed identifiers being double-hashed, `_fbp`/`_fbc` not forwarded, IP/UA fallback regressed, raw PII not normalized |
| First check | Inspect `user_data` in `capi_signal_logs.payload` — are `em`/`ph`/`external_id` 64-char hex? Are `fbp`/`fbc` present when expected? |
| Second check | Run the `capi-event` regression suite — confirm pre-hashed pass-through and IP/UA fallback tests pass |
| Likely fix | Restore the `isSha256Hex` guard if it regressed. Restore IP precedence (`cf-connecting-ip` → `x-forwarded-for` first hop → `x-real-ip` → `0.0.0.0`). |
| Do **not** | "Improve" match quality by sending raw PII unhashed. Never weaken the hash guard. |
| Escalate when | Match quality is weak despite all `user_data` fields being present and correctly formatted — coordinate with Meta support |

See [`MEASUREMENT_OPERATOR_RUNBOOK.md`](./MEASUREMENT_OPERATOR_RUNBOOK.md) §5c–5d for double-hash symptoms vs. healthy pass-through.

### 3.9 Smoke-send succeeds but live traffic still looks wrong

**Symptom:** `smoke_send_meta_event` reports success and appears in Meta Test Events, but real traffic still shows degraded delivery or wrong routing.

| Step | Action |
|---|---|
| Likely cause | Smoke-send and live traffic resolve to different configs (e.g. smoke uses an explicit `client_id`; live traffic omits `client_slug`) |
| First check | Compare the `tier` reported by `preview_meta_route` for **the live traffic's slug** vs. the slug used in smoke-send |
| Second check | Inspect `capi_signal_logs` for a recent live event — what `pixel_id` actually got used? |
| Likely fix | Align: ensure the live caller passes the same `client_slug` you smoke-tested. Fix the caller, not the controller. |
| Do **not** | Assume smoke-send success implies live correctness — they only agree when they resolve to the same config |
| Escalate when | The same slug resolves differently between smoke and live (indicates a `resolvePixelConfig` non-determinism — open sprint) |

### 3.10 Preview says one route, operator expected another

**Symptom:** `preview_meta_route` returns a tier/pixel that contradicts the operator's mental model.

| Step | Action |
|---|---|
| Likely cause | Stale assumption about which row is active; client was deactivated; default was changed |
| First check | Read the routing precedence in [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md) §2 — preview is authoritative |
| Second check | Query: `select id, client_id, is_default, pixel_id from meta_configurations where client_id = '<id>' or is_default = true` |
| Likely fix | Update the operator's understanding, OR adjust the config via `admin-data:create_meta_client_config`. Trust the preview. |
| Do **not** | Override the controller because "the preview must be wrong" |
| Escalate when | Preview output contradicts the actual `meta_configurations` row contents — open sprint (controller bug) |

---

## 4. What to Inspect First

Always inspect in this order. Skipping a layer wastes time.

| Order | Surface | What it tells you |
|---|---|---|
| 1 | **Route preview** (`admin-data:preview_meta_route`) | Which tier and pixel will be used for a given slug — authoritative |
| 2 | **Smoke-send** (`admin-data:smoke_send_meta_event`) | Whether end-to-end delivery works for a chosen config |
| 3 | **Token diagnostics** (`admin-data:diagnose_token_health`) | Token presence, masking, and explicit failure classification |
| 4 | **`capi_signal_logs` table** | What was actually sent, masked, and what Meta returned |
| 5 | **Edge Function logs** (Supabase → Functions → `capi-event` → Logs) | Stack traces, `resolvePixelConfig` decisions, header parsing |
| 6 | **CI status** | Are `pageview-guardrail` and `capi-event-guardrail` green on `main`? |
| 7 | **Canonical docs/tests** | [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md), `supabase/functions/capi-event/index.test.ts` |

If a quick fix conflicts with the canonical doc or a regression test, **trust the canonical artifact** and stop.

---

## 5. Recovery Commands & References

### 5a. Operator helpers (admin-only via `admin-data`)

| Helper | Purpose |
|---|---|
| `preview_meta_route` | Show tier/pixel for a slug without sending |
| `smoke_send_meta_event` | Validate end-to-end delivery for a config |
| `diagnose_token_health` | Check token presence + classify failure mode |
| `list_meta_configurations` | Masked listing of all routes |
| `create_meta_client_config` | Atomic upsert (rotate token, change pixel) |

All return masked tokens only. Never paste raw tokens anywhere.

### 5b. Regression suites

```bash
# Server-side dispatcher + routing + token hygiene
deno check supabase/functions/capi-event/index.ts
deno test --allow-net --allow-env supabase/functions/capi-event/index.test.ts

# Browser PageView guardrail
npm run typecheck
npm run build
npm run proof:pageview
```

### 5c. Canonical references

- [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md) — single source of truth
- [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md) — routing precedence, onboarding model
- [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md) — how to add/rotate a client
- [`CAPI_ROUTING_VALIDATION.md`](./CAPI_ROUTING_VALIDATION.md) — routing test contract
- [`MEASUREMENT_OPERATOR_RUNBOOK.md`](./MEASUREMENT_OPERATOR_RUNBOOK.md) — browser + server health checks
- [`MEASUREMENT_DISCREPANCY_DECISION_TREE.md`](./MEASUREMENT_DISCREPANCY_DECISION_TREE.md) — Events Manager vs. ground truth
- [`MEASUREMENT_DEPLOYMENT_CHECKLIST.md`](./MEASUREMENT_DEPLOYMENT_CHECKLIST.md) — pre/post-deploy verification
- [`BROWSER_META_DECOUPLING_COMPLETE.md`](./BROWSER_META_DECOUPLING_COMPLETE.md) — historical browser/server split

---

## 6. Escalation Matrix

| Situation | Action |
|---|---|
| Routing precedence appears wrong (controller bug suspected) | **Stop. Open dedicated sprint.** Do not patch `resolvePixelConfig` ad hoc. |
| Token rotation does not restore delivery | First rule out pixel/token mismatch (§3.6). If still broken, open sprint. |
| `capi-event` regression test failing | Restore the broken invariant (hash guard, IP precedence, pass-through). Never modify tests to make CI pass. |
| New conversion event needed | **Open dedicated sprint.** Coordinate taxonomy + dispatcher + tests. |
| Browser-side conversion event detected | **Stop. Open dedicated sprint.** Conversion ownership is server-side only. |
| Browser call to `/functions/v1/capi-event` detected | **Stop. Open dedicated sprint.** Forbidden surface. |
| Issue lives in a protected file (`PostScanReportSwitcher`, `PhoneVerifyModal`, `VerifyGate`, `verify-otp`, `send-otp`) | **Stop. Open dedicated scoped sprint.** Never touch as collateral cleanup. |
| Twilio behavior is involved | **Stop. Open dedicated sprint.** Twilio is off-limits to measurement work. |
| Match quality weak after all fields verified correct | Coordinate with Meta support; do not weaken hashing or PII handling to chase a number |

---

## 7. Do-Not-Do List

- ❌ Do **not** patch browser conversion ownership back in
- ❌ Do **not** call `/functions/v1/capi-event` from the browser
- ❌ Do **not** touch OTP/reveal/protected funnel files during measurement incidents
- ❌ Do **not** expose, paste, log, or commit raw Meta access tokens (use masked previews only)
- ❌ Do **not** bypass `resolvePixelConfig` or `capi-event` (no direct browser → Meta calls)
- ❌ Do **not** turn degraded / no-send states into fake success responses
- ❌ Do **not** modify regression tests to make a failing build pass
- ❌ Do **not** disable the PageView or `capi-event` CI guardrails
- ❌ Do **not** weaken hashing, IP/UA fallback, or `_fbp`/`_fbc` pass-through to chase match quality
- ❌ Do **not** broaden browser Meta beyond `init` + `PageView`
- ❌ Do **not** change routing precedence casually — always a dedicated sprint
- ❌ Do **not** touch Twilio code, secrets, or behavior under any measurement-related pretext

---

## 8. References

- [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md)
- [`MEASUREMENT_OPERATOR_RUNBOOK.md`](./MEASUREMENT_OPERATOR_RUNBOOK.md)
- [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md)
- [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md)
- [`CAPI_ROUTING_VALIDATION.md`](./CAPI_ROUTING_VALIDATION.md)
- [`MEASUREMENT_DISCREPANCY_DECISION_TREE.md`](./MEASUREMENT_DISCREPANCY_DECISION_TREE.md)
- [`MEASUREMENT_DEPLOYMENT_CHECKLIST.md`](./MEASUREMENT_DEPLOYMENT_CHECKLIST.md)
- `supabase/functions/capi-event/index.ts` — server dispatcher
- `supabase/functions/capi-event/index.test.ts` — regression suite
- `.github/workflows/capi-event-guardrail.yml` — server CI guardrail
- `.github/workflows/pageview-guardrail.yml` — browser CI guardrail
