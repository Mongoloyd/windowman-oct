-- Atomic, first-write-immutable persistence for the /wmchat Phase 2
-- continuation. This migration changes no columns, RLS policies, table grants,
-- contact fields, consent data, or scanner/reveal state.

DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('public.leads') IS NULL THEN
    RAISE EXCEPTION 'public.leads is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'qualification_answers_json'
      AND data_type = 'jsonb'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'public.leads.qualification_answers_json jsonb is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'session_id'
      AND data_type = 'text'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'public.leads.session_id text is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'query_params'
      AND data_type = 'jsonb'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'public.leads.query_params jsonb is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.leads AS l
    WHERE pg_catalog.jsonb_typeof(l.qualification_answers_json) = 'object'
      AND l.qualification_answers_json ? 'wmchat_post_capture_v1'
  ) THEN
    RAISE EXCEPTION
      'Unexpected pre-existing wmchat_post_capture_v1 data requires manual review';
  END IF;
END;
$preflight$;

-- Before continuation exists, canonical capture retries may replace wmchat_v1.
-- After continuation exists, both WmChat namespaces are immutable. A stale
-- whole-document writer therefore fails closed rather than reporting a
-- successful update whose WmChat data was silently discarded.
CREATE OR REPLACE FUNCTION public.preserve_immutable_wmchat_qualification_namespaces()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_old_qualification jsonb;
  v_new_qualification jsonb;
  v_expected_token text;
  v_write_token text;
  v_rpc_owner name;
BEGIN
  v_new_qualification := NEW.qualification_answers_json;

  IF TG_OP = 'INSERT' THEN
    IF pg_catalog.jsonb_typeof(v_new_qualification) = 'object'
      AND v_new_qualification ? 'wmchat_post_capture_v1'
    THEN
      RAISE EXCEPTION 'wmchat_post_capture_unauthorized'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  v_old_qualification := OLD.qualification_answers_json;
  IF pg_catalog.jsonb_typeof(v_old_qualification) = 'object'
    AND v_old_qualification ? 'wmchat_post_capture_v1'
  THEN
    IF pg_catalog.jsonb_typeof(v_new_qualification) <> 'object' THEN
      RAISE EXCEPTION 'wmchat_post_capture_v1_immutable'
        USING ERRCODE = '55000';
    END IF;

    IF pg_catalog.jsonb_typeof(v_old_qualification -> 'wmchat_v1') <> 'object'
      OR pg_catalog.jsonb_typeof(v_new_qualification -> 'wmchat_v1') <> 'object'
      OR (v_new_qualification -> 'wmchat_v1') - 'completed_at'
        IS DISTINCT FROM
        (v_old_qualification -> 'wmchat_v1') - 'completed_at'
    THEN
      RAISE EXCEPTION 'wmchat_v1_immutable_after_post_capture'
        USING ERRCODE = '55000';
    END IF;

    IF v_new_qualification -> 'wmchat_post_capture_v1'
      IS DISTINCT FROM v_old_qualification -> 'wmchat_post_capture_v1'
    THEN
      RAISE EXCEPTION 'wmchat_post_capture_v1_immutable'
        USING ERRCODE = '55000';
    END IF;

    -- An otherwise identical canonical retry may carry a fresh completion
    -- timestamp. Keep the exact original namespace without hiding answer drift.
    v_new_qualification := pg_catalog.jsonb_set(
      v_new_qualification,
      ARRAY['wmchat_v1']::text[],
      v_old_qualification -> 'wmchat_v1',
      true
    );
    v_new_qualification := pg_catalog.jsonb_set(
      v_new_qualification,
      ARRAY['wmchat_post_capture_v1']::text[],
      v_old_qualification -> 'wmchat_post_capture_v1',
      true
    );
  ELSIF pg_catalog.jsonb_typeof(v_new_qualification) = 'object'
    AND v_new_qualification ? 'wmchat_post_capture_v1'
  THEN
    v_write_token := pg_catalog.current_setting(
      'windowman.wmchat_post_capture_write_token',
      true
    );
    v_expected_token := NEW.id::text || ':' || COALESCE(
      v_new_qualification -> 'wmchat_post_capture_v1' ->> 'submission_id',
      ''
    );

    SELECT pg_catalog.pg_get_userbyid(p.proowner)
    INTO v_rpc_owner
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = pg_catalog.to_regprocedure(
      'public.persist_wmchat_post_capture_v1(uuid,uuid,text,uuid,jsonb,jsonb)'
    );

    IF v_rpc_owner IS NULL
      OR CURRENT_USER IS DISTINCT FROM v_rpc_owner
      OR v_write_token IS DISTINCT FROM v_expected_token
    THEN
      RAISE EXCEPTION 'wmchat_post_capture_unauthorized'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.qualification_answers_json := v_new_qualification;
  RETURN NEW;
