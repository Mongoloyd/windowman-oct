I understand the directive: do not keep trying to “fix” the working user-facing site right now. The mobile incognito path works, so the safe move is documentation only.

Current baseline observed:
- Latest commit SHA: `e6781b439089bbb95e2f52873ae9e88130ce6e41`
- Latest commit message: `Reset scan state and IDs`

Files inspected read-only:
- `src/hooks/useAnalysisData.ts`
- `src/services/reportService.ts`
- `src/services/phoneVerificationService.ts`
- `src/components/UploadZone.tsx`
- `src/pages/Index.tsx`
- `src/state/scanFunnel.tsx`
- Browser/network context supplied in the prompt

Planned change after approval:
- Create one markdown audit file only.
- Proposed path: `docs/audits/2026-04-30-scanner-error-audit.md`
- Do not edit any frontend, hook, service, Supabase, Edge Function, test, package, or config file.
- Do not change runtime behavior.
- Do not run build/typecheck manually.

The markdown file will include:
1. Baseline
   - Commit SHA and message.
   - Statement that the normal mobile incognito frontend path is currently working and should not be disturbed.

2. Non-action directive
   - “Do not fix these immediately unless a future sprint explicitly scopes them.”
   - “Treat this as a review backlog, not a patch list.”

3. Observed issues / risky code areas
   - DEV bypass can mask production OTP behavior in local/preview contexts when `wm_dev_secret` is present.
   - `fetchFullViaDevBypass` currently normalizes any Edge Function error into generic `dev_bypass_error`, so a 404 “analysis not ready/no complete analysis” state is not represented as a controlled domain state.
   - `doDevBypassFetch` in `useAnalysisData.ts` throws on non-ok service results, which can turn expected/controlled backend states into generic exception handling.
   - `phoneVerificationService.ts` allows `scanSessionId` to be omitted for `sendOtp` / `verifyOtp`; this may be intentional for some flows but is risky for strict scan-bound OTP unlock integrity.
   - `UploadZone.tsx` has diagnostic logging and telemetry that may include file names/storage paths/error details; useful in DEV, but should be reviewed for production privacy/noise.
   - Direct `event_logs` insert attempts from the client can hit RLS 403, as shown in the captured network log. This appears non-fatal but creates noise and may hide real telemetry.
   - The preview polling loop in `useAnalysisData.ts` has a fixed retry window; if OCR/scoring takes longer, the UI may show “Analysis not found” even though backend processing is simply late.
   - `scan_sessions?select=lead_id` returned an empty array in captured network logs for an invalid scan session; this may be expected RLS behavior, but it is worth documenting because it affects client-side recovery assumptions.
   - Console warnings about refs passed to function components (`ExitIntentPhoneModal`, `Footer` via `LazySection`) are currently noisy but not the scanner breakage.
   - HEIC validation is MIME-based; some phones/browsers may provide empty or alternate MIME types even for acceptable images.

4. Golden Thread / identity notes
   - `lead_id` persists in `ScanFunnelProvider` localStorage.
   - `session_id` is separate context and should survive scan reset unless explicitly starting a new journey.
   - `scan_session_id` is per scan and should be cleared when changing files after terminal scan states.
   - `quote_file_id` is per uploaded quote file and should be cleared with scan session reset.
   - Full report must remain backend-gated through `get_analysis_full` / verified access, except explicit DEV bypass paths.

5. Deferred review questions for a future sprint
   - Should OTP service calls hard-fail client-side if `scanSessionId` is missing?
   - Should dev bypass errors distinguish `analysis_not_ready`, `invalid_scan_session`, `unauthorized_dev_secret`, and generic function failures?
   - Should event logging go through an Edge Function instead of direct `event_logs` inserts from the browser?
   - Should preview polling use backend status as the primary source instead of retrying preview RPC for a fixed duration?
   - Should diagnostic logs be DEV-only or sanitized further in production?

6. Explicit non-changes
   - No code changed.
   - No Edge Function contract changed.
   - No OTP production path changed.
   - No RLS changed.
   - No frontend behavior changed.
   - No `dev-report-unlock` behavior changed.

Success criteria:
- Exactly one new `.md` file is created.
- The live site behavior remains untouched.
- The file is useful as a future review checklist, not an instruction to blindly refactor.
- It clearly separates “observed risk” from “confirmed active user-facing bug.”