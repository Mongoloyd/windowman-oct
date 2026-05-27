# RPC & Edge Contract Type Registry

> **Scope:** Frontend-to-backend contracts for the Verify-to-Reveal funnel.  
> **Generated:** 2026-05-26 · **Repo:** `wm-mvp`  
> **Rule:** Documentation only — no source, migration, or deployment changes in this pass.

---

# 1. Executive Summary

WindowMan’s canonical funnel uses **11 backend contracts** spanning Postgres RPCs and Supabase Edge Functions. The transport layer is split:

| Layer | Pattern | Browser access |
|---|---|---|
| **Direct RPC** | `supabase.rpc(...)` | `get_scan_status`, `get_county_by_scan_session` |
| **Edge proxy** | `supabase.functions.invoke(...)` | `report-access` (wraps preview/full RPCs), OTP, upload bootstrap, scanner, CTAs |

**Critical architectural fact:** `get_analysis_preview` and `get_analysis_full` are `SECURITY DEFINER` RPCs intended for **service_role** execution. The browser **must not** call them directly; production code routes through **`report-access`** (`src/services/reportService.ts`). Direct RPC definitions still matter as the authoritative payload shape behind the Edge proxy.

**Typing posture today**

| Status | Count | Examples |
|---|---|---|
| **Typed (partial → good)** | 4 | `RawPreviewRow` / `RawFullRow` / `ScanStatusRow`, OTP service result types, Zod schemas in Edge (`start-upload-scan-session`, `scan-quote` request) |
| **Manual runtime parse (unknown → narrowed)** | 2 | `report-access` envelope unwrapping in `reportService.ts` |
| **Casted `as any`** | 3 hot paths | `reportService.fetchScanStatus`, `ReportClassic.useCountyForSession`, `useAnalysisData` preview_json fields |
| **`unknown` by design** | 2 | `RawFullRow.flags`, `RawFullRow.full_json` inner shapes |
| **Untyped invoke** | 4 | `UploadZone` (`scan-quote`, `start-upload-scan-session`), CTA callers (`request-callback`, `generate-contractor-brief`) |

**Highest reveal risk:** `useAnalysisData.ts` reads `preview_json` / `full_json` via `(previewJson as any)` for grade teaser fields. A backend shape change silently breaks teaser UI or over-exposes fields without compile-time failure.

**Deployment gap:** `get_county_by_scan_session` appears in `src/integrations/supabase/types.ts` but has **no matching SQL migration** in `supabase/migrations/`. Staging/prod presence is **UNKNOWN**; `ReportClassic.tsx` triple-casts around the RPC and falls back to `"Your County"`.

**Generated types source:** `npm run typegen` → `src/integrations/supabase/types.ts` (project ref `zgsofkgddpcntdvpckdq`).

---

# 2. Contract Registry Table

## 2.1 `get_scan_status` (RPC)

| Field | Value |
|---|---|
| **Name** | `public.get_scan_status(p_scan_session_id uuid)` |
| **Caller file(s)** | `src/services/reportService.ts` (`fetchScanStatus`), `src/hooks/useScanPolling.ts` (direct RPC), `src/hooks/useAnalysisData.ts` (via service), `src/components/dev/DevQuoteGenerator.tsx` |
| **Request** | `{ p_scan_session_id: string /* UUID */ }` |
| **Response** | `{ id: uuid, status: text }[]` — first row used. Status values include `uploading`, `processing`, `preview_ready`, `complete`, `invalid_document`, `needs_better_upload`, `error`, `failed`, `unreadable` |
| **Auth / reveal** | **Anonymous OK.** `GRANT EXECUTE … TO anon, authenticated` (`20260523120000_grant_get_scan_status_execute.sql`). Returns **id + status only** — no analysis payload. |
| **Tables touched** | `scan_sessions` (read) |
| **Typing status** | **Partially typed.** Generated `Database["public"]["Functions"]["get_scan_status"]` exists. `reportService.ts:61` uses `(data as any)`. `useScanPolling.ts:126-129` casts `row.status as ScanStatus`. |
| **Risk if shape changes** | **Medium.** Polling stalls or mis-routes UI (preview never fetched, infinite spinner). No reveal leak. |
| **Recommended interface** | `GetScanStatusArgs`, `ScanStatusRow` (already in `@/types/serviceResults`) |
| **First file to clean up** | `src/services/reportService.ts` — remove `as any`, use generated RPC return type |

