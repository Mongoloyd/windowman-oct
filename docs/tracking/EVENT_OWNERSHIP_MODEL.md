# Event Ownership Model — Canonical Scanner / OTP / Report Path

> Phase 4 Preflight deliverable. Covers only the canonical scanner → OTP → report reveal path.

## Two-Lane Architecture

| Lane | File | Consumer | Purpose |
|------|------|----------|---------|
| **Business Events** | `src/lib/trackConversion.ts` (`trackGtmEvent`) | `window.dataLayer` → GTM → GA4/Meta/Google Ads | Conversion signals for marketing attribution and platform optimization |
| **Operational Telemetry** | `src/lib/trackEvent.ts` (`trackEvent`) | `event_logs` Supabase table | Internal diagnostics, funnel debugging, support visibility |

These lanes must never be conflated. A single business moment may fire one event in each lane, but the event names must differ to prevent confusion.

## Business Events — Canonical Owners

| Event Name | Owner File | Trigger Moment | Dedup-Worthy | Identity Keys |
|---|---|---|---|---|
| `quote_uploaded` | `UploadZone.tsx` | After file upload + scan_session creation succeeds | Yes | `event_id`, `scan_session_id`, `lead_id`, `file_type`, `file_size` |
| `phone_verified` | `PostScanReportSwitcher.tsx` | On `pipeline.submitOtp()` returning `status: "verified"` | Yes | `event_id` (server-issued), `scan_session_id`, `phone_e164_last4` |
| `report_revealed` | `PostScanReportSwitcher.tsx` | On `isFullLoaded` transitioning to `true` after OTP (guarded by `capturedPhone` presence to exclude resume) | Yes | `event_id` (server-issued), `scan_session_id`, `lead_id`, `grade` |
| `contractor_match_requested` | `PostScanReportSwitcher.tsx` (smart container) | On user clicking the "Get a Counter-Quote" CTA in `TruthReportClassic` | Yes | `event_id`, `scan_session_id`, `lead_id`, `grade`, `county` |

### Why each owner is correct

- **`quote_uploaded` → UploadZone**: This is the only component that performs the file upload. The event fires after the scan session is created, making it the earliest reliable moment.
- **`phone_verified` → PostScanReportSwitcher**: This is the canonical OTP orchestrator. It calls `pipeline.submitOtp()` and receives the verified result. VerifyGate and PhoneVerifyModal are dead code (not imported anywhere).
- **`report_revealed` → PostScanReportSwitcher**: This component is the single render-decision authority (Phase 3). It knows when `isFullLoaded` transitions after verification. The `capturedPhone` guard prevents firing on resume.
- **`contractor_match_requested` → PostScanReportSwitcher (Arc 3)**: Ownership moved from `TruthReportClassic` (presentational) to the smart container so the canonical fire carries `event_id`, `lead_id`, and `scan_session_id`. `TruthReportClassic` now only invokes the parent-supplied `onContractorMatchClick` handler.

## Operational Telemetry Events

| Event Name | Owner File | Purpose |
|---|---|---|
| `upload_completed` | `UploadZone.tsx` | Track successful file upload to storage |
| `photo_option_clicked` | `UploadZone.tsx` | Track interest in photo upload option |
| `preview_rendered` | `useAnalysisData.ts` | Track when preview data is first fetched and rendered |
| `report_unlocked` | `useAnalysisData.ts` | Track successful full data fetch (internal complement to `report_revealed`) |
| `resume_flow_triggered` | `useAnalysisData.ts` | Track returning-user resume |
| `otp_sent` | `usePhonePipeline.ts` | Track successful OTP dispatch |
| `otp_verify_success` | `usePhonePipeline.ts` | Track successful OTP verification (internal complement to `phone_verified`) |
| `otp_error` | `usePhonePipeline.ts` | Track OTP verification failures |
| `otp_send_failed` | `usePhonePipeline.ts` | Track OTP send failures |
| `rate_limit_hit` | `usePhonePipeline.ts` | Track rate limit encounters |
| `phone_submitted` | `PostScanReportSwitcher.tsx` | Track phone form submission |
| `fetch_stall_retry` | `PostScanReportSwitcher.tsx` | Track stall retry attempts |
| `lead_captured_with_phone` / `lead_captured_no_phone` | `TruthGateFlow.tsx` | Track lead creation with phone presence flag |

