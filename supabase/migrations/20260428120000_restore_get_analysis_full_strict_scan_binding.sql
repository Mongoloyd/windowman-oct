BEGIN;

-- Defensive: ensure the column needed for strict OTP-to-scan binding exists.
ALTER TABLE public.phone_verifications
  ADD COLUMN IF NOT EXISTS scan_session_id uuid;

-- Helpful lookup indexes for strict phone/session/status authorization.
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone_scan_status
  ON public.phone_verifications (phone_e164, scan_session_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_scan_session
  ON public.phone_verifications (scan_session_id)
  WHERE scan_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_analysis_full(
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_authorized boolean := false;
BEGIN
  -- Strict OTP-to-scan-session authorization.
  -- A phone verification may unlock only the exact scan_session_id it was
  -- created/verified for, while still confirming the scan belongs to the
  -- same lead and the lead is marked phone_verified.
  SELECT EXISTS(
    SELECT 1
    FROM public.phone_verifications pv
    JOIN public.scan_sessions ss
      ON ss.id = p_scan_session_id
     AND ss.id = pv.scan_session_id
    JOIN public.leads l
      ON l.id = ss.lead_id
     AND l.id = pv.lead_id
    WHERE pv.phone_e164 = p_phone_e164
      AND pv.status = 'verified'
      AND pv.scan_session_id = p_scan_session_id
      AND l.phone_verified = true
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    -- Preserve current frontend contract: unauthorized is represented as a
    -- sentinel row, not an empty result and not a thrown error.
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
  ORDER BY a.created_at DESC
  LIMIT 1;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_analysis_full(uuid, text) TO anon, authenticated;

COMMIT;
