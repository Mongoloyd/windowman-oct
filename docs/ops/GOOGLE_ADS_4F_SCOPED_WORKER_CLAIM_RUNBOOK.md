# Google Ads 4F — Scoped Worker Claim Runbook

Code-only sprint: wires `dispatch-platform-events` and the canonical dispatch worker to call `public.wm_claim_dispatch_rows_scoped` when an operator supplies an explicit scope. **Does not deploy, invoke the worker, or mutate the queue by itself.**

**Target staging:** `zgsofkgddpcntdvpckdq` | **Forbidden production:** `wkrcyxcnzhwjtdpmfpaf`

---

## Precondition (human-verified)

`public.wm_claim_dispatch_rows_scoped` was manually installed on staging via Supabase Dashboard SQL Editor (source migration: `supabase/migrations/20260624130000_create_wm_claim_dispatch_rows_scoped.sql`).

Do **not** run generic FIFO worker smoke against staging while hundreds of `google_ads` and `meta` rows are pending.

---

## Request body (scoped smoke — future)

When a later sprint authorizes a single-row Google dry-run smoke, use **both** `target_platform` and `dispatch_id`:

```json
{
  "target_platform": "google_ads",
  "dispatch_id": "<known_google_dispatch_id>",
  "limit": 1
}
```

### Safety rule

Do **not** use platform-only scope (`target_platform` without `dispatch_id`) as the default smoke pattern. Platform-only scope may claim the **oldest** pending Google row from a large backlog and process an unintended event.

Always pair `dispatch_id` with a row you have identified in read-only SQL first.

---

## Behavior summary

| Body fields | Claim RPC | Notes |
|-------------|-----------|-------|
| *(empty)* | `wm_claim_dispatch_rows` | Legacy cron/FIFO behavior unchanged |
| `target_platform: google_ads` | `wm_claim_dispatch_rows_scoped` | Platform filter only — backlog risk |
| `dispatch_id: <uuid>` | `wm_claim_dispatch_rows_scoped` | Forces effective `limit` to **1** |
| Both | `wm_claim_dispatch_rows_scoped` | Preferred smoke shape |

Validation (HTTP 400, no worker run):

- `target_platform` — when provided, must be `"google_ads"` (this sprint)
- `dispatch_id` — when provided, must be a valid UUID
- `limit` — integer 1–25; ignored for effective limit when `dispatch_id` is set (always 1)

---

## Google dry-run guard (unchanged)

Google Ads worker lane remains dry-run only (`GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY = true`). Outbound envelope is `{ dry_run: true, payload: ... }`. No live Google API calls from this sprint.

---

## Explicitly not in this sprint

- `supabase functions deploy`
- `supabase secrets set`
- `GOOGLE_ADS_DISPATCH_URL` wiring
- Worker invocation / queue drain
- `dry_run: false`
- Migrations or production changes

---

## Next recommended action (after deploy sprint)

1. Deploy updated `dispatch-platform-events` to staging only.
2. Identify one known `google_ads` `wm_platform_dispatch_log.id` via read-only SQL.
3. Invoke with scoped body above and `x-dispatch-secret`.
4. Confirm single row processed with `dry_run: true` in provider response.
