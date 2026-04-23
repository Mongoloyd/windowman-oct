WINDOWMAN / wm-mvp — HARD SYSTEMS GUARDRAILS

Prefer stricter, safer enforcement over cheaper shortcuts.

1. PRODUCT BOUNDARY
- WindowMan is Verify-to-Reveal.
- Preview may be shown; full report must NEVER be preloaded or revealed before backend authorization.
- CSS hiding is never a substitute for backend enforcement.

2. CANONICAL SCAN PATH
- Canonical flow: private `quotes` storage -> `quote_files` -> `scan_sessions` -> `scan-quote` -> `analyses`.
- `analyses` is canonical. `quote_analyses` is legacy.
- Preserve preview/full separation.

3. AI / SCORING RULES
- Gemini handles extraction/classification only.
- Grade + pillar scores are deterministic backend TypeScript, NEVER AI-generated.
- Never call Gemini or any AI provider directly from the browser.
- Low-confidence/unreadable scans must fail safely to manual review / safe fallback, not fake certainty.

4. OTP / AUTH RULES
- Preserve `send-otp` and `verify-otp` via Twilio Verify in Supabase Edge Functions.
- No frontend-only OTP logic, no generic SMS hacks, no mocked success states on live paths.
- `usePhonePipeline` supports only `validate_only` and `validate_and_send_otp` unless deliberately upgraded across the real architecture.

5. UNLOCK INTEGRITY
- OTP success may unlock ONLY the exact authorized `scan_session_id` / `lead_id` it belongs to.
- No cross-unlock behavior.
- Do not fetch full report payload before authorization succeeds.

6. DATA / SECURITY RULES
- Quote files remain private and require signed access after validation.
- RLS + backend authorization are mandatory.
- Raw OCR text stays backend; frontend gets structured payloads only.
- Preserve the `public.profiles` auto-create trigger tied to `auth.users` unless intentionally migrated with a full replacement plan.

7. IDENTITY / ATTRIBUTION
- `lead_id` = persistent identity.
- `scan_session_id` = per-scan identity.
- `event_id` = dedup key; generate once and never regenerate downstream.
- `session_id` is optional context only.
- `client_slug` MUST NOT be NULL on lead creation.
- Fallback chain: 1) URL route/query param -> 2) `localStorage.getItem('wm_client_slug')` -> 3) `'direct'`.

8. TRACKING / META CAPI
- Preserve the two-lane model:
  business events -> `window.dataLayer` / GTM
  operational telemetry -> `event_logs`
- High-value events (ex: phone verified / reveal milestones) fire server-side via Meta CAPI from Edge Functions.
- High-value CAPI payloads must include: deterministic `event_id`, `external_id=lead_id`, `fbp`, `fbc`, and server-side SHA-256 hashed email/phone.
- Preserve `capi-event` as the Meta server bridge unless intentionally migrated.

9. ACCESS LADDER
- Anonymous: may initiate upload/session flow and read processing status only.
- Identified but unverified: teaser-only data, never full analysis.
- Verified + authorized: full report for own authorized data only.

10. ANTI-HALLUCINATION
- Only use real repo functions from `/supabase/functions`.
- Do not invent fake architecture or fake function names.
- Especially protect: `scan-quote`, `send-otp`, `verify-otp`, `capi-event`.
- Do not casually modify private storage, scoring, RLS, slug routing, preview/full boundaries, or conversion routing.
