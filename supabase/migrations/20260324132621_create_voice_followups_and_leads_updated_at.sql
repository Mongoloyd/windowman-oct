-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Create public.voice_followups table; add updated_at to public.leads
-- Date: 2026-03-27
-- Purpose: This migration is a prerequisite for the voice_followup → leads
--          sync trigger migration that follows it. It:
--
--   1. Adds updated_at to public.leads (missing from the initial schema
--      migration but present in the live DB per src/integrations/supabase/types.ts).
--   2. Creates public.voice_followups (table existed in the live DB but had
--      no migration file, so fresh-schema deploys failed at trigger creation).
--
-- All DDL is idempotent: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── 1. Add updated_at to public.leads ────────────────────────────────────────
-- The initial leads migration (20260317051701) did not include this column.
-- It exists on the live database (confirmed in src/integrations/supabase/types.ts
-- leads.Row.updated_at: string). Adding it here makes fresh deploys consistent.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Register the shared update_updated_at() trigger on leads so updated_at
-- is automatically maintained on every row update.
-- (update_updated_at() was created in migration 20260318033552.)
DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ── 2. Create public.voice_followups ─────────────────────────────────────────
-- Schema is derived from src/integrations/supabase/types.ts (voice_followups
-- Row/Insert/Update). Only one FK is reflected in the generated types
-- (voice_followups_lead_id_fkey → leads.id); opportunity_id and
-- scan_session_id are stored as plain nullable uuid columns.
-- No CHECK constraint on status because values come from the external
-- phonecall.bot provider and the full value set is not known at schema time.
CREATE TABLE IF NOT EXISTS public.voice_followups (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  lead_id                   uuid        NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  scan_session_id           uuid,
  opportunity_id            uuid,
  phone_e164                text        NOT NULL,
  provider                  text        NOT NULL DEFAULT 'phonecall_bot',
  provider_call_id          text,
  call_intent               text        NOT NULL,
  cta_source                text,
  status                    text        NOT NULL DEFAULT 'queued',
  payload_json              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  result_json               jsonb       NOT NULL DEFAULT '{}'::jsonb,
  queued_at                 timestamptz NOT NULL DEFAULT now(),
  started_at                timestamptz,
  answered_at               timestamptz,
  completed_at              timestamptz,
  duration_seconds          integer,
  recording_url             text,
  transcript_url            text,
  transcript_text           text,
  summary                   text,
  call_outcome              text,
  failure_reason            text,
  booking_intent_detected   boolean     NOT NULL DEFAULT false,
  appointment_booked        boolean     NOT NULL DEFAULT false,
  appointment_time_requested text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voice_followups_lead_id
  ON public.voice_followups(lead_id);

CREATE INDEX IF NOT EXISTS idx_voice_followups_scan_session_id
  ON public.voice_followups(scan_session_id);

CREATE INDEX IF NOT EXISTS idx_voice_followups_created_at
  ON public.voice_followups(created_at DESC);

-- RLS: service role only — no anon or authenticated access.
-- Admin dashboard and edge functions use SERVICE_ROLE_KEY (bypasses RLS).
ALTER TABLE public.voice_followups ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_voice_followups_updated_at ON public.voice_followups;

CREATE TRIGGER trg_voice_followups_updated_at
  BEFORE UPDATE ON public.voice_followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
