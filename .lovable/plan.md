Plan only: get_analysis_full migration/RPC audit and migration-only fix

Scope boundaries
- Do not edit old migrations.
- Do not edit frontend code.
- Do not edit Edge Functions.
- Do not touch OTP, Twilio, scanner, tracking, admin, routes, or UI.
- If approved, make exactly one new migration file only.

Audit findings

1. Migrations that define or replace `public.get_analysis_full`

In timestamp order, the migrations defining/replacing the RPC are:

- `supabase/migrations/20260322_redact_preview_create_gated_full.sql`
  - Creates the initial gated full fetch.
  - Authorization only checks `phone_verifications.phone_e164` + `status = 'verified'`.
  - No scan-session binding.

- `supabase/migrations/20260322_fix_get_analysis_full_session_binding.sql`
  - Replaces the global phone check with a lead/session-bound join.
  - Requires the verified phone row to be tied to the same lead as the scan session.
  - Does not require `phone_verifications.scan_session_id = p_scan_session_id`.

- `supabase/migrations/20260324140743_73eebc81-c2a3-4f16-bcf5-bdbdeffa5b87.sql`
  - Replaces `get_analysis_full` again.
  - Keeps lead/session-bound authorization.
  - Does not require `phone_verifications.scan_session_id = p_scan_session_id`.

- `supabase/migrations/20260404112827_d214d3aa-c87c-4a59-8dca-32c5b44aa641.sql`
  - Replaces `get_analysis_full`.
  - Adds `leads.phone_verified = true` and the unauthorized sentinel row using `grade = '__UNAUTHORIZED__'`.
  - Does not require `phone_verifications.scan_session_id = p_scan_session_id`.

- `supabase/migrations/20260419175308_181351be-53ef-423d-b997-8cb185f560c8.sql`
  - Adds `phone_verifications.scan_session_id`.
  - Adds indexes for phone/session lookup.
  - Replaces `get_analysis_full` with stronger scan-session binding and includes `analysis_id` in the return shape.
  - However, it includes a legacy fallback path for rows where `phone_verifications.scan_session_id IS NULL`.

- `supabase/migrations/20260420000000_add_analysis_id_to_analysis_rpcs.sql`
  - Drops and recreates `get_analysis_full`.
  - Preserves the current return shape including `analysis_id`.
  - Preserves the unauthorized sentinel behavior.
  - Weakens the strict session binding because authorization only proves:
    - `phone_verifications.lead_id = leads.id`
    - `scan_sessions.lead_id = leads.id`
    - `scan_sessions.id = p_scan_session_id`
    - `leads.phone_verified = true`
  - It does not require `phone_verifications.scan_session_id = p_scan_session_id`.

2. Final effective migration by timestamp

The final effective definition currently comes from:

`supabase/migrations/20260420000000_add_analysis_id_to_analysis_rpcs.sql`

Later migrations exist, but the audit did not find any later migration that defines or replaces `public.get_analysis_full`.

3. Is strict `scan_session_id` binding currently enforced?

No.

The currently winning function does not require:

```sql
pv.scan_session_id = p_scan_session_id
```

It only requires the verified phone row and requested scan session to belong to the same lead. That preserves lead-level authorization but does not enforce exact OTP-to-scan-session authorization.

4. Does `send-otp` write `scan_session_id` into `phone_verifications`?

Yes.

`supabase/functions/send-otp/index.ts` reads `body.scan_session_id` and inserts it into `phone_verifications.scan_session_id` when creating the pending row:

```ts
const scan_session_id = body.scan_session_id || null;
...
.insert({
  phone_e164,
  status: "pending",
  ip_address: clientIp,
  scan_session_id: scan_session_id || null,
});
```

No Edge Function edit is needed for this part.

5. Does `verify-otp` preserve/stamp `scan_session_id` on successful verification?

Yes.

`supabase/functions/verify-otp/index.ts`:

- Reads `body.scan_session_id`.
- First looks for a pending `phone_verifications` row matching that exact `scan_session_id`.
- Falls back only to a pending legacy row where `scan_session_id IS NULL`.
- Resolves `lead_id` from the requested scan session.
- On successful Twilio verification, updates the pending row with:

```ts
status: "verified",
verified_at: now,
lead_id: resolvedLeadId,
scan_session_id: scan_session_id,
```

No Edge Function edit is needed for this part.

Conclusion

A new final corrective migration is needed.

Reason: the latest winning RPC definition preserves `analysis_id`, but it does not preserve strict OTP-to-scan-session binding. Since `send-otp` and `verify-otp` already write/preserve `scan_session_id`, the smallest safe fix is migration-only: redefine `public.get_analysis_full` so authorization requires the verified phone row to be bound to the requested scan session.

Exact proposed migration filename

`supabase/migrations/20260428120000_restore_get_analysis_full_strict_scan_binding.sql`

Full SQL to add

```sql
BEGIN;

-- Defensive: ensure the column needed for strict OTP-to-scan binding exists.
ALTER TABLE public.phone_verifications
  ADD COLUMN IF NOT EXISTS scan_session_id uuid;

-- Helpful lookup indexes for strict phone/session/status authorization.
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone_scan_status
  ON public.phone_verifications (phone_e164, scan_session_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_scan_session
  ON public.phone_verifications (scan_session_id)
  WHERE scan_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_analysis_full(
  p_scan_session_id uuid,
  p_phone_e164 text
)
RETURNS TABLE(
  analysis_id uuid,
  grade text,
  flags jsonb,
  full_json jsonb,
  proof_of_read jsonb,
  preview_json jsonb,
  confidence_score numeric,
  document_type text,
  rubric_version text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_authorized boolean := false;
BEGIN
  -- Strict OTP-to-scan-session authorization.
  -- A phone verification may unlock only the exact scan_session_id it was
  -- created/verified for, while still confirming the scan belongs to the
  -- same lead and the lead is marked phone_verified.
  SELECT EXISTS(
    SELECT 1
    FROM public.phone_verifications pv
    JOIN public.scan_sessions ss
      ON ss.id = p_scan_session_id
     AND ss.id = pv.scan_session_id
    JOIN public.leads l
      ON l.id = ss.lead_id
     AND l.id = pv.lead_id
    WHERE pv.phone_e164 = p_phone_e164
      AND pv.status = 'verified'
      AND pv.scan_session_id = p_scan_session_id
      AND l.phone_verified = true
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    -- Preserve current frontend contract: unauthorized is represented as a
    -- sentinel row, not an empty result and not a thrown error.
    RETURN QUERY SELECT
      NULL::uuid AS analysis_id,
      '__UNAUTHORIZED__'::text AS grade,
      NULL::jsonb AS flags,
      NULL::jsonb AS full_json,
      NULL::jsonb AS proof_of_read,
      NULL::jsonb AS preview_json,
      NULL::numeric AS confidence_score,
      NULL::text AS document_type,
      NULL::text AS rubric_version;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.id AS analysis_id,
    a.grade,
    a.flags,
    a.full_json,
    a.proof_of_read,
    a.preview_json,
    a.confidence_score,
    a.document_type,
    a.rubric_version
  FROM public.analyses a
  WHERE a.scan_session_id = p_scan_session_id
    AND a.analysis_status = 'complete'
  ORDER BY a.created_at DESC
  LIMIT 1;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_analysis_full(uuid, text) TO anon, authenticated;

COMMIT;
```

Implementation acceptance criteria after approval
- Exactly one new file is created:
  - `supabase/migrations/20260428120000_restore_get_analysis_full_strict_scan_binding.sql`
- No old migration files are edited.
- No `src/` files are edited.
- No `supabase/functions/` files are edited.
- No package files, routes, UI, tracking, scanner, admin, OTP, or Twilio code is edited.
- The final RPC return shape includes `analysis_id`.
- Unauthorized behavior remains the `__UNAUTHORIZED__` sentinel row.
- Authorization requires `phone_verifications.scan_session_id = p_scan_session_id`.