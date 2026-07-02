# Nextdoor Native Lead Form Ingestion — Architecture Spec

> **Status:** Planning artifact only. No runtime implementation in this document’s authoring pass.
>
> **Branch audited:** `forensic_report_v2`
>
> **Last updated:** 2026-07-02

---

## 1. Status and Scope

This document is the canonical planning spec for ingesting **Nextdoor Native Lead Form** submissions through **Zapier Webhooks** into WindowMan’s Supabase-backed lead system.

**In scope (this document):**

- Architecture decision and repo evidence
- Future Edge Function contract (design only)
- Data model, idempotency, event separation, and security posture
- Manual verification checklist for a future implementation sprint

**Out of scope (explicit non-actions in §17):**

- Implementing `ingest-native-lead`
- Migrations, RLS changes, deploys, secrets, or any Supabase mutation
- Changes to OTP, report reveal, quote scan/upload, contractor routing, or platform dispatch behavior

**Critical repo truth:**

- `supabase/functions/ingest-native-lead/index.ts` **does not exist yet.** — **CONFIRMED** (glob search returned zero matches)
- **This pass does not implement `ingest-native-lead`.** Only this markdown file is created/updated.
- `public.native_lead_submissions` **does not exist yet.** — **CONFIRMED** (repo search returned zero matches). Treat as **Phase 2 only** if ops requires a submission-level ledger beyond existing tables.

---

## 2. Executive Recommendation

In a **future approved build**, add a provider-neutral Edge Function:

```text
supabase/functions/ingest-native-lead/index.ts
```

**Structural template:** [`supabase/functions/import-facebook-lead-ad/index.ts`](../../supabase/functions/import-facebook-lead-ad/index.ts) — **CONFIRMED** as the closest existing server-to-server lead import pattern (secret-gated POST, flexible field parsing, `leads` + `lead_attribution_details` writes, service-role boundary).

**Do not** wrap [`supabase/functions/capture-truth-gate-lead/index.ts`](../../supabase/functions/capture-truth-gate-lead/index.ts) for Zapier native leads. That function is browser/session/TruthGate-oriented (see §5).

**Phase 1 raw archive:** [`public.lead_attribution_details.raw_payload`](../../supabase/migrations/20260425064117_0cea2d49-b627-4ddc-bbad-f5a77872d488.sql) — **CONFIRMED** column exists; Facebook import already stores full inbound JSON there.

**Do not** use [`public.webhook_deliveries`](../../supabase/migrations/20260404021605_0b0bef5a-396d-4ea7-9976-4ea7d4a37b99.sql) for inbound Zapier payloads (see §6).

**Conversion posture:** Native ingestion may emit **at most** `lead_captured`, and **only** through the backend canonical event lane (`wm_event_log` via `persistCanonicalEvent`) when the repo’s existing env gate allows it. Native ingestion must **never** emit high-value conversion events or call platform CAPI routers directly (see §10).

**Zapier configuration:** URL and shared secret values must be configured in Zapier and Supabase Edge secrets **later** during an approved implementation/deploy pass — **not hardcoded** in this repo or in this document.

---

## 3. Current Repo Evidence Summary

Each finding uses: **Finding → Evidence → File → Risk → Recommendation** and a confidence level.

### 3.1 Lead capture / import Edge Functions

| Function | Role | Confidence |
|---|---|---|
| `capture-truth-gate-lead` | TruthGate + on-site Nextdoor intake (`source: "nextdoor"` from client) | **CONFIRMED** |
| `import-facebook-lead-ad` | Facebook Lead Ads server import | **CONFIRMED** |
| `capture-arbitrage-lead` | Progressive ArbitrageEngine capture | **CONFIRMED** |
| `capture-power-tool-demo-lead` | No-quote demo funnel | **CONFIRMED** |
| `qualify-homepage-lead` | Homepage qualification + optional canonical `lead_identified` | **CONFIRMED** |
| `ingest-native-lead` | — | **NOT FOUND** |

**Finding:** Only `import-facebook-lead-ad` matches inbound webhook import today.

