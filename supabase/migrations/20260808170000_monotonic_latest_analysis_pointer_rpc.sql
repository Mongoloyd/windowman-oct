BEGIN;

-- Service-role-only monotonic pointer for public.leads.latest_analysis_id.
-- Advances only to same-lead completed analyses; never regresses on stale calls.
CREATE OR REPLACE FUNCTION public.set_latest_complete_analysis_pointer(
  p_lead_id uuid,
  p_analysis_id uuid
)
RETURNS TABLE (
  updated boolean,
  outcome text,
  latest_analysis_id uuid
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_candidate public.analyses%ROWTYPE;
  v_current public.analyses%ROWTYPE;
  v_current_valid boolean := false;
  v_result_analysis_id uuid;
  v_outcome text;
  v_did_update boolean := false;
BEGIN
  SELECT *
    INTO v_lead
  FROM public.leads AS l
  WHERE l.id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_candidate
  FROM public.analyses AS a
  WHERE a.id = p_analysis_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'analysis_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_candidate.lead_id IS DISTINCT FROM p_lead_id THEN
    RAISE EXCEPTION 'analysis_lead_mismatch' USING ERRCODE = '22023';
  END IF;

  IF v_candidate.analysis_status IS DISTINCT FROM 'complete' THEN
    RAISE EXCEPTION 'analysis_not_complete' USING ERRCODE = '22023';
  END IF;

  IF v_lead.latest_analysis_id IS NOT NULL THEN
    SELECT *
      INTO v_current
    FROM public.analyses AS a
    WHERE a.id = v_lead.latest_analysis_id;

    IF FOUND
       AND v_current.lead_id = p_lead_id
       AND v_current.analysis_status = 'complete' THEN
      v_current_valid := true;
    END IF;
  END IF;

  IF NOT v_current_valid THEN
    UPDATE public.leads AS l
    SET latest_analysis_id = p_analysis_id
    WHERE l.id = p_lead_id;

    v_did_update := true;
    v_result_analysis_id := p_analysis_id;
    IF v_lead.latest_analysis_id IS NULL THEN
      v_outcome := 'updated';
    ELSE
      v_outcome := 'repaired_invalid_current';
    END IF;
  ELSIF v_lead.latest_analysis_id = p_analysis_id THEN
    v_did_update := false;
    v_result_analysis_id := p_analysis_id;
    v_outcome := 'already_current';
  ELSIF ROW(v_candidate.created_at, v_candidate.id)
        > ROW(v_current.created_at, v_current.id) THEN
    UPDATE public.leads AS l
    SET latest_analysis_id = p_analysis_id
    WHERE l.id = p_lead_id;

    v_did_update := true;
    v_result_analysis_id := p_analysis_id;
    v_outcome := 'updated';
  ELSE
    v_did_update := false;
    v_result_analysis_id := v_lead.latest_analysis_id;
    v_outcome := 'kept_newer';
  END IF;

  updated := v_did_update;
  outcome := v_outcome;
  latest_analysis_id := v_result_analysis_id;
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.set_latest_complete_analysis_pointer(uuid, uuid) IS
  'Service-role-only monotonic advance of leads.latest_analysis_id to a same-lead completed analysis. Never regresses on older or invalid candidates.';

REVOKE ALL
  ON FUNCTION public.set_latest_complete_analysis_pointer(uuid, uuid)
  FROM PUBLIC;
REVOKE ALL
  ON FUNCTION public.set_latest_complete_analysis_pointer(uuid, uuid)
  FROM anon;
REVOKE ALL
  ON FUNCTION public.set_latest_complete_analysis_pointer(uuid, uuid)
  FROM authenticated;
GRANT EXECUTE
  ON FUNCTION public.set_latest_complete_analysis_pointer(uuid, uuid)
  TO service_role;

-- SECURITY INVOKER: service_role must hold row privileges used inside the function.
GRANT SELECT, UPDATE ON TABLE public.leads TO service_role;
GRANT SELECT, UPDATE ON TABLE public.analyses TO service_role;

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
    'public.set_latest_complete_analysis_pointer(uuid,uuid)'
  );
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'INSTALL ASSERT: monotonic pointer RPC is missing';
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

  IF v_arguments IS DISTINCT FROM 'p_lead_id uuid, p_analysis_id uuid' THEN
    RAISE EXCEPTION 'INSTALL ASSERT: argument signature mismatch: %', v_arguments;
  END IF;
  IF v_result IS DISTINCT FROM
    'TABLE(updated boolean, outcome text, latest_analysis_id uuid)' THEN
    RAISE EXCEPTION 'INSTALL ASSERT: return shape mismatch: %', v_result;
  END IF;
  IF v_security_definer THEN
    RAISE EXCEPTION 'INSTALL ASSERT: RPC must be SECURITY INVOKER';
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

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.leads', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.leads', 'UPDATE') THEN
    RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks required public.leads privileges';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.analyses', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('service_role', 'public.analyses', 'UPDATE') THEN
    RAISE EXCEPTION 'INSTALL ASSERT: service_role lacks required public.analyses privileges';
  END IF;
END;
$assert$;

COMMIT;
