# Netlify Deploy Checklist

## Required environment variables

Set these in Netlify for the production site:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-anon-key
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are public browser configuration values. They are required at build time so Vite can expose them to client-side code.

## Recommended Netlify secret scan configuration

Because these values are intentionally public browser config, configure Netlify secret scanning to omit these public env keys:

```text
SECRETS_SCAN_OMIT_KEYS=VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY,VITE_SUPABASE_ANON_KEY
```

Do not disable secret scanning globally. `SECRETS_SCAN_ENABLED=false` should only be considered as an emergency-only workaround and is not the preferred configuration.

## Backend/runtime secrets

These should generally live in Supabase Edge Function secrets unless Netlify Functions actually need them:

```text
GEMINI_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_VERIFY_SERVICE_SID
```

Do not place Supabase service-role keys, Twilio credentials, Gemini keys, Meta tokens, or other private credentials in browser code or committed files.

## Vite browser exposure rule

Vite only exposes environment variables prefixed with `VITE_` to browser code. Non-`VITE_` secrets should not be relied on in the client bundle.
