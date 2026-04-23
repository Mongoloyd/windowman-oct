

## Verification Plan: Admin Auth End-to-End

### What the audit found

I read every piece of the new admin auth surface — `AdminAuthGate`, `AdminIdentityBar` (incl. its JWT decoder), `AdminLogin`, `AdminForgotPassword`, `AdminResetPassword`, the `App.tsx` route wiring — and queried the database for real admin accounts.

**Two real gaps must be closed before "verified" can be claimed.** The plan below first fixes those gaps, then runs the actual end-to-end verification.

### Gap 1 — `AdminAuthGate` does NOT block non-admin users

The current gate (`src/components/admin/AdminAuthGate.tsx`) only checks "is there a session?" — it accepts any authenticated Supabase user, including a homeowner who signed up via the public site. The file even acknowledges this:

> "Role-level enforcement (operator/admin/super_admin) is left to backend RLS via is_internal_operator()"

That is not a gate. A non-admin user lands inside the admin shell and only fails when individual queries error out. The user explicitly asked us to confirm non-admins are blocked — today they aren't.

**Fix:** add a role check to `AdminAuthGate` after the session check:
- decode `session.access_token` with the same logic already present in `AdminIdentityBar` (`app_metadata.role`)
- if role is not in `('operator','admin','super_admin')` → render `<AdminUnauthorizedPanel />` (already exists in the same file)
- if role IS valid → render children
- keep DEV bypass untouched

This reuses the existing `decodeJwtRole` function — extract it into a small shared helper `src/components/admin/auth/decodeJwtRole.ts` so both `AdminAuthGate` and `AdminIdentityBar` share one source of truth.

### Gap 2 — Verifying the identity-bar pill matches the live JWT

The decoder in `AdminIdentityBar` reads `payload.app_metadata.role`. The DB confirms one real admin exists:

```
mongoloyd@protonmail.com  →  app_metadata.role = "operator"
```

After Gap 1 is fixed and that account signs in on the production preview, the pill should render **Operator** (blue). To make this provable rather than visual-only, add a dev-time `console.debug` in the shared `decodeJwtRole` helper that logs the decoded role exactly once per session change. This gives us a reproducible signal in `code--read_console_logs` instead of relying on a screenshot.

### Gap 3 — Test account for "non-admin should be blocked"

We have one operator account but no proven non-admin auth user readily available to log in as. To verify the block, the user needs to either:
- (a) provide credentials for any non-admin Supabase user they already control, or
- (b) tell us to create a throwaway account via `supabase.auth.signUp` from the preview (no `app_metadata.role`), then test the block

I'll ask which they prefer before running the live test.

### Execution sequence (default mode, after approval)

1. Create `src/components/admin/auth/decodeJwtRole.ts` (single shared decoder, optional debug log)
2. Update `AdminIdentityBar.tsx` to import from it (drop the local copy)
3. Update `AdminAuthGate.tsx`:
   - keep DEV bypass
   - production: session check → role check → render children OR `<AdminUnauthorizedPanel />`
   - covers `SIGNED_OUT` and JWT refresh via existing `onAuthStateChange`
4. `npx tsc --noEmit` must exit 0
5. Live verification on the production preview (`https://wmmvp.lovable.app`) using browser tools:
   - **Test A — Admin sign-in path:** navigate `/admin` while signed out → asserts redirect to `/admin/login` → fill `mongoloyd@protonmail.com` + password the user provides → asserts land on `/admin` → screenshot identity bar → assert pill text is **Operator** → assert console log `decoded admin role: operator` → click Sign Out → asserts redirect to `/admin/login`
   - **Test B — Forgot-password loop:** `/admin/login` → "Forgot password?" → submit email → asserts "Check your inbox" → (manual) open email link → assert lands on `/admin/reset-password` with form ready → set new password → assert redirect to `/admin/login` → assert sign-in with new password works
   - **Test C — Non-admin block:** sign in as the non-admin account → navigate `/admin` → asserts `<AdminUnauthorizedPanel />` renders, NOT the dashboard → click Sign Out works
   - **Test D — Direct deep-link:** `/admin/forgot-password` while signed out renders correctly; `/admin/reset-password` without a recovery hash shows the "Invalid or expired link" panel after the 3s grace
6. Capture results in a single summary: pass/fail per test, with screenshots and the decoded-role console line for each.

### What this plan does NOT touch

- `is_internal_operator()` RPC, RLS policies, schema
- `phoneVerificationService.ts`, OTP flow, Twilio
- Partner auth, homeowner flow, Inspector, Session Diag panel
- DEV bypasses in `AuthGuard.tsx` / `useCurrentUserRole.ts`
- The 35→13 tab curation already in place
- Any edge function

### Inputs needed from you (before live tests)

1. **Admin password** for `mongoloyd@protonmail.com` (or a different real operator account to use)
2. **Non-admin verification approach** — either provide existing non-admin credentials, or approve creating a throwaway signup for Test C
3. **Permission to send a real password-reset email** to that operator address (Test B will trigger one)

### Acceptance

- `tsc --noEmit` exit 0
- `AdminAuthGate` blocks any signed-in user whose JWT `app_metadata.role` is not operator/admin/super_admin (Test C green)
- `AdminIdentityBar` pill matches the decoded role for the live admin session, confirmed by both screenshot and console log (Test A green)
- All three new routes complete a real end-to-end round trip on the production preview (Tests A, B, D green)
- No protected paths modified

