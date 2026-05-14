# Phase 1 — Preflight Plan: Scan Theatrics Visual Polish

Visual-only refinement of the dark forensic scanner experience. Zero changes to data flow, payloads, OTP, reveal gating, or scanner state.

## PREFLIGHT FILES


| File                                       | Controls                                                                                                                                                                                 | Type                                | Touching?                                                                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ScanTheatrics.tsx`         | Dark forensic terminal, X-ray document overlay, [OK] status lines, pillar reveal cards, progress UI. Reads `useScanPolling`, `usePhonePipeline`, `useScanFunnelSafe` for *display only*. | Visual + reads existing logic hooks | YES — visual JSX/Tailwind/CSS only. No hook calls, props, state, effects, payloads, or callbacks modified.                                                  |
| `src/components/OrangeScanner.tsx`         | Sibling scanner visual used on Index above ScanTheatrics. Same scanning ceremony layer.                                                                                                  | Visual                              | YES — visual JSX/Tailwind only.                                                                                                                             |
| `src/components/XRayScannerBackground.tsx` | Decorative scanning bar background wrapper (14 lines, pure presentational).                                                                                                              | Pure visual                         | Possibly — minor opacity/contrast tweak only.                                                                                                               |
| `src/index.css`                            | Houses `.report-dark` and forensic tokens.                                                                                                                                               | Tokens/CSS                          | Possibly — may add 2–4 forensic tokens (e.g., `--scan-ok`, `--scan-active`, `--scan-muted`) used by the components above. No existing token values changed. |


No other files in scope. No new files created.

## PROTECTED FILES — NOT TOUCHED

Confirmed I will NOT touch:

- `supabase/functions/start-upload-scan-session/*`
- `supabase/functions/scan-quote/*`
- `supabase/functions/send-otp/*`
- `supabase/functions/verify-otp/*`
- `src/services/reportService.ts`
- `src/services/phoneVerificationService.ts`
- `src/hooks/useAnalysisData.ts`
- `src/hooks/usePhonePipeline.ts`
- `src/hooks/useScanPolling.ts` (scanner logic — read-only consumer)
- `src/state/scanFunnel.tsx` (state machine — read-only consumer)
- Supabase schema, RLS, storage policies, Twilio config, secrets

No backend payloads, RPC params, Edge Function bodies, OTP transport, preview/full reveal authorization, or scanner state semantics will be changed.

## VISUAL CHANGES (summary)

**Typography & contrast**

- Raise terminal/status line size from ~xs to sm (mobile) / base (desktop); line-height 1.5–1.6.
- Active step: `font-semibold`, full-opacity foreground, subtle blue glow.
- Completed steps: `font-medium` at ~75–80% opacity (not 40%); legible secondary.
- Main scan heading: heavier weight, tracked-tight, larger; clear eyebrow above.
- Replace thin gray `[OK]` with bold amber/emerald token, monospace, slightly enlarged.

**Hierarchy**

- 5-tier visual stack: Title → Active line → Completed lines → Supporting labels → X-ray decoration.
- Active step gets a left accent rule + faint surgical-blue background wash.
- X-ray markers and document silhouette dropped to lower z-contrast so text always wins.

**Progress / pillar cards**

- Progress bar: thicker (8–10px), inner gradient, inset border, accessible contrast track.
- Pillar cards: stronger card border, clearer header, status chip with icon + label (not color-only).

**Palette discipline**

- Restrained: deep noir surface, single surgical blue (`hsl(210 90% 60%)`), single amber accent (`hsl(30 95% 55%)`), emerald for OK only. No neon.

**Mobile**

- Min 14px terminal text, no clipped lines, single-column pillar stack, progress bar always visible above-the-fold of the panel.

**Motion / a11y**

- Existing Framer Motion easing softened only where already declared. `prefers-reduced-motion` respected (disable typewriter cursor blink + scan bar pulse).
- Status communicated via icon + label + color (not color alone).

## STATE / FLOW INVARIANTS PRESERVED

- No new React state, context, or storage keys.
- No new effects, timers, polling, or retries.
- No new Supabase / RPC / Edge Function calls.
- No new props on `ScanTheatrics` or `OrangeScanner`.
- No exposure of `phone_e164`, `lead_id`, `scan_session_id`, `quote_file_id`, `analysis_id`, request/response bodies, logs, or `full_json`.
- Upload → scan → preview → OTP → full reveal state machine untouched.

## TEST CHECKLIST (post-build)

1. Upload quote → ScanTheatrics renders.
2. Terminal lines readable on 375px mobile and desktop.
3. Active step visually dominant; completed steps still legible.
4. Progress bar visible and high-contrast.
5. Partial reveal appears as before.
6. OTP send + verify unchanged.
7. Full reveal appears as before.
8. Refresh mid-flow does not break reveal state.
9. `prefers-reduced-motion` disables blink/pulse.

## FINAL VERDICT

SAFE_VISUAL_ONLY_CHANGE: **YES**

Proceed with Phase 2 build only under this additional hard constraint:

In ScanTheatrics.tsx and OrangeScanner.tsx, do not modify:

- imports

- hook calls

- useState declarations

- useEffect blocks

- useRef declarations

- useCallback declarations

- timer logic

- polling logic

- navigation logic

- callback props

- function signatures

- scanStatus conditions

- OTP auto-send behavior

- onRevealComplete timing

- invalid_document / needs_better_upload / error handling branches

Allowed edits inside these files are limited to:

- className strings

- inline style visual values

- copy for non-sensitive status labels

- decorative markup that does not read or change state

- Tailwind/CSS visual structure only

If any desired visual change requires touching logic, stop and report it instead of implementing it.  
  
