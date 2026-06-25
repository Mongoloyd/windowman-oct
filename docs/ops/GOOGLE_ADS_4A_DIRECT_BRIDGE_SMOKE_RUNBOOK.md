# Google Ads Sprint 4A — Staging Direct Bridge Smoke Runbook

Human-operated only. **Documentation sprint — no code, deploy, migration, secret writes, worker invocation, or production touch.**

**Objective:** Validate that the **external Google Ads dispatch bridge** (`GOOGLE_ADS_DISPATCH_URL`) accepts the payload shape that `dispatch-platform-events` would POST via `sendToGoogle` — **without** invoking the shared worker or touching the dispatch queue.

**Explicitly out of scope for 4A:**

- Production Google Ads or production Supabase project
- Worker E2E Google dispatch (`dispatch-platform-events`)
- Queue drain, row claim, or backlog triage
- Meta / TikTok / Nextdoor dispatch work
- OTP / scanner / report / funnel changes
- In-repo Google sender Edge Function (none exists today)

**Target:** Forensic V2 staging `zgsofkgddpcntdvpckdq` (see [SUPABASE_TARGETING.md](./SUPABASE_TARGETING.md))

**Forbidden:** Production `wkrcyxcnzhwjtdpmfpaf` — do not set secrets, deploy functions, invoke workers, or send conversions there.

---

## 1. Purpose

Sprint **4A** validates the **external Google bridge contract only**.

Canonical enqueue is already proven: `createCanonicalEvent` writes `google_ads` rows when `shouldSendGoogle === true`, and `dispatchWorker` has a `google_ads` branch that maps via `mapToGoogle` and POSTs via `sendToGoogle`. What is **not** proven:

- That `GOOGLE_ADS_DISPATCH_URL` is configured on staging
- That the external bridge accepts the mapped payload
- That the bridge returns a success response the worker would treat as `sent`

4A is a **direct POST smoke** to the bridge URL (staging/test endpoint only). It does **not** validate worker claim/write-back, retry policy, or queue lifecycle. Those require separate sprint approval (**4B**).

---

## 2. Current Baseline

| Item | Value |
|------|-------|
| **Google enqueue** | **Confirmed** — `createCanonicalEvent` enqueues `google_ads` when `shouldSendGoogle === true` |
| **Worker Google branch** | **Confirmed** — `dispatchWorker` calls `mapToGoogle` → `sendToGoogle` for `platform_name = google_ads` |
| **Google `sent` rows (staging)** | **0** — no successful Google dispatch observed |
| **Staging queue snapshot (planning baseline — re-check before any future worker work)** | See table below |
| **In-repo Google sender** | **None** — no `google-ads-*` Edge Function; outbound path is external URL only |
| **Dry-run / test mode** | **Not proven in repo** — no `dry_run` flag on Google path (unlike TikTok worker gate) |
| **Bridge dependency** | Worker `sendToGoogle` fails fast when `GOOGLE_ADS_DISPATCH_URL` is empty |

### Staging `google_ads` queue snapshot (as of 4A planning)

| `dispatch_status` | Approx. count |
|-------------------|---------------|
| `pending` | 680 |
| `processing` | 10 |
| `suppressed` | 80 |
| `dead_letter` | 22 |
| `sent` | 0 |

**Interpretation:** Rows are enqueuing and some are failing/suppressed, but **zero** have reached `sent`. The worker path depends on a configured external bridge; 4A validates that bridge in isolation.

**Repo references (read-only audit):**

- Mapper: `supabase/functions/_shared/tracking/canonical/mapToGoogle.ts`
- Worker branch: `supabase/functions/_shared/tracking/canonical/dispatchWorker.ts` (`google_ads`)
- Sender wiring: `supabase/functions/dispatch-platform-events/index.ts` (`sendToGoogle`)

---

## 3. Hard Boundaries

Operators **must not** during 4A:

| Boundary | Rule |
|----------|------|
| Production | No production Google Ads account, conversion actions, or Supabase project `wkrcyxcnzhwjtdpmfpaf` |
| Worker invocation | **Do not** call `dispatch-platform-events` |
| Queue drain | Do not claim, retry, or bulk-process `wm_platform_dispatch_log` rows |
| Other platforms | No Meta / TikTok / Nextdoor CAPI or worker work |
| Schema / deploy | No migrations, `db push`, Edge Function deploys, or `gen types` |
| Secret automation | No agent or script `supabase secrets set`; Dashboard changes are human-only |
| Live Google Ads API | No direct Google Ads API call from this repo unless the **external bridge** is explicitly a staging/test endpoint |

**4A authorization:** Direct **POST to `GOOGLE_ADS_DISPATCH_URL`** with fake QA payload only.

