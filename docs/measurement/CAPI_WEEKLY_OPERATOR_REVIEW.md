# CAPI Weekly Operator Review

> **Companion to:** [`CAPI_FLEET_HEALTH_VIEW.md`](./CAPI_FLEET_HEALTH_VIEW.md), [`CAPI_POST_LAUNCH_WATCHTOWER.md`](./CAPI_POST_LAUNCH_WATCHTOWER.md), [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md), [`CAPI_CLIENT_GO_LIVE_GATE.md`](./CAPI_CLIENT_GO_LIVE_GATE.md), [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md), [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md)

---

## 1. Purpose

A **recurring weekly ritual** to detect drift, fallback creep, degraded routes, token issues, and Meta rejects across the entire Meta CAPI fleet — *before* any of them become an incident.

The watchtower covers T+0 → T+72h after a launch. The recovery runbook covers active incidents. **This doc covers the steady-state weeks in between.**

**Use this doc when:** it's the start of a new week and nothing is on fire — you want a structured pass over the fleet to catch slow problems early.

**Do NOT use this doc for:** active incidents (use the recovery runbook), new launches (use the go-live gate + watchtower), or per-client deep dives (use `preview_meta_route` + `diagnose_token_health` + `smoke_send_meta_event`).

---

## 2. Cadence

| Field | Value |
|---|---|
| **Frequency** | Weekly — same day, same time |
| **Recommended slot** | Monday 09:00 local, before standup |
| **Owner** | On-call CAPI operator (rotating) |
| **Backup owner** | Measurement architect |
| **Time window covered** | Last 168 hours (`window_hours = 168`) |
| **Expected duration** | 15–25 min for a healthy fleet; up to 60 min if escalations exist |
| **Output** | One short written log: triage table + escalations + actions taken |

**Skip rule:** never skip. If the on-call is unavailable, the backup runs it. A missed week is the most common cause of slow drift becoming an incident.

---

## 3. Inputs (data sources — all read-only)

| Source | How to access | What it tells you |
|---|---|---|
| **Fleet health summary** | `admin-data` action `summarize_meta_fleet_health` with `{ "window_hours": 168 }` | Per-client + default-tier health, dominant route, recent counts, suspected issue class |
| **`capi_signal_logs` table** | DB read (admin) | Raw event-level evidence for any client flagged warning/incident |
| **Edge Function logs** | Supabase Edge Function logs for `capi-event` | Runtime errors, rate limits, classification reasons |
| **Meta Events Manager** | Meta UI per pixel | Match-quality scores, deduplication health, EMQ trends |
| **Last week's review log** | Internal ops log | Open items still being watched |

**No new tooling required** — every signal in this review already exists.

---

## 4. Step-by-step weekly sweep

### Step 1 — Pull the fleet snapshot (2 min)

```http
POST /functions/v1/admin-data
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{ "action": "summarize_meta_fleet_health", "payload": { "window_hours": 168 } }
```

Read `fleet_summary`:
- Note `client_count`, `healthy`, `warning`, `incident`.
- If `default_tier.health_state` is anything other than `healthy` → **stop and treat as P0** (fleet-wide blast radius).

### Step 2 — Triage every client (5–15 min)

The response sorts `clients[]` `incident → warning → healthy`. Walk top to bottom. For each non-healthy client, assign one triage bucket per §5.

### Step 3 — Per-client review questions (per non-healthy client)

For each client flagged `warning` or `incident`, answer:

1. Is `dominant_route === "client"`? If not, why?
2. Has `recent_fallback_count` increased vs. last week's log?
3. Has `recent_meta_server_error_count` or `recent_rate_limited_count` appeared?
4. Has `recent_meta_reject_count` appeared?
5. Has `recent_token_failure_count` appeared?
6. Is `last_seen_at` within expectations for this client's traffic level?
7. Is the `suspected_issue_class` consistent with the raw `capi_signal_logs.response` for the worst events?

### Step 4 — Spot-check 2 healthy clients (3 min)