**Evidence:** Function inventory under `supabase/functions/*/index.ts`; Facebook import writes `leads` + `lead_attribution_details` (`import-facebook-lead-ad/index.ts` ~L291–435).

**File:** `supabase/functions/import-facebook-lead-ad/index.ts`

**Risk:** A new ad-hoc import without shared idempotency increases duplicate paid leads.

**Recommendation:** Future `ingest-native-lead` mirrors Facebook import spine, not TruthGate.

---

### 3.2 Support for `source = "nextdoor"`

**Finding:** `nextdoor` is a recognized normalized source for lead derivation and on-site capture.

**Evidence:**

- `deriveLeadSourceFromSource.ts` maps `nextdoor: "nextdoor"` — **CONFIRMED**
- `src/services/nextdoorLeadCapture.ts` sends `source: "nextdoor"` to `capture-truth-gate-lead` — **CONFIRMED**
- `capture-truth-gate-lead/index.ts` emits CRM activity `nextdoor_lead_captured` when `source === "nextdoor"` — **CONFIRMED**

**File:** `supabase/functions/_shared/deriveLeadSourceFromSource.ts`, `src/services/nextdoorLeadCapture.ts`, `supabase/functions/capture-truth-gate-lead/index.ts`

**Risk:** On-site Nextdoor funnel and Zapier native forms may share `leads.source` semantics but differ in identity keys (browser `session_id` vs platform lead ID).

**Recommendation:** Distinguish channel in `lead_attribution_details`: `source_platform='nextdoor'`, `source_channel='native_lead_form'` (or equivalent), `import_source='ingest-native-lead'`.

---

### 3.3 Nextdoor attribution fields (`ndclid`, `nd_lead_id`, `nd_form_id`, `nd_ad_id`, `nd_ad_group_id`, `nd_campaign_id`)

**Finding:** These keys are stored in **JSON attribution surfaces**, not as scalar columns on `public.leads`.

**Evidence:**

- `attributionMerge.ts` allowlist includes `nd_lead_id`, `nd_form_id`, `nd_ad_id`, `nd_ad_group_id`, `nd_campaign_id` — **CONFIRMED**
- `src/lib/nextdoor/attributionHelpers.ts` handoff keys include `ndclid` and all `nd_*` IDs — **CONFIRMED**
- `src/integrations/supabase/types.ts` grep for scalar `ndclid` / `nd_lead_id` on `leads` — **NOT FOUND** — **CONFIRMED absent**

**File:** `supabase/functions/_shared/attributionMerge.ts`, `src/lib/nextdoor/attributionHelpers.ts`, `src/integrations/supabase/types.ts`

**Risk:** Zapier payloads must normalize `nd_lead_id` → `lead_attribution_details.platform_lead_id` for unique-index dedup.

**Recommendation:** Map native IDs into attribution detail scalar columns; preserve full Zapier body in `raw_payload`.

---

### 3.4 Flexible JSON on `public.leads`

**Finding:** `leads` includes JSON/JSONB bags suitable for selected answers.

**Evidence:** `types.ts` — `attribution`, `query_params`, `qualification_answers_json`, `manual_entry_data` — **CONFIRMED**

**File:** `src/integrations/supabase/types.ts`

**Risk:** `qualification_answers_json` is namespaced by other flows (e.g. ArbitrageEngine uses `.arbitrage` in `capture-arbitrage-lead`).

**Recommendation:** Store parsed custom answers under a namespaced key (e.g. `qualification_answers_json.native_lead.custom_answers`); full evidence stays in `lead_attribution_details.raw_payload`.

**Note:** Column `custom_answers_json` — **NOT FOUND** in repo — **NEEDS REPO VERIFICATION** (search returned zero matches).

---

### 3.5 Raw inbound payload archive

**Finding:** No dedicated native-lead archive table today. Closest existing archive: **`lead_attribution_details.raw_payload`**.

**Evidence:** Migration `20260425064117_...sql` defines `raw_payload jsonb`; Facebook import sets `raw_payload: payload.rawPayload` — **CONFIRMED**

