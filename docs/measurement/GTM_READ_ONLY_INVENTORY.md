# GTM Read-Only Inventory — WindowMan Production Baseline

**Status:** Inventory complete (read-only). No GTM workspace edits. No publication. No production uploads.  
**Captured:** 2026-07-16  
**Surface:** `https://windowman.app/` (production)  
**Method:** Published `gtm.js` decode + live dataLayer / Network / Consent Mode ICS inspection + Vitest contract proofs

---

## 1. GTM container identification

| Field | Value | Evidence |
|---|---|---|
| Public container ID | **GTM-K3M99HSM** | [`index.html`](../../index.html) snippet + live `gtm.js?id=GTM-K3M99HSM` |
| Secondary container ID seen in macros | **GTM-W7D4JN4V** | Constant macro inside published `gtm.js` (used by custom template macros; not the page snippet) |
| Environment | **Production** (single container for all deploys) | No staging GTM ID in repo |
| Active workspace (draft) | **Not inspected via UI** — inventory used **published `gtm.js`**, which is the live baseline | Google Preview default = workspace draft; published JS = live |
| Published configuration source | Live `https://www.googletagmanager.com/gtm.js?id=GTM-K3M99HSM` (~416 KB) | Downloaded 2026-07-16 |
| Published version number (UI) | **Requires Tag Manager Admin → Versions** (not exposed in public `gtm.js`) | Operator must screenshot Versions row |
| Account / owner | **Requires Tag Manager Admin → Account + User Management** | Operator fill-in |
| Google tag / GA4 measurement ID | **G-CQG8HJQGM7** | Macro constant + Network `tid=` |
| Server-side first-party collect | `https://sgifgyly.apd.stape.io` | Google Tag `server_container_url` |
| TikTok pixel | `D8IK7ORC77UDLID69P0G` | Macro + Network |
| Nextdoor pixel | `99ce86f1-c249-4f6f-82f6-dd34361895ed` | Tags + Network `flask.nextdoor.com/pixel` |

### Operator fill-in (GTM UI — Versions / Users)

Record these once in Tag Manager (Admin → Versions / User Management). Do **not** Preview the draft workspace for baseline.

| Field | Operator value |
|---|---|
| GTM account name / ID | _TBD_ |
| Internal container numeric ID | _TBD_ |
| Published version # / name / time / publisher | _TBD_ |
| Container admins | _TBD_ |
| Active workspace name (for future edits) | _TBD — create `homepage-micro-conversions-v1` later_ |

---

## 2. Published GTM inventory (from live `gtm.js`)

### 2a. Custom-event / predicate triggers

| # | Predicate | Meaning |
|---|---|---|
| 0 | Event equals `quote_uploaded` | WindowMan dataLayer conversion |
| 1 | Event equals `gtm.js` | Container load |
| 2 | Click Text contains `View Live Scan…` | Click trigger filter |
| 3 | Event equals `gtm.click` | Built-in click |
| 4 | Click Text contains `Calculate Final Risk Score…` | Click trigger filter |

**Absent from published triggers (critical gap):**  
`engaged_session`, `scroll_depth`, `form_start`, `cta_hover`, `exit_intent`, `quality_page_view`, `virtual_page_view`, `truth_gate_viewed`, `consent_update`, `lead_magnet_captured`, `phone_verified`, `report_revealed`, `contractor_match_requested`.

### 2b. Rules (tag firing map)

| Rule | When | Tags fired (tag_id) |
|---|---|---|
| A | `quote_uploaded` | 40 (TikTok), 43 (GA4 `SubmitForm`), 57 (Nextdoor `LEAD`) |
| B | `gtm.js` | 45 (Google Tag), 56 (Nextdoor `PAGE_VIEW`), 60 (GA4 `page_view`), 49 (TikTok HTML), 61–63 (click listeners) |
| C | Click “View Live Scan…” | 53 (TikTok), 58 (Nextdoor `INITIATE_CHECKOUT`) |
| D | Click “Calculate Final Risk Score…” | 54 (TikTok), 59 (Nextdoor `PURCHASE`) |

### 2c. Tags

