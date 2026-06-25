# google-ads-conversion-event

Internal Google Ads conversion sender for WindowMan's **master** Google Ads account.

## Sprint 4C status

**Dry-run only.** This function validates `mapToGoogle`-shaped payloads and returns masked proof. It does **not** call Google Ads API.

Live upload (`dry_run: false`) is rejected with a non-retryable error.

## Request shape

```json
{
  "dry_run": true,
  "payload": {
    "conversion_action": "wm_phone_verified",
    "transaction_id": "wmc_qa_4c_example",
    "conversion_date_time": "2026-06-24T12:00:00.000Z",
    "conversion_value": 0,
    "currency_code": "USD",
    "gclid": "<fake-qa-gclid>",
    "user_identifiers": {
      "hashed_email": "<64-char-sha256-hex>"
    }
  }
}
```

## Auth

Internal callers only:

- `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
- `x-capi-dispatch-secret: <CAPI_DISPATCH_SECRET>`
- `x-google-ads-dispatch-secret: <GOOGLE_ADS_DISPATCH_AUTH_TOKEN or CAPI_DISPATCH_SECRET>`

## Wiring (future 4D)

After deploy approval, staging may set:

```txt
GOOGLE_ADS_DISPATCH_URL = https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/google-ads-conversion-event
```

Worker integration and live Google upload require separate sprint approvals.

See [GOOGLE_ADS_4C_DRY_RUN_SCAFFOLD_RUNBOOK.md](../../docs/ops/GOOGLE_ADS_4C_DRY_RUN_SCAFFOLD_RUNBOOK.md).
