-- ============================================================================
-- Neutral Event Control Plane — Physical Storage (Task 2 / Sprint 4)
-- ----------------------------------------------------------------------------
-- Pairs with the TypeScript neutral facade introduced in PR #113
-- (`src/lib/tracking/neutralEventModel.ts`). PR #113 shipped the SOFTWARE
-- contract; this migration adds the corresponding PHYSICAL STORAGE so future
-- dispatchers can (1) extend platform support to TikTok, (2) carry a tenant
-- (`client_slug`) on every event-bearing row, and (3) capture the raw query
-- params + structured attribution snapshot at the source.
--
-- Idempotency:
--   - Every column add uses `IF NOT EXISTS` (additive only).
--   - The enum value addition uses `ALTER TYPE … ADD VALUE IF NOT EXISTS`
--     and is intentionally NOT referenced anywhere else in this migration —
--     PostgreSQL forbids using a freshly-added enum value in the same
--     transaction in some versions, and we want this migration to remain
--     replayable as a single transaction on a clean DB.
--   - Policies use `DROP POLICY IF EXISTS` then `CREATE POLICY`.
--   - The Vault helper uses `CREATE OR REPLACE FUNCTION`.
--
-- Reversibility:
--   - All column additions are nullable. Down-migration would `ALTER TABLE …
--     DROP COLUMN IF EXISTS …` and `DROP TABLE IF EXISTS
--     public.client_platform_configs CASCADE` (intentionally NOT included
--     here — Supabase migrations are forward-only).
--   - The 'tiktok' enum value cannot be removed in PostgreSQL; choose this
--     name carefully. `tiktok` matches the existing
--     `WMPlatformName`/`NeutralEventSource` lower-snake-case convention.
--
-- Out of scope (deliberately deferred):
--   - Backfilling `client_slug` on `wm_event_log`, `scan_sessions` from
--     existing `leads.client_slug` (a separate data migration).
--   - Replacing the legacy `public.client_configs` (1:1 with clients) with
--     the new per-platform `public.client_platform_configs` (1:many) — both
--     coexist until a data-migration sprint consolidates them.
--   - Adding a TikTok mapper in `src/lib/tracking/canonical/`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enum extension: add `tiktok` destination to wm_platform_name
-- ----------------------------------------------------------------------------
-- NOTE: Do NOT reference 'tiktok' anywhere else in this migration — PostgreSQL
-- treats `ADD VALUE` as visible only in subsequent transactions on some
-- versions. Future migrations / dispatchers may use it freely.
ALTER TYPE public.wm_platform_name ADD VALUE IF NOT EXISTS 'tiktok';

-- ----------------------------------------------------------------------------
-- 2. Column augmentation — leads
-- ----------------------------------------------------------------------------
-- `leads.client_slug` already exists (added in 20260416123026); the
-- IF NOT EXISTS guard makes this a safe no-op for that column.
-- `query_params` captures the raw URL query string at first-touch as JSONB so
-- we can audit unanticipated marketing parameters without a schema change.
-- `attribution` carries the structured neutral-plane attribution snapshot
-- (utm + click ids + sourcePlatform/sourceChannel) — keys mirror
-- `NeutralEvent.attribution` and `NeutralEvent.utm` from
-- `src/lib/tracking/neutralEventModel.ts`.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS client_slug  text,
  ADD COLUMN IF NOT EXISTS query_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attribution  jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.leads.query_params IS
  'Raw URL query parameters captured at first-touch. JSONB so future UTM/click params do not require a schema change. Populated by useUtmCapture / capture-truth-gate-lead.';
COMMENT ON COLUMN public.leads.attribution IS
  'Structured attribution snapshot mirroring NeutralEvent.attribution + NeutralEvent.utm. Read-source-of-truth for downstream dispatch resolution.';

-- ----------------------------------------------------------------------------
-- 3. Column augmentation — scan_sessions
-- ----------------------------------------------------------------------------
ALTER TABLE public.scan_sessions
  ADD COLUMN IF NOT EXISTS client_slug  text,
  ADD COLUMN IF NOT EXISTS query_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attribution  jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.scan_sessions.client_slug IS
  'Tenant slug propagated from leads.client_slug. Nullable. No FK (deferred until clients-row-exists writer guarantee, matching analyses.client_slug).';

CREATE INDEX IF NOT EXISTS idx_scan_sessions_client_slug
  ON public.scan_sessions (client_slug)
  WHERE client_slug IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. Column augmentation — wm_event_log
-- ----------------------------------------------------------------------------
-- Lifts the canonical event ledger to carry tenant ownership directly,
-- removing the need to join through leads/scan_sessions for every dispatch
-- decision. This is the §6 deferred work explicitly called out in
-- `docs/tracking/NEUTRAL_EVENT_CONTROL_PLANE.md`.
ALTER TABLE public.wm_event_log
  ADD COLUMN IF NOT EXISTS client_slug  text,
  ADD COLUMN IF NOT EXISTS query_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attribution  jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.wm_event_log.client_slug IS
  'Tenant slug for dispatch routing. Resolved by the canonical event creation service from lead_id / scan_session_id at write time. Nullable for pre-attribution / unknown traffic.';

CREATE INDEX IF NOT EXISTS idx_wm_event_log_client_slug
  ON public.wm_event_log (client_slug, event_timestamp DESC)
  WHERE client_slug IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. New table — public.client_platform_configs (per-platform destinations)
