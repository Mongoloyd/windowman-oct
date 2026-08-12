# Canonical Intake Route/Event Matrix — Current → Target

**Status:** Proposed — operator review requested
**Implementation authority:** None
**Audience:** Operators reviewing the identity glossary; engineers preparing a later protected sprint
**Scope:** One row per distinct intake surface. Measures current runtime against [CANONICAL_IDENTITY_GLOSSARY.md](./CANONICAL_IDENTITY_GLOSSARY.md). Does not authorize schema, Edge Function, or measurement-owner edits.

> **Architectural precedence:** The [glossary](./CANONICAL_IDENTITY_GLOSSARY.md) defines target meanings. This matrix measures each surface against those meanings. Do not encode today's inconsistent runtime names as the target.
> **Subordinate to:** [AGENTS.md](../../AGENTS.md), [CANONICAL_IDENTITY_GLOSSARY.md](./CANONICAL_IDENTITY_GLOSSARY.md), [VERIFY_TO_REVEAL_CONTRACT.md](../reveal/VERIFY_TO_REVEAL_CONTRACT.md), [CANONICAL_MEASUREMENT_ARCHITECTURE.md](../measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md), [EVENT_OWNERSHIP_MODEL.md](./EVENT_OWNERSHIP_MODEL.md), [.cursor/PROTECTED_FILES.md](../../.cursor/PROTECTED_FILES.md)
> **Does not authorize:** migrations, Edge Function deploys, `AppTrackingProvider` edits, new browser conversion events, unique indexes, or runtime ID rewiring.

---

## 1. How to read this matrix

Each surface uses the same columns:

| Column | Required content |
|---|---|
| Route | Actual mounted route or ingestion entry |
| Surface | Modal, inline form, upload bootstrap, native ingestion, etc. |
| Current ID ownership | Exact runtime source for every applicable ID |
| Current capture backend | Edge Function/RPC or explicitly none |
| Current events | Exact dataLayer, operational, and server events |
| Current persistence | Tables/JSON fields actually written |
| Target contract | Required glossary behavior |
| Gap | Concrete divergence, not proposed implementation |
| Protected tier | A / B / C / D or unprotected |
| Owner | Frontend, backend, measurement, privacy, or operator |
| Evidence | Exact file and line |
| Acceptance test | Observable pass/fail condition |
| Disposition | Adopt, migrate, accepted exception, or unresolved |

### Three lanes (keep separate)

| Lane | Code | What it is | What it is not |
|---|---|---|---|
| **UI** | dataLayer / browser lifecycle | `lead_capture_*`, `lead_magnet_captured`, low-intent CTA events | Meta Lead, CAPI, OTP authorization |
| **SRV** | Server-authoritative canonical events and vendor dispatch | `wm_event_log`, consent persistence, platform dispatch | Browser-only completion |
| **AUTH** | OTP / scanner / report authorization | `scan_session_id`, `verify-otp`, report-access | `lead_id` + marketing `session_id` |

Do not collapse `/scan` opening into lead capture. Do not fabricate browser IDs for native ingestion. Do not classify `lead_id` + `session_id` as authorization. Do not apply the homepage trusted-lead upload rejection rule to `/scan` (see rows 10–12).

### Corrections applied in this draft

1. **`lead_magnet_captured` is UI/dataLayer.** It fires in the browser after capture API success. It is not a server-authoritative canonical event and must not be mapped to Meta Lead.
2. **Lifecycle envelope does not require `visitor_id`.** Follow glossary §7: `session_id`, `capture_attempt_id`, `landing_visit_id`, post-success `lead_id`, `route`, `variant`, `entry_point`, sanitized `attribution`. `visitor_id` remains a separate optional browser-profile ID.
3. **Protected-tier split:** measurement owners (`AppTrackingProvider`, dataLayer, CAPI/dispatch) are **Tier C**. Schema and migrations are **Tier B**.
4. **Attribution parity** means parity of the **approved privacy-safe projection** (the sanitized snapshot already allowed into dataLayer / capture metadata / canonical event `source`+`metadata`), not a raw dump of cookies, PII, or full `query_params`.

---

## 2. Unresolved operator decisions

Operator review of this matrix **and** the glossary must resolve these before any Tier B/C sprint. This document does not choose them.

| # | Decision | Why it is blocked | If left unresolved |
|---|---|---|---|
| **D1** | **30-minute `session_id` inactivity rotation** | Rotating `session_id` after a lead already exists changes whether the visit still maps to that lead. | Do not implement rotation, unique `leads.session_id`, or inactivity timers. |
| **D2** | **Arbitrage: migrate vs accepted exception** | `/about` uses `capture-arbitrage-lead` with no dataLayer and a different session model. | Do not rewrite arbitrage onto the TruthGate envelope. |
| **D3** | **One visit → at most one canonical lead** | Current Edge Function *intends* session reuse but lookup-then-insert is not race-safe, and `leads.session_id` is not unique. | Do not add a unique index or atomic upsert until duplicates are audited and this invariant is accepted (or rejected in favor of `capture_attempt_id` idempotency). |
| **D4** | **Tab-instance uniqueness vs `sessionStorage` copy-on-duplicate** | Duplicating a same-origin tab (or opening with an opener) can copy `sessionStorage`, so a single canonical key does **not** guarantee a new tab gets a new `session_id`. Combined with D3, the second tab would reuse the first tab's lead and consent. | Do not treat `sessionStorage` alone as the D3 lead-dedup boundary. An implementation sprint must mint a tab-instance ID that is regenerated in copied tabs (clone detection) before uniqueness ships. |

---

## 3. Shared current-state facts (do not repeat per row)

| Fact | Evidence |
|---|---|
| `public.leads.id` is Postgres-generated | `supabase/migrations/20260317051701_bdf3572f-5d3e-4662-b4db-31d55ae58ece.sql:3-4` |
| Session reuse is lookup-then-insert, not atomic | `supabase/functions/capture-truth-gate-lead/index.ts:724-731` |
| Canonical `lead_captured` is gated | `CANONICAL_LEAD_CAPTURED_ENABLED` at `capture-truth-gate-lead/index.ts:74-75`; ID override at `:292-293` |
| Pre-capture dataLayer sets `lead_id` from `getLeadId()` | `src/lib/tracking/dataLayer.ts:68-87` |
| `getLeadId()` is a persistent browser profile, not `public.leads.id` | `src/lib/useLeadId.ts:1-14,39-58` |
| `AppTrackingProvider` does not own visit `session_id` | `src/components/AppTrackingProvider.tsx:49-53,72-75` |

Target UI lifecycle events (`lead_capture_opened`, `lead_capture_started`, `form_fields_completed`, `lead_capture_completed`) **do not exist** in the repo today. Where a row says “UI: none for lifecycle,” that is the gap.

