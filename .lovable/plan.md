

## Hero CTA restructure + 4 contextual modal triggers on `/contractors2`

All buttons open the existing `QualificationFlow` modal already wired in `src/pages/Contractors2.tsx` via `qualOpen` state. No new components, no schema changes, no `/contractors3` impact.

### Approach: lift `setQualOpen` into the sections that need it

Each target section will accept a single optional `onOpenQualification: () => void` prop (matching the pattern already used by `QualificationStripSection`). `Contractors2.tsx` passes `() => setQualOpen(true)` to each.

All 5 section files (`HeroSection`, `CompetitorQuoteSection`, `ArbitrageModelSection`, `FlywheelSection`, `ExclusivitySection`) are imported only by `Contractors2.tsx` — confirmed via grep. Adding an optional prop is non-breaking elsewhere.

---

### Change 1 — `src/components/sections/HeroSection.tsx`

**Hero CTA cluster (lines 60–79):**

- Add prop: `onOpenQualification?: () => void`
- Replace the two `<a>` tags with:
  - **Primary** (button, opens modal): `Get Window Buyers` — same white/black styling as current primary, swap to `<button onClick={onOpenQualification}>`
  - **Secondary** (link to Calendly, demoted to outline style): `Book a 10-Minute Walkthrough` — switch to the outlined `border border-white/10 text-white` styling currently used by "Call or Text"
- **Delete** the "Call or Text" anchor entirely
- Remove now-unused `PAGE_CONFIG.phone` reference if no longer needed (keep `PAGE_CONFIG.calendly`)

### Change 2 — `src/components/sections/CompetitorQuoteSection.tsx`

Section: "We Don't Generate Demand. We Intercept It."

- Add prop: `onOpenQualification?: () => void`
- Inside the bottom conclusion card (after the `<p>` on line 81–84), add a centered primary button:
  - Text: **`Intercept Active Buyers`**
  - Style: matches hero primary — `inline-flex items-center justify-center rounded-xl bg-white text-slate-950 font-semibold text-sm px-7 py-3.5 hover:bg-white/90 transition-colors mt-5`
  - Wrap with `motion.button` for parity, `onClick={onOpenQualification}`

### Change 3 — `src/components/sections/ArbitrageModelSection.tsx`

Section: "Our Arbitrage Model"

- Add prop: `onOpenQualification?: () => void`
- Add a centered CTA block after the closing of the inner grid `</div>` on line 165, **inside** the rounded panel, with top border separator:
  - Text: **`Capture This Margin`**
  - Style: same white primary as above (sits well on the dark grid panel)
  - `onClick={onOpenQualification}`

### Change 4 — `src/components/sections/FlywheelSection.tsx`

Section: "The Compounding Pricing Monopoly" (this is where it actually lives — the user's description matches this section, not a separate one)

- Add prop: `onOpenQualification?: () => void`
- Append a primary button at the end of the left column's `space-y-8` block (after the third bullet, line 45):
  - Text: **`Leverage Our County Data`**
  - Style: same white primary, with `mt-2` for breathing room from the bullets
  - `onClick={onOpenQualification}`

### Change 5 — `src/components/sections/ExclusivitySection.tsx`

Section: "Not Every Contractor Is a Fit"

- Add prop: `onOpenQualification?: () => void`
- Existing button (lines 32–38):
  - Change text: `Request Access` → **`See If You Qualify`**
  - Add `onClick={onOpenQualification}` to the existing `motion.button`
  - Keep all current styling (rounded-full pill, `bg-white text-black px-8 py-4`)

### Change 6 — `src/pages/Contractors2.tsx`

Wire the prop through to the five sections:

```tsx
<HeroSection onOpenQualification={() => setQualOpen(true)} />
<MarketTruthSection />
<CinematicDivider />
<CompetitorQuoteSection onOpenQualification={() => setQualOpen(true)} />
...
<ArbitrageModelSection onOpenQualification={() => setQualOpen(true)} />
...
<FlywheelSection onOpenQualification={() => setQualOpen(true)} />
...
<ExclusivitySection onOpenQualification={() => setQualOpen(true)} />
```

`QualificationFlow` mount and `QualificationStripSection` ("Check Your Territory") remain unchanged — they already work.

---

### Files touched

1. `src/components/sections/HeroSection.tsx`
2. `src/components/sections/CompetitorQuoteSection.tsx`
3. `src/components/sections/ArbitrageModelSection.tsx`
4. `src/components/sections/FlywheelSection.tsx`
5. `src/components/sections/ExclusivitySection.tsx`
6. `src/pages/Contractors2.tsx`

### Out of scope (explicit)

- No new components extracted
- No DB / schema changes; no `source_cta` attribution this pass
- `/contractors3`, `/contractors`, `QualificationFlow.tsx` internals — untouched
- Sticky footer, GTM, OTP, scanner, backend — untouched

### Verification after apply

- `/contractors2` hero shows two buttons: `Get Window Buyers` (primary, white) + `Book a 10-Minute Walkthrough` (secondary, outline). No "Call or Text" button.
- Clicking `Get Window Buyers` opens the same modal as "Check Your Territory" lower on the page.
- Each of the four new contextual buttons opens the same modal.
- `ExclusivitySection` button now reads "See If You Qualify" and opens the modal (was a dead button before).
- `git diff` touches only the 6 files above.