| tag_id | Type | Destination event / role | Notes |
|---|---|---|---|
| 45 | `__googtag` | Google tag **G-CQG8HJQGM7** via Stape | `send_page_view=true`, `server_container_url=https://sgifgyly.apd.stape.io` |
| 60 | `__gaawe` | GA4 event **`page_view`** | Params: `event_id`, `event_time`, `page_url`, `user_agent`, `ttclid`, `ttp`, `external_id` |
| 43 | `__gaawe` | GA4 event **`SubmitForm`** | Params include **`email`, `phone`, `fn`, `ln`, city, country, zip** from DLVs |
| 56 | `__cvt_KD25J` | Nextdoor **PAGE_VIEW** | Pixel `99ce86f1-…` |
| 57 | `__cvt_KD25J` | Nextdoor **LEAD** | Fires on `quote_uploaded` |
| 58 | `__cvt_KD25J` | Nextdoor **INITIATE_CHECKOUT** | Click CTA |
| 59 | `__cvt_KD25J` | Nextdoor **PURCHASE** | Click CTA (misaligned naming risk) |
| 40/53/54 | `__cvt_249420178_32` | TikTok Events | Pixel `D8IK7ORC77UDLID69P0G` |
| 49 | `__html` | TikTok pixel bootstrap | Custom HTML |
| 61–63 | `__cl` | Click listeners | Support click triggers |

### 2d. Variables (macros) — privacy-relevant

| Macro role | Source |
|---|---|
| Event name | `__e` |
| GA4 ID | Constant `G-CQG8HJQGM7` |
| Stape URL | Constant `https://sgifgyly.apd.stape.io` |
| TikTok pixel | Constant `D8IK7ORC77UDLID69P0G` |
| **PII DLVs** | `user_data.email`, `user_data.phone`, `user_data.first_name`, `user_data.last_name`, address fields |
| Derived | Email lower/trim JS; phone digits-only JS; UUID `external_id` cookie |
| Click text | `__aev` TEXT |
| URL / path / host | `__u` components |

**Red flag:** GA4 `SubmitForm` maps email/phone/name DLVs. WindowMan `pushLowIntentEvent` strips top-level PII, but these DLVs expect a `user_data.*` shape that could be populated by other pushes or Enhanced Measurement user-provided data.

### 2e. Nextdoor (browser GTM)

Nextdoor tags **are live** on published container:

- PAGE_VIEW on every `gtm.js` load (confirmed Network: `flask.nextdoor.com/pixel?...&ev=PAGE_VIEW`)
- LEAD on `quote_uploaded`
- INITIATE_CHECKOUT / PURCHASE on homepage CTA click text

**Inventory policy:** Do **not** add `quality_page_view` (or other micro-events) to Nextdoor until correlation + consent approval. Existing Nextdoor PAGE_VIEW already fires without Consent Mode default.

---

## 3. GA4 property inventory (observed + Admin TBD)

| Area | Observed | Admin UI still needed |
|---|---|---|
| Measurement ID | **G-CQG8HJQGM7** | Property ID, stream ID, stream URL |
| Google tag deployment | GTM `__googtag` → Stape sGTM | Confirm linked GTM container in GA4 Admin |
| Enhanced Measurement — page views | **ON** (history change produced SPA `page_view`) | Confirm toggle label |
| Enhanced Measurement — scroll | **ON** (`en=scroll`, `percent=90`) | Confirm 90% setting |
| Enhanced Measurement — forms | **Likely OFF or not triggered** — no GA4 `form_start`/`form_submit` collect observed during Truth Gate focus | Confirm toggles |
| Key events | Unknown | List in Admin |
| Custom definitions | Unknown | Quota used/remaining |
| Filters / retention / redaction / ads links | Unknown | Admin export |

### Custom definition policy (do not register)

Do **not** register: `wm_timestamp`, `visitor_id`, `lead_id`, `event_id`, session-unique IDs, duplicate page fields, raw UTMs as custom dimensions.

---

## 4. GA4 Enhanced Measurement collision audit