**Safety stop:** If `google_ads` queue counts change (especially `pending` ↓ or `sent` ↑) during 4A, someone invoked the worker — stop and investigate.

---

## 4. Required Staging Config

All secret names below are **config references only**. **Do not paste values** into docs, tickets, or chat.

### 4.1 `dispatch-platform-events` secrets (bridge wiring)

| Secret | Required | Role |
|--------|----------|------|
| `GOOGLE_ADS_DISPATCH_URL` | **Yes** for any Google send | External HTTP endpoint the worker POSTs mapped payloads to |
| `GOOGLE_ADS_DISPATCH_AUTH_TOKEN` | Optional | When set, worker sends `Authorization: Bearer <token>` |

Set on Supabase Dashboard → **Project `zgsofkgddpcntdvpckdq`** → Edge Functions → Secrets.

**Verify project ref** before any Dashboard edit: URL must contain **`zgsofkgddpcntdvpckdq`**, never **`wkrcyxcnzhwjtdpmfpaf`**.

### 4.2 Secrets that exist but must **not** be used in 4A

| Secret | Why |
|--------|-----|
| `DISPATCH_WORKER_SECRET` | Authorizes `dispatch-platform-events` only — **4A must not invoke the worker** |
| `SUPABASE_SERVICE_ROLE_KEY` | Not used for direct bridge POST (unless bridge operator requires it — confirm with bridge owner) |

### 4.3 Blocker: URL not configured

If `GOOGLE_ADS_DISPATCH_URL` is **not** set on staging (or no staging/test bridge endpoint exists):

1. **4A cannot execute.**
2. Escalate to a **bridge design / spec sprint** — define the external service, staging endpoint, auth model, and test/sandbox mode before any smoke or worker E2E.

---

## 5. Bridge Contract

### 5.1 What `GOOGLE_ADS_DISPATCH_URL` is expected to do

The external bridge is a **server-side HTTP receiver** that:

1. Accepts `POST` with `Content-Type: application/json`
2. Optionally validates `Authorization: Bearer` when `GOOGLE_ADS_DISPATCH_AUTH_TOKEN` is configured on the worker
3. Accepts the **mapped Google payload** (see below) — the worker sends `JSON.stringify(payload)` with no extra wrapper
4. Forwards or records the conversion via Google Ads (implementation is **outside this repo**)
5. Returns HTTP **2xx** on success (worker treats `response.ok` as success; body is stored in `provider_response_body` but success does not require a specific JSON shape)

**Worker HTTP behavior (repo-verified):**

- Method: `POST`
- Headers: `Content-Type: application/json`; optional `Authorization: Bearer <GOOGLE_ADS_DISPATCH_AUTH_TOKEN>`
- Timeout: 7 seconds (`DEFAULT_TIMEOUT_MS` in `dispatch-platform-events`)
- Missing URL: worker returns non-retryable failure (`GOOGLE_ADS_DISPATCH_URL is not configured`)

### 5.2 Payload shape: `mapToGoogle` → `sendToGoogle`

Source: `supabase/functions/_shared/tracking/canonical/mapToGoogle.ts` (inspect before execution if mapper changed).

**Repo-verified fields sent by the worker:**

| Worker JSON field | Source | Notes |
|-------------------|--------|-------|
| `conversion_action` | `GOOGLE_ACTION_MAP[eventName]` | e.g. `wm_quote_uploaded`, `wm_phone_verified`, `wm_report_revealed` |
| `transaction_id` | `canonical.eventId` | Dedup key; must be stable |
| `conversion_date_time` | `canonical.eventTimestamp` | ISO-style timestamp string |
| `conversion_value` | `payload.optimization.valueUsd ?? 0` | Numeric USD value |
| `currency_code` | `"USD"` | Fixed |
| `gclid` | `identity.gclid` | Optional; at least one of click IDs or hashed PII required |
| `gbraid` | `identity.gbraid` | Optional |
| `wbraid` | `identity.wbraid` | Optional |
| `user_identifiers.hashed_email` | `identity.emailHash` | SHA-256 hex; optional |
| `user_identifiers.hashed_phone_number` | `identity.phoneHash` | SHA-256 hex; optional |

**Suppression rules (worker will not POST if mapper suppresses):**

- `shouldSendGoogle === false`
- Unknown `eventName` (no Google mapping)
- `quote_validation_passed` with unsafe anomaly or trust below threshold
- Missing attribution: no `gclid` / `gbraid` / `wbraid` **and** no hashed email/phone

**Canonical event → `conversion_action` map (repo-verified):**

