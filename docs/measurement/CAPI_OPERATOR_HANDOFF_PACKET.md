# CAPI Operator Handoff Packet

> **Read this first.** This is the canonical entry point for any operator (or future AI assistant) working on the WindowMan Meta CAPI control plane. It does **not** replace detailed docs — it sequences them.

---

## 1. Executive summary

The WindowMan Meta measurement architecture is **intentionally split**:

| Layer | Scope | Owner |
|---|---|---|
| **Browser** | `init` + `PageView` only (one WindowMan-controlled pixel) | `src/components/AppTrackingProvider.tsx` + `src/lib/metaBrowserPixel.ts` |
| **Server (CAPI)** | All conversions: `lead`, `otp_verified`, `report_revealed`, `purchase` | `supabase/functions/capi-event` + `_shared/capiRouting.ts` |
| **Multi-tenant routing** | Server-side only — per-client pixel resolution from `meta_configurations` | `_shared/capiRouting.ts` |

**Hard rules — never violate without an explicit, separately-scoped sprint:**

- ❌ No browser conversion events beyond `PageView`
- ❌ No browser-side multi-pixel routing or client pixel selection
- ❌ No browser code holding Meta access tokens
- ❌ No browser `fetch` / `invoke("capi-event", …)` calls
- ❌ No changes to OTP / reveal / Twilio in measurement work
- ❌ No weakening of server-side match-quality rules (see [`CANONICAL_MEASUREMENT_ARCHITECTURE.md` §3.2](./CANONICAL_MEASUREMENT_ARCHITECTURE.md))

If a proposed change requires touching any of the above, **stop and open a dedicated sprint**.

---

## 2. System map

### 2.1 Runtime code (do not casually modify)

| Concern | Path |
|---|---|
| Browser pixel (init + PageView) | `src/lib/metaBrowserPixel.ts` |
| App-level tracking provider | `src/components/AppTrackingProvider.tsx` |
| GTM dataLayer helper | `src/lib/trackConversion.ts` |
| Server CAPI dispatch | `supabase/functions/capi-event/index.ts` |
| Routing + classification helpers | `supabase/functions/_shared/capiRouting.ts` |
| Canonical mapper | `supabase/functions/_shared/mapToMeta.ts` (and equivalents) |
| Admin control plane | `supabase/functions/admin-data/index.ts` |
| Signal log table | `capi_signal_logs` |
| Config tables | `clients`, `meta_configurations` |

### 2.2 Canonical docs (read in this order)

| Doc | Use when |
|---|---|
| [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md) | You need the load-bearing rules for browser/server scope and match quality |
| [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md) | You're configuring the control plane or routing precedence |
| [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md) | A new operator is being trained, or you need to rotate a token |
| [`CAPI_ROUTING_VALIDATION.md`](./CAPI_ROUTING_VALIDATION.md) | You need to preview / smoke-test routing |
| [`CAPI_CLIENT_GO_LIVE_GATE.md`](./CAPI_CLIENT_GO_LIVE_GATE.md) | A new client pixel is being promoted to production |
| [`CAPI_POST_LAUNCH_WATCHTOWER.md`](./CAPI_POST_LAUNCH_WATCHTOWER.md) | A client just went live — first 24–72h |
| [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md) | An incident is happening right now |
| [`CAPI_FLEET_HEALTH_VIEW.md`](./CAPI_FLEET_HEALTH_VIEW.md) | You need cross-client health data |
| [`CAPI_WEEKLY_OPERATOR_REVIEW.md`](./CAPI_WEEKLY_OPERATOR_REVIEW.md) | Recurring weekly triage |
| [`CAPI_MONTHLY_CONTROL_PLANE_AUDIT.md`](./CAPI_MONTHLY_CONTROL_PLANE_AUDIT.md) | Recurring monthly governance |
| [`MEASUREMENT_DISCREPANCY_DECISION_TREE.md`](./MEASUREMENT_DISCREPANCY_DECISION_TREE.md) | Numbers don't match between Meta and our DB |

### 2.3 First place to look by issue class

| Symptom | Start here |
|---|---|
| New client to onboard | `CAPI_OPERATOR_ONBOARDING.md` → `CAPI_CONTROL_PLANE_SETUP.md` |
| Routing seems wrong | `CAPI_ROUTING_VALIDATION.md` (preview) |
| Live incident | `CAPI_PRODUCTION_RECOVERY_RUNBOOK.md` |
| Match-quality drop | `CANONICAL_MEASUREMENT_ARCHITECTURE.md` §3.2 |
| Cross-client drift | `CAPI_FLEET_HEALTH_VIEW.md` |
| Reporting cadence | weekly → monthly review docs |
| Numbers mismatch | `MEASUREMENT_DISCREPANCY_DECISION_TREE.md` |

---

## 3. Operator workflow sequence

