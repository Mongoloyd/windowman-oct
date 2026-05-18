-- DB-HARDEN-1C-PREP-1
-- Create narrow SECURITY DEFINER RPCs to replace unsafe browser direct SELECTs
-- on scan_sessions, leads, and quote_files.
--
-- Addresses blockers from the 1C audit (blockers 2, 3, and 5):
--   Blocker 2: browser SELECT on scan_sessions (UploadZone, PostScanReportSwitcher, Estimate)
--   Blocker 3: browser SELECT on leads (PostScanReportSwitcher, Estimate)
--   Blocker 5: browser SELECT on quote_files by storage_path (UploadZone retry)
--
-- Does NOT enable RLS on any table.
-- Does NOT create any table grants.
-- Does NOT create admin or attribution analytics RPCs (blocker 4 deferred).
-- Does NOT add UPDATE or INSERT policies.
-- Does NOT alter Edge Functions, storage policies, or frontend code.

-- ─── RPC 1: get_scan_session_context ─────────────────────────────────────────
-- Replaces three browser direct SELECTs on scan_sessions:
--   1. UploadZone L244 — retry path: .select("quote_file_id, lead_id").eq("id", scanSessionId)
--   2. PostScanReportSwitcher L173 — .select("lead_id").eq("id", scanSessionId)
--   3. Estimate.tsx L53 — .select("lead_id").eq("id", scanSessionId)
-- Returns only the two identity FKs needed for retry coherence and lead binding.
-- Does NOT return: status, user_id, client_slug, attribution, timestamps.

CREATE OR REPLACE FUNCTION public.get_scan_session_context(
  p_scan_session_id uuid
)
RETURNS TABLE(quote_file_id uuid, lead_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ss.quote_file_id, ss.lead_id
  FROM public.scan_sessions ss
  WHERE ss.id = p_scan_session_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_scan_session_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_scan_session_context(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_scan_session_context(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_scan_session_context(uuid) TO anon, authenticated;


-- ─── RPC 2: get_lead_context_for_session ─────────────────────────────────────
-- Replaces browser direct SELECTs on leads:
--   1. PostScanReportSwitcher L185 — .select("phone_e164, first_name, email, grade")
--   2. Estimate.tsx L60 — .select("first_name, county, grade, phone_e164, phone_verified")
-- Returns ONLY: lead_id, first_name, county, phone_e164.
-- Does NOT return: email, grade, grade_score, phone_verified, phone_verified_at,
--   otp_state, latest_analysis_id, report_unlocked_at, or any scoring/auth field.
-- Callers must obtain grade from get_analysis_preview and phone_verified state
-- from the OTP/verify pipeline — not from direct leads table reads.

CREATE OR REPLACE FUNCTION public.get_lead_context_for_session(
  p_scan_session_id uuid
)
RETURNS TABLE(lead_id uuid, first_name text, county text, phone_e164 text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT l.id AS lead_id, l.first_name, l.county, l.phone_e164
  FROM public.scan_sessions ss
  JOIN public.leads l ON l.id = ss.lead_id
  WHERE ss.id = p_scan_session_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_lead_context_for_session(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_lead_context_for_session(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_lead_context_for_session(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_context_for_session(uuid) TO anon, authenticated;


-- ─── RPC 3: get_upload_retry_context ─────────────────────────────────────────
-- Replaces UploadZone's two-step cross-component retry lookup (fresh path):
--   Step 1: L285 — quote_files: .select("id, lead_id").eq("storage_path", filePath)
--   Step 2: L295 — scan_sessions: .select("id").eq("quote_file_id", quoteFileId)
-- Collapses both SELECTs into a single authenticated RPC call.
--
-- SIGNATURE NOTE: The prompt specified p_scan_session_id uuid but the actual call
-- site (UploadZone) does not have the scan_session UUID at lookup time — only the
-- text sessionScope that forms the storage path prefix. Using p_session_scope text
-- is the correct binding for path-prefix ownership validation.
-- Returning scan_session_id in addition to quote_file_id/lead_id allows UploadZone
-- to obtain both IDs in one call.
--
-- Security validation:
--   p_storage_path MUST begin with p_session_scope || '/' to prevent cross-session
--   path enumeration. Empty scope or path strings are rejected.
-- Does NOT return: storage_path, status, created_at, or any other metadata.

CREATE OR REPLACE FUNCTION public.get_upload_retry_context(
  p_session_scope text,
  p_storage_path  text
)
RETURNS TABLE(quote_file_id uuid, scan_session_id uuid, lead_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    qf.id   AS quote_file_id,
    ss.id   AS scan_session_id,
    qf.lead_id
  FROM public.quote_files qf
  LEFT JOIN public.scan_sessions ss ON ss.quote_file_id = qf.id
  WHERE qf.storage_path = p_storage_path
    AND qf.storage_path LIKE p_session_scope || '/%'
    AND length(p_session_scope) > 0
    AND length(p_storage_path) > 0
  ORDER BY qf.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_upload_retry_context(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_upload_retry_context(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_upload_retry_context(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_upload_retry_context(text, text) TO anon, authenticated;