### Mounted capture-surface inventory (`src/App.tsx`)

Verified against current route mounts. Every production capture path must have a matrix row (or an explicit sibling row). Visual/dev/sandbox routes are out of scope.

| Mounted route | Capture? | Matrix row |
|---|---|---|
| `/nq` | Yes — modal | §4.1 |
| `/nq2` | Yes — modal | §4.1a |
| `/nq3` | Yes — modal | §4.2 |
| `/nq4` | Yes — modal | §4.3 |
| `/windowman` | Yes — modal | §4.4 |
| `/window-prices` | Yes — inline | §4.5 |
| `/window-price-audit` | Yes — inline | §4.5a |
| `/ai-demo` | Yes — inline | §4.5a |
| `/truth-report` | Yes — inline | §4.5a |
| `/quote-check` | Yes — inline, then upload handoff | §4.5b |
| `/` `#truth-gate` | Yes — inline | §4.6 |
| `/lp/:slug` | Yes — homepage re-export | §4.13 |
| `/nextdoor` | Yes — Track B / Track C | §4.7–4.8 |
| `/about` | Yes — feature-flagged arbitrage | §4.9 |
| `/scan` | Route open: no. Prototype modal: no persist. Upload: yes, **without** `lead_id` | §4.10–4.12 |
| Native webhook | Yes — no browser route | §4.14 |

---

## 4. Surface matrix

### 1. `/nq` — capture modal

| Column | Content |
|---|---|
| **Route** | `/nq` |
| **Surface** | Modal — `CampaignNqCaptureDialog` |
| **Current ID ownership** | `session_id`: component-memory UUID (`useState(createUuid)`), lost on remount. `capture_attempt_id`: absent; consent uses `submissionIdRef` (not bound to modal open). `landing_visit_id`: absent. `visitor_id`: `getLeadId()` / `wm_lead_id` (misnamed). `lead_id`: server-only after success. `scan_session_id`: not created. |
| **Current capture backend** | `capture-truth-gate-lead` via `submitCampaignNqLead` → `submitTruthGateLead` |
| **Current events** | **UI:** no `lead_capture_*`; `lead_magnet_captured` after success via `truthGateLeadCapture.ts`. **SRV:** gated `lead_captured` in `wm_event_log`; `emitLeadActivity` (`truth_gate_captured`); OpenAI `lead_created` only for new consented truth-gate-family inserts. **AUTH:** none at capture. |
| **Current persistence** | `public.leads` insert/reuse (`session_id`, PII scalars, `attribution`, `query_params`, OTP-safe defaults); consent batch keyed by `submissionId`. No `lead_capture_metadata`. |
| **Target contract** | Central tab-scoped `session_id`; `capture_attempt_id` per modal open; `landing_visit_id` per landing mount; glossary UI envelope (no required `visitor_id`); `lead_magnet_captured` remains UI/dataLayer after server success; `lead_id` ≠ `visitor_id`. |
| **Gap** | Session not tab-stable; no `landing_visit_id`; no lifecycle UI events; `submissionId` not named/bound to modal open; session owner fragmented vs NQ3/NQ4. |
| **Protected tier** | Frontend host **unprotected**. `capture-truth-gate-lead` and dataLayer are **Tier C**. Schema uniqueness / migrations are separately **Tier B** (not authorized). |
| **Owner** | Frontend (modal/host IDs); backend (atomic session dedupe, if D3 accepted); measurement (lifecycle events). |
| **Evidence** | Session: `src/pages/CampaignNQ/useCampaignNqCapture.ts:30`. Submit: `useCampaignNqCapture.ts:86-94`; `campaignNqLeadCapture.ts:50-64`. Modal: `CampaignNqCaptureDialog.tsx:16`. |
| **Acceptance test** | Open modal twice in the same tab → same `session_id`, different `capture_attempt_id`. Close/reopen → new `capture_attempt_id`. SPA navigation in-tab preserves `session_id`. Post-success dataLayer `lead_id` equals `public.leads.id`, not `wm_lead_id`. |
| **Disposition** | **Migrate** |

---

### 1a. `/nq2` — capture modal

| Column | Content |
|---|---|
| **Route** | `/nq2` (`src/App.tsx:213`) |
| **Surface** | Modal — `CampaignNq2CaptureDialog` |
| **Current ID ownership** | `session_id`: component-memory UUID (`useState(createUuid)`), lost on remount — **independent of `/nq`**. `capture_attempt_id`: absent; consent uses `submissionIdRef` (rotated on marketing-consent change). `landing_visit_id`: absent. `visitor_id`: `getLeadId()`. `lead_id`: server-only after success. `scan_session_id`: not created. |
| **Current capture backend** | `capture-truth-gate-lead` via `submitCampaignNq2Lead` → `submitTruthGateLead` (temporary `wm_intent=no_quote` URL rewrite during payload build) |
| **Current events** | **UI:** no `lead_capture_*`; `lead_magnet_captured` after success via `truthGateLeadCapture.ts`. **SRV:** same gated canonical/consent path as `/nq`. **AUTH:** none at capture. |
| **Current persistence** | `public.leads` insert/reuse; consent keyed by `submissionId`. No `lead_capture_metadata`. |
| **Target contract** | Same glossary contract as `/nq`: central tab-scoped `session_id` (after D4 clone detection); `capture_attempt_id` per modal open; `landing_visit_id` per landing mount; UI envelope; `lead_magnet_captured` remains UI/dataLayer. |
| **Gap** | Own competing session owner vs `/nq` / NQ3 / NQ4. No lifecycle UI events. No `landing_visit_id`. Temporary history rewrite for `wm_intent` is a capture-time attribution side effect. |
| **Protected tier** | Frontend host **unprotected**. `capture-truth-gate-lead` and dataLayer are **Tier C**. Schema / migrations **Tier B**. |
| **Owner** | Frontend; measurement. |
| **Evidence** | Session/submit: `src/pages/CampaignNQ2/useCampaignNq2Capture.ts:31-91`. Adapter: `campaignNq2LeadCapture.ts:23-58`. Modal: `CampaignNq2CaptureDialog.tsx:14,56-60`. Route: `src/App.tsx:213`. |
| **Acceptance test** | Open `/nq2` modal twice in the same tab → same target `session_id`, different `capture_attempt_id`. `/nq` then `/nq2` in the same tab share the central visit `session_id` after migration. Post-success dataLayer `lead_id` equals `public.leads.id`. |
| **Disposition** | **Migrate** |

---

### 2. `/nq3` — universal intake modal

