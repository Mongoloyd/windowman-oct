# CANONICAL REPO EVIDENCE — forensic_report_v2

> **⚠ STALE BROWSER TRANSPORT — read before implementing**
>
> This document may describe the client calling `get_analysis_preview` or `get_analysis_full` via `supabase.rpc()`.
> **That is not the live production path** after the `report-access` migration.
>
> **Canonical browser transport:** `src/services/reportService.ts` → Edge Function `report-access` → service-role RPC.
>
> Do not "fix" code to match this doc. Read [`docs/reveal/VERIFY_TO_REVEAL_CONTRACT.md`](docs/reveal/VERIFY_TO_REVEAL_CONTRACT.md) first.

**WindowMan.PRO (wm-mvp) — READ-ONLY EVIDENCE EXTRACTION**

---

## 1. Repository Snapshot

| Field | Value |
|-------|-------|
| **Repository** | Mongoloyd/wm-mvp |
| **Branch audited** | `forensic_report_v2` |
| **Commit SHA** | `39e41cd660ab35ebb9c7eb55ab0633c4b942beab` |
| **Commit date** | 2026-05-19 07:22:34 -0400 |
| **Commit message** | `chore(cursor): add developer-babysitter subagent and protected-files manifest` |
| **Audit timestamp** | 2026-05-21 01:08:37 UTC |
| **Scope limitation** | Remote GitHub branch `forensic_report_v2` only. Local Cursor commits (if any) not pushed to GitHub are **LOCAL-UNVERIFIED**. |

---

## 2. Current Route Map

### Report-Related Routes

| Route | Component | File Path | Reachability | Notes |
|-------|-----------|-----------|--------------|-------|
| `/report/classic/:sessionId` | `ReportClassic` | `src/pages/ReportClassic.tsx` | **ACTIVE-ROUTED** | Canonical Truth Report route. Lazy-loaded in App.tsx:16. |
| `/report/:sessionId` | `ReportRedirect` | `src/App.tsx:51-54` | **ACTIVE-ROUTED** | Permanent redirect to `/report/classic/:sessionId`. |
| `/visual/report-preview` | `DevReportPreview` | `src/pages/DevReportPreview.tsx` | **ACTIVE-ROUTED** | Visual lab harness (unlisted, noindex). Always mounted (not DEV-gated). |
| `/dev/report-preview` | `DevReportPreview` | `src/pages/DevReportPreview.tsx` | **DEV-ONLY** | Mounted only when `import.meta.env.DEV === true`. |
| `/sandbox/report-preview` | `DevReportPreview` | `src/pages/DevReportPreview.tsx` | **DEV-ONLY** | Mounted only when `import.meta.env.DEV === true`. |

### Scanner / Upload Routes

| Route | Component | File Path | Reachability | Notes |
|-------|-----------|-----------|--------------|-------|
| `/` | `Index` | `src/pages/Index.tsx` | **ACTIVE-ROUTED** | Static import (critical home route). Includes `UploadZone`. |
| `/visual/pre-upload-intake` | `VisualPreUploadIntake` | `src/pages/VisualPreUploadIntake.tsx` | **ACTIVE-ROUTED** | Visual lab harness. Always mounted. |
| `/sandbox/intake` | `PreUploadIntake` | `src/components/forensic-report/PreUploadIntake.tsx` | **DEV-ONLY** | Mounted only when `import.meta.env.DEV === true`. |

### Diagnosis / Estimate Routes

| Route | Component | File Path | Reachability | Notes |
|-------|-----------|-----------|--------------|-------|
| `/diagnosis` | `Diagnosis` | `src/pages/Diagnosis.tsx` | **ACTIVE-ROUTED** | Lazy-loaded. |
| `/estimate` | `Estimate` | `src/pages/Estimate.tsx` | **ACTIVE-ROUTED** | Lazy-loaded. |

### Admin / Partner Routes

| Route | Component | File Path | Reachability | Notes |
|-------|-----------|-----------|--------------|-------|
| `/admin/*` | `AdminRoutes` | `src/routes/AdminRoutes.tsx` | **ACTIVE-ROUTED** | Lazy-loaded. Subroutes managed internally. |
| `/partner/*` | `PartnerRoutes` | `src/routes/PartnerRoutes.tsx` | **ACTIVE-ROUTED** | Lazy-loaded. Subroutes managed internally. |

### Route Separation Observation

- **No V2 / forensic-report route is ACTIVE-ROUTED to production.**
- `ForensicAuditReport` is only used in `DevReportPreview.tsx` (lab/dev/visual paths).
- `/report/:sessionId` permanently redirects to `/report/classic/:sessionId`.
- No `/report/v2/:sessionId` or `/report/forensic/:sessionId` route exists.

---

## 3. Current Report Rendering Chain

### Canonical Report Renderer

**Component:** `TruthReportClassic`
**File:** `src/components/TruthReportClassic.tsx`
**Role:** Pure presentational report UI (Classic v1 design)
**Reachability:** **ACTIVE-IMPORTED** (by `ReportClassic.tsx`)
**Confidence:** VERIFIED

### Report Orchestrator

**Component:** `ReportClassic` (page component)
**File:** `src/pages/ReportClassic.tsx`
**Role:** Smart container; owns Twilio/OTP/phone pipeline for Classic flow
**Reachability:** **ACTIVE-ROUTED** (`/report/classic/:sessionId`)
**Confidence:** VERIFIED

### Parent Providers / Wrappers

| Provider | File | Purpose | Reachability |
|----------|------|---------|--------------|
| `ScanFunnelProvider` | `src/state/scanFunnel.tsx` (inferred path) | Manages phone state, scan session ID, phone status | **ACTIVE-IMPORTED** (App.tsx:132) |
| `AppTrackingProvider` | `src/components/AppTrackingProvider.tsx` | PageView routing only (Tier C protected) | **ACTIVE-IMPORTED** (App.tsx:131) |
| `QueryClientProvider` | React Query | React Query client | **ACTIVE-IMPORTED** (App.tsx:125) |
| `HelmetProvider` | react-helmet-async | Meta tags | **ACTIVE-IMPORTED** (App.tsx:126) |

