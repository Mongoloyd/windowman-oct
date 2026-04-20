

## Goals
1. **Bigger character on desktop** — show the full pill-sitting illustration at its native composition (with the in-image message visible), scaled up significantly. Proportional scale-down on tablet. Hide on mobile.
2. **Fix CLS** — eliminate cumulative layout shift on `/partner/login` and across the site by reserving space for images that currently load without intrinsic dimensions.

---

## Part 1 — Resize the floating WindowMan

### Current state (line 519–533)
- `h-36 w-auto` (144px tall) — too small for desktop
- `-top-8` — barely peeks above the card
- `lazy` loading — also a CLS contributor (see Part 2)

### New responsive sizing
Replace the image classes with a viewport-aware ladder so the **entire illustration** (pill + speech message baked into the AVIF) is visible at full glory on desktop:

```tsx
<div className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-0
                hidden md:block
                -top-40 lg:-top-56
                motion-reduce:animate-none animate-float-soft">
  <img
    src="/images/wman-reading.avif"
    alt=""
    aria-hidden="true"
    width="320"
    height="320"
    fetchpriority="low"
    decoding="async"
    className="h-56 md:h-64 lg:h-80 xl:h-96 w-auto drop-shadow-[0_18px_36px_rgba(0,0,0,0.55)]"
  />
</div>
```

Behavior:
| Viewport | Image height | Visible? |
|---|---|---|
| Mobile (<md / <768px) | — | **Hidden** |
| Tablet (md, 768–1023) | 256px (`h-64`) | Visible, scaled |
| Desktop (lg, 1024–1279) | 320px (`h-80`) | Full glory |
| Desktop (xl, ≥1280) | 384px (`h-96`) | Largest |

### Clearance adjustment
The auth column wrapper currently has `pt-20` (80px). Bump for the bigger figure on `md+` only:
```tsx
<div className="relative pt-0 md:pt-44 lg:pt-60 xl:pt-72">
```
This reserves vertical space matching the negative-top offset, so the figure has room to float above without overlapping the mobile WindowMan/Partner Portal header (which is `lg:hidden` anyway, but the new spacing prevents collision on tablet).

### Why this works for "the message in the image"
The AVIF already contains the speech bubble baked into the artwork. Currently at `h-36`, that text is too small to read on a 1497px display. At `h-80`/`h-96`, the bubble becomes legible at a normal reading distance. Aspect ratio is preserved via `w-auto` so the composition (character + pill + bubble) stays intact.

---

## Part 2 — Fix CLS site-wide

### Root causes (from a quick audit)
1. **Images without `width`/`height` or aspect-ratio**: browser allocates 0 height initially, then jumps when the image decodes. The flywheel image and the new wman image are prime offenders.
2. **`loading="lazy"` on above-the-fold images**: defers layout calculation past initial paint, causing late shifts.
3. **Custom fonts via `@font-face`**: if `font-display: swap` is used without `size-adjust`, fallback→webfont swap reflows headings (FOUT shift). Already preloaded in `index.html`, but worth verifying `font-display`.
4. **Glassmorphic auth card** with content that renders conditionally (loading states, view switch) — those are *user-initiated*, not initial CLS, so safe.

### Fixes

**A. Add intrinsic dimensions + `aspect-ratio` to the two `/partner/login` images**

Floating wman (handled in Part 1 with `width="320" height="320"`).

Flywheel image (line 553–558) — wrap or set aspect ratio:
```tsx
<img
  src="/images/flywheel-wman.avif"
  alt="WindowMan partner intelligence flywheel"
  width="800"
  height="600"
  loading="lazy"
  decoding="async"
  className="w-full h-auto object-contain"
  style={{ aspectRatio: "4 / 3" }}  // adjust to actual ratio
/>
```
I'll measure the actual AVIF dimensions during implementation (via `identify` or by inspecting the file) to set the correct `width`/`height` attributes — that's what eliminates the shift.

**B. Site-wide image audit**
Run `grep -r "<img" src/` to find every raw `<img>` tag. For each one above the fold or inside a layout-affecting container, ensure both `width` and `height` attributes are present (or an explicit `aspect-ratio` CSS rule on the wrapper). I'll fix the top offenders in this same pass:
- Hero images on `/`
- Logo in `PublicNavbar` and partner header
- Any `<img>` in `Footer`, `NativeBookingForm`, `ContractorLogin`

**C. Font swap shift**
Check `src/index.css` for `@font-face` blocks and add `font-display: optional` or `size-adjust` adjustments on the fallback if Barlow Condensed / DM Sans are still used. (Per `tailwind.config.ts` they've been removed in favor of system fonts, so this may already be clean — I'll verify.)

**D. Reserve space for the seam-fade overlay**
The `absolute bottom-0 ... h-32 bg-gradient-to-b` overlay (line 545–548) is `pointer-events-none` and absolute, so it doesn't cause CLS. Leaving as-is.

### Verification approach
After edits, I'll:
1. Visually QA at 375 / 768 / 1024 / 1497 px.
2. Use the browser performance profile tool to measure CLS before/after on `/partner/login` and `/`.
3. Confirm the floating character is hidden on mobile, scaled on tablet, and full-size on desktop with the in-image bubble legible.

---

## Files changed
```text
src/pages/ContractorLogin.tsx   (resize float wman, hide on mobile, add intrinsic dims to flywheel + wman, bump auth-column pt-* spacing)
src/index.css                   (verify/adjust font-display if needed — only if a webfont @font-face exists)
[other image files site-wide]   (add width/height attrs to top CLS offenders found in grep audit)
```

## Out of scope
- No layout/copy changes
- No animation timing changes (5s float-soft stays)
- No NativeBookingForm or auth logic changes
- No new assets