-- ----------------------------------------------------------------------------
-- The existing `public.client_configs` is a 1:1 grab-bag of Meta + Google +
-- GTM-Server fields. As the platform list grows (TikTok now, future
-- platforms later), a wide grab-bag pattern stops scaling. This new table
-- is a 1:many normalization keyed on (client_id, platform_name) so each
-- destination has its own row + secret reference.
--
-- Note: `client_configs` is NOT dropped; it remains the legacy single-row
-- store while a future data-migration sprint consolidates it.
CREATE TABLE IF NOT EXISTS public.client_platform_configs (
  id                       uuid                    NOT NULL DEFAULT gen_random_uuid(),
  client_id                uuid                    NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform_name            public.wm_platform_name NOT NULL,
  pixel_id                 text                        NULL,
  conversion_id            text                        NULL,
  conversion_label         text                        NULL,
  dataset_id               text                        NULL,
  endpoint_url             text                        NULL,
  -- Vault secret pointer for the platform's auth token. NEVER stores the
  -- token directly. Populated only by `vault_upsert_client_platform_token`
  -- under service_role. RLS forbids authenticated writes to this column.
  token_secret_id          uuid                        NULL,
  is_active                boolean                 NOT NULL DEFAULT true,
  created_at               timestamptz             NOT NULL DEFAULT now(),
  updated_at               timestamptz             NOT NULL DEFAULT now(),

  CONSTRAINT client_platform_configs_pkey PRIMARY KEY (id),
  CONSTRAINT client_platform_configs_client_platform_key UNIQUE (client_id, platform_name),
  CONSTRAINT client_platform_configs_endpoint_https CHECK (
    endpoint_url IS NULL OR endpoint_url ~ '^https://'
  )
);

CREATE INDEX IF NOT EXISTS idx_client_platform_configs_client_id
  ON public.client_platform_configs (client_id);

CREATE INDEX IF NOT EXISTS idx_client_platform_configs_active
  ON public.client_platform_configs (platform_name, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_client_platform_configs_token_secret_id
  ON public.client_platform_configs (token_secret_id)
  WHERE token_secret_id IS NOT NULL;

-- updated_at trigger — reuse the project's standard helper
DROP TRIGGER IF EXISTS trg_client_platform_configs_updated_at ON public.client_platform_configs;
CREATE TRIGGER trg_client_platform_configs_updated_at
  BEFORE UPDATE ON public.client_platform_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------------------------
-- 6. RLS — client_platform_configs
-- ----------------------------------------------------------------------------
-- Posture mirrors `public.client_configs`:
--   - service_role: full access (edge functions / dispatch worker)
--   - authenticated internal_operator: read + write metadata, but NEVER
--     write `token_secret_id` directly (must go through Vault helper)
--   - anon: no access
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
  WITH CHECK (
    public.is_internal_operator()
    AND token_secret_id IS NULL
  );

DROP POLICY IF EXISTS client_platform_configs_update_internal ON public.client_platform_configs;
CREATE POLICY client_platform_configs_update_internal
  ON public.client_platform_configs
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_operator())
  WITH CHECK (
    public.is_internal_operator()
    AND token_secret_id IS NULL
  );

DROP POLICY IF EXISTS client_platform_configs_delete_internal ON public.client_platform_configs;
CREATE POLICY client_platform_configs_delete_internal
  ON public.client_platform_configs
  FOR DELETE
  TO authenticated
  USING (public.is_internal_operator());

-- ----------------------------------------------------------------------------
-- 7. Vault helper — vault_upsert_client_platform_token
-- ----------------------------------------------------------------------------
-- Mirrors the existing `public.vault_upsert_client_capi_token` pattern but
-- is platform-aware so a single tenant can have separate tokens for Meta /
-- Google Ads / TikTok / future platforms without colliding on secret names.
--
-- Returns the vault.secrets.id (uuid) so the caller can write it into
-- `client_platform_configs.token_secret_id` under service_role.
CREATE OR REPLACE FUNCTION public.vault_upsert_client_platform_token(
  p_client_id     uuid,
  p_platform_name public.wm_platform_name,
  p_token         text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_secret_id   uuid;
  v_secret_name text;
  v_description text;
BEGIN
  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'client_id is required';
  END IF;

  IF p_platform_name IS NULL THEN
    RAISE EXCEPTION 'platform_name is required';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) < 20 THEN
    RAISE EXCEPTION 'platform token is required (min 20 chars)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'client not found';
  END IF;

  v_secret_name := format(
    'client_platform_token_%s_%s',
    replace(p_client_id::text, '-', '_'),
    p_platform_name::text
  );

  v_description := format(
    'WindowMan client %s token (platform=%s)',
    p_client_id::text,
    p_platform_name::text
  );

  SELECT id INTO v_secret_id
  FROM vault.secrets
  WHERE name = v_secret_name;

  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret(trim(p_token), v_secret_name, v_description);
    SELECT id INTO v_secret_id
    FROM vault.secrets
    WHERE name = v_secret_name;
  ELSE
    PERFORM vault.update_secret(v_secret_id, trim(p_token), v_secret_name, v_description);
  END IF;

  RETURN v_secret_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vault_upsert_client_platform_token(uuid, public.wm_platform_name, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_upsert_client_platform_token(uuid, public.wm_platform_name, text)
  TO service_role;

COMMENT ON FUNCTION public.vault_upsert_client_platform_token(uuid, public.wm_platform_name, text) IS
  'Securely upserts a platform-scoped auth token for a WindowMan client into Vault. Returns the vault.secrets.id (uuid) so callers can write it into client_platform_configs.token_secret_id. service_role only.';
