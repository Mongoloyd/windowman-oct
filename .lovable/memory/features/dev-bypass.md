Dev OCR bypass system for deterministic testing of the scoring pipeline.

## How it works
- `supabase/functions/scan-quote/index.ts` accepts `dev_extraction_override` + `dev_secret` in request body
- When `dev_secret` matches `DEV_BYPASS_SECRET` env var, skips Gemini OCR (steps 3-7)
- Feeds override directly into classification gate → scoring → flag detection → analyses upsert
- Produces identical DB records as a real scan

## Secrets
- `DEV_BYPASS_SECRET` — Supabase edge function secret (runtime). **Only real enforcement boundary.**
- Client side: NO build-time env var. The browser stores the dev secret in
  `localStorage.wm_dev_secret`, prompted once via `window.prompt()` on the
  first explicit DEV action (e.g. clicking a scenario in `DevQuoteGenerator`).
  See `src/lib/devSecret.ts` (`getDevSecret` prompts; `peekDevSecret` does not).
  Cancel the prompt → normal OTP flow runs unchanged.

## Client consumers (all DEV-gated via `import.meta.env.DEV`)
- `src/hooks/useAnalysisData.ts` — `peekDevSecret()` for full report fetch
- `src/components/dev/DevQuoteGenerator.tsx` — `getDevSecret()` (prompts on click)
- `src/components/TruthReportFindings/VerifyGate.tsx` — `peekDevSecret()` auto-skip; never calls `send-otp`/`verify-otp` on bypass path
- `src/services/adminDataService.ts` — `peekDevSecret()` → `x-dev-secret` header

## Fixtures
- 14 scenarios in `src/test/createMockQuote.ts` as `SCENARIO_FIXTURES`
- Each has a complete `ExtractionResult` + `expectedGrade` or `expectedTerminal`
- Scenarios: gradeA, gradeB, gradeC, gradeD, gradeF, mixedPillars, cornerCutting, overpaymentTrap, vagueScope, missingWarranty, finePrintTrap, insuranceSensitive, invalidDocument, lowConfidence

## Rubric v1.1.0 calibration (2026-03-20)
- Thresholds: A≥88, B≥70, C≥52, D≥37, else F
- Safety penalties: DP 25/item cap 50, NOA 20/item cap 40
- Hard caps: no warranty→max C, safety<25→max C, no impact→max D, zero items→F
- Fixture adjustments: gradeB (removed NOA/disposal/details), mixedPillars (added minimal warranty), overpaymentTrap (2 items, 1 missing NOA, no cancellation)

## Dev UI
- `src/components/dev/DevQuoteGenerator.tsx` — bypass mode + inline result inspector
- Shows actual vs expected grade, pillar statuses, flag counts, rubric version
- "Run All Scenarios" button for batch testing
- Single-scenario runs skip page transition (onScanStart not called)

## ScanTheatrics grade fix
- `ScanTheatrics` now accepts `grade` prop (default "C")
- `Index.tsx` passes `analysisData?.grade` to ScanTheatrics
