---
name: Sprint 2 — Contractor ↔ Client Bridge
description: public.contractor_client_assignments is the canonical bridge mapping paying tenants (clients) to operating contractors. Resolver function resolve_contractors_for_client_slug and four v_admin_* views provide ops visibility. Empty by design — no speculative backfill.
type: feature
---

# Sprint 2 — Contractor ↔ Client Bridge (2026-04-21)

## What changed

1. **Bridge table `public.contractor_client_assignments`** with all required columns:
   `id, created_at, updated_at, client_id (FK clients.id ON DELETE CASCADE), contractor_id (FK contractors.id ON DELETE CASCADE), status, is_primary, receives_leads, priority, dispatch_method, crm_webhook_url, crm_email, notes` plus `unique(client_id, contractor_id)`.
   - `status` constrained to `active | paused | archived`
   - `dispatch_method` constrained to `webhook | email | manual | none`
   - Partial unique index `idx_cca_one_primary_per_client` enforces one primary per client.

2. **Indexes**: client_id, contractor_id, status, receives_leads, is_primary, priority, plus composite `idx_cca_dispatch_lookup (client_id, status, receives_leads, priority DESC)` for the canonical resolver path.

3. **`updated_at` trigger** (`trg_cca_set_updated_at`) reuses existing `public.set_updated_at()`.

4. **RLS**: internal operators full CRUD via `is_internal_operator()`. Service role bypass policy. Contractors can `SELECT` their own assignment rows (`auth.uid() = contractors.auth_user_id`) for the partner portal.

5. **Canonical resolver** `public.resolve_contractors_for_client_slug(text)` — `STABLE SECURITY DEFINER`. Returns ordered receivers: `is_primary DESC, priority DESC, created_at ASC`. Filters by `assignment.status='active' AND receives_leads=true AND contractor.status='active'`. SECURITY DEFINER lets it resolve the inactive `direct` sentinel cleanly.

6. **Four admin views** (all `security_invoker=true`):
   - `v_admin_assignments_by_client` — every client + roster jsonb
   - `v_admin_assignments_by_contractor` — every contractor + roster jsonb
   - `v_admin_unassigned_active_clients` — paying tenants with no active receiver (excludes `direct` sentinel)
   - `v_admin_active_contractors_unassigned` — active contractors not yet assigned

7. **Repo additions** (no existing files mutated):
   - `src/types/contractorClientAssignments.ts` — TypeScript shapes for the table, resolver output, and view rows.
   - `src/services/contractorClientAssignments.ts` — CRUD, resolver wrapper, and view fetchers.

## Audit (read-only) findings

- `clients`: 2 rows total → 1 active (`Test Client` / slug `test`) + 1 inactive (`Direct / Organic` / slug `direct`).
- `contractors`: 2 active + vetted (`Alpha Impact Windows & Doors`, `Your Partner LLC`).
- **Backfill: NONE.** No unambiguous 1:1 (one paying client, two contractors). Per spec, did not invent assignments. Operator must assign explicitly.

## What is intentionally deferred

- **Dispatcher rewiring** (making `fire_crm_handoff` / webhook delivery actually consume `resolve_contractors_for_client_slug`) — Sprint 3.
- **Downstream propagation** of `client_slug` to `analyses` / `contractor_opportunities` — Sprint 3.
- **Admin UI** for assignment management — deliberately not built per "No UI redesign" hard requirement.
- **Adding `client_slug` directly on `contractors`** — explicitly forbidden by spec; the bridge IS the relationship.

## Acceptance queries (operator-runnable)

```sql
-- a) active assignments by client
SELECT * FROM public.v_admin_assignments_by_client;

-- b) active assignments by contractor
SELECT * FROM public.v_admin_assignments_by_contractor;

-- c) unassigned active clients (operational gap)
SELECT * FROM public.v_admin_unassigned_active_clients;

-- d) active contractors with no assignments
SELECT * FROM public.v_admin_active_contractors_unassigned;

-- canonical resolver smoke test
SELECT * FROM public.resolve_contractors_for_client_slug('test');
SELECT * FROM public.resolve_contractors_for_client_slug('direct');
```

## Linter notes

Two warnings surfaced post-migration; neither is a Sprint 2 regression:
- `cca_service_role_all` "always-true" — identical pattern to every other `*_service_role_all` policy in the project (analyses, clients, lead_events, etc.). Intentional consistency; service_role bypasses RLS regardless.
- "Leaked Password Protection Disabled" — Supabase Auth project setting, unrelated.
