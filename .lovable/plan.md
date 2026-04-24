## Master Polish — Operator Command Center

A surgical upgrade of the existing `MasterCommandCenter` (Mission Control) surface. No schema changes, no new edge functions. Every metric stays bound to repo-real columns on `leads`, `contractor_opportunities`, `contractor_opportunity_routes`, and `webhook_deliveries`.

**Architectural Acknowledgement & CoT Protocol**

- **Environment:** WindowMan MVP (Production Admin Shell).
- **Hard Limitations:** No schema changes, no new edge functions, no modifications to `auth` middleware or Twilio/OTP logic.
- **Blast Radius:** Low. This is a UI/UX synthesis task localized to the `/admin` surface.
- **Chain of Thought (CoT):** Before writing code, map the current `CRMLead` type and ensure the addition of `deal_value` and `revenue_amount` doesn't conflict with any existing local state management.

### Scope

- Reuses: `MasterCommandCenter.tsx`, `AdminDashboard.tsx`, `AdminPrimaryTabs.tsx`, `MarketOpsFeed`, `DeliveryInspectorPage`, existing TanStack queries (`opps`, `routes`, `contractors`).
- Out of scope: contractor portal, new edge functions, new tables, scanner/OTP/Twilio/scoring flows.

---

## What changes

### 1. Deep-link route `/admin/command-center`

- Add a route in `src/App.tsx`:
  - `/admin/command-center` → renders `<AdminDashboard initialTab="mission-control" />`.
- `AdminDashboard.tsx`: accept optional `initialTab` prop; if `useLocation().pathname === "/admin/command-center"`, force `activeTab = "mission-control"` on mount.
- `AdminPrimaryTabs.tsx`: keep "Mission Control" as a panel tab (current behaviour) but also treat `/admin/command-center` as an active-state match for it.
- Keeps existing `/admin` entry point unchanged; `/admin/command-center` is the canonical shareable link.

### 2. Daily Revenue Target strip

- New section directly under the readiness banner, above the funnel KPI tiles.
- Sources of truth (already on `leads` per schema):
  - "Today's Closed Volume" = `SUM(deal_value)` for leads where `closed_at >= start_of_today_local` AND `deal_status` ∈ {`won`, `closed_won`, `sold`}. Falls back to `revenue_amount` when `deal_value` is null.
  - "Today's Closed Count" = same filter, count of leads.
- Daily goal: persisted to `localStorage` key `wm_admin_daily_revenue_goal` (default `25000`). Inline editable via small pencil-icon button → prompt; no DB write.
- UI: wide card containing
  - Left: "$X,XXX of $YY,YYY closed today" + small "Edit goal" affordance.
  - Right: shadcn `<Progress>` bar with high-contrast fill. Color tier: <50% muted, 50–99% amber, ≥100% emerald.
  - Footer microcopy: count of closes today + delta vs goal.
- Requires extending `CRMLead` type and `toLeadCRM` mapper to include `deal_value: number | null` and `revenue_amount: number | null`. Both columns already exist on `leads`.

### 3. Webhook Dead-Letter = CRITICAL tier

- Introduce a third readiness status: `"critical"` alongside `operational | attention | unknown`.
- Tone tokens: red/rose palette (`bg-rose-500/10`, `text-rose-700`, `XCircle` icon).
- Computation in `signals` memo:
  - `webhook.dead > 0` → `critical` (was `attention`).
  - `webhook.failed > 0` and `dead === 0` → `attention`.
  - Else `operational`.
- Aggregate readiness rollup: any `critical` → overall `critical` (overrides `attention`).
- Add a small webhook legend chip row inside the readiness banner: Pending / Delivered / Failed / Dead-Letter (Critical) — counts pulled from the existing `webhook` memo.

### 4. Expandable readiness signals with "the why"

- Replace the current static signal chips with shadcn `<Popover>` (or simple click-to-expand inline panel) per signal.
- Each non-green signal exposes:
  - Threshold rule that fired (e.g. "Dead-letter > 0", "Stale unresolved ≥ 5", "Ghost rate ≥ 50%").
  - Numeric detail (already in `s.detail`).
  - "Open source" deep link → routes/tabs:
    - `webhooks` → `delivery-inspector` panel tab
    - `stale` → `outcomes` tab
    - `ghosts` → `ghosts` tab
    - `data-quality` → `data-quality` tab
    - `contractors` → `contractors` tab
    - `opps` / `routes` → `routing` tab
