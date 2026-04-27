# Phase 3C — Syndicate Schema + RLS Foundation

## Goal

Phase 3C turns the Phase 3B Syndicate plan into an additive, RLS-protected database foundation. The migration creates durable records for syndicates, client membership, contractor accounts, lead assignment ownership, and routing event history without changing scanner, OTP, report reveal, or live-dispatch behavior.

## North Star

WindowMan can prove which syndicates exist, which clients belong to them, which contractor accounts operate under each client, which assignment currently owns a lead identity, and which immutable events explain routing changes without cross-tenant leakage.

## Migration

- `supabase/migrations/20260427142000_syndicate_schema_rls.sql`

## Tables Created

| Table | Purpose |
| --- | --- |
| `public.syndicates` | Internal WindowMan market/routing groups. |
| `public.syndicate_clients` | Maps existing `client_slug` tenants into syndicates with role, priority, territory, and active state. |
| `public.contractor_accounts` | Operational contractor/company/branch/sales-recipient accounts under a `client_slug`. |
| `public.lead_assignments` | Current and historical ownership/routing records for lead, scan session, or analysis identities. |
| `public.lead_routing_events` | Immutable audit events for assignment creation, reassignment, recycling, disputes, operator notes, and lifecycle changes. |

## Constraints and Indexes

- Assignment status is constrained to the approved 3C state list.
- Routing event type is constrained to the approved 3C event list.
- `lead_assignments` requires at least one of `lead_id`, `scan_session_id`, or `analysis_id`.
- `lead_routing_events` requires at least one of `assignment_id`, `lead_id`, `scan_session_id`, or `analysis_id`.
- Partial unique indexes enforce at most one current assignment per lead, scan session, or analysis identity when that identity is present.
- Foreign keys bind `client_slug` to `clients.slug` and assignment/event identities to their existing canonical tables.
- `updated_at` triggers use the existing `public.update_updated_at()` helper for mutable tables.
- `lead_routing_events` has reject triggers for update and delete to preserve audit immutability.

## RLS Model

All new tables have RLS enabled.

- `service_role`: full access through explicit policies and grants.
- `authenticated` internal operators: read/write operational access through `public.is_internal_operator()` policies.
- `anon`: no grants and no policies.
- `PUBLIC`: revoked on all new tables.

`lead_routing_events` is insert/read for internal operators but not update/delete, preserving audit history.

## Contractor Access Posture

Contractor access is narrow and direct:

- Contractors may read only their own `contractor_accounts` rows where `contractor_accounts.auth_user_id = auth.uid()`.
- Contractors may read only `lead_assignments` rows whose `contractor_account_id` points to their own account.
- Contractors cannot insert, update, or delete assignment rows.
- Contractors cannot read or mutate `syndicates`, `syndicate_clients`, or `lead_routing_events`.
- No contractor policy exposes platform tokens, Vault secret IDs, client platform configs, or competing contractor data.

Broader contractor-safe views for homeowner lead details are deferred until 3D/3G because that requires a redacted field contract and portal-specific read model.

## Source-of-Truth Boundaries

- `leads` remains homeowner identity and rollup context, not assignment truth.
- `lead_assignments` is ownership/routing truth, not conversion outcome truth.
- `lead_routing_events` explains why assignment state changed.
- `contractor_outcomes` remains the authoritative sold/lost revenue source.
- `client_platform_configs` remains client-owned platform configuration; no token or Vault data is copied into Syndicate tables.
- No live ad-platform dispatch is introduced.

## Known Deferrals

- 3D routing service/RPCs to create assignments transactionally.
- Redacted contractor-facing lead detail views.
- Capacity rules, recycling rules, dispute workflows, and reassignment automation.
- Outcome-to-assignment reconciliation and health surfaces.
- Generated Supabase types refresh after migration application.

## Type Generation Note

`src/integrations/supabase/types.ts` was not edited manually. After applying the migration, regenerate types with the project’s standard Supabase type-generation flow so the client reflects the new tables.

## Rollback Notes

This migration is additive. Before production assignment rows exist, rollback can drop the five new tables, the immutable-event trigger function, and related policies/indexes. After assignment rows exist, prefer marking syndicates or memberships inactive and preserving audit history instead of destructive rollback.

## Manual SQL Validation

If a local Supabase reset/check is unavailable, validate the applied database with:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('syndicates','syndicate_clients','contractor_accounts','lead_assignments','lead_routing_events');

select policyname, tablename, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('syndicates','syndicate_clients','contractor_accounts','lead_assignments','lead_routing_events')
order by tablename, policyname;
```
