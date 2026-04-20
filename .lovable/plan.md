

## Goal
Reskin `/partner/login` with the cinematic blue + warm-orange-accent aesthetic from the reference image. Eliminate the hard vertical divider between the two columns. Use radial gradients, soft glow blobs, and glassmorphic panels so blue zones blend into each other. Preserve all current fonts, copy, and auth logic.

## Direction: **Darker** (cinematic deep-blue, not light)
- Reference image is clearly dark cinematic blue with warm amber rim-light → darker route fits better than lightening to the About page's pale blue. About page is daylight; reference is dusk/cinema.
- Darker also keeps continuity with the existing `NativeBookingForm` section below (which is `#0d0d0d`) — the page reads as one moody gradient flowing top-to-bottom into the booking section instead of jarring light→dark.
- Contrast: white text (`#ffffff`) on `hsl(215 50% 10%)` ≈ **18:1**, slate-300 (`#cbd5e1`) on same ≈ **12:1** — both well above the 5:1 floor.

## Visual recipe (no new files, all in `ContractorLogin.tsx` + small CSS additions)

### 1. Replace the flat dark bg with a **layered cinematic backdrop**
Root wrapper becomes `relative overflow-hidden` and gets three stacked layers:

- **Base gradient** (linear, top→bottom): `from-[hsl(215,55%,8%)] via-[hsl(218,50%,11%)] to-[hsl(220,45%,7%)]` — keeps the page dark but adds vertical breath
- **Radial glow A** (left/upper): soft cobalt blob `radial-gradient(60% 50% at 25% 30%, hsla(217,90%,55%,0.18), transparent 70%)`
- **Radial glow B** (right/lower): warm amber rim `radial-gradient(50% 40% at 80% 70%, hsla(28,90%,55%,0.10), transparent 70%)` — the orange accent from the reference
- **Subtle grain overlay**: `bg-[url('data:image/svg+xml...noise')] opacity-[0.04] mix-blend-overlay` to match the cinematic film-grain feel of the reference

These three layers eliminate any hard line because the entire viewport is a continuous gradient field.

### 2. Remove the hard column divider
- Drop `border-r border-white/5` from the left panel
- Drop the left panel's distinct `bg-[hsl(222,47%,8%)]` — instead let it sit transparently on top of the unified backdrop
- Add a soft **glassmorphic frame** to *both* the left brand area and the right auth card: `backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]`
- The brand panel becomes a floating glass card, not a wall

### 3. Skeuomorphic depth on the auth card
Mirror the reference's "frosted square with hand icon":
- Auth `<Card>` gets a stronger inset highlight + outer shadow combo: `shadow-[inset_0_1px_0_hsla(0,0%,100%,0.08),inset_0_-1px_0_hsla(0,0%,0%,0.4),0_40px_100px_-20px_rgba(0,0,0,0.7)]`
- Inputs get a subtle "well" treatment: slightly darker than card surface + inset top-shadow so they look pressed in
- Submit button gains a soft cobalt-to-deeper-cobalt vertical gradient + warm amber focus glow on hover (matches the reference's blue+orange duotone)

### 4. Brand mark refinement
- Shield icon container becomes a frosted square (mimicking the reference's hand-in-square): `bg-white/[0.06] backdrop-blur-md border border-white/10 shadow-inner` instead of the current solid `bg-sky-500/20`
- Adds a thin warm amber accent dot on the trio of bullets so the orange accent shows up in 3 quiet places (icon ring hover, button focus glow, bullet dot)

### 5. Bullet list polish
- Replace solid sky-500 dots with a small horizontal divider line (per reference's separator under "The Overwhelmed Kitchen") — `h-px w-6 bg-gradient-to-r from-amber-400/40 to-transparent` next to each bullet
- Bullet text bumped from `text-slate-500` (~3.5:1, fails 5:1) to `text-slate-300` (~12:1) — fixes a real contrast bug

### 6. Seam into NativeBookingForm
The booking section below is `#0d0d0d`. Add a 120px-tall fade strip at the bottom of the login section: `bg-gradient-to-b from-transparent to-[#0d0d0d]` so the cinematic blue dissolves into the booking section's near-black with zero visible boundary.

## Fonts & contrast (unchanged but verified)
- All existing classes (`font-mono`, `font-semibold`, `font-bold`, default `font-sans` = DM Sans) preserved
- Text color audit:
  - Bullet text: `text-slate-500` → `text-slate-300` (fixes contrast)
  - Eyebrow labels: `text-slate-500` → `text-slate-400` (passes 5:1 on darker bg)
  - All headings stay `text-white`
  - Body `text-slate-400` already passes on the new darker base

## Files changed
```text
src/pages/ContractorLogin.tsx   (edit: wrapper layers, glass card classes, bullet/contrast tweaks)
src/index.css                   (add: 1 keyframe for the soft amber-glow pulse on hover, optional)
```
No new components. No image assets imported. NativeBookingForm untouched. Auth logic untouched.

## Out of scope
- No changes to `NativeBookingForm`, `PartnerGuard`, `usePartnerAuth`, edge functions, RLS, OTP/Twilio, scan, or `/about` page
- No font swap, no copy edits beyond the contrast-driven slate-500→slate-300 bullet change

## Verification
1. `/partner/login` shows a continuous cinematic blue field with no hard vertical line
2. Subtle warm amber glow visible in the lower-right area (matches reference)
3. Both panels read as floating glass over one shared backdrop
4. All text passes 5:1 contrast (spot-check bullets, eyebrows, body)
5. Page bottom dissolves into the dark `NativeBookingForm` with no visible seam
6. Mobile (375px): single-column flow still works, glass card renders, glow blobs scale via percentage positions