Pick 2 random `healthy` clients and skim their counts. This catches silent regressions in the classifier itself (e.g., everyone is "healthy" because nobody is sending).

### Step 5 — Cross-reference Meta Events Manager (3–5 min)

For each client with non-trivial volume, glance at Meta Events Manager:
- Match quality score not collapsing week-over-week
- No new "Event setup" warnings
- Deduplication still working (server vs. browser PageView)

This is the only signal **not** in `capi_signal_logs` — Meta's own assessment of identifier richness.

### Step 6 — Record the review (2 min)

Write a short log entry (template in §8). Even an all-healthy week gets a one-line entry — that's the audit trail.

---

## 5. Triage buckets

Every non-healthy client lands in exactly one bucket.

| Bucket | Trigger | Action this week | SLA |
|---|---|---|---|
| **HEALTHY / no action** | `health_state = healthy`, no drift vs. last week | None — record only | — |
| **WATCH** | `health_state = warning`; `meta_transient`, `rate_limited`, `no_recent_traffic` for low-volume client, or `client_inactive` (intentional) | Note in log; re-check next week. No live action. | Re-evaluate in 7 days |
| **OPERATOR ACTION** | `health_state = warning` with `elevated_errors`, OR `health_state = incident` with `token_failure`, `unexpected_fallback`, `config_missing`, `config_incomplete` | Run the matching recovery flow from `CAPI_PRODUCTION_RECOVERY_RUNBOOK.md` §3. Fix this week. | Fix within 72h |
| **SPRINT ESCALATION** | Recurring incident across ≥2 weeks, OR multiple clients hit the same class simultaneously, OR root cause requires code/schema change to `_shared/capiRouting.ts`, `capi-event`, `meta_configurations`, or the classifier | Open a tracked sprint ticket. Do **not** patch in production. | Schedule next sprint cycle |

**Rule of thumb:** if you've done the same operator fix on the same client more than 2 weeks running, it's no longer an operator fix — it's a sprint.

---

## 6. Follow-up action map

Match the `suspected_issue_class` from the fleet report to the action.

| Issue class | First action this week | Reference |
|---|---|---|
| `none` | None | — |
| `client_inactive` | Confirm intentional with stakeholder. If unintentional, run go-live gate before re-enable. | `CAPI_CLIENT_GO_LIVE_GATE.md` |
| `config_missing` | `create_meta_client_config` (full payload) | `CAPI_CONTROL_PLANE_SETUP.md` §3 |
| `config_incomplete` | `create_meta_client_config` (full payload) | `CAPI_CONTROL_PLANE_SETUP.md` §3 |
| `no_recent_traffic` | `preview_meta_route` → `smoke_send_meta_event`. Confirm caller traffic exists. | `CAPI_CONTROL_PLANE_SETUP.md` §4 |
| `token_failure` | `diagnose_token_health` → rotate via `create_meta_client_config` | `CAPI_OPERATOR_ONBOARDING.md` §6 |
| `unexpected_fallback` | `preview_meta_route`; check controller precedence | `CAPI_PRODUCTION_RECOVERY_RUNBOOK.md` §3 |
| `meta_reject` | Inspect raw `capi_signal_logs.response` | `CAPI_PRODUCTION_RECOVERY_RUNBOOK.md` §3.7 |
| `elevated_errors` | Edge Function logs + signal logs for the slug | `CAPI_PRODUCTION_RECOVERY_RUNBOOK.md` §3 |
| `rate_limited` | Throttle caller; investigate volume spike | `CAPI_PRODUCTION_RECOVERY_RUNBOOK.md` §3 |
| `meta_transient` | Watch — Meta-side, retry-safe | — |
| `default_config_incomplete` | **P0 — repair immediately.** Default tier gone breaks every fallback. | `CAPI_CONTROL_PLANE_SETUP.md` §3 |

---

## 7. Escalation rules

