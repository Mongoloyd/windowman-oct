# TikTok Sprint 3C-6 — Staging Live Test-Event Validation Runbook

Human-operated only. **Documentation sprint — no code, deploy, migration, secret writes, worker invocation, or production touch.**

**Objective:** Validate that a **real TikTok Events API test event** reaches TikTok Events Manager from **staging** via the **direct `tiktok-capi-event` sender path** with `dry_run: false` and a required `test_event_code`.

**Explicitly out of scope for 3C-6:**

- Production TikTok or production Supabase project
- Worker E2E live TikTok dispatch (`dispatch-platform-events`)
- Bulk Meta / Google Ads queue processing
- Nextdoor CAPI
- OTP / scanner / report / funnel changes

**Target:** Forensic V2 staging `zgsofkgddpcntdvpckdq` (see [SUPABASE_TARGETING.md](./SUPABASE_TARGETING.md))

**Forbidden:** Production `wkrcyxcnzhwjtdpmfpaf` — do not set secrets, deploy functions, or send events there.

---

## 1. Purpose

Sprint **3C-5** proved the canonical enqueue → worker → `tiktok-capi-event` chain with **`dry_run: true`** (no outbound TikTok HTTP).

Sprint **3C-6** proves **live staging delivery** to TikTok's test-event lane by calling **`tiktok-capi-event` directly** with:

- Real staging TikTok access token and pixel / event source ID (Dashboard secrets, human-only)
- TikTok Events Manager **test event code**
- `dry_run: false` at the **sender** level only

This validates TikTok credential wiring and payload shape **without** enabling worker E2E live dispatch. Worker live TikTok remains deferred to **3C-7** (separate sprint approval).

---

## 2. Current Baseline

| Item | Value |
|------|-------|
| **3C-5 dry-run smoke** | **PASS** |
| **Proof dispatch row** | `dispatch_id = dd40f800-4bf4-4147-a173-c9f9c13e4a1b` |
| **Platform** | `platform_name = tiktok` |
| **Status** | `dispatch_status = sent`, `attempt_count = 1`, `error_message = null` |
| **Dry-run flag** | `provider_response_body.dry_run = true` |
| **Confirmed chain (3C-5)** | `capture-truth-gate-lead` → `wm_event_log` (`lead_captured`) → `wm_platform_dispatch_log` (tiktok) → `dispatch-platform-events` → `tiktok-capi-event` → provider body `dry_run: true` |
| **Worker write-back fix** | Commit `2eefcaff` — `fix(tracking): update dispatch rows without partial upsert` |
| **Worker constraint** | `TIKTOK_DISPATCH_DRY_RUN_ONLY = true` (worker always passes `dry_run: true` for TikTok) |
| **Staging project** | `zgsofkgddpcntdvpckdq` |
| **Production (forbidden)** | `wkrcyxcnzhwjtdpmfpaf` |

Prior runbook: [TIKTOK_3C5_STAGING_DRY_RUN_RUNBOOK.md](./TIKTOK_3C5_STAGING_DRY_RUN_RUNBOOK.md)

---

## 3. Hard Boundaries

Operators **must not** during 3C-6:

| Boundary | Rule |
|----------|------|
| Production TikTok | No production pixel, token, or Events Manager workspace |
| Production Supabase | No secrets, deploys, or HTTP to `wkrcyxcnzhwjtdpmfpaf` |
| Worker invocation | **Do not** call `dispatch-platform-events` |
| Meta / Google bulk | Do not drain or process Meta / Google dispatch backlog |
| Nextdoor | No Nextdoor CAPI work |
| Product surfaces | No OTP, scanner, report, or funnel code changes |
| Schema / types | No migrations, `db push`, or `gen types` |
| Deploy | No Edge Function deploy unless separately approved outside this sprint |

**3C-6 authorization:** Direct **`tiktok-capi-event`** sender smoke with **`test_event_code`** only.

---

## 4. Required Staging Config

All secret changes are **human-only** via Supabase Dashboard → **Project `zgsofkgddpcntdvpckdq`** → Edge Functions → Secrets.

### 4.1 `tiktok-capi-event` secrets (live sender)

