Baseline confirmed: latest git commit is `47b46443 Added OTP scan-session guard`.

Plan to implement the requested regression tests without touching production behavior:

1. Touch only `src/components/post-scan/PostScanReportSwitcher.test.tsx`
   - Do not edit Edge Functions, OTP services, routing, upload, storage, report styling, database/RLS, or production component files.
   - Do not create a `ReportClassic.test.tsx` in this pass because no existing ReportClassic harness is present and building one would require broad mocks; per your instruction, that should be separate if needed.

2. Update the existing `TruthReportClassic` test mock
   - Add the required controlled OTP input:
     ```tsx
     <input
       data-testid="otp-input"
       value={gateProps?.otpValue ?? ""}
       onChange={(e) => gateProps?.onOtpChange?.(e.target.value)}
     />
     ```
   - Keep the existing mock buttons for `otp-submit`, `phone-submit`, and `resend`.
   - This lets tests exercise the real `PostScanReportSwitcher` handler path instead of manually calling mocked pipeline functions.

3. Add a focused guard regression suite for `PostScanReportSwitcher`
   - Shared setup will mock:
     - funnel state
     - `usePhonePipeline`
     - `toast.error`
     - `onVerified`
   - Assertions will verify no guarded action leaks past invalid session checks.

4. Add missing/invalid verify-block tests
   - `scanSessionId: null`, phone present, `phoneStatus: "otp_sent"`.
   - `scanSessionId: "not-a-valid-uuid"`, phone present, `phoneStatus: "otp_sent"`.
   - Action: set OTP with the rendered `otp-input`, then click `otp-submit`.
   - Assert:
     - `pipeline.submitOtp` not called
     - `funnel.setPhone` not called with verified
     - `funnel.setPhoneStatus` not called with verified
     - `onVerified` not called
     - `toast.error("We lost the scan session. Please restart the scan.")` called

5. Add missing-session send/resend-block tests
   - Phone submit/send:
     - `scanSessionId: null`
     - click `phone-submit`
     - assert `pipeline.submitPhone` not called, no `sending_otp` funnel mutation, and toast error called.
   - Resend:
     - `scanSessionId: null`, phone present, `phoneStatus: "otp_sent"`
     - click `resend`
     - assert `pipeline.resend` not called, no `sending_otp` funnel mutation, and toast error called.

6. Replace the current weak successful-OTP test with a real handler-driven test
   - Use a valid UUID.
   - Set OTP through `otp-input` with `fireEvent.change(... "123456")`.
   - Click `otp-submit`.
   - Assert:
     - `pipeline.submitOtp` called once with `"123456"`
     - `funnel.setPhone("+13055551234", "verified")` called
     - `onVerified("+13055551234")` called
   - Remove the existing manual mock invocation pattern that directly calls `submitOtpMock` and manually invokes `onVerified`, because it does not test the component invariant.

7. Verification command to run after implementation
   - `bunx vitest run src/components/post-scan/PostScanReportSwitcher.test.tsx`

Final output after implementation will include:
1. files changed
2. tests added
3. exact invariant each test proves
4. command to run the tests
5. confirmation that no production behavior changed
6. confirmation that no Edge Functions were touched

And will end exactly with:
`✅ COMMIT READY. Please verify the latest git commit before continuing.`