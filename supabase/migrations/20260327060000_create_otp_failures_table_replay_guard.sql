-- ============================================================================

-- Replay-guard predecessor for public.otp_failures

-- ----------------------------------------------------------------------------

-- Existing migration 20260327062226_... enables RLS and creates policies on

-- public.otp_failures before the table exists during clean-DB replay.

-- This migration creates the missing prerequisite table and sorts immediately

-- before that RLS migration.

--

-- Scope:

--   - Migration-only

--   - Idempotent

--   - No product-code changes

--   - No edge-function changes

--   - No RLS/policy duplication

-- ============================================================================

CREATE TABLE IF NOT EXISTS public.otp_failures (

  phone_e164 text PRIMARY KEY,

  failure_count integer NOT NULL DEFAULT 0,

  first_failure_at timestamptz NOT NULL DEFAULT now(),

  last_failure_at timestamptz NOT NULL DEFAULT now(),

  ip_address text,

  last_user_agent_hash text,

  locked_until timestamptz,

  scan_session_id uuid,

  updated_at timestamptz NOT NULL DEFAULT now()

);

-- Defensive catch-up for databases where the table already exists but is

-- missing one or more expected columns. These statements must not drop,

-- rename, or destructively alter production columns.

ALTER TABLE public.otp_failures

  ADD COLUMN IF NOT EXISTS phone_e164 text,

  ADD COLUMN IF NOT EXISTS failure_count integer DEFAULT 0,

  ADD COLUMN IF NOT EXISTS first_failure_at timestamptz DEFAULT now(),

  ADD COLUMN IF NOT EXISTS last_failure_at timestamptz DEFAULT now(),

  ADD COLUMN IF NOT EXISTS ip_address text,

  ADD COLUMN IF NOT EXISTS last_user_agent_hash text,

  ADD COLUMN IF NOT EXISTS locked_until timestamptz,

  ADD COLUMN IF NOT EXISTS scan_session_id uuid,

  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_otp_failures_locked_until

  ON public.otp_failures (locked_until)

  WHERE locked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_failures_ip_address

  ON public.otp_failures (ip_address)

  WHERE ip_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_failures_scan_session_id

  ON public.otp_failures (scan_session_id)

  WHERE scan_session_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_otp_failures_updated_at ON public.otp_failures;

CREATE TRIGGER trg_otp_failures_updated_at

  BEFORE UPDATE ON public.otp_failures

  FOR EACH ROW

  EXECUTE FUNCTION public.update_updated_at();
