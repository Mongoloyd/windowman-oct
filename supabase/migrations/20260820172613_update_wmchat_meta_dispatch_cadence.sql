-- Fix forward the prepared WMChat Meta dispatch cadence from every minute to
-- every five minutes. This migration only replaces the postgres-only
-- activation function; it never calls it and never creates a cron job.

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'wmchat-meta-lead-dispatch-v1'
  ) THEN
    RAISE EXCEPTION
      'wmchat-meta-lead-dispatch-v1 must be disabled before cadence replacement';
  END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.activate_wmchat_meta_lead_dispatch_v1()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_expected_url constant text :=
    'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/dispatch-platform-events';
  v_url_count integer;
  v_url text;
  v_secret_count integer;
  v_secret text;
  v_existing_jobid bigint;
  v_jobid bigint;
  v_job_count integer;
BEGIN
  -- Serialize repeated or concurrent activation attempts without touching any
  -- other cron job.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wmchat-meta-lead-dispatch-v1', 0)
  );

  SELECT pg_catalog.count(*)::integer, pg_catalog.min(decrypted_secret)
  INTO v_url_count, v_url
  FROM vault.decrypted_secrets
  WHERE name = 'wmchat_meta_dispatch_url';

  IF v_url_count IS DISTINCT FROM 1
    OR pg_catalog.btrim(coalesce(v_url, '')) = ''
  THEN
    RAISE EXCEPTION
      'wmchat_meta_dispatch_url must exist exactly once in Vault';
  END IF;

  IF v_url IS DISTINCT FROM v_expected_url THEN
    RAISE EXCEPTION
      'wmchat_meta_dispatch_url does not match the approved production endpoint';
  END IF;

  SELECT pg_catalog.count(*)::integer, pg_catalog.min(decrypted_secret)
  INTO v_secret_count, v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'wmchat_meta_dispatch_worker_secret';

  IF v_secret_count IS DISTINCT FROM 1
    OR pg_catalog.length(pg_catalog.btrim(coalesce(v_secret, ''))) < 64
  THEN
    RAISE EXCEPTION
      'wmchat_meta_dispatch_worker_secret must exist exactly once in Vault';
  END IF;

  FOR v_existing_jobid IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'wmchat-meta-lead-dispatch-v1'
    ORDER BY jobid
  LOOP
    IF cron.unschedule(v_existing_jobid) IS DISTINCT FROM true THEN
      RAISE EXCEPTION
        'failed to remove existing wmchat-meta-lead-dispatch-v1 job';
    END IF;
  END LOOP;

  -- The command resolves the credential from Vault for every invocation.
  -- No decrypted secret is interpolated into cron.job.command.
  SELECT cron.schedule(
    'wmchat-meta-lead-dispatch-v1',
    '*/5 * * * *',
    $cron$
      SELECT net.http_post(
        url := (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'wmchat_meta_dispatch_url'
            AND decrypted_secret = 'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/dispatch-platform-events'
        ),
        headers := pg_catalog.jsonb_build_object(
          'Content-Type', 'application/json',
          'x-dispatch-secret', (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'wmchat_meta_dispatch_worker_secret'
          )
        ),
        body := pg_catalog.jsonb_build_object(
          'limit', 25,
          'target_platform', 'meta',
          'target_event_name', 'lead_captured'
        ),
        timeout_milliseconds := 8000
      ) AS request_id;
    $cron$
  )
  INTO v_jobid;

  SELECT pg_catalog.count(*)::integer
  INTO v_job_count
  FROM cron.job
  WHERE jobname = 'wmchat-meta-lead-dispatch-v1';

  IF v_jobid IS NULL OR v_job_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION
      'wmchat-meta-lead-dispatch-v1 activation invariant failed';
  END IF;

  RETURN v_jobid;
END;
$function$;

ALTER FUNCTION public.activate_wmchat_meta_lead_dispatch_v1()
OWNER TO postgres;

REVOKE ALL
ON FUNCTION public.activate_wmchat_meta_lead_dispatch_v1()
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.activate_wmchat_meta_lead_dispatch_v1() IS
  'Postgres-operator-only activation for the five-minute scoped WMChat Meta lead dispatcher. Creating or replacing this function does not schedule a cron job.';
