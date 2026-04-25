# Plan: Diagnosis Step 1 Repair

## Goal
Make `/diagnosis` Step 1 feel protective, confident, readable, and premium:

```text
I’ve got your report.
You don’t need to know the technical answer.
Pick what felt wrong — or let WindowMan guide you.
```

## Scope Guardrails
I will only change the diagnosis Step 1 surface and related diagnosis types/config:

- `src/pages/diagnosis/components/StepIntake.tsx`
- `src/pages/diagnosis/constants/diagnosticMap.ts`
- `src/pages/diagnosis/types.ts`

No backend, scanner, scan-quote, scoring, OTP, Twilio, Supabase functions, RLS, storage, report generation, partner/admin, or unrelated routing changes.

## 1. Add “I don’t know — guide me” Diagnosis Option
In `types.ts`, add a new diagnosis code:

```ts
'not_sure'
```

In `diagnosticMap.ts`, add it to `DIAGNOSTIC_MAP` and `DIAGNOSIS_ORDER` using `HelpCircle` or `Compass` from `lucide-react`.

New config:

- Label: `I don’t know — guide me`
- Card description: `Use the report to choose the safest next move for me.`
- Reflection: `That is exactly why WindowMan exists. You do not need to diagnose the quote yourself — we’ll use the report to guide the safest next move.`
- Secondary question: `What would help you feel safer?`
- Secondary options:
  - `Show me the biggest risk`
  - `Help me compare options`
  - `Tell me what to ask next`
  - `Find me a cleaner quote`
- Prescription headline: `WindowMan-Guided Next Move`
- Prescription subhead: `We’ll use your report findings to choose the safest path forward.`
- CTA: `Guide my next move`
- Prescription path: `guided_next_move`

The `not_sure` card will render full-width on mobile and desktop so it feels intentional.

## 2. Add Card Descriptions to All Diagnosis Options
In `DiagnosticConfig`, add:

```ts
cardDescription: string;
```

Then add descriptions to every option:

- `price_shock`: `The number felt inflated or hard to justify.`
- `trust_breakdown`: `Something felt rushed, vague, or pressured.`
- `financial`: `The deposit, financing, or payment terms felt wrong.`
- `timing`: `The deadline, urgency, or install timing felt off.`
- `scope_mismatch`: `The scope or product mix did not match your goal.`
- `other`: `Something felt wrong, even if it is hard to name.`
- `not_sure`: `Use the report to choose the safest next move for me.`

## 3. Replace Weak Hero Copy with “I’ve Got You”
In `StepIntake.tsx`, replace the current soft/questioning tone with confident copy.

Headline:

```text
{FirstName}, I’ve Got You.
```

Fallback:

```text
I’ve Got You.
```

Subhead:

```text
Your report is loaded. Choose the biggest problem — or let WindowMan guide the safest move.
```

Grade-specific support line:

- D/F: `This is not a maybe. This quote needs a safer move before you sign.`
- B/C: `This quote may be workable, but the weak spots need to be handled first.`
- A: `This quote looks stronger than most. Let’s pressure-test the final details.`

Remove:

```text
This Isn't a Sales Form. It's a Consultation.
```

Replace pill with:

```text
Report loaded. Strategy builder ready.
```

The pill will use darker navy text, stronger border, and blue/cyan icon styling.

## 4. Repair Audit Card
Keep the audit card, but make it tighter and stronger:

- Keep grade.
- Keep score context.
- Keep up to 3 report insights.
- Strengthen border and text contrast.
- Avoid tiny low-contrast chips.
- Replace the mono ribbon:

```text
We Have Your Quote · We Have Your Answers · Let's Build Your Counter-Offer
```

with:

```text
Report loaded. Strategy builder ready.
```

## 5. Add WindowMan Advisor Visual
In `StepIntake.tsx`, add a structured advisor card for the first step.

Desktop layout above the answer grid:

```text
[left: copy + audit card] [right: WindowMan advisor card]
```

Mobile layout:

- Keep compact.
- Do not push the root question too far down.
- Advisor card appears below the audit/copy area or near the root question header without dominating the screen.

Advisor card copy:

```text
WindowMan has your report.
Pick the problem. I’ll build the next move.
```

Styling:

- `rounded-3xl`
- dark navy / dark blue gradient
- soft blue/orange glow
- `border border-blue-300/30`
- contained visual area

If no appropriate WindowMan advisor asset is available in the repo, I will add a clean structured placeholder/TODO area instead of inventing fake artwork.

## 6. Replace Scattered Buttons with Centered Decision Cards
In `StepIntake.tsx`, replace:

```tsx
flex flex-wrap gap-3
```

with:

```tsx
grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto
```

For `not_sure`:

```tsx
sm:col-span-2
```

Each option will become a real card:

- `min-h-[104px]`
- `w-full`
- `rounded-2xl`
- `border-2 border-slate-300`
- `bg-white`
- `px-5 py-5`
- `shadow-[0_16px_38px_rgba(15,23,42,0.12)]`
- `transition-all duration-200`
- `hover:-translate-y-0.5`
- `hover:border-blue-500`
- `hover:shadow-[0_20px_48px_rgba(37,99,235,0.18)]`
- `focus:outline-none`
- `focus:ring-4 focus:ring-blue-500/20`
- `active:scale-[0.99]`

Internal layout:

- `flex items-center gap-4`
- icon block on left
- text block on right

Icon block:

- `h-12 w-12`
- `rounded-xl`
- `bg-blue-50`
- `text-blue-700`
- `border border-blue-200`
- `shadow-sm`

Label:

- `text-[16px] md:text-[17px]`
- `font-black`
- `text-slate-950`
- `leading-tight`

Description:

- `mt-1`
- `text-sm`
- `text-slate-600`
- `leading-relaxed`

No tiny chips. No weak custom-only button classes. No flex-wrap.

## 7. Root Question Copy
Replace:

```text
What Frustrated You Most About The Quote You Received?
```

with:

```text
What was the biggest problem with this quote?
```

Helper:

```text
Choose the closest answer. We’ll turn it into your next move.
```

No italic helper text.

## 8. Tracking
Preserve existing diagnosis tracking.

If adding the new root-selection event, use browser/GTM tracking only:

```text
diagnosis_root_option_selected
```

Payload will include:

- selected code
- report grade

It will not include:

- raw email
- raw phone
- full name
- full report JSON
- quote text

No direct Meta/Google calls.

## 9. Verification
After implementation, I will run typecheck and confirm:

1. files changed
2. `DiagnosisCode` added
3. `DIAGNOSTIC_MAP` changes
4. grid/card layout changes
5. WindowMan visual placement or structured placeholder
6. copy changes
7. mobile behavior
8. tracking changes, if any
9. confirmation no backend/scanner/OTP/Supabase changes
10. typecheck result