# Canonical Integration Specification — WindowMan ↔ External Copilot

> **Status:** Read-only forensic manifest. No application code, migrations, Edge Functions, RLS, schema, routes, OTP/Twilio, scan, report, tracking, or contractor-routing logic was modified to produce this document.
>
> **Verification rule applied throughout:** every fact carries an exact path (file, migration, table, Edge Function, generated type). Anything not directly verified from repo files, migrations, generated Supabase types, or visible schema context is marked **UNCLEAR — NEEDS MANUAL REVIEW** rather than asserted.

---

## SECTION 1 — Executive Integration Summary

**Verified stack** (`package.json`):
- React 18.3.1, Vite, TypeScript, Tailwind, shadcn/ui (`components.json` present), `react-router-dom@6.30.1`, `@tanstack/react-query@5.83.0`, `@supabase/supabase-js@2.99.2`, `react-helmet-async@3`, `framer-motion@12`, `recharts@2`, `sonner@1.7.4`, `lucide-react@0.462`.

**Verified routing** (`src/App.tsx`):
- Public root `/` → `src/pages/Index.tsx` (statically imported).
- `/lp/:slug`, `/estimate`, `/diagnosis`, `/report/classic/:sessionId`, `/report/:sessionId` (redirect), `/admin/*` (`src/routes/AdminRoutes.tsx`), `/partner/*` (`src/routes/PartnerRoutes.tsx`), DEV-only `/demo-classic`, `/dev/report-preview`, `/devtesting`, `/dialer|/settings|/partners` redirects, plus public content under `PublicLayout`.

**Verified Supabase integration:**
- Single client at `src/integrations/supabase/client.ts` using anon publishable key.
- Generated types at `src/integrations/supabase/types.ts` (per project rule: never modify).
- Edge Functions live in `supabase/functions/<name>/index.ts`.

**Verified auth/OTP model:**
- Twilio Verify-backed Edge Functions: `supabase/functions/send-otp/index.ts`, `supabase/functions/verify-otp/index.ts`.
- Frontend pipeline: `src/hooks/usePhonePipeline.ts` (modes `validate_only` and `validate_and_send_otp`, per project invariants).

**Verified scan/report model:**
- Scan Edge Function: `supabase/functions/scan-quote/index.ts` (with `flagging.ts`, `scoring.ts`, `reportCompiler.ts`, `sessionRecovery.ts`, `requestSchema.ts` — deterministic TypeScript scoring lives here).
- Upload broker: `supabase/functions/start-upload-scan-session/index.ts`.
- Report transport: `src/services/reportService.ts` calls RPCs `get_scan_status`, `get_analysis_preview`, `get_analysis_full(p_scan_session_id, p_phone_e164)`. Sentinel `__UNAUTHORIZED__` enforces the gate (see `fetchAnalysisFull` in `src/services/reportService.ts`).
- RPC sources verified in migrations: `supabase/migrations/20260318112259_7a111b45-4d4b-4ce9-ac6e-1409cf114ceb.sql`, `20260318122015_97ef1e8e-ab6a-4c62-bb5f-288d887849f1.sql`, `20260322_redact_preview_create_gated_full.sql`, `20260322_fix_get_analysis_full_session_binding.sql`, `20260420000000_add_analysis_id_to_analysis_rpcs.sql`, `20260428120000_restore_get_analysis_full_strict_scan_binding.sql`.
- Dev bypass: `supabase/functions/dev-report-unlock/index.ts` (used by `fetchFullViaDevBypass` in `src/services/reportService.ts`).

**Verified lead/tracking model:**
- Persistent `lead_id`: `src/lib/useLeadId.ts` (initialized in `src/main.tsx`).
- UTM capture: `src/lib/useUtmCapture.ts` (initialized in `src/main.tsx`).
- fb cookies: `src/lib/attribution/fbCookies.ts`.
- Canonical event constants/schemas/types: `src/lib/tracking/canonical/{constants.ts,schemas.ts,types.ts}`.
- Business event API: `src/lib/tracking/{events.ts,trackBusinessEvent.ts,canonicalEventId.ts,neutralEventModel.ts,index.ts}`.
- Server CAPI bridge: `supabase/functions/capi-event/index.ts` (logs into `capi_signal_logs`).
- Browser telemetry table: `event_logs` (RLS allows anon insert; no anon select).
- Server-only conversion ledger: `conversion_events` (anon denied insert+select).

**Verified contractor/partner model (schema + functions):**
- Tables (from supplied schema): `contractors`, `contractor_accounts`, `contractor_client_assignments`, `contractor_opportunities`, `contractor_opportunity_routes`, `contractor_outcomes`, `contractor_credits`, `contractor_credit_ledger`, `contractor_credit_purchases`, `contractor_invitations`, `contractor_unlocked_leads`, `contractor_followups`, `contractor_activity_log`, `contractor_leads`, `contractor_profiles`, `lead_assignments`, `billable_intros`, `lead_contact_release_events`, `lead_attribution_details`.
- Edge Functions: `dispatch-lead`, `unlock-lead`, `request-callback`, `contractor-actions`, `contractor-submit-outcome`, `contractor-booking-confirmed`, `contractor-mark-no-show`, `contractor-send-followups`, `contractor-performance-summary`, `send-contractor-handoff`, `list-contractor-opportunities`, `get-contractor-dossier`, `get-contractor-document-url`, `admin-route-lead`, `generate-contractor-brief`, `generate-negotiation-script`, `partner-update-disposition`, `request-partner-access`, `save-routing-preferences`, `accept-invite`, `dial-lead`, `import-facebook-lead-ad`, `voice-followup`, `dispatch-platform-events`, `process-webhook`, `admin-materialize-dispatch-outbox`, `admin-simulate-dispatch-attempt`, `admin-sync-revenue-signals`, `admin-contractor-performance`, `admin-client-platform-config`, `admin-data`, `update-homeowner-context`.
- Frontend surfaces: `src/pages/ContractorPortal.tsx`, `src/pages/Contractors.tsx`, `Contractors2.tsx`, `src/pages/contractors3/Contractors3.tsx`, plus admin pages `src/pages/AdminLeadInbox.tsx`, `AdminLeadReport.tsx`, `AdminLeadDossierPage.tsx`, `AdminLeadEvidence.tsx`, `AdminHealth.tsx`.