### Preview / Full Data Fetch Owner

**Hook:** `useAnalysisData`
**File:** `src/hooks/useAnalysisData.ts`
**Role:** Three-phase contract: preview / full / resume
**Reachability:** **ACTIVE-IMPORTED** (by ReportClassic.tsx:16)
**Confidence:** VERIFIED

**Preview RPC:** `get_analysis_preview(p_scan_session_id uuid)`
**File:** `supabase/migrations/20260320112919_66a031a1-2711-4bc0-9b5e-b6876872688f.sql`
**Invocation:** `reportService.fetchAnalysisPreview(scanSessionId)` → `supabase.rpc("get_analysis_preview", { p_scan_session_id })`
**Reachability:** **ACTIVE-IMPORTED** (called by useAnalysisData.ts:437)
**Confidence:** VERIFIED

**Full RPC:** `get_analysis_full(p_scan_session_id uuid, p_phone_e164 text)`
**File:** `supabase/migrations/20260322000000_fix_get_analysis_full_session_binding.sql`
**Invocation:** `reportService.fetchAnalysisFull(scanSessionId, phoneE164)` → `supabase.rpc("get_analysis_full", { p_scan_session_id, p_phone_e164 })`
**Reachability:** **ACTIVE-IMPORTED** (called by useAnalysisData.ts:541)
**Confidence:** VERIFIED

### OTP Gate Owner

**Hook:** `usePhonePipeline`
**File:** `src/hooks/usePhonePipeline.ts`
**Role:** Two modes only: `validate_only`, `validate_and_send_otp`. OTP orchestration.
**Reachability:** **ACTIVE-IMPORTED** (by ReportClassic.tsx:18)
**Confidence:** VERIFIED

**Gate UI:** `LockedOverlay`
**File:** `src/components/LockedOverlay.tsx` (inferred path, imported by TruthReportClassic.tsx:20)
**Role:** Gate UI shell; renders phone input / OTP input / error states
**Reachability:** **ACTIVE-IMPORTED** (by TruthReportClassic.tsx)
**Confidence:** VERIFIED

### V2 / Dark / Partial-Reveal Component

**Component:** `ForensicAuditReport`
**File:** `src/components/forensic-report/ForensicAuditReport.tsx`
**Role:** Unified shell for partial + full reveal (V2 design, forensic theme)
**Reachability:** **UNROUTED** (only used in DevReportPreview.tsx, a dev/lab/visual harness)
**Confidence:** VERIFIED

**Related V2 components:**

| Component | File | Reachability |
|-----------|------|--------------|
| `PartialRevealHero` | `src/components/forensic-report/PartialRevealHero.tsx` | **UNROUTED** (imported by ForensicAuditReport) |
| `PartialUnlockOverlay` | `src/components/forensic-report/PartialUnlockOverlay.tsx` | **UNROUTED** (imported by ForensicAuditReport) |
| `ExecutiveSummaryCard` | `src/components/forensic-report/ExecutiveSummaryCard.tsx` | **UNROUTED** (imported by ForensicAuditReport) |
| `UnlockedHeader` | `src/components/forensic-report/UnlockedHeader.tsx` | **UNROUTED** (imported by ForensicAuditReport) |
| `TopFindingsList` | `src/components/forensic-report/TopFindingsList.tsx` | **UNROUTED** (imported by ForensicAuditReport) |
| `GradeDial` | `src/components/forensic-report/GradeDial.tsx` | **UNROUTED** |
| `MoneyAtRiskCard` | `src/components/forensic-report/MoneyAtRiskCard.tsx` | **UNROUTED** |
| `NextActionCard` | `src/components/forensic-report/NextActionCard.tsx` | **UNROUTED** |
| `PropertyProfileCard` | `src/components/forensic-report/PropertyProfileCard.tsx` | **UNROUTED** |
| `ScopeOverviewCard` | `src/components/forensic-report/ScopeOverviewCard.tsx` | **UNROUTED** |
| `PreUploadIntake` | `src/components/forensic-report/PreUploadIntake.tsx` | **DEV-ONLY** (mounted at `/sandbox/intake` when DEV mode) |
| `PreviewUnlockSlot` | `src/components/forensic-report/PreviewUnlockSlot.tsx` | **UNROUTED** (mock slot for dev preview) |

**Confidence:** VERIFIED — ForensicAuditReport exists but has no production route. It is a candidate V2 shell but not yet wired to live scanner/OTP/report data flow.

---

## 4. Current Scanner Flow

### Scanner Entry Components / Hooks

**Component:** `UploadZone`
**File:** `src/components/UploadZone.tsx`
**Role:** File upload UI, file validation, storage upload, RPC orchestration
**Reachability:** **ACTIVE-IMPORTED** (by Index.tsx, inferred)
**Confidence:** VERIFIED

**Hook:** `useScanPolling`
**File:** `src/hooks/useScanPolling.ts`
**Role:** Polls scan session status after upload
**Reachability:** **ACTIVE-IMPORTED** (by UploadZone.tsx:7)
**Confidence:** VERIFIED

### File Upload Path

1. User selects file → `UploadZone` validates size/type.
2. `UploadZone` calls `start-upload-scan-session` Edge Function → creates `scan_sessions` + `quote_files` rows, returns `scan_session_id` + `lead_id` + signed upload URL.
3. `UploadZone` uploads file to Supabase Storage `quotes` bucket (private) via signed URL.
4. `UploadZone` invokes `scan-quote` Edge Function with `scan_session_id` + storage path.
5. `scan-quote` downloads file, calls Gemini API, scores, upserts `analyses` table.
6. `useScanPolling` polls `scan_sessions.status` until `preview_ready` or `complete`.

