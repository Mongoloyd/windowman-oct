-- Durable pgTAP regression suite for 20260716134535_native_lead_atomic_rpc.sql.
-- Run only against a disposable local database built from the checked-in
-- migration chain. This file deliberately exercises DDL and two dblink
-- connections; the outer transaction rolls back local assertions, while the
-- dedicated concurrency rows are explicitly deleted through dblink.

\set ON_ERROR_STOP on
\pset pager off

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA extensions;

SELECT plan(56);

BEGIN;

INSERT INTO public.clients (slug, name, is_active)
VALUES
  ('direct', 'Direct / Organic', false),
  ('nlrpc-legacy-client', 'Native RPC Legacy Client', true)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.nlrpc_reset()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  TRUNCATE TABLE public.lead_attribution_details, public.leads CASCADE;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.nlrpc_contract_ok()
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_oid oid;
  v_owner oid;
BEGIN
  v_oid := pg_catalog.to_regprocedure(
    'public.upsert_native_lead_with_attribution(jsonb,jsonb)'
  );
  IF v_oid IS NULL THEN
    RETURN false;
  END IF;
  SELECT p.proowner INTO v_owner
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = v_oid;

  IF pg_catalog.pg_get_function_identity_arguments(v_oid)
       <> 'p_lead jsonb, p_attribution jsonb'
     OR pg_catalog.pg_get_function_result(v_oid)
       <> 'TABLE(lead_id uuid, attribution_id uuid, duplicate boolean, resolution_status text, review_required boolean)'
     OR NOT (SELECT p.prosecdef FROM pg_catalog.pg_proc AS p WHERE p.oid = v_oid)
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_proc AS p,
         pg_catalog.unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(value)
       WHERE p.oid = v_oid
         AND pg_catalog.split_part(cfg.value, '=', 1) = 'search_path'
         AND pg_catalog.btrim(pg_catalog.split_part(cfg.value, '=', 2), '"') = ''
     ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        (SELECT p.proacl FROM pg_catalog.pg_proc AS p WHERE p.oid = v_oid),
        pg_catalog.acldefault('f', v_owner)
      )
    ) AS acl
    LEFT JOIN pg_catalog.pg_roles AS role_grantee
      ON role_grantee.oid = acl.grantee
    WHERE acl.privilege_type = 'EXECUTE'
      AND acl.grantee <> v_owner
      AND COALESCE(role_grantee.rolname, 'PUBLIC') <> 'service_role'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.aclexplode(
      COALESCE(
        (SELECT p.proacl FROM pg_catalog.pg_proc AS p WHERE p.oid = v_oid),
        pg_catalog.acldefault('f', v_owner)
      )
    ) AS acl
    JOIN pg_catalog.pg_roles AS role_grantee
      ON role_grantee.oid = acl.grantee
    WHERE acl.privilege_type = 'EXECUTE'
      AND role_grantee.rolname = 'service_role'
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS i
    JOIN pg_catalog.pg_class AS table_class ON table_class.oid = i.indrelid
    JOIN pg_catalog.pg_namespace AS table_namespace
      ON table_namespace.oid = table_class.relnamespace
    JOIN pg_catalog.pg_attribute AS first_key
      ON first_key.attrelid = i.indrelid AND first_key.attnum = i.indkey[0]
    JOIN pg_catalog.pg_attribute AS second_key
      ON second_key.attrelid = i.indrelid AND second_key.attnum = i.indkey[1]
    WHERE table_namespace.nspname = 'public'
      AND table_class.relname = 'lead_attribution_details'
      AND i.indisunique
      AND i.indisvalid
      AND i.indisready
      AND i.indnkeyatts = 2
      AND i.indnatts = 2
      AND i.indexprs IS NULL
      AND first_key.attname = 'source_platform'
      AND second_key.attname = 'platform_lead_id'
      AND pg_catalog.upper(
        pg_catalog.regexp_replace(
          pg_catalog.pg_get_expr(i.indpred, i.indrelid, true),
          '\s+',
          '',
          'g'
        )
      ) IN ('PLATFORM_LEAD_IDISNOTNULL', '(PLATFORM_LEAD_IDISNOTNULL)')
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS c
    JOIN pg_catalog.pg_class AS source_table ON source_table.oid = c.conrelid
    JOIN pg_catalog.pg_namespace AS source_namespace
      ON source_namespace.oid = source_table.relnamespace
    JOIN pg_catalog.pg_class AS target_table ON target_table.oid = c.confrelid
    JOIN pg_catalog.pg_namespace AS target_namespace
      ON target_namespace.oid = target_table.relnamespace
    JOIN pg_catalog.pg_attribute AS source_column
      ON source_column.attrelid = c.conrelid
      AND source_column.attnum = c.conkey[1]
    JOIN pg_catalog.pg_attribute AS target_column
      ON target_column.attrelid = c.confrelid
      AND target_column.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND c.convalidated
      AND pg_catalog.array_length(c.conkey, 1) = 1
      AND pg_catalog.array_length(c.confkey, 1) = 1
      AND source_namespace.nspname = 'public'
      AND source_table.relname = 'lead_attribution_details'
      AND source_column.attname = 'lead_id'
      AND target_namespace.nspname = 'public'
      AND target_table.relname = 'leads'
      AND target_column.attname = 'id'
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

SELECT ok(
  pg_temp.nlrpc_contract_ok(),
  'exact function, ACL, partial unique index, and FK contract passes'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.upsert_native_lead_with_attribution(jsonb,jsonb)',
    'EXECUTE'
  ),
  'service_role has effective EXECUTE'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.upsert_native_lead_with_attribution(jsonb,jsonb)',
    'EXECUTE'
  ),
  'anon is denied EXECUTE'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.upsert_native_lead_with_attribution(jsonb,jsonb)',
    'EXECUTE'
  ),
  'authenticated is denied EXECUTE'
);
SELECT ok(
  NOT has_function_privilege(
    'public',
    'public.upsert_native_lead_with_attribution(jsonb,jsonb)',
    'EXECUTE'
  ),
  'PUBLIC is denied EXECUTE'
);
SELECT ok(
  has_function_privilege(
    current_user,
    'public.upsert_native_lead_with_attribution(jsonb,jsonb)',
    'EXECUTE'
  ),
  'migration owner/superuser capability remains documented'
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'nlrpc_unexpected') THEN
    CREATE ROLE nlrpc_unexpected NOLOGIN;
  END IF;
END;
$$;
SELECT ok(
  NOT has_function_privilege(
    'nlrpc_unexpected',
    'public.upsert_native_lead_with_attribution(jsonb,jsonb)',
    'EXECUTE'
  ),
  'arbitrary unexpected role is denied'
);
GRANT EXECUTE
  ON FUNCTION public.upsert_native_lead_with_attribution(jsonb, jsonb)
  TO nlrpc_unexpected;
