Plan to implement the requested end-to-end test:

1. Add a focused Playwright spec for `/partner/join`
   - Create a new test file under `tests/e2e/`, e.g. `partner-join.spec.ts`.
   - Navigate to `/partner/join` in a fresh browser context.
   - Fill the real registration form fields: company name, contact name, email, phone, service area, website/license/capacity/notes, password, confirm password.
   - Submit via the visible `Submit Request` button.
   - Wait for the real UI success state: `Request Received`, `You're on the list`, and the pending-review copy.

2. Assert the real Supabase Edge Function was invoked
   - Use Playwright’s network observer to wait for the `request-partner-access` function request.
   - Assert the request finishes successfully and returns an OK response from the real connected Supabase project.
   - Keep the test using the app’s existing Supabase client path (`supabase.functions.invoke`) rather than calling a fake endpoint.

3. Verify pending-review persistence in Supabase
   - Extend `tests/helpers/supabaseAdmin.ts` with narrow helper functions for this partner test only:
     - fetch `contractor_profiles` by the unique test email and confirm `status = 'pending_review'`.
     - fetch `contractor_accounts` by the unique test email and confirm `access_status = 'pending'`, `is_active = false`, and expected metadata/territory fields.
   - Reuse the existing service-role-only Playwright helper pattern so the service key stays in Node test code and is never bundled into `src/`.
   - Skip cleanly when `SUPABASE_SERVICE_ROLE_KEY` / Supabase URL are unavailable, matching the existing cold-session smoke pattern.

4. Exercise the pending-review screen after registration
   - After the registration success state, switch to sign-in.
   - Sign in with the newly created pending-review partner credentials.
   - Assert the app routes to the partner shell and displays the pending-review account screen/copy from `PartnerGuard` rather than active opportunities.

5. Add safe cleanup for real Supabase data
   - Use a unique email prefix such as `wm-partner-e2e-...@windowman-test.local`.
   - Add a best-effort cleanup helper that only touches that safe test prefix.
   - Clean up `contractor_accounts`, `contractor_profiles`, and the created Supabase Auth user through the Node-only admin client.
   - Do not modify production RLS or expose any secrets to the browser.

Technical notes:
- This does not require database migrations.
- This does not alter the partner registration product flow, only locks it with E2E coverage.
- The test will run against the real connected Supabase project when Playwright has the required Supabase env/secrets available; otherwise it will skip safely with a clear reason.