| Measurement | Observed behavior | Ownership decision |
|---|---|---|
| Initial page view | **Two** `en=page_view` collects to G-CQG8HJQGM7 within ~5ms (Google Tag `send_page_view=true` **and** GA4 Event tag 60) | **Exactly one owner required.** Prefer Google Tag only; **pause GA4 Event `page_view` tag 60** (or set `send_page_view=false` and keep one event tag — not both). |
| SPA route page view | `virtual_page_view` in dataLayer **and** GA4 `page_view` on `/signin` via history change; GTM also emits `gtm.historyChange-v2` | **Owner: WindowMan `virtual_page_view` via new GTM tag** (allowlisted params). **Disable Enhanced Measurement “Page changes based on browser history events”** after WindowMan SPA tag exists. Until then, document double SPA counting. |
| Form start | WindowMan `form_start` in dataLayer; **no** GA4 `form_start` collect observed | **Owner: WindowMan.** Keep Enhanced Measurement form interactions **OFF** (or confirm OFF). When adding GA4 tag, use WindowMan event only. |
| Scroll depth | WindowMan `scroll_depth` 25/50/75 in dataLayer (**no** GA4 tag); GA4 Enhanced Measurement `scroll` at **90%** collected; also `gtm.scrollDepth` in dataLayer | **Coexistence:** Keep GA4 90% `scroll` for built-in reporting **or** disable it and rely on WindowMan milestones — not both in the same explorations without clear naming. WindowMan milestones need a **new** GA4 event `scroll_depth` (different name from `scroll`). |

**Do not change production until ownership decisions are approved.** Decisions above are recommended based on observation.

---

## 5. Consent initialization and first-load timing audit

### Critical findings

1. **`ConsentBanner` is dead code** — [`src/components/consentBanner.tsx`](../../src/components/consentBanner.tsx) is **not imported** by `App.tsx` or any other module. No banner in DOM on production.
2. **No `gtag('consent', 'default', …)`** in [`index.html`](../../index.html) or [`main.tsx`](../../src/main.tsx).
3. **No GTM Consent Initialization tag** observed in published container predicates/tags.
4. Live ICS state on first load:

```
usedDefault: false
usedUpdate: false
usedImplicit: true
wasSetLate: false
ad_storage / analytics_storage / ad_user_data / ad_personalization: implicit
```

5. **Measurement fires before any consent UI** (~550–700ms): GTM → Google Tag/GA4 (Stape), Nextdoor PAGE_VIEW, TikTok pixel.

| Check | Result |
|---|---|
| Default denied before tags? | **No** — implicit grant |
| Consent Initialization tag? | **Not present** in published config |
| First-visit pre-banner window | Banner **never mounts** |
| Reject All / Accept All | **N/A** — UI not wired |
| `consent_update` event | Not observed (banner never runs) |
| Consistency of consent types | All four ad/analytics types implicit together |

---

## 6. Browser dataLayer captures (six micro-events)

**Method:** Post-interaction `window.dataLayer.filter(...)` (no `push` monkey-patch).  
**Contract tests:** `npx vitest run src/lib/tracking/__tests__/dataLayer.test.ts src/components/tracking/NextdoorMicroTracking.test.tsx` → **42/42 passed**.

### Envelope confirmation

`pushLowIntentEvent` → attribution merge → strip forbidden keys → `trackGtmEvent` appends `event` + `wm_timestamp` last. Observed objects match.

### Captured examples (PII-scrubbed attribution may include prior QA click IDs from browser storage)

#### `scroll_depth` (50%)

```json
{
  "event": "scroll_depth",
  "page_path": "/",
  "scroll_percent": 50,
  "scroll_unit": "percent",
  "wm_intent": "has_quote",
  "client_slug": "direct",
  "wm_timestamp": "2026-07-16T08:22:25.230Z"
}
```

Also captured: 25%, 75% once each. **No uploaded-document keys.**

#### `form_start`

```json
{
  "event": "form_start",
  "page_path": "/",
  "form_id": "truth_gate_contact",
  "form_step": "1",
  "field_name": "first_name",
  "wm_timestamp": "2026-07-16T08:22:24.138Z"
}
```

**PII check:** `email`/`phone`/`value` keys **absent**. Input value length **0**. Email field focus did not fire a second `form_start`.

#### `cta_hover`

