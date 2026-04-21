---
name: Sprint 1 — Tenant Ownership Lockdown
description: leads.client_slug is now DB-enforced against public.clients. 'direct' is the canonical organic sentinel (is_active=false). fire_crm_handoff is idempotent against double-fire races. Four admin debug views (v_admin_*) provide ops visibility.
type: feature
---

# Sprint 1 — Tenant Ownership Lockdown (2026-04-21)

## What changed

1. **Direct sentinel seeded** in `public.clients`:
   - `slug='direct'`, `name='Direct / Organic'`, `is_active=false`
   - Marked inactive on purpose so the `clients_anon_select_active` policy cannot resolve it as a real tenant.

2. **Cleanup**: 2 leads carrying the unknown slug `'testAA'` were remapped to `'direct'`.

3. **Slug integrity guardrail**: trigger `trg_enforce_lead_client_slug_integrity` (BEFORE INSERT OR UPDATE OF client_slug) calls `enforce_lead_client_slug_integrity()`:
   - `NULL` → allowed (legacy / pre-attribution)
   - `'direct'` → allowed unconditionally (sentinel)
   - any other value → must exist in `public.clients` (active OR inactive); rejected with `foreign_key_violation` ERRCODE if not

4. **fire_crm_handoff hardened** against double-fire races:
   - INSERT into `webhook_deliveries` now uses `ON CONFLICT ON CONSTRAINT idx_webhook_deliveries_lead_event_unique DO NOTHING`
   - `lead_events.crm_handoff_queued` is only emitted when a NEW delivery row was actually queued (uses `RETURNING id` to detect)
   - Eliminates the risk of a unique_violation aborting the parent lead update.

5. **Four admin debug views** (all `security_invoker=true`):
   - `v_admin_leads_unknown_slug` — should always be empty post-Sprint-1
   - `v_admin_active_clients` — tenant roster with lead/verified counts
   - `v_admin_webhook_health_7d` — delivery health by status × event_type
   - `v_admin_leads_direct_sentinel` — daily direct/organic counts (last 30 days)

## Audit findings (no work needed)

- `clients.slug` was already UNIQUE via `clients_slug_key` — FK hardening is safe whenever desired.
- `webhook_deliveries` repo interface in `src/components/admin/types.ts` matched live shape exactly. No drift.
- `idx_webhook_deliveries_lead_event_unique` partial unique index was already live from Phase 2.
- `friendly_name` and `contact_email` "wrong assumption" warnings did not apply: `contact_email` is a real live column on `contractor_profiles` (separate from `contractors`).

## Path to FK hardening (deferred)

Path documented in `enforce_lead_client_slug_integrity` migration comment:

```sql
ALTER TABLE public.leads
  ADD CONSTRAINT leads_client_slug_fkey
  FOREIGN KEY (client_slug) REFERENCES public.clients(slug)
  ON UPDATE CASCADE ON DELETE SET NULL
  NOT VALID;
ALTER TABLE public.leads VALIDATE CONSTRAINT leads_client_slug_fkey;
```

Deferred because the trigger gives identical enforcement with the flexibility to migrate to `clients.id`-based ownership in a future sprint without dropping a FK first.

## Live verification (post-migration)

```
sentinel_seeded=1, sentinel_active=false
leftover_testAA=0, leads_now_direct=2
integrity_trigger_live=1
unknown_slug_rows=0
```
