# CAPI Monthly Control-Plane Audit

> **Companion to:** [`CAPI_WEEKLY_OPERATOR_REVIEW.md`](./CAPI_WEEKLY_OPERATOR_REVIEW.md), [`CAPI_FLEET_HEALTH_VIEW.md`](./CAPI_FLEET_HEALTH_VIEW.md), [`CAPI_POST_LAUNCH_WATCHTOWER.md`](./CAPI_POST_LAUNCH_WATCHTOWER.md), [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md), [`CAPI_CLIENT_GO_LIVE_GATE.md`](./CAPI_CLIENT_GO_LIVE_GATE.md), [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md), [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md)

---

## 1. Purpose

A **monthly governance pass** over the Meta CAPI fleet to catch the slow, structural problems that the weekly review is too short-window to see:

- Fallback creep (clients quietly depending on the default tier)
- Stale config (tokens never rotated, inactive clients lingering)
- Long-tail Meta rejects clustering by client or pixel
- Match-quality erosion across months
- Recurring operator patches that should have become sprints

**Use this doc when:** it's the first business day of the month and you're doing the structural review — not chasing an incident, not reviewing a launch, not running a weekly sweep.

**Do NOT use this doc for:** active incidents (recovery runbook), new launches (go-live gate + watchtower), or week-to-week triage (weekly review).

The weekly review asks *"is anything broken right now?"* This audit asks *"is the fleet structurally healthy and getting healthier over time?"*

---

## 2. Cadence

| Field | Value |
|---|---|
| **Frequency** | Monthly — first business day of the calendar month |
| **Owner** | Measurement architect (primary); CAPI on-call operator (secondary) |
| **Backup owner** | Engineering lead |
| **Time window covered** | Trailing 30 days (`window_hours = 720`) compared against the prior 30 days |
| **Expected duration** | 45–90 min for a healthy fleet; up to half a day if escalations exist |
| **Output** | One written audit log: structural findings + risk-bucket assignments + sprint candidates |

**Skip rule:** never skip. A missed month is the most common cause of a quiet structural problem becoming a quarterly incident.

---

## 3. Inputs (data sources — all read-only)

| Source | How to access | What it tells you |
|---|---|---|
| **Fleet health summary (current month)** | `admin-data` action `summarize_meta_fleet_health` with `{ "window_hours": 720 }` | 30-day per-client + default-tier health, dominant route, recent counts |
| **Fleet health summary (prior month)** | Same action, run against last month's archived snapshot OR re-derived from `capi_signal_logs` | Baseline for month-over-month comparison |
| **`capi_signal_logs` table** | DB read (admin) — full 30 day window | Raw event-level evidence; required for Meta-reject clustering |
| **`meta_configurations` table** | DB read (admin) | Token rotation recency (`updated_at`), `is_default`, `client_id` linkage |
| **`clients` table** | DB read (admin) | `is_active` state, last touched, slug inventory |
| **Edge Function logs** | Supabase Edge Function logs for `capi-event` | Long-tail runtime errors, rate limits, classification reasons |
| **Meta Events Manager** | Meta UI per pixel | Match-quality month-over-month trend, EMQ score, deduplication health |
| **Last month's audit log** | Internal ops log | Open structural items still being tracked |
| **Weekly review logs (4 entries)** | Internal ops log | Pattern detection — same client, same issue, multiple weeks |

**No new tooling required** — every signal already exists.

---

## 4. Step-by-step monthly audit

### Step 1 — Pull the structural snapshot (5 min)

```http
POST /functions/v1/admin-data
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{ "action": "summarize_meta_fleet_health", "payload": { "window_hours": 720 } }
```

Note `fleet_summary` and the full `clients[]` array. Save it as the month's snapshot.

### Step 2 — Structural routing review (10 min)

For the **whole fleet**, compute:

| Metric | Threshold | Action if breached |
|---|---|---|
| % of `clients[]` with `dominant_route = client` | ≥95% | If <95%, fallback creep — investigate per-client |
| % of `clients[]` with `dominant_route` ∈ {`default`, `mixed`} on active clients | 0% | Each is an `OPERATOR CLEANUP` candidate |
| Total `recent_fallback_count` across active clients | trending down or flat M/M | If trending up, structural concern |
| `default_tier.recent_total_count` share of fleet total | <10% | If >10%, too many clients leaning on default — root cause needed |
| Clients showing `unknown` dominant route with `is_active = true` | should equal expected idle clients only | Each unexpected one is `OPERATOR CLEANUP` |

