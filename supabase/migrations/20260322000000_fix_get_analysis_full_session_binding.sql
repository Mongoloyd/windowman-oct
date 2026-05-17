-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Fix get_analysis_full — session-bound phone verification
-- Date: 2026-03-22
-- Purpose: Replace global phone check with three-table JOIN that binds
--          phone_verifications → leads → scan_sessions so a verified phone
--          can only unlock the report for the lead it was verified against.
-- Depends on: verify-otp edge function setting phone_verifications.lead_id
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop the old (insecure) version
DROP FUNCTION IF EXISTS public.get_analysis_full(uuid, text);

-- Recreate with session-bound authorization
CREATE OR REPLACE FUNCTION public.get_analysis_full(
  p_scan_session_id uuid,
  p_phone_e164    text
)
RETURNS TABLE (
  grade              text,
  flags              jsonb,
  full_json          jsonb,
  proof_of_read      jsonb,
  preview_json       jsonb,
  confidence_score   numeric,
  document_type      text,
  rubric_version     text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify phone is verified AND bound to the same lead as this scan session.
  -- Three-table JOIN enforces:
  --   phone_verifications.lead_id → leads.id ← scan_sessions.lead_id = p_scan_session_id
  IF NOT EXISTS (
    SELECT 1
    FROM phone_verifications pv
    JOIN leads l ON l.id = pv.lead_id
    JOIN scan_sessions ss ON ss.lead_id = l.id
    WHERE pv.phone_e164 = p_phone_e164
      AND pv.status = 'verified'
      AND ss.id = p_scan_session_id
  ) THEN
    RETURN;  -- empty result set = unauthorized
  END IF;

  -- Return the full gated payload
  RETURN QUERY
  SELECT
    a.grade,
    a.flags,
    a.full_json,
    a.proof_of_read,
    a.preview_json,
    a.confidence_score,
    a.document_type,
    a.rubric_version
  FROM analyses a
  WHERE a.scan_session_id = p_scan_session_id
    AND a.analysis_status = 'complete'
  ORDER BY a.created_at DESC
  LIMIT 1;
END;
$$;
