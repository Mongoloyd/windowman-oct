# CAPI Control Plane — Operator Setup & Management

**Status:** Canonical. **Audience:** Operators onboarding/disabling client pixels and verifying server-side Meta routing.
**Companion docs:** `CANONICAL_MEASUREMENT_ARCHITECTURE.md`, `MEASUREMENT_OPERATOR_RUNBOOK.md`, `MEASUREMENT_DEPLOYMENT_CHECKLIST.md`, `MEASUREMENT_DISCREPANCY_DECISION_TREE.md`.

This document is the **single source of truth** for adding, disabling, and verifying server-side Meta CAPI client pixels in WindowMan. It does not change runtime behavior — it documents the existing control plane.

---

## 1. What the controller is

- **File:** `supabase/functions/capi-event/index.ts`
- **Function:** `resolvePixelConfig(supabase, clientSlug?)` — sole authority for deciding which Meta pixel a server-side conversion is sent to.
- **Invocation:** Called once per request inside the `Deno.serve` handler. There is no other server-side dispatcher and no browser-side multi-pixel selector.
- **Tests:** `supabase/functions/capi-event/index.test.ts` (27 scenarios, including the routing matrix below).

The browser pixel layer is **init + PageView only**. It never selects client pixels and never owns conversions. Do not change that.

---

## 2. How client routing works

Routing is **deterministic, three-tiered**, evaluated in this exact order:

| Tier | Source | Trigger | Outcome |
|---|---|---|---|
| 1 | `meta_configurations` row joined to `clients.slug` | Request payload includes `client_slug` AND matching `clients.is_active = true` AND non-null `pixel_id` + `access_token` | Routed to client-specific pixel. `source = "client:<slug>"` |
| 2 | `meta_configurations` row with `is_default = true` | Tier 1 misses, fails, or `client_slug` not provided | Routed to platform default. `source = "db:default"` |
| 3 | Env vars `META_PIXEL_ID` + `META_CAPI_TOKEN` | Tier 1 + Tier 2 both miss | Routed via env fallback. `source = "env:fallback"` |
| — | None of the above | All three tiers miss | **Graceful degradation.** Returns HTTP 202 with `{ success: false, degraded: true }`. **No event sent to Meta.** |

`test_event_code` is read from the same row at every tier. Never hardcoded.

### Config contract (per row in `meta_configurations`)

| Field | Required | Notes |
|---|---|---|
| `client_id` (FK → `clients.id`) | Required for tier 1 | Tier-2 default rows have `client_id = null` and `is_default = true`. |
| `pixel_id` | Yes | Stored in DB. Not a secret. |
| `access_token` | Yes | Stored in DB. **Never** exposed to client. Read only via service role. |
| `test_event_code` | Optional | Toggle Meta test mode without code changes. |
| `is_default` | Exactly one row should be `true` | Platform default. |

### `clients` table contract

| Field | Required | Notes |
|---|---|---|
| `slug` | Yes | Stable identifier passed in CAPI payload as `client_slug`. |
| `is_active` | Yes | **The disable flag.** Setting to `false` causes tier-1 to skip and falls through to tier-2 default. |
| `name` | Yes | Display name for operator reference. |

---

## 3. How to onboard a new client pixel

> All steps run with internal-operator role or service-role. Browser never sees `access_token`.

1. **Insert the client row** (SQL Editor or admin UI):
   ```sql
   INSERT INTO public.clients (slug, name, is_active)
   VALUES ('acme-windows', 'Acme Windows', true)
   RETURNING id;
   ```
2. **Insert the pixel config** using the returned `id`:
   ```sql
   INSERT INTO public.meta_configurations
     (client_id, pixel_id, access_token, test_event_code, is_default)
   VALUES
     ('<clients.id>', '1234567890', '<META_LONG_LIVED_TOKEN>', NULL, false);
   ```
   - `pixel_id`: from Meta Events Manager → Data Sources.
   - `access_token`: long-lived system-user token from Meta Business Settings → System Users → Generate Token, with `ads_management` permission scoped to the pixel.
   - `test_event_code`: optional. Set to a value like `TEST12345` from Events Manager → Test Events while validating; clear it (`NULL`) when going live.
