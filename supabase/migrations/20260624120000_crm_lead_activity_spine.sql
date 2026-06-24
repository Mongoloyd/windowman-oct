-- CRM Lead Event Spine (Sprint 1): denormalized latest-activity columns on leads
-- and expanded lead_events.event_name allowlist for capture-path CRM activities.
--
-- Does NOT touch lead_events_event_source_check — edge_function is already allowed
-- per 20260407073646_2fe08fc2-3695-4a5f-90f9-f444462bafe8.sql.
--
-- Backfill policy (conservative): only operator-safe event names are used when
-- populating leads.latest_activity_type / last_activity_at from existing rows.
-- Backfill-safe names: scan_completed, report_unlocked, appointment_booked,
-- crm_handoff_queued (clear milestone labels for operators).

-- 1) Additive nullable columns on leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS latest_activity_type text;

COMMENT ON COLUMN public.leads.last_activity_at IS
  'Denormalized snapshot: timestamp of the most recent CRM-grade lead_events row (guarded update in emitLeadActivity).';

COMMENT ON COLUMN public.leads.latest_activity_type IS
  'Denormalized snapshot: event_name of the most recent CRM-grade lead_events row (guarded update in emitLeadActivity).';

-- 2) Expand lead_events.event_name CHECK (preserve all values from 20260422193520)
ALTER TABLE public.lead_events
  DROP CONSTRAINT IF EXISTS lead_events_event_name_check;

ALTER TABLE public.lead_events
  ADD CONSTRAINT lead_events_event_name_check
  CHECK (event_name = ANY (ARRAY[
    -- existing lifecycle / OTP / scan / handoff names (20260422193520)
    'lead_created','lead_captured',
    'otp_send_requested','otp_send_blocked','otp_sent',
    'otp_verify_attempted','otp_verified','otp_verify_failed','otp_verify_locked',
    'phone_lookup_completed','voice_fallback_used',
    'scan_started','scan_completed','report_unlocked',
    'intro_requested','report_help_call_requested',
    'suggested_match_generated','suggested_match_shown_to_homeowner','suggested_match_unavailable',
    'voice_followup_queued','voice_followup_webhook_sent','voice_followup_failed',
    'voice_followup_answered','voice_followup_completed',
    'booking_intent_detected','appointment_booked',
    'contractor_intro_routed','billable_intro_created','deal_outcome_updated',
    'crm_handoff_queued',
    'crm_handoff_unroutable',
    -- new capture-path CRM activity names (Sprint 1)
    'truth_gate_captured',
    'nextdoor_lead_captured',
    'arbitrage_completed',
    'power_demo_submitted',
    'ai_demo_submitted',
    'quote_uploaded',
    'demo_viewed'
  ]::text[]));

-- 3) Conservative backfill from newest backfill-safe lead_events per lead
-- Skips leads with no qualifying events; leaves columns NULL otherwise.
WITH backfill_safe AS (
  SELECT unnest(ARRAY[
    'scan_completed',
    'report_unlocked',
    'appointment_booked',
    'crm_handoff_queued'
  ]::text[]) AS event_name
),
newest_safe AS (
  SELECT DISTINCT ON (le.lead_id)
    le.lead_id,
    le.event_name,
    le.created_at
  FROM public.lead_events le
  INNER JOIN backfill_safe bs ON bs.event_name = le.event_name
  ORDER BY le.lead_id, le.created_at DESC
)
UPDATE public.leads l
SET
  latest_activity_type = ns.event_name,
  last_activity_at = ns.created_at
FROM newest_safe ns
WHERE l.id = ns.lead_id
  AND l.latest_activity_type IS NULL
  AND l.last_activity_at IS NULL;
