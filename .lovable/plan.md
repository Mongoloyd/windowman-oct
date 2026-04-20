

## Goal
Drop `NativeBookingForm` into `/partner/login` as its own full-width section below the existing hero/auth grid. Same dark `bg-[#0d0d0d]` styling as on the contractors3 page. Centered on all viewports (already is, via its internal `mx-auto max-w-6xl`).

## Implementation
Single-file edit to `src/pages/ContractorLogin.tsx`:

1. Add import: `import NativeBookingForm from "@/pages/contractors3/components/sections/NativeBookingForm";`
2. After the closing tag of the existing hero/grid section (the parent wrapper that contains the brand panel + auth card), insert:
   ```tsx
   <NativeBookingForm />
   ```
3. Nothing else changes — no prop wiring, no style overrides. The component already renders its own `<section bg-[#0d0d0d] py-24>` with centered `mx-auto max-w-6xl px-6`, so it will stack naturally below the hero on desktop, tablet, and mobile.

## Files changed
```text
src/pages/ContractorLogin.tsx   (edit: 1 import + 1 JSX line)
```

## Out of scope
- No edit to `NativeBookingForm` itself (preserves contractors3 parity)
- No auth, edge function, RLS, OTP, scan, or `PartnerGuard` changes
- The form's submit handler stays as-is (currently simulated success — no real persistence yet)

## Verification
1. `/partner/login` renders existing hero + auth card unchanged
2. Below it, the dark booking section appears centered, identical to `/contractors3`
3. Mobile (375px), tablet (768px), desktop (1497px) — section is centered and responsive
4. Calendar, time slots, and form interactions work exactly as on contractors3

