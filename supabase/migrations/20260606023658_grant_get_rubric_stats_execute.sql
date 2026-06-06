-- Allow authenticated callers to execute the RPC so the internal
-- is_internal_operator() gate can enforce operator/admin/super_admin access.
-- Keep anon and PUBLIC blocked.
REVOKE ALL ON FUNCTION public.get_rubric_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_rubric_stats(integer) TO authenticated, service_role;