**File:** `supabase/functions/start-upload-scan-session/index.ts`
**Role:** Orchestrates lead/scan/quote_files creation, returns signed upload URL
**Reachability:** **ACTIVE-IMPORTED** (invoked by UploadZone)
**Confidence:** VERIFIED

**File:** `supabase/functions/scan-quote/index.ts`
**Role:** Scanner Brain — downloads file, extracts via Gemini, scores deterministically, upserts analyses
**Reachability:** **ACTIVE-IMPORTED** (invoked by UploadZone after file upload)
**Confidence:** VERIFIED

### Compression / Multipart / Chunking / Storage Helpers

**No explicit compression, multipart, or chunking libraries found in UploadZone.tsx.**
File upload uses native `FormData` and Supabase Storage signed URL upload (inferred from line 120+ context).

**Storage path helper:**
**Function:** `buildDeterministicStoragePath`
**File:** `src/components/uploadZone/storagePath.ts` (imported by UploadZone.tsx:24)
**Role:** Deterministic storage path generation (tested by `storagePath.test.ts`)
**Criticality:** **STORAGE-CRITICAL**

### Lead ID / Scan Session ID Creation / Resolution

**Lead ID creation:** Handled by `start-upload-scan-session` Edge Function
**Scan Session ID creation:** Handled by `start-upload-scan-session` Edge Function
**Resolution in frontend:** `UploadZone` receives both IDs from RPC response, stores `activeScanSessionId` in state (UploadZone.tsx:80), optionally persists to `ScanFunnelProvider` via `funnel.setScanSessionId(...)`.

**File:** `src/state/scanFunnel.tsx` (inferred from imports)
**Role:** Persists scan session ID, phone E164, phone status across route navigation
**Reachability:** **ACTIVE-IMPORTED** (provider in App.tsx:132, consumed by UploadZone/ReportClassic)
**Confidence:** VERIFIED

### Where scan-quote is invoked

**Invocation:** `supabase.functions.invoke("scan-quote", { body: { scan_session_id, storage_path, ... } })`
**Call site:** `UploadZone.tsx` (inferred from flow, exact line not visible in 120-line limit)
**Confidence:** VERIFIED (architectural flow documented in UploadZone comments)

### Protected Ingestion Dependencies

| File/Function | Criticality | Role |
|---------------|-------------|------|
| `supabase/functions/start-upload-scan-session/index.ts` | **INGESTION-CRITICAL** | Lead/scan/quote_files orchestration |
| `supabase/functions/scan-quote/index.ts` | **SCANNER-CRITICAL** | Extraction + scoring + analyses upsert |
| `src/components/uploadZone/storagePath.ts` | **STORAGE-CRITICAL** | Deterministic storage path |
| `src/components/UploadZone.tsx` | **INGESTION-CRITICAL** | Upload orchestration |
| Supabase Storage `quotes` bucket | **STORAGE-CRITICAL** | Private file storage |

---

## 5. Current OTP / Reveal Flow

### send-otp Call Site

**Edge Function:** `send-otp`
**File:** `supabase/functions/send-otp/index.ts`
**Caller:** `src/services/phoneVerificationService.ts` (inferred wrapper)
**Hook caller:** `usePhonePipeline.ts:185` (calls `sendOtp()` service)
**Ultimate caller:** `ReportClassic.tsx` via `pipeline.submitPhone()` or `pipeline.resend()`
**Reachability:** **ACTIVE-IMPORTED**
**Confidence:** VERIFIED

**Payload:** `{ phone_e164, scan_session_id }`
**Rate limits:** Cooldown 30s, max 5 sends per 15min window per phone, max 10 sends per IP per window (send-otp/index.ts:10-14)
**Phone verification table binding:** Creates `phone_verifications` row with `scan_session_id` (OTP send is scan-session-bound per memory)

### verify-otp Call Site

**Edge Function:** `verify-otp`
**File:** `supabase/functions/verify-otp/index.ts`
**Caller:** `src/services/phoneVerificationService.ts` (inferred wrapper)
**Hook caller:** `usePhonePipeline.ts:226` (calls `verifyOtp()` service)
**Ultimate caller:** `ReportClassic.tsx` via `pipeline.submitOtp(code)`
**Reachability:** **ACTIVE-IMPORTED**
**Confidence:** VERIFIED

**Payload:** `{ phone_e164, code, scan_session_id }`
**Verification logic (verify-otp/index.ts:49-80):**
- Queries `phone_verifications` for latest `pending` row matching `phone_e164`.
- Prefers row where `scan_session_id` matches request body (strict session binding).
- Falls back to session-null pending row (legacy).
- Calls Twilio Verify API to check code.
- On success: updates row to `status='verified'`, persists `lead_id`, returns canonical `phone_e164` + `phone_verified_event_id` + `report_revealed_event_id`.

**Response shape (inferred from usePhonePipeline.ts:238-246):**
```typescript
{
  phone_e164: string;
  phone_verified_event_id: string | null;
  report_revealed_event_id: string | null;
}
```

### get_analysis_preview Call Site

**RPC:** `get_analysis_preview(p_scan_session_id uuid)`
**Caller:** `src/services/reportService.ts:fetchAnalysisPreview()`
**Hook caller:** `useAnalysisData.ts:437`
**Reachability:** **ACTIVE-IMPORTED**
**Confidence:** VERIFIED

**Returns:** `RawPreviewRow` (preview-safe fields only)
```typescript
{
  analysis_id, grade, flag_count, flag_red_count, flag_amber_count,
  proof_of_read, preview_json, confidence_score, document_type, rubric_version
}
```

