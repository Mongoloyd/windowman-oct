-- pgTAP contract tests for the Meta Intake Lab mapping-suggestion table.
-- Run with: npx supabase test db --local supabase/tests/field_mapping_overrides.test.sql
-- The transaction is rolled back so fixture rows never persist.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(24);

-- Schema and indexing.
SELECT has_table(
  'public',
  'field_mapping_overrides',
  'field_mapping_overrides exists'
);
SELECT has_column(
  'public',
  'field_mapping_overrides',
  'form_id',
  'form_id exists'
);
SELECT has_column(
  'public',
  'field_mapping_overrides',
  'question_label',
  'question_label exists'
);
SELECT has_column(
  'public',
  'field_mapping_overrides',
  'mapping_action',
  'mapping_action exists'
);
SELECT has_column(
  'public',
  'field_mapping_overrides',
  'canonical_key',
  'canonical_key exists'
);
SELECT has_index(
  'public',
  'field_mapping_overrides',
  'field_mapping_overrides_form_id_idx',
  'form_id lookup index exists'
);

-- RLS and direct browser-role denial.
SELECT ok(
  (
    SELECT c.relrowsecurity
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'field_mapping_overrides'
  ),
  'RLS is enabled'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy AS p
    JOIN pg_catalog.pg_class AS c ON c.oid = p.polrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'field_mapping_overrides'
  ),
  'no browser-facing RLS policy exists'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.field_mapping_overrides', 'SELECT'),
  'anon cannot select mappings directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.field_mapping_overrides', 'SELECT'),
  'authenticated cannot select mappings directly'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.field_mapping_overrides', 'INSERT'),
  'anon cannot insert mappings directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.field_mapping_overrides', 'INSERT'),
  'authenticated cannot insert mappings directly'
);
SELECT ok(
  has_table_privilege('service_role', 'public.field_mapping_overrides', 'SELECT'),
  'service_role can select mappings'
);
SELECT ok(
  has_table_privilege('service_role', 'public.field_mapping_overrides', 'INSERT'),
  'service_role can insert mappings'
);
SELECT ok(
  has_table_privilege('service_role', 'public.field_mapping_overrides', 'UPDATE'),
  'service_role can update mappings'
);
SELECT ok(
  has_table_privilege('service_role', 'public.field_mapping_overrides', 'DELETE'),
  'service_role can delete mappings'
);

-- Mapping-action and canonical-key constraints.
SELECT lives_ok(
  $sql$
    INSERT INTO public.field_mapping_overrides (
      form_id,
      question_label,
      mapping_action,
      canonical_key
    ) VALUES (
      'form-ignore',
      'Ignore this question',
      'ignore',
      NULL
    )
  $sql$,
  'ignore accepts a NULL canonical key'
);
SELECT lives_ok(
  $sql$
    INSERT INTO public.field_mapping_overrides (
      form_id,
      question_label,
      mapping_action,
      canonical_key
    ) VALUES (
      'form-map',
      'How many openings?',
      'map',
      'qualification_openings'
    )
  $sql$,
  'map accepts an allowlisted qualification key'
);
SELECT throws_ok(
  $sql$
    INSERT INTO public.field_mapping_overrides (
      form_id,
      question_label,
      mapping_action,
      canonical_key
    ) VALUES (
      'form-null-map',
      'Missing destination',
      'map',
      NULL
    )
  $sql$,
  '23514',
  NULL,
  'map rejects a NULL canonical key'
);
SELECT throws_ok(
  $sql$
    INSERT INTO public.field_mapping_overrides (
      form_id,
      question_label,
      mapping_action,
      canonical_key
    ) VALUES (
      'form-ignore-key',
      'Ignored with destination',
      'ignore',
      'email'
    )
  $sql$,
  '23514',
  NULL,
  'ignore rejects a non-NULL canonical key'
);
SELECT throws_ok(
  $sql$
    INSERT INTO public.field_mapping_overrides (
      form_id,
      question_label,
      mapping_action,
      canonical_key
    ) VALUES (
      'form-unsafe',
      'Unsafe destination',
      'map',
      'phone_verified'
    )
  $sql$,
  '23514',
  NULL,
  'map rejects a non-allowlisted canonical key'
);
SELECT throws_ok(
  $sql$
    INSERT INTO public.field_mapping_overrides (
      form_id,
      question_label,
      mapping_action,
      canonical_key
    ) VALUES (
      'form-bad-action',
      'Bad action',
      'delete',
      NULL
    )
  $sql$,
  '23514',
  NULL,
  'unknown mapping action is rejected'
);

-- Composite uniqueness is the upsert identity.
SELECT lives_ok(
  $sql$
    INSERT INTO public.field_mapping_overrides (
      form_id,
      question_label,
      mapping_action,
      canonical_key
    ) VALUES (
      'form-unique',
      'Unique question',
      'map',
      'email'
    )
  $sql$,
  'first form and question pair is accepted'
);
SELECT throws_ok(
  $sql$
    INSERT INTO public.field_mapping_overrides (
      form_id,
      question_label,
      mapping_action,
      canonical_key
    ) VALUES (
      'form-unique',
      'Unique question',
      'map',
      'phone_e164'
    )
  $sql$,
  '23505',
  NULL,
  'duplicate form and question pair is rejected'
);

SELECT * FROM finish();

ROLLBACK;