SELECT ok(
  NOT pg_temp.nlrpc_contract_ok(),
  'unexpected direct EXECUTE ACL grant fails installation contract'
);
REVOKE ALL
  ON FUNCTION public.upsert_native_lead_with_attribution(jsonb, jsonb)
  FROM nlrpc_unexpected;
DROP ROLE nlrpc_unexpected;
SELECT ok(pg_temp.nlrpc_contract_ok(), 'ACL contract recovers after test grant removal');

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    r record;
  BEGIN
    SELECT * INTO r
    FROM public.upsert_native_lead_with_attribution(
      pg_catalog.jsonb_build_object(
        'session_id', 'nlrpc-test-new',
        'email', 'new@native.test',
        'phone_e164', '+13052341234'
      ),
      pg_catalog.jsonb_build_object(
        'source_platform', 'meta',
        'platform_lead_id', 'NL-NEW',
        'raw_payload', pg_catalog.jsonb_build_object('version', 1)
      )
    );
    IF r.resolution_status <> 'created'
       OR r.duplicate
       OR r.review_required THEN
      RAISE EXCEPTION 'unexpected new-lead response: %', r;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.leads AS l
      WHERE l.id = r.lead_id
        AND l.client_slug = 'direct'
        AND l.status = 'new'
        AND NOT l.phone_verified
        AND l.phone_verified_at IS NULL
        AND l.report_unlocked_at IS NULL
    ) THEN
      RAISE EXCEPTION 'new lead protected defaults mismatch';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.lead_attribution_details AS a
      WHERE a.id = r.attribution_id
        AND a.lead_id = r.lead_id
        AND a.import_source = 'ingest-native-lead'
    ) THEN
      RAISE EXCEPTION 'new attribution mismatch';
    END IF;
  END
  $do$;
  $sql$,
  'new lead and attribution are captured atomically'
);

SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    first_result record;
    replay_result record;
  BEGIN
    SELECT * INTO first_result
    FROM public.upsert_native_lead_with_attribution(
      pg_catalog.jsonb_build_object(
        'session_id', 'nlrpc-test-replay',
        'email', 'replay@native.test',
        'phone_e164', '+13052341235'
      ),
      pg_catalog.jsonb_build_object(
        'source_platform', 'google',
        'platform_lead_id', 'NL-REPLAY',
        'raw_payload', pg_catalog.jsonb_build_object('version', 1)
      )
    );
    SELECT * INTO replay_result
    FROM public.upsert_native_lead_with_attribution(
      pg_catalog.jsonb_build_object(
        'session_id', 'nlrpc-test-replay-2',
        'email', 'conflict@native.test',
        'phone_e164', '+13052341236',
        'ttclid', 'tt-replay'
      ),
      pg_catalog.jsonb_build_object(
        'source_platform', 'google',
        'platform_lead_id', 'NL-REPLAY',
        'utm_term', 'term-replay',
        'raw_payload', pg_catalog.jsonb_build_object('version', 2)
      )
    );
    IF replay_result.resolution_status <> 'provider_replay'
       OR replay_result.lead_id <> first_result.lead_id
       OR replay_result.attribution_id <> first_result.attribution_id THEN
      RAISE EXCEPTION 'provider replay identity mismatch';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.leads AS l
      WHERE l.id = first_result.lead_id
        AND l.email = 'replay@native.test'
        AND l.phone_e164 = '+13052341235'
        AND l.utm_term = 'term-replay'
        AND l.ttclid = 'tt-replay'
        AND l.qualification_answers_json #>> '{native_lead,tracking,ttclid}' = 'tt-replay'
    ) THEN
      RAISE EXCEPTION 'replay enrichment/canonical-contact behavior mismatch';
    END IF;
    IF (
      SELECT a.raw_payload ->> 'version'
      FROM public.lead_attribution_details AS a
      WHERE a.id = first_result.attribution_id
    ) <> '2' THEN
      RAISE EXCEPTION 'replay did not replace raw payload';
    END IF;
  END
  $do$;
  $sql$,
  'provider replay preserves canonical contact and fills missing enrichment'
);

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    base_result record;
    both_result record;
    phone_result record;
    email_base record;
    email_result record;
  BEGIN
    SELECT * INTO base_result
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-both","email":"both@native.test","phone_e164":"+13052341237"}'::jsonb,
      '{"source_platform":"meta","platform_lead_id":"NL-BOTH-1","raw_payload":{}}'::jsonb
    );
    SELECT * INTO both_result
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-both-2","email":"both@native.test","phone_e164":"+13052341237"}'::jsonb,
      '{"source_platform":"google","platform_lead_id":"NL-BOTH-2","raw_payload":{}}'::jsonb
    );
    IF both_result.resolution_status <> 'matched_both'
       OR both_result.lead_id <> base_result.lead_id THEN
      RAISE EXCEPTION 'matched_both failed';
    END IF;
    SELECT * INTO phone_result
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-phone","phone_e164":"+13052341237"}'::jsonb,
      '{"source_platform":"tiktok","platform_lead_id":"NL-PHONE","raw_payload":{}}'::jsonb
    );
    IF phone_result.resolution_status <> 'matched_phone'
       OR phone_result.lead_id <> base_result.lead_id THEN
      RAISE EXCEPTION 'matched_phone failed';
    END IF;
    SELECT * INTO email_base
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-email","email":"email@native.test"}'::jsonb,
      '{"source_platform":"nextdoor","platform_lead_id":"NL-EMAIL-1","raw_payload":{}}'::jsonb
    );
    SELECT * INTO email_result
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-email-2","email":"email@native.test"}'::jsonb,
      '{"source_platform":"google","platform_lead_id":"NL-EMAIL-2","raw_payload":{}}'::jsonb
    );
    IF email_result.resolution_status <> 'matched_email'
       OR email_result.lead_id <> email_base.lead_id THEN
      RAISE EXCEPTION 'matched_email failed';
    END IF;
  END
  $do$;
  $sql$,
  'matched phone, email, and both branches select the global identity'
);

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    legacy_id uuid;
    result record;
  BEGIN
    INSERT INTO public.leads (session_id, client_slug, status, email)
    VALUES (
      'nlrpc-test-legacy-email',
      'direct',
      'new',
      '  legacy-whitespace@native.test  '
    )
    RETURNING id INTO legacy_id;
    SELECT * INTO result
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-legacy-email-incoming","email":"legacy-whitespace@native.test"}'::jsonb,
      '{"source_platform":"meta","platform_lead_id":"NL-LEGACY-EMAIL","raw_payload":{}}'::jsonb
    );
    IF result.lead_id <> legacy_id
       OR result.resolution_status <> 'matched_email'
       OR (SELECT pg_catalog.count(*) FROM public.leads) <> 1 THEN
      RAISE EXCEPTION 'trimmed legacy email did not match globally';
    END IF;
  END
  $do$;
  $sql$,
  'legacy email with leading/trailing whitespace matches without duplication'
);

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    phone_owner record;
    email_owner record;
    conflict_result record;
    fallback_result record;
  BEGIN
    SELECT * INTO phone_owner
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-phone-owner","email":"phone-owner@native.test","phone_e164":"+13052341238"}'::jsonb,
      '{"source_platform":"meta","platform_lead_id":"NL-CONFLICT-P","raw_payload":{}}'::jsonb
    );
    SELECT * INTO email_owner
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-email-owner","email":"email-owner@native.test","phone_e164":"+13052341239"}'::jsonb,
      '{"source_platform":"meta","platform_lead_id":"NL-CONFLICT-E","raw_payload":{}}'::jsonb
    );
    SELECT * INTO conflict_result
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-conflict","email":"email-owner@native.test","phone_e164":"+13052341238"}'::jsonb,
      '{"source_platform":"google","platform_lead_id":"NL-CONFLICT","raw_payload":{}}'::jsonb
    );
    IF conflict_result.resolution_status <> 'phone_priority_soft_conflict'
       OR conflict_result.lead_id <> phone_owner.lead_id
       OR NOT conflict_result.review_required THEN
      RAISE EXCEPTION 'phone priority conflict failed';
    END IF;

    UPDATE public.leads
    SET phone_e164 = '+13052341999'
    WHERE id IN (phone_owner.lead_id, email_owner.lead_id);
    SELECT * INTO fallback_result
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-fallback","email":"email-owner@native.test","phone_e164":"+13052341999"}'::jsonb,
      '{"source_platform":"tiktok","platform_lead_id":"NL-FALLBACK","raw_payload":{}}'::jsonb
    );
    IF fallback_result.resolution_status <> 'email_priority_soft_conflict'
       OR fallback_result.lead_id <> email_owner.lead_id
       OR NOT fallback_result.review_required THEN
      RAISE EXCEPTION 'email priority fallback failed';
    END IF;
  END
  $do$;
  $sql$,
  'phone-priority conflict and email-priority fallback are deterministic'
);

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    lead_a uuid;
    lead_b uuid;
    ambiguous_result record;
    fake_result record;
  BEGIN
    INSERT INTO public.leads (session_id, client_slug, status, phone_e164)
    VALUES ('nlrpc-test-amb-a', 'direct', 'new', '+13052341888')
    RETURNING id INTO lead_a;
    INSERT INTO public.leads (session_id, client_slug, status, phone_e164)
    VALUES ('nlrpc-test-amb-b', 'direct', 'new', '+13052341888')
    RETURNING id INTO lead_b;
    SELECT * INTO ambiguous_result
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-amb-new","phone_e164":"+13052341888"}'::jsonb,
      '{"source_platform":"meta","platform_lead_id":"NL-AMB","raw_payload":{}}'::jsonb
    );
    IF ambiguous_result.resolution_status <> 'ambiguous_created'
       OR NOT ambiguous_result.review_required
       OR ambiguous_result.lead_id IN (lead_a, lead_b) THEN
      RAISE EXCEPTION 'ambiguous branch failed';
    END IF;
    SELECT * INTO fake_result
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-fake","phone_e164":"+15551234567","email":"fake@example.com"}'::jsonb,
      '{"source_platform":"google","platform_lead_id":"NL-FAKE","raw_payload":{}}'::jsonb
    );
    IF fake_result.resolution_status <> 'dedup_suppressed_created'
       OR NOT fake_result.review_required
       OR NOT EXISTS (
         SELECT 1 FROM public.leads AS l
         WHERE l.id = fake_result.lead_id
           AND l.phone_e164 = '+15551234567'
           AND l.email = 'fake@example.com'
           AND l.qualification_answers_json #> '{native_lead,dedup_suppression}' IS NOT NULL
       ) THEN
      RAISE EXCEPTION 'fake-contact capture failed';
    END IF;
  END
  $do$;
  $sql$,
  'ambiguous identities create review leads and fake contacts remain captured'
);

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    meta_lead uuid;
    facebook_lead uuid;
    meta_attr uuid;
    facebook_attr uuid;
    result record;
  BEGIN
    INSERT INTO public.leads (session_id, client_slug, status, email)
    VALUES ('nlrpc-test-meta', 'direct', 'new', 'meta@native.test')
    RETURNING id INTO meta_lead;
    INSERT INTO public.leads (session_id, client_slug, status, email)
    VALUES ('nlrpc-test-facebook', 'direct', 'new', 'facebook@native.test')
    RETURNING id INTO facebook_lead;
    INSERT INTO public.lead_attribution_details (
      lead_id, source_platform, platform_lead_id, raw_payload
    ) VALUES (meta_lead, 'meta', 'NL-ALIAS', '{}'::jsonb)
    RETURNING id INTO meta_attr;
    INSERT INTO public.lead_attribution_details (
      lead_id, source_platform, platform_lead_id, raw_payload
    ) VALUES (facebook_lead, 'facebook', 'NL-ALIAS', '{}'::jsonb)
    RETURNING id INTO facebook_attr;

    SELECT * INTO result
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-alias","email":"meta@native.test"}'::jsonb,
      '{"source_platform":"meta","platform_lead_id":"NL-ALIAS","raw_payload":{"latest":true}}'::jsonb
    );
    IF result.lead_id <> meta_lead
       OR result.attribution_id <> meta_attr
       OR NOT result.review_required
       OR (
         SELECT pg_catalog.count(*)
         FROM public.lead_attribution_details
         WHERE platform_lead_id = 'NL-ALIAS'
       ) <> 2
       OR (
         SELECT l.qualification_answers_json #>> '{native_lead,identity_conflict,facebook_attribution_id}'
         FROM public.leads AS l WHERE l.id = meta_lead
       ) <> facebook_attr::text THEN
      RAISE EXCEPTION 'meta/facebook alias collision behavior failed';
    END IF;
  END
  $do$;
  $sql$,
  'dual Meta/Facebook rows retain both records while canonical Meta wins review'
);

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    existing_id uuid;
    result record;
  BEGIN
    INSERT INTO public.leads (
      session_id,
      client_slug,
      status,
      email,
      phone_verified,
      phone_verified_at,
      otp_state,
      otp_failure_count,
      report_unlocked_at,
      manually_reviewed
    ) VALUES (
      'nlrpc-test-cross-client',
      'nlrpc-legacy-client',
      'qualified',
      'global@native.test',
      true,
      pg_catalog.now(),
      'verified',
      3,
      pg_catalog.now(),
      true
    ) RETURNING id INTO existing_id;

    SELECT * INTO result
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-cross-client-incoming","email":"global@native.test","client_slug":"evil-client"}'::jsonb,
      '{"source_platform":"nextdoor","platform_lead_id":"NL-CROSS-CLIENT","raw_payload":{}}'::jsonb
    );
    IF result.lead_id <> existing_id
       OR result.resolution_status <> 'matched_email'
       OR NOT EXISTS (
         SELECT 1 FROM public.leads AS l
         WHERE l.id = existing_id
           AND l.client_slug = 'nlrpc-legacy-client'
           AND l.status = 'qualified'
           AND l.phone_verified
           AND l.otp_state = 'verified'
           AND l.otp_failure_count = 3
           AND l.report_unlocked_at IS NOT NULL
           AND l.manually_reviewed
       ) THEN
      RAISE EXCEPTION 'cross-client global match mutated protected ownership/state';
    END IF;
  END
  $do$;
  $sql$,
  'global identity matches across client_slug while preserving legacy ownership and OTP state'
);

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    result record;
    native jsonb;
  BEGIN
    SELECT * INTO result
    FROM public.upsert_native_lead_with_attribution(
      pg_catalog.jsonb_build_object(
        'session_id', 'nlrpc-test-metadata',
        'email', 'metadata@native.test',
        'ROUTING', 'secret-route',
        ' Buyer_Id ', 'secret-buyer',
        'attribution', '{"Tenant_Id":"secret-tenant","utm_source":"safe-source"}'::jsonb,
        'query_params', '{" Dispatch_To ":"secret-dispatch","gclid":"safe-gclid"}'::jsonb,
        'qualification_answers_json', pg_catalog.jsonb_build_object(
          'native_lead',
          pg_catalog.jsonb_build_object(
            'Identity_Resolution', pg_catalog.jsonb_build_array('forged'),
            ' identity_conflict ', pg_catalog.jsonb_build_object('forged', true),
            'ROUTING', 'secret-native-route',
            ' Custom_Answers ', '{"color":"white"," Buyer_Id ":"secret-custom"}'::jsonb,
            ' TRACKING ', '{"utm_campaign":"safe-campaign","ROUTING":"secret-tracking"}'::jsonb,
            ' By_Platform ', '{"meta":{"quality":"high"," Owner_Id ":"secret-owner"}}'::jsonb
          )
        )
      ),
      '{"source_platform":"meta","platform_lead_id":"NL-METADATA","raw_payload":{}}'::jsonb
    );
    SELECT l.qualification_answers_json -> 'native_lead'
    INTO native
    FROM public.leads AS l
    WHERE l.id = result.lead_id;

    IF native ? 'Identity_Resolution'
       OR native ? ' identity_conflict '
       OR native ? 'ROUTING'
       OR native -> 'custom_answers' ? ' Buyer_Id '
       OR native -> 'tracking' ? 'ROUTING'
       OR native #> '{by_platform,meta}' ? ' Owner_Id '
       OR native #>> '{custom_answers,color}' <> 'white'
       OR native #>> '{tracking,utm_campaign}' <> 'safe-campaign'
       OR native #>> '{by_platform,meta,quality}' <> 'high'
       OR (
         SELECT l.attribution ? 'Tenant_Id'
            OR l.query_params ? ' Dispatch_To '
         FROM public.leads AS l
         WHERE l.id = result.lead_id
       )
       OR native -> 'ignored_control_plane_keys' @> '["secret-route"]'::jsonb
       OR NOT (
         native -> 'ignored_control_plane_keys'
         @> '["routing","buyer_id","identity_resolution","identity_conflict"]'::jsonb
       ) THEN
      RAISE EXCEPTION 'normalized reserved/control metadata filtering failed: %', native;
    END IF;
  END
  $do$;
  $sql$,
  'mixed-case and whitespace metadata variants normalize without persisting values'
);

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    existing_id uuid;
    result record;
    qualification jsonb;
  BEGIN
    INSERT INTO public.leads (
      session_id,
      client_slug,
      status,
      email,
      qualification_answers_json
    ) VALUES (
      'nlrpc-test-existing-json',
      'direct',
      'new',
      'existing-json@native.test',
      '{
        "unrelated_namespace":{"keep":true},
        "native_lead":{
          "custom_answers":{"old_answer":"old"},
          "tracking":{"utm_source":"existing-source"},
          "by_platform":{"meta":{"old_provider_field":"old"}}
        }
      }'::jsonb
    ) RETURNING id INTO existing_id;

    SELECT * INTO result
    FROM public.upsert_native_lead_with_attribution(
      '{
        "session_id":"nlrpc-test-existing-json-incoming",
        "email":"existing-json@native.test",
        "qualification_answers_json":{
          "native_lead":{
            "custom_answers":{"new_answer":"new"},
            "tracking":{"utm_source":"incoming-source","gclid":"new-gclid"},
            "by_platform":{"meta":{"new_provider_field":"new"}}
          }
        }
      }'::jsonb,
      '{"source_platform":"meta","platform_lead_id":"NL-EXISTING-JSON","raw_payload":{}}'::jsonb
    );
    SELECT l.qualification_answers_json
    INTO qualification
    FROM public.leads AS l
    WHERE l.id = existing_id;
    IF result.lead_id <> existing_id
       OR qualification #>> '{unrelated_namespace,keep}' <> 'true'
       OR qualification #>> '{native_lead,custom_answers,old_answer}' <> 'old'
       OR qualification #>> '{native_lead,custom_answers,new_answer}' <> 'new'
       OR qualification #>> '{native_lead,tracking,utm_source}' <> 'existing-source'
       OR qualification #>> '{native_lead,tracking,gclid}' <> 'new-gclid'
       OR qualification #>> '{native_lead,by_platform,meta,old_provider_field}' <> 'old'
       OR qualification #>> '{native_lead,by_platform,meta,new_provider_field}' <> 'new' THEN
      RAISE EXCEPTION 'existing qualification/provider JSON was not preserved: %',
        qualification;
    END IF;
  END
  $do$;
  $sql$,
  'existing qualification namespaces and provider JSON survive deep merging'
);

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    existing_id uuid;
    matched record;
  BEGIN
    INSERT INTO public.leads (
      session_id, client_slug, status, email, utm_source, gclid, attribution
    ) VALUES (
      'nlrpc-test-enrich-existing',
      'direct',
      'new',
      'enrich@native.test',
      'existing-source',
      'existing-gclid',
      '{"utm_source":"existing-json","blank_key":""}'::jsonb
    ) RETURNING id INTO existing_id;

    SELECT * INTO matched
    FROM public.upsert_native_lead_with_attribution(
      pg_catalog.jsonb_build_object(
        'session_id', 'nlrpc-test-enrich-incoming',
        'email', 'enrich@native.test',
        'utm_source', 'incoming-source',
        'utm_medium', 'incoming-medium',
        'utm_campaign', 'incoming-campaign',
        'utm_term', 'incoming-term',
        'utm_content', 'incoming-content',
        'gclid', 'incoming-gclid',
        'ttclid', 'incoming-ttclid',
        'msclkid', 'incoming-msclkid',
        'wbraid', 'incoming-wbraid',
        'gbraid', 'incoming-gbraid',
        'landing_page_url', 'https://example.test/landing',
        'first_page_path', '/first',
        'initial_referrer', 'https://referrer.test',
        'attribution', '{"utm_source":"incoming-json","blank_key":"filled"}'::jsonb
      ),
      '{"source_platform":"google","platform_lead_id":"NL-ENRICH","raw_payload":{}}'::jsonb
    );
    IF matched.lead_id <> existing_id
       OR NOT EXISTS (
         SELECT 1 FROM public.leads AS l
         WHERE l.id = existing_id
           AND l.utm_source = 'existing-source'
           AND l.gclid = 'existing-gclid'
           AND l.utm_medium = 'incoming-medium'
           AND l.utm_campaign = 'incoming-campaign'
           AND l.utm_term = 'incoming-term'
           AND l.utm_content = 'incoming-content'
           AND l.ttclid = 'incoming-ttclid'
           AND l.msclkid = 'incoming-msclkid'
           AND l.wbraid = 'incoming-wbraid'
           AND l.gbraid = 'incoming-gbraid'
           AND l.landing_page_url = 'https://example.test/landing'
           AND l.first_page_path = '/first'
           AND l.initial_referrer = 'https://referrer.test'
           AND l.attribution ->> 'utm_source' = 'existing-json'
           AND l.attribution ->> 'blank_key' = 'filled'
           AND l.qualification_answers_json #>> '{native_lead,tracking,ttclid}' = 'incoming-ttclid'
       ) THEN
      RAISE EXCEPTION 'matched enrichment preserve/fill behavior failed';
    END IF;
  END
  $do$;
  $sql$,
  'matched lead fills missing enrichment and preserves existing nonblank tracking'
);

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    existing_id uuid;
    attribution_id uuid;
    replay record;
  BEGIN
    INSERT INTO public.leads (
      session_id, client_slug, status, email, utm_source, fbc
    ) VALUES (
      'nlrpc-test-replay-enrichment',
      'nlrpc-legacy-client',
      'new',
      'replay-enrichment@native.test',
      'existing-source',
      'existing-fbc'
    ) RETURNING id INTO existing_id;
    INSERT INTO public.lead_attribution_details (
      lead_id,
      source_platform,
      platform_lead_id,
      source_channel,
      utm_source,
      fbc,
      raw_payload
    ) VALUES (
      existing_id,
      'meta',
      'NL-REPLAY-ENRICH',
      'existing-channel',
      'existing-attribution-source',
      'existing-attribution-fbc',
      '{"version":1}'::jsonb
    ) RETURNING id INTO attribution_id;

    SELECT * INTO replay
    FROM public.upsert_native_lead_with_attribution(
      pg_catalog.jsonb_build_object(
        'session_id', 'nlrpc-test-replay-enrichment-2',
        'email', 'other@native.test',
        'utm_source', 'incoming-source',
        'utm_medium', 'incoming-medium',
        'fbc', 'incoming-fbc',
        'fbp', 'incoming-fbp',
        'ttclid', 'incoming-ttclid'
      ),
      pg_catalog.jsonb_build_object(
        'source_platform', 'meta',
        'platform_lead_id', 'NL-REPLAY-ENRICH',
        'source_channel', 'incoming-channel',
        'utm_source', 'incoming-attribution-source',
        'utm_medium', 'incoming-attribution-medium',
        'fbc', 'incoming-attribution-fbc',
        'fbp', 'incoming-attribution-fbp',
        'raw_payload', pg_catalog.jsonb_build_object('version', 2)
      )
    );
    IF replay.lead_id <> existing_id
       OR replay.attribution_id <> attribution_id
       OR NOT EXISTS (
         SELECT 1 FROM public.leads AS l
         WHERE l.id = existing_id
           AND l.client_slug = 'nlrpc-legacy-client'
           AND l.email = 'replay-enrichment@native.test'
           AND l.utm_source = 'existing-source'
           AND l.utm_medium = 'incoming-attribution-medium'
           AND l.fbc = 'existing-fbc'
           AND l.fbp = 'incoming-attribution-fbp'
           AND l.ttclid = 'incoming-ttclid'
       )
       OR NOT EXISTS (
         SELECT 1 FROM public.lead_attribution_details AS a
         WHERE a.id = attribution_id
           AND a.source_channel = 'existing-channel'
           AND a.utm_source = 'existing-attribution-source'
           AND a.utm_medium = 'incoming-attribution-medium'
           AND a.fbc = 'existing-attribution-fbc'
           AND a.fbp = 'incoming-attribution-fbp'
           AND a.raw_payload ->> 'version' = '2'
       ) THEN
      RAISE EXCEPTION 'provider replay enrichment preserve/fill behavior failed';
    END IF;
  END
  $do$;
  $sql$,
  'provider replay fills missing lead/attribution tracking and preserves nonblank values'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lead_attribution_details'
      AND column_name IN ('ttclid', 'msclkid', 'wbraid', 'gbraid')
  ),
  'tracking identifiers without attribution columns are not invented'
);