The full lifecycle, in order:

```
[1] Onboard          → CAPI_OPERATOR_ONBOARDING.md
       ↓
[2] Configure        → CAPI_CONTROL_PLANE_SETUP.md (create_meta_client_config)
       ↓
[3] Preview route    → CAPI_ROUTING_VALIDATION.md  (preview_meta_route)
       ↓
[4] Smoke-send       → CAPI_ROUTING_VALIDATION.md  (smoke_send_meta_event)
       ↓
[5] Go-live gate     → CAPI_CLIENT_GO_LIVE_GATE.md (decision packet)
       ↓
[6] Watchtower       → CAPI_POST_LAUNCH_WATCHTOWER.md (T+0 → T+72h)
       ↓
[7] Weekly review    → CAPI_WEEKLY_OPERATOR_REVIEW.md
       ↓
[8] Monthly audit    → CAPI_MONTHLY_CONTROL_PLANE_AUDIT.md
       ↓
[9] On incident      → CAPI_PRODUCTION_RECOVERY_RUNBOOK.md
```

**Never skip steps 3–5 for a new client.** Going live without preview + smoke + gate is the single most common cause of avoidable incidents.

---

## 4. Canonical tools and actions

All admin actions are read- or write-restricted via `supabase/functions/admin-data` and require admin auth.

| Purpose | Action | Doc |
|---|---|---|
| Create / update client config | `create_meta_client_config` | `CAPI_CONTROL_PLANE_SETUP.md` |
| Activate / deactivate client | `set_meta_client_active` | `CAPI_CONTROL_PLANE_SETUP.md` |
| Preview which pixel a slug routes to | `preview_meta_route` | `CAPI_ROUTING_VALIDATION.md` |
| Send a controlled smoke event | `smoke_send_meta_event` | `CAPI_ROUTING_VALIDATION.md` |
| Token health check | `diagnose_token_health` | `CAPI_OPERATOR_ONBOARDING.md` §6 |
| Fleet-wide health summary | `summarize_meta_fleet_health` | `CAPI_FLEET_HEALTH_VIEW.md` |

### 4.1 Logs and tables (read-only diagnostics)

| Source | What it tells you |
|---|---|
| `capi_signal_logs` | Per-event routing outcome, status code, response, pixel used |
| Edge Function logs (`capi-event`) | Runtime errors, classification, rate limits |
| Meta Events Manager | Match quality, deduplication, event-setup warnings |
| `meta_configurations.updated_at` | Token rotation recency |

### 4.2 Tests (do not modify casually)

| Test | Protects |
|---|---|
| `supabase/functions/capi-event/index.test.ts` | Hashing, IP/UA fallback, pre-hashed pass-through (27 cases) |
| `supabase/functions/admin-data/summarize_meta_fleet_health.test.ts` | Fleet-health classifier |
| `scripts/pageview-dedupe-test.tsx` (+ `vitest.proof.config.ts`) | Browser PageView dedupe |
| `.github/workflows/pageview-guardrail.yml` | CI enforcement of dedupe |

---

## 5. Protected boundaries

These are the **non-negotiable** boundaries for any measurement work:

### 5.1 Frontend protected files (DO NOT edit in measurement sprints)

- `src/components/post-scan/PostScanReportSwitcher.tsx`
- `src/components/TruthReportFindings/PhoneVerifyModal.tsx`
- `src/components/TruthReportFindings/VerifyGate.tsx`
- `src/lib/metaBrowserPixel.ts` (already at the approved ceiling)
- `src/components/AppTrackingProvider.tsx` (PageView routing only)

### 5.2 Behavioral boundaries

| Boundary | Rule |
|---|---|
| Browser Meta scope | `init` + `PageView` only |
| Browser conversion ownership | None — server-side only |
| Browser multi-pixel routing | Forbidden — one pixel only |
| OTP behavior | Off-limits in measurement work |
| Reveal behavior | Off-limits in measurement work |
| Twilio | Off-limits in measurement work |
| Routing precedence | Do not silently change to "fix" drift — escalate to sprint |
| Match-quality rules | Do not weaken (see `CANONICAL_MEASUREMENT_ARCHITECTURE.md` §3.2) |
| Pre-hashed PII | Never double-hash — `isSha256Hex` guard is load-bearing |

### 5.3 Server protected helpers

- `supabase/functions/_shared/capiRouting.ts` — routing precedence
- `supabase/functions/_shared/mapToMeta.ts` — payload shape
- `supabase/functions/capi-event/index.ts` — hashing, fallback, pass-through

Touch these only in a dedicated, explicitly-scoped sprint.

---

## 6. Decision matrix

