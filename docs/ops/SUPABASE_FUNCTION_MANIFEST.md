# Supabase Edge Function Manifest — WindowMan

**Generated:** 2026-05-26 · **Forensic V2 refresh:** 2026-06-11
**Source of truth inputs:** `supabase/functions/**/index.ts`, `supabase/config.toml`, `src/`, `.env.example`  
**Scope:** Inventory and auth/deploy drift visibility only — no runtime mutations.

---

## 1. Executive Summary

The 2026-06 snapshot inventoried **56 Edge Functions** under `supabase/functions/` (excluding `_shared/` helpers). The 2026-09 `quote-education-capture` sprint adds `capture-quote-education-demo-lead` with a matching `verify_jwt = false` config entry. It was deployed ACTIVE v1 to `zgsofkgddpcntdvpckdq` on 2026-09-10 after migration `20260910063126`; the separate production inventory and unrelated gaps, including `ingest-native-lead`, were not re-audited or repaired in this bounded recovery.

That means the Supabase API gateway does **not** enforce JWT validation at the edge. Security relies entirely on **in-function auth** (adminAuth, contractor JWT checks, phone-verification RPC gates, cron/webhook secrets, or dev bypass flags). Any caller holding the public anon/publishable key can reach every function URL; only handler logic restricts abuse.

**Project targeting (documented, not live-verified here):**

Canonical operational roles: [SUPABASE_ENVIRONMENT_REGISTRY.md](./SUPABASE_ENVIRONMENT_REGISTRY.md).

| Ref | Operational role | Notes |
|-----|------------------|-------|
| `zgsofkgddpcntdvpckdq` | **LIVE_ACTIVE** | Current live WindowMan DB; default approved Forensic V2 remote target |
| `wkrcyxcnzhwjtdpmfpaf` | **LEGACY_PARENT** | Legacy WMProd parent; do not target from `forensic_report_v2` without explicit approval |
| `aqyptdxsbxqpbgoecykx` | **EMPTY_PREVIEW_V2** | Empty preview DB for V2 branch experiments |

**Matrix column labels:** Tables below use legacy audit labels **Staging** / **Production** for the two refs audited in 2026-05/06. **Staging** = `zgsofkgddpcntdvpckdq` (**LIVE_ACTIVE**). **Production** = `wkrcyxcnzhwjtdpmfpaf` (**LEGACY_PARENT** — not current live). Script names such as `assert-staging.ps1` assert LIVE_ACTIVE, not a disposable staging environment.

