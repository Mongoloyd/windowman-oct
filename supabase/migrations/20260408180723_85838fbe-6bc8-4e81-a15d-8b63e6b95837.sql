-- Define set_updated_at before first use in this migration chain.
-- 20260416154937 may CREATE OR REPLACE the same helper; this keeps earlier triggers valid.
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- ============================================================
-- 1) contractor_profiles
-- ============================================================
CREATE TABLE public.contractor_profiles (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name  text        NOT NULL,
  contact_email text        NOT NULL,
  status        text        NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contractor_profiles_status_check
    CHECK (status IN ('active', 'delinquent', 'suspended')),

  CONSTRAINT contractor_profiles_contact_email_unique
    UNIQUE (contact_email)
);

-- ============================================================
-- 2) contractor_credits
-- ============================================================
CREATE TABLE public.contractor_credits (
  contractor_id uuid        PRIMARY KEY REFERENCES public.contractor_profiles(id) ON DELETE CASCADE,
  balance       integer     NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contractor_credits_balance_non_negative
    CHECK (balance >= 0)
);

-- Reuse existing set_updated_at() trigger function
CREATE TRIGGER trg_contractor_credits_updated_at
  BEFORE UPDATE ON public.contractor_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3) contractor_unlocked_leads
-- ============================================================
CREATE TABLE public.contractor_unlocked_leads (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id uuid        NOT NULL REFERENCES public.contractor_profiles(id) ON DELETE CASCADE,
  lead_id       uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  unlocked_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contractor_unlocked_leads_unique_pair
    UNIQUE (contractor_id, lead_id)
);

CREATE INDEX idx_contractor_unlocked_leads_contractor
  ON public.contractor_unlocked_leads (contractor_id);

CREATE INDEX idx_contractor_unlocked_leads_lead
  ON public.contractor_unlocked_leads (lead_id);

-- ============================================================
-- 4) RLS
-- ============================================================
ALTER TABLE public.contractor_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_credits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_unlocked_leads ENABLE ROW LEVEL SECURITY;

-- contractor_profiles: read own row
CREATE POLICY contractor_profiles_select_own
  ON public.contractor_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- contractor_credits: read own row
CREATE POLICY contractor_credits_select_own
  ON public.contractor_credits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = contractor_id);

-- contractor_unlocked_leads: read own rows
CREATE POLICY contractor_unlocked_leads_select_own
  ON public.contractor_unlocked_leads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = contractor_id);

-- ============================================================
-- 5) Revoke anon access
-- ============================================================
REVOKE ALL ON public.contractor_profiles       FROM anon;
REVOKE ALL ON public.contractor_credits        FROM anon;
REVOKE ALL ON public.contractor_unlocked_leads FROM anon;