**File:** `supabase/migrations/20260425064117_0cea2d49-b627-4ddc-bbad-f5a77872d488.sql`, `supabase/functions/import-facebook-lead-ad/index.ts`

**Risk:** Without submission-level status columns, reject/duplicate audit relies on `event_logs` + attribution row lookups.

**Recommendation:** Phase 1 use `lead_attribution_details`; Phase 2 `native_lead_submissions` only if ops requires ingestion pipeline history.

---

### 3.6 `lead_attribution_details` platform IDs and raw payloads

**Finding:** Table stores `platform_lead_id`, `raw_payload`, and unique `(source_platform, platform_lead_id)`.

**Evidence:** Migration L13–14, L55–57; RLS internal operator SELECT + service_role ALL — **CONFIRMED**

**File:** `supabase/migrations/20260425064117_0cea2d49-b627-4ddc-bbad-f5a77872d488.sql`

**Recommendation:** Reuse for Nextdoor native (`source_platform='nextdoor'`).

---

### 3.7 `webhook_deliveries` purpose

**Finding:** **Outbound** contractor/CRM delivery queue — not inbound archive.

**Evidence:**

- Table created with `lead_id`, `event_type`, retry/delivery fields — **CONFIRMED**
- `process-webhook/index.ts` drains pending rows and POSTs to `CRM_WEBHOOK_URL` — **CONFIRMED**
- `dispatch-lead/index.ts` header: drains `webhook_deliveries` to contractor destinations — **CONFIRMED**
- Migration `20260421084637_...sql` enqueues `qualified_lead` on `phone_verified + latest_analysis_id` — **CONFIRMED**

**File:** `supabase/migrations/20260404021605_0b0bef5a-396d-4ea7-9976-4ea7d4a37b99.sql`, `supabase/functions/process-webhook/index.ts`, `supabase/functions/dispatch-lead/index.ts`

**Recommendation:** Do not write Zapier payloads to `webhook_deliveries` (see §6).

---

### 3.8 Status / disposition fields

**Finding:** Leads carry operator-facing state; contractor outcomes are separate.

**Evidence:** `types.ts` — `status`, `funnel_stage`, `deal_status`, `admin_disposition`, OTP/report fields — **CONFIRMED**; `partner-update-disposition/index.ts` writes `contractor_outcomes.disposition_state` — **CONFIRMED**

**File:** `src/integrations/supabase/types.ts`, `supabase/functions/partner-update-disposition/index.ts`

**Recommendation:** Native ingest sets safe defaults only (`phone_verified=false`, `report_unlocked_at=null`); disposition remains admin/partner paths.

---

### 3.9 Event ladder and telemetry lanes

**Finding:** Two-lane model — operational vs business/conversion.

**Evidence:** `docs/tracking/NEUTRAL_EVENT_CONTROL_PLANE.md` §1.3 — `event_logs` (operational), `wm_event_log` (canonical business truth) — **CONFIRMED**; `docs/tracking/EVENT_OWNERSHIP_MODEL.md` — business vs operational separation — **CONFIRMED**

**Neutral ladder (recommended):** `lead_captured → phone_verified → quote_uploaded → scan_completed → report_revealed → contractor_match_requested → appointment_booked → sold_closed` — **CONFIRMED** in NEUTRAL_EVENT_CONTROL_PLANE §4.2

**Live legacy names still emitted:** `truth_gate_captured`, `nextdoor_lead_captured`, `lead_identified`, `lead_captured_with_phone` (event_logs) — **CONFIRMED**

**Recommendation:** Native ingest uses `lead_captured` in `wm_event_log` only when env gate allows; do not use `event_logs` as paid-media truth.

---

### 3.10 Business / conversion dispatch chain

**Finding:** Dispatch is worker-driven from `wm_event_log` / `wm_platform_dispatch_log`.

**Evidence:** `docs/tracking/DISPATCH_WORKER_RUNBOOK.md`; `dispatch-platform-events/index.ts`; platform senders include `capi-event`, `tiktok-capi-event`, `google-ads-conversion-event` — **CONFIRMED**

