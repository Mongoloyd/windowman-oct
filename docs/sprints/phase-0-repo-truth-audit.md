# Phase 0 Repo-Truth Audit

> **⚠ STALE BROWSER TRANSPORT — read before implementing**
>
> This document may describe the client calling `get_analysis_preview` or `get_analysis_full` via `supabase.rpc()`.
> **That is not the live production path** after the `report-access` migration.
>
> **Canonical browser transport:** `src/services/reportService.ts` → Edge Function `report-access` → service-role RPC.
>
> Do not "fix" code to match this doc. Read [`docs/reveal/VERIFY_TO_REVEAL_CONTRACT.md`](../reveal/VERIFY_TO_REVEAL_CONTRACT.md) first.

> **Sprint type:** Audit-lock. No runtime code changed. This file is the canonical map of the live Verify-to-Reveal path as it exists in `Mongoloyd/wm-mvp` at audit time. Where the repo contradicts prior planning docs, **the repo wins**.

---

## 1. Canonical Live Path

Step-by-step flow from upload → full reveal → return.

1. **Lead capture (pre-upload).** `TruthGateFlow` (Flow A) collects intake answers, persists a `leads` row, and reports the resulting `session_id` upward to `pages/Index.tsx` via `onLeadCaptured(sid)`. `setLeadCaptured(true)` gates the `UploadZone` into view.
2. **Upload entry.** `src/components/UploadZone.tsx` accepts the quote file, uploads to private storage bucket `quotes` (path: `${sessionId}/${ts}_${name}`), then:
   - resolves or creates a `leads` row (RPC `get_lead_by_session`, fallback `leads.insert`),
   - inserts a `quote_files` row (`status: 'pending'`),
   - inserts a `scan_sessions` row (`status: 'uploading'`, with `lead_id` and `quote_file_id`),
   - calls `onScanStart(fileName, scanSessionId)` which sets `scanSessionId` + `fileUploaded=true` in `Index.tsx`,
   - invokes the `scan-quote` edge function with `{ scan_session_id, event_id }`.
3. **Scanner Brain.** `supabase/functions/scan-quote/index.ts` (RUBRIC v1.x) runs:
   - signed-URL download → Gemini extraction → manual schema validation → deterministic TypeScript scoring (`scoring.ts`) → flag detection (`flagging.ts`) → derived metrics → county benchmark comparison → report compilation (`reportCompiler.ts`).
   - Persists state via `upsertAnalysisRecord(...)` into the `analyses` table with `onConflict: 'scan_session_id'` (idempotent).
   - Updates `scan_sessions.status` through phases: `uploading` → `processing` → terminal (`preview_ready` | `complete` | `invalid_document` | `needs_better_upload`).
4. **Preview fetch (anonymous).** `useAnalysisData(scanSessionId, enabled)` runs Phase 1 on mount: calls SECURITY DEFINER RPC `get_analysis_preview(p_scan_session_id)`. Returns grade, flag counts, pillar bands, proof-of-read, and a redacted `preview_json`. **Flags array is intentionally empty in preview**.
5. **Theatrics + reveal trigger.** `ScanTheatrics` runs the in-page animation and calls `onRevealComplete()`, which sets `gradeRevealed=true` in `Index.tsx`. The page then renders `PostScanReportSwitcher` with the preview-level data.
6. **OTP send.** Inside `PostScanReportSwitcher`, the `usePhonePipeline("validate_and_send_otp", { scanSessionId, externalPhoneE164 })` hook screens, normalizes, and calls `phoneVerificationService.sendOtp` → edge function `send-otp`. `send-otp` does Twilio Lookup (fail-open), rate-limit checks (per-phone cooldown + window cap, per-IP cap), expires older `phone_verifications` pending rows, inserts a fresh `pending` row, then calls Twilio Verify Verifications endpoint.
7. **OTP verify.** `PostScanReportSwitcher.handleOtpSubmit` calls `pipeline.submitOtp(code)` → `verifyOtp` → edge function `verify-otp`. The edge function:
   - calls Twilio `VerificationCheck`,
   - resolves `lead_id` from `scan_sessions` (fail-closed integrity guard if missing),
   - updates `phone_verifications` row to `status='verified', verified_at, lead_id` (fail-closed),
   - updates `leads.phone_verified=true, phone_e164, phone_verified_at` (fail-closed),
   - persists canonical events `phone_verified` and `report_revealed` server-side and returns deterministic `phone_verified_event_id` + `report_revealed_event_id`.
