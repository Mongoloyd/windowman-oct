# TikTok Event Ladder (Mapping Contract)

> **Status: Sprint 1 — mapping foundation only.**
> **NO live TikTok dispatch exists.** This document and the `mapToTikTok`
> mapper define *how* WindowMan CRM/canonical events would translate to TikTok
> Events API events in the future. Nothing in this sprint sends events to
> TikTok, builds a live API payload, calls the TikTok API, fires a browser
> `ttq()` pixel, enqueues outbox rows, or mutates any database table.

## Purpose

WindowMan wants to move TikTok optimization away from weak front-door form
fills and toward **server-confirmed, high-intent CRM events**. This ladder is
the canonical reference for which WindowMan business moment maps to which TikTok
event, and at what optimization tier.

The mapper is implemented as a pure function in lockstep copies:

- `supabase/functions/_shared/tracking/canonical/mapToTikTok.ts`
- `src/lib/tracking/canonical/mapToTikTok.ts`

Both copies are byte-identical (the Supabase edge bundler cannot import
arbitrary `src/` paths, mirroring the canonical dispatch worker pattern).

## Hard scope boundary

This sprint produces **no runtime tracking behavior change**:

- No `fetch` / TikTok Events API endpoint (`business-api.tiktok.com` etc.).
- No browser pixel (`ttq`) calls.
- No PII hashing (the future sender/worker layer owns hashing).
- No live API payload assembly with secrets, pixel IDs, or access tokens.
- No outbox enqueue, no CRM or paid-media table writes.
- No changes to `trackConversion`, `trackEvent`, GTM `dataLayer`, `capi-event`,
  or `dispatch-platform-events`.

## CRM / canonical → TikTok mapping

| WindowMan source event | TikTok event | Kind | Optimization tier | Server-confirmed |
|---|---|---|---|---|
| `truth_gate_captured` | `SubmitForm` | standard | `lead` | required |
| `lead_captured` | `SubmitForm` | standard | `lead` | required |
| `quote_uploaded` | `UploadQuote` | **custom** | `high_intent` | required |
| `report_revealed` | `UnlockReport` | **custom** | `verified_demand` | required |
| `report_unlocked` | `UnlockReport` | **custom** | `verified_demand` | required |
| `contractor_match_requested` | `Contact` | standard | `sales_ready` | required |
| `contractor_intro_requested` | `Contact` | standard | `sales_ready` | required |
| `appointment_booked` | `Schedule` | standard | `scheduled` | required |
| `appointment_scheduled` | `Schedule` | standard | `scheduled` | required |
| `sold` | `CompletePayment` | standard | `revenue` | required |
| `won` | `CompletePayment` | standard | `revenue` | required |
| _anything else_ | — | — | — | `mapToTikTok(...)` returns `null` |

### Standard vs custom events

- **Standard TikTok events** (recognized by TikTok's optimization models):
  `SubmitForm`, `Contact`, `Schedule`, `CompletePayment`.
- **Custom WindowMan events** (TikTok custom event names, subject to change):
  `UploadQuote`, `UnlockReport`.

### Aliases

Several source names are aliases that resolve to the same TikTok event so the
mapper is robust to differing phrasing across the codebase:

- `lead_captured` ≡ `truth_gate_captured` → `SubmitForm`
- `report_unlocked` ≡ `report_revealed` → `UnlockReport`
- `contractor_intro_requested` ≡ `contractor_match_requested` → `Contact`
- `appointment_scheduled` ≡ `appointment_booked` → `Schedule`
- `won` ≡ `sold` → `CompletePayment`

**`report_revealed` is the preferred paid-media truth** for the unlock moment:
it is the server-issued canonical event persisted by `verify-otp`.
`report_unlocked` is an internal telemetry name (`event_logs`) and should not be
treated as the paid-media source of truth.

### Server confirmation

Every event in this ladder has `requiresServerConfirmation: true`. High-value
TikTok events must only ever be dispatched **after a backend success** for the
corresponding business moment — never optimistically from the browser.

## Deduplication principle

Future live dispatch **must** deduplicate using the canonical
`wm_event_log.event_id` — never a randomly generated id. The canonical id is
already produced deterministically (`buildCanonicalEventId` on the browser,
`defaultCreateId` / explicit ids on the server) so a browser fire and the
server dispatch can share one id. If a TikTok browser pixel event is ever dual-
fired alongside the server event, both must carry the **same** `event_id`.

## Architecture decision (future work)

Live TikTok dispatch must **extend the existing outbox/worker pattern**, not
dispatch directly from capture Edge Functions:

```
business moment (server-confirmed)
  -> wm_event_log row (paid-media truth)        [persistCanonicalEvent]
  -> wm_platform_dispatch_log row (platform=tiktok, status=pending)
  -> dispatch-platform-events worker            [claims + sends, retries]
  -> tiktok sender                              [future: builds live payload]
```

Rejected alternatives:

- **Direct dispatch from capture functions** — couples capture latency/uptime to
  TikTok availability and duplicates queue/retry logic.
- **Overloading `capi-event`** — `capi-event` is Meta-specific (Meta auth,
  `capi_signal_logs`, Meta routing/payload). A separate TikTok sender keeps the
  lanes clean.

## Lane separation (do not conflate)

- **`lead_events` is CRM truth** — the lead lifecycle / timeline audit trail
  written via `emitLeadActivity`. It is admin-facing CRM history.
- **`wm_event_log` is paid-media dispatch truth** — the canonical event ledger
  that drives platform dispatch (Meta today; TikTok later).

These remain parallel lanes. TikTok dispatch reads from the paid-media lane, not
from `lead_events`.

## Future work checklist

The following are explicitly **out of scope** for this sprint and required
before any live TikTok event can be sent:

1. **Attribution snapshot into `wm_event_log`** — populate the existing
   `wm_event_log.attribution` column from `leads.attribution` at canonical write
   time so `ttclid` / `ttp` / hashed identity are available at dispatch.
2. **TikTok sender function** — a new, internal-auth-only Edge Function that
   builds the live TikTok Events API payload (hashing PII, attaching `ttclid` /
   `ttp`, IP / user-agent) and sends it. Do not overload `capi-event`.
3. **Worker / outbox integration** — add a `sendToTikTok` bridge in
   `dispatch-platform-events` and enqueue `platform_name = tiktok` rows.
4. **Event ID parity with browser / GTM** — if any TikTok browser pixel event is
   dual-fired, align its `event_id` with the canonical `wm_event_log.event_id`.
5. **Live QA against TikTok Events Manager** — verify event receipt, match
   quality, and deduplication before scaling spend.

> Do not add real secrets, pixel IDs, access tokens, or environment variable
> values to this document or to the mapper.
