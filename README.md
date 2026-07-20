<<<<<<< HEAD
# WindowMan MVP

**Audit baseline:** `forensic_report_v2` at commit `3edfc6dd89fc1db3116f77277a82e8be4ed35bb7`  
**Repository:** `https://github.com/Mongoloyd/wm-mvp`  
**Audit date:** `2026-07-20`

WindowMan MVP is a consumer quote-intelligence platform that protects homeowners from overpaying on window replacement estimates. It is implemented as a React/Vite single-page application backed by Supabase Database, Storage, Auth, and Deno Edge Functions.

The core product flow captures quote-owner intake, uploads a quote file to a private Supabase Storage bucket, creates a scan session, runs a server-side quote scan, stores preview and full report payloads in `public.analyses`, renders a preview report, and unlocks the full report only after server-recorded SMS OTP verification.

The scanner sends uploaded quote content to Gemini for structured extraction, then computes scores, grades, hard caps, flags, derived financial metrics, preview JSON, and full report JSON in deterministic TypeScript code.
=======
# WindowMAN

> "WindowMan is a forensic quote-intelligence platform that audits residential window estimates against localized market data, exposing price gaps and routing high-intent, verified homeowners to a vetted contractor network.

WindowMan is a tool designed to help homeowners who are buying new windows. When a homeowner receives a price estimate from a window company, they upload it to the platform. The system then acts like a financial detective to see if the price is actually fair.

Building from there
The platform works in three simple steps. First, it reads the estimate line by line. Second, it compares those numbers to actual market prices in the homeowner's specific zip code or city. Third, it points out exactly where the homeowner is being overcharged. Once the homeowner sees the truth about their quote, WindowMan connects them with a trusted, pre-approved contractor who can offer a fair deal.

Key insights
The key insight is that everyday buyers lack the data to know if a window quote is a ripoff. By providing instant, localized data, the platform shifts the power back to the buyer and turns a confused shopper into a highly motivated customer for the partner contractor.

Common misconceptions
A common misconception is that WindowMan manufactures or installs windows. It does not. It is strictly a software platform and a matchmaker that sits between the buyer and the installer.

Why this matters
Replacing windows is a major home expense, and the industry is known for confusing contracts and hidden markups. This tool protects consumers from predatory pricing while rewarding honest, local contractors with high-quality leads.

Check your understanding
You'll know you understand when you can explain that WindowMan's main product is not the windows themselves, but rather the transparency and trust it provides to the transaction.

**Grounded in `forensic_report_v2` at commit `a83283a7cc0162eaaeaacad189691ad805aba81a`.**

The repository implements a browser-based acquisition and report-reveal funnel backed by Supabase Postgres, private Storage, and Deno Edge Functions. Homeowners upload quote files, receive a backend-gated preview, verify by SMS OTP, and only then receive authorized full report data. Deterministic TypeScript scoring runs server-side; Gemini is used for document extraction only.

---

## README Purpose and Authority

This README is a **derived, commit-pinned onboarding map** for developers, operators, security reviewers, and AI coding agents.

| Audience | Use this README to… |
|---|---|
| Developers | Find entry points, run commands, trace call chains, avoid unsafe edits |
| Operators | Understand runtime boundaries, env contracts, and what is frozen vs active |
| Security reviewers | Locate authorization gates, private assets, and service-role boundaries |
| AI agents | Ground changes in executable evidence rather than speculative docs |

**Authority order:**

1. Executable code, SQL migrations, runtime configuration, and generated types at the pinned SHA
2. Commands actually executed during this audit (labeled separately)
3. This README

This README is **not** a product roadmap, marketing deck, deployment-state oracle, or substitute for migrations or Edge Function contracts. Speculative or historical markdown elsewhere in the repo is not represented here as implementation.

Deployed production behavior is **(unknown from repository evidence)** unless independently verified outside this audit.
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Quick Navigation

