BEGIN;

-- WindowMan owns one global homeowner identity. Native-lead phone/email matching
-- is intentionally global and never scoped by client_slug. New native leads use
-- the non-routable `direct` sentinel; an existing lead's client_slug and all
-- downstream assignment/routing state are preserved.
--
-- Capture-first conflict behavior:
--   * provider replay wins without re-parenting its attribution;
--   * a unique phone is the primary identity winner;
--   * email is the fallback when no unique phone winner exists;
--   * split/ambiguous identities are retained and flagged for review;
--   * unexpected attribution races raise SQLSTATE 40001 so the whole call rolls
--     back and the trusted caller can retry.
CREATE OR REPLACE FUNCTION public.upsert_native_lead_with_attribution(
  p_lead jsonb,
  p_attribution jsonb
)
RETURNS TABLE (
  lead_id uuid,
  attribution_id uuid,
  duplicate boolean,
  resolution_status text,
  review_required boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  c_p_lead_max_bytes constant integer := 262144;
  c_p_attribution_max_bytes constant integer := 262144;
  c_raw_payload_max_bytes constant integer := 1048576;
  c_identity_max_length constant integer := 255;
  c_name_max_length constant integer := 120;
  c_provider_id_max_length constant integer := 255;
  c_detail_max_length constant integer := 500;
  c_tracking_max_length constant integer := 1000;
  c_url_max_length constant integer := 2048;
  c_custom_answer_max_entries constant integer := 50;
  c_custom_answer_key_max_length constant integer := 120;
  c_custom_answer_scalar_max_length constant integer := 2000;
  c_import_source constant text := 'ingest-native-lead';
  c_source_channel constant text := 'native_lead_form';
  c_source_detail constant text := 'trusted_forwarder';
  c_control_keys constant text[] := ARRAY[
    'client','client_id','client_slug',
    'tenant','tenant_id','tenant_slug',
    'partner','partner_id','partner_slug',
    'buyer','buyer_id',
    'assignment','assigned_to','assignee_id',
    'owner_id','lead_owner',
    'route','routing','routing_rule','routing_destination',
    'dispatch','dispatch_to'
  ];
  c_database_owned_keys constant text[] := ARRAY[
    'identity_resolution',
    'identity_conflict',
    'dedup_suppression',
    'resolution_status',
    'ignored_control_plane_keys'
  ];
  c_namespace_keys constant text[] := ARRAY[
    'custom_answers',
    'tracking',
    'by_platform'
  ];

  v_now timestamptz := pg_catalog.clock_timestamp();
  v_platform text;
  v_platform_lead_id text;
  v_raw_payload jsonb;
  v_session_id text;
  v_email text;
  v_phone text;
  v_phone_digits10 text;
  v_first_name text;
  v_last_name text;
  v_zip text;
  v_county text;

  v_phone_dedup_eligible boolean := false;
  v_email_dedup_eligible boolean := false;
  v_phone_suppressed_reason text;
  v_email_suppressed_reason text;

  v_meta_attr_id uuid;
  v_meta_lead_id uuid;
  v_fb_attr_id uuid;
  v_fb_lead_id uuid;
  v_provider_attr_id uuid;
  v_provider_attr_lead_id uuid;
  v_provider_attr_platform text;
  v_legacy_alias_collision boolean := false;

  v_phone_candidate_ids uuid[] := ARRAY[]::uuid[];
  v_email_candidate_ids uuid[] := ARRAY[]::uuid[];
  v_all_candidate_ids uuid[] := ARRAY[]::uuid[];
  v_phone_candidate_count integer := 0;
  v_email_candidate_count integer := 0;
  v_uid uuid;

  v_selected_lead_id uuid;
  v_created_this_tx boolean := false;
  v_resolution_status text;
  v_review_required boolean := false;
  v_duplicate boolean := false;
  v_crosslink boolean := false;
  v_phone_fill_ok boolean := false;
  v_email_fill_ok boolean := false;

  v_attribution_platform text;
  v_attribution_id uuid;
  v_attribution_lead_id uuid;

  v_existing_lead public.leads%ROWTYPE;
  v_existing_qual jsonb;
  v_existing_native jsonb;
  v_incoming_native jsonb;
  v_merged_native jsonb;
  v_incoming_attr jsonb;
  v_incoming_qp jsonb;
  v_attr_fill jsonb;
  v_qp_fill jsonb;
  v_incoming_ca jsonb;
  v_incoming_tr jsonb;
  v_incoming_byplat jsonb;
  v_ns_existing jsonb;
  v_ns_fill jsonb;
  v_observations jsonb;
  v_new_observation jsonb;
  v_obs_count integer;
  v_custom_answer_count integer := 0;
  v_ignored_keys text[] := ARRAY[]::text[];
  v_key text;
  v_val jsonb;

  v_received_at timestamptz;
  v_platform_created_time timestamptz;
  v_imported_at timestamptz;

  v_source_channel text;
  v_source_detail text;
  v_campaign_id text;
  v_campaign_name text;
  v_adset_id text;
  v_adset_name text;
  v_ad_id text;
  v_ad_name text;
  v_form_id text;
  v_utm_source text;
  v_utm_medium text;
  v_utm_campaign text;
  v_utm_term text;
  v_utm_content text;
  v_fbclid text;
  v_gclid text;
  v_fbc text;
  v_fbp text;
  v_ttclid text;
  v_msclkid text;
  v_wbraid text;
  v_gbraid text;
  v_landing_page_url text;
  v_first_page_path text;
  v_initial_referrer text;
BEGIN
  IF p_lead IS NULL OR pg_catalog.jsonb_typeof(p_lead) <> 'object' THEN
    RAISE EXCEPTION 'invalid_p_lead' USING ERRCODE = '22023';
  END IF;
  IF p_attribution IS NULL OR pg_catalog.jsonb_typeof(p_attribution) <> 'object' THEN
    RAISE EXCEPTION 'invalid_p_attribution' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.octet_length(p_lead::text) > c_p_lead_max_bytes THEN
    RAISE EXCEPTION 'p_lead_too_large' USING ERRCODE = '22023';
  END IF;

  v_raw_payload := p_attribution -> 'raw_payload';
  IF v_raw_payload IS NULL OR pg_catalog.jsonb_typeof(v_raw_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_raw_payload' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.octet_length(v_raw_payload::text) > c_raw_payload_max_bytes THEN
    RAISE EXCEPTION 'raw_payload_too_large' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.octet_length(p_attribution::text) > c_p_attribution_max_bytes THEN
    RAISE EXCEPTION 'p_attribution_too_large' USING ERRCODE = '22023';
  END IF;

  v_platform := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_attribution ->> 'source_platform', '')));
  IF v_platform NOT IN ('meta', 'google', 'nextdoor', 'tiktok') THEN
    RAISE EXCEPTION 'invalid_source_platform' USING ERRCODE = '22023';
  END IF;

  v_platform_lead_id := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'platform_lead_id', '')), '');
  IF v_platform_lead_id IS NULL THEN
    RAISE EXCEPTION 'missing_platform_lead_id' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.length(v_platform_lead_id) > c_identity_max_length THEN
    RAISE EXCEPTION 'platform_lead_id_too_long' USING ERRCODE = '22023';
  END IF;

  v_session_id := NULLIF(pg_catalog.btrim(COALESCE(p_lead ->> 'session_id', '')), '');
  IF v_session_id IS NOT NULL AND pg_catalog.length(v_session_id) > c_identity_max_length THEN
    RAISE EXCEPTION 'session_id_too_long' USING ERRCODE = '22023';
  END IF;

  v_email := NULLIF(pg_catalog.lower(pg_catalog.btrim(COALESCE(p_lead ->> 'email', ''))), '');
  IF v_email IS NOT NULL THEN
    IF pg_catalog.length(v_email) > c_identity_max_length
       OR v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
      RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
    END IF;
    IF v_email = 'test@test.com'
       OR v_email LIKE '%@example.com'
       OR v_email LIKE '%@example.net'
       OR v_email LIKE '%@example.org' THEN
      v_email_suppressed_reason := 'suppressed_example_email';
    ELSE
      v_email_dedup_eligible := true;
    END IF;
  END IF;

  v_phone := NULLIF(pg_catalog.btrim(COALESCE(p_lead ->> 'phone_e164', '')), '');
  IF v_phone IS NOT NULL THEN
    IF v_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
      RAISE EXCEPTION 'invalid_phone_e164' USING ERRCODE = '22023';
    END IF;

    IF pg_catalog.length(v_phone) = 12 AND pg_catalog.substr(v_phone, 1, 2) = '+1' THEN
      v_phone_digits10 := pg_catalog.substr(v_phone, 3, 10);
      IF pg_catalog.substr(v_phone_digits10, 1, 1) IN ('0', '1')
         OR pg_catalog.substr(v_phone_digits10, 4, 1) IN ('0', '1') THEN
        v_phone_suppressed_reason := 'invalid_nanp_shape';
      ELSIF v_phone IN (
        '+15551234567', '+10000000000', '+11111111111',
        '+11234567890', '+11234567891', '+19999999999'
      ) THEN
        v_phone_suppressed_reason := 'blocked_number';
      ELSIF pg_catalog.strpos('0123456789', v_phone_digits10) > 0
         OR pg_catalog.strpos('9876543210', v_phone_digits10) > 0 THEN
        v_phone_suppressed_reason := 'sequential_digits';
      ELSIF v_phone_digits10 = pg_catalog.repeat(pg_catalog.substr(v_phone_digits10, 1, 1), 10) THEN
        v_phone_suppressed_reason := 'repeated_digits';
      ELSIF pg_catalog.substr(v_phone_digits10, 4, 3) = '555' THEN
        v_phone_suppressed_reason := 'test_555_exchange';
      ELSIF pg_catalog.substr(v_phone_digits10, 1, 3) IN (
        '800', '888', '877', '866', '855', '844', '833'
      ) THEN
        v_phone_suppressed_reason := 'toll_free_prefix';
      ELSE
        v_phone_dedup_eligible := true;
      END IF;
    ELSE
      v_phone_dedup_eligible := true;
    END IF;
  END IF;

  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'missing_identity' USING ERRCODE = '22023';
  END IF;

  IF p_lead ? 'received_at' THEN
    BEGIN
      v_received_at := (pg_catalog.btrim(p_lead ->> 'received_at'))::timestamptz;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_received_at' USING ERRCODE = '22023';
    END;
  END IF;
  IF p_attribution ? 'platform_created_time' THEN
    BEGIN
      v_platform_created_time := (pg_catalog.btrim(p_attribution ->> 'platform_created_time'))::timestamptz;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_platform_created_time' USING ERRCODE = '22023';
    END;
  END IF;
  IF p_attribution ? 'imported_at' THEN
    BEGIN
      v_imported_at := (pg_catalog.btrim(p_attribution ->> 'imported_at'))::timestamptz;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'invalid_imported_at' USING ERRCODE = '22023';
    END;
  END IF;
  v_imported_at := COALESCE(v_imported_at, v_received_at, v_now);

  v_first_name := NULLIF(pg_catalog.btrim(COALESCE(p_lead ->> 'first_name', '')), '');
  v_last_name := NULLIF(pg_catalog.btrim(COALESCE(p_lead ->> 'last_name', '')), '');
  v_zip := NULLIF(pg_catalog.btrim(COALESCE(p_lead ->> 'zip', p_lead ->> 'postal_code', '')), '');
  v_county := NULLIF(pg_catalog.btrim(COALESCE(p_lead ->> 'county', '')), '');
  IF v_first_name IS NOT NULL AND pg_catalog.length(v_first_name) > c_name_max_length THEN
    RAISE EXCEPTION 'first_name_too_long' USING ERRCODE = '22023';
  END IF;
  IF v_last_name IS NOT NULL AND pg_catalog.length(v_last_name) > c_name_max_length THEN
    RAISE EXCEPTION 'last_name_too_long' USING ERRCODE = '22023';
  END IF;
  IF v_zip IS NOT NULL AND pg_catalog.length(v_zip) > 20 THEN
    RAISE EXCEPTION 'zip_too_long' USING ERRCODE = '22023';
  END IF;
  IF v_county IS NOT NULL AND pg_catalog.length(v_county) > c_name_max_length THEN
    RAISE EXCEPTION 'county_too_long' USING ERRCODE = '22023';
  END IF;

  v_source_channel := COALESCE(
    NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'source_channel', '')), ''),
    c_source_channel
  );
  v_source_detail := COALESCE(
    NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'source_detail', '')), ''),
    c_source_detail
  );
  v_campaign_id := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'campaign_id', '')), '');
  v_campaign_name := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'campaign_name', '')), '');
  v_adset_id := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'adset_id', '')), '');
  v_adset_name := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'adset_name', '')), '');
  v_ad_id := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'ad_id', '')), '');
  v_ad_name := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'ad_name', '')), '');
  v_form_id := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'form_id', '')), '');
  v_utm_source := COALESCE(
    NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'utm_source', p_lead ->> 'utm_source', '')), ''),
    v_platform
  );
  v_utm_medium := COALESCE(
    NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'utm_medium', p_lead ->> 'utm_medium', '')), ''),
    c_source_channel
  );
  v_utm_campaign := COALESCE(
    NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'utm_campaign', p_lead ->> 'utm_campaign', '')), ''),
    v_campaign_id
  );
  v_utm_term := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'utm_term', p_lead ->> 'utm_term', '')), '');
  v_utm_content := COALESCE(
    NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'utm_content', p_lead ->> 'utm_content', '')), ''),
    v_ad_id
  );
  v_fbclid := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'fbclid', p_lead ->> 'fbclid', '')), '');
  v_gclid := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'gclid', p_lead ->> 'gclid', '')), '');
  v_fbc := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'fbc', p_lead ->> 'fbc', '')), '');
  v_fbp := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'fbp', p_lead ->> 'fbp', '')), '');
  v_ttclid := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'ttclid', p_lead ->> 'ttclid', '')), '');
  v_msclkid := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'msclkid', p_lead ->> 'msclkid', '')), '');
  v_wbraid := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'wbraid', p_lead ->> 'wbraid', '')), '');
  v_gbraid := NULLIF(pg_catalog.btrim(COALESCE(p_attribution ->> 'gbraid', p_lead ->> 'gbraid', '')), '');
  v_landing_page_url := NULLIF(pg_catalog.btrim(COALESCE(
    p_attribution ->> 'landing_page_url', p_lead ->> 'landing_page_url', ''
  )), '');
  v_first_page_path := NULLIF(pg_catalog.btrim(COALESCE(
    p_attribution ->> 'first_page_path', p_lead ->> 'first_page_path', ''
  )), '');
  v_initial_referrer := NULLIF(pg_catalog.btrim(COALESCE(
    p_attribution ->> 'initial_referrer', p_lead ->> 'initial_referrer', ''
  )), '');

  IF pg_catalog.length(v_source_channel) > c_detail_max_length THEN
    RAISE EXCEPTION 'source_channel_too_long' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.length(v_source_detail) > c_detail_max_length THEN
    RAISE EXCEPTION 'source_detail_too_long' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(ARRAY[v_campaign_id, v_adset_id, v_ad_id, v_form_id]) AS x(value)
    WHERE x.value IS NOT NULL AND pg_catalog.length(x.value) > c_provider_id_max_length
  ) THEN
    RAISE EXCEPTION 'provider_field_id_too_long' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(ARRAY[v_campaign_name, v_adset_name, v_ad_name]) AS x(value)
    WHERE x.value IS NOT NULL AND pg_catalog.length(x.value) > c_detail_max_length
  ) THEN
    RAISE EXCEPTION 'provider_field_name_too_long' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(ARRAY[
      v_utm_source, v_utm_medium, v_utm_campaign, v_utm_term, v_utm_content,
      v_fbclid, v_gclid, v_fbc, v_fbp, v_ttclid, v_msclkid, v_wbraid, v_gbraid
    ]) AS x(value)
    WHERE x.value IS NOT NULL AND pg_catalog.length(x.value) > c_tracking_max_length
  ) THEN
    RAISE EXCEPTION 'tracking_field_too_long' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(ARRAY[
      v_landing_page_url, v_first_page_path, v_initial_referrer
    ]) AS x(value)
    WHERE x.value IS NOT NULL AND pg_catalog.length(x.value) > c_url_max_length
  ) THEN
    RAISE EXCEPTION 'url_field_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_object_agg(e.k, e.v), '{}'::jsonb)
  INTO v_incoming_attr
  FROM pg_catalog.jsonb_each(
    CASE WHEN pg_catalog.jsonb_typeof(p_lead -> 'attribution') = 'object'
      THEN p_lead -> 'attribution' ELSE '{}'::jsonb END
  ) AS e(k, v)
  WHERE pg_catalog.lower(pg_catalog.btrim(e.k)) <> ALL (c_control_keys)
    AND pg_catalog.lower(pg_catalog.btrim(e.k)) <> ALL (c_database_owned_keys)
    AND pg_catalog.lower(pg_catalog.btrim(e.k)) <> ALL (c_namespace_keys);

  SELECT COALESCE(pg_catalog.jsonb_object_agg(e.k, e.v), '{}'::jsonb)
  INTO v_incoming_qp
  FROM pg_catalog.jsonb_each(
    CASE WHEN pg_catalog.jsonb_typeof(p_lead -> 'query_params') = 'object'
      THEN p_lead -> 'query_params' ELSE '{}'::jsonb END
  ) AS e(k, v)
  WHERE pg_catalog.lower(pg_catalog.btrim(e.k)) <> ALL (c_control_keys)
    AND pg_catalog.lower(pg_catalog.btrim(e.k)) <> ALL (c_database_owned_keys)
    AND pg_catalog.lower(pg_catalog.btrim(e.k)) <> ALL (c_namespace_keys);

  v_incoming_native := COALESCE(
    p_lead -> 'qualification_answers_json' -> 'native_lead',
    '{}'::jsonb
  );
  IF pg_catalog.jsonb_typeof(v_incoming_native) <> 'object' THEN
    RAISE EXCEPTION 'invalid_native_lead_metadata' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_each(v_incoming_native) AS ns(k, v)
    WHERE pg_catalog.lower(pg_catalog.btrim(ns.k)) = ANY (c_namespace_keys)
      AND pg_catalog.jsonb_typeof(ns.v) <> 'object'
  ) THEN
    RAISE EXCEPTION 'invalid_native_lead_namespace' USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.count(*)::integer
  INTO v_custom_answer_count
  FROM pg_catalog.jsonb_each(v_incoming_native) AS ns(k, v)
  CROSS JOIN LATERAL pg_catalog.jsonb_object_keys(ns.v) AS custom_key(k)
  WHERE pg_catalog.lower(pg_catalog.btrim(ns.k)) = 'custom_answers';
  IF v_custom_answer_count > c_custom_answer_max_entries THEN
    RAISE EXCEPTION 'custom_answers_too_many_entries' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_each(v_incoming_native) AS ns(k, v)
    CROSS JOIN LATERAL pg_catalog.jsonb_each(ns.v) AS ca(k, v)
    WHERE pg_catalog.lower(pg_catalog.btrim(ns.k)) = 'custom_answers'
      AND pg_catalog.length(ca.k) > c_custom_answer_key_max_length
  ) THEN
    RAISE EXCEPTION 'custom_answer_key_too_long' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_each(v_incoming_native) AS ns(k, v)
    CROSS JOIN LATERAL pg_catalog.jsonb_each(ns.v) AS ca(k, v)
    WHERE pg_catalog.lower(pg_catalog.btrim(ns.k)) = 'custom_answers'
      AND pg_catalog.jsonb_typeof(ca.v) = 'string'
      AND pg_catalog.length(ca.v #>> '{}') > c_custom_answer_scalar_max_length
  ) THEN
    RAISE EXCEPTION 'custom_answer_value_too_long' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_object_agg(ca.k, ca.v ORDER BY ns_ord, ca_ord), '{}'::jsonb)
  INTO v_incoming_ca
  FROM pg_catalog.jsonb_each(v_incoming_native) WITH ORDINALITY AS ns(k, v, ns_ord)
  CROSS JOIN LATERAL pg_catalog.jsonb_each(ns.v) WITH ORDINALITY AS ca(k, v, ca_ord)
  WHERE pg_catalog.lower(pg_catalog.btrim(ns.k)) = 'custom_answers'
    AND pg_catalog.lower(pg_catalog.btrim(ca.k)) <> ALL (c_control_keys)
    AND pg_catalog.lower(pg_catalog.btrim(ca.k)) <> ALL (c_database_owned_keys)
    AND pg_catalog.lower(pg_catalog.btrim(ca.k)) <> ALL (c_namespace_keys);

  SELECT COALESCE(pg_catalog.jsonb_object_agg(tr.k, tr.v ORDER BY ns_ord, tr_ord), '{}'::jsonb)
  INTO v_incoming_tr
  FROM pg_catalog.jsonb_each(v_incoming_native) WITH ORDINALITY AS ns(k, v, ns_ord)
  CROSS JOIN LATERAL pg_catalog.jsonb_each(ns.v) WITH ORDINALITY AS tr(k, v, tr_ord)
  WHERE pg_catalog.lower(pg_catalog.btrim(ns.k)) = 'tracking'
    AND pg_catalog.lower(pg_catalog.btrim(tr.k)) <> ALL (c_control_keys)
    AND pg_catalog.lower(pg_catalog.btrim(tr.k)) <> ALL (c_database_owned_keys)
    AND pg_catalog.lower(pg_catalog.btrim(tr.k)) <> ALL (c_namespace_keys);

  -- Derived defaults are lowest priority, approved nested tracking is next,
  -- and explicitly supplied top-level tracking fields are authoritative.
  v_incoming_tr := pg_catalog.jsonb_strip_nulls(
    pg_catalog.jsonb_build_object(
      'utm_source', v_utm_source,
      'utm_medium', v_utm_medium,
      'utm_campaign', v_utm_campaign,
      'utm_term', v_utm_term,
      'utm_content', v_utm_content,
      'fbclid', v_fbclid,
      'gclid', v_gclid,
      'fbc', v_fbc,
      'fbp', v_fbp,
      'ttclid', v_ttclid,
      'msclkid', v_msclkid,
      'wbraid', v_wbraid,
      'gbraid', v_gbraid,
      'landing_page_url', v_landing_page_url,
      'first_page_path', v_first_page_path,
      'initial_referrer', v_initial_referrer
    )
  ) || v_incoming_tr || pg_catalog.jsonb_strip_nulls(
    pg_catalog.jsonb_build_object(
      'utm_source', NULLIF(pg_catalog.btrim(COALESCE(
        p_attribution ->> 'utm_source', p_lead ->> 'utm_source', ''
      )), ''),
      'utm_medium', NULLIF(pg_catalog.btrim(COALESCE(
        p_attribution ->> 'utm_medium', p_lead ->> 'utm_medium', ''
      )), ''),
      'utm_campaign', NULLIF(pg_catalog.btrim(COALESCE(
        p_attribution ->> 'utm_campaign', p_lead ->> 'utm_campaign', ''
      )), ''),
      'utm_term', v_utm_term,
      'utm_content', NULLIF(pg_catalog.btrim(COALESCE(
        p_attribution ->> 'utm_content', p_lead ->> 'utm_content', ''
      )), ''),
      'fbclid', v_fbclid,
      'gclid', v_gclid,
      'fbc', v_fbc,
      'fbp', v_fbp,
      'ttclid', v_ttclid,
      'msclkid', v_msclkid,
      'wbraid', v_wbraid,
      'gbraid', v_gbraid,
      'landing_page_url', v_landing_page_url,
      'first_page_path', v_first_page_path,
      'initial_referrer', v_initial_referrer
    )
  );

  SELECT COALESCE(pg_catalog.jsonb_object_agg(bp.k, bp.filtered ORDER BY bp.ns_ord), '{}'::jsonb)
  INTO v_incoming_byplat
  FROM (
    SELECT
      provider.k,
      ns_ord,
      CASE
        WHEN pg_catalog.jsonb_typeof(provider.v) = 'object' THEN COALESCE(
          (
            SELECT pg_catalog.jsonb_object_agg(item.k, item.v)
            FROM pg_catalog.jsonb_each(provider.v) AS item(k, v)
            WHERE pg_catalog.lower(pg_catalog.btrim(item.k)) <> ALL (c_control_keys)
              AND pg_catalog.lower(pg_catalog.btrim(item.k)) <> ALL (c_database_owned_keys)
              AND pg_catalog.lower(pg_catalog.btrim(item.k)) <> ALL (c_namespace_keys)
          ),
          '{}'::jsonb
        )
        ELSE provider.v
      END AS filtered
    FROM pg_catalog.jsonb_each(v_incoming_native) WITH ORDINALITY AS ns(k, v, ns_ord)
    CROSS JOIN LATERAL pg_catalog.jsonb_each(ns.v) AS provider(k, v)
    WHERE pg_catalog.lower(pg_catalog.btrim(ns.k)) = 'by_platform'
  ) AS bp;

  SELECT COALESCE(
    pg_catalog.array_agg(DISTINCT pg_catalog.lower(pg_catalog.btrim(src.k)))
      FILTER (
        WHERE pg_catalog.lower(pg_catalog.btrim(src.k)) = ANY (c_control_keys)
           OR pg_catalog.lower(pg_catalog.btrim(src.k)) = ANY (c_database_owned_keys)
      ),
    ARRAY[]::text[]
  )
  INTO v_ignored_keys
  FROM (
    SELECT k FROM pg_catalog.jsonb_object_keys(p_lead) AS x(k)
    UNION ALL
    SELECT k FROM pg_catalog.jsonb_object_keys(
      CASE WHEN pg_catalog.jsonb_typeof(p_lead -> 'attribution') = 'object'
        THEN p_lead -> 'attribution' ELSE '{}'::jsonb END
    ) AS x(k)
    UNION ALL
    SELECT k FROM pg_catalog.jsonb_object_keys(
      CASE WHEN pg_catalog.jsonb_typeof(p_lead -> 'query_params') = 'object'
        THEN p_lead -> 'query_params' ELSE '{}'::jsonb END
    ) AS x(k)
    UNION ALL
    SELECT k FROM pg_catalog.jsonb_object_keys(v_incoming_native) AS x(k)
    UNION ALL
    SELECT item.k
    FROM pg_catalog.jsonb_each(v_incoming_native) AS ns(k, v)
    CROSS JOIN LATERAL pg_catalog.jsonb_object_keys(ns.v) AS item(k)
    WHERE pg_catalog.lower(pg_catalog.btrim(ns.k)) = ANY (c_namespace_keys)
      AND pg_catalog.jsonb_typeof(ns.v) = 'object'
    UNION ALL
    SELECT item.k
    FROM pg_catalog.jsonb_each(v_incoming_native) AS ns(k, v)
    CROSS JOIN LATERAL pg_catalog.jsonb_each(ns.v) AS provider(k, v)
    CROSS JOIN LATERAL pg_catalog.jsonb_object_keys(
      CASE WHEN pg_catalog.jsonb_typeof(provider.v) = 'object'
        THEN provider.v ELSE '{}'::jsonb END
    ) AS item(k)
    WHERE pg_catalog.lower(pg_catalog.btrim(ns.k)) = 'by_platform'
  ) AS src;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'native_lead:platform:' || v_platform || ':' || v_platform_lead_id,
      0
    )
  );
  IF v_phone_dedup_eligible THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('native_lead:phone:' || v_phone, 0)
    );
  END IF;
  IF v_email_dedup_eligible THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('native_lead:email:' || v_email, 0)
    );
  END IF;

  IF v_platform = 'meta' THEN
    SELECT lad.id, lad.lead_id
    INTO v_meta_attr_id, v_meta_lead_id
    FROM public.lead_attribution_details AS lad
    WHERE lad.source_platform = 'meta'
      AND lad.platform_lead_id = v_platform_lead_id
    ORDER BY lad.created_at, lad.id
    LIMIT 1
    FOR UPDATE;

    SELECT lad.id, lad.lead_id
    INTO v_fb_attr_id, v_fb_lead_id
    FROM public.lead_attribution_details AS lad
    WHERE lad.source_platform = 'facebook'
      AND lad.platform_lead_id = v_platform_lead_id
    ORDER BY lad.created_at, lad.id
    LIMIT 1
    FOR UPDATE;

    IF v_meta_attr_id IS NOT NULL THEN
      v_provider_attr_id := v_meta_attr_id;
      v_provider_attr_lead_id := v_meta_lead_id;
      v_provider_attr_platform := 'meta';
      v_legacy_alias_collision := v_fb_attr_id IS NOT NULL;
    ELSIF v_fb_attr_id IS NOT NULL THEN
      v_provider_attr_id := v_fb_attr_id;
      v_provider_attr_lead_id := v_fb_lead_id;
      v_provider_attr_platform := 'facebook';
    END IF;
  ELSE
    SELECT lad.id, lad.lead_id, lad.source_platform
    INTO v_provider_attr_id, v_provider_attr_lead_id, v_provider_attr_platform
    FROM public.lead_attribution_details AS lad
    WHERE lad.source_platform = v_platform
      AND lad.platform_lead_id = v_platform_lead_id
    ORDER BY lad.created_at, lad.id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_phone_dedup_eligible THEN
    SELECT COALESCE(pg_catalog.array_agg(c.id ORDER BY c.id), ARRAY[]::uuid[])
    INTO v_phone_candidate_ids
    FROM (
      SELECT DISTINCT l.id
      FROM public.leads AS l
      WHERE pg_catalog.btrim(l.phone_e164) = v_phone
    ) AS c;
  END IF;
  IF v_email_dedup_eligible THEN
    SELECT COALESCE(pg_catalog.array_agg(c.id ORDER BY c.id), ARRAY[]::uuid[])
    INTO v_email_candidate_ids
    FROM (
      SELECT DISTINCT l.id
      FROM public.leads AS l
      WHERE pg_catalog.lower(pg_catalog.btrim(l.email)) = v_email
    ) AS c;
  END IF;

  v_phone_candidate_count := pg_catalog.cardinality(v_phone_candidate_ids);
  v_email_candidate_count := pg_catalog.cardinality(v_email_candidate_ids);
  SELECT COALESCE(pg_catalog.array_agg(c.id ORDER BY c.id), ARRAY[]::uuid[])
  INTO v_all_candidate_ids
  FROM (
    SELECT DISTINCT pg_catalog.unnest(
      v_phone_candidate_ids || v_email_candidate_ids
    ) AS id
  ) AS c;

  FOREACH v_uid IN ARRAY v_all_candidate_ids LOOP
    PERFORM 1
    FROM public.leads AS l
    WHERE l.id = v_uid
    FOR UPDATE;
  END LOOP;

  IF v_provider_attr_id IS NOT NULL THEN
    v_selected_lead_id := v_provider_attr_lead_id;
    v_resolution_status := 'provider_replay';
    v_duplicate := true;
    v_attribution_platform := v_provider_attr_platform;
    v_attribution_id := v_provider_attr_id;
    FOREACH v_uid IN ARRAY v_all_candidate_ids LOOP
      IF v_uid <> v_selected_lead_id THEN
        v_crosslink := true;
      END IF;
    END LOOP;
    v_review_required := v_crosslink OR v_legacy_alias_collision;
  ELSIF v_phone_candidate_count = 1
        AND v_email_candidate_count = 1
        AND v_phone_candidate_ids[1] = v_email_candidate_ids[1] THEN
    v_selected_lead_id := v_phone_candidate_ids[1];
    v_resolution_status := 'matched_both';
    v_duplicate := true;
  ELSIF v_phone_candidate_count = 1 THEN
    v_selected_lead_id := v_phone_candidate_ids[1];
    v_duplicate := true;
    IF v_email_candidate_count = 0
       OR (
         v_email_candidate_count = 1
         AND v_email_candidate_ids[1] = v_phone_candidate_ids[1]
       ) THEN
      v_resolution_status := 'matched_phone';
    ELSE
      v_resolution_status := 'phone_priority_soft_conflict';
      v_review_required := true;
    END IF;
  ELSIF v_phone_candidate_count = 0 AND v_email_candidate_count = 1 THEN
    v_selected_lead_id := v_email_candidate_ids[1];
    v_resolution_status := 'matched_email';
    v_duplicate := true;
  ELSIF v_phone_candidate_count > 1 AND v_email_candidate_count = 1 THEN
    v_selected_lead_id := v_email_candidate_ids[1];
    v_resolution_status := 'email_priority_soft_conflict';
    v_duplicate := true;
    v_review_required := true;
  ELSE
    IF v_session_id IS NULL THEN
      RAISE EXCEPTION 'missing_session_id' USING ERRCODE = '22023';
    END IF;
    IF NOT v_phone_dedup_eligible AND NOT v_email_dedup_eligible THEN
      v_resolution_status := 'dedup_suppressed_created';
      v_review_required := true;
    ELSIF v_phone_candidate_count > 1 OR v_email_candidate_count > 1 THEN
      v_resolution_status := 'ambiguous_created';
      v_review_required := true;
    ELSE
      v_resolution_status := 'created';
    END IF;

    INSERT INTO public.leads AS inserted_lead (
      session_id,
      client_slug,
      status,
      phone_verified,
      otp_failure_count,
      first_name,
      last_name,
      email,
      phone_e164,
      zip,
      county,
      source,
      lead_source,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      fbclid,
      gclid,
      fbc,
      fbp,
      ttclid,
      msclkid,
      wbraid,
      gbraid,
      landing_page_url,
      first_page_path,
      initial_referrer,
      attribution,
      query_params,
      qualification_answers_json
    )
    VALUES (
      v_session_id,
      'direct',
      'new',
      false,
      0,
      v_first_name,
      v_last_name,
      v_email,
      v_phone,
      v_zip,
      v_county,
      v_platform || '_native_lead',
      v_platform,
      v_utm_source,
      v_utm_medium,
      v_utm_campaign,
      v_utm_term,
      v_utm_content,
      v_fbclid,
      v_gclid,
      v_fbc,
      v_fbp,
      v_ttclid,
      v_msclkid,
      v_wbraid,
      v_gbraid,
      v_landing_page_url,
      v_first_page_path,
      v_initial_referrer,
      v_incoming_attr,
      v_incoming_qp,
      '{}'::jsonb
    )
    RETURNING inserted_lead.id INTO v_selected_lead_id;

    v_created_this_tx := true;
    v_duplicate := false;
    v_attribution_platform := v_platform;
  END IF;

  IF v_provider_attr_id IS NULL THEN
    v_attribution_platform := v_platform;
  END IF;

  SELECT l.*
  INTO v_existing_lead
  FROM public.leads AS l
  WHERE l.id = v_selected_lead_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'selected_lead_missing' USING ERRCODE = '22023';
  END IF;

  v_phone_fill_ok := v_phone_dedup_eligible
    AND (
      v_phone_candidate_count = 0
      OR (
        v_phone_candidate_count = 1
        AND v_phone_candidate_ids[1] = v_selected_lead_id
      )
    );
  v_email_fill_ok := v_email_dedup_eligible
    AND (
      v_email_candidate_count = 0
      OR (
        v_email_candidate_count = 1
        AND v_email_candidate_ids[1] = v_selected_lead_id
      )
    );

  SELECT COALESCE(pg_catalog.jsonb_object_agg(e.k, e.v), '{}'::jsonb)
  INTO v_attr_fill
  FROM pg_catalog.jsonb_each(v_incoming_attr) AS e(k, v)
  WHERE NOT (COALESCE(v_existing_lead.attribution, '{}'::jsonb) ? e.k)
     OR COALESCE(v_existing_lead.attribution, '{}'::jsonb) -> e.k = 'null'::jsonb
     OR (
       pg_catalog.jsonb_typeof(COALESCE(v_existing_lead.attribution, '{}'::jsonb) -> e.k) = 'string'
       AND pg_catalog.btrim(COALESCE(v_existing_lead.attribution, '{}'::jsonb) ->> e.k) = ''
     );

  SELECT COALESCE(pg_catalog.jsonb_object_agg(e.k, e.v), '{}'::jsonb)
  INTO v_qp_fill
  FROM pg_catalog.jsonb_each(v_incoming_qp) AS e(k, v)
  WHERE NOT (COALESCE(v_existing_lead.query_params, '{}'::jsonb) ? e.k)
     OR COALESCE(v_existing_lead.query_params, '{}'::jsonb) -> e.k = 'null'::jsonb
     OR (
       pg_catalog.jsonb_typeof(COALESCE(v_existing_lead.query_params, '{}'::jsonb) -> e.k) = 'string'
       AND pg_catalog.btrim(COALESCE(v_existing_lead.query_params, '{}'::jsonb) ->> e.k) = ''
     );

  IF NOT v_created_this_tx THEN
    UPDATE public.leads AS l
    SET
      first_name = CASE
        WHEN v_resolution_status <> 'provider_replay'
          AND NULLIF(pg_catalog.btrim(l.first_name), '') IS NULL
          THEN v_first_name
        ELSE l.first_name
      END,
      last_name = CASE
        WHEN v_resolution_status <> 'provider_replay'
          AND NULLIF(pg_catalog.btrim(l.last_name), '') IS NULL
          THEN v_last_name
        ELSE l.last_name
      END,
      zip = CASE
        WHEN v_resolution_status <> 'provider_replay'
          AND NULLIF(pg_catalog.btrim(l.zip), '') IS NULL
          THEN v_zip
        ELSE l.zip
      END,
      county = CASE
        WHEN v_resolution_status <> 'provider_replay'
          AND NULLIF(pg_catalog.btrim(l.county), '') IS NULL
          THEN v_county
        ELSE l.county
      END,
      phone_e164 = CASE
        WHEN v_resolution_status <> 'provider_replay'
          AND v_phone_fill_ok
          AND NULLIF(pg_catalog.btrim(l.phone_e164), '') IS NULL
          THEN v_phone
        ELSE l.phone_e164
      END,
      email = CASE
        WHEN v_resolution_status <> 'provider_replay'
          AND v_email_fill_ok
          AND NULLIF(pg_catalog.btrim(l.email), '') IS NULL
          THEN v_email
        ELSE l.email
      END,
      utm_source = CASE WHEN NULLIF(pg_catalog.btrim(l.utm_source), '') IS NULL THEN v_utm_source ELSE l.utm_source END,
      utm_medium = CASE WHEN NULLIF(pg_catalog.btrim(l.utm_medium), '') IS NULL THEN v_utm_medium ELSE l.utm_medium END,
      utm_campaign = CASE WHEN NULLIF(pg_catalog.btrim(l.utm_campaign), '') IS NULL THEN v_utm_campaign ELSE l.utm_campaign END,
      utm_term = CASE WHEN NULLIF(pg_catalog.btrim(l.utm_term), '') IS NULL THEN v_utm_term ELSE l.utm_term END,
      utm_content = CASE WHEN NULLIF(pg_catalog.btrim(l.utm_content), '') IS NULL THEN v_utm_content ELSE l.utm_content END,
      fbclid = CASE WHEN NULLIF(pg_catalog.btrim(l.fbclid), '') IS NULL THEN v_fbclid ELSE l.fbclid END,
      gclid = CASE WHEN NULLIF(pg_catalog.btrim(l.gclid), '') IS NULL THEN v_gclid ELSE l.gclid END,
      fbc = CASE WHEN NULLIF(pg_catalog.btrim(l.fbc), '') IS NULL THEN v_fbc ELSE l.fbc END,
      fbp = CASE WHEN NULLIF(pg_catalog.btrim(l.fbp), '') IS NULL THEN v_fbp ELSE l.fbp END,
      ttclid = CASE WHEN NULLIF(pg_catalog.btrim(l.ttclid), '') IS NULL THEN v_ttclid ELSE l.ttclid END,
      msclkid = CASE WHEN NULLIF(pg_catalog.btrim(l.msclkid), '') IS NULL THEN v_msclkid ELSE l.msclkid END,
      wbraid = CASE WHEN NULLIF(pg_catalog.btrim(l.wbraid), '') IS NULL THEN v_wbraid ELSE l.wbraid END,
      gbraid = CASE WHEN NULLIF(pg_catalog.btrim(l.gbraid), '') IS NULL THEN v_gbraid ELSE l.gbraid END,
      landing_page_url = CASE WHEN NULLIF(pg_catalog.btrim(l.landing_page_url), '') IS NULL THEN v_landing_page_url ELSE l.landing_page_url END,
      first_page_path = CASE WHEN NULLIF(pg_catalog.btrim(l.first_page_path), '') IS NULL THEN v_first_page_path ELSE l.first_page_path END,
      initial_referrer = CASE WHEN NULLIF(pg_catalog.btrim(l.initial_referrer), '') IS NULL THEN v_initial_referrer ELSE l.initial_referrer END,
      attribution = COALESCE(l.attribution, '{}'::jsonb) || v_attr_fill,
      query_params = COALESCE(l.query_params, '{}'::jsonb) || v_qp_fill
    WHERE l.id = v_selected_lead_id;
  END IF;

  v_existing_qual := COALESCE(v_existing_lead.qualification_answers_json, '{}'::jsonb);
  IF pg_catalog.jsonb_typeof(v_existing_qual) <> 'object' THEN
    v_existing_qual := '{}'::jsonb;
  END IF;
  v_existing_native := COALESCE(v_existing_qual -> 'native_lead', '{}'::jsonb);
  IF pg_catalog.jsonb_typeof(v_existing_native) <> 'object' THEN
    v_existing_native := '{}'::jsonb;
  END IF;
  v_merged_native := v_existing_native;

  FOR v_key, v_val IN
    SELECT e.k, e.v
    FROM pg_catalog.jsonb_each(v_incoming_native) AS e(k, v)
    WHERE pg_catalog.lower(pg_catalog.btrim(e.k)) <> ALL (c_control_keys)
      AND pg_catalog.lower(pg_catalog.btrim(e.k)) <> ALL (c_database_owned_keys)
      AND pg_catalog.lower(pg_catalog.btrim(e.k)) <> ALL (c_namespace_keys)
  LOOP
    v_merged_native := v_merged_native || pg_catalog.jsonb_build_object(v_key, v_val);
  END LOOP;

  v_ns_existing := CASE
    WHEN pg_catalog.jsonb_typeof(v_existing_native -> 'custom_answers') = 'object'
      THEN v_existing_native -> 'custom_answers'
    ELSE '{}'::jsonb
  END;
  v_merged_native := v_merged_native || pg_catalog.jsonb_build_object(
    'custom_answers',
    v_ns_existing || v_incoming_ca
  );

  v_ns_existing := CASE
    WHEN pg_catalog.jsonb_typeof(v_existing_native -> 'tracking') = 'object'
      THEN v_existing_native -> 'tracking'
    ELSE '{}'::jsonb
  END;
  SELECT COALESCE(pg_catalog.jsonb_object_agg(e.k, e.v), '{}'::jsonb)
  INTO v_ns_fill
  FROM pg_catalog.jsonb_each(v_incoming_tr) AS e(k, v)
  WHERE NOT (v_ns_existing ? e.k)
     OR v_ns_existing -> e.k = 'null'::jsonb
     OR (
       pg_catalog.jsonb_typeof(v_ns_existing -> e.k) = 'string'
       AND pg_catalog.btrim(v_ns_existing ->> e.k) = ''
     );
  v_merged_native := v_merged_native || pg_catalog.jsonb_build_object(
    'tracking',
    v_ns_existing || v_ns_fill
  );

  v_ns_existing := CASE
    WHEN pg_catalog.jsonb_typeof(v_existing_native -> 'by_platform') = 'object'
      THEN v_existing_native -> 'by_platform'
    ELSE '{}'::jsonb
  END;
  v_ns_fill := v_ns_existing;
  FOR v_key, v_val IN
    SELECT e.k, e.v
    FROM pg_catalog.jsonb_each(v_incoming_byplat) AS e(k, v)
  LOOP
    IF pg_catalog.jsonb_typeof(v_ns_fill -> v_key) = 'object'
       AND pg_catalog.jsonb_typeof(v_val) = 'object' THEN
      v_ns_fill := v_ns_fill || pg_catalog.jsonb_build_object(
        v_key,
        (v_ns_fill -> v_key) || v_val
      );
    ELSE
      v_ns_fill := v_ns_fill || pg_catalog.jsonb_build_object(v_key, v_val);
    END IF;
  END LOOP;
  v_merged_native := v_merged_native || pg_catalog.jsonb_build_object(
    'by_platform',
    v_ns_fill
  );

  IF pg_catalog.cardinality(v_ignored_keys) > 0 THEN
    v_merged_native := v_merged_native || pg_catalog.jsonb_build_object(
      'ignored_control_plane_keys',
      pg_catalog.to_jsonb(v_ignored_keys)
    );
  END IF;

  IF v_phone_suppressed_reason IS NOT NULL OR v_email_suppressed_reason IS NOT NULL THEN
    v_merged_native := v_merged_native || pg_catalog.jsonb_build_object(
      'dedup_suppression',
      pg_catalog.jsonb_build_object(
        'observed_at', v_now,
        'phone', v_phone,
        'email', v_email,
        'phone_reason', v_phone_suppressed_reason,
        'email_reason', v_email_suppressed_reason
      )
    );
    v_review_required := true;
  END IF;

  IF v_resolution_status IN (
      'phone_priority_soft_conflict',
      'email_priority_soft_conflict',
      'ambiguous_created'
    )
    OR v_crosslink
    OR v_legacy_alias_collision THEN
    v_merged_native := v_merged_native || pg_catalog.jsonb_build_object(
      'identity_conflict',
      pg_catalog.jsonb_build_object(
        'observed_at', v_now,
        'source_platform', v_platform,
        'platform_lead_id', v_platform_lead_id,
        'resolution_status', v_resolution_status,
        'legacy_alias_collision', v_legacy_alias_collision,
        'meta_attribution_id', v_meta_attr_id,
        'meta_lead_id', v_meta_lead_id,
        'facebook_attribution_id', v_fb_attr_id,
        'facebook_lead_id', v_fb_lead_id,
        'phone', v_phone,
        'email', v_email,
        'phone_candidate_lead_ids', pg_catalog.to_jsonb(v_phone_candidate_ids),
        'email_candidate_lead_ids', pg_catalog.to_jsonb(v_email_candidate_ids),
        'selected_lead_id', v_selected_lead_id
      )
    );
  END IF;

  v_observations := COALESCE(
    v_merged_native -> 'identity_resolution',
    '[]'::jsonb
  );
  IF pg_catalog.jsonb_typeof(v_observations) <> 'array' THEN
    v_observations := '[]'::jsonb;
  END IF;
  v_new_observation := pg_catalog.jsonb_build_object(
    'observed_at', v_now,
    'source_platform', v_platform,
    'platform_lead_id', v_platform_lead_id,
    'resolution_status', v_resolution_status,
    'review_required', v_review_required,
    'phone', v_phone,
    'email', v_email,
    'phone_dedup_eligible', v_phone_dedup_eligible,
    'email_dedup_eligible', v_email_dedup_eligible,
    'phone_candidate_lead_ids', pg_catalog.to_jsonb(v_phone_candidate_ids),
    'email_candidate_lead_ids', pg_catalog.to_jsonb(v_email_candidate_ids),
    'selected_lead_id', v_selected_lead_id
  );
  v_observations := v_observations || pg_catalog.jsonb_build_array(v_new_observation);
  v_obs_count := pg_catalog.jsonb_array_length(v_observations);
  IF v_obs_count > 10 THEN
    SELECT COALESCE(pg_catalog.jsonb_agg(t.element ORDER BY t.ordinality), '[]'::jsonb)
    INTO v_observations
    FROM (
      SELECT e.element, e.ordinality
      FROM pg_catalog.jsonb_array_elements(v_observations)
        WITH ORDINALITY AS e(element, ordinality)
      WHERE e.ordinality > (v_obs_count - 10)
    ) AS t;
  END IF;
  v_merged_native := (v_merged_native - 'identity_resolution')
    || pg_catalog.jsonb_build_object('identity_resolution', v_observations);

  UPDATE public.leads AS l
  SET qualification_answers_json = pg_catalog.jsonb_set(
    v_existing_qual,
    '{native_lead}',
    v_merged_native,
    true
  )
  WHERE l.id = v_selected_lead_id;

  IF v_resolution_status = 'provider_replay' THEN
    UPDATE public.lead_attribution_details AS lad
    SET
      source_channel = CASE WHEN NULLIF(pg_catalog.btrim(lad.source_channel), '') IS NULL THEN v_source_channel ELSE lad.source_channel END,
      source_detail = CASE WHEN NULLIF(pg_catalog.btrim(lad.source_detail), '') IS NULL THEN v_source_detail ELSE lad.source_detail END,
      campaign_id = CASE WHEN NULLIF(pg_catalog.btrim(lad.campaign_id), '') IS NULL THEN v_campaign_id ELSE lad.campaign_id END,
      campaign_name = CASE WHEN NULLIF(pg_catalog.btrim(lad.campaign_name), '') IS NULL THEN v_campaign_name ELSE lad.campaign_name END,
      adset_id = CASE WHEN NULLIF(pg_catalog.btrim(lad.adset_id), '') IS NULL THEN v_adset_id ELSE lad.adset_id END,
      adset_name = CASE WHEN NULLIF(pg_catalog.btrim(lad.adset_name), '') IS NULL THEN v_adset_name ELSE lad.adset_name END,
      ad_id = CASE WHEN NULLIF(pg_catalog.btrim(lad.ad_id), '') IS NULL THEN v_ad_id ELSE lad.ad_id END,
      ad_name = CASE WHEN NULLIF(pg_catalog.btrim(lad.ad_name), '') IS NULL THEN v_ad_name ELSE lad.ad_name END,
      form_id = CASE WHEN NULLIF(pg_catalog.btrim(lad.form_id), '') IS NULL THEN v_form_id ELSE lad.form_id END,
      platform_created_time = COALESCE(lad.platform_created_time, v_platform_created_time),
      fbclid = CASE WHEN NULLIF(pg_catalog.btrim(lad.fbclid), '') IS NULL THEN v_fbclid ELSE lad.fbclid END,
      gclid = CASE WHEN NULLIF(pg_catalog.btrim(lad.gclid), '') IS NULL THEN v_gclid ELSE lad.gclid END,
      fbc = CASE WHEN NULLIF(pg_catalog.btrim(lad.fbc), '') IS NULL THEN v_fbc ELSE lad.fbc END,
      fbp = CASE WHEN NULLIF(pg_catalog.btrim(lad.fbp), '') IS NULL THEN v_fbp ELSE lad.fbp END,
      utm_source = CASE WHEN NULLIF(pg_catalog.btrim(lad.utm_source), '') IS NULL THEN v_utm_source ELSE lad.utm_source END,
      utm_medium = CASE WHEN NULLIF(pg_catalog.btrim(lad.utm_medium), '') IS NULL THEN v_utm_medium ELSE lad.utm_medium END,
      utm_campaign = CASE WHEN NULLIF(pg_catalog.btrim(lad.utm_campaign), '') IS NULL THEN v_utm_campaign ELSE lad.utm_campaign END,
      utm_term = CASE WHEN NULLIF(pg_catalog.btrim(lad.utm_term), '') IS NULL THEN v_utm_term ELSE lad.utm_term END,
      utm_content = CASE WHEN NULLIF(pg_catalog.btrim(lad.utm_content), '') IS NULL THEN v_utm_content ELSE lad.utm_content END,
      landing_page_url = CASE WHEN NULLIF(pg_catalog.btrim(lad.landing_page_url), '') IS NULL THEN v_landing_page_url ELSE lad.landing_page_url END,
      first_page_path = CASE WHEN NULLIF(pg_catalog.btrim(lad.first_page_path), '') IS NULL THEN v_first_page_path ELSE lad.first_page_path END,
      initial_referrer = CASE WHEN NULLIF(pg_catalog.btrim(lad.initial_referrer), '') IS NULL THEN v_initial_referrer ELSE lad.initial_referrer END,
      import_source = c_import_source,
      imported_at = v_imported_at,
      raw_payload = v_raw_payload
    WHERE lad.id = v_attribution_id
    RETURNING lad.id, lad.lead_id
    INTO v_attribution_id, v_attribution_lead_id;
  ELSE
    INSERT INTO public.lead_attribution_details AS inserted_attribution (
      lead_id,
      source_platform,
      source_channel,
      source_detail,
      campaign_id,
      campaign_name,
      adset_id,
      adset_name,
      ad_id,
      ad_name,
      form_id,
      platform_lead_id,
      platform_created_time,
      fbclid,
      gclid,
      fbc,
      fbp,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      landing_page_url,
      first_page_path,
      initial_referrer,
      import_source,
      imported_at,
      raw_payload
    )
    VALUES (
      v_selected_lead_id,
      v_attribution_platform,
      v_source_channel,
      v_source_detail,
      v_campaign_id,
      v_campaign_name,
      v_adset_id,
      v_adset_name,
      v_ad_id,
      v_ad_name,
      v_form_id,
      v_platform_lead_id,
      v_platform_created_time,
      v_fbclid,
      v_gclid,
      v_fbc,
      v_fbp,
      v_utm_source,
      v_utm_medium,
      v_utm_campaign,
      v_utm_term,
      v_utm_content,
      v_landing_page_url,
      v_first_page_path,
      v_initial_referrer,
      c_import_source,
      v_imported_at,
      v_raw_payload
    )
    ON CONFLICT (source_platform, platform_lead_id)
      WHERE platform_lead_id IS NOT NULL
    DO NOTHING
    RETURNING inserted_attribution.id, inserted_attribution.lead_id
    INTO v_attribution_id, v_attribution_lead_id;

    IF v_attribution_id IS NULL THEN
      RAISE EXCEPTION 'attribution_race_retry' USING ERRCODE = '40001';
    END IF;
  END IF;

  IF v_attribution_lead_id IS DISTINCT FROM v_selected_lead_id THEN
    RAISE EXCEPTION 'attribution_lead_mismatch' USING ERRCODE = '40001';
  END IF;

  lead_id := v_selected_lead_id;
  attribution_id := v_attribution_id;
  duplicate := v_duplicate;
  resolution_status := v_resolution_status;
  review_required := v_review_required;
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.upsert_native_lead_with_attribution(jsonb, jsonb) IS
  'Atomic service-role-only native-lead capture. Resolves global homeowner identity, preserves existing client_slug/OTP/report/routing state, and raises SQLSTATE 40001 on unexpected attribution races.';

