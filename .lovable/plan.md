# Phase 25 — Master Command Center / Final Synthesis

## What's already built (do not rebuild)

The repo's "Mission Control" surface area is unusually mature. Existing pieces I will compose:

| Need | Existing real asset |
|---|---|
| Operator shell + tabs | `AdminShell` + `AdminPrimaryTabs` (panel + route tabs, badge counts) |
| Funnel KPIs (captured/verified/scanned/routed/booked/closed) | `PilotReadiness.flowCounts` derivation; `OneContractorSummaryStrip` (Routed/Contacted/Booked/Stale/Reactivation); `CommandCenter` (North Star rate, Total Scans, Verified, Ghost) |
| Global event feed | `MarketOpsFeed` — chronological multi-event feed across leads + opportunities + routes |
| Health / readiness signal | `LaunchReadinessSurface` health signals (`operational` / `attention` / `unknown`); `DispatchHealthCard`; webhook health in `CommandCenter` |
| Data-quality snapshot | `DataQualityFieldIntegritySurface` (strong/partial/sparse classifier across leads, opps, routes, contractors) |
| Revenue-integrity / outcome snapshot | `OutcomeTrackingReport` (post-route buckets: stale_unresolved, interested_not_booked, booked, closed, dead) |
| Quick actions into surfaces | `AdminPrimaryTabs` already supports `onNavigateTab(tab)` everywhere |
| Data hooks | `invokeAdminData("fetch_leads")`, `fetchOpportunities`, `fetchRoutes`, `fetchContractors`, `fetchWebhookDeliveries` (all already cached via TanStack with `["admin", …]` keys) |

**Implication:** Phase 25 is a new **synthesis tab**, not a new system. Smallest safe diff.

## What I will build

### 1. New surface: `MasterCommandCenter.tsx`
One file at `src/components/admin/MasterCommandCenter.tsx`. Pure read-and-compose. Layout, top to bottom:

