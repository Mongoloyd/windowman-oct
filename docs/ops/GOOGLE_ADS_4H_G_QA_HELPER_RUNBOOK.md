# Google Ads 4H-G — Staging-Only Click-ID QA Helper Runbook

Human-operated runbook for the `qa-google-attribution-event` Edge Function.

**Purpose:** Create exactly one synthetic Google attribution proof candidate on staging without OTP, Twilio, upload, scanner, or report reveal. Proves:

```text
synthetic QA lead with gclid/gbraid/wbraid
→ mapped canonical event (default lead_identified)
→ wm_event_log.attribution + query_params populated
→ wm_platform_dispatch_log google_ads pending row
→ dispatch_id returned for scoped worker smoke
```

**Target staging:** `zgsofkgddpcntdvpckdq`

**Forbidden production:** `wkrcyxcnzhwjtdpmfpaf` — helper hard-denies this ref at runtime.

---

## Staging-only warning

- Do **not** deploy to production.
- Do **not** set `QA_HELPER_ENABLED=true` on production.
- Do **not** add this function to the default CRM/dispatch deploy wrapper.
- Disable or undeploy after proof is complete.

---

## Required secrets (placeholders only)

Set on staging only via Supabase Dashboard or CLI (`supabase secrets set` — human only):

| Secret | Example value | Notes |
|--------|---------------|-------|
| `QA_HELPER_ENABLED` | `true` | Fail-closed when not exactly `true` |
| `QA_HELPER_SECRET` | `<rotate-me-staging-only>` | Compared to `x-qa-helper-secret` header |
| `QA_HELPER_PROJECT_REF` | `zgsofkgddpcntdvpckdq` | Must match approved staging ref |
| `WM_SUPABASE_PROJECT_REF` | `zgsofkgddpcntdvpckdq` | Must equal `QA_HELPER_PROJECT_REF` |

Never commit real secret values. Never paste secrets into chat or logs.

---

## Deploy (human only)

Verify project ref before deploy:

```powershell
$env:SUPABASE_PROJECT_REF = "zgsofkgddpcntdvpckdq"
# Confirm ref is NOT wkrcyxcnzhwjtdpmfpaf

supabase functions deploy qa-google-attribution-event --project-ref zgsofkgddpcntdvpckdq
```

Do **not** use `scripts/deploy-functions-forensic-v2-live.ps1` for this helper unless a future sprint adds an explicit `-QaHelperOnly` mode.

---

## Helper smoke (human only, after deploy)

### PowerShell template

```powershell
$StagingUrl = "https://zgsofkgddpcntdvpckdq.supabase.co"
$AnonKey = "<STAGING_ANON_KEY>"
$QaSecret = "<QA_HELPER_SECRET>"

$Body = @{
  event_name = "lead_identified"
  lead = @{
    email = "qa+google-clickid-proof@example.com"
    phone = "+17545550123"
  }
  attribution = @{
    utm_source = "google"
    utm_medium = "cpc"
    utm_campaign = "qa_google_4h_clickid_proof"
    gclid = "qa-gclid-4h-clickid-proof"
    gbraid = "qa-gbraid-4h-clickid-proof"
    wbraid = "qa-wbraid-4h-clickid-proof"
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method POST `
  -Uri "$StagingUrl/functions/v1/qa-google-attribution-event" `
  -Headers @{
    "Authorization" = "Bearer $AnonKey"
    "Content-Type" = "application/json"
    "x-qa-helper-secret" = $QaSecret
  } `
  -Body $Body
```

### curl template

```bash
curl -sS -X POST \
  "https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/qa-google-attribution-event" \
  -H "Authorization: Bearer <STAGING_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -H "x-qa-helper-secret: <QA_HELPER_SECRET>" \
  -d '{
    "event_name": "lead_identified",
    "lead": {
      "email": "qa+google-clickid-proof@example.com",
      "phone": "+17545550123"
    },
    "attribution": {
      "utm_source": "google",
      "utm_medium": "cpc",
      "utm_campaign": "qa_google_4h_clickid_proof",
      "gclid": "qa-gclid-4h-clickid-proof",
      "gbraid": "qa-gbraid-4h-clickid-proof",
      "wbraid": "qa-wbraid-4h-clickid-proof"
    }
  }'
```

Record `lead_id`, `event_log_id`, `event_id`, and `dispatch_id` from the response.

---

## SQL verification (read-only)

Replace placeholders with values from the helper response.

```sql
-- Synthetic lead with click IDs
SELECT id, source, client_slug, gclid, gbraid, wbraid, attribution, query_params
FROM public.leads
WHERE id = '<lead_id>';

