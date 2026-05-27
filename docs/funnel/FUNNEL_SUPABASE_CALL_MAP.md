# Funnel → Supabase Call Map

> **⚠ STALE BROWSER TRANSPORT — read before implementing**
>
> This document may describe the client calling `get_analysis_preview` or `get_analysis_full` via `supabase.rpc()`.
> **That is not the live production path** after the `report-access` migration.
>
> **Canonical browser transport:** `src/services/reportService.ts` → Edge Function `report-access` → service-role RPC.
>
> Do not "fix" code to match this doc. Read [`docs/reveal/VERIFY_TO_REVEAL_CONTRACT.md`](../reveal/VERIFY_TO_REVEAL_CONTRACT.md) first.

Authoritative reference of which Supabase surface (Edge Function / RPC / table / Storage bucket) every UI step in the homeowner funnel must invoke, in order. This is the contract that the local Cursor / Supabase staging branch wires `/scan` and `/report/forensic/:sessionId` against.

> Status: docs-only. No runtime code is modified by this file.
> Companion to: `.lovable/plan.md` (production freeze), `docs/tracking/CANONICAL_EVENT_SERVICE.md`, `AGENTS.md`.

---

## 0. Conventions

- **Identity keys**
  - `lead_id` — persistent homeowner identity (never null after intake).
  - `scan_session_id` — per-scan identity; canonical join key across `scan_sessions`, `analyses`, `phone_verifications`.
  - `event_id` — deterministic dedup key for CAPI / canonical events. Generate once; never regenerate downstream.
  - `client_slug` — never null. Resolution order: URL/route param → `localStorage.getItem("wm_client_slug")` → `"direct"`.
- **Transport rules**
  - Frontend uses the anon key only. All writes to protected tables (`analyses`, `phone_verifications`, `contractor_*`, `wm_*`) go through Edge Functions or SECURITY DEFINER RPCs.
  - Quote files live in the **private** `quotes` bucket. Access only via signed URLs.
  - Business/conversion events go through GTM + server-side `capi-event`. Operational telemetry goes to `event_logs`. Do not collapse the lanes.
- **GATE** markers — steps that must succeed server-side before the next step is allowed to render authorized data. Never gate with CSS, localStorage, blur, or hidden DOM.

---

## 1. Step-by-step map

For each step: **Trigger → Client call → Backend surface → Tables touched → Returns → Failure mode**.

### Step 1 — Landing `/scan` mounted
- **Trigger**: route mount.
- **Client**: `useUtmCapture`, `useClientSlug`, `useLeadId` (reads only).
- **Backend**: none. Anonymous.
- **Telemetry**: `supabase.from("event_logs").insert({ event_name: "page_view", route: "/scan", session_id, ... })` (anon insert policy `anon_insert_event_logs` already allows this; SELECT is blocked).
- **Failure**: no-op; UI must still render.

### Step 2 — PreUploadIntake submitted (name / email / phone / address)
- **Trigger**: form submit.
- **Client**: `qualifyHomepageLead(input)` → `supabase.functions.invoke("qualify-homepage-lead", { body })`.
- **Backend surface**: Edge Function `qualify-homepage-lead`.
- **Tables touched (server-side)**: `leads` (insert/upsert), `lead_attribution_details` (insert). Twilio line-type check is performed by the function.
- **Returns**: `{ success, lead_id, qualified, can_run_ai, phone_e164, phone_line_type, reason }`.
- **Client side-effects**: persist `lead_id` and `phone_e164` to `sessionStorage` (NOT `localStorage` for PII). Update `ScanFunnelProvider`.
- **GATE**: `can_run_ai === true`. If false, surface `reason` and block the upload step.
- **Failure**: surface `reason`; do not advance.

### Step 3 — Quote file selected → upload session minted
- **Trigger**: file picker `change`.
- **Client**: `supabase.functions.invoke("start-upload-scan-session", { body: { lead_id, client_slug, file_meta } })`.
- **Backend surface**: Edge Function `start-upload-scan-session`.
- **Tables touched (server-side)**: `scan_sessions` (insert; this mints `scan_session_id`), `quote_files` (insert pending row pointing at the storage path).
- **Returns**: `{ scan_session_id, upload_path, upload_token }` (signed URL token for the private `quotes` bucket).
- **Storage**: `supabase.storage.from("quotes").uploadToSignedUrl(upload_path, upload_token, file)`. Bucket is private — never `getPublicUrl`.
- **Telemetry**: `event_logs` `upload_started` before upload, `upload_completed` on success.
- **Failure**: retry signed URL once; on second failure surface "couldn't reach scan service" and keep `scan_session_id` so retry stays idempotent.

