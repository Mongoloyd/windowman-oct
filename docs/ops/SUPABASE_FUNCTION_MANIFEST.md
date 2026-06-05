# Supabase Edge Function Manifest — WindowMan.PRO

**Generated:** 2026-05-26  
**Source of truth inputs:** `supabase/functions/**/index.ts`, `supabase/config.toml`, `src/`, `.env.example`  
**Scope:** Inventory and auth/deploy drift visibility only — no runtime mutations.

---

## 1. Executive Summary

WindowMan ships **52 Edge Functions** under `supabase/functions/` (excluding `_shared/` helpers). Every deployed function has a matching `[functions.<name>]` block in `supabase/config.toml`, and **all 52 are configured with `verify_jwt = false`**.

That means the Supabase API gateway does **not** enforce JWT validation at the edge. Security relies entirely on **in-function auth** (adminAuth, contractor JWT checks, phone-verification RPC gates, cron/webhook secrets, or dev bypass flags). Any caller holding the public anon/publishable key can reach every function URL; only handler logic restricts abuse.

**Project targeting (documented, not live-verified here):**

| Ref | Role | Evidence |
|-----|------|----------|
| `wkrcyxcnzhwjtdpmfpaf` | Legacy Lovable/main production | Historical production project; do not target from `forensic_report_v2` without explicit approval |
| `zgsofkgddpcntdvpckdq` | Forensic V2 target | Active V2 Supabase project for staging now and future Netlify production promotion |