**Migration source:** `supabase/migrations/20260318112259_7a111b45-4d4b-4ce9-ac6e-1409cf114ceb.sql`

---

## 2.2 `get_analysis_preview` (RPC — via `report-access`)

| Field | Value |
|---|---|
| **Name** | `public.get_analysis_preview(p_scan_session_id uuid)` |
| **Caller file(s)** | **Not called from browser.** Proxied by `supabase/functions/report-access/index.ts` → consumed via `src/services/reportService.ts` (`fetchAnalysisPreview`) → `src/hooks/useAnalysisData.ts`, `src/lib/labLiveReportAccess.ts`, `src/components/dev/DevQuoteGenerator.tsx` |
| **Request (RPC)** | `{ p_scan_session_id: uuid }` |
| **Response (RPC row)** | `analysis_id`, `grade`, `flag_count`, `flag_red_count`, `flag_amber_count`, `proof_of_read`, `preview_json`, `confidence_score`, `document_type`, `rubric_version` — **no `flags` array, no `full_json`** |
| **Request (Edge `report-access`)** | `{ mode: "preview", scan_session_id: string }` |
| **Response (Edge envelope)** | Success: `{ ok: true, mode: "preview", data: <PreviewRow> }` · Not ready: `{ ok: false, error: "Report not found" }` (404) · RPC failure: `{ ok: false, error: "Report processing failed" }` (500) |
| **Auth / reveal** | **Anonymous OK** (UUID knowledge gate only). Teaser-safe by design — flag counts only, empty flags array on client. |
| **Tables touched** | `analyses` (read, `analysis_status = 'complete'`) |
| **Typing status** | **Partially typed.** `RawPreviewRow` in `@/types/serviceResults`. Edge envelope untyped (`isRecord` guards). `preview_json` inner shape **unknown** at compile time. |
| **Risk if shape changes** | **High (conversion).** Teaser grade, flag buckets, proof-of-read break. Low reveal risk if RPC contract preserved (no `full_json`). |
| **Recommended interface** | `ReportAccessPreviewRequest`, `ReportAccessPreviewEnvelope`, `AnalysisPreviewRpcRow` |
| **First file to clean up** | `src/services/reportService.ts` — add envelope interfaces; tighten `preview_json` to `PreviewJsonTeaser` |

**Migration source:** `supabase/migrations/20260420000000_add_analysis_id_to_analysis_rpcs.sql` (supersedes redacted preview in `20260322100001_redact_preview_create_gated_full.sql`)

---

## 2.3 `get_analysis_full` (RPC — via `report-access`)

| Field | Value |
|---|---|
| **Name** | `public.get_analysis_full(p_scan_session_id uuid, p_phone_e164 text)` |
| **Caller file(s)** | **Not called from browser in production.** Proxied by `report-access` → `fetchAnalysisFull` → `useAnalysisData.fetchFull` / `tryResume`. Also invoked server-side from `generate-contractor-brief`, `compare-quotes`, `generate-negotiation-script`. |
| **Request (RPC)** | `{ p_scan_session_id: uuid, p_phone_e164: text /* E.164 */ }` |
| **Response (RPC row — authorized)** | `analysis_id`, `grade`, `flags` (jsonb array), `full_json`, `proof_of_read`, `preview_json`, `confidence_score`, `document_type`, `rubric_version` |
| **Response (RPC row — unauthorized)** | Sentinel row: `grade = '__UNAUTHORIZED__'`, other fields null |
| **Request (Edge `report-access`)** | `{ mode: "full", scan_session_id: string, phone_e164: string }` |
| **Response (Edge envelope)** | Authorized: `{ ok: true, mode: "full", authorized: true, data: FullRow & { v2_source?, v2_source_version? } }` · Locked: `{ ok: true, mode: "full", authorized: false, locked: true, reason: "unauthorized" }` (HTTP 200) · Not found: `{ ok: false, error: "Report not found" }` |
| **Auth / reveal** | **SMS verified + strict scan binding.** Requires `phone_verifications.status = 'verified'`, `phone_verifications.scan_session_id = p_scan_session_id`, `leads.phone_verified = true`, joined through `scan_sessions`. |
| **Tables touched** | `phone_verifications`, `scan_sessions`, `leads`, `analyses` |
| **Typing status** | **Partially typed / unknown internals.** `RawFullRow` typed shell; `flags: unknown`, `full_json: Record<string, unknown>`. `v2_source` parsed via `parseV2SourceProjection`. Unauthorized sentinel handled explicitly. |
| **Risk if shape changes** | **Critical (moat).** Full report leak, wrong grade, broken OTP gate UX, contractor brief auth bypass if sentinel handling breaks. |
| **Recommended interface** | `ReportAccessFullRequest`, `ReportAccessFullAuthorizedEnvelope`, `ReportAccessFullLockedEnvelope`, `AnalysisFullRpcRow`, `AnalysisFlagWire` |
| **First file to clean up** | `src/types/serviceResults.ts` — replace `flags: unknown` with typed flag wire shape; then `src/hooks/useAnalysisData.ts` |

