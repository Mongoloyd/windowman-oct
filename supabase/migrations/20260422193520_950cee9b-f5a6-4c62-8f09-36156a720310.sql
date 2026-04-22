-- Fix: the fire_crm_handoff() trigger emits 'crm_handoff_unroutable' when a
-- verified lead has no client_slug / no active assignment, but the existing
-- CHECK constraint did not list that value. The CHECK violation aborted the
-- leads UPDATE inside verify-otp, returning HTTP 500 "Verification confirmed
-- but could not be saved" to the user. Allow the value.
ALTER TABLE public.lead_events
  DROP CONSTRAINT IF EXISTS lead_events_event_name_check;

ALTER TABLE public.lead_events
  ADD CONSTRAINT lead_events_event_name_check
  CHECK (event_name = ANY (ARRAY[
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
    'crm_handoff_unroutable'
  ]));

-- Backfill: leads whose phone_verifications row is verified but whose
-- leads.phone_verified is still false (collateral damage from the bug above).
-- This UPDATE will now succeed because the CHECK constraint accepts the
-- 'crm_handoff_unroutable' event the trigger emits.
UPDATE public.leads l
SET    phone_verified    = true,
       phone_e164        = pv.phone_e164,
       phone_verified_at = pv.verified_at
FROM   public.phone_verifications pv
WHERE  pv.lead_id = l.id
  AND  pv.status = 'verified'
  AND  l.phone_verified = false;