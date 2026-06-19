-- Add missing attribution scalar columns promoted by attributionMerge.ts
-- and selected by capture-truth-gate-lead / start-upload-scan-session.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ttclid text,
  ADD COLUMN IF NOT EXISTS msclkid text,
  ADD COLUMN IF NOT EXISTS wbraid text,
  ADD COLUMN IF NOT EXISTS gbraid text;

-- Add missing enrichment columns written by enrich-lead edge function.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_source text,
  ADD COLUMN IF NOT EXISTS property_value_low numeric,
  ADD COLUMN IF NOT EXISTS property_value_high numeric,
  ADD COLUMN IF NOT EXISTS year_built integer,
  ADD COLUMN IF NOT EXISTS property_type text;
