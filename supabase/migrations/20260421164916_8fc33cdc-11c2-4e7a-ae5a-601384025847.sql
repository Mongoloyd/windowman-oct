DO $$
DECLARE
  v_dispatch_url    text;
  v_dispatch_secret text;
  v_jobid           bigint;
BEGIN
  SELECT decrypted_secret INTO v_dispatch_url
    FROM vault.decrypted_secrets WHERE name = 'dispatch_lead_url';
  SELECT decrypted_secret INTO v_dispatch_secret
    FROM vault.decrypted_secrets WHERE name = 'dispatch_lead_secret';

  IF v_dispatch_url IS NULL OR v_dispatch_secret IS NULL THEN
    -- Vault secrets absent on clean/local replay — skip cron scheduling.
    -- In production/staging, boot dispatch-lead once to self-seed before relying on this job.
    RAISE NOTICE 'dispatch_lead_url / dispatch_lead_secret not present in Vault — skipping cron schedule. Boot dispatch-lead once to self-seed.';
    RETURN;
  END IF;

  -- Idempotently unschedule the legacy minute job (process-webhook caller)
  -- and any prior incarnation of the new job, by name.
  FOR v_jobid IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('process-webhooks-every-minute', 'dispatch-lead-every-minute')
  LOOP
    PERFORM cron.unschedule(v_jobid);
  END LOOP;

  -- Reschedule against the canonical Sprint 5 dispatcher (drain mode).
  PERFORM cron.schedule(
    'dispatch-lead-every-minute',
    '* * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type',     'application/json',
          'x-dispatch-secret', %L
        ),
        body := jsonb_build_object('limit', 25),
        timeout_milliseconds := 8000
      ) AS request_id;
    $cron$, v_dispatch_url, v_dispatch_secret)
  );
END
$$;