| Column | Content |
|---|---|
| **Route** | `/nq3` |
| **Surface** | Modal — `UniversalIntakeHost` + `Nq3IntakeSkin` |
| **Current ID ownership** | `session_id`: `getOrCreateFirstQuoteSessionId()` → `sessionStorage` `wm_first_quote_session_id`. `capture_attempt_id`: `crypto.randomUUID()` per modal open. `landing_visit_id`: component-mount ref UUID. `visitor_id`: `getLeadId()`. `lead_id`: server after success. `scan_session_id`: not created. |
| **Current capture backend** | `capture-truth-gate-lead` via `submitWindowmanFirstQuoteLead` (`source=windowman-first-quote`) |
| **Current events** | **UI:** no `lead_capture_*`; **no** `lead_magnet_captured` (first-quote service does not call `pushLeadMagnetCaptured`). **SRV:** same gated canonical/consent path as TruthGate. **AUTH:** none. |
| **Current persistence** | `public.leads` + `query_params` (`source_path=/nq3`, intake fields); consent `submissionId` = `captureAttemptId`. Attempt/visit IDs not in a dedicated metadata JSON. |
| **Target contract** | Glossary IDs; `landing_visit_id` + `capture_attempt_id` in capture metadata and UI events; central `session_id` key (not a route-specific storage key); `lead_magnet_captured` as UI/dataLayer after success. |
| **Gap** | Partial ID pattern (attempt + landing visit) with wrong `session_id` owner/key; no UI lifecycle events; no post-success `lead_magnet_captured`; IDs not in DB metadata. |
| **Protected tier** | Frontend host **unprotected**. `capture-truth-gate-lead` and measurement are **Tier C**. Schema / migrations are separately **Tier B**. |
| **Owner** | Frontend; measurement. |
| **Evidence** | IDs: `src/components/intake/universal/UniversalIntakeHost.tsx:133,152`. Session: `src/services/windowmanFirstQuoteLeadCapture.ts:21,78-98`. Submit: `src/pages/CampaignNQ3/campaignNq3LeadCapture.ts:28-43`. No dataLayer: `windowmanFirstQuoteLeadCapture.ts:188-247`. |
| **Acceptance test** | Modal open fires `lead_capture_opened` with `session_id`, `capture_attempt_id`, `landing_visit_id` (no required `visitor_id`). Successful submit fires `lead_magnet_captured` once as UI/dataLayer. Metadata records `initial_capture_attempt_id` + `landing_visit_id`. |
| **Disposition** | **Migrate** |

---

### 3. `/nq4` — universal intake modal

| Column | Content |
|---|---|
| **Route** | `/nq4` |
| **Surface** | Modal — `UniversalIntakeHost` (same host as NQ3) |
| **Current ID ownership** | Same as `/nq3` except `source_path=/nq4`. |
| **Current capture backend** | Same — `capture-truth-gate-lead` / `windowman-first-quote` |
| **Current events** | Same as `/nq3`. |
| **Current persistence** | Same; `source_path=/nq4` in `query_params`. |
| **Target contract** | Same as glossary + route/variant in metadata. |
| **Gap** | Same as `/nq3`. Shares `wm_first_quote_session_id` with NQ3 in the same tab (correct tab scope, wrong canonical owner). |
| **Protected tier** | Frontend **unprotected**. `capture-truth-gate-lead` and measurement are **Tier C**. Schema / migrations are separately **Tier B**. |
| **Owner** | Frontend; measurement. |
| **Evidence** | `src/pages/CampaignNQ4/campaignNq4LeadCapture.ts:28-43`. Host: `CampaignNq4Page.tsx` (`UniversalIntakeHost`). |
| **Acceptance test** | NQ3 then NQ4 in the same tab → one shared target `session_id`; separate `capture_attempt_id` per modal open. |
| **Disposition** | **Migrate** |

---

### 4. `/windowman` — landing CTAs + first-quote modal

| Column | Content |
|---|---|
| **Route** | `/windowman` |
| **Surface** | (A) Landing CTAs. (B) Modal — `FirstQuoteIntakeModal` |
| **Current ID ownership** | (A) No intake IDs on landing mount. (B) `session_id`: `getOrCreateFirstQuoteSessionId()`. `capture_attempt_id`: absent (`submissionIdRef` per submit/consent). `landing_visit_id`: absent. `visitor_id`: `getLeadId()`. |
| **Current capture backend** | `capture-truth-gate-lead` via `submitWindowmanFirstQuoteLead` |
| **Current events** | **UI:** `first_quote_modal_opened`, `windowman_handoff_has_quote` (low-intent); no `lead_capture_*`; no `lead_magnet_captured` from first-quote service. **SRV:** gated canonical/consent. **AUTH:** handoff to `/#truth-gate` is navigation, not authorization. |
| **Current persistence** | Same leads-row pattern; default `source_path=/windowman`. |
| **Target contract** | Landing host owns `landing_visit_id`; modal owns `capture_attempt_id`; glossary UI envelope; `lead_magnet_captured` UI/dataLayer after success. |
| **Gap** | Modal lacks `capture_attempt_id` per open; no landing visit ID; CTA events hardcode `page_path: "/windowman"` without the glossary envelope. |
| **Protected tier** | Frontend **unprotected**. `capture-truth-gate-lead` and measurement are **Tier C** (`landingTracking.ts` / dataLayer). Schema / migrations are separately **Tier B**. |
| **Owner** | Frontend; measurement. |
| **Evidence** | Modal open: `src/components/landing/landingTracking.ts:32-39`. Submit: `FirstQuoteIntakeModal.tsx:247-253`. Session: `FirstQuoteIntakeModal.tsx:37-38,154`. |
| **Acceptance test** | CTA → `lead_capture_opened` includes `landing_visit_id`. Modal reopen → new `capture_attempt_id`, same tab `session_id`. Has-quote handoff does not emit `lead_capture_completed`. |
| **Disposition** | **Migrate** |

---

### 5. `/window-prices` — inline capture form

| Column | Content |
|---|---|
| **Route** | `/window-prices` |
| **Surface** | Inline form — `WindowPricesLanding` |
| **Current ID ownership** | `session_id`: `sessionIdRef` = `createUuid()` per page mount (memory; tab-stable only while mounted). `capture_attempt_id`: absent (`submissionIdRef`). `landing_visit_id`: absent. `visitor_id`: `getLeadId()`. |
| **Current capture backend** | `capture-truth-gate-lead` via `submitWindowPricesLead` |
| **Current events** | **UI:** `lead_magnet_captured` after success (`windowPricesLeadCapture.ts:137-144`); no lifecycle events. **SRV:** gated canonical/consent. **AUTH:** none. |
| **Current persistence** | `public.leads`; zip in `query_params`; source `google_window_prices` or `nextdoor_truth_report`. |
| **Target contract** | Inline form is the intake host → `capture_attempt_id`; landing visit ID; glossary UI envelope; `lead_magnet_captured` remains UI/dataLayer. |
| **Gap** | Session in a component ref, not central `sessionStorage`; no attempt/visit IDs; no lifecycle UI events. |
| **Protected tier** | Frontend **unprotected**. `capture-truth-gate-lead` and measurement are **Tier C**. Schema / migrations are separately **Tier B**. |
| **Owner** | Frontend; measurement. |
| **Evidence** | `src/pages/WindowPricesLanding.tsx:75-79,124-126`. dataLayer: `src/services/windowPricesLeadCapture.ts:137-144`. |
| **Acceptance test** | Reload in the same tab → target `session_id` survives (today: new UUID). Success → exactly one `lead_magnet_captured` per lead/session as UI/dataLayer. |
| **Disposition** | **Migrate** |

