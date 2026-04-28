ALTER TABLE public.contractor_accounts
ADD COLUMN IF NOT EXISTS access_status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS portal_role text NOT NULL DEFAULT 'contractor_member',
ADD COLUMN IF NOT EXISTS last_portal_login_at timestamp with time zone NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contractor_accounts_access_status_check'
      AND conrelid = 'public.contractor_accounts'::regclass
  ) THEN
    ALTER TABLE public.contractor_accounts
    ADD CONSTRAINT contractor_accounts_access_status_check
    CHECK (access_status IN ('pending', 'invited', 'active', 'suspended', 'revoked'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contractor_accounts_portal_role_check'
      AND conrelid = 'public.contractor_accounts'::regclass
  ) THEN
    ALTER TABLE public.contractor_accounts
    ADD CONSTRAINT contractor_accounts_portal_role_check
    CHECK (portal_role IN ('contractor_owner', 'contractor_admin', 'contractor_member'));
  END IF;
END $$;

COMMENT ON COLUMN public.contractor_accounts.access_status IS 'Contractor portal access status for internal-pilot access gating.';
COMMENT ON COLUMN public.contractor_accounts.portal_role IS 'Contractor portal role for account context only; not a broad permission grant.';
COMMENT ON COLUMN public.contractor_accounts.last_portal_login_at IS 'Future audit timestamp for contractor portal access; not updated by 4A client code.';