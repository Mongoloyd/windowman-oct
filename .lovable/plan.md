## Plan: Surgical Netlify Secret Scan Unblock

### Audit findings

1. `.env` is tracked by Git
   - `git ls-files .env` reports `.env`, so it is committed/tracked.

2. `.env` contains real public Supabase browser config values
   - It contains the real `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
   - These are public browser config values, not service-role secrets, but Netlify secret scanning is still blocking on them.

3. `.gitignore` does not fully protect `.env`
   - It currently ignores `.env.*` but not the root `.env` file.

4. `.env.example` uses placeholders already, but should be normalized
   - It has placeholder values, but I will align the exact requested values:
     - `VITE_SUPABASE_URL=https://your-project.supabase.co`
     - `VITE_SUPABASE_PUBLISHABLE_KEY=your-public-anon-key`

5. `index.html` hardcodes the Supabase project URL
   - Hardcoded in:
     - `<link rel="preconnect" href="https://wkrcyxcnzhwjtdpmfpaf.supabase.co" crossorigin />`
     - `<link rel="dns-prefetch" href="https://wkrcyxcnzhwjtdpmfpaf.supabase.co" />`

6. Supabase Edge Function test files hardcode the production Supabase URL
   - `supabase/functions/contractor-actions/index.test.ts`
   - `supabase/functions/voice-followup/index.test.ts`
   - `supabase/functions/contractor-send-followups/index.test.ts`
   - `supabase/functions/contractor-mark-no-show/index.test.ts`
   - `supabase/functions/contractor-booking-confirmed/index.test.ts`

7. Some Edge Function tests also hardcode the public anon key
   - `supabase/functions/contractor-actions/index.test.ts`
   - `supabase/functions/voice-followup/index.test.ts`

8. The specified migration hardcodes the production Supabase URL in operational SQL
   - File: `supabase/migrations/20260404105923_eab75b78-c0ea-4a08-a255-a142bc302c2f.sql`
   - Usage:
     ```sql
     SELECT net.http_post(
       url := 'https://wkrcyxcnzhwjtdpmfpaf.supabase.co/functions/v1/process-webhook',
       headers := '{"Content-Type":"application/json","Authorization":"Bearer ..."}'::jsonb,
       body := '{}'::jsonb
     ) AS request_id;
     ```
   - This is not a comment/test fixture. It schedules a cron job that posts to an Edge Function. I will not rewrite this migration as a behavioral change unless you explicitly approve a DB-safe replacement strategy.

9. `netlify.toml` does not exist
   - No Netlify config file was found.

10. Vite config does not hardcode Supabase env values
   - `vite.config.ts` does not reference the real Supabase URL/key.

### Implementation steps after approval

1. Remove committed `.env` safely
   - Delete `.env` from the repository workspace.
   - Update `.gitignore` to include root `.env`.
   - Keep `.env.example` tracked with placeholders only.

2. Normalize `.env.example`
   - Keep only safe placeholder values for public frontend config and documented runtime secret names.
   - Do not add real Twilio, Gemini, Meta, Supabase service-role, or other private values.

3. Clean `index.html`
   - Remove the hardcoded Supabase `preconnect` and `dns-prefetch` tags.
   - Do not replace them with env substitution in static HTML.
   - Leave unrelated preconnects and metadata untouched.

4. Clean Supabase function tests only
   - Replace hardcoded production Supabase URLs with `https://example.supabase.co`.
   - Replace hardcoded public anon key test constants with a placeholder JWT-shaped string or environment-driven placeholder that will not match the real Netlify env value.
   - Do not touch Edge Function runtime code.
   - Do not touch `send-otp`, `verify-otp`, `scan-quote`, report reveal, contractor outcome flow, or revenue dispatch.

5. Handle the migration conservatively
   - Because the specified migration uses the URL in operational SQL, I will leave it unchanged by default and report it as an intentional remaining match.
   - If Netlify secret scan still fails on migrations, the safe deployment unblock options are outside the source-code patch:
     - configure Netlify `SECRETS_SCAN_OMIT_KEYS` for these public browser config env names, and/or
     - confirm whether the historical migration can be replaced with a placeholder without affecting DB replay expectations.

6. Add Netlify deployment documentation
   - Create `docs/deployment/netlify-deploy-checklist.md` with:
     - Required Netlify env vars:
       - `VITE_SUPABASE_URL`
       - `VITE_SUPABASE_PUBLISHABLE_KEY`
     - Recommended omit keys for public browser config:
       - `SECRETS_SCAN_OMIT_KEYS=VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY,VITE_SUPABASE_ANON_KEY`
     - Explicitly avoid recommending `SECRETS_SCAN_ENABLED=false` except as emergency-only/not preferred.
     - Note that `GEMINI_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` generally belong in Supabase Edge Function secrets unless Netlify Functions need them.
     - Note that Vite only exposes variables prefixed with `VITE_` to browser code.

7. Validation after patch
   - Run:
     - `git diff --name-only`
     - `bun run build`
     - `npx tsc --noEmit`
     - `grep -R "wkrcyxcnzhwjtdpmfpaf.supabase.co" . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git`
   - Expected result:
     - No hardcoded source/test/index matches remain.
     - The specified migration may remain as an intentional operational SQL match unless separately approved for migration history cleanup.

### Expected files changed

- `.gitignore`
- `.env.example`
- `index.html`
- `supabase/functions/contractor-actions/index.test.ts`
- `supabase/functions/voice-followup/index.test.ts`
- `supabase/functions/contractor-send-followups/index.test.ts`
- `supabase/functions/contractor-mark-no-show/index.test.ts`
- `supabase/functions/contractor-booking-confirmed/index.test.ts`
- `docs/deployment/netlify-deploy-checklist.md`
- `.env` removed from tracked workspace

### Files intentionally not changed

- `src/integrations/supabase/client.ts` because it already reads `import.meta.env` only.
- `vite.config.ts` because it does not hardcode the Supabase URL/key.
- `supabase/migrations/20260404105923_eab75b78-c0ea-4a08-a255-a142bc302c2f.sql` because the hardcoded URL is operational SQL, not cosmetic/test-only.

### Commit message

```text
fix(deploy): unblock netlify secret scan
```