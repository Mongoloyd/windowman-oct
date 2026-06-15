-- ============================================================================
-- Nextdoor CAPI Dispatch Lane — Enum expansion (Step 2)
-- ----------------------------------------------------------------------------
-- Adds two enum values required before Nextdoor platform dispatch and
-- lead_captured canonical event persistence can be wired in later steps.
--
-- Forward-only:
--   PostgreSQL does not support safely removing enum values in a normal
--   down migration. Once committed, rollback requires creating a new enum
--   type, migrating dependent columns, and dropping the old type. This
--   migration is intentionally forward-only with no destructive DOWN.
--
-- Same-transaction safety:
--   Freshly added enum values must not be referenced in the same migration
--   transaction (tables, constraints, functions, inserts, or data rows).
--   PostgreSQL may reject new enum values used elsewhere in the same
--   transaction. This file adds values only — no downstream references.
--
-- Human apply required:
--   Do not auto-apply. A human operator must review and apply this migration
--   manually to the target Supabase project.
--
-- Type regeneration:
--   After manual DB application, src/integrations/supabase/types.ts may need
--   regeneration (npm run typegen) as a separate approved step.
-- ============================================================================

-- nextdoor: first-class dispatch destination for paid Nextdoor CAPI traffic.
-- Enables client_platform_configs rows and dispatch outbox routing keyed to
-- platform_name = 'nextdoor' once mapper/sender work lands in later steps.
ALTER TYPE public.wm_platform_name ADD VALUE IF NOT EXISTS 'nextdoor';

-- lead_captured: canonical business milestone for Truth Gate lead capture.
-- Aligns wm_event_name with the neutral event ladder (lead_identified /
-- lead_qualified collapse to lead_captured) used by dispatch resolution.
ALTER TYPE public.wm_event_name ADD VALUE IF NOT EXISTS 'lead_captured';
