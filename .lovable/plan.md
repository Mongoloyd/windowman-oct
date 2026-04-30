# Plan: Hero prototype routes for mascot A/B comparison

Build three dev-only hero prototype pages so you can flip between mascot placements in the same browser tab.

## Routes (dev-gated, behind `isDevMode` in `App.tsx`)

- `/dev/hero-1` — **Inspector Reveal** — mascot right side, blue scan-line sweeping over him, "● LIVE · analyzing 47 quotes" pulse badge, headline + 2 CTAs on the left.
- `/dev/hero-3` — **Phone-as-Portal** — mascot center-right, real DOM "Truth Report" card (B+ badge, 4 pillar rows, red-flag count) floating over his upper torso, slight tilt that straightens on hover.
- `/dev/hero-4` — **Floating Receipts** — mascot centered on a radial-gradient stage, 6 quote thumbnails orbiting with red/green/amber stickers (`OVERCHARGE +$2,400`, `FAIR PRICE`, `MISSING DP RATING`, etc.), gentle CSS float animation.

Each variant has a sticky top dev-bar with quick-jump links to the other two for instant side-by-side comparison.

## Files

**New**
- `src/assets/wman_phone_hero.avif` — uploaded mascot image (already copied)
- `src/pages/dev-heroes/HeroShell.tsx` — shared dev-bar wrapper with variant nav links
- `src/pages/dev-heroes/Hero1Inspector.tsx`
- `src/pages/dev-heroes/Hero3Portal.tsx`
- `src/pages/dev-heroes/Hero4Receipts.tsx`

**Edited**
- `src/App.tsx` — three lazy imports + three `<Route>`s inside the existing `{isDevMode && (...)}` block, alongside `/dev/testing1`.

## Constraints honored

- **Dev-gated**: routes only mount when `import.meta.env.DEV` is true, matching the existing `/devtesting` and `/dev/testing1` pattern. They will not be reachable in production.
- **Pure presentational**: no hooks touched, no edge functions called, no Supabase queries, no real CTAs wired. Buttons are visual only.
- **Self-contained**: all styling is inline Tailwind + a small `<style>` block per file for the scan-line / float keyframes. Nothing added to `tailwind.config.ts` or `index.css`. No collisions with the existing `dossier-*` palette.
- **Asset hygiene**: mascot lives in `src/assets/` and is imported as an ES module so Vite handles bundling.
- **No-touch zones preserved**: `usePhonePipeline`, `useAnalysisData`, `PostScanReportSwitcher`, edge functions, Supabase config, OTP logic, `TruthReportClassic.tsx`, and the production `/` route are all untouched.

## Out of scope

- Variants 2, 5, 6, 7, 8 from the prior list (can be added later if any of these three resonates).
- Wiring any prototype to the real upload / OTP / Truth Report pipeline.
- Mobile-specific tuning beyond Tailwind's default responsive grid.