SELECT throws_ok(
  $sql$
  SELECT *
  FROM public.upsert_native_lead_with_attribution(
    '{"session_id":"nlrpc-test-bound","email":"bound@native.test"}'::jsonb,
    pg_catalog.jsonb_build_object(
      'source_platform', 'meta',
      'platform_lead_id', 'NL-BOUND-ATTR',
      'raw_payload', '{}'::jsonb,
      'padding', pg_catalog.repeat('x', 262145)
    )
  )
  $sql$,
  '22023',
  'p_attribution_too_large',
  'entire attribution JSON is bounded at 256 KiB'
);
SELECT throws_ok(
  $sql$
  SELECT *
  FROM public.upsert_native_lead_with_attribution(
    '{"session_id":"nlrpc-test-bound","email":"bound@native.test"}'::jsonb,
    pg_catalog.jsonb_build_object(
      'source_platform', 'meta',
      'platform_lead_id', 'NL-BOUND-RAW',
      'raw_payload', pg_catalog.jsonb_build_object(
        'padding', pg_catalog.repeat('x', 1048577)
      )
    )
  )
  $sql$,
  '22023',
  'raw_payload_too_large',
  'raw payload is bounded at 1 MiB'
);
SELECT throws_ok(
  $sql$
  SELECT *
  FROM public.upsert_native_lead_with_attribution(
    '{"session_id":"nlrpc-test-bound","email":"bound@native.test"}'::jsonb,
    pg_catalog.jsonb_build_object(
      'source_platform', 'meta',
      'platform_lead_id', pg_catalog.repeat('x', 256),
      'raw_payload', '{}'::jsonb
    )
  )
  $sql$,
  '22023',
  'platform_lead_id_too_long',
  'provider lead identity is never silently truncated'
);
SELECT throws_ok(
  $sql$
  SELECT *
  FROM public.upsert_native_lead_with_attribution(
    '{"session_id":"nlrpc-test-bound","email":"bound@native.test"}'::jsonb,
    pg_catalog.jsonb_build_object(
      'source_platform', 'meta',
      'platform_lead_id', 'NL-BOUND-ID',
      'campaign_id', pg_catalog.repeat('x', 256),
      'raw_payload', '{}'::jsonb
    )
  )
  $sql$,
  '22023',
  'provider_field_id_too_long',
  'campaign/ad/adset/form identifiers are bounded'
);
SELECT throws_ok(
  $sql$
  SELECT *
  FROM public.upsert_native_lead_with_attribution(
    '{"session_id":"nlrpc-test-bound","email":"bound@native.test"}'::jsonb,
    pg_catalog.jsonb_build_object(
      'source_platform', 'meta',
      'platform_lead_id', 'NL-BOUND-NAME',
      'campaign_name', pg_catalog.repeat('x', 501),
      'raw_payload', '{}'::jsonb
    )
  )
  $sql$,
  '22023',
  'provider_field_name_too_long',
  'campaign/ad/adset display names are bounded'
);
SELECT throws_ok(
  $sql$
  SELECT *
  FROM public.upsert_native_lead_with_attribution(
    pg_catalog.jsonb_build_object(
      'session_id', 'nlrpc-test-bound',
      'email', 'bound@native.test',
      'gclid', pg_catalog.repeat('x', 1001)
    ),
    '{"source_platform":"meta","platform_lead_id":"NL-BOUND-TRACK","raw_payload":{}}'::jsonb
  )
  $sql$,
  '22023',
  'tracking_field_too_long',
  'UTM and click identifiers are bounded'
);
SELECT throws_ok(
  $sql$
  SELECT *
  FROM public.upsert_native_lead_with_attribution(
    pg_catalog.jsonb_build_object(
      'session_id', 'nlrpc-test-bound',
      'email', 'bound@native.test',
      'landing_page_url', pg_catalog.repeat('x', 2049)
    ),
    '{"source_platform":"meta","platform_lead_id":"NL-BOUND-URL","raw_payload":{}}'::jsonb
  )
  $sql$,
  '22023',
  'url_field_too_long',
  'landing/referrer/path values are bounded'
);
SELECT throws_ok(
  $sql$
  SELECT *
  FROM public.upsert_native_lead_with_attribution(
    pg_catalog.jsonb_build_object(
      'session_id', 'nlrpc-test-bound',
      'email', 'bound@native.test',
      'qualification_answers_json', pg_catalog.jsonb_build_object(
        'native_lead', pg_catalog.jsonb_build_object(
          'custom_answers',
          (
            SELECT pg_catalog.jsonb_object_agg('key_' || n, n)
            FROM pg_catalog.generate_series(1, 51) AS n
          )
        )
      )
    ),
    '{"source_platform":"meta","platform_lead_id":"NL-BOUND-COUNT","raw_payload":{}}'::jsonb
  )
  $sql$,
  '22023',
  'custom_answers_too_many_entries',
  'custom-answer entry count is bounded'
);
SELECT throws_ok(
  $sql$
  SELECT *
  FROM public.upsert_native_lead_with_attribution(
    pg_catalog.jsonb_build_object(
      'session_id', 'nlrpc-test-bound',
      'email', 'bound@native.test',
      'qualification_answers_json', pg_catalog.jsonb_build_object(
        'native_lead', pg_catalog.jsonb_build_object(
          'custom_answers',
          pg_catalog.jsonb_build_object(pg_catalog.repeat('k', 121), 'value')
        )
      )
    ),
    '{"source_platform":"meta","platform_lead_id":"NL-BOUND-KEY","raw_payload":{}}'::jsonb
  )
  $sql$,
  '22023',
  'custom_answer_key_too_long',
  'custom-answer keys are bounded'
);
SELECT throws_ok(
  $sql$
  SELECT *
  FROM public.upsert_native_lead_with_attribution(
    pg_catalog.jsonb_build_object(
      'session_id', 'nlrpc-test-bound',
      'email', 'bound@native.test',
      'qualification_answers_json', pg_catalog.jsonb_build_object(
        'native_lead', pg_catalog.jsonb_build_object(
          'custom_answers',
          pg_catalog.jsonb_build_object('long_value', pg_catalog.repeat('x', 2001))
        )
      )
    ),
    '{"source_platform":"meta","platform_lead_id":"NL-BOUND-VALUE","raw_payload":{}}'::jsonb
  )
  $sql$,
  '22023',
  'custom_answer_value_too_long',
  'custom-answer scalar strings are bounded'
);

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    result record;
    resolution_count integer;
  BEGIN
    FOR n IN 0..14 LOOP
      SELECT * INTO result
      FROM public.upsert_native_lead_with_attribution(
        '{"session_id":"nlrpc-test-cap","email":"cap@native.test"}'::jsonb,
        pg_catalog.jsonb_build_object(
          'source_platform', 'meta',
          'platform_lead_id', 'NL-CAP-' || n,
          'raw_payload', '{}'::jsonb
        )
      );
    END LOOP;
    SELECT pg_catalog.jsonb_array_length(
      l.qualification_answers_json #> '{native_lead,identity_resolution}'
    )
    INTO resolution_count
    FROM public.leads AS l
    WHERE l.id = result.lead_id;
    IF resolution_count <> 10 THEN
      RAISE EXCEPTION 'observation count=%', resolution_count;
    END IF;
  END
  $do$;
  $sql$,
  'identity-resolution observations remain capped at ten'
);

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    retained integer;
    got_40001 boolean := false;
  BEGIN
    CREATE OR REPLACE FUNCTION public.nlrpc_test_inject_race()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $trigger$
    BEGIN
      IF NEW.session_id = 'nlrpc-test-race' THEN
        INSERT INTO public.lead_attribution_details (
          lead_id, source_platform, platform_lead_id, raw_payload
        ) VALUES (NEW.id, 'meta', 'NL-RACE', '{}'::jsonb);
      END IF;
      RETURN NEW;
    END
    $trigger$;
    CREATE TRIGGER nlrpc_test_inject_race
      AFTER INSERT ON public.leads
      FOR EACH ROW
      EXECUTE FUNCTION public.nlrpc_test_inject_race();

    BEGIN
      PERFORM public.upsert_native_lead_with_attribution(
        '{"session_id":"nlrpc-test-race","email":"race@native.test"}'::jsonb,
        '{"source_platform":"meta","platform_lead_id":"NL-RACE","raw_payload":{}}'::jsonb
      );
    EXCEPTION WHEN SQLSTATE '40001' THEN
      got_40001 := true;
    END;

    DROP TRIGGER nlrpc_test_inject_race ON public.leads;
    DROP FUNCTION public.nlrpc_test_inject_race();
    IF NOT got_40001 THEN
      RAISE EXCEPTION 'expected 40001 was not raised';
    END IF;
    SELECT pg_catalog.count(*) INTO retained
    FROM public.leads
    WHERE session_id = 'nlrpc-test-race';
    IF retained <> 0 OR EXISTS (
      SELECT 1 FROM public.lead_attribution_details
      WHERE platform_lead_id = 'NL-RACE'
    ) THEN
      RAISE EXCEPTION 'race retained partial data';
    END IF;
  END
  $do$;
  $sql$,
  'unexpected attribution race raises 40001 and retains no orphan'
);