**Migration source:** `supabase/migrations/20260428120000_restore_get_analysis_full_strict_scan_binding.sql`

---

## 2.4 `get_county_by_scan_session` (RPC)

| Field | Value |
|---|---|
| **Name** | `public.get_county_by_scan_session(p_scan_session_id uuid)` |
| **Caller file(s)** | `src/pages/ReportClassic.tsx` (`useCountyForSession` hook, lines 71–101) |
| **Request** | `{ p_scan_session_id: string /* UUID */ }` |
| **Response** | `{ county: string }[]` — first row used |
| **Auth / reveal** | **UNKNOWN grant in repo migrations.** Intended narrow read: `scan_sessions` → `leads.county`. No phone gate (county is non-sensitive geography). |
| **Tables touched** | `leads`, `scan_sessions` (per `docs/db/TABLE_ACCESS_MODEL.md`) |
| **Typing status** | **Casted `as any`.** Generated types **do** include the function (`types.ts:4930`), but caller bypasses with `(supabase.rpc as any)` and `(data as any[])`. |
| **Risk if shape changes** | **Low–medium.** UI shows `"Your County"` fallback; benchmark copy degrades silently. **404 if RPC missing in deployed DB.** |
| **Recommended interface** | `GetCountyByScanSessionArgs`, `CountyByScanSessionRow` |
| **First file to clean up** | `src/pages/ReportClassic.tsx` — remove triple `as any`; use generated RPC types |

**Migration in repo:** **NONE FOUND** — function exists in generated types only. Mark **UNKNOWN** for production deployment.

---

## 2.5 `report-access` (Edge Function)

| Field | Value |
|---|---|
| **Name** | `report-access` |
| **Caller file(s)** | `src/services/reportService.ts` (preview + full), `src/lib/labLiveReportAccess.ts`, `src/components/forensic-report/LabLiveReportAccessPanel.tsx`, `src/pages/DevReportPreview.tsx` |
| **Request** | Discriminated by `mode`: `preview` \| `full` (see §2.2 / §2.3) |
| **Response** | Discriminated union on `ok`, `mode`, `authorized` (see §2.2 / §2.3). Full authorized rows include server-side `v2_source` projection (`V2_SOURCE_VERSION = "v2-source-2026-05"`). |
| **Auth / reveal** | Edge uses **service_role** internally. Preview: UUID only. Full: E.164 + RPC auth gate. |
| **Tables touched** | Via RPCs only (no direct table writes) |
| **Typing status** | **Manual parse (unknown → narrowed).** No shared TS contract between Edge and client. |
| **Risk if shape changes** | **Critical.** Breaks entire reveal path; unauthorized sentinel misclassification leaks or locks report. |
| **Recommended interface** | `ReportAccessRequest`, `ReportAccessResponse` (discriminated union) |
| **First file to clean up** | `src/services/reportService.ts` |

**Edge source:** `supabase/functions/report-access/index.ts`

---

## 2.6 `scan-quote` (Edge Function)

