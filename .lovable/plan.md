

## Hero CTA Render Desync Fix

### Problem
On first paint, the blue "Scan My Quote" CTA appears immediately while the orange "No Quote Yet?" CTA pops in ~200-400ms later. Cause: `PowerToolFlow` is `React.lazy(...)` wrapped in `<Suspense fallback={<div className="h-[54px]" />}>`. The fallback only reserves height (no width), and the heavy 1641-line module must download + parse before the orange button can render. Two visible problems result:

1. The orange button paints later than the blue one (desync).
2. The fallback is height-only, so even the layout reserve is wrong on desktop (CTAs reflow horizontally).

Plus: H1 still uses `uppercase` + ALL-CAPS source text instead of the Title-Case version.

### Strategy
Split the lightweight visible button away from the heavy modal/scan logic. The button renders synchronously in the same paint as the blue CTA; the 1600-line modal flow stays lazy and loads on click. This kills the desync without bloating the initial JS bundle.

### Change scope
**3 files, ~30 lines of net change.**

1. **`src/components/PowerToolButton.tsx`** — NEW small file (~15 lines)
   Extract the existing `PowerToolButton` component (currently inline in `PowerToolDemo.tsx` lines 252–262) into its own module. Pure styled button, zero deps beyond React. This is the only thing that needs to render in the first paint.

2. **`src/components/PowerToolDemo.tsx`** — minimal edit
   - Remove the inline `PowerToolButton` definition (it now lives in its own file).
   - Import it from the new file and continue using it inside `PowerToolFlow`'s render so the lazy modal path is unchanged.

3. **`src/components/AuditHero.tsx`** — the real fix
   - Static import the lightweight button: `import PowerToolButton from "./PowerToolButton"`.
   - Keep the heavy flow lazy but **only mount it when the user actually clicks** (or when `triggerPowerTool` flips true). Use a small `mounted` state so we never download `PowerToolDemo.tsx` until needed.
   - In the CTA row, render `<PowerToolButton onClick={...} />` directly next to the blue CTA → identical render cycle, zero desync, zero layout shift.
   - On click (or when `triggerPowerTool` becomes true), set `mounted=true` and render the lazy `PowerToolFlow` with `triggerOpen` set, wrapped in `Suspense` with a `null` fallback (it's a portal modal, no inline footprint to reserve).
   - Drop the height-only Suspense placeholder since the visible button is no longer behind Suspense.

4. **H1 cleanup in `AuditHero.tsx`** (lines 140–155)
   - Remove `uppercase` from the H1 className.
   - Replace the all-caps default headline with the Title-Case version:
     `Your Quote Looks Legitimate. / That's Exactly What `**`They're Counting On.`**` ` (orange word unchanged in styling).
   - No copy meaning change, no layout change beyond the case shift.

### Final CTA row (AuditHero.tsx)
```tsx
<div className="flex flex-col sm:flex-row items-center lg:items-start gap-3 sm:gap-4 w-full sm:w-auto">
  <button
    onClick={() => onUploadQuote?.()}
    className="btn-depth-primary w-full sm:w-auto whitespace-nowrap"
    style={{ fontSize: 18, padding: "20px 40px" }}
  >
    Scan My Quote<span className="inline sm:hidden lg:inline"> — It's Free</span>
  </button>

  <PowerToolButton onClick={() => setMounted(true)} />
</div>

{(mounted || triggerPowerTool) && (
  <React.Suspense fallback={null}>
    <PowerToolFlow
      onUploadQuote={onUploadQuote}
      triggerOpen
      onToolClose={() => { setMounted(false); onPowerToolClose?.(); }}
    />
  </React.Suspense>
)}
```

### Why this is the right tradeoff
- **No desync**: both buttons are static imports rendering in the same React commit.
- **No layout shift**: orange button is always present at full footprint from frame 1.
- **No bundle bloat**: the 1641-line `PowerToolDemo` still ships as its own chunk and loads on click — exactly the original lazy goal, just gated correctly.
- **`triggerPowerTool` prop preserved**: external triggers still work via the `mounted || triggerPowerTool` condition.

### What does NOT change
- No backend logic, routing, GTM, scanner, OTP, admin code touched.
- Button styling, copy ("Scan My Quote" / "No Quote Yet? Start Here"), spacing, click behavior — all preserved exactly.
- Mascot, grade card, trust pill, stats strip, OCR image — all untouched.
- `PowerToolDemo.tsx` internal modal/scan logic — untouched (only the small button definition is extracted).
- `useTickerStats`, `SampleGradeCard`, `TrustBullets`, `motion` animations — untouched.

### Verification
- TypeScript clean (`tsc --noEmit`).
- Visually confirm both CTAs paint together on initial load (no orange pop-in).
- Click orange CTA → modal still opens (lazy chunk loads on demand).
- `triggerPowerTool` external trigger still opens modal.

