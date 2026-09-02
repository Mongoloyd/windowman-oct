-- Prepare, but do not activate, the report-summary worker schedule.
--
-- Activation is a separate postgres-operator decision:
--   SELECT * FROM public.activate_report_summary_schedules_v1();
--
-- Kill switch:
--   SELECT * FROM public.deactivate_report_summary_schedules_v1();
--
-- This migration never schedules cron jobs, never writes Vault, and never
-- invokes report-summary-worker.
--
-- Required Vault secrets (operator-configured; never committed):
--   report_summary_worker_url
--   report_summary_worker_secret

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'report-summary-worker-v1'
  ) THEN
    RAISE EXCEPTION
      'report-summary schedule already exists; refuse to replace it during prepare';
  END IF;
END;
$guard$;

CREATE OR REPLACE FUNCTION public.activate_report_summary_schedules_v1()
RETURNS TABLE(
  worker_jobid bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_expected_url constant text :=
    'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/report-summary-worker';
  v_url_count integer;
  v_url text;
  v_secret_count integer;
  v_secret text;
  v_existing_jobid bigint;
  v_worker_jobid bigint;
  v_worker_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('report-summary-schedules-v1', 0)
  );

  SELECT pg_catalog.count(*)::integer, pg_catalog.min(decrypted_secret)
  INTO v_url_count, v_url
  FROM vault.decrypted_secrets
  WHERE name = 'report_summary_worker_url';

  IF v_url_count IS DISTINCT FROM 1
    OR pg_catalog.btrim(coalesce(v_url, '')) = ''
  THEN
    RAISE EXCEPTION
      'report_summary_worker_url must exist exactly once in Vault';
  END IF;

  IF v_url IS DISTINCT FROM v_expected_url THEN
    RAISE EXCEPTION
      'report_summary_worker_url does not match the approved LIVE_ACTIVE endpoint';
  END IF;

  SELECT pg_catalog.count(*)::integer, pg_catalog.min(decrypted_secret)
  INTO v_secret_count, v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'report_summary_worker_secret';

  IF v_secret_count IS DISTINCT FROM 1
    OR pg_catalog.btrim(coalesce(v_secret, '')) = ''
  THEN
    RAISE EXCEPTION
      'report_summary_worker_secret must exist exactly once in Vault';
  END IF;

  FOR v_existing_jobid IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'report-summary-worker-v1'
    ORDER BY jobid
  LOOP
    IF cron.unschedule(v_existing_jobid) IS DISTINCT FROM true THEN
      RAISE EXCEPTION
        'failed to remove existing report-summary schedule job';
    END IF;
  END LOOP;

  SELECT cron.schedule(
    'report-summary-worker-v1',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'report_summary_worker_url'
            AND decrypted_secret = 'https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/report-summary-worker'
        ),
        headers := pg_catalog.jsonb_build_object(
          'Content-Type', 'application/json',
          'x-report-summary-worker-secret', (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'report_summary_worker_secret'
          )
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
      ) AS request_id;
    $cron$
  )
  INTO v_worker_jobid;

  SELECT pg_catalog.count(*)::integer
  INTO v_worker_count
  FROM cron.job
  WHERE jobname = 'report-summary-worker-v1';

  IF v_worker_jobid IS NULL
    OR v_worker_count IS DISTINCT FROM 1
  THEN
    RAISE EXCEPTION
      'report-summary schedule activation invariant failed';
  END IF;

  RETURN QUERY
  SELECT v_worker_jobid;
END;
$function$;

ALTER FUNCTION public.activate_report_summary_schedules_v1()
OWNER TO postgres;

REVOKE ALL
ON FUNCTION public.activate_report_summary_schedules_v1()
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.activate_report_summary_schedules_v1() IS
  'Postgres-operator-only activation for report-summary-worker schedule. Creating this function does not schedule a cron job.';

CREATE OR REPLACE FUNCTION public.deactivate_report_summary_schedules_v1()
RETURNS TABLE(
  worker_jobs_removed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_existing_jobid bigint;
  v_worker_removed integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('report-summary-schedules-v1', 0)
  );

  SELECT pg_catalog.count(*)::integer
  INTO v_worker_removed
  FROM cron.job
  WHERE jobname = 'report-summary-worker-v1';

  FOR v_existing_jobid IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'report-summary-worker-v1'
    ORDER BY jobid
  LOOP
    IF cron.unschedule(v_existing_jobid) IS DISTINCT FROM true THEN
      RAISE EXCEPTION
        'failed to remove existing report-summary schedule job';
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT v_worker_removed;
END;
$function$;

ALTER FUNCTION public.deactivate_report_summary_schedules_v1()
OWNER TO postgres;

REVOKE ALL
ON FUNCTION public.deactivate_report_summary_schedules_v1()
FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.deactivate_report_summary_schedules_v1() IS
  'Postgres-operator-only kill switch for report-summary-worker schedule. Does not delete Summary rows.';

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'report-summary-worker-v1'
  ) THEN
    RAISE EXCEPTION
      'prepare_report_summary_schedules_v1 must not create cron jobs';
  END IF;
END;
$guard$;