- Operational signals stay collapsed by default but remain clickable to jump to source.

### 5. Quick-Action HUD reshuffle

Slim the existing 8-item list to the 4 the brief calls out, in order:

1. Routing → `routing` tab
2. Data Quality → `data-quality` tab
3. Revenue Integrity → `outcomes` tab
4. Readiness / SOPs → `readiness` tab

Keep "Lead Inbox" (route) and "Settings" (route) as a secondary row underneath.

### 6. One-Click Operator Snapshot (CSV export)

- New "Export Snapshot" button in the readiness banner header (right side).
- Pure client-side: builds a CSV in-memory and triggers download via Blob — no edge function, no PDF dep.
- Filename: `wm-operator-snapshot-YYYY-MM-DD-HHmm.csv`.
- Sections (one per row group with a separator row):
  - Funnel: Captured / Verified / Scanned / Routed / Booked / Closed (counts + % of prior stage).
  - Daily Revenue: goal, today's closed volume, today's closed count, % of goal.
  - Readiness rollup: each signal label, status, detail.
  - Webhook health: pending / delivered / failed / dead-letter.
  - Outcome rollup: booked / closed / stale / unresolved / recent handoffs (24h).
  - Data quality: strong / partial / sparse / missing-county / orphaned-opps.
- PDF deferred — CSV satisfies the "Operator Snapshot" requirement and stays scope-safe.

### 7. Density / aesthetic polish

- Tighten readiness banner chip grid to fit on one row at `lg`.
- Card surface: keep current border-l accent, add subtle `backdrop-blur-sm bg-card/95` on the readiness banner only (glassmorphic touch, no theme overhaul).
- Native system stack already used via tailwind defaults — no font change.

---

## Files touched

- `src/App.tsx` — register `/admin/command-center` route.
- `src/components/AdminDashboard.tsx` — accept `initialTab` prop, derive from pathname; thread `deal_value` / `revenue_amount` into `toLeadCRM`.
- `src/components/admin/types.ts` — extend `CRMLead` with `deal_value` and `revenue_amount`.
- `src/components/admin/MasterCommandCenter.tsx` — add Revenue Target strip, critical tier, expandable signals + deep links, snapshot exporter, slimmed quick actions, webhook legend.
- `src/components/admin/shell/AdminPrimaryTabs.tsx` — match `/admin/command-center` as active for Mission Control tab.
- New helper: `src/components/admin/missionControl/exportSnapshot.ts` — pure CSV builder + downloader (no deps).

> **STRICT NON-INTERFERENCE GUARDRAILS:**
>
> 1. **Scanner/OCR Integrity:** Do not touch any components or hooks related to `ScannerCore`, `OCRUpload`, or `AnalysisEngine`.
> 2. **Twilio/OTP Security:** Do not modify any files in `src/integrations/supabase/edge-functions` or the Twilio verification UI.
> 3. **Revenue Logic:** This is a READ-ONLY polish for the dashboard. Do not implement any logic that writes `deal_value` to the database; use `localStorage` strictly for the "Daily Goal."
> 4. **Verification:** Run `npx tsc --noEmit` after implementation to ensure the extended `CRMLead` type is correctly propagated without breaking existing components.

## Verification

- `npx tsc --noEmit` returns zero.
- `/admin/command-center` lands directly on Mission Control; `/admin` still defaults to Mission Control.
- Inserting a single `webhook_deliveries` row with `status='dead_letter'` flips overall readiness to **CRITICAL** (red).
- Closing a lead with `deal_value=10000` and `closed_at=now()` increments today's closed volume in the progress bar without a refresh cycle (next 120s poll).
- Existing tabs (Routing, Pipeline, Ghost, Needs Review, Contractors, Outcomes, Data Quality, Delivery Inspector, Session Diag, Settings) all still mount and render unchanged.
- Scanner / OTP / Twilio / scoring code paths are not modified.