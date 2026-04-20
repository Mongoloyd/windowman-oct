

## What I see in the screenshot

Your reference shows a **much tighter, more deliberate composition** than what's currently rendered:

1. **Character is significantly larger** — sits as the visual anchor, ~70-80% the width of the auth card below it
2. **Character is centered directly above the auth card**, not floating off to the side or with huge gap
3. **The "Free Pro-Consumer Protection Service" pill/chip** sits between the character and the auth card — looks like a tab/handle the character is "holding" the form by
4. **Bottom of character (legs/pill he's sitting on) overlaps the top edge of the auth card** — tucked behind the chip and card, creating the "perched on top" effect
5. **No left brand panel visible in this shot** — the auth column appears centered or the brand panel is below/hidden
6. **Tighter vertical rhythm** — character → chip → card is one continuous stacked unit, not three floating pieces

## What's wrong with current state

Based on the previous resize, the character is now `h-80`/`h-96` but:
- It's positioned at `-top-40 lg:-top-56` which lifts it too far above the card → big visual gap
- No "Free Pro-Consumer Protection Service" pill/chip between character and card
- The pill the character sits on isn't visually tucked behind the card — it's just floating above

## Plan: Match the reference layout

### Single file: `src/pages/ContractorLogin.tsx`

**1. Tighten character positioning so its bottom tucks into the card**
- Change `-top-40 lg:-top-56` → `-top-32 lg:-top-48 xl:-top-56` (less lift, so character's pill bottom overlaps the card's top edge)
- Keep the responsive heights (`h-64 lg:h-80 xl:h-96`)
- Reduce the auth column padding accordingly: `md:pt-32 lg:pt-44 xl:pt-52` (was `md:pt-44 lg:pt-60 xl:pt-72`)

**2. Add the "Free Pro-Consumer Protection Service" chip**
Insert a small glass pill between the character and the auth card. Sits on the seam where the character meets the card — same z-index logic (z-0 behind card top edge, but visually centered).

```tsx
<div className="hidden md:flex absolute left-1/2 -translate-x-1/2 -top-5 z-20
                items-center gap-2 px-4 py-2 rounded-full
                bg-white/[0.04] backdrop-blur-md border border-white/[0.08]
                shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_hsla(0,0%,100%,0.08)]">
  <ShieldCheck className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
  <span className="text-xs font-medium tracking-wide text-white/85">
    Free Pro-Consumer Protection Service
  </span>
</div>
```

This chip is positioned on the auth card's `relative` wrapper at `-top-5`, so it sits half-on, half-off the top edge — exactly like the reference.

**3. Z-stacking refinement**
- Character: `z-0` (behind card)
- Auth card: `z-10`
- Chip: `z-20` (on top of card edge, in front of character's lower body)

This recreates the layered depth: character behind → card in middle → chip in front, all sharing the same horizontal centerline.

**4. Verify the pill-bottom overlap**
After the `-top` adjustment, the character's seated pill should visually disappear behind the card's top ~30-40px. Will spot-check at 1280, 1440, 1811px (your current viewport).

## What stays the same
- `float-soft` 5s animation
- `motion-reduce:animate-none`
- Mobile: character + chip both hidden (`hidden md:block` / `hidden md:flex`)
- All copy, fonts, colors, auth logic, brand panel, flywheel, NativeBookingForm
- CLS fixes from previous pass (intrinsic dims, aspect ratios)

## Files changed
```text
src/pages/ContractorLogin.tsx   (tighten character -top offset, reduce column pt-*, add glass chip with ShieldCheck icon)
```

## Out of scope
- No new assets
- No animation changes
- No edits to brand panel, booking form, or auth flow
- No changes to the character image itself (using existing `/images/wman-reading.avif`)

## Verification
1. Desktop (1811px / your viewport): character sits directly above the card with its seated pill tucking behind the top edge; chip is centered on the seam reading "Free Pro-Consumer Protection Service"
2. Tablet (768–1023px): same composition, scaled down (`h-64`)
3. Mobile (<768px): character + chip hidden, auth card stands alone (unchanged)
4. Float animation still loops smoothly without breaking the chip overlap