3. **Validate routing** (see §5).
4. **Never** check `access_token` into source control or send it to the browser. Only `capi-event` (service-role) should read it.

### Onboarding the WindowMan platform default (one-time)

Exactly one row in `meta_configurations` should have `is_default = true` and `client_id = NULL`. This is the WindowMan owned-traffic pixel and the safety net for tier 2.

```sql
INSERT INTO public.meta_configurations
  (client_id, pixel_id, access_token, test_event_code, is_default)
VALUES
  (NULL, '<WINDOWMAN_PIXEL_ID>', '<WINDOWMAN_TOKEN>', NULL, true);
```

If the default row is missing, tier 3 (env fallback) covers it; if env vars are also missing the controller degrades gracefully (HTTP 202, no send).

---

## 4. How to disable a client

Flip `clients.is_active` to `false`. **Do not delete the row** — historical `capi_signal_logs.client_slug` references still need it for audit.

```sql
UPDATE public.clients
SET is_active = false
WHERE slug = 'acme-windows';
```

**Expected behavior after disable:**
- Tier-1 lookup fails (`is_active = true` filter excludes the row).
- Controller logs `[CAPI:RESOLVE] Client slug="acme-windows" not found or missing pixel config — falling through`.
- Routing falls through to tier-2 default (or tier-3 env, or graceful degrade).
- No event is silently misrouted to the disabled client's pixel.

To **fully decommission**, also clear the pixel config:
```sql
UPDATE public.meta_configurations
SET access_token = NULL, pixel_id = NULL
WHERE client_id = (SELECT id FROM clients WHERE slug = 'acme-windows');
```

---

## 5. How to verify routing

### A. Tests (CI guardrail)
```bash
deno test --allow-net --allow-env supabase/functions/capi-event/index.test.ts
```
Covers the full routing matrix below. Run on every PR that touches the function or its config helpers.

### B. Logs (per-request observability)

Each invocation emits a `[CAPI:RESOLVE]` line followed by `[CAPI:FIRE]`:
```
[CAPI:RESOLVE] Using client-specific pixel for slug="acme-windows"
[CAPI:FIRE] event=Lead source=client:acme-windows pixel=…7890
```
Inspect via Supabase dashboard → Edge Functions → `capi-event` → Logs.

`source` values:
- `client:<slug>` → tier 1
- `db:default` → tier 2
- `env:fallback` → tier 3
- (no `[CAPI:FIRE]` line, HTTP 202) → graceful degradation, no send

### C. `capi_signal_logs` (durable audit trail)

Every fire (success or Meta-side failure) writes a row:
```sql
SELECT fired_at, client_slug, pixel_id, event_name, status_code,
       response->'events_received' AS events_received
FROM public.capi_signal_logs
ORDER BY fired_at DESC
LIMIT 50;
```
- `status_code = 200` and `events_received = 1` → Meta accepted.
- `status_code = 200` with `response.error` → controller fired but Meta rejected (check match-quality / token).
- `status_code = 500` → controller-side exception (rare; check function logs).
- **No row at all** for an expected event → controller degraded (tier-3 miss) or function never invoked.

### D. Meta Events Manager
- Live events: Events Manager → your pixel → Overview → recent activity.
- Test mode (when `test_event_code` is set): Events Manager → Test Events → enter the code → see events stream in.

---

## 6. Routing matrix (covered by tests)

