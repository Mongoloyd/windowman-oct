# Google Ads Sprint 4B — Internal Sender Design (WindowMan Master Account)

Human-operated design sprint only. **No code, deploy, migration, secret writes, worker invocation, or production touch.**

**Objective:** Specify an internal Supabase Edge Function (`google-ads-conversion-event`) that replaces the missing external `GOOGLE_ADS_DISPATCH_URL` bridge for **one WindowMan master Google Ads account** — not a contractor-owned multi-tenant ad system.

**Target staging:** `zgsofkgddpcntdvpckdq` | **Forbidden production:** `wkrcyxcnzhwjtdpmfpaf`

> **Operational role note:** **Target staging** = LIVE_ACTIVE. **Forbidden production** = LEGACY_PARENT. See [SUPABASE_ENVIRONMENT_REGISTRY.md](./SUPABASE_ENVIRONMENT_REGISTRY.md).

**Related docs:**

- [GOOGLE_ADS_4A_DIRECT_BRIDGE_SMOKE_RUNBOOK.md](./GOOGLE_ADS_4A_DIRECT_BRIDGE_SMOKE_RUNBOOK.md) — direct POST smoke pattern (superseded for staging by internal sender once built)
- [SUPABASE_TARGETING.md](./SUPABASE_TARGETING.md) — project refs
- [DISPATCH_WORKER_RUNBOOK.md](../tracking/DISPATCH_WORKER_RUNBOOK.md) — queue lifecycle (read-only context)

---

## 1. Executive Summary

**Google is enqueue-ready but send-not-ready.**

Canonical events already write `google_ads` rows to `wm_platform_dispatch_log`. `mapToGoogle` and the `dispatchWorker` Google branch exist. Outbound send fails because:

- `GOOGLE_ADS_DISPATCH_URL` is **missing** on staging
- There is **no in-repo Google sender** Edge Function
- There is **no server-side `dry_run` mode** for Google (unlike TikTok)

**Recommended architecture:** Internal Supabase Edge Function (`google-ads-conversion-event`) called by `dispatch-platform-events` via `GOOGLE_ADS_DISPATCH_URL` pointing at `functions/v1/google-ads-conversion-event` (same pattern as Meta → `capi-event`, TikTok → `tiktok-capi-event`).

**Business model:** WindowMan is the advertiser. Contractors/partners are downstream lead recipients. `client_slug` is internal routing/reporting metadata — **not** required to resolve Google Ads account credentials.

---

## 2. Current Repo-Grounded Google Path

```text
Edge Functions (qualify-homepage-lead, scan-quote, verify-otp, capture-truth-gate-lead, partner-update-disposition)
  → persistCanonicalEvent / createCanonicalEvent
  → wm_event_log (insert)
  → wm_platform_dispatch_log upsert (platform_name = google_ads, dispatch_status = pending)
      when shouldSendGoogle === true

dispatch-platform-events
  → runDispatchWorker
  → wm_claim_dispatch_rows (FIFO, up to 25 rows, all platforms)
  → google_ads branch: mapToGoogle(canonical) → sendToGoogle(payload)
  → POST GOOGLE_ADS_DISPATCH_URL (JSON body = mapped payload)

Missing URL behavior (dispatch-platform-events/index.ts):
  ok: false, retryable: false, statusCode: 400
  errorMessage: "GOOGLE_ADS_DISPATCH_URL is not configured"
  → classifyFailure → dead_letter (non-retryable)
```

**Repo files:**

| Layer | Path |
|-------|------|
| Enqueue | `supabase/functions/_shared/tracking/canonical/createCanonicalEvent.ts` |
| Mapper | `supabase/functions/_shared/tracking/canonical/mapToGoogle.ts` |
| Worker | `supabase/functions/_shared/tracking/canonical/dispatchWorker.ts` |
| Sender wiring | `supabase/functions/dispatch-platform-events/index.ts` |
| Claim RPC | `supabase/migrations/20260414170000_wm_dispatch_worker.sql` |