SELECT pg_temp.nlrpc_reset();
SELECT lives_ok(
  $sql$
  DO $do$
  DECLARE
    result record;
  BEGIN
    SELECT * INTO result
    FROM public.upsert_native_lead_with_attribution(
      '{"session_id":"nlrpc-test-link","email":"link@native.test"}'::jsonb,
      '{"source_platform":"meta","platform_lead_id":"NL-LINK","raw_payload":{}}'::jsonb
    );
    IF NOT EXISTS (
      SELECT 1
      FROM public.lead_attribution_details AS a
      WHERE a.id = result.attribution_id
        AND a.lead_id = result.lead_id
    ) OR EXISTS (
      SELECT 1
      FROM public.lead_attribution_details AS a
      LEFT JOIN public.leads AS l ON l.id = a.lead_id
      WHERE l.id IS NULL
    ) THEN
      RAISE EXCEPTION 'attribution/lead linkage mismatch';
    END IF;
  END
  $do$;
  $sql$,
  'every returned attribution references its returned lead'
);

-- Catalog assertion negative cases. Functional rows are no longer needed.
SELECT pg_temp.nlrpc_reset();

DROP INDEX public.idx_lead_attribution_details_platform_unique;
SELECT ok(NOT pg_temp.nlrpc_contract_ok(), 'missing partial unique index fails contract');