| Field | Value |
|---|---|
| **Name** | `scan-quote` |
| **Caller file(s)** | `src/components/UploadZone.tsx` (`invokeScan`, line 196), dev/scanner lab paths |
| **Request** | `{ scan_session_id: uuid, event_id?: string (≤128, server-substitutes if bad), dev_extraction_override?: unknown, dev_secret?: string }` — validated by Zod `ScanQuoteRequestSchema` |
| **Response (success)** | `{ scan_session_id, analysis_status: "complete", scan_session_status: "preview_ready", grade: string }` |
| **Response (idempotent skip)** | `{ scan_session_id, status: <terminal> }` |
| **Response (in-flight)** | `{ scan_session_id, status: "processing", message: "Scan already in progress." }` (202) |
| **Response (rate limit)** | `{ error: "rate_limit_exceeded", message: string }` (429) — `UploadZone` checks `fnData?.error` |
| **Response (failure variants)** | `{ error: string, scan_session_id?, analysis_status?, scan_session_status? }` — multiple terminal failure shapes in handler |
| **Auth / reveal** | **Anonymous invoke** (`verify_jwt: false`). Writes `analyses`, updates `scan_sessions`, syncs lead snapshot. Produces **preview-ready** analysis only (no full reveal). |
| **Tables touched** | `scan_sessions`, `quote_files`, `analyses`, `leads`, `event_logs` (canonical events) |
| **Typing status** | **Untyped on client.** Request body inline object; `fnData`/`fnError` untyped. Edge request **typed** (Zod). |
| **Risk if shape changes** | **High (funnel).** Upload retry UX, polling never reaches `preview_ready`, rate-limit detection breaks. |
| **Recommended interface** | `ScanQuoteInvokeRequest`, `ScanQuoteSuccessResponse`, `ScanQuoteErrorResponse` |
| **First file to clean up** | `src/components/UploadZone.tsx` |

**Edge source:** `supabase/functions/scan-quote/requestSchema.ts`, `supabase/functions/scan-quote/index.ts`

---

## 2.7 `send-otp` (Edge Function)

| Field | Value |
|---|---|
| **Name** | `send-otp` |
| **Caller file(s)** | `src/services/phoneVerificationService.ts` (`sendOtp`) → `src/hooks/usePhonePipeline.ts` → OTP UI (`VerifyGate`, `PhoneVerifyModal`, `TruthGateFlow`, `ReportClassic`, `PostScanReportSwitcher`) |
| **Request** | `{ phone_e164: string /* normalized +1XXXXXXXXXX */, scan_session_id?: string /* UUID, binds pending row */ }` |
| **Response (success)** | `{ success: true }` |
| **Response (error)** | `{ error: string, success?: false, twilio_code?: number }` — HTTP 400/429/500 |
| **Auth / reveal** | **Anonymous invoke.** Creates `phone_verifications` row (`status: pending`, `scan_session_id` bound). Does **not** unlock report. |
| **Tables touched** | `phone_verifications` (expire old pending, insert new) |
| **Typing status** | **Partially typed.** `OtpSendResult` / `OtpServiceResult` on client; invoke `data`/`error` untyped (`parseEdgeFunctionError(error: any)`). |
| **Risk if shape changes** | **High (gate).** OTP send UX, session binding for reveal breaks. |
| **Recommended interface** | `SendOtpRequest`, `SendOtpSuccessResponse`, `SendOtpErrorResponse` |
| **First file to clean up** | `src/services/phoneVerificationService.ts` |

**Edge source:** `supabase/functions/send-otp/index.ts`

---

## 2.8 `verify-otp` (Edge Function)

