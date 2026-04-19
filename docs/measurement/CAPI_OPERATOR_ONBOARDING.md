# CAPI Operator Onboarding & Management

> Smallest safe operator path for adding, validating, disabling, and auditing
> Meta client pixels in the WindowMan CAPI control plane.

This document is the **operator runbook** for the server-side Meta routing
control plane. It supersedes ad-hoc SQL for day-to-day onboarding.

Companion docs:
- `CAPI_CONTROL_PLANE_SETUP.md` — architecture & routing tiers
- `CAPI_ROUTING_VALIDATION.md` — routing matrix & log markers
- `MEASUREMENT_DISCREPANCY_DECISION_TREE.md` — triage flow

---

## 1. What this gives operators

Four admin-only actions on the existing `admin-data` edge function:

| Action                       | Role(s)                       | Purpose                                  |
| ---------------------------- | ----------------------------- | ---------------------------------------- |
| `list_meta_configurations`   | super_admin / operator / viewer | Audit all pixel rows (tokens redacted)  |
| `create_meta_client_config`  | super_admin only              | Add or update a client + its pixel row   |
| `set_meta_client_active`     | super_admin only              | Enable / disable a client                |
| `preview_meta_route`         | super_admin / operator / viewer | Dry-run resolver, no Meta call          |

Tokens are **never** returned in plaintext — only a `xxxx…xxxx` preview.

---

## 2. Database safety net

The `meta_configurations` table now enforces these invariants at the DB level
(no application code can violate them):

1. **At most one default row** — partial unique index on `(is_default) WHERE is_default = true`.
2. **At most one config per client** — partial unique index on `(client_id) WHERE client_id IS NOT NULL`.
3. **A row cannot be both default and tied to a client** — CHECK constraint.
4. **Active rows must have non-empty `pixel_id` AND `access_token`** — CHECK constraint.
5. **Every row must have a role** — either `is_default = true` OR `client_id IS NOT NULL`.

Violations bubble up as 4xx errors from the admin actions.

---

## 3. Onboard a new client (the happy path)

```ts
// From the admin UI / a super_admin context:
await invokeAdminData("create_meta_client_config", {
  client_slug:     "acme-windows",      // 1-40 chars, [a-z0-9-]
  client_name:     "Acme Windows LLC",
  pixel_id:        "1234567890123456",  // 6-20 digits
  access_token:    "EAAxxxx…",          // Meta CAPI long-lived token
  test_event_code: "TEST12345",         // optional, omit/null for production
});
```

The action will:
- Validate the slug, pixel_id, and token shape.
- Upsert the `clients` row (sets `is_active = true`).
- Upsert the `meta_configurations` row tied to that client.
- Return `{ mode: "created" | "updated", client_id, client_slug }`.

---

## 4. Validate before sending live traffic (dry-run)

`preview_meta_route` is a deterministic dry-run that **delegates to the same
`resolvePixelConfig()` used by `capi-event` in production**. It never fires to
Meta and never writes to `capi_signal_logs`. Use it for onboarding validation,
disable verification, and degraded-state debugging.

```ts
const { data } = await invokeAdminData("preview_meta_route", {
  client_slug: "acme-windows",
});
```

Response shape (`RouteDiagnostic`):

| Field                 | Meaning                                                      |
| --------------------- | ------------------------------------------------------------ |
| `tier`                | `"client"` \| `"default"` \| `"env"` \| `"degraded"`         |
| `resolved`            | `true` if any tier produced a pixel + token                  |
| `is_send_safe`        | `true` if a real event would be dispatched (not degraded)    |
| `resolved_pixel_id`   | The pixel ID a real event would target (or `null`)           |
| `masked_pixel_id`     | Last-4 mask for safe display (e.g. `…3456`)                  |
| `source`              | Internal source label (`client:<slug>` / `db:default` / `env:fallback`) |
| `uses_default`        | `true` when fallthrough hit the platform default row         |
| `uses_env_fallback`   | `true` when fallthrough hit `META_PIXEL_ID`/`META_CAPI_TOKEN` |
| `degraded`            | `true` when no tier resolved — events would be HTTP 202 no-send |
| `reasons`             | Ordered list of stable reason enums (see below)              |
| `missing_fields`      | Concrete fields the operator must populate to fix degraded routing |
| `preview_only`        | Always `true` — guarantees this response represents no real send |

