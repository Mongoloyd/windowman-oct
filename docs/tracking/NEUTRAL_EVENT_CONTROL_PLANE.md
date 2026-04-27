# Neutral Event Control Plane — Foundation Audit (Task 1)

> Task 1 deliverable: audit-only + a TypeScript-only platform-neutral facade.
> No live dispatch, no schema changes, no browser conversion events.

## 1. What exists today

### 1.1 Frontend tracking

| Module | Role | Notes |
|---|---|---|
| `src/components/AppTrackingProvider.tsx` | Mounts UTM capture + `virtual_page_view` dataLayer push | Also initializes the *one* WindowMan Meta browser pixel for `PageView` only |
| `src/lib/useUtmCapture.ts` | Captures UTM / fbclid / gclid + `_fbp` / `_fbc` cookies; persists to localStorage | Vendor-agnostic surface |
| `src/lib/attribution/fbCookies.ts` | Validates Meta cookie shape; one-shot diagnostic logger | Logs to `event_logs` masked, never raw values |
| `src/lib/metaBrowserPixel.ts` | Top-of-funnel Meta `PageView` + cookie seeding only | Hard rules forbid any browser conversion fire |
| `src/lib/trackConversion.ts` (`trackGtmEvent`) | Canonical browser business-event push to `window.dataLayer` | GTM owns vendor routing |
| `src/lib/trackEvent.ts` (`trackEvent`) | Operational telemetry writer to `event_logs` | Deliberately separate from `trackGtmEvent` |
| `src/lib/tracking/trackBusinessEvent.ts` | Newer dataLayer emitter with auto event_id / lead_id / utm | Pre-promoted; not yet the canonical browser emitter |
| `src/lib/tracking/canonicalEventId.ts` | Deterministic browser-side event id builder | Mirrors server `defaultCreateId` exactly |
| `src/lib/tracking/canonical/*` | Server-side mirror of the canonical event helpers | Imported by edge functions via `_shared/tracking` |

### 1.2 Edge functions touching events

| Function | Role |
|---|---|
| `supabase/functions/scan-quote` | Server-side canonical event for `quote_uploaded` |
| `supabase/functions/verify-otp` | Server-side canonical events for `phone_verified` and `report_revealed` |
| `supabase/functions/capture-truth-gate-lead` | Lead intake (RLS-safe service role); audit logging |
| `supabase/functions/capi-event` | Meta CAPI dispatcher |
| `supabase/functions/dispatch-platform-events` | Cron-driven platform dispatch worker |
| `supabase/functions/_shared/tracking/canonicalBridge.ts` | Adapter from real Supabase client to the canonical helper's `DBLike` |
| `supabase/functions/_shared/tracking/dispatchWorkerBridge.ts` | Edge-compatible re-export of the dispatch worker |

### 1.3 Database tables relevant to events

| Table | Purpose | Status |
|---|---|---|
| `public.event_logs` | Operational telemetry (anon-insertable) | Live, used for diagnostics + funnel debugging |
| `public.lead_events` | Lead lifecycle audit trail (timeline view) | Live, admin-only read |
| `public.conversion_events` | Older Meta-attributed dedup ledger | **Legacy** — predates `wm_event_log` |
| `public.wm_event_log` | Canonical neutral event ledger w/ trust + dispatch state | **Source of truth (recommended)** |
| `public.wm_quote_facts` | Per-analysis quote trust facts | Live; written by `createCanonicalEvent` |
| `public.wm_quote_reviews` | Manual review queue for non-safe quotes | Live |
| `public.wm_pricing_index_snapshots` | Cohort stats / pricing band versions | Live |
| `public.wm_platform_dispatch_log` | Per-platform dispatch state + audit | Live |
| `public.webhook_deliveries` | Webhook delivery audit (broader than measurement) | Live |
| `public.capi_signal_logs` | Meta-specific CAPI dispatch logs | Live; legacy alongside `wm_platform_dispatch_log` |

### 1.4 Routing tables

| Table | Role |
|---|---|
| `public.clients` | Tenant registry: `id` (uuid), `slug` (unique), `is_active` |
| `public.client_configs` | Per-tenant destination configuration (1:1 with `clients` via `client_id`) |
| `public.meta_configurations` | **Legacy** Meta-specific config; predates `client_configs` |

