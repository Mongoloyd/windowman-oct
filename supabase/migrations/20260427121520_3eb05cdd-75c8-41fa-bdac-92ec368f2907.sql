DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'wm_platform_name' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.wm_platform_name AS ENUM ('meta','google_ads','ga4','internal');
  END IF;
END $$;

ALTER TYPE public.wm_platform_name ADD VALUE IF NOT EXISTS 'tiktok';

CREATE TABLE IF NOT EXISTS public.client_platform_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform_name public.wm_platform_name NOT NULL,
  pixel_id text NULL,
  conversion_id text NULL,
  conversion_label text NULL,
  dataset_id text NULL,
  endpoint_url text NULL,
  token_secret_id uuid NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_platform_configs_pkey PRIMARY KEY (id),
  CONSTRAINT client_platform_configs_client_platform_key UNIQUE (client_id, platform_name),
  CONSTRAINT client_platform_configs_endpoint_https CHECK (endpoint_url IS NULL OR endpoint_url ~ '^https://')
);

ALTER TABLE public.client_platform_configs
  ADD COLUMN IF NOT EXISTS config_state text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'not_tested',
  ADD COLUMN IF NOT EXISTS validated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS validation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_validation_error text NULL,
  ADD COLUMN IF NOT EXISTS token_last_rotated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS token_fingerprint_prefix text NULL,
  ADD COLUMN IF NOT EXISTS last_operator_id uuid NULL,
  ADD COLUMN IF NOT EXISTS last_operator_action_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_platform_configs_config_state_check'
      AND conrelid = 'public.client_platform_configs'::regclass
  ) THEN
    ALTER TABLE public.client_platform_configs
      ADD CONSTRAINT client_platform_configs_config_state_check
      CHECK (config_state IN ('draft','incomplete','pending_validation','validated','active','paused','retired','invalid'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_platform_configs_validation_status_check'
      AND conrelid = 'public.client_platform_configs'::regclass
  ) THEN
    ALTER TABLE public.client_platform_configs
      ADD CONSTRAINT client_platform_configs_validation_status_check
      CHECK (validation_status IN ('not_tested','validation_passed','validation_failed','validation_stale','requires_revalidation'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_platform_configs_client_id
  ON public.client_platform_configs (client_id);

CREATE INDEX IF NOT EXISTS idx_client_platform_configs_active
  ON public.client_platform_configs (platform_name, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_client_platform_configs_token_secret_id
  ON public.client_platform_configs (token_secret_id)
  WHERE token_secret_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_platform_configs_state
  ON public.client_platform_configs (config_state, validation_status);

CREATE INDEX IF NOT EXISTS idx_client_platform_configs_operator_action
  ON public.client_platform_configs (last_operator_action_at DESC)
  WHERE last_operator_action_at IS NOT NULL;

DROP TRIGGER IF EXISTS trg_client_platform_configs_updated_at ON public.client_platform_configs;
CREATE TRIGGER trg_client_platform_configs_updated_at
  BEFORE UPDATE ON public.client_platform_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.client_platform_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_platform_configs_service_role_all ON public.client_platform_configs;
CREATE POLICY client_platform_configs_service_role_all
  ON public.client_platform_configs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS client_platform_configs_select_internal ON public.client_platform_configs;
CREATE POLICY client_platform_configs_select_internal
  ON public.client_platform_configs
  FOR SELECT
  TO authenticated
  USING (public.is_internal_operator());

DROP POLICY IF EXISTS client_platform_configs_insert_internal ON public.client_platform_configs;
CREATE POLICY client_platform_configs_insert_internal
  ON public.client_platform_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_operator() AND token_secret_id IS NULL);

DROP POLICY IF EXISTS client_platform_configs_update_internal ON public.client_platform_configs;
CREATE POLICY client_platform_configs_update_internal
  ON public.client_platform_configs
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_operator())
  WITH CHECK (public.is_internal_operator());

CREATE OR REPLACE FUNCTION public.client_platform_configs_block_token_writes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.token_secret_id IS DISTINCT FROM OLD.token_secret_id
     AND current_user <> 'service_role'
     AND current_user <> 'supabase_admin' THEN
    RAISE EXCEPTION
      'token_secret_id is service_role-only; use public.vault_upsert_client_platform_token() and have an edge function persist the returned secret id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_platform_configs_block_token_writes ON public.client_platform_configs;
CREATE TRIGGER trg_client_platform_configs_block_token_writes
  BEFORE UPDATE OF token_secret_id ON public.client_platform_configs
  FOR EACH ROW EXECUTE FUNCTION public.client_platform_configs_block_token_writes();

DROP POLICY IF EXISTS client_platform_configs_delete_internal ON public.client_platform_configs;
CREATE POLICY client_platform_configs_delete_internal
  ON public.client_platform_configs
  FOR DELETE
  TO authenticated
  USING (public.is_internal_operator());

COMMENT ON COLUMN public.client_platform_configs.config_state IS
  'Operator lifecycle state for platform config readiness: draft, incomplete, pending_validation, validated, active, paused, retired, invalid.';

COMMENT ON COLUMN public.client_platform_configs.validation_status IS
  'Local non-external validation status for dispatch-readiness simulation.';

COMMENT ON COLUMN public.client_platform_configs.validation_summary IS
  'Non-secret JSON summary of local validation checks. Must never contain raw platform tokens.';

COMMENT ON COLUMN public.client_platform_configs.token_fingerprint_prefix IS
  'Non-sensitive hash prefix used only to identify token rotation state without exposing the token.';