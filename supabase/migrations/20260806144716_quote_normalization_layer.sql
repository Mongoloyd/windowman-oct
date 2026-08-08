-- Sprint 1 Gate 2: additive quote normalization layer.
-- Backfill/admin invocation only. This migration does not alter the scanner,
-- analyses, leads, scan_sessions, or any existing table.

CREATE TABLE public.quote_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL
    REFERENCES public.analyses(id)
    ON DELETE CASCADE,
  lead_id uuid NULL
    REFERENCES public.leads(id)
    ON DELETE SET NULL,
  county_name text NULL,
  zip_code text NULL,
  benchmark_county_key text NULL,
  contractor_raw_name text NULL,
  contract_total_cents bigint NULL,
  total_openings integer NULL,
  product_line_count integer NULL,
  adder_line_count integer NULL,
  line_item_count integer NOT NULL DEFAULT 0,
  has_line_item_detail boolean NOT NULL DEFAULT false,
  has_priced_lines boolean NOT NULL DEFAULT false,
  has_dimension_text boolean NOT NULL DEFAULT false,
  total_united_inches numeric NULL,
  is_stats_eligible boolean NOT NULL DEFAULT false,
  extraction_confidence numeric NULL,
  scanned_at timestamptz NULL,
  normalization_version text NOT NULL,
  source_extraction_keys text[] NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_observations_analysis_id_key UNIQUE (analysis_id)
);

COMMENT ON COLUMN public.quote_observations.scanned_at IS
  'Timestamp copied from analyses.created_at. This is scan persistence time, not the quote document date.';

CREATE TABLE public.quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid NOT NULL
    REFERENCES public.quote_observations(id)
    ON DELETE CASCADE,
  line_index integer NOT NULL,
  raw_description text NOT NULL,
  raw_dimensions text NULL,
  line_category text NULL,
  is_scope_adder boolean NOT NULL DEFAULT false,
  quantity numeric NULL,
  width_inches numeric NULL,
  height_inches numeric NULL,
  united_inches numeric NULL,
  cents_per_united_inch bigint NULL,
  unit_price_cents bigint NULL,
  extended_price_cents bigint NULL,
  brand text NULL,
  series text NULL,
  dp_rating text NULL,
  noa_number text NULL,
  opening_location text NULL,
  opening_tag text NULL,
  product_assignment_text text NULL,
  glass_package_text text NULL,
  glass_makeup_type text NULL,
  glass_low_e_present boolean NULL,
  glass_argon_present boolean NULL,
  glass_tint_text text NULL,
  glass_spec_complete boolean NULL,
  raw_line_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_line_items_observation_line_key
    UNIQUE (observation_id, line_index),
  CONSTRAINT quote_line_items_line_category_check
    CHECK (
      line_category IS NULL OR line_category IN (
        'window',
        'door',
        'screen',
        'install',
        'permit',
        'trim',
        'demo',
        'discount',
        'tax',
        'other'
      )
    )
);

COMMENT ON COLUMN public.quote_line_items.raw_dimensions IS
  'Verbatim source dimension text; normalizeAnalysis may also parse width/height/united inches for stats.';

COMMENT ON COLUMN public.quote_line_items.line_category IS
  'Bucket emitted by the existing shared classifyLineItem function. Engineering has no dedicated bucket and remains other unless separately approved.';

COMMENT ON COLUMN public.quote_line_items.raw_line_json IS
  'Untouched extracted source line item retained for deterministic reparsing without rescanning the document.';

CREATE TABLE public.normalization_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL,
  failure_stage text NOT NULL,
  reason text NOT NULL,
  field_name text NULL,
  line_index integer NULL,
  raw_excerpt text NULL,
  normalization_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT normalization_failures_stage_check
    CHECK (
      failure_stage IN (
        'read',
        'parse_header',
        'parse_lines',
        'write'
      )
    ),
  CONSTRAINT normalization_failures_excerpt_length_check
    CHECK (raw_excerpt IS NULL OR char_length(raw_excerpt) <= 500)
);

COMMENT ON COLUMN public.normalization_failures.analysis_id IS
  'Intentionally has no foreign key so normalization diagnostics survive analysis deletion.';

COMMENT ON COLUMN public.normalization_failures.raw_excerpt IS
  'Redacted diagnostic excerpt limited to 500 characters. Never store full_json here.';

-- The UNIQUE constraint on quote_observations.analysis_id supplies the required
-- analysis_id B-tree index while also enforcing normalization idempotency.
CREATE INDEX idx_quote_observations_lead_id
  ON public.quote_observations (lead_id);

CREATE INDEX idx_quote_observations_county_name
  ON public.quote_observations (county_name);

CREATE INDEX idx_quote_observations_contractor_raw_name
  ON public.quote_observations (contractor_raw_name);

CREATE INDEX idx_quote_observations_scanned_at
  ON public.quote_observations (scanned_at);

CREATE INDEX idx_quote_line_items_observation_id
  ON public.quote_line_items (observation_id);

CREATE INDEX idx_quote_line_items_brand_series
  ON public.quote_line_items (brand, series);

CREATE INDEX idx_quote_line_items_line_category
  ON public.quote_line_items (line_category);

CREATE INDEX idx_quote_line_items_is_scope_adder
  ON public.quote_line_items (is_scope_adder);

CREATE INDEX idx_normalization_failures_analysis_id
  ON public.normalization_failures (analysis_id);

CREATE INDEX idx_normalization_failures_failure_stage
  ON public.normalization_failures (failure_stage);

-- Existing updated_at trigger pattern:
-- supabase/migrations/20260427142000_syndicate_schema_rls.sql:139-149.
CREATE TRIGGER trg_quote_observations_updated_at
  BEFORE UPDATE ON public.quote_observations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.quote_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.normalization_failures ENABLE ROW LEVEL SECURITY;

-- Existing admin-readable table access pattern:
-- supabase/migrations/20260427142000_syndicate_schema_rls.sql:173-203.
-- PUBLIC/anon receive no grants or policies. Authenticated access is SELECT-only
-- and remains gated by the canonical internal-operator role check.
REVOKE ALL ON TABLE public.quote_observations
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.quote_line_items
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.normalization_failures
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.quote_observations TO authenticated;
GRANT SELECT ON TABLE public.quote_line_items TO authenticated;
GRANT SELECT ON TABLE public.normalization_failures TO authenticated;

GRANT ALL ON TABLE public.quote_observations TO service_role;
GRANT ALL ON TABLE public.quote_line_items TO service_role;
GRANT ALL ON TABLE public.normalization_failures TO service_role;

CREATE POLICY quote_observations_service_role_all
  ON public.quote_observations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY quote_observations_select_internal
  ON public.quote_observations
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_internal_operator()));

CREATE POLICY quote_line_items_service_role_all
  ON public.quote_line_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY quote_line_items_select_internal
  ON public.quote_line_items
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_internal_operator()));

CREATE POLICY normalization_failures_service_role_all
  ON public.normalization_failures
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY normalization_failures_select_internal
  ON public.normalization_failures
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_internal_operator()));

-- ROLLBACK (human-operated; review data-retention impact before running):
-- DROP TABLE IF EXISTS public.normalization_failures;
-- DROP TABLE IF EXISTS public.quote_line_items;
-- DROP TABLE IF EXISTS public.quote_observations;
