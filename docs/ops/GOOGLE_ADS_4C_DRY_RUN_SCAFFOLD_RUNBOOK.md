# Google Ads Sprint 4C — Internal Sender Dry-Run Scaffold Runbook

Human-operated only. **Sprint 4C — dry-run scaffold only. No live Google Ads API calls.**

**Objective:** Validate the new internal Edge Function `google-ads-conversion-event` accepts `mapToGoogle`-shaped payloads with `dry_run: true` and returns masked proof — **without** invoking `dispatch-platform-events` or touching the dispatch queue.

**Target staging:** `zgsofkgddpcntdvpckdq` | **Forbidden production:** `wkrcyxcnzhwjtdpmfpaf`

> **Operational role note:** **Target staging** = LIVE_ACTIVE. **Forbidden production** = LEGACY_PARENT. See [SUPABASE_ENVIRONMENT_REGISTRY.md](./SUPABASE_ENVIRONMENT_REGISTRY.md).

**Related:**

- [GOOGLE_ADS_4B_INTERNAL_SENDER_DESIGN.md](./GOOGLE_ADS_4B_INTERNAL_SENDER_DESIGN.md)
- [GOOGLE_ADS_4A_DIRECT_BRIDGE_SMOKE_RUNBOOK.md](./GOOGLE_ADS_4A_DIRECT_BRIDGE_SMOKE_RUNBOOK.md)

---

## 1. Purpose

Sprint **4C** implements the **dry-run-only** internal Google sender scaffold:

```txt
supabase/functions/google-ads-conversion-event/index.ts
supabase/functions/_shared/googleAdsConversionValidation.ts
```

**Current status:** Live Google upload is **not enabled**. Requests with `dry_run: false` are rejected.

**Not in scope for 4C:**

- Google Ads API HTTP calls
- `dispatch-platform-events` worker invocation
- Queue drain or mutation
- `GOOGLE_ADS_DISPATCH_URL` wiring (deferred to **4D** after deploy approval)
- Live `dry_run: false` (separate sprint approval)

---

## 2. Hard Boundaries

| Boundary | Rule |
|----------|------|
| Production | No production Google Ads or Supabase `wkrcyxcnzhwjtdpmfpaf` |
| Worker | **Do not** invoke `dispatch-platform-events` |
| Queue | Do not drain or mutate `wm_platform_dispatch_log` |
| Live Google | **Do not** call Google Ads API |
| Deploy | Human-operated deploy only when separately approved |

---

## 3. Required Secret Names (no values)

Optional for dry-run **success** (config presence flags only):

| Secret | Purpose |
|--------|---------|
| `GOOGLE_ADS_CUSTOMER_ID` | WindowMan master customer ID |
| `GOOGLE_ADS_CONVERSION_ACTION_ID` | Default conversion action |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads API developer token |
| `GOOGLE_ADS_CLIENT_ID` | OAuth client ID |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | OAuth refresh token |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Optional MCC login customer ID |

Auth for direct smoke (one of):

| Secret / header | Purpose |
|-----------------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | `Authorization: Bearer` |
| `CAPI_DISPATCH_SECRET` | `x-capi-dispatch-secret` |
| `GOOGLE_ADS_DISPATCH_AUTH_TOKEN` | `x-google-ads-dispatch-secret` (optional) |

**Do not paste secret values into docs, tickets, or chat.**

---

## 4. Request Contract

```json
{
  "dry_run": true,
  "payload": {
    "conversion_action": "wm_phone_verified",
    "transaction_id": "wmc_qa_4c_<timestamp>",
    "conversion_date_time": "2026-06-24T12:00:00.000Z",
    "conversion_value": 0,
    "currency_code": "USD",
    "gclid": "CjwKCAiAQa4a_FAKE_GCLID_STAGING_SMOKE_ONLY",
    "user_identifiers": {
      "hashed_email": "<64-char-sha256-hex>",
      "hashed_phone_number": "<64-char-sha256-hex>"
    }
  }
}
```

**Required:**

- `dry_run: true`
- `conversion_action` or `conversion_action_id`
- `transaction_id` or `event_id`
- `conversion_date_time` or `event_time`
- At least one match identifier: `gclid`, `gbraid`, `wbraid`, hashed email, hashed phone

**Rejected:**

```json
{ "dry_run": false, "payload": {} }
```

Response:

```json
{
  "success": false,
  "dry_run": false,
  "retryable": false,
  "error": "Live Google Ads dispatch is not enabled in 4C"
}
```

---

## 5. Direct POST Dry-Run Template

**After deploy approval only.** Replace placeholders; never commit real tokens.

