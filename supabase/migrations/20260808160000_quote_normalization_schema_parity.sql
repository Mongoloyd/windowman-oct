-- Idempotent schema parity for environments that applied an earlier revision of
-- 20260806144716_quote_normalization_layer.sql without stats/dimension columns.

ALTER TABLE public.quote_observations
  ADD COLUMN IF NOT EXISTS total_united_inches numeric NULL;

ALTER TABLE public.quote_observations
  ADD COLUMN IF NOT EXISTS is_stats_eligible boolean NOT NULL DEFAULT false;

ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS width_inches numeric NULL;

ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS height_inches numeric NULL;

ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS united_inches numeric NULL;

ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS cents_per_united_inch bigint NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_line_items'
      AND column_name = 'quantity'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE public.quote_line_items
      ALTER COLUMN quantity TYPE numeric
      USING quantity::numeric;
  END IF;
END $$;

COMMENT ON COLUMN public.quote_line_items.raw_dimensions IS
  'Verbatim source dimension text; normalizeAnalysis may also parse width/height/united inches for stats.';
