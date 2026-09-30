-- Reproduce the location-nullability change already recorded in production.
-- This migration is for fresh environments; do not reapply it manually to
-- production, where version 20260924000000 is already in migration history.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $precheck$
BEGIN
  IF (
    SELECT count(*)
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('meta_form_destinations', 'meta_qualification_events')
      AND c.relkind = 'r'
      AND a.attname = 'location_id'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND a.attnotnull
  ) <> 2 THEN
    RAISE EXCEPTION 'meta_location_nullable_precondition_failed';
  END IF;
END
$precheck$;

ALTER TABLE public.meta_form_destinations
  ALTER COLUMN location_id DROP NOT NULL;

ALTER TABLE public.meta_qualification_events
  ALTER COLUMN location_id DROP NOT NULL;

DO $postcheck$
BEGIN
  IF (
    SELECT count(*)
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('meta_form_destinations', 'meta_qualification_events')
      AND c.relkind = 'r'
      AND a.attname = 'location_id'
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND NOT a.attnotnull
  ) <> 2 THEN
    RAISE EXCEPTION 'meta_location_nullable_postcondition_failed';
  END IF;
END
$postcheck$;

COMMIT;
