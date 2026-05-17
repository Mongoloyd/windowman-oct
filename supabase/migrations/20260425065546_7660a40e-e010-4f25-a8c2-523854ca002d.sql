ALTER TABLE public.lead_attribution_details
  ADD COLUMN IF NOT EXISTS source_detail text,
  ADD COLUMN IF NOT EXISTS first_page_path text,
  ADD COLUMN IF NOT EXISTS initial_referrer text,
  ADD COLUMN IF NOT EXISTS platform_created_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS import_source text;

ALTER TABLE public.lead_attribution_details
  ALTER COLUMN source_channel SET DEFAULT 'unknown';

UPDATE public.lead_attribution_details
SET source_channel = 'unknown'
WHERE source_channel IS NULL;

ALTER TABLE public.lead_attribution_details
  ALTER COLUMN source_channel SET NOT NULL,
  ALTER COLUMN imported_at DROP NOT NULL,
  ALTER COLUMN raw_payload DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_attribution_details_source_platform_channel
  ON public.lead_attribution_details (source_platform, source_channel);

CREATE INDEX IF NOT EXISTS idx_lead_attribution_details_campaign_id
  ON public.lead_attribution_details (campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_attribution_details_adset_id
  ON public.lead_attribution_details (adset_id)
  WHERE adset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_attribution_details_ad_id
  ON public.lead_attribution_details (ad_id)
  WHERE ad_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_attribution_details_created_at
  ON public.lead_attribution_details (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_attribution_details_platform_created_time
  ON public.lead_attribution_details (platform_created_time DESC)
  WHERE platform_created_time IS NOT NULL;

DROP POLICY IF EXISTS lead_attribution_details_insert_internal
  ON public.lead_attribution_details;
DROP POLICY IF EXISTS lead_attribution_details_update_internal
  ON public.lead_attribution_details;
DROP POLICY IF EXISTS lead_attribution_details_delete_internal
  ON public.lead_attribution_details;

-- Ensure website attribution/admin fields exist on leads before backfilling lead_attribution_details.
-- These fields may be absent on clean staging because early funnel attribution was captured before
-- the dedicated lead_attribution_details spine existed.
-- last_name is required later in this same migration by get_admin_attribution_spine.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS fbc text,
  ADD COLUMN IF NOT EXISTS fbp text,
  ADD COLUMN IF NOT EXISTS landing_page_url text,
  ADD COLUMN IF NOT EXISTS first_page_path text,
  ADD COLUMN IF NOT EXISTS initial_referrer text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS latest_opportunity_id uuid;

CREATE INDEX IF NOT EXISTS idx_leads_latest_opportunity_id
  ON public.leads (latest_opportunity_id)
  WHERE latest_opportunity_id IS NOT NULL;

INSERT INTO public.lead_attribution_details (
  lead_id,
  source_platform,
  source_channel,
  source_detail,
  utm_source,
  utm_medium,
  utm_campaign,
  utm_term,
  utm_content,
  fbclid,
  gclid,
  fbc,
  fbp,
  landing_page_url,
  first_page_path,
  initial_referrer,
  import_source,
  imported_at,
  raw_payload,
  created_at,
  updated_at
)
SELECT
  l.id,
  'website',
  CASE
    WHEN lower(coalesce(l.source, '')) IN ('truth-gate', 'truth_gate', 'truthgate') THEN 'truth_gate'
    WHEN coalesce(l.utm_medium, '') <> '' THEN l.utm_medium
    WHEN coalesce(l.utm_source, '') <> '' THEN l.utm_source
    ELSE 'direct'
  END,
  l.source,
  l.utm_source,
  l.utm_medium,
  l.utm_campaign,
  l.utm_term,
  l.utm_content,
  l.fbclid,
  l.gclid,
  l.fbc,
  l.fbp,
  l.landing_page_url,
  l.first_page_path,
  l.initial_referrer,
  'website_backfill',
  NULL,
  jsonb_build_object(
    'backfilled_from', 'leads',
    'lead_source', l.source,
    'client_slug', l.client_slug,
    'backfilled_at', now()
  ),
  l.created_at,
  now()
FROM public.leads l
WHERE NOT EXISTS (
    SELECT 1
    FROM public.lead_attribution_details lad
    WHERE lad.lead_id = l.id
      AND lad.source_platform = 'website'
  )
  AND (
    l.utm_source IS NOT NULL OR
    l.utm_medium IS NOT NULL OR
    l.utm_campaign IS NOT NULL OR
    l.utm_term IS NOT NULL OR
    l.utm_content IS NOT NULL OR
    l.fbclid IS NOT NULL OR
    l.gclid IS NOT NULL OR
    l.fbc IS NOT NULL OR
    l.fbp IS NOT NULL OR
    l.landing_page_url IS NOT NULL OR
    l.first_page_path IS NOT NULL OR
    l.initial_referrer IS NOT NULL OR
    l.client_slug IS NOT NULL OR
    l.source IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.get_admin_attribution_spine(p_limit integer DEFAULT 500)
RETURNS TABLE (
  lead_id uuid,
  attribution_id uuid,
  lead_name text,
  has_email boolean,
  has_phone boolean,
  source_platform text,
  source_channel text,
  source_detail text,
  campaign_name text,
  campaign_id text,
  adset_name text,
  adset_id text,
  ad_name text,
  ad_id text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  fbclid_present boolean,
  gclid_present boolean,
  fbc_present boolean,
  fbp_present boolean,
  phone_verified boolean,
  final_disposition text,
  final_value_cents integer,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_internal_operator() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l.id AS lead_id,
    lad.id AS attribution_id,
    NULLIF(trim(concat_ws(' ', l.first_name, l.last_name)), '') AS lead_name,
    l.email IS NOT NULL AS has_email,
    l.phone_e164 IS NOT NULL AS has_phone,
    lad.source_platform,
    lad.source_channel,
    lad.source_detail,
    lad.campaign_name,
    lad.campaign_id,
    lad.adset_name,
    lad.adset_id,
    lad.ad_name,
    lad.ad_id,
    lad.utm_campaign,
    lad.utm_term,
    lad.utm_content,
    lad.fbclid IS NOT NULL AS fbclid_present,
    lad.gclid IS NOT NULL AS gclid_present,
    lad.fbc IS NOT NULL AS fbc_present,
    lad.fbp IS NOT NULL AS fbp_present,
    l.phone_verified,
    COALESCE(co.disposition_state, l.deal_status, l.status) AS final_disposition,
    co.final_value_cents,
    lad.created_at
  FROM public.lead_attribution_details lad
  JOIN public.leads l ON l.id = lad.lead_id
  LEFT JOIN LATERAL (
    SELECT o.disposition_state, o.final_value_cents
    FROM public.contractor_outcomes o
    WHERE o.opportunity_id = l.latest_opportunity_id
       OR o.opportunity_id IN (
         SELECT opp.id
         FROM public.contractor_opportunities opp
         WHERE opp.lead_id = l.id
       )
    ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC
    LIMIT 1
  ) co ON true
  ORDER BY lad.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 1000);
END;
$$;