-- ============================================================================
-- TWILIO-OBS-03: Local draft — OTP/Twilio observability schema (additive only)
-- ============================================================================
--
-- Purpose: prepare durable audit/read-model tables for OTP send/verify lifecycle
--          and Twilio delivery callbacks without changing unlock authorization.
--
-- Invariants:
--   - Does not alter unlock logic (get_analysis_full / report-access unchanged).
--   - Does not store OTP codes.
--   - Does not store Twilio secrets or raw webhook signatures.
--   - Does not authorize report access.
--   - phone_verifications remains the canonical OTP verification/session table.
--   - otp_lifecycle_events and twilio_message_events are observability inputs only.
--   - Admin reads must later go through service-role admin functions (admin-data).
--
-- This migration does NOT instrument send-otp, verify-otp, or report-access.
-- ============================================================================

BEGIN;

-- ── Section 1: Extend phone_verifications (canonical OTP session table) ─────

ALTER TABLE public.phone_verifications
  ADD COLUMN IF NOT EXISTS twilio_verification_sid text,
  ADD COLUMN IF NOT EXISTS send_outcome text,
  ADD COLUMN IF NOT EXISTS twilio_send_error_code integer,
  ADD COLUMN IF NOT EXISTS twilio_send_error_message text,
  ADD COLUMN IF NOT EXISTS verify_attempt_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_verify_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_verify_error_code integer,
  ADD COLUMN IF NOT EXISTS verification_channel text,
  ADD COLUMN IF NOT EXISTS initiated_by text DEFAULT 'homeowner',
  ADD COLUMN IF NOT EXISTS initiated_by_user_id uuid;

COMMENT ON COLUMN public.phone_verifications.twilio_verification_sid IS
  'Twilio Verify Verification SID from send response. Observability only; not used for report unlock.';

COMMENT ON COLUMN public.phone_verifications.send_outcome IS
  'Outcome of the OTP send attempt: accepted, failed, rate_limited, lookup_rejected, or qa_bypass. Observability only.';

COMMENT ON COLUMN public.phone_verifications.twilio_send_error_code IS
  'Twilio REST error code when send_outcome indicates failure. Observability only.';

COMMENT ON COLUMN public.phone_verifications.twilio_send_error_message IS
  'Truncated user-safe send error message. Must not contain secrets or OTP codes.';

COMMENT ON COLUMN public.phone_verifications.verify_attempt_count IS
  'Count of verify attempts against this pending row. Updated by future verify-otp instrumentation.';

COMMENT ON COLUMN public.phone_verifications.last_verify_at IS
  'Timestamp of the most recent verify attempt. Observability only.';

COMMENT ON COLUMN public.phone_verifications.last_verify_error_code IS
  'Twilio REST error code from the most recent failed verify attempt. Observability only.';

COMMENT ON COLUMN public.phone_verifications.verification_channel IS
  'Channel used for verification: twilio_verify or qa_bypass. Observability only.';

COMMENT ON COLUMN public.phone_verifications.initiated_by IS
  'Who initiated the OTP send: homeowner, admin_resend, or system. Default homeowner.';

COMMENT ON COLUMN public.phone_verifications.initiated_by_user_id IS
  'Admin auth.users.id when initiated_by is admin_resend. NULL for homeowner sends.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'phone_verifications_send_outcome_check'
      AND conrelid = 'public.phone_verifications'::regclass
  ) THEN
    ALTER TABLE public.phone_verifications
      ADD CONSTRAINT phone_verifications_send_outcome_check
      CHECK (
        send_outcome IS NULL
        OR send_outcome IN (
          'accepted', 'failed', 'rate_limited', 'lookup_rejected', 'qa_bypass'
        )
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'phone_verifications_verification_channel_check'
      AND conrelid = 'public.phone_verifications'::regclass
  ) THEN
    ALTER TABLE public.phone_verifications
      ADD CONSTRAINT phone_verifications_verification_channel_check
      CHECK (
        verification_channel IS NULL
        OR verification_channel IN ('twilio_verify', 'qa_bypass')
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'phone_verifications_initiated_by_check'
      AND conrelid = 'public.phone_verifications'::regclass
  ) THEN
    ALTER TABLE public.phone_verifications
      ADD CONSTRAINT phone_verifications_initiated_by_check
      CHECK (
        initiated_by IS NULL
        OR initiated_by IN ('homeowner', 'admin_resend', 'system')
      ) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'phone_verifications_verify_attempt_count_check'
      AND conrelid = 'public.phone_verifications'::regclass
  ) THEN
    ALTER TABLE public.phone_verifications
      ADD CONSTRAINT phone_verifications_verify_attempt_count_check
      CHECK (
        verify_attempt_count IS NULL OR verify_attempt_count >= 0
      ) NOT VALID;
  END IF;
END $$;

-- ── Section 2: otp_lifecycle_events (append-only observability stream) ────────