**Key signal:** a client whose weekly review keeps flipping `healthy` because traffic is silently going to default — that masking is exactly what this audit exists to catch.

### Step 3 — Configuration hygiene review (10 min)

Run these read-only DB checks:

```sql
-- Clients that are inactive but still have a config row
SELECT c.slug, c.is_active, mc.updated_at AS config_updated_at
FROM clients c
JOIN meta_configurations mc ON mc.client_id = c.id
WHERE c.is_active = false
ORDER BY mc.updated_at;

-- Tokens not rotated in >180 days (rotation hygiene)
SELECT c.slug, mc.is_default, mc.updated_at
FROM meta_configurations mc
LEFT JOIN clients c ON c.id = mc.client_id
WHERE mc.access_token IS NOT NULL
  AND mc.updated_at < now() - interval '180 days'
ORDER BY mc.updated_at;

-- Active clients with no config row at all
SELECT c.slug
FROM clients c
LEFT JOIN meta_configurations mc ON mc.client_id = c.id
WHERE c.is_active = true AND mc.id IS NULL;

-- Active clients with config but missing pixel_id or access_token
SELECT c.slug, mc.pixel_id IS NOT NULL AS has_pixel, mc.access_token IS NOT NULL AS has_token
FROM clients c
JOIN meta_configurations mc ON mc.client_id = c.id
WHERE c.is_active = true
  AND (mc.pixel_id IS NULL OR mc.access_token IS NULL);

-- Clients with zero observed events in the last 30 days
SELECT c.slug, c.is_active
FROM clients c
WHERE c.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM capi_signal_logs csl
    WHERE csl.client_slug = c.slug
      AND csl.fired_at >= now() - interval '30 days'
      AND (csl.client_slug NOT LIKE 'smoke:%')
  );
```

| Hygiene finding | Risk bucket |
|---|---|
| Inactive client + config row present | `MONITOR` (intentional? archive candidate) |
| Token not rotated in >180 days | `OPERATOR CLEANUP` (rotate per `CAPI_OPERATOR_ONBOARDING.md` §6) |
| Token not rotated in >365 days | `SPRINT ESCALATION` (rotation policy gap) |
| Active client with no config | `OPERATOR CLEANUP` (run go-live gate before re-trusting traffic) |
| Active client with incomplete config | `OPERATOR CLEANUP` (run `create_meta_client_config` full payload) |
| Active client with zero traffic 30d | `MONITOR` (confirm intent with stakeholder) |

### Step 4 — Delivery quality review (10–15 min)

Cluster Meta rejects by client + pixel:

```sql
SELECT
  client_slug,
  pixel_id,
  count(*) AS reject_count,
  min(fired_at) AS first_seen,
  max(fired_at) AS last_seen
FROM capi_signal_logs
WHERE fired_at >= now() - interval '30 days'
  AND (client_slug NOT LIKE 'smoke:%')
  AND (
    status_code >= 400
    OR (response->>'error') IS NOT NULL
  )
GROUP BY client_slug, pixel_id
ORDER BY reject_count DESC
LIMIT 50;
```

| Pattern | Meaning | Risk bucket |
|---|---|---|
| One client dominates rejects | Per-client config or token issue | `OPERATOR CLEANUP` |
| Same `pixel_id` rejects across multiple slugs | Routing precedence or shared-pixel misconfig | `SPRINT ESCALATION` |
| Rejects clustered on `is_default` tier | Default token degradation — fleet-wide blast radius | **P0 — page** |
| Rejects scattered evenly, low volume | Background Meta noise | `HEALTHY` |
| Repeated `meta_rejected_payload` across clients | Payload-shape contract drift | `SPRINT ESCALATION` (touches `_shared/capiRouting.ts` or `capi-event`) |

Then check Meta Events Manager **per pixel** for the month:
- Match quality score vs. last month
- Deduplication rate (server vs. browser PageView)
- New "Event setup" warnings
- Any pixels Meta has flagged for review

| Match-quality movement | Risk bucket |
|---|---|
| Stable or improving | `HEALTHY` |
| Drop of 1–9 points M/M | `MONITOR` |
| Drop of ≥10 points M/M with no known cause | `OPERATOR CLEANUP` (verify identifier coverage in payload) |
| Drop ≥10 points across multiple pixels in same month | `SPRINT ESCALATION` (likely upstream payload-builder regression) |

### Step 5 — Cross-reference weekly review history (5 min)

Pull the last 4 weekly review log entries. For each client, count how many weeks it appeared in `OPERATOR ACTION` or `WATCH`.

| Pattern | Risk bucket |
|---|---|
| Same client, `OPERATOR ACTION` ≥2 weeks running | `SPRINT ESCALATION` (operator patches not holding) |
| Same client, `WATCH` 4 weeks running with no resolution | `OPERATOR CLEANUP` (force a decision: fix or accept) |
| New `INCIDENT` this month not yet resolved | Carry forward to next month explicitly |

### Step 6 — Assign every client to a risk bucket (10 min)

Walk the full `clients[]` and assign exactly one bucket per §5.

### Step 7 — Record the audit (5–10 min)

Append to the internal ops log using the template in §8.

---

## 5. Risk buckets

| Bucket | Trigger | Owner action | Cadence |
|---|---|---|---|
| **HEALTHY** | All structural metrics within thresholds, no fallback dependence, recent token rotation, no Meta-reject clustering | None — record only | Re-evaluate next month |
| **MONITOR** | Minor month-over-month drift, low-volume client with `unknown` route, intentional inactive, single-week WATCH | Flag in monthly log; revisit next month. No live action. | Re-evaluate next month |
| **OPERATOR CLEANUP** | Token rotation overdue (>180d), incomplete config, unexpected fallback, single-client Meta-reject cluster, ≥10pt match-quality drop on one pixel | Run the matching action this month per §6. Close out within 30 days. | Resolve before next audit |
| **SPRINT ESCALATION** | Token rotation policy gap (>365d), shared-pixel misconfig, payload-shape rejects, recurring operator patches not holding, fleet-wide match-quality drop | Open a tracked sprint ticket. Do **not** keep operator-patching. | Schedule within current sprint cycle |

**P0 escalation (page immediately, do not wait for monthly cycle):**

- `default_tier` rejects clustering — every fallback at risk
- Token rotation has knocked a live client offline
- ≥25% of fleet drops one risk bucket in a single month

---

## 6. Required-action map

| Finding | First action this month | Reference |
|---|---|---|
| Token >180d old | `diagnose_token_health` → rotate via `create_meta_client_config` | `CAPI_OPERATOR_ONBOARDING.md` §6 |
| Token >365d old | Open sprint to define rotation policy | — |
| Active client, no config | Run go-live gate, then `create_meta_client_config` | `CAPI_CLIENT_GO_LIVE_GATE.md` |
| Active client, incomplete config | `create_meta_client_config` (full payload) | `CAPI_CONTROL_PLANE_SETUP.md` §3 |
| Inactive client, config row lingering | Confirm with stakeholder; archive or re-onboard | `CAPI_CLIENT_GO_LIVE_GATE.md` |
| Unexpected `default`/`mixed` dominant route | `preview_meta_route` → fix per recovery runbook | `CAPI_PRODUCTION_RECOVERY_RUNBOOK.md` §3 |
| Active client, zero 30d traffic | Confirm caller path; `preview_meta_route` + `smoke_send_meta_event` | `CAPI_CONTROL_PLANE_SETUP.md` §4 |
| Single-client Meta-reject cluster | Inspect raw `capi_signal_logs.response`; rotate or fix payload | `CAPI_PRODUCTION_RECOVERY_RUNBOOK.md` §3.7 |
| Shared-pixel reject pattern | Open sprint — routing/precedence audit | — |
| Payload-shape rejects | Open sprint — `_shared/capiRouting.ts` / `capi-event` audit | — |
| ≥10pt match-quality drop, one pixel | Verify identifier coverage (em/ph/fbp/fbc) in payload builder | — |
| Fleet-wide match-quality drop | Open sprint — payload builder regression | — |

---

## 7. Escalation rules

Open a sprint ticket (don't operator-patch) when **any** of these are true:

- Same client landed in `OPERATOR CLEANUP` 2 months running
- Token rotation policy gap surfaced (any client >365d)
- Reject pattern spans ≥2 clients with the same root cause
- Match quality dropped fleet-wide
- Fix would touch `supabase/functions/_shared/capiRouting.ts`, `supabase/functions/capi-event/index.ts`, the `meta_configurations` schema, payload builder, or the fleet-health classifier

P0 (page immediately):

- `default_tier` reject clustering
- Live client knocked offline by rotation
- ≥25% of fleet drops a risk bucket in one month

---

## 8. Monthly audit log template

```
## CAPI Monthly Control-Plane Audit — YYYY-MM
Owner: <name>
Window: 30 days ending <ISO date>
Comparison baseline: prior 30 days
Source: summarize_meta_fleet_health (window_hours=720) + DB hygiene queries

Fleet structural snapshot:
  client_count: N | healthy: N | monitor: N | cleanup: N | sprint: N
  default_tier: <healthy|warning|incident>
  total_events_observed: N (M/M delta: +/- N)
  % dominant_route=client (active): NN%
  default_tier share of fleet volume: NN%

Configuration hygiene:
  Inactive clients with config row:    [slug list]
  Tokens >180d old:                    [slug — last_rotated]
  Tokens >365d old (SPRINT):           [slug — last_rotated]
  Active clients no config:            [slug list]
  Active clients incomplete config:    [slug — missing fields]
  Active clients zero traffic 30d:     [slug list]

Delivery quality:
  Top 5 reject clusters: [slug — pixel — count]
  Match-quality M/M deltas:
    - <slug>: +/- N points
  Pixels with new EM warnings: [list]

Weekly-review pattern detection:
  Clients in OPERATOR ACTION ≥2 weeks: [slug — class — sprint ticket]
  Clients in WATCH 4 weeks running:    [slug — class — decision needed]

Risk bucket assignments:
  HEALTHY:            [slugs]
  MONITOR:            [slug — reason]
  OPERATOR CLEANUP:   [slug — finding — action — owner — due]
  SPRINT ESCALATION:  [slug — finding — ticket ref]

P0 escalations:        [list or "none"]

Carry-forward from last month:
  - [item — status — close/extend]

Closed this month:
  - [item — outcome]

Next audit: YYYY-MM-DD
```

---

## 9. What this audit does NOT do

- ❌ Does not send Meta traffic (only `smoke_send_meta_event` when triage demands it)
- ❌ Does not mutate config (use `create_meta_client_config` / `set_meta_client_active`)
- ❌ Does not return tokens
- ❌ Does not include smoke traffic in counts
- ❌ Does not replace the weekly review for short-window triage
- ❌ Does not replace the post-launch watchtower for new clients in their first 72h
- ❌ Does not replace the recovery runbook for active incidents
- ❌ Does not cover browser PageView (out of scope; server-side only)

---

## 10. Forbidden surfaces

- ❌ Do **not** expose any audit action via a public endpoint
- ❌ Do **not** add a browser-side audit widget
- ❌ Do **not** broaden browser Meta beyond `init` + `PageView`
- ❌ Do **not** touch `PostScanReportSwitcher.tsx`, `PhoneVerifyModal.tsx`, `VerifyGate.tsx`, OTP, reveal, or Twilio
- ❌ Do **not** silently change routing precedence to "fix" recurring drift — escalate to sprint
- ❌ Do **not** mark a client healthy without evidence in `capi_signal_logs` and config tables
- ❌ Do **not** archive an inactive client's config without stakeholder confirmation

---

## 11. References

- [`CAPI_WEEKLY_OPERATOR_REVIEW.md`](./CAPI_WEEKLY_OPERATOR_REVIEW.md) — week-to-week triage
- [`CAPI_FLEET_HEALTH_VIEW.md`](./CAPI_FLEET_HEALTH_VIEW.md) — primary data source
- [`CAPI_POST_LAUNCH_WATCHTOWER.md`](./CAPI_POST_LAUNCH_WATCHTOWER.md) — T+0 → T+72h monitoring
- [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md) — active incident triage
- [`CAPI_CLIENT_GO_LIVE_GATE.md`](./CAPI_CLIENT_GO_LIVE_GATE.md) — promotion / re-enable decisions
- [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md) — token rotation procedure
- [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md) — routing precedence + config mutations
- `supabase/functions/admin-data/index.ts` — `summarize_meta_fleet_health` action
- `supabase/functions/_shared/capiRouting.ts` — `classifyMetaError`
