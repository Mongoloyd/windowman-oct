I’m currently in Plan/read-only mode, so I can’t modify `src/integrations/supabase/client.ts`, rebuild, or republish yet. Once approved/switching to Build mode is allowed, I will make exactly this narrow fix.

Implementation plan

1. Modify only this file:
  - `src/integrations/supabase/client.ts`
2. Replace the current required env-only constants with public browser-safe fallback values:

```ts
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://wkrcyxcnzhwjtdpmfpaf.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_JTHC-098GYEItvrHERbbZw_SzhUbcT4";
```

3. Update the Supabase client creation to use:

```ts
createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ...)
```

4. Add development-only warnings if either fallback is being used:
  - warn if `VITE_SUPABASE_URL` is missing and the URL fallback is used
  - warn if both `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_ANON_KEY` are missing and the publishable-key fallback is used
5. Do not throw in production when the public fallback values exist.
6. Do not touch:
  - Supabase Edge Functions
  - migrations
  - OTP/Twilio
  - scanner
  - report reveal
  - tracking
  - routes
  - `package.json`
  - `package-lock.json`
  - any file other than `src/integrations/supabase/client.ts`
7. Verification after the edit:
  - let the automatic build/check pipeline run
  - republish/rebuild through the available Lovable publishing flow
  - open `https://wmmvp.lovable.app/`
  - confirm the homepage renders
  - confirm the console no longer shows `supabaseUrl is required`

Expected changed files

```text
src/integrations/supabase/client.ts
```

Security boundary

- The fallback key will be the public `sb_publishable` key only.
- No `sb_secret` key will be used, requested, echoed, or stored in source.
- No backend secrets or Edge Function secrets will be involved.