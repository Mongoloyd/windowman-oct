CREATE OR REPLACE FUNCTION public.get_contractor_released_contact(_lead_assignment_id uuid)
RETURNS TABLE(
  release_status text,
  allowed_contact_fields text[],
  first_name text,
  last_name text,
  phone text,
  email text,
  city text,
  county text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lcr.release_status,
    lcr.allowed_contact_fields,
    CASE WHEN 'first_name' = ANY(lcr.allowed_contact_fields) THEN l.first_name ELSE NULL END AS first_name,
    CASE WHEN 'last_name' = ANY(lcr.allowed_contact_fields) THEN l.last_name ELSE NULL END AS last_name,
    CASE WHEN 'phone' = ANY(lcr.allowed_contact_fields) THEN l.phone_e164 ELSE NULL END AS phone,
    CASE WHEN 'email' = ANY(lcr.allowed_contact_fields) THEN l.email ELSE NULL END AS email,
    CASE WHEN 'city' = ANY(lcr.allowed_contact_fields) THEN l.city ELSE NULL END AS city,
    CASE WHEN 'county' = ANY(lcr.allowed_contact_fields) THEN l.county ELSE NULL END AS county
  FROM public.lead_assignments la
  JOIN public.contractor_accounts ca ON ca.id = la.contractor_account_id
  JOIN public.lead_contact_releases lcr
    ON lcr.lead_assignment_id = la.id
   AND lcr.contractor_account_id = ca.id
   AND lcr.client_slug = la.client_slug
  LEFT JOIN public.leads l ON l.id = la.lead_id AND l.client_slug = la.client_slug
  WHERE la.id = _lead_assignment_id
    AND ca.auth_user_id = auth.uid()
    AND ca.is_active = true
    AND ca.access_status = 'active'
    AND lcr.release_status = 'approved'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_contractor_released_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contractor_released_contact(uuid) TO authenticated;