| Field | Value |
|---|---|
| **Name** | `verify-otp` |
| **Caller file(s)** | `src/services/phoneVerificationService.ts` (`verifyOtp`) → `usePhonePipeline` → reveal triggers `useAnalysisData.fetchFull` |
| **Request** | `{ phone_e164: string, code: string /* 6-digit */, scan_session_id?: string }` |
| **Response (success)** | `{ success: true, verified: true, phone_e164: string, phone_verified_event_id: string \| null, report_revealed_event_id: string \| null }` |
| **Response (error)** | `{ error: string }` — invalid/expired/rate-limited |
| **Auth / reveal** | Verifies via Twilio Verify; updates `phone_verifications` → `verified`, sets `leads.phone_verified`, binds `scan_session_id`. **Unlock authority** for subsequent `get_analysis_full`. |
| **Tables touched** | `phone_verifications`, `leads`, `lead_events`, canonical event bridge |
| **Typing status** | **Partially typed.** `OtpVerifyResult` documents success shape; error parsing uses `any`. |
| **Risk if shape changes** | **Critical (moat).** Cross-scan unlock, analytics dedup break, reveal never loads. |
| **Recommended interface** | `VerifyOtpRequest`, `VerifyOtpSuccessResponse`, `VerifyOtpErrorResponse` |
| **First file to clean up** | `src/services/phoneVerificationService.ts` |

**Edge source:** `supabase/functions/verify-otp/index.ts`

---

## 2.9 `start-upload-scan-session` (Edge Function)

| Field | Value |
|---|---|
| **Name** | `start-upload-scan-session` |
| **Caller file(s)** | `src/components/UploadZone.tsx` (lines 466–474) |
| **Request** | `{ session_id: uuid, storage_path: string /* must start with ${session_id}/ */, file_name?: string, file_size?: int ≥0, file_type?: string }` — Zod `.strict()` |
| **Response (success)** | `{ success: true, scan_session_id: uuid, quote_file_id: uuid, lead_id: uuid }` |
| **Response (error)** | `{ success: false, code: BootstrapErrorCode, message: string, details?: unknown }` |
| **Auth / reveal** | **Anonymous invoke** (service_role writes). Forces `phone_verified: false` on new leads. Idempotent on `storage_path`. |
| **Tables touched** | `leads`, `quote_files`, `scan_sessions`, `event_logs` (audit) · RPC `get_lead_by_session` |
| **Typing status** | **Untyped client / typed Edge.** Zod schemas in `supabase/functions/start-upload-scan-session/contracts/schemas.ts`. Client casts `bootstrapData.scan_session_id as string`, error path `(bootstrapData ?? {}) as Record<string, unknown>`. |
| **Risk if shape changes** | **High (funnel entry).** Upload path dead; duplicate sessions if idempotency fields rename. |
| **Recommended interface** | Re-export `BootstrapRequest`, `BootstrapSuccess`, `BootstrapError` from Edge schemas into `src/types/uploadBootstrap.ts` |
| **First file to clean up** | `src/components/UploadZone.tsx` |

**Edge source:** `supabase/functions/start-upload-scan-session/contracts/schemas.ts`

---

## 2.10 `request-callback` (Edge Function)

| Field | Value |
|---|---|
| **Name** | `request-callback` |
| **Caller file(s)** | `src/pages/ReportClassic.tsx` (contractor intro + report help), `src/components/post-scan/PostScanReportSwitcher.tsx` (report help), `src/pages/Estimate.tsx` (contractor intro) |
| **Request** | `{ scan_session_id: string, call_intent: "contractor_intro" \| "report_explainer" \| "general_callback", cta_source?: string }` |
| **Response (success)** | `{ success: true, followup_id: uuid, webhook_status: "queued" \| "sent" \| "failed" }` |
| **Response (error)** | `{ error: string }` — 400/403/500 |
| **Auth / reveal** | **Server-side phone_verified gate** on lead linked to scan. No admin JWT. Caller does not pass phone — server reads `leads.phone_e164`. |
| **Tables touched** | `scan_sessions`, `leads`, `analyses`, `contractor_opportunities`, `voice_followups`, `lead_events` |
| **Typing status** | **Untyped.** Call sites ignore response shape except fire-and-forget; no error surfacing in PostScanReportSwitcher. |
| **Risk if shape changes** | **Medium.** Silent CTA failure; ops queue misses callbacks. No direct reveal leak. |
| **Recommended interface** | `RequestCallbackRequest`, `RequestCallbackSuccessResponse`, `RequestCallbackErrorResponse` |
| **First file to clean up** | `src/pages/ReportClassic.tsx` (extract shared CTA transport helper) |

**Edge source:** `supabase/functions/request-callback/index.ts`

---

## 2.11 `generate-contractor-brief` (Edge Function)

