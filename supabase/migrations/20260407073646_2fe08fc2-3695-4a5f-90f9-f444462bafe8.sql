-- Step 1: Fix lead_events constraints to allow crm_handoff_queued + db_trigger

ALTER TABLE public.lead_events DROP CONSTRAINT IF EXISTS lead_events_event_name_check;
ALTER TABLE public.lead_events ADD CONSTRAINT lead_events_event_name_check CHECK (
  event_name = ANY (ARRAY[
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
    'crm_handoff_queued'
  ]::text[])
);

ALTER TABLE public.lead_events DROP CONSTRAINT IF EXISTS lead_events_event_source_check;
ALTER TABLE public.lead_events ADD CONSTRAINT lead_events_event_source_check CHECK (
  event_source IS NULL OR event_source = ANY (ARRAY[
    'web','edge_function','admin','phonecall_bot','system','db_trigger'
  ]::text[])
);