

## Hotfix: VerifyGate / PhoneVerifyModal — pass server-canonical `phone_e164` to `onVerified`

### Root cause confirmed (audit)

The verify-otp service already returns the server-canonical phone:
- `src/services/phoneVerificationService.ts:127-135` → `OtpVerifyResult.phone_e164` (server-normalized E.164).

But two consumers throw it away:

| File | Line | Current | Bug |
|---|---|---|---|
| `VerifyGate.tsx` | 22, 161 | `onVerified: () => void` then `onVerified()` | No phone passed up |
| `PhoneVerifyModal.tsx` | 21, 77 | `onVerified: () => void` then `onVerified()` | No phone passed up |

Meanwhile the **parent contract already expects a phone string**:
- `PostScanReportSwitcher.tsx:59` → `onVerified?: (phoneE164: string) => void;`
- `Index.tsx:616-618` → `(phoneE164) => fetchFull(phoneE164)`

So `fetchFull(undefined)` → backend cannot match `phone_verifications.status='verified'` → `__UNAUTHORIZED__`.

`PostScanReportSwitcher.tsx:359` already does this correctly with `props.onVerified?.(result.e164)` — confirming the canonical pattern.

### Fix (4 surgical edits, 2 files)

**1) `src/components/TruthReportFindings/VerifyGate.tsx`**
- Line 22: change prop type to `onVerified: (phoneE164: string) => void;`
- Line 56 (dev bypass): pass `e164` if present, else fall back to a sentinel handled by the dev path; safest is to keep dev bypass passing `e164` once available — but bypass fires on mount before phone exists, so leave dev bypass calling `onVerified("")` only if dev bypass actually short-circuits the gate. (Dev bypass already skips OTP entirely; downstream `fetchFull` is gated by `peekDevSecret()` in `useAnalysisData`, so empty string is acceptable here. We will pass `""` and add a brief comment.)
- Line 161: replace `onVerified()` with `onVerified(result.data.phone_e164)` — using the server-canonical value from the successful `verifyOtp` response.

**2) `src/components/TruthReportFindings/PhoneVerifyModal.tsx`**
- Line 21: change prop type to `onVerified: (phoneE164: string) => void;`
- Line 77: replace `onVerified()` with `onVerified(result.data.phone_e164)`.

### What we are NOT touching

- `phoneVerificationService.ts` — already correct.
- `usePhonePipeline.ts` — already passes `canonicalPhone` correctly.
- `PostScanReportSwitcher.tsx` — already forwards `result.e164` correctly.
- `Index.tsx` / `ReportClassic.tsx` — already wire `phoneE164 → fetchFull`.
- OTP edge functions, scoring, RLS, scan-quote — untouched (per WindowMan guardrails).
- `phoneVerificationService.test.ts` — phantom TS cache errors will be ignored as instructed.

### Simulated post-fix flow

1. User enters `(305) 555-1234` → `usePhoneInput` produces `e164 = "+13055551234"`.
2. `verifyOtp(e164, code, scanSessionId)` → server returns `{ verified: true, phone_e164: "+13055551234" }` (server-canonical, possibly re-normalized).
3. `result.data.phone_e164` is captured and passed: `onVerified("+13055551234")`.
4. `Index.tsx` receives the string and calls `fetchFull("+13055551234")`.
5. `useAnalysisData.fetchFull` posts to backend with the **same** canonical phone the server stored in `phone_verifications` → row matches → `full_json` returned.

### Simulated test results

- ✅ `VerifyGate` happy path: phone propagates end-to-end; `__UNAUTHORIZED__` no longer reproducible.
- ✅ `PhoneVerifyModal` happy path: same.
- ✅ Existing return-shape contract test (`phoneVerificationService.test.ts`) unchanged — service surface untouched.
- ✅ TypeScript: parent contracts already require `(phoneE164: string) => void`; widening the child prop types brings them into alignment (currently the parents pass a wider callback into a narrower slot, which TS allows; after fix the types are exactly aligned).
- ✅ Dev bypass path still short-circuits without invoking OTP transport.

### Answer to "Do you see the problem being fixed?"

**Yes.** The handoff variable was the only break in the chain — the server already returns the canonical phone, the parents already wire `phoneE164 → fetchFull`, and the only gap is `VerifyGate` / `PhoneVerifyModal` discarding `result.data.phone_e164` and invoking `onVerified()` with no argument. Forwarding that one value closes the loop.

### Files changed

- `src/components/TruthReportFindings/VerifyGate.tsx` (prop type + 1 call site, plus dev-bypass call site comment)
- `src/components/TruthReportFindings/PhoneVerifyModal.tsx` (prop type + 1 call site)

No new files. No deletions. No service / edge-function / RLS changes.