---

### 5a. Paid-magnet siblings — `/window-price-audit`, `/ai-demo`, `/truth-report`

These are distinct mounted routes with their own in-memory session owners. They share `submitWindowPricesLead` but must not be treated as aliases of `/window-prices`.

| Column | `/window-price-audit` | `/ai-demo` | `/truth-report` |
|---|---|---|---|
| **Route** | `/window-price-audit` (`App.tsx:158`) | `/ai-demo` (`App.tsx:160`) | `/truth-report` (`App.tsx:159`) |
| **Surface** | Inline form | Inline form | Inline form |
| **Current ID ownership** | `sessionIdRef` = `crypto.randomUUID()` per mount (`WindowPriceAuditLanding.tsx:68-73`); `submissionIdRef`; no `landing_visit_id` | Same pattern (`AiDemoLanding.tsx:75-80`) | Same pattern (`TruthReportLanding.tsx:63-68`) |
| **Current capture backend** | `capture-truth-gate-lead` via `submitWindowPricesLead` | Same | Same |
| **Current events** | **UI:** `lead_magnet_captured` after success. No lifecycle events. **SRV:** gated canonical. **AUTH:** none. | Same | Same |
| **Current persistence** | `public.leads`; source `window_price_audit` | source `ai_demo` | source `truth_report_demo` |
| **Target contract** | Same glossary envelope as `/window-prices`; `source` / `route` in capture metadata | Same | Same |
| **Gap** | Independent competing session UUID vs `/window-prices` and vs each other | Same | Same |
| **Protected tier** | Frontend **unprotected**. Capture/measurement **Tier C**. Schema **Tier B**. | Same | Same |
| **Owner** | Frontend; measurement | Same | Same |
| **Evidence** | `WindowPriceAuditLanding.tsx:68-73,102-104` | `AiDemoLanding.tsx:75-80,101` | `TruthReportLanding.tsx:63-68,89` |
| **Acceptance test** | Each route persists `leads.source` matching its adapter; post-success `lead_magnet_captured` once; after migration, same-tab visit `session_id` is the central ID, not a per-page ref. | Same | Same |
| **Disposition** | **Migrate** | **Migrate** | **Migrate** |

---

### 5b. `/quote-check` — inline capture then upload handoff

| Column | Content |
|---|---|
| **Route** | `/quote-check` (`src/App.tsx:156`) |
| **Surface** | Inline capture form — `PricingSearchLanding`. This is a **lead-intake surface**, not merely an upload handoff. After success it writes funnel `leadId`/`sessionId` and navigates to `/?post_capture=upload&source=quote-check`. |
| **Current ID ownership** | `session_id`: `sessionIdRef` = `crypto.randomUUID()` per page mount (`PricingSearchLanding.tsx:100-107`). `capture_attempt_id`: absent (`submissionIdRef`). `landing_visit_id`: absent. `visitor_id`: `getLeadId()`. After success, funnel localStorage receives the **server** `lead_id` + `session_id`. |
| **Current capture backend** | `capture-truth-gate-lead` via `submitWindowPricesLead` (`source=google_quote_check`) |
| **Current events** | **UI:** `lead_magnet_captured` after capture success (via `windowPricesLeadCapture.ts`); `lead_magnet_upload_cta_clicked` immediately before auto-navigate (`PricingSearchLanding.tsx:160-167`). No `lead_capture_*`. **SRV:** gated canonical/consent. **AUTH:** none at capture; homepage upload still requires trusted identity. |
| **Current persistence** | `public.leads`; then funnel `wm_funnel_*` localStorage; homepage `UploadZone` bootstrap. |
| **Target contract** | Glossary IDs on this route's capture; `lead_magnet_captured` UI/dataLayer after server success; handoff event is UI-only; homepage upload uses the returned `lead_id` (trusted pair). Do not skip this route in a migration. |
| **Gap** | Own competing in-memory session vs `/window-prices` and vs homepage funnel localStorage. Capture and handoff are collapsed into one submit. No lifecycle envelope. |
| **Protected tier** | Frontend **unprotected**. Capture/measurement **Tier C**. Homepage upload adjacency **Tier A**. Schema **Tier B**. |
| **Owner** | Frontend; measurement. |
| **Evidence** | Session/submit: `src/pages/PricingSearchLanding.tsx:100-167`. Route: `src/App.tsx:156`. Service: `src/services/windowPricesLeadCapture.ts`. |
| **Acceptance test** | Submit on `/quote-check` → `public.leads` row with source `google_quote_check` and server `lead_id`. dataLayer has `lead_magnet_captured` then `lead_magnet_upload_cta_clicked`. Homepage upload uses that `lead_id`. Failed capture does not navigate or emit either UI event. |
| **Disposition** | **Migrate** |

---

### 6. `/` — homepage TruthGate inline capture

