Change only the selected blue sticky footer button label in `src/components/StickyCTAFooter.tsx`.

Scope:
- Replace the current post-conversion account CTA text `Request a Free Estimate` with exactly:
  `Requet a Phone Estimate`
- Do not change styling, layout, routing, click handlers, tracking, imports, or backend logic.
- No Supabase, database, or edge function changes.

Technical detail:
- The selected button text comes from `postConversionText` when `conversionType === "account"`.
- I will update only that string literal and leave the rest of the component untouched.

Validation:
- Run a typecheck after the edit to confirm the app remains green.