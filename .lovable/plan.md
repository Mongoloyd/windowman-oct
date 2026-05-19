# Funnel → Supabase Call Map

Target file: `docs/funnel/FUNNEL_SUPABASE_CALL_MAP.md` (new, docs-only — no runtime code touched).

Purpose: give the local Cursor/staging team a single authoritative reference of which Supabase surface (table / RPC / Storage bucket / Edge Function) each UI step must invoke, in order. This is the contract the `/scan` + `/report/forensic/:sessionId` wiring will be built against.

## Document structure

### 0. Conventions
- Identity keys: `lead_id` (persistent), `scan_session_id` (per scan), `event_id` (CAPI dedup), `client_slug` (never null; route → `localStorage.wm_client_slug` → `"direct"`).
- All writes to protected tables go through Edge Functions or RPCs. Frontend uses anon key only.
- Order shown = required temporal order. Steps marked **GATE** must succeed before the next step renders authorized data.

### 1. Step-by-step map

For each UI step, document: **Trigger → Client call → Backend surface → Tables touched → Returns → Failure mode**.

1. **Landing `/scan` mounted**
   - Client: `useUtmCapture`, `useClientSlug`, `useLeadId` (read-only).
   - Backend: none (anonymous).
   - Telemetry: `supabase.from("event_logs").insert({ event_name: "page_view", ... })` (anon insert policy already in place).

2. **PreUploadIntake — homeowner submits name/email/phone/address**
   - Client: `qualifyHomepageLead()` → `supabase.functions.invoke("qualify-homepage-lead", { body })`.
   - Backend writes: `leads` (insert/upsert), `lead_attribution_details` (insert), Twilio line-type check.
   - Returns: `{ lead_id, qualified, can_run_ai, phone_e164 }`.
   - Persist `lead_id` + `phone_e164` to `sessionStorage`. **GATE** — `can_run_ai === true` required to proceed to upload.

3. **Quote file selected → upload**
   - Client: `supabase.functions.invoke("start-upload-scan-session", { body: { lead_id, client_slug } })` to mint a `scan_session_id` + signed upload URL.
   - Backend writes: `scan_sessions` (insert), `quote_files` (insert pending row).
   - Client: `supabase.storage.from("quotes").uploadToSignedUrl(path, token, file)` — private bucket, no public read.
   - Telemetry: `event_logs` `upload_started`, `upload_completed`.

4. **Scan kickoff**
   - Client: `supabase.functions.invoke("scan-quote", { body: { scan_session_id } })`.
   - Backend writes: `analyses` (insert with `analysis_status='pending'` → `'ready'`), `wm_event_log` via `createCanonicalEvent` (`quote_uploaded`), `wm_quote_facts` upsert, `wm_platform_dispatch_log` rows.
   - Deterministic TS scoring (not LLM) sets `grade`, `flags`, `preview_json`, `full_json`, `proof_of_read`, `confidence_score`.

5. **Polling for status**
   - Client: `useScanPolling` → `supabase.rpc("get_scan_status", { p_scan_session_id })` (already in `reportService.fetchScanStatus`).
   - Returns: `{ status, analysis_id }`. Poll until `ready` or `failed`.

6. **PartialRevealHero — preview fetch (no PII gate)**
   - Client: `supabase.rpc("get_analysis_preview", { p_scan_session_id })` via `fetchAnalysisPreview`.
   - Returns: `grade`, `flag_count`, `flag_red_count`, `flag_amber_count`, `preview_json`, `proof_of_read`, `confidence_score`, `document_type`, `rubric_version`.
   - Renders ExecutiveSummaryBand + one-line issue count. **Never** fetch `full_json` here.

7. **OTP request**
   - Client: `usePhonePipeline` mode `validate_and_send_otp` → `supabase.functions.invoke("send-otp", { body: { phone_e164, scan_session_id, lead_id } })`.
   - Backend writes: `phone_verifications` (insert/update), Twilio Verify send.
   - Telemetry: `otp_started`.

8. **OTP verify — GATE**
   - Client: `supabase.functions.invoke("verify-otp", { body: { phone_e164, code, scan_session_id } })`.
   - Backend writes: `phone_verifications.phone_verified_at`, `leads.phone_verified_at`, conversion event row.
   - Telemetry: `otp_verified`. Must succeed before any full-report fetch.

9. **ForensicAuditReport — authorized full fetch**
   - Client: `supabase.rpc("get_analysis_full", { p_scan_session_id, p_phone_e164 })` via `fetchAnalysisFull`. RPC re-checks `phone_verified_at` server-side and returns `__UNAUTHORIZED__` grade if not verified.
   - Returns: `grade`, `flags`, `full_json`, `proof_of_read`, `preview_json`, `confidence_score`, `document_type`, `rubric_version`.
   - Telemetry: `report_revealed`; CAPI dispatched server-side via `capi-event` queue (already enqueued during scan).

10. **Diagnosis intake (post-report)**
    - Client: `supabase.functions.invoke("submit-diagnosis-intake", ...)` (or RPC, TBD by local team) → writes `diagnosis_intakes`.

11. **Contractor handoff request**
    - Client: `supabase.functions.invoke("contractor-actions", { body: { action: "request_intro", scan_session_id, lead_id } })`.
    - Backend writes: `contractor_opportunities`, `contractor_opportunity_routes`, optionally `billable_intros`; canonical event `contractor_match_requested`.
    - Telemetry: `contractor_match_requested`, `qualified_lead`.

12. **Dev bypass (non-prod only)**
    - Client: `supabase.functions.invoke("dev-report-unlock", { body: { scan_session_id, dev_secret } })` → `fetchFullViaDevBypass`. Gate stays hardened in `adminAuth.ts`.

### 2. Table-touch matrix (appendix)
A compact table at the end with rows = UI steps and columns = each table/bucket, marking R/W/Upsert. Quick visual for the staging engineer.

### 3. Forbidden patterns reminder (appendix)
- No direct `supabase.from("analyses").select(...)` for full payloads from the browser.
- No `localStorage`/CSS gating of full report.
- No frontend OCR/LLM scoring.
- No write to `phone_verifications`, `analyses`, `contractor_*` tables from the browser.

## Open items to confirm before writing

1. Intake Edge Function name: **`qualify-homepage-lead`** (existing) vs new `capture-intake`? Default: reuse existing.
2. Upload session function name: confirm `start-upload-scan-session` exists in `/supabase/functions` or substitute the real name.
3. Diagnosis intake transport: Edge Function vs RPC — confirm with local team before locking the doc.

If those three are answered "use existing names as listed", I write the doc as drafted. Otherwise I'll substitute the corrected names.
