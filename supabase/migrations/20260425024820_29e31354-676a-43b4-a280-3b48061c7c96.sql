ALTER FUNCTION public.fire_crm_handoff()
SET search_path = '';

COMMENT ON FUNCTION public.fire_crm_handoff() IS
  'SECURITY DEFINER CRM handoff trigger function. Function-level search_path is fixed to empty string for Supabase linter compliance; function body must schema-qualify all application objects.';