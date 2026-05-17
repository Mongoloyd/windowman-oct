-- Create lead_events table required by CRM/admin audit migrations and Edge Function writers.
-- This table was present in generated Supabase types and referenced throughout the repo,
-- but no CREATE TABLE migration existed in the local migration chain.
-- Constraints and policies are intentionally left to later existing migrations.

CREATE TABLE IF NOT EXISTS public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  analysis_id uuid,
  scan_session_id uuid,
  event_id text,
  opportunity_id uuid,
  voice_followup_id uuid,
  status text
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id
  ON public.lead_events(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_events_created_at
  ON public.lead_events(created_at DESC);

ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
