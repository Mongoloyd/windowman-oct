CREATE TABLE IF NOT EXISTS public.lead_attribution_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  source_platform text NOT NULL,
  source_channel text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  form_id text,
  platform_lead_id text,
  fbclid text,
  gclid text,
  fbc text,
  fbp text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  landing_page_url text,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lead_attribution_details_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE,
  CONSTRAINT lead_attribution_details_source_platform_not_blank
    CHECK (length(btrim(source_platform)) > 0),
  CONSTRAINT lead_attribution_details_raw_payload_is_object
    CHECK (jsonb_typeof(raw_payload) = 'object')
);

ALTER TABLE public.lead_attribution_details ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lead_attribution_details_lead_id
  ON public.lead_attribution_details (lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_attribution_details_source_platform
  ON public.lead_attribution_details (source_platform);

CREATE INDEX IF NOT EXISTS idx_lead_attribution_details_platform_lead_id
  ON public.lead_attribution_details (platform_lead_id)
  WHERE platform_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_attribution_details_form_id
  ON public.lead_attribution_details (form_id)
  WHERE form_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_attribution_details_imported_at
  ON public.lead_attribution_details (imported_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_attribution_details_platform_unique
  ON public.lead_attribution_details (source_platform, platform_lead_id)
  WHERE platform_lead_id IS NOT NULL;

DROP POLICY IF EXISTS lead_attribution_details_select_internal
  ON public.lead_attribution_details;
CREATE POLICY lead_attribution_details_select_internal
  ON public.lead_attribution_details
  FOR SELECT
  TO authenticated
  USING (public.is_internal_operator());

DROP POLICY IF EXISTS lead_attribution_details_service_role_all
  ON public.lead_attribution_details;
CREATE POLICY lead_attribution_details_service_role_all
  ON public.lead_attribution_details
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_lead_attribution_details_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_lead_attribution_details_updated_at
  ON public.lead_attribution_details;
CREATE TRIGGER update_lead_attribution_details_updated_at
  BEFORE UPDATE ON public.lead_attribution_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lead_attribution_details_updated_at();