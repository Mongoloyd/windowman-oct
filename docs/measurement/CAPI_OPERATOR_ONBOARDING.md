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
