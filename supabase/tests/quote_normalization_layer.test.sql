-- pgTAP tests for quote normalization schema (20260806144716 + parity migration).
-- Run: supabase test db --local (isolated local database only).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(20);

SELECT has_table(
  'public', 'quote_observations',
  'quote_observations table exists'
);

SELECT has_table(
  'public', 'quote_line_items',
  'quote_line_items table exists'
);

SELECT has_column(
  'public', 'quote_observations', 'total_united_inches',
  'quote_observations.total_united_inches exists'
);

SELECT has_column(
  'public', 'quote_observations', 'is_stats_eligible',
  'quote_observations.is_stats_eligible exists'
);

SELECT has_column(
  'public', 'quote_line_items', 'width_inches',
  'quote_line_items.width_inches exists'
);

SELECT has_column(
  'public', 'quote_line_items', 'height_inches',
  'quote_line_items.height_inches exists'
);

SELECT has_column(
  'public', 'quote_line_items', 'united_inches',
  'quote_line_items.united_inches exists'
);

SELECT has_column(
  'public', 'quote_line_items', 'cents_per_united_inch',
  'quote_line_items.cents_per_united_inch exists'
);

SELECT is(
  (
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_line_items'
      AND column_name = 'quantity'
  ),
  'numeric',
  'quote_line_items.quantity is numeric'
);

SELECT is(
  (
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_line_items'
      AND column_name = 'united_inches'
  ),
  'numeric',
  'quote_line_items.united_inches is numeric'
);

SELECT is(
  (
    SELECT udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_line_items'
      AND column_name = 'cents_per_united_inch'
  ),
  'int8',
  'quote_line_items.cents_per_united_inch is bigint'
);

SELECT col_not_null(
  'public', 'quote_observations', 'is_stats_eligible',
  'is_stats_eligible is NOT NULL'
);

SELECT col_has_default(
  'public', 'quote_observations', 'is_stats_eligible',
  'is_stats_eligible has a default'
);

SELECT is(
  (
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_observations'
      AND column_name = 'is_stats_eligible'
  ),
  'false',
  'is_stats_eligible defaults to false'
);

SELECT policies_are(
  'public',
  'quote_observations',
  ARRAY[
    'quote_observations_service_role_all',
    'quote_observations_select_internal'
  ],
  'quote_observations RLS policies unchanged'
);

SELECT policies_are(
  'public',
  'quote_line_items',
  ARRAY[
    'quote_line_items_service_role_all',
    'quote_line_items_select_internal'
  ],
  'quote_line_items RLS policies unchanged'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.quote_observations', 'SELECT'),
  'authenticated retains SELECT on quote_observations'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.quote_line_items', 'SELECT'),
  'authenticated retains SELECT on quote_line_items'
);

SELECT ok(
  has_table_privilege('service_role', 'public.quote_observations', 'INSERT')
  AND has_table_privilege('service_role', 'public.quote_observations', 'UPDATE')
  AND has_table_privilege('service_role', 'public.quote_observations', 'DELETE'),
  'service_role retains write privileges on quote_observations'
);

SELECT ok(
  has_table_privilege('service_role', 'public.quote_line_items', 'INSERT')
  AND has_table_privilege('service_role', 'public.quote_line_items', 'UPDATE')
  AND has_table_privilege('service_role', 'public.quote_line_items', 'DELETE'),
  'service_role retains write privileges on quote_line_items'
);

SELECT * FROM finish();

ROLLBACK;