| Situation | Operator can fix? | Action |
|---|---|---|
| Token stale / rejected by Meta | ✅ Yes | Rotate via `create_meta_client_config` (see onboarding §6) |
| Client routing to default unexpectedly | ✅ Yes | Preview → fix config → smoke-send → re-verify |
| Single-client Meta-reject cluster | ✅ Yes | Inspect `capi_signal_logs.response`, rotate or fix payload |
| Active client with incomplete config | ✅ Yes | `create_meta_client_config` with full payload |
| Inactive client lingering | ✅ Yes (with stakeholder confirm) | `set_meta_client_active(false)` or archive |
| Default-tier rejects (fleet-wide blast) | ⚠️ Disable + escalate | Page on-call → recovery runbook §3 → sprint |
| Live client knocked offline by rotation | ⚠️ Rollback + escalate | Restore previous token → recovery runbook → sprint |
| Routing precedence appears wrong | ❌ No | **Sprint** — touches `_shared/capiRouting.ts` |
| Payload-shape rejects across clients | ❌ No | **Sprint** — touches `_shared/mapToMeta.ts` or `capi-event` |
| Match-quality drop fleet-wide | ❌ No | **Sprint** — payload builder regression |
| Token-rotation policy gap (>365d) | ❌ No | **Sprint** — define rotation policy |
| Need to broaden browser Meta scope | ❌ No | **Sprint** — explicit amendment to canonical architecture memo |
| Anything touching OTP / reveal / Twilio | ❌ No | **Sprint** — separately scoped |

**Stop rule:** if a fix requires editing protected files, broadening browser scope, weakening match-quality rules, or silently changing routing precedence — **stop and open a sprint**. Do not improvise.

---

## 7. Reference appendix

### 7.1 Key admin commands

```http
# Preview a route
POST /functions/v1/admin-data
{ "action": "preview_meta_route", "payload": { "client_slug": "<slug>" } }

# Smoke-send (safe, marked smoke:)
POST /functions/v1/admin-data
{ "action": "smoke_send_meta_event", "payload": { "client_slug": "<slug>" } }

# Token diagnostics
POST /functions/v1/admin-data
{ "action": "diagnose_token_health", "payload": { "client_slug": "<slug>" } }

# Fleet health (24h, 168h weekly, 720h monthly)
POST /functions/v1/admin-data
{ "action": "summarize_meta_fleet_health", "payload": { "window_hours": 168 } }

# Create/update config
POST /functions/v1/admin-data
{ "action": "create_meta_client_config", "payload": { "client_slug": "<slug>", "pixel_id": "...", "access_token": "..." } }

# Activate / deactivate
POST /functions/v1/admin-data
{ "action": "set_meta_client_active", "payload": { "client_slug": "<slug>", "is_active": true } }
```

### 7.2 Key file paths

```
src/lib/metaBrowserPixel.ts                       # browser init + PageView
src/components/AppTrackingProvider.tsx            # SPA route-change PageView
supabase/functions/capi-event/index.ts            # CAPI dispatch
supabase/functions/_shared/capiRouting.ts         # routing + classification
supabase/functions/_shared/mapToMeta.ts           # canonical payload mapper
supabase/functions/admin-data/index.ts            # admin control plane
```

### 7.3 Key docs

```
docs/measurement/
├── CAPI_OPERATOR_HANDOFF_PACKET.md             # ← you are here
├── CANONICAL_MEASUREMENT_ARCHITECTURE.md       # load-bearing rules
├── CAPI_CONTROL_PLANE_SETUP.md                 # routing + config
├── CAPI_OPERATOR_ONBOARDING.md                 # new operator + token rotation
├── CAPI_ROUTING_VALIDATION.md                  # preview + smoke
├── CAPI_CLIENT_GO_LIVE_GATE.md                 # promotion decision
├── CAPI_POST_LAUNCH_WATCHTOWER.md              # T+0 → T+72h
├── CAPI_PRODUCTION_RECOVERY_RUNBOOK.md         # incident response
├── CAPI_FLEET_HEALTH_VIEW.md                   # cross-client view
├── CAPI_WEEKLY_OPERATOR_REVIEW.md              # weekly cadence
├── CAPI_MONTHLY_CONTROL_PLANE_AUDIT.md         # monthly governance
└── MEASUREMENT_DISCREPANCY_DECISION_TREE.md    # number mismatches
```

### 7.4 Key tests / guardrails

```
supabase/functions/capi-event/index.test.ts                          # 27 cases
supabase/functions/admin-data/summarize_meta_fleet_health.test.ts    # fleet classifier
scripts/pageview-dedupe-test.tsx + vitest.proof.config.ts            # PageView dedupe
.github/workflows/pageview-guardrail.yml                             # CI enforcement
```

---

## 8. One-line summary for the next operator

> **Browser fires PageView. Server owns conversions. Routing is server-side. Protected files stay protected. When in doubt, preview → smoke → gate, and escalate to sprint instead of improvising.**
