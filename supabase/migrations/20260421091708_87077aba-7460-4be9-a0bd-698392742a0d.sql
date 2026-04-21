
-- Vault helper used by dispatch-lead edge function on cold boot.
-- Idempotent: replaces existing values so secret rotation just works.
CREATE OR REPLACE FUNCTION public.vault_upsert_dispatch_secrets(
  p_url    text,
  p_secret text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- dispatch_lead_url
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'dispatch_lead_url';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(p_url, 'dispatch_lead_url', 'dispatch-lead edge function URL');
  ELSE
    PERFORM vault.update_secret(v_id, p_url, 'dispatch_lead_url', 'dispatch-lead edge function URL');
  END IF;

  -- dispatch_lead_secret
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'dispatch_lead_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(p_secret, 'dispatch_lead_secret', 'shared secret for dispatch-lead edge function');
  ELSE
    PERFORM vault.update_secret(v_id, p_secret, 'dispatch_lead_secret', 'shared secret for dispatch-lead edge function');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.vault_upsert_dispatch_secrets(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_upsert_dispatch_secrets(text, text) TO service_role;