**Staging queue baseline (planning):** 680 pending, 10 processing, 80 suppressed, 22 dead_letter, 0 sent.

---

## 3. Business Model Alignment

```text
WindowMan-owned ads
  → WindowMan-owned funnel
  → WindowMan CRM
  → leads routed/sold/assigned to contractors downstream
```

| Concept | Design stance |
|---------|---------------|
| **Advertiser** | WindowMan master Google Ads account only at launch |
| **Contractors** | Downstream recipients; not ad-account tenants |
| **`client_slug`** | Internal routing / reporting metadata; optional on payloads; **must not gate** Google send |
| **Platform config** | WindowMan master env secrets (see §5); not per-contractor `client_platform_configs` lookup at launch |
| **Sold/value feedback** | `partner-update-disposition` → canonical `sold` event → Google conversion in **WindowMan's** account for optimization |

Legacy multi-tenant fields (`client_platform_configs.google_ads_conversion_id`, `client_slug` on `wm_event_log`) may remain for admin/reporting and **future** optional overrides — they are **not** required for v1 sender operation.

---

## 4. Proposed Internal Sender

**Working name:** `google-ads-conversion-event`

**Proposed path:** `supabase/functions/google-ads-conversion-event/index.ts`

**Role:** Accept the existing `mapToGoogle` output shape (+ optional wrapper fields), validate, optionally perform dry-run, and when authorized call Google Ads API upload for WindowMan's master account.

### 4.1 Responsibilities

| Responsibility | Detail |
|----------------|--------|
| Accept payload | Same JSON fields `sendToGoogle` POSTs today (see §9) |
| Validate shape | Required fields, attribution presence, conversion_action known |
| Auth | Internal-only (see §7) |
| `dry_run: true` | Validate only; **no Google HTTP**; return success-like response |
| PII safety | Never log raw email/phone; mask hashes and click IDs in responses/logs |
| Response | Normalized `{ success, dry_run?, reason?, request_id?, masked_proof? }` |

### 4.2 Non-responsibilities (v1)

- Per-tenant Google account resolution via `client_slug`
- Browser/GTM conversion firing
- Queue claim or write-back (owned by `dispatch-platform-events`)
- Mass queue cleanup

### 4.3 Wiring after implementation

```text
GOOGLE_ADS_DISPATCH_URL = ${SUPABASE_URL}/functions/v1/google-ads-conversion-event
GOOGLE_ADS_DISPATCH_AUTH_TOKEN = optional; prefer CAPI_DISPATCH_SECRET header parity
```

Worker `sendToGoogle` unchanged except URL points to internal function. Worker should pass `dry_run: true` until a separate live-enable sprint (mirror TikTok `TIKTOK_DISPATCH_DRY_RUN_ONLY` pattern — **future implementation**).

**This sprint does not implement the function.**

---

## 5. Master Google Config Resolution

v1 resolves **one WindowMan master account** from Edge Function secrets only. No `client_slug` lookup.

### 5.1 Placeholder secret names (no values)

| Secret | Purpose |
|--------|---------|
| `GOOGLE_ADS_CUSTOMER_ID` | Target Google Ads customer ID (no dashes) |
| `GOOGLE_ADS_CONVERSION_ACTION_ID` | Default conversion action resource ID or numeric ID for master account — **NEEDS GOOGLE ADS API VERIFICATION BEFORE IMPLEMENTATION** (may need resource name `customers/{cid}/conversionActions/{id}`) |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API developer token |
| `GOOGLE_ADS_CLIENT_ID` | OAuth 2.0 client ID |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth 2.0 client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | Long-lived refresh token for unattended server calls |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Optional MCC/manager account ID for `login-customer-id` header |

Optional operational secrets (mirror TikTok/Meta):

