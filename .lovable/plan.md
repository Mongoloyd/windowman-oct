

# Phase 7 Fix + Finish Wiring

## Audit summary

**Build break (1 missing import):**
- `src/components/admin/OpportunityRouteTimeline.tsx` line 151 references `<OwnershipBlock>` but never imports it. The file lives at `src/components/admin/OwnershipBlock.tsx` and exports both `OwnershipBlock` and `deriveOwnershipBadges`.

**Phase 7 wiring status:**
- ✅ `OwnershipBlock` + `LeadLifecycleTimeline` components created (operator-safe, repo-real only)
- ✅ Types extended (`OwnershipBadge`, lifecycle timestamps on `CRMLead`)
- ✅ `OpportunityRouteTimeline` already attempts to render `<OwnershipBlock>` — just missing the import
- ❌ `LeadLifecycleTimeline` is created but never mounted anywhere
- ❌ `RoutingDesk` row headers don't show ownership badges (only the expanded section gets the timeline)
- ❌ `ActivePipeline` has no ownership-aware filters
- ❌ `LeadDossierSheet` has no lifecycle timeline block

## Changes (smallest safe diff)

### 1. Fix the build break
**`src/components/admin/OpportunityRouteTimeline.tsx`**
- Add `import { OwnershipBlock } from "./OwnershipBlock";`
- Pass `reportUnlockedAt` and `routedToContractorAt` from the parent lead (already loaded via `opps` query — find the lead match through the existing `leads` array or skip if not in scope; safer to leave those props optional as they already are).

### 2. Mount `LeadLifecycleTimeline` in the dossier
**`src/components/admin/LeadDossierSheet.tsx`**
- Import `LeadLifecycleTimeline`.
- Replace the existing terse "Activity Timeline" block (lines 757–765) with `<LeadLifecycleTimeline lead={lead} />`. Keep the `<SectionTitle>Activity Timeline</SectionTitle>` header. The new component renders the full repo-real lifecycle (created → verified → unlocked → routed → viewed → responded → interested → released → booked → closed) and filters out empty milestones.

### 3. Ownership badges on `RoutingDesk` row headers
**`src/components/admin/RoutingDesk.tsx`**
- Import `deriveOwnershipBadges` from `./OwnershipBlock`.
- For each row, compute badges from that opportunity's full route history (filter `routesQuery.data` by `opportunity_id`, plus the lead's `report_unlocked_at` / `routed_to_contractor_at`).
- Render the resulting badges as a small inline strip in the row header (next to the existing route_status badge). This makes the ledger visible at-a-glance without expanding.

### 4. Ownership-aware filters on `ActivePipeline`
**`src/components/admin/ActivePipeline.tsx`**
- Add a second `Select` (Ownership filter) with options backed by repo-real `CRMLead` fields only:
  - `all` (default)
  - `assigned` — `routed_to_contractor_at != null`
  - `unassigned` — `routed_to_contractor_at == null`
  - `booked` — `appointment_booked_at != null`
  - `closed` — `closed_at != null`
  - `recovery_candidate` — `report_unlocked_at` >14d ago AND no `routed_to_contractor_at` (operator view, label includes "(operator view)")
- Add a small "Owner" column to the table showing `assigned_partner` already exists — rename the column header from "Partner" to "Owner" for clarity, no logic change.
- All filters apply via the existing `filteredLeads` `useMemo`.

## Constraints honored
- ✅ No new backend endpoints, no schema changes, no migrations
- ✅ No OTP / Twilio / scanner / tracking / public funnel changes
- ✅ All ownership signals derived from repo-real `contractor_opportunity_routes` rows + repo-real `leads` lifecycle timestamps
- ✅ "Recovery Candidate" / "Reassignable" remain operator-derived UI labels, not backend statuses
- ✅ Centralized `invokeAdminData` / TanStack Query pattern preserved
- ✅ No "cartel" language; uses Ownership / Owner / Recovery Candidate
- ✅ No Phase 8 work, no token/style polish

## Files changed
```
EDIT  src/components/admin/OpportunityRouteTimeline.tsx   (add OwnershipBlock import — fixes build)
EDIT  src/components/admin/LeadDossierSheet.tsx           (mount LeadLifecycleTimeline)
EDIT  src/components/admin/RoutingDesk.tsx                (ownership badges in row headers)
EDIT  src/components/admin/ActivePipeline.tsx             (ownership filter dropdown + column rename)
```

## Verification
After edits: `npx tsc --noEmit` should exit clean. The previously failing `OpportunityRouteTimeline.tsx(151,8): error TS2304` resolves with the import on line 1 fix.

