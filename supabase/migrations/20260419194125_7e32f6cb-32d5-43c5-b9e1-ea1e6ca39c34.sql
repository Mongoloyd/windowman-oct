-- ═══════════════════════════════════════════════════════════════════════════
-- CAPI Control-Plane Safety Constraints
-- ═══════════════════════════════════════════════════════════════════════════
-- Prevents the four classes of unsafe routing states:
--   1. Multiple is_default=true rows (ambiguous fallback)
--   2. Multiple configs for the same client_id (ambiguous client routing)
--   3. Active routable configs missing pixel_id or access_token
--   4. A row that is both is_default=true AND tied to a client_id

-- 1. At most ONE default config row across the entire table.
CREATE UNIQUE INDEX IF NOT EXISTS meta_configurations_one_default_idx
  ON public.meta_configurations ((is_default))
  WHERE is_default = true;

-- 2. At most ONE config row per client_id.
CREATE UNIQUE INDEX IF NOT EXISTS meta_configurations_one_per_client_idx
  ON public.meta_configurations (client_id)
  WHERE client_id IS NOT NULL;

-- 3. A default row must NOT be tied to a client_id (mutually exclusive roles).
ALTER TABLE public.meta_configurations
  DROP CONSTRAINT IF EXISTS meta_config_default_or_client;
ALTER TABLE public.meta_configurations
  ADD CONSTRAINT meta_config_default_or_client
  CHECK (
    (is_default = true AND client_id IS NULL)
    OR (is_default = false)
  );

-- 4. Any non-degraded routable config row must carry both pixel_id and access_token.
--    (Rows without these fields have no business existing — they are silent landmines.)
ALTER TABLE public.meta_configurations
  DROP CONSTRAINT IF EXISTS meta_config_routable_fields_present;
ALTER TABLE public.meta_configurations
  ADD CONSTRAINT meta_config_routable_fields_present
  CHECK (
    pixel_id IS NOT NULL
    AND length(trim(pixel_id)) > 0
    AND access_token IS NOT NULL
    AND length(trim(access_token)) > 0
  );

-- 5. Either is_default=true OR client_id IS NOT NULL — orphan rows are forbidden.
ALTER TABLE public.meta_configurations
  DROP CONSTRAINT IF EXISTS meta_config_must_have_role;
ALTER TABLE public.meta_configurations
  ADD CONSTRAINT meta_config_must_have_role
  CHECK (is_default = true OR client_id IS NOT NULL);
