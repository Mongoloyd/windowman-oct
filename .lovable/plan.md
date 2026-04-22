

## Forensic root cause (proven)

The previous prompt's hypothesis (Twilio service mismatch / phone mismatch / scan-session mismatch) is **wrong**. The real failure is a database CHECK constraint violation inside an AFTER UPDATE trigger on `leads`.

### Stage-by-stage proof from the failed session
- send-otp succeeded, SMS delivered, `phone_verifications` pending row created with correct `phone_e164=+12038567938`, correct `scan_session_id=70db6489-…`, correct `lead_id=7c1eb988-…`.
- verify-otp first call → HTTP **500** (not 400, not Twilio 20404) with `"Verification confirmed but could not be saved"`. That message lives at `supabase/functions/verify-otp/index.ts` lines 219 and 245 — Twilio already approved the code at that point.
- The `phone_verifications` row IS marked `status='verified', verified_at=18:05:57.996` in the DB.
- The `leads` row still shows `phone_verified=false`, `phone_e164=NULL`, `phone_verified_at=NULL`. So the failing write is the **`leads` UPDATE** at lines 232–250.
- verify-otp second call → HTTP 400 "Verification session expired or not found". That is genuine Twilio 20404, but it's the **downstream symptom** of the first failure: send-otp had already expired older pending rows, and Twilio's Verify session was already consumed by the first (approved) check.

### Why the leads UPDATE fails

Trigger `trg_fire_crm_handoff` (AFTER UPDATE on `leads`) calls `public.fire_crm_handoff()`. When `phone_verified` flips to true and `latest_analysis_id IS NOT NULL` (true here — analysis `8111798d-…` exists), the function:

1. Calls `resolve_route_for_lead(lead_id)`. The lead has `client_slug = NULL`, so the resolver returns `resolved=false, no_route_reason='lead_has_no_slug'`.
2. Sets `v_status := 'unroutable'`.
3. Inserts a `webhook_deliveries` row with `status='unroutable'` (this part is fine — column allows it).
4. Inserts a `lead_events` row with `event_name = 'crm_handoff_unroutable'`.

Step 4 violates `lead_events_event_name_check`. The allowed list contains `'crm_handoff_queued'` but **not** `'crm_handoff_unroutable'`. The CHECK violation propagates up, the trigger fails, the UPDATE on `leads` is aborted, and verify-otp catches the error and returns the 500.

This means **every OTP verification for a lead that has no `client_slug` has been silently failing** since this constraint/trigger pair shipped. Five recent verified rows in `phone_verifications` for this same phone number all correspond to leads where the report stayed gated.

## The smallest safe fix

Add `'crm_handoff_unroutable'` to the allowed list in `lead_events_event_name_check`. That is the only change needed to unblock the verify path. No code changes, no Twilio changes, no scope creep.

### Migration
```sql
ALTER TABLE public.lead_events
  DROP CONSTRAINT lead_events_event_name_check;

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
    'crm_handoff_unroutable'   -- newly allowed; emitted by fire_crm_handoff()
  ]));
```

### Backfill (one-time, optional but recommended)
For leads whose `phone_verifications.status='verified'` but `leads.phone_verified=false`, replay the verified state so existing users aren't stuck:
```sql
UPDATE public.leads l
SET    phone_verified = true,
       phone_e164     = pv.phone_e164,
       phone_verified_at = pv.verified_at
FROM   public.phone_verifications pv
WHERE  pv.lead_id = l.id
  AND  pv.status = 'verified'
  AND  l.phone_verified = false;
```
This will trigger the (now fixed) handoff path for each backfilled lead.

## Out of scope (not touched)
- No changes to `send-otp`, `verify-otp`, or any frontend file.
- No changes to Twilio integration or secrets.
- No changes to RLS, storage, scanner, admin, or GTM.
- No redesign of the report gate.

## Verification after applying
1. Reproduce the homepage flow with a new upload + OTP. verify-otp returns 200, `leads.phone_verified` flips true, full report unlocks.
2. Confirm a `webhook_deliveries` row with `status='unroutable'` and `no_route_reason='lead_has_no_slug'` exists (expected for direct/no-slug traffic) and a `lead_events` row with `event_name='crm_handoff_unroutable'` is recorded.
3. Confirm a slug-bearing lead (e.g. `?client_slug=…` route) still produces `crm_handoff_queued` and a routable webhook delivery — proving the queued path still works.

## Confidence

**95 / 100** that this fix resolves the verify-otp failure observed in the network log (500 → "could not be saved", followed by 400 → "expired or not found").

The 5-point uncertainty: I cannot directly read pg logs in this read-only mode to see the exact CHECK violation message, but the mechanism is fully consistent with every observed signal (HTTP 500 on first verify, message text matching only the leads-update branch, `phone_verifications.verified` row written, `leads` row unchanged, no `webhook_deliveries` row inserted, lead has no `client_slug`, trigger emits a value not in the CHECK list).

## If this fix turns out insufficient

Likely secondary causes, in order of probability:
1. The `webhook_deliveries` insert hits a different unseen constraint or unique-index conflict — fix by widening that constraint or making the trigger swallow the insert error inside a sub-block.
2. `pg_net`/vault permission error inside the trigger's `pg_net.http_post` block — already wrapped in `EXCEPTION WHEN OTHERS`, so unlikely, but if vault access is denied at parse time it could still abort. Mitigation: move the wake-up call to a deferred constraint trigger or to a NOTIFY that an external worker listens to.
3. The trigger should not be in the synchronous write path of `verify-otp` at all. A more durable architecture is to make `fire_crm_handoff` enqueue via `pg_notify` and let the dispatch worker pick it up. That is a larger refactor and is **not** proposed here — only the constraint fix is needed to restore the verify flow today.

