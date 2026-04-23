

## Verification result

### What works
- **TypeScript**: `tsc --noEmit -p tsconfig.app.json` exits clean — zero type errors across the new files (`AdminLeadInbox.tsx`, `AdminLeadDossierPage.tsx`, `LeadStatusPanel.tsx`, `LeadNotesPanel.tsx`, `LeadTasksPanel.tsx`, `LeadTimelinePanel.tsx`, `leadWorkflow.ts`, updated `adminDataService.ts`, regenerated `supabase/types.ts`).
- **Vite dev server**: started in 637 ms, no HMR errors, no module-resolution failures in `/tmp/dev-server-logs/dev-server.log`.
- **Edge function**: `admin-data` extensions compile alongside the rest of the project.

### What's broken in preview
- **`/admin/leads` and `/admin/leads/:id` are not routed.** `src/App.tsx` has no `lazy()` import for `AdminLeadInbox` or `AdminLeadDossierPage` and no `<Route>` entries inside the `<AdminAuthGate>` block. Hitting either URL in preview today renders the `NotFound` catch-all — so the pages never mount and we can't actually confirm they render at runtime.
- Because nothing currently links to them either, an operator has no way to reach the new workspace from the existing admin shell.

### Plan to make verification pass

1. **Wire the routes in `src/App.tsx`**
   - Add two `lazy()` imports next to the existing admin imports:
     ```ts
     const AdminLeadInbox = lazy(() => import("./pages/AdminLeadInbox.tsx"));
     const AdminLeadDossierPage = lazy(() => import("./pages/AdminLeadDossierPage.tsx"));
     ```
   - Add two gated routes alongside `/admin`, `/admin/settings`, `/admin/partners`:
     ```tsx
     <Route path="/admin/leads" element={<AdminAuthGate><AdminLeadInbox /></AdminAuthGate>} />
     <Route path="/admin/leads/:id" element={<AdminAuthGate><AdminLeadDossierPage /></AdminAuthGate>} />
     ```

2. **Add a navigation entry point** so operators can actually reach `/admin/leads`:
   - Add a "Lead Inbox" tab to `AdminPrimaryTabs` (or the admin shell's nav source) pointing at `/admin/leads`. Keep the existing 13 surfaces; this is a 14th curated tab.
   - In `AdminLeadInbox`, ensure each row's "View" action navigates to `/admin/leads/${lead.id}` (already implemented via `useNavigate`, just confirm).

3. **Runtime smoke verification** (after the routes land)
   - Restart-check the dev-server log for compile errors (`grep -nE 'error|warn|failed' /tmp/dev-server-logs/dev-server.log | tail`).
   - Re-run `npx tsc --noEmit -p tsconfig.app.json` — must stay clean.
   - Run the existing Vitest suite (`AdminAuthGate.test.tsx`, `adminDataService.test.ts`) to confirm no regression in the gate or data-service contracts.
   - Hit `/admin/health` to confirm the health page still reports the admin route set as deployed (and extend the required-route list to include `/admin/leads` and `/admin/leads/:id` so future deploys catch missing wiring automatically).

4. **Sanity-check the data path** without going to production
   - Confirm `invokeAdminData('fetch_leads', …)` and `fetchLeadDetail` resolve against the deployed `admin-data` edge function (the migration and function deploy already happened in the previous loop).
   - If `fetch_lead_detail` returns 4xx/5xx in preview, capture the edge-function log and fix the action handler before declaring the dossier page "renders correctly."

### Out of scope for this verification pass
- The seven Supabase security findings shown in the security view (conversion_events RLS, realtime row filters, quotes-bucket update policy, `resolve_route_for_*` grants, `function_search_path_mutable`). These are pre-existing and unrelated to the lead-workspace work; they should be tracked as their own hardening sprint.

### Files to change
- `src/App.tsx` — 2 `lazy()` imports + 2 `<Route>` entries.
- `src/components/admin/AdminPrimaryTabs.tsx` (or equivalent nav source) — 1 new tab entry pointing at `/admin/leads`.
- `src/pages/AdminHealth.tsx` — extend the required-route list with the two new paths.

No new files, no DB changes, no edge-function changes.

