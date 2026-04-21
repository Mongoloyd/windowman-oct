
-- ═══════════════════════════════════════════════════════════════════════════
-- Sprint 5 — Deterministic lead delivery dispatcher (Part 1: schema)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. Wipe legacy test rows (operator-confirmed) ────────────────────────
DELETE FROM public.webhook_deliveries;

-- ─── 1. Enable pg_net for trigger → edge function call ────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─── 2. Evolve webhook_deliveries: queue/state row with routing snapshot ──
ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS client_slug          text,
  ADD COLUMN IF NOT EXISTS contractor_id        uuid,
  ADD COLUMN IF NOT EXISTS assignment_id        uuid,
  ADD COLUMN IF NOT EXISTS dispatch_method      text,
  ADD COLUMN IF NOT EXISTS destination_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS no_route_reason      text,
  ADD COLUMN IF NOT EXISTS resolved_at          timestamptz,
  ADD COLUMN IF NOT EXISTS terminal_at          timestamptz;

-- Replace the legacy status check (if any) with the Sprint 5 vocabulary.
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.webhook_deliveries'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.webhook_deliveries DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE public.webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_status_check
  CHECK (status IN (
    'pending',          -- enqueued, awaiting dispatch
    'processing',       -- claimed by a dispatcher worker
    'delivered',        -- terminal: at least one attempt returned 2xx
    'failed',           -- transient failure; will retry
    'dead_letter',      -- terminal: max retries exceeded
    'unroutable',       -- terminal: resolve_route_for_lead returned resolved=false
    'mock_delivered'    -- legacy sentinel; not produced by Sprint 5+ code
  ));

-- ─── 3. Indexes for the dispatcher claim path & admin views ──────────────
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending_claim
  ON public.webhook_deliveries (created_at ASC)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_client_slug
  ON public.webhook_deliveries (client_slug, created_at DESC)
  WHERE client_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_contractor_id
  ON public.webhook_deliveries (contractor_id, created_at DESC)
  WHERE contractor_id IS NOT NULL;

-- ─── 4. Append-only attempt log (immutable proof) ────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_delivery_attempts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id           uuid NOT NULL REFERENCES public.webhook_deliveries(id) ON DELETE CASCADE,
  lead_id               uuid NOT NULL,
  client_slug           text,
  contractor_id         uuid,
  assignment_id         uuid,
  dispatch_method       text NOT NULL,
  destination_snapshot  jsonb NOT NULL,                          -- e.g. { "url": "https://...", "method": "POST" } or { "email": "..." }
  attempt_number        integer NOT NULL CHECK (attempt_number >= 1),
  request_started_at    timestamptz NOT NULL DEFAULT now(),
  request_completed_at  timestamptz,
  duration_ms           integer,
  response_status_code  integer,
  response_body_snippet text,                                    -- truncated to 2KB for safety
  success               boolean NOT NULL,
  outcome               text NOT NULL CHECK (outcome IN (
                          'http_2xx',
                          'http_4xx',
                          'http_5xx',
                          'http_redirect',
                          'timeout',
                          'network_error',
                          'resend_accepted',
                          'resend_rejected',
                          'unsupported_dispatch_method',
                          'missing_destination',
                          'exception'
                        )),
  error_class           text,
  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wd_attempts_delivery_id
  ON public.webhook_delivery_attempts (delivery_id, attempt_number DESC);