8. **Full reveal authorization.** On verify success, `PostScanReportSwitcher` invokes `props.onVerified(e164)`. `Index.tsx` wires that to `fetchFull(e164)` on the hook, which calls SECURITY DEFINER RPC `get_analysis_full(p_scan_session_id, p_phone_e164)`. The DB function checks BOTH `phone_verifications.status='verified'` AND `leads.phone_verified=true`, joined back to `scan_sessions.id`. On success it returns full `flags`, `full_json`, `proof_of_read`, `preview_json`, etc. On failure it returns the sentinel `grade='__UNAUTHORIZED__'`.
9. **Resume record + DB-side trigger.** On successful full fetch, `useAnalysisData` calls `saveVerifiedAccess(scanSessionId, phoneE164)` → 24-hour `localStorage` record under key `wm_verified_access`. Database trigger `fire_crm_handoff` (on `leads`) fires when `phone_verified=true` + `latest_analysis_id` set → enqueues `webhook_deliveries` row + `lead_events.crm_handoff_queued`.
10. **Return / refresh.** On `?resume=1` reload, `Index.tsx` reads the `wm_verified_access` record on mount, restores `scanSessionId/fileUploaded/gradeRevealed`, and calls `tryResume()`, which re-issues `get_analysis_full` with the cached phone. If the RPC fails or returns null, the cached record is cleared (`clearVerifiedAccess`) and the user is dropped back to a locked state.

---

## 2. Canonical Runtime Inventory

### Frontend components (canonical reveal path)

| Component | Path | Role |
|---|---|---|
| `Index` | `src/pages/Index.tsx` | Orchestrates the entire homepage acquisition + reveal flow. Owns `scanSessionId`, `fileUploaded`, `gradeRevealed`, `tryResume` invocation, and the `onVerified={fetchFull}` wiring. |
| `TruthGateFlow` | `src/components/TruthGateFlow.tsx` | Lead capture step before upload. |
| `UploadZone` | `src/components/UploadZone.tsx` | File intake → storage → `leads`/`quote_files`/`scan_sessions` inserts → `scan-quote` invocation. |
| `ScanTheatrics` | `src/components/ScanTheatrics.tsx` | Polls/animates while `analyses` is being computed; signals reveal complete. |
| `PostScanReportSwitcher` | `src/components/post-scan/PostScanReportSwitcher.tsx` | **Canonical in-page post-scan orchestrator.** Single source of truth for render decisions on the reveal path; owns OTP pipeline, gate state, CTA logic, and emits the `phone_verified` + `report_revealed` business events. |
| `TruthReportClassic` | `src/components/TruthReportClassic.tsx` | **Canonical report renderer.** Pure-presentational; receives `accessLevel` and `gateProps` from `PostScanReportSwitcher`. |
| `LockedOverlay` | `src/components/LockedOverlay.tsx` | Gate UI (phone / send_code / enter_code). All business logic lives in the parent orchestrator. |

### Hooks

| Hook | Path | Role |
|---|---|---|
| `useAnalysisData` | `src/hooks/useAnalysisData.ts` | Two-phase data hook: Phase 1 preview on mount, Phase 2 `fetchFull(phone)` post-OTP, Phase 3 `tryResume()` for returning verified users. |
| `usePhonePipeline` | `src/hooks/usePhonePipeline.ts` | Shared phone screen → normalize → send-otp / verify-otp pipeline. **Currently supports two modes: `validate_only` and `validate_and_send_otp`.** No third mode exists. |
| `useScanFunnel` / `useScanFunnelSafe` | `src/state/scanFunnel.tsx` | Funnel-scoped React context: phoneE164, phoneStatus, sessionId, scanSessionId, quoteFileId, clientSlug. Persists phoneE164/phoneStatus/sessionId/scanSessionId to `localStorage` under `wm_funnel_*` keys with 24h expiry. |
| `usePhoneInput` | `src/hooks/usePhoneInput.ts` | Pure input formatter/normalizer (no IO). |

