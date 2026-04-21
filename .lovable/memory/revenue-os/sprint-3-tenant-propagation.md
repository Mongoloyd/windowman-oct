---
name: Sprint 3 — Tenant Ownership Propagation
description: analyses.client_slug and contractor_opportunities.client_slug now auto-inherit from leads.client_slug via BEFORE INSERT/UPDATE triggers. Lead is the single source of truth. Three v_admin_* views monitor propagation health.
type: feature
---

# Sprint 3 — Tenant Ownership Propagation (2026-04-21)

## What changed

1. **Generic propagation function** `inherit_client_slug_from_lead()`:
   - SECURITY DEFINER, SET search_path = public
   - If `NEW.lead_id` is NULL → no-op
   - Looks up `leads.client_slug` for `NEW.lead_id`
   - If lead has no slug → no-op (do not invent ownership)
   - Else: **always** sets `NEW.client_slug` to the lead's slug — lead wins, even if the caller passed a different value

2. **Triggers**:
   - `trg_analyses_inherit_client_slug` — BEFORE INSERT OR UPDATE OF lead_id, client_slug ON `public.analyses`
   - `trg_opps_inherit_client_slug` — BEFORE INSERT OR UPDATE OF lead_id, client_slug ON `public.contractor_opportunities`

3. **Backfill** (idempotent, no data loss):
   - `UPDATE analyses SET client_slug = l.client_slug ... WHERE a.client_slug IS NULL AND l.client_slug IS NOT NULL` → 2 rows updated (the 2 `direct` sentinel leads from Sprint 1)
   - Same shape for `contractor_opportunities` → 0 rows (no opps have a parent lead with a slug yet)

4. **Three admin debug views** (security_invoker=true):
   - `v_admin_analyses_slug_mismatch` — should always be empty
   - `v_admin_opportunities_slug_mismatch` — should always be empty
   - `v_admin_slug_backfill_pending` — should always be 0/0

## Why DB triggers (not app code only)

Per spec: "Bias: Prefer DB triggers over application-only discipline." Writer paths (`scan-quote` for analyses, `generate-contractor-brief` for opportunities) already pass `lead_id` on insert. The trigger fires regardless of what the application sends, so even legacy code paths or future writers cannot mint fake tenant ownership. App code does NOT need to recompute ownership from scratch when `lead_id` is present.

## Live verification (post-migration)

```
analyses_backfilled=2, opps_backfilled=0
analyses_mismatch=0, opps_mismatch=0
pending_analyses=0, pending_contractor_opportunities=0
```

## No code changes required

- `supabase/functions/scan-quote/index.ts` — upserts analyses with `lead_id` already in the payload; trigger fills `client_slug` automatically
- `supabase/functions/generate-contractor-brief/index.ts` — inserts opportunities with `lead_id` from session; trigger fills `client_slug` automatically
- All other writers (`send-contractor-handoff`, `contractor-actions`, `voice-followup`, `request-callback`, `admin-data`) only UPDATE existing rows — trigger fires on any update touching `lead_id` or `client_slug` and re-asserts the lead's slug

## Linter warnings (pre-existing, unrelated)

- `0024_permissive_rls_policy` — pre-existing service_role policies; not introduced by this migration
- `Leaked Password Protection Disabled` — Supabase Auth setting; unrelated to schema

## Audit queries

```sql
-- Should always be 0
SELECT COUNT(*) FROM public.v_admin_analyses_slug_mismatch;
SELECT COUNT(*) FROM public.v_admin_opportunities_slug_mismatch;

-- Should always be 0/0
SELECT * FROM public.v_admin_slug_backfill_pending;
```
