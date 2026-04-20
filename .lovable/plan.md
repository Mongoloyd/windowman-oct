

## Root cause (confirmed from edge function logs)

```
code: "23514"
message: 'new row for relation "contractor_profiles" violates check constraint "contractor_profiles_status_check"'
details: 'Failing row contains (..., abcd window, petervsiclen@gmail.com, pending_review, ...)'
```

The Supabase client **is** using the service role key (verified in `index.ts` line 76 — `createClient(supabaseUrl, serviceRoleKey, ...)`). RLS is not the problem.

The real problem: there is a `CHECK` constraint on `contractor_profiles.status` that only permits a fixed set of values (almost certainly `'active'`, `'suspended'`, `'cancelled'`), and `'pending_review'` is not in that list. The insert is being rejected by Postgres before RLS is even consulted.

## The fix (one migration, one tiny code touch)

### 1. Migration — extend the CHECK constraint to allow `'pending_review'`
```sql
ALTER TABLE public.contractor_profiles
  DROP CONSTRAINT IF EXISTS contractor_profiles_status_check;

ALTER TABLE public.contractor_profiles
  ADD CONSTRAINT contractor_profiles_status_check
  CHECK (status IN ('active', 'pending_review', 'suspended', 'cancelled'));
```
- Additive only. Existing rows (all `'active'`) still satisfy the new constraint.
- Does **not** change the column default (`'active'`) → invite-flow rows continue to land active.
- No RLS changes. No new policies. No touch to OTP/Twilio/scan code.

### 2. Edge function — surface DB errors in the response (debug aid, requested by user)
In `supabase/functions/request-partner-access/index.ts`, expand the `profileErr` branch to include `error.message` and `error.code` in the JSON response (still 500, still rolls back the orphan auth user). Keeps the user-facing message generic but adds a `debug` field so future check-constraint mismatches surface immediately instead of requiring a log dive.

```ts
return json(500, {
  ok: false,
  error_code: "internal_error",
  message: "Could not create partner profile.",
  debug: { code: profileErr.code, message: profileErr.message },
});
```

That's it. No client initialization change (already correct). No payload mapping change (already correct — `company_name`, `contact_email`, `id` all match the schema).

## Files changed
```text
supabase/migrations/<ts>_allow_pending_review_status.sql   (new — 1 ALTER TABLE)
supabase/functions/request-partner-access/index.ts         (edit — add debug field to one error response)
```

## Verification after apply
1. Click "Request Partner Access →" on `/partner/login`, submit valid form → success screen renders.
2. SQL: `select id, company_name, status from contractor_profiles order by created_at desc limit 1;` → `status = 'pending_review'`.
3. Sign in with new credentials → `PartnerGuard` shows "Account Pending Review" sky screen.
4. SQL: `update contractor_profiles set status='active' where id='<uuid>';` → next sign-in lands on `/partner/opportunities`.
5. Existing invite-created contractors (status='active') unaffected.

## Out of scope
OTP, Twilio, scan, lead capture, attribution, RLS on any other table, visual redesign. Zero changes.

