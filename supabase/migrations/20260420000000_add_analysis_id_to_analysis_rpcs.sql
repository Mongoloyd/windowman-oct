BEGIN;

-- 1) Extend get_analysis_preview to return analysis_id
DROP FUNCTION IF EXISTS public.get_analysis_preview(uuid);
CREATE FUNCTION public.get_analysis_preview(p_scan_session_id uuid)
RETURNS TABLE(
  analysis_id uuid,
  grade text,
  flag_count integer,
  flag_red_count integer,
  flag_amber_count integer,
  proof_of_read jsonb,
  preview_json jsonb,
  confidence_score numeric,
  document_type text,
  rubric_version text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT 
    a.id AS analysis_id,
    a.grade,
    jsonb_array_length(COALESCE(a.flags, '[]'::jsonb))::integer AS flag_count,
    (SELECT count(*)::integer FROM jsonb_array_elements(COALESCE(a.flags, '[]'::jsonb)) elem WHERE elem->>'severity' IN ('Critical', 'High')) AS flag_red_count,
    (SELECT count(*)::integer FROM jsonb_array_elements(COALESCE(a.flags, '[]'::jsonb)) elem WHERE elem->>'severity' = 'Medium') AS flag_amber_count,
    a.proof_of_read,
    a.preview_json,
    a.confidence_score,
    a.document_type,
    a.rubric_version
  FROM public.analyses a
  WHERE a.scan_session_id = p_scan_session_id
    AND a.analysis_status = 'complete'
  LIMIT 1;
$$;

-- 2) Extend get_analysis_full to return analysis_id WITH LIVE AUTH RULES
DROP FUNCTION IF EXISTS public.get_analysis_full(uuid, text);
CREATE FUNCTION public.get_analysis_full(
  p_scan_session_id uuid,
  p_phone_e164 text
)
RETURNS TABLE(
  analysis_id uuid,
  grade text,
  flags jsonb,
  full_json jsonb,
  proof_of_read jsonb,
  preview_json jsonb,
  confidence_score numeric,
  document_type text,
  rubric_version text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_authorized boolean := false;
BEGIN
  -- Belt-and-suspenders auth check
  SELECT EXISTS(
    SELECT 1
    FROM public.phone_verifications pv
    JOIN public.leads l ON l.id = pv.lead_id
    JOIN public.scan_sessions ss ON ss.lead_id = l.id
    WHERE pv.phone_e164 = p_phone_e164
      AND pv.status = 'verified'
      AND ss.id = p_scan_session_id
      AND l.phone_verified = true
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    -- Sentinel unauthorized row
    RETURN QUERY SELECT
      NULL::uuid AS analysis_id,
      '__UNAUTHORIZED__'::text AS grade,
      NULL::jsonb AS flags,
      NULL::jsonb AS full_json,
      NULL::jsonb AS proof_of_read,
      NULL::jsonb AS preview_json,
      NULL::numeric AS confidence_score,
      NULL::text AS document_type,
      NULL::text AS rubric_version;
    RETURN;
  END IF;

  -- Authorized payload
  RETURN QUERY
  SELECT 
    a.id AS analysis_id,
    a.grade,
    a.flags,
    a.full_json,
    a.proof_of_read,
    a.preview_json,
    a.confidence_score,
    a.document_type,
    a.rubric_version
  FROM public.analyses a
  WHERE a.scan_session_id = p_scan_session_id
    AND a.analysis_status = 'complete'
  LIMIT 1;
END;
$$;

COMMIT;