### Reason enums (stable contract)

| Reason                          | When it appears                                       |
| ------------------------------- | ----------------------------------------------------- |
| `client_resolved`               | Slug matched an active client with complete config    |
| `client_slug_not_provided`      | Caller passed no slug                                 |
| `client_not_found`              | Slug didn't match any `clients` row                   |
| `client_inactive`               | Slug matched but `clients.is_active = false`          |
| `client_config_missing`         | Client row exists but no `meta_configurations` row    |
| `client_config_missing_pixel`   | Config row exists but `pixel_id` is null/empty        |
| `client_config_missing_token`   | Config row exists but `access_token` is null/empty    |
| `default_resolved`              | Fell through to the `is_default = true` row           |
| `default_missing`               | No default row present                                |
| `env_resolved`                  | Fell through to env vars                              |
| `env_missing` / `env_missing_pixel` / `env_missing_token` | Env-tier gaps               |
| `degraded_no_route`             | Final tier — events would be dropped (HTTP 202)       |

### Common dry-runs

```ts
// Verify a new client BEFORE flipping it live:
await invokeAdminData("preview_meta_route", { client_slug: "acme-windows" });
// Expect: tier === "client", is_send_safe === true

// Verify the global default path (no slug):
await invokeAdminData("preview_meta_route", {});
// Expect: tier === "default" | "env" | "degraded"

// Confirm a disabled client correctly falls back:
await invokeAdminData("preview_meta_route", { client_slug: "acme-windows" });
// Expect: tier === "default", reasons includes "client_inactive"
```

---

## 5. Disable a client

```ts
await invokeAdminData("set_meta_client_active", {
  client_slug: "acme-windows",
  is_active:   false,
});
```

Effect: subsequent events using that slug fall through to **default → env → degraded**.
History (the `meta_configurations` row, `capi_signal_logs`, `lead_events`) is preserved.

Re-enable by calling the same action with `is_active: true`.

---

## 6. Audit current state

```ts
const { rows } = await invokeAdminData("list_meta_configurations", {});
```

Each row includes:
- `role`: `"default"` or `"client"`
- `client_slug`, `client_name`, `client_is_active`
- `pixel_id`
- `access_token_preview` (e.g. `EAAB…fG3z`)
- `test_event_code`, `updated_at`

---

## 7. Verify in production

After onboarding, confirm with these signals:

1. **Dry-run** — `preview_meta_route { client_slug }` → expect `tier: "client"`.
2. **Edge logs** — search for `[CAPI:RESOLVE]` to see live tier resolution.
3. **`capi_signal_logs`** — filter by `client_slug` & `pixel_id` to confirm dispatch.
4. **Meta Events Manager** — verify the test event arrives at the expected pixel.

---

## 8. Failure modes & what they mean

| Symptom                                                  | Likely cause                              | Fix                                        |
| -------------------------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| `create_meta_client_config` → `invalid_slug`             | Bad slug shape                            | Use lowercase a-z, 0-9, hyphens (1-40)     |
| `create_meta_client_config` → `invalid_pixel_id`         | Pixel ID has letters or wrong length      | Confirm in Meta Events Manager             |
| `create_meta_client_config` → `config_insert_failed`     | DB constraint blocked an unsafe state     | Read the message; fix the input            |
| `preview_meta_route` → `tier: "default"` when expecting client | Slug inactive or config row incomplete | Toggle `set_meta_client_active`, re-check  |
| `preview_meta_route` → `tier: "degraded"` everywhere     | No default row AND no env vars            | Add a default config row                   |
| Events arriving on wrong pixel                            | Wrong slug being passed at event time     | Check upstream `client_slug` propagation   |

---

## 9. Hard rules

- Tokens are **server-side only**. Never paste them into the browser DevTools or client code.
- Browser remains **init + PageView only** — never selects pixels.
- Conversion ownership remains **server-side via `capi-event`**.
- No SQL needed for routine onboarding — use the admin actions.

---

## 10. Smoke-send (operator-triggered test event)