| Field | Value |
|---|---|
| **Name** | `generate-contractor-brief` |
| **Caller file(s)** | `src/pages/ReportClassic.tsx` (`handleContractorMatchClick`, line 284) — **not** invoked from `PostScanReportSwitcher` (diagnosis CTA replaces contractor match there) |
| **Request** | `{ scan_session_id: string, phone_e164: string, cta_source?: string /* default "intro_request" */ }` |
| **Response (success)** | `{ success: true, opportunity_id: uuid, analysis_id: uuid, status: "brief_ready", suggested_match: { confidence, reasons, contractor_alias } \| null }` |
| **Response (error)** | `{ error: string }` — 400/403/500 |
| **Auth / reveal** | **Phone gate via `get_analysis_full` RPC** — rejects if sentinel unauthorized. Requires verified phone matching scan. |
| **Tables touched** | `analyses`, `leads`, `scan_sessions`, `contractor_opportunities`, `contractor_briefs`, `event_logs` |
| **Typing status** | **Untyped.** Checks `data?.success` and reads `data.suggested_match` without interface. |
| **Risk if shape changes** | **Medium–high (revenue).** Contractor match UI breaks; may queue callback with stale opportunity id. |
| **Recommended interface** | `GenerateContractorBriefRequest`, `GenerateContractorBriefSuccessResponse`, `SuggestedMatchWire` |
| **First file to clean up** | `src/pages/ReportClassic.tsx` |

**Edge source:** `supabase/functions/generate-contractor-brief/index.ts`

---

# 3. Highest Risk Untyped Calls

Ranked by moat / funnel impact. Includes file:line evidence from repo search.

| Rank | Call site | Pattern | Risk |
|---|---|---|---|
| **P0** | `src/hooks/useAnalysisData.ts:218–321` | `(previewJson as any)?.quality_band`, `has_warranty`, `has_permits` | Teaser + full hybrid mapping breaks silently; may read fields that should stay gated |
| **P0** | `src/services/reportService.ts:119–157` | Edge full envelope manual unwrap; `flags: unknown` in `RawFullRow` | Unauthorized misread or full payload shape drift |
| **P0** | `src/services/phoneVerificationService.ts:71–135` | Untyped invoke `data`; `parseEdgeFunctionError(error: any)` | OTP gate + canonical event_id handoff |
| **P1** | `src/components/UploadZone.tsx:196–221, 466–499` | Untyped `fnData` for `scan-quote` + bootstrap | Funnel entry failure; rate-limit branch depends on stringly `fnData?.error` |
| **P1** | `src/pages/ReportClassic.tsx:81–89` | `(supabase.rpc as any)("get_county_by_scan_session")` | RPC may 404 in prod; unnecessary type bypass |
| **P1** | `src/pages/ReportClassic.tsx:284–296` | Untyped `generate-contractor-brief` response | Revenue CTA + suggested match UI |
| **P2** | `src/services/reportService.ts:61` | `(data as any)` on scan status row | Poll / preview timing desync |
| **P2** | `src/hooks/useScanPolling.ts:103–129` | Direct RPC + `row.status as ScanStatus` | Duplicate transport path vs `reportService` |
| **P2** | `src/pages/ReportClassic.tsx:381–387`, `PostScanReportSwitcher.tsx:793–799`, `Estimate.tsx:124–130` | Fire-and-forget `request-callback` | Silent operator queue failure |
| **P3** | `src/pages/ReportClassic.tsx:641` | `derivedMetrics={analysisData.derivedMetrics as any}` | Report UI props drift |

### Search inventory (target patterns)

| Pattern | Notable hits in funnel paths |
|---|---|
| `supabase.rpc(` | `reportService.ts`, `useScanPolling.ts`, `ReportClassic.tsx` (`as any`) |
| `supabase.functions.invoke(` | `reportService.ts`, `UploadZone.tsx`, `phoneVerificationService.ts`, `ReportClassic.tsx`, `PostScanReportSwitcher.tsx`, `Estimate.tsx` |
| `as any` | `reportService.ts:61`, `ReportClassic.tsx:81–89,641`, `useAnalysisData.ts:218–321` |
| `Record<string, any>` | Mostly admin/partner surfaces — **not** in core reveal transport except admin dossier |
| `get_analysis_preview` / `get_analysis_full` | Browser: **via `report-access` only**; direct RPC in Edge (`report-access`, `generate-contractor-brief`) |
| `report-access` | `reportService.ts`, lab harness |