```text
┌────────────────────────────────────────────────────────────────┐
│ READINESS BANNER  [● System Healthy / ▲ Needs Attention]      │
│ Derived: roll-up of {contractors loaded, routes loaded,        │
│ opportunities loaded, webhook dead-letter ==0, ghost <30%}     │
├────────────────────────────────────────────────────────────────┤
│ TOP-LEVEL KPI STRIP (6 tiles)                                  │
│ Captured │ Verified │ Scanned │ Routed │ Booked │ Closed       │
│ (real lead-level timestamps; reuses PilotReadiness derivation) │
├──────────────────────────────────┬─────────────────────────────┤
│ LEFT (2/3): Global Ops Feed      │ RIGHT (1/3): Quick Actions  │
│   <MarketOpsFeed leads={leads}/> │   - Routing Desk            │
│   (already a high-density feed)  │   - Active Pipeline         │
│                                  │   - Lead Inbox  (route)     │
│                                  │   - Needs Review            │
│                                  │   - Outcomes                │
│                                  │   - Data Quality            │
│                                  │   - Launch Readiness        │
│                                  │   - Settings    (route)     │
├──────────────────────────────────┴─────────────────────────────┤
│ BOTTOM ROW (2 cards side-by-side)                              │
│ ┌─ Data Quality Snapshot ─┐  ┌─ Revenue Integrity Snapshot ─┐ │
│ │ Sparse field count      │  │ Stale unresolved             │ │
│ │ Fallback labels         │  │ Interested-not-booked        │ │
│ │ Linkage mismatches      │  │ Booked / Closed / Dead       │ │
│ │ → Open Data Quality     │  │ Recent handoffs (24h)        │ │
│ └─────────────────────────┘  │ → Open Outcomes              │ │
│                              └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

Every section has explicit **loading**, **empty**, and **derived/source-of-truth** labels. Tone is operational (no "ROI", no "revenue projection").

### 2. New tab in `AdminPrimaryTabs`
Insert `{ kind: "panel", value: "mission-control", label: "Mission Control" }` as the **first panel tab** (right after the `Lead Inbox` route tab). The existing `command` Command Center tab stays — it's the detail surface; Mission Control is the compression layer above it.

### 3. Wire it into `AdminDashboard.tsx`
- Add the import.
- Add one `<TabsContent value="mission-control">` block: `<MasterCommandCenter leads={leads} deliveries={deliveries} ghosts={ghosts} needsReview={needsReview} onNavigateTab={setActiveTab} />`.
- Set `useState<string>("mission-control")` as default `activeTab` (replaces current `"launch"`) so operators land on the synthesis screen.

That's it. No edge functions. No new tables. No new hooks. No mutation of any of the protected truth surfaces.

## Readiness signal derivation (explicit)

Single function `deriveReadiness({contractors, opportunities, routes, deliveries, leads, ghosts})` returns one of:

- **`operational`** (green): all four core reads returned, dead_letter == 0, ghost_rate < 30%, ≥1 active contractor
- **`attention`** (amber): any of {dead_letter > 0, ghost_rate ≥ 30%, no active contractors, ≥1 sparse data-quality field, ≥5 stale_unresolved opportunities}
- **`unknown`** (gray): any read still loading / failed (preview/auth-expired)

Each signal contributing to the roll-up is listed inline so the operator sees *why* the badge is what it is. Pattern is borrowed from `LaunchReadinessSurface.SignalStatus` to stay consistent.

## Data-quality + revenue-integrity compression rules

These two cards are **summaries** of the existing surfaces, not duplicates of their full content:

- **Data Quality card** counts: # `sparse` field rows, # `partial` field rows, # records using fallback labels (e.g. `Unknown County`). Numbers come from the same classifier used in `DataQualityFieldIntegritySurface` — I will export the classifier helpers from that file so we don't duplicate logic.
- **Revenue Integrity card** counts: # `stale_unresolved`, # `interested_not_booked`, # `booked`, # `closed`, # `dead`, plus # contact-released in last 24h (handoff candidates). Reuses `OutcomeTrackingReport`'s `deriveBucket` — same export pattern.

Both cards have a **"→ Open …"** button that calls `onNavigateTab("data-quality")` / `onNavigateTab("outcomes")`.

## Files changed

1. **NEW** `src/components/admin/MasterCommandCenter.tsx` (~350–400 LOC, single component, pure synthesis)
2. **EDIT** `src/components/admin/DataQualityFieldIntegritySurface.tsx` — export `classify`, `nonEmpty` helpers (no behavior change)
3. **EDIT** `src/components/admin/OutcomeTrackingReport.tsx` — export `deriveBucket`, `pickLatestRoute`, `STALE_HOURS` (no behavior change)
4. **EDIT** `src/components/admin/shell/AdminPrimaryTabs.tsx` — add one tab entry
5. **EDIT** `src/components/AdminDashboard.tsx` — import, add `<TabsContent>`, change default `activeTab` to `"mission-control"`

No other files touched.

## Protected surfaces — explicitly NOT touched
- `scan-quote`, `send-otp`, `verify-otp`, Twilio Verify, capi-event
- Deterministic scoring / report compilation
- Preview-vs-full report gating
- Upload flow, `quotes` storage bucket
- Attribution truth (`leads.utm_*`, `gclid`, `fbc`, `fbp`)
- Billing, `contractor_credits`, `billable_intros`
- Partner shell (`PartnerLayout`, `PartnerPortalNav`) and partner routes
- RLS policies, edge functions, db functions, triggers

This phase is read-only synthesis on the admin side; partner portal is unaffected.

## Acceptance verification I will perform

- `npx tsc --noEmit` returns zero errors
- Admin tab strip still renders, all existing tabs still mount
- Mission Control loads with KPI strip, readiness banner, ops feed, snapshots, quick actions
- Quick actions navigate to existing tabs / routes
- Empty state renders cleanly when leads array is empty (preview mode)
- Loading skeletons render while `useQuery` is fetching
- No partner-portal regression (no shared imports changed)

## Build sequence inside the next loop
1. Add helper exports in DataQuality + Outcome surfaces
2. Write `MasterCommandCenter.tsx`
3. Wire tab + dashboard
4. Run `tsc --noEmit`, fix any types, report green

Approve and I'll execute as a single smallest-safe-diff implementation.