| Secret | Purpose |
|--------|---------|
| `CAPI_DISPATCH_SECRET` | `x-capi-dispatch-secret` header auth |
| `GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY` | When `true`, sender rejects live upload even if caller omits `dry_run` — **proposed; not in repo today** |

### 5.2 `conversion_action` mapping (wm_* → Google resource)

`mapToGoogle` emits logical names (`wm_phone_verified`, `wm_quote_uploaded`, etc.). The sender must map these to Google Ads conversion actions in the **master account**.

**v1 design options (choose at implementation):**

1. **Single env per action:** `GOOGLE_ADS_CONVERSION_ACTION_WM_PHONE_VERIFIED`, … (verbose but explicit)
2. **JSON env map:** `GOOGLE_ADS_CONVERSION_ACTION_MAP` (single secret, parsed server-side)
3. **Hardcoded map in sender** keyed by `conversion_action` string with env overrides

Default conversion action env (`GOOGLE_ADS_CONVERSION_ACTION_ID`) covers events without per-action mapping only if product accepts one action for all events — **likely insufficient**. Per-action mapping is **NEEDS GOOGLE ADS API VERIFICATION BEFORE IMPLEMENTATION**.

### 5.3 Future optional phase (not v1)

Per-`client_slug` conversion action overrides via `client_platform_configs` — document only; do not require for launch.

---

## 6. OAuth Refresh Token Setup / Recovery Plan

Google Ads API does **not** use a simple API key. Server-side upload requires OAuth 2.0 + developer token.

### 6.1 One-time human setup (staging)

| Step | Operator action |
|------|-----------------|
| 1 | Create/select Google Cloud project; enable **Google Ads API** |
| 2 | Create OAuth 2.0 **Desktop** or **Web** client; note `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` |
| 3 | Apply for **Google Ads developer token** (test access for staging; production token separate approval) |
| 4 | Identify WindowMan **master** Google Ads customer ID → `GOOGLE_ADS_CUSTOMER_ID` |
| 5 | If using MCC, set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` |
| 6 | Generate refresh token using **one** of: |
| | • [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) with scope `https://www.googleapis.com/auth/adwords` — **NEEDS GOOGLE ADS API VERIFICATION BEFORE IMPLEMENTATION** for exact scope string |
| | • Google Ads API client library local script (offline access, prompt=consent) |
| | • Dedicated repo script under `scripts/` in a **future approved sprint** (not this sprint) |
| 7 | Store refresh token in Supabase Dashboard → Edge Functions → Secrets on **`zgsofkgddpcntdvpckdq` only** |
| 8 | Create conversion actions in Google Ads UI; record resource IDs for wm_* mapping |

**No refresh token generation in this sprint. No secret values in docs.**

### 6.2 Runtime token exchange (sender design)

```text
On each request (or cached with TTL):
  POST https://oauth2.googleapis.com/token
    grant_type=refresh_token
    client_id=GOOGLE_ADS_CLIENT_ID
    client_secret=GOOGLE_ADS_CLIENT_SECRET
    refresh_token=GOOGLE_ADS_REFRESH_TOKEN
  → access_token (short-lived)

Google Ads API call:
  Authorization: Bearer {access_token}
  developer-token: {GOOGLE_ADS_DEVELOPER_TOKEN}
  login-customer-id: {GOOGLE_ADS_LOGIN_CUSTOMER_ID}  (if MCC)
```

**NEEDS GOOGLE ADS API VERIFICATION BEFORE IMPLEMENTATION** for exact REST endpoint (`uploadClickConversions` vs `uploadConversionAdjustments`), request JSON shape, and header requirements.

### 6.3 Storage location

**Recommended:** Supabase Edge Function Secrets (same pattern as `TIKTOK_ACCESS_TOKEN`, Meta tokens via Vault for tenant configs). Do **not** store refresh tokens in database columns or repo files.

