Plan: Make Lead Evidence Inspector discoverable from Command Center

Exact file scope
- Change exactly one file:
  - `src/components/admin/MasterCommandCenter.tsx`

No other files will be changed.

Current repo placement found
- `src/components/AdminDashboard.tsx` renders the main admin Command Center via `<MasterCommandCenter />` for:
  - `/admin` default mission-control tab
  - `/admin/command-center`
  - `/admin/command`
- `src/components/admin/MasterCommandCenter.tsx` already contains a `Quick-Action HUD` card.
- That HUD has:
  - primary in-dashboard tab actions
  - secondary route links currently including `Lead Inbox` and `Settings`

Exact UI placement
- Add the Lead Evidence Inspector as a secondary route link in the existing `Quick-Action HUD` card in `src/components/admin/MasterCommandCenter.tsx`.
- Specifically, add a new item to the existing `secondaryActions` array near the existing `Lead Inbox` and `Settings` links.
- Label:
  - `Lead Evidence Inspector`
- Subtitle/description:
  - `Inspect quote files, scan sessions, and analysis chain for a selected lead.`
- Destination:
  - `/admin/lead-evidence`
- CTA behavior:
  - The existing secondary action UI is a clickable card/link row with an arrow. The visible label/subtitle will act as the requested compact card/button. If space allows, the description will use the exact subtitle text; if the current compact row truncates visually, the full text will still be present in the action data and link title for discoverability.

Implementation approach
1. Update imports only if needed
- `MasterCommandCenter.tsx` already imports `Link`, `ArrowRight`, and suitable icons from `lucide-react`.
- It already imports `ScanSearch`, which fits the evidence inspector action, so no new import is expected.

2. Add one route action
- Extend:
  - `const secondaryActions: Array<{ to: string; label: string; desc: string; icon: typeof Activity }>`
- Add:
  - `{ to: "/admin/lead-evidence", label: "Lead Evidence Inspector", desc: "Inspect quote files, scan sessions, and analysis chain for a selected lead.", icon: ScanSearch }`
- Prefer placing it immediately after `Lead Inbox` because it is lead/evidence related.

3. Keep routing/security unchanged
- Do not modify `src/routes/AdminRoutes.tsx`.
- Do not modify `src/routes/adminDashboardTabs.ts`.
- Do not add a new route, dashboard tab, root alias, or public route.
- The link points to the already-existing `/admin/lead-evidence` route, which remains protected by `AdminAuthGate` in `AdminRoutes.tsx`.
- This change does not query data and does not touch backend code.

Verification plan
- Confirm `/admin` and `/admin/command-center` show the Quick-Action HUD with a visible `Lead Evidence Inspector` link.
- Confirm clicking the link navigates to `/admin/lead-evidence`.
- Confirm `/admin/lead-evidence` remains protected by the existing `AdminAuthGate` route.
- Confirm no route files changed.
- Confirm no backend files changed.
- Confirm no public routes changed.

Why this does not affect routing/security
- It adds only a client-side navigation link to an already-defined protected admin route.
- Authorization stays centralized in the existing `AdminRoutes.tsx` wrapper for `/admin/lead-evidence`.
- No data fetching, backend action, Supabase config, RLS, storage, scanner, OTP, report reveal, tracking, package, Vite, homepage, partner, or public route code is touched.

Stop conditions
- Stop if the Quick-Action HUD is not the correct Command Center action area.
- Stop if any required implementation appears to need route changes.
- Stop if any required implementation appears to need backend/data changes.
- Stop if any file outside `src/components/admin/MasterCommandCenter.tsx` appears necessary.

Approval prompt
```text
Approved. Add the Lead Evidence Inspector link to the main admin Command Center exactly as planned.

Allowed file only:
- src/components/admin/MasterCommandCenter.tsx

Add it to the existing Quick-Action HUD secondary route links, pointing to /admin/lead-evidence, with label "Lead Evidence Inspector" and subtitle "Inspect quote files, scan sessions, and analysis chain for a selected lead."

Do not modify routes, dashboard tabs, App.tsx, AdminLeadEvidence.tsx, services, backend files, Supabase config, migrations, RLS, scanner/scan-quote, OTP/Twilio, report reveal/full_json gating, tracking/CAPI/analytics, package files, Vite files, homepage, partner routes/pages, or public routes.
```