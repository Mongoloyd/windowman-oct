-- DB-HARDEN-1B
-- Isolate service-only tables from browser roles.
-- These tables should be accessed only through trusted backend/RPC/service-role paths.
-- This migration intentionally does not alter Edge Functions, OTP logic, frontend code,
-- storage policies, or funnel-critical tables.
--
-- Existing policies (from 20260416154937) already grant service_role FOR ALL;
-- enabling RLS activates default-deny for anon/authenticated with no allow policies.

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_analyses ENABLE ROW LEVEL SECURITY;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE
  ON public.phone_verifications, public.quote_analyses
  FROM anon, authenticated;