**Recommendation:** Native ingest must **not** call `dispatch-platform-events`, `capi-event`, or `nextdoor-capi-event` directly.

---

### 3.11 `nextdoor-capi-event`

**Finding:** Function **code exists**; production registration is **inconsistent** in repo config/docs.

**Evidence:**

- `supabase/functions/nextdoor-capi-event/index.ts` exists (internal-only Nextdoor CAPI sender) — **CONFIRMED**
- `supabase/config.toml` lists `capi-event` and `tiktok-capi-event` but **no** `[functions.nextdoor-capi-event]` entry — **CONFIRMED**
- `docs/ops/SUPABASE_FUNCTION_MANIFEST.md` grep for `nextdoor-capi` — **NOT FOUND** — **NEEDS REPO VERIFICATION** against live deploy state

**File:** `supabase/functions/nextdoor-capi-event/index.ts`, `supabase/config.toml`, `docs/ops/SUPABASE_FUNCTION_MANIFEST.md`

**Recommendation:** Do not change CAPI routing in native-ingest sprint; verify live manifest before relying on Nextdoor dispatch chain.

---

## 4. Existing Native Lead Import Pattern

The closest existing pattern is **`import-facebook-lead-ad`** — **CONFIRMED**.

| Mechanism | Behavior | File reference |
|---|---|---|
| Auth | `x-import-secret` or Bearer vs `FACEBOOK_LEAD_AD_IMPORT_SECRET` | `import-facebook-lead-ad/index.ts` L242–248 |
| Parsing | Flexible `field_data` / camelCase keys | L96–145 |
| Identity | Requires `platform_lead_id`; email **or** phone | L171–191 |
| Dedup | Lookup `(source_platform, platform_lead_id)` then email/phone on `leads` | L291–327 |
| Archive | `lead_attribution_details.raw_payload` | L412 |
| Events | `event_logs` only (`facebook_lead_ad_imported` / `_deduped`) — **no** `wm_event_log lead_captured` | L437–460 |
| OTP safety | Insert sets `phone_verified: false` | L373–375 |

**Confidence:** **CONFIRMED** from function source.

**Gap for Nextdoor native:** Facebook dedup falls back to email before phone (L305–327) — future ingest must prioritize **platform submission ID** and treat email-only dedup as last resort (see §9).

**On-site Nextdoor (not Zapier):** `nextdoorLeadCapture.ts` invokes `capture-truth-gate-lead` with `source: "nextdoor"` — **CONFIRMED**. That path is not a server webhook import.

---

## 5. Why Not `capture-truth-gate-lead`

**Finding:** `capture-truth-gate-lead` is the public TruthGate front door for browser sessions, not Zapier server ingest.

**Evidence:**

- Requires UUID `session_id` (`parseAndValidate`, L505–511) — **CONFIRMED**
- Requires valid email (`invalid_email` if missing, L523–530) — **CONFIRMED**
- Idempotency via RPC `get_lead_by_session` — session-oriented — **CONFIRMED**
- Emits `emitLeadActivity` → `nextdoor_lead_captured` when `source === "nextdoor"` — **CONFIRMED**
- Optional `persistCanonicalEvent` → `lead_captured` when `CANONICAL_LEAD_CAPTURED_ENABLED=true` — **CONFIRMED**

**File:** `supabase/functions/capture-truth-gate-lead/index.ts`

**Risk:** Wrapping this function for Zapier would conflate Verify-to-Reveal session semantics with native form submissions, and could emit wrong CRM/canonical events.

**Recommendation:** Do not wrap for Zapier. Use future `ingest-native-lead` instead.

---

## 6. Why Not `webhook_deliveries`

**Finding:** `webhook_deliveries` is **outbound** delivery infrastructure.

**Evidence:**

- Created as per-lead outbound queue with `event_type`, retry state (`20260404021605_...sql`) — **CONFIRMED**
- `process-webhook` reads pending rows and POSTs to external CRM URL — **CONFIRMED**
- `dispatch-lead` drains queue to contractor/webhook destinations — **CONFIRMED**
- Enqueue trigger fires on qualified lead gate (`phone_verified` + `latest_analysis_id`), not on marketing form receipt — **CONFIRMED**

