
# Pilot Readiness — Mobile Layout Pass

Tighten only the two sections that fail at narrow widths. Cards and badges keep their current size; only the **stacking direction** and **breakpoints** change.

## Changes (single file: `src/components/admin/PilotReadiness.tsx`)

### 1. Routing Flow — vertical-on-mobile, horizontal-on-desktop
Currently a single `flex` row with `overflow-x-auto`, so on mobile the right half of the funnel (Routed → Booked → Closed) is hidden behind a scroll. Switch to:

- `flex flex-col sm:flex-row` on the container
- `FlowArrow` rotates: `rotate-90 sm:rotate-0` (down arrow on mobile, right arrow on desktop)
- `FlowStep` keeps its `min-w-[120px]` but becomes `w-full sm:w-auto` so each step fills the mobile row instead of being cramped
- Drop `overflow-x-auto` — no longer needed

Result: on mobile the 6 steps stack vertically with down arrows between them; on `sm+` the existing horizontal layout returns unchanged.

### 2. Market Coverage — single column on mobile
Currently `grid-cols-2` at base width truncates most Florida county names ("Miami-Dade", "Palm Beach", "Hillsborough"). Change grid to:

- `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`

Each county tile keeps its existing padding, border, badge size, and `truncate` rule — but at the smallest width each tile gets the full row, so the name renders in full.

### 3. Header card — minor wrap fix
The header row uses `flex items-center gap-2 flex-wrap` already, which is correct. No change.

### Sections explicitly NOT changed
- `OneContractorSummaryStrip` (reused component, owns its own responsive grid)
- `MarketOpsFeed` (reused, owns its own layout)
- `SharedMarketReadinessSection` (reused)
- `ExplainerCard` grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`) — already correct
- `ReceiveRow` grid (`grid-cols-1 sm:grid-cols-2`) — already correct
- All card padding, badge sizes, font sizes, icon sizes — unchanged

## Constraints honored

- Read-only surface; no handlers, no state, no new data, no new types
- No font-size shrinking, no badge shrinking, no card padding reduction
- Pure Tailwind responsive class adjustments
- One file touched: `src/components/admin/PilotReadiness.tsx`

## Verification after change

- At 375px width: routing flow stacks vertically with all 6 steps visible; county tiles render one-per-row with full names
- At ≥640px (`sm`): layout matches the current desktop appearance exactly
- `npx tsc --noEmit` clean (no type changes)
