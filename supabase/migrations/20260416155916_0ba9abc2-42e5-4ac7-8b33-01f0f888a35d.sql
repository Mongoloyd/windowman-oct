-- Ensure OTP / Verify-to-Reveal guard columns exist before constraining anon lead inserts.
-- These columns are required by leads_anon_insert_constrained and must exist on clean staging.
-- Add nullable first, backfill safely, then enforce defaults / NOT NULL for deterministic policy behavior.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS phone_verified boolean,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS otp_state text,
  ADD COLUMN IF NOT EXISTS otp_failure_count integer,
  ADD COLUMN IF NOT EXISTS otp_locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS report_unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_otp_verified_at timestamptz;

-- Preserve existing verification semantics where phone_verified_at already exists.
UPDATE public.leads
SET
  phone_verified = COALESCE(phone_verified, phone_verified_at IS NOT NULL, false),
  otp_failure_count = COALESCE(otp_failure_count, 0)
WHERE phone_verified IS NULL
   OR otp_failure_count IS NULL;

ALTER TABLE public.leads
  ALTER COLUMN phone_verified SET DEFAULT false,
  ALTER COLUMN phone_verified SET NOT NULL,
  ALTER COLUMN otp_failure_count SET DEFAULT 0,
  ALTER COLUMN otp_failure_count SET NOT NULL;

-- Ensure admin role audit table exists.
-- admin-data writes to this table during manage_user_roles and reads it during get_role_audit_log.
CREATE TABLE IF NOT EXISTS public.user_role_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  changed_by_user_id uuid NOT NULL,
  old_role text,
  new_role text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_role_audit_log
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS target_user_id uuid,
  ADD COLUMN IF NOT EXISTS changed_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS old_role text,
  ADD COLUMN IF NOT EXISTS new_role text,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.user_role_audit_log
SET created_at = COALESCE(created_at, now())
WHERE created_at IS NULL;

ALTER TABLE public.user_role_audit_log
  ALTER COLUMN target_user_id SET NOT NULL,
  ALTER COLUMN changed_by_user_id SET NOT NULL,
  ALTER COLUMN new_role SET NOT NULL,
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.user_role_audit_log ENABLE ROW LEVEL SECURITY;

-- Make replay safe if a previous partial/non-transactional run already created the constrained leads policy.
DROP POLICY IF EXISTS "leads_anon_insert_constrained" ON public.leads;

-- Constrain anon INSERT on leads to prevent OTP gate bypass
DROP POLICY IF EXISTS "Allow anonymous insert on leads" ON public.leads;

CREATE POLICY "leads_anon_insert_constrained"
  ON public.leads
  FOR INSERT
  TO anon
  WITH CHECK (
    phone_verified = false
    AND phone_verified_at IS NULL
    AND otp_state IS NULL
    AND otp_failure_count = 0
    AND otp_locked_until IS NULL
    AND report_unlocked_at IS NULL
    AND last_otp_verified_at IS NULL
  );

-- Fix PERMISSIVE deny policies → RESTRICTIVE
-- Guarded: conversion_events may be absent on minimal/forked replays.
DO $$
BEGIN
  IF to_regclass('public.conversion_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS "deny_anon_insert_conversion_events" ON public.conversion_events;
    CREATE POLICY "deny_anon_insert_conversion_events"
      ON public.conversion_events
      AS RESTRICTIVE
      FOR INSERT
      TO anon
      WITH CHECK (false);

    DROP POLICY IF EXISTS "deny_anon_select_conversion_events" ON public.conversion_events;
    CREATE POLICY "deny_anon_select_conversion_events"
      ON public.conversion_events
      AS RESTRICTIVE
      FOR SELECT
      TO anon
      USING (false);
  END IF;
END $$;

DROP POLICY IF EXISTS "deny_public_insert_audit" ON public.user_role_audit_log;
CREATE POLICY "deny_public_insert_audit"
  ON public.user_role_audit_log
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK (false);