| Secret | Value | Notes |
|--------|-------|-------|
| `TIKTOK_ACCESS_TOKEN` | `<STAGING_TIKTOK_ACCESS_TOKEN>` | Real **staging** TikTok Events API token — never commit or paste into docs |
| `TIKTOK_PIXEL_ID` **or** `TIKTOK_EVENT_SOURCE_ID` | `<STAGING_TIKTOK_PIXEL_OR_EVENT_SOURCE_ID>` | Real staging pixel / event source ID |
| `TIKTOK_TEST_EVENT_CODE` | `<STAGING_TIKTOK_TEST_EVENT_CODE>` | From TikTok Events Manager → Test events (recommended env fallback) |

Optional: `CAPI_DISPATCH_SECRET` — if set, sender accepts `x-capi-dispatch-secret` header (see smoke template). **Do not** document or paste the value.

### 4.2 Capture-path gates (unchanged behavior)

These remain **enqueue gates only** on `capture-truth-gate-lead`. They do **not** authorize live worker TikTok dispatch:

| Secret | Role |
|--------|------|
| `TIKTOK_CAPI_ENABLED` | When `true`, truth-gate path may enqueue TikTok rows in `wm_platform_dispatch_log` |
| `CANONICAL_LEAD_CAPTURED_ENABLED` | When `true`, truth-gate path writes `lead_captured` to `wm_event_log` |

Leave both as established during 3C-5 unless rollback requires unsetting `TIKTOK_CAPI_ENABLED`.

### 4.3 Secrets operators must not paste

| Secret | Why |
|--------|-----|
| `DISPATCH_WORKER_SECRET` | Rotated; used only for `dispatch-platform-events` — **not used in 3C-6** |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for sender auth in smoke template — obtain from Dashboard, never commit |
| Production TikTok token / pixel | Forbidden |

**Verify project ref** before any Dashboard edit: URL must contain **`zgsofkgddpcntdvpckdq`**, never **`wkrcyxcnzhwjtdpmfpaf`**.

---

## 5. Meta / Google Queue Guardrail

The dispatch worker claims rows via `wm_claim_dispatch_rows`, which selects up to **25 rows FIFO across all platforms** (not TikTok-isolated).

**Current staging backlog (as of 3C-6 planning — re-check before any future worker work):**

| Platform | Status | Approx. count |
|----------|--------|---------------|
| `meta` | `pending` | 190 |
| `google_ads` | `pending` | 680 |
| `google_ads` | `processing` | 10 |

**During 3C-6:**

1. **Do not invoke** `dispatch-platform-events`.
2. Use **direct `tiktok-capi-event` sender smoke** only.
3. Before and after smoke, optionally run read-only backlog snapshot:

```sql
SELECT platform_name, dispatch_status, count(*) AS row_count
FROM public.wm_platform_dispatch_log
GROUP BY platform_name, dispatch_status
ORDER BY platform_name, dispatch_status;
```

**Safety stop:** If Meta or Google `pending` counts **drop** during 3C-6, someone invoked the worker — stop and investigate.

---

## 6. Sender Smoke Template

Direct POST to staging `tiktok-capi-event`. **Human executes only** after Dashboard secrets are set on **`zgsofkgddpcntdvpckdq`**.

**Requirements:**

- `dry_run: false` (live sender call)
- **`test_event_code` required** (body and/or `TIKTOK_TEST_EVENT_CODE` env)
- No raw PII — use fake QA SHA-256-like hex strings only
- Payload shaped like 3C-5 proof (`lead_captured` → TikTok `SubmitForm`)

Replace placeholders; do not commit real tokens, pixel IDs, or service role keys.

### 6.1 PowerShell template

```powershell
# Preflight: confirm staging project only
$StagingProjectRef = "zgsofkgddpcntdvpckdq"
if ($StagingProjectRef -eq "wkrcyxcnzhwjtdpmfpaf") { throw "SAFETY STOP: production ref forbidden" }

$Timestamp = [int][double]::Parse((Get-Date -UFormat %s))
$EventId = "wmc_lead_captured_qa_3c6_$Timestamp"

$Body = @{
  client_slug = "direct"
  verified_client_slug = "direct"
  event_id = $EventId
  dry_run = $false
  test_event_code = "<STAGING_TIKTOK_TEST_EVENT_CODE>"
  payload = @{
    event_source = "web"
    event_source_id = "<STAGING_TIKTOK_PIXEL_OR_EVENT_SOURCE_ID>"
    test_event_code = "<STAGING_TIKTOK_TEST_EVENT_CODE>"
    data = @(
      @{
        event = "SubmitForm"
        event_time = $Timestamp
        event_id = $EventId
        user = @{
          email = "qa3c6email00000000000000000000000000000000000000000000000000000001"
          phone = "qa3c6phone00000000000000000000000000000000000000000000000000000002"
          external_id = "qa-lead-3c6-00000001"
          ttclid = "qa-ttclid-3c6"
        }
        properties = @{
          content_type = "product"
          event_name_internal = "lead_captured"
          tiktok_event_name = "SubmitForm"
        }
        page = @{
          url = "https://windowman.app"
        }
      }
    )
  }
} | ConvertTo-Json -Depth 10

$Uri = "https://$StagingProjectRef.supabase.co/functions/v1/tiktok-capi-event"

Invoke-RestMethod -Method Post -Uri $Uri `
  -Headers @{
    "Content-Type" = "application/json"
    Authorization = "Bearer <STAGING_SUPABASE_SERVICE_ROLE_KEY>"
  } `
  -Body $Body
```

