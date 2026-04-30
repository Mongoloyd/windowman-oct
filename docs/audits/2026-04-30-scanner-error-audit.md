# Scanner Error / Risk Audit — 2026-04-30

## Baseline

- Latest commit SHA observed: `e6781b439089bbb95e2f52873ae9e88130ce6e41`
- Latest commit message observed: `Reset scan state and IDs`
- User-observed status: the normal site is working on cell phone in incognito.
- Directive: do **not** keep trying to fix the working user-facing path right now.

## Non-action directive

This file is a review backlog, not an instruction to patch immediately.

Do not fix these items unless a future sprint explicitly scopes the work, defines target files, and confirms the user-facing path is failing or the risk is worth addressing.

## Files inspected read-only

- `src/hooks/useAnalysisData.ts`
- `src/services/reportService.ts`
- `src/services/phoneVerificationService.ts`
- `src/components/UploadZone.tsx`
- `src/pages/Index.tsx`
- `src/state/scanFunnel.tsx`
- Supplied browser console/network/session context

## Observed issues and risky code areas

### 1. DEV bypass can mask production OTP behavior

`useAnalysisData.ts` enables a DEV report bypass when `import.meta.env.DEV` is true and `localStorage.wm_dev_secret` exists via `peekDevSecret()`.

Risk:
- DEV/preview testing may skip `get_analysis_full` and therefore fail to exercise the production OTP unlock path.
- A local/preview bug may appear to be an OTP bug when the actual flow used `dev-report-unlock`.

Important boundary:
- This appears DEV-gated, not a normal production-user path.
- Do not remove it casually because it is used for deterministic testing.

Future review question:
- Should DEV bypass require an explicit user action per session instead of auto-activating whenever the secret exists?

### 2. `dev-report-unlock` 404 is treated too generically

Captured network showed:

- Request: `POST /functions/v1/dev-report-unlock`
- Status: `404`
- Body: `{"error":"No complete analysis found for this scan session"}`

Current frontend service behavior in `src/services/reportService.ts`:
- `fetchFullViaDevBypass()` maps any Edge Function error to `code: "dev_bypass_error"`.

Risk:
- A normal “analysis not ready / no complete analysis” condition is not represented as a specific domain state.
- The hook cannot reliably distinguish “try again later” from “real dev bypass failure.”

Future review question:
- Should 404 from `dev-report-unlock` normalize to `analysis_not_ready` while non-404 failures stay `dev_bypass_error`?

### 3. `doDevBypassFetch` throws from a service-result path

In `src/hooks/useAnalysisData.ts`, `doDevBypassFetch()` calls `fetchFullViaDevBypassService()`. If the result is not ok, it throws `new Error(err.message)`.

Risk:
- Controlled backend outcomes can become generic exceptions.
- Exceptions then land in broader catch blocks and can produce vague UI messages.

Important boundary:
- This affects DEV bypass behavior, not necessarily the normal production OTP path.

Future review question:
- Should DEV bypass return typed service results all the way through the hook instead of throwing?

### 4. OTP service allows missing `scanSessionId`

In `src/services/phoneVerificationService.ts`:

- `sendOtp(phoneE164, scanSessionId?)`
- `verifyOtp(phoneE164, code, scanSessionId?)`

Both allow `scanSessionId` to be omitted and send `undefined` in the request body.

Risk:
- For strict scan-bound unlock integrity, OTP should ideally bind to the exact `scan_session_id` being unlocked.
- If any caller accidentally omits the scan session ID, the backend must be the final protection boundary.

Important boundary:
- Backend verification may already reject or safely handle missing scan IDs.
- Do not change this client behavior without auditing all OTP callers and Edge Function contracts.

Future review question:
- Should the frontend service fail closed when `scanSessionId` is missing, or should the backend remain the only enforcement point?

### 5. Client direct `event_logs` insert can hit RLS 403

Captured network showed:

- Request: `POST /rest/v1/event_logs`
- Status: `403`
- Error: `new row violates row-level security policy for table "event_logs"`
- Event: `fetch_stall_retry`

Risk:
- Telemetry may silently fail or create console/network noise.
- Failed operational logging can obscure the actual scanner state during debugging.

Important boundary:
- This does not appear to break the normal user scan path directly.
- Do not weaken RLS to fix logging convenience.

Future review question:
- Should operational telemetry go through a dedicated Edge Function instead of direct browser inserts?

### 6. Preview polling has a fixed retry window

In `src/hooks/useAnalysisData.ts`, preview loading retries up to 8 times with about 2.5 seconds between attempts.

Risk:
- If OCR/scoring takes longer than the retry window, the UI may show “Analysis not found” even while backend processing is still legitimately ongoing.
- This can look like a scanner failure when it is actually delayed processing.

Current mitigating behavior:
- On retry attempts, the hook checks `get_scan_status` and handles terminal non-preview statuses like `invalid_document`, `needs_better_upload`, `error`, `failed`, and `unreadable`.

