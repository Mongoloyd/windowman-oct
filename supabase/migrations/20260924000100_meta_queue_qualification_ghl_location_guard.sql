-- Reproduce the GHL location guard already recorded in production.
-- This migration is for fresh environments; do not reapply it manually to
-- production, where version 20260924000100 is already in migration history.
-- Only the GHL branch changes. The Meta feedback branch remains independent.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $patch$
DECLARE
  v_oid oid := to_regprocedure('public.meta_queue_qualification(uuid,uuid,boolean)');
  v_before pg_catalog.pg_proc%ROWTYPE;
  v_after pg_catalog.pg_proc%ROWTYPE;
  v_body text;
  v_definition text;
  v_anchor constant text :=
    'IF COALESCE(v_marketing_granted, false) AND COALESCE(v_sharing_granted, false) THEN';
  v_replacement constant text :=
    'IF COALESCE(v_marketing_granted, false) AND COALESCE(v_sharing_granted, false) AND v_qualification.location_id IS NOT NULL THEN';
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'meta_qualification_function_missing';
  END IF;

  SELECT * INTO v_before FROM pg_catalog.pg_proc WHERE oid = v_oid;
  v_body := replace(v_before.prosrc, E'\r\n', E'\n');
  IF md5(v_body) <> 'abacca5cf502edaeceb78427c81f021c' THEN
    RAISE EXCEPTION 'meta_qualification_original_fingerprint_mismatch';
  END IF;
  IF (length(v_body) - length(replace(v_body, v_anchor, '')))
      / length(v_anchor) <> 1 THEN
    RAISE EXCEPTION 'meta_qualification_body_anchor_mismatch';
  END IF;

  v_definition := replace(pg_catalog.pg_get_functiondef(v_oid), E'\r\n', E'\n');
  IF (length(v_definition) - length(replace(v_definition, v_anchor, '')))
      / length(v_anchor) <> 1 THEN
    RAISE EXCEPTION 'meta_qualification_definition_anchor_mismatch';
  END IF;

  EXECUTE replace(v_definition, v_anchor, v_replacement);

  SELECT * INTO v_after FROM pg_catalog.pg_proc WHERE oid = v_oid;
  IF NOT FOUND
     OR md5(replace(v_after.prosrc, E'\r\n', E'\n'))
        <> 'c064ab5c598239a8cb5873f4628c3732'
     OR (to_jsonb(v_after) - 'prosrc')
        IS DISTINCT FROM (to_jsonb(v_before) - 'prosrc') THEN
    RAISE EXCEPTION 'meta_qualification_final_contract_mismatch';
  END IF;
END
$patch$;

COMMIT;