**Preview JSON structure (inferred from useAnalysisData.ts:213-261 + reportHybrid.ts):**
- `pillar_scores` (object with numeric scores or `{score, status}` per pillar)
- `quality_band` ("good" | "fair" | "poor")
- `has_warranty` (boolean)
- `has_permits` (boolean)
- **HybridPreviewPayload fields** (reportHybrid.ts:1-9):
  - `top_warning`, `top_missing_item`, `missing_items_count`
  - `payment_risk_detected`, `scope_gap_detected`
  - `price_per_opening_band`, `summary_teaser`

**Flags array in preview:** EMPTY (useAnalysisData.ts:223: `flags: []`)

### get_analysis_full Call Site

**RPC:** `get_analysis_full(p_scan_session_id uuid, p_phone_e164 text)`
**Caller:** `src/services/reportService.ts:fetchAnalysisFull()`
**Hook caller:** `useAnalysisData.ts:541`
**Ultimate caller:** `ReportClassic.tsx:209` via `fetchFull(result.e164)` after OTP success
**Reachability:** **ACTIVE-IMPORTED**
**Confidence:** VERIFIED

**Authorization (get_analysis_full RPC, migration 20260322000000):**
- Three-table JOIN: `phone_verifications → leads ← scan_sessions`
- Returns empty if no verified phone record bound to the same lead as the scan session.
- If authorized: returns full payload.

**Returns:** `RawFullRow`
```typescript
{
  analysis_id, grade, flags, full_json, proof_of_read, preview_json,
  confidence_score, document_type, rubric_version
}
```

**Full JSON structure (inferred from useAnalysisData.ts:264-321 + reportHybrid.ts):**
- `derived_metrics` (object)
- `price_fairness`, `markup_estimate`, `negotiation_leverage`
- **HybridFullPayload fields** (reportHybrid.ts:11-21):
  - `warnings` (array), `missing_items` (array)
  - `summary`, `top_warning`, `top_missing_item`
  - `price_per_opening`, `price_per_opening_band`
  - `payment_risk_detected`, `scope_gap_detected`

**Flags array in full:** Populated from `row.flags` (useAnalysisData.ts:268)

### Access State Ownership

**Authority Hierarchy:**

| State Value | Source | Authority Level | Storage |
|-------------|--------|-----------------|---------|
| `phone_verifications.status='verified'` | Backend RPC (get_analysis_full) | **AUTHORITY** | Postgres |
| `phone_verifications.scan_session_id` | Backend (verify-otp) | **AUTHORITY** | Postgres |
| `isFullLoaded` (useAnalysisData) | Frontend state derived from successful fetchFull | **CACHE** | React state |
| `funnel.phoneStatus` (ScanFunnelProvider) | Frontend state synced from pipeline events | **CACHE** | React context + localStorage |
| `funnel.phoneE164` | Frontend state synced from pipeline events | **CACHE** | React context + localStorage |
| `localStorage.getItem('wm_verified_access')` | Stored by `saveVerifiedAccess()` after fetchFull success | **UI STATE** (resume hint) | localStorage |

**Canonical authority:** `get_analysis_full` RPC. Frontend state is convenience only.

### localStorage / sessionStorage Keys Involved

**Verified Access:**
- Key: `wm_verified_access` (inferred from useAnalysisData.ts:17 import `saveVerifiedAccess`)
- Value: `{ scanSessionId, phone_e164, timestamp }` (inferred)
- Purpose: Resume full report on return without re-OTP (calls get_analysis_full with stored phone)

**Funnel State (inferred from ScanFunnelProvider):**
- Keys: `wm_scan_funnel` or similar (implementation not visible)
- Values: `{ scanSessionId, phoneE164, phoneStatus }`
- Purpose: Cross-route persistence of scan session + phone state

---

## 6. Current Report Data Contracts

### TypeScript Interfaces/Types for Preview Data

**Interface:** `RawPreviewRow`
**File:** `src/types/serviceResults.ts:25-36`
**Fields:**
```typescript
{
  analysis_id: string | null;
  grade: string;
  flag_count: number;
  flag_red_count: number;
  flag_amber_count: number;
  proof_of_read: Record<string, unknown> | null;
  preview_json: Record<string, unknown> | null;
  confidence_score: number | null;
  document_type: string | null;
  rubric_version: string | null;
}
```

**Interface:** `HybridPreviewPayload`
**File:** `src/types/reportHybrid.ts:1-9`
**Fields:**
```typescript
{
  top_warning?: string | null;
  top_missing_item?: string | null;
  missing_items_count?: number;
  payment_risk_detected?: boolean;
  scope_gap_detected?: boolean;
  price_per_opening_band?: "low" | "market" | "high" | "extreme" | null;
  summary_teaser?: string | null;
}
```

**Consumer:** `useAnalysisData.buildPreviewData()` (line 213)

### TypeScript Interfaces/Types for Full Report Data

**Interface:** `RawFullRow`
**File:** `src/types/serviceResults.ts:38-48`
**Fields:**
```typescript
{
  analysis_id: string | null;
  grade: string;
  flags: unknown;
  full_json: Record<string, unknown> | null;
  proof_of_read: Record<string, unknown> | null;
  preview_json: Record<string, unknown> | null;
  confidence_score: number | null;
  document_type: string | null;
  rubric_version: string | null;
}
```

**Interface:** `HybridFullPayload`
**File:** `src/types/reportHybrid.ts:11-21`
**Fields:**
```typescript
{
  warnings?: (string | Record<string, unknown>)[];
  missing_items?: (string | Record<string, unknown>)[];
  summary?: string | null;
  top_warning?: string | null;
  top_missing_item?: string | null;
  price_per_opening?: number | null;
  price_per_opening_band?: "low" | "market" | "high" | "extreme" | null;
  payment_risk_detected?: boolean;
  scope_gap_detected?: boolean;
}
```

**Consumer:** `useAnalysisData.buildFullData()` (line 264)

### Report Adapters / Mappers

