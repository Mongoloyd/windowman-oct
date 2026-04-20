

## Goal
Add the uploaded WindowMan-reading-a-report image above the "Secure Access" auth card with a subtle, slow vertical float (≈2–3mm). The bottom of the image should tuck **behind** the card so it visually anchors to the form, giving the impression of a small companion peeking out from behind the panel.

## Implementation

### 1. Add the asset
Copy the upload to a stable public path:
- `user-uploads://Screenshot_2026-04-15_012205.avif` → `public/images/wman-reading.avif`
  (alpha-channel AVIF — perfect, no background plate to fight the cinematic blue)

### 2. Add a slow float keyframe (`tailwind.config.ts`)
The existing `fade-in` / `scale-in` are too fast and don't loop. Add one new utility:
```ts
keyframes: {
  "float-soft": {
    "0%, 100%": { transform: "translateY(0px)" },
    "50%":      { transform: "translateY(-3px)" },   // ~2.5mm at 96dpi
  },
},
animation: {
  "float-soft": "float-soft 5s ease-in-out infinite",
}
```
5s cycle = slow and "alive," not distracting. Respects `prefers-reduced-motion` via a Tailwind variant on the wrapper (`motion-reduce:animate-none`).

### 3. Place the image above the auth card (single edit, `src/pages/ContractorLogin.tsx`, ~line 519)
Wrap the existing auth card in a `relative` container and insert the floating image as a sibling positioned above it, with the bottom ~25% overlapping behind the card via negative margin + `z-0`:

```tsx
<div className="relative">
  {/* Floating WindowMan — bottom tucks behind the card */}
  <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-28 z-0 motion-reduce:animate-none animate-float-soft">
    <img
      src="/images/wman-reading.avif"
      alt=""
      aria-hidden="true"
      loading="lazy"
      className="h-36 w-auto drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]"
    />
  </div>

  {/* Existing auth card — bumped to z-10 so it covers the image's lower portion */}
  <div className="relative z-10 rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_hsla(0,0%,100%,0.08),inset_0_-1px_0_hsla(0,0%,0%,0.4),0_40px_100px_-20px_rgba(0,0,0,0.7)]">
    {rightPanel()}
  </div>
</div>
```

### 4. Spacing nudge
Add `pt-20` (or increase top spacing of the auth column wrapper) so the floating figure has clearance and doesn't clip into the mobile WindowMan/Partner Portal header on `<lg` viewports. On desktop, the floating figure replaces some of that whitespace gracefully.

## Behavior summary
- Image floats up/down ~3px continuously, 5s loop, ease-in-out → reads as breathing/idle.
- Bottom ~25% of the image is hidden behind the glass auth card (z-stacking + negative `top`).
- Hidden from screen readers (`alt=""` + `aria-hidden`) — purely decorative.
- Honors `prefers-reduced-motion` (no animation for users who request it).
- Works on all viewports; image stays centered above the form on mobile/tablet/desktop.

## Files changed
```text
public/images/wman-reading.avif      (new asset, copied from upload)
tailwind.config.ts                   (add float-soft keyframe + animation)
src/pages/ContractorLogin.tsx        (wrap auth card, insert floating image, spacing nudge)
```

## Out of scope
- No changes to the brand panel, flywheel image, NativeBookingForm, auth logic, or RLS.
- No new components, no edge functions.

## Verification
1. Image appears centered above the "Secure Access" card on `/partner/login`.
2. Bottom of the image is partially obscured by the glass card.
3. Slow vertical breathing motion (~3px, 5s) is visible but not distracting.
4. Mobile (375px), tablet (768px), desktop (1497px): no clipping, no horizontal overflow.
5. With OS "Reduce motion" enabled, the image is static.