**Files:** `supabase/migrations/20260404021605_0b0bef5a-396d-4ea7-9976-4ea7d4a37b99.sql`, `supabase/functions/process-webhook/index.ts`, `supabase/functions/dispatch-lead/index.ts`, `supabase/migrations/20260421084637_0fa51b04-0d9d-47f5-aea3-5d10c4cd0290.sql`

**Risk:** Storing inbound Zapier payloads here conflates CRM outbound routing with marketing ingestion audit and may trigger wrong downstream delivery assumptions.

**Recommendation:** Do not insert inbound native lead payloads into `webhook_deliveries`. Do not call `process-webhook` or `dispatch-lead` from native ingest.

---

## 7. Recommended Future Architecture

**Target flow (future implementation only):**

```text
Zapier
  → POST /functions/v1/ingest-native-lead
  → verify x-native-lead-secret (before parse/store)
  → require x-native-lead-provider: nextdoor
  → parse provider-specific body (flexible field map)
  → archive raw payload → lead_attribution_details.raw_payload
  → normalize identity + nd_* attribution into leads + attribution rows
  → enforce idempotency (platform_lead_id first)
  → upsert leads (OTP/report-safe defaults)
  → if new: optionally persistCanonicalEvent → lead_captured (env-gated)
  → return stable JSON (200 + duplicate:true on retry)
```

**Do not call in v1 native ingest:**

- `capture-truth-gate-lead`
- `dispatch-lead`
- `process-webhook`
- `scan-quote`, `send-otp`, `verify-otp`, `report-access`
- `capi-event`, `nextdoor-capi-event`, `tiktok-capi-event`, `google-ads-conversion-event`
- `dispatch-platform-events`

**Option comparison (future build decision — already resolved):**

| Option | Verdict |
|---|---|
| **A:** New `ingest-native-lead` | **Recommended** |
| **B:** Wrap `capture-truth-gate-lead` | **Reject** (§5) |
| **C:** Extend `import-facebook-lead-ad` in place | **Reject** as primary path (Facebook-specific); **reuse patterns** only |

---

## 8. Data Model Recommendation

### Phase 1 (no new table — recommended default)

| Surface | Purpose |
|---|---|
| `public.leads` | Normalized identity, routing (`client_slug`), attribution JSON, selected answers |
| `public.lead_attribution_details` | Provider attribution, `platform_lead_id`, **`raw_payload`** full Zapier evidence |
| `public.event_logs` | Operational ingest audit (`native_lead_ingest_received` / `_deduped`) — not conversion truth |
| `public.wm_event_log` | At most one `lead_captured` per platform lead ID when env gate enabled |

**Preferred Phase 1 raw archive:** `lead_attribution_details.raw_payload` — **CONFIRMED** column exists.

**Selected answers (not full raw evidence):** namespaced JSON under existing `leads.qualification_answers_json` or `leads.manual_entry_data` — **CONFIRMED** columns exist; **`custom_answers_json` column NOT FOUND**.

### Phase 2 (optional migration — not authorized in this pass)

Table name candidate: `native_lead_submissions` — **does not exist yet**.

Evaluate only if ops requires: `ingestion_status`, `reject_reason`, `idempotency_key` as first-class queryable history separate from attribution rows.

**Required security if Phase 2 is approved later:**

- Service-role write only
- RLS locked down; admin/operator read via approved backend path only
- Unique constraint on `idempotency_key` or `(provider, provider_submission_id)`
- No browser/client writes; no public SELECT on raw PII

---

## 9. Idempotency and Deduplication Rules

**Do not use email-only deduplication as primary strategy.**

**Recommended hierarchy (future implementation):**