### Helper modules (canonical reveal path)

| Module | Path | Role |
|---|---|---|
| `reportService` | `src/services/reportService.ts` | Owns the three RPC calls: `fetchScanStatus`, `fetchAnalysisPreview`, `fetchAnalysisFull`. Plus `fetchFullViaDevBypass` (dev only). |
| `phoneVerificationService` | `src/services/phoneVerificationService.ts` | Wraps `send-otp` / `verify-otp` edge function calls. |
| `verifiedAccess` | `src/lib/verifiedAccess.ts` | 24-hour resume record in `localStorage` (key `wm_verified_access`). |
| `deriveRevealPhase` | `src/lib/deriveRevealPhase.ts` | Pure function that maps hook outputs to the canonical `RevealPhase` discriminated union. |
| `revealPhase` types | `src/types/revealPhase.ts` | `RevealPhase` union: `locked` / `full_loading` / `full_stalled` / `full_ready`. |

### Edge functions (in canonical path)

| Function | Path | `verify_jwt` | Role |
|---|---|---|---|
| `scan-quote` | `supabase/functions/scan-quote/index.ts` | default (true) | Scanner Brain. Extraction → scoring → `analyses` upsert. |
| `send-otp` | `supabase/functions/send-otp/index.ts` | **false** | Phone screen + rate limit + Twilio Verify create + `phone_verifications` insert. |
| `verify-otp` | `supabase/functions/verify-otp/index.ts` | **false** | Twilio VerificationCheck + `phone_verifications` update + `leads` update + canonical event persistence. |
| `dev-report-unlock` | `supabase/functions/dev-report-unlock/index.ts` | default | Dev-only bypass for `get_analysis_full`. Gated by `VITE_DEV_BYPASS_SECRET`. |
| `send-report-email` | `supabase/functions/send-report-email/index.ts` | default | Snapshot Receipt email fired once per first true full unlock from `PostScanReportSwitcher`. Server is authoritative on idempotency via `leads.snapshot_email_status`. |

### Database tables touched on the live reveal path

| Table | Role |
|---|---|
| `leads` | Canonical lead identity. `phone_verified`, `phone_verified_at`, `phone_e164`, `latest_analysis_id`, `latest_scan_session_id`, `snapshot_email_status`, etc. |
| `quote_files` | Stores storage path + status. Anon/authenticated `INSERT` only (no SELECT/UPDATE/DELETE). |
| `scan_sessions` | Per-upload session row with `status` and FKs to `lead_id` / `quote_file_id`. **No anon SELECT** — frontend uses RPC `get_scan_status` (SECURITY DEFINER). |
| `analyses` | **Canonical analysis table.** Upserted by `scan-quote` on `scan_session_id`. Holds `grade`, `flags`, `full_json`, `preview_json`, `proof_of_read`, `confidence_score`, `analysis_status`, etc. RLS: internal-operator SELECT + service-role full. |
| `phone_verifications` | OTP send/verify ledger. Row inserted by `send-otp`, updated by `verify-otp`. RLS: service-role only. |
| `lead_events` | Canonical event log (e.g., `crm_handoff_queued`). RLS: internal-operator SELECT + service-role full. |
| `webhook_deliveries` | Inserted by DB trigger `fire_crm_handoff` when verification + analysis are both present. |

### Database functions (SECURITY DEFINER) in canonical path

