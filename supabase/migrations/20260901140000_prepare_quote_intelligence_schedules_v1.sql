-- Prepare, but do not activate, the quote-intelligence discovery and worker schedules.
--
-- Activation is a separate postgres-operator decision:
--   SELECT * FROM public.activate_quote_intelligence_schedules_v1();
--
-- Kill switch:
--   SELECT * FROM public.deactivate_quote_intelligence_schedules_v1();
--
-- This migration never schedules cron jobs, never writes Vault, and never
-- invokes quote-intelligence-worker.

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname IN (
      'quote-intelligence-discover-v1',
      'quote-intelligence-worker-v1'
    )
  ) THEN
    RAISE EXCEPTION
      'quote-intelligence schedules already exist; refuse to replace them during prepare';
  END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.activate_quote_intelligence_schedules_v1(
  p_discovery_limit integer DEFAULT 3
)
RETURNS TABLE(
  discovery_jobid bigint,
  worker_jobid bigint,
  discovery_limit integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_expected_url constant text :=
    'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/quote-intelligence-worker';
  v_url_count integer;
  v_url text;
  v_secret_count integer;
  v_secret text;
  v_existing_jobid bigint;
  v_discovery_jobid bigint;
  v_worker_jobid bigint;
  v_discovery_command text;
  v_discovery_count integer;
  v_worker_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quote-intelligence-schedules-v1', 0)
  );

  IF p_discovery_limit < 1 OR p_discovery_limit > 25 THEN
    RAISE EXCEPTION
      'p_discovery_limit must be between 1 and 25 inclusive'
      USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.count(*)::integer, pg_catalog.min(decrypted_secret)
  INTO v_url_count, v_url
  FROM vault.decrypted_secrets
  WHERE name = 'quote_intelligence_worker_url';

  IF v_url_count IS DISTINCT FROM 1
    OR pg_catalog.btrim(coalesce(v_url, '')) = ''
  THEN
    RAISE EXCEPTION
      'quote_intelligence_worker_url must exist exactly once in Vault';
  END IF;

  IF v_url IS DISTINCT FROM v_expected_url THEN
    RAISE EXCEPTION
      'quote_intelligence_worker_url does not match the approved LIVE_ACTIVE endpoint';
  END IF;

  SELECT pg_catalog.count(*)::integer, pg_catalog.min(decrypted_secret)
  INTO v_secret_count, v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'quote_intelligence_worker_secret';

  IF v_secret_count IS DISTINCT FROM 1
    OR pg_catalog.length(pg_catalog.btrim(coalesce(v_secret, ''))) < 64
  THEN
    RAISE EXCEPTION
      'quote_intelligence_worker_secret must exist exactly once in Vault';
  END IF;

  FOR v_existing_jobid IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'quote-intelligence-discover-v1',
      'quote-intelligence-worker-v1'
    )
    ORDER BY jobid
  LOOP
    IF cron.unschedule(v_existing_jobid) IS DISTINCT FROM true THEN
      RAISE EXCEPTION
        'failed to remove existing quote-intelligence schedule job';
    END IF;
  END LOOP;

  v_discovery_command := pg_catalog.format(
    'SELECT public.wm_discover_quote_intelligence_jobs(%s, ''quote_document_header'', ''v1'', ''p1'');',
    p_discovery_limit
  );

  SELECT cron.schedule(
    'quote-intelligence-discover-v1',
    '*/15 * * * *',
    v_discovery_command
  )
  INTO v_discovery_jobid;

  SELECT cron.schedule(
    'quote-intelligence-worker-v1',
    '2-59/5 * * * *',
    $cron$
      SELECT net.http_post(
        url := (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'quote_intelligence_worker_url'
            AND decrypted_secret = 'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/quote-intelligence-worker'
        ),
        headers := pg_catalog.jsonb_build_object(
          'Content-Type', 'application/json',
          'x-quote-intelligence-worker-secret', (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'quote_intelligence_worker_secret'
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
      ) AS request_id;
    $cron$
  )
  INTO v_worker_jobid;

  SELECT pg_catalog.count(*)::integer
  INTO v_discovery_count
  FROM cron.job
  WHERE jobname = 'quote-intelligence-discover-v1';

  SELECT pg_catalog.count(*)::integer
  INTO v_worker_count
  FROM cron.job
  WHERE jobname = 'quote-intelligence-worker-v1';

  IF v_discovery_jobid IS NULL
    OR v_worker_jobid IS NULL
    OR v_discovery_count IS DISTINCT FROM 1
    OR v_worker_count IS DISTINCT FROM 1
  THEN
    RAISE EXCEPTION
      'quote-intelligence schedule activation invariant failed';
  END IF;

  RETURN QUERY
  SELECT v_discovery_jobid, v_worker_jobid, p_discovery_limit;
END;
$function$;

ALTER FUNCTION public.activate_quote_intelligence_schedules_v1(integer)
OWNER TO postgres;

REVOKE ALL
ON FUNCTION public.activate_quote_intelligence_schedules_v1(integer)
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.activate_quote_intelligence_schedules_v1(integer) IS
  'Postgres-operator-only activation for quote-intelligence discovery and worker schedules. Creating this function does not schedule a cron job.';

CREATE OR REPLACE FUNCTION public.deactivate_quote_intelligence_schedules_v1()
RETURNS TABLE(
  discovery_jobs_removed integer,
  worker_jobs_removed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_existing_jobid bigint;
  v_discovery_removed integer;
  v_worker_removed integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quote-intelligence-schedules-v1', 0)
  );

  SELECT pg_catalog.count(*)::integer
  INTO v_discovery_removed
  FROM cron.job
  WHERE jobname = 'quote-intelligence-discover-v1';

  SELECT pg_catalog.count(*)::integer
  INTO v_worker_removed
  FROM cron.job
  WHERE jobname = 'quote-intelligence-worker-v1';

  FOR v_existing_jobid IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'quote-intelligence-discover-v1',
      'quote-intelligence-worker-v1'
    )
    ORDER BY jobid
  LOOP
    IF cron.unschedule(v_existing_jobid) IS DISTINCT FROM true THEN
      RAISE EXCEPTION
        'failed to remove existing quote-intelligence schedule job';
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT v_discovery_removed, v_worker_removed;
END;
$function$;

ALTER FUNCTION public.deactivate_quote_intelligence_schedules_v1()
OWNER TO postgres;

REVOKE ALL
ON FUNCTION public.deactivate_quote_intelligence_schedules_v1()
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.deactivate_quote_intelligence_schedules_v1() IS
  'Postgres-operator-only kill switch for quote-intelligence discovery and worker schedules. Does not delete intelligence data.';

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname IN (
      'quote-intelligence-discover-v1',
      'quote-intelligence-worker-v1'
    )
  ) THEN
    RAISE EXCEPTION
      'prepare_quote_intelligence_schedules_v1 must not create cron jobs';
  END IF;
END;
$guard$;