CREATE INDEX IF NOT EXISTS idx_wd_attempts_lead_id
  ON public.webhook_delivery_attempts (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wd_attempts_client_slug
  ON public.webhook_delivery_attempts (client_slug, created_at DESC)
  WHERE client_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wd_attempts_contractor_id
  ON public.webhook_delivery_attempts (contractor_id, created_at DESC)
  WHERE contractor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wd_attempts_failures
  ON public.webhook_delivery_attempts (created_at DESC)
  WHERE success = false;

ALTER TABLE public.webhook_delivery_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY wda_select_internal       ON public.webhook_delivery_attempts FOR SELECT TO authenticated USING (is_internal_operator());
CREATE POLICY wda_service_role_all      ON public.webhook_delivery_attempts FOR ALL    TO service_role  USING (true) WITH CHECK (true);

-- Immutability: block UPDATE / DELETE for everyone except service_role
-- (service_role still bypasses RLS, so this is a defense-in-depth guard
-- against accidental updates from authenticated operator sessions).
CREATE OR REPLACE FUNCTION public.reject_wda_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'webhook_delivery_attempts is append-only — % is not allowed', TG_OP
    USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER trg_wda_no_update
  BEFORE UPDATE ON public.webhook_delivery_attempts
  FOR EACH ROW EXECUTE FUNCTION public.reject_wda_mutation();

CREATE TRIGGER trg_wda_no_delete
  BEFORE DELETE ON public.webhook_delivery_attempts
  FOR EACH ROW EXECUTE FUNCTION public.reject_wda_mutation();

-- ─── 5. Upgrade fire_crm_handoff: stamp routing snapshot at enqueue ──────
CREATE OR REPLACE FUNCTION public.fire_crm_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_id   uuid;
  v_route         record;
  v_status        text;
  v_destination   jsonb;
  v_payload       jsonb;
  v_dispatch_url  text;
  v_dispatch_sec  text;
BEGIN
  IF NOT (
    NEW.phone_verified = true
    AND NEW.latest_analysis_id IS NOT NULL
    AND (OLD.phone_verified = false OR OLD.latest_analysis_id IS NULL)
  ) THEN
    RETURN NEW;
  END IF;

  -- 1. Resolve route deterministically (Sprint 4).
  SELECT * INTO v_route
  FROM public.resolve_route_for_lead(NEW.id)
  LIMIT 1;

  IF v_route.resolved THEN
    v_status      := 'pending';
    v_destination := jsonb_build_object(
      'dispatch_method', v_route.dispatch_method,
      'webhook_url',     v_route.crm_webhook_url,
      'email',           v_route.crm_email,
      'company_name',    v_route.company_name
    );
  ELSE
    v_status      := 'unroutable';
    v_destination := NULL;
  END IF;

  -- 2. Initial payload snapshot (small, safe — full brief is loaded at dispatch time).
  v_payload := jsonb_build_object(
    'lead_id',           NEW.id,
    'client_slug',       NEW.client_slug,
    'analysis_id',       NEW.latest_analysis_id,
    'phone_verified_at', NEW.phone_verified_at,
    'enqueued_at',       now()
  );

  -- 3. Idempotent enqueue.
  INSERT INTO public.webhook_deliveries (
    lead_id, event_type, status,
    payload_json, webhook_url,
    client_slug, contractor_id, assignment_id,
    dispatch_method, destination_snapshot, no_route_reason,
    resolved_at, terminal_at
  ) VALUES (
    NEW.id, 'qualified_lead', v_status,
    v_payload, v_route.crm_webhook_url,
    NEW.client_slug, v_route.contractor_id, v_route.assignment_id,
    v_route.dispatch_method, v_destination, v_route.no_route_reason,
    CASE WHEN v_route.resolved THEN now() ELSE NULL END,
    CASE WHEN v_status = 'unroutable' THEN now() ELSE NULL END
  )
  ON CONFLICT ON CONSTRAINT idx_webhook_deliveries_lead_event_unique
    DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    RETURN NEW;  -- already queued, no audit duplication
  END IF;

  INSERT INTO public.lead_events (lead_id, event_name, event_source, metadata)
  VALUES (
    NEW.id,
    CASE WHEN v_status = 'unroutable' THEN 'crm_handoff_unroutable' ELSE 'crm_handoff_queued' END,
    'db_trigger',
    jsonb_build_object(
      'analysis_id',         NEW.latest_analysis_id,
      'phone_verified_at',   NEW.phone_verified_at,
      'webhook_delivery_id', v_inserted_id,
      'client_slug',         NEW.client_slug,
      'contractor_id',       v_route.contractor_id,
      'assignment_id',       v_route.assignment_id,
      'dispatch_method',     v_route.dispatch_method,
      'no_route_reason',     v_route.no_route_reason,
      'triggered_at',        now()
    )
  );

  RAISE LOG '[CRM:HANDOFF:ENQUEUED] {"lead_id":"%","delivery_id":"%","status":"%","contractor_id":"%","dispatch_method":"%"}',
    NEW.id, v_inserted_id, v_status, v_route.contractor_id, v_route.dispatch_method;

  -- 4. Wake the dispatcher (best-effort; cron is the safety net).
  --    Only fire pg_net for routable rows.
  IF v_status = 'pending' THEN
    BEGIN
      SELECT decrypted_secret INTO v_dispatch_url
        FROM vault.decrypted_secrets WHERE name = 'dispatch_lead_url';
      SELECT decrypted_secret INTO v_dispatch_sec
        FROM vault.decrypted_secrets WHERE name = 'dispatch_lead_secret';

      IF v_dispatch_url IS NOT NULL AND v_dispatch_sec IS NOT NULL THEN
        PERFORM extensions.http_post(
          url     := v_dispatch_url,
          headers := jsonb_build_object(
                       'Content-Type',     'application/json',
                       'x-dispatch-secret', v_dispatch_sec
                     ),
          body    := jsonb_build_object('delivery_id', v_inserted_id),
          timeout_milliseconds := 2000
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG '[CRM:HANDOFF:NET_WAKE_FAILED] {"delivery_id":"%","error":"%"}',
        v_inserted_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 6. Admin views ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_admin_recent_deliveries
WITH (security_invoker = true) AS
SELECT
  d.id                AS delivery_id,
  d.lead_id,
  d.event_type,
  d.status,
  d.client_slug,
  d.contractor_id,
  d.assignment_id,
  d.dispatch_method,
  d.no_route_reason,
  d.attempt_count,
  d.last_http_status,
  d.created_at,
  d.last_attempt_at,
  d.terminal_at,
  ct.company_name,
  l.first_name        AS lead_first_name,
  l.email             AS lead_email
FROM public.webhook_deliveries d
LEFT JOIN public.contractors ct ON ct.id = d.contractor_id
LEFT JOIN public.leads        l ON l.id  = d.lead_id
ORDER BY d.created_at DESC
LIMIT 200;

CREATE OR REPLACE VIEW public.v_admin_failed_deliveries
WITH (security_invoker = true) AS
SELECT
  d.id              AS delivery_id,
  d.lead_id,
  d.client_slug,
  d.contractor_id,
  ct.company_name,
  d.dispatch_method,
  d.status,
  d.no_route_reason,
  d.attempt_count,
  d.last_http_status,
  d.last_error,
  d.created_at,
  d.last_attempt_at,
  (SELECT count(*) FROM public.webhook_delivery_attempts a WHERE a.delivery_id = d.id) AS attempt_log_count
FROM public.webhook_deliveries d
LEFT JOIN public.contractors ct ON ct.id = d.contractor_id
WHERE d.status IN ('failed','dead_letter','unroutable')
ORDER BY d.created_at DESC
LIMIT 200;

CREATE OR REPLACE VIEW public.v_admin_deliveries_by_client
WITH (security_invoker = true) AS
SELECT
  COALESCE(d.client_slug, '(null)')                                AS client_slug,
  count(*)                                                          AS total,
  count(*) FILTER (WHERE d.status = 'pending')                      AS pending,
  count(*) FILTER (WHERE d.status = 'processing')                   AS processing,
  count(*) FILTER (WHERE d.status = 'delivered')                    AS delivered,
  count(*) FILTER (WHERE d.status = 'failed')                       AS failed,
  count(*) FILTER (WHERE d.status = 'dead_letter')                  AS dead_letter,
  count(*) FILTER (WHERE d.status = 'unroutable')                   AS unroutable,
  max(d.created_at)                                                 AS most_recent_at
FROM public.webhook_deliveries d
GROUP BY COALESCE(d.client_slug, '(null)')
ORDER BY total DESC;

CREATE OR REPLACE VIEW public.v_admin_deliveries_by_contractor
WITH (security_invoker = true) AS
SELECT
  d.contractor_id,
  ct.company_name,
  count(*)                                                          AS total,
  count(*) FILTER (WHERE d.status = 'delivered')                    AS delivered,
  count(*) FILTER (WHERE d.status IN ('failed','dead_letter'))      AS failed_or_dead,
  count(*) FILTER (WHERE d.status = 'pending')                      AS pending,
  max(d.created_at)                                                 AS most_recent_at,
  count(DISTINCT d.client_slug)                                     AS distinct_clients
FROM public.webhook_deliveries d
LEFT JOIN public.contractors ct ON ct.id = d.contractor_id
WHERE d.contractor_id IS NOT NULL
GROUP BY d.contractor_id, ct.company_name
ORDER BY total DESC;

-- ─── 7. Claim function for the dispatcher worker ─────────────────────────
-- SELECT … FOR UPDATE SKIP LOCKED so concurrent workers never collide.
CREATE OR REPLACE FUNCTION public.claim_pending_deliveries(p_limit integer DEFAULT 25)
RETURNS TABLE (
  delivery_id          uuid,
  lead_id              uuid,
  client_slug          text,
  contractor_id        uuid,
  assignment_id        uuid,
  dispatch_method      text,
  destination_snapshot jsonb,
  attempt_count        integer,
  payload_json         jsonb,
  webhook_url          text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT d.id
    FROM public.webhook_deliveries d
    WHERE d.status IN ('pending','failed')
      AND (d.next_retry_at IS NULL OR d.next_retry_at <= now())
      AND d.dispatch_method IS NOT NULL
      AND d.destination_snapshot IS NOT NULL
    ORDER BY d.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  ),
  flipped AS (
    UPDATE public.webhook_deliveries d
    SET status          = 'processing',
        last_attempt_at = now(),
        updated_at      = now()
    FROM claimed
    WHERE d.id = claimed.id
    RETURNING d.id
  )
  SELECT
    d.id, d.lead_id, d.client_slug, d.contractor_id, d.assignment_id,
    d.dispatch_method, d.destination_snapshot, d.attempt_count,
    d.payload_json, d.webhook_url
  FROM public.webhook_deliveries d
  JOIN flipped f ON f.id = d.id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_deliveries(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_deliveries(integer) TO service_role;
