-- DB-HARDEN-1A
-- Remove destructive privileges from browser roles.
-- This is intentionally narrow: it does not alter SELECT, INSERT, UPDATE, RLS policies,
-- Edge Functions, storage policies, or service-role behavior.

REVOKE DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE DELETE, TRUNCATE ON TABLES FROM anon, authenticated;