`smoke_send_meta_event` lets a `super_admin` intentionally fire a controlled
**test-mode** event through the **real** server-side controller path
(`resolvePixelConfig` + `dispatchCapiEvent`) — the exact same code production
uses. This is the safest way to confirm a freshly-onboarded pixel before live
traffic, or to verify Meta accepts a re-enabled client.

### Hard guarantees

- `super_admin` only — `operator` and `viewer` cannot invoke it.
- Test mode is **mandatory**. The action refuses to send unless either:
  - `payload.test_event_code` is provided, OR
  - the resolved config row carries a `test_event_code`.
- The dispatched event uses a namespaced `event_id` (`wm-smoke-<uuid>`) so it
  can never collide with funnel telemetry.
- `capi_signal_logs.client_slug` is prefixed with `smoke:` so business
  reporting filters can exclude it trivially.
- Tokens never appear in the response — only `masked_pixel_id` (last 4).

### Invocation

```ts
await invokeAdminData("smoke_send_meta_event", {
  client_slug:     "acme-windows",   // optional; omit to test the default tier
  test_event_code: "TEST12345",      // optional if config row already has one
  event_name:      "PageView",       // optional, default PageView
});
```

### Response shape

| Field                  | Meaning                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `attempted`            | `true` if a Meta call was dispatched                          |
| `sent`                 | `true` if Meta returned 2xx                                   |
| `mode`                 | Always `"test"` for smoke-send                                |
| `status`               | HTTP status returned by Meta                                  |
| `meta_response`        | Raw Meta response body (e.g. `{ events_received: 1 }`)        |
| `masked_pixel_id`      | Last-4 mask (e.g. `…3456`)                                    |
| `test_event_code_used` | The actual code injected into the payload                     |
| `event_id`             | The namespaced `wm-smoke-…` ID — search for it in Meta Test Events |
| `route`                | Full `RouteDiagnostic` so you can see which tier resolved     |
| `reason`               | When `attempted=false`: `"no_route_resolved"`                 |

### Common smoke-send scenarios

| Scenario                          | Expected outcome                                                     |
| --------------------------------- | -------------------------------------------------------------------- |
| Active client + `test_event_code` | `attempted=true, sent=true, route.tier="client"`                     |
| Unknown slug                      | Falls through to default/env; route surfaces `client_not_found`      |
| Inactive client                   | Falls through; `route.reasons` includes `client_inactive`            |
| Malformed config                  | Falls through OR degraded; `route.missing_fields` lists what's wrong |
| No `test_event_code` anywhere     | HTTP 400 `test_event_code_required` — refuses to send                |
| Fully degraded (no route)         | `attempted=false, reason="no_route_resolved"`                        |

### Confirming in Meta

1. Open **Events Manager → Data Sources → \[your pixel\] → Test Events**.
2. Run the smoke-send.
3. Look for the `event_id` returned in the response — it should appear within
   a few seconds with the chosen `event_name`.
4. If the event arrives at the **wrong** pixel, the routing is misconfigured —
   re-run `preview_meta_route` to debug.

---

## 7. Token rotation & secret hygiene

### 7.1 Where tokens live

| Tier        | Storage                                | Mutation path                                |
| ----------- | -------------------------------------- | -------------------------------------------- |
| Per-client  | `meta_configurations.access_token`     | `create_meta_client_config` (super_admin)    |
| Default     | `meta_configurations` row, `is_default = true` | manual SQL (intentionally rare)       |
| Env fallback| `META_PIXEL_ID` + `META_CAPI_TOKEN` secrets   | Supabase Secrets UI (super_admin)     |

Tokens are **never** returned in plaintext from any admin action. All read
paths (`list_meta_configurations`, `diagnose_token_health`) return only
masked previews (`first4…last4`) and presence booleans.

### 7.2 Rotate a client token (happy path)

```ts
// Step 1 — replace the stored token. Same upsert action as onboarding.
await invokeAdminData("create_meta_client_config", {
  client_slug:  "acme-windows",
  client_name:  "Acme Windows LLC",
  pixel_id:     "1234567890123456",
  access_token: "EAA…NEW_TOKEN",
});

// Step 2 — verify the route still resolves to the client tier.
await invokeAdminData("preview_meta_route", { client_slug: "acme-windows" });
//   → expect: tier="client", is_send_safe=true

// Step 3 — confirm the new token actually works against Meta.
await invokeAdminData("smoke_send_meta_event", {
  client_slug:     "acme-windows",
  test_event_code: "TEST12345",
});
//   → expect: sent=true, failure_class="ok"
```

