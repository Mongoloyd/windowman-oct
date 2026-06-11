-- PowerToolDemo + canonical lead enrichment columns
-- Strictly additive. Safe to run multiple times.
-- Unblocks capture-power-tool-demo-lead on forensic V2 (zgsofkgddpcntdvpckdq).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS qualification_answers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS funnel_stage text,
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS zip text;

COMMENT ON COLUMN public.leads.qualification_answers_json IS
  'Structured intake and qualification answers captured during homeowner lead flows.';

COMMENT ON COLUMN public.leads.funnel_stage IS
  'Progressive funnel stage for lead lifecycle tracking.';

COMMENT ON COLUMN public.leads.lead_source IS
  'Canonical lead source label; may mirror source for analytics and admin workflows.';

COMMENT ON COLUMN public.leads.zip IS
  'Homeowner ZIP code captured during intake or demo calibration.';