## Quarantined Components (Not on Canonical Path)

The following components are **not imported anywhere** in the production route graph. They are not canonical and must not be reused:

- `src/components/TruthReportFindings/VerifyGate.tsx` — Fires non-canonical `trackGtmEvent("otp_verified")` and premature `trackGtmEvent("report_revealed")`; bypasses `usePhonePipeline` orchestration
- `src/components/TruthReportFindings/PhoneVerifyModal.tsx` — Same stale browser business-event fires as VerifyGate; bypasses `usePhonePipeline` orchestration
- `src/components/TruthReportFindings/VerifyBanner.tsx` — Presentational orphan CTA only; no OTP transport or tracking fire

VerifyGate and PhoneVerifyModal call `phoneVerificationService` for transport but are still not the canonical OTP/reveal path — they own their own inline OTP UI and stale GTM fires instead of routing through `PostScanReportSwitcher` / `ReportClassic` + `usePhonePipeline`. Removal requires a dedicated deprecation sprint.

**Follow-up (separate measurement audit):** `/report/classic/:sessionId` (`ReportClassic.tsx`) uses canonical OTP transport via `usePhonePipeline` but does not yet emit browser GTM `phone_verified` / `report_revealed` — parity with `PostScanReportSwitcher` is out of scope for this docs pass.

## Intentionally Deferred

The following are intentionally NOT implemented in this phase:

1. **`appointment_booked` activation** — Mapped in canonical constants/value ladder but no live producer on the homeowner path. Activated only when the admin/CRM pipeline owns it.
2. **`trackBusinessEvent.ts` promotion** — This file has a richer payload contract (auto event_id, lead_id, utm, route) but is not yet the canonical emitter. It will replace `trackGtmEvent` when GTM/CAPI rollout is formalized.
3. **Direct frontend `capi-event` calls** — Frontend stays vendor-agnostic. CAPI relay is owned by the server canonical lane and GTM server-side container.

## Arc 1.5 — Browser/Server `event_id` Parity (active)

Browser dataLayer fires for `quote_uploaded`, `phone_verified`, and `report_revealed` now carry an `event_id` that matches the server-side canonical event id 1:1, so GTM (browser → Meta/Google) can deduplicate against the server-side CAPI/Google dispatch.

| Event | Browser source of `event_id` | Server source of `event_id` |
|---|---|---|
| `quote_uploaded` | `buildCanonicalEventId({ eventName, leadId, scanSessionId })` in `UploadZone.tsx`, forwarded to `scan-quote` as `body.event_id` | `scan-quote` reuses `client_event_id` when supplied; falls back to `defaultCreateId` otherwise |
| `phone_verified` | Server-issued id returned from `verify-otp` (`phone_verified_event_id`), reused by `PostScanReportSwitcher.tsx` in the dataLayer push | `verify-otp` generates `wmc_phone_verified_lead-{leadId}_scan-{scanSessionId}` |
| `report_revealed` | Server-issued id returned from `verify-otp` (`report_revealed_event_id`), stored in a ref and used when the reveal effect fires | `verify-otp` generates `wmc_report_revealed_lead-{leadId}_scan-{scanSessionId}` |

Mapper coverage was extended so the server lane is no longer silently suppressed: `phone_verified` → Meta `CompleteRegistration` / Google `wm_phone_verified`; `report_revealed` → Meta `ViewContent` / Google `wm_report_revealed`. Their value rungs remain unset (fall through to `0`) — no fabricated value inflation.