---

# 4. Proposed Type Interfaces

Recommended home: **`src/types/contracts/`** (new module — future PR only).

```typescript
// ── RPC rows (mirror generated Database types) ──────────────────────────
export interface GetScanStatusArgs {
  p_scan_session_id: string;
}
// ScanStatusRow — already exists in @/types/serviceResults

export interface GetCountyByScanSessionArgs {
  p_scan_session_id: string;
}
export interface CountyByScanSessionRow {
  county: string;
}

export interface AnalysisPreviewRpcRow {
  analysis_id: string | null;
  grade: string;
  flag_count: number;
  flag_red_count: number;
  flag_amber_count: number;
  proof_of_read: Record<string, unknown> | null;
  preview_json: PreviewJsonTeaser | null;
  confidence_score: number | null;
  document_type: string | null;
  rubric_version: string | null;
}

export interface AnalysisFullRpcRow {
  analysis_id: string | null;
  grade: string;
  flags: AnalysisFlagWire[] | null;
  full_json: FullJsonWire | null;
  proof_of_read: Record<string, unknown> | null;
  preview_json: PreviewJsonTeaser | null;
  confidence_score: number | null;
  document_type: string | null;
  rubric_version: string | null;
}

// ── report-access envelopes ───────────────────────────────────────────────
export type ReportAccessPreviewRequest = {
  mode: "preview";
  scan_session_id: string;
};

export type ReportAccessFullRequest = {
  mode: "full";
  scan_session_id: string;
  phone_e164: string;
};

export type ReportAccessPreviewEnvelope =
  | { ok: true; mode: "preview"; data: AnalysisPreviewRpcRow }
  | { ok: false; error: string };

export type ReportAccessFullEnvelope =
  | { ok: true; mode: "full"; authorized: true; data: AnalysisFullRpcRow & V2SourceFields }
  | { ok: true; mode: "full"; authorized: false; locked: true; reason: "unauthorized" }
  | { ok: false; error: string };

// ── Edge invoke: scanner + upload ─────────────────────────────────────────
export interface ScanQuoteInvokeRequest {
  scan_session_id: string;
  event_id?: string;
  dev_extraction_override?: unknown;
  dev_secret?: string;
}

export interface ScanQuoteSuccessResponse {
  scan_session_id: string;
  analysis_status: "complete";
  scan_session_status: "preview_ready";
  grade: string;
}

// BootstrapRequest / BootstrapSuccess — mirror Edge Zod exports

// ── OTP ───────────────────────────────────────────────────────────────────
export interface SendOtpRequest {
  phone_e164: string;
  scan_session_id?: string;
}
export interface SendOtpSuccessResponse {
  success: true;
}

export interface VerifyOtpRequest {
  phone_e164: string;
  code: string;
  scan_session_id?: string;
}
export interface VerifyOtpSuccessResponse {
  success: true;
  verified: true;
  phone_e164: string;
  phone_verified_event_id: string | null;
  report_revealed_event_id: string | null;
}

// ── Post-reveal CTAs ──────────────────────────────────────────────────────
export type CallbackIntent =
  | "contractor_intro"
  | "report_explainer"
  | "general_callback";

export interface RequestCallbackRequest {
  scan_session_id: string;
  call_intent: CallbackIntent;
  cta_source?: string;
}

export interface GenerateContractorBriefRequest {
  scan_session_id: string;
  phone_e164: string;
  cta_source?: string;
}

// ── Wire sub-shapes (define incrementally) ────────────────────────────────
export interface PreviewJsonTeaser {
  quality_band?: string;
  has_warranty?: boolean;
  has_permits?: boolean;
  flag_count?: number;
  price_per_opening_band?: "low" | "market" | "high" | "extreme";
  summary_teaser?: string;
  // extend from preview_json compiler output
}

export interface AnalysisFlagWire {
  title?: string;
  name?: string;
  severity?: string;
  category?: string;
  summary?: string;
  detail?: string;
  tip?: string;
  pillar?: string;
}

export interface FullJsonWire {
  summary?: string;
  top_warning?: string;
  pillar_scores?: Record<string, number>;
  extraction?: Record<string, unknown>;
  derived_metrics?: Record<string, unknown>;
  rubric_version?: string;
  price_fairness?: string;
  markup_estimate?: string;
  // extend from reportCompiler output — do NOT use `any`
}

export interface V2SourceFields {
  v2_source_version?: string | null;
  v2_source?: import("@/types/v2ReportTransport").V2SourceProjection | null;
}
```