| `eventName` | `conversion_action` |
|-------------|---------------------|
| `lead_identified` | `wm_lead_identified` |
| `lead_qualified` | `wm_lead_qualified` |
| `quote_uploaded` | `wm_quote_uploaded` |
| `quote_upload_completed` | `wm_quote_uploaded` |
| `quote_validation_passed` | `wm_quote_validation_passed` |
| `phone_verified` | `wm_phone_verified` |
| `report_revealed` | `wm_report_revealed` |
| `appointment_booked` | `wm_appointment_booked` |
| `sale_confirmed` | `wm_sale_confirmed` |

### 5.3 Fields **not** sent by `mapToGoogle` (bridge may still accept — confirm with bridge operator)

These appear in other platform mappers or canonical events but are **not** in the worker's Google POST body today:

| Concept | Repo status |
|---------|-------------|
| `event_name` | Use `conversion_action` instead |
| `event_id` | Use `transaction_id` instead |
| `event_time` | Use `conversion_date_time` instead |
| `external_id` / `lead_id` | **NEEDS REPO VERIFICATION** — not in `mapToGoogle`; add only if bridge contract requires |
| `client_slug` | **NEEDS REPO VERIFICATION** — Meta path adds this; Google path does not |
| `source_url` | **NEEDS REPO VERIFICATION** — not in `mapToGoogle` |

Before live bridge work, confirm with bridge owner whether extra fields are required. If the bridge expects fields the worker does not send, fix mapper or bridge in a **separate approved sprint** — not during 4A smoke unless the smoke is explicitly testing an extended contract.

---

## 6. Direct Smoke Template

Direct POST to **`<STAGING_GOOGLE_ADS_DISPATCH_URL>`** only. **Human executes** after confirming:

1. URL points to **staging/test bridge**, not production Google conversion upload
2. Dashboard secret is on project **`zgsofkgddpcntdvpckdq`**
3. **`dispatch-platform-events` will not be invoked**

**Requirements:**

- Fake QA `gclid` only (e.g. `CjwKCAiA...qa4a_fake` — not a real click)
- SHA-256 lowercase hex (64 chars) for fake email/phone hashes — never raw PII
- Fake `transaction_id` / event id prefix `wmc_qa_4a_`
- Fake `conversion_value` and `USD` currency
- **Do not** invoke `dispatch-platform-events`
- **Do not** insert or update `wm_platform_dispatch_log` for this test

Replace placeholders; do not commit real tokens or bridge URLs.

### 6.1 PowerShell template