CREATE UNIQUE INDEX idx_lead_attribution_details_platform_unique
  ON public.lead_attribution_details (platform_lead_id, source_platform)
  WHERE platform_lead_id IS NOT NULL;
SELECT ok(NOT pg_temp.nlrpc_contract_ok(), 'reversed index keys fail contract');
DROP INDEX public.idx_lead_attribution_details_platform_unique;

CREATE UNIQUE INDEX idx_lead_attribution_details_platform_unique
  ON public.lead_attribution_details (
    source_platform,
    platform_lead_id,
    source_channel
  )
  WHERE platform_lead_id IS NOT NULL;
SELECT ok(NOT pg_temp.nlrpc_contract_ok(), 'extra indexed key fails contract');
DROP INDEX public.idx_lead_attribution_details_platform_unique;

CREATE UNIQUE INDEX idx_lead_attribution_details_platform_unique
  ON public.lead_attribution_details (source_platform, platform_lead_id)
  WHERE platform_lead_id IS NOT NULL AND source_platform <> '';
SELECT ok(NOT pg_temp.nlrpc_contract_ok(), 'wrong index predicate fails contract');
DROP INDEX public.idx_lead_attribution_details_platform_unique;

CREATE UNIQUE INDEX idx_lead_attribution_details_platform_unique
  ON public.lead_attribution_details (
    pg_catalog.lower(source_platform),
    platform_lead_id
  )
  WHERE platform_lead_id IS NOT NULL;