Supabase Vault is used for per-client platform tokens elsewhere; for WindowMan master account, Edge Function secrets are sufficient at v1.

### 6.4 Failure / rotation runbook

| Failure | Safe behavior | Operator recovery |
|---------|---------------|-------------------|
| Refresh token revoked | Sender returns `401`/`success: false`, reason `oauth_refresh_failed`; log **no token values** | Re-run OAuth consent flow; update `GOOGLE_ADS_REFRESH_TOKEN` on staging |
| Wrong Google account | Conversions upload to wrong account or API 403 | Verify customer IDs; rotate refresh token tied to correct Google user |
| Developer token not approved | API permission errors | Use test token on staging; apply for production token before prod |
| Expired client secret | Token exchange fails | Rotate OAuth client secret in GCP + update secret |

**Safe logs on auth failure:** `reason` code, HTTP status, customer_id prefix masked, conversion_action name — never refresh token, access token, or raw PII.

### 6.5 Credential rotation runbook (operator checklist)

1. Confirm staging project ref `zgsofkgddpcntdvpckdq`
2. Generate new refresh token (§6.1 step 6)
3. Update secrets in Dashboard (human-only; no agent `supabase secrets set`)
4. Run direct sender dry-run smoke (§15)
5. Do **not** invoke `dispatch-platform-events` until worker isolation exists

---

## 7. Auth Boundary

Mirror existing internal CAPI senders (`capiRouting.ts` → `isInternalCapiAuthorized`).

### Option A — Internal dispatch secret header (recommended)

```text
Header: x-capi-dispatch-secret: <CAPI_DISPATCH_SECRET>
```

Same pattern as `tiktok-capi-event`. Allows worker to call sender without embedding service role in a custom header beyond existing patterns.

### Option B — Service-role bearer

```text
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
```

Already supported by `isInternalCapiAuthorized`. `dispatch-platform-events` already holds service role for Meta/Nextdoor/TikTok internal calls.

**Recommendation:** Support **both** (reuse `isInternalCapiAuthorized` from `_shared/capiRouting.ts`). Prefer documenting `CAPI_DISPATCH_SECRET` for parity with TikTok direct smoke templates. Optional `GOOGLE_ADS_DISPATCH_AUTH_TOKEN` on worker outbound can remain as Bearer to sender if set.

**No secret values in docs or logs.**

---

## 8. Dry-Run / Test Mode

Google has **no TikTok-style test event code**. Repo-owned dry-run is mandatory before live upload.

### 8.1 `dry_run: true` behavior

```text
1. Auth check
2. Parse + validate mapToGoogle payload shape
3. Validate conversion_action maps to a configured Google action (or report mapping_missing)
4. Require at least one of: gclid, gbraid, wbraid, hashed_email, hashed_phone_number
5. Validate OAuth/config *presence* (boolean flags only — never print values):
   - customer_id_configured
   - developer_token_configured
   - oauth_client_configured
   - refresh_token_configured
6. Build masked proof object:
   - transaction_id prefix
   - conversion_action
   - gclid_present / gbraid_present / wbraid_present
   - email_hash_prefix (first 8 chars)
   - phone_hash_prefix (first 8 chars)
   - conversion_value, currency_code
7. Do NOT call Google Ads API
8. Return HTTP 200:
   { success: true, dry_run: true, masked_proof: {...} }
```

### 8.2 `dry_run: false` behavior (live)

Requires **explicit human approval sprint** after:

- Staging dry-run smoke PASS
- Verified Google Ads API credentials on staging
- Known conversion actions created in WindowMan master account
- Google-attributed QA lead proves click-id persistence (§11)

**Must not** be combined with worker FIFO drain of 680+ pending rows.

### 8.3 Worker-level dry-run gate (future implementation)

Proposed constant (mirror TikTok):

```text
GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY = true  (worker always passes dry_run: true)
```

Separate sprint to flip live after sender validation.

