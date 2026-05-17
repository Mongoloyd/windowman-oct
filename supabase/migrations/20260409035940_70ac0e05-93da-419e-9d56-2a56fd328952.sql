-- Preview contractor seed intentionally disabled.
--
-- This migration previously inserted a hardcoded contractor profile:
--   id: f184e9db-dcc4-4a54-a818-7a8e95db8697
--   company_name: Your Partner LLC
--   contact_email: preview@windowman.pro
--
-- That row depends on a matching Supabase Auth user in auth.users.
-- Clean staging/branch environments do not contain that Auth user, causing
-- contractor_profiles_id_fkey violations during migration replay.
--
-- Contractor/admin seed identities must be created through explicit environment
-- setup or a dedicated seed process, not required schema migrations.

DO $$
BEGIN
  RAISE NOTICE 'Skipping hardcoded preview contractor seed; create contractor users through environment setup instead.';
END $$;