- `get_scan_status(p_scan_session_id)` — id + status only.
- `get_analysis_preview(p_scan_session_id)` — grade, flag counts, proof_of_read, preview_json (no `full_json`, no flags array).
- `get_analysis_full(p_scan_session_id, p_phone_e164)` — **the gate.** Verifies both `phone_verifications.status='verified'` AND `leads.phone_verified=true` joined to `scan_sessions.id`. Returns sentinel `grade='__UNAUTHORIZED__'` on failure.
- `get_lead_by_session(p_session_id)` — used by `UploadZone` to find/reuse a lead.
- `fire_crm_handoff()` — trigger on `leads` that fires when phone-verified + analysis present.

### Storage

- Bucket `quotes` (private). Files written by anon `UploadZone` upload via Supabase JS client. No public URL exposure.

### Routes

- `/` (`Index.tsx`) — canonical homepage acquisition + in-page reveal.
- `/report/:scanSessionId` (`ReportClassic.tsx`) — secondary reveal surface used for shared/return links. Uses the same `useAnalysisData` hook and `PostScanReportSwitcher`-class flow inline.

---

## 3. State Map

| State | What's true | What the user sees | Backend gate |
|---|---|---|---|
| **Anonymous visitor** | No `scanSessionId`, no `phone_verified`, no `wm_verified_access` record. | Marketing hero / TruthGateFlow / FlowB. | None — public surface. |
| **Lead captured** | `leads` row exists with `session_id`. `phone_verified=false`. `UploadZone` is visible. | Upload UI. | RLS allows anon `INSERT` on `leads` with `phone_verified=false` constraints. |
| **Scan session created** | `scan_sessions.status='uploading'` then `processing`. `analyses` row may not yet exist. | `ScanTheatrics` animation. | `get_scan_status` RPC (SECURITY DEFINER) is the only way to read status. |
| **Preview ready** | `analyses.analysis_status='complete'` with `preview_json`. `gradeRevealed=true`. | `TruthReportClassic` in `accessLevel='preview'` mode with `LockedOverlay`. | `get_analysis_preview` returns grade + counts; **`flags=[]` and `full_json` not exposed**. |
| **OTP sent** | `phone_verifications` row inserted with `status='pending'`. Funnel `phoneStatus='otp_sent'`. `localGateOverride='enter_code'`. | `LockedOverlay` in `enter_code` mode. | Twilio Verify owns the code. DB row holds the binding. |
| **OTP verified (verify-otp returned 200)** | `phone_verifications.status='verified'`, `leads.phone_verified=true`, `leads.phone_verified_at` set. Funnel `phoneStatus='verified'`. `props.onVerified(e164)` called → `fetchFull(e164)` triggered. | Loading spinner / `full_loading` phase. | Backend trigger `fire_crm_handoff` enqueues handoff. |
| **Full reveal authorized** | `get_analysis_full` returned data. `isFullLoaded=true`. `wm_verified_access` saved (24h). | `TruthReportClassic` in `accessLevel='full'` mode. CTAs (`Match Me`, `Help Call`) become live. | Server is authority via `get_analysis_full`. |
| **Logged-in return state** | **Not implemented.** There is no homeowner Supabase Auth account on the canonical reveal path. The only "return" mechanism is the `wm_verified_access` `localStorage` record + `?resume=1` URL param. There is no `auth.users` linkage for homeowners on this path — Supabase Auth in the repo is only used for B2B contractor portal (`ContractorLogin`, `usePartnerAuth`). | If `?resume=1` and record valid → auto-restore + `tryResume()`. Otherwise normal anonymous flow. | `tryResume()` re-runs `get_analysis_full` with cached phone. |

---

## 4. Source of Truth Map

