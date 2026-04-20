

## Goal
Add `public/images/flywheel-wman.avif` to `/partner/login` with responsive placement:
- **Desktop (≥lg, 1024px+):** inside the left brand panel, above the descriptive paragraph "Access real-time dossiers…" and above the 3-bullet list.
- **Tablet (md 768px → lg 1023px):** between the auth card column and the `<NativeBookingForm />` section below (i.e., above the calendar, below the form).
- **Mobile (<md):** hide it (or show it below auth — pick one; default plan = hide to keep mobile lean, since flywheel diagrams read poorly at <400px).

## Current layout reality
- Desktop brand panel: `hidden lg:flex lg:w-[45%]` — left column with logo, headline, paragraph, bullets.
- Below `lg` the brand panel is hidden; only a small centered `WindowMan / Partner Portal` header shows above the auth card.
- `<NativeBookingForm />` is a sibling section directly below the hero `<div>`.

## Implementation (single file: `src/pages/ContractorLogin.tsx`)

### 1. Desktop placement — inside the glass brand panel
Inside the existing `<div className="flex flex-col justify-between h-full rounded-2xl …">`, insert the image **between** the headline block and the descriptive paragraph (above "Access real-time dossiers…"). Wrap in a frosted container so it reads as a product visual, not a floating PNG:

```tsx
<div className="my-8 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-4 shadow-[inset_0_1px_0_hsla(0,0%,100%,0.06)]">
  <img
    src="/images/flywheel-wman.avif"
    alt="WindowMan partner intelligence flywheel"
    loading="lazy"
    className="w-full h-auto object-contain"
  />
</div>
```

Position: directly **before** the `<p>Access real-time dossiers…</p>` paragraph, so order top→bottom in the panel is: logo → "Partner Portal" → "Weaponized Competitive Intelligence" → **flywheel image** → descriptive paragraph → bullets.

### 2. Tablet placement — between auth column and booking section
Currently the JSX returns the hero `<div>` then `<NativeBookingForm />` as siblings inside a fragment. Insert a tablet-only band between them:

```tsx
<div className="hidden md:block lg:hidden bg-[hsl(218,50%,9%)]">
  <div className="mx-auto max-w-2xl px-6 py-12">
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-5 shadow-[inset_0_1px_0_hsla(0,0%,100%,0.06)]">
      <img
        src="/images/flywheel-wman.avif"
        alt="WindowMan partner intelligence flywheel"
        loading="lazy"
        className="w-full h-auto object-contain"
      />
    </div>
  </div>
</div>
```

Background tone matches the existing cinematic blue mid-tone so the seam-fade-to-`#0d0d0d` continues naturally into the booking section without a hard line.

### 3. Mobile — hidden
The tablet band uses `hidden md:block lg:hidden`, so mobile (<768px) sees neither the desktop brand panel image nor the tablet band. Mobile flow stays: small WindowMan header → auth card → booking section. (If you want it on mobile too, swap to `block lg:hidden` — say the word.)

## Contrast / fonts
No font or text color changes. Image is decorative; `alt` provides screen-reader context. No new CSS tokens.

## Files changed
```text
src/pages/ContractorLogin.tsx   (2 JSX insertions: 1 in brand panel, 1 between hero and NativeBookingForm)
```

## Out of scope
- No edits to `NativeBookingForm`, auth logic, RLS, edge functions, or styling tokens.
- No image processing — using the existing `.avif` as-is from `/public/images/`.

## Verification
1. Desktop (≥1024px): flywheel renders inside the left glass panel between the headline and the descriptive paragraph.
2. Tablet (768–1023px): flywheel band appears between the auth card and the booking section.
3. Mobile (<768px): flywheel is not rendered; layout is unchanged.
4. No layout shift or seam between the tablet band and the `#0d0d0d` booking section.