**Per-function deploy parity across projects:** Reconciled **2026-05-26** via `supabase functions list` (see [§ Live Deployment Matrix](#live-deployment-matrix)). Staging (`zgsofkgddpcntdvpckdq`): **32/52** local functions live + **1 ghost**. Production (`wkrcyxcnzhwjtdpmfpaf`): **52/52** local functions live. Structural parity between staging and production is **not** good — staging lacks 20 repo functions.

**Canonical funnel functions (Verify-to-Reveal):** `start-upload-scan-session` → `scan-quote` → `report-access` (preview/full) → `send-otp` / `verify-otp` → full reveal. OTP must remain server-side; preview must never expose `full_json`.

**Last smoke test dates:** UNKNOWN for all functions unless noted. Repo contains `supabase/functions/capi-event/smoke_test.ts` and Deno unit tests for `_shared/adminAuth`, `contractor-actions`, and `voice-followup` — test *existence* ≠ last production smoke.

---

## 2. Function Inventory Table

Legend — **Auth model:** `app-logic` (handler validation, no gateway JWT); `adminAuth` (`_shared/adminAuth.ts` JWT + `user_roles` or `x-dev-secret`); `JWT+role` (Bearer JWT + role/account lookup in handler); `phone-RPC` (`get_analysis_full` phone gate); `secret-header`; `webhook signature`; `dev-secret`; `none` (intentionally open / stateless).

| Function | Category | `verify_jwt` | Auth model | Service role | Frontend callers (`src/`) |
|----------|----------|--------------|------------|--------------|---------------------------|
| `accept-invite` | contractor | false | JWT+role | yes | `AcceptInvite.tsx` |
| `admin-client-platform-config` | admin | false | adminAuth | yes | `clientPlatformConfigs.ts` |
| `admin-contractor-performance` | admin | false | JWT+role | yes | `contractorPerformance.ts` |
| `admin-data` | admin | false | adminAuth | yes | `adminDataService.ts`, `dispatchHealth.ts`; indirect: `VoiceFollowupsPanel.tsx`, `RoutingDesk.tsx`, `LeadDossierSheet.tsx` |
| `admin-materialize-dispatch-outbox` | admin | false | adminAuth | yes | `dispatchOutbox.ts` |
| `admin-route-lead` | admin | false | adminAuth | via RPC | `leadAssignments.ts` |
| `admin-simulate-dispatch-attempt` | admin | false | adminAuth | yes | `dispatchAttempts.ts` |
| `admin-sync-revenue-signals` | admin | false | adminAuth | via RPC | `revenueSignalDryRunAudit.ts`, `revenueSignalIntegration.ts` |
| `calculate-estimate-metrics` | internal | false | none | no | none (logic inlined via `_shared/metrics.ts` in `scan-quote`) |
| `capi-event` | internal | false | service-role or x-capi-dispatch-secret | yes | none (browser/anon blocked at handler) |
| `capture-truth-gate-lead` | homeowner public | false | app-logic | yes | `TruthGateFlow.tsx` |
| `compare-quotes` | homeowner public | false | phone-RPC | yes | `PostScanReportSwitcher.tsx` |
| `contractor-actions` | admin | false | adminAuth | yes | none (no current `src/` invoke; docs reference only) |
| `contractor-booking-confirmed` | cron | false | secret-header | yes | none |
| `contractor-mark-no-show` | cron | false | secret-header | yes | none |
| `contractor-performance-summary` | contractor | false | JWT+role | yes | `contractorPerformance.ts` |
| `contractor-send-followups` | cron | false | secret-header | yes | none |
| `contractor-submit-outcome` | contractor | false | JWT+role | yes | `contractorOutcomeSubmission.ts` |
| `create-checkout-session` | contractor | false | JWT+role | yes | `CreditPurchaseStore.tsx`, `PartnerLayout.tsx` |
| `dev-create-quote-scenario` | dev | false | dev-secret | yes | `DevQuoteGenerator.tsx` |
| `dev-report-unlock` | dev | false | dev-secret | yes | `reportService.ts` → `useAnalysisData` |
| `dial-lead` | admin | false | adminAuth | yes | `adminDataService.ts` |
| `dispatch-lead` | internal | false | secret-header | yes | none (pg_net / cron / manual) |
| `dispatch-platform-events` | cron | false | secret-header | yes | none |
| `enrich-lead` | internal | false | app-logic | yes | `TruthGateFlow.tsx` (async) |
| `generate-contractor-brief` | homeowner public | false | phone-RPC | yes | `ReportClassic.tsx` |
| `generate-negotiation-script` | homeowner public | false | phone-RPC | yes | none |
| `get-contractor-document-url` | contractor | false | JWT+role | yes | `PartnerDossier.tsx` |
| `get-contractor-dossier` | contractor | false | JWT+role | yes | `PartnerDossier.tsx` |
| `import-facebook-lead-ad` | webhook | false | secret-header | yes | none |
| `lead-reactivation` | cron | false | secret-header | yes | none |
| `list-contractor-opportunities` | contractor | false | JWT+role | yes | `ContractorOpportunitiesPage.tsx` |
| `partner-update-disposition` | contractor | false | JWT+role | yes | `PartnerActionCenter.tsx` |
| `persist-diagnosis-start` | homeowner public | false | app-logic | yes | `PostScanReportSwitcher.tsx` |
| `process-webhook` | cron | false | secret-header | yes | none |
| `qualify-homepage-lead` | homeowner public | false | app-logic | yes | `qualifyHomepageLead.ts` |
| `refresh-benchmarks` | cron | false | secret-header | yes | none |
| `report-access` | homeowner public | false | app-logic / phone-RPC | yes | `reportService.ts`, `labLiveReportAccess.ts` (DevReportPreview) |
| `request-callback` | homeowner public | false | app-logic | yes | `Estimate.tsx`, `PostScanReportSwitcher.tsx`, `ReportClassic.tsx` |
| `request-partner-access` | contractor | false | app-logic | yes | `ContractorLogin.tsx` |
| `save-routing-preferences` | contractor | false | JWT+role | yes | `ContractorOnboarding.tsx` |
| `scan-quote` | homeowner public | false | app-logic (+ optional dev-secret) | yes | `UploadZone.tsx`; `admin-data` (re-scan action) |
| `send-contractor-handoff` | admin | false | adminAuth | yes | `adminDataService.ts` |
| `send-otp` | homeowner public | false | app-logic | yes | `phoneVerificationService.ts` → `usePhonePipeline` |
| `send-report-email` | homeowner public | false | app-logic | yes | `PostScanReportSwitcher.tsx` |
| `start-upload-scan-session` | homeowner public | false | app-logic | yes | `UploadZone.tsx` |
| `stripe-webhook` | webhook | false | webhook signature | yes | none |
| `submit-diagnosis-intake` | homeowner public | false | app-logic | yes | `useDiagnosticIntake.ts` |
| `unlock-lead` | contractor | false | JWT+role | yes | `PartnerDossier.tsx` |
| `update-homeowner-context` | homeowner public | false | app-logic | yes | `PropertyAndConsentStep.tsx` |
| `verify-otp` | homeowner public | false | app-logic | yes | `phoneVerificationService.ts` → `usePhonePipeline` |
| `voice-followup` | admin | false | adminAuth | yes | none direct; via `admin-data` action `trigger_voice_followup` |

**Config reconciliation:** 52 function directories with `index.ts` ↔ 52 `[functions.*]` entries in `config.toml`. No orphan config entries. No function folders missing config.

**Deployment projects column:** See [§ Live Deployment Matrix](#live-deployment-matrix) (audited 2026-05-26).

**Last smoke test:** UNKNOWN (all), except note `capi-event/smoke_test.ts` exists for manual Deno smoke.

---

## Live Deployment Matrix

**Audit date:** 2026-05-26  
**Collection commands (read-only):**

```powershell
supabase functions list --project-ref zgsofkgddpcntdvpckdq
supabase functions list --project-ref wkrcyxcnzhwjtdpmfpaf
```

**CLI fields captured:** `STATUS`, `VERSION`, `UPDATED_AT (UTC)`. All live rows reported `ACTIVE`. No inactive functions observed.

| Function | Local Folder | Config Entry | Staging Status | Staging Version | Staging Updated/Deployed At | Production Status | Production Version | Production Updated/Deployed At | Parity Verdict | Notes |
|----------|--------------|--------------|----------------|-----------------|----------------------------|-------------------|--------------------|-----------------------------|----------------|-------|
| `accept-invite` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 100 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Contractor onboarding path |
| `admin-client-platform-config` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 32 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Admin platform config CRUD |
| `admin-contractor-performance` | YES | YES | ACTIVE | 18 | 2026-05-19 05:03:16 | ACTIVE | 19 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `admin-data` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 317 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Monolithic admin API — blocks admin UI on staging |
| `admin-materialize-dispatch-outbox` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 30 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Dispatch outbox materialization |
| `admin-route-lead` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 27 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Lead routing RPC bridge |
| `admin-simulate-dispatch-attempt` | YES | YES | ACTIVE | 17 | 2026-05-19 07:28:32 | ACTIVE | 29 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `admin-sync-revenue-signals` | YES | YES | ACTIVE | 17 | 2026-05-19 07:38:51 | ACTIVE | 30 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `calculate-estimate-metrics` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 280 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Standalone deploy; logic also inlined in scan-quote |
| `capi-event` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 338 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Meta CAPI server bridge absent on staging |
| `capture-truth-gate-lead` | YES | YES | ACTIVE | 22 | 2026-05-17 04:52:05 | ACTIVE | 44 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | TruthGate lead capture |
| `compare-quotes` | YES | YES | ACTIVE | 18 | 2026-05-19 04:53:20 | ACTIVE | 204 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `contractor-actions` | YES | YES | ACTIVE | 17 | 2026-05-19 07:46:27 | ACTIVE | 313 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `contractor-booking-confirmed` | YES | YES | ACTIVE | 17 | 2026-05-19 07:55:17 | ACTIVE | 74 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | Cron secret-header |
| `contractor-mark-no-show` | YES | YES | ACTIVE | 17 | 2026-05-19 07:58:32 | ACTIVE | 74 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | Cron secret-header |
| `contractor-performance-summary` | YES | YES | ACTIVE | 17 | 2026-05-19 07:59:05 | ACTIVE | 19 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `contractor-send-followups` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 74 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Cron follow-up sender |
| `contractor-submit-outcome` | YES | YES | ACTIVE | 17 | 2026-05-19 08:10:55 | ACTIVE | 20 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `create-checkout-session` | YES | YES | ACTIVE | 17 | 2026-05-19 08:00:01 | ACTIVE | 104 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `dev-create-quote-scenario` | YES | YES | ACTIVE | 17 | 2026-05-23 21:29:36 | ACTIVE | 14 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | Staging version counter higher than prod |
| `dev-report-unlock` | YES | YES | ACTIVE | 17 | 2026-05-19 08:04:06 | ACTIVE | 152 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | Dev bypass — staging only use |
| `dial-lead` | YES | YES | ACTIVE | 17 | 2026-05-19 08:11:40 | ACTIVE | 135 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `dispatch-lead` | YES | YES | ACTIVE | 17 | 2026-05-19 08:10:40 | ACTIVE | 54 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `dispatch-platform-events` | YES | YES | ACTIVE | 17 | 2026-05-19 08:46:08 | ACTIVE | 73 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `enrich-lead` | YES | YES | ACTIVE | 17 | 2026-05-19 08:29:58 | ACTIVE | 204 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `generate-contractor-brief` | YES | YES | ACTIVE | 17 | 2026-05-19 09:04:32 | ACTIVE | 314 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `generate-negotiation-script` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 203 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | No frontend caller; prod-only today |
| `get-contractor-document-url` | YES | YES | ACTIVE | 17 | 2026-05-19 08:55:13 | ACTIVE | 101 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `get-contractor-dossier` | YES | YES | ACTIVE | 17 | 2026-05-19 08:57:48 | ACTIVE | 102 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `import-facebook-lead-ad` | YES | YES | ACTIVE | 17 | 2026-05-19 08:58:46 | ACTIVE | 33 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `lead-reactivation` | YES | YES | ACTIVE | 17 | 2026-05-19 09:00:21 | ACTIVE | 203 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `list-contractor-opportunities` | YES | YES | ACTIVE | 17 | 2026-05-19 09:03:39 | ACTIVE | 101 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `partner-update-disposition` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 44 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Partner CRM write path |
| `persist-diagnosis-start` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 66 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Post-scan diagnosis funnel |
| `process-webhook` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 154 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Legacy webhook drain cron |
| `qualify-homepage-lead` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 81 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Confirms prior ops note — homepage funnel 404 on staging |
| `refresh-benchmarks` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 203 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Nightly benchmarks cron |
| `report-access` | YES | YES | ACTIVE | 17 | 2026-05-21 07:47:28 | ACTIVE | 4 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | Funnel critical — both envs live; version counters not comparable across projects |
| `request-callback` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 145 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Homeowner callback bridge |
| `request-partner-access` | YES | YES | ACTIVE | 18 | 2026-05-19 06:56:39 | ACTIVE | 57 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `save-routing-preferences` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 82 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Contractor onboarding |
| `scan-quote` | YES | YES | ACTIVE | 23 | 2026-05-26 11:49:17 | ACTIVE | 384 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | Scanner Brain — both envs; staging deployed same day earlier |
| `send-contractor-handoff` | YES | YES | ACTIVE | 18 | 2026-05-19 06:51:54 | ACTIVE | 131 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `send-otp` | YES | YES | ACTIVE | 23 | 2026-05-25 00:27:35 | ACTIVE | 356 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | OTP hard gate — both envs live |
| `send-report-email` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 204 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Post-unlock snapshot email |
| `start-upload-scan-session` | YES | YES | ACTIVE | 22 | 2026-05-17 04:52:13 | ACTIVE | 41 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | Upload bootstrap — both envs live |
| `stripe-webhook` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 95 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Credit purchase fulfillment |
| `submit-diagnosis-intake` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 67 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Diagnosis persistence |
| `summarize-row` | NO | NO | ACTIVE | 19 | 2026-05-19 07:12:20 | NOT_DEPLOYED | UNKNOWN | UNKNOWN | GHOST_ON_STAGING | Live on staging only — no local folder or config entry |
| `unlock-lead` | YES | YES | ACTIVE | 18 | 2026-05-19 06:32:48 | ACTIVE | 103 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `update-homeowner-context` | YES | YES | ACTIVE | 18 | 2026-05-19 06:31:09 | ACTIVE | 44 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `verify-otp` | YES | YES | ACTIVE | 23 | 2026-05-25 00:27:51 | ACTIVE | 371 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | OTP hard gate — both envs live |
| `voice-followup` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 311 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Admin voice webhook — prod only |

---

## Deployment Drift Summary

**Audit date:** 2026-05-26  
**Branch at audit:** `forensic_report_v2` (manifest docs untracked; no uncommitted function source changes)

| Metric | Count |
|--------|------:|
| Local function folders (`index.ts`, excl. `_shared`) | 52 |
| `[functions.*]` config entries | 52 |
| Staging live functions (`zgsofkgddpcntdvpckdq`) | 33 |
| Production live functions (`wkrcyxcnzhwjtdpmfpaf`) | 52 |
| Local functions live on **both** staging and production | 32 |
| Ghost functions (live but not in repo) | 1 (`summarize-row` on staging) |

### Missing on staging (20)

`accept-invite`, `admin-client-platform-config`, `admin-data`, `admin-materialize-dispatch-outbox`, `admin-route-lead`, `calculate-estimate-metrics`, `capi-event`, `contractor-send-followups`, `generate-negotiation-script`, `partner-update-disposition`, `persist-diagnosis-start`, `process-webhook`, `qualify-homepage-lead`, `refresh-benchmarks`, `request-callback`, `save-routing-preferences`, `send-report-email`, `stripe-webhook`, `submit-diagnosis-intake`, `voice-followup`

### Missing on production (0)

All 52 local functions are deployed on production.

### Ghost functions

| Function | Environment | Status | Version | Updated At (UTC) |
|----------|-------------|--------|---------|------------------|
| `summarize-row` | Staging only | ACTIVE | 19 | 2026-05-19 07:12:20 |

### Inactive functions

None — all live rows reported `ACTIVE` on both projects.

### Version / date divergences

All **32** functions present on both environments show `VERSION_DIVERGENCE` and `DATE_DIVERGENCE` (version counters are project-scoped; production bulk-updated **2026-05-26 13:58:17 UTC**). This is expected after independent deploy histories — not automatically a defect. Re-smoke after intentional deploys.

**Notable same-day funnel deploys (staging):** `scan-quote` v23 @ 2026-05-26 11:49:17; `send-otp` / `verify-otp` v23 @ 2026-05-25.

### Scanner / OTP / report-access deploy status

| Function | Staging | Production | Funnel role |
|----------|---------|------------|-------------|
| `start-upload-scan-session` | ACTIVE v22 | ACTIVE v41 | Upload bootstrap |
| `scan-quote` | ACTIVE v23 | ACTIVE v384 | Scanner Brain |
| `report-access` | ACTIVE v17 | ACTIVE v4 | Preview/full RPC proxy |
| `send-otp` | ACTIVE v23 | ACTIVE v356 | OTP send |
| `verify-otp` | ACTIVE v23 | ACTIVE v371 | OTP verify / unlock |

Core Verify-to-Reveal chain is **live on both** environments. Staging lacks adjacent funnel functions: `qualify-homepage-lead`, `send-report-email`, `request-callback`, `persist-diagnosis-start`, `submit-diagnosis-intake`, `capi-event`.

### Functions requiring smoke tests next (priority)

1. **Staging deploy gap (P0):** `qualify-homepage-lead`, `admin-data`, `capi-event`, `request-callback`, `send-report-email`
2. **Funnel re-smoke both envs (P0):** `start-upload-scan-session` → `scan-quote` → `report-access` → `send-otp` / `verify-otp`
3. **Staging missing partner/admin (P1):** `partner-update-disposition`, `admin-route-lead`, `admin-materialize-dispatch-outbox`, `accept-invite`, `save-routing-preferences`
4. **Ghost cleanup (P1):** Investigate `summarize-row` on staging — remove or document
5. **Production-only paths (P2):** `voice-followup`, `generate-negotiation-script`, cron family not on staging

### Unresolved unknowns

- Last smoke test timestamps (still UNKNOWN — CLI does not provide)
- Whether staging version lag vs production reflects intentional partial deploy or drift
- Secrets parity between projects (not in scope of `functions list`)
- `summarize-row` purpose and whether safe to delete from staging

---

## 3. Public / Anon Surface

Functions reachable by unauthenticated browsers using only the publishable/anon key (gateway `verify_jwt = false`). Handler-level gates vary — **do not treat “public surface” as “unprotected data.”**

| Function | Purpose (short) | Handler gate | Primary tables / RPCs |
|----------|-----------------|----------------|------------------------|
| `capture-truth-gate-lead` | TruthGate lead INSERT (RLS-safe) | Payload validation; never sets `phone_verified` | `leads`, `event_logs` |
| `start-upload-scan-session` | Bootstrap lead + quote_file + scan_session | UUID + storage_path contract | `leads`, `quote_files`, `scan_sessions`, `event_logs` |
| `scan-quote` | Scanner Brain: Gemini extract + TS score | Session existence, rate limits; optional `DEV_BYPASS_SECRET` for dev override | `scan_sessions`, `analyses`, `quote_files`, `quotes`, `leads`, `lead_events` |
| `report-access` | Service-role proxy for preview/full RPCs | Preview: `scan_session_id` only. Full: `phone_e164` + `get_analysis_full` | RPC `get_analysis_preview`, `get_analysis_full` |
| `send-otp` | Twilio Verify send + rate limits | E.164 validation, cooldown windows | `phone_verifications` |
| `verify-otp` | Twilio Verify check + unlock session | OTP validation; optional QA bypass env | `phone_verifications`, `scan_sessions`, `leads`; canonical events |
| `qualify-homepage-lead` | Homepage lead qualification + Twilio lookup | Email/phone validation | `leads` |
| `enrich-lead` | Post-capture county/window enrichment | Resolves `session_id` → `lead_id` | `scan_sessions`, `leads`, `event_logs` |
| `compare-quotes` | Multi-quote Gemini comparison | `phone-RPC` per session | `quote_comparisons`, `scan_sessions`, `event_logs` |
| `generate-contractor-brief` | Contractor match brief + opportunity | `phone-RPC` | `scan_sessions`, `leads`, `analyses`, `contractors`, `contractor_opportunities`, `event_logs` |
| `generate-negotiation-script` | Gemini negotiation script | `phone-RPC`; caches on `analyses` | `analyses`, `scan_sessions`, `leads`, `event_logs` |
| `request-callback` | Homeowner callback request | `phone_verified` on lead | `scan_sessions`, `leads`, `analyses`, `contractor_opportunities`, `voice_followups`, `lead_events` |
| `send-report-email` | Post-unlock snapshot receipt email | `phone_verified` + idempotency on lead | `scan_sessions`, `leads`, `analyses`, `event_logs` |
| `persist-diagnosis-start` | Stamp `diagnosis_started` | lead/session/analysis binding | `scan_sessions`, `analyses`, `leads`, `lead_events` |
| `submit-diagnosis-intake` | Persist diagnosis intake | Relationship validation | `diagnosis_intakes`, `scan_sessions`, `analyses`, `leads`, `lead_events` |
| `update-homeowner-context` | Phase 10 human context fields | Session↔lead binding; enum validation | `scan_sessions`, `leads`, `lead_events` |
| `request-partner-access` | Contractor self-serve registration | Zod body validation | `contractor_profiles`, `contractor_accounts`, `event_logs` |
| `calculate-estimate-metrics` | Stateless metrics from extraction JSON | None (no DB) | none |
| `capi-event` | Meta CAPI dispatch | Accepts POST JSON; graceful degrade if unconfigured | `capi_signal_logs`, `event_logs`, `meta_configurations`, `clients` |
| `report-access` preview | Teaser-safe preview payload | UUID only | via RPC |
| `dev-report-unlock` | Dev full report bypass | `DEV_BYPASS_ENABLED` + body `dev_secret` | `analyses` |
| `dev-create-quote-scenario` | Dev scaffold + invoke scan-quote | Body `dev_secret` | `leads`, `quote_files`, `scan_sessions` |

**High-risk public endpoints (UUID / knowledge-based gates only):** `report-access` preview, `persist-diagnosis-start`, `submit-diagnosis-intake`, `update-homeowner-context`, `enrich-lead`, `capture-truth-gate-lead`, `send-report-email` (checks verification server-side but callable by anyone with `scan_session_id`).

---

## 4. Admin / Contractor / Internal Surface

### Admin (`adminAuth` — JWT + `user_roles`, or `x-dev-secret` when `DEV_BYPASS_ENABLED=true`)

| Function | Purpose | Required roles (typical) | Main tables |
|----------|---------|--------------------------|-------------|
| `admin-data` | Monolithic admin API (50+ actions) | super_admin / operator / viewer (action-dependent) | Many — see function source |
| `admin-client-platform-config` | Client platform config CRUD | super_admin | `clients`, `client_platform_configs` |
| `admin-materialize-dispatch-outbox` | Dispatch outbox materialization | super_admin / operator | `platform_dispatch_outbox` |
| `admin-simulate-dispatch-attempt` | Dispatch attempt simulation | super_admin / operator | `platform_dispatch_attempts`, `platform_dispatch_outbox` |
| `admin-route-lead` | Lead assignment routing | super_admin / operator | RPC `admin_route_lead_assignment` |
| `admin-sync-revenue-signals` | Revenue signal dry-run sync | super_admin | RPC `admin_sync_revenue_signals` |
| `admin-contractor-performance` | Operator performance dashboard | super_admin / operator / viewer | `user_roles`, `contractor_accounts`, `lead_assignments`, `lead_contact_releases`, `contractor_outcomes` |
| `contractor-actions` | Monetization lifecycle actions | super_admin / operator | `contractor_opportunity_routes`, `contractor_opportunities`, `billable_intros`, `contractor_outcomes`, `event_logs` |
| `dial-lead` | Admin autodial webhook | super_admin / operator | `leads`, `voice_followups`, `lead_events` |
| `send-contractor-handoff` | Email handoff to contractor | super_admin / operator | `leads`, `analyses`, `contractor_opportunities`, `lead_events` |
| `voice-followup` | phonecall.bot webhook (admin trigger) | super_admin / operator | `scan_sessions`, `leads`, `analyses`, `contractor_opportunities`, `event_logs` |

### Contractor (JWT + marketplace account bridge)

| Function | Purpose | Main tables / RPCs |
|----------|---------|-------------------|
| `accept-invite` | Invite token → link contractor | `contractor_invitations`, `contractors`, `contractor_profiles`, `contractor_credits` |
| `create-checkout-session` | Stripe checkout for credits | `contractor_profiles`, `contractor_credits` |
| `list-contractor-opportunities` | Opportunity inbox | `contractor_profiles`, `contractors`, `contractor_credits`, `contractor_opportunity_routes`, `contractor_opportunities`, `contractor_unlocked_leads`, `leads`, `scan_sessions` |
| `get-contractor-dossier` | Partner dossier read | `analyses`, `leads`, `contractor_unlocked_leads`, `contractor_profiles`, `contractor_credits`, `contractors`, `contractor_opportunities`, `contractor_outcomes` |
| `get-contractor-document-url` | Signed quote file URL | `analyses`, `contractor_unlocked_leads`, `contractors`, `contractor_opportunities`, `contractor_opportunity_routes`, `scan_sessions`, `quote_files`, `quotes` (storage) |
| `unlock-lead` | Credit spend unlock | RPC `unlock_contractor_lead` |
| `partner-update-disposition` | CRM disposition writes | `contractor_profiles`, `contractors`, `contractor_outcomes`, `contractor_opportunities`, `leads`, `lead_assignments`, `contractor_accounts` |
| `contractor-submit-outcome` | Outcome submission | `contractor_accounts`, `lead_assignments`, `lead_contact_releases`, `contractor_outcomes` |
| `contractor-performance-summary` | Partner KPI summary | `contractor_accounts`, `lead_assignments`, `lead_contact_releases`, `contractor_outcomes` |
| `save-routing-preferences` | Onboarding routing prefs | `contractors` |

### Internal / cron / webhook (secret-header or signature)

| Function | Purpose | Auth header / mechanism | Main tables |
|----------|---------|-------------------------|-------------|
| `dispatch-lead` | Drain `webhook_deliveries` queue | `x-dispatch-secret` = `DISPATCH_LEAD_SECRET` | `webhook_deliveries`, `webhook_delivery_attempts`, `leads`, `analyses`, `lead_events` |
| `dispatch-platform-events` | Platform dispatch worker (CAPI/Google) | `x-dispatch-secret` = `DISPATCH_WORKER_SECRET` | `wm_event_log`, `wm_platform_dispatch_log` (via worker) |
| `process-webhook` | Legacy CRM webhook drain | `x-cron-secret` = `PROCESS_WEBHOOK_SECRET` or `CONTRACTOR_CRON_SECRET` | `webhook_deliveries`, `leads`, `lead_events` |
| `refresh-benchmarks` | Nightly county benchmarks | `x-cron-secret` = `BENCHMARK_CRON_SECRET` or `CONTRACTOR_CRON_SECRET` | `analyses`, `scan_sessions`, `leads`, `county_benchmarks`, `event_logs` |
| `lead-reactivation` | Cold lead drip email | `x-cron-secret` = `REACTIVATION_CRON_SECRET` or `CONTRACTOR_CRON_SECRET` | `leads`, `scan_sessions`, `analyses`, `event_logs` |
| `contractor-booking-confirmed` | Booking confirmation hook | `x-contractor-secret` = `CONTRACTOR_CRON_SECRET` | `contractor_leads`, `contractor_followups`, `contractor_activity_log` |
| `contractor-mark-no-show` | No-show marker | `x-contractor-secret` = `CONTRACTOR_CRON_SECRET` | same family |
| `contractor-send-followups` | Follow-up email sender | `x-contractor-secret` = `CONTRACTOR_CRON_SECRET` | `contractor_followups`, `contractor_leads`, `contractor_activity_log` |
| `import-facebook-lead-ad` | Facebook lead ad ingest | `x-import-secret` or Bearer = `FACEBOOK_LEAD_AD_IMPORT_SECRET` | `leads`, `lead_attribution_details`, `event_logs` |
| `stripe-webhook` | Stripe checkout fulfillment | Stripe `stripe-signature` = `STRIPE_WEBHOOK_SECRET` | `contractor_credit_purchases`; RPC `fulfill_contractor_credit_purchase` |

---

## 5. Required Secrets Inventory

Supabase-managed (auto-injected): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` (some functions accept alias).

Documented in `.env.example` (set via `supabase secrets set`, never in client `.env.local`):

| Secret | Used by (functions) |
|--------|---------------------|
| `DEV_BYPASS_ENABLED` | `_shared/adminAuth.ts`, `dev-report-unlock` |
| `DEV_BYPASS_SECRET` | `_shared/adminAuth.ts`, `dev-report-unlock`, `dev-create-quote-scenario`, `scan-quote` (dev override) |
| `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE` | `capi-event`, `_shared/capiRouting.ts`, `admin-data` (Meta health) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | `send-otp`, `verify-otp` |
| `TWILIO_LOOKUP_ENABLED` | `send-otp`, `qualify-homepage-lead` |
| `GEMINI_API_KEY` | `scan-quote`, `compare-quotes`, `generate-negotiation-script` |
| `DISPATCH_LEAD_SECRET` | `dispatch-lead` |

Additional secrets found in function code (not all listed in `.env.example`):

| Secret | Used by |
|--------|---------|
| `GEMINI_SCAN_MODEL`, `GEMINI_SCAN_TIMEOUT_MS`, `GEMINI_SCAN_MAX_OUTPUT_TOKENS`, `SCAN_STALE_PROCESSING_MINUTES`, `SCAN_MAX_FILE_BYTES` | `scan-quote` via `_shared/scannerConfig.ts` |
| `OTP_QA_BYPASS_*`, `WM_SUPABASE_PROJECT_REF` | `send-otp`, `verify-otp` |
| `RESEND_API_KEY`, `REPORT_FROM_EMAIL`, `REPORT_BASE_URL`, `RESEND_FROM_EMAIL` | `send-report-email`, `lead-reactivation`, `send-contractor-handoff`, `request-partner-access`, `dispatch-lead` |
| `PHONECALL_BOT_WEBHOOK_URL` | `request-callback`, `dial-lead`, `voice-followup` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `create-checkout-session`, `stripe-webhook` |
| `PREVIEW_CHECKOUT_ENABLED`, `PREVIEW_CONTRACTOR_PROFILE_ID`, `PREVIEW_CONTRACTOR_ID` | `create-checkout-session` |
| `DISPATCH_WORKER_SECRET` | `dispatch-platform-events` |
| `GOOGLE_ADS_DISPATCH_URL`, `GOOGLE_ADS_DISPATCH_AUTH_TOKEN`, `WM_EVENT_SOURCE_URL` | `dispatch-platform-events` |
| `CONTRACTOR_CRON_SECRET` | `contractor-booking-confirmed`, `contractor-mark-no-show`, `contractor-send-followups`, `process-webhook`, `refresh-benchmarks`, `lead-reactivation` |
| `PROCESS_WEBHOOK_SECRET`, `BENCHMARK_CRON_SECRET`, `REACTIVATION_CRON_SECRET` | respective cron functions (fallback to `CONTRACTOR_CRON_SECRET`) |
| `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET` | `process-webhook` |
| `FACEBOOK_LEAD_AD_IMPORT_SECRET` | `import-facebook-lead-ad` |
| `LOVABLE_API_KEY` | `dispatch-lead` |
| `CONTRACTOR_EMAIL`, `CONTRACTOR_NAME` | `send-contractor-handoff`, `request-partner-access` |
| `WM_EDGE_DIAGNOSTICS`, `EDGE_DIAGNOSTICS` | `get-contractor-dossier` |

---

## 6. Caller / Auth Mismatches

| Issue | Severity | Detail |
|-------|----------|--------|
| **Global `verify_jwt = false`** | Critical | All 52 functions accept anon-key invocation at the gateway. Misconfigured handler auth = full exposure. |
| **JWT-required functions without gateway JWT** | High | `unlock-lead`, `list-contractor-opportunities`, `create-checkout-session`, contractor JWT functions rely on Bearer parsing only — anon key still reaches endpoint. |
| **`adminAuth` vs gateway** | High | Admin endpoints trust `Authorization` header parsing in Deno; dev bypass via `x-dev-secret` when `DEV_BYPASS_ENABLED=true` (must stay false in prod). |
| **`report-access` preview** | High | Preview mode requires only `scan_session_id` (UUID). Teaser payload is whitelisted but UUID leakage enables preview fetch. |
| **Service-role writers without caller auth** | High | `capture-truth-gate-lead`, `start-upload-scan-session`, `persist-diagnosis-start`, `submit-diagnosis-intake`, `update-homeowner-context`, `enrich-lead` — callable with anon key; trust relationship/id validation only. |
| **Local/remote target split** | High | `supabase/config.toml` uses local namespace `wm-mvp-forensic-v2-local`; remote CLI and browser env must explicitly target `zgsofkgddpcntdvpckdq`. Do not infer remote target from local Docker project_id. |
| **`src/integrations/supabase/client.ts` env-only client** | Medium | Client now fails loudly when Supabase env vars are missing and refuses old Lovable/main ref in local dev. |
| **Orphan / unwired functions** | Medium | `generate-negotiation-script`, `contractor-actions`, `calculate-estimate-metrics` have no `src/` callers; drift risk if deployed but untested. |
| **`voice-followup` indirect only** | Low | Frontend migrated to `request-callback` for homeowner CTAs; `voice-followup` reached via `admin-data` only. |
| **Legacy `process-webhook` vs `dispatch-lead`** | Low | Two webhook drain paths documented; cron migration in progress per migrations comments. |

---

## 7. Functions Requiring Smoke Tests

Priority order for pre-deploy / post-deploy verification (last run: **UNKNOWN** for all).

| Priority | Function | Suggested smoke |
|----------|----------|-----------------|
| P0 | `start-upload-scan-session` | POST valid bootstrap body → `scan_session_id` returned |
| P0 | `scan-quote` | Known fixture session → `analyses` row complete |
| P0 | `report-access` | preview + full (verified phone) + unauthorized full |
| P0 | `send-otp` / `verify-otp` | E.164 send → verify → `phone_verified_at` set |
| P0 | `capture-truth-gate-lead` | TruthGate payload → `lead_id` |
| P1 | `qualify-homepage-lead` | Homepage lead path (confirm deployed on staging) |
| P1 | `dispatch-lead` | `x-dispatch-secret` drain with `{ limit: 1 }` |
| P1 | `stripe-webhook` | Stripe CLI test event → credits fulfilled |
| P1 | `capi-event` | Run `supabase/functions/capi-event/smoke_test.ts` |
| P1 | `admin-data` | Authenticated `get_attribution_freshness` action |
| P2 | Cron family | `refresh-benchmarks`, `lead-reactivation`, `process-webhook`, `contractor-send-followups` with correct `x-cron-secret` |
| P2 | Contractor JWT family | `list-contractor-opportunities`, `unlock-lead`, `partner-update-disposition` |
| P2 | Dev-only | `dev-report-unlock`, `dev-create-quote-scenario` with bypass enabled on staging only |

---

## 8. Open Questions

1. ~~**Live deploy matrix:**~~ **Resolved 2026-05-26** — see [§ Live Deployment Matrix](#live-deployment-matrix). Staging: 32/52 + 1 ghost; Production: 52/52.
2. **Secrets parity:** Do staging and prod share the same secret *names* with different values? Full diff not in repo.
3. **`generate-negotiation-script`:** Deployed on **production only** (staging NOT_DEPLOYED); no frontend wiring — intentional defer or dead code?
4. **`contractor-actions` vs `partner-update-disposition`:** Overlap in outcome handling; which is canonical for new work?
5. **`calculate-estimate-metrics`:** Standalone HTTP function vs inlined `_shared/metrics.ts` — is standalone deploy still needed?
6. **Cron schedules:** Which pg_cron jobs are active per environment for `dispatch-lead`, `dispatch-platform-events`, `refresh-benchmarks`, `lead-reactivation`, `process-webhook`?
7. **`OTP_QA_BYPASS_*`:** Enabled on staging only? Document expected values per project ref.
8. **Last smoke timestamps:** No CI job records production/staging smoke dates — should manifest be updated from a recurring checklist?

---

## Appendix A — Per-Function Detail

Each entry: **Purpose · Category · verify_jwt · Auth · Env vars · Service role · Tables · Callers · Deploy · Smoke**

### `accept-invite`
- **Purpose:** Validate invite token; link auth user to contractor; seed profile/credits.
- **Category:** contractor · **verify_jwt:** false · **Auth:** JWT+role
- **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | `SUPABASE_PUBLISHABLE_KEY`
- **Service role:** yes · **Tables:** `contractor_invitations`, `contractors`, `contractor_profiles`, `contractor_credits`
- **Callers:** `src/pages/AcceptInvite.tsx` · **Deploy:** UNKNOWN · **Smoke:** UNKNOWN

### `admin-client-platform-config`
- **Purpose:** CRUD for `client_platform_configs` readiness matrix.
- **Category:** admin · **verify_jwt:** false · **Auth:** adminAuth (super_admin)
- **Env:** via adminAuth + Supabase auto env
- **Service role:** yes · **Tables:** `clients`, `client_platform_configs`
- **Callers:** `src/services/clientPlatformConfigs.ts` · **Deploy:** UNKNOWN · **Smoke:** UNKNOWN

### `admin-contractor-performance`
- **Purpose:** Internal operator contractor KPI aggregates.
- **Category:** admin · **verify_jwt:** false · **Auth:** JWT+role (`user_roles`)
- **Env:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Service role:** yes · **Tables:** `user_roles`, `contractor_accounts`, `lead_assignments`, `lead_contact_releases`, `contractor_outcomes`
- **Callers:** `src/services/contractorPerformance.ts` · **Deploy:** UNKNOWN · **Smoke:** UNKNOWN

### `admin-data`
- **Purpose:** Monolithic admin API (leads, opportunities, Meta, storage, voice, roles, re-scan, etc.).
- **Category:** admin · **verify_jwt:** false · **Auth:** adminAuth (role per action)
- **Env:** adminAuth + `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE` (Meta actions)
- **Service role:** yes · **Tables:** extensive — see `admin-data/index.ts`
- **Callers:** `adminDataService.ts`, `dispatchHealth.ts`; proxies `voice-followup`, `scan-quote`
- **Deploy:** UNKNOWN · **Smoke:** UNKNOWN

### `admin-materialize-dispatch-outbox`
- **Purpose:** Preview/materialize platform dispatch outbox rows.
- **Category:** admin · **Auth:** adminAuth · **Tables:** `platform_dispatch_outbox`
- **Callers:** `dispatchOutbox.ts` · **Deploy/Smoke:** UNKNOWN

### `admin-route-lead`
- **Purpose:** Operator lead assignment actions.
- **Category:** admin · **Auth:** adminAuth · **RPC:** `admin_route_lead_assignment`
- **Callers:** `leadAssignments.ts` · **Deploy/Smoke:** UNKNOWN

### `admin-simulate-dispatch-attempt`
- **Purpose:** Simulate dispatch attempts against outbox.
- **Category:** admin · **Auth:** adminAuth · **Tables:** `platform_dispatch_attempts`, `platform_dispatch_outbox`
- **Callers:** `dispatchAttempts.ts` · **Deploy/Smoke:** UNKNOWN

### `admin-sync-revenue-signals`
- **Purpose:** Dry-run revenue signal sync (live sync blocked from this entrypoint).
- **Category:** admin · **Auth:** adminAuth · **RPC:** `admin_sync_revenue_signals`
- **Callers:** `revenueSignalDryRunAudit.ts`, `revenueSignalIntegration.ts` · **Deploy/Smoke:** UNKNOWN

### `calculate-estimate-metrics`
- **Purpose:** Stateless derived financial metrics from extraction JSON.
- **Category:** internal · **Auth:** none · **Service role:** no · **Tables:** none
- **Env:** none · **Callers:** none (inlined in scan-quote) · **Deploy/Smoke:** UNKNOWN

### `capi-event`
- **Purpose:** Meta Conversions API internal secure sender (tenant-only routing after auth).
- **Category:** internal · **Auth:** `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` and/or `x-capi-dispatch-secret` (`CAPI_DISPATCH_SECRET`, optional)
- **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `CAPI_DISPATCH_SECRET`; `META_*` used only for legacy admin preview / platform-owned allowlist (empty in Wave C)
- **Tables:** `capi_signal_logs`, `event_logs`, `meta_configurations`, `clients`, `client_configs`
- **Callers:** `dispatch-platform-events` (service-role bearer); admin smoke uses in-process helpers
- **Smoke:** `smoke_test.ts` requires service-role token; `scripts/verify-capi-fallback.ts` verifies anon rejection + fail-closed routing

### `capture-truth-gate-lead`
- **Purpose:** RLS-safe TruthGate lead capture.
- **Category:** homeowner public · **Auth:** app-logic
- **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Tables:** `leads`, `event_logs` · **Callers:** `TruthGateFlow.tsx`

### `compare-quotes`
- **Purpose:** Multi-quote Gemini comparison with cache.
- **Category:** homeowner public · **Auth:** phone-RPC
- **Env:** `GEMINI_API_KEY`, Supabase auto env
- **Tables:** `quote_comparisons`, `scan_sessions`, `event_logs`
- **Callers:** `PostScanReportSwitcher.tsx`

### `contractor-actions`
- **Purpose:** Admin monetization actions (mark_interest, release, billing, outcome).
- **Category:** admin · **Auth:** adminAuth (operator+)
- **Tables:** routes, opportunities, billable_intros, outcomes, event_logs
- **Callers:** none in `src/` · **Deploy/Smoke:** UNKNOWN

### `contractor-booking-confirmed` / `contractor-mark-no-show` / `contractor-send-followups`
- **Category:** cron · **Auth:** `x-contractor-secret` / `CONTRACTOR_CRON_SECRET`
- **Service role:** yes · **Callers:** none · **Deploy/Smoke:** UNKNOWN

### `contractor-performance-summary`
- **Purpose:** Partner-facing KPI summary.
- **Category:** contractor · **Auth:** JWT+role (contractor_accounts)
- **Callers:** `contractorPerformance.ts`

### `contractor-submit-outcome`
- **Purpose:** Contractor outcome pipeline submission.
- **Category:** contractor · **Auth:** JWT+role
- **Callers:** `contractorOutcomeSubmission.ts`

### `create-checkout-session`
- **Purpose:** Stripe checkout for credit packs.
- **Category:** contractor · **Auth:** JWT+role (+ preview env fallback)
- **Env:** `STRIPE_SECRET_KEY`, `PREVIEW_*`, `REPORT_BASE_URL`
- **Callers:** `CreditPurchaseStore.tsx`, `PartnerLayout.tsx`

### `dev-create-quote-scenario` / `dev-report-unlock`
- **Category:** dev · **Auth:** dev-secret (+ `DEV_BYPASS_ENABLED` for unlock)
- **Callers:** `DevQuoteGenerator.tsx`, `reportService.ts`

### `dial-lead` / `send-contractor-handoff` / `voice-followup`
- **Category:** admin · **Auth:** adminAuth
- **Callers:** `adminDataService.ts`; voice via admin-data action

### `dispatch-lead` / `dispatch-platform-events` / `process-webhook`
- **Category:** internal/cron · **Auth:** secret-header (see §4)
- **Callers:** pg_cron, pg_net, manual curl · **Deploy/Smoke:** UNKNOWN

### `enrich-lead`
- **Purpose:** Async county/window enrichment post-capture.
- **Category:** internal · **Auth:** app-logic · **Callers:** `TruthGateFlow.tsx`

### `generate-contractor-brief` / `generate-negotiation-script`
- **Category:** homeowner public · **Auth:** phone-RPC · **Env:** `GEMINI_API_KEY` (negotiation + compare)
- **Callers:** brief → `ReportClassic.tsx`; negotiation → none

### `get-contractor-dossier` / `get-contractor-document-url`
- **Category:** contractor · **Auth:** JWT+role · **Callers:** `PartnerDossier.tsx`

### `import-facebook-lead-ad`
- **Category:** webhook · **Auth:** `FACEBOOK_LEAD_AD_IMPORT_SECRET` · **Callers:** none

### `lead-reactivation` / `refresh-benchmarks`
- **Category:** cron · **Auth:** `x-cron-secret` · **Callers:** none

### `list-contractor-opportunities` / `unlock-lead` / `partner-update-disposition` / `save-routing-preferences`
- **Category:** contractor · **Auth:** JWT+role · **Callers:** see inventory table

### `persist-diagnosis-start` / `submit-diagnosis-intake` / `update-homeowner-context`
- **Category:** homeowner public · **Auth:** app-logic (service-role writers)
- **Callers:** PostScan / diagnosis / PropertyAndConsent components

### `qualify-homepage-lead`
- **Category:** homeowner public · **Auth:** app-logic
- **Env:** Twilio + Supabase · **Callers:** `qualifyHomepageLead.ts`
- **Note:** Staging deploy gap reported in ops docs

### `report-access`
- **Category:** homeowner public · **Auth:** app-logic (preview) / phone-RPC (full)
- **Callers:** `reportService.ts`, DevReportPreview lab

### `request-callback` / `send-report-email`
- **Category:** homeowner public · **Auth:** app-logic (server checks `phone_verified`)
- **Callers:** Estimate, PostScan, ReportClassic

### `request-partner-access`
- **Category:** contractor · **Auth:** app-logic (public registration)
- **Callers:** `ContractorLogin.tsx`

### `scan-quote`
- **Category:** homeowner public · **Auth:** app-logic (+ dev-secret override)
- **Env:** `GEMINI_API_KEY`, scanner config envs, optional `DEV_BYPASS_SECRET`
- **Callers:** `UploadZone.tsx`, admin re-scan

### `send-otp` / `verify-otp`
- **Category:** homeowner public · **Auth:** app-logic
- **Env:** Twilio + OTP QA bypass vars · **Callers:** `phoneVerificationService.ts`

### `start-upload-scan-session`
- **Category:** homeowner public · **Auth:** app-logic
- **Callers:** `UploadZone.tsx`

### `stripe-webhook`
- **Category:** webhook · **Auth:** Stripe signature · **Callers:** Stripe servers

---

## Appendix B — Maintenance

Reconcile this manifest when:
- Adding/removing a function under `supabase/functions/`
- Changing `[functions.*]` in `config.toml`
- Adding `supabase.functions.invoke` or `/functions/v1/` calls in `src/`
- Rotating secrets or auth models
- After staging/prod deploy — update deploy matrix and smoke test dates

**Reconcile commands (human-run, not executed for this doc):**
```bash
supabase functions list --project-ref zgsofkgddpcntdvpckdq
supabase functions list --project-ref wkrcyxcnzhwjtdpmfpaf
supabase secrets list --project-ref <ref>
```