| Column | Content |
|---|---|
| **Route** | `/` (`#truth-gate` section) |
| **Surface** | Inline form — `TruthGateFlow` |
| **Current ID ownership** | `session_id`: `ScanFunnelProvider.sessionId` (localStorage `wm_funnel_sessionId`, cross-tab) or new `createUuid()` if missing. `capture_attempt_id`: `submissionIdRef` (consent transaction, not open-bound). `landing_visit_id`: absent. `visitor_id`: `getLeadId()`. |
| **Current capture backend** | `capture-truth-gate-lead` via `submitTruthGateLead` |
| **Current events** | **UI:** `truth_gate_viewed` (hash-gated); homepage `form_start` / `engaged_session` / `scroll_depth` / `quality_page_view` during discovery; `lead_magnet_captured` after success. Operational: `cta_scan_funnel`, `scan_started` via `trackEvent`. **SRV:** `truth_gate_captured` activity; gated `lead_captured`. **AUTH:** capture success sets funnel state only — not OTP/reveal. |
| **Current persistence** | `public.leads` (`source=truth-gate`); funnel localStorage mirror of `lead_id` / `session_id`. |
| **Target contract** | `AppTrackingProvider` owns visit `session_id` (sessionStorage); intake host owns `capture_attempt_id`; Index mount owns `landing_visit_id`; glossary UI envelope; funnel localStorage remains a resume hint, never authorization. |
| **Gap** | Marketing `session_id` in localStorage conflates visit with funnel resume and crosses tabs; no lifecycle envelope; pre-capture dataLayer may set `lead_id = visitor_id`. |
| **Protected tier** | TruthGate unlock adjacency **Tier A** (do not treat as visual-only). `capture-truth-gate-lead` and measurement are **Tier C**. Schema / migrations are separately **Tier B**. Funnel persistence is a resume hint, not AUTH. |
| **Owner** | Frontend; backend; measurement; operator (D1 rotation policy). |
| **Evidence** | Session: `src/components/TruthGateFlow.tsx:549-555`. Submit: `TruthGateFlow.tsx:557-565`. Funnel: `src/state/scanFunnel.tsx:8-9,101-103`. dataLayer drift: `src/lib/tracking/dataLayer.ts:68-87`. |
| **Acceptance test** | Capture success does not set `phone_verified` or unlock the report. Post-success UI events include server-returned `lead_id`. New tab does not share the target visit `session_id`. |
| **Disposition** | **Migrate** |

---

### 7. `/nextdoor` — Track B identity save

| Column | Content |
|---|---|
| **Route** | `/nextdoor` |
| **Surface** | Inline identity module — Track B |
| **Current ID ownership** | `session_id`: `getOrCreateNextdoorSessionId()` → `wm_nextdoor_session_id` (sessionStorage). `capture_attempt_id`: `leadCaptureSubmissionIdRef`. `landing_visit_id`: absent. `visitor_id`: `getLeadId()`. |
| **Current capture backend** | `capture-truth-gate-lead` via `submitNextdoorLead` (`source=nextdoor`, **`client_slug: null`**) |
| **Current events** | **UI:** no lifecycle; **no** `lead_magnet_captured`. **SRV:** activity name `nextdoor_lead_captured` when source is nextdoor; gated canonical `lead_captured`. **AUTH:** none. |
| **Current persistence** | `public.leads`; Nextdoor fields in `query_params`. Known dispatch risk when `client_slug` is null. |
| **Target contract** | Shared visit session + attempt/visit IDs; resolved `client_slug`; `lead_magnet_captured` as UI/dataLayer after success; no fabricated browser IDs. |
| **Gap** | Route-specific session key; `client_slug: null`; no dataLayer; no lifecycle events. |
| **Protected tier** | `capture-truth-gate-lead`, measurement, and Nextdoor dispatch are **Tier C**. Schema / migrations are separately **Tier B**. |
| **Owner** | Backend; measurement; operator (Nextdoor slug policy). |
| **Evidence** | Session: `src/lib/nextdoor/nextdoorSession.ts:1-27`. Submit: `src/pages/NextdoorHome.tsx:466-468`; `src/services/nextdoorLeadCapture.ts:98-104`. |
| **Acceptance test** | Paid Nextdoor traffic persists a non-null `client_slug`. Success fires `lead_magnet_captured` (UI/dataLayer) with real `lead_id`. |
| **Disposition** | **Migrate** |

---

### 8. `/nextdoor` — Track C contact + qualification

| Column | Content |
|---|---|
| **Route** | `/nextdoor` |
| **Surface** | Two-step inline — Track C contact save, then qualification enrich |
| **Current ID ownership** | Same session/submission refs as Track B; `persistLead` reuses `nextdoorSessionId`. |
| **Current capture backend** | Same — multiple `capture-truth-gate-lead` calls on the same `session_id` (reuse path) |
| **Current events** | **UI:** none. **SRV:** reuse + consent idempotency after `submissionId` rotation on success. **AUTH:** none. |
| **Current persistence** | Lead reuse by session; qualification in `query_params` / later patches. |
| **Target contract** | One visit → one lead **if D3 is accepted**; later steps append consent/event history without overwriting initial capture metadata. |
| **Gap** | Multi-step reuse relies on non-atomic session lookup; no per-step lifecycle telemetry; Track B vs C not distinguished in events. |
| **Protected tier** | `capture-truth-gate-lead` and measurement are **Tier C**. Schema / migrations are separately **Tier B**. |
| **Owner** | Backend; frontend. |
| **Evidence** | Track C contact: `src/pages/NextdoorHome.tsx:669-695`. Submission rotate: `NextdoorHome.tsx:485-487`. |
| **Acceptance test** | Step 1 + Step 2 → single `lead_id`. Second step gets a new consent `submission_id` and the same `session_id`. Concurrent submit does not create two leads **if D3 is accepted**. |
| **Disposition** | **Migrate** (blocked on D3 for uniqueness) |

---

### 9. `/about` — arbitrage progressive intake

| Column | Content |
|---|---|
| **Route** | `/about` (feature-flagged `WindowManIntakeLive` / `useIntakeCapture`) |
| **Surface** | Multi-step inline router — progressive capture |
| **Current ID ownership** | `session_id`: in-memory ref. Separate `event_id` ref (arbitrage dedupe, not glossary `capture_attempt_id`). `landing_visit_id`: absent. `visitor_id`: `getLeadId()` sent as `external_id`. |
| **Current capture backend** | `capture-arbitrage-lead` (staged: create → update_identity → update_timeframe) |
| **Current events** | **UI:** explicitly none. **SRV:** `emitLeadActivity` on completion stages. **AUTH:** HMAC `capture_token` for staged updates only — not OTP. |
| **Current persistence** | `public.leads` progressive; `qualification_answers_json.arbitrage`; source-scoped session lookup (not `get_lead_by_session`). |
| **Target contract** | Either adopt the shared ID/event envelope **or** remain an explicit exception. Operator must choose (D2). |
| **Gap** | No dataLayer; separate backend; different session semantics; no shared visit session with other routes. |
| **Protected tier** | Separate Edge Function changes require a named protected sprint. Schema / migrations are **Tier B**; measurement becomes **Tier C** if the envelope is adopted. |
| **Owner** | **Operator** (D2); backend. |
| **Evidence** | No tracking: `src/components/intake/useIntakeCapture.ts:14`. Session: `useIntakeCapture.ts:123-126`. Backend: `supabase/functions/capture-arbitrage-lead/index.ts:313-315`. Route: `src/pages/About.tsx:52,98-99`. |
| **Acceptance test** | If migrate: arbitrage emits the glossary UI envelope with `capture_attempt_id` per funnel open. If exception: this matrix (once accepted) states arbitrage opts out of the UI lifecycle lane. |
| **Disposition** | **Unresolved** (D2) |

