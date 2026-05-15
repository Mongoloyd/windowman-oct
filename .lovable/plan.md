# Plan — PreUploadIntake.tsx Finalization (Phase 4L.9.2)

**Scope lock:** All edits confined to `src/components/forensic-report/PreUploadIntake.tsx`. No routing, no App.tsx, no new files.

---

## Module 1 — Progressive Disclosure + Step Indicator

- Add `step: 1 | 2` local state, derived as: Step 1 until both `selectedPath && homeType` are set, then auto-advance to Step 2 on first focus inside Zone B (or click "Continue to identity").
- Render a slim 2-segment progress bar at the very top of the main grid: `[████░░] Step 1 of 2 · Intake` → `[████████] Step 2 of 2 · Chain of Custody`.
- Bar fill animates via `transition-all duration-500 ease-out` width change.
- Step labels swap with a fade. Includes "← Back" affordance when on Step 2.
- Zone A dims to `opacity-60` (still visible, still clickable) when Step 2 is active; Zone B dims when Step 1 is active. Keeps both panels mounted, just visually weighted.

## Module 2 — Keyboard + Screen Reader

- `PathCard` group: `role="radiogroup"` with `aria-label="Visitor type"`. Arrow Up/Down cycles focus + selection; Home/End jump to first/last; Enter/Space confirms (already selected on focus per radio pattern).
- `PillChoice` group: same pattern, Arrow Left/Right.
- Manage focus via `useRef` array + `tabIndex={selected ? 0 : -1}` (roving tabindex).
- Add `focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950` to all interactive elements (only shows on keyboard focus, not mouse).
- Single `aria-live="polite"` `<div className="sr-only">` near the top, updated with `"Selected: I already have a quote"` / `"Home type: Single family"` etc. on every selection change.

## Module 3 — Inline Validation

- Add `touched: { name, email, zip }` state, set true on `onBlur`.
- Validation rules:
  - `name`: trimmed length ≥ 2
  - `email`: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
  - `zip`: `/^\d{5}$/`
- Error messages render in `text-[11px] text-red-400/80 mt-1` only when `touched[field] && !valid(field)`.
- Field border shifts to `border-red-400/40` when in error state.
- CTA `disabled` when `canContinue` is false (already wired) — also add `aria-describedby` pointing to an error summary when user tries to interact.
- On disabled-click attempt: mark all fields touched + flash a `role="alert"` summary line above the CTA: *"Complete required fields to open your case file."*

## Module 4 — Case File Preview ("Receipt")

- Compact panel above the CTA in Zone B, only renders when at least one field is filled.
- Layout: `bg-slate-950/40 border border-dashed border-slate-700 rounded-lg px-4 py-3`.
- Header: `§ CASE FILE PREVIEW` in mono uppercase tracking-wider text-slate-500.
- Body lines (each line only renders if data exists):
  - `PATH ········· I already have a quote`
  - `HOME ········· Single family`
  - `ASSIGNED ····· Maria G. <m@domain.com>`
  - `JURISDICTION · 33073`
- Dotted leaders rendered via `flex justify-between` + `border-b border-dotted border-slate-800` separator OR via repeated `·` characters in a `font-mono` span — will use the latter for the spec-sheet aesthetic.
- Live case ID echoed at the bottom right in `text-[10px] text-slate-600`.

## Module 5 — Pending Elevations

- **Case ID:** `useMemo` once on mount → `WM-2026-FL-${4-digit random}`. Stable for the session. Renders in the header pill (replacing the static "Step 1 of 2 · Identity" tag, which moves into the new step indicator). Click to copy → flashes "Copied" for 1.5s.
- **Spec-sheet labels:** Zone A heading rail becomes `§ 01 — INTAKE`; Zone B becomes `§ 02 — CHAIN OF CUSTODY`. Both in `font-mono uppercase tracking-[0.18em] text-slate-500`.
- **Benchmark counter:** `Benchmarked against 2,847 South FL quotes` appears under Zone B's H2, with a small pulsing emerald dot prefix to suggest "live data".

## Bonus Elevations (the +12 from the rating)

- **Session persistence:** `useEffect` syncs all state to `sessionStorage["wm:intake:draft"]`; restore on mount.
- **Reduced motion:** wrap press/glow/sheen in `motion-safe:` Tailwind variants.
- **Field lock icon state machine:** small `Lock` icon absolutely positioned right side of each input — `text-slate-600` idle, `text-amber-400 animate-pulse` while typing (debounced), `text-emerald-400` when field is valid. Reinforces the "encrypted hardware" metaphor on every keystroke.
- **Stable case ID + copy:** as above.
- **Error summary alert:** as above in Module 3.
- **Back button:** as above in Module 1.

---

## Technical Notes

- All new state is local `useState` / `useRef` / `useMemo`. Zero new dependencies.
- No changes to exports — keep `export function PreUploadIntake` + `export default`.
- No backend, no Supabase, no analytics, no routing per the strict constraint and project rules (visual harness only).
- Tailwind tokens preserved — continues using the existing `bg-slate-*`, `border-white/[0.0X]`, blue/indigo accent vocabulary already established in the file.
- Estimated final file size: ~620 lines (from current ~410).

## ASCII Layout Reference

```text
┌─────────────────────────────────────────────────────────┐
│  [WM Logo]  WindowMan                  [● Secure · TLS] │
│             Forensic Audit System                       │
├─────────────────────────────────────────────────────────┤
│  [WM-2026-FL-7421 📋]                                   │
│  Open your private case file.                           │
│  Tell us where you are…                                 │
├─────────────────────────────────────────────────────────┤
│  ████████░░░░░░░░  Step 1 of 2 · Intake                 │
├──────────────────────────┬──────────────────────────────┤
│  § 01 — INTAKE           │  § 02 — CHAIN OF CUSTODY     │
│  Where are you in the…   │  Set up your case file       │
│                          │  ● Benchmarked against 2,847 │
│  ┌────────────────────┐  │                              │
│  │ 📄 I have a quote  │  │  Full name    [_________🔒] │
│  └────────────────────┘  │  Email        [_________🔒] │
│  ┌────────────────────┐  │  Project Zip  [_________🔒] │
│  │ 🧮 Getting quotes  │  │  Home type    [SF][TH][CN]  │
│  └────────────────────┘  │                              │
│  ┌────────────────────┐  │  ┌── § CASE FILE PREVIEW ──┐│
│  │ 🔍 Researching     │  │  │ PATH ····· Have a quote ││
│  └────────────────────┘  │  │ HOME ····· Single family││
│                          │  │ ASSIGNED · Maria G.     ││
│  [What happens next ⏱]   │  └─────────────────────────┘│
│                          │  [  Continue to upload →  ]  │
└──────────────────────────┴──────────────────────────────┘
```

## Out of Scope

- No new routes, no mounting in App.tsx (file already exists at the path; user will mount separately).
- No real form submission, no persistence beyond sessionStorage draft.
- No new Lucide imports beyond what the file already uses (`Lock`, `CheckCircle2`, `ArrowRight` already imported; will add `Copy` for the case ID).

---

**Confirm to proceed and I'll implement all 5 modules + the 6 bonus elevations in a single edit.**
