-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║ Seal OTP-to-Report unlock boundary — strict scan_session binding    ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Problem: phone_verifications has no scan_session_id, so a verified
-- phone for one scan can be used by get_analysis_full to unlock a
-- different scan owned by the same lead. The current JOIN only proves
-- ss.lead_id = l.id AND ss.id = p_scan_session_id — i.e. that some
-- scan owned by the lead exists with this id, not that the verified
-- pending row was the one created for THIS scan session.
--
-- Fix:
--   1. Add phone_verifications.scan_session_id (nullable for legacy rows).
--   2. Index for fast (phone, scan_session, status) lookup.
--   3. Replace get_analysis_full so authorization REQUIRES that the
--      verified phone_verifications row was bound to the requested
--      scan_session_id (not merely owned-by-the-same-lead).
--
-- Backward compatibility: legacy verified rows (NULL scan_session_id)
-- continue to authorize via the lead-owned-session path. New rows
-- written by send-otp will always carry scan_session_id, so the strict
-- binding takes effect for all future verifications.

-- ── 1. Schema ──────────────────────────────────────────────────────────
ALTER TABLE public.phone_verifications
  ADD COLUMN IF NOT EXISTS scan_session_id uuid;

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone_scan_status
  ON public.phone_verifications (phone_e164, scan_session_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_scan_session
  ON public.phone_verifications (scan_session_id)
  WHERE scan_session_id IS NOT NULL;

-- ── 2. Hardened RPC ────────────────────────────────────────────────────
-- PostgreSQL cannot CREATE OR REPLACE a function when OUT/RETURNS TABLE
-- columns change. Drop the exact overload first, without CASCADE, then
-- recreate it below with the intended hardened return shape.
DROP FUNCTION IF EXISTS public.get_analysis_full(uuid, text);

CREATE OR REPLACE FUNCTION public.get_analysis_full(
  p_scan_session_id uuid,
  p_phone_e164      text
)
RETURNS TABLE(
  analysis_id      uuid,
  grade            text,
  flags            jsonb,
  full_json        jsonb,
  proof_of_read    jsonb,
  preview_json     jsonb,
  confidence_score numeric,
  document_type    text,
  rubric_version   text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_authorized boolean := false;
BEGIN
  -- Strict session-bound authorization.
  -- Path A (preferred): a verified phone_verifications row exists that was
  --                     explicitly bound to this scan_session_id.
  -- Path B (legacy)   : a verified row with NULL scan_session_id whose
  --                     lead owns the requested scan_session.
  --                     Kept for backward compatibility with rows written
  --                     before this migration. New rows always carry
  --                     scan_session_id.
  SELECT EXISTS(
    -- Path A — strict binding
    SELECT 1
    FROM public.phone_verifications pv
    JOIN public.leads        l  ON l.id = pv.lead_id
    JOIN public.scan_sessions ss ON ss.id = pv.scan_session_id
    WHERE pv.phone_e164       = p_phone_e164
      AND pv.status           = 'verified'
      AND pv.scan_session_id  = p_scan_session_id
      AND ss.lead_id          = l.id
      AND l.phone_verified    = true
    UNION ALL
    -- Path B — legacy (NULL scan_session_id) lead-owned-session
    SELECT 1
    FROM public.phone_verifications pv
    JOIN public.leads        l  ON l.id = pv.lead_id
    JOIN public.scan_sessions ss ON ss.lead_id = l.id
    WHERE pv.phone_e164       = p_phone_e164
      AND pv.status           = 'verified'
      AND pv.scan_session_id  IS NULL
      AND ss.id               = p_scan_session_id
      AND l.phone_verified    = true
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    -- Sentinel unauthorized row consumed by the client as "__UNAUTHORIZED__".
    RETURN QUERY SELECT
      NULL::uuid     AS analysis_id,
      '__UNAUTHORIZED__'::text AS grade,
      NULL::jsonb    AS flags,
      NULL::jsonb    AS full_json,
      NULL::jsonb    AS proof_of_read,
      NULL::jsonb    AS preview_json,
      NULL::numeric  AS confidence_score,
      NULL::text     AS document_type,
      NULL::text     AS rubric_version;
    RETURN;
  END IF;

  -- Authorized — return the analysis payload for THIS scan session.
  RETURN QUERY
  SELECT
    a.id              AS analysis_id,
    a.grade,
    a.flags,
    a.full_json,
    a.proof_of_read,
    a.preview_json,
    a.confidence_score,
    a.document_type,
    a.rubric_version
  FROM public.analyses a
  WHERE a.scan_session_id  = p_scan_session_id
    AND a.analysis_status  = 'complete'
  LIMIT 1;
END;
$function$;