CREATE OR REPLACE FUNCTION public.admin_route_lead_assignment(
  p_action text,
  p_assignment_id uuid DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_scan_session_id uuid DEFAULT NULL,
  p_analysis_id uuid DEFAULT NULL,
  p_syndicate_id uuid DEFAULT NULL,
  p_client_slug text DEFAULT NULL,
  p_contractor_account_id uuid DEFAULT NULL,
  p_reason_code text DEFAULT NULL,
  p_operator_note text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_client_slug text := nullif(btrim(coalesce(p_client_slug, '')), '');
  v_reason_code text := nullif(btrim(coalesce(p_reason_code, '')), '');
  v_note text := nullif(btrim(coalesce(p_operator_note, '')), '');
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_now timestamptz := now();
  v_operator_id uuid := auth.uid();
  v_prior public.lead_assignments%rowtype;
  v_new public.lead_assignments%rowtype;
  v_event_id uuid;
  v_identity_count integer;
BEGIN
  IF NOT (public.is_internal_operator() OR current_user = 'service_role') THEN
    RAISE EXCEPTION 'forbidden: internal operator access required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_action NOT IN ('route_lead','reassign_lead','recycle_lead','manual_review','operator_note') THEN
    RAISE EXCEPTION 'invalid_action: %', p_action USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_reason_code IS NULL THEN
    RAISE EXCEPTION 'reason_code_required' USING ERRCODE = 'not_null_violation';
  END IF;

  SELECT
    (CASE WHEN p_lead_id IS NULL THEN 0 ELSE 1 END) +
    (CASE WHEN p_scan_session_id IS NULL THEN 0 ELSE 1 END) +
    (CASE WHEN p_analysis_id IS NULL THEN 0 ELSE 1 END)
  INTO v_identity_count;

  IF p_assignment_id IS NULL AND v_identity_count = 0 THEN
    RAISE EXCEPTION 'lead_identity_required' USING ERRCODE = 'not_null_violation';
  END IF;

  IF p_lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leads WHERE id = p_lead_id) THEN
    RAISE EXCEPTION 'lead_not_found' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF p_scan_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.scan_sessions WHERE id = p_scan_session_id) THEN
    RAISE EXCEPTION 'scan_session_not_found' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF p_analysis_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.analyses WHERE id = p_analysis_id) THEN
    RAISE EXCEPTION 'analysis_not_found' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_action IN ('route_lead','reassign_lead') THEN
    IF v_client_slug IS NULL THEN
      RAISE EXCEPTION 'client_slug_required' USING ERRCODE = 'not_null_violation';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE slug = v_client_slug AND is_active = true) THEN
      RAISE EXCEPTION 'client_slug_not_active: %', v_client_slug USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF p_syndicate_id IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.syndicates WHERE id = p_syndicate_id AND is_active = true) THEN
        RAISE EXCEPTION 'syndicate_not_active' USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.syndicate_clients sc
        WHERE sc.syndicate_id = p_syndicate_id
          AND sc.client_slug = v_client_slug
          AND sc.is_active = true
      ) THEN
        RAISE EXCEPTION 'client_not_active_in_syndicate' USING ERRCODE = 'foreign_key_violation';
      END IF;
    END IF;

    IF p_contractor_account_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.contractor_accounts ca
        WHERE ca.id = p_contractor_account_id
          AND ca.client_slug = v_client_slug
          AND ca.is_active = true
      ) THEN
        RAISE EXCEPTION 'contractor_account_not_active_for_client' USING ERRCODE = 'foreign_key_violation';
      END IF;
    END IF;
  END IF;

  IF v_action = 'route_lead' THEN
    IF EXISTS (
      SELECT 1 FROM public.lead_assignments la
      WHERE la.is_current = true
        AND (
          (p_lead_id IS NOT NULL AND la.lead_id = p_lead_id)
          OR (p_scan_session_id IS NOT NULL AND la.scan_session_id = p_scan_session_id)
          OR (p_analysis_id IS NOT NULL AND la.analysis_id = p_analysis_id)
        )
    ) THEN
      RAISE EXCEPTION 'current_assignment_exists: use reassign_lead' USING ERRCODE = 'unique_violation';
    END IF;

    INSERT INTO public.lead_assignments (
      lead_id, scan_session_id, analysis_id, syndicate_id, client_slug,
      contractor_account_id, status, is_current, assigned_at, reason_code,
      assigned_by, metadata
    ) VALUES (
      p_lead_id, p_scan_session_id, p_analysis_id, p_syndicate_id, v_client_slug,
      p_contractor_account_id, 'assigned', true, v_now, v_reason_code,
      v_operator_id, v_metadata
    ) RETURNING * INTO v_new;

    INSERT INTO public.lead_routing_events (
      assignment_id, lead_id, scan_session_id, analysis_id, event_type,
      to_client_slug, to_contractor_account_id, operator_id, reason_code, note, metadata
    ) VALUES (
      v_new.id, v_new.lead_id, v_new.scan_session_id, v_new.analysis_id, 'assigned',
      v_new.client_slug, v_new.contractor_account_id, v_operator_id, v_reason_code, v_note,
      jsonb_build_object('action', v_action, 'external_dispatch', false) || v_metadata
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object('success', true, 'action', v_action, 'assignment_id', v_new.id, 'event_id', v_event_id, 'status', v_new.status, 'is_current', v_new.is_current);
  END IF;

  IF v_action = 'reassign_lead' THEN
    SELECT * INTO v_prior
    FROM public.lead_assignments la
    WHERE la.is_current = true
      AND (
        (p_assignment_id IS NOT NULL AND la.id = p_assignment_id)
        OR (p_lead_id IS NOT NULL AND la.lead_id = p_lead_id)
        OR (p_scan_session_id IS NOT NULL AND la.scan_session_id = p_scan_session_id)
        OR (p_analysis_id IS NOT NULL AND la.analysis_id = p_analysis_id)
      )
    ORDER BY la.created_at DESC
    FOR UPDATE
    LIMIT 1;

    IF v_prior.id IS NULL THEN
      RAISE EXCEPTION 'current_assignment_not_found_for_reassign' USING ERRCODE = 'no_data_found';
    END IF;

    UPDATE public.lead_assignments
    SET is_current = false,
        status = 'reassigned',
        released_at = v_now,
        reason_code = v_reason_code,
        metadata = metadata || jsonb_build_object('reassigned_by', v_operator_id, 'reassigned_at', v_now, 'reassign_reason_code', v_reason_code)
    WHERE id = v_prior.id;

    INSERT INTO public.lead_assignments (
      lead_id, scan_session_id, analysis_id, syndicate_id, client_slug,
      contractor_account_id, status, is_current, assigned_at, reason_code,
      assigned_by, metadata
    ) VALUES (
      coalesce(p_lead_id, v_prior.lead_id), coalesce(p_scan_session_id, v_prior.scan_session_id), coalesce(p_analysis_id, v_prior.analysis_id),
      p_syndicate_id, v_client_slug, p_contractor_account_id, 'assigned', true, v_now, v_reason_code,
      v_operator_id, v_metadata || jsonb_build_object('previous_assignment_id', v_prior.id)
    ) RETURNING * INTO v_new;

    INSERT INTO public.lead_routing_events (
      assignment_id, lead_id, scan_session_id, analysis_id, event_type,
      from_client_slug, to_client_slug, from_contractor_account_id, to_contractor_account_id,
      operator_id, reason_code, note, metadata
    ) VALUES (
      v_new.id, v_new.lead_id, v_new.scan_session_id, v_new.analysis_id, 'reassigned',
      v_prior.client_slug, v_new.client_slug, v_prior.contractor_account_id, v_new.contractor_account_id,
      v_operator_id, v_reason_code, v_note,
      jsonb_build_object('action', v_action, 'previous_assignment_id', v_prior.id, 'external_dispatch', false) || v_metadata
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object('success', true, 'action', v_action, 'previous_assignment_id', v_prior.id, 'assignment_id', v_new.id, 'event_id', v_event_id, 'status', v_new.status, 'is_current', v_new.is_current);
  END IF;

  SELECT * INTO v_prior
  FROM public.lead_assignments la
  WHERE (
    (p_assignment_id IS NOT NULL AND la.id = p_assignment_id)
    OR (p_lead_id IS NOT NULL AND la.is_current = true AND la.lead_id = p_lead_id)
    OR (p_scan_session_id IS NOT NULL AND la.is_current = true AND la.scan_session_id = p_scan_session_id)
    OR (p_analysis_id IS NOT NULL AND la.is_current = true AND la.analysis_id = p_analysis_id)
  )
  ORDER BY la.is_current DESC, la.created_at DESC
  FOR UPDATE
  LIMIT 1;

  IF v_prior.id IS NULL THEN
    RAISE EXCEPTION 'assignment_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_action = 'recycle_lead' THEN
    UPDATE public.lead_assignments
    SET is_current = false,
        status = 'recycled',
        recycled_at = v_now,
        released_at = coalesce(released_at, v_now),
        reason_code = v_reason_code,
        metadata = metadata || jsonb_build_object('recycled_by', v_operator_id, 'recycled_at', v_now, 'recycle_reason_code', v_reason_code)
    WHERE id = v_prior.id
    RETURNING * INTO v_prior;

    INSERT INTO public.lead_routing_events (
      assignment_id, lead_id, scan_session_id, analysis_id, event_type,
      from_client_slug, from_contractor_account_id, operator_id, reason_code, note, metadata
    ) VALUES (
      v_prior.id, v_prior.lead_id, v_prior.scan_session_id, v_prior.analysis_id, 'recycled',
      v_prior.client_slug, v_prior.contractor_account_id, v_operator_id, v_reason_code, v_note,
      jsonb_build_object('action', v_action, 'external_dispatch', false) || v_metadata
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object('success', true, 'action', v_action, 'assignment_id', v_prior.id, 'event_id', v_event_id, 'status', v_prior.status, 'is_current', v_prior.is_current);
  END IF;

  IF v_action = 'manual_review' THEN
    UPDATE public.lead_assignments
    SET status = 'manual_review',
        reason_code = v_reason_code,
        metadata = metadata || jsonb_build_object('manual_review_by', v_operator_id, 'manual_review_at', v_now, 'manual_review_reason_code', v_reason_code)
    WHERE id = v_prior.id
    RETURNING * INTO v_prior;

    INSERT INTO public.lead_routing_events (
      assignment_id, lead_id, scan_session_id, analysis_id, event_type,
      from_client_slug, to_client_slug, from_contractor_account_id, to_contractor_account_id,
      operator_id, reason_code, note, metadata
    ) VALUES (
      v_prior.id, v_prior.lead_id, v_prior.scan_session_id, v_prior.analysis_id, 'manual_review',
      v_prior.client_slug, v_prior.client_slug, v_prior.contractor_account_id, v_prior.contractor_account_id,
      v_operator_id, v_reason_code, v_note,
      jsonb_build_object('action', v_action, 'external_dispatch', false) || v_metadata
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object('success', true, 'action', v_action, 'assignment_id', v_prior.id, 'event_id', v_event_id, 'status', v_prior.status, 'is_current', v_prior.is_current);
  END IF;

  INSERT INTO public.lead_routing_events (
    assignment_id, lead_id, scan_session_id, analysis_id, event_type,
    from_client_slug, to_client_slug, from_contractor_account_id, to_contractor_account_id,
    operator_id, reason_code, note, metadata
  ) VALUES (
    v_prior.id, v_prior.lead_id, v_prior.scan_session_id, v_prior.analysis_id, 'operator_note',
    v_prior.client_slug, v_prior.client_slug, v_prior.contractor_account_id, v_prior.contractor_account_id,
    v_operator_id, v_reason_code, v_note,
    jsonb_build_object('action', v_action, 'external_dispatch', false) || v_metadata
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object('success', true, 'action', v_action, 'assignment_id', v_prior.id, 'event_id', v_event_id, 'status', v_prior.status, 'is_current', v_prior.is_current);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_route_lead_assignment(text, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_route_lead_assignment(text, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_route_lead_assignment(text, uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, jsonb) IS
  'Phase 3D internal operator routing service. Atomically routes, reassigns, recycles, marks manual review, and writes immutable routing events. Does not mutate contractor_outcomes or dispatch externally.';