**Verified payment/auction/scheduling model:**
- Stripe checkout: `supabase/functions/create-checkout-session/index.ts`.
- Stripe webhook: `supabase/functions/stripe-webhook/index.ts`.
- Verified backing tables: `contractor_credit_purchases`, `contractor_credits`, `contractor_credit_ledger` — i.e. Stripe is wired for **contractor credit packs only**.
- Auction sessions, blind-bid storage, lockbox, scheduled-install-call: **NOT FOUND** in `supabase/functions/`, `supabase/migrations/`, or visible schema.

**What Copilot must obey:**
- Verify-to-Reveal via `get_analysis_full` (see Section 4).
- No frontend high-value pixels.
- No new fonts (existing `@fontsource/dm-sans|dm-mono|barlow-condensed` in `package.json` is a pre-existing PARTIAL violation of the "system font only" rule documented in `claude.md`/`AGENTS.md` — Copilot must not extend it).
- No direct frontend writes to protected tables (Section 3 / Section 4).
- No edits to protected files (Section 5).

---

## SECTION 2 — Exact Project File Map

Format: `path` — purpose — MAY IMPORT? — MUST NOT MODIFY?

### Routing / app shell
- `src/App.tsx` — route table, providers. **MAY IMPORT?** No. **MUST NOT MODIFY?** Yes (without explicit approval).
- `src/main.tsx` — bootstraps `getLeadId()` and `captureUtmFromUrl()` before render. MUST NOT MODIFY.
- `src/components/AppTrackingProvider.tsx` — global tracking provider mounted in `App.tsx`. MUST NOT MODIFY.
- `src/state/scanFunnel.tsx` — `ScanFunnelProvider`. MAY IMPORT (read). MUST NOT MODIFY.
- `src/store/useFunnelStore.ts` — funnel store. MAY IMPORT.

### Page routes (`src/pages/`)
- `Index.tsx`, `LandingPage.tsx`, `Estimate.tsx`, `Diagnosis.tsx`, `ReportClassic.tsx`, `DemoClassic.tsx`, `DevReportPreview.tsx`, `DevTesting.tsx`, `DevTesting2.tsx`, `Contractors.tsx`, `Contractors2.tsx`, `contractors3/Contractors3.tsx`, `ContractorPortal.tsx`, `ContractorOnboarding.tsx`, `AdminLogin.tsx`, `AdminForgotPassword.tsx`, `AdminResetPassword.tsx`, `AdminLeadInbox.tsx`, `AdminLeadReport.tsx`, `AdminLeadDossierPage.tsx`, `AdminLeadEvidence.tsx`, `AdminHealth.tsx`, `AcceptInvite.tsx`, `PartnerResetPassword.tsx`, `About.tsx`, `Contact.tsx`, `FAQ.tsx`, `Privacy.tsx`, `Terms.tsx`, `Disclaimer.tsx`, `HowWeBeatWindowQuotes.tsx`, `NotFound.tsx`. All MUST NOT MODIFY without approval.
- `src/routes/AdminRoutes.tsx`, `src/routes/PartnerRoutes.tsx`, `src/routes/adminDashboardTabs.ts`. MUST NOT MODIFY.

### Scanner / upload / report UI (`src/components/`)
- `UploadZone.tsx`, `uploadZone/*` (storage path tested), `TruthGateFlow.tsx`, `ScanTheatrics.tsx`, `InteractiveDemoScan.tsx`, `OrangeScanner.tsx`, `XRayScannerBackground.tsx` — scanner UI surface. MUST NOT MODIFY.
- `TruthReportClassic.tsx`, `TruthReportFindings/*`, `AnalysisPreview.tsx`, `GradeReveal.tsx`, `EvidenceLocker.tsx`, `EvidenceCarousel.tsx`, `EvidenceImage.tsx`, `EvidenceLightbox.tsx`, `CriticalFlagCard.tsx`, `NegotiationScript.tsx`, `LockedOverlay.tsx`, `MobileStickyUnlock.tsx`, `PreviewModeBadge.tsx`, `TopViolationSummaryStrip.tsx`, `RubricComparison.tsx` (referenced from prior phases). Treat as canonical report surface — MUST NOT MODIFY.
- `dev/scanner-lab/*` (Scanner Lab cockpit) — DEV cockpit; MUST NOT MODIFY.
- `dev/RubricComparison.tsx`, `dev/DevQuoteGenerator.tsx` (referenced in prior phases). MUST NOT MODIFY.
- `dev/DevPreviewPanel.tsx` at `src/dev/DevPreviewPanel.tsx`. MUST NOT MODIFY.
- shadcn primitives at `src/components/ui/*`. MAY IMPORT. MUST NOT MODIFY.

### Hooks (`src/hooks/`)
- `useAnalysisData.ts` — canonical preview+full+dev-bypass fetch. MAY IMPORT (read-only). **MUST NOT MODIFY**.
- `usePhonePipeline.ts` — canonical OTP pipeline. MAY IMPORT. **MUST NOT MODIFY**. Do not add modes.
- `useReportAccess.ts` — UX access-level helper (`preview` | `full`).
- `useScanPolling.ts` — polls `get_scan_status` RPC.
- `useCurrentUserRole.ts`, `usePartnerAuth.ts`, `usePhoneInput.ts`, `useHomepageVariant.ts`, `useRubricStats.ts`, `useTickerStats.ts`, `useWarmIntent.tsx`.

### Services (`src/services/`)
- `reportService.ts` — sole transport for `get_scan_status`, `get_analysis_preview`, `get_analysis_full`, `dev-report-unlock`. **MUST NOT MODIFY**.
- `phoneVerificationService.ts`, `sessionService.ts` — auth/session adjuncts. MUST NOT MODIFY.
- `contractorAccess.ts`, `contractorClientAssignments.ts`, `contractorLeadRelease.ts`, `contractorLeads.ts`, `contractorOutcomeIntegrity.ts`, `contractorOutcomeSubmission.ts`, `contractorPerformance.ts`, `dispatchAttempts.ts`, `dispatchGovernance.ts`, `dispatchHealth.ts`, `dispatchOutbox.ts`, `leadAssignments.ts`, `leadDelivery.ts`, `leadReleaseQueue.ts`, `routing.ts`, `revenueDispatchReadiness.ts`, `revenueSignalDryRunAudit.ts`, `revenueSignalIntegration.ts`, `signalDispatch.ts`, `clientPlatformConfigs.ts`, `adminDataService.ts` (verified via test sibling). All MUST NOT MODIFY.

