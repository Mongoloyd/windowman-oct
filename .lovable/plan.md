## Goal

Add a new thin, full-width "EXECUTIVE SUMMARY" band that sits **above** the `▢ SCOPE OVERVIEW` section and **below** the blurred Top Forensic Findings. Also surface a one-line issue count ("We found N issues with your estimate.") on the partial reveal hero.

## What to build

### 1. New component: `src/components/forensic-report/ExecutiveSummaryBand.tsx`

A thin, full-width section (roughly half the height of the Scope Overview tile row, ~80–96px tall) containing:

- Section label: `▦ EXECUTIVE SUMMARY` — same `fr-mono text-[11px] font-bold text-[hsl(var(--fr-cyan))]` style used by other section headers.
- Issue-count line (when `flagRedCount + flagAmberCount > 0`):
  - `We found <N> issues with your estimate.`
  - N is computed from props (red + amber). Red number colored `--fr-danger`, total bolded.
- Summary sentence:
  - `This quote shows multiple high-risk issues, including contract traps and missing technical proof that should be resolved before signing.`
  - Rendered in `text-[hsl(var(--fr-text))]` at ~`text-sm sm:text-base`, single-line on desktop, wraps on mobile.
- Container: uses existing `fr-card` styling with reduced vertical padding (`py-3 sm:py-4 px-5 sm:px-6`) so the band reads as a thin strip, full-width inside the existing `max-w-6xl` container — matches the width of the Scope Overview row.

Props:
```ts
{ flagRedCount: number; flagAmberCount: number; summary?: string | null; }
```

`summary` defaults to the static sentence above when not supplied (it will later be wired to live OCR-derived copy).

### 2. Wire it into `ForensicAuditReport.tsx`

Render `<ExecutiveSummaryBand />` between `<TopFindingsList>`/`PartialUnlockOverlay` block and `<ScopeOverviewCard>`, in **both** `preview` and `full` modes. Pass `flagRedCount` and `flagAmberCount` from props.

### 3. Partial reveal: add issue-count line

In `PartialRevealHero.tsx`, add a single short line under the subtitle (or inside the locked teaser block) that reads:
`We found <N> issues with your estimate.` — using `flagRedCount + flagAmberCount`. No detail breakdown — preserves the verify-to-reveal moat.

## Files changed

- **new** `src/components/forensic-report/ExecutiveSummaryBand.tsx`
- **edit** `src/components/forensic-report/ForensicAuditReport.tsx` — insert band between Top Findings and Scope Overview
- **edit** `src/components/forensic-report/PartialRevealHero.tsx` — add one-line issue count

## Out of scope

- No backend, RPC, or scoring changes. The dynamic issue count already flows through existing props (`flagRedCount`, `flagAmberCount`); when live OCR data lands, the number updates automatically.
- No changes to `ExecutiveSummaryCard` (the larger top card) — this new band is a separate, narrower strip lower in the page.