---

### 10. `/scan` — route shell (not lead capture)

| Column | Content |
|---|---|
| **Route** | `/scan` (flag `VITE_SCAN_ROUTE_MOUNTED`) |
| **Surface** | Page shell — `ScanFunnelPage` → `ScanLandingExperience` |
| **Current ID ownership** | No lead-capture IDs. Upload bridge uses `sessionScopeRef` (`createUuid()` per bridge mount) as `start-upload-scan-session.session_id` — not a marketing visit session. `scan_session_id`: created on upload bootstrap. |
| **Current capture backend** | **None** for lead at route open |
| **Current events** | **UI:** none for lead lifecycle. **SRV:** upload/scan events only after a file is selected. **AUTH:** preview uses `scan_session_id`; no OTP on the `/scan` prototype path. |
| **Current persistence** | No lead row from route mount. Upload creates `scan_sessions`, `quote_files`. |
| **Target contract** | Receive global `session_id` + `landing_visit_id`. **Must not** create a lead or emit `lead_capture_completed` / `lead_magnet_captured` on route open. **Excluded from the homepage trusted-lead upload rule:** `useRealScanBridge` currently invokes `start-upload-scan-session` **without** `lead_id` (`useRealScanBridge.ts:201-213`). Requiring a trusted `lead_id` here would fail every `/scan` upload. Adding a trusted lead-capture/capability step is a separate authorized `/scan` sprint (ADR-005 / `ROUTE_SCAN.md`), not this matrix. |
| **Gap** | No central visit session; no landing visit ID; bootstrap `session_id` param is a bridge-local UUID, not the glossary marketing session; upload is not contact-owned. |
| **Protected tier** | Scanner transport / route policy **Tier A**. Measurement **Tier C** only if visit IDs are later attached. |
| **Owner** | Frontend; operator (scan rollout). |
| **Evidence** | `src/pages/ScanFunnelPage.tsx:1-27`. Bridge session/bootstrap: `src/components/scan/useRealScanBridge.ts:116,182-213`. |
| **Acceptance test** | Navigate to `/scan` → zero `capture-truth-gate-lead` calls; zero `lead_magnet_captured`. Upload still creates a distinct `scan_session_id` **without** requiring `lead_id`. A homepage `UploadZone` trusted-lead rejection must not be applied to this bridge. |
| **Disposition** | **Migrate** (IDs only — not lead capture) |

---

### 11. `/scan` — lead capture modal (prototype)

| Column | Content |
|---|---|
| **Route** | `/scan` |
| **Surface** | Modal — `LeadCaptureModal` (UI-only phase in the scan bridge) |
| **Current ID ownership** | None persisted; local form state only. |
| **Current capture backend** | **Explicitly none** |
| **Current events** | **UI / SRV / AUTH:** none |
| **Current persistence** | None |
| **Target contract** | Modal open may emit `lead_capture_opened` for UX analytics only. Must not persist a lead or emit completed/captured until a real backend is authorized. |
| **Gap** | Prototype bypasses the intake contract — acceptable only while flagged / noindex. |
| **Protected tier** | **Tier A** when wired to real capture. Prototype UI currently local-only. |
| **Owner** | Frontend; operator. |
| **Evidence** | `src/components/scan/LeadCaptureModal.tsx:1-5`. Open: `ScanLandingExperience.tsx:201-202`. |
| **Acceptance test** | Submit modal → no capture network call; no `leads` row; no `lead_magnet_captured`. |
| **Disposition** | **Accepted exception** (prototype until an authorized `/scan` intake sprint) |

---

### 12. Quote upload bootstrap

| Column | Content |
|---|---|
| **Route** | `/` (canonical homepage `UploadZone` only). **Not** `/scan`. `/quote-check` is a prior capture surface (row 5b) that hands off here. |
| **Surface** | Upload bootstrap — `UploadZone` → `start-upload-scan-session` → `scan-quote` |
| **Current ID ownership** | Bootstrap `session_id`: `sessionId \|\| sessionScope` where `sessionScope = sessionId \|\| crypto.randomUUID()`. Marketing `session_id` from funnel prop. `scan_session_id`: server-returned. `lead_id`: optional prop when a trusted pair exists. `/scan` uses a different caller (`useRealScanBridge`) that omits `lead_id`. |
| **Current capture backend** | `start-upload-scan-session`; `scan-quote` |
| **Current events** | **UI:** `quote_uploaded` (GTM/dataLayer). **Operational:** `upload_completed`, `scan_invoke_failed`. **SRV:** scanner persistence only. **AUTH:** `contact_required_before_upload` when `ENFORCE_CONTACT_OWNED_UPLOAD=1` on this public path; OTP remains downstream. |
| **Current persistence** | `scan_sessions`, `quote_files`, storage object; may link `lead_id`. |
| **Target contract** | On **homepage / post-capture handoff `UploadZone` only:** `scan_session_id` created here; marketing `session_id` binds to an existing lead; no lead creation at upload bootstrap; `lead_id` + marketing `session_id` are not OTP authorization. **`/scan` is excluded** from the trusted-`lead_id` rejection rule until an authorized `/scan` intake sprint. |
| **Gap** | Random bootstrap session when funnel `sessionId` is missing; API param name `session_id` conflates marketing visit and storage-scope UUID. Applying this row's rejection rule to `/scan` would contradict rows 10–11. |
| **Protected tier** | **Tier A** (upload / session / scanner). |
| **Owner** | Backend; frontend. |
| **Evidence** | Homepage: `src/components/UploadZone.tsx:659,881,907-921,557-565`. `/scan` omission of `lead_id`: `useRealScanBridge.ts:201-213`. Enforcement flag: `start-upload-scan-session/index.ts:663`. Handoff origin: `PricingSearchLanding.tsx:13-17,100-167`. |
| **Acceptance test** | **Homepage `UploadZone`:** upload without trusted `lead_id` → backend rejects or safe-fails when enforcement is on; with trusted pair → `scan_session_id` links to the same `lead_id`; `quote_uploaded` `event_id` is stable on retry. **`/scan`:** upload without `lead_id` still bootstraps a `scan_session_id` (this matrix must not require that call to fail). |
| **Disposition** | **Migrate** (bootstrap binding clarity) |

---

### 13. `/lp/:slug` — partner white-label browser capture

