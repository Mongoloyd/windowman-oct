# Plan: Import "WindowMan — The Market Maker" as `/twochoices`

## Approach

The uploaded file is a complete 1675-line standalone HTML page with:
- Inline Tailwind CDN script + custom `tailwind.config`
- ~250 lines of custom CSS (gate background, scan-line animations, modal transitions, OTP boxes, toast, etc.)
- Vanilla JS handling 6-step upload modal, scan theatrics, OTP, drag-drop, etc.
- Hard-coded color palette (`wm-blue`, `wm-dark1`, etc.) that conflicts with the project's existing Tailwind config

To honor "**import exactly as is**" with zero drift, the safest approach is to serve the HTML byte-for-byte as a static asset and mount it inside an iframe at the React route. This preserves every animation, modal, script, and pixel of the original.

Rewriting the 1675 lines into idiomatic React/JSX would (a) introduce drift, (b) force conversion of vanilla DOM event handlers to React state, and (c) collide with the existing project Tailwind config. Iframe embedding sidesteps all three.

## Files

1. **`public/twochoices.html`** (new, copied verbatim from the upload) — 1675 lines, byte-identical to the upload. Loads its own Tailwind CDN + lucide UMD inside the iframe, isolated from the host app's bundle.
2. **`src/pages/TwoChoices.tsx`** (new, ~15 lines) — thin React wrapper that renders a full-viewport iframe pointing at `/twochoices.html`.
3. **`src/App.tsx`** (1-line edit) — add lazy import + one route:
   ```text
   const TwoChoices = lazy(() => import("./pages/TwoChoices.tsx"));
   <Route path="/twochoices" element={<TwoChoices />} />
   ```
   Placed alongside other public routes (not gated to dev-only, since the request did not specify dev-only).

## What this preserves

- Exact CSS, animations, gate gradient, scan-line effects, modal transitions
- Original `wm-*` Tailwind color palette without polluting project tokens
- Vanilla JS 6-step upload flow, OTP boxes, toast, drag-drop, testimonial carousel
- All `data-id` attributes, lucide icons, accessibility attrs

## What it does NOT do

- No backend wiring — modal submits remain client-side as authored
- No integration with `usePhonePipeline`, `scan-quote`, OTP edge functions, or Supabase
- No styling drift, no React-ification of the JS

If you later want this page to actually wire into the real WindowMan pipeline (real OTP, real scan, real reveal), that would be a separate sprint to port the markup into native React components.

## NO-TOUCH (confirmed untouched)

All previously listed no-touch zones remain untouched. This change is purely additive: one new public asset + one new page file + one new route line.