`leads.client_slug` already inherits to downstream rows
(`analyses.client_slug`, `contractor_opportunities.client_slug`) via the
`inherit_client_slug_from_lead()` trigger.

## 2. Recommended canonical source of truth

**`public.wm_event_log` is the chosen canonical event source of truth.**

Rationale:

- Already enum-typed via `wm_event_name` (DB) ↔ `WM_EVENT_NAMES` (TS).
- Carries trust, anomaly, identity-quality, and optimization state on the
  same row, so dispatch decisions read one record.
- Has stable `event_id` uniqueness for cross-lane (browser ↔ server)
  deduplication.
- Already integrated with `wm_platform_dispatch_log` for outbound dispatch
  state, and with `wm_quote_facts` for quote-level trust facts.
- Mirrored on the browser via `buildCanonicalEventId()` so both lanes can
  produce the same id for the same business moment.

`event_logs`, `lead_events`, `conversion_events`, and `capi_signal_logs`
remain useful as **specialized side-channels** (operational diagnostics,
admin timeline, legacy CAPI dedup, vendor-specific dispatch audit), but
none of them should be treated as the cross-platform contract going
forward.

## 3. Neutral event contract (TypeScript-only)

Defined in `src/lib/tracking/neutralEventModel.ts`.

| Field | Notes |
|---|---|
| `canonicalEventId` | Stable id; reuses `buildCanonicalEventId()` algorithm |
| `eventName` | Normalized to the neutral ladder (see §4) |
| `eventCategory` | `funnel` / `attribution` / `audit` / `traffic` |
| `eventSource` | `browser` / `edge_function` / `internal_admin` / `webhook` / `import` / `unknown` |
| `eventTime` | ISO-8601 string |
| `clientSlug` | Tenant ownership; nullable for pre-attribution traffic |
| `sourcePlatform` / `sourceChannel` | Where the upstream signal came from (independent of *destination*) |
| `leadId`, `scanSessionId`, `analysisId`, `quoteFileId` | Foreign keys into the WM data model |
| `utm.{source,medium,campaign,term,content}` | UTM snapshot |
| `attribution.{fbclidPresent,gclidPresent,fbcPresent,fbpPresent}` | Booleans only — raw values never bubble up here |
| `valueCents` / `currency` | Integer cents to avoid float drift |
| `dispatchEligible` / `dispatchBlockReason` | Single neutral dispatch flag, decoupled from any vendor mapping |
| `metadata` | Free-form context; **must NOT** carry contractor payout terms, partner commissions, raw quote files, or raw homeowner PII |

The neutral facade is intentionally *not* the persisted shape. It's a
downstream view callers can construct from the existing `wm_event_log`
row via `buildNeutralEventDraft()`. See §6 for the deferred work needed
to align the persisted columns to this view.

## 4. Event-name discipline

### 4.1 Live event names today

The DB enum `wm_event_name` and `WM_EVENT_NAMES` (TS) currently allow:

```
virtual_page_view, scan_initiated, quote_uploaded, teaser_viewed,
otp_started, otp_sent, phone_verified, report_revealed,
contractor_match_requested, appointment_booked, sold,
lead_identified, lead_qualified, quote_upload_completed,
quote_validation_passed, sale_confirmed
```

Several of these describe the same business moment under different names
(`quote_uploaded` vs `quote_upload_completed` vs `quote_validation_passed`;
`lead_identified` vs `lead_qualified`; `sold` vs `sale_confirmed`).
Existing code (`createCanonicalEvent.ts`) already absorbs the
`quote_*` triplet into the same trust-scoring path.

### 4.2 Proposed neutral ladder

```
lead_captured
phone_verified
quote_uploaded
scan_completed
report_revealed
contractor_match_requested
appointment_booked
sold_closed
```

Aliases handled by `normalizeNeutralEventName()`:

| Legacy name | Neutral name |
|---|---|
| `lead_identified`, `lead_qualified` | `lead_captured` |
| `quote_upload_completed`, `quote_validation_passed` | `quote_uploaded` |
| `sold`, `sale_confirmed` | `sold_closed` |