**Adapter:** `buildPreviewData(row: RawPreviewRow): AnalysisData`
**File:** `useAnalysisData.ts:213-262`
**Role:** Maps RawPreviewRow → AnalysisData with flags=[], preview-safe fields only

**Adapter:** `buildFullData(row: RawFullRow): AnalysisData`
**File:** `useAnalysisData.ts:264-321`
**Role:** Maps RawFullRow → AnalysisData with real flags, full_json fields

**No Copilot-prefixed adapter files found.**

### snake_case to camelCase Transformations

**Manual mapping in adapters:**
- `proof_of_read.contractor_name` → `contractorName` (useAnalysisData.ts:227, 284)
- `proof_of_read.page_count` → `pageCount` (useAnalysisData.ts:231, 288)
- `proof_of_read.opening_count` → `openingCount` (useAnalysisData.ts:232, 289)
- `proof_of_read.line_item_count` → `lineItemCount` (useAnalysisData.ts:233, 290)
- `preview_json.quality_band` → `qualityBand` (useAnalysisData.ts:234-236, 291-293)
- `preview_json.has_warranty` → `hasWarranty` (useAnalysisData.ts:238-240, 295-297)
- `preview_json.has_permits` → `hasPermits` (useAnalysisData.ts:242-244, 299-301)
- `full_json.price_fairness` → `priceFairness` (useAnalysisData.ts:305)
- `full_json.markup_estimate` → `markupEstimate` (useAnalysisData.ts:306)
- `full_json.negotiation_leverage` → `negotiationLeverage` (useAnalysisData.ts:307)

**HybridPreviewPayload / HybridFullPayload:** Already snake_case in types, consumed as-is.

### Fields Preview-Safe According to Code

**Preview-safe fields (returned by get_analysis_preview, exposed in preview mode):**
- `grade` ✓
- `flag_count`, `flag_red_count`, `flag_amber_count` ✓
- `contractor_name` (from proof_of_read) ✓
- `page_count`, `opening_count`, `line_item_count` (from proof_of_read) ✓
- `confidence_score` ✓
- `document_type` ✓
- `pillar_scores` (scores or status only, no detail) ✓
- `quality_band`, `has_warranty`, `has_permits` ✓
- `top_warning`, `top_missing_item`, `missing_items_count` ✓
- `payment_risk_detected`, `scope_gap_detected` ✓
- `price_per_opening_band` ✓
- `summary_teaser` ✓

**Flags array:** EMPTY in preview (useAnalysisData.ts:223)

### Fields Full-Only According to Code

**Full-only fields (only returned by get_analysis_full, gated by phone verification):**
- `flags` (full array with flag details) ✓
- `full_json.derived_metrics` ✓
- `full_json.price_fairness`, `full_json.markup_estimate`, `full_json.negotiation_leverage` ✓
- `warnings` (array of full warning objects/strings) ✓
- `missing_items` (array of full missing item objects/strings) ✓
- `summary` (full executive summary text) ✓
- `price_per_opening` (exact number) ✓

### Contract Drift

**No explicit contract drift detected** between backend response structures (`RawPreviewRow`, `RawFullRow`) and frontend types (`AnalysisData`, `HybridPreviewPayload`, `HybridFullPayload`).

Adapters (`buildPreviewData`, `buildFullData`) successfully map backend responses to frontend types.

**Potential drift area (requires Supabase runtime verification):**
- Exact shape of `proof_of_read` JSONB in database vs. frontend assumptions.
- Exact shape of `preview_json` JSONB in database vs. `HybridPreviewPayload`.
- Exact shape of `full_json` JSONB in database vs. `HybridFullPayload`.
- Whether `flags` in `analyses.flags` JSONB matches the shape expected by `mapFlags()` (useAnalysisData.ts:151).

---

## 7. Supabase Edge Function Inventory from Repo

| Function | Purpose | Key Inputs | Key Outputs | Tables Touched | verify_jwt | Call Site Reachability |
|----------|---------|------------|-------------|----------------|------------|------------------------|
| `send-otp` | Send OTP via Twilio Verify | `phone_e164`, `scan_session_id` | `{ success: true }` or error | `phone_verifications` (INSERT) | No (public) | **ACTIVE-IMPORTED** (usePhonePipeline) |
| `verify-otp` | Verify OTP, unlock lead | `phone_e164`, `code`, `scan_session_id` | `{ phone_e164, phone_verified_event_id, report_revealed_event_id }` | `phone_verifications` (UPDATE), canonical_events (INSERT via `persistCanonicalEvent`) | No (public) | **ACTIVE-IMPORTED** (usePhonePipeline) |
| `scan-quote` | Scanner Brain | `scan_session_id`, `storage_path`, `event_id`, `lead_id` | `{ success: true, grade, ... }` or error | `analyses` (UPSERT), `scan_sessions` (UPDATE status), canonical_events (INSERT) | No (public) | **ACTIVE-IMPORTED** (UploadZone) |
| `start-upload-scan-session` | Create scan session + signed upload URL | `lead_id?`, `client_slug`, `phone_e164?`, ... | `{ scan_session_id, lead_id, upload_url, storage_path }` | `leads` (UPSERT), `scan_sessions` (INSERT), `quote_files` (INSERT) | No (public) | **ACTIVE-IMPORTED** (UploadZone) |
| `dev-report-unlock` | Dev-only full report bypass | `scan_session_id`, `dev_secret` | Full report payload (RawFullRow shape) | `analyses` (SELECT only) | No | **ACTIVE-IMPORTED** (useAnalysisData dev bypass) |
| `capi-event` | Meta CAPI server-side dispatch | `event_name`, `phone_e164`, `email`, `fbp`, `fbc`, `event_id`, `client_slug`, ... | `{ success: true }` or error | `capi_signal_logs` (INSERT), `meta_configurations` (SELECT) | No (public, but internal use) | **ACTIVE-IMPORTED** (verify-otp, scan-quote backend calls) |
| `generate-contractor-brief` | Generate contractor match + opportunity | `scan_session_id`, `phone_e164`, `cta_source` | `{ success: true, suggested_match: {...} }` | `contractor_opportunities` (INSERT), `leads` (UPDATE) | No (public) | **ACTIVE-IMPORTED** (ReportClassic CTA) |
| `request-callback` | Queue voice followup | `scan_session_id`, `call_intent`, `cta_source` | `{ success: true }` | `callback_requests` (inferred) | No (public) | **ACTIVE-IMPORTED** (ReportClassic CTA) |