CREATE TABLE IF NOT EXISTS public.otp_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_verification_id uuid NULL
    REFERENCES public.phone_verifications(id) ON DELETE CASCADE,
  lead_id uuid NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  scan_session_id uuid NULL REFERENCES public.scan_sessions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_status text NOT NULL,
  actor text NOT NULL,
  source text NOT NULL,
  twilio_error_code integer NULL,
  twilio_verification_sid text NULL,
  twilio_message_sid text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT otp_lifecycle_events_event_type_check CHECK (
    event_type IN (
      'send_requested',
      'send_accepted',
      'send_failed',
      'rate_limited',
      'session_expired',
      'verify_submitted',
      'verify_approved',
      'verify_failed',
      'report_full_authorized',
      'delivery_status',
      'admin_resend_requested',
      'admin_sms_sent',
      'admin_sms_failed',
      'sms_opt_out'
    )
  ),
  CONSTRAINT otp_lifecycle_events_event_status_check CHECK (
    event_status IN ('ok', 'failed', 'blocked', 'info')
  ),
  CONSTRAINT otp_lifecycle_events_actor_check CHECK (
    actor IN (
      'homeowner',
      'edge_send_otp',
      'edge_verify_otp',
      'edge_report_access',
      'admin',
      'system',
      'twilio_webhook'
    )
  ),
  CONSTRAINT otp_lifecycle_events_source_check CHECK (
    source IN (
      'send-otp',
      'verify-otp',
      'report-access',
      'twilio-status-webhook',
      'admin-data',
      'browser',
      'system'
    )
  ),
  CONSTRAINT otp_lifecycle_events_metadata_object_check CHECK (
    jsonb_typeof(metadata) = 'object'
  ),
  CONSTRAINT otp_lifecycle_events_phone_verification_binding_check CHECK (
    phone_verification_id IS NOT NULL
    OR (
      phone_verification_id IS NULL
      AND source = 'send-otp'
      AND event_type IN ('send_requested', 'rate_limited', 'send_failed')
      AND event_status IN ('info', 'blocked', 'failed')
      AND actor IN ('homeowner', 'edge_send_otp')
    )
  )
);

COMMENT ON TABLE public.otp_lifecycle_events IS
  'Append-only OTP/Twilio lifecycle audit stream. Does not authorize report unlock. '
  'phone_verification_id is required for normal verify/report lifecycle events; '
  'NULL is allowed only for pre-insert send-otp observability rows per binding CHECK. '
  'Null phone_verification_id rows are observability only and never authorize report access. '
  'Lookup rejection is send_failed with metadata.reason=lookup_rejected, not a separate event_type. '
  'No OTP codes or Twilio secrets stored. Admin reads via service-role admin functions only.';

COMMENT ON COLUMN public.otp_lifecycle_events.phone_verification_id IS
  'FK to phone_verifications. Required for verify, report, and post-insert send events. '
  'May be NULL only for pre-insert send-otp events (send_requested, rate_limited, send_failed) '
  'when source=send-otp and actor is homeowner or edge_send_otp. Observability only; not unlock authority.';

COMMENT ON COLUMN public.otp_lifecycle_events.metadata IS
  'Redacted JSON object only. Must not contain OTP codes, raw phone numbers, full_json, '
  'email, names, Twilio auth tokens, raw signatures, or unredacted Twilio payloads. '
  'Lookup rejection: use metadata.reason=lookup_rejected on send_failed/blocked rows. '
  'Edge Functions must redact before insert.';

-- ── Section 3: twilio_message_events (Twilio delivery callbacks) ─────────────

CREATE TABLE IF NOT EXISTS public.twilio_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  twilio_message_sid text NULL,
  twilio_verification_sid text NULL,
  phone_verification_id uuid NULL
    REFERENCES public.phone_verifications(id) ON DELETE SET NULL,
  lead_id uuid NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  scan_session_id uuid NULL REFERENCES public.scan_sessions(id) ON DELETE SET NULL,
  channel text NOT NULL,
  message_status text NOT NULL,
  error_code integer NULL,
  error_message text NULL,
  raw_payload_redacted jsonb NOT NULL DEFAULT '{}'::jsonb,
  phone_last4 text NULL,
  phone_hash text NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  twilio_timestamp timestamptz NULL,

  CONSTRAINT twilio_message_events_channel_check CHECK (
    channel IN ('verify_sms', 'admin_sms')
  ),
  CONSTRAINT twilio_message_events_message_status_check CHECK (
    message_status IN (
      'queued', 'sent', 'delivered', 'undelivered', 'failed', 'read', 'unknown'
    )
  ),
  CONSTRAINT twilio_message_events_raw_payload_object_check CHECK (
    jsonb_typeof(raw_payload_redacted) = 'object'
  ),
  CONSTRAINT twilio_message_events_phone_last4_check CHECK (
    phone_last4 IS NULL OR phone_last4 ~ '^[0-9]{4}$'
  ),
  CONSTRAINT twilio_message_events_phone_hash_check CHECK (
    phone_hash IS NULL OR phone_hash ~ '^[a-f0-9]{64}$'
  )
);

