BEGIN;

-- analyses
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS client_slug text;

COMMENT ON COLUMN public.analyses.client_slug IS
  'Tenant slug propagated from leads.client_slug. Nullable. No FK (deferred until clients-row-exists writer guarantee). Added 2026-04-19.';

UPDATE public.analyses a
SET    client_slug = l.client_slug
FROM   public.leads l
WHERE  a.lead_id     = l.id
  AND  a.client_slug IS NULL
  AND  l.client_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analyses_client_slug
  ON public.analyses (client_slug)
  WHERE client_slug IS NOT NULL;

-- contractor_opportunities
ALTER TABLE public.contractor_opportunities
  ADD COLUMN IF NOT EXISTS client_slug text;

COMMENT ON COLUMN public.contractor_opportunities.client_slug IS
  'Tenant slug propagated from leads.client_slug. Nullable. No FK (deferred until clients-row-exists writer guarantee). Added 2026-04-19.';

UPDATE public.contractor_opportunities o
SET    client_slug = l.client_slug
FROM   public.leads l
WHERE  o.lead_id     = l.id
  AND  o.client_slug IS NULL
  AND  l.client_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contractor_opportunities_client_slug
  ON public.contractor_opportunities (client_slug)
  WHERE client_slug IS NOT NULL;

COMMIT;