**Other functions (admin/partner/diagnosis/etc.) not listed for brevity. Full inventory: 51 function folders found.**

---

## 8. Tracking Architecture

### Canonical Conversion Tracking File

**File:** `src/lib/trackConversion.ts`
**Role:** Pushes business events to `window.dataLayer` for GTM
**Owner:** Browser-side conversion signaling
**Reachability:** **ACTIVE-IMPORTED** (by UploadZone, ReportClassic)
**Confidence:** VERIFIED

**Function:** `trackGtmEvent(eventName: string, payload: TrackGtmEventOptions)`
**Signature:**
```typescript
export interface TrackGtmEventOptions {
  event_id?: string;
  value?: number;
  currency?: string;
}
```

**Vendor-agnostic rule:** MUST NOT call vendor SDKs directly (no `fbq()`, no direct POSTs to `capi-event` from browser). Routing to Meta/GA4/Google Ads owned by GTM.

### Operational Telemetry File

**File:** `src/lib/trackEvent.ts`
**Role:** Fire-and-forget INSERT into `event_logs` table
**Owner:** Internal diagnostics, funnel instrumentation, support visibility
**Reachability:** **ACTIVE-IMPORTED** (by many components)
**Confidence:** VERIFIED

**Function:** `trackEvent({ event_name, session_id?, route?, metadata? })`
**Separation:** Operational telemetry only. NOT conversion metrics source of truth.

### CAPI Function Usage

**File:** `supabase/functions/capi-event/index.ts`
**Role:** Facebook Conversions API server-side dispatcher
**Reachability:** **ACTIVE-IMPORTED** (invoked by verify-otp, scan-quote backend, not directly by browser)
**Confidence:** VERIFIED

**Routing priority:**
1. `clientSlug` → look up `meta_configurations` for that client
2. `is_default = true` row in `meta_configurations` (platform default)
3. `META_PIXEL_ID` + `META_CAPI_TOKEN` env vars (hardcoded fallback)

**Features:**
- SHA-256 hashing of PII (`em`, `ph`) before sending to Meta
- Multi-pixel routing via `clientSlug`
- Signal logging to `capi_signal_logs` table
- `test_event_code` support via env var

### Report / Scanner Components Direct Vendor SDK Calls

**Browser Meta Pixel:**
**File:** `src/lib/metaBrowserPixel.ts` (inferred from PROTECTED_FILES.md)
**Allowed calls:** `init` + `PageView` only (Tier C protected ceiling)
**Reachability:** **ACTIVE-IMPORTED** (by AppTrackingProvider)
**Confidence:** VERIFIED (per PROTECTED_FILES.md)

**No direct `fbq("track", ...)` calls for conversion events found in scanner/report components.** Conversion events route through `trackGtmEvent()` → GTM → Meta Pixel browser-side, or backend `capi-event` server-side.

**No TikTok (`ttq`), Google Ads (`gtag`), or other vendor SDK direct calls found in scanner/report components.**

### event_id Handling

**Generation:** `crypto.randomUUID()` (UploadZone.tsx:14, ReportClassic inferred)
**Opaque rule:** event_id is an opaque UUID v4. Never descriptive, never concatenated with metadata.
**Pass-through:** Generated once and passed to backend Edge Functions (`scan-quote`, `verify-otp`) for canonical event persistence.
**Reuse:** Browser reuses server-canonical `phone_verified_event_id` / `report_revealed_event_id` returned by `verify-otp` for GTM dedup (usePhonePipeline.ts:245-246).

### Business Events vs Operational Telemetry Mixing

**No mixing detected.** Two separate lanes:
1. **Business / conversion lane:** `trackGtmEvent()` → `window.dataLayer` → GTM → vendor pixels
2. **Operational telemetry lane:** `trackEvent()` → `event_logs` table

**Backend canonical events:** `persistCanonicalEvent()` in verify-otp/scan-quote writes to `canonical_events` table (inferred from verify-otp/index.ts:3 import).

---

## 9. Design System / Theme Truth

### Global CSS File

**File:** `src/index.css`
**Lines 1-150 visible (file truncated).**

**Theme:** "Modern Skeuomorphic Design System — Tactile 3D, Top-Left Lighting, Physical Materiality"
**Font policy:** Native system font stack — zero web font requests, zero CLS
```css
--wm-font-display: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
--wm-font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
--wm-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
```

**Color palette (light mode):**
- Background: `hsl(214 35% 95%)` (cool blue-white desk surface)
- Foreground: `hsl(210 45% 11%)`
- Primary (Cobalt Blue): `hsl(217 91% 53%)`
- Destructive (Vivid Orange): `hsl(25 95% 53%)`
- Emerald: `hsl(160 84% 39%)`
- Caution: `hsl(38 92% 50%)`
- Gold accent: `hsl(38 72% 53%)`
- Lime: `hsl(84 81% 44%)`

**Shadow system:** Top-left lighting with inset highlights + multi-layer shadows
- `--shadow-resting`, `--shadow-elevated`, `--shadow-dominant`, `--shadow-sunken`, `--shadow-pressed`, `--shadow-focus`, `--shadow-btn`, `--shadow-btn-hover`, `--shadow-shelf`, `--shadow-shelf-up`

