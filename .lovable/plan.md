## Short answer

Yes: the **Open Join** model is the right interpretation if the business goal is “any contractor can create/request an account and then WindowMan follows up.”

Important correction from the codebase: this project already has a partial open-signup system. It is not starting from zero.

Existing pieces:

```text
/partner/login
  -> Request Partner Access form
  -> supabase.functions.invoke("request-partner-access")
  -> creates Supabase auth user
  -> creates contractor_profiles row with status = "pending_review"
```

So the mismatch is not “there is no open signup.” The mismatch is:

```text
/partner/accept-invite = invite-only page
/partner/login = hidden/secondary open access request
```

The current `/partner/accept-invite` page still behaves like a private invite gate and treats no-token traffic as an error. If this route is being used publicly or shared broadly, it should either pivot into the existing open signup flow or redirect to a clearer `/partner/join` route.

## Current diagnosis

1. **`/partner/accept-invite` is invite-only by design**
   - It requires `?token=` or `?invite_token=`.
   - Without a token, it shows “No invitation token provided.”
   - That is technically correct for invite acceptance, but wrong for an open partner acquisition flow.

2. **Open self-serve registration already exists, but it is buried under `/partner/login`**
   - `ContractorLogin.tsx` has a “Request Partner Access” mode.
   - It calls `request-partner-access`.
   - That edge function creates a pending-review account.

3. **The existing open signup collects too little operational data**
   - Current fields: company name, email, password.
   - The edge function optionally supports `contactName`, but the form does not collect it.
   - It does not collect phone, service counties, zip/territory, monthly capacity, license info, or notes.
   - That limits follow-up usefulness.

4. **There is no strong operator notification path**
   - `request-partner-access` does a best-effort audit insert.
   - It does not send a reliable email/Slack/admin alert.
   - The current audit insert also appears questionable: it writes `lead_events.lead_id = userId`, which is semantically not a homeowner lead id.

5. **The route naming is confusing**
   - `/partner/accept-invite` should remain for tokenized invites.
   - Public signup should live at `/partner/join` or `/partner/signup`.
   - The missing-token state on `/partner/accept-invite` should not look broken; it should guide users to the open join flow.

## Revised implementation plan

### 1. Keep invite acceptance intact
Do not remove or weaken the invite flow.

Supported invite URLs remain:

```text
/partner/accept-invite?token=INVITE_TOKEN
/partner/accept-invite?invite_token=INVITE_TOKEN
/partner/accept-invite?token=INVITE_TOKEN&code=SUPABASE_CODE
/partner/accept-invite?token=INVITE_TOKEN#access_token=...&refresh_token=...
```

This route continues to call `accept-invite` only when a valid invite token exists.

### 2. Add a public open-join route
Add a new route:

```text
/partner/join
```

This route will render the open partner application experience currently buried inside `/partner/login`.

Preferred route behavior:

```text
/partner/accept-invite with token -> invite acceptance flow
/partner/accept-invite without token -> redirect or CTA to /partner/join
/partner/login -> sign-in/recovery-first page, with link to /partner/join
/partner/join -> public partner application
```

### 3. Reuse the existing self-serve backend instead of creating a duplicate table immediately
Do not create a new `partner_leads` table yet unless the existing schema cannot support the workflow.

Use the existing:

```text
contractor_profiles.status = "pending_review"
request-partner-access edge function
```

Rationale:
- It already creates the Supabase Auth user.
- It already creates the pending-review profile.
- It aligns with the existing `usePartnerAuth` pending-review handling.
- It avoids creating a second “lead” object that later has to be reconciled with auth users.

### 4. Expand the public partner application form
Update the open signup form to collect better follow-up context:

Required:
- company name
- contact name
- email
- password

Recommended optional fields:
- phone
- service counties / territories
- company website
- license number
- monthly lead capacity
- notes / “what markets do you serve?”

Client-side validation with Zod; server-side validation in the edge function.

### 5. Update `request-partner-access` to store richer metadata safely
Extend the edge function payload and validation.

Store operational context in one of these safe ways:

Option A, minimal schema change:
- Keep `contractor_profiles` as-is.
- Store extra details in auth `user_metadata`.
- This is fastest but weaker for admin workflows.

Option B, better long-term:
- Use or extend `contractor_accounts` for open applicants.
- Set:
  ```text
  auth_user_id = new auth user id
  access_status = "pending"
  is_active = false
  display_name = company name
  contact_email = email
  contact_phone = phone
  territory = counties/zips JSON
  client_slug = "direct"
  ```
- This fits the existing partner access model better than inventing a new `partner_leads` table.

I recommend **Option B** if the current schema permits all needed fields without migration. If not, use a small migration only for missing operational fields.

### 6. Add operator notification
Add notification after successful self-serve request.

Preferred implementation:
- Use Lovable Emails if available for zero-config operator alerts.
- If not available/desired, add a dedicated edge-function email integration later.

Notification contents:

```text
New partner access request
Company:
Contact:
Email:
Phone:
Service area:
Capacity:
Submitted at:
Admin review route:
```

This should be best-effort: failure to notify should not orphan or block the account creation, but it should log clearly.

### 7. Fix pending-review UX
When a self-serve applicant signs in before approval:
- show “Account Pending Review”
- explain WindowMan will follow up within 1 business day
- provide sign out
- do not show active marketplace/opportunity functionality

This currently exists partially via `PartnerGuard`, but partner routes in `App.tsx` currently note that `PartnerGuard` was removed. I will verify and reapply the correct guard or equivalent pending-review gate without breaking preview fallback behavior.

### 8. Keep `/partner/accept-invite` from looking broken
For no-token visits, change the page from a dead error into a bridge:

```text
Invite link required
If you were invited, use the full link from your email.
If you want to join the WindowMan Partner Network, request access here.
[Request Partner Access] -> /partner/join
[Partner Sign In] -> /partner/login
```

This preserves semantics while supporting open signup.

### 9. Fix invite-specific reliability issues from the earlier diagnosis
Also keep the surgical auth fixes:
- preserve `token` / `invite_token` through Supabase `?code=` and `#access_token` callbacks
- validate expected auth link type where possible
- improve wrong-session messaging
- reduce `/partner/opportunities` lazy-load failure risk after successful invite acceptance

## Likely files changed

Frontend:
- `src/App.tsx`
- `src/pages/AcceptInvite.tsx`
- `src/pages/ContractorLogin.tsx` or a new shared `PartnerJoin` component/page
- possibly `src/hooks/usePartnerAuth.ts` / partner guard wiring if pending-review access is currently too loose
- `src/lib/supabaseAuthLink.ts`
- `src/lib/supabaseAuthLink.test.ts`

Backend:
- `supabase/functions/request-partner-access/index.ts`
- possibly `supabase/functions/accept-invite/index.ts` for structured invite error codes

Database:
- No new table by default.
- Possible small migration only if `contractor_accounts` needs extra fields for open applicants.

## What this will not do

- No database rebuild.
- No weakening RLS.
- No public access to active partner leads.
- No fake approval state.
- No removal of invite-only acceptance for manually invited partners.
- No changes to homeowner SMS-gated Truth Report access.

## Final model after implementation

```text
Public contractor prospect
  -> /partner/join
  -> creates auth user + pending applicant profile/account
  -> operator notification sent
  -> user sees pending-review state
  -> WindowMan manually approves
  -> user gains active partner portal access

Invited contractor
  -> /partner/accept-invite?token=...
  -> signs in/up with invited email
  -> invite token links account
  -> active partner portal access if invite is valid
```

This gives you both tracks: open acquisition and controlled activation.