**Per-function deploy parity across projects:** Reconciled **2026-06-11** on forensic V2 via `supabase functions list` (see [§ Live Deployment Matrix](#live-deployment-matrix)); ghost `summarize-row` retired **2026-06-11**. LIVE_ACTIVE / legacy matrix label “Staging” (`zgsofkgddpcntdvpckdq`): **36/55** inventoried local functions live, **0 ghosts**. LEGACY_PARENT / legacy matrix label “Production” (`wkrcyxcnzhwjtdpmfpaf`): **52/52** was last audited **2026-05-26** (may lag new repo folders `capture-power-tool-demo-lead`, `windowman-concierge`). Structural parity between the two audited refs is **not** good — LIVE_ACTIVE lacks **18** repo functions relative to the legacy parent audit.

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
| `capture-power-tool-demo-lead` | homeowner public | false | app-logic | yes | none (Sprint B: `PowerToolDemo.tsx`) |
| `capture-quote-education-demo-lead` | homeowner public | false | app-logic | yes | `productionCaptureClient.ts` via `captureQuoteEducationDemoLead.ts` |
| `capture-arbitrage-lead` | homeowner public | false | app-logic (+ backend flag) | yes | `arbitrageengine.tsx` (via `captureArbitrageLead.ts`) |
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
| `process-meta-lead` | cron | false | `x-meta-worker-secret` | yes | none (local implementation; not deployment-verified) |
| `process-meta-outbox` | cron | false | `x-meta-worker-secret` | yes | none (local implementation; not deployment-verified) |
| `lead-reactivation` | cron | false | secret-header | yes | none |
| `list-contractor-opportunities` | contractor | false | JWT+role | yes | `ContractorOpportunitiesPage.tsx` |
| `partner-update-disposition` | contractor | false | JWT+role | yes | `PartnerActionCenter.tsx` |
| `persist-diagnosis-start` | homeowner public | false | app-logic | yes | `PostScanReportSwitcher.tsx` |
| `process-webhook` | cron | false | secret-header | yes | none |
| `qualify-homepage-lead` | homeowner public | false | app-logic | yes | `qualifyHomepageLead.ts` |
| `quote-intelligence-worker` | cron | false | secret-header (`x-quote-intelligence-worker-secret` = `QUOTE_INTELLIGENCE_WORKER_SECRET`) | yes | none |
| `report-summary-worker` | cron | false | secret-header (`x-report-summary-worker-secret` = `REPORT_SUMMARY_WORKER_SECRET`) | yes | none |
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
| `windowman-concierge` | homeowner public | false | app-logic (Zod + Gemini JSON only) | no | none observed in `src/` (acquisition concierge endpoint) |

**Config reconciliation:** the 56-function count is a historical snapshot. The Meta Lead Ads sprint adds two local function directories and matching `config.toml` entries; neither their deployment nor overall current parity is asserted here.

**Deployment projects column:** See [§ Live Deployment Matrix](#live-deployment-matrix) (audited 2026-05-26).

**Last smoke test:** UNKNOWN (all), except note `capi-event/smoke_test.ts` exists for manual Deno smoke.

---

## Live Deployment Matrix

**Audit date:** 2026-06-11 (forensic V2); production column still **2026-05-26** unless re-listed
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
| `admin-data` | YES | YES | ACTIVE | 1 | 2026-06-11 09:17:33 | ACTIVE | 317 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | Monolithic admin API — deployed on V2 2026-06-11; `/admin/leads` verified live |
| `admin-materialize-dispatch-outbox` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 30 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Dispatch outbox materialization |
| `admin-route-lead` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 27 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Lead routing RPC bridge |
| `admin-simulate-dispatch-attempt` | YES | YES | ACTIVE | 17 | 2026-05-19 07:28:32 | ACTIVE | 29 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `admin-sync-revenue-signals` | YES | YES | ACTIVE | 17 | 2026-05-19 07:38:51 | ACTIVE | 30 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `calculate-estimate-metrics` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 280 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Standalone deploy; logic also inlined in scan-quote |
| `capi-event` | YES | YES | ACTIVE | 1 | 2026-06-05 23:34:25 | ACTIVE | 338 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | Meta CAPI server bridge — deployed on V2 2026-06-05 |
| `capture-power-tool-demo-lead` | YES | YES | ACTIVE | 1 | 2026-06-11 02:14:31 | NOT_DEPLOYED | UNKNOWN | UNKNOWN | MISSING_ON_PRODUCTION | PowerToolDemo progressive lead capture; `source=power-tool-demo`; never sets `phone_verified` / report unlock |
| `capture-quote-education-demo-lead` | YES | YES | ACTIVE | 1 | 2026-09-10 11:11:52 | NOT_DEPLOYED | UNKNOWN | UNKNOWN | MISSING_ON_PRODUCTION | SyntheticDemo progressive capture; `source=quote-education-demo`; CORS and NQ3/NQ4 handoff smoke verified on staging |
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
| `quote-intelligence-worker` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | NOT_DEPLOYED | UNKNOWN | UNKNOWN | NOT_DEPLOYED | Secret-header worker; local inventory only; deployment not claimed |
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
| `summarize-row` | NO | NO | RETIRED_DELETED | 27 | 2026-05-19 07:12:20 | NOT_DEPLOYED | UNKNOWN | UNKNOWN | RETIRED_GHOST | Remote-only orphan on forensic V2 (`zgsofkgddpcntdvpckdq`); deleted 2026-06-11 — no local folder, config entry, src/migration/trigger/cron/webhook refs, or 24h edge-function logs |
| `unlock-lead` | YES | YES | ACTIVE | 18 | 2026-05-19 06:32:48 | ACTIVE | 103 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `update-homeowner-context` | YES | YES | ACTIVE | 18 | 2026-05-19 06:31:09 | ACTIVE | 44 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | |
| `verify-otp` | YES | YES | ACTIVE | 23 | 2026-05-25 00:27:51 | ACTIVE | 371 | 2026-05-26 13:58:17 | PARITY_OK; VERSION_DIVERGENCE; DATE_DIVERGENCE | OTP hard gate — both envs live |
| `voice-followup` | YES | YES | NOT_DEPLOYED | UNKNOWN | UNKNOWN | ACTIVE | 311 | 2026-05-26 13:58:17 | MISSING_ON_STAGING | Admin voice webhook — prod only |
| `windowman-concierge` | YES | YES | ACTIVE | 6 | 2026-05-28 06:11:16 | NOT_DEPLOYED | UNKNOWN | UNKNOWN | MISSING_ON_PRODUCTION | Pre-login acquisition concierge (Gemini JSON); no DB/service-role; see audit § below |

---

## Deployment Drift Summary

**Audit date:** 2026-06-11 (forensic V2)
**Branch at audit:** `forensic_report_v2` @ `745e0d33` or later

| Metric | Count |
|--------|------:|
| Local function folders (`index.ts`, excl. `_shared`) | 55 |
| `[functions.*]` config entries | 55 |
| Staging live functions (`zgsofkgddpcntdvpckdq`) | 36 |
| Production live functions (`wkrcyxcnzhwjtdpmfpaf`) | 52 (2026-05-26 audit; may lag) |
| Local functions live on **both** staging and production | ~34 (estimate; re-list prod to confirm) |
| Ghost functions (live but not in repo) | 0 (none; `summarize-row` retired 2026-06-11) |
| Local-only on forensic V2 (repo present, not deployed) | 19 |

### Missing on staging (19)

`accept-invite`, `admin-client-platform-config`, `admin-materialize-dispatch-outbox`, `admin-route-lead`, `calculate-estimate-metrics`, `contractor-send-followups`, `generate-negotiation-script`, `partner-update-disposition`, `persist-diagnosis-start`, `process-webhook`, `qualify-homepage-lead`, `quote-intelligence-worker`, `refresh-benchmarks`, `request-callback`, `save-routing-preferences`, `send-report-email`, `stripe-webhook`, `submit-diagnosis-intake`, `voice-followup`

### Missing on production (2+)

At minimum: `capture-power-tool-demo-lead`, `windowman-concierge` (live on V2, not in 2026-05-26 prod audit). Re-list `wkrcyxcnzhwjtdpmfpaf` to confirm full delta.

### Ghost functions

None currently live. Previously:

| Function | Environment | Status | Version | Updated At (UTC) | Retirement |
|----------|-------------|--------|---------|------------------|------------|
| `summarize-row` | Staging only (`zgsofkgddpcntdvpckdq`) | RETIRED_DELETED | 27 | 2026-05-19 07:12:20 | Deleted 2026-06-11 after orphan verification (no local source, config, callers, or 24h logs) |

### Inactive functions

None — all live rows reported `ACTIVE` on both projects.

### Version / date divergences

All functions present on both environments show `VERSION_DIVERGENCE` and `DATE_DIVERGENCE` (version counters are project-scoped; production bulk-updated **2026-05-26 13:58:17 UTC**). This is expected after independent deploy histories — not automatically a defect. Re-smoke after intentional deploys.

**Notable forensic V2 deploys (2026-06):** `admin-data` v1 @ 2026-06-11; `capture-power-tool-demo-lead` v1 @ 2026-06-11; `capi-event` v1 @ 2026-06-05; `windowman-concierge` v6 @ 2026-05-28.

**Notable funnel deploys (staging):** `scan-quote` v31 @ 2026-05-26 11:49:17; `send-otp` / `verify-otp` v31 @ 2026-05-25.

### Scanner / OTP / report-access deploy status

| Function | Staging | Production | Funnel role |
|----------|---------|------------|-------------|
| `start-upload-scan-session` | ACTIVE v22 | ACTIVE v41 | Upload bootstrap |
| `scan-quote` | ACTIVE v23 | ACTIVE v384 | Scanner Brain |
| `report-access` | ACTIVE v17 | ACTIVE v4 | Preview/full RPC proxy |
| `send-otp` | ACTIVE v23 | ACTIVE v356 | OTP send |
| `verify-otp` | ACTIVE v23 | ACTIVE v371 | OTP verify / unlock |

Core Verify-to-Reveal chain is **live on forensic V2**. Staging still lacks adjacent funnel functions: `qualify-homepage-lead`, `send-report-email`, `request-callback`, `persist-diagnosis-start`, `submit-diagnosis-intake`. `capi-event` and `admin-data` are now live on V2.

### Forensic V2 local-only function triage (2026-06-11)

Repo folders present on `forensic_report_v2` but **not** deployed to `zgsofkgddpcntdvpckdq`. No deploy/delete in this pass — classification only.

| Function | Classification | Why | Blast radius | Protected deploy? | Next prompt title |
|----------|----------------|-----|--------------|-------------------|-------------------|
| `qualify-homepage-lead` | DEPLOY_LATER | Homepage acquisition funnel; `src/` caller `qualifyHomepageLead.ts` | Homepage lead capture 404 on V2 | YES | Deploy qualify-homepage-lead to forensic V2 |
| `request-callback` | DEPLOY_LATER | Post-scan/homeowner CTAs in `Estimate.tsx`, report shells | Callback requests fail on V2 | YES | Deploy request-callback to forensic V2 |
| `send-report-email` | DEPLOY_LATER | Post-unlock snapshot email; report funnel | Email receipt unavailable on V2 | YES | Deploy send-report-email to forensic V2 |
| `persist-diagnosis-start` | DEPLOY_LATER | Post-scan diagnosis funnel stamp | Diagnosis start not persisted on V2 | YES | Deploy persist-diagnosis-start to forensic V2 |
| `submit-diagnosis-intake` | DEPLOY_LATER | Diagnosis intake persistence; `useDiagnosticIntake.ts` | Intake writes fail on V2 | YES | Deploy submit-diagnosis-intake to forensic V2 |
| `accept-invite` | DEPLOY_LATER | Contractor onboarding; JWT+role handler | Invite acceptance blocked on V2 | YES | Deploy accept-invite to forensic V2 |
| `admin-client-platform-config` | DEPLOY_LATER | Admin platform config CRUD; adminAuth | Admin config UI blocked on V2 | YES | Deploy admin-client-platform-config to forensic V2 |
| `admin-materialize-dispatch-outbox` | DEPLOY_LATER | Dispatch outbox materialization; adminAuth | Dispatch outbox tooling blocked | YES | Deploy admin-materialize-dispatch-outbox to forensic V2 |
| `admin-route-lead` | DEPLOY_LATER | Lead routing RPC bridge; adminAuth | Routing desk actions blocked | YES | Deploy admin-route-lead to forensic V2 |
| `partner-update-disposition` | DEPLOY_LATER | Partner CRM writes; JWT+role | Partner disposition updates blocked | YES | Deploy partner-update-disposition to forensic V2 |
| `save-routing-preferences` | DEPLOY_LATER | Contractor onboarding preferences | Onboarding save blocked on V2 | YES | Deploy save-routing-preferences to forensic V2 |
| `voice-followup` | DEPLOY_LATER | Admin voice webhook; reached via `admin-data` | Voice follow-up trigger blocked on V2 | YES | Deploy voice-followup to forensic V2 |
| `contractor-send-followups` | DEPLOY_LATER | Cron follow-up sender; `x-contractor-secret` | Cron email follow-ups not running on V2 | YES | Deploy contractor-send-followups + cron secrets to V2 |
| `refresh-benchmarks` | DEPLOY_LATER | Nightly benchmarks cron; secret-header | Benchmark refresh not running on V2 | YES | Deploy refresh-benchmarks + cron to forensic V2 |
| `stripe-webhook` | DEFER | Credit purchase fulfillment; not current sprint | Billing webhook inactive on V2 | YES | Defer stripe-webhook until credit purchase on V2 |
| `generate-negotiation-script` | DEFER | Phone-RPC + Gemini; no `src/` caller observed | Negotiation script unavailable on V2 | YES | Defer or wire generate-negotiation-script |
| `calculate-estimate-metrics` | DEFER | Standalone metrics; logic inlined in `scan-quote` via `_shared/metrics.ts` | Redundant HTTP surface if deployed | NO | Retire or document calculate-estimate-metrics standalone |
| `process-webhook` | RETIRE_LATER | Legacy webhook drain; `dispatch-lead` is canonical per migrations comments | Legacy duplicate drain path | YES | Audit process-webhook vs dispatch-lead retirement |

### `windowman-concierge` handler audit (2026-06-11)

Read-only review of `supabase/functions/windowman-concierge/index.ts` on forensic V2 (**ACTIVE v6**).

| Attribute | Finding |
|-----------|---------|
| **Purpose** | Pre-login acquisition concierge: Gemini structured JSON routing chat. Does **not** touch scan-quote, OTP, report-access, scoring, analyses, or storage. |
| **HTTP methods** | `POST` (handler), `OPTIONS` (CORS preflight), `405` for others |
| **CORS** | `Access-Control-Allow-Origin: *`; methods `POST, OPTIONS` |
| **`verify_jwt`** | `false` in `config.toml` |
| **Handler auth** | No JWT, secret header, or session gate. Zod-validated JSON body only. |
| **Payload validation** | Strict Zod schemas for message, history, `contextMeta`; Gemini output re-validated; fallback response on parse/validation failure |
| **Service-role** | **No** Supabase client — no DB reads/writes |
| **Tables/RPCs** | **None** |
| **External APIs** | Google Gemini (`GEMINI_API_KEY`; optional `GEMINI_CONCIERGE_MODEL` / `GEMINI_MODEL`) |
| **PII logging** | User message content sent to Gemini; server logs use truncated error snippets and model names — no explicit raw PII log of phone/email |
| **Blast radius** | Gemini API cost/abuse; no data mutation risk. Code notes `TODO(rate-limit)` — no IP/session rate limit yet |
| **Deployed expected?** | YES — public acquisition surface; OPTIONS returns 200 on V2 endpoint |
| **Manifest gap** | Was missing entirely before this refresh |
| **Recommended status** | **NEEDS_SECURITY_REVIEW** — `verify_jwt=false` acceptable only while handler stays DB-less; add rate limiting before high-traffic promotion |

### Functions requiring smoke tests next (priority)

1. **Staging deploy gap (P0):** `qualify-homepage-lead`, `request-callback`, `send-report-email`
2. **Funnel re-smoke forensic V2 (P0):** `start-upload-scan-session` → `scan-quote` → `report-access` → `send-otp` / `verify-otp`; re-smoke `admin-data`, `capi-event`, `capture-power-tool-demo-lead`
3. **Staging missing partner/admin (P1):** `partner-update-disposition`, `admin-route-lead`, `admin-materialize-dispatch-outbox`, `accept-invite`, `save-routing-preferences`, `voice-followup`
4. ~~**Ghost cleanup (P1):** `summarize-row` on staging~~ — **DONE 2026-06-11** (retired/deleted from `zgsofkgddpcntdvpckdq`)
5. **Concierge security (P1):** `windowman-concierge` rate-limit review before broad acquisition traffic
6. **Production-only paths (P2):** `generate-negotiation-script`, cron family not on staging; prod deploy gap for `capture-power-tool-demo-lead`, `windowman-concierge`

### Unresolved unknowns

- Last smoke test timestamps (still UNKNOWN — CLI does not provide)
- Whether staging version lag vs production reflects intentional partial deploy or drift
- Secrets parity between projects (not in scope of `functions list`)
- ~~`summarize-row` purpose and whether safe to delete from staging~~ — resolved: remote-only ghost; retired/deleted from `zgsofkgddpcntdvpckdq` 2026-06-11

---

## 3. Public / Anon Surface

Functions reachable by unauthenticated browsers using only the publishable/anon key (gateway `verify_jwt = false`). Handler-level gates vary — **do not treat “public surface” as “unprotected data.”**

| Function | Purpose (short) | Handler gate | Primary tables / RPCs |
|----------|-----------------|----------------|------------------------|
| `capture-truth-gate-lead` | TruthGate lead INSERT (RLS-safe) + consent-gated OpenAI Ads `lead_created` | Payload validation; never sets `phone_verified`; server event ID and CAPI only after a new `source=truth-gate` insert | `leads`, `event_logs` |
| `capture-power-tool-demo-lead` | PowerToolDemo progressive lead capture (`source=power-tool-demo`) | `verify_jwt=false`; source-scoped session lookup; never sets `phone_verified` / report unlock; PII logging banned | `leads`, `event_logs` |
| `capture-quote-education-demo-lead` | SyntheticDemo progressive lead capture (`source=quote-education-demo`) | `verify_jwt=false`; variant/host/fixture allowlists; source-scoped session lookup; never sets `phone_verified` / report unlock; PII logging banned | `leads`, `event_logs`, `lead_events`; RPC `persist_lead_consent_batch` |
| `capture-arbitrage-lead` | ArbitrageEngine progressive lead capture (`source=arbitrage-engine`) | `verify_jwt=false`; backend flag `ARBITRAGE_PROGRESSIVE_CAPTURE_ENABLED` (default off); source-scoped `session_id`+`source` lookup; never sets `phone_verified` / report unlock; PII logging banned | `leads`, `event_logs` |
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
| `submit-diagnosis-intake` | Persist diagnosis intake + queue one scan-scoped diagnosis callback + canonical `callback_requested` | Scan/lead/phone-verification binding; `diagnosis_submission_id` intake retry key; session-unique callback | `diagnosis_intakes`, `voice_followups`, `lead_consent_events`, `wm_event_log`, `wm_platform_dispatch_log`, `scan_sessions`, `analyses`, `leads`, `phone_verifications`, `lead_events` |
| `update-homeowner-context` | Phase 10 human context fields | Session↔lead binding; enum validation | `scan_sessions`, `leads`, `lead_events` |
| `windowman-concierge` | Pre-login acquisition routing chat (Gemini JSON) | Zod request/output validation only; no DB; no service-role | **None** (Gemini API only) |
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
| `quote-intelligence-worker` | Quote intelligence extraction worker (one job per invoke) | `x-quote-intelligence-worker-secret` = `QUOTE_INTELLIGENCE_WORKER_SECRET` | `wm_quote_intelligence_*` via worker RPCs |
| `report-summary-worker` | Truth Report executive summary worker (one analysis per invoke) | `x-report-summary-worker-secret` = `REPORT_SUMMARY_WORKER_SECRET` | `wm_report_summaries` via worker RPCs |
| `lead-reactivation` | Cold lead drip email | `x-cron-secret` = `REACTIVATION_CRON_SECRET` or `CONTRACTOR_CRON_SECRET` | `leads`, `scan_sessions`, `analyses`, `event_logs` |
| `contractor-booking-confirmed` | Booking confirmation hook | `x-contractor-secret` = `CONTRACTOR_CRON_SECRET` | `contractor_leads`, `contractor_followups`, `contractor_activity_log` |
| `contractor-mark-no-show` | No-show marker | `x-contractor-secret` = `CONTRACTOR_CRON_SECRET` | same family |
| `contractor-send-followups` | Follow-up email sender | `x-contractor-secret` = `CONTRACTOR_CRON_SECRET` | `contractor_followups`, `contractor_leads`, `contractor_activity_log` |
| `import-facebook-lead-ad` | Signed native bytes committed before parsing; authenticated trusted import persists synchronously and returns IDs | Meta GET verify token / POST `X-Hub-Signature-256` (signature takes precedence), or `x-import-secret` / Bearer = `FACEBOOK_LEAD_AD_IMPORT_SECRET` | `meta_webhook_receipts` via `meta_receive_webhook_receipt`; trusted path via `meta_import_trusted_lead` |
| `process-meta-lead` | Retryable raw-receipt parsing, per-item quarantine, Graph lookup, and WindowMan lead persistence | `x-meta-worker-secret` = `META_WORKER_SECRET` | `meta_webhook_receipts`, `meta_lead_inbox`, `leads`, `lead_attribution_details`, `lead_consent_events`, form mappings via RPCs |
| `process-meta-outbox` | Independent qualified-only GHL and distinct Meta CRM feedback lanes | `x-meta-worker-secret` = `META_WORKER_SECRET` | `meta_integration_outbox`, `meta_ghl_contact_links`, `capi_signal_logs` via RPCs |
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
| `OPENAI_ADS_PIXEL_ID`, `OPENAI_ADS_CONVERSIONS_API_KEY`, `OPENAI_ADS_SITE_ORIGIN` | `capture-truth-gate-lead` via `_shared/openAiAdsConversions.ts` (`OPENAI_ADS_CONVERSIONS_API_KEY` is server-only) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | `send-otp`, `verify-otp` |
| `TWILIO_LOOKUP_ENABLED` | `send-otp`, `qualify-homepage-lead` |
| `GEMINI_API_KEY` | `scan-quote`, `compare-quotes`, `generate-negotiation-script` |
| `DISPATCH_LEAD_SECRET` | `dispatch-lead` |

Additional secrets found in function code (not all listed in `.env.example`):

| Secret | Used by |
|--------|---------|
| `GEMINI_SCAN_MODEL`, `GEMINI_SCAN_TIMEOUT_MS`, `GEMINI_SCAN_MAX_OUTPUT_TOKENS`, `SCAN_STALE_PROCESSING_MINUTES`, `SCAN_MAX_FILE_BYTES` | `scan-quote` via `_shared/scannerConfig.ts` |
| `QI_GEMINI_MODEL`, `QI_GEMINI_TIMEOUT_MS` | `quote-intelligence-worker` via `contract.ts` / `provider.ts` (independent of `GEMINI_SCAN_MODEL`; align both in production) |
| `REPORT_SUMMARY_GEMINI_MODEL`, `REPORT_SUMMARY_GEMINI_TIMEOUT_MS`, `REPORT_SUMMARY_GEMINI_MAX_OUTPUT_TOKENS`, `REPORT_SUMMARY_LEASE_SECONDS` | `report-summary-worker` via `_shared/reportSummary/summaryProviderConfig.ts` / `contract.ts` (independent of scanner/QI model envs) |
| `OTP_QA_BYPASS_*`, `WM_SUPABASE_PROJECT_REF` | `send-otp`, `verify-otp` |
| `RESEND_API_KEY`, `REPORT_FROM_EMAIL`, `REPORT_BASE_URL`, `RESEND_FROM_EMAIL` | `send-report-email`, `lead-reactivation`, `send-contractor-handoff`, `request-partner-access`, `dispatch-lead` |
| `PHONECALL_BOT_WEBHOOK_URL` | `request-callback`, `submit-diagnosis-intake`, `dial-lead`, `voice-followup` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `create-checkout-session`, `stripe-webhook` |
| `PREVIEW_CHECKOUT_ENABLED`, `PREVIEW_CONTRACTOR_PROFILE_ID`, `PREVIEW_CONTRACTOR_ID` | `create-checkout-session` |
| `DISPATCH_WORKER_SECRET` | `dispatch-platform-events` |
| `GOOGLE_ADS_DISPATCH_URL`, `GOOGLE_ADS_DISPATCH_AUTH_TOKEN`, `WM_EVENT_SOURCE_URL` | `dispatch-platform-events` |
| `CONTRACTOR_CRON_SECRET` | `contractor-booking-confirmed`, `contractor-mark-no-show`, `contractor-send-followups`, `process-webhook`, `refresh-benchmarks`, `lead-reactivation` |
| `PROCESS_WEBHOOK_SECRET`, `BENCHMARK_CRON_SECRET`, `REACTIVATION_CRON_SECRET` | respective cron functions (fallback to `CONTRACTOR_CRON_SECRET`) |
| `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET` | `process-webhook` |
| `FACEBOOK_LEAD_AD_IMPORT_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET`, `META_WEBHOOK_TEST_MODE`, `META_TEST_FORM_IDS`, `META_TEST_PAGE_IDS` | `import-facebook-lead-ad` |
| `META_PAGE_ACCESS_TOKEN`, `META_GRAPH_API_VERSION`, `META_WORKER_SECRET` | `process-meta-lead`; graph version and worker secret also used by `process-meta-outbox` as applicable |
| `GHL_LOCATION_ID`, `GHL_PRIVATE_INTEGRATION_TOKEN`, `META_GHL_DELIVERY_ENABLED`, `META_CRM_FEEDBACK_ENABLED`, `META_CRM_TEST_EVENT_CODE`, `META_CRM_LIVE_SEND_ENABLED` | `process-meta-outbox` (delivery flags default off) |
| `LOVABLE_API_KEY` | `dispatch-lead` |
| `QUOTE_INTELLIGENCE_WORKER_SECRET` | `quote-intelligence-worker` |
| `REPORT_SUMMARY_WORKER_SECRET` | `report-summary-worker` |
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
| P0 | `capture-truth-gate-lead` | New TruthGate payload → `lead_id` + `openai_ads_event_id`; reused response has neither OpenAI ID nor dispatch; CAPI failure remains non-blocking |
| P1 | `qualify-homepage-lead` | Homepage lead path (confirm deployed on staging) |
| P1 | `dispatch-lead` | `x-dispatch-secret` drain with `{ limit: 1 }` |
| P1 | `stripe-webhook` | Stripe CLI test event → credits fulfilled |
| P1 | `capi-event` | Run `supabase/functions/capi-event/smoke_test.ts` on V2 (deployed v1 2026-06-05) |
| P1 | `admin-data` | Authenticated `get_attribution_freshness` action on V2 (deployed v1 2026-06-11) |
| P1 | `windowman-concierge` | OPTIONS smoke + rate-limit review before acquisition traffic |
| P1 | `capture-power-tool-demo-lead` | PowerToolDemo progressive capture smoke on V2 |
| P2 | Cron family | `refresh-benchmarks`, `lead-reactivation`, `process-webhook`, `contractor-send-followups` with correct `x-cron-secret` |
| P2 | Contractor JWT family | `list-contractor-opportunities`, `unlock-lead`, `partner-update-disposition` |
| P2 | Dev-only | `dev-report-unlock`, `dev-create-quote-scenario` with bypass enabled on staging only |

---

## 8. Open Questions

1. ~~**Live deploy matrix:**~~ **Refreshed 2026-06-11** on forensic V2 — see [§ Live Deployment Matrix](#live-deployment-matrix). Staging: 36/55 inventoried local functions, 0 ghosts (`summarize-row` retired 2026-06-11); Production: 52/52 (2026-05-26; re-list recommended). `quote-intelligence-worker` is inventory-only and NOT_DEPLOYED.
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
- **Purpose:** RLS-safe TruthGate lead capture; owns consent-gated OpenAI Ads `lead_created` only after a newly persisted lead.
- **Category:** homeowner public · **Auth:** app-logic
- **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; optional OpenAI Ads runtime config `OPENAI_ADS_PIXEL_ID`, server-only `OPENAI_ADS_CONVERSIONS_API_KEY`, `OPENAI_ADS_SITE_ORIGIN`
- **Tables:** `leads`, `event_logs` · **Callers:** `TruthGateFlow.tsx`
- **OpenAI Ads contract:** fixed `lead_created`; server ID returned only on new `source=truth-gate` insert; consent-gated `oppref`/`obref`; trusted origin+path `source_url`; normalized SHA-256 email; no phone data; `EdgeRuntime.waitUntil` + bounded timeout; reused/failed paths are silent.

### `capture-power-tool-demo-lead`
- **Purpose:** Public homeowner/demo lead capture for PowerToolDemo (no-quote / pre-estimate path).
- **Category:** homeowner public · **Auth:** `verify_jwt=false` · app-logic via `session_id` + `source=power-tool-demo`
- **Actions:** `create`, `update_zip`, `update_phone`, `update_intake` (progressive capture)
- **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Tables:** `leads` only (best-effort `event_logs` audit)
- **Source discriminator:** `power-tool-demo` (must not collide with TruthGate `truth-gate` leads)
- **Forbidden writes:** OTP fields, `phone_verified*`, `report_unlocked_at`, scan/analysis/quote fields, tracking/CAPI
- **PII logging:** banned (safe boolean flags only)
- **Callers:** `PowerToolDemo.tsx` (progressive capture via `create` / `update_zip` / `update_phone` / `update_intake`)
- **Deploy (V2):** ACTIVE v1 @ 2026-06-11 on `zgsofkgddpcntdvpckdq`

### `capture-quote-education-demo-lead`
- **Purpose:** Source-isolated public capture for the X-Ray, Quote Lens, and Quote Challenge SyntheticDemo experiences.
- **Category:** homeowner public · **Auth:** `verify_jwt=false` · app-logic via source-scoped `session_id` + `source=quote-education-demo`
- **Actions:** `create`, `update_zip`, `update_phone`, `update_intake` (progressive capture and same-lead NQ3/NQ4 handoff)
- **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Tables / RPC:** `leads`, `lead_events` (`quote_education_demo_submitted`), best-effort `event_logs` audit, and append-only consent via `persist_lead_consent_batch`.
- **Source discriminator:** `quote-education-demo`; server-owned variant, host-page, entry-point, and fixture metadata are stored in existing JSON fields.
- **Forbidden writes:** OTP fields, `phone_verified*`, `report_unlocked_at`, scan/analysis/quote fields, external tracking/CAPI
- **Rate limit:** temporarily matches the classic public demo endpoint (no custom limiter); shared limiter tracked as a P1 follow-up.
- **Deploy (staging):** ACTIVE v1 @ 2026-09-10 11:11:52 UTC on `zgsofkgddpcntdvpckdq`; CORS `OPTIONS`, NQ3/NQ4 create + handoff, consent, and activity persistence smoke verified.

### `capture-arbitrage-lead`
- **Purpose:** Public homeowner ArbitrageEngine progressive lead capture (About-page arbitrage funnel).
- **Category:** homeowner public · **Auth:** `verify_jwt=false` · app-logic via `session_id` + `source=arbitrage-engine`; backend flag `ARBITRAGE_PROGRESSIVE_CAPTURE_ENABLED` (default off → safe `feature_disabled` 200 with no DB writes)
- **Actions:** `create`, `update_identity`, `update_call_intent`, `update_timeframe` (progressive capture)
- **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ARBITRAGE_PROGRESSIVE_CAPTURE_ENABLED`
- **Tables:** `leads` only (best-effort `event_logs` audit; non-PII)
- **Source discriminator:** `arbitrage-engine` (must not collide with `truth-gate` / `power-tool-demo` leads)
- **`event_id` / `external_id`:** stored only inside `qualification_answers_json.arbitrage`; never written to top-level `leads.event_id` / `leads.external_id`
- **Consent:** server-stamped evidence in `qualification_answers_json.consent` (`consent_version=arb_contact_v1`, SHA-256 of UI copy)
- **Forbidden writes:** OTP fields, `phone_verified_at`, `report_unlocked_at`, scan/analysis/quote fields, private storage, tracking/CAPI
- **PII logging:** banned (safe boolean flags + 8-char session prefix only)
- **Callers:** `src/components/arbitrageengine.tsx` via `src/lib/captureArbitrageLead.ts` (frontend flag `VITE_ARBITRAGE_PROGRESSIVE_CAPTURE`)
- **Deploy:** NOT_DEPLOYED — local implementation only; human-approved Edge Function deploy pending · **Smoke:** UNKNOWN

### `windowman-concierge`
- **Purpose:** Pre-login acquisition concierge — Gemini structured JSON routing chat (no scanner/OTP/report paths).
- **Category:** homeowner public · **Auth:** `verify_jwt=false` · app-logic (Zod only; no DB)
- **Env:** `GEMINI_API_KEY`; optional `GEMINI_CONCIERGE_MODEL`, `GEMINI_MODEL`
- **Service role:** no · **Tables/RPCs:** none · **External:** Gemini API
- **PII:** user text sent to Gemini; server logs avoid raw PII; rate limit TODO in source
- **Callers:** none observed in `src/` · **Deploy (V2):** ACTIVE v6 @ 2026-05-28 · **Status:** NEEDS_SECURITY_REVIEW (rate limiting)

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
- **Category:** webhook · **Auth:** Meta GET verification uses `META_WEBHOOK_VERIFY_TOKEN`; native POST verifies `X-Hub-Signature-256` with `META_APP_SECRET`; the existing trusted importer still accepts `FACEBOOK_LEAD_AD_IMPORT_SECRET`
- **Callers:** Meta Page `leadgen` webhooks; existing trusted server-side importer
- **Retrieval:** the exact signed callback bytes are committed to `meta_webhook_receipts` before JSON parsing or acknowledgment; `process-meta-lead` parses each change independently, records bounded issue codes, then retrieves protected Graph data asynchronously using `META_PAGE_ACCESS_TOKEN`. The authenticated trusted-secret path remains synchronous.
- **Test mode:** `META_WEBHOOK_TEST_MODE` defaults to enabled unless explicitly set to `false`; test leads are marked `is_test` on initial persistence and cannot enqueue outbound jobs
- **Activation:** the migration prepares, but does not run, Vault-backed worker schedules. Deploy functions, approve one form destination and its consent rules, verify test events, then explicitly activate schedules and enable outbound flags. No deployment is asserted by this manifest edit.

### `lead-reactivation` / `refresh-benchmarks`
- **Category:** cron · **Auth:** `x-cron-secret` · **Callers:** none

### `list-contractor-opportunities` / `unlock-lead` / `partner-update-disposition` / `save-routing-preferences`
- **Category:** contractor · **Auth:** JWT+role · **Callers:** see inventory table

### `persist-diagnosis-start` / `update-homeowner-context`
- **Category:** homeowner public · **Auth:** app-logic (service-role writers)
- **Callers:** PostScan / PropertyAndConsent components

### `submit-diagnosis-intake`
- **Category:** homeowner public · **Auth:** app-logic (service-role writers)
- **Callers:** `src/pages/diagnosis/hooks/useDiagnosticIntake.ts` only
- **Canonical event:** `callback_requested` (Meta `Contact`)
- **Callback grain:** one `voice_followups` row per `scan_session_id` for `general_callback` + `diagnosis_final_cta`; the same scan reuses the row and never invokes `PHONECALL_BOT_WEBHOOK_URL` again
- **Conversion grain:** one session-stable `callback_requested` event / Meta row per scan; event id `wmc_callback_requested_lead-{leadId}_scan-{scanSessionId}`; existing dispatch rows are never reset to `pending`
- **Intake idempotency:** `diagnosis_submission_id` remains the questionnaire retry key only; a new id on the same scan may create another `diagnosis_intakes` row but not another call or Contact
- **Identity:** `scan_session_id` → server-derived `lead_id` + verified phone binding
- **Consent:** latest `lead_consent_events.purpose = marketing_communications`
- **Durable success boundary:** `diagnosis_intakes` + `voice_followups` + `wm_event_log` + Meta `wm_platform_dispatch_log`
- **Call cadence:** WindowMan queues one request. The phone-agent product owns the initial call, no-answer retries at approximately 30 minutes / 2 hours, and stop rules; no cadence, cron, or extra attempt rows are scheduled here.
- **Note:** Diagnosis CTA does **not** invoke `request-callback`. `request-callback` remains a separate, unchanged path for Estimate / PostScan / ReportClassic callers; its deployment status was not revalidated in this local-only sprint.

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
