-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Redact preview + create gated full fetch
-- Date: 2026-03-22
-- Purpose: Close the flags data leak; create backend-authoritative gate
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Step 1: Replace get_analysis_preview with redacted version ────────────────
-- Returns flag_count (integer) instead of flags (jsonb).
-- Adds flag_red_count and flag_amber_count for teaser UI.

DROP FUNCTION IF EXISTS public.get_analysis_preview(uuid);

CREATE FUNCTION public.get_analysis_preview(p_scan_session_id uuid)
RETURNS TABLE(
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    a.grade,
    jsonb_array_length(COALESCE(a.flags, '[]'::jsonb))::integer AS flag_count,
    (SELECT count(*)::integer
     FROM jsonb_array_elements(COALESCE(a.flags, '[]'::jsonb)) elem
     WHERE elem->>'severity' IN ('Critical', 'High'))            AS flag_red_count,
    (SELECT count(*)::integer
     FROM jsonb_array_elements(COALESCE(a.flags, '[]'::jsonb)) elem
     WHERE elem->>'severity' = 'Medium')                         AS flag_amber_count,
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

-- ── Step 2: Create get_analysis_full — gated behind phone verification ───────
-- Returns flags + full_json ONLY when a verified phone record exists.
-- Returns empty result set if verification fails — no error, no hint.

CREATE OR REPLACE FUNCTION public.get_analysis_full(
  p_scan_session_id uuid,
  p_phone_e164 text
)
RETURNS TABLE(
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
AS $$
DECLARE
  v_verified boolean := false;
BEGIN
  -- Check that this phone has a verified record
  SELECT EXISTS(
    SELECT 1
    FROM public.phone_verifications pv
    WHERE pv.phone_e164 = p_phone_e164
      AND pv.status = 'verified'
  ) INTO v_verified;

  IF NOT v_verified THEN
    RETURN;  -- empty result — phone not verified
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
  FROM public.analyses a
  WHERE a.scan_session_id = p_scan_session_id
    AND a.analysis_status = 'complete'
  LIMIT 1;
END;
$$;

-- ── Step 3: Ensure no direct anon SELECT on analyses ─────────────────────────
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_analyses" ON public.analyses;
DROP POLICY IF EXISTS "Allow anonymous select on analyses" ON public.analyses;
-- No new anon SELECT policy. All access goes through SECURITY DEFINER RPCs.