---

## 9. Payload Contract

### 9.1 Input — `mapToGoogle` output (repo-verified)

Source: `supabase/functions/_shared/tracking/canonical/mapToGoogle.ts`

| Field | Type | Notes |
|-------|------|-------|
| `conversion_action` | string | e.g. `wm_phone_verified`, `wm_quote_uploaded` |
| `transaction_id` | string | Canonical `eventId`; dedup key |
| `conversion_date_time` | string | ISO timestamp |
| `conversion_value` | number | From `optimization.valueUsd ?? 0` |
| `currency_code` | `"USD"` | Fixed |
| `gclid` | string? | Click ID |
| `gbraid` | string? | iOS web-to-app |
| `wbraid` | string? | iOS web-to-app |
| `user_identifiers.hashed_email` | string? | SHA-256 hex, lowercase |
| `user_identifiers.hashed_phone_number` | string? | SHA-256 hex |

Optional wrapper fields (sender may accept for observability; not sent by worker today):

| Field | Notes |
|-------|-------|
| `dry_run` | boolean; default `true` in staging smokes |
| `client_slug` | metadata only; not used for account resolution v1 |

### 9.2 Identity hashing (already in repo)

`identity.ts` → `normalizeAndHashIdentity`:

- Email: trim + lowercase + SHA-256
- Phone: normalize US E.164 + SHA-256 on digits

Sender must **not** accept raw email/phone in upload path; reject or hash server-side if legacy callers send raw fields.

### 9.3 Google Ads API upload shape (design target)

**NEEDS GOOGLE ADS API VERIFICATION BEFORE IMPLEMENTATION**

Likely `ConversionUploadService.uploadClickConversions` or REST equivalent:

```text
customer_id: GOOGLE_ADS_CUSTOMER_ID
conversion_action: resource name or ID resolved from conversion_action map
conversion_date_time: from payload (timezone format per API spec)
conversion_value: conversion_value
currency_code: currency_code
gclid / gbraid / wbraid: as available
user_identifiers: [{ hashed_email }, { hashed_phone_number }]
partial_failure: true
order_id or transaction_id: transaction_id  (dedup — verify field name)
```

Verify: timezone format, consent flags for enhanced conversions, and whether `wm_*` actions require offline vs click conversion type.

---

## 10. Sold / Revenue Mapping

### 10.1 Current gap (repo-verified)

| Source | Event name |
|--------|------------|
| `partner-update-disposition/index.ts` | `sold` |
| `mapToGoogle.ts` `GOOGLE_ACTION_MAP` | `sale_confirmed` only |

Result: `sold` events enqueue `google_ads` rows (when `shouldSendGoogle`) but worker **suppresses** with `no_google_mapping`.

### 10.2 Recommended mapping fix (implementation sprint)

```text
sold            → wm_sale_confirmed
sale_confirmed  → wm_sale_confirmed
```

Single Google conversion action for closed-won revenue feedback to WindowMan's ad account.

### 10.3 Value / revenue fields

| Event | `conversion_value` source (today) |
|-------|-----------------------------------|
| `sold` / `sale_confirmed` | `marginUsd` from disposition (gross sale proxy) or default 1500 (`valueModel.ts`) |
| Ladder events | `VALUE_LADDER` (10–1000 USD) |
| `phone_verified`, `report_revealed` | **0** (not in ladder) — **NEEDS REPO VERIFICATION** if non-zero values required |

### 10.4 Future CRM value metadata (no schema change this sprint)

Document for downstream optimization honesty:

```text
sold_value
sold_currency
sold_at
value_source: manual | imported | estimated
revenue_truth_source: contractor_outcomes  (already in partner-update-disposition metadata)
```

Sender v1 uses `conversion_value` + `currency_code` from mapped payload only.

---

## 11. Frontend Click-ID / Attribution Persistence Requirement

