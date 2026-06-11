-- Lock down SECURITY DEFINER dispatch claim RPC.
-- Remote audit confirmed anon/authenticated EXECUTE grants on forensic V2.
-- This function claims/mutates wm_platform_dispatch_log rows and must only be callable by service_role.

REVOKE EXECUTE ON FUNCTION public.wm_claim_dispatch_rows(integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wm_claim_dispatch_rows(integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.wm_claim_dispatch_rows(integer, integer) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.wm_claim_dispatch_rows(integer, integer) TO service_role;
