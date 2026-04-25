CREATE TABLE IF NOT EXISTS public.client_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  google_ads_conversion_id text,
  google_ads_label text,
  meta_pixel_id text,
  meta_dataset_id text,
  gtm_server_url text,
  capi_token_secret_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT client_configs_client_id_key UNIQUE (client_id),
  CONSTRAINT client_configs_google_ads_conversion_id_format CHECK (
    google_ads_conversion_id IS NULL OR google_ads_conversion_id ~ '^(AW-)?[0-9]{6,20}$'
  ),
  CONSTRAINT client_configs_meta_pixel_id_format CHECK (
    meta_pixel_id IS NULL OR meta_pixel_id ~ '^[0-9]{6,20}$'
  ),
  CONSTRAINT client_configs_gtm_server_url_https CHECK (
    gtm_server_url IS NULL OR gtm_server_url ~ '^https://'
  )
);

ALTER TABLE public.client_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_configs_select_internal ON public.client_configs;
CREATE POLICY client_configs_select_internal
ON public.client_configs
FOR SELECT
TO authenticated
USING (public.is_internal_operator());

DROP POLICY IF EXISTS client_configs_insert_internal ON public.client_configs;
CREATE POLICY client_configs_insert_internal
ON public.client_configs
FOR INSERT
TO authenticated
WITH CHECK (public.is_internal_operator() AND capi_token_secret_id IS NULL);

DROP POLICY IF EXISTS client_configs_update_internal ON public.client_configs;
CREATE POLICY client_configs_update_internal
ON public.client_configs
FOR UPDATE
TO authenticated
USING (public.is_internal_operator())
WITH CHECK (public.is_internal_operator() AND capi_token_secret_id IS NULL);

DROP POLICY IF EXISTS client_configs_delete_internal ON public.client_configs;
CREATE POLICY client_configs_delete_internal
ON public.client_configs
FOR DELETE
TO authenticated
USING (public.is_internal_operator());

DROP POLICY IF EXISTS client_configs_service_role_all ON public.client_configs;
CREATE POLICY client_configs_service_role_all
ON public.client_configs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_client_configs_client_id ON public.client_configs(client_id);
CREATE INDEX IF NOT EXISTS idx_client_configs_capi_token_secret_id ON public.client_configs(capi_token_secret_id) WHERE capi_token_secret_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_client_configs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_client_configs_updated_at ON public.client_configs;
CREATE TRIGGER set_client_configs_updated_at
BEFORE UPDATE ON public.client_configs
FOR EACH ROW
EXECUTE FUNCTION public.set_client_configs_updated_at();

CREATE OR REPLACE FUNCTION public.vault_upsert_client_capi_token(
  p_client_id uuid,
  p_token text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_secret_id uuid;
  v_secret_name text;
BEGIN
  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'client_id is required';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) < 20 THEN
    RAISE EXCEPTION 'CAPI token is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'client not found';
  END IF;

  v_secret_name := 'client_capi_token_' || replace(p_client_id::text, '-', '_');

  SELECT id INTO v_secret_id
  FROM vault.secrets
  WHERE name = v_secret_name;

  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret(trim(p_token), v_secret_name, 'WindowMan client Meta CAPI token');
    SELECT id INTO v_secret_id
    FROM vault.secrets
    WHERE name = v_secret_name;
  ELSE
    PERFORM vault.update_secret(v_secret_id, trim(p_token), v_secret_name, 'WindowMan client Meta CAPI token');
  END IF;

  RETURN v_secret_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vault_upsert_client_capi_token(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_upsert_client_capi_token(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_client_capi_token_by_secret_id(
  p_secret_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_client_capi_token_by_secret_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_capi_token_by_secret_id(uuid) TO service_role;