SELECT ok(NOT pg_temp.nlrpc_contract_ok(), 'expression index cannot masquerade as required index');
DROP INDEX public.idx_lead_attribution_details_platform_unique;

CREATE UNIQUE INDEX idx_lead_attribution_details_platform_unique
  ON public.lead_attribution_details (source_platform, platform_lead_id)
  WHERE platform_lead_id IS NOT NULL;
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS i
    WHERE i.indexrelid =
      'public.idx_lead_attribution_details_platform_unique'::regclass
      AND i.indisvalid
      AND i.indisready
  ),
  'required index is both valid and ready'
);
SELECT ok(pg_temp.nlrpc_contract_ok(), 'exact partial unique index restoration passes');

ALTER TABLE public.lead_attribution_details
  DROP CONSTRAINT lead_attribution_details_lead_id_fkey;
SELECT ok(NOT pg_temp.nlrpc_contract_ok(), 'missing attribution FK fails contract');

ALTER TABLE public.lead_attribution_details
  ADD CONSTRAINT lead_attribution_details_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) NOT VALID;
SELECT ok(NOT pg_temp.nlrpc_contract_ok(), 'NOT VALID attribution FK fails contract');
ALTER TABLE public.lead_attribution_details
  DROP CONSTRAINT lead_attribution_details_lead_id_fkey;

ALTER TABLE public.lead_attribution_details
  ADD CONSTRAINT nlrpc_wrong_source_fk
  FOREIGN KEY (id) REFERENCES public.leads(id);
SELECT ok(NOT pg_temp.nlrpc_contract_ok(), 'FK from wrong source column fails contract');
ALTER TABLE public.lead_attribution_details
  DROP CONSTRAINT nlrpc_wrong_source_fk;

CREATE UNIQUE INDEX nlrpc_test_leads_external_id_unique
  ON public.leads (external_lead_id);
ALTER TABLE public.lead_attribution_details
  ADD CONSTRAINT nlrpc_wrong_target_fk
  FOREIGN KEY (lead_id) REFERENCES public.leads(external_lead_id);
SELECT ok(NOT pg_temp.nlrpc_contract_ok(), 'FK to wrong referenced column fails contract');
ALTER TABLE public.lead_attribution_details
  DROP CONSTRAINT nlrpc_wrong_target_fk;
DROP INDEX public.nlrpc_test_leads_external_id_unique;

ALTER TABLE public.lead_attribution_details
  ADD CONSTRAINT lead_attribution_details_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;
SELECT ok(pg_temp.nlrpc_contract_ok(), 'exact validated attribution FK restoration passes');

ROLLBACK;

-- Two real database connections exercise reverse-order JSON key submission.
BEGIN;

CREATE TEMP TABLE nlrpc_concurrency_results (
  connection_name text PRIMARY KEY,
  response jsonb NOT NULL
);

-- dblink_connect with password auth on inet_server_addr() (not 127.0.0.1).
-- Local Supabase pg_hba trusts loopback, so non-superuser dblink rejects
-- 127.0.0.1 as credential-less impersonation; the server IP requires SCRAM.
SELECT ok(
  pg_catalog.inet_server_addr() IS NOT NULL,
  'concurrency harness requires a TCP session with inet_server_addr()'
);
SELECT extensions.dblink_connect(
  'nlrpc_a',
  pg_catalog.format(
    'host=%s port=%s dbname=%I user=postgres password=postgres',
    pg_catalog.inet_server_addr(),
    pg_catalog.current_setting('port'),
    pg_catalog.current_database()
  )
);
SELECT extensions.dblink_connect(
  'nlrpc_b',
  pg_catalog.format(
    'host=%s port=%s dbname=%I user=postgres password=postgres',
    pg_catalog.inet_server_addr(),
    pg_catalog.current_setting('port'),
    pg_catalog.current_database()
  )
);