-- Event log attribution snapshot
SELECT id, event_id, event_name, attribution, query_params,
       payload->'identity' AS identity
FROM public.wm_event_log
WHERE id = '<event_log_id>';

-- Pending google_ads dispatch row
SELECT id AS dispatch_id, platform_name, dispatch_status, event_log_id
FROM public.wm_platform_dispatch_log
WHERE id = '<dispatch_id>'
  AND platform_name = 'google_ads';
```

Expected:

- `leads.source = qa_google_4h_clickid_proof`
- `leads.phone_verified = false`
- `wm_event_log.attribution` contains `gclid`, `gbraid`, `wbraid`
- `wm_event_log.query_params` contains the same click IDs
- `wm_platform_dispatch_log.dispatch_status = pending`

---

## Scoped worker smoke (human only, separate step)

**Do not** run generic FIFO worker drain against the staging backlog.

Use the known `dispatch_id` from the helper response. See [GOOGLE_ADS_4F_SCOPED_WORKER_CLAIM_RUNBOOK.md](./GOOGLE_ADS_4F_SCOPED_WORKER_CLAIM_RUNBOOK.md).

```powershell
$StagingUrl = "https://zgsofkgddpcntdvpckdq.supabase.co"
$ServiceRoleKey = "<STAGING_SERVICE_ROLE_KEY>"
$DispatchSecret = "<DISPATCH_WORKER_SECRET>"
$DispatchId = "<dispatch_id from helper>"

$Body = @{
  target_platform = "google_ads"
  dispatch_id = $DispatchId
  limit = 1
} | ConvertTo-Json

Invoke-RestMethod `
  -Method POST `
  -Uri "$StagingUrl/functions/v1/dispatch-platform-events" `
  -Headers @{
    "Authorization" = "Bearer $ServiceRoleKey"
    "Content-Type" = "application/json"
    "x-dispatch-secret" = $DispatchSecret
  } `
  -Body $Body
```

### Expected final proof

After scoped worker smoke, verify:

```sql
SELECT dispatch_status, provider_response_body
FROM public.wm_platform_dispatch_log
WHERE id = '<dispatch_id>';
```

Success criteria:

- `dispatch_status = sent`
- Provider response includes `dry_run: true`
- `match_identifier_types` includes at least one of: `gclid`, `gbraid`, `wbraid`

**Forbidden in this proof path:**

- `dry_run: false`
- Live calls to `googleads.googleapis.com`
- Generic platform-only worker scope without `dispatch_id`

---

## Cleanup / disable plan

1. Set `QA_HELPER_ENABLED=false` on staging (helper returns 404).
2. Optionally undeploy: `supabase functions delete qa-google-attribution-event --project-ref zgsofkgddpcntdvpckdq`
3. Delete synthetic rows when proof is complete:

```sql
-- Review counts before delete
SELECT count(*) FROM public.leads WHERE source = 'qa_google_4h_clickid_proof';
SELECT count(*) FROM public.wm_event_log WHERE event_id LIKE 'wmc_qa_4hg_%';

-- Delete QA event logs (cascades dispatch rows)
DELETE FROM public.wm_event_log WHERE event_id LIKE 'wmc_qa_4hg_%';

-- Delete orphaned QA leads
DELETE FROM public.leads WHERE source = 'qa_google_4h_clickid_proof';
```

---

## What not to touch

This helper must **not** invoke:

- `dispatch-platform-events` (from helper itself)
- `google-ads-conversion-event` (from helper itself)
- `send-otp` / `verify-otp`
- `scan-quote` / `start-upload-scan-session`
- `report-access`

Do not modify Meta, TikTok, or Nextdoor senders for this proof.

Do not run migrations or change production config for this sprint.

---

## Allowed event names (v1)

| Event | Google action |
|-------|---------------|
| `lead_identified` (default) | `wm_lead_identified` |
| `lead_qualified` | `wm_lead_qualified` |
| `phone_verified` | `wm_phone_verified` |
| `report_revealed` | `wm_report_revealed` |
| `appointment_booked` | `wm_appointment_booked` |
| `sale_confirmed` | `wm_sale_confirmed` |

Quote events (`quote_uploaded`, `quote_validation_passed`, etc.) are rejected in v1.

---

*Last updated: 2026-06-25 — implementation sprint 4H-H. Deploy and smoke are human-operated only.*