```json
{
  "event": "cta_hover",
  "page_path": "/",
  "cta_id": "header_primary_desktop",
  "cta_location": "header",
  "hover_duration_ms": 2000,
  "wm_timestamp": "2026-07-16T08:22:31.940Z"
}
```

#### `engaged_session`

```json
{
  "event": "engaged_session",
  "page_path": "/",
  "active_time_seconds": 30,
  "engagement_definition": "30s_active_foreground",
  "wm_timestamp": "2026-07-16T08:23:19.942Z"
}
```

#### `quality_page_view`

```json
{
  "event": "quality_page_view",
  "page_path": "/",
  "active_time_seconds": 30,
  "scroll_percent": 50,
  "qpv_definition": "30s_active_and_50_scroll",
  "qpv_version": "v1",
  "wm_timestamp": "2026-07-16T08:23:19.944Z"
}
```

#### `exit_intent`

```json
{
  "event": "exit_intent",
  "page_path": "/",
  "exit_method": "desktop_chrome",
  "wm_timestamp": "2026-07-16T08:24:01.994Z"
}
```

### Product-phase unmount (no production upload)

Proven by unit tests in `NextdoorMicroTracking.test.tsx` (cleanup / suppressExitIntent / leadCaptured). Live upload **not** performed (read-only production boundary).

---

## 7. Network + destination verification (not “tag fired” alone)

| DataLayer event | GTM tag for event? | Network to G-CQG8HJQGM7 | Destination note |
|---|---|---|---|
| `virtual_page_view` | **No** dedicated tag | SPA history still sent `en=page_view` (Enhanced Measurement) | WindowMan event **not** forwarded as custom event |
| `engaged_session` | **No** | **None** | Not in GA4 |
| `scroll_depth` | **No** | **None** for `scroll_depth`; Enhanced Measurement sent `en=scroll` @ 90% | Collision / different event |
| `form_start` | **No** | **None** | Not in GA4 |
| `cta_hover` | **No** | **None** | Not in GA4 |
| `exit_intent` | **No** | **None** | Not in GA4 |
| `quality_page_view` | **No** | **None** | Not in GA4; **must not** go to Nextdoor yet |
| (load) | Google Tag + GA4 `page_view` | **Two** `en=page_view` | Duplicate initial page views |
| (load) | Nextdoor PAGE_VIEW | `flask.nextdoor.com/pixel?...ev=PAGE_VIEW` | Fires without consent default |
| (load) | TikTok | `analytics.tiktok.com` | Fires without consent default |

**GA4 DebugView:** Requires operator session with debug mode + Admin access. Network collect proves events reaching Stape/GA4 pipeline; DebugView screenshots remain an operator follow-up for parameter UI confirmation.

---

## 8. Tightened parameter allowlist (GTM → GA4)

### Initial reporting parameters (register as custom definitions only if needed)

`wm_intent`, `client_slug`, `form_id`, `form_step`, `field_name`, `cta_id`, `cta_location`, `exit_method`, `qpv_version`, `qpv_definition`

Optional low-cardinality: `engagement_definition`, `scroll_percent`, `scroll_unit`, `active_time_seconds`, `hover_duration_ms`

### Withhold from GA4 custom mappings

`wm_timestamp`, `visitor_id`, `lead_id`, `event_id`, `session_id`, `scan_session_id`, all click IDs (`gclid`, `fbclid`, `ttclid`, `ndclid`, `msclkid`, `gbraid`, `wbraid`), raw UTMs (use GA4 campaign attribution), any input/document/report fields

---

## 9. Source-to-report truth tables

Legend for Tag / Network / Destination columns:  
**Observed** = proven this inventory · **Contract** = frontend/docs only (no production write) · **Gap** = dataLayer exists, no GTM tag

### 9a. Micro-conversion + acquisition