**Alternative auth:** If `CAPI_DISPATCH_SECRET` is configured on `tiktok-capi-event`, replace `Authorization` with:

```powershell
"x-capi-dispatch-secret" = "<CAPI_DISPATCH_SECRET>"
```

Do **not** use `DISPATCH_WORKER_SECRET` or invoke `dispatch-platform-events`.

### 6.2 curl-style template

```bash
TIMESTAMP=$(date +%s)
EVENT_ID="wmc_lead_captured_qa_3c6_${TIMESTAMP}"

curl -sS -X POST \
  "https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/tiktok-capi-event" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <STAGING_SUPABASE_SERVICE_ROLE_KEY>" \
  -d "{
    \"client_slug\": \"direct\",
    \"verified_client_slug\": \"direct\",
    \"event_id\": \"${EVENT_ID}\",
    \"dry_run\": false,
    \"test_event_code\": \"<STAGING_TIKTOK_TEST_EVENT_CODE>\",
    \"payload\": {
      \"event_source\": \"web\",
      \"event_source_id\": \"<STAGING_TIKTOK_PIXEL_OR_EVENT_SOURCE_ID>\",
      \"test_event_code\": \"<STAGING_TIKTOK_TEST_EVENT_CODE>\",
      \"data\": [{
        \"event\": \"SubmitForm\",
        \"event_time\": ${TIMESTAMP},
        \"event_id\": \"${EVENT_ID}\",
        \"user\": {
          \"email\": \"qa3c6email00000000000000000000000000000000000000000000000000000001\",
          \"phone\": \"qa3c6phone00000000000000000000000000000000000000000000000000000002\",
          \"external_id\": \"qa-lead-3c6-00000001\",
          \"ttclid\": \"qa-ttclid-3c6\"
        },
        \"properties\": {
          \"content_type\": \"product\",
          \"event_name_internal\": \"lead_captured\",
          \"tiktok_event_name\": \"SubmitForm\"
        },
        \"page\": { \"url\": \"https://windowman.app\" }
      }]
    }
  }"
```

### 6.3 Expected API response (pass shape)

- HTTP **200**
- JSON `success: true`
- **`dry_run` absent or `false`** (live path)
- `masked_event_source_id` present (masked tail only)
- Provider fields may include TikTok `request_id` — must **not** echo raw token, email, or phone

### 6.4 Function log check (read-only)

In Supabase Dashboard → Edge Functions → `tiktok-capi-event` → Logs:

- Expect `[TIKTOK:CAPI]` safe audit line with masked `event_id` and `provider_status`
- Must **not** log raw `TIKTOK_ACCESS_TOKEN`, full pixel ID, or user PII
- Outbound call to `business-api.tiktok.com` is **expected** for this smoke **only because** `test_event_code` is set

---

## 7. Events Manager Validation

After sender smoke, confirm in **TikTok Events Manager** (staging pixel / event source):

- [ ] Open **Test events** tab for the staging pixel
- [ ] **SubmitForm** event received within expected latency (typically seconds to ~2 min)
- [ ] **Event ID** matches smoke `event_id` (e.g. `wmc_lead_captured_qa_3c6_<timestamp>`)
- [ ] **Test event code** matches `<STAGING_TIKTOK_TEST_EVENT_CODE>`
- [ ] User parameters show **hashed** email / phone (64-char hex), not plaintext
- [ ] No raw PII, quote content, or WindowMan internal fields (`full_json`, OCR, etc.) visible
- [ ] Screenshot evidence saved for sprint record (Events Manager + API response JSON)