| Column | Content |
|---|---|
| **Route** | `/lp/:slug` |
| **Surface** | Homepage re-export — `LandingPage` → `Index` + TruthGate |
| **Current ID ownership** | Same as homepage TruthGate; adds `funnel.clientSlug` from validated `clients.slug`. |
| **Current capture backend** | Same — `capture-truth-gate-lead` |
| **Current events** | Same as `/` TruthGate + homepage micro-conversion |
| **Current persistence** | Same; `client_slug` stamped from partner slug |
| **Target contract** | Same glossary contract; partner slug in capture metadata. |
| **Gap** | Inherits all homepage gaps; partner slug is not in versioned capture-metadata JSON. |
| **Protected tier** | Same as homepage: `capture-truth-gate-lead` and measurement are **Tier C**; schema / migrations are **Tier B**; reveal adjacency is **Tier A**. |
| **Owner** | Frontend; backend. |
| **Evidence** | `src/pages/LandingPage.tsx:1-83`; slug set: `LandingPage.tsx:52-55`. |
| **Acceptance test** | Valid slug → captured lead `client_slug` matches. Invalid slug → redirect, no capture. |
| **Disposition** | **Migrate** (via homepage intake migration) |

---

### 14. Native lead ingestion (no browser route)

| Column | Content |
|---|---|
| **Route** | Edge entry — `ingest-native-lead` (Zapier / platform webhook) |
| **Surface** | Native ingestion — server webhook |
| **Current ID ownership** | **No browser IDs.** Platform IDs: `nd_lead_id`, form/campaign/ad IDs. Synthetic `session_id`: `ndla_{providerSubmissionId}` on insert. |
| **Current capture backend** | `ingest-native-lead` (direct DB) |
| **Current events** | **UI:** none. **SRV:** canonical `lead_captured` intentionally deferred; audit `lead_captured_deferred`. **AUTH:** none. |
| **Current persistence** | `public.leads` insert/update; native blocks in `qualification_answers_json` / attribution. |
| **Target contract** | Preserve platform lead IDs. **Do not fabricate** browser `session_id` / `landing_visit_id` / `capture_attempt_id`. Server-generated ingestion identity only. |
| **Gap** | Canonical conversion pipeline not wired. `ndla_*` is an ingestion-scoped surrogate, not a browser visit session — acceptable if documented as such. |
| **Protected tier** | Native-ingestion Edge Function changes require a named protected sprint. Schema / migrations are **Tier B**; later dispatch enablement is **Tier C**. |
| **Owner** | Backend; measurement; operator (dispatch enablement). |
| **Evidence** | `supabase/functions/ingest-native-lead/index.ts:7-8,796,894-905`. |
| **Acceptance test** | Webhook ingest → lead row with platform IDs; no browser lifecycle events; no invented `landing_visit_id`. Canonical SRV event only when operator enables that path. |
| **Disposition** | **Accepted exception** (no browser ID envelope) + **Migrate** (canonical SRV dispatch, separately) |

---

## 5. Cross-cutting rows

### C1. Global `visitor_id` (`wm_lead_id`)

| Column | Content |
|---|---|
| **Route** | All browser routes |
| **Surface** | `AppTrackingProvider` / `useLeadId` |
| **Current ID ownership** | `getLeadId()` → persistent UUID in localStorage + cookie; context field named `leadId`; dataLayer sets both `visitor_id` and `lead_id` from this value **before** a lead exists. |
| **Current capture backend** | N/A |
| **Current events** | Included in attribution snapshots on many dataLayer pushes. **Not** part of the glossary lifecycle envelope. |
| **Current persistence** | Cookie / localStorage; may appear in attribution JSON. |
| **Target contract** | Concept is `visitor_id`. Never map to `public.leads.id`. Optional 90-day TTL is policy-gated. Lifecycle events do **not** require `visitor_id`. |
| **Gap** | Naming and pre-capture `lead_id` conflation. |
| **Protected tier** | **Tier C** |
| **Owner** | Measurement; privacy; operator (TTL policy). |
| **Evidence** | `src/lib/useLeadId.ts:1-14`. `src/lib/tracking/dataLayer.ts:68-87`. `src/components/AppTrackingProvider.tsx:49-53,74`. |
| **Acceptance test** | Pre-capture dataLayer events may include `visitor_id` and must not present it as `lead_id`. `lead_id` appears only after the server returns `public.leads.id`. |
| **Disposition** | **Migrate** |

---

### C2. Central visit `session_id` (not implemented)

| Column | Content |
|---|---|
| **Route** | All browser intake routes |
| **Surface** | Target owner: `AppTrackingProvider` |
| **Current ID ownership** | Not centralized. Competing sources include `/nq` and `/nq2` component memory, `/quote-check` and magnet-page refs, `wm_first_quote_session_id`, `wm_nextdoor_session_id`, funnel localStorage, arbitrage in-memory refs. |
| **Current capture backend** | N/A |
| **Current events** | Some events carry route-local session UUIDs. |
| **Current persistence** | `public.leads.session_id` on capture; homepage also mirrors into funnel localStorage. |
| **Target contract** | One visit UUID owned by `AppTrackingProvider`, shared across intake routes in the same **tab instance**. Storage may use `sessionStorage` for reload survival, but **`sessionStorage` is not a uniqueness guarantee:** duplicate-tab / opener copy can clone the key. **D4** must be resolved (clone detection or regenerated tab-instance ID) before this ID is used as the D3 lead-dedup boundary. **D1** remains unresolved. |
| **Gap** | No central owner. Homepage uses localStorage. Unique `leads.session_id` is blocked on D3. `sessionStorage` copy-on-duplicate would make D3 reuse another tab's lead. |
| **Protected tier** | `AppTrackingProvider` **Tier C**. Unique constraint / atomic upsert **Tier B**. |
| **Owner** | Frontend; backend; **operator** (D1, D3, D4). |
| **Evidence** | Glossary §5. Lookup: `capture-truth-gate-lead/index.ts:724-731`. HTML `sessionStorage` is copied when a browsing context is duplicated. |
| **Acceptance test** | Same tab `/nq` → `/nq3` → submit: one `session_id` in all payloads. Duplicate-tab (or opener) must **not** submit the source tab's `session_id` once D4 ships. Concurrent double-submit returns the same `lead_id` **only after D3 is accepted and an atomic path ships**. |
| **Disposition** | **Migrate** + **Unresolved** (D1, D3, D4) |

---

### C3. Server `lead_captured` canonical + vendor dispatch