Google offline/click conversion upload is only useful if click IDs captured at landing persist into canonical `payload.identity` (or are merged at worker time — see §12).

### 11.1 Repo-confirmed storage locations

| Location | Fields (from migrations / code) |
|----------|-----------------------------------|
| **`public.leads`** | Scalar: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `fbclid`, `fbc`, `landing_page`; JSONB: `attribution`, `query_params` (`20260427090000_neutral_event_control_plane.sql`) |
| **`public.leads`** | `gclid`, `wbraid`, `gbraid` promoted in `capture-truth-gate-lead` from payload + attribution merge |
| **`public.scan_sessions`** | `attribution`, `query_params`, `client_slug` (JSONB + slug) |
| **`public.wm_event_log`** | `attribution`, `query_params`, `client_slug`; canonical `payload` JSON includes `identity` |
| **`public.lead_attribution_details`** | `gclid` and paid-media spine fields (`20260425065546_...sql`) |
| **Frontend capture** | `src/lib/useUtmCapture.ts` — captures `gclid`, `gbraid`, `wbraid`, UTMs, referrer, landing page; persists `localStorage` key `wm_utm_data` |
| **Intake / arbitrage** | `useIntakeCapture.ts`, `ArbitrageEngine` — `getAttributionPayload()` at submit |
| **Truth gate** | `capture-truth-gate-lead` — merges attribution into `leads` row |

### 11.2 Gap: canonical event identity vs stored attribution

Edge functions often pass **partial** `payload.identity`:

| Function | Identity passed |
|----------|-------------------|
| `qualify-homepage-lead` | email, phone, gclid (from context) ✓ |
| `verify-otp` | phone, leadId — gclid **not** in payload |
| `scan-quote` | leadId only — gclid **not** in payload |
| `capture-truth-gate-lead` (lead_captured) | email, phone — gclid **not** in canonical identity block |

`createCanonicalEvent` copies lead/session **attribution** to `wm_event_log.attribution` but **does not** merge click IDs into `payload.identity` for `mapToGoogle`.

### 11.3 Hard requirement before live Google dispatch

```text
Before Google live dispatch (dry_run: false), a Google-attributed QA lead must prove:
  landing URL with gclid/gbraid/wbraid
    → persisted on leads / scan_sessions / wm_event_log
    → present in mapToGoogle output (via identity merge or edge function enrichment)
```

**NEEDS REPO VERIFICATION IN UPCOMING FRONTEND ATTRIBUTION AUDIT** for every production funnel path (truth gate, vault upload, OTP) — confirm end-to-end, not only `qualify-homepage-lead`.

---

## 12. Attribution Merge Gap

### 12.1 Current behavior

| Platform | Worker attribution handling |
|----------|----------------------------|
| **TikTok** | `fetchAttributionSnapshotsForEventLogs` → `buildTikTokPayload` merges `wm_event_log.attribution` + `query_params` |
| **Google** | `mapToGoogle` reads **`payload.identity` only** — no attribution snapshot merge |

### 12.2 Recommended fix (implementation sprint)

Reuse TikTok-style snapshot fetch in `dispatchWorker` Google branch **before** `mapToGoogle`:

```text
Merge into ephemeral identity (do not mutate stored payload):
  gclid  ← payload.identity.gclid ?? attribution.gclid ?? query_params.gclid
  gbraid ← payload.identity.gbraid ?? attribution.gbraid ?? query_params.gbraid
  wbraid ← payload.identity.wbraid ?? attribution.wbraid ?? query_params.wbraid
  emailHash / phoneHash ← already in payload.identity if edge function passed PII
```

Also consider promoting click IDs from `leads.gclid` scalar at canonical create time — **alternative**; pick one approach in implementation sprint to avoid double-merge bugs.

### 12.3 Consequence if unfixed

```text
If gclid/gbraid/wbraid are not in payload.identity at worker time,
mapToGoogle suppresses with missing_attribution_identifiers
unless hashed email/phone exist.
Google offline conversion matching will be weak or impossible for click-only traffic.
```

