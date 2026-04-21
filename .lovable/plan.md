

# Phase 6 — Single-Client Delivery Spine

## Audit findings (canonical routing path)

Two backend writers touch `contractor_opportunities`. They are **complementary, not duplicate**:

| Action | Writes opportunity row | Writes route row | Sends email |
|---|---|---|---|
| `send-contractor-handoff` (edge fn) | ✅ upsert, status=`sent_to_contractor`, sets `lead.latest_opportunity_id` | ❌ | ✅ Resend |
| `route_opportunity` (admin-data) | ✅ update status=`sent_to_contractor`, `routed_at` | ✅ inserts `contractor_opportunity_routes` | ❌ |

**Decision:** Treat the **opportunity row** as the canonical handoff fact. The opportunity is created/upserted by `send-contractor-handoff`; `route_opportunity` then attaches the formal route + audit trail. Both belong inside one operator action.

**Unification rule:** Introduce a single helper `routeLeadToContractor(leadId, contractorId)` in `adminDataService.ts` that:
1. Calls `sendContractorHandoff(leadId)` → guarantees the opportunity exists and the email is dispatched, returns `opportunity_id`.
2. Calls `invokeAdminData("route_opportunity", { opportunity_id, contractor_id, scan_session_id })` → records the route row + sets `routed_at`.

Both `RoutingDesk` and `LeadDossierSheet` call this helper only. The legacy "Send to Contractor" button in `LeadDossierSheet` is rewired to call this same helper (passing the canonical contractor) — no parallel path.

---

## What we'll build

### 1. `src/services/adminDataService.ts` — additive only
Add typed wrappers (no new actions, no new endpoints):
- `fetchOpportunities()`, `fetchRoutes(opportunityId?)`, `fetchContractors()`
- `routeOpportunity({ opportunity_id, contractor_id, scan_session_id })`
- `markOpportunityDead({ opportunity_id, scan_session_id })`
- `routeLeadToContractor(leadId, contractorId)` — **the canonical unified mutation** (handoff → route)

### 2. New `RoutingDesk.tsx` tab
TanStack Query–driven operator surface. Three **operator-derived UI groupings** (clearly labeled as derived, not backend statuses):

- **Ready to Route** — `contractor_opportunities.status IN ('intro_requested')` AND no route row yet
- **Routed** — `routed_at != null`, sub-grouped by latest `contractor_opportunity_routes.route_status` (sent / viewed / interested / declined)
- **Stale (derived)** — routed >7d ago with no `responded_at` AND no `last_call_completed_at` on parent lead. Label includes "(operator view)" so it's never mistaken for a backend status.
- **Reactivation Candidates (derived)** — `report_unlocked_at` >14d ago AND `routed_to_contractor_at IS NULL`. Same "(operator view)" label.

Per-row controls (all repo-real):
- "Route to [Contractor ▾]" → `routeLeadToContractor` (single-contractor dropdown from `fetch_contractors`)
- "Mark Dead" → `markOpportunityDead`
- "Trigger Voice Follow-up" → existing `trigger_voice_followup`
- "Open Dossier" → opens existing `LeadDossierSheet`

### 3. New `OpportunityRouteTimeline.tsx`
Operator-safe handoff context block, embedded in dossier + RoutingDesk row-expand. Reads `contractor_opportunities` + latest `contractor_opportunity_routes` + `contractors`. Renders:
- Assigned Contractor / Partner (`contractors.company_name`)
- Handoff Status (mapped: Ready / Sent / Viewed / Interested / Declined / Released / Closed)
- Routed At
- Activity timeline (sent_at → viewed_at → responded_at → interested_at → contact_released_at)
- Contractor Brief Summary — renders `contractor_opportunities.brief_text` only (operator-safe; no `brief_json` raw, no prompts, no rubric weights)
- One-line "Strongest closing angle" from `brief_json.closing_angles[0]` if present (string only)

### 4. New `OneContractorSummaryStrip.tsx` — operational only
Five tiles on the Command Center. **No revenue, no close rate, no contractor score, no fake analytics.** Counts only:
- Leads Routed (`routed_at != null`)
- Contacted (route w/ `viewed_at` OR `responded_at`)
- Booked (`leads.appointment_booked_at != null`)
- Stale (operator derivation, same rule as RoutingDesk)
- Reactivation Candidates (operator derivation, same rule as RoutingDesk)

### 5. `LeadDossierSheet.tsx` — additive
- Insert **"Contractor Delivery"** section between "Project Specs" and "Truth Engine Audit". Renders `<OpportunityRouteTimeline opportunityId={lead.latest_opportunity_id} />`.
- Insert **"Follow-up Status"** strip below "Call History" — reads `last_call_*`, `appointment_booked_at`, `replacement_quote_submitted_at`, `deal_status` from the `CRMLead` already in memory.
- **Rewire** the existing "Send to Contractor" button: replace its current `sendContractorHandoff` call with `routeLeadToContractor(lead.id, canonicalContractorId)` so dossier and RoutingDesk share one path. The canonical contractor is the single active `contractors` row (Phase 6 = one paying contractor); if multiple exist, dossier opens the same Contractor select as RoutingDesk.

### 6. `AdminDashboard.tsx` — minimal
- Add `<TabsTrigger value="routing">Routing</TabsTrigger>` between Pipeline and Ghosts.
- Mount `<RoutingDesk />` in new `<TabsContent value="routing">`.
- Mount `<OneContractorSummaryStrip />` at the top of the existing `command` tab (above `<CommandCenter />`).
- Tab grid changes from `grid-cols-7` → `grid-cols-8`.

---

## Constraints honored

- ✅ **One canonical routing path** via `routeLeadToContractor` helper. No parallel writes.
- ✅ **Stale & Reactivation are operator-derived UI groupings only** — never written back to the DB, labeled "(operator view)".
- ✅ **Summary strip is operational only** — counts of repo-real timestamps; no revenue/score/analytics.
- ✅ Stays inside `AdminDashboard.tsx` tab architecture; uses existing `invokeAdminData` pattern with bearer token.
- ✅ No new edge functions, no migrations, no schema changes.
- ✅ No OTP / Twilio / scanner / tracking / public funnel / multi-client changes.
- ✅ No "cartel" language anywhere — Contractor / Partner / Network only.
- ✅ TanStack Query for server state; shadcn/ui + lucide-react + Tailwind only.

## Files changed

```
NEW   src/types/routingDesk.ts
NEW   src/components/admin/RoutingDesk.tsx
NEW   src/components/admin/OpportunityRouteTimeline.tsx
NEW   src/components/admin/OneContractorSummaryStrip.tsx
EDIT  src/services/adminDataService.ts          (typed wrappers + routeLeadToContractor unified helper)
EDIT  src/components/AdminDashboard.tsx         (Routing tab + summary strip mount; grid-cols-8)
EDIT  src/components/admin/LeadDossierSheet.tsx (Contractor Delivery block, Follow-up strip, rewire Send button to unified helper)
```

## Out of scope

Multi-client routing, round-robin, network release automation, contractor self-serve portal, billing UI, master pixel controls, fake CRM sync, schema/state-machine changes, homeowner-side polish, live delivery test button, admin-data new actions.