| Scenario | Expected outcome |
|---|---|
| Active client slug + valid pixel config | Routed to client pixel. `source = "client:<slug>"`. |
| Unknown / typo'd client slug | Falls through to tier-2 default (or tier-3 env, then degrade). |
| Inactive client (`is_active = false`) | Tier-1 skipped → falls through. No silent route to disabled pixel. |
| Client row exists but `meta_configurations` row missing or null pixel/token | Falls through to tier-2. |
| No `client_slug` in payload | Tier-1 skipped → tier-2 default. |
| No tier-1, no tier-2, env vars set | Tier-3 fires. `source = "env:fallback"`. |
| No tier-1, no tier-2, no env vars | HTTP 202 `{ degraded: true }`. **Nothing sent to Meta.** |
| Pre-hashed `em` / `ph` / `external_id` (64-char lowercase hex) | Passed through, **not double-hashed**. |
| Raw `em` / `ph` / `external_id` | Normalized + SHA-256 hashed before send. |
| `fbp` / `fbc` present in payload | Forwarded verbatim into `user_data`. |
| Missing IP in payload | Filled from `cf-connecting-ip` → `x-forwarded-for[0]` → `x-real-ip` → `0.0.0.0`. |
| Missing `client_user_agent` in payload | Filled from request `user-agent` header. |

---

## 7. Failure modes

| Symptom | Likely cause | Where to look |
|---|---|---|
| HTTP 202, `degraded: true`, no `capi_signal_logs` row | All three tiers missed. | Confirm at least one of: client row + active config, default row, or env vars. |
| Events fire but match quality is weak in Meta | Missing `_fbp`/`_fbc`, or hashing regression. | `MEASUREMENT_OPERATOR_RUNBOOK.md` §match-quality; check pre-hash detection isn't broken. |
| Events route to wrong pixel | Stale `client_slug` mapping or duplicate `is_default = true` rows. | `SELECT slug, is_active FROM clients;` and `SELECT client_id, is_default FROM meta_configurations WHERE is_default = true;` — should return exactly one default. |
| `capi_signal_logs.response` shows `(#190) Invalid OAuth access token` | Token rotated, expired, or revoked in Meta. | Regenerate system-user token, `UPDATE meta_configurations SET access_token = '<new>' WHERE …`. |
| `capi_signal_logs.response` shows pixel-not-found | Wrong `pixel_id` for this token's scope. | Verify pixel ID in Events Manager belongs to the same Business Manager as the system user. |
| Browser-side conversion suddenly appears in Meta | A regression added browser conversion ownership. **Stop and open a dedicated sprint.** | `MEASUREMENT_DISCREPANCY_DECISION_TREE.md`. |
| Match-quality drop with no routing change | Likely double-hashing or `fbp`/`fbc` strip — not a routing issue. | Check `isSha256Hex` guard and CI regression tests are still green. |

---

## 8. Hard rules (do not violate)

- Browser is **init + PageView only**. No browser conversion events. No browser-side pixel selection. No browser POST to `capi-event`.
- `access_token` lives **only** in DB (`meta_configurations.access_token`) or Edge-Function env. Never in client code, env files shipped to browser, or logs.
- Exactly **one** `meta_configurations` row should have `is_default = true`.
- **Disable, don't delete.** Flip `clients.is_active`; preserve the row for audit joins.
- Do **not** change OTP, reveal, or Twilio behavior from this control plane. Those are protected.
- Do **not** introduce new event names without a dedicated taxonomy sprint.

---

## 9. Quick reference

- Controller: `supabase/functions/capi-event/index.ts` → `resolvePixelConfig`
- Tests: `supabase/functions/capi-event/index.test.ts`
- Tables: `public.clients`, `public.meta_configurations`, `public.capi_signal_logs`
- Env fallback: `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE`
- Architecture memo: `docs/measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md`
- Runbook: `docs/measurement/MEASUREMENT_OPERATOR_RUNBOOK.md`
- Deployment checklist: `docs/measurement/MEASUREMENT_DEPLOYMENT_CHECKLIST.md`
- Decision tree: `docs/measurement/MEASUREMENT_DISCREPANCY_DECISION_TREE.md`
