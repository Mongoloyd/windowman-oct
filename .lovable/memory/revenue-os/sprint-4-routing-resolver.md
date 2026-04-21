---
name: Sprint 4 — Deterministic Routing Resolver
description: resolve_route_for_lead and resolve_route_for_slug return the single chosen contractor receiver (primary → priority ASC → created_at ASC) or a typed no_route_reason. Read-only mapping; no delivery side effects. Three admin views surface routing health and legacy coexistence.
type: feature
---

# Sprint 4 — Deterministic Routing Resolver (2026-04-21)

## What changed

1. **`resolve_route_for_lead(uuid)`** — STABLE SECURITY DEFINER. Always returns exactly ONE row: either `resolved=true` with destination, or `resolved=false` with a typed `no_route_reason`. Order of preference inside the function:
   - `is_primary DESC` — primary first
   - `priority ASC` — **lowest priority number wins** (Sprint 4 contract)
   - `created_at ASC` — deterministic tie-break

2. **`resolve_route_for_slug(text)`** — operator-facing preview variant. Same resolution logic, starts from a slug instead of a lead_id.

3. **Destination validation inside the resolver:**
   - `dispatch_method='webhook'` requires `crm_webhook_url IS NOT NULL`
   - `dispatch_method='email'` requires `crm_email IS NOT NULL`
   - `manual` and `none` require no destination
   - Otherwise → `no_route_reason='assignment_missing_destination'` (no half-routes)

4. **Typed `no_route_reason` taxonomy:**
   - `lead_not_found`
   - `lead_has_no_slug`
   - `slug_not_in_clients`
   - `client_inactive`
   - `no_active_assignment`
   - `assignment_missing_destination`

5. **Three new admin views (security_invoker=true):**
   - `v_admin_routing_resolution` — for every client, the deterministically chosen route or unresolved reason
   - `v_admin_leads_unrouted` — verified leads (`phone_verified=true`) with no active route, each carrying `no_route_reason`
   - `v_admin_legacy_vs_new_routing` — for every existing `webhook_deliveries` row, shows what the new resolver would have chosen and a `coexistence_state` of `BOTH_PATHS_ACTIVE` | `LEGACY_ONLY` | `UNKNOWN`

6. **TypeScript service layer:**
   - `src/types/routing.ts` — `ResolvedRoute`, `NoRouteReason`, view row types
   - `src/services/routing.ts` — `resolveRouteForLead`, `resolveRouteForSlug`, three view fetchers

## Coexistence strategy with legacy `fire_crm_handoff`

**Sprint 4 is mapping only — no delivery, no double-fire risk.** The legacy DB trigger continues queueing into `webhook_deliveries` exactly as before. The new resolver is read-only; nothing in this sprint sends.

**Sprint 5 hard guard plan** (encoded in the audit view): for any future delivery worker, the contract is "if `v_admin_legacy_vs_new_routing.coexistence_state='BOTH_PATHS_ACTIVE'` for a `(lead_id, event_type)` pair, the new path wins and the legacy `webhook_deliveries.status` must be marked `superseded` before any send."

Current snapshot at migration time: 65 legacy delivery rows exist, 0 are `BOTH_PATHS_ACTIVE` (because there are still 0 active assignments). The audit view will start surfacing `BOTH_PATHS_ACTIVE` only after operators wire the first contractor↔client assignment.

## Sprint 2 helper still works

`resolve_contractors_for_client_slug(text)` (Sprint 2, multi-row, `priority DESC`) is **not** dropped. The new single-row Sprint 4 functions use `priority ASC` per spec. Both coexist; pick the one matching your call site's contract.

## Live verification (post-migration, no UI/data changes)

```
routing_resolution_rows = 2     (1 active + 1 inactive client)
routing_resolved_count  = 0     (no contractor assignments wired yet — by design from Sprint 2)
routing_unresolved_count= 2
leads_unrouted_count    = 127   (pre-existing operational gap, not a regression)
legacy_vs_new_rows      = 65
legacy_BOTH_PATHS_ACTIVE= 0     (no double-fire risk today)

resolve_route_for_slug('test')          → no_active_assignment   ✅
resolve_route_for_slug('direct')        → client_inactive        ✅
resolve_route_for_slug('nonexistent_xyz')→ slug_not_in_clients   ✅
```

## Hard requirements respected

- ✅ No UI redesign
- ✅ No fake global singleton webhook logic
- ✅ No delivery side effects this sprint
- ✅ Deterministic ordering enforced inside SQL function
- ✅ Resolver fails cleanly with a typed `no_route_reason` (never NULL ambiguity)

## Linter notes

Two warnings post-migration are **pre-existing**, not regressions:
- `0024_permissive_rls_policy` (the `*_service_role_all` pattern shared across every table)
- `Leaked Password Protection Disabled` (Supabase Auth project setting, unrelated)