```powershell
$StagingProjectRef = "zgsofkgddpcntdvpckdq"
if ($StagingProjectRef -eq "wkrcyxcnzhwjtdpmfpaf") { throw "SAFETY STOP: production ref forbidden" }

$FakeEmail = "qa4c@example.com"
$FakePhone = "+15555550402"

$EmailHash = [System.BitConverter]::ToString(
  [System.Security.Cryptography.SHA256]::Create().ComputeHash(
    [System.Text.Encoding]::UTF8.GetBytes($FakeEmail.ToLower().Trim())
  )
).Replace("-", "").ToLower()

$PhoneHash = [System.BitConverter]::ToString(
  [System.Security.Cryptography.SHA256]::Create().ComputeHash(
    [System.Text.Encoding]::UTF8.GetBytes($FakePhone.Trim())
  )
).Replace("-", "").ToLower()

$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$TransactionId = "wmc_qa_4c_$(Get-Date -UFormat %s)"

$Body = @{
  dry_run = $true
  payload = @{
    conversion_action = "wm_phone_verified"
    transaction_id = $TransactionId
    conversion_date_time = $Timestamp
    conversion_value = 0
    currency_code = "USD"
    gclid = "CjwKCAiAQa4a_FAKE_GCLID_4C_SMOKE_ONLY"
    user_identifiers = @{
      hashed_email = $EmailHash
      hashed_phone_number = $PhoneHash
    }
  }
} | ConvertTo-Json -Depth 6 -Compress

$FunctionUrl = "https://$StagingProjectRef.supabase.co/functions/v1/google-ads-conversion-event"
$ServiceRoleKey = "<STAGING_SUPABASE_SERVICE_ROLE_KEY>"

$Headers = @{
  "Content-Type" = "application/json"
  "Authorization" = "Bearer $ServiceRoleKey"
}

Write-Host "4C dry-run smoke: POST to google-ads-conversion-event (NOT dispatch-platform-events)"

try {
  $Response = Invoke-WebRequest -Uri $FunctionUrl -Method POST -Headers $Headers -Body $Body -UseBasicParsing
  Write-Host "HTTP status:" $Response.StatusCode
  Write-Host "Response body:" $Response.Content
} catch {
  if ($_.Exception.Response) {
    Write-Host "HTTP status:" $_.Exception.Response.StatusCode.value__
    $Reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "Response body:" $Reader.ReadToEnd()
  } else {
    Write-Host "Error:" $_.Exception.Message
  }
}
```

---

## 6. Pass / Fail Criteria

### Pass

- HTTP **200**
- `success: true`, `dry_run: true`
- `masked_conversion_action`, `masked_transaction_id` present (masked)
- `match_identifier_types` includes expected identifiers
- `config_presence` booleans only — no secret values
- No raw PII in response
- **`dispatch-platform-events` not invoked**
- Queue counts unchanged

### Fail

- HTTP 401 (auth misconfigured)
- HTTP 403 on `dry_run: false` attempt (expected rejection)
- HTTP 400 validation errors
- Raw email/phone/gclid in response body
- Queue counts change during smoke

---

## 7. Safety Stop Criteria

```text
SAFETY STOP

Phase: Google Ads 4C
Reason: <e.g. live Google API required / worker invoked / production endpoint>
Evidence: <what you observed>
Recommended next action: <stop and escalate>
```

Stop immediately if:

- Live Google upload is attempted (`dry_run: false` expecting success)
- `dispatch-platform-events` is invoked
- Queue counts drop or `sent` increases
- Production project or live ad account touched
- Secret values appear in logs or tickets

---

## 8. What Not to Touch

- `dispatch-platform-events` worker invocation
- `wm_platform_dispatch_log` bulk cleanup / drain
- Meta / TikTok / Nextdoor CAPI paths
- OTP / scanner / report / funnel code
- Production `wkrcyxcnzhwjtdpmfpaf`

---

## 9. Next Sprint Notes

### 4D — Wire internal URL (after deploy approval)

```txt
GOOGLE_ADS_DISPATCH_URL = https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/google-ads-conversion-event
GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY = true
```

Requires separate **SPRINT APPROVAL** before editing `dispatch-platform-events`.

### Live Google upload

Requires:

- Full OAuth credential stack (§3)
- Dry-run smoke PASS
- Attribution persistence audit PASS
- Explicit human approval for `dry_run: false`
- Platform-isolated worker claim before any worker E2E

---

## 10. Local Verification (developers)

```powershell
deno test --allow-env supabase/functions/_shared/googleAdsConversionValidation.test.ts
```

---

*Last updated: 2026-06-24 — Sprint 4C dry-run scaffold only.*
