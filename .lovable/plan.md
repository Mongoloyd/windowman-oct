## Pre-Publish Cleanup Plan

Two small, surgical edits. No routing, no funnel, no backend, no auth touched.

### 1. `src/components/about/AboutCTASection.tsx`

Remove the tertiary "See a Sample Report" link (which points to the dev-only `/demo-classic` route) and any code that becomes unused.

**Remove:**
- The `<Link to="/demo-classic">See a Sample Report</Link>` JSX block (the third CTA inside the card).
- The `handleSampleReport` callback (becomes unused).
- The `onSampleReportClick` prop from the `AboutCTASectionProps` interface (becomes unused).

**Keep:**
- The "Analyze My Quote" primary CTA → `/`
- The "Create My Vault" secondary CTA → `/`
- All tracking, IntersectionObserver view-tracking, and section styling.

**Caller check:** `src/pages/About.tsx` renders `<AboutCTASection onTrack={handleTrack} />` and does not pass `onSampleReportClick`, so removing the prop is safe.

### 2. `src/components/StickyCTAFooter.tsx`

Single typo fix on line ~44:
- `"Requet a Phone Estimate"` → `"Request a Phone Estimate"`

No other changes in this file.

### Out of scope (explicitly untouched)
- Homepage resume logic, `Index.tsx`, scan funnel, UploadZone
- `scan-quote`, `send-otp`, `verify-otp`, Twilio, Gemini
- Supabase RLS, report authorization, `adminDataService`
- Any route definitions in `App.tsx` (the `/demo-classic` route itself stays; we only remove the public link to it)

### Validation after implementation
1. TypeScript check passes (no unused-prop or unused-import errors).
2. Build passes.
3. `/about` renders with the cleaned CTA card (two buttons, no third link).
4. `/` still loads and the scan CTA still works.
5. No console errors introduced.

### Files changed
- `src/components/about/AboutCTASection.tsx`
- `src/components/StickyCTAFooter.tsx`
