## Plan: Redesign `/diagnosis` Step 1

I will surgically redesign `src/pages/diagnosis/components/StepIntake.tsx` only, with one optional type-safe constants update if needed for answer descriptions.

### 1. Rebuild StepIntake layout
Render the page in the required order:

```text
Forensic Audit Card
Short Hero Copy
Root Question Card
Symmetrical Answer Card Grid
Sticky Bottom CTA Bar
```

The existing diagnosis state machine and `onSelectPrimary(code)` handler will stay intact.

### 2. Replace the audit score block
Convert the weak white grade panel into a premium glass forensic result card:
- rounded 28px glass container
- subtle blue top glow
- compact grade tile on the left
- “Audit Result” eyebrow
- “High-risk quote signals found” title
- short explanatory body copy
- top 3 findings displayed as rounded chips instead of bullets
- blue-tinted next-step info strip replacing the mono ribbon

Grade color will remain derived from `context.report_grade`, with F/D using red risk styling and safer grades using trust-oriented green/blue accents.

### 3. Simplify hero copy
Replace the long headline with:

> Tell Us What Felt Wrong.

Subhead:

> We’ll use your audit findings to build the right next move: negotiate, compare, or walk away.

Remove the large consultation pill and add the small trust note below the hero:

> Private consultation. No contractor sees this.

### 4. Replace root question styling
Remove `card-raised-hero`, `border-double`, flex-wrap behavior, and italic helper text.

New card will use:
- premium white/glass styling
- `Step 1 · Root Concern` eyebrow
- `What frustrated you most about this quote?`
- helper copy: `Pick the answer that feels closest. You can refine it later.`

### 5. Make answer buttons symmetrical
Replace:

```tsx
<div className="flex flex-wrap gap-3">
```

with:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
```

Each answer becomes an equal-width, equal-height card with:
- icon tile
- bold label
- short description
- premium hover/focus state
- no gold styling
- no staggered wrapping

### 6. Add answer descriptions safely
`diagnosticMap.ts` currently has labels and longer downstream copy but no short answer-card descriptions.

I will either:
- keep descriptions as a local `Record<DiagnosisCode, string>` inside `StepIntake.tsx` to avoid widening shared types, or
- if preferred by TypeScript clarity, add `shortDescription?: string` to `DiagnosticConfig` and populate it in `diagnosticMap.ts`.

Default implementation will favor the local map to keep changes surgical and avoid affecting other diagnosis steps.

### 7. Add sticky bottom CTA bar
Add a fixed bottom CTA bar for Step 1:
- slate/navy glass container
- blue CTA button
- desktop copy: “Ready for a locked-in price?” / “Schedule a free phone measurement.”
- mobile-friendly full-width button behavior

Because this step advances by choosing an answer, the CTA will be a safe non-backend placeholder action that scrolls/focuses attention to the root question area rather than creating new backend behavior. No routing or funnel logic will be introduced.

### 8. Background and spacing cleanup
Update StepIntake’s internal section background to a smooth blue/navy trust aesthetic:
- soft slate/blue gradient
- subtle radial blue/cyan glows
- breathable mobile-first spacing
- bottom padding to account for the fixed CTA bar

### 9. Validation and final grading
After implementation, I will run the relevant checks available in build mode:
- TypeScript/build or project test command as appropriate
- confirm no backend/Supabase/OTP/Twilio/routing files changed
- inspect the StepIntake source for no remaining flex-wrap answer layout, no italics, no gold CTA styling

I will also provide the requested Senior CRO UX scorecard across 10 categories, explaining the final result category-by-category.

## Files intended to change

Primary:
- `src/pages/diagnosis/components/StepIntake.tsx`

Optional only if necessary:
- `src/pages/diagnosis/constants/diagnosticMap.ts`
- `src/pages/diagnosis/types.ts`

## Files explicitly not touched

- backend files
- Supabase migrations/functions
- OTP/Twilio files
- scan/report generation logic
- routing
- diagnosis state machine
- admin/partner pages