COMMENT ON TABLE public.twilio_message_events IS
  'Twilio SMS/Verify delivery status callbacks. Does not authorize report unlock. '
  'No full phone_e164, OTP codes, or Twilio secrets stored. Admin reads via service-role only.';

COMMENT ON COLUMN public.twilio_message_events.idempotency_key IS
  'Supplied by future webhook ingestion. Derive from stable Twilio callback identity '
  '(e.g. provider + MessageSid + status + event type) after redaction. Not computed in SQL.';

COMMENT ON COLUMN public.twilio_message_events.raw_payload_redacted IS
  'Redacted webhook payload object only. Must be redacted before insert by Edge Function. '
  'Must not contain OTP codes, raw phone numbers, full_json, email, names, Twilio auth tokens, '
  'raw signatures, or unredacted Twilio payloads.';

COMMENT ON COLUMN public.twilio_message_events.phone_hash IS
  'Lowercase hex SHA-256/HMAC of normalized E.164 + server-only pepper. '
  'Computed by future Edge Function only. No DB secret, trigger, or hashing function in this migration.';

COMMENT ON COLUMN public.twilio_message_events.phone_last4 IS
  'Last four digits of destination phone for admin correlation. No full E.164 in this table.';

-- Future webhook ingestion should derive idempotency_key from stable Twilio callback
-- identity such as provider + message SID + status + timestamp/event type, after redaction.

-- ── Section 4: Indexes ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_phone_verifications_created_at_desc
  ON public.phone_verifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_status_created_at_desc
  ON public.phone_verifications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_twilio_verification_sid
  ON public.phone_verifications (twilio_verification_sid)
  WHERE twilio_verification_sid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_lifecycle_events_phone_verification_created_at
  ON public.otp_lifecycle_events (phone_verification_id, created_at);

CREATE INDEX IF NOT EXISTS idx_otp_lifecycle_events_scan_session_created_at_desc
  ON public.otp_lifecycle_events (scan_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_lifecycle_events_lead_created_at_desc
  ON public.otp_lifecycle_events (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_lifecycle_events_event_type_created_at_desc
  ON public.otp_lifecycle_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_lifecycle_events_twilio_message_sid
  ON public.otp_lifecycle_events (twilio_message_sid)
  WHERE twilio_message_sid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_lifecycle_events_unbound_preinsert_created_at_desc
  ON public.otp_lifecycle_events (event_type, created_at DESC)
  WHERE phone_verification_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_twilio_message_events_twilio_message_sid
  ON public.twilio_message_events (twilio_message_sid)
  WHERE twilio_message_sid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_twilio_message_events_twilio_verification_sid
  ON public.twilio_message_events (twilio_verification_sid)
  WHERE twilio_verification_sid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_twilio_message_events_phone_verification_id
  ON public.twilio_message_events (phone_verification_id);

CREATE INDEX IF NOT EXISTS idx_twilio_message_events_message_status_received_at_desc
  ON public.twilio_message_events (message_status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_twilio_message_events_received_at_desc
  ON public.twilio_message_events (received_at DESC);

-- ── Section 5: RLS (service-role only; matches phone_verifications posture) ───

ALTER TABLE public.otp_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twilio_message_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'otp_lifecycle_events'
      AND policyname = 'otp_lifecycle_events_service_role_all'
  ) THEN
    CREATE POLICY "otp_lifecycle_events_service_role_all"
      ON public.otp_lifecycle_events FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'twilio_message_events'
      AND policyname = 'twilio_message_events_service_role_all'
  ) THEN
    CREATE POLICY "twilio_message_events_service_role_all"
      ON public.twilio_message_events FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE
  ON public.otp_lifecycle_events, public.twilio_message_events
  FROM anon, authenticated;

-- ── Section 7: Explicitly deferred ───────────────────────────────────────────
--
-- Deferred to later sprints:
-- - TWILIO-OBS-04 Edge Function instrumentation
-- - TWILIO-OBS-05 Admin read model and dashboard
-- - TWILIO-OBS-06 Twilio webhook ingestion
-- - TWILIO-OBS-07 safe resend planning
-- - TWILIO-ADMIN-SMS-08 admin SMS composer
--
-- Explicitly not included in this migration:
-- - admin_sms_messages
-- - lead_communications
-- - Twilio webhook Edge Function
-- - admin dashboard UI
-- - send-otp writes
-- - verify-otp writes
-- - report-access writes
-- - lead_events writes
-- - lead_events CHECK constraint changes
-- - phone number hashing SQL function
-- - database triggers
-- - SECURITY DEFINER RPCs
-- - admin views

COMMIT;
