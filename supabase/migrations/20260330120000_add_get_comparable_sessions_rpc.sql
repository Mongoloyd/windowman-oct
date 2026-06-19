-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Add get_comparable_sessions SECURITY DEFINER RPC
-- Date: 2026-03-30
-- Purpose: Allow the frontend (anon role) to detect whether a lead has 2+
--          completed analyses, without needing a direct SELECT on analyses or
--          scan_sessions (both of which have no anon SELECT policy).
--          Used by PostScanReportSwitcher to conditionally render the
--          "Compare My Quotes" CTA.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_comparable_sessions(p_scan_session_id uuid)
RETURNS TABLE(scan_session_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.scan_session_id
  FROM public.analyses a
  WHERE a.lead_id = (
    SELECT ss.lead_id
    FROM public.scan_sessions ss
    WHERE ss.id = p_scan_session_id
    LIMIT 1
  )
    AND a.analysis_status = 'complete'
    AND a.scan_session_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_comparable_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_comparable_sessions(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_comparable_sessions(uuid) TO authenticated;
