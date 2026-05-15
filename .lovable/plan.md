# Unify Lock Badges with Emoji 🔒

Replace the Lucide `<Lock />` SVG inside the three circular badges with the actual emoji `🔒` so the color (yellow/orange padlock) is identical everywhere. Only the font-size changes per location to create a small → medium → large progression. No other visual or logic changes.

## Targets and sizes

Top → Middle → Bottom, smallest → largest:

1. **Top — `PreviewUnlockSlot.tsx`** (header "VERIFICATION REQUIRED" badge, blue circle, 44×44)
   - Replace `<Lock size={18} className="text-blue-300" />` with `<span className="text-[18px] leading-none">🔒</span>`
   - Smallest of the three.

2. **Middle — `PartialUnlockOverlay.tsx`** (center "LOCKED · VERIFICATION REQUIRED" badge, blue circle, 56×56)
   - Replace `<Lock size={22} className="text-blue-300" />` with `<span className="text-[26px] leading-none">🔒</span>`
   - A bit larger.

3. **Bottom — `PartialRevealHero.tsx`** (locked teaser "Unlock Your Private Truth Report" badge, cyan circle, 44×44)
   - Replace `<Lock size={18} className="text-[hsl(var(--fr-cyan-soft))]" />` with `<span className="text-[28px] leading-none">🔒</span>`
   - Largest, matching the size shown in chat. (The circle stays 44×44; the emoji slightly fills it more.)

## How emojis are styled

- Use a `<span>` with `text-[Npx] leading-none` so the glyph stays vertically centered in its flex parent (the existing `flex items-center justify-center` wrappers handle centering automatically).
- No `color` class needed — emoji renders in its native yellow/orange regardless of theme.
- Remove the now-unused `Lock` import from each file (or leave if other usage exists; will check during implementation).

## Out of scope

- Circle sizes, colors, glow, borders, ring — unchanged.
- All copy, layout, OTP/phone logic — unchanged.
- No new inline lock prefixes in eyebrow text (dropped from earlier proposal).

## Verification

Re-screenshot `/sandbox/report-preview?v=v3&mode=preview` at mobile + desktop and confirm the three badges show the same yellow-orange 🔒 with progressive sizing.