**Sync rule (future):** After contract changes, run `npm run typegen` and diff `src/integrations/supabase/types.ts` RPC sections against `AnalysisPreviewRpcRow` / `AnalysisFullRpcRow`.

---

# 5. Cleanup Order

Execute in this sequence to maximize safety and minimize duplicate work.

| Phase | Target | Action | Blocks |
|---|---|---|---|
| **1** | `src/types/contracts/` + `serviceResults.ts` | Add envelope + wire interfaces; tighten `RawFullRow.flags` | Nothing |
| **2** | `src/services/reportService.ts` | Type `report-access` envelopes; remove `as any` on scan status; use generated RPC types | Phase 1 |
| **3** | `src/services/phoneVerificationService.ts` | Type invoke payloads/responses; remove `error: any` | Phase 1 OTP interfaces |
| **4** | `src/hooks/useAnalysisData.ts` | Replace `(previewJson as any)` with `PreviewJsonTeaser` / `FullJsonWire` | Phases 1–2 |
| **5** | `src/components/UploadZone.tsx` | Import bootstrap + scan-quote contracts | Phase 1 |
| **6** | `src/hooks/useScanPolling.ts` | Route through `fetchScanStatus` **or** share `ScanStatusRow` typing — eliminate duplicate RPC path | Phase 2 |
| **7** | `src/pages/ReportClassic.tsx` | Fix county RPC typing; type CTA invokes; remove `derivedMetrics as any` | Phases 1, 4 |
| **8** | `get_county_by_scan_session` migration | Add SQL migration if missing in deployed DB; verify grant | Ops / DBA |
| **9** | Edge ↔ client parity | Optionally export Zod schemas to shared package or duplicate types with contract tests | Longer term |

**Test gates after each phase:** `npm run test:critical`, `npm run typecheck`, manual preview → OTP → full reveal smoke.

---

# 6. No-Code Safety Confirmation

| Check | Status |
|---|---|
| TypeScript source edited | **NO** |
| Supabase functions edited | **NO** |
| Migrations edited | **NO** |
| Deploy / push performed | **NO** |
| Only file created | **`docs/ops/RPC_TYPE_CONTRACT_REGISTRY.md`** |
| Unknown shapes marked | **YES** — `get_county_by_scan_session` migration missing; `preview_json` / `full_json` inner fields; Edge error bodies beyond documented literals |
| Future cleanup files identified | **YES** — see §2 per-contract “First file to clean up” and §5 |

---

## Appendix A — Caller map (quick reference)

```
UploadZone
  └─ start-upload-scan-session → leads / quote_files / scan_sessions
  └─ scan-quote → analyses + preview_ready

useScanPolling / reportService.fetchScanStatus
  └─ get_scan_status (direct RPC)

reportService.fetchAnalysisPreview / fetchAnalysisFull
  └─ report-access → get_analysis_preview | get_analysis_full

usePhonePipeline → phoneVerificationService
  └─ send-otp | verify-otp → phone_verifications / leads

useAnalysisData
  └─ reportService (preview + full) + verifiedAccess local resume

ReportClassic
  └─ get_county_by_scan_session (direct RPC, casted)
  └─ generate-contractor-brief + request-callback

PostScanReportSwitcher / Estimate
  └─ request-callback only
```

## Appendix B — Related docs

- `docs/ops/SUPABASE_FUNCTION_MANIFEST.md` — Edge function inventory & auth models  
- `docs/db/TABLE_ACCESS_MODEL.md` — RPC → table access matrix  
- `docs/sprints/phase-0-repo-truth-audit.md` — canonical reveal flow narrative  
- `src/types/v2ReportTransport.ts` — `v2_source` projection mirror  