Future review question:
- Should backend scan status become the primary polling source, with preview RPC fetched only after status indicates preview/full readiness?

### 7. Empty `scan_sessions` lookup appeared in captured network

Captured network showed:

- Request: `GET /rest/v1/scan_sessions?select=lead_id&id=eq.bbb2b49a-2fbe-4747-9270-67cdc81cc017`
- Status: `200`
- Body: `[]`

Risk:
- Client-side recovery code may assume the row is readable when RLS or ownership rules return no row.
- Empty row reads can make a real scan session look missing from the browser perspective.

Important boundary:
- This may be correct RLS behavior.
- Do not weaken table policies without a formal backend security review.

Future review question:
- Should recovery read paths use a safe RPC/Edge Function that returns only the minimal authorized state?

### 8. UploadZone has useful but noisy diagnostics

`src/components/UploadZone.tsx` contains diagnostic logging around storage upload, bootstrap, retry, scan invocation, and error details.

Risk:
- Console noise can make real errors harder to spot.
- File names, storage paths, and raw error objects may appear in browser logs.

Current mitigating behavior:
- Some logs are DEV-gated.
- User-facing messages are generally generic.

Future review question:
- Should production logs be reduced to static error codes only, with no file names/storage paths/raw SDK errors?

### 9. HEIC validation is MIME-based

`UploadZone.tsx` allows:

- `application/pdf`
- `image/jpeg`
- `image/png`
- `image/webp`
- `image/heic`

Risk:
- Some phones/browsers may provide an empty MIME type or alternate HEIC/HEIF type.
- A valid phone photo may be rejected even though the file extension is acceptable.

Current observed status:
- User reports phone incognito flow is working, so do not change this now.

Future review question:
- Should validation allow known HEIC/HEIF extensions when MIME is empty or inconsistent?

### 10. Ref warnings are present but probably unrelated

Console showed React warnings:

- Function components cannot be given refs.
- Mentioned `ExitIntentPhoneModal` / `AnimatePresence`.
- Mentioned `Footer` rendered through `LazySection` from `Index`.

Risk:
- Console noise during debugging.
- Potential future incompatibility if these components rely on refs or animations.

Current observed status:
- These warnings do not appear to be the scanner user-facing failure.

Future review question:
- Should these components be wrapped with `React.forwardRef`, or should the parent stop passing refs to function components?

## Golden Thread / identity notes

These are not necessarily bugs. They are the identity invariants to preserve in future scanner work.

- `lead_id` is persistent identity and is stored in `ScanFunnelProvider` state/localStorage.
- `session_id` is separate context and should survive scan reset unless the whole journey is intentionally restarted.
- `scan_session_id` is per scan and should be cleared when changing files after terminal scan states.
- `quote_file_id` is per uploaded quote file and should be cleared with scan session reset.
- Full report data must remain backend-gated through `get_analysis_full` / verified access, except explicit DEV-only bypass paths.
- Do not expose `full_json` to the client before backend authorization.
- Do not weaken RLS to make browser debugging easier.

## Captured backend call sequence from observed failing DEV path

From supplied network context, the browser performed calls like:

1. `get_analysis_preview`
   - Returned `[]`.
2. `get_scan_status`
   - Returned status `invalid_document` for scan session `bbb2b49a-2fbe-4747-9270-67cdc81cc017`.
3. `scan_sessions?select=lead_id`
   - Returned `[]`.
4. `event_logs` insert
   - Returned RLS `403`.
5. `dev-report-unlock`
   - Returned `404` with “No complete analysis found for this scan session.”

Interpretation:
- The observed 404 appears consistent with trying to unlock a full report for a scan session that does not have a complete analysis.
- That should be treated as a controlled not-ready/no-analysis state in DEV tooling, not as proof the normal incognito user flow is broken.

## Deferred review questions

1. Should OTP service calls hard-fail client-side if `scanSessionId` is missing?
2. Should DEV bypass errors distinguish `analysis_not_ready`, `invalid_scan_session`, `unauthorized_dev_secret`, and generic function failures?
3. Should event logging go through an Edge Function instead of direct `event_logs` inserts from the browser?
4. Should preview polling use backend status as the primary source instead of retrying preview RPC for a fixed duration?
5. Should diagnostic logs be DEV-only or sanitized further in production?
6. Should HEIC/HEIF file validation tolerate phone-browser MIME inconsistencies?
7. Should ref warnings be cleaned up in a separate UI hygiene sprint?

## Explicit non-changes made by this audit

- No frontend behavior changed.
- No scanner logic changed.
- No hook or service code changed.
- No Edge Function contract changed.
- No OTP production path changed.
- No Supabase/RLS policy changed.
- No `dev-report-unlock` behavior changed.
- No package/config/test files changed.

## Recommended handling

Do not patch any of this immediately while the normal mobile incognito path is working.

Use this document later to scope a narrow sprint with:

- exact target files,
- one failure mode,
- one expected user flow,
- explicit no-touch files,
- and a clear rollback point.
