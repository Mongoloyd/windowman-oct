-- ============================================================
-- WM Canonical Event + Quote Trust Foundation (Sprint 1)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'wm_event_name' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.wm_event_name AS ENUM (
      'virtual_page_view',
      'scan_initiated',
      'quote_uploaded',
      'teaser_viewed',
      'otp_started',
      'otp_sent',
      'phone_verified',
      'report_revealed',
      'contractor_match_requested',
      'appointment_booked',
      'sold'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'wm_anomaly_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.wm_anomaly_status AS ENUM (
      'safe',
      'review',
      'quarantine',
      'reject'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'wm_dispatch_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.wm_dispatch_status AS ENUM (
      'not_applicable',
      'pending',
      'processing',
      'dispatched',
      'blocked',
      'failed'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'wm_platform_name' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.wm_platform_name AS ENUM (
      'meta',
      'google_ads',
      'ga4',
      'internal'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.wm_event_log (
  id                            uuid                      NOT NULL DEFAULT gen_random_uuid(),
  event_id                      text                      NOT NULL,
  event_name                    public.wm_event_name      NOT NULL,
  event_timestamp               timestamptz               NOT NULL DEFAULT now(),
  lead_id                       uuid                          NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  account_user_id               uuid                          NULL,
  scan_session_id               uuid                          NULL REFERENCES public.scan_sessions(id) ON DELETE SET NULL,
  analysis_id                   uuid                          NULL REFERENCES public.analyses(id) ON DELETE SET NULL,
  quote_file_id                 uuid                          NULL REFERENCES public.quote_files(id) ON DELETE SET NULL,
  schema_version                text                      NOT NULL DEFAULT '1.0.0',
  model_version                 text                          NULL,
  rubric_version                text                          NULL,
  trust_score                   numeric(5,4)                  NULL CHECK (trust_score >= 0 AND trust_score <= 1),
  anomaly_score                 numeric(5,4)                  NULL CHECK (anomaly_score >= 0 AND anomaly_score <= 1),
  anomaly_status                public.wm_anomaly_status      NULL,
  manual_review_required        boolean                   NOT NULL DEFAULT false,
  approved_for_index            boolean                   NOT NULL DEFAULT false,
  approved_for_ads              boolean                   NOT NULL DEFAULT false,
  optimization_value_usd        numeric                       NULL,
  optimization_priority         integer                       NULL CHECK (optimization_priority BETWEEN 0 AND 100),
  dispatch_status               public.wm_dispatch_status NOT NULL DEFAULT 'not_applicable',
  dispatch_attempted_at         timestamptz                NULL,
  payload                       jsonb                     NOT NULL DEFAULT '{}'::jsonb,
  raw_payload                   jsonb                     NOT NULL DEFAULT '{}'::jsonb,
  created_at                    timestamptz               NOT NULL DEFAULT now(),
  updated_at                    timestamptz               NOT NULL DEFAULT now(),

  CONSTRAINT wm_event_log_pkey PRIMARY KEY (id),
  CONSTRAINT wm_event_log_event_id_key UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_wm_event_log_event_name_time
  ON public.wm_event_log (event_name, event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_wm_event_log_lead_id
  ON public.wm_event_log (lead_id);

CREATE INDEX IF NOT EXISTS idx_wm_event_log_analysis_id
  ON public.wm_event_log (analysis_id);

CREATE INDEX IF NOT EXISTS idx_wm_event_log_dispatch_status
  ON public.wm_event_log (dispatch_status, event_timestamp DESC);

DROP TRIGGER IF EXISTS trg_wm_event_log_updated_at ON public.wm_event_log;
CREATE TRIGGER trg_wm_event_log_updated_at
  BEFORE UPDATE ON public.wm_event_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.wm_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wm_event_log_service_role_all ON public.wm_event_log;
CREATE POLICY wm_event_log_service_role_all
  ON public.wm_event_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.wm_quote_facts (
  id                            uuid                      NOT NULL DEFAULT gen_random_uuid(),
  analysis_id                   uuid                      NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  lead_id                       uuid                          NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  scan_session_id               uuid                          NULL REFERENCES public.scan_sessions(id) ON DELETE SET NULL,
  quote_file_id                 uuid                          NULL REFERENCES public.quote_files(id) ON DELETE SET NULL,
  document_type                 text                          NULL,
  is_quote_document             boolean                   NOT NULL DEFAULT true,
  ocr_confidence                numeric(5,4)                  NULL CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),
  completeness_score            numeric(5,4)                  NULL CHECK (completeness_score >= 0 AND completeness_score <= 1),
  math_consistency_score        numeric(5,4)                  NULL CHECK (math_consistency_score >= 0 AND math_consistency_score <= 1),
  cohort_fit_score              numeric(5,4)                  NULL CHECK (cohort_fit_score >= 0 AND cohort_fit_score <= 1),
  scope_consistency_score       numeric(5,4)                  NULL CHECK (scope_consistency_score >= 0 AND scope_consistency_score <= 1),
  document_validity_score       numeric(5,4)                  NULL CHECK (document_validity_score >= 0 AND document_validity_score <= 1),
  identity_strength_score       numeric(5,4)                  NULL CHECK (identity_strength_score >= 0 AND identity_strength_score <= 1),
  trust_score                   numeric(5,4)              NOT NULL CHECK (trust_score >= 0 AND trust_score <= 1),
  anomaly_score                 numeric(5,4)              NOT NULL CHECK (anomaly_score >= 0 AND anomaly_score <= 1),
  anomaly_status                public.wm_anomaly_status  NOT NULL,
  duplicate_suspected           boolean                   NOT NULL DEFAULT false,
  impossible_values_detected    boolean                   NOT NULL DEFAULT false,
  manual_review_required        boolean                   NOT NULL DEFAULT false,
  approved_for_index            boolean                   NOT NULL DEFAULT false,
  approved_for_ads              boolean                   NOT NULL DEFAULT false,
  reasons                       text[]                    NOT NULL DEFAULT '{}'::text[],
  cohort_key                    text                          NULL,
  county                        text                          NULL,
  opening_count                 integer                       NULL CHECK (opening_count >= 0),
  quote_amount                  numeric                       NULL CHECK (quote_amount >= 0),
  price_per_opening             numeric                       NULL CHECK (price_per_opening >= 0),
  deposit_percent               numeric                       NULL CHECK (deposit_percent >= 0 AND deposit_percent <= 100),
  normalized_facts              jsonb                     NOT NULL DEFAULT '{}'::jsonb,
  trust_inputs                  jsonb                     NOT NULL DEFAULT '{}'::jsonb,
  created_at                    timestamptz               NOT NULL DEFAULT now(),
  updated_at                    timestamptz               NOT NULL DEFAULT now(),

  CONSTRAINT wm_quote_facts_pkey PRIMARY KEY (id),
  CONSTRAINT wm_quote_facts_analysis_id_key UNIQUE (analysis_id)
);

CREATE INDEX IF NOT EXISTS idx_wm_quote_facts_anomaly_status
  ON public.wm_quote_facts (anomaly_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wm_quote_facts_cohort_key
  ON public.wm_quote_facts (cohort_key);

CREATE INDEX IF NOT EXISTS idx_wm_quote_facts_index_approval
  ON public.wm_quote_facts (approved_for_index, approved_for_ads, created_at DESC);

DROP TRIGGER IF EXISTS trg_wm_quote_facts_updated_at ON public.wm_quote_facts;
CREATE TRIGGER trg_wm_quote_facts_updated_at
  BEFORE UPDATE ON public.wm_quote_facts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.wm_quote_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wm_quote_facts_service_role_all ON public.wm_quote_facts;
CREATE POLICY wm_quote_facts_service_role_all
  ON public.wm_quote_facts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.wm_quote_reviews (
  id                            uuid        NOT NULL DEFAULT gen_random_uuid(),
  quote_fact_id                 uuid        NOT NULL REFERENCES public.wm_quote_facts(id) ON DELETE CASCADE,
  analysis_id                   uuid            NULL REFERENCES public.analyses(id) ON DELETE SET NULL,
  lead_id                       uuid            NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  status                        text        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  priority                      integer     NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  reason_codes                  text[]      NOT NULL DEFAULT '{}'::text[],
  notes                         text            NULL,
  assigned_to                   uuid            NULL,
  resolved_by                   uuid            NULL,
  resolved_at                   timestamptz     NULL,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT wm_quote_reviews_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_wm_quote_reviews_status_priority
  ON public.wm_quote_reviews (status, priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_wm_quote_reviews_quote_fact_id
  ON public.wm_quote_reviews (quote_fact_id);

DROP TRIGGER IF EXISTS trg_wm_quote_reviews_updated_at ON public.wm_quote_reviews;
CREATE TRIGGER trg_wm_quote_reviews_updated_at
  BEFORE UPDATE ON public.wm_quote_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.wm_quote_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wm_quote_reviews_service_role_all ON public.wm_quote_reviews;
CREATE POLICY wm_quote_reviews_service_role_all
  ON public.wm_quote_reviews
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.wm_pricing_index_snapshots (
  id                            uuid        NOT NULL DEFAULT gen_random_uuid(),
  snapshot_version              text        NOT NULL,
  cohort_key                    text        NOT NULL,
  sample_size                   integer     NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
  cohort_stats                  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  pricing_bands                 jsonb       NOT NULL DEFAULT '{}'::jsonb,
  effective_from                timestamptz NOT NULL DEFAULT now(),
  effective_to                  timestamptz     NULL,
  created_at                    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT wm_pricing_index_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT wm_pricing_index_snapshots_snapshot_version_key UNIQUE (snapshot_version, cohort_key)
);

CREATE INDEX IF NOT EXISTS idx_wm_pricing_index_snapshots_cohort_effective
  ON public.wm_pricing_index_snapshots (cohort_key, effective_from DESC);

ALTER TABLE public.wm_pricing_index_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wm_pricing_index_snapshots_service_role_all ON public.wm_pricing_index_snapshots;
CREATE POLICY wm_pricing_index_snapshots_service_role_all
  ON public.wm_pricing_index_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.wm_platform_dispatch_log (
  id                            uuid                      NOT NULL DEFAULT gen_random_uuid(),
  event_log_id                  uuid                      NOT NULL REFERENCES public.wm_event_log(id) ON DELETE CASCADE,
  platform_name                 public.wm_platform_name   NOT NULL,
  dispatch_status               public.wm_dispatch_status NOT NULL DEFAULT 'pending',
  attempt_count                 integer                   NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at               timestamptz                   NULL,
  next_attempt_at               timestamptz                   NULL,
  provider_response_code        text                           NULL,
  provider_response_body        jsonb                     NOT NULL DEFAULT '{}'::jsonb,
  error_message                 text                           NULL,
  created_at                    timestamptz               NOT NULL DEFAULT now(),
  updated_at                    timestamptz               NOT NULL DEFAULT now(),

  CONSTRAINT wm_platform_dispatch_log_pkey PRIMARY KEY (id),
  CONSTRAINT wm_platform_dispatch_log_event_platform_key UNIQUE (event_log_id, platform_name)
);

CREATE INDEX IF NOT EXISTS idx_wm_platform_dispatch_log_status
  ON public.wm_platform_dispatch_log (dispatch_status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_wm_platform_dispatch_log_platform
  ON public.wm_platform_dispatch_log (platform_name, created_at DESC);

DROP TRIGGER IF EXISTS trg_wm_platform_dispatch_log_updated_at ON public.wm_platform_dispatch_log;
CREATE TRIGGER trg_wm_platform_dispatch_log_updated_at
  BEFORE UPDATE ON public.wm_platform_dispatch_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.wm_platform_dispatch_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wm_platform_dispatch_log_service_role_all ON public.wm_platform_dispatch_log;
CREATE POLICY wm_platform_dispatch_log_service_role_all
  ON public.wm_platform_dispatch_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