### Step 4 — Scan kickoff
- **Trigger**: storage upload completes.
- **Client**: `supabase.functions.invoke("scan-quote", { body: { scan_session_id } })`.
- **Backend surface**: Edge Function `scan-quote` (Gemini extraction → deterministic TS scoring).
- **Tables touched (server-side)**:
  - `analyses` — insert with `analysis_status='pending'`, transitions to `'ready'` once scoring completes. Writes `grade`, `flags`, `preview_json`, `full_json`, `proof_of_read`, `confidence_score`, `document_type`, `rubric_version`.
  - `wm_event_log` via `createCanonicalEvent` — canonical `quote_uploaded` event.
  - `wm_quote_facts` — upsert keyed on `analysis_id`.
  - `wm_platform_dispatch_log` — enqueue rows for `meta` / `google_ads` (status `pending`, only if eligible).
- **Returns**: `{ scan_session_id, analysis_id, status }` (status is the kickoff ack, not the final state).
- **Rule**: AI extracts; TS scores. Never let the LLM determine grade or pillar scores.
- **Failure**: function returns a typed failure status (`needs_better_upload`, `unreadable_quote`, `manual_review_pending`). UI must render the matching state, not a fake "complete".

### Step 5 — Poll for scan status
- **Trigger**: post-kickoff, until terminal state.
- **Client**: `useScanPolling` → `fetchScanStatus(scanSessionId)` → `supabase.rpc("get_scan_status", { p_scan_session_id })`.
- **Backend surface**: RPC `get_scan_status` (SECURITY DEFINER).
- **Tables read (server-side)**: `scan_sessions`, `analyses`.
- **Returns**: `{ status, analysis_id, ... }`. Poll until `status === 'ready'` or `'failed'`.
- **Failure**: stop polling after N attempts; render manual-review fallback.

### Step 6 — PartialRevealHero + ExecutiveSummaryBand (preview)
- **Trigger**: `status === 'ready'`.
- **Client**: `fetchAnalysisPreview(scanSessionId)` → `supabase.rpc("get_analysis_preview", { p_scan_session_id })`.
- **Backend surface**: RPC `get_analysis_preview` (SECURITY DEFINER, no PII gate).
- **Tables read (server-side)**: `analyses` (preview-safe columns only).
- **Returns**: `analysis_id`, `grade`, `flag_count`, `flag_red_count`, `flag_amber_count`, `preview_json`, `proof_of_read`, `confidence_score`, `document_type`, `rubric_version`.
- **Renders**: `ExecutiveSummaryBand` (grade + counts) and the one-line issue count in `PartialRevealHero`.
- **Forbidden**: do NOT request `full_json` here. Do NOT call `supabase.from("analyses").select(...)` directly from the browser.

### Step 7 — OTP request
- **Trigger**: user clicks "Reveal full report" / submits phone confirmation.
- **Client**: `usePhonePipeline` mode `validate_and_send_otp` → `supabase.functions.invoke("send-otp", { body: { phone_e164, scan_session_id, lead_id } })`.
- **Backend surface**: Edge Function `send-otp` (Twilio Verify send).
- **Tables touched (server-side)**: `phone_verifications` (insert/update attempt row).
- **Returns**: `{ ok, attempt_id, cooldown_seconds }`.
- **Telemetry**: `event_logs` `otp_started`.
- **Failure**: surface cooldown; do not advance.

### Step 8 — OTP verify — **GATE**
- **Trigger**: user submits 6-digit code.
- **Client**: `supabase.functions.invoke("verify-otp", { body: { phone_e164, code, scan_session_id, lead_id } })`.
- **Backend surface**: Edge Function `verify-otp` (Twilio Verify check).
- **Tables touched (server-side)**:
  - `phone_verifications` — set `phone_verified_at`.
  - `leads` — mirror `phone_verified_at`.
  - `conversion_events` — insert row for downstream CAPI.
  - `wm_event_log` — canonical `otp_verified` event (eligible for dispatch).
- **Returns**: `{ verified: true, scan_session_id }`.
- **Telemetry**: `event_logs` `otp_verified`.
- **Rule**: this is the only gate that authorizes the next step. No frontend boolean, no localStorage flag, no URL param substitutes for it.

### Step 9 — ForensicAuditReport (authorized full fetch)
- **Trigger**: OTP verify resolves successfully.
- **Client**: `fetchAnalysisFull(scanSessionId, phoneE164)` → `supabase.rpc("get_analysis_full", { p_scan_session_id, p_phone_e164 })`.
- **Backend surface**: RPC `get_analysis_full` (SECURITY DEFINER; re-checks `phone_verifications.phone_verified_at` server-side).
- **Tables read (server-side)**: `analyses`, `phone_verifications`.
- **Returns**: `analysis_id`, `grade`, `flags`, `full_json`, `proof_of_read`, `preview_json`, `confidence_score`, `document_type`, `rubric_version`.
- **Unauthorized response**: `grade === "__UNAUTHORIZED__"` → `reportService` returns `{ ok:false, code:"unauthorized" }`. UI must re-route to OTP, not blur full data.
- **Telemetry**: `event_logs` `report_revealed`. CAPI dispatch already enqueued at scan time + reinforced at verify; no direct `fbq`/`gtag` from React.

### Step 10 — Diagnosis intake (post-report)
- **Trigger**: user completes diagnosis questionnaire on report page.
- **Client**: `supabase.functions.invoke("submit-diagnosis-intake", { body: { scan_session_id, lead_id, analysis_id, primary_diagnosis, secondary_clarifiers, window_intelligence, counter_offer, top_insights_snapshot, attribution_snapshot } })`.
- **Backend surface**: Edge Function `submit-diagnosis-intake`.
- **Tables touched (server-side)**: `diagnosis_intakes` (insert).
- **Returns**: `{ ok, diagnosis_intake_id }`.

### Step 11 — Contractor handoff request
- **Trigger**: user clicks "Get matched with a vetted contractor".
- **Client**: `supabase.functions.invoke("contractor-actions", { body: { action: "request_intro", scan_session_id, lead_id, analysis_id, cta_source } })`.
- **Backend surface**: Edge Function `contractor-actions`.
- **Tables touched (server-side)**:
  - `contractor_opportunities` (insert; `intro_requested_at = now()`).
  - `contractor_opportunity_routes` (insert per suggested contractor).
  - `billable_intros` (insert when a release is approved downstream).
  - `wm_event_log` — canonical `contractor_match_requested` event.
- **Returns**: `{ opportunity_id, status }`.
- **Telemetry**: `event_logs` `contractor_match_requested`, `qualified_lead` (fires server-side once route is sent).

### Step 12 — Dev bypass (non-prod only)
- **Trigger**: dev-only `?dev_secret=` or dev panel.
- **Client**: `fetchFullViaDevBypass(scanSessionId, devSecret)` → `supabase.functions.invoke("dev-report-unlock", { body: { scan_session_id, dev_secret } })`.
- **Backend surface**: Edge Function `dev-report-unlock` (hardened in `adminAuth.ts`; rejects in production env).
- **Returns**: same shape as `get_analysis_full`.
- **Rule**: never wired into the production reveal path.

---

## 2. Table-touch matrix

R = read, W = write/insert, U = upsert. Server-side unless marked (client).

| Step | leads | lead_attribution_details | scan_sessions | quote_files | quotes (storage) | analyses | phone_verifications | conversion_events | wm_event_log | wm_quote_facts | wm_platform_dispatch_log | diagnosis_intakes | contractor_opportunities | contractor_opportunity_routes | billable_intros | event_logs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. Landing | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | W (client) |
| 2. Intake | U | W | — | — | — | — | — | — | — | — | — | — | — | — | — | W (client) |
| 3. Upload session | — | — | W | W | W (client, signed) | — | — | — | — | — | — | — | — | — | — | W (client) |
| 4. Scan kickoff | — | — | R | R | R | W | — | — | W | U | W | — | — | — | — | — |
| 5. Poll status | — | — | R | — | — | R | — | — | — | — | — | — | — | — | — | — |
| 6. Preview | — | — | — | — | — | R (preview cols) | — | — | — | — | — | — | — | — | — | — |
| 7. Send OTP | — | — | — | — | — | — | W | — | — | — | — | — | — | — | — | W (client) |
| 8. Verify OTP **GATE** | W (verified_at) | — | — | — | — | — | W (verified_at) | W | W | — | — | — | — | — | — | W (client) |
| 9. Full reveal | — | — | — | — | — | R (full) | R | — | — | — | — | — | — | — | — | W (client) |
| 10. Diagnosis | — | — | — | — | — | R | — | — | — | — | — | W | — | — | — | — |
| 11. Contractor handoff | — | — | — | — | — | R | — | — | W | — | — | — | W | W | W (later) | W (client) |
| 12. Dev bypass | — | — | — | — | — | R | — | — | — | — | — | — | — | — | — | — |

---

## 3. Forbidden patterns (must reject in code review)

- `supabase.from("analyses").select("full_json,...")` from the browser.
- `supabase.from("phone_verifications").insert/update(...)` from the browser.
- Any client-side write to `contractor_*`, `wm_*`, `billable_intros`, `lead_attribution_details`.
- Hiding `full_json` behind CSS blur, opacity, `display:none`, or React boolean only.
- Storing `full_json`, OTP codes, or `phone_e164` in `localStorage`.
- Direct frontend vendor pixels: `fbq()`, `ttq()`, `gtag('event','conversion',...)`.
- LLM-derived `grade` / pillar scores / hard caps. AI extracts; TS scores.
- Re-using `event_id` across steps. Generate once, propagate as-is.
- Public-bucket access to `quotes`. Always signed URLs.

---

## 4. Open items for the staging engineer

1. Confirm `start-upload-scan-session` returns `{ scan_session_id, upload_path, upload_token }` exactly — if the function returns a different shape, update Step 3 here before wiring `PreUploadIntake`.
2. Confirm `submit-diagnosis-intake` body matches `diagnosis_intakes` columns (`primary_diagnosis`, `secondary_clarifiers`, `window_intelligence`, `counter_offer`, `top_insights_snapshot`, `attribution_snapshot`, `prescription_path`, `confidence`).
3. Confirm the contractor handoff `cta_source` enum allowed values used by `contractor-actions` before sending from the report page.