```powershell
# Preflight: confirm staging project context only (4A does not call Supabase worker)
$StagingProjectRef = "zgsofkgddpcntdvpckdq"
if ($StagingProjectRef -eq "wkrcyxcnzhwjtdpmfpaf") { throw "SAFETY STOP: production ref forbidden" }

# Fake QA identity only — never use real homeowner PII
$FakeEmail = "qa4a@example.com"
$FakePhone = "+15555550401"

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
$TransactionId = "wmc_qa_4a_$(Get-Date -UFormat %s)"

# Payload mirrors mapToGoogle output (repo-verified field names)
$Body = @{
  conversion_action = "wm_phone_verified"
  transaction_id    = $TransactionId
  conversion_date_time = $Timestamp
  conversion_value  = 0
  currency_code     = "USD"
  gclid             = "CjwKCAiAQa4a_FAKE_GCLID_STAGING_SMOKE_ONLY"
  user_identifiers  = @{
    hashed_email        = $EmailHash
    hashed_phone_number = $PhoneHash
  }
} | ConvertTo-Json -Depth 5 -Compress

$BridgeUrl = "<STAGING_GOOGLE_ADS_DISPATCH_URL>"
$AuthToken = "<STAGING_GOOGLE_ADS_DISPATCH_AUTH_TOKEN>"  # omit header if bridge has no auth

$Headers = @{
  "Content-Type" = "application/json"
}
if ($AuthToken -and $AuthToken -notmatch "^<") {
  $Headers["Authorization"] = "Bearer $AuthToken"
}

Write-Host "4A smoke: POST to bridge (NOT dispatch-platform-events)"
Write-Host "transaction_id: $TransactionId"
Write-Host "gclid: CjwKCAiAQa4a_FAKE_GCLID_STAGING_SMOKE_ONLY"

try {
  $Response = Invoke-WebRequest -Uri $BridgeUrl -Method POST -Headers $Headers -Body $Body -UseBasicParsing
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

### 6.2 Optional read-only queue snapshot (before and after)

Run in Supabase SQL Editor on **staging only** — counts should be **unchanged** after 4A:

```sql
SELECT platform_name, dispatch_status, count(*) AS row_count
FROM public.wm_platform_dispatch_log
WHERE platform_name = 'google_ads'
GROUP BY platform_name, dispatch_status
ORDER BY dispatch_status;
```

---

## 7. Pass / Fail Criteria

### Pass

- Bridge returns HTTP **200 / 2xx**
- Bridge response indicates payload **accepted** (per bridge operator's success contract)
- Request used **fake QA** click id and **hashed** identity only — no raw email/phone in body or logs
- No secrets (auth token, service role, bridge URL with embedded credentials) pasted into tickets or docs
- **`wm_platform_dispatch_log` counts unchanged** by this test (no worker invocation)
- **Production not touched** — staging/test bridge only
- **`dispatch-platform-events` not invoked**

### Fail

- `GOOGLE_ADS_DISPATCH_URL` missing or unreachable
- Bridge returns 4xx/5xx or rejects payload shape
- Bridge requires fields the worker does not send (contract mismatch — stop and spec bridge + mapper alignment)
- Raw PII appears in request, response, or operator notes
- Unintentional **live production** Google conversion created
- Queue counts change during smoke (worker or other bulk process ran)
- Operator invoked `dispatch-platform-events`, `capi-event`, `tiktok-capi-event`, or `nextdoor-capi-event` as part of 4A

---

## 8. Post-Smoke Evidence Checklist

Human pastes back **redacted evidence only** (no secrets, no raw PII):

| Field | Value |
|-------|-------|
| HTTP status | |
| Bridge success (y/n + brief note) | |
| Request id (if bridge returns one) | |
| `conversion_action` used | |
| `transaction_id` / event id used | |
| Fake `gclid` used | |
| Hashed identity used (first 8 chars of hash ok) | |
| Raw PII found (must be **no**) | |
| Production touched (must be **no**) | |
| `dispatch-platform-events` invoked (must be **no**) | |
| Queue counts changed (must be **no**) | |

---

## 9. Why `dispatch-platform-events` Must Not Be Invoked Yet

1. **FIFO cross-platform claim:** `wm_claim_dispatch_rows` claims up to **25 rows across all platforms**, not Google-isolated. Invoking the worker can process Meta and Google backlog rows unintentionally.
2. **Large untriaged backlogs:** Staging has hundreds of pending `google_ads` rows and significant Meta backlog — worker invocation is a **queue drain**, not a controlled smoke.
3. **Zero `sent` baseline:** Worker E2E has never proven Google write-back to `sent`; debugging worker + bridge + backlog simultaneously is unsafe.
4. **4A scope:** Proves **bridge contract** only. Worker claim, retry, dead-letter, and `wm_event_log` sync are **4B**.

**Do not invoke `dispatch-platform-events` until 4B approval and one of the isolation mechanisms in §10 exists.**

---

## 10. Future 4B Design Note

Worker E2E Google dispatch requires **separate sprint approval** and must not proceed until at least one of:

| Prerequisite | Rationale |
|--------------|-----------|
| **Platform-isolated claim** | Claim only `google_ads` rows (RPC or filter change) |
| **Single `dispatch_id` claim** | Operator targets one known row for controlled E2E |
| **Dry-run / test bridge mode** | Bridge accepts payload but does not upload live conversions (mirror TikTok `dry_run` pattern) |
| **Queue cleanup / suppression plan** | Reduce `pending`/`processing`/`dead_letter` noise before FIFO worker runs |

**4B must also confirm:**

- `GOOGLE_ADS_DISPATCH_URL` and optional auth configured on staging
- 4A bridge smoke **PASS** with redacted evidence
- Pass/fail write-back to `wm_platform_dispatch_log.dispatch_status = sent`
- Explicit operator sign-off that Meta/TikTok rows will not be accidentally claimed

---

## 11. Related Docs

- [SUPABASE_TARGETING.md](./SUPABASE_TARGETING.md) — staging vs production project refs
- [SUPABASE_FUNCTION_MANIFEST.md](./SUPABASE_FUNCTION_MANIFEST.md) — `GOOGLE_ADS_DISPATCH_*` on `dispatch-platform-events`
- [DISPATCH_WORKER_RUNBOOK.md](../tracking/DISPATCH_WORKER_RUNBOOK.md) — queue lifecycle (read-only context for 4B)
- [TIKTOK_3C6_STAGING_LIVE_VALIDATION_RUNBOOK.md](./TIKTOK_3C6_STAGING_LIVE_VALIDATION_RUNBOOK.md) — parallel pattern: direct sender smoke without worker

---

## 12. Safety Stop Template

If any forbidden action is required to proceed:

```text
SAFETY STOP

Phase: Google Ads 4A
Reason: <e.g. GOOGLE_ADS_DISPATCH_URL missing / worker required / production endpoint detected>
Evidence: <what you observed>
Recommended next action: <bridge spec sprint / 4B planning / human Dashboard secret setup>
```

---

*Last updated: 2026-06-24 — documentation sprint 4A only.*
