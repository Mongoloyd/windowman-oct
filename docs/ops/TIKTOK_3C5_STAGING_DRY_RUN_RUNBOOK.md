# TikTok Sprint 3C-5 — Staging Dry-Run Smoke Runbook

Human-operated only. **No live TikTok dispatch** in this sprint — worker code forces `dry_run: true`.

**Target:** Forensic V2 staging `zgsofkgddpcntdvpckdq` (see [SUPABASE_TARGETING.md](./SUPABASE_TARGETING.md))

**Code baseline:** `forensic_report_v2` @ `57058cd9` or later with TikTok enqueue + worker dry-run commits.

> **Operational role note:** Runbook **staging** = LIVE_ACTIVE (`zgsofkgddpcntdvpckdq`). See [SUPABASE_ENVIRONMENT_REGISTRY.md](./SUPABASE_ENVIRONMENT_REGISTRY.md).

---

## 1. Required deploy functions

| Function | Role |
|----------|------|
| `dispatch-platform-events` | Claims `wm_platform_dispatch_log` rows; TikTok worker branch (`TIKTOK_DISPATCH_DRY_RUN_ONLY=true`) |
| `tiktok-capi-event` | Internal sender; returns success with `dry_run: true` without calling TikTok API |
| `capture-truth-gate-lead` | Primary smoke emitter (`lead_captured` → TikTok enqueue when gates on) |

**Not in this smoke set:** `scan-quote`, `verify-otp`, `send-otp`, `report-access`, `admin-data`, `capi-event`, `nextdoor-capi-event`.

---

## 2. Staging-only env / config (Supabase Dashboard → Edge Functions → Secrets)

Set on **`capture-truth-gate-lead`**:

| Secret | Value | Notes |
|--------|-------|-------|
| `TIKTOK_CAPI_ENABLED` | `true` | Exact string required for TikTok enqueue |
| `CANONICAL_LEAD_CAPTURED_ENABLED` | `true` | Required so truth-gate path writes `lead_captured` to `wm_event_log` |

Set on **`tiktok-capi-event`** (placeholder OK — dry-run skips API `fetch` but still resolves config):

| Secret | Value | Notes |
|--------|-------|-------|
| `TIKTOK_ACCESS_TOKEN` | `staging-dry-run-placeholder` | Not a real TikTok token |
| `TIKTOK_PIXEL_ID` or `TIKTOK_EVENT_SOURCE_ID` | `staging-dry-run-pixel` | Placeholder event source id |

**Do not** set these on production (`wkrcyxcnzhwjtdpmfpaf`). **Do not** remove `TIKTOK_DISPATCH_DRY_RUN_ONLY` in worker code.

---

## 3. Human deploy steps

### Preflight

```powershell
cd c:\Projects\forensic_report_v2a\wm-mvp
git status --short --branch   # clean tree, branch forensic_report_v2
powershell -ExecutionPolicy Bypass -File scripts/supabase/assert-staging.ps1
$env:SUPABASE_PROJECT_REF = "zgsofkgddpcntdvpckdq"
```

### Deploy (wrapper)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-functions-forensic-v2-live.ps1
```

When prompted, type exactly: **`DEPLOY_FORENSIC_V2_LIVE_FUNCTIONS`**

The wrapper deploys CRM emitters plus `dispatch-platform-events` and `tiktok-capi-event` to `zgsofkgddpcntdvpckdq` only. It refuses production and forbidden refs.

---

## 4. Smoke proof

1. **Trigger event:** Submit a truth-gate lead capture on staging (with env gates on).
2. **Verify enqueue (read-only SQL):**

```sql
SELECT e.id, e.event_id, e.event_name, d.platform_name, d.dispatch_status
FROM public.wm_event_log e
LEFT JOIN public.wm_platform_dispatch_log d ON d.event_log_id = e.id AND d.platform_name = 'tiktok'
WHERE e.event_timestamp >= now() - interval '1 hour'
ORDER BY e.event_timestamp DESC
LIMIT 20;
```

Expect: `event_name = lead_captured`, TikTok row `dispatch_status = pending`.

3. **Run worker** (requires `DISPATCH_WORKER_SECRET` already on staging):

```http
POST https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/dispatch-platform-events
x-dispatch-secret: <DISPATCH_WORKER_SECRET>
Content-Type: application/json
```

4. **Verify dry-run success:**

```sql
SELECT id, event_log_id, dispatch_status,
       provider_response_body->>'dry_run' AS dry_run_flag,
       provider_response_body
FROM public.wm_platform_dispatch_log
WHERE platform_name = 'tiktok'
ORDER BY last_attempt_at DESC NULLS LAST
LIMIT 10;
```

**Pass:** `dispatch_status = sent` and `provider_response_body` contains `dry_run: true`.

5. **Prove no live TikTok call:** Function logs for `tiktok-capi-event` must not show outbound HTTP to `business-api.tiktok.com`. Worker must not pass `dry_run: false`.

---

## 5. Rollback

| Situation | Action |
|-----------|--------|
| TikTok rows enqueue unexpectedly | Unset `TIKTOK_CAPI_ENABLED` on `capture-truth-gate-lead` |
| Worker errors | Stop invoking `dispatch-platform-events`; inspect logs |
| Missing `dry_run: true` in provider response | **Stop** — do not proceed to live enable |
| Live TikTok endpoint in logs | **Safety stop** — roll back `dispatch-platform-events` / `tiktok-capi-event` deploy |
| Meta regression | Redeploy prior `dispatch-platform-events` version if needed |

---

## Related docs

- [DISPATCH_WORKER_RUNBOOK.md](../tracking/DISPATCH_WORKER_RUNBOOK.md)
- [TIKTOK_EVENT_LADDER.md](../tracking/TIKTOK_EVENT_LADDER.md)
- [SUPABASE_FUNCTION_MANIFEST.md](./SUPABASE_FUNCTION_MANIFEST.md)