| Column | Content |
|---|---|
| **Route** | All `capture-truth-gate-lead` successes |
| **Surface** | Server success effects |
| **Current ID ownership** | Gated event ID override `wmc_lead_captured_lead-{leadId}_session-{sessionId}`. |
| **Current capture backend** | `maybePersistLeadCapturedCanonical` when `CANONICAL_LEAD_CAPTURED_ENABLED=true` |
| **Current events** | **SRV:** `wm_event_log` + dispatch workers. Meta map gap for `lead_captured` is documented in `CANONICAL_TRACKING_RULES.md` §8. **UI:** `lead_magnet_captured` is a separate dataLayer signal — not this event. |
| **Current persistence** | `wm_event_log`, consent tables, platform dispatch log. |
| **Target contract** | UI lifecycle ≠ vendor conversion. Dispatch keys the canonical server event only. Attribution on the server event matches the **approved privacy-safe projection** used in capture metadata / sanitized dataLayer — not raw PII. |
| **Gap** | Flag off by default; Meta mapping missing; event-ID formula not reconciled with all builders. |
| **Protected tier** | **Tier C** (measurement / dispatch). Enabling persistence of new columns would also be **Tier B**. |
| **Owner** | Measurement; operator. |
| **Evidence** | `capture-truth-gate-lead/index.ts:74-75,280-293,960-976`. `docs/tracking/CANONICAL_TRACKING_RULES.md` §8. |
| **Acceptance test** | Enabled path: one canonical row per lead/session. Meta Lead fires server-side only. UI lifecycle and `lead_magnet_captured` never map to Meta Lead. CAPI attribution equals the approved privacy-safe projection stored on the lead. |
| **Disposition** | **Migrate** (measurement sprint; not authorized here) |

---

### C4. OTP / scanner authorization (downstream — not intake)

| Column | Content |
|---|---|
| **Route** | `/`, `/report/classic/:sessionId`, post-upload flows |
| **Surface** | OTP pipeline — `usePhonePipeline`, `verify-otp`, report-access |
| **Current ID ownership** | `scan_session_id` binds OTP/reveal. Marketing `session_id` / `lead_id` are hints only. |
| **Current capture backend** | `verify-otp`, report-access Edge Functions / RPCs |
| **Current events** | **UI:** `phone_verified`, `report_revealed` (owners in `EVENT_OWNERSHIP_MODEL.md`). **SRV:** high-value CAPI. **AUTH:** backend only. |
| **Current persistence** | Phone verification / reveal timestamps on authorized paths. |
| **Target contract** | Intake `lead_id` + `session_id` **never** authorize reveal. OTP binds to `scan_session_id`. |
| **Gap** | Funnel localStorage can imply progress; must not be treated as auth (backend remains authoritative). |
| **Protected tier** | **Tier A** |
| **Owner** | Backend; measurement. |
| **Evidence** | `docs/tracking/EVENT_OWNERSHIP_MODEL.md`. `AGENTS.md` authorization rules. |
| **Acceptance test** | Lead capture alone cannot fetch `full_json`. OTP for scan session A does not unlock scan session B. |
| **Disposition** | **Adopt** (keep separate from intake migration) |

---

## 6. Attribution parity (privacy-safe projection)

**Definition used by this matrix:** attribution continuity is **parity of the approved privacy-safe projection**, not identity of every raw field that ever existed in the URL, cookies, or `query_params`.

The approved projection is the sanitized snapshot already used by:

- `buildAttributionDataLayerPayload()` / `getAttributionPayload()` after forbidden-key stripping
- Capture payloads that persist UTMs, click IDs, `client_slug`, landing path, and referrer without raw email/phone/name
- Canonical event `source` + `metadata` (no PII)

| Must match across UI snapshot, `leads` attribution JSON, and SRV event | Must not be required for “parity” |
|---|---|
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | Raw email, phone, name |
| Click IDs present in the snapshot (`fbclid`, `gclid`, `ndclid`, `ttclid`, …) | Full unsanitized `query_params` blob |
| `client_slug` (when policy requires it) | `visitor_id` inside the lifecycle envelope |
| Landing path / referrer as already captured | Nextdoor engagement score |
| | Meta browser `Lead` |

A route **fails** attribution parity when the approved projection present at submit is dropped or rewritten (for example Nextdoor `client_slug: null`, or a hardcoded `/windowman` path replacing the real route) — not when a forbidden PII key is absent from dataLayer.

---

## 7. Disposition summary

| Disposition | Surfaces |
|---|---|
| **Migrate** | `/nq`, `/nq2`, `/nq3`, `/nq4`, `/windowman`, `/window-prices`, `/window-price-audit`, `/ai-demo`, `/truth-report`, `/quote-check`, homepage TruthGate, Nextdoor Track B/C, `/scan` route shell (IDs only; upload remains prototype exception), homepage upload bootstrap, `/lp/:slug`, C1 `visitor_id`, C2 session owner, C3 canonical SRV dispatch |
| **Adopt** | C4 OTP/scanner authorization lane (keep separate) |
| **Accepted exception** | `/scan` `LeadCaptureModal` (prototype, no persist); `/scan` upload bootstrap without `lead_id` until an authorized `/scan` intake sprint; native ingestion (no browser IDs) |
| **Unresolved** | Arbitrage (D2); 30-minute session rotation (D1); one-visit→one-lead uniqueness (D3); tab-instance clone detection (D4) |

---

## 8. Next artifacts (prescribed order)

1. ✅ [Canonical ID glossary](./CANONICAL_IDENTITY_GLOSSARY.md)
2. ✅ **This matrix**
3. ⬜ Executable audit checklist — one pass/fail per acceptance-test cell, grouped by UI / SRV / AUTH
4. ⬜ Migration plan + named protected sprint — only after operator sign-off on D1–D4 and glossary acceptance

---

## 9. Related documents

| Document | Relationship |
|---|---|
| [CANONICAL_IDENTITY_GLOSSARY.md](./CANONICAL_IDENTITY_GLOSSARY.md) | Target ID meanings this matrix measures against |
| [EVENT_OWNERSHIP_MODEL.md](./EVENT_OWNERSHIP_MODEL.md) | Business vs operational event owners |
| [CANONICAL_TRACKING_RULES.md](./CANONICAL_TRACKING_RULES.md) | Casing, event-ID dedupe, known vendor gaps |
| [CANONICAL_MEASUREMENT_ARCHITECTURE.md](../measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md) | Browser vs server measurement policy |
| [VERIFY_TO_REVEAL_CONTRACT.md](../reveal/VERIFY_TO_REVEAL_CONTRACT.md) | OTP/reveal authorization |

---

## Operator sign-off

| Field | Value |
|---|---|
| Decision owner | _pending_ |
| Review date | _pending_ |
| Accepted / rejected | _pending_ |
| D1 30-minute rotation | _pending_ |
| D2 Arbitrage migrate vs exception | _pending_ |
| D3 One visit → one lead | _pending_ |
| D4 Tab-instance clone detection | _pending_ |
| Sprint name (if accepted) | _pending_ |

When accepted, promote this document to **CANONICAL** in [DOC_STATUS_REGISTRY.md](../ops/DOC_STATUS_REGISTRY.md) only after D1–D4 are recorded. Acceptance of this matrix still does **not** authorize protected implementation.