| Event | User action | Frontend | GTM | Tag | Network | Destination | Reporting | Decision |
|---|---|---|---|---|---|---|---|---|
| Landing `page_view` | Open `/` | GTM bootstrap + Google Tag | `gtm.js` rule | Google Tag + GA4 Event `page_view` | **2×** `en=page_view` via Stape | GA4 property G-CQG8HJQGM7 | Sessions / Users | Deduplicate ownership |
| `virtual_page_view` | SPA route change | `AppTrackingProvider` | **No custom trigger** | — | Enhanced Measurement `page_view` may fire | GA4 (history) | SPA pages inflated | Own SPA via WindowMan tag; disable EM history PV |
| `engaged_session` | 30s active foreground on homepage | HomepageMicroConversionTracker | **Gap** | — | — | — | — | Diagnostic only; add GA4 tag |
| `scroll_depth` | Cross 25/50/75% | same | **Gap** | — | EM `scroll`@90% only | GA4 `scroll` ≠ WM milestones | Content placement | Add `scroll_depth` GA4 event; decide on EM 90% |
| `quality_page_view` | 30s + 50% scroll | same | **Gap** | — | — | — | — | Traffic quality; no Nextdoor |
| `truth_gate_viewed` | `#truth-gate` view | `pushTruthGateViewedOnce` | **Gap** | — | — | — | — | CTA→gate conversion |
| `form_start` | Focus marked Truth Gate field | attributes only | **Gap** | — | — | — | Form friction | WindowMan owns; keep EM forms off |
| `cta_hover` | Fine-pointer hover ≥2s | same | **Gap** | — | — | — | Diagnostic vs clicks | Never optimize ads |
| `exit_intent` | Exit modal trigger | ExitIntentPhoneModal | **Gap** | — | — | — | Abandonment | Pair with modal CTA + capture |

### 9b. Downstream funnel (contract + published GTM; no production write)

| Event | User action | Frontend owner | GTM today | Tag / Network | Reporting / Decision |
|---|---|---|---|---|---|
| `lead_magnet_captured` | Capture API success | `dataLayer.ts` | **No trigger** | Gap | Form start→capture CRO |
| `quote_uploaded` | Upload + session success | `UploadZone.tsx` | Trigger exists | TikTok + GA4 `SubmitForm` + Nextdoor LEAD | High-intent; audit PII params on SubmitForm |
| `phone_verified` | OTP success | PostScanReportSwitcher | **No trigger** | Gap (server CAPI authoritative) | OTP friction |
| `report_revealed` | Full report authorized | PostScanReportSwitcher | **No trigger** | Gap (server CAPI) | Reveal reliability |
| `contractor_match_requested` | Handoff CTA | PostScanReportSwitcher | **No trigger** | Gap | Trust/urgency |

### 9c. Funnel CRO matrix

| Transition | Question | Primary events |
|---|---|---|
| Session → engagement | Is traffic qualified; is opening persuasive? | `engaged_session` |
| Engagement → quality view | Does page hold attention deeply? | `quality_page_view` |
| Quality → TruthGate | Is CTA/value prop convincing? | `truth_gate_viewed`, `cta_hover` (diagnostic) |
| TruthGate → form start | Does contact gate create anxiety? | `form_start` |
| Form start → capture | Validation/privacy friction? | `lead_magnet_captured` |
| Capture → upload | Post-capture momentum? | `lead_magnet_upload_cta_clicked`, `quote_uploaded` |
| Upload → verification | OTP friction? | `phone_verified` |
| Verification → reveal | Scan/reveal health? | `report_revealed` |
| Reveal → contractor request | Trust + urgency? | `contractor_match_requested` |

---

## 10. Duplicate / missing / PII findings

| Severity | Finding |
|---|---|
| **P0** | No Consent Mode default; ConsentBanner not mounted; ads/analytics pixels fire immediately |
| **P0** | Duplicate initial GA4 `page_view` (Google Tag + Event tag) |
| **P0** | Nextdoor PAGE_VIEW + TikTok fire on every load without consent gating |
| **P1** | Six micro-events present in dataLayer but **zero** GTM→GA4 tags |
| **P1** | Enhanced Measurement SPA `page_view` + WindowMan `virtual_page_view` naming split |
| **P1** | Scroll: WM `scroll_depth` + GA4 `scroll`@90% + `gtm.scrollDepth` |
| **P1** | GA4 `SubmitForm` maps email/phone/name DLVs — PII risk if `user_data` ever populated |
| **P2** | Nextdoor PURCHASE mapped to click text “Calculate Final Risk Score” (semantic mismatch) |
| **P2** | Canonical funnel events (`phone_verified`, `report_revealed`, etc.) missing from browser GTM (server lane may still send) |
| **Info** | `form_start` PII boundary holds on frontend (attributes only) |
| **Info** | Attribution fields (`visitor_id`, click IDs) present in dataLayer — must not be allowlisted into GA4 custom params |

