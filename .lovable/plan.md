# Plan: Fix the TruthGate orange-button failure at the source

## What will be fixed
The TruthGate submit step currently fails before UploadZone because the browser sends an authenticated admin/operator session to Supabase, but `public.leads` and `public.event_logs` only allow the current insert path for `anon`. The result is an RLS rejection (`42501`) and the button flips into the orange error state.

## Implementation

1. Replace the fragile browser-side `leads` insert with a dedicated edge function
   - Add a new edge function for TruthGate lead capture.
   - Accept only the exact allowed intake fields from `TruthGateFlow`.
   - Normalize and validate the payload server-side.
   - Insert the lead using service-role access so the flow works for both anonymous visitors and logged-in internal users.
   - Return a structured success/error response with safe diagnostics.

2. Update `TruthGateFlow.tsx` to use the edge function
   - Move the current inline Supabase `from("leads").insert(...)` payload into a named object.
   - Call the edge function instead of inserting directly into `public.leads`.
   - Preserve the existing success path: store `sessionId`, persist funnel state, and reveal UploadZone only after confirmed success.
   - Keep event logging non-blocking.

3. Add targeted diagnostics without exposing private data
   - Add structured non-PII console logging for lead-capture failures.
   - Add a preview/dev-only inline diagnostic under the CTA showing `[code] [message]`.
   - Keep the public production UI generic and safe.

4. Make telemetry resilient in mixed-auth browser sessions
   - Prevent `event_logs` failures from affecting lead capture UX.
   - If needed, route the TruthGate failure/success telemetry through the new edge function response path or preserve fire-and-forget behavior with better guards.

5. Validate the behavior across the real failure cases
   - Anonymous homepage visit: lead capture succeeds.
   - Logged-in operator/admin on homepage: lead capture still succeeds.
   - UploadZone appears after successful capture.
   - Orange error state only appears for real failures, and dev/preview now shows the exact reason.

## Files likely affected
- `src/components/TruthGateFlow.tsx`
- `supabase/functions/<new-truthgate-capture-function>/index.ts`
- possibly shared edge-function utilities if existing validation helpers are reused

## Technical details
- Root cause confirmed from runtime request snapshot:
  - `POST /rest/v1/leads` returned `403 / 42501`
  - request carried an authenticated operator JWT
  - `leads` insert policy is currently `TO anon`
- Related secondary failure:
  - `event_logs` inserts also fail for the same reason (`anon`-only insert path)
- Columns in the current TruthGate payload already exist in generated Supabase types, so this is not a missing-column issue.
- This fix preserves the project’s security model:
  - no weakening of RLS for convenience
  - no exposure of service-role secrets to the client
  - no impact to OTP gating, report reveal, storage privacy, or scoring logic

## Expected result
The blue TruthGate button stays on the happy path after name/email submission, the lead is captured reliably regardless of current browser auth state, UploadZone starts as intended, and preview/dev gives actionable diagnostics if anything fails again.