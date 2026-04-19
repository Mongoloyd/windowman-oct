-- Phase 2: Diagnosis Intake Persistence
-- Creates the diagnosis_intakes table, FKs, indexes, RLS, and adds funnel timestamps to leads.

-- 1. Create diagnosis_intakes table ─────────────────────────────────────────
CREATE TABLE public.diagnosis_intakes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  scan_session_id uuid NOT NULL REFERENCES public.scan_sessions(id) ON DELETE CASCADE,
  analysis_id uuid NULL REFERENCES public.analyses(id) ON DELETE SET NULL,

  report_grade text NOT NULL,
  source text NOT NULL DEFAULT 'post_report_diagnostic_intake',

  primary_diagnosis text NOT NULL,
  secondary_clarifiers jsonb NOT NULL DEFAULT '{}'::jsonb,
  other_text text NULL,

  window_intelligence jsonb NOT NULL DEFAULT '{}'::jsonb,
  counter_offer jsonb NOT NULL DEFAULT '{}'::jsonb,
  top_insights_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  confidence text NULL,
  prescription_path text NULL,

  attribution_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,

  status text NOT NULL DEFAULT 'completed'
);

-- 2. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX idx_diagnosis_intakes_lead_id ON public.diagnosis_intakes(lead_id);
CREATE INDEX idx_diagnosis_intakes_scan_session_id ON public.diagnosis_intakes(scan_session_id);
CREATE INDEX idx_diagnosis_intakes_analysis_id ON public.diagnosis_intakes(analysis_id);
CREATE INDEX idx_diagnosis_intakes_created_at ON public.diagnosis_intakes(created_at DESC);

-- 3. Updated-at trigger (reuses existing public.set_updated_at()) ───────────
CREATE TRIGGER trg_diagnosis_intakes_updated_at
BEFORE UPDATE ON public.diagnosis_intakes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 4. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.diagnosis_intakes ENABLE ROW LEVEL SECURITY;

-- Service role: full access (used by the submit-diagnosis-intake edge function)
CREATE POLICY diagnosis_intakes_service_role_all
ON public.diagnosis_intakes
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Internal operators (admins / operators): read for CRM dashboards
CREATE POLICY diagnosis_intakes_select_internal
ON public.diagnosis_intakes
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (public.is_internal_operator());

-- 5. Add funnel timestamps to leads ─────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS diagnosis_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS diagnosis_completed_at timestamptz NULL;