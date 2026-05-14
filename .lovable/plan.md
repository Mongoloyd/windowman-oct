## ROLE:  
Act as a senior React/Supabase engineer for WindowMan.  
  
TASK:  
Fix the dev-bypass precedence bug after OTP verification.  
  
This is a small surgical bugfix. Do not redesign UI. Do not touch backend infrastructure.  
  
GOAL:  
After OTP verification, `fetchFull(phoneE164)` must always call the normal gated full-report RPC:  
  
fetchAnalysisFull(scanSessionId, phoneE164)  
  
Dev bypass may only run when no valid phoneE164 is available, and only in DEV mode when a stored dev secret exists.  
  
BUG:  
After a user enters a phone number at partial reveal, receives OTP, and enters the OTP code, the app can call:  
  
/functions/v1/dev-report-unlock  
  
instead of the normal:  
  
rpc/get_analysis_full  
  
Observed runtime error:  
Edge function returned 404: {"error":"Not found"}  
filename: supabase/functions/dev-report-unlock/index.ts  
  
ROOT CAUSE:  
In `src/hooks/useAnalysisData.ts`, the current logic enables dev bypass when:  
  
[import.meta.env.DEV](http://import.meta.env.DEV) && !!peekDevSecret()  
  
Then `fetchFull(phoneE164)` chooses dev bypass before checking whether a real phoneE164 exists.  
  
That means a stale localStorage value at `wm_dev_secret` can hijack the real OTP unlock path in Lovable/dev preview.  
  
CORRECT PRECEDENCE:  
Real OTP unlock always wins.  
  
Required behavior:  
  
if (phoneE164 is present and valid E.164) {  
 call fetchAnalysisFull(scanSessionId, phoneE164)  
} else if (devBypassEnabled) {  
 call doDevBypassFetch(scanSessionId)  
} else {  
 set a safe fullFetchError such as "Verification required to unlock report."  
}  
  
Dev bypass must never override a real phone-based unlock.  
  
STRICT CONSTRAINTS:  
Do not modify Edge Functions.  
Do not modify Supabase schema.  
Do not modify RLS.  
Do not modify storage policies.  
Do not modify Twilio logic.  
Do not modify send-otp.  
Do not modify verify-otp.  
Do not modify scan-quote.  
Do not modify start-upload-scan-session.  
Do not modify reportService.ts unless absolutely required and reported first.  
Do not change RPC names.  
Do not change RPC params.  
Do not change OTP verification behavior.  
Do not change scan/upload behavior.  
Do not change preview/full reveal authorization.  
Do not change UI design.  
Do not add fallback from failed get_analysis_full to dev-report-unlock.  
Do not expose phone_e164, lead_id, scan_session_id, request bodies, response bodies, logs, or full_json in UI.  
  
PREFERRED FILES:  
Modify only:  
- src/hooks/useAnalysisData.ts  
  
Optionally modify or add one focused test file only if existing test infrastructure supports it.  
  
TEST-FIRST REQUIREMENT:  
Before editing production code:  
  
1. Verify whether `src/hooks/useAnalysisData.fetchFull.test.ts` actually exists.  
  
2. If it exists:  
 - Add one failing test proving:  
 - `peekDevSecret()` returns a value  
 - `fetchFull(validPhoneE164)` is called  
 - `fetchAnalysisFull(scanSessionId, validPhoneE164)` is called  
 - `fetchFullViaDevBypassService` is NOT called  
 - Do not weaken, delete, or rewrite existing tests.  
  
3. If that exact file does not exist:  
 - Check whether the repo already has Vitest/test infrastructure.  
 - If yes, create the smallest focused test file for this hook behavior.  
 - If no suitable test infrastructure exists, do not introduce a new framework. Report that and proceed with the smallest production fix.  
  
4. If any existing test fails unexpectedly, stop and report the failure. Do not rewrite tests to hide a regression.  
  
PRODUCTION FIX REQUIREMENTS:  
  
1. Add a local E.164 phone validator near the existing UUID validation logic:  
  
const E164_RE = /^\+[1-9]\d{7,14}$/;  
const isValidPhone = (p: string | null | undefined): p is string =>  
 typeof p === "string" && E164_RE.test(p.trim());  
  
2. In `fetchFull(phoneE164)`:  
 - Check for valid phoneE164 before checking devBypassEnabled.  
 - If phoneE164 is valid, always call:  
 fetchAnalysisFull(scanSessionId, phoneE164)  
 - If phoneE164 is valid, never call:  
 doDevBypassFetch(scanSessionId)  
 - If fetchAnalysisFull returns unauthorized or another error, surface the existing safe fullFetchError.  
 - Do not fallback to dev-report-unlock.  
  
3. In `tryResume()`:  
 - Read the stored verifiedAccess record as it does now.  
 - If a valid stored `record.phone_e164` exists, always call:  
 fetchAnalysisFull(scanSessionId, [record.phone](http://record.phone)_e164)  
 - Dev bypass may only run when no valid verifiedAccess phone record exists.  
 - If the RPC fails for a stored verifiedAccess phone, clear stale verified access as the code already does.  
 - Do not fallback to dev-report-unlock after a failed RPC.  
  
4. Dev bypass behavior:  
 - Keep dev bypass available for explicit dev/design flows where no phoneE164 is available.  
 - If dev bypass is attempted and returns 404/403, do not crash the app.  
 - Set a safe fullFetchError or return false in tryResume.  
 - Do not show raw function errors to the user.  
  
5. Preserve existing safe logging:  
 - Keep phone_last4-only logging if already present.  
 - Do not log full phone_e164.  
 - Do not log request bodies, response bodies, lead_id, full_json, or secrets.  
  
ACCEPTANCE CRITERIA:  
  
A) Normal OTP path with no dev secret:  
- localStorage.removeItem("wm_dev_secret")  
- User uploads quote  
- Partial reveal appears  
- User enters phone  
- OTP sends  
- OTP verifies  
- Full reveal appears  
- Network shows one get_analysis_full RPC  
- Network shows zero calls to /functions/v1/dev-report-unlock after OTP  
  
B) Normal OTP path with stale dev secret present:  
- localStorage.setItem("wm_dev_secret", "fake")  
- User uploads quote  
- Partial reveal appears  
- User enters phone  
- OTP sends  
- OTP verifies  
- Full reveal appears  
- Network still shows get_analysis_full  
- Network shows zero calls to /functions/v1/dev-report-unlock after OTP  
  
C) Dev bypass path:  
- Dev bypass may only run when no valid phoneE164 is available and DEV mode allows it.  
- If dev-report-unlock returns 404 because DEV_BYPASS_ENABLED is not true, that remains a separate pre-existing environment issue.  
- The app must not white-screen.  
  
AFTER CHANGES REPORT:  
Return:  
- files changed  
- whether `src/hooks/useAnalysisData.fetchFull.test.ts` existed  
- test added/updated, or exact reason no test was added  
- exact production logic change  
- confirmation no Edge Functions changed  
- confirmation no Supabase schema/RLS/storage/Twilio changes  
- confirmation no send-otp/verify-otp/scan-quote/start-upload-scan-session changes  
- confirmation no reportService.ts changes unless explicitly required  
- confirmation real OTP unlock now always uses get_analysis_full  
- confirmation dev bypass cannot override valid phoneE164  
- manual test checklist for cases A, B, and C  
  
FINAL VERDICT REQUIRED:  
SAFE_SURGICAL_FIX: YES/NO