Plan: Diagnosis CTA Refinement + Phone-Call Intent Tracking

Scope: `src/pages/diagnosis/components/StepIntake.tsx` only unless typecheck exposes a local import issue. This is visual-only plus frontend dataLayer tracking. No Supabase writes, backend calls, routing changes, modal creation, OTP/Twilio changes, scan logic, report logic, storage, or diagnosis state behavior changes.

1. Replace the heavy sticky CTA
- Remove the fixed dark slab CTA (`bg-slate-950/95`) and blue button (`bg-blue-600`).
- Add a compact floating white/orange consultation ticket:
  - Mobile: centered bottom, `left-1/2`, `-translate-x-1/2`, `w-[calc(100%-32px)]`, `max-w-[360px]`.
  - Desktop: bottom-right, `md:left-auto`, `md:right-6`, `md:translate-x-0`, `md:max-w-[340px]`.
- Use a warm orange radial glow wrapper, amber border, white/glass surface, tactile orange/slate shadow, dark text, and `ArrowRight` on the right.

2. Remove dishonest scroll behavior
- Remove `useRef`, `rootQuestionRef`, and the `handleStickyCta` scroll-to-question behavior.
- Keep the CTA label “Schedule Free Measurement,” but do not pretend to schedule or scroll.
- Add the requested local TODO comment:
  - `// TODO: wire this CTA to the PhoneCaptureForm / scheduling modal.`
  - `// For now, this click only records phone-call intent tracking.`

3. Add frontend conversion tracking only
- Use the existing canonical business-event helper `trackGtmEvent` from `@/lib/trackConversion` because it pushes vendor-agnostic events into `window.dataLayer` and does not write to Supabase.
- On CTA click, generate `eventId` with `crypto.randomUUID()` and call:
  - event name: `wm_phone_call_cta_click`
  - top-level fields: `event_id`, `category`, `source`, `conversion_type`, `value: 200`, `currency: "USD"`
  - metadata: `category: "opt"`, `funnel_step: "diagnosis_step_1"`, `cta_label`, `report_grade`, `top_insight_count`
- Do not include PII: no email, phone, lead ID, or homeowner identity.
- Do not call Meta Pixel, Google Ads, Supabase, or any backend function directly.

4. Mobile polish
- Change section padding from mobile `pb-28` to `pb-40`, keeping desktop `md:pb-32`, so the floating ticket does not cover answer cards.
- Compact the audit card on mobile by reducing mobile padding/gaps and making the “Next” strip smaller while preserving the premium glass style.
- Keep the answer grid symmetrical.
- Change answer label typography from `font-bold` to `font-semibold`.

5. Validation
- Run typecheck after implementation.
- Final report will include:
  1. files changed
  2. CTA visual changes
  3. CTA action decision
  4. tracking event name
  5. tracking payload fields
  6. confirmation no PII is tracked
  7. confirmation no Supabase/backend code was added
  8. mobile polish changes
  9. typecheck result