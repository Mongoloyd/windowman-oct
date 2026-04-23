

## Rotate `DEV_BYPASS_SECRET` end-to-end (no `.env`, no committed values)

### Step 1 — Lovable client secret (I trigger the secure input)

I'll invoke the secure secret-entry tool for **`VITE_DEV_BYPASS_SECRET`**. A secure paste field appears in the chat. You paste your saved value there. Lovable stores it encrypted; it's never written to any file or echoed back.

Constraints for the value:
- no square brackets `[ ]`
- no surrounding quotes
- no leading/trailing spaces
- exact same string you'll paste into Supabase in Step 3

### Step 2 — `.env.example` cleanup (code change, no secrets)

Edit `.env.example` only:

- **Remove** the line `VITE_ADMIN_SECRET="your-secret-here"` (legacy, zero references in codebase)
- **Update** the comment above `VITE_DEV_BYPASS_SECRET` to read:
  ```
  # ═══ Dev Bypass Secret ═══
  # MUST match DEV_BYPASS_SECRET in Supabase Edge Function secrets exactly.
  # No brackets, no quotes, no surrounding whitespace.
  # Used by: supabase/functions/dev-report-unlock + client dev panel.
  VITE_DEV_BYPASS_SECRET="your-secret-here"
  ```

No other files touched. No application code changes.

### Step 3 — Supabase server secret (you do this manually)

After Step 1 completes:

1. Open Supabase → Project → Edge Functions → **Manage secrets**
2. Find **`DEV_BYPASS_SECRET`** (already exists)
3. Click edit → paste the **exact same value** you pasted in Step 1
4. Save

That's it. The edge function `dev-report-unlock` reads `Deno.env.get("DEV_BYPASS_SECRET")` and will pick up the new value on next invocation.

### What is NOT changing

- `VITE_ADMIN_SECRET` stays removed from `.env.example`; it's not deleted from the Lovable secret store in this pass (dormant, harmless, separate cleanup if you want it later)
- No changes to: upload, OTP, scan-quote, admin logic, GTM/CAPI tracking, report reveal, RLS, or any edge function code
- No `.env` file created
- No secret value written to any tracked file or chat message

### Verification after rotation

- Client: dev panel actions that use the bypass should keep working in preview
- Server: `dev-report-unlock` should return data when called with the new `dev_secret`; calls with the old value should now return `403 Forbidden`

### Rollback

If anything breaks: re-paste the previous value into both `VITE_DEV_BYPASS_SECRET` (Lovable) and `DEV_BYPASS_SECRET` (Supabase). No code rollback needed because no code logic changes.

