

## Wire `/contractors3` to canonical lead-capture modal + contextual CRO CTAs

Mirror the `/contractors2` CTA architecture on the dark `/contractors3` page. Replace the dummy `.jsx` modal with the canonical TSX `QualificationFlow` (saves to `contractor_leads`), lift state into `Contractors3.tsx`, mount the floating pill, restructure the hero, and inject 4 contextual modal triggers. All new buttons share one primary style tuned for the dark theme.

### 1. Data layer — canonicalize the form

**Delete** the dummy contractors3 qualification stack (these have no other importers — confirmed via grep, only `Contractors3.tsx` references them):
- `src/pages/contractors3/components/qualification/QualificationFlow.jsx`
- `src/pages/contractors3/components/qualification/StepCard.jsx`
- `src/pages/contractors3/components/qualification/OptionButton.jsx`

**`src/pages/contractors3/Contractors3.tsx`** — swap the import:
```tsx
// remove:
import QualificationFlow from "./components/qualification/QualificationFlow.jsx";
// add:
import QualificationFlow from "@/components/qualification/QualificationFlow";
import CTAFloatPill from "@/components/contractors/CTAFloatPill";
import { WarmIntentProvider } from "@/hooks/useWarmIntent";
```

State already lifted (`qualOpen` / `setQualOpen`). Pass `onOpenQualification={() => setQualOpen(true)}` to: `HeroSection`, `CompetitorQuoteSection`, `EconomicsSection`, `DifferentiationSection`, `ExclusivitySection`. (`QualificationStripSection` already wired.)

### 2. Floating sticky CTA

Wrap the page in `<WarmIntentProvider>` (required by `useWarmIntent` inside `CTAFloatPill`) and mount the pill inside it:
```tsx
<WarmIntentProvider>
  <div className="contractors3-page">
    {/* existing PageWrapper + sections */}
    <CTAFloatPill onRequestAccess={() => setQualOpen(true)} />
  </div>
</WarmIntentProvider>
```
The mobile bottom-bar "Check Your Territory" button stays as-is and also opens the modal.

### 3. Hero restructure — `src/pages/contractors3/components/sections/HeroSection.jsx`

- Add `onOpenQualification` prop.
- Replace the Calendly `<a>` (currently "Book a 10-Minute Walkthrough") **with a primary `<button>` "Get Window Buyers"** wired to `onClick={onOpenQualification}`.
- Demote the Calendly link to secondary outline style (border `border-white/20 bg-transparent text-white`) and keep label "Book a 10-Minute Walkthrough".
- **Remove** the "Call or Text {phone}" anchor entirely.
- Update the helper microcopy below to: `Or talk to us by phone — see footer.` (small, neutral) so we don't lose the phone option entirely without a redirect surprise.

### 4. Contextual inline CTAs

All buttons reuse this single primary style (matches new hero + the page's existing white-on-black pill convention):

```
inline-flex items-center justify-center rounded-full bg-white px-8 py-4
text-base font-bold text-black transition-all hover:bg-white/90 active:scale-[0.98]
```

Each section gets `onOpenQualification?: () => void` prop and a centered button after the section's main content:

| Section file | Button label | Placement |
|---|---|---|
| `CompetitorQuoteSection.jsx` ("We Don't Generate Generic Demand…") | **Intercept Active Buyers** | New `<div className="mt-10 flex justify-center">` after the closing blockquote (line 108) |
| `EconomicsSection.jsx` ("Fewer Leads. Better Timing…") | **Access Higher-Intent Buyers** | New centered block after the Conservative Math card (after line 67) |
| `DifferentiationSection.jsx` ("This Is Not Shared Lead Gen.") | **Stop Buying Shared Leads** | New `<div className="mt-10 flex justify-center">` after the closing quote (after line 58) |
| `ExclusivitySection.jsx` ("One Contractor Per Territory.") | **See If Your Territory Is Open** | Replace the existing Calendly `<a>` (lines 22–25) with a `<button>` triggering `onOpenQualification`. Label already matches the spec. |

Each section file gets a minimal prop signature change:
```jsx
export default function CompetitorQuoteSection({ onOpenQualification }) { … }
```

### 5. File diff summary

**Modified (6):**
1. `src/pages/contractors3/Contractors3.tsx` — swap modal import, add `WarmIntentProvider`, mount `CTAFloatPill`, pass prop to 4 more sections
2. `src/pages/contractors3/components/sections/HeroSection.jsx` — primary button + demote Calendly + remove phone CTA
3. `src/pages/contractors3/components/sections/CompetitorQuoteSection.jsx` — prop + button
4. `src/pages/contractors3/components/sections/EconomicsSection.jsx` — prop + button
5. `src/pages/contractors3/components/sections/DifferentiationSection.jsx` — prop + button
6. `src/pages/contractors3/components/sections/ExclusivitySection.jsx` — prop + replace anchor with button

**Deleted (3):**
- `src/pages/contractors3/components/qualification/QualificationFlow.jsx`
- `src/pages/contractors3/components/qualification/StepCard.jsx`
- `src/pages/contractors3/components/qualification/OptionButton.jsx`

### Out of scope
- DB schema, `contractor_leads` payload (no `sourcePage`/`sourceCta` attribution this pass)
- `/contractors`, `/contractors2`, canonical `QualificationFlow.tsx` internals — untouched
- No new components extracted; no theme inversion of the modal (canonical modal renders on its own dark overlay and works fine on the black page)

### Verification after apply
- `/contractors3` hero shows **Get Window Buyers** (white primary, opens modal) + **Book a 10-Minute Walkthrough** (outline). No "Call or Text" button.
- All 4 contextual buttons + the Exclusivity button + the existing mobile sticky + the new floating pill (after warm-intent triggers) open the same canonical 6-step `QualificationFlow` that writes to `contractor_leads`.
- Submitting the modal from `/contractors3` produces a row in `contractor_leads` (same path as `/contractors2`).
- TypeScript + grep show no remaining importers of the deleted `.jsx` qualification files.
- `git diff` touches only the 6 modified + 3 deleted files above.