---

## 13. Enqueue Policy Gap / Queue Bloat Ruling

### 13.1 Problem (repo-verified)

`createCanonicalEvent` enqueues `google_ads` when `shouldSendGoogle === true` **without** checking:

- Whether `eventName` exists in `GOOGLE_ACTION_MAP`
- Whether `GOOGLE_ADS_DISPATCH_URL` / sender exists

Example: `lead_captured` enqueues but **always suppresses** at worker with `no_google_mapping`.

### 13.2 Options evaluated

| Option | Description | Verdict |
|--------|-------------|---------|
| **A** | Tighten enqueue gate: only enqueue `google_ads` for Google-mapped event names | **Recommended** |
| **B** | Keep broad enqueue; suppress later | Status quo; wastes queue rows |
| **C** | Add mappings for unmapped high-value events (`lead_captured` → new action) | Optional product decision; does not fix `sold` alias alone |

**Definitive recommendation: Option A** — add `isGoogleMappedEvent(eventName)` check before `dispatchPlatforms.push("google_ads")`.

Optional complement: map `sold` → `wm_sale_confirmed` (§10) so disposition events enqueue **and** send.

### 13.3 Historical staging debris

```text
Do NOT mass-suppress or delete 680 pending rows in this sprint.
Historical queue cleanup requires a separate human-approved queue triage sprint.
Future triage may: sample rows, suppress stale unmapped rows, reclaim processing rows.
This design sprint does NOT authorize SQL mutation.
```

---

## 14. Queue Safety

### 14.1 Forbidden until isolation exists

| Action | Rule |
|--------|------|
| Invoke `dispatch-platform-events` | **Do not** — FIFO claims Meta + Google + TikTok + Nextdoor |
| Drain 680 pending Google rows | **Do not** |
| Cross-platform FIFO processing | **Do not** |

### 14.2 Future worker E2E requirements

Before worker Google E2E:

- Platform-isolated claim **or** single `dispatch_id` scoped claim
- Sender dry-run PASS
- `GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY` worker gate (proposed)
- Human sprint approval

### 14.3 Stale `processing` rows

10 staging `google_ads` rows in `processing` likely indicate past worker runs interrupted mid-flight. **`wm_claim_dispatch_rows`** auto-dead-letters stale processing after 10 minutes when `attempt_count >= 5`.

**Recommendation:** Separate **queue-repair/triage sprint** — no mutation authorized here.

---

## 15. Implementation Sprint Proposal

**This proposal does not authorize itself.**

```text
Requires separate SPRINT APPROVAL before any supabase/functions/** edits.
```

### Sprint name

**Google Ads 4C — Internal Sender Scaffold + Dry-Run (Staging)**

### Goal

Implement `google-ads-conversion-event` with dry-run only; wire staging `GOOGLE_ADS_DISPATCH_URL` to internal function; fix `sold` mapping; add enqueue gate Option A; add Google attribution merge in worker.

### Allowed files (with SPRINT APPROVAL)

```text
supabase/functions/google-ads-conversion-event/**
supabase/functions/_shared/googleAds* (if needed)
supabase/functions/_shared/tracking/canonical/mapToGoogle.ts  (sold alias)
supabase/functions/_shared/tracking/canonical/createCanonicalEvent.ts  (enqueue gate)
supabase/functions/_shared/tracking/canonical/dispatchWorker.ts  (attribution merge)
supabase/functions/dispatch-platform-events/index.ts  (URL wiring, dry_run passthrough)
src/lib/tracking/canonical/*  (mirror shared modules if repo policy requires)
docs/ops/GOOGLE_ADS_4C_* runbook
scripts/deploy-functions-forensic-v2-live.ps1  (human-operated deploy list only — if required by manifest)
```

### Forbidden files / systems

