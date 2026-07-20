# Google Ads Sprint 4E — Forced Dry-Run Worker Bridge Runbook

Human-operated only. **Sprint 4E — worker bridge patch only. No worker invocation, no queue drain.**

**Objective:** `dispatch-platform-events` `sendToGoogle` posts the internal dry-run envelope expected by `google-ads-conversion-event`:

```json
{
  "dry_run": true,
  "payload": { "...": "exact mapToGoogle output" }
}
```

**Target staging:** `zgsofkgddpcntdvpckdq` | **Forbidden production:** `wkrcyxcnzhwjtdpmfpaf`

> **Operational role note:** **Target staging** = LIVE_ACTIVE. **Forbidden production** = LEGACY_PARENT. See [SUPABASE_ENVIRONMENT_REGISTRY.md](./SUPABASE_ENVIRONMENT_REGISTRY.md).

**Related:**

- [GOOGLE_ADS_4C_DRY_RUN_SCAFFOLD_RUNBOOK.md](./GOOGLE_ADS_4C_DRY_RUN_SCAFFOLD_RUNBOOK.md)
- [GOOGLE_ADS_4B_INTERNAL_SENDER_DESIGN.md](./GOOGLE_ADS_4B_INTERNAL_SENDER_DESIGN.md)

---

## 1. What 4E Changed (Code)

| Area | Change |
|------|--------|
| `dispatch-platform-events` | `sendToGoogle` wraps `mapToGoogle` output via `buildGoogleDryRunDispatchEnvelope` |
| Auth | `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` (internal sender pattern) |
| `dispatchWorker` | `GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY = true`; Google success write-back includes `dry_run: true` |
| Response | `ok = response.ok && body.success === true` (aligned with Meta/TikTok) |

**Not changed in 4E:**

- `mapToGoogle` mapper
- `google-ads-conversion-event` sender
- `GOOGLE_ADS_DISPATCH_URL` default (unset URL still blocks accidental sends)
- Queue claim RPC / FIFO behavior

---

## 2. Hard Boundaries

| Boundary | Rule |
|----------|------|
| Worker | **Do not** invoke `dispatch-platform-events` until **4F** scoped claim exists |
| Queue | Do not drain or mutate `wm_platform_dispatch_log` |
| Live Google | **Do not** send `dry_run: false` |
| Deploy | Human-operated deploy only when separately approved |
| URL secret | Human sets `GOOGLE_ADS_DISPATCH_URL` on staging only after 4F approval |

---

## 3. Staging URL (Human Sets Later — Not in 4E)

After deploy + **4F** scoped-claim approval, human may set on **`zgsofkgddpcntdvpckdq` only**:

```txt
GOOGLE_ADS_DISPATCH_URL=https://zgsofkgddpcntdvpckdq.supabase.co/functions/v1/google-ads-conversion-event
```

**Do not set** until one-row worker smoke (4G) is approved. Unset URL remains the safety gate.

---

## 4. Verification (Developers — Local)

```powershell
npx vitest run src/lib/tracking/canonical/__tests__/dispatchWorker.test.ts
```

Grep guard (no live path):

```powershell
rg -n "dry_run:\s*false|googleads\.googleapis\.com|uploadClickConversions" supabase/functions/dispatch-platform-events supabase/functions/_shared/tracking/canonical/dispatchWorker.ts
```

---

## 5. Next Sprint

| Sprint | Scope |
|--------|--------|
| **4F** | Platform-scoped or dispatch-id-scoped claim RPC |
| **4G** | One-row Google worker dry-run smoke (scoped claim only) |
| **4H** | Attribution persistence audit |
| **4I** | CRM sold/value loop |

---

## 6. Safety Stop

Stop if:

- Worker invoked without 4F isolation
- Queue counts change during bridge-only work
- `dry_run: false` appears in Google worker path
- Production project or live Google API touched

---

*Last updated: 2026-06-24 — Sprint 4E bridge patch only.*