END;
$function$;

REVOKE ALL
ON FUNCTION public.preserve_immutable_wmchat_qualification_namespaces()
FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_preserve_immutable_wmchat_qualification_namespaces
ON public.leads;

CREATE TRIGGER trg_preserve_immutable_wmchat_qualification_namespaces
BEFORE INSERT OR UPDATE OF qualification_answers_json
ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.preserve_immutable_wmchat_qualification_namespaces();

-- The service-role-only RPC locks one exact lead row, confirms the Edge-
-- validated original wmchat_v1 against that locked version, validates the
-- complete action envelope again, and atomically writes one sibling namespace.
CREATE OR REPLACE FUNCTION public.persist_wmchat_post_capture_v1(
  p_lead_id uuid,
  p_session_id uuid,
  p_source text,
  p_submission_id uuid,
  p_expected_wmchat_v1 jsonb,
  p_namespace jsonb
)
RETURNS TABLE (
  outcome text,
  lead_id uuid,
  session_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_qualification jsonb;
  v_query_params jsonb;
  v_existing_namespace jsonb;
  v_stored_namespace jsonb;
  v_property_address jsonb;
  v_action text;
  v_namespace_keys constant text[] := ARRAY[
    'schema_version',
    'mode',
    'source',
    'submission_id',
    'action',
    'property_address',
    'conversation_time_preference',
    'quote_readiness',
    'callback_preference'
  ]::text[];
  v_address_keys constant text[] := ARRAY[
    'line1',
    'line2',
    'city',
    'region',
    'postal_code'
  ]::text[];
  v_updated_lead_id uuid;
  v_updated_session_id text;
  v_updated_qualification jsonb;
  v_original_keys constant text[] := ARRAY[
    'schema_version',
    'intake_version',
    'entry_intent',
    'answer_path',
    'answers',
    'continuation',
    'completed_at'
  ]::text[];
BEGIN
  IF p_lead_id IS NULL
    OR p_session_id IS NULL
    OR p_submission_id IS NULL
    OR p_source IS DISTINCT FROM 'windowman-first-quote'
    OR p_namespace IS NULL
    OR pg_catalog.jsonb_typeof(p_namespace) <> 'object'
    OR NOT (p_namespace ?& v_namespace_keys)
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_object_keys(p_namespace) AS item(key)
      WHERE NOT (item.key = ANY (v_namespace_keys))
    )
    OR pg_catalog.jsonb_typeof(p_namespace -> 'schema_version') <> 'string'
    OR p_namespace ->> 'schema_version' IS DISTINCT FROM '1'
    OR pg_catalog.jsonb_typeof(p_namespace -> 'mode') <> 'string'
    OR p_namespace ->> 'mode' IS DISTINCT FROM 'wmchat_post_capture_v1'
    OR pg_catalog.jsonb_typeof(p_namespace -> 'source') <> 'string'
    OR p_namespace ->> 'source' IS DISTINCT FROM 'windowman-first-quote'
    OR pg_catalog.jsonb_typeof(p_namespace -> 'submission_id') <> 'string'
    OR p_namespace ->> 'submission_id' IS DISTINCT FROM p_submission_id::text
    OR pg_catalog.jsonb_typeof(p_namespace -> 'action') <> 'string'
  THEN
    RETURN QUERY
    SELECT 'invalid_namespace'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  v_action := p_namespace ->> 'action';
  v_property_address := p_namespace -> 'property_address';

  IF v_property_address IS DISTINCT FROM 'null'::jsonb THEN
    IF pg_catalog.jsonb_typeof(v_property_address) <> 'object'
      OR NOT (v_property_address ?& v_address_keys)
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_object_keys(v_property_address) AS item(key)
        WHERE NOT (item.key = ANY (v_address_keys))
      )
      OR EXISTS (
        SELECT 1
        FROM pg_catalog.unnest(v_address_keys) AS item(key)
        WHERE pg_catalog.jsonb_typeof(v_property_address -> item.key) <> 'string'
      )
      OR pg_catalog.length(pg_catalog.btrim(v_property_address ->> 'line1'))
        NOT BETWEEN 3 AND 120
      OR pg_catalog.length(pg_catalog.btrim(v_property_address ->> 'line2')) > 120
      OR pg_catalog.length(pg_catalog.btrim(v_property_address ->> 'city'))
        NOT BETWEEN 2 AND 80
      OR pg_catalog.length(pg_catalog.btrim(v_property_address ->> 'region'))
        NOT BETWEEN 2 AND 40
      OR pg_catalog.upper(pg_catalog.btrim(v_property_address ->> 'region'))
        IS DISTINCT FROM pg_catalog.btrim(v_property_address ->> 'region')
      OR v_property_address ->> 'postal_code' !~ '^[0-9]{5}$'
      OR v_property_address ->> 'line1' ~ E'[\\r\\n]'
      OR v_property_address ->> 'line2' ~ E'[\\r\\n]'
      OR v_property_address ->> 'city' ~ E'[\\r\\n]'
      OR v_property_address ->> 'region' ~ E'[\\r\\n]'
    THEN
      RETURN QUERY
      SELECT 'invalid_namespace'::text, NULL::uuid, NULL::text;
      RETURN;
    END IF;
  END IF;

  IF v_action = 'quote_request_game_plan' THEN
    IF p_namespace -> 'conversation_time_preference'
        IS DISTINCT FROM 'null'::jsonb
      OR p_namespace -> 'quote_readiness' IS DISTINCT FROM 'null'::jsonb
      OR p_namespace -> 'callback_preference' IS DISTINCT FROM 'null'::jsonb
    THEN
      RETURN QUERY
      SELECT 'invalid_namespace'::text, NULL::uuid, NULL::text;
      RETURN;
    END IF;
  ELSIF v_action = 'schedule_windowman_conversation' THEN
    IF pg_catalog.jsonb_typeof(
      p_namespace -> 'conversation_time_preference'
    ) <> 'string'
      OR NOT (
        p_namespace ->> 'conversation_time_preference' = ANY (
          ARRAY[
            'asap',
            'weekday_morning',
            'weekday_afternoon',
            'weekday_evening'
          ]::text[]
        )
      )
      OR p_namespace -> 'quote_readiness' IS DISTINCT FROM 'null'::jsonb
      OR p_namespace -> 'callback_preference' IS DISTINCT FROM 'null'::jsonb
    THEN
      RETURN QUERY
      SELECT 'invalid_namespace'::text, NULL::uuid, NULL::text;
      RETURN;
    END IF;
  ELSIF v_action = 'review_quote_when_ready' THEN
    IF v_property_address IS DISTINCT FROM 'null'::jsonb
      OR p_namespace -> 'conversation_time_preference'
        IS DISTINCT FROM 'null'::jsonb
      OR pg_catalog.jsonb_typeof(p_namespace -> 'quote_readiness') <> 'string'
      OR p_namespace ->> 'quote_readiness' IS DISTINCT FROM 'not_yet'
      OR pg_catalog.jsonb_typeof(p_namespace -> 'callback_preference') <> 'string'
      OR NOT (
        p_namespace ->> 'callback_preference' = ANY (
          ARRAY[
            'next_week',
            'one_month',
            'three_months',
            'self_return'
          ]::text[]
        )
      )
    THEN
      RETURN QUERY
      SELECT 'invalid_namespace'::text, NULL::uuid, NULL::text;
      RETURN;
    END IF;
  ELSE
    RETURN QUERY
    SELECT 'invalid_namespace'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  SELECT l.qualification_answers_json, l.query_params
  INTO v_qualification, v_query_params
  FROM public.leads AS l
  WHERE l.id = p_lead_id
    AND l.session_id = p_session_id::text
    AND l.source = p_source
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 'identity_mismatch'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  IF pg_catalog.jsonb_typeof(v_qualification) <> 'object'
    OR pg_catalog.jsonb_typeof(v_qualification -> 'wmchat_v1') <> 'object'
    OR pg_catalog.jsonb_typeof(p_expected_wmchat_v1) <> 'object'
    OR v_qualification -> 'wmchat_v1' IS DISTINCT FROM p_expected_wmchat_v1
    OR NOT (p_expected_wmchat_v1 ?& v_original_keys)
    OR EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_object_keys(p_expected_wmchat_v1) AS item(key)
      WHERE NOT (item.key = ANY (v_original_keys))
    )
    OR p_expected_wmchat_v1 ->> 'schema_version' IS DISTINCT FROM '1'
    OR p_expected_wmchat_v1 ->> 'intake_version' IS DISTINCT FROM 'wmchat_v1'
    OR p_expected_wmchat_v1 ->> 'continuation' IS DISTINCT FROM 'sms_then_voice'
    OR NOT (
      p_expected_wmchat_v1 ->> 'entry_intent' = ANY (
        ARRAY['have_quote', 'need_quote', 'learn_powers']::text[]
      )
    )
    OR pg_catalog.jsonb_typeof(p_expected_wmchat_v1 -> 'answer_path') <> 'array'
    OR pg_catalog.jsonb_typeof(p_expected_wmchat_v1 -> 'answers') <> 'object'
    OR pg_catalog.jsonb_typeof(p_expected_wmchat_v1 -> 'completed_at') <> 'string'
    OR pg_catalog.length(p_expected_wmchat_v1 ->> 'completed_at') > 40
    OR pg_catalog.jsonb_typeof(v_query_params) <> 'object'
    OR v_query_params ->> 'source_path' IS DISTINCT FROM '/wmchat'
    OR v_query_params ->> 'intake_version' IS DISTINCT FROM 'wmchat_v1'
  THEN
    RETURN QUERY
    SELECT 'invalid_original'::text, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  IF v_qualification ? 'wmchat_post_capture_v1' THEN
    v_existing_namespace := v_qualification -> 'wmchat_post_capture_v1';
    IF pg_catalog.jsonb_typeof(v_existing_namespace) = 'object'
      AND pg_catalog.jsonb_typeof(v_existing_namespace -> 'completed_at') = 'string'
      AND v_existing_namespace - 'completed_at' = p_namespace
    THEN
      RETURN QUERY
      SELECT 'replayed'::text, p_lead_id, p_session_id::text;
    ELSE
      RETURN QUERY
      SELECT 'conflict'::text, NULL::uuid, NULL::text;
    END IF;
    RETURN;
  END IF;

  v_stored_namespace := p_namespace || pg_catalog.jsonb_build_object(
    'completed_at',
    pg_catalog.to_char(
      pg_catalog.clock_timestamp() AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
  );

  PERFORM pg_catalog.set_config(
    'windowman.wmchat_post_capture_write_token',
    p_lead_id::text || ':' || p_submission_id::text,
    true
  );

  UPDATE public.leads AS l
  SET qualification_answers_json = pg_catalog.jsonb_set(
    v_qualification,
    ARRAY['wmchat_post_capture_v1']::text[],
    v_stored_namespace,
    true
  )
  WHERE l.id = p_lead_id
    AND l.session_id = p_session_id::text
    AND l.source = p_source
  RETURNING l.id, l.session_id, l.qualification_answers_json
  INTO v_updated_lead_id, v_updated_session_id, v_updated_qualification;

  PERFORM pg_catalog.set_config(
    'windowman.wmchat_post_capture_write_token',
    '',
    true
  );

  IF v_updated_lead_id IS NULL
    OR v_updated_session_id IS DISTINCT FROM p_session_id::text
    OR v_updated_qualification -> 'wmchat_v1'
      IS DISTINCT FROM p_expected_wmchat_v1
    OR v_updated_qualification -> 'wmchat_post_capture_v1'
      IS DISTINCT FROM v_stored_namespace
  THEN
    RAISE EXCEPTION 'wmchat_post_capture_invariant_failed'
      USING ERRCODE = '55000';
  END IF;

  RETURN QUERY
  SELECT 'inserted'::text, v_updated_lead_id, v_updated_session_id;
END;
$function$;

REVOKE ALL
ON FUNCTION public.persist_wmchat_post_capture_v1(
  uuid,
  uuid,
  text,
  uuid,
  jsonb,
  jsonb
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.persist_wmchat_post_capture_v1(
  uuid,
  uuid,
  text,
  uuid,
  jsonb,
  jsonb
)
TO service_role;

DO $assertions$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.leads'::regclass
      AND tgname = 'trg_preserve_immutable_wmchat_qualification_namespaces'
      AND NOT tgisinternal
      AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'WmChat namespace preservation trigger was not installed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS t
    WHERE t.tgrelid = 'public.leads'::regclass
      AND t.tgname = 'trg_preserve_immutable_wmchat_qualification_namespaces'
      AND t.tgfoid = pg_catalog.to_regprocedure(
        'public.preserve_immutable_wmchat_qualification_namespaces()'
      )
      AND t.tgtype = 23
      AND NOT t.tgisinternal
      AND t.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'WmChat namespace trigger contract is not exact';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = pg_catalog.to_regprocedure(
      'public.persist_wmchat_post_capture_v1(uuid,uuid,text,uuid,jsonb,jsonb)'
    )
      AND p.prosecdef
      AND COALESCE(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
  ) THEN
    RAISE EXCEPTION 'WmChat post-capture RPC security contract is not exact';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = pg_catalog.to_regprocedure(
      'public.preserve_immutable_wmchat_qualification_namespaces()'
    )
      AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'WmChat preservation trigger must remain SECURITY INVOKER';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
    'service_role',
    'public.persist_wmchat_post_capture_v1(uuid,uuid,text,uuid,jsonb,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role must execute WmChat post-capture RPC';
  END IF;

  IF pg_catalog.has_function_privilege(
    'anon',
    'public.persist_wmchat_post_capture_v1(uuid,uuid,text,uuid,jsonb,jsonb)',
    'EXECUTE'
  ) OR pg_catalog.has_function_privilege(
    'authenticated',
    'public.persist_wmchat_post_capture_v1(uuid,uuid,text,uuid,jsonb,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'browser roles must not execute WmChat post-capture RPC';
  END IF;
END;
$assertions$;

COMMENT ON FUNCTION public.persist_wmchat_post_capture_v1(
  uuid,
  uuid,
  text,
  uuid,
  jsonb,
  jsonb
) IS
  'Service-role-only atomic first-write persistence for wmchat_post_capture_v1.';

COMMENT ON FUNCTION public.preserve_immutable_wmchat_qualification_namespaces() IS
  'Preserves exact WmChat JSONB siblings after post-capture continuation exists.';

-- Rollback order (only after Edge/frontend callers are reverted):
--   1. DROP trg_preserve_immutable_wmchat_qualification_namespaces.
--   2. REVOKE service_role EXECUTE and DROP persist_wmchat_post_capture_v1.
--   3. DROP preserve_immutable_wmchat_qualification_namespaces last.
-- Existing wmchat_post_capture_v1 data is intentionally retained. Removing
-- the trigger reopens the stale whole-document overwrite risk.
