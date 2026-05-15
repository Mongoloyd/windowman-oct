## Phase 4L.8A — Phone-Only Unlock Gate on Partial Reveal

### Audit (Task 1)

**File:** `src/components/forensic-report/PreviewUnlockSlot.tsx`

- This is the **sandbox/preview-only visual harness** (header docblock confirms it does not call Supabase, send-otp, verify-otp, or fetch reports). It is mounted only via `DevReportPreview` → `/dev/report-preview` and `/sandbox/report-preview`.
- Currently renders: First Name, Last Name, Email, Mobile Number, TCPA checkbox, Send Verification Code CTA, then OTP boxes + Verify CTA + Resend in step `"code"`.
- Phone field has valid (emerald + check), invalid (red + alert), and neutral states already.
- OTP boxes render when local `step === "code"` (after the visual-only "Send" tap).
- **Confirmed safe to edit** — not the production OTP component (`LockedOverlay` is real prod and lives elsewhere; `DemoClassic` uses its own gate orchestration and is untouched).

### Changes

**Single file edited:** `src/components/forensic-report/PreviewUnlockSlot.tsx`

1. **Remove fields** from the `step === "phone"` view: First Name, Last Name, Email inputs, and the TCPA checkbox block. Keep all local state (`phone`, `touched`, `otp`, `sending`, `verifying`, `step`) — no new state added.

2. **Add "case file ready" summary** above the phone field:
   - Small emerald check + label: `Scan complete · Case file created`
   - Heading: **"Unlock Your Private Truth Report"**
   - Sub: "Your scan is complete. Verify your phone to open the full forensic audit."
   - Muted line: "We'll send the full Truth Report to the contact details you already provided." (No invented email — mock data has none here.)

3. **Phone states (visuals preserved, helper copy updated):**
   - Empty/neutral: "We'll text a 6-digit code to unlock your report."
   - Invalid: "Enter a valid mobile number to receive your secure unlock code." (replaces the previous "valid 10-digit US mobile number" text and removes any "prove you're not a bot" framing — that string lives in a different component and isn't touched here)
   - Valid: "Ready to send verification code."
   - CTA label logic preserved: `Send Verification Code` when valid, `Unlock My Report` when empty, `Sending…` while pending.

4. **Trust copy replacement** (footer microcopy under CTA):
   - Replace any contractor-protection framing with: "Your report stays private. We only use your number to send a secure one-time verification code. No spam. No obligation."

5. **Code-sent step:** unchanged structurally — OTP boxes, Verify & Unlock CTA, Resend link all retained. Header swapped to match the new "Private Truth Report" framing.

6. **Card visual polish:** keep existing `bg-slate-900 border-blue-500/25 rounded-2xl shadow-2xl`, dark phone input, blue CTA, emerald valid, red invalid, `min-h-[48px]` mobile spacing. No white inputs.

7. Keep the `DEV PREVIEW · NO REAL OTP IS SENT` footer stamp.

### Out of scope (explicitly NOT touched)

- `LockedOverlay.tsx`, `DemoClassic.tsx`, `usePhonePipeline`, `send-otp`/`verify-otp` Edge Functions, `usePhoneInput`, Supabase, RLS, migrations, routes, `App.tsx`, `DevReportPreview.tsx`, blurred findings, lock overlay, full-mode rendering.
- The pre-upload "Where should we send your Truth Report?" screen — deferred to a later phase as you noted (zip → home type → has-quote/wants-quote branch happens earlier in the funnel).

### Verification

- Visual check at `/sandbox/report-preview?v=v3&mode=preview`: only phone + OTP fields visible, blurred findings + lock overlay intact.
- Visual check at `/sandbox/report-preview?v=v3&mode=full`: unchanged.
- No new state variables, no new network calls, no route changes.

### Final line on completion
`PHASE 4L.8A COMPLETE — Partial Reveal now uses phone-only unlock gate. Logic preserved.`