| Identity | Source of truth | Notes |
|---|---|---|
| **Lead** | `leads.id` (uuid). Looked up via `leads.session_id` (text) using RPC `get_lead_by_session`. | `session_id` is a free-form text key set by `TruthGateFlow` / `UploadZone`. |
| **Scan** | `scan_sessions.id` (uuid). | Always carried as `scanSessionId` in frontend state. Persisted in `localStorage` under `wm_funnel_scanSessionId`. |
| **Analysis** | `analyses` row keyed uniquely on `scan_session_id` (upsert with `onConflict: 'scan_session_id'`). | One analysis per scan session by construction. |
| **Verified access (server)** | `phone_verifications.status='verified'` joined to `leads.phone_verified=true` joined to `scan_sessions.lead_id`. | Both flags must be true. Checked atomically inside `get_analysis_full`. |
| **Verified access (client UX)** | `wm_verified_access` `localStorage` record `{ scan_session_id, phone_e164, verified_at, expires_at }`. | UX-only resume hint; backend re-checks on every `tryResume`. |
| **Full reveal authorization** | The SECURITY DEFINER function `get_analysis_full(p_scan_session_id, p_phone_e164)`. | If `v_authorized` is false, function returns sentinel `grade='__UNAUTHORIZED__'`. Frontend `reportService.fetchAnalysisFull` translates that sentinel into `{ ok: false, code: 'unauthorized' }`. |

---

## 5. Refresh / Return Behavior

### Refresh during preview (after upload, before OTP)
- `Index.tsx` re-mounts. `scanSessionId`, `fileUploaded`, `gradeRevealed` are local React state and are **lost**.
- `wm_funnel_scanSessionId` is in `localStorage` (`scanFunnel.tsx`), but `Index.tsx` does not currently restore it on mount unless `?resume=1` is in the URL.
- **Net effect:** A bare refresh on the homepage after upload but before OTP drops the user back to the marketing hero. The `scan_sessions` row and any `analyses` row remain server-side, but the UI has no path back to them without `?resume=1` + a saved `wm_verified_access` record (which only exists post-OTP).

### Refresh during OTP entry (code sent, not yet verified)
- Same as above. The `phone_verifications` row is still pending server-side, but the UI loses its anchor to the scan session.
- `wm_funnel_phoneE164` and `wm_funnel_phoneStatus` are persisted, but without a restored `scanSessionId` they cannot be reattached to a report.

### Refresh after successful OTP
- `useAnalysisData.fetchFull` calls `saveVerifiedAccess(scanSessionId, phoneE164)` on success, writing `wm_verified_access`.
- A bare refresh **without** `?resume=1` drops the user back to the marketing hero (the resume effect in `Index.tsx` is gated on `params.get('resume') === '1'`).
- A refresh **with** `?resume=1` restores `scanSessionId/fileUploaded/gradeRevealed` and calls `tryResume()`, which re-runs `get_analysis_full` and re-renders the full report. If the resume RPC fails, `clearVerifiedAccess()` is called and the user falls back to the locked preview.

### Return visit if logged-in / verified state exists
- There is no homeowner Supabase Auth login. "Logged-in" state for homeowners does not exist in this repo.
- "Verified return" is exclusively driven by `wm_verified_access` in `localStorage` on the same browser, with the explicit `?resume=1` URL flag. Cross-device resume is not supported.
- `ReportClassic.tsx` (route `/report/:scanSessionId`) calls `tryResume()` unconditionally on mount, so a user with the resume record + the report URL gets auto-revealed there without needing the `?resume=1` query.

---

## 6. Current Risks and Bugs

### P0

