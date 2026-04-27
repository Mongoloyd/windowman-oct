# Phase 3D Lead Assignment Routing

## 1. Goal
Complete Phase 3D by pairing the backend routing RPC and Edge Function with an internal admin workflow for lead assignment inspection and operator actions.

## 2. North Star
Give WindowMan internal operators a safe, auditable routing console for operational lead ownership without dispatching externally, mutating revenue truth, or exposing contractor self-service routing controls.

## 3. What Was Completed In 3D Backend
- `public.admin_route_lead_assignment(...)` was added as the authoritative mutation path.
- `supabase/functions/admin-route-lead/index.ts` wraps the RPC with request validation and internal role checks.
- Supported actions are `route_lead`, `reassign_lead`, `recycle_lead`, `manual_review`, and `operator_note`.
- The RPC records immutable `lead_routing_events` for assignment mutations.
- The backend metadata asserts `external_dispatch: false` and `revenue_truth_mutated: false`.

## 4. What 3D-B Completed
- Added `src/services/leadAssignments.ts` with local interfaces because generated Supabase types are stale.
- Added `src/components/admin/LeadAssignmentBoard.tsx` as the operator UI.
- Added the Admin `Lead Assignments` tab and `/admin/lead-assignments` route alias.
- Added assignment list, filters, KPI strip, detail drawer, routing event timeline, and action dialogs.
- Wired all mutation actions through the existing `admin-route-lead` Edge Function.

## 5. Service Wrapper Contract
Read functions:
- `fetchLeadAssignments(filters?)`
- `fetchLeadAssignmentDetail(assignmentId)`
- `fetchLeadRoutingEvents(filters?)`

Mutation functions:
- `routeLead(input)`
- `reassignLead(input)`
- `recycleLead(input)`
- `markAssignmentManualReview(input)`
- `addOperatorNote(input)`

Mutations require a non-blank `reason_code` and send metadata with:
- `ui_source: "lead_assignment_board"`
- `external_dispatch: false`
- `revenue_truth_mutated: false`

## 6. Admin UI Sections
The Lead Assignments board includes:
- Safety banner
- KPI strip
- Filters for client slug, status, current-only, manual-review-only, and UUID search
- Assignment table with masked IDs
- Detail drawer
- Routing event timeline
- Operator action dialogs
- Empty, loading, backend unavailable, and permission-safe error states

## 7. Assignment Actions
The UI supports:
- Route lead
- Reassign lead
- Recycle assignment
- Mark manual review
- Add operator note

All actions call `admin-route-lead`. The frontend does not directly write to `lead_assignments` or `lead_routing_events`.

## 8. Routing Event Timeline
The drawer renders chronological `lead_routing_events` with:
- event time and type
- from/to client slug
- masked contractor account IDs
- masked operator ID
- reason code
- safe note preview
- metadata flags proving no external dispatch and no revenue mutation when asserted

## 9. Safety Boundaries
`lead_assignments` is operational ownership only. It is not sold outcome truth, conversion truth, or billing truth.

Contractors cannot route, reassign, recycle, or manually review leads from this UI. 3D-B is internal admin only.

No scanner, OTP, report reveal, platform mapper, provider sender, retry worker, scheduler, CRM webhook, Meta, Google, TikTok, or GTM paths were changed.

## 10. Revenue Truth Boundary
`contractor_outcomes` remains the revenue source of truth. 3D-B does not mutate `contractor_outcomes`, does not move revenue truth into `lead_assignments`, and does not use `leads` as revenue truth.

## 11. No External Dispatch Proof
The UI copy states no external dispatch occurs from the screen. The service wrapper sends `external_dispatch: false`, and the Edge Function also stamps `external_dispatch: false` into the RPC metadata payload.

## 12. Generated Types Status
`src/integrations/supabase/types.ts` is stale: it does not include `syndicates`, `syndicate_clients`, `contractor_accounts`, `lead_assignments`, or `lead_routing_events`.

For this sprint, `src/services/leadAssignments.ts` uses local interfaces and a locally widened Supabase client for the new tables. Context Debt: regenerate Supabase types after the 3C/3D migrations are applied to the connected project.

Recommended typegen step:

```bash
supabase gen types typescript --project-id wkrcyxcnzhwjtdpmfpaf --schema public > src/integrations/supabase/types.ts
```

Only run that in an environment authorized for generated type updates.

## 13. Validation Results
Validation was run during the sprint with:
- `git diff --name-only`
- `bun run build`
- `npx tsc --noEmit`

See the sprint final response for exact command results.

## 14. Context Debt For 3E
- Regenerate Supabase types once database migrations are reflected in the project schema.
- 3E should link contractor outcome feedback back to assignment context without making `lead_assignments` revenue truth.
- 3E should preserve internal-only routing mutations and contractor-facing read boundaries.
- Consider a backend read RPC for assignment board summaries if table volume grows beyond the current admin read-query pattern.