1. **`provider_submission_id` / `nd_lead_id`** → `lead_attribution_details.platform_lead_id` with `source_platform='nextdoor'` (unique index) — **CONFIRMED** index exists in migration
2. **`phone_e164`** on `leads` — only when platform ID missing; do not merge unrelated submissions without strong evidence
3. **`email`** — same caution as phone
4. **`email + zip/postal_code + first_name` hash** — fallback when provider ID missing
5. **Synthetic idempotency key:** `nextdoor:<form_id>:<hash(email|phone|created_time)>` — store in attribution metadata or Phase 2 submission table

**Idempotency key when Nextdoor lead ID exists:**

```text
nextdoor:<nd_lead_id>
```

**Duplicate Zapier retry behavior (future):**

- Return HTTP **200**
- Body includes `duplicate: true`
- Do **not** create another `leads` row
- Do **not** write another `wm_event_log` `lead_captured` row
- Do **not** enqueue contractor/`webhook_deliveries`
- Write operational audit that duplicate was received (non-PII metadata only)

**Risks:**

- Spouses may share a project email
- Emails may be missing or mistyped
- Phones are often more stable but may be shared
- Zapier retries resend identical payloads
- Facebook import’s email-first fallback (L305–315) is a cautionary pattern, not a template for Nextdoor native primary dedup

---

## 10. Event and CAPI Separation

### Allowed from native lead ingestion

- **At most one** canonical business event: **`lead_captured`**
- **Only** via backend canonical lane: `persistCanonicalEvent` → `wm_event_log` when `CANONICAL_LEAD_CAPTURED_ENABLED=true` (same gate pattern as `capture-truth-gate-lead`) — **CONFIRMED** gate at `capture-truth-gate-lead/index.ts` L53–54, L263–265
- Operational telemetry in `event_logs` / optional `lead_events` — **not** paid-media truth

### Forbidden from native lead ingestion

Native ingestion must **never** emit:

- `phone_verified`
- `report_revealed`
- `appointment_booked`
- `sold` / `sold_closed` / `sale_confirmed`
- Any other high-value conversion event

Native ingestion must **never** directly call:

- Meta **`capi-event`**
- **`nextdoor-capi-event`**
- **`tiktok-capi-event`**
- **`google-ads-conversion-event`**
- GTM / browser `dataLayer`
- **`dispatch-platform-events`**

### Allowed downstream progression (unchanged repo behavior)

```text
lead_captured
  → phone_verified
  → quote_uploaded
  → scan_completed
  → report_revealed
  → contractor_match_requested
  → appointment_booked
  → sold_closed
```

Disposition feedback loop (unchanged):

```text
admin or partner disposition update
  → backend validates transition (e.g. partner-update-disposition)
  → backend writes canonical event to lead_events / wm_event_log
  → dispatch-platform-events decides eligibility
  → platform routers (Meta / Google / TikTok / Nextdoor)
```

**Not allowed:** admin UI → React → Meta CAPI directly.

### Live vs neutral event names

| Context | Name | Confidence |
|---|---|---|
| Neutral recommended | `lead_captured` | **CONFIRMED** — `docs/tracking/NEUTRAL_EVENT_CONTROL_PLANE.md` §4.2 |
| Live CRM (TruthGate Nextdoor) | `nextdoor_lead_captured` | **CONFIRMED** — `capture-truth-gate-lead/index.ts` |
| Live canonical (when gate on) | `lead_captured` in `wm_event_log` | **CONFIRMED** — `maybePersistLeadCapturedCanonical` |
| Renaming all live producers to neutral names | Deferred per NEUTRAL_EVENT_CONTROL_PLANE §4.2 | **CONFIRMED** |

**Nextdoor CAPI mapping (downstream only):** `lead_captured` → Nextdoor `"lead"` in `mapToNextdoor.ts` — **CONFIRMED**; subject to dispatch eligibility and `NEXTDOOR_CAPI_ENABLED` — **INFERRED** from `nextdoorDispatchEligibility.ts`.

---

## 11. Security Requirements

