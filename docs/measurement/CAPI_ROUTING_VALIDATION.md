# CAPI Multi-Pixel Routing Validation

> **Purpose:** Prove the server-side `capi-event` controller routes events to
> the correct pixel for every supported configuration state. Use this when
> onboarding a new client pixel, after editing `meta_configurations`, or when
> triaging a "wrong pixel fired" report.
>
> **Scope:** Server-side routing only. Browser remains init + PageView.
> Conversion ownership is server-side only.

---

## 1. The routing matrix

The controller (`resolvePixelConfig` in `supabase/functions/capi-event/index.ts`)
is deterministic. Every event resolves to **exactly one** of these outcomes:

| Input state | Outcome | Log marker | HTTP |
|---|---|---|---|
| Known active `client_slug` with valid pixel + token | Route to client-specific pixel | `[CAPI:RESOLVE] Using client-specific pixel for slug="<slug>"` | 200 |
| Unknown `client_slug` | Fall through to DB default row | `[CAPI:RESOLVE] Client slug="<slug>" not found … falling through` then default marker | 200 |
| Inactive client (`is_active = false`) | Fall through to DB default row | same as unknown | 200 |
| Malformed client config (missing pixel or token) | Fall through to DB default row | same as unknown | 200 |
| No `client_slug`, default DB row present | Route to default pixel | `[CAPI:RESOLVE] Loaded default meta_configuration id=<uuid>` | 200 |
| No client match, no default DB row, env vars set | Route to env fallback pixel | `[CAPI:RESOLVE] Using fallback META_PIXEL_ID from environment secrets` | 200 |
| No client match, no default, no env | Degraded — event NOT sent | `[CAPI:RESOLVE] No pixel configuration found … Signal will be dropped gracefully.` | 202 with `{ degraded: true }` |

There are **no other outcomes**. If you see ambiguous behavior, treat it as a
regression and run the routing test suite.

---

## 2. Routing test suite (deterministic proof)

The routing matrix is locked by:

```
supabase/functions/capi-event/routing.test.ts
```

Run it with:

```bash
deno test --allow-net --allow-env supabase/functions/capi-event/routing.test.ts
```

Every test uses an in-memory mock Supabase client — **no network, no DB, no
Meta calls**. If any test fails, do not deploy.

Scenarios covered:

1. Active client slug → client-specific pixel
2. Unknown client slug → default DB row
3. Inactive client slug → default DB row
4. Malformed client config (no token) → default DB row
5. Malformed client config (no pixel_id) → default DB row
6. Missing default DB row → env vars
7. Missing default + no env → null (degraded, no-send)
8. Unknown client + missing default + no env → null (degraded, no-send)
9. No `client_slug` → default DB row
10. `test_event_code` propagation from client-specific config
11. Env tier requires BOTH `META_PIXEL_ID` AND `META_CAPI_TOKEN`

---

## 3. Live smoke validation (DB priority + env fallback)

For an end-to-end check against the deployed function (uses dummy values that
Meta will reject — controller behavior is what we validate, not Meta delivery):

```
scripts/verify-capi-fallback.ts
```

Run with:

```bash
npx tsx scripts/verify-capi-fallback.ts
```

This script:

1. Seeds a dummy `meta_configurations` row marked `is_default = true`
2. Fires a test event and confirms HTTP 200 + `[CAPI:RESOLVE] Loaded default …`
3. Cleans up the row
4. Fires a second event and confirms either env fallback or HTTP 202 degraded

Requires `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`.

---

## 4. How to validate routing for a specific client

1. Open Edge Function logs for `capi-event` and filter by `[CAPI:RESOLVE]`.
2. Trigger an event with the target `client_slug` (qualification handler,
   reveal handler, or a manual `curl` to the function).
3. Confirm the log line shows `Using client-specific pixel for slug="<slug>"`.
4. Cross-check `capi_signal_logs` — the `pixel_id` column should match the
   client's configured pixel, and `client_slug` should equal the input slug.
5. In Meta Events Manager → Test Events, confirm the event arrives on the
   expected pixel (use `test_event_code` for safe verification).

---

## 5. How to detect inactive / malformed client outcomes

| Symptom | Likely cause | Fix |
|---|---|---|
| Event fires on default pixel instead of client pixel | `clients.is_active = false`, OR `meta_configurations` row for that client is missing/null | Re-activate or repair the config row |
| `[CAPI:RESOLVE] Client slug="…" not found … falling through` in logs | Slug typo OR client row never created | Fix slug or insert client row |
| HTTP 202 with `degraded: true` | No client match, no default row, no env vars | Insert a default `meta_configurations` row OR set `META_PIXEL_ID` + `META_CAPI_TOKEN` secrets |
| Event fires but Meta rejects it | Routing is fine — this is a token/pixel-pairing or match-quality issue, **not** a routing issue | See § 6 |

---

## 6. Routing problems vs match-quality problems

| Looks like | Routing problem | Match-quality problem |
|---|---|---|
| Wrong pixel ID in `capi_signal_logs` | ✅ yes | ❌ no |
| `[CAPI:RESOLVE]` log shows wrong source | ✅ yes | ❌ no |
| HTTP 202 degraded | ✅ yes | ❌ no |
| HTTP 200 but Meta returns `events_received: 0` or error | ❌ no | ✅ yes |
| Pixel correct but `em` / `ph` show as raw strings instead of 64-char hex | ❌ no | ✅ yes (see `index.test.ts`) |
| `_fbp` / `_fbc` missing in payload | ❌ no | ✅ yes |

Routing problems are diagnosed in this doc. Match-quality problems are
diagnosed via `supabase/functions/capi-event/index.test.ts` and
`docs/measurement/MEASUREMENT_DISCREPANCY_DECISION_TREE.md`.

---

## 7. References

- Controller: `supabase/functions/capi-event/index.ts`
- Routing tests: `supabase/functions/capi-event/routing.test.ts`
- Match-quality tests: `supabase/functions/capi-event/index.test.ts`
- Live smoke harness: `scripts/verify-capi-fallback.ts`
- Operator setup: `docs/measurement/CAPI_CONTROL_PLANE_SETUP.md`
- Discrepancy triage: `docs/measurement/MEASUREMENT_DISCREPANCY_DECISION_TREE.md`
- Operator runbook: `docs/measurement/MEASUREMENT_OPERATOR_RUNBOOK.md`
