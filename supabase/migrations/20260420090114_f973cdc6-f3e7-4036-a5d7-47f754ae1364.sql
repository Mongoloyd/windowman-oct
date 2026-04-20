ALTER TABLE public.contractor_profiles
  DROP CONSTRAINT IF EXISTS contractor_profiles_status_check;

ALTER TABLE public.contractor_profiles
  ADD CONSTRAINT contractor_profiles_status_check
  CHECK (status IN ('active', 'pending_review', 'suspended', 'cancelled'));