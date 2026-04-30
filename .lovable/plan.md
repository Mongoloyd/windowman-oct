# Plan: Dark Forensic Dossier — Self-Contained Page

## Scope decision (per "option 1")

The existing `src/components/TruthReportClassic.tsx` is 1009 lines and renders ~14 production child components (`ForensicPillarSection`, `RiskSummaryHeader`, `ExecutiveSummaryStrip`, `RedFlagsList`, `MissingItemsList`, `TopRisksBlock`, `ReportDecisionFork`, `GapFixModule`, `GreenChecklistModule`, `QuotePriceMath`, `LockedOverlay`, `TopViolationSummaryStrip`, `CriticalFlagCard`, `ForensicFindingsPanel`). Re-skinning it in place would either (a) cascade into all 14 children — out of scope and risky — or (b) leave a half-skinned mess.

**Therefore: build the dark theme as a brand-new self-contained component** that lives alongside the production one and is rendered only at `/dev/testing1`. Production `TruthReportClassic` is **not modified at all** this sprint. This satisfies "option 1 — keep this as its own self-contained page and style" and keeps every NO-TOUCH zone untouched.

## Files created (new)

1. **`src/components/dossier-dark/DarkForensicDossier.tsx`** — the new self-contained presentational component. Accepts the same prop shape as `TruthReportClassic` (so it's drop-in compatible later if you choose), but renders the 8 dark-themed sections per spec. Pure presentation — no hooks beyond local `useState` for collapsibles. Uses `lucide-react` icons.
2. **`src/components/dossier-dark/sections/ExecutiveSummary.tsx`** — Section 1 (grade badge + 3 stat boxes + verdict text).
3. **`src/components/dossier-dark/sections/TopForensicFindings.tsx`** — Section 2 (3 critical-finding cards with red left border, blur + lock overlay in preview mode).
4. **`src/components/dossier-dark/sections/PropertyProfile.tsx`** — Section 3.
5. **`src/components/dossier-dark/sections/ProjectScope.tsx`** — Section 4 (full-only).
6. **`src/components/dossier-dark/sections/ProductEngineering.tsx`** — Section 5 (full-only).
7. **`src/components/dossier-dark/sections/Compliance.tsx`** — Section 6 (full-only).
8. **`src/components/dossier-dark/sections/FinancialIntegrity.tsx`** — Section 7 focal point (full-only).
9. **`src/components/dossier-dark/sections/ForensicVulnerabilities.tsx`** — Section 8 (full-only).
10. **`src/components/dossier-dark/primitives/StatusPill.tsx`** — variants: critical / clear / warning / info, with the exact text-stroke + paint-order spec.
11. **`src/components/dossier-dark/primitives/GradeBadge.tsx`** — 24×24 circle, gradient + ring per grade band.
12. **`src/components/dossier-dark/primitives/KeyValueRow.tsx`** — label (txtsecondary) / value (font-mono txtprimary), optional pill, optional `[Edit]`.
13. **`src/components/dossier-dark/primitives/SectionCard.tsx`** — `bg-[#1a1f2e] border border-[#2a2f3e] rounded-xl` wrapper with H2 eyebrow header.
14. **`src/components/dossier-dark/primitives/LockOverlay.tsx`** — centered `bg-black/40 backdrop-blur` overlay with lock icon for preview mode.
15. **`src/components/dossier-dark/fixtures.ts`** — dossier-shaped sample payload (37-signal extraction shape) for the dev page. Self-contained; does not import from `src/dev/fixtures.ts` to keep the dossier module isolated.
16. **`src/pages/DevTesting1.tsx`** — DEV-only page. Renders `<DarkForensicDossier />` with the fixture in both `preview` and `full` modes via a simple top-of-page toggle so you can flip states.

## Files edited (minimal, additive only)

17. **`src/App.tsx`** — add **one** lazy import + **one** route inside the existing `{isDevMode && (...)}` block:
    ```text
    const DevTesting1 = lazy(() => import("./pages/DevTesting1.tsx"));
    <Route path="/dev/testing1" element={<DevTesting1 />} />
    ```
    No other changes. Production routing untouched.

18. **`tailwind.config.ts`** — additive only. Add a **namespaced** `dossier` color group to avoid colliding with the existing `border` / `accent` / `danger` theme tokens that production components depend on:
    ```text
    dossier: {
      surface:      "#0f1419",
      elevated:     "#1a1f2e",
      border:       "#2a2f3e",
      accent:       "#3b82f6",
      "txt-primary":   "#f1f5f9",
      "txt-secondary": "#94a3b8",
      "txt-muted":     "#64748b",
      danger:       "#ff4444",
      success:      "#00ff88",
      warning:      "#ffaa00",
      "info":       "#44aaff",
    }
    ```
    Used as `bg-dossier-elevated`, `text-dossier-danger`, `border-dossier-border`, etc. Production tokens (`border-border`, `bg-accent`, `text-danger`) are unaffected.

## NO-TOUCH (confirmed untouched)

- `src/components/TruthReportClassic.tsx` ← **not modified**
- `src/components/dossier/ForensicFindingsPanel.tsx` ← **not modified** (the new dark version lives in `dossier-dark/`, separate dir)
- `src/hooks/useAnalysisData.ts`, `src/hooks/usePhonePipeline.ts`
- `src/components/post-scan/PostScanReportSwitcher.tsx`
- All edge functions (`send-otp`, `verify-otp`, `get-truth-report`, `scan-quote`, `capi-event`)
- `src/integrations/supabase/client.ts`
- OTP verification logic, RLS, storage, scoring, preview/full backend boundary
- All 14 existing report child components in `src/components/report/`, `src/components/TruthReportFindings/`, `src/components/dossier/`
- Production routes, navigation, tracking

## Preview vs Full behavior

Driven entirely by the `accessLevel: "preview" | "full"` prop on the new component (no backend calls, no gating logic — purely presentational, mirroring the spec):

- **preview**: Sections 1 + 3 visible. Section 2 rendered with `filter: blur(6px); user-select: none; pointer-events: none` and a centered `LockOverlay`. Sections 4–8 not rendered (`return null`).
- **full**: All sections rendered, no blur, no overlay. Blur removal on the findings card transitions via `transition: filter 0.6s ease-out`.

The dev page exposes a simple `[Preview] [Full]` toggle at the top so you can flip between states without touching real OTP.

## Accessibility commitments (built in)

- All body/label text uses `text-dossier-txt-secondary` (#94a3b8) or lighter on the `#0f1419`–`#1a1f2e` background — meets the 7:1 floor.
- No text dimmer than `dossier-txt-muted` (#64748b).
- All interactive elements use `min-h-[44px]`.
- Any input fields use `bg-white text-slate-900 border-2 border-slate-300 focus:border-blue-500 rounded-lg px-3 py-2` with `text-base` (16px+) to prevent iOS zoom.
- System font stack only — no Google Fonts. The existing `tailwind.config.ts` already maps `font-sans` / `font-mono` to system stacks, so we use those directly.
- All icons are `lucide-react`, color-matched to section accent.

## Verification after build

1. Visit `/dev/testing1` — confirm dark dossier renders.
2. Toggle preview ↔ full — confirm blur + overlay behavior on Section 2 and Sections 4–8 hide/show correctly.
3. Visit `/report/classic/<sessionId>` — confirm production `TruthReportClassic` is **visually identical** to before (proof of zero collateral).
4. Confirm no new console errors, no new network calls from the dev page, no Supabase/edge function traffic from `/dev/testing1`.

## Out of scope (explicitly deferred)

- Wiring this new component into production `PostScanReportSwitcher`.
- Removing or replacing the current `TruthReportClassic`.
- Backend payload reshaping to the 37-signal extraction model (fixture provides the shape locally).
- Tests (this is a presentational dev harness; add tests in a follow-up sprint if you decide to promote it).