**Important:** live producers continue firing the legacy names. The
neutral helper only collapses them when *reading*. Renaming live event
names — including the DB enum — is explicitly deferred (see §6).

## 5. `client_configs` and future routing

Current shape:

```
public.client_configs (
  client_id              uuid,    -- FK → public.clients(id)
  google_ads_conversion_id text,
  google_ads_label         text,
  meta_pixel_id            text,
  meta_dataset_id          text,
  gtm_server_url           text,
  capi_token_secret_id     uuid,  -- pointer into vault.secrets
  ...
)
```

Future destination resolution must walk:

```
lead.client_slug
  → public.clients (slug → id)
    → public.client_configs (1:1 by client_id)
      → set of configured destinations (Meta / Google Ads / GTM Server / TikTok / …)
        → optional secret reference (vault) for each destination
          → server-side dispatcher (no secrets in the browser)
```

Hard rules for this layer:

- Browser code MUST NEVER read `client_configs`. Browser fires only push
  to `window.dataLayer`; routing is owned by GTM (browser-side) and the
  server canonical lane (server-side).
- Vault-stored secrets (e.g. `capi_token_secret_id`) are accessible only
  via SECURITY DEFINER RPCs invoked by the dispatch worker.
- Internal business structure (contractor payout terms, partner
  commissions, resale logic, contractor notes) must NEVER leave the
  trust boundary defined by `mapToMeta` / `mapToGoogle` / future
  `mapToTikTok` / `mapToGtmServer`. The neutral plane carries only
  attribution + funnel signal + value, never internal economics.

## 6. Deferred work (not in Task 1)

| Area | Future task |
|---|---|
| Schema | Migration to add `client_slug` to `wm_event_log` (currently relies on lead/scan FK lookups) |
| Schema | Migration to extend `wm_platform_name` enum with `tiktok` and `gtm_server` |
| Schema | Migration to extend `client_configs` with TikTok / additional destinations |
| Backend | Dispatcher implementation for TikTok and GTM Server (mirror `mapToMeta` / `mapToGoogle`) |
| Backend | Replace per-platform `shouldSendMeta` / `shouldSendGoogle` flags on `wm_event_log` with one neutral `dispatch_eligible` + `dispatch_block_reason` (and resolve destinations downstream) |
| Backend | Plan for sunsetting `conversion_events` / `capi_signal_logs` once `wm_event_log` + `wm_platform_dispatch_log` cover the same surface |
| Admin | Event Inspector page consuming the neutral facade; per-event suppression reasons surfaced as first-class UI |
| Admin | Per-tenant destination configuration UI (read-only first, then editable, never exposing tokens) |
| Browser | Promote `trackBusinessEvent` to canonical browser emitter once GTM rollout is formalized; deprecate direct `trackGtmEvent` calls |
| Frontend | Migrate live legacy event names to the neutral ladder *behind* a mapping layer, then drop the legacy enum values |
| Attribution | Server-side persistence of `sourcePlatform` / `sourceChannel` derived from UTM + click-id at intake time |

## 7. What was NOT done in this task (intentional)

- No live Meta / Google / TikTok / GTM Server dispatch was added.
- No browser-side `Lead`, `Purchase`, `Schedule`, OTP-verified, or
  report-revealed conversion events were added.
- No new admin pages or routes.
- No Supabase migrations.
- No schema or RLS edits.
- No changes to scanner OCR, OTP, Twilio, TruthGate, lead capture,
  Verify-to-Reveal gating, public upload flow, storage policies,
  contractor disposition, or contractor outcomes.
- No edits to `.github/workflows/supabase-migration-integrity.yml` or
  any file under `supabase/migrations/`.

## 8. Files added by Task 1

- `src/lib/tracking/neutralEventModel.ts` — neutral event contract + pure
  helpers (`normalizeNeutralEventName`, `buildNeutralEventDraft`,
  `evaluateDispatchEligibilityDraft`, `maskAttributionIds`,
  `neutralEventCategoryOf`).
- `src/lib/tracking/__tests__/neutralEventModel.test.ts` — unit tests
  for the helpers above.
- `docs/tracking/NEUTRAL_EVENT_CONTROL_PLANE.md` — this document.
