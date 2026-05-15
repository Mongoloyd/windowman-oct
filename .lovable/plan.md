# Phase 4L.8B — Premium Partial Reveal Polish

Pure visual/UX pass on the sandbox Partial Reveal (`/sandbox/report-preview?v=v3&mode=preview`). No state, handler, route, backend, or gating changes.

## Preflight audit (report before editing)

Confirm in `PreviewUnlockSlot.tsx`:
1. Sandbox/preview-only — no Supabase, no `send-otp`, no `verify-otp`, no report fetch.
2. Local state only: `step`, `phone`, `touched`, `otp`, `sending`, `verifying`.
3. No First Name / Last Name / Email / TCPA fields present.
4. Phone CTA disabled when `!isValid || sending`; OTP verify disabled when `otp.length !== 6 || verifying`.
5. OTP UI only renders when `step === "code"` (after local 600ms simulated send).
6. Visual states present: neutral / invalid / valid phone, code sent, verifying.

Component ownership map (record in report):
- Hero, grade dial, metric tiles, locked teaser → `PartialRevealHero.tsx`
- Blurred finding cards → `TopFindingsList.tsx`
- Lock overlay → `PartialUnlockOverlay.tsx`
- Phone-only unlock card → `PreviewUnlockSlot.tsx`
- Shell composition → `ForensicAuditReport.tsx`

If any item fails, STOP and report instead of editing.

## Files to touch (visual only)

- `src/components/forensic-report/PartialRevealHero.tsx`
- `src/components/forensic-report/TopFindingsList.tsx` (blurred branch only)
- `src/components/forensic-report/PartialUnlockOverlay.tsx`
- `src/components/forensic-report/PreviewUnlockSlot.tsx`
- `src/components/forensic-report/tokens.ts` (only if a small token addition genuinely helps)
- `src/index.css` (only if a `.report-dark`-scoped helper is genuinely needed)

Forbidden to touch: `App.tsx`, `DevReportPreview.tsx`, `ForensicAuditReport.tsx` (logic), `LockedOverlay.tsx`, `usePhonePipeline`, `usePhoneInput`, edge functions, anything in `src/services`, `src/hooks`, Supabase, RLS, migrations, packages, lockfiles.

## Visual changes

### 1. PartialRevealHero
- Tighten hero rhythm: stronger eyebrow chip ("FORENSIC AUDIT · PREVIEW LOCKED"), refined headline weight/tracking, more confident subtitle:
  - Headline: "Unlock Your Forensic Audit" (kept)
  - Subtitle: "WindowMan reviewed your quote like a private forensic second opinion. Here's the preview of what we found before you sign."
- Grade dial: deeper red radial glow, thin inner ring, small supporting label under dial ("Audit Verdict · Quote Grade"). No grade value or data binding changes.
- Metric tiles: stronger numeric hierarchy (larger mono numerals, smaller label, severity-colored top hairline), tighter mobile stack, even desktop 3-col rhythm. No new metrics, no data shape change.
- Locked teaser block:
  - Eyebrow: "SCAN COMPLETE · CASE FILE READY"
  - Heading: "Unlock Your Private Truth Report"
  - Subheading: "WindowMan found risk signals in your quote. Verify your phone to unlock the full forensic audit."
  - Keep dynamic grade + missingRegulatory + overpayMid sentence; soften secondary line.

### 2. TopFindingsList (blurred branch only)
- Stronger frosted treatment on placeholder cards: slightly denser blur, deeper card border, soft red/amber severity glow on left rail, consistent height.
- Section header copy unchanged structurally; keep "Top Forensic Findings".
- Full-mode branch untouched.

### 3. PartialUnlockOverlay
- Increase frosted glass quality (bg-slate-900/70, stronger backdrop blur, ring-1 ring-blue-500/20, larger lock chip).
- Copy: keep "LOCKED · VERIFICATION REQUIRED" eyebrow; main line: "Verify your phone to unlock the full forensic audit."
- Better mobile centering and max-width.

### 4. PreviewUnlockSlot (phone-only gate polish)
- Header eyebrow → "VERIFICATION REQUIRED" (kept), heading "Unlock Your Private Truth Report", subline "WindowMan found risk signals in your quote. Verify your phone to unlock the full forensic audit."
- Case-file summary chip: keep emerald check + "Scan complete · Case file created"; replace second line with "Your case file is saved. Verify your phone to unlock the full private audit."
- Phone field: keep three states (neutral slate, red invalid, emerald valid + check). Helpers exactly as spec'd.
- CTA: replace `h-13` with `min-h-[52px]`. Keep exact `disabled` condition and `onClick`. Same label logic.
- OTP step: dark slots, stronger focus ring, ensure row fits 390px (use `gap-1.5 sm:gap-2`, `w-10 sm:w-12`). No behavior change.
- Footer trust line unchanged. Keep `DEV PREVIEW · NO REAL OTP IS SENT` stamp.

### 5. tokens.ts / index.css
- Only add a token/helper if it removes a meaningfully repeated literal in the files above. Otherwise skip and list remaining hardcoded classes as "future token cleanup" in the report.

## Guardrails (verify after edit)

- No new imports from `@/integrations/supabase/*`, `@/hooks/usePhonePipeline`, `@/hooks/usePhoneInput`, `@/services/*`.
- No new `useEffect`, no new state variables, no new fetch/RPC/edge calls.
- No name/email/TCPA fields anywhere in `PreviewUnlockSlot`.
- `ForensicAuditReport` still drops real flags in preview (`safeFlags`).
- `/sandbox/report-preview?v=v3&mode=full` still renders unchanged structurally.

## Verification

- `git diff --name-status` — expect only the files listed above.
- Build/typecheck via the harness (no manual `npm run build`).
- Visual QA at 390px and 1280px on `?v=v3&mode=preview` and a smoke check on `?v=v3&mode=full`.

## Final report

Deliver the Phase 4L.8B report with all 19 sections from the spec and end with:

`PHASE 4L.8B COMPLETE — Premium Partial Reveal polish finished. Logic preserved.`