| # | Title | Why it matters | Files | Confirmed / Suspected |
|---|---|---|---|---|
| P0-1 | **Bare refresh during preview/OTP loses the entire flow.** | After upload, `Index.tsx` does not auto-restore from `wm_funnel_scanSessionId`. Resume requires `?resume=1` AND a `wm_verified_access` record (which only exists post-OTP). A user who refreshes after upload — or is bounced by a tab restore — silently loses the scan and is dropped back to the hero, even though the `scan_sessions` row and `analyses` row exist server-side. | `src/pages/Index.tsx` (resume effect L78-99 gated on `?resume=1`); `src/state/scanFunnel.tsx` (persists `scanSessionId` but `Index.tsx` doesn't read it). | **Confirmed.** |

### P1

| # | Title | Why it matters | Files | Confirmed / Suspected |
|---|---|---|---|---|
| P1-1 | **`phone_verifications` rate-limit query is global, not session-scoped.** | `send-otp` rate-limits by `phone_e164` and IP only. A user changing scan sessions mid-flow (e.g. retrying a different upload) can be blocked by their own prior cooldown. Inverse risk: a single attacker phone can be re-bound to many leads if `lead_id` resolution is delayed. | `supabase/functions/send-otp/index.ts` L94-150; `supabase/functions/verify-otp/index.ts` L43-58 (selects most-recent pending row by phone only). | **Confirmed** behavior; UX risk **suspected** until reproduced. |
| P1-2 | **`verify-otp` matches the most recent pending row by phone only — `scan_session_id` is not part of the WHERE clause.** | If two scan sessions share a phone (same browser, two uploads minutes apart), the verify call will bind the latest pending row to the most recently provided `scan_session_id`. This works in practice but is fragile if a user retries an old code intended for a previous session. | `supabase/functions/verify-otp/index.ts` L43-58, L99-127. | **Confirmed.** |
| P1-3 | **No homeowner auth path exists for cross-device return.** | Users who scan on phone, get the report email, then click on desktop have no way to re-authorize. The `wm_verified_access` record is per-browser localStorage. The repo has no homeowner `auth.users` linkage on the canonical path. | Absent: any homeowner Supabase Auth UI. Present: `src/lib/verifiedAccess.ts` is the only mechanism. | **Confirmed absence.** |
| P1-4 | **`tryResume` does not require `?resume=1` on `/report/:scanSessionId` but does require it on `/`.** | Inconsistent gating. `Index.tsx` only resumes when `?resume=1` is present; `ReportClassic.tsx` resumes whenever it has a record. This is the right behavior for `/report/...` but it means email-share / SMS-share links to `/?...` will never auto-resume unless the link includes `?resume=1`. | `src/pages/Index.tsx` L78-99; `src/pages/ReportClassic.tsx` L110-113. | **Confirmed.** |
| P1-5 | **`leads` RLS allows anon `INSERT` directly (with constraints).** | Required for `UploadZone`'s fallback path, but it means an unauthenticated client can spam-insert `leads` rows as long as they keep `phone_verified=false` etc. No frontend rate limit. | `leads` RLS policy `leads_anon_insert_constrained`; `src/components/UploadZone.tsx` L92-102. | **Confirmed**, by design but worth noting. |

### P2

| # | Title | Why it matters | Files | Confirmed / Suspected |
|---|---|---|---|---|
| P2-1 | **Stall timer is 5s and shared between "fetch in progress" and "fetch errored".** | If `get_analysis_full` returns slowly under load (cold cache, slow region), the user sees the `full_stalled` retry UI even though the request is still in flight. Retry triggers a duplicate fetch. | `src/components/post-scan/PostScanReportSwitcher.tsx` L227-242, L270-286. | **Confirmed.** |
| P2-2 | **`useAnalysisData` preview retry loop is up to 8 attempts at 2.5s each (~20s).** | If `analyses` is genuinely missing, the user waits 20s before seeing "Analysis not found." Considered acceptable for the happy path but may mask permanent backend failures. | `src/hooks/useAnalysisData.ts` L344-396. | **Confirmed.** |
| P2-3 | **`scanFunnel` localStorage and `wm_verified_access` localStorage have overlapping responsibilities and independent expiries.** | Both are 24h, but they can drift out of sync if one is cleared and not the other. `Index.tsx` calls `clearVerifiedAccess()` on "Start New Scan" but does not call `funnel.clearFunnel()`. | `src/pages/Index.tsx` L294-298 (Start New Scan); `src/state/scanFunnel.tsx` L168-171 (`clearFunnel`). | **Suspected**, edge case. |
| P2-4 | **`PostScanReportSwitcher` mounts a phone-hydration effect that writes to `funnel.setPhone("", "none")` if the lead row has no phone.** | This destructively clears any phone the user typed in another tab if the DB lookup races the user. Unlikely on the happy path but observable in dev with multi-tab usage. | `src/components/post-scan/PostScanReportSwitcher.tsx` L134-178. | **Suspected.** |
| P2-5 | **`fetchFull` is awaited inside `Index.tsx`'s `onVerified` lambda but the lambda does not return the promise.** | If `fetchFull` throws, the rejection is swallowed silently. The hook itself catches errors and writes `fullFetchError`, so the user surface is fine, but it means an unhandled rejection in a future refactor would be invisible. | `src/pages/Index.tsx` L359 `onVerified={(phoneE164: string) => { fetchFull(phoneE164); }}`. | **Confirmed**, low impact today. |
| P2-6 | **`UploadZone` creates a fallback `lead_id` client-side via `crypto.randomUUID()` if `get_lead_by_session` returns nothing.** | Works, but leaks the responsibility for lead identity into the client. The `leads` row created here has only `session_id` + `source`, no UTM / attribution capture. | `src/components/UploadZone.tsx` L84-102. | **Confirmed.** |

---

## 7. Scope Lock for Phase 1

### Files Phase 1 IS allowed to touch

Default: **none** unless the Phase 1 brief explicitly names them. The audit's purpose is to lock the canonical surface. Any Phase 1 work that needs to extend the reveal path should propose changes to the files in the table below, in priority order:

| File | Allowed change shape (Phase 1) |
|---|---|
| `src/pages/Index.tsx` | Resume restoration logic only (P0-1 fix). No new orchestration concerns. |
| `src/state/scanFunnel.tsx` | Read-back helpers if Phase 1 adopts the funnel store as the resume source. No new fields. |
| `src/lib/verifiedAccess.ts` | Additive helpers only (e.g. expiry check exposed). No schema change. |
| `docs/sprints/*` | Free to add new sprint docs. |
| `docs/db/*`, `docs/tracking/*` | Doc-only updates if Phase 1 needs to record decisions. |

### Files / systems Phase 1 must NOT touch

- `supabase/functions/scan-quote/**` — Scanner Brain is frozen for this sprint.
- `supabase/functions/send-otp/**`, `supabase/functions/verify-otp/**` — OTP gate is the moat.
- `supabase/functions/dev-report-unlock/**` — dev-only; do not generalize into prod.
- `src/hooks/useAnalysisData.ts` — three-phase contract (preview / full / resume) is locked. No new phases.
- `src/hooks/usePhonePipeline.ts` — two modes only: `validate_only`, `validate_and_send_otp`. Do not introduce a third mode.
- `src/components/post-scan/PostScanReportSwitcher.tsx` — canonical orchestrator. Behavior changes require an explicit, named sprint.
- `src/components/TruthReportClassic.tsx` — presentational only; do not move logic into it.
- `src/lib/deriveRevealPhase.ts` and `src/types/revealPhase.ts` — `RevealPhase` union is the canonical render contract. No new phases without a sprint.
- Database schema (`supabase/migrations/**`) and `src/integrations/supabase/types.ts`.
- RLS policies on `leads`, `analyses`, `phone_verifications`, `scan_sessions`, `quote_files`.
- Storage bucket `quotes` (must remain private; signed URLs only).

---

## 8. Changed Files

- `docs/sprints/phase-0-repo-truth-audit.md` — **created** (this file).

No runtime files modified. No config, schema, migration, package, style, route, or edge function changes.

---

### Validation snapshot

- ✅ Audit explicitly names: `PostScanReportSwitcher`, `TruthReportClassic`, `usePhonePipeline`, `analyses`, `scan_sessions`, `send-otp`, `verify-otp`, `scan-quote`.
- ✅ All 8 sections present in required order.
- ✅ Confirmed vs. suspected risks distinguished in Section 6.
- ✅ Phase 1 touch / do-not-touch scope present in Section 7.
- ⚠ Git CLI not available in this audit environment — changed-files list provided manually in Section 8. Only `docs/sprints/phase-0-repo-truth-audit.md` was created.
