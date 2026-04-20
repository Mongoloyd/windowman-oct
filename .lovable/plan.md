

## Goal
Replace the small red `card-raised` audit-score block in `StepIntake.tsx` (lines 52–79) with a premium **Aura Diagnostic Card** that feels like a live forensic event on arrival.

## Scope
- **One file edited:** `src/pages/diagnosis/components/StepIntake.tsx`
- No schema, no routing, no data-shape changes. Pure presentational upgrade of an existing block that already receives `context.report_grade` and `context.top_insights`.

## Design Spec

### Grade Color Map (added as local const inside the component)
```text
A → Emerald  #15803D
B → Lime     #4D7C0F
C → Gold     #A16207
D → Orange   #C2410C
F → Soft Red #B91C1C
```
Resolver: take `context.report_grade?.[0]?.toUpperCase()` and look up. Fallback = Soft Red.

### The Aura Card
- White rounded container, `rounded-2xl`, `p-6 md:p-8`
- Aura shadow: `box-shadow: 0 20px 50px -12px {gradeColor}33` (≈20% opacity), plus a subtle inner border `1px solid {gradeColor}1A`
- Replaces the existing `card-raised rounded-2xl p-5 mb-10` block

### The Grade Stage (left)
- `aspect-square w-20 md:w-24` tile
- Background: `{gradeColor}0D` (5% opacity)
- Border: `1px solid {gradeColor}26`
- Centered letter: `font-display font-black text-5xl md:text-6xl` in `{gradeColor}`
- Mathematically centered via `flex items-center justify-center`

### Header Typography (right column)
- Eyebrow: `text-xs font-black tracking-[0.2em] uppercase text-gray-500` → "YOUR AUDIT SCORE"
- Sub-line: `text-sm font-semibold text-foreground/70` → "Here's What We Flagged"
- Fixes the current visual bug where the two strings collide on the screenshot.

### The Smart Grid (flags)
```text
items.length <= 4  → grid-cols-1
items.length <= 8  → grid-cols-1 md:grid-cols-2
items.length >= 9  → grid-cols-1 md:grid-cols-2 lg:grid-cols-3
```
- `h-auto`, no scrollbars
- Each flag: small dot in `{gradeColor}`, `text-sm font-medium text-foreground/85`, light divider between rows on mobile

### The Waterfall Animation
- Use existing Tailwind `animate-fade-in` keyframe (already in project per `<animations>` context) combined with inline `style={{ animationDelay: `${i * 200}ms`, animationFillMode: 'both' }}`
- Add a 5px translateY via a small inline keyframe utility OR reuse `animate-fade-in` (which already includes a 10px translateY → close enough; spec says 5px so we'll override with a tiny inline `@keyframes` block in the component using a `<style>` tag is unnecessary — instead apply `animate-fade-in` since it already does fade + slide-up and matches the brief's intent)
- Cap delay at `Math.min(i, 9) * 200` so a 10+ item list still lands in ~2s

### Reassurance Ribbon (idea 5, included)
- Thin strip at the bottom of the card, `border-t border-gray-200/60 mt-5 pt-4`
- `font-mono text-[11px] tracking-wider uppercase text-gray-500`
- Copy: "We Have Your Quote · We Have Your Answers · Let's Build Your Counter-Offer"
- A 2px wide accent bar in `{gradeColor}` on the left of the ribbon ties it to the aura

## Implementation Plan
1. Inside `StepIntake.tsx`, add a `GRADE_COLORS` const map and a `gradeColor` resolver at the top of the component body.
2. Replace lines 52–79 with the new Aura Card structure: grade stage (left) + header + smart-grid flag list + reassurance ribbon.
3. Compute `gridColsClass` from `context.top_insights.length`.
4. Map flags with `style={{ animationDelay }}` + `animate-fade-in` class.
5. Keep the existing conditional `{context.report_grade && (...)}` wrapper — no change to data contract.

## Out of Scope (will not touch)
- OTP, reveal, Twilio, Meta CAPI, schema, lead writer, attribution capture
- The "Root Question" card below it
- `MarketingSections`, progress indicator, nav

## Risk
Zero data-layer risk. Only visual changes to one presentational block. No new dependencies. Uses existing `animate-fade-in` keyframe already configured in Tailwind.