| Control | Requirement |
|---|---|
| Secret header | `x-native-lead-secret` required; constant-time compare against `NATIVE_LEAD_INGEST_SECRET` (future env var — **not set in this pass**) |
| Provider header | `x-native-lead-provider: nextdoor` required; reject unknown providers with 400 unless explicitly designed otherwise |
| Auth before parse | Verify secret **before** JSON parse, DB write, or payload logging |
| Bad secret | Return **401**; **do not log or store raw payload** |
| Content-Type | Require `application/json`; 400 on invalid JSON |
| Payload size | Enforce limit (recommend 64–128 KB); return 413; do not log body |
| PII in logs | Forbidden — log booleans, error codes, idempotency metadata only |
| Service role | Edge function service-role writes only; no browser INSERT to `leads` / archive tables |
| OTP / report | Force `phone_verified=false`, `report_unlocked_at=null`, `otp_state` unchanged/null on ingest |
| CORS | Server-to-server; mirror import-facebook permissive CORS with secret-only trust |
| Stable errors | Typed `ok: false` + `error` enum + non-PII `message` |

**Future success response shape (design reference):**

```json
{
  "ok": true,
  "provider": "nextdoor",
  "submission_id": "string",
  "idempotency_key": "nextdoor:<id>",
  "lead_id": "uuid",
  "native_lead_submission_id": null,
  "attribution_id": "uuid",
  "duplicate": false,
  "event": "lead_captured"
}
```

Duplicate retry: same shape with `"duplicate": true` and no second event write.

---

## 12. Edge Cases

| Case | Future behavior |
|---|---|
| Zapier retries same lead | HTTP 200, `duplicate: true`, no second lead or conversion event |
| Missing email | Accept if valid phone exists; do not mark verified |
| Missing phone | Accept if valid email exists; nurture lead; do not mark verified |
| Unknown form question | Preserve in `raw_payload`; map known fields to canonical columns; store remainder in namespaced selected-answer JSON |
| Bad secret | 401; no payload storage or logging |
| Unknown provider | 400 (default) |
| Payload too large | 413 |
| Disposition update without `lead_id` | Reject (existing partner/admin paths unchanged) |
| Sale signal without contractor/client mapping | Store operationally if appropriate; block ad dispatch (existing integrity checks in partner path) |

**Exact Nextdoor/Zapier payload field names:** **NEEDS REPO VERIFICATION** until a real sample payload is captured in staging.

---

## 13. Future Build Files

**Only after explicit sprint approval** — not created in this pass:

| Path | Purpose |
|---|---|
| `supabase/functions/ingest-native-lead/index.ts` | Zapier webhook handler |
| `supabase/functions/_shared/nativeLead/*` | Provider parsers, idempotency helpers (optional module split) |
| `supabase/config.toml` | Register function; `verify_jwt = false` |
| `docs/ops/SUPABASE_FUNCTION_MANIFEST.md` | Manifest entry |
| Deno tests | Beside import-facebook pattern |
| Optional migration | `native_lead_submissions` + RLS |

**Do not touch in first implementation pass:** OTP, report reveal, scan-quote, TruthGate orchestrators, RLS, storage policies, dispatch worker behavior, contractor routing.

---

## 14. Required Future Secrets

Configure only during approved deploy — **not in this docs pass**:

| Secret | Purpose |
|---|---|
| `NATIVE_LEAD_INGEST_SECRET` | Validates `x-native-lead-secret` in Zapier |
| `SUPABASE_SERVICE_ROLE_KEY` | Platform-managed Edge runtime |
| `CANONICAL_LEAD_CAPTURED_ENABLED` | Optional; when `true`, allows `wm_event_log` `lead_captured` write (mirror TruthGate) |
| `NEXTDOOR_CAPI_ENABLED` | Controls downstream dispatch only; ingest must not set this or call CAPI directly |

Zapier must store **only** the Edge Function URL and shared secret — **no Supabase database credentials**.

---

## 15. Manual Verification Checklist

Future implementation QA (not runnable until `ingest-native-lead` exists):

