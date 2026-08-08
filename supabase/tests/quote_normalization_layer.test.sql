-- pgTAP tests for quote normalization schema (20260806144716 + parity migration).
-- Run: supabase test db --local (isolated local database only).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(27);

SELECT has_table(
  'public', 'quote_observations',
  'quote_observations table exists'
);

SELECT has_table(
  'public', 'quote_line_items',
  'quote_line_items table exists'
);

SELECT has_table(
  'public', 'normalization_failures',
  'normalization_failures table exists'
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

SELECT ok(
  (
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_observations'
      AND column_name = 'is_stats_eligible'
  ) IN ('false', 'false::boolean'),
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

SELECT policies_are(
  'public',
  'normalization_failures',
  ARRAY[
    'normalization_failures_service_role_all',
    'normalization_failures_select_internal'
  ],
  'normalization_failures RLS policies unchanged'
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
  has_table_privilege('authenticated', 'public.normalization_failures', 'SELECT'),
  'authenticated retains SELECT on normalization_failures'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.quote_observations', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.quote_observations', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.quote_observations', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.quote_line_items', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.quote_line_items', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.quote_line_items', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.normalization_failures', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.normalization_failures', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.normalization_failures', 'DELETE'),
  'authenticated remains SELECT-only on normalization tables'
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

SELECT ok(
  has_table_privilege('service_role', 'public.normalization_failures', 'INSERT')
  AND has_table_privilege('service_role', 'public.normalization_failures', 'UPDATE')
  AND has_table_privilege('service_role', 'public.normalization_failures', 'DELETE'),
  'service_role retains write privileges on normalization_failures'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.quote_observations', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.quote_line_items', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.normalization_failures', 'SELECT'),
  'anon has no access to normalization tables'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        (
          SELECT c.relacl
          FROM pg_catalog.pg_class AS c
          JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname = 'quote_observations'
        ),
        pg_catalog.acldefault(
          'r',
          (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
        )
      )
    ) AS acl
    LEFT JOIN pg_catalog.pg_roles AS role_grantee
      ON role_grantee.oid = acl.grantee
    WHERE COALESCE(role_grantee.rolname, 'PUBLIC') = 'PUBLIC'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        (
          SELECT c.relacl
          FROM pg_catalog.pg_class AS c
          JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname = 'quote_line_items'
        ),
        pg_catalog.acldefault(
          'r',
          (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
        )
      )
    ) AS acl
    LEFT JOIN pg_catalog.pg_roles AS role_grantee
      ON role_grantee.oid = acl.grantee
    WHERE COALESCE(role_grantee.rolname, 'PUBLIC') = 'PUBLIC'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        (
          SELECT c.relacl
          FROM pg_catalog.pg_class AS c
          JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname = 'normalization_failures'
        ),
        pg_catalog.acldefault(
          'r',
          (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
        )
      )
    ) AS acl
    LEFT JOIN pg_catalog.pg_roles AS role_grantee
      ON role_grantee.oid = acl.grantee
    WHERE COALESCE(role_grantee.rolname, 'PUBLIC') = 'PUBLIC'
  ),
  'PUBLIC has no grants on normalization tables'
);

SELECT * FROM finish();

ROLLBACK;