---

## 8. Kill Switch / Rollback

| Action | Effect |
|--------|--------|
| Unset `TIKTOK_CAPI_ENABLED` on `capture-truth-gate-lead` | Stops **new** TikTok enqueue from truth-gate path |
| Remove or revert `TIKTOK_ACCESS_TOKEN` on `tiktok-capi-event` | Blocks live TikTok HTTP even if sender is called |
| Remove `TIKTOK_TEST_EVENT_CODE` | Prevents accidental unattributed live events — pair with token removal |
| **Do not invoke** `dispatch-platform-events` | Avoids Meta / Google backlog drain |
| Keep `TIKTOK_DISPATCH_DRY_RUN_ONLY = true` in worker code | Worker TikTok remains dry-run until 3C-7 |
| Revert any future 3C-7 live-enable commit | If live worker was enabled prematurely |

If live call occurred **without** `test_event_code`: **safety stop** — treat as incident; rotate staging token and review TikTok Events Manager for non-test traffic.

---

## 9. Pass / Fail / Safety Stop Criteria

### Pass

- TikTok Events Manager shows **SubmitForm** test event
- TikTok API response indicates success (`success: true`, no fatal provider error)
- **`test_event_code`** used (body and/or env)
- **`event_id`** deterministic and matches Events Manager
- Email / phone are **hashed** hex in payload and EM UI
- Meta / Google pending counts **unchanged** during 3C-6
- No production project or production TikTok asset touched
- No `dispatch-platform-events` invocation

### Fail

- HTTP 401 / 400 / degraded 202 from sender (misconfigured auth, token, or pixel)
- TikTok provider 4xx / classified failure in response body
- Events Manager shows no event after reasonable wait
- `event_id` mismatch
- Response or logs contain raw PII

### Safety stop (halt immediately)

| Condition | Action |
|-----------|--------|
| Production ref `wkrcyxcnzhwjtdpmfpaf` detected | Stop; verify Dashboard URL and project ref |
| `dry_run: false` **without** `test_event_code` | Stop; do not retry until test code is set |
| Call to `business-api.tiktok.com` without test code | Stop; rotate staging token |
| Raw PII, token, or secret in logs / provider response | Stop; redact logs; rotate credentials |
| Meta / Google `pending` counts drop during 3C-6 | Stop; worker was invoked |
| `dispatch-platform-events` invoked | Stop; assess queue impact |
| OTP / scanner / report code or schema changed | Stop; out-of-scope mutation |

Report safety stops using:

```text
SAFETY STOP
Phase: TikTok 3C-6
Reason: <one line>
Evidence: <log snippet, SQL snapshot, or screenshot ref>
Recommended next action: <rollback step>
```

---

## 10. 3C-7 Design Note (Future Worker E2E Live — Not Implemented)

**3C-7 requires separate sprint approval** (`SPRINT APPROVAL: TikTok 3C-7 — worker E2E live dispatch`).

Design constraints for a future worker live path:

1. **`TIKTOK_TEST_EVENT_CODE` mandatory** for staging live worker runs until production cutover is explicitly approved without test code.
2. **Platform-isolated claim or row-scoped dispatch** — avoid FIFO `wm_claim_dispatch_rows` draining Meta / Google when validating TikTok (e.g. claim filter by `platform_name`, dedicated worker entrypoint, or single-row dispatch by `dispatch_id`).
3. **Preserve dry-run default** — `TIKTOK_DISPATCH_DRY_RUN_ONLY = true` remains until a gated flag + approval flips live worker dispatch.
4. **Tests + protected grep** — extend `dispatchWorker.test.ts` / `tiktokCapiRouting.test.ts`; grep CI must block live TikTok without test code in staging configs.
5. **No production enable** in the same sprint as first worker live proof.

3C-6 success is a **prerequisite** for 3C-7 but does **not** authorize 3C-7 automatically.

---

## Related docs

- [TIKTOK_3C5_STAGING_DRY_RUN_RUNBOOK.md](./TIKTOK_3C5_STAGING_DRY_RUN_RUNBOOK.md)
- [TIKTOK_EVENT_LADDER.md](../tracking/TIKTOK_EVENT_LADDER.md)
- [DISPATCH_WORKER_RUNBOOK.md](../tracking/DISPATCH_WORKER_RUNBOOK.md)
- [SUPABASE_TARGETING.md](./SUPABASE_TARGETING.md)