<<<<<<< HEAD
| Section | Purpose |
|---|---|
| [Current Repository Reality](#current-repository-reality) | Pinned repo, branch, route, table, runtime, and package-manager facts |
| [Implemented Product Flow](#implemented-product-flow) | End-to-end quote upload, scan, preview, OTP, and full reveal sequence |
| [Architecture](#architecture) | System-level Mermaid diagram |
| [Core Stack](#core-stack) | Verified technology stack and runtime roles |
| [Repository Layout](#repository-layout) | Major source directories and responsibilities |
| [Routing](#routing) | Public, authenticated, redirect, dev, sandbox, and visual QA routes |
| [Canonical Data Flow](#canonical-data-flow) | Intake, upload, scan, extraction, scoring, persistence, preview, OTP, and full retrieval |
| [Report Access and Security Contract](#report-access-and-security-contract) | Verify-to-Reveal rules and backend authorization boundaries |
| [Supabase Architecture](#supabase-architecture) | Tables, RPCs, private storage buckets, and config mismatches |
| [Edge Function Inventory](#edge-function-inventory) | Edge Functions grouped by product area |
| [AI and Deterministic Analysis Boundary](#ai-and-deterministic-analysis-boundary) | Gemini extraction vs deterministic TypeScript scoring |
| [Tracking and External Integrations](#tracking-and-external-integrations) | Browser/server integrations and verified call paths |
| [Environment Configuration](#environment-configuration) | Browser-visible, server-only, and test/dev variables |
| [Local Development](#local-development) | Verified local setup constraints and startup commands |
| [Available Commands](#available-commands) | `package.json` command surface and prerequisites |
| [Testing](#testing) | Static test inventory, frameworks, and audit execution status |
| [Deployment and Runtime Boundaries](#deployment-and-runtime-boundaries) | SPA fallback, Deno runtime, service-role isolation, CI, and external dependencies |
| [Common Failure Modes](#common-failure-modes) | Known evidence-backed failure causes |
| [Commonly Misidentified Technologies](#commonly-misidentified-technologies) | Technologies and assumptions absent from this pinned tree |
| [Change-Safety Boundaries](#change-safety-boundaries) | High-blast-radius files and invariants |
| [Evidence and Audit Notes](#evidence-and-audit-notes) | Audit method, source paths, limitations, and material unknowns |
| [Operating Principles](#operating-principles) | Non-negotiable architecture and security rules |
=======
- [Current Repository Reality](#current-repository-reality)
- [Implemented Product Flow](#implemented-product-flow)
- [Architecture](#architecture)
- [Core Stack](#core-stack)
- [Repository Layout](#repository-layout)
- [Routing](#routing)
- [Canonical Data Flow](#canonical-data-flow)
- [Report Access and Security Contract](#report-access-and-security-contract)
- [Supabase Architecture](#supabase-architecture)
- [Edge Function Inventory](#edge-function-inventory)
- [AI and Deterministic Analysis Boundary](#ai-and-deterministic-analysis-boundary)
- [CRM, Lead Dispatch, and Disposition](#crm-lead-dispatch-and-disposition)
- [Tracking and External Integrations](#tracking-and-external-integrations)
- [Environment Configuration](#environment-configuration)
- [Local Development](#local-development)
- [Available Commands](#available-commands)
- [Testing](#testing)
- [Deployment and Runtime Boundaries](#deployment-and-runtime-boundaries)
- [Known Repository Inconsistencies](#known-repository-inconsistencies)
- [Common Failure Modes](#common-failure-modes)
- [Architectural Non-Assumptions](#architectural-non-assumptions)
- [Change-Safety Boundaries](#change-safety-boundaries)
- [README Maintenance Contract](#readme-maintenance-contract)
- [Evidence and Audit Notes](#evidence-and-audit-notes)
- [Operating Principles](#operating-principles)
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Current Repository Reality

<<<<<<< HEAD
| Item | Verified reality |
|---|---|
| Repository | `https://github.com/Mongoloyd/wm-mvp` |
| Audited branch | `forensic_report_v2` |
| Audited commit | `3edfc6dd89fc1db3116f77277a82e8be4ed35bb7` |
| Primary package manager | Mixed: `package-lock.json`, `bun.lock`, and `deno.lock` are present. `package.json` scripts are the canonical command surface; `predev`, `prebuild`, and `scanner:fixtures` require Bun commands. |
| Frontend dev URL | Vite config: `http://localhost:8080` via `server.host = "::"` and `server.port = 8080` |
| Playwright default URL | `http://localhost:5173` unless `PLAYWRIGHT_BASE_URL` or `BASE_URL` is set |
| Canonical report route | `/report/classic/:sessionId` |
| Compatibility redirects | `/report/:sessionId` redirects to `/report/classic/:sessionId`; several root dev aliases redirect to `/admin/*` only in `import.meta.env.DEV` |
| Primary report table | `public.analyses` |
| Legacy or compatibility report table | `public.quote_analyses` remains in migrations and is later RLS-hardened; no current full-report flow uses it as canonical storage |
| Dedicated reports table | Absent in migration table creation inventory |
| Report storage bucket | Supabase Storage bucket `quotes`, set `public = false` by migration |
| Frontend runtime | Browser React 18 + Vite + React Router |
| Edge Function runtime | Supabase Edge Functions on Deno, using `Deno.serve` and remote `esm.sh` imports |
=======
| Field | Value |
|---|---|
| Repository | `https://github.com/Mongoloyd/wm-mvp` |
| Audited ref | `forensic_report_v2` |
| Pinned SHA | `a83283a7cc0162eaaeaacad189691ad805aba81a` |
| Audit date | 2026-07-20 |
| Manifest size | 1,335 tracked files at pinned SHA |
| Frontend runtime | Vite 7 + React 18 + TypeScript 5.8 (`package.json`) |
| Edge runtime | Deno (Supabase Edge Functions under `supabase/functions/`) |
| Package manager evidence | Dual lockfiles: `package-lock.json` and `bun.lock`; scripts mix `npm`/`npx` and `bunx` |
| Frontend dev URL | `http://localhost:8080` (`vite.config.ts`: `server.port = 8080`) |
| Playwright default URL | `http://localhost:5173` unless `PLAYWRIGHT_BASE_URL` or `BASE_URL` is set (`playwright.config.ts`) — **does not match Vite dev port** |
| Canonical report route | `/report/classic/:sessionId` |
| Compatibility redirect | `/report/:sessionId` → `/report/classic/:sessionId` (`App.tsx`) |
| Canonical analysis table | `public.analyses` |
| Legacy analysis table | `public.quote_analyses` — present in schema/types; **not runtime-referenced** in application TypeScript at this SHA |
| Private quote storage bucket | `quotes` (private; anon INSERT/UPDATE allowed; anon SELECT removed) |
| Canonical reports table | **(absent)** — report payloads live on `analyses.preview_json` / `analyses.full_json` |
| Homeowner auth routes `/signin`, `/signup`, `/vault` | **(absent)** from `App.tsx` route table |
| Deployed state | **(unknown from repository evidence)** |
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Implemented Product Flow

<<<<<<< HEAD
1. A browser user enters the React SPA through public routes such as `/`, `/quote-check`, `/window-prices`, `/window-price-audit`, `/truth-report`, `/ai-demo`, `/estimate`, `/diagnosis`, `/nextdoor`, `/windowman`, or static content routes.

2. The application initializes a persistent lead ID and captures URL attribution before React renders in `src/main.tsx`.

3. Quote upload UI in `src/components/UploadZone.tsx` validates file size and MIME type client-side, then uploads to Supabase Storage bucket `quotes`.

4. The browser invokes `start-upload-scan-session`, which verifies the private storage object exists, resolves or creates `leads`, `quote_files`, and `scan_sessions`, and returns `scan_session_id`, `quote_file_id`, and `lead_id`.

5. The browser invokes `scan-quote` with the returned IDs. The function uses service-role Supabase access, downloads the uploaded file from `quotes`, calls Gemini unless a dev fixture bypass is active, validates extracted JSON, applies a classification gate, computes deterministic grades and report payloads, upserts `analyses`, and updates `scan_sessions.status` to `preview_ready`.

6. `/report/classic/:sessionId` fetches a preview through the `report-access` Edge Function and renders a partial report.

7. The full report path uses `send-otp` and `verify-otp`. Verification creates/updates `phone_verifications`, binds the phone verification to the scan session, updates `leads.phone_verified`, `leads.phone_e164`, and `leads.phone_verified_at`, and returns server-canonical event IDs.

8. After OTP verification, the frontend calls `report-access` in full mode with `scan_session_id` and server-canonical `phone_e164`. `report-access` calls `get_analysis_full`; unauthorized access returns a locked sentinel rather than `full_json`.

9. Full report rendering occurs only after authorized full data is returned. Browser `localStorage` stores a 24-hour per-scan resume record, but the resume path still re-calls the backend full gate.

### Incomplete or Alternative Flows

| Flow | Status |
|---|---|
| `/vault`, `/vault/upload`, `/vault/reports/:reportId` | Absent in top-level router at this commit |
| `/signin`, `/signup`, `/verify`, `/demo` | Absent in top-level router at this commit |
| Contractor/partner portal | Partially implemented under `/partner/*`, with guarded portal, opportunities, revenue, and dossier routes |
| Admin back office | Implemented under `/admin/*`, frontend-gated by session except in Vite dev mode, with backend role checks in admin Edge Functions |
| Visual QA routes | `/visual/report-preview`, `/visual/pre-upload-intake`, and `/visual/intake-preview` are production-reachable unlisted QA/mock surfaces |
| Sandbox/dev routes | `/dev/report-preview`, `/devtesting`, `/sandbox/report-preview`, `/sandbox/intake`, `/dialer`, `/settings`, `/partners`, and root admin-tab aliases are gated by `import.meta.env.DEV` |
=======
### Primary homeowner funnel (verified)

1. **Landing / acquisition** — `/` renders `src/pages/Index.tsx` with `TruthGateFlow`, optional contact capture, and upload/report states.
2. **Lead capture** — `capture-truth-gate-lead` Edge Function via `src/services/truthGateLeadCapture.ts` (and related capture services) creates/updates `leads` without setting `phone_verified`.
3. **Quote upload** — `src/components/UploadZone.tsx` uploads to private bucket `quotes`, then invokes `start-upload-scan-session` and `scan-quote`.
4. **Scan + analysis** — `scan-quote` downloads the private file, calls Gemini for extraction, runs deterministic scoring/flagging, persists to `analyses`, updates `scan_sessions`.
5. **Preview** — browser calls `report-access` mode `preview` → RPC `get_analysis_preview`; frontend strips/withholds sensitive fields (`useAnalysisData.ts`).
6. **OTP gate** — `usePhonePipeline("validate_and_send_otp")` → `send-otp` / `verify-otp` (Twilio Verify server-side).
7. **Full reveal** — after OTP, `fetchFull(phoneE164)` → `report-access` mode `full` → RPC `get_analysis_full` with strict scan-session + phone binding.
8. **Post-reveal actions** — contractor brief / callback requests via `generate-contractor-brief`, `request-callback`; partner disposition is separate admin/partner workflow.

### Alternate / parallel surfaces (verified)

| Surface | Route / module | Role |
|---|---|---|
| In-page homepage report | `PostScanReportSwitcher` on `/` | Dark V2 partial/full UI with OTP gate inline |
| Standalone classic report | `/report/classic/:sessionId` → `ReportClassic.tsx` | Same OTP + `useAnalysisData` pattern |
| Paid-search / LP landings | `/quote-check`, `/window-prices`, `/window-price-audit`, `/truth-report`, `/ai-demo`, `/lp/:slug` | Acquisition variants |
| Nextdoor presell | `/nextdoor` | Native-lead oriented landing |
| Diagnosis funnel | `/diagnosis`, `/estimate` | Separate intake paths with backend persistence functions |
| Admin operator console | `/admin/*` | Lead inbox, routing, dispatch inspection, OTP ops |
| Partner portal | `/partner/*` | Contractor login, opportunities, dossier, revenue |
| Visual / sandbox QA | `/visual/*`, `/sandbox/*` (dev-gated), `/admin/lab/*` | Mock-only or QA harnesses |

### Incomplete, frozen, or dev-only systems (verified)

| System | State at pinned SHA |
|---|---|
| Automatic CRM webhook delivery | **Frozen** by migration `20260716165508_atomic_phase0a_crm_freeze.sql` (`fire_crm_handoff` no-op; `claim_pending_deliveries` returns zero rows) |
| Google Ads conversion dispatch | **Dry-run only** in worker code |
| TikTok conversion dispatch | **Dry-run only** in worker code |
| `nextdoor-capi-event` Edge Function | Code present; **missing** from `supabase/config.toml` |
| `test:e2e:scanner-smoke` npm script | **Placeholder** (`echo "TODO: …"`) |
| Dev report unlock | `dev-report-unlock` + browser `localStorage` dev secret — **development-only** |
| Admin auth in dev | `AdminAuthGate` bypasses session checks when `import.meta.env.DEV` |
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Architecture

```mermaid
flowchart TD
<<<<<<< HEAD
  Browser[Browser React/Vite SPA] -->|upload file| Storage[Supabase Storage: private quotes bucket]
  Browser -->|invoke| StartFn[start-upload-scan-session Edge Function]
  StartFn -->|service role insert/reuse| DB[(Supabase Postgres)]
  StartFn -->|signed URL existence probe| Storage
  Browser -->|invoke scan_session_id| ScanFn[scan-quote Edge Function]
  ScanFn -->|download quote| Storage
  ScanFn -->|Gemini generateContent| Gemini[Google Gemini API]
  ScanFn -->|deterministic TS scoring, flags, metrics, compiler| Scanner[Scanner Brain modules]
  Scanner -->|upsert preview_json/full_json| DB
  Browser -->|preview mode| ReportAccess[report-access Edge Function]
  ReportAccess -->|get_analysis_preview| DB
  Browser -->|send/verify OTP| OTP[send-otp / verify-otp Edge Functions]
  OTP -->|Twilio Verify + DB verification state| Twilio[Twilio Verify]
  OTP -->|phone_verifications + leads verified state| DB
  Browser -->|full mode + phone_e164| ReportAccess
  ReportAccess -->|get_analysis_full strict scan/phone gate| Gate[Backend report-access gate]
  Gate -->|authorized full_json only| Browser
```

=======
  Browser["Browser SPA<br/>Vite + React"]
  GTM["window.dataLayer / GTM"]
  QuotesBucket["Storage: quotes<br/>(private)"]
  PG["Postgres + RLS/RPC"]
  EF_Scan["Edge: scan-quote"]
  EF_Start["Edge: start-upload-scan-session"]
  EF_OTP["Edge: send-otp / verify-otp"]
  EF_Report["Edge: report-access"]
  Gemini["Gemini API<br/>(extraction only)"]
  Twilio["Twilio Verify"]
  DispatchWorker["Edge: dispatch-platform-events"]
  CAPI["Edge: capi-event / tiktok / google-ads"]

  Browser -->|"upload file"| QuotesBucket
  Browser -->|"invoke"| EF_Start
  EF_Start --> PG
  Browser -->|"invoke"| EF_Scan
  EF_Scan -->|"download"| QuotesBucket
  EF_Scan --> Gemini
  EF_Scan -->|"deterministic score + persist"| PG
  Browser -->|"preview/full"| EF_Report
  EF_Report -->|"RPC get_analysis_*"| PG
  Browser -->|"OTP"| EF_OTP
  EF_OTP --> Twilio
  EF_OTP --> PG
  Browser --> GTM
  EF_OTP -->|"canonical events"| PG
  DispatchWorker --> CAPI
  DispatchWorker --> PG
```

Only relationships with executable call paths at the pinned SHA are shown. Deployed scheduling of workers/cron is **(unknown from repository evidence)**.

>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc
---

## Core Stack

<<<<<<< HEAD
| Area | Verified technology | Version source | Runtime role |
|---|---|---|---|
| Frontend framework | React, React DOM | `package.json` dependencies `react`, `react-dom` `^18.3.1` | Browser UI |
| Frontend build | Vite | `package.json` dependency `vite ^7.3.2`; `vite.config.ts` | Dev server and production build |
| Routing | `react-router-dom` | `package.json` dependency `^6.30.1`; `src/App.tsx` | SPA routing |
| Data fetching/state | TanStack Query, Zustand, React state | `package.json`; `src/App.tsx`; state modules | Browser state and cache |
| UI primitives | Radix UI, shadcn-style local components, Tailwind CSS, `lucide-react` | `package.json`, `tailwind.config.ts`, component imports | Browser UI |
| Supabase browser client | `@supabase/supabase-js` | `package.json` dependency `^2.99.2`; `src/integrations/supabase/client.ts` | Auth, Storage, Functions, direct RPCs |
| Edge Functions | Deno + Supabase JS | `deno.json`, function imports from `esm.sh/@supabase/supabase-js@2.49.x` | Server-side business logic |
| AI extraction | Google Gemini REST API | `scan-quote`, `compare-quotes`, `generate-negotiation-script`, `windowman-concierge` call `generativelanguage.googleapis.com` | Server-side extraction/generation |
| SMS OTP | Twilio Verify and optional Twilio Lookup | `send-otp`, `verify-otp`, `qualify-homepage-lead` | Server-side phone verification |
| Payments | Stripe | `deno.json`, `create-checkout-session`, `stripe-webhook`, `package.json` has no browser Stripe SDK | Server-side checkout/webhook |
| Email | Resend API | Edge Function environment lookups and call paths in follow-up/dispatch/email functions | Server-side email dispatch |
| E2E tests | Playwright | `package.json`, `playwright.config.ts` | Browser automation |
| Unit/component tests | Vitest + Testing Library + jsdom | `package.json`, `vitest.config.ts` | Frontend tests |
| Edge tests | Deno test files | `deno.json`, `supabase/functions/**/*.test.ts` | Edge/shared module tests |
=======
| Area | Technology | Version / evidence | Runtime role |
|---|---|---|---|
| UI framework | React | `^18.3.1` (`package.json`) | Browser SPA |
| Routing | React Router DOM | `^6.30.1` | Client routes/guards |
| Build tool | Vite | `^7.3.2` | Dev server, production bundle |
| Styling | Tailwind CSS + shadcn/Radix | `tailwindcss ^3.4.17`, Radix packages | UI components |
| Client state | Zustand, TanStack Query | `zustand ^5.0.12`, `@tanstack/react-query ^5.83.0` | Funnel + server-state |
| Database | Supabase Postgres | migrations under `supabase/migrations/` | Canonical persistence |
| Auth | Supabase Auth | `@supabase/supabase-js ^2.99.2` | Admin/partner sessions |
| Object storage | Supabase Storage | bucket `quotes` | Private quote files |
| Edge compute | Supabase Edge Functions (Deno) | 58 function entrypoints | Scanner, OTP, reveal proxy, dispatch |
| SMS OTP | Twilio Verify | `send-otp`, `verify-otp` | Phone verification gate |
| Document AI | Gemini | `GEMINI_API_KEY` in `scan-quote` | OCR/extraction only |
| Unit tests | Vitest | `^4.1.0` | Frontend/service tests |
| E2E tests | Playwright | `^1.57.0` | Browser flows |
| Edge lint/typecheck | Deno | CI workflows | Function static analysis |
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Repository Layout

<<<<<<< HEAD
| Path | Verified responsibility |
|---|---|
| `src/main.tsx` | Browser entrypoint; initializes lead ID and UTM capture, renders `App` |
| `src/App.tsx` | Top-level React Router declarations, providers, lazy-loaded route modules |
| `src/routes/` | Nested admin and partner routers; admin tab route helpers |
| `src/components/UploadZone.tsx` | Browser file validation, private storage upload, scan-session bootstrap, scan invocation |
| `src/hooks/useAnalysisData.ts` | Preview/full report fetch orchestration and browser resume logic |
| `src/hooks/usePhonePipeline.ts` | Browser OTP send/verify orchestration through service module |
| `src/services/reportService.ts` | Browser transport to `report-access`, `dev-report-unlock`, and `get_scan_status` |
| `src/services/phoneVerificationService.ts` | Browser transport to `send-otp` and `verify-otp` |
| `src/integrations/supabase/client.ts` | Browser Supabase client construction from `VITE_SUPABASE_*` variables |
| `supabase/functions/` | Deno Edge Functions and shared server modules |
| `supabase/functions/scan-quote/` | Scanner request validation, classification, deterministic scoring, flagging, report compilation |
| `supabase/functions/_shared/` | Shared Edge utilities for auth, metrics, tracking, CORS, OTP observability, CAPI routing |
| `supabase/migrations/` | Chronological Postgres, RLS, storage, RPC, and trigger migrations |
| `src/integrations/supabase/types.ts` | Generated Supabase TypeScript types; secondary schema evidence |
| `tests/` | Playwright specs and fixtures |
| `.github/workflows/` | CI guardrails for Deno functions and migration integrity |
| `public/_redirects` | SPA host fallback: `/* /index.html 200` |
=======
Architecturally important paths only:

| Path | Purpose |
|---|---|
| `src/App.tsx` | Top-level public/dev route table |
| `src/pages/Index.tsx` | Canonical homepage acquisition + inline report shell |
| `src/pages/ReportClassic.tsx` | Standalone classic report + OTP gate |
| `src/components/UploadZone.tsx` | Private upload, session bootstrap, scan invocation |
| `src/components/post-scan/PostScanReportSwitcher.tsx` | Homepage post-scan report renderer |
| `src/hooks/useAnalysisData.ts` | Preview/full fetch orchestration |
| `src/hooks/usePhonePipeline.ts` | OTP pipeline modes |
| `src/services/reportService.ts` | `report-access` / RPC transport |
| `src/services/phoneVerificationService.ts` | Sole browser OTP transport |
| `src/routes/AdminRoutes.tsx` | Nested admin routes + `AdminAuthGate` |
| `src/routes/PartnerRoutes.tsx` | Nested partner routes + `PartnerGuard` |
| `src/integrations/supabase/client.ts` | Browser Supabase client (publishable key only) |
| `src/integrations/supabase/types.ts` | Generated DB types (secondary schema evidence) |
| `src/lib/trackEvent.ts` | Operational telemetry → `event_logs` |
| `src/lib/trackConversion.ts`, `src/lib/tracking/` | Business events → `window.dataLayer` |
| `supabase/functions/scan-quote/` | Scanner brain orchestrator |
| `supabase/functions/report-access/` | Service-role reveal proxy |
| `supabase/functions/send-otp/`, `verify-otp/` | Twilio OTP |
| `supabase/functions/start-upload-scan-session/` | Upload/session bootstrap |
| `supabase/functions/dispatch-lead/` | CRM webhook dispatcher (queue frozen) |
| `supabase/functions/dispatch-platform-events/` | Paid-media dispatch worker entry |
| `supabase/migrations/` | Chronological schema/RPC/RLS source of truth |
| `supabase/config.toml` | Local function JWT settings (all listed functions `verify_jwt = false`) |
| `.github/workflows/` | CI guardrails (lint, typecheck, Deno checks, migration integrity) |
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Routing

<<<<<<< HEAD
### Public Production Routes

| Route | Component/module | Classification |
|---|---|---|
| `/` | `src/pages/Index.tsx` | Public production |
| `/quote-check` | `PricingSearchLanding` | Public production |
| `/window-prices` | `WindowPricesLanding` | Public production |
| `/window-price-audit` | `WindowPriceAuditLanding` | Public production |
| `/truth-report` | `TruthReportLanding` | Public production |
| `/ai-demo` | `AiDemoLanding` | Public production |
| `/lp/:slug` | `LandingPage` | Public production |
| `/estimate` | `Estimate` | Public production |
| `/diagnosis` | `Diagnosis` | Public production |
| `/report/classic/:sessionId` | `ReportClassic` | Public route with backend-gated full payload |
| `/contractors3` | `Contractors3` | Public production |
| `/about` | `About` inside `PublicLayout` | Public production |
| `/contact` | `Contact` inside `PublicLayout` | Public production |
| `/faq` | `FAQ` inside `PublicLayout` | Public production |
| `/privacy` | `Privacy` inside `PublicLayout` | Public production |
| `/terms` | `Terms` inside `PublicLayout` | Public production |
| `/disclaimer` | `Disclaimer` inside `PublicLayout` | Public production |
| `/how-we-beat-window-quotes` | `HowWeBeatWindowQuotes` inside `PublicLayout` | Public production |
| `/contractors` | `Contractors` inside `PublicLayout` | Public production |
| `/contractors2` | `Contractors2` inside `PublicLayout` | Public production |
| `/partner/login` | `ContractorLogin` | Public partner auth route |
| `/partner/join` | `ContractorLogin initialView="register"` | Public partner registration route |
| `/partner/reset-password` | `PartnerResetPassword` | Public partner auth route |
| `/partner/accept-invite` | `AcceptInvite` | Public invite route |
| `/partner/onboarding` | `ContractorOnboarding` | Public route in router; page behavior may call backend |
| `/nextdoor` | `NextdoorHome` | Public production |
| `/windowman` | `WindowManLanding` | Public production |

### Authenticated Production Routes

| Route | Guard | Notes |
|---|---|---|
| `/admin/*` except auth/health routes | `AdminAuthGate` frontend session gate; backend admin functions use shared role validation | `AdminAuthGate` bypasses in `import.meta.env.DEV`; production redirects anonymous users to `/admin/login` |
| `/admin/leads` | `AdminAuthGate` | Admin lead inbox |
| `/admin/leads/:id` | `AdminAuthGate` | Admin lead dossier |
| `/admin/leads/:id/report` | `AdminAuthGate` | Admin lead report |
| `/admin/lead-evidence` | `AdminAuthGate` | Admin evidence route |
| `/admin/settings` | `AdminAuthGate` | Admin settings |
| `/admin/partners` | `AdminAuthGate` | Admin partners |
| `/admin/lab/report-preview` | `AdminAuthGate` | Admin-gated lab route |
| `/admin/lab/devtesting` | `AdminAuthGate` | Admin-gated lab route |
| `/admin/:tab` | `AdminAuthGate` plus `isAdminDashboardTab` | Dynamic admin dashboard tab route |
| `/partner/portal` | `PartnerGuard` | Requires Supabase session and active `contractor_profiles` row |
| `/partner/opportunities` | `PartnerGuard` | Partner opportunities |
| `/partner/revenue` | `PartnerGuard` | Partner revenue dashboard |
| `/partner/dossier/:id?` | `PartnerGuard` | Partner dossier |

### Redirect and Compatibility Routes

| Route | Behavior |
|---|---|
| `/report/:sessionId` | Redirects to `/report/classic/:sessionId` |
| `/admin` | Redirects to `/admin/leads` after `AdminAuthGate` |
| `/dialer` | In dev mode only, redirects to `/admin/dialer` |
| `/settings` | In dev mode only, redirects to `/admin/settings` |
| `/partners` | In dev mode only, redirects to `/admin/partners` |
| `/:devAdminAlias` | In dev mode only, redirects to `/admin/:devAdminAlias` when alias is a valid admin tab and not denylisted |

### Development, Sandbox, and Visual QA Routes

| Route | Gate | Classification |
|---|---|---|
| `/visual/report-preview` | None in router | Visual QA/mock route, production-reachable |
| `/visual/pre-upload-intake` | None in router | Visual QA/mock route, production-reachable |
| `/visual/intake-preview` | None in router | Visual QA/mock route, production-reachable |
| `/dev/report-preview` | `import.meta.env.DEV` | Development-only |
| `/devtesting` | `import.meta.env.DEV` | Development-only |
| `/sandbox/report-preview` | `import.meta.env.DEV` | Sandbox visual QA |
| `/sandbox/intake` | `import.meta.env.DEV` | Sandbox visual QA |
| `*` | `NotFound` | Fallback |
=======
Route classification is from executable router composition at the pinned SHA. **Production-eligible** means not gated by `import.meta.env.DEV` in inspected routing code. It does **not** prove deployment.

### Public production-eligible

| Path | Component / behavior |
|---|---|
| `/` | `Index` |
| `/quote-check` | `PricingSearchLanding` |
| `/window-prices` | `WindowPricesLanding` |
| `/window-price-audit` | `WindowPriceAuditLanding` |
| `/truth-report` | `TruthReportLanding` |
| `/ai-demo` | `AiDemoLanding` |
| `/lp/:slug` | `LandingPage` |
| `/estimate` | `Estimate` |
| `/diagnosis` | `Diagnosis` |
| `/report/classic/:sessionId` | `ReportClassic` |
| `/visual/report-preview` | `DevReportPreview` (mock QA; unlisted) |
| `/visual/pre-upload-intake` | `VisualPreUploadIntake` |
| `/visual/intake-preview` | `WindowManIntakePreview` |
| `/contractors3` | `Contractors3` |
| `/about`, `/contact`, `/faq`, `/privacy`, `/terms`, `/disclaimer`, `/how-we-beat-window-quotes`, `/contractors`, `/contractors2` | Static pages via `PublicLayout` |
| `/nextdoor` | `NextdoorHome` |
| `/windowman` | `WindowManLanding` |
| `/admin/login`, `/admin/forgot-password`, `/admin/reset-password`, `/admin/health` | Public admin auth/health |
| `/partner/login`, `/partner/join`, `/partner/reset-password`, `/partner/accept-invite` | Public partner auth/invite |

### Authenticated / guarded production-eligible

| Path | Guard | Notes |
|---|---|---|
| `/admin/*` (except public auth/health above) | `AdminAuthGate` | Production requires Supabase session; **DEV bypasses gate entirely** |
| `/admin/settings`, `/admin/partners` | `AdminAuthGate` + page-level `AuthGuard` | Double guard |
| `/partner/portal`, `/partner/opportunities`, `/partner/revenue`, `/partner/dossier/:id?` | `PartnerGuard` via layout | Requires auth + active `contractor_profiles` row |
| `/partner/onboarding` | `PartnerGuard` inside page export | Route element itself is public |

### Compatibility / redirect

| Path | Target |
|---|---|
| `/report/:sessionId` | `/report/classic/:sessionId` |

### Development-only (`import.meta.env.DEV`)

| Path | Behavior |
|---|---|
| `/dev/report-preview` | `DevReportPreview` |
| `/devtesting` | `DevTesting` |
| `/dialer` | redirect → `/admin/dialer` |
| `/settings` | redirect → `/admin/settings` |
| `/partners` | redirect → `/admin/partners` |
| `/:devAdminAlias` | redirect → `/admin/:devAdminAlias` when alias is valid admin tab |
| `/sandbox/report-preview` | `DevReportPreview` |
| `/sandbox/intake` | `PreUploadIntake` |

### Sandbox / visual QA

| Path | Gate |
|---|---|
| `/visual/*` | Always routed; mock/QA harness |
| `/admin/lab/report-preview`, `/admin/lab/devtesting` | Behind `AdminAuthGate` in production |

### Fallback

| Path | Component |
|---|---|
| `*` | `NotFound` |
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Canonical Data Flow

<<<<<<< HEAD
### Intake and Lead Capture

Implemented through several public services and functions, including `capture-truth-gate-lead`, `capture-power-tool-demo-lead`, `capture-arbitrage-lead`, `qualify-homepage-lead`, `submit-diagnosis-intake`, and attribution utilities.

`src/main.tsx` initializes `getLeadId()` and `captureUtmFromUrl()` before rendering.

### Upload and Storage

`src/components/UploadZone.tsx` accepts PDF/images up to 10 MB, writes to Supabase Storage bucket `quotes`, and uses deterministic storage paths from `src/components/uploadZone/storagePath.ts`.

### Scan-Session Creation

`UploadZone` invokes `start-upload-scan-session`.

The function validates a zod request contract, probes the private storage object through a signed URL, resolves or creates `leads`, `quote_files`, and `scan_sessions`, emits operational audit events to `event_logs`, and returns IDs.

### Document Processing

`UploadZone` invokes `scan-quote`.

The function validates the request via `scan-quote/requestSchema.ts`, handles stale session recovery via `sessionRecovery.ts`, sets `scan_sessions.status`, retrieves `quote_files.storage_path`, downloads from Storage bucket `quotes`, and enforces size/runtime limits from `_shared/scannerConfig.ts`.

### AI Extraction

`scan-quote` builds a Gemini `generateContent` URL through `_shared/scannerConfig.ts`, uses `GEMINI_API_KEY`, posts the uploaded file content to Gemini, normalizes returned text through `_shared/geminiJson.ts`, parses JSON, and validates the extraction shape before scoring.

### Deterministic Scoring

`scan-quote/scoring.ts` computes five pillar scores, weighted averages, letter grades, and hard caps.

`scan-quote/flagging.ts` computes flags.

`_shared/metrics.ts` computes deterministic derived financial metrics.

`scan-quote/reportCompiler.ts` compiles warnings, missing items, summaries, payment-risk, scope-gap, and price-per-opening fields.

### Persistence

`scan-quote` upserts `public.analyses` on `scan_session_id`, storing:

- `proof_of_read`
- `preview_json`
- `full_json`
- `grade`
- `flags`
- `confidence_score`
- `document_type`
- `rubric_version`
- derived scalar columns

It updates `leads` snapshot fields and appends `lead_events`.

### Preview Retrieval

`src/hooks/useAnalysisData.ts` calls `fetchAnalysisPreview`, which invokes `report-access` with:

```ts
{ mode: "preview", scan_session_id }
```

`report-access` calls `get_analysis_preview` and strips `full_json` defensively before returning data.

### OTP Verification

`src/hooks/usePhonePipeline.ts` calls `sendOtp()` and `verifyOtp()` from `src/services/phoneVerificationService.ts`.

`send-otp` validates US E.164 phone numbers, applies cooldown/window rate limits using `phone_verifications`, optionally calls Twilio Lookup, calls Twilio Verify, expires older pending rows, and inserts a pending row bound to `scan_session_id`.

`verify-otp` looks up a pending row bound to the requested scan session, calls Twilio `VerificationCheck` unless QA bypass is approved, updates `phone_verifications`, updates `leads`, and persists canonical events.

### Full Report Retrieval

`fetchAnalysisFull` invokes `report-access` with:

```ts
{ mode: "full", scan_session_id, phone_e164 }
```

`report-access` validates UUID and E.164 inputs and calls `get_analysis_full`.

The latest migration defines `get_analysis_full` to require a verified `phone_verifications` row whose `scan_session_id`, `lead_id`, and phone match the requested scan and lead, and requires `leads.phone_verified = true`.
=======
### 1. Intake / lead identity

- Browser session id + attribution captured in funnel state (`src/state/scanFunnel`, UTM helpers).
- Lead rows created/updated via Edge Functions such as `capture-truth-gate-lead`, `qualify-homepage-lead`, `ingest-native-lead`, and upload bootstrap in `start-upload-scan-session`.
- **`client_slug` must not be NULL** on lead creation paths inspected in capture/upload functions.
- Tables: `leads`, optional `lead_attribution_details`, `lead_events`, `lead_activity` spine (later migrations).

### 2. Private upload

- `UploadZone.tsx` builds deterministic storage path via `src/components/uploadZone/storagePath.ts`.
- File uploaded to **`quotes`** bucket (private).
- Browser does **not** receive durable signed read URLs for unrestricted quote browsing on the happy path.

### 3. Quote-file registration

- `start-upload-scan-session` validates storage path prefix, verifies object exists, upserts `quote_files`.

### 4. Scan session

- Same function upserts `scan_sessions` linked 1:1 to `quote_file_id`.
- Returns `{ scan_session_id, quote_file_id, lead_id }`.

### 5. Scanner invocation

- Browser invokes **`scan-quote`** with `scan_session_id`.
- Function loads session/file context from Postgres, downloads from `quotes`.

### 6. AI extraction

- Gemini HTTP call built in `supabase/functions/scan-quote/index.ts` using `supabase/functions/_shared/scannerConfig.ts`.
- Output normalized/parsed via `geminiJson.ts`; classification gate in `classificationGate.ts`.

### 7. Deterministic scoring / metrics / flags

- `supabase/functions/scan-quote/scoring.ts` — grade + pillar math.
- `flagging.ts` — red flags.
- `../_shared/metrics.ts` — derived financial metrics.
- `reportCompiler.ts` — preview/full payload assembly.

### 8. Persistence

- Upsert into **`analyses`** with `preview_json`, `full_json`, `grade`, `flags`, `analysis_status`, etc.
- Update `scan_sessions.status`.
- Legacy **`quote_analyses`** is not written by inspected runtime paths.

### 9. Preview retrieval

- `useAnalysisData` → `reportService.fetchAnalysisPreview` → Edge **`report-access`** `{ mode: "preview" }` → RPC **`get_analysis_preview`**.
- Frontend preview builder intentionally withholds full flag payloads/count reconstruction beyond allowed preview fields.

### 10. OTP

- `usePhonePipeline` → `phoneVerificationService.sendOtp` / `verifyOtp`.
- Edge functions persist **`phone_verifications`** bound to **`scan_session_id`**; update `leads.phone_verified*`.

### 11. Full authorization / reveal

- `fetchFull(phoneE164)` → **`report-access`** `{ mode: "full", phone_e164 }` → RPC **`get_analysis_full`**.
- DB function returns sentinel `grade = '__UNAUTHORIZED__'` when phone/session binding fails.
- Browser resume uses `localStorage` key `wm_verified_access` (24h TTL) only as a **resume hint**; backend still re-checks on fetch.

### 12. Downstream CRM / contractor actions (where verified)

- **Lead routing:** `admin-route-lead` → RPC `admin_route_lead_assignment`; UI in `src/services/leadAssignments.ts`.
- **Contractor opportunities:** `generate-contractor-brief` writes/reads `contractor_opportunities`.
- **Partner disposition:** `partner-update-disposition` updates `contractor_outcomes`, may emit canonical `sold`.
- **CRM webhook delivery:** `dispatch-lead` exists but queue claim path is frozen (see CRM section).
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Report Access and Security Contract

<<<<<<< HEAD
| Boundary | Verified backend behavior |
|---|---|
| Preview payload | `report-access` preview mode calls `get_analysis_preview`; response includes grade, flag counts, proof of read, preview JSON, confidence, document type, rubric version, and analysis ID. `full_json` is stripped before response. |
| Full payload | `report-access` full mode calls `get_analysis_full`; authorized rows include flags, `full_json`, proof_of_read, `preview_json`, confidence, document type, rubric version, and a curated `v2_source` projection when useful. |
| Unauthorized full request | `get_analysis_full` returns sentinel grade `__UNAUTHORIZED__`; `report-access` converts this to `{ authorized: false, locked: true, reason: "unauthorized" }`. |
| OTP binding | `send-otp` inserts `phone_verifications.scan_session_id`; `verify-otp` prefers scan-bound pending rows and updates the verified row with `lead_id` and `scan_session_id`; `get_analysis_full` enforces exact scan-session binding. |
| Browser resume | `src/lib/verifiedAccess.ts` stores one `localStorage` record with `scan_session_id`, `phone_e164`, `verified_at`, and `expires_at`. This is only a UX resume input; full data still comes from `report-access` and `get_analysis_full`. |
| Service-role boundary | Browser code uses `VITE_SUPABASE_URL` plus publishable/anon key. Service-role keys are read only in Edge Functions and scripts through `Deno.env.get` or `process.env`. |
| Dev full-report bypass | Browser bypass is possible only when `import.meta.env.DEV` and a local `wm_dev_secret` exists. Server bypass through `dev-report-unlock` requires `DEV_BYPASS_ENABLED === "true"` and a matching `DEV_BYPASS_SECRET`; otherwise it returns `404` or `403`. |
| Admin bypass | Shared `adminAuth.ts` accepts `x-dev-secret` only when `DEV_BYPASS_ENABLED === "true"` and `DEV_BYPASS_SECRET` matches; otherwise it validates a Bearer JWT and reads `user_roles`. |
| RLS and grants | Migrations enable RLS for sensitive tables including `analyses`, `phone_verifications`, `quote_analyses`, partner/dispatch tables, and tracking tables. Later migrations revoke destructive privileges from `anon` and `authenticated`. |
| Storage privacy | `quotes` bucket is updated to `public = false`; anonymous SELECT policy is dropped. Anonymous/authenticated INSERT and UPDATE policies exist for upload/upsert; table-level storage grants are restored so RLS can evaluate those writes. |
=======
### Preview access (allowed before OTP)

- Mode: `report-access` → `get_analysis_preview`.
- Returns redacted preview fields only; function and frontend both treat `full_json` as forbidden in preview mode.

### Full access (requires backend authorization)

- Mode: `report-access` → `get_analysis_full(p_scan_session_id, p_phone_e164)`.
- Authorization requires a **verified** `phone_verifications` row matching both phone and scan session, joined to consistent `scan_sessions` / `leads` verification state (migration `20260428120000_restore_get_analysis_full_strict_scan_binding.sql`).
- Unauthorized responses are `{ authorized: false, locked: true }`; not a silent preview fallback.

### What is **not** authorization

| Mechanism | Verdict |
|---|---|
| CSS hiding / locked overlays | UX only |
| Disabled buttons | UX only |
| React route visibility | UX only |
| `localStorage` (`wm_verified_access`, `wm_client_slug`, dev secret) | Resume/dev convenience only |
| `useReportAccess()` hook | Mirrors fetch state only |

### OTP binding rules (verified)

- `send-otp` stores pending verification with optional/required session binding.
- `verify-otp` rejects cross-session pending rows when a session id is supplied.
- One verified phone/session pair does **not** automatically authorize unrelated scan sessions unless backend RPC logic explicitly allows it (strict binding enforced in `get_analysis_full`).

### Dev bypass (development-only)

- Browser: `src/lib/devSecret.ts` (`localStorage.wm_dev_secret`) + `import.meta.env.DEV`.
- Server: `dev-report-unlock` checks `DEV_BYPASS_ENABLED` / `DEV_BYPASS_SECRET`.
- Valid production phone path always takes precedence over dev bypass in `useAnalysisData.ts`.

### Service-role boundary

- Browser client uses publishable/anon key only (`src/integrations/supabase/client.ts`).
- Gated RPCs (`get_analysis_preview`, `get_analysis_full`) are invoked **only** through service-role Edge Functions such as `report-access`.
- No browser exposure of `SUPABASE_SERVICE_ROLE_KEY` was found in frontend bundles.
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Supabase Architecture

<<<<<<< HEAD
### Important Current Tables

| Table | Role in implemented system | Runtime referenced |
|---|---|---|
| `leads` | Lead/contact/session identity, phone verification snapshot, attribution, latest scan/analysis snapshot | Yes |
| `quote_files` | Maps uploaded private storage path to a lead | Yes |
| `scan_sessions` | Scan lifecycle and report route key | Yes |
| `analyses` | Canonical report storage: proof, preview, full JSON, grade, flags, status | Yes |
| `phone_verifications` | OTP lifecycle and scan-bound full-report authorization | Yes |
| `event_logs` | Operational event telemetry | Yes |
| `lead_events` | Operational lead timeline | Yes |
| `contractor_opportunities` | Contractor intro/match request state hydrated by report page and Edge Functions | Yes |
| `voice_followups` | Callback/follow-up queue from report CTA paths | Yes |
| `contractor_profiles` | Partner route guard checks active partner state | Yes |
| `contractor_accounts`, `lead_assignments`, `lead_contact_releases`, `lead_contact_release_events` | Partner/syndicate lead routing and contact release surfaces | Yes |
| `wm_event_log` | Canonical server-side event persistence | Yes, through tracking shared modules |
| `platform_dispatch_outbox`, `platform_dispatch_attempts`, `client_platform_configs` | Conversion/platform dispatch control plane | Yes |
| `quote_analyses` | Legacy table from initial schema | Current but not canonical; later RLS-hardened |

### Important RPCs

| RPC | Role |
|---|---|
| `get_scan_status(uuid)` | Browser polling of scan session state |
| `get_analysis_preview(uuid)` | Preview report retrieval through `report-access` |
| `get_analysis_full(uuid, text)` | Full report retrieval with strict scan/phone verification binding |
| `get_lead_by_session(text)` | Lead resolution during upload bootstrap |
| `get_upload_retry_context(...)` | Upload retry rebind path from `UploadZone` |
| `get_rubric_stats(...)` | Rubric/admin stats hook |
| `get_county_by_scan_session(...)` | Report county display lookup; called through an untyped RPC in `ReportClassic` |
| `admin_*` RPCs | Admin dashboards, revenue dispatch, outcome integrity, dispatch outbox |
| `wm_claim_dispatch_rows`, `wm_claim_dispatch_rows_scoped` | Dispatch worker row claiming |
| `upsert_native_lead_with_attribution` | Native lead ingestion atomic RPC |
| `get_contractor_released_contact` | Partner contact release retrieval |

### Private Storage Buckets

| Bucket | Evidence |
|---|---|
| `quotes` | Created by initial migration; updated to `public = false`; used by `UploadZone`, `start-upload-scan-session`, and `scan-quote` |

### Function and Config Mismatches

| Mismatch | Evidence |
|---|---|
| `nextdoor-capi-event` | Has `supabase/functions/nextdoor-capi-event/index.ts` and call sites, but no `[functions.nextdoor-capi-event]` block in `supabase/config.toml` |
| Config blocks without entrypoint | Absent in the pinned comparison |

All functions listed in `supabase/config.toml` have `verify_jwt = false`.

This does not by itself prove they are unrestricted. Authorization is implemented inside individual function bodies where present, including admin JWT/role validation, dispatch secrets, native-lead secrets, import secrets, OTP state checks, and report RPC gates.
=======
### Important current tables (runtime-referenced)

| Table | Role |
|---|---|
| `leads` | Persistent lead identity, verification timestamps, attribution |
| `scan_sessions` | Per-scan identity linked to quote file |
| `quote_files` | Private storage pointer + status |
| `analyses` | Canonical analysis artifacts (`preview_json`, `full_json`, grade, flags) |
| `phone_verifications` | OTP lifecycle + scan binding |
| `event_logs` | Operational telemetry (anon insert policy) |
| `wm_event_log` | Canonical business/conversion ledger |
| `wm_platform_dispatch_log` | Paid-media dispatch outbox |
| `webhook_deliveries` / `webhook_delivery_attempts` | CRM delivery queue (frozen producer/claim) |
| `lead_assignments` | Admin routing assignments |
| `contractor_profiles`, `contractors` | Partner identity/marketplace records |
| `contractor_opportunities`, `contractor_outcomes` | Sales pipeline + disposition |
| `contractor_unlocked_leads`, `billable_intros` | Monetization/unlock bridge |
| `user_roles` | Admin RBAC lookup |

### Important RPCs

| RPC | Access pattern |
|---|---|
| `get_scan_status` | Browser-safe polling |
| `get_scan_session_context`, `get_upload_retry_context`, `get_lead_context_for_session` | Browser-safe funnel hydration |
| `get_analysis_preview`, `get_analysis_full` | **Service-role / Edge only** |
| `get_lead_by_session` | Edge/bootstrap helpers |
| `admin_route_lead_assignment` | Admin Edge + UI |
| `claim_pending_deliveries` | Returns zero rows (CRM freeze) |
| `wm_claim_dispatch_rows` / scoped variant | Dispatch worker claim |
| `unlock_contractor_lead` | Contractor unlock Edge Function |

### Private storage

- Bucket: **`quotes`**
- Private (`public = false` after early migration)
- Anonymous upload path exists; anonymous read of objects is not policy-permitted.

### RLS / grants (high level)

- Many sensitive tables moved to service-role-only access in late migrations (e.g. `20260518140000_enable_rls_revoke_client_access_service_only_tables.sql`).
- `event_logs` allows anonymous INSERT for telemetry; not a substitute for conversion truth.
- SECURITY DEFINER functions implement reveal, routing, dispatch claim, and admin operations.

### Legacy / compatibility schema objects

| Object | Status at SHA |
|---|---|
| `quote_analyses` | Legacy table retained; service-role policies; **no app runtime reads/writes** |
| `public.profiles` | **(absent)** — use `contractor_profiles` |
| `public.reports` | **(absent)** |
| `/vault/*` route strings | Appear in tests/tracking fixtures only; **no browser routes** |

### Function/config mismatches

| Issue | Detail |
|---|---|
| `nextdoor-capi-event` | Has `index.ts`; **no** `[functions.nextdoor-capi-event]` block in `supabase/config.toml` |
| All configured functions | `verify_jwt = false` in `config.toml` — **does not imply public access**; each function performs its own auth (secrets, service-role internal calls, admin session checks, etc.) |
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Edge Function Inventory

<<<<<<< HEAD
### Scan and Report

| Function | Responsibility | Authorization notes |
|---|---|---|
| `start-upload-scan-session` | Service-role bootstrap for `leads`, `quote_files`, `scan_sessions`; private storage object probe | `verify_jwt = false`; validates request; optional `ENFORCE_CONTACT_OWNED_UPLOAD`; service-role transport bypass only with exact service-role bearer |
| `scan-quote` | Private file download, Gemini extraction, classification, deterministic scoring, persistence | `verify_jwt = false`; validates scan/session IDs and service-role DB state |
| `report-access` | Preview/full report proxy over service-role-only RPCs | `verify_jwt = false`; preview is public by scan UUID; full requires `get_analysis_full` authorization |
| `dev-report-unlock` | Dev/design full-report bypass | Disabled unless `DEV_BYPASS_ENABLED === "true"` and secret matches |
| `dev-create-quote-scenario` | Dev scenario generation | Uses `DEV_BYPASS_SECRET` |
| `compare-quotes` | Gemini-assisted comparison path | Calls Gemini and Supabase service role |
| `generate-negotiation-script` | Gemini-assisted script generation | Calls Gemini and Supabase service role |
| `calculate-estimate-metrics` | Estimate metric calculation | Registered with `verify_jwt = false` |

### OTP and Access

| Function | Responsibility |
|---|---|
| `send-otp` | Normalize/validate phone, optional Twilio Lookup, rate limit, Twilio Verify send, insert pending verification |
| `verify-otp` | Twilio `VerificationCheck` or QA bypass, scan-bound pending row lookup, persist verified state, update lead |
| `unlock-lead` | Contractor credit/lead unlock path |
| `accept-invite` | Partner invitation acceptance |

### Lead Intake and Public Funnel

| Function | Responsibility |
|---|---|
| `capture-truth-gate-lead` | Public lead capture |
| `capture-power-tool-demo-lead` | Public demo lead capture |
| `capture-arbitrage-lead` | Public arbitrage lead capture with optional progressive capture |
| `qualify-homepage-lead` | Homepage lead qualification and optional Twilio Lookup |
| `submit-diagnosis-intake` | Diagnosis intake persistence |
| `persist-diagnosis-start` | Diagnosis-start persistence |
| `update-homeowner-context` | Homeowner context updates |
| `request-callback` | Report/estimate callback request, writes follow-up/opportunity state |
| `request-partner-access` | Partner access request and email dispatch |

### Admin

| Function | Responsibility |
|---|---|
| `admin-data` | Large admin data API surface; imports shared admin auth |
| `admin-client-platform-config` | Client platform configuration |
| `admin-contractor-performance` | Contractor performance reporting |
| `admin-materialize-dispatch-outbox` | Dispatch outbox materialization |
| `admin-route-lead` | Lead routing |
| `admin-simulate-dispatch-attempt` | Dispatch simulation |
| `admin-sync-revenue-signals` | Revenue signal sync |

### Partner and Contractor

| Function | Responsibility |
|---|---|
| `generate-contractor-brief` | Requires report authorization through `get_analysis_full`, then builds opportunity/brief state |
| `contractor-actions` | Contractor action API |
| `contractor-submit-outcome` | Contractor outcome submission |
| `contractor-booking-confirmed` | Cron/secret-gated contractor booking update |
| `contractor-mark-no-show` | Cron/secret-gated no-show update |
| `contractor-send-followups` | Contractor follow-up sending with Resend |
| `contractor-performance-summary` | Contractor performance summary |
| `get-contractor-document-url` | Signed document access for contractor path |
| `get-contractor-dossier` | Contractor dossier retrieval |
| `list-contractor-opportunities` | Partner opportunity listing |
| `partner-update-disposition` | Partner disposition update |
| `save-routing-preferences` | Partner onboarding routing preferences |

### Tracking, Attribution, and Conversion

| Function | Responsibility |
|---|---|
| `capi-event` | Meta CAPI event endpoint |
| `tiktok-capi-event` | TikTok Events API endpoint |
| `google-ads-conversion-event` | Google Ads conversion dispatch endpoint |
| `dispatch-platform-events` | Dispatches platform events to Meta, Nextdoor, TikTok, and Google paths |
| `import-facebook-lead-ad` | Secret-gated Facebook lead ad import |
| `ingest-native-lead` | Secret-gated native lead ingestion |
| `dispatch-lead` | Lead dispatch and email/webhook behavior |
| `process-webhook` | Secret-gated webhook processing |
| `lead-reactivation` | Secret-gated reactivation email path |
| `refresh-benchmarks` | Secret-gated benchmark refresh |
| `qa-google-attribution-event` | QA helper for Google attribution |
| `windowman-concierge` | Gemini-backed concierge function |
| `voice-followup` | Voice follow-up webhook path |
| `dial-lead` | Phone-call bot webhook path |
| `enrich-lead` | Lead enrichment |
=======
58 functions with `index.ts` at the pinned SHA. Grouped by role:

### Scan / report

| Function | Authorization notes |
|---|---|
| `scan-quote` | Service-role internal; scans private `quotes` objects |
| `start-upload-scan-session` | Service-role bootstrap; optional contact-owned upload gate |
| `report-access` | Publicly invokable endpoint, but delegates to gated RPCs; no service key returned |
| `compare-quotes`, `calculate-estimate-metrics` | Service-role analysis helpers |
| `send-report-email` | Server-side email; requires mail secrets |
| `dev-report-unlock` | Dev secret gated |
| `dev-create-quote-scenario` | Dev/QA helper |

### OTP / access

| Function | Authorization notes |
|---|---|
| `send-otp` | Rate limits + Twilio; binds pending verification to scan session when provided |
| `verify-otp` | Twilio check + DB stamp + canonical events |

### Intake / lead capture

| Function | Notes |
|---|---|
| `capture-truth-gate-lead` | Primary browser lead capture |
| `capture-arbitrage-lead`, `capture-power-tool-demo-lead` | Alternate capture paths |
| `qualify-homepage-lead` | Homepage qualification |
| `persist-diagnosis-start`, `submit-diagnosis-intake` | Diagnosis funnel |
| `ingest-native-lead` | Shared-secret header; Nextdoor provider active |
| `import-facebook-lead-ad` | Shared-secret import |
| `enrich-lead`, `update-homeowner-context` | Lead enrichment/update |

### CRM / dispatch

| Function | Notes |
|---|---|
| `dispatch-lead` | `x-dispatch-secret`; queue claim **frozen empty** |
| `admin-route-lead` | Admin auth |
| `admin-materialize-dispatch-outbox`, `admin-simulate-dispatch-attempt` | Operator tooling |
| `send-contractor-handoff` | Handoff notifications |
| `process-webhook` | External webhook processor |

### Admin

| Function | Examples |
|---|---|
| `admin-data`, `admin-sync-revenue-signals`, `admin-contractor-performance`, `admin-client-platform-config` | Operator APIs |
| `dial-lead`, `unlock-lead`, `voice-followup`, `lead-reactivation` | Ops automation |

### Partner / contractor

| Function | Examples |
|---|---|
| `accept-invite`, `request-partner-access` | Partner onboarding |
| `list-contractor-opportunities`, `get-contractor-dossier`, `get-contractor-document-url` | Portal data |
| `contractor-actions`, `contractor-submit-outcome`, `partner-update-disposition` | Disposition + billing |
| `contractor-booking-confirmed`, `contractor-mark-no-show`, `contractor-send-followups` | Follow-up automation |
| `generate-contractor-brief`, `generate-negotiation-script`, `request-callback` | Homeowner/partner workflows |

### Tracking / conversion

| Function | Notes |
|---|---|
| `capi-event` | Internal Meta sender; called by dispatch worker |
| `tiktok-capi-event` | Internal; worker forces dry-run at SHA |
| `google-ads-conversion-event` | Dry-run only |
| `nextdoor-capi-event` | Present in code; config omission noted above |
| `dispatch-platform-events` | Worker entry; requires `DISPATCH_WORKER_SECRET` |
| `qa-google-attribution-event` | QA helper |

### Webhooks / external automation

| Function | Notes |
|---|---|
| `stripe-webhook` | Stripe signature verification |
| `create-checkout-session` | Stripe checkout |
| `refresh-benchmarks`, `contractor-send-followups`, `contractor-performance-summary` | Cron/secret gated jobs |

### Other

| Function | Notes |
|---|---|
| `windowman-concierge` | Gemini-backed concierge endpoint |
| `save-routing-preferences` | Routing prefs persistence |
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## AI and Deterministic Analysis Boundary

<<<<<<< HEAD
| Boundary | Verified implementation |
|---|---|
| Model input | `scan-quote` downloads the uploaded quote file from private Storage, converts it to a Gemini request part, and posts it to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with `GEMINI_API_KEY` |
| Model selection | `GEMINI_SCAN_MODEL` can override default scanner model in `_shared/scannerConfig.ts`; otherwise the configured default string is used |
| Model output | Gemini is expected to return JSON matching the extraction schema embedded in the prompt; `scan-quote` normalizes and parses returned text |
| Extraction validation | `validateExtraction` requires object shape, document type, boolean window/door relation, confidence `0..1`, and `line_items` with string descriptions |
| Classification | `classificationGate.ts` normalizes classification and can terminate scans as `invalid_document` or `needs_better_upload` |
| Grade assignment | `scan-quote/scoring.ts` computes pillar scores, weighted average, letter grade, and hard caps |
| Financial metrics | `_shared/metrics.ts` computes bucket totals, per-opening values, coverage, benchmarks, and diagnostics |
| Flags | `scan-quote/flagging.ts` computes red/amber/green-equivalent issue flags with severity strings |
| Preview payload | Built in `scan-quote/index.ts` from deterministic grade result, flags, compiled report, and proof-of-read |
| Full payload | Built in `scan-quote/index.ts` and includes grade, weighted average, hard cap, pillar scores, flags, raw extraction, derived metrics, warnings, missing items, summary, and risk booleans |
| Persistence | `scan-quote` upserts `public.analyses` with both `preview_json` and `full_json` |
| Provider behavior | Gemini model internals and extraction accuracy are unknown; only request/response handling and downstream deterministic processing are verified |
=======
| Stage | System | Module / function |
|---|---|---|
| Reads document bytes | Gemini via `scan-quote` | `index.ts` + `_shared/scannerConfig.ts` |
| Parses/normalizes model JSON | TypeScript validation | `geminiJson.ts`, extraction validators in `scan-quote` |
| Classifies readability/mismatch | TypeScript gate | `classificationGate.ts` |
| Calculates grades/pillars | Deterministic TS | `scoring.ts` |
| Detects flags | Deterministic TS | `flagging.ts` |
| Computes financial metrics | Deterministic TS | `_shared/metrics.ts` |
| Compiles preview/full payloads | Deterministic TS | `reportCompiler.ts` |
| Persists analysis | Edge orchestrator | upsert `analyses` in `scan-quote/index.ts` |
| Renders preview/full | Frontend | `useAnalysisData.ts` + report components |

**Verified rule at this SHA:** AI extracts evidence; TypeScript assigns scores/flags/grades; backend persists; frontend renders authorized payloads only.

The browser does **not** call Gemini directly.

---

## CRM, Lead Dispatch, and Disposition

Three layers must stay separate:

### Lead lifecycle (`leads`, `lead_events`, activity spine)

- Creation via capture/upload/diagnosis/native ingest functions.
- Verification state on `leads.phone_verified_at`.
- Admin disposition fields added in later migrations.

### Delivery / dispatch state (`webhook_deliveries`, `dispatch-lead`, routing RPCs)

- **Phase 0A freeze (latest relevant migration):**
  - `fire_crm_handoff()` trigger function is a no-op.
  - `claim_pending_deliveries()` returns zero rows.
  - Cron job `dispatch-lead-every-minute` unscheduled when present.
- `dispatch-lead` Edge Function remains in repo but cannot drain a queue at this schema state.

### Contractor sales outcome / disposition (`contractor_outcomes`, partner/admin tools)

- Partners update outcomes via `partner-update-disposition`.
- Operators intervene via `contractor-actions`.
- Sold signals may write canonical `sold` events to `wm_event_log` for measurement; not the same as CRM webhook delivery.

### Paid-media dispatch (separate system)

- Canonical events land in `wm_event_log` / `wm_platform_dispatch_log`.
- Worker: `dispatch-platform-events` → platform senders (`capi-event`, etc.).
- Scheduling/triggering in production: **(unknown from repository evidence)**.
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Tracking and External Integrations

<<<<<<< HEAD
| Integration | Verified call path | Browser/server |
|---|---|---|
| Supabase Auth | Browser client persists sessions; admin/partner gates call `supabase.auth`; Edge admin auth validates bearer tokens | Browser and server |
| Supabase Database | Browser direct queries for allowed state; Edge Functions use service-role for privileged paths | Browser and server |
| Supabase Storage | Browser uploads to `quotes`; Edge Functions create signed URLs and download private files | Browser and server |
| Gemini | `scan-quote`, `compare-quotes`, `generate-negotiation-script`, `windowman-concierge` | Server |
| Twilio Verify | `send-otp`, `verify-otp` | Server |
| Twilio Lookup | `send-otp` and `qualify-homepage-lead` when `TWILIO_LOOKUP_ENABLED === "true"` | Server |
| Meta Pixel | `src/lib/metaBrowserPixel.ts` injects `connect.facebook.net/en_US/fbevents.js` and calls `fbq("init")` / `fbq("track", "PageView")` when `VITE_META_PIXEL_ID` is configured and not placeholder | Browser |
| GTM/dataLayer | `src/lib/trackConversion.ts` pushes events to `window.dataLayer` | Browser |
| Meta CAPI | `capi-event`, `_shared/capiRouting.ts`, `dispatch-platform-events` | Server |
| TikTok Events API | `tiktok-capi-event`, `_shared/tiktokCapiRouting.ts`, `dispatch-platform-events` | Server |
| Nextdoor CAPI | `_shared/nextdoorCapiRouting.ts`, `dispatch-platform-events`, `nextdoor-capi-event` entrypoint | Server; config mismatch noted |
| Google Ads conversion | `google-ads-conversion-event`, `dispatch-platform-events` | Server |
| Stripe | `create-checkout-session`, `stripe-webhook` | Server |
| Resend | Contractor follow-up, dispatch, reactivation, partner access, handoff, report email functions | Server |
| Phone-call bot webhook | `dial-lead`, `request-callback`, `voice-followup` | Server |
| CRM webhook | `process-webhook` | Server |
| Lovable API | `dispatch-lead` | Server |
=======
### Browser measurement (business lane)

- GTM container **`GTM-K3M99HSM`** bootstrapped in `index.html`.
- Emitters: `src/lib/trackConversion.ts`, `src/lib/tracking/dataLayer.ts`, `AppTrackingProvider.tsx`.
- Meta browser pixel limited to PageView seeding (`src/lib/metaBrowserPixel.ts`).
- **No browser calls** to `capi-event`, `tiktok-capi-event`, or `google-ads-conversion-event`.

### Server conversion dispatch

- Producers: `verify-otp`, `scan-quote`, conditional `capture-truth-gate-lead`, `qualify-homepage-lead`, `partner-update-disposition`.
- Canonical writer: `supabase/functions/_shared/tracking/canonical/createCanonicalEvent.ts`.
- Worker sender: `dispatch-platform-events`.
- Meta live sender: `capi-event`.
- TikTok/Google: dry-run enforced in worker at this SHA.

### Operational telemetry

- `src/lib/trackEvent.ts` → `event_logs` (OTP errors, preview rendered, upload failures, etc.).
- Not equivalent to paid-media truth unless explicitly bridged by canonical pipeline.

### Communication APIs

| Provider | Path |
|---|---|
| Twilio Verify | `send-otp`, `verify-otp` |
| Resend email | `send-report-email`, contractor mailers |
| Stripe | `create-checkout-session`, `stripe-webhook` |

### Webhooks / native ingest

| Entry | Auth |
|---|---|
| `ingest-native-lead` | `NATIVE_LEAD_INGEST_SECRET` |
| `import-facebook-lead-ad` | import secret |
| `process-webhook` | cron/shared secret pattern |

### AI providers

| Provider | Where |
|---|---|
| Gemini | `scan-quote`, `windowman-concierge` |
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Environment Configuration

<<<<<<< HEAD
### Browser-Visible Configuration

Variables with `VITE_` are browser-exposed by Vite.

| Variable | Consuming modules | Purpose | Required status |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `src/integrations/supabase/client.ts`, admin services, session service | Supabase project URL for browser client and function URLs | Required for browser app startup; missing value throws |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `src/integrations/supabase/client.ts` | Preferred browser Supabase key | Required unless `VITE_SUPABASE_ANON_KEY` is present |
| `VITE_SUPABASE_ANON_KEY` | `src/integrations/supabase/client.ts`, session service | Fallback browser Supabase key | Required unless publishable key is present |
| `VITE_META_PIXEL_ID` | `src/lib/metaBrowserPixel.ts` | Browser Meta Pixel initialization | Optional; no-op when absent or placeholder |
| `VITE_AUTH_GUARD_DEV_BYPASS` | `src/components/auth/AuthGuard.tsx` | Dev-only auth guard bypass | Optional; only active with `import.meta.env.DEV` |
| `VITE_ENABLE_DARK_V2_HOMEPAGE` | `src/pages/Index.tsx` | Homepage report variant flag | Optional |
| `VITE_ARBITRAGE_PROGRESSIVE_CAPTURE` | `src/pages/About.tsx` | About-page capture behavior flag | Optional |
| `VITE_INTAKE_ROUTER_ENABLED` | `src/pages/About.tsx` | Intake routing feature flag | Optional |
| `VITE_NEXTDOOR_CAPI_ENABLED` | Browser tracking eligibility modules | Browser-side eligibility flag | Optional |
| `VITE_TIKTOK_CAPI_ENABLED` | Browser tracking eligibility modules | Browser-side eligibility flag | Optional |

### Server-Only Variables and Secrets

| Variable | Consuming subsystem | Purpose | Required status |
|---|---|---|---|
| `SUPABASE_URL` | Most Edge Functions | Supabase project URL | Required for service-role functions that construct clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Most privileged Edge Functions | Service-role DB/Storage access | Required for privileged Edge Function workflows |
| `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Admin/partner auth functions | User JWT validation client | Required for functions that validate user sessions |
| `GEMINI_API_KEY` | `scan-quote`, comparison/script/concierge functions | Gemini API access | Required for non-bypass AI workflows |
| `GEMINI_SCAN_MODEL` | `_shared/scannerConfig.ts` | Scanner model override | Optional |
| `GEMINI_SCAN_TIMEOUT_MS` | `_shared/scannerConfig.ts` | Scanner Gemini timeout override | Optional |
| `GEMINI_SCAN_MAX_OUTPUT_TOKENS` | `_shared/scannerConfig.ts` | Scanner output token budget override | Optional |
| `SCAN_STALE_PROCESSING_MINUTES` | `_shared/scannerConfig.ts` | Stale processing takeover threshold | Optional |
| `SCAN_MAX_FILE_BYTES` | `_shared/scannerConfig.ts` | Server-side max file bytes sent to scanner | Optional |
| `TWILIO_ACCOUNT_SID` | OTP and phone qualification | Twilio authentication | Required when Twilio send/verify/lookup paths run |
| `TWILIO_AUTH_TOKEN` | OTP and phone qualification | Twilio authentication | Required when Twilio send/verify/lookup paths run |
| `TWILIO_VERIFY_SERVICE_SID` | `send-otp`, `verify-otp` | Twilio Verify service | Required for real OTP |
| `TWILIO_LOOKUP_ENABLED` | `send-otp`, `qualify-homepage-lead` | Enables Twilio Lookup screening | Optional |
| `OTP_QA_BYPASS_ENABLED`, `OTP_QA_PHONE_E164`, `OTP_QA_CODE`, `OTP_QA_PROJECT_REF`, `WM_SUPABASE_PROJECT_REF` | OTP QA bypass helpers | Controlled OTP bypass | Conditional; only for QA bypass |
| `DEV_BYPASS_ENABLED`, `DEV_BYPASS_SECRET` | Admin auth, dev report unlock, dev quote scenario, scan dev bypass | Dev/staging bypass gate | Conditional |
| `ENFORCE_CONTACT_OWNED_UPLOAD` | `start-upload-scan-session` | Enforces contact-owned upload validation | Optional feature flag |
| `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE` | Meta CAPI routing/admin health | Meta server-side conversion dispatch | Conditional |
| `CAPI_DISPATCH_SECRET` | CAPI/Google dispatch | Dispatch secret | Conditional |
| `TIKTOK_ACCESS_TOKEN`, `TIKTOK_PIXEL_ID`, `TIKTOK_EVENT_SOURCE_ID`, `TIKTOK_TEST_EVENT_CODE`, `TIKTOK_EVENTS_API_ENDPOINT_URL`, `TIKTOK_CAPI_ENABLED` | TikTok dispatch | TikTok Events API | Conditional |
| `NEXTDOOR_CAPI_TOKEN`, `NEXTDOOR_DATA_SOURCE_ID`, `NEXTDOOR_CAPI_ENDPOINT_URL`, `NEXTDOOR_CAPI_ENABLED`, `NEXTDOOR_EVENT_SOURCE_URL` | Nextdoor dispatch | Nextdoor CAPI | Conditional |
| `GOOGLE_ADS_DISPATCH_AUTH_TOKEN`, `GOOGLE_ADS_DISPATCH_URL` | Google Ads dispatch | Google conversion dispatch | Conditional |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout and Stripe webhook | Stripe payments | Conditional |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `REPORT_FROM_EMAIL` | Email dispatch functions | Resend email sending | Conditional |
| `REPORT_BASE_URL` | Email/checkout/reactivation links | Report URL construction | Optional/conditional |
| `CONTRACTOR_CRON_SECRET`, `REACTIVATION_CRON_SECRET`, `BENCHMARK_CRON_SECRET`, `PROCESS_WEBHOOK_SECRET`, `DISPATCH_LEAD_SECRET` | Cron/webhook/dispatch functions | Shared-secret protection | Conditional |
| `FACEBOOK_LEAD_AD_IMPORT_SECRET` | `import-facebook-lead-ad` | Import endpoint secret | Required for import endpoint use |
| `NATIVE_LEAD_INGEST_SECRET` | `ingest-native-lead` | Native lead ingestion secret | Required for native lead endpoint use |
| `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET` | `process-webhook` | CRM webhook dispatch | Conditional |
| `PHONECALL_BOT_WEBHOOK_URL` | Dial/callback/voice functions | Phone-call bot integration | Conditional |
| `CONTRACTOR_EMAIL`, `CONTRACTOR_NAME` | Partner request/handoff functions | Contractor notification target/name | Conditional |
| `LOVABLE_API_KEY` | `dispatch-lead` | Lovable integration | Conditional |
| `QA_HELPER_ENABLED`, `QA_HELPER_SECRET`, `QA_HELPER_PROJECT_REF` | QA helper guard | QA helper access | Conditional |
| `WM_EDGE_DIAGNOSTICS`, `EDGE_DIAGNOSTICS` | Contractor dossier function | Edge diagnostics toggle | Optional |
| `WM_EVENT_SOURCE_URL` | Dispatch platform events | Event source URL | Optional |

### Development or Test-Only Configuration

| Variable | Consuming module | Purpose |
|---|---|---|
| `PLAYWRIGHT_BASE_URL`, `BASE_URL` | `playwright.config.ts`, E2E specs | Playwright target URL |
| `SITE_URL` | `scripts/generate-sitemap.ts` | Sitemap base URL; defaults to `https://windowman.app` |
| `CAPI_SMOKE_BASE_URL`, `CAPI_SMOKE_AUTH_TOKEN`, `CAPI_SMOKE_DISPATCH_SECRET` | `supabase/functions/capi-event/smoke_test.ts` | CAPI smoke test configuration |
| `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Tests and verification scripts | Test/admin helper configuration |
=======
Names and purposes only. **Never commit secret values.**

### Browser-visible (`import.meta.env` / `VITE_*`)

| Variable | Subsystem | Required? | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase client | **Required** | Project URL; missing throws in client bootstrap |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase client | **Required*** | Browser key (*or `VITE_SUPABASE_ANON_KEY` alias) |
| `VITE_SUPABASE_ANON_KEY` | Supabase client | Optional alias | Acceptable alternate publishable key name |
| `VITE_META_PIXEL_ID` | Meta pixel | Optional | Skips/init guards when absent/test id |
| `VITE_AUTH_GUARD_DEV_BYPASS` | AuthGuard | Optional | Dev-only bypass when `"true"` |
| `VITE_ENABLE_DARK_V2_HOMEPAGE` | Homepage resume | Optional | Enables Dark V2 return resume branch in `Index.tsx` |
| `VITE_ARBITRAGE_PROGRESSIVE_CAPTURE` | Feature flag | Optional | Progressive capture |
| `VITE_INTAKE_ROUTER_ENABLED` | Feature flag | Optional | Intake router |
| `VITE_NEXTDOOR_CAPI_ENABLED` | Dispatch eligibility | Optional | Nextdoor dispatch flag |
| `VITE_TIKTOK_CAPI_ENABLED` | Dispatch eligibility | Optional | TikTok dispatch flag |
| `DEV` | Vite built-in | Built-in | Dev routes/guards/bypass behavior |

`VITE_SUPABASE_PROJECT_ID` appears in `.env.example` but has **no runtime consumer** at this SHA.

### Server-only / Edge secrets (representative)

| Variable | Subsystem | Required when |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Most mutating/server paths |
| `SUPABASE_ANON_KEY` | Edge Functions | JWT validation paths |
| `GEMINI_API_KEY` | `scan-quote` | Scanning |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | OTP | Live SMS |
| `META_PIXEL_ID`, `META_CAPI_TOKEN` | Meta CAPI | Meta dispatch |
| `DISPATCH_WORKER_SECRET` | `dispatch-platform-events` | Worker auth |
| `DISPATCH_LEAD_SECRET` | `dispatch-lead` | CRM dispatcher auth |
| `DEV_BYPASS_ENABLED`, `DEV_BYPASS_SECRET` | Dev/admin bypass | Dev unlock/admin auth bypass |
| `NATIVE_LEAD_INGEST_SECRET` | Native ingest | External lead POST |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Billing | Checkout/webhooks |
| `RESEND_API_KEY` | Email | Mail senders |
| OTP QA vars (`OTP_QA_*`) | QA only | Non-production test bypass |

Full inventory exceeds 75 server-side names across Edge Functions; inspect with repository search on `Deno.env.get` when adding new functions.

### Development / test variables

| Variable | Used by |
|---|---|
| `PLAYWRIGHT_BASE_URL`, `BASE_URL` | Playwright |
| `SITE_URL` | `scripts/generate-sitemap.ts` |
| `SUPABASE_STAGING_DB_URL` | CI migration workflow optional smoke |
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Local Development

<<<<<<< HEAD
Prerequisites verified from manifests and scripts:

- Node/npm are supported by `package-lock.json` and `package.json` scripts.
- Bun is required by lifecycle scripts: `predev`, `prebuild`, and `scanner:fixtures`.
- Deno is required for Supabase Edge Function development/tests.
- Supabase CLI is present as a dev dependency named `supabase`.
- Playwright is present as a dev dependency.
- The repository does not define package scripts for database reset, migration apply, or Supabase local start.
- Do not assume `db:*` scripts exist.

```bash
git clone https://github.com/Mongoloyd/wm-mvp.git
cd wm-mvp
git checkout forensic_report_v2
git rev-parse HEAD
npm ci
npm run dev
```

Open:

```bash
http://localhost:8080
```

Optional local Supabase operations must use the installed Supabase CLI directly; no repository `package.json` script wraps them at this commit.
=======
Verified prerequisites implied by scripts and config:

- Node.js + npm (CI uses `npm ci`; some scripts call `bunx`)
- Optional: Bun (for `bunx tsx` predev/prebuild sitemap generation)
- Optional: Supabase CLI (for `typegen` script)
- Optional: Deno (Edge Function lint/typecheck/tests)
- Supabase project with Edge Functions deployed/secrets configured for end-to-end OTP/scan flows (**environment-specific**)

Sequential commands (from executable scripts only):

```bash
git checkout forensic_report_v2
git rev-parse HEAD   # expect a83283a7cc0162eaaeaacad189691ad805aba81a for this README snapshot

cp .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY)

npm ci
npm run dev          # predev runs: bunx tsx scripts/generate-sitemap.ts
                     # serves at http://localhost:8080
```

For Playwright against local dev, set:

```bash
set PLAYWRIGHT_BASE_URL=http://localhost:8080   # Windows
# or export PLAYWRIGHT_BASE_URL=http://localhost:8080
```

No package-level database reset/bootstrap command exists in `package.json`. Database setup is via Supabase migrations (`supabase/migrations/`) applied through your Supabase project workflow.
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Available Commands

<<<<<<< HEAD
| Command | Behavior | Prerequisites | Lifecycle side effects |
|---|---|---|---|
| `npm run dev` | Starts Vite dev server | npm deps plus Bun for `bunx` | Runs `predev`: `bunx tsx scripts/generate-sitemap.ts` |
| `npm run build` | Production Vite build | npm deps plus Bun for `bunx` | Runs `prebuild`: `bunx tsx scripts/generate-sitemap.ts` |
| `npm run build:dev` | Vite build with `--mode development` | npm deps | No explicit pre hook |
| `npm run lint` | `eslint .` | npm deps | None |
| `npm run preview` | `vite preview` | Built app and npm deps | None |
| `npm test` | `vitest run` | npm deps | None |
| `npm run test:watch` | Vitest watch mode | npm deps | None |
| `npm run test:critical` | Runs selected critical Vitest files | npm deps | None |
| `npm run test:all` | Runs `vitest run && npx supabase functions test` | npm deps, Supabase CLI, Deno/function test prerequisites | None |
| `npm run test:e2e:legacy-golden-thread` | Playwright test for `tests/golden-thread.spec.ts` | npm deps, browser install, dev server | Playwright config starts `npm run dev` |
| `npm run test:e2e:scanner-smoke` | Placeholder command that only echoes a scanner-smoke TODO string | Shell only | No implemented test |
| `npm run typecheck` | `tsc --noEmit` | npm deps | None |
| `npm run proof:pageview` | `vitest run --config vitest.proof.config.ts` | npm deps | None |
| `npm run typegen` | Generates Supabase TypeScript types into `src/integrations/supabase/types.ts` | Supabase CLI, network/project access | Writes generated types file |
| `npm run typegen:check` | Compares generated Supabase types to committed file | Supabase CLI, `diff`, network/project access | No intended write |
| `npm run scanner:fixtures` | Runs `bun run scripts/scanner-fixture-report.ts` | Bun | None |
=======
From `package.json` at pinned SHA:

| Script | Command | Lifecycle side effects | Notes |
|---|---|---|---|
| `predev` | `bunx tsx scripts/generate-sitemap.ts` | Runs automatically before `dev` | Requires Bun-compatible runner |
| `dev` | `vite` | After `predev` | Port 8080 |
| `prebuild` | `bunx tsx scripts/generate-sitemap.ts` | Runs automatically before `build` | |
| `build` | `vite build` | After `prebuild` | |
| `build:dev` | `vite build --mode development` | | |
| `preview` | `vite preview` | | |
| `lint` | `eslint .` | | |
| `typecheck` | `tsc --noEmit` | | |
| `test` | `vitest run` | | All Vitest unit/integration tests under `src/**` |
| `test:watch` | `vitest` | | |
| `test:critical` | vitest run on 5 critical files | | OTP/reveal/upload path |
| `test:all` | `vitest run && npx supabase functions test` | | Edge tests require Supabase CLI + Deno toolchain |
| `test:e2e:legacy-golden-thread` | `playwright test tests/golden-thread.spec.ts` | | |
| `test:e2e:scanner-smoke` | `echo "TODO: …"` | | **Placeholder only** |
| `proof:pageview` | `vitest run --config vitest.proof.config.ts` | | PageView dedupe proof |
| `typegen` | `npx supabase gen types typescript --project-id zgsofkgddpcntdvpckdq > src/integrations/supabase/types.ts` | | Writes generated types |
| `typegen:check` | pipes generated types to `diff` | | Unix `diff` dependency |
| `scanner:fixtures` | `bun run scripts/scanner-fixture-report.ts` | | Bun script |
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Testing

<<<<<<< HEAD
### Static Test Inventory

| Test surface | Inventory at pinned commit |
|---|---|
| Frontend Vitest files under `src/` | 84 `*.test.ts` / `*.test.tsx` files |
| Supabase Edge/shared Deno test files | 40 `*.test.ts` / `_test.ts` files |
| SQL smoke/test files | 9 `.sql` files under `supabase/tests` and `scripts/validation` |
| Playwright specs | 7 specs under `tests/` |
| Placeholder scripts | `test:e2e:scanner-smoke` only echoes a TODO string and is not an implemented test |

### Test Frameworks

| Framework | Config |
|---|---|
| Vitest | `vitest.config.ts`, jsdom, globals, setup file `src/test/setup.ts`, includes `src/**/*.{test,spec}.{ts,tsx}` |
| Playwright | `playwright.config.ts`, Chromium project, web server command `npm run dev`, default base URL `http://localhost:5173` |
| Deno | `deno.json`, `deno.lock`, CI workflows run `deno lint`, `deno fmt --check`, and `deno check` |
| Supabase SQL tests | `.sql` files exist; no package script directly runs those SQL files |

### Executed Results During This Audit

Not executed during this audit.

Reason: the user required no repository modification and all implementation inspection was pinned to Git object `3edfc6dd89fc1db3116f77277a82e8be4ed35bb7`. Installing dependencies or running package tests would use and potentially mutate the working tree rather than a separate pinned checkout.
=======
### Static inventory

| Kind | Count at SHA |
|---|---|
| `*.test.ts` | 88 |
| `*.spec.ts` | 7 |
| `*.test.tsx` | 31 (Vitest-eligible, not in `*.test.ts` count above) |
| Edge Function tests | Present under `supabase/functions/**` (run via Deno / `supabase functions test`) |

Frameworks: **Vitest** (frontend), **Playwright** (e2e), **Deno test** (selected Edge guardrails in CI).

### Executed during this audit (detached worktree at pinned SHA)

| Command | Exit | Result |
|---|---|---|
| `npm ci` | 0 | Dependencies installed in isolated worktree |
| `npm run typecheck` | 0 | Passed |
| `npm run test:critical` | 0 | **5 files, 106 tests passed** |
| `npm run build` | 0 | Production build succeeded |
| `npm run lint` | 1 | **410 problems (301 errors, 109 warnings)** |

### Not executed during this audit

- Full `npm run test`
- `npm run test:all`
- Playwright e2e suite
- Deno Edge Function tests (`deno test`, CI workflows)
- Supabase migration integrity workflow
- Runtime OTP/scan manual verification against a live Supabase project
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Deployment and Runtime Boundaries

<<<<<<< HEAD
| Boundary | Verified evidence |
|---|---|
| SPA fallback | `public/_redirects` contains `/* /index.html 200` |
| Browser runtime | Vite browser bundle; `import.meta.env.VITE_*` variables are browser-visible |
| Server runtime | Supabase Edge Functions use Deno APIs including `Deno.serve`, `Deno.env.get`, and Web Fetch |
| Supabase function JWT behavior | Every function block in `supabase/config.toml` has `verify_jwt = false`; in-function authorization must be reviewed per endpoint |
| Service-role isolation | Service-role key is read in Edge Functions and scripts, not in browser client code |
| Storage privacy | `quotes` bucket is private; browser uploads are allowed by Storage RLS policies; public reads are not provided by the final bucket policy state inspected |
| Build lifecycle | `dev` and `build` run sitemap generation first through Bun |
| CI | Workflows include Deno lint/format, Deno typecheck, CAPI/pageview/estimate guardrails, and manual migration integrity |
| External network dependencies | Gemini, Twilio, Meta, TikTok, Nextdoor, Google Ads, Stripe, Resend, CRM webhook, phone-call bot, Lovable, Supabase |
=======
| Boundary | Implementation evidence | Deployed state |
|---|---|---|
| Browser SPA | Vite build → static assets | **(unknown)** |
| Supabase Auth | Admin/partner sessions | **(unknown)** |
| Postgres + RPC/RLS | migrations + generated types | **(unknown)** |
| Storage `quotes` | private bucket policies | **(unknown)** |
| Edge Functions (Deno) | `supabase/functions/*` | **(unknown)** |
| Service-role credentials | Edge Functions only | Must never ship to browser |
| Twilio / Gemini / Stripe / Meta | External network from Edge | **(unknown)** |
| CRM webhook delivery | Code present; schema frozen | Automatic delivery **disabled at schema level** in repo |
| Dispatch worker cron | Unscheduled for CRM; platform worker trigger **(unknown)** | **(unknown)** |

Repository implementation proves capability exists in code/migrations; it does **not** prove which project/ref is live.

---

## Known Repository Inconsistencies

1. **Playwright base URL vs Vite port** — Playwright defaults to `:5173`; Vite serves `:8080`.
2. **`nextdoor-capi-event` config drift** — Function directory exists; missing from `supabase/config.toml`.
3. **Dark V2 homepage flag split** — `PostScanReportSwitcher.tsx` hardcodes `enableDarkV2Homepage = true`, while `Index.tsx` resume branch keys off `VITE_ENABLE_DARK_V2_HOMEPAGE === "true"`.
4. **Dual lockfiles / package managers** — Both `package-lock.json` and `bun.lock`; CI uses `npm ci` in one workflow and `bun install --frozen-lockfile` in another.
5. **`App.tsx` stale comment vs partner routing** — Comment says PartnerGuard removed; `PartnerRoutes.tsx` still wraps portal routes with `PartnerGuard`.
6. **`upsert_native_lead_with_attribution` RPC vs ingest implementation** — Migration adds RPC; `ingest-native-lead` still uses direct table writes at this SHA.
7. **`/vault/*` strings vs routing** — Appear in tracking/tests and Edge telemetry strings; no homeowner `/vault` routes in `App.tsx`.
8. **Generated types vs legacy tables** — `quote_analyses` remains in types/migrations but canonical runtime uses `analyses`.
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Common Failure Modes

<<<<<<< HEAD
| Failure | Evidence-backed cause |
|---|---|
| Browser app fails at startup | Missing `VITE_SUPABASE_URL` or missing both `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_ANON_KEY` throws in `src/integrations/supabase/client.ts` |
| `npm run dev` fails before Vite | `predev` runs `bunx tsx scripts/generate-sitemap.ts`; Bun must be installed |
| `npm run build` fails before Vite build | `prebuild` runs the same Bun sitemap script |
| Playwright targets wrong port | Playwright default base URL is `http://localhost:5173`, while Vite dev config uses port `8080`; set `PLAYWRIGHT_BASE_URL=http://localhost:8080` or `BASE_URL` when needed |
| Full report remains locked after OTP | `get_analysis_full` requires matching `phone_verifications.phone_e164`, `phone_verifications.status = 'verified'`, exact `scan_session_id`, matching `lead_id`, and `leads.phone_verified = true` |
| Preview available but full unavailable | Preview mode does not require phone verification; full mode does |
| Private quote upload retry fails | Storage RLS requires correct INSERT/UPDATE policy path and deterministic retry context; `UploadZone` has explicit orphan/conflict handling |
| Edge Function appears deployed locally but missing config | `nextdoor-capi-event` has an entrypoint and call sites but no config block in `supabase/config.toml` |
| Generated DB types drift | `typegen:check` compares remote generated types to `src/integrations/supabase/types.ts`; it requires Supabase CLI and project access |
| Admin page renders in dev without session | `AdminAuthGate` returns children immediately when `import.meta.env.DEV` is true; backend admin functions still perform their own checks unless dev secret bypass is used |
| Local migration command uncertainty | No package script exists for DB reset/apply; use Supabase CLI directly and verify command syntax from the installed CLI |
| Browser/server API confusion | Browser code uses `import.meta.env` and Supabase publishable/anon keys; Edge Functions use `Deno.env.get` and service-role keys |

---

## Commonly Misidentified Technologies

| Technology or assumption | Status | Basis |
|---|---|---|
| Next.js | Absent | No `next` dependency, no `next.config.*`, no Next `app`/`pages` routing in pinned tree |
| pnpm | Absent | No `pnpm-lock.yaml` in pinned tree |
| Yarn | Absent | No `yarn.lock` in pinned tree |
| Docker application runtime | Absent | No `Dockerfile` or `docker-compose.yml` in pinned tree |
| Vercel config | Absent | No `vercel.json` in pinned tree |
| Netlify config file | Absent | No `netlify.toml`; only `public/_redirects` SPA fallback exists |
| A canonical `reports` table | Absent | Migration table creation inventory shows `analyses` and legacy `quote_analyses`, not `reports` |
| Frontend direct Gemini calls | Absent for scanner path | Gemini API calls are in Edge Functions/scripts, not browser scanner code |
| Browser service-role key | Absent | Browser Supabase client reads only `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_ANON_KEY` |
| Package scripts for DB migration/reset | Absent | No `db:*` or migration apply/reset scripts in `package.json` |
| `/vault` production app routes | Absent | No `/vault/*` routes in `src/App.tsx` at pinned commit |
=======
Evidence-backed operational failures developers encounter:

| Symptom | Likely cause in code |
|---|---|
| Frontend fails immediately on boot | Missing `VITE_SUPABASE_URL` or publishable key (`src/integrations/supabase/client.ts` throws) |
| Local dev refuses old Supabase ref | DEV guard rejects URL containing `wkrcyxcnzhwjtdpmfpaf` |
| Upload succeeds but scan session missing | `start-upload-scan-session` not invoked or storage path prefix mismatch |
| Preview loads but full stays locked after OTP | Phone/session mismatch in `get_analysis_full`; pending verification bound to different `scan_session_id` |
| OTP send failures | Twilio secrets missing/invalid; rate limit windows in `send-otp` |
| Scan stalls / retry loops | `scan-quote` stale-processing recovery; upload retry context RPC failures |
| Playwright e2e cannot reach app | Wrong base URL (`5173` default vs `8080` dev server) |
| CRM webhook never fires | Expected after Phase 0A freeze — producer/claim intentionally disabled |
| Google/TikTok dispatch appears in logs but not in ad platforms | Dry-run-only senders at worker layer |
| ESLint CI/local friction | `npm run lint` reports hundreds of existing violations at pinned SHA |

---

## Architectural Non-Assumptions

Do **not** assume the following without re-verifying code at your commit:

| Assumption | Forensic verdict at pinned SHA |
|---|---|
| Next.js app router/pages | **(absent)** — Vite SPA only (`next-themes` is unrelated UI theming) |
| Prisma ORM | **(absent)** from dependencies and runtime queries |
| Homeowner `/vault` product routes | **(absent)** from `App.tsx` |
| Canonical `public.reports` table | **(absent)** — use `analyses` |
| Canonical `public.profiles` table | **(absent)** — use `contractor_profiles` / `leads` |
| Browser holds service-role key | **(absent)** in frontend code paths |
| `quote_analyses` is written on scan | **(absent)** runtime writes — canonical is `analyses` |
| Package script resets local DB | **(absent)** in `package.json` |
| `verify_jwt = false` means unauthenticated public data access | **False** — inspect per-function secret/JWT/ownership checks |
| README or other markdown proves runtime behavior | **False** — executable code/SQL wins |
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Change-Safety Boundaries

<<<<<<< HEAD
| Boundary | High-blast-radius files | Invariant to preserve |
|---|---|---|
| Full report access | `supabase/functions/report-access/index.ts`, `supabase/migrations/*get_analysis_full*.sql`, `src/services/reportService.ts`, `src/hooks/useAnalysisData.ts` | `full_json` must not be returned unless backend scan/phone verification succeeds |
| OTP verification | `supabase/functions/send-otp/index.ts`, `supabase/functions/verify-otp/index.ts`, `_shared/otpQaBypass.ts`, `_shared/otpObservability.ts` | Verification must remain scan-session-bound and persisted before unlock |
| Scanner scoring | `supabase/functions/scan-quote/scoring.ts`, `flagging.ts`, `reportCompiler.ts`, `_shared/metrics.ts` | Grades, hard caps, flags, and financial metrics remain deterministic TypeScript outputs |
| Upload bootstrap | `src/components/UploadZone.tsx`, `supabase/functions/start-upload-scan-session/index.ts`, `contracts/schemas.ts` | Private upload must map to one coherent lead, quote file, and scan session without weakening RLS |
| Storage privacy | Storage migrations touching `storage.buckets` and `storage.objects` policies | `quotes` remains private; uploads may work without public read |
| Function registration | `supabase/config.toml`, `supabase/functions/*/index.ts` | Entry functions and config blocks stay aligned; review every `verify_jwt = false` endpoint body |
| Admin authorization | `_shared/adminAuth.ts`, admin functions importing it, `src/components/admin/AdminAuthGate.tsx` | Browser route gates are not a substitute for backend role validation |
| Partner access | `src/components/auth/PartnerGuard.tsx`, `src/hooks/usePartnerAuth.ts`, partner Edge Functions and RLS | Partner data access remains tied to authenticated contractor identity/profile |
| Conversion tracking | `src/lib/trackConversion.ts`, `src/lib/metaBrowserPixel.ts`, `_shared/tracking/`, CAPI/TikTok/Nextdoor/Google functions | Browser events and server canonical events must not expose secrets and should preserve dedup IDs |
| Migrations and generated types | `supabase/migrations/`, `src/integrations/supabase/types.ts` | Schema, grants, RLS, RPC signatures, and generated types must stay coherent |
=======
| Subsystem | High-risk locations | Invariant that must remain true |
|---|---|---|
| Verify-to-Reveal | `supabase/functions/report-access/`, RPCs `get_analysis_preview` / `get_analysis_full`, `src/hooks/useAnalysisData.ts`, `src/services/reportService.ts` | `full_json` never authorized without backend phone/session verification |
| OTP binding | `send-otp`, `verify-otp`, `phone_verifications`, `ReportClassic.tsx`, `PostScanReportSwitcher.tsx` | One verified OTP unlocks only its bound scan session |
| Scanner/scoring | `supabase/functions/scan-quote/scoring.ts`, `flagging.ts`, `reportCompiler.ts` | Grades/flags/pillars remain deterministic TS, not LLM output |
| Private quote storage | Storage bucket `quotes`, upload policies, `start-upload-scan-session` | Quote files stay private; no casual anon read paths |
| Migrations / RPC grants | `supabase/migrations/**`, SECURITY DEFINER functions | Do not widen client EXECUTE on gated RPCs |
| Admin authorization | `AdminAuthGate`, admin Edge Functions, `user_roles` checks | Production admin paths must not silently widen to anon |
| Partner authorization | `PartnerGuard`, `usePartnerAuth`, partner Edge Functions | Partner data scoped to authenticated contractor identity |
| CRM dispatch | `fire_crm_handoff`, `claim_pending_deliveries`, `dispatch-lead` | Do not re-enable delivery without explicit approved migration + ops plan |
| Conversion tracking | `createCanonicalEvent.ts`, `dispatch-platform-events`, `capi-event` | Preserve deterministic `event_id`, identity fields, and server-side dispatch boundary |
| Dev bypass | `dev-report-unlock`, `devSecret.ts`, `_shared/adminAuth.ts` | Must remain impossible in production builds/paths |

---

## README Maintenance Contract

Regenerate or manually review this README after material changes to:

- `src/App.tsx` and nested route modules (`src/routes/*`)
- `package.json` scripts/tooling and lockfiles
- `vite.config.ts`, Vitest/Playwright configs
- `supabase/config.toml` and Edge Function inventory/contracts
- `supabase/migrations/**`, RPCs, RLS, storage policies
- Scanner architecture under `supabase/functions/scan-quote/**`
- OTP/report authorization (`send-otp`, `verify-otp`, `report-access`, related RPCs)
- CRM routing/dispatch/disposition modules
- Tracking/canonical event pipeline
- Environment variable contracts (`.env.example`, client bootstrap, Edge env reads)

After code changes, **executable sources remain authoritative**; this README must not silently become the only spec.
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Evidence and Audit Notes

<<<<<<< HEAD
| Note | Detail |
|---|---|
| Pinned commit | `3edfc6dd89fc1db3116f77277a82e8be4ed35bb7` |
| Audit date | `2026-07-20` |
| Evidence snapshot | Branch resolved locally with `git rev-parse --verify forensic_report_v2`; subsequent inspections used the pinned SHA |
| Repository manifest | A full pinned file manifest was generated with `git ls-tree -r --name-only` before implementation inspection |
| Commands executed | Git object reads/searches only; no dependency install, test, build, lint, migration, or app runtime command was executed |
| Prohibited evidence | Markdown, MDX, text planning files, PDFs, docs, commit messages, PRs, issues, and comments were not used as architectural proof |
| Comments in source | Source comments were encountered but not treated as proof of behavior; executable control flow, imports, calls, config, and migrations were used |
| Inaccessible admissible files | None identified during targeted pinned inspection |
| Broad search limitation | One broad runtime table/RPC extraction timed out; targeted searches for the material report, OTP, upload, scan, admin, partner, and tracking paths were completed |
| Material unknowns | Exact deployed Supabase project state, remote secrets, current production/staging environment values, and Gemini/Twilio/Stripe account configuration are unknown from repository evidence |
| Material conflict | `supabase/functions/nextdoor-capi-event/index.ts` exists and is invoked, but `supabase/config.toml` has no `[functions.nextdoor-capi-event]` block |
| Source paths for main claims | `src/App.tsx`, `src/main.tsx`, `src/components/UploadZone.tsx`, `src/pages/ReportClassic.tsx`, `src/hooks/useAnalysisData.ts`, `src/hooks/usePhonePipeline.ts`, `src/services/reportService.ts`, `src/services/phoneVerificationService.ts`, `src/integrations/supabase/client.ts`, `supabase/config.toml`, `supabase/functions/report-access/index.ts`, `supabase/functions/send-otp/index.ts`, `supabase/functions/verify-otp/index.ts`, `supabase/functions/start-upload-scan-session/index.ts`, `supabase/functions/scan-quote/index.ts`, `supabase/functions/scan-quote/scoring.ts`, `supabase/functions/scan-quote/flagging.ts`, `supabase/functions/scan-quote/reportCompiler.ts`, `supabase/functions/_shared/metrics.ts`, `supabase/functions/_shared/scannerConfig.ts`, `supabase/migrations/*.sql`, `package.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `deno.json`, `.github/workflows/*.yml`, `public/_redirects` |
=======
| Field | Value |
|---|---|
| Pinned SHA | `a83283a7cc0162eaaeaacad189691ad805aba81a` |
| Audit date | 2026-07-20 |
| Inspected evidence | 1,335-path manifest; `package.json`, lockfiles, Vite/Vitest/Playwright/ESLint configs, CI workflows, `src/App.tsx`, nested routers, core funnel/report hooks/services, `supabase/config.toml`, 58 Edge Function entrypoints, 145 migration files chronologically, generated `src/integrations/supabase/types.ts`, env declarations in executable code |
| Commands executed | `git worktree add --detach`, `npm ci`, `npm run typecheck`, `npm run test:critical`, `npm run build`, `npm run lint` |
| Commands not executed | Full test suite, Playwright e2e, Deno edge tests, migration integrity workflow, live Supabase OTP/scan verification |
| Inaccessible admissible evidence | Live deployed Supabase project state, secret values, production cron/schedulers, external ad platform receipt |
| Unresolved conflicts | Listed in [Known Repository Inconsistencies](#known-repository-inconsistencies) |
| Deployed-state facts | **(unknown from repository evidence)** |
| Material limitations | Audit used immutable `git show`/`git ls-tree` for source truth; existing working-tree `README.md` modifications were not used as evidence |

Major claim source paths are cited inline by repository-relative path throughout this document.
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc

---

## Operating Principles

<<<<<<< HEAD
- `public.analyses.full_json` is a backend-gated asset; preview retrieval and full retrieval are separate server paths.
- SMS verification is persisted server-side and bound to the exact `scan_session_id` before full report access is authorized.
- Browser `localStorage` can resume a verified report UX, but it does not authorize full report data by itself.
- Quote files are stored in the private `quotes` bucket; upload permissions do not imply public read access.
- Gemini extracts structured document evidence; deterministic TypeScript assigns grades, pillar scores, hard caps, flags, warnings, missing items, and financial metrics.
- Service-role credentials are constructed in Edge Functions and scripts, not in the browser Supabase client.
- Every configured Edge Function has `verify_jwt = false`, so endpoint-specific authorization must remain in function code, shared auth helpers, secrets, or database gates.
- Admin UI session gates are UX gates; backend admin role checks are the security boundary for privileged data/actions.
- The canonical report route is `/report/classic/:sessionId`; `/report/:sessionId` is only a compatibility redirect.
- `public.analyses` is the canonical report table at this commit; `public.quote_analyses` is legacy compatibility schema.
=======
Verified invariants implemented at the pinned SHA:

1. **AI reads; TypeScript scores.** Gemini extraction in `scan-quote` precedes deterministic grade/flag computation.
2. **Preview before OTP is allowed; full report before backend authorization is not.** `report-access` full mode delegates to strict RPC binding.
3. **Client-side hiding is not authorization.** Route visibility, overlays, and hooks mirror state but do not gate secrets.
4. **Canonical analysis lives in `analyses`.** Preview/full separation is enforced in RPCs and Edge proxy stripping.
5. **Private quotes bucket.** Homeowner uploads go to `quotes`; gated retrieval happens server-side.
6. **OTP verification is server-side via Twilio Edge Functions.** Browser uses `phoneVerificationService` only.
7. **Business conversion events and operational telemetry are separated.** dataLayer/GTM vs `event_logs` vs `wm_event_log`.
8. **CRM automatic delivery is fail-closed at the database layer** in the latest migration at this SHA.
9. **Service-role credentials stay server-side.** Browser Supabase client uses publishable/anon key only.
10. **This README is a snapshot** of `forensic_report_v2 @ a83283a7…` and is not authoritative beyond that commit without regeneration.
>>>>>>> 985590424a025de5fec7b2ecb2414a2f5eb968bc