SELECT extensions.dblink_exec(
  'nlrpc_a',
  $remote$
  DELETE FROM public.lead_attribution_details
  WHERE platform_lead_id IN ('NL-CONC-A', 'NL-CONC-B');
  DELETE FROM public.leads
  WHERE session_id IN ('nlrpc-conc-phone-owner', 'nlrpc-conc-email-owner');
  INSERT INTO public.leads (
    id, session_id, client_slug, status, phone_e164, email
  ) VALUES
    (
      'a1000000-0000-0000-0000-000000000001'::uuid,
      'nlrpc-conc-phone-owner',
      'direct',
      'new',
      '+13052341777',
      'phone-owner@native.test'
    ),
    (
      'b1000000-0000-0000-0000-000000000002'::uuid,
      'nlrpc-conc-email-owner',
      'direct',
      'new',
      '+13052341666',
      'split-owner@native.test'
    );
  $remote$
);

SELECT ok(
  extensions.dblink_send_query(
    'nlrpc_a',
    $remote$
    WITH started AS MATERIALIZED (
      SELECT pg_catalog.clock_timestamp() AS started_at
    ),
    rpc_result AS MATERIALIZED (
      SELECT result.*
      FROM started
      CROSS JOIN LATERAL public.upsert_native_lead_with_attribution(
        '{"session_id":"nlrpc-conc-a","phone_e164":"+13052341777","email":"split-owner@native.test"}'::jsonb,
        '{"source_platform":"meta","platform_lead_id":"NL-CONC-A","raw_payload":{}}'::jsonb
      ) AS result
    ),
    hold_lock AS MATERIALIZED (
      SELECT pg_catalog.pg_sleep(2), rpc_result.lead_id
      FROM rpc_result
    )
    SELECT pg_catalog.jsonb_build_object(
      'lead_id', rpc_result.lead_id,
      'attribution_id', rpc_result.attribution_id,
      'resolution_status', rpc_result.resolution_status,
      'review_required', rpc_result.review_required,
      'started_at', started.started_at,
      'finished_at', pg_catalog.clock_timestamp(),
      'duration_ms', pg_catalog.round(
        EXTRACT(
          epoch FROM (pg_catalog.clock_timestamp() - started.started_at)
        ) * 1000
      ),
      'hold', hold_lock.pg_sleep
    )::text
    FROM started
    JOIN rpc_result ON true
    JOIN hold_lock ON hold_lock.lead_id = rpc_result.lead_id
    $remote$
  ) = 1,
  'concurrency connection A accepted asynchronous query'
);
SELECT pg_catalog.pg_sleep(0.25);
SELECT ok(
  extensions.dblink_send_query(
    'nlrpc_b',
    $remote$
    WITH started AS MATERIALIZED (
      SELECT pg_catalog.clock_timestamp() AS started_at
    ),
    rpc_result AS MATERIALIZED (
      SELECT result.*
      FROM started
      CROSS JOIN LATERAL public.upsert_native_lead_with_attribution(
        '{"session_id":"nlrpc-conc-b","email":"split-owner@native.test","phone_e164":"+13052341777"}'::jsonb,
        '{"source_platform":"google","platform_lead_id":"NL-CONC-B","raw_payload":{}}'::jsonb
      ) AS result
    )
    SELECT pg_catalog.jsonb_build_object(
      'lead_id', rpc_result.lead_id,
      'attribution_id', rpc_result.attribution_id,
      'resolution_status', rpc_result.resolution_status,
      'review_required', rpc_result.review_required,
      'started_at', started.started_at,
      'finished_at', pg_catalog.clock_timestamp(),
      'duration_ms', pg_catalog.round(
        EXTRACT(
          epoch FROM (pg_catalog.clock_timestamp() - started.started_at)
        ) * 1000
      )
    )::text
    FROM started, rpc_result
    $remote$
  ) = 1,
  'concurrency connection B accepted reverse-order asynchronous query'
);

INSERT INTO nlrpc_concurrency_results (connection_name, response)
SELECT 'A', result::jsonb
FROM extensions.dblink_get_result('nlrpc_a') AS result(result text);
INSERT INTO nlrpc_concurrency_results (connection_name, response)
SELECT 'B', result::jsonb
FROM extensions.dblink_get_result('nlrpc_b') AS result(result text);

-- dblink_get_result must be drained once more after an async statement before
-- the named connection can accept the explicit cleanup command.
SELECT *
FROM extensions.dblink_get_result('nlrpc_a') AS drained(result text);
SELECT *
FROM extensions.dblink_get_result('nlrpc_b') AS drained(result text);

SELECT
  connection_name,
  response ->> 'lead_id' AS lead_id,
  response ->> 'attribution_id' AS attribution_id,
  response ->> 'resolution_status' AS resolution_status,
  response ->> 'review_required' AS review_required,
  response ->> 'started_at' AS started_at,
  response ->> 'finished_at' AS finished_at,
  response ->> 'duration_ms' AS duration_ms
FROM nlrpc_concurrency_results
ORDER BY connection_name;

SELECT is(
  (SELECT response ->> 'resolution_status'
   FROM nlrpc_concurrency_results WHERE connection_name = 'A'),
  'phone_priority_soft_conflict',
  'connection A resolves split identity with phone priority'
);
SELECT is(
  (SELECT response ->> 'resolution_status'
   FROM nlrpc_concurrency_results WHERE connection_name = 'B'),
  'phone_priority_soft_conflict',
  'connection B resolves reverse-order split identity with phone priority'
);
SELECT is(
  (SELECT response ->> 'lead_id'
   FROM nlrpc_concurrency_results WHERE connection_name = 'A'),
  'a1000000-0000-0000-0000-000000000001',
  'connection A returns phone-owner lead'
);
SELECT is(
  (SELECT response ->> 'lead_id'
   FROM nlrpc_concurrency_results WHERE connection_name = 'B'),
  'a1000000-0000-0000-0000-000000000001',
  'connection B returns the same phone-owner lead without deadlock'
);
SELECT is(
  (
    SELECT pg_catalog.count(*)::integer
    FROM public.lead_attribution_details
    WHERE platform_lead_id IN ('NL-CONC-A', 'NL-CONC-B')
      AND lead_id = 'a1000000-0000-0000-0000-000000000001'::uuid
  ),
  2,
  'both concurrent attributions reference the phone-owner lead'
);
SELECT is(
  (
    SELECT pg_catalog.count(*)::integer
    FROM public.leads
    WHERE session_id IN ('nlrpc-conc-a', 'nlrpc-conc-b')
  ),
  0,
  'concurrency calls commit no orphan leads'
);

SELECT extensions.dblink_exec(
  'nlrpc_a',
  $remote$
  DELETE FROM public.lead_attribution_details
  WHERE platform_lead_id IN ('NL-CONC-A', 'NL-CONC-B');
  DELETE FROM public.leads
  WHERE session_id IN ('nlrpc-conc-phone-owner', 'nlrpc-conc-email-owner');
  $remote$
);
SELECT extensions.dblink_disconnect('nlrpc_a');
SELECT extensions.dblink_disconnect('nlrpc_b');

SELECT * FROM finish();
ROLLBACK;
