## Goal
Add the two Gemini-related secrets to Lovable's runtime secret store so that Edge Functions (`scan-quote`, `generate-negotiation-script`) can access them via `Deno.env.get()`.

## Context
- Current Lovable secrets do NOT include `GEMINI_SCAN_MODEL` or `GEMINI_API_KEY` (confirmed via fetch).
- The `scan-quote` Edge Function reads `GEMINI_SCAN_MODEL` to override the default `gemini-3.1-flash-lite-preview` fallback.
- The `generate-negotiation-script` Edge Function reads `GEMINI_API_KEY` to call the Gemini API.
- The user wants `GEMINI_SCAN_MODEL` set to `gemini-3.1-flash-lite` (replacing the sunset preview model).

## Plan
1. Call `secrets--add_secret` with `["GEMINI_SCAN_MODEL", "GEMINI_API_KEY"]`.
2. The user will be prompted in a secure form to enter both values.
3. After the user submits, both secrets will be available to all Edge Functions at runtime.

## No code changes required
This is a pure secret configuration update. No files in the repo will be modified.