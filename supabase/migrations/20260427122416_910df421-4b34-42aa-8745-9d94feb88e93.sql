CREATE OR REPLACE FUNCTION public.client_platform_configs_block_token_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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