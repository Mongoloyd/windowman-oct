-- Homepage scan theatrics polls scan_sessions.status via get_scan_status (useScanPolling).
-- anon and authenticated callers need EXECUTE on this SECURITY DEFINER RPC after
-- anon_select_scan_sessions was dropped; without it PostgREST returns 42501
-- permission denied and scan theatrics never advances past preview_ready polling.

REVOKE ALL ON FUNCTION public.get_scan_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_scan_status(uuid) TO anon, authenticated;
