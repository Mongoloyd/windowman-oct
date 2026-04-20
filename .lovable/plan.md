

## Goal
Wire `/partner/login` "Request Partner Access" → real registration → service-role creation of auth user + `contractor_profiles` row with `status='pending_review'` → `PartnerGuard` blocks until operator flips to `active`.

## Verified repo truth (read in this loop + prior loops)
- `ContractorLogin.tsx:169` → "Request Partner Access" button fires fake toast. ✅ confirmed.
- `PartnerGuard.tsx` → already blocks `unlinked` (no profile) and `suspended` (status ≠ 'active'). ✅
- `usePartnerAuth.ts` → reads `contractor_profiles` (id = auth.uid()) and exposes `state`, `userId`, `contractorId`, `companyName`. **Does not expose `status`** — needs adding to differentiate pending vs suspended.
- `contractor_profiles` schema: `id uuid (=auth.uid())`, `company_name text NOT NULL`, `contact_email text NOT NULL`, `status text NOT NULL default 'active'`. RLS: select-own only; **no client INSERT policy** (correct — we use service role).
- Invite flow writes `status='active'` via existing edge functions — untouched.
- All required secrets present: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Scope (fenced)
**5 file ops · zero scanner/OTP/Twilio/lead/attribution code touched.**

### 1. NEW: `supabase/functions/request-partner-access/index.ts`
Public edge function (no JWT required). 
- Validate input with zod: `companyName` (1–200), `email` (valid + ≤255), `password` (≥8), optional `contactName`.
- Service-role client → `auth.admin.createUser({ email, password, email_confirm: true })`.
- On success → `insert into contractor_profiles { id: user.id, company_name, contact_email: email, status: 'pending_review' }`.
- On profile insert failure → `auth.admin.deleteUser(user.id)` rollback to avoid orphan auth users.
- Insert `lead_events` row `{ event_name: 'partner_access_requested', event_source: 'partner_self_serve', metadata: { company_name, email_masked } }` for ops visibility (best-effort, not fatal).
- Structured error codes: `email_taken`, `weak_password`, `invalid_email`, `missing_company`, `internal_error`.
- CORS headers on every response (incl. errors).

### 2. NEW migration: register function as public in `supabase/config.toml`
Add:
```toml
[functions.request-partner-access]
verify_jwt = false
```
**No DB migration needed.** `status` is free-text; `'pending_review'` is just a convention. RLS is already correct (no client insert; service role bypasses RLS). Existing invite flow unaffected.

### 3. EDIT: `src/hooks/usePartnerAuth.ts`
- Add `status: string | null` to `PartnerAuth` interface.
- Select `status` (already does) and pass it through in all return states.
- No behavior change to state machine — just exposes the raw status string for the guard's copy branch.

### 4. EDIT: `src/components/auth/PartnerGuard.tsx`
- Read `status` from hook.
- When `state === 'suspended'` AND `status === 'pending_review'` → render "Account Pending Review" screen (sky Clock icon, neutral copy: "Your partner account request is under review. We'll email you within 1 business day once approved.").
- All other non-active statuses → existing "Account Suspended" amber screen (unchanged).
- `unauthenticated` and `unlinked` paths unchanged.

### 5. EDIT: `src/pages/ContractorLogin.tsx`
- Extend `View` type: `"login" | "forgot" | "register" | "register-success"`.
- Change line 169 button: `onClick={() => setView("register")}` (kill the fake toast).
- Add `RegisterPanel` JSX inside `rightPanel()`:
  - Fields: Company Name, Contact Email, Password, Confirm Password
  - Client-side zod validation (mirrors edge function)
  - Submit → `supabase.functions.invoke('request-partner-access', { body: {...} })`
  - Loading state, inline errors, structured error → toast mapping
  - Back-arrow returns to `login` view
- Add `register-success` view: success card with copy "Request received. Your partner account is pending review. We'll email you once approved." + "Return to sign in" button.
- Visual style matches existing `Card` shell exactly (`border-white/[0.06] bg-white/[0.02] shadow-2xl`, sky-500 buttons). Minimal diff.

## Out of scope (will NOT touch)
- `send-otp`, `verify-otp`, any Twilio code
- Scan routes, report reveal, analyses, leads, attribution, `useUtmCapture`
- Admin routes, contractor invite flow, RLS on any other table
- Visual redesign of partner portal
- Aura Diagnostic Card

## Files changed
```text
supabase/functions/request-partner-access/index.ts   (new)
supabase/config.toml                                  (edit: 2 lines added)
src/hooks/usePartnerAuth.ts                           (edit: expose status)
src/components/auth/PartnerGuard.tsx                  (edit: pending_review branch)
src/pages/ContractorLogin.tsx                         (edit: register view + wire button)
```

## Verification checklist (post-implementation)
1. `/partner/login` → click "Request Partner Access →" → register form opens (no fake toast). ✅
2. Submit valid form → success screen renders with pending-review copy. ✅
3. SQL: `select id, company_name, contact_email, status from contractor_profiles order by created_at desc limit 1;` → `status='pending_review'`. ✅
4. Sign in with new credentials → `PartnerGuard` shows "Account Pending Review" (sky), never lands on `/partner/opportunities`. ✅
5. SQL: `update contractor_profiles set status='active' where id='<uuid>';` → next sign-in succeeds → opportunities dashboard. ✅
6. Existing invite-flow contractors (status='active') unaffected. ✅
7. Duplicate email submit → "This email is already registered" inline error. ✅
8. No file in `supabase/functions/{send-otp,verify-otp}/` or any scan/Twilio path was modified. ✅

## Risk: very low
Additive only. Service-role insert keeps RLS surface unchanged for the browser. No schema migration. No touch to invite, OTP, scan, or homeowner code paths. Auth-user rollback on profile-insert failure prevents orphan accounts.

