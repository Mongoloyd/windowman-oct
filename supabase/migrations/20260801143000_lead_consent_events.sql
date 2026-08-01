-- Append-only lead consent audit trail (service, marketing, contractor sharing).
-- Writes occur only via service-role Edge Functions and SECURITY DEFINER RPC.

CREATE TABLE IF NOT EXISTS public.lead_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  lead_id uuid NOT NULL
    REFERENCES public.leads(id)
    ON DELETE CASCADE,

  session_id text,

  submission_id uuid NOT NULL,

  purpose text NOT NULL
    CHECK (
      purpose IN (
        'service_communications',
        'marketing_communications',
        'contractor_sharing'
      )
    ),

  decision text NOT NULL
    CHECK (
      decision IN (
        'granted',
        'declined',
        'withdrawn'
      )
    ),

  consent_schema_version text NOT NULL,
  privacy_policy_version text NOT NULL,
  terms_version text,
  disclosure_version text NOT NULL,
  source text NOT NULL,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (lead_id, submission_id, purpose)
);

CREATE INDEX IF NOT EXISTS idx_lead_consent_events_lead_id
  ON public.lead_consent_events(lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_consent_events_purpose
  ON public.lead_consent_events(purpose);

CREATE INDEX IF NOT EXISTS idx_lead_consent_events_created_at
  ON public.lead_consent_events(created_at);

ALTER TABLE public.lead_consent_events ENABLE ROW LEVEL SECURITY;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE
  ON public.lead_consent_events
  FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.persist_lead_consent_batch(
  p_lead_id uuid,
  p_session_id text,
  p_submission_id uuid,
  p_consent_schema_version text,
  p_privacy_policy_version text,
  p_terms_version text,
  p_source text,
  p_events jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_lead_id IS NULL OR p_submission_id IS NULL THEN
    RAISE EXCEPTION 'invalid_consent_batch' USING ERRCODE = '22023';
  END IF;

  IF p_events IS NULL OR pg_catalog.jsonb_typeof(p_events) <> 'array' OR pg_catalog.jsonb_array_length(p_events) = 0 THEN
    RAISE EXCEPTION 'empty_consent_batch' USING ERRCODE = '22023';
  END IF;

  -- Idempotency contract for (lead_id, submission_id, purpose):
  --   * byte-equivalent duplicate  -> idempotent success (ON CONFLICT DO NOTHING)
  --   * same key, different payload -> explicit conflict error; silently
  --     preserving the earlier decision while returning success is forbidden.
  -- A changed decision must arrive as a NEW submission_id (append-only audit).
  IF EXISTS (
    SELECT 1
    FROM public.lead_consent_events existing
    JOIN pg_catalog.jsonb_to_recordset(p_events) AS e(
      purpose text,
      decision text,
      disclosure_version text
    ) ON existing.purpose = e.purpose
    WHERE existing.lead_id = p_lead_id
      AND existing.submission_id = p_submission_id
      AND (
        existing.decision IS DISTINCT FROM e.decision
        OR existing.disclosure_version IS DISTINCT FROM e.disclosure_version
        OR existing.consent_schema_version IS DISTINCT FROM p_consent_schema_version
        OR existing.privacy_policy_version IS DISTINCT FROM p_privacy_policy_version
        OR existing.terms_version IS DISTINCT FROM p_terms_version
        OR existing.source IS DISTINCT FROM p_source
      )
  ) THEN
    RAISE EXCEPTION 'consent_submission_conflict' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.lead_consent_events (
    lead_id,
    session_id,
    submission_id,
    purpose,
    decision,
    consent_schema_version,
    privacy_policy_version,
    terms_version,
    disclosure_version,
    source,
    metadata
  )
  SELECT
    p_lead_id,
    p_session_id,
    p_submission_id,
    e.purpose,
    e.decision,
    p_consent_schema_version,
    p_privacy_policy_version,
    p_terms_version,
    e.disclosure_version,
    p_source,
    '{}'::jsonb
  FROM pg_catalog.jsonb_to_recordset(p_events) AS e(
    purpose text,
    decision text,
    disclosure_version text
  )
  ON CONFLICT (lead_id, submission_id, purpose) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.persist_lead_consent_batch(
  uuid, text, uuid, text, text, text, text, jsonb
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.persist_lead_consent_batch(
  uuid, text, uuid, text, text, text, text, jsonb
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.persist_lead_consent_batch(
  uuid, text, uuid, text, text, text, text, jsonb
) TO service_role;