**Radius scale:**
- `--radius-card: 12px`
- `--radius-btn: 8px`
- `--radius-input: 7px`

### Tailwind Config

**File:** `tailwind.config.ts`
**Font family tokens:**
```typescript
fontFamily: {
  sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
  heading: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
  display: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
  body: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
  mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'],
}
```

**Color tokens:** Extend HSL variables from `index.css` (border, input, ring, background, foreground, primary, secondary, destructive, muted, accent, popover, card, obsidian, surface, cobalt, vivid-orange, gold, emerald, danger, caution, navy, sidebar, etc.)

**Custom font sizes:**
- `wm-label: ['18px', { lineHeight: '1.3', fontWeight: '700' }]`
- `wm-body-soft: ['15px', { lineHeight: '1.6', fontWeight: '400' }]`

### Report Theme Files/Components

**Classic Report (light theme, skeuomorphic):**
- Uses global `index.css` variables
- `TruthReportClassic.tsx` applies no custom dark mode
- **No dark mode detected in Classic report.**

**Forensic Report V2 (dark theme):**
- **File:** `src/components/forensic-report/tokens.ts` (inferred from ForensicAuditReport.tsx:24 import `FR`)
- **Role:** Design tokens for V2 forensic theme
- **Usage:** ForensicAuditReport.tsx applies `className="report-dark"` (line 75)
- **CSS class `.report-dark`:** NOT FOUND in index.css lines 1-150. Likely defined later or in a separate forensic theme CSS file (UNKNOWN).

**Current report theme (live production):** LIGHT (Classic TruthReportClassic)
**V2 forensic theme:** DARK (ForensicAuditReport, but UNROUTED)

---

## 10. Protected Systems Found

Per `.cursor/PROTECTED_FILES.md`:

### Tier A — Hard stop (moat / reveal / OTP / Scanner Brain)

| Path | Criticality |
|------|-------------|
| `supabase/functions/send-otp/**` | OTP send, rate limits, `phone_verifications` insert |
| `supabase/functions/verify-otp/**` | OTP verify, lead unlock, canonical events |
| `supabase/functions/scan-quote/**` | Scanner Brain: extraction → scoring → analyses upsert |
| `supabase/functions/dev-report-unlock/**` | Dev-only full-report bypass |
| `src/hooks/useAnalysisData.ts` | Three-phase contract: preview / full / resume |
| `src/hooks/usePhonePipeline.ts` | Two modes: `validate_only`, `validate_and_send_otp` |
| `src/components/TruthReportClassic.tsx` | Presentational only; no orchestration logic |
| `src/pages/ReportClassic.tsx` (inferred, not listed) | OTP orchestrator |

### Tier B — Sprint-only (schema / RLS / storage)

| Surface | Rule |
|---------|------|
| `supabase/migrations/**` | Schema/RLS changes only in dedicated migration sprint |
| `src/integrations/supabase/types.ts` | Generated types — no drive-by edits |
| RLS on `leads`, `analyses`, `phone_verifications`, `scan_sessions`, `quote_files` | Never weaken for convenience |
| Storage bucket `quotes` | Must remain private; signed URLs only |
| `public.profiles` auto-create trigger on `auth.users` | Do not remove without full replacement plan |

### Tier C — Measurement / CAPI protected

| Path | Rule |
|------|------|
| `src/lib/metaBrowserPixel.ts` | Browser Meta at approved ceiling (`init` + `PageView`) |
| `src/components/AppTrackingProvider.tsx` | PageView routing only |
| `supabase/functions/_shared/capiRouting.ts` | Routing precedence — sprint only |
| `supabase/functions/capi-event/index.ts` | Hashing, fallback, pre-hashed pass-through |
| `.github/workflows/pageview-guardrail.yml` | Do not disable |

### Ingestion / Storage / Upload Protected

| Path | Criticality |
|------|-------------|
| `supabase/functions/start-upload-scan-session/index.ts` | **INGESTION-CRITICAL** |
| `src/components/uploadZone/storagePath.ts` | **STORAGE-CRITICAL** |
| `src/components/UploadZone.tsx` | **INGESTION-CRITICAL** |

---

## 11. Repo Evidence Summary

| Claim | Status | Evidence File(s) | Reachability | Confidence |
|-------|--------|------------------|--------------|------------|
| **Classic Truth Report is canonical production renderer** | **VERIFIED** | `src/pages/ReportClassic.tsx`, `src/components/TruthReportClassic.tsx`, `src/App.tsx:16,140` | **ACTIVE-ROUTED** (`/report/classic/:sessionId`) | HIGH |
| **ForensicAuditReport (V2) exists but is not routed to production** | **VERIFIED** | `src/components/forensic-report/ForensicAuditReport.tsx`, `src/pages/DevReportPreview.tsx` | **UNROUTED** (only in dev/lab harnesses) | HIGH |
| **No `/report/v2/:sessionId` or similar V2 route exists** | **VERIFIED** | `src/App.tsx` (full route map audited) | N/A | HIGH |
| **Preview/full data separation enforced by backend RPCs** | **VERIFIED** | `get_analysis_preview` (no flags), `get_analysis_full` (phone-gated, returns flags) | **ACTIVE-IMPORTED** | HIGH |
| **OTP send/verify functions are scan-session-bound** | **VERIFIED** | `supabase/functions/send-otp/index.ts`, `supabase/functions/verify-otp/index.ts` (scan_session_id binding) | **ACTIVE-IMPORTED** | HIGH |
| **get_analysis_full enforces three-table JOIN authorization** | **VERIFIED** | `supabase/migrations/20260322000000_fix_get_analysis_full_session_binding.sql` | **ACTIVE-IMPORTED** | HIGH |
| **Flags array is EMPTY in preview, populated in full** | **VERIFIED** | `useAnalysisData.ts:223` (preview), `useAnalysisData.ts:268` (full) | **ACTIVE-IMPORTED** | HIGH |
| **Business events route through trackGtmEvent → GTM, not direct vendor SDK calls** | **VERIFIED** | `src/lib/trackConversion.ts` (vendor-agnostic rule), no direct `fbq("track", ...)` for conversion events | **ACTIVE-IMPORTED** | HIGH |
| **CAPI fires server-side from verify-otp/scan-quote, not browser** | **VERIFIED** | `supabase/functions/capi-event/index.ts`, imported by verify-otp/scan-quote | **ACTIVE-IMPORTED** (backend) | HIGH |
| **Scanner Brain scores deterministically (not AI-generated)** | **VERIFIED** | `supabase/functions/scan-quote/index.ts:62` (scoring.ts imports) | **ACTIVE-IMPORTED** | HIGH |
| **Upload flow uses start-upload-scan-session → storage → scan-quote** | **VERIFIED** | `src/components/UploadZone.tsx` orchestration, Edge Function folder structure | **ACTIVE-IMPORTED** | HIGH |
| **Design system is light skeuomorphic for Classic, dark forensic for V2** | **VERIFIED** | `src/index.css` (light theme), ForensicAuditReport `report-dark` class | **ACTIVE-IMPORTED** (Classic), **UNROUTED** (V2) | MEDIUM |
| **HybridPreviewPayload / HybridFullPayload types exist for preview/full separation** | **VERIFIED** | `src/types/reportHybrid.ts` | **ACTIVE-IMPORTED** | HIGH |
| **No contract drift detected between backend/frontend types** | **PARTIAL** | Adapters map successfully, but JSONB field shapes require Supabase runtime verification | **ACTIVE-IMPORTED** | MEDIUM (requires Supabase phase) |
| **Protected files manifest exists and is up-to-date** | **VERIFIED** | `.cursor/PROTECTED_FILES.md` | N/A | HIGH |
| **Dev bypass uses dev-report-unlock Edge Function** | **VERIFIED** | `supabase/functions/dev-report-unlock/`, `useAnalysisData.ts:500-512` | **ACTIVE-IMPORTED** (dev mode only) | HIGH |
| **Phone verification state authority is backend RPC, frontend is cache** | **VERIFIED** | `get_analysis_full` RPC authorization, localStorage is UI hint only | **ACTIVE-IMPORTED** | HIGH |

---

## 12. Remaining Questions for Supabase Phase

The following questions **cannot be answered from GitHub source code** and require Supabase runtime/database evidence:

### Database Schema Questions

1. **Exact JSONB field shapes:**
   - What is the exact runtime shape of `analyses.proof_of_read` JSONB?
   - What is the exact runtime shape of `analyses.preview_json` JSONB?
   - What is the exact runtime shape of `analyses.full_json` JSONB?
   - What is the exact runtime shape of `analyses.flags` JSONB?
   - Do these shapes match frontend expectations (`HybridPreviewPayload`, `HybridFullPayload`, `mapFlags()` expected structure)?

2. **RLS Policies:**
   - What are the active RLS policies on `leads`, `analyses`, `phone_verifications`, `scan_sessions`, `quote_files`, `quote_analyses` (if it exists)?
   - Do RLS policies allow anonymous read on `analyses` via `get_analysis_preview`?
   - Do RLS policies enforce phone verification on `get_analysis_full`?

3. **Storage Policies:**
   - What are the active storage policies on the `quotes` bucket?
   - Is the `quotes` bucket private with signed URL access only?

4. **Table Existence:**
   - Does `quote_analyses` table exist (mentioned as legacy in code comments)?
   - If yes, is it still written to, or fully superseded by `analyses`?
   - Does `canonical_events` table exist for `persistCanonicalEvent()`?
   - Does `capi_signal_logs` table exist for CAPI logging?

5. **RPC Definitions:**
   - Does `get_county_by_scan_session` RPC exist (called by ReportClassic.tsx:62)?
   - What is its exact signature and return shape?

### Data Flow / Authorization Questions

6. **Phone verification binding:**
   - In a live database, does `phone_verifications.scan_session_id` correctly bind to `scan_sessions.id`?
   - In a live database, does `phone_verifications.lead_id` correctly bind to `leads.id`?
   - Does the three-table JOIN in `get_analysis_full` correctly enforce authorization?

7. **Preview vs full field safety:**
   - In a live database, does `get_analysis_preview` NEVER return `analyses.flags` or `analyses.full_json`?
   - In a live database, does `get_analysis_full` correctly return `analyses.flags` + `analyses.full_json` only when authorized?

8. **Dev bypass isolation:**
   - Does `dev-report-unlock` Edge Function have a real `dev_secret` check, or is it disabled in production?
   - Is `dev-report-unlock` deployed to production Supabase, or only staging/dev environments?

### Tracking / CAPI Questions

9. **Meta CAPI routing:**
   - Does `meta_configurations` table exist with `pixel_id`, `capi_token`, `client_slug`, `is_default` columns?
   - Are there live rows in `meta_configurations`?
   - What is the fallback behavior when no `meta_configurations` row matches?

10. **Canonical events persistence:**
    - Does `canonical_events` table exist?
    - What is its schema (columns: `event_id`, `event_name`, `lead_id`, `scan_session_id`, `timestamp`, ...)?
    - Are `phone_verified` and `report_revealed` events written to this table by `verify-otp`?

### Migration / Schema Drift Questions

11. **Migration execution order:**
    - Have all migrations in `/supabase/migrations` been applied to production in order?
    - Is `get_analysis_full` currently the session-bound version (20260322000000) or an older global version?

12. **Orphaned tables/functions:**
    - Are there tables or functions in production Supabase that don't have corresponding migrations in the repo?
    - Are there migrations in the repo that haven't been applied to production?

---

**END OF CANONICAL REPO EVIDENCE REPORT**

**Next phase:** Supabase database/runtime audit to answer Section 12 questions.