```text
OTP / scanner / report reveal surfaces
wm_platform_dispatch_log bulk SQL mutation
dispatch-platform-events worker invocation until 4D isolation sprint
production wkrcyxcnzhwjtdpmfpaf
live dry_run: false without separate approval
```

### Tests required

```text
mapToGoogle sold alias unit test
createCanonicalEvent: lead_captured does NOT enqueue google_ads
google-ads-conversion-event: dry_run success, missing attribution fail, auth fail
dispatchWorker: Google branch merges attribution into identity (unit)
```

### Deploy requirements

Human-operated staging deploy via `scripts/deploy-functions-forensic-v2-live.ps1` on **`zgsofkgddpcntdvpckdq` only**.

Secrets set human-only in Dashboard (§5, §6).

Set:

```text
GOOGLE_ADS_DISPATCH_URL = https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/google-ads-conversion-event
GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY = true
```

### Dry-run smoke test plan

1. Direct POST to `google-ads-conversion-event` with fake QA payload + `dry_run: true` (mirror TikTok 3C-5)
2. Confirm `success: true`, `dry_run: true`, masked proof, no Google API call
3. Confirm `wm_platform_dispatch_log` counts unchanged (no worker)
4. Optional: single-row worker test **only** after 4D isolation — not in 4C

### Rollback

- Unset `GOOGLE_ADS_DISPATCH_URL` on staging
- Redeploy prior function version
- Do not delete queue rows

### Human approval gate

- OAuth refresh token setup complete (§6)
- Conversion actions created in WindowMan master account
- Sprint owner sign-off before `dry_run: false`

### What not to touch

Meta CAPI, TikTok CAPI, Nextdoor CAPI, funnel UX, production project.

---

## Appendix A — Event → Google mapping reference

| `eventName` | Enqueued today? | `GOOGLE_ACTION_MAP` | Notes |
|-------------|-----------------|----------------------|-------|
| `lead_identified` | Yes | `wm_lead_identified` | qualify-homepage-lead |
| `lead_qualified` | If emitted | `wm_lead_qualified` | No current edge emitter found |
| `quote_uploaded` | Yes | `wm_quote_uploaded` | scan-quote, start-upload-scan-session |
| `quote_upload_completed` | If emitted | `wm_quote_uploaded` | Legacy alias |
| `quote_validation_passed` | Yes | `wm_quote_validation_passed` | scan-quote; extra trust gate |
| `phone_verified` | Yes | `wm_phone_verified` | verify-otp |
| `report_revealed` | Yes | `wm_report_revealed` | verify-otp |
| `appointment_booked` | If emitted | `wm_appointment_booked` | contractor-actions logs event_logs only — **NEEDS REPO VERIFICATION** for canonical path |
| `sale_confirmed` | If emitted | `wm_sale_confirmed` | |
| `sold` | Yes | **missing** → suppress | partner-update-disposition |
| `lead_captured` | Yes (when flag on) | **missing** → suppress | capture-truth-gate-lead |

---

## Appendix B — Comparison to Meta / TikTok senders

| Aspect | Meta | TikTok | Google (proposed) |
|--------|------|--------|-------------------|
| Sender EF | `capi-event` | `tiktok-capi-event` | `google-ads-conversion-event` |
| Worker URL | internal `functions/v1/capi-event` | internal `functions/v1/tiktok-capi-event` | internal `functions/v1/google-ads-conversion-event` |
| Auth | service role + CAPI_DISPATCH_SECRET | same | same |
| Tenant routing | client_slug required (Meta) | client_slug required | **WindowMan master only v1** |
| Dry-run | test_event_code (Meta) | `dry_run: true` | repo `dry_run: true` (no Google test code) |
| Attribution merge in worker | via Meta payload build | yes (snapshot) | **needed** |

---

*Last updated: 2026-06-24 — design sprint 4B only. No implementation authorized.*