- [ ] Valid secret + sample payload creates exactly one `leads` row
- [ ] `lead_attribution_details.raw_payload` contains full Zapier body
- [ ] `platform_lead_id` populated from `nd_lead_id` when present
- [ ] Identical retry returns HTTP 200 with `duplicate: true`, same `lead_id`
- [ ] No second `wm_event_log` row for duplicate retry
- [ ] `phone_verified=false`, `report_unlocked_at=null` after ingest
- [ ] Missing email + valid phone succeeds
- [ ] Missing phone + valid email succeeds (not verified)
- [ ] Bad secret → 401, no DB rows, no payload in logs
- [ ] Unknown provider → 400
- [ ] Oversized body → 413
- [ ] No row inserted into `webhook_deliveries`
- [ ] No direct call to `dispatch-platform-events` or CAPI functions from ingest
- [ ] On-site TruthGate, OTP, and report paths unchanged

---

## 16. Open Questions / NEEDS REPO VERIFICATION

1. **Exact Nextdoor Native Lead Form Zapier JSON shape** — no sample in repo; parser design blocked until staging capture.
2. **`native_lead_submissions` necessity** — table not found; decide after Phase 1 ops review of `lead_attribution_details` + `event_logs`.
3. **`nextdoor-capi-event` live registration** — code exists; absent from `supabase/config.toml` and `SUPABASE_FUNCTION_MANIFEST.md` — verify production deploy manifest.
4. **`custom_answers_json` column** — not found; use existing JSON bags unless migration approved.
5. **Distinct `lead_source` for native vs on-site** (`nextdoor` vs `nextdoor_native`) — product/analytics decision.
6. **CRM `lead_events` name for native ingest** (`native_lead_received` vs reuse `nextdoor_lead_captured`) — product decision; must not replace `wm_event_log` truth.
7. **`client_slug` resolution from native form/campaign** — business rules not defined in repo.
8. **`qualify-homepage-lead` writes `lead_attribution_details`** — claimed in `FUNNEL_SUPABASE_CALL_MAP.md` §Step 2 but function source shows `persistCanonicalEvent` only — **NEEDS REPO VERIFICATION** (doc may be stale; map file carries STALE banner).

---

## 17. Explicit Non-Actions

This spec pass and the planned future ingest sprint **must not**:

- Implement `ingest-native-lead` or shared parser modules (until approved)
- Create or apply migrations (including `native_lead_submissions`)
- Deploy Edge Functions or run Supabase CLI mutation commands
- Set or change Edge secrets or `.env` / `.env.local`
- Modify RLS, storage policies, or `supabase/config.toml`
- Regenerate or hand-edit `src/integrations/supabase/types.ts`
- Modify `scan-quote`, `send-otp`, `verify-otp`, `report-access`, `get_analysis_full` paths
- Modify TruthGate/report orchestrators (`ReportClassic`, `PostScanReportSwitcher`)
- Modify quote storage or private `quotes` bucket policies
- Modify `capi-event`, `dispatch-platform-events`, `nextdoor-capi-event`, or dispatch worker eligibility
- Modify `dispatch-lead`, `process-webhook`, or `webhook_deliveries` semantics
- Modify `partner-update-disposition` or admin disposition workflows
- Modify contractor/client routing or lead assignment
- Emit high-value CAPI events from Zapier ingestion
- Weaken OTP, report reveal, or Verify-to-Reveal boundaries
- Expose raw inbound PII to the browser or public RLS policies

---

## Related Documents

- [`docs/tracking/NEUTRAL_EVENT_CONTROL_PLANE.md`](../tracking/NEUTRAL_EVENT_CONTROL_PLANE.md) — canonical event source of truth
- [`docs/tracking/DISPATCH_WORKER_RUNBOOK.md`](../tracking/DISPATCH_WORKER_RUNBOOK.md) — platform dispatch worker
- [`docs/tracking/EVENT_OWNERSHIP_MODEL.md`](../tracking/EVENT_OWNERSHIP_MODEL.md) — business vs operational lanes
- [`docs/funnel/FUNNEL_SUPABASE_CALL_MAP.md`](../funnel/FUNNEL_SUPABASE_CALL_MAP.md) — funnel call map (partial STALE banner)
- [`docs/ops/SUPABASE_FUNCTION_MANIFEST.md`](../ops/SUPABASE_FUNCTION_MANIFEST.md) — deployed function inventory