---

## 11. Prioritized GTM implementation backlog (document only)

1. **Consent Mode foundation** — Add `consent default` denied (or regional) **before** GTM tags; mount ConsentBanner (or equivalent); add Consent Initialization tag; gate GA4/TikTok/Nextdoor on `analytics_storage` / `ad_storage`.
2. **Fix double `page_view`** — Single owner for initial page view.
3. **Enhanced Measurement ownership** — Apply decisions in §4 (history PV, forms OFF, scroll coexistence).
4. **Workspace** `homepage-micro-conversions-v1` branched from **published** version.
5. **Six Custom Event triggers** + allowlisted DLVs (one key each) + six GA4 Event tags (explicit parameter maps; no object passthrough).
6. **Custom definitions** only for tightened allowlist; stay within quota.
7. **Exceptions** — consent denied; optionally `page_path` ≠ `/` for homepage-only micros.
8. **Audit / quarantine** GA4 SubmitForm PII parameter map and Nextdoor PURCHASE click mapping.
9. **Do not** send `quality_page_view` (or micros) to Nextdoor until correlation study.
10. Preview workspace → approve → publish → **24–48h** DebugView / Realtime monitoring → rollback = re-publish inventory baseline version.

### Publish / rollback (future)

| Step | Action |
|---|---|
| Pre-publish | All acceptance gates green; Preview **workspace** vs published baseline |
| Publish | Changelog references published version recorded in §1 |
| Monitor | 24–48h for duplicate page_view, consent blocks, missing micros |
| Rollback | Admin → Versions → publish prior baseline |

---

## 12. Acceptance gates

| Gate | Status |
|---|---|
| Published GTM baseline inventoried (via live `gtm.js`) | **Pass** (UI version # still operator fill-in) |
| GA4 measurement ID + EM scroll/page_view observed | **Pass** (full Admin inventory TBD) |
| Enhanced Measurement ownership decisions documented | **Pass** (recommended; not applied) |
| Consent timing documented | **Pass** — critical gap found |
| Source-to-report tables for full funnel | **Pass** |
| Six micro-event shapes match frontend contract | **Pass** |
| `form_start` identifiers only | **Pass** |
| No production uploads / DB writes | **Pass** |
| Product-phase unmount via tests | **Pass** (42 tests) |
| Network verification (not tag-fired alone) | **Pass** — micros have **no** GA4 hits |
| Tightened parameter allowlist | **Pass** |
| Funnel CRO matrix | **Pass** |
| Zero GTM edits/publications this inventory | **Pass** |
| Nextdoor not given new micro-event mappings | **Pass** (existing PAGE_VIEW noted) |
| Implementation backlog drafted | **Pass** |
| GA4 DebugView UI screenshots | **Deferred** — operator with GA4 Admin |
| GTM Admin account/version/owner fields | **Deferred** — operator fill-in §1 |

---

## 13. Repo anchors

- [`index.html`](../../index.html) — GTM-K3M99HSM
- [`src/lib/tracking/dataLayer.ts`](../../src/lib/tracking/dataLayer.ts) — `pushLowIntentEvent`
- [`src/lib/trackConversion.ts`](../../src/lib/trackConversion.ts) — `trackGtmEvent`
- [`src/components/tracking/HomepageMicroConversionTracker.tsx`](../../src/components/tracking/HomepageMicroConversionTracker.tsx)
- [`src/components/ExitIntentPhoneModal.tsx`](../../src/components/ExitIntentPhoneModal.tsx)
- [`src/components/consentBanner.tsx`](../../src/components/consentBanner.tsx) — **unmounted**
- [`docs/tracking/EVENT_OWNERSHIP_MODEL.md`](../tracking/EVENT_OWNERSHIP_MODEL.md)
- [`docs/measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md)