REVOKE ALL
  ON FUNCTION public.upsert_native_lead_with_attribution(jsonb, jsonb)
  FROM PUBLIC;
REVOKE ALL
  ON FUNCTION public.upsert_native_lead_with_attribution(jsonb, jsonb)
  FROM anon;
REVOKE ALL
  ON FUNCTION public.upsert_native_lead_with_attribution(jsonb, jsonb)
  FROM authenticated;
GRANT EXECUTE
  ON FUNCTION public.upsert_native_lead_with_attribution(jsonb, jsonb)
  TO service_role;

-- Fail the migration before COMMIT unless the exact RPC, ACL, uniqueness guard,
-- and attribution ownership FK match the reviewed contract.
DO $assert$
DECLARE
  v_oid oid;
  v_owner oid;
  v_result text;
  v_arguments text;
  v_security_definer boolean;
  v_search_path_empty boolean;
BEGIN
  v_oid := pg_catalog.to_regprocedure(
    'public.upsert_native_lead_with_attribution(jsonb,jsonb)'
  );
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'INSTALL ASSERT: exact native-lead RPC is missing';
  END IF;

  SELECT
    p.proowner,
    pg_catalog.pg_get_function_result(p.oid),
    pg_catalog.pg_get_function_identity_arguments(p.oid),
    p.prosecdef,
    EXISTS (
      SELECT 1
      FROM pg_catalog.unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg(value)
      WHERE pg_catalog.split_part(cfg.value, '=', 1) = 'search_path'
        AND pg_catalog.btrim(pg_catalog.split_part(cfg.value, '=', 2), '"') = ''
    )
  INTO
    v_owner,
    v_result,
    v_arguments,
    v_security_definer,
    v_search_path_empty
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = v_oid;

  IF v_arguments IS DISTINCT FROM 'p_lead jsonb, p_attribution jsonb' THEN
    RAISE EXCEPTION 'INSTALL ASSERT: exact argument signature mismatch: %', v_arguments;
  END IF;
  IF v_result IS DISTINCT FROM
    'TABLE(lead_id uuid, attribution_id uuid, duplicate boolean, resolution_status text, review_required boolean)' THEN
    RAISE EXCEPTION 'INSTALL ASSERT: return shape mismatch: %', v_result;
  END IF;
  IF NOT v_security_definer THEN
    RAISE EXCEPTION 'INSTALL ASSERT: RPC is not SECURITY DEFINER';
  END IF;
  IF NOT v_search_path_empty THEN
    RAISE EXCEPTION 'INSTALL ASSERT: search_path is not empty';
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
  ) THEN
    RAISE EXCEPTION 'INSTALL ASSERT: unexpected direct EXECUTE ACL grantee';
  END IF;

  IF NOT EXISTS (
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
    RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks direct EXECUTE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index AS i
    JOIN pg_catalog.pg_class AS table_class
      ON table_class.oid = i.indrelid
    JOIN pg_catalog.pg_namespace AS table_namespace
      ON table_namespace.oid = table_class.relnamespace
    JOIN pg_catalog.pg_attribute AS first_key
      ON first_key.attrelid = i.indrelid
      AND first_key.attnum = i.indkey[0]
    JOIN pg_catalog.pg_attribute AS second_key
      ON second_key.attrelid = i.indrelid
      AND second_key.attnum = i.indkey[1]
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
      ) IN (
        'PLATFORM_LEAD_IDISNOTNULL',
        '(PLATFORM_LEAD_IDISNOTNULL)'
      )
  ) THEN
    RAISE EXCEPTION 'INSTALL ASSERT: exact valid/ready partial unique index is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS c
    JOIN pg_catalog.pg_class AS source_table
      ON source_table.oid = c.conrelid
    JOIN pg_catalog.pg_namespace AS source_namespace
      ON source_namespace.oid = source_table.relnamespace
    JOIN pg_catalog.pg_class AS target_table
      ON target_table.oid = c.confrelid
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
    RAISE EXCEPTION 'INSTALL ASSERT: exact validated attribution-to-lead FK is missing';
  END IF;
END
$assert$;

COMMIT;
