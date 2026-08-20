# WMChat Day-1 Meta migration rollback

These statements are manual rollback SQL. They are intentionally not named as
timestamped `.sql` migrations, so the Supabase CLI will not apply them during a
forward migration run.

## Advertising measurement consent purpose

The safe launch rollback is to stop producing/dispatching Meta events and keep
the additive consent purpose plus immutable consent history. Removing the check
value is only valid when no stored row uses it:

```sql
DO $rollback$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.lead_consent_events
    WHERE purpose = 'advertising_measurement'
  ) THEN
    RAISE EXCEPTION
      'Rollback blocked: advertising_measurement consent history exists';
  END IF;

  ALTER TABLE public.lead_consent_events
    DROP CONSTRAINT IF EXISTS lead_consent_events_purpose_check;

  ALTER TABLE public.lead_consent_events
    ADD CONSTRAINT lead_consent_events_purpose_check
    CHECK (
      purpose IN (
        'service_communications',
        'marketing_communications',
        'contractor_sharing'
      )
    );
END;
$rollback$;
```

## WMChat session idempotency index

```sql
DROP INDEX IF EXISTS public.leads_wmchat_session_id_unique;
```

## Event-scoped dispatch claim RPC

```sql
BEGIN;

DROP FUNCTION IF EXISTS public.wm_claim_dispatch_rows_scoped(
  integer,
  integer,
  public.wm_platform_name,
  uuid,
  public.wm_event_name
);

CREATE OR REPLACE FUNCTION public.wm_claim_dispatch_rows_scoped(
  p_limit integer DEFAULT 25,
  p_lock_stale_minutes integer DEFAULT 10,
  p_platform_name public.wm_platform_name DEFAULT NULL,
  p_dispatch_id uuid DEFAULT NULL
)
RETURNS TABLE (
  dispatch_id uuid,
  event_log_id uuid,
  platform_name public.wm_platform_name,
  dispatch_status public.wm_dispatch_status,
  attempt_count integer,
  event_id text,
  event_name public.wm_event_name,
  event_timestamp timestamptz,
  event_payload jsonb,
  event_raw_payload jsonb,
  event_schema_version text,
  event_model_version text,
  event_rubric_version text,
  event_identity_quality text,
  should_send_meta boolean,
  should_send_google boolean,
  event_client_slug text,
  event_lead_id uuid,
  event_scan_session_id uuid,
  event_analysis_id uuid,
  event_quote_file_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
BEGIN
  UPDATE public.wm_platform_dispatch_log AS d
  SET
    dispatch_status = 'dead_letter',
    error_message =
      'Worker crashed after final attempt; row auto-dead-lettered',
    updated_at = pg_catalog.now()
  WHERE d.dispatch_status = 'processing'
    AND d.last_attempt_at IS NOT NULL
    AND d.last_attempt_at <= (
      pg_catalog.now() -
      pg_catalog.make_interval(mins => p_lock_stale_minutes)
    )
    AND COALESCE(d.attempt_count, 0) >= 5
    AND (p_platform_name IS NULL OR d.platform_name = p_platform_name)
    AND (p_dispatch_id IS NULL OR d.id = p_dispatch_id);

  RETURN QUERY
  WITH eligible AS (
    SELECT d.id
    FROM public.wm_platform_dispatch_log AS d
    JOIN public.wm_event_log AS e ON e.id = d.event_log_id
    WHERE (
        d.dispatch_status = 'processing'
          AND d.last_attempt_at IS NOT NULL
          AND d.last_attempt_at <= (
            pg_catalog.now() -
            pg_catalog.make_interval(mins => p_lock_stale_minutes)
          )
        OR d.dispatch_status = 'pending'
          AND (
            d.next_attempt_at IS NULL OR
            d.next_attempt_at <= pg_catalog.now()
          )
        OR d.dispatch_status = 'failed'
          AND d.next_attempt_at IS NOT NULL
          AND d.next_attempt_at <= pg_catalog.now()
      )
      AND COALESCE(d.attempt_count, 0) < 5
      AND (p_platform_name IS NULL OR d.platform_name = p_platform_name)
      AND (p_dispatch_id IS NULL OR d.id = p_dispatch_id)
    ORDER BY COALESCE(d.next_attempt_at, d.created_at) ASC
    FOR UPDATE OF d SKIP LOCKED
    LIMIT GREATEST(COALESCE(p_limit, 25), 1)
  ), claimed AS (
    UPDATE public.wm_platform_dispatch_log AS d
    SET
      dispatch_status = 'processing',
      last_attempt_at = pg_catalog.now(),
      next_attempt_at = NULL,
      attempt_count = COALESCE(d.attempt_count, 0) + 1,
      updated_at = pg_catalog.now()
    FROM eligible
    WHERE d.id = eligible.id
    RETURNING
      d.id,
      d.event_log_id,
      d.platform_name,
      d.dispatch_status,
      d.attempt_count
  )
  SELECT
    c.id AS dispatch_id,
    c.event_log_id,
    c.platform_name,
    c.dispatch_status,
    c.attempt_count,
    e.event_id,
    e.event_name,
    e.event_timestamp,
    e.payload AS event_payload,
    e.raw_payload AS event_raw_payload,
    e.schema_version AS event_schema_version,
    e.model_version AS event_model_version,
    e.rubric_version AS event_rubric_version,
    COALESCE(
      e.payload -> 'identity' ->> 'identityQuality',
      e.payload ->> 'identityQuality',
      'unknown'
    ) AS event_identity_quality,
    COALESCE(
      (e.payload ->> 'shouldSendMeta')::boolean,
      e.approved_for_ads,
      false
    ) AS should_send_meta,
    COALESCE(
      (e.payload ->> 'shouldSendGoogle')::boolean,
      e.approved_for_index,
      false
    ) AS should_send_google,
    e.client_slug AS event_client_slug,
    e.lead_id AS event_lead_id,
    e.scan_session_id AS event_scan_session_id,
    e.analysis_id AS event_analysis_id,
    e.quote_file_id AS event_quote_file_id
  FROM claimed AS c
  JOIN public.wm_event_log AS e ON e.id = c.event_log_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.wm_claim_dispatch_rows_scoped(
  integer,
  integer,
  public.wm_platform_name,
  uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.wm_claim_dispatch_rows_scoped(
  integer,
  integer,
  public.wm_platform_name,
  uuid
) TO service_role;

COMMIT;
```