Open a sprint ticket (don't operator-patch) when **any** of these are true:

- Same client hit `OPERATOR ACTION` ≥2 weeks running
- ≥3 clients hit the same `suspected_issue_class` in the same week (suggests systemic, not per-client)
- A fix would require touching `supabase/functions/_shared/capiRouting.ts`, `supabase/functions/capi-event/index.ts`, the `meta_configurations` schema, or the fleet-health classifier itself
- Meta rejects are payload-shape rejections (not token/permission) — implies a contract drift
- Match-quality score in Events Manager dropped by ≥10 points week-over-week without an explanation

P0 escalation (page immediately, do not wait for the weekly cycle):

- `default_tier.health_state = incident`
- ≥25% of fleet flips to `incident` in one week
- Token rotation in production has knocked a live client offline

---

## 8. Review log template

Append to the internal ops log every week — even healthy weeks.

```
## CAPI Weekly Review — YYYY-MM-DD
Owner: <name>
Window: 168h ending <ISO timestamp>
Source: summarize_meta_fleet_health

Fleet summary:
  client_count: N | healthy: N | warning: N | incident: N
  default_tier: <healthy|warning|incident>
  total_events_observed: N

Triage:
  HEALTHY:           [list of client_slugs]
  WATCH:             [client_slug — issue_class — reason]
  OPERATOR ACTION:   [client_slug — issue_class — action taken — owner]
  SPRINT ESCALATION: [client_slug — issue_class — ticket ref]

Spot-checks (healthy):
  - <slug>: ok
  - <slug>: ok

Meta Events Manager:
  - <slug>: match quality stable / dropped / improved
  - …

Carry-over from last week:
  - [item — status]

Next review: YYYY-MM-DD
```

---

## 9. What this review does NOT do

- ❌ Does not send Meta traffic (use `smoke_send_meta_event` only when triage demands it)
- ❌ Does not mutate config (use `create_meta_client_config` / `set_meta_client_active`)
- ❌ Does not return tokens
- ❌ Does not include smoke traffic in counts
- ❌ Does not replace the post-launch watchtower for new clients in their first 72h
- ❌ Does not replace the recovery runbook for active incidents
- ❌ Does not cover browser PageView (out of scope; server-side only)

---

## 10. Forbidden surfaces

- ❌ Do **not** expose any review action via a public endpoint
- ❌ Do **not** add a browser-side fleet-review widget
- ❌ Do **not** broaden browser Meta beyond `init` + `PageView`
- ❌ Do **not** touch `PostScanReportSwitcher.tsx`, `PhoneVerifyModal.tsx`, `VerifyGate.tsx`, OTP, reveal, or Twilio
- ❌ Do **not** silently change routing precedence to "fix" a recurring issue — escalate to sprint
- ❌ Do **not** mark a client healthy without evidence in `capi_signal_logs`

---

## 11. References

- [`CAPI_FLEET_HEALTH_VIEW.md`](./CAPI_FLEET_HEALTH_VIEW.md) — the data source for this review
- [`CAPI_POST_LAUNCH_WATCHTOWER.md`](./CAPI_POST_LAUNCH_WATCHTOWER.md) — T+0 → T+72h monitoring for new launches
- [`CAPI_PRODUCTION_RECOVERY_RUNBOOK.md`](./CAPI_PRODUCTION_RECOVERY_RUNBOOK.md) — incident triage by failure class
- [`CAPI_CLIENT_GO_LIVE_GATE.md`](./CAPI_CLIENT_GO_LIVE_GATE.md) — promotion decision before re-enabling clients
- [`CAPI_OPERATOR_ONBOARDING.md`](./CAPI_OPERATOR_ONBOARDING.md) — token rotation
- [`CAPI_CONTROL_PLANE_SETUP.md`](./CAPI_CONTROL_PLANE_SETUP.md) — routing precedence + config mutations
- `supabase/functions/admin-data/index.ts` — `summarize_meta_fleet_health` action
- `supabase/functions/_shared/capiRouting.ts` — `classifyMetaError`