### Tracking / attribution (`src/lib/`)
- `tracking/index.ts` re-exports `BUSINESS_EVENTS`, `trackBusinessEvent`, `generateEventId`.
- `tracking/events.ts`, `tracking/trackBusinessEvent.ts`, `tracking/canonicalEventId.ts`, `tracking/neutralEventModel.ts`, `tracking/canonical/{constants.ts,schemas.ts,types.ts}`.
- `attribution/fbCookies.ts`, `useLeadId.ts`, `useUtmCapture.ts`, `useClientSlug.ts`, `trackConversion.ts`, `trackEvent.ts`, `metaBrowserPixel.ts`, `privacy/identityHashing.ts`. **MUST NOT MODIFY** the canonical tracking primitives.
- `humanContext.ts`, `qualificationLogic.ts`, `qualifyHomepageLead.ts`, `reportDiagnosisHandoff.ts`, `routeIdGuards.ts`, `statusConstants.ts`, `supabaseAuthLink.ts`, `verifiedAccess.ts`, `deriveRevealPhase.ts`, `devSecret.ts`, `platformReadinessMatrix.ts`, `contractorOpportunitySignals.ts`, `contractors2/`. MAY IMPORT for utilities; do not modify without scope.

### Supabase / config
- `src/integrations/supabase/client.ts` — MAY IMPORT.
- `src/integrations/supabase/types.ts` — MAY IMPORT, **NEVER MODIFY** (regen-only).
- `tailwind.config.ts`, `components.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `.env.example`, `supabase/config.toml`. MUST NOT MODIFY.

### Edge Functions / migrations
- `supabase/functions/*/index.ts` — see Section 5.
- `supabase/migrations/*.sql` — 100+ files. MUST NOT MODIFY; MUST NOT add new migrations as part of Copilot import.

### Tests / scripts
- `src/test/*`, `src/hooks/*.test.ts`, `src/components/*.test.tsx`, `src/services/*.test.ts`, `src/pages/__tests__/*`, `tests/*.spec.ts`, `scripts/*`. MAY READ for context.

---

## SECTION 3 — Supabase Database Schema

Tables in this section are **verified** from the schema dump supplied in context. Tables referenced in repo code but not in the supplied schema dump are marked **UNCLEAR — NEEDS MANUAL REVIEW (verify in `src/integrations/supabase/types.ts`)**.

### Verified tables (columns/RLS posture from supplied dump)

#### `analyses`
- Columns include: `id uuid pk`, `scan_session_id uuid`, `preview_json jsonb`, `full_json jsonb`, `grade text`, `dollar_delta numeric`, `flags jsonb default '[]'`, `document_type text`, `rubric_version text`, `analysis_status text default 'pending'`, `client_slug text`, `proof_of_read jsonb`, `user_id uuid`, `confidence_score numeric`, `lead_id uuid`, `negotiation_script jsonb`, `contractor_brief_json jsonb`, plus timestamps.
- RLS: `analyses_select_internal` (`is_internal_operator()`), `analyses_service_role_all`. **No anon/authenticated insert/update/delete policies** — frontend must use RPCs.
- Holds protected report data (`full_json`, `flags`). Copilot **MUST NOT** write directly. Reads via `get_analysis_preview` / `get_analysis_full` only.

#### `event_logs`
- Columns: `id uuid pk`, `session_id text`, `lead_id uuid`, `user_id uuid`, `event_name text not null`, `flow_type text`, `created_at`, `route text`, `metadata jsonb default '{}'`.
- RLS: `anon_insert_event_logs` (insert true). No select for anon/authenticated.
- Safe for browser telemetry inserts only.

#### `conversion_events`
- Columns: `id bigint pk`, `event_name text`, `lead_id uuid`, `event_id text`, `fbc text`, `fbp text`, `user_data jsonb`, `sent_to_facebook bool`, timestamps.
- RLS: `deny_anon_insert_conversion_events` (insert false), `deny_anon_select_conversion_events` (select false). Service role only.
- Copilot must never read/write from frontend. Use Edge Function `capi-event`.

#### `capi_signal_logs`
- Columns: `id`, `event_name`, `payload jsonb`, `client_slug`, `status_code int`, `pixel_id`, `fired_at`, `response jsonb`.
- RLS: `capi_logs_select_internal` (internal operator), `capi_logs_service_role_all`.
- Read-only for internal operators. Frontend never writes.

#### `clients`
- Columns: `id`, `name`, `slug`, `is_active`, `created_at`.
- RLS: `clients_anon_select_active` (anon may select active rows), plus internal+service-role policies.
- Safe for landing-page client lookup by slug.

#### `client_configs`
- Columns include `client_id`, `meta_pixel_id`, `meta_dataset_id`, `google_ads_*`, `gtm_server_url`, `capi_token_secret_id`. Internal-operator only. **Never expose secrets.**

#### `client_platform_configs`
- Per-platform credential rows. Internal-operator only.

#### `contractors`
- Internal-operator only.

#### `contractor_accounts`
- Internal-operator + `contractor_accounts_select_own` for `auth_user_id = auth.uid()`.

#### `contractor_client_assignments`
- Internal-operator + `cca_contractor_select_own` (joined via `contractors.auth_user_id`).

#### `contractor_credit_ledger`, `contractor_credits`, `contractor_credit_purchases`
- Read-own (`auth.uid() = contractor_id`) selects, internal/service-role for writes.

#### `contractor_invitations`
- Internal-operator + service-role.

#### `contractor_followups`, `contractor_leads`, `contractor_activity_log`
- Service-role only.

#### `contractor_opportunities`, `contractor_opportunity_routes`, `contractor_outcomes`
- Internal-operator + service-role.

#### `contractor_profiles`
- `contractor_profiles_select_own` only.

#### `contractor_unlocked_leads`
- `contractor_unlocked_leads_select_own` only.

#### `lead_assignments`
- Internal-operator + service-role + `lead_assignments_select_own_contractor` (via `contractor_accounts.auth_user_id`).

#### `lead_attribution_details`
- Internal-operator select only. No frontend writes; populated by ingestion functions.

#### `lead_contact_release_events`
- Verified table; RLS detail truncated in supplied dump → **UNCLEAR — NEEDS MANUAL REVIEW** beyond existence.

#### `billable_intros`
- Internal-operator only.

#### `county_benchmarks`
- `county_benchmarks_select_public` (anon+authenticated). Safe for frontend reads.

#### `diagnosis_intakes`
- Internal-operator select + service-role for all. Frontend writes go through `submit-diagnosis-intake` Edge Function.

### Tables referenced by repo code but **not present in the supplied schema dump window** — UNCLEAR — NEEDS MANUAL REVIEW (verify in `src/integrations/supabase/types.ts`):

`leads`, `quote_files`, `scan_sessions`, `phone_verifications`, `profiles`, `homepage_leads`, rubric tables (`rubric_*`), dispatch tables (`dispatch_outbox`, `dispatch_attempts`, etc.), revenue-signal tables, `wm_event_log`, `wm_quote_facts`, `wm_quote_reviews`, `wm_pricing_index_snapshots`, `wm_platform_dispatch_log` (foundation in `docs/tracking/CANONICAL_EVENT_FOUNDATION.md`).

### Tables Copilot is likely to assume but that **NOT FOUND** in repo evidence:

`quote_analyses` (canonical is `analyses`), `auctions`, `bids`, `winning_bids`, `appointments`, `pre_quiz_responses`, `hesitation_audits`, `firing_pledges`, `scope_locks`, `lockbox_payments`, `scheduled_calls`.

---

## SECTION 4 — RLS and Security Model

### Verify-to-Reveal enforcement path (verified)
1. UI renders preview from `src/services/reportService.ts::fetchAnalysisPreview` → RPC `get_analysis_preview(p_scan_session_id)`.
2. OTP pipeline: `src/hooks/usePhonePipeline.ts` → `supabase/functions/send-otp/index.ts` → `supabase/functions/verify-otp/index.ts`.
3. Full reveal: `src/services/reportService.ts::fetchAnalysisFull` → RPC `get_analysis_full(p_scan_session_id, p_phone_e164)`.
4. RPC source / belt-and-suspenders verification (per `docs/db/DB_PREFLIGHT_STATUS.md` invariants and migration files): checks both `phone_verifications.status = 'verified'` and `leads.phone_verified = true`. On failure, returns sentinel grade `__UNAUTHORIZED__`, which the service layer converts to `{ ok: false, code: "unauthorized" }`.
5. Migrations defining/modifying these RPCs (verified via `rg`):
   - `supabase/migrations/20260318112259_7a111b45-4d4b-4ce9-ac6e-1409cf114ceb.sql`
   - `supabase/migrations/20260318122015_97ef1e8e-ab6a-4c62-bb5f-288d887849f1.sql`
   - `supabase/migrations/20260322_redact_preview_create_gated_full.sql`
   - `supabase/migrations/20260322_fix_get_analysis_full_session_binding.sql`
   - `supabase/migrations/20260420000000_add_analysis_id_to_analysis_rpcs.sql`
   - `supabase/migrations/20260428120000_restore_get_analysis_full_strict_scan_binding.sql`
6. Dev bypass: `supabase/functions/dev-report-unlock/index.ts` (used only via `fetchFullViaDevBypass`, gated by `DEV_BYPASS_SECRET`).

### Storage
- Bucket `quotes` referenced in storage migrations (`supabase/migrations/20260318033459_*.sql`, `20260317051701_*.sql`, `20260416154937_*.sql`, `20260421202348_*.sql`, `20260421214258_*.sql`). Treated as private; uploads brokered via `supabase/functions/start-upload-scan-session/index.ts`. Anon listing/reading must not be enabled (per project invariants in `claude.md`/`AGENTS.md`).
- Exact storage policy bodies → **UNCLEAR — NEEDS MANUAL REVIEW** (read the migration files above to confirm).

### CSS-blur reliance check
- Components `LockedOverlay.tsx`, `MobileStickyUnlock.tsx`, `PreviewModeBadge.tsx` exist as presentational locks. Verified via `src/services/reportService.ts` and `src/hooks/useAnalysisData.ts` that the **full payload is fetched only** through `fetchAnalysisFull` / `fetchFullViaDevBypass` — no preload-and-blur pattern observed in `reportService.ts`. Marked **COMPLIANT** for the verified read path.

### Anon/authenticated/service-role write rules
- See per-table notes in Section 3.
- General rule (verified across listed tables): all "protected" tables expose only `is_internal_operator()` SELECT + service-role ALL. Frontend writes to those tables must route through Edge Functions or RPCs.

---

## SECTION 5 — Edge Function Inventory

Verified deployable functions (by directory listing of `supabase/functions/`):

`accept-invite`, `admin-client-platform-config`, `admin-contractor-performance`, `admin-data`, `admin-materialize-dispatch-outbox`, `admin-route-lead`, `admin-simulate-dispatch-attempt`, `admin-sync-revenue-signals`, `calculate-estimate-metrics`, `capi-event`, `capture-truth-gate-lead`, `compare-quotes`, `contractor-actions`, `contractor-booking-confirmed`, `contractor-mark-no-show`, `contractor-performance-summary`, `contractor-send-followups`, `contractor-submit-outcome`, `create-checkout-session`, `dev-create-quote-scenario`, `dev-report-unlock`, `dial-lead`, `dispatch-lead`, `dispatch-platform-events`, `enrich-lead`, `generate-contractor-brief`, `generate-negotiation-script`, `get-contractor-document-url`, `get-contractor-dossier`, `import-facebook-lead-ad`, `lead-reactivation`, `list-contractor-opportunities`, `partner-update-disposition`, `persist-diagnosis-start`, `process-webhook`, `qualify-homepage-lead`, `refresh-benchmarks`, `request-callback`, `request-partner-access`, `save-routing-preferences`, `scan-quote`, `send-contractor-handoff`, `send-otp`, `send-report-email`, `start-upload-scan-session`, `stripe-webhook`, `submit-diagnosis-intake`, `unlock-lead`, `update-homeowner-context`, `verify-otp`, `voice-followup`. (`_shared` is support code, not deployable.)

### Critical / MUST NOT MODIFY
`send-otp`, `verify-otp`, `scan-quote`, `start-upload-scan-session`, `capi-event`, `dev-report-unlock`, `stripe-webhook`, `process-webhook`, `dispatch-lead`, `unlock-lead`, `dispatch-platform-events`.

### Names Copilot may assume but **NOT FOUND**
`lookup` (Twilio lookup is internal to `send-otp`), `save-lead`, `log-event`, `analyze-rubric`, `image-processing`, `lead-scoring`, `system-audit`, `submit-native-lead`, `generate-truth-report`, any auction/bid/lockbox/install-call function.

### Per-function detail
For each function above, exact request/response shapes, env vars, tables read/written, CORS, and rate limiting are **UNCLEAR — NEEDS MANUAL REVIEW** until the corresponding `index.ts` is read. Verified shapes for the report path:
- `dev-report-unlock` request: `{ scan_session_id: string, dev_secret: string }`; response includes `{ analysis_id, grade, flags, full_json, proof_of_read, preview_json, confidence_score, document_type, rubric_version }` (verified via `src/services/reportService.ts::fetchFullViaDevBypass`).

### `verify_jwt = false` functions
Per `docs/db/DB_PREFLIGHT_STATUS.md`: `send-otp`, `verify-otp`, `generate-contractor-brief`, `contractor-actions`, `voice-followup`, `admin-data`, `dial-lead`, `send-contractor-handoff`, `dispatch-platform-events`. Reconfirm in `supabase/config.toml` before assuming.

---

## SECTION 6 — Frontend Data Flow

```text
Visitor → "/" (src/pages/Index.tsx)
  → TruthGateFlow (src/components/TruthGateFlow.tsx)
        → Edge: capture-truth-gate-lead → leads (UNCLEAR row shape — see types.ts)
  → UploadZone (src/components/UploadZone.tsx)
        → Edge: start-upload-scan-session
              ↳ writes to private storage bucket `quotes`
              ↳ creates/updates quote_files + scan_sessions (UNCLEAR exact columns — see types.ts)
  → Edge: scan-quote (deterministic scoring lives here)
        → upserts analyses (preview_json, full_json, flags, grade, ...)
  → Polling: src/hooks/useScanPolling.ts → RPC get_scan_status
  → Preview: RPC get_analysis_preview → AnalysisPreview / TruthReportClassic (preview mode)
  → OTP: src/hooks/usePhonePipeline.ts
        → Edge: send-otp (Twilio Verify)
        → Edge: verify-otp → flips phone_verifications + leads.phone_verified
  → Full reveal: RPC get_analysis_full(p_scan_session_id, p_phone_e164)
        ↳ returns __UNAUTHORIZED__ unless verified
  → Route /report/classic/:sessionId → src/pages/ReportClassic.tsx → TruthReportClassic
  → Downstream:
        Edge: send-contractor-handoff | request-callback | dispatch-lead | unlock-lead
  → Tracking:
        src/lib/tracking/trackBusinessEvent → window.dataLayer (telemetry)
        Edge: capi-event → conversion_events / capi_signal_logs (server CAPI)
```

---

## SECTION 7 — Current State Management

| Hook / Provider | Path | Purpose | MAY IMPORT | MUST NOT MODIFY |
|---|---|---|---|---|
| `useAnalysisData` | `src/hooks/useAnalysisData.ts` | Canonical preview + full + dev-bypass orchestration | yes | yes |
| `usePhonePipeline` | `src/hooks/usePhonePipeline.ts` | OTP pipeline (`validate_only`, `validate_and_send_otp`) | yes | yes |
| `useReportAccess` | `src/hooks/useReportAccess.ts` | UX access level only | yes | no (low risk) |
| `useScanPolling` | `src/hooks/useScanPolling.ts` | Polls `get_scan_status` | yes | yes |
| `useCurrentUserRole` | `src/hooks/useCurrentUserRole.ts` | Role lookup | yes | yes |
| `usePartnerAuth` | `src/hooks/usePartnerAuth.ts` | Partner auth | yes | yes |
| `usePhoneInput` | `src/hooks/usePhoneInput.ts` | Phone input UX | yes | no |
| `useHomepageVariant` | `src/hooks/useHomepageVariant.ts` | A/B variant | yes | yes |
| `useRubricStats` | `src/hooks/useRubricStats.ts` | Rubric stats RPC | yes | yes |
| `useTickerStats` | `src/hooks/useTickerStats.ts` | Public ticker | yes | yes |
| `useWarmIntent` | `src/hooks/useWarmIntent.tsx` | Intent capture | yes | yes |
| `ScanFunnelProvider` | `src/state/scanFunnel.tsx` | Funnel state | yes | yes |
| `useFunnelStore` | `src/store/useFunnelStore.ts` | Funnel store | yes | yes |
| `getLeadId` | `src/lib/useLeadId.ts` | Persistent lead id | yes | yes |
| `captureUtmFromUrl` | `src/lib/useUtmCapture.ts` | UTM capture | yes | yes |
| `useClientSlug` | `src/lib/useClientSlug.ts` | Slug fallback | yes | yes |
| `trackBusinessEvent` | `src/lib/tracking/trackBusinessEvent.ts` | Canonical event emit | yes | yes |

`PostScanReportSwitcher` — **NOT FOUND**. Any Copilot reference must be replaced with the canonical preview→full reveal flow above.

---

## SECTION 8 — UI Components and Design System

- **shadcn/ui:** primitives at `src/components/ui/*` (configured by `components.json`). MAY IMPORT.
- **Tailwind:** `tailwind.config.ts` + tokens via `src/index.css`. Use semantic tokens only — do not write raw color classes (`text-white`, `bg-black`).
- **Icons:** `lucide-react@0.462`.
- **Toasts:** dual stack — `@/components/ui/toaster` (radix) and `@/components/ui/sonner`. Both mounted in `src/App.tsx`. Either is acceptable; prefer the existing pattern of the surrounding component.
- **Animation:** `framer-motion@12`. Do not introduce alternatives.
- **Fonts:** `package.json` ships `@fontsource/dm-sans`, `@fontsource/dm-mono`, `@fontsource/barlow-condensed`. This is a **PARTIAL violation** of the "system font only" rule documented in `claude.md`/`AGENTS.md` — Copilot must NOT add new fonts and should rely on existing tokens.
- **Recommended Copilot folders (do not create now):** `src/components/copilot/`, `src/components/copilot/truth-report/`, `src/components/copilot/auction/`, `src/hooks/copilot/`, `src/lib/copilot/`.

---

## SECTION 9 — Routes and Mounting Points

Verified from `src/App.tsx`:

| Path | Component | File | Auth | Public | Copilot mount |
|---|---|---|---|---|---|
| `/` | `Index` | `src/pages/Index.tsx` | none | yes | NO |
| `/lp/:slug` | `LandingPage` | `src/pages/LandingPage.tsx` | none | yes | NO without approval |
| `/estimate` | `Estimate` | `src/pages/Estimate.tsx` | none | yes | NO |
| `/diagnosis` | `Diagnosis` | `src/pages/Diagnosis.tsx` | none | yes | NO |
| `/report/classic/:sessionId` | `ReportClassic` | `src/pages/ReportClassic.tsx` | preview public; full requires verified phone | yes | NO |
| `/report/:sessionId` | `ReportRedirect` | inline | — | yes | NO |
| `/admin/*` | `AdminRoutes` | `src/routes/AdminRoutes.tsx` | admin | gated | NO |
| `/partner/*` | `PartnerRoutes` | `src/routes/PartnerRoutes.tsx` | partner | gated | NO |
| `/demo-classic`, `/dev/report-preview`, `/devtesting` | DEV-only | `src/pages/DemoClassic.tsx`, `DevReportPreview.tsx`, `DevTesting.tsx` | DEV | DEV | OK as references |
| `/contractors`, `/contractors2`, `/contractors3` | Contractor pages | as listed | none | yes | NO |
| `/about`, `/contact`, `/faq`, `/privacy`, `/terms`, `/disclaimer`, `/how-we-beat-window-quotes` | under `PublicLayout` | `src/components/PublicLayout.tsx` | none | yes | NO |

**Recommended (not yet created)** Copilot test mounts (DEV-only, gated by `import.meta.env.DEV`): `/dev/copilot-landing`, `/dev/copilot-truth-report`, `/dev/copilot-auction`. Any actual `Routes` change requires explicit approval.

---

## SECTION 10 — Attribution and Tracking Contract

### Verified primitives
- Persistent `lead_id`: `src/lib/useLeadId.ts` (initialized in `src/main.tsx`).
- UTM: `src/lib/useUtmCapture.ts` (initialized in `src/main.tsx`).
- fb cookies: `src/lib/attribution/fbCookies.ts`.
- `client_slug` fallback: `src/lib/useClientSlug.ts`.
- Canonical event names enum (verified): `src/lib/tracking/canonical/constants.ts::WM_EVENT_NAMES` =
  `virtual_page_view`, `scan_initiated`, `quote_uploaded`, `teaser_viewed`, `otp_started`, `otp_sent`, `phone_verified`, `report_revealed`, `contractor_match_requested`, `appointment_booked`, `sold`, `lead_identified`, `lead_qualified`, `quote_upload_completed`, `quote_validation_passed`, `sale_confirmed`.
- Canonical anomaly/dispatch/platform/identity enums also in `constants.ts`. Schemas in `src/lib/tracking/canonical/schemas.ts`. Types in `src/lib/tracking/canonical/types.ts`. Mirror of these in `supabase/functions/_shared/tracking/canonical/` (constants and types verified).
- `event_id`: `src/lib/tracking/canonicalEventId.ts` (deterministic, generate once and reuse).
- Browser dataLayer is referenced only inside tracking utilities (verified by `rg "fbq|gtag|dataLayer" src` returning only utility files plus `index.html`). No vendor `fbq()`, `gtag()`, or `ttq()` calls inside `src/components/` or `src/pages/`. Compliant with project rules.

### Server-side surfaces
- `supabase/functions/capi-event/index.ts` — Meta CAPI bridge.
- `event_logs` table (anon insert) — operational telemetry.
- `conversion_events` (server-only) — paid-media truth.
- `capi_signal_logs` (internal-operator read) — outbound dispatch log.

### Recommended Copilot event map

For each Copilot artifact event, prefer reusing a `WM_EVENT_NAMES` value. Anything not in the enum is **EXTENSION REQUIRED — DO NOT EMIT** until added to the canonical enum + Zod schemas + DB enum (see `docs/tracking/CANONICAL_EVENT_FOUNDATION.md`).

Landing page:
- `landing view` → `virtual_page_view` (browser dataLayer + `event_logs`).
- `quote upload click` → EXTENSION REQUIRED (not in enum).
- `want quote click` → EXTENSION REQUIRED.
- `file selected` → EXTENSION REQUIRED.
- `file uploaded` → `quote_upload_completed` (server-side too).
- `OTP requested` → `otp_started` (browser+server).
- `OTP verified` → `phone_verified` (server-required).
- `scan started` → `scan_initiated` (browser+server).
- `scan completed` → EXTENSION REQUIRED (closest: `quote_validation_passed`).
- `extraction confirmed` → EXTENSION REQUIRED.
- `lead submitted` → `lead_identified`.
- `no-quote lead submitted` → `lead_identified` with `metadata.flow="no_quote"`.

Truth report / auction:
- `prequiz submitted`, `report preview viewed` (use `teaser_viewed`), `report unlocked` (use `report_revealed`), `truth report viewed` (use `report_revealed` with metadata), `real price clicked`, `hesitation selected`, `hesitation submitted`, `firing pledge clicked`, `scope edited`, `scope locked`, `auction started`, `auction status viewed`, `lockbox viewed`, `payment started`, `payment succeeded`, `winning bid revealed`, `bid accepted`, `scheduled call confirmed` → all **EXTENSION REQUIRED** except `teaser_viewed` and `report_revealed`. Do not emit non-canonical events.

For each event, payload must include: `eventId`, `eventName`, `eventTimestamp`, `payload.identity` (with `leadId`), `payload.journey` (with `route`, `flow`), and any quote/analytics/optimization/source blocks per `wmCanonicalEventPayloadSchema` in `src/lib/tracking/canonical/schemas.ts`.

---

## SECTION 11 — Copilot Import Rules

1. Every new file/component/hook/util **must** be prefixed `Copilot` / `copilot`.
2. Never overwrite an existing file.
3. Never modify: `useAnalysisData`, `usePhonePipeline`, `useReportAccess`, `useScanPolling`, `reportService`, `phoneVerificationService`, `sessionService`, any canonical tracking primitive, `src/integrations/supabase/types.ts`, any Edge Function, any migration, any RLS, any route in `src/App.tsx`, `src/main.tsx`, `AppTrackingProvider`, `ScanFunnelProvider`.
4. All backend interaction goes through the adapter layer in Section 12.
5. Use existing Supabase client import: `@/integrations/supabase/client`.
6. Use existing UI primitives in `src/components/ui/*`.
7. No raw card collection in UI. No fake OTP. No fake report authorization.
8. No frontend-only "unlocked" booleans / no localStorage unlock flags / no URL-param unlock.
9. No new fonts (`@fontsource/*` is already a pre-existing partial violation; do not extend).
10. No external scripts/CDNs, no jQuery, no inline `<script>` dependencies.
11. No frontend high-value pixels (`fbq`, `gtag`, `ttq`, vendor SDKs).
12. No direct frontend writes to: `analyses`, `phone_verifications`, `lead_assignments`, any `contractor_*`, `conversion_events`, `client_configs`, `client_platform_configs`, `billable_intros`, `lead_attribution_details`, `capi_signal_logs`, `wm_*`.
13. No route changes without explicit approval.

---

## SECTION 12 — Required Adapter Layer

Each adapter lives at `src/lib/copilot/<name>.ts`. Each returns a typed result `{ ok: true, data } | { ok: false, code: "not_configured" | "rpc_error" | "network" | "unauthorized" | "validation", message?: string }`. All use `import { supabase } from "@/integrations/supabase/client"`.

### Landing-page adapters
| Adapter | Backend | Notes |
|---|---|---|
| `copilotCreateOrUpdateLead` | Edge `capture-truth-gate-lead` (or `qualify-homepage-lead`) | Request shape verified UNCLEAR — read function source before wiring |
| `copilotUploadQuoteFile` | Edge `start-upload-scan-session` | Goes to private bucket `quotes` |
| `copilotCreateScanSession` | Implicit inside `start-upload-scan-session` | Do not insert into `scan_sessions` directly |
| `copilotRequestOtp` | Edge `send-otp` | Prefer wrapping `usePhonePipeline` |
| `copilotVerifyOtp` | Edge `verify-otp` | Same |
| `copilotRunQuoteScan` | Edge `scan-quote` | Triggered automatically by upload flow today; verify before re-invoking |
| `copilotSaveTruthCorrections` | NOT FOUND | Return `not_configured` |
| `copilotSubmitNoQuoteLead` | Edge `qualify-homepage-lead` (closest existing) | Verify request shape before use |
| `copilotTrackEvent` | `trackBusinessEvent` + `event_logs` insert; high-value via Edge `capi-event` | Use canonical event names only |

### Truth-report / auction adapters
| Adapter | Backend | Notes |
|---|---|---|
| `copilotFetchReportPreview` | RPC `get_analysis_preview` | Wrap `src/services/reportService.ts::fetchAnalysisPreview` |
| `copilotFetchFullReport` | RPC `get_analysis_full(p_scan_session_id, p_phone_e164)` | Wrap `fetchAnalysisFull`; respect `__UNAUTHORIZED__` |
| `copilotSavePreQuiz` | NOT FOUND | `not_configured` |
| `copilotSaveHesitationAudit` | NOT FOUND | `not_configured` |
| `copilotSaveFiringPledge` | NOT FOUND | `not_configured` |
| `copilotSaveScopeCorrections` | NOT FOUND | `not_configured` |
| `copilotLockAuctionScope` | NOT FOUND | `not_configured` |
| `copilotStartBlindAuction` | NOT FOUND | `not_configured` |
| `copilotGetAuctionStatus` | NOT FOUND | `not_configured` |
| `copilotCreateBidUnlockCheckoutSession` | Edge `create-checkout-session` exists for credit packs only | PARTIAL — `not_configured` until product wired |
| `copilotConfirmBidUnlockPayment` | Edge `stripe-webhook` is server-side | Frontend confirm → `not_configured` |
| `copilotGetWinningBid` | NOT FOUND | `not_configured` |
| `copilotAcceptWinningBid` | NOT FOUND | `not_configured` |
| `copilotScheduleInstallCall` | NOT FOUND (only contractor-side `contractor-booking-confirmed`) | `not_configured` |

---

## SECTION 13 — Missing Backend Capabilities

| Capability | Status | Evidence |
|---|---|---|
| Auction sessions | MISSING | No table or function found |
| Contractor bids storage | MISSING | No table or function found |
| Winning-bid storage | MISSING | No table or function found |
| Stripe `$1` hold / bid-unlock checkout | PARTIAL | `create-checkout-session` exists for `contractor_credit_purchases` only |
| Payment verification webhook | EXISTS for credits | `supabase/functions/stripe-webhook/index.ts` |
| Scheduled install call | MISSING | No table/function for homeowner-side scheduling |
| Contractor brief routing | EXISTS | `generate-contractor-brief`, `send-contractor-handoff`, `dispatch-lead` |
| Report preview RPC | EXISTS | `get_analysis_preview` |
| Full report authorization RPC | EXISTS | `get_analysis_full` (see Section 4 migrations) |
| Partner/contractor notification | EXISTS | `contractor-send-followups`, `dial-lead`, `voice-followup` |
| Contractor dashboard display | PARTIAL | `src/pages/ContractorPortal.tsx` |
| Expiration timer persistence (auction) | MISSING | n/a |
| Pre-quiz / hesitation / firing pledge / scope-lock storage | MISSING | n/a |
| Canonical event ledger (`wm_event_log`) | EXISTS at schema level | `docs/tracking/CANONICAL_EVENT_FOUNDATION.md` (verify in `types.ts`) |

---

## SECTION 14 — Safe Integration Plan

**Phase 1 — Isolated import.** Files: only `src/components/copilot/**`, `src/lib/copilot/**`, `src/hooks/copilot/**`. Risk: low. QA: typecheck, build, no behavior change. Rollback: delete folders.

**Phase 2 — Adapter wiring.** Files: `src/lib/copilot/*` only. Risk: medium. QA: stub adapters return `not_configured`; live adapters tested with real `scan_session_id`. Rollback: revert adapter file.

**Phase 3 — DEV mount.** Files: tiny diff to `src/App.tsx` adding DEV-only routes (requires explicit approval; not part of this manifest). Risk: low (DEV-gated). QA: route only renders under `import.meta.env.DEV`. Rollback: revert route diff.

**Phase 4 — Preview/full validation.** No code changes. QA: confirm `__UNAUTHORIZED__` path triggers when phone unverified; confirm full reveal renders post-OTP. Rollback: n/a.

**Phase 5 — Auction/payment backend.** Out of current sprint. Requires schema review, new migrations, new Edge Functions, new RLS — NOT to be initiated by Copilot autonomously.

**Phase 6 — Demo→production swap.** Replace any demo data inside Copilot components with adapter results. Risk: medium. QA: regression on `/report/classic/:sessionId`. Rollback: re-enable demo data.

---

## SECTION 15 — Exact Import Paths for Copilot

```ts
// Supabase
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// shadcn primitives (MUST NOT MODIFY source files)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Toasts (either is OK; do not introduce a new toast lib)
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";

// Utilities
import { cn } from "@/lib/utils";

// Routing
import { Link, useNavigate, useParams, Navigate } from "react-router-dom";

// Tracking & identity (READ-ONLY; do not modify)
import { trackBusinessEvent, BUSINESS_EVENTS, generateEventId } from "@/lib/tracking";
import { getLeadId } from "@/lib/useLeadId";
import { captureUtmFromUrl } from "@/lib/useUtmCapture";

// Hooks (READ-ONLY)
import { usePhonePipeline } from "@/hooks/usePhonePipeline";
import { useAnalysisData } from "@/hooks/useAnalysisData";
import { useReportAccess } from "@/hooks/useReportAccess";
```

If something is not listed above, write **NO SAFE IMPORT FOUND — CREATE COPILOT-ISOLATED VERSION** in the Copilot file. In particular, no safe imports exist for: `useClientSlug` value (path `@/lib/useClientSlug` is verified but UNCLEAR API surface), auction state hooks, scope-lock state, payment confirm helpers — create Copilot-isolated versions for these.

---

## SECTION 16 — Conflict / Collision Report

| Conflict | Project evidence | Likely Copilot assumption | Resolution |
|---|---|---|---|
| Component names | `TruthReportClassic.tsx`, `TruthGateFlow.tsx`, `UploadZone.tsx`, `LockedOverlay.tsx`, `MobileStickyUnlock.tsx`, `GradeReveal.tsx`, `EvidenceLocker.tsx`, `AnalysisPreview.tsx`, `NegotiationScript.tsx` | Same names | Prefix with `Copilot*` |
| Hook names | `useAnalysisData`, `usePhonePipeline`, `useReportAccess`, `useScanPolling` | Same names | Prefix with `useCopilot*` |
| Route collisions | `/`, `/report/classic/:sessionId`, `/admin/*`, `/partner/*` | Same paths | Use DEV-only `/dev/copilot-*` |
| Table-name mismatches | Canonical: `analyses`. Copilot may assume `quote_analyses`, `bids`, `auctions`, `appointments`, `pre_quiz_responses`, `hesitation_audits`, `firing_pledges` | NOT FOUND in repo | Use adapter layer; `not_configured` returns |
| Edge Function names | NOT FOUND: `lookup`, `save-lead`, `log-event`, `analyze-rubric`, `image-processing`, `lead-scoring`, `system-audit`, `submit-native-lead`, `generate-truth-report` | Copilot may call them | Map to existing functions per Section 12 |
| Tracking | Canonical primitives in `src/lib/tracking/*` | Copilot may build its own | Always use `trackBusinessEvent` |
| OTP | `usePhonePipeline` + `send-otp`/`verify-otp` | Copilot may invent OTP | Forbidden — wrap existing |
| Report fetch | `get_analysis_full(p_scan_session_id, p_phone_e164)` | Copilot may fetch directly | Forbidden — go via `useAnalysisData` |
| CSS globals | `src/index.css` defines tokens | Copilot may add raw color classes | Use semantic tokens only |

---

## SECTION 17 — COPILOT IMPLEMENTATION DIRECTIVE

**Source-of-truth names**
- Tables: `analyses`, `event_logs`, `conversion_events`, `capi_signal_logs`, `clients`, `client_configs`, `client_platform_configs`, `county_benchmarks`, `diagnosis_intakes`, `lead_attribution_details`, `lead_contact_release_events`, `billable_intros`, `lead_assignments`, contractor family. Other tables (`leads`, `quote_files`, `scan_sessions`, `phone_verifications`, `profiles`, `homepage_leads`, `wm_*`, dispatch family, rubric family) — verify in `src/integrations/supabase/types.ts` before use.
- RPCs: `get_scan_status`, `get_analysis_preview(p_scan_session_id)`, `get_analysis_full(p_scan_session_id, p_phone_e164)`.
- Edge Functions: see Section 5. Critical, do-not-modify list applies.
- Hooks: `useAnalysisData`, `usePhonePipeline`, `useReportAccess`, `useScanPolling`.

**May create**
- Files only under `src/components/copilot/**`, `src/lib/copilot/**`, `src/hooks/copilot/**`, all prefixed `Copilot` / `copilot`.

**Imports**
- Use exactly the import paths listed in Section 15. Anything else: create a Copilot-isolated version.

**Backend calls**
- Use the adapters in Section 12 only. Never bypass `get_analysis_full`. Never call `supabase.from('analyses').insert/update/delete` from the frontend.

**Missing backend (auction / payment / scheduling / pre-quiz / hesitation / firing pledge / scope lock)**
- Wrap in `not_configured` returns. Do not invent SQL, migrations, or Edge Functions.

**Naming**
- Every new file/component/hook/util/export must be prefixed `Copilot` / `copilot` to avoid collisions documented in Section 16.

**Verify-to-Reveal**
- Never preload full payload behind blur. Never set local "unlocked" flags. Never store unlock tokens in localStorage. Always rely on the RPC sentinel `__UNAUTHORIZED__`.

**Payment / security**
- No card collection in UI. No client-side Stripe key handling beyond redirecting to Stripe Checkout via the existing `create-checkout-session` Edge Function (and only for products that already exist).

**Routing**
- Mount only behind DEV-only test routes after explicit approval; do not edit `src/App.tsx` autonomously.

**Tracking**
- Use canonical event names from `WM_EVENT_NAMES`. Anything else is EXTENSION REQUIRED — do not emit until added to `src/lib/tracking/canonical/constants.ts`, Zod schemas, and corresponding DB enum.

---

### Verification footnote

Items asserted as fact in this manifest are backed by one or more of:
- direct file-system listing of `supabase/functions/`, `supabase/migrations/`, `src/`, `src/hooks/`, `src/lib/`, `src/components/`,
- direct read of `src/App.tsx`, `src/main.tsx`, `src/services/reportService.ts`, `src/integrations/supabase/client.ts`, `src/lib/tracking/canonical/{constants.ts,schemas.ts,types.ts}`, `src/lib/tracking/index.ts`, `src/hooks/useReportAccess.ts`, `package.json`,
- the supplied live Supabase schema dump (RLS + columns) for the tables enumerated in Section 3,
- `docs/db/DB_PREFLIGHT_STATUS.md` and `docs/tracking/CANONICAL_EVENT_FOUNDATION.md` for invariants/foundation tables.

Anything else is explicitly marked **UNCLEAR — NEEDS MANUAL REVIEW** or **NOT FOUND** as appropriate.