### 7.3 Recover from a revoked / invalid token

If the live `capi-event` controller starts returning `failure_class:
"token_invalid_or_revoked"` (visible in the function response and in
`capi_signal_logs.response.error`), the recovery sequence is:

1. **Diagnose** — confirm which tier is broken without exposing secrets:
   ```ts
   await invokeAdminData("diagnose_token_health", { client_slug: "acme-windows" });
   ```
   Inspect `tiers.client.presence` (or `.default` / `.env`). A tier with
   `access_token_present: true` but a live `token_invalid_or_revoked` failure
   means the stored token has been revoked at Meta — rotate it.

2. **Rotate** — generate a new long-lived system-user token in Meta Business
   Manager, then run `create_meta_client_config` (Step 1 above).

3. **Re-validate** — run `preview_meta_route` then `smoke_send_meta_event`.
   `smoke_send_meta_event` now returns `failure_class` directly so you do not
   have to interpret raw Meta error codes.

### 7.4 Failure-class enum (stable contract)

The `capi-event` live response and `smoke_send_meta_event` both surface a
stable `failure_class`. Use this — not raw Meta `error.code` values — when
building dashboards, alerts, or runbooks:

| `failure_class`             | Meaning                                                      | Operator action                                         |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| `ok`                        | Meta returned 2xx                                            | None                                                    |
| `token_invalid_or_revoked`  | Token rejected (codes 190 / 102 / 463, or "token invalid")   | Rotate token (§7.2)                                     |
| `token_permission_denied`   | Token alive but lacks scopes (200 / 10)                      | Re-issue with `ads_management` + asset permission       |
| `pixel_token_mismatch`      | Token does not own the pixel                                 | Verify pixel belongs to token's Business Manager assets |
| `rate_limited`              | App / user / pixel rate cap (4 / 17 / 32 / 613)              | Back off; investigate volume                            |
| `meta_rejected_payload`     | 4xx unrelated to token (event schema, missing field)         | Inspect payload; fix sender                             |
| `meta_server_error`         | 5xx from Meta                                                | Transient; safe to retry                                |
| `network_error`             | Local fetch failure (DNS, TLS) — only seen in smoke-send     | Check network egress                                    |
| `unknown_failure`           | Unclassified — inspect `meta_response`                       | File an issue with the raw response                     |

### 7.5 Inspect token health without sending

`diagnose_token_health` is a read-only inspector. It returns booleans +
masked previews **only** — never raw secrets, never raw env values. Safe for
`super_admin`, `operator`, and `viewer`.

```ts
const { data } = await invokeAdminData("diagnose_token_health", {
  client_slug: "acme-windows", // optional; omit to inspect default + env only
});
```

Response shape:

```jsonc
{
  "client_slug": "acme-windows",
  "effective_tier": "client",      // "client" | "default" | "env" | "degraded"
  "is_send_safe": true,
  "tiers": {
    "client":  { "resolved": true,  "reason": "ok",                "presence": { /* booleans + masks */ } },
    "default": { "resolved": true,  "reason": "ok",                "presence": { /* … */ } },
    "env":     { "resolved": false, "reason": "env_missing_token", "presence": { /* … */ } }
  },
  "contract": {
    "tokens_returned": false,
    "env_values_returned": false,
    "mask_format": "first4…last4"
  }
}
```

Use this before and after rotation to confirm presence without firing a Meta
call. If you need to confirm the new token *works*, follow with
`smoke_send_meta_event`.

### 7.6 What operators must never do

- **Never** paste a raw `access_token` into chat, tickets, screenshots, or
  docs. Use `EAA…example` placeholders.
- **Never** add a token to a public env var or commit one to git. Tokens live
  in `meta_configurations.access_token` (DB) or Supabase Secrets only.
- **Never** echo a token back to the browser. There is no client-side Meta
  conversion path — the browser must remain `init + PageView` only.
- **Never** infer that a Meta failure is "fine" because the call returned
  HTTP 200 to your client — the controller intentionally returns 200 with
  `success:false` + `failure_class` so the funnel keeps moving.

