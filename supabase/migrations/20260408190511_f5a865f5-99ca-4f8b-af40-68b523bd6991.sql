CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Contractor invitation table for invite-only onboarding
CREATE TABLE public.contractor_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,  invited_email text NOT NULL,
  contractor_id uuid NOT NULL,
  initial_credits integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamp with time zone,
  accepted_by uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.contractor_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_select_internal" ON public.contractor_invitations
  FOR SELECT TO authenticated USING (public.is_internal_operator());

CREATE POLICY "invitations_insert_internal" ON public.contractor_invitations
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_operator());

CREATE POLICY "invitations_update_internal" ON public.contractor_invitations
  FOR UPDATE TO authenticated
  USING (public.is_internal_operator())
  WITH CHECK (public.is_internal_operator());

CREATE POLICY "invitations_delete_internal" ON public.contractor_invitations
  FOR DELETE TO authenticated USING (public.is_internal_operator());

-- Service role full access for edge functions
CREATE POLICY "invitations_service_role_all" ON public.contractor_invitations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for token lookups
CREATE INDEX idx_contractor_invitations_token ON public.contractor_invitations (invite_token);
CREATE INDEX idx_contractor_invitations_email ON public.contractor_invitations (invited_email);

-- Updated_at trigger
CREATE TRIGGER update_contractor_invitations_updated_at
  BEFORE UPDATE ON public.contractor_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
