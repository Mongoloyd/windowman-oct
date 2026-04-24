## Truth Strip — Interactive Funnel for the Operator Command Center

Upgrade the existing 6-stage funnel inside `MasterCommandCenter.tsx` from a static KPI grid into an interactive **Truth Strip**: each tile becomes a clickable drill-down with a 24h delta indicator, prior-stage conversion %, and a global Time Scope toggle (Today / 7D / All).

The Daily Revenue Target stays in lock-step with the strip's "Closed" stage (already summing `deal_value` → `revenue_amount` for `sold_closed` / `won` / `sold` / `closed` / `closed_won`).

---

### Files touched (1)

- `src/components/admin/MasterCommandCenter.tsx`

No new files. No schema changes. No edge function edits. No RLS edits. No changes to OCR scanner, Twilio/OTP, scoring, or `useAnalysisData`.

---

### What changes inside the file

**1. Time Scope toggle (header strip)**

A new compact segmented control beside the funnel header: `Today · 7D · All`. Stored in local `useState<'today' | '7d' | 'all'>('all')`. Drives a derived `windowMs` (start-of-today / now-7d / 0).

**2. Funnel computation — windowed + 24h delta**

Replace the current single-pass `flow` `useMemo` with a richer computation that produces, per stage:

- `count` — leads in the active scope whose stage timestamp falls in-window
- `prevCount` — same metric for the immediately previous equal-length window
- `delta` — `count - prevCount`
- `deltaPct` — `(delta / prevCount) * 100`, with sane fallback when `prevCount === 0`
- `convPct` — `count` ÷ prior-stage `count` (Captured = baseline, no conv %)

Stage → timestamp mapping (already correct in the file):

| Stage     | Predicate                                   |
|-----------|---------------------------------------------|
| Captured  | `created_at`                                |
| Verified  | `phone_verified_at`                         |
| Scanned   | leads with `latest_analysis_id` (timestamped via `updated_at` for window filter) |
| Routed    | `routed_to_contractor_at`                   |
| Booked    | `appointment_booked_at`                     |
| Closed    | `closed_at` AND `deal_status` ∈ CLOSED_STATUSES |

`CLOSED_STATUSES` already includes `sold_closed`, `won`, `closed_won`, `sold`, `closed`. No change.

**3. Revenue stays canonical**

`revenueToday` calc is unchanged — it already sums `deal_value ?? revenue_amount` for closed-today leads in CLOSED_STATUSES. The Truth Strip's Closed tile and the Daily Revenue Target read from the same `closed_at` + status predicate, guaranteeing sync.

**4. Interactive KPI tile (`KpiTile` rewrite)**

`KpiTile` becomes a `<button>` with this dense layout:

```text
┌──────────────────────────────┐
│ VERIFIED            🛡        │  ← label + icon
│ 1,284                         │  ← bold tabular count
│ ▲ 12% · 80% of Captured       │  ← delta · conversion
└──────────────────────────────┘
```

- Delta: `▲` emerald-600 when ≥0, `▼` rose-600 when <0, slate when neutral/zero baseline
- Conv %: muted slate, omitted on Captured tile (replaced by "baseline")
- Loading/empty state: shows `—` instead of `0%` when prior window is empty
- Glass aesthetic: `backdrop-blur-sm bg-card/95 border-border/60 hover:bg-muted/40`
- Focus ring + `aria-label` describing stage, count, delta, conversion
- Click handler: calls `onTileClick(stageKey)`

**5. Drill-down behavior**

The user's spec says "filter the data tables below". The repo has **no global AdminFilterState** — filtering lives inside each sub-component (per `tech/admin-filtering-isolation` memory). To respect that pattern and still deliver the drill-down promise, each tile navigates to the most relevant existing surface via the already-wired `onNavigateTab` prop:

| Tile      | Action                                            |
|-----------|---------------------------------------------------|
| Captured  | `onNavigateTab('pipeline')` — full lead pipeline  |
| Verified  | `onNavigateTab('pipeline')` — verified is the default healthy state |
| Scanned   | `onNavigateTab('pipeline')`                       |
| Routed    | `onNavigateTab('routing')`                        |
| Booked    | `onNavigateTab('outcomes')`                       |
| Closed    | `onNavigateTab('outcomes')`                       |

This is non-destructive: no new shared filter state, no breaking of isolated filter patterns.

**6. Layout & responsiveness**

- The 6 tiles already use `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3` — kept.
- Header gains a flex row: title left, scope toggle right, leads-in-scope badge collapses to a tooltip on small screens.
- Glassmorphism: tiles get `bg-card/95 backdrop-blur-sm` (matches existing readiness banner).

**7. Performance**

All metrics computed in a single `useMemo` keyed on `[leads, scope]`. No new queries. Reuses the existing TanStack `["admin", ...]` caches that other surfaces share, so cache hits are immediate.

---

### What is explicitly NOT done

- No global `AdminFilterState` introduced (would conflict with `tech/admin-filtering-isolation`).
- No changes to `ActivePipeline`, `GhostRecovery`, `RoutingDesk`, or `OutcomeTrackingReport` internals.
- No new edge functions, no DB migrations, no RLS edits.
- Scanner / OTP / Twilio / scoring / RLS untouched.
- `CLOSED_STATUSES` set unchanged — `sold_closed` already canonical.

---

### Verification after build

1. `npx tsc --noEmit` — must be zero errors.
2. Mission Control loads with 6 tiles, each clickable, each showing delta + conv %.
3. Time Scope toggle re-computes counts & deltas without refetch.
4. Closed tile count × avg-deal aligns with Daily Revenue Target progress.
5. Clicking each tile navigates to the mapped tab.
6. Snapshot CSV export still includes funnel + revenue + signals (no shape change required, but funnel block will reflect current scope).
