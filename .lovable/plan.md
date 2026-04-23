

## Phase 20: Routing Integration & Navigation Wiring

### Audit findings

- **Routes (already in place)** — `src/App.tsx` lines 29-30 lazy-import `AdminLeadInbox` / `AdminLeadDossierPage`; lines 138-139 register `/admin/leads` and `/admin/leads/:id` inside `<AdminAuthGate>`. ✅ No further work needed here.
- **Navigation source** — the primary admin nav is `src/components/admin/shell/AdminPrimaryTabs.tsx`. It's a Radix `<TabsList>` with **13 panel tabs** (`launch`, `command`, `pipeline`, `routing`, `ghosts`, `needs-review`, `engine`, `contractors`, `onboarding`, `outcomes`, `attribution`, `delivery-inspector`, `session-diag`) — all in-page panels, not router links.
- **Component paths confirmed** — `src/pages/AdminLeadInbox.tsx` (default export `LeadInbox`) and `src/pages/AdminLeadDossierPage.tsx` (default export `AdminLeadDossierPage`).
- **Connectivity gaps** — `AdminLeadInbox` already calls `navigate('/admin/leads/${id}')` on row click and renders a `View` link, but the link's `aria-label` says `"View lead {name}"`; Phase 20 spec wants `"View details for {Lead Name}"`.

### Changes

#### 1. `src/components/admin/shell/AdminPrimaryTabs.tsx` — rewrite to support mixed panel + route tabs

The existing 13 entries are Radix `<TabsTrigger>`s tied to in-page panels in `AdminDashboard`. "Lead Inbox" lives at a sibling route (`/admin/leads`), so it can't be a `<TabsTrigger>` (Radix would try to match it against an in-page panel value and never highlight on `/admin/leads/:id`).

Approach: introduce a tagged-union `TabDef` (`{ kind: 'panel' }` vs `{ kind: 'route' }`) and render route entries as react-router `<Link>`s styled with the **exact same className string** as the panel triggers, including `data-state="active"` driven by `useLocation()`. Active match uses a `matchPrefixes: string[]` so `/admin/leads/abc-123` keeps the tab highlighted (the "operator maintains context" requirement).

Tab order: **Lead Inbox first** (it's the operator's new front door), then the 13 existing panel tabs unchanged. Total = 14. The list already wraps with `flex flex-wrap` + `min-w-[110px]`, so a 14th entry doesn't cramp text — it just wraps to a second row on narrow screens. No fixed `grid-cols-N` to overflow.

Active-state CSS reuses the existing tokens (`data-[state=active]:bg-card`, `data-[state=active]:text-foreground`, `data-[state=active]:shadow-sm`) so the route-tab is visually indistinguishable from an active panel-tab. Adds `aria-current="page"` for screen-reader correctness.

#### 2. `src/pages/AdminLeadInbox.tsx` — fix the `View` link's aria-label

One-line change at line 365: `aria-label={`View lead ${name}`}` → `aria-label={`View details for ${name}`}`. Row click + link click already navigate to `/admin/leads/${l.id}` via `useNavigate` and `<Link to>` respectively; `e.stopPropagation()` on the link prevents double-fire.

#### 3. `src/components/AdminDashboard.tsx` — remove the now-redundant header "Lead Inbox" link

Added in the previous loop as a header chip next to "Settings". Phase 20 puts the canonical entry in the primary tab strip, so the duplicate header link should go to keep one source of truth. Settings link stays.

### Out of scope (per Phase 20 constraints)

- No DB / Edge Function / Supabase schema changes.
- No OTP / scanner / homeowner funnel touches.
- No new routes beyond the two already registered.
- No restyle of the existing 13 panel tabs.

### Verification after implementation

1. `npx tsc --noEmit -p tsconfig.app.json` — must stay at 0 errors.
2. Re-run `AdminAuthGate.test.tsx` (26 tests) and `adminDataService.test.ts` (34 tests) — must stay green; the gate already covers `/admin/leads` and `/admin/leads/:id` because `AdminAuthGate` is route-agnostic.
3. Dev-server log (`/tmp/dev-server-logs/dev-server.log`) — no HMR errors after the swap.
4. Manual matrix (described, not browser-tested per the project's browser-restraint rule):
   - Logged out → `/admin/leads` redirects to `/admin/login` (inherits from existing gate).
   - On `/admin` → "Lead Inbox" tab is **inactive** (`data-state="inactive"`).
   - On `/admin/leads` → "Lead Inbox" is **active**, no panel tab is active.
   - On `/admin/leads/abc-123` → "Lead Inbox" stays **active** (prefix match).
   - "View" link in inbox row → navigates to `/admin/leads/${id}` and tab stays highlighted.

### Files changed

- `src/components/admin/shell/AdminPrimaryTabs.tsx` (rewrite)
- `src/pages/AdminLeadInbox.tsx` (1-line aria-label fix)
- `src/components/AdminDashboard.tsx` (remove duplicate header chip; keep Settings)

No new files. No deletions.

