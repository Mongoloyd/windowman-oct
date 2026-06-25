# Google Ads 4H — Staging Dry-Run Closeout

**Status:** Complete (staging dry-run proof passed)  
**Target staging:** `zgsofkgddpcntdvpckdq`  
**Forbidden production:** `wkrcyxcnzhwjtdpmfpaf` — not touched in this sprint  
**Closeout date:** 2026-06-25

---

## What was proven

Google Ads click-ID attribution flows end-to-end on **staging** under **forced dry-run** only:

```text
synthetic QA lead (gclid / gbraid / wbraid)
→ wm_event_log.attribution + query_params populated
→ wm_platform_dispatch_log google_ads pending row
→ scoped dispatch-platform-events claim (single dispatch_id)
→ google-ads-conversion-event dry_run bridge
→ dispatch_status = sent, provider dry_run: true
→ match_identifier_types includes gclid, gbraid, wbraid (not hashed_phone only)
```

Sprint **4H** fixed the attribution merge gap: `mapToGoogle` now reads click IDs from `identity` → `attribution` → `query_params` via `resolveGoogleClickIdentifiers`. The staging QA helper (`qa-google-attribution-event`) created the synthetic candidate without OTP, upload, scanner, or report reveal.

**Not proven in this sprint:**

- Live Google Ads API (`dry_run: false`)
- Production deployment or secrets
- Generic FIFO queue drain
- Meta / TikTok / Nextdoor dispatch changes

---

## Final dispatch_id proof

| Field | Value |
|-------|-------|
| `dispatch_id` | `09bc059f-0760-4194-900a-c82564d03be1` |
| `platform_name` | `google_ads` |
| `dispatch_status` | `sent` |
| `attempt_count` | `1` |
| `dry_run_flag` | `true` |
| `error_message` | `null` |
| `match_identifier_types` | `gclid`, `gbraid`, `wbraid`, `hashed_email`, `hashed_phone` |

**Provider response (summary):**

- `dry_run: true`
- `success: true`
- `masked_transaction_id` present
- `masked_conversion_action` present
- Request payload contained fake QA click IDs only (no live customer PII)

Read-only verification SQL:

```sql
SELECT
  id AS dispatch_id,
  platform_name,
  dispatch_status,
  attempt_count,
  error_message,
  provider_response_body
FROM public.wm_platform_dispatch_log
WHERE id = '09bc059f-0760-4194-900a-c82564d03be1';
```

---

## Queue safety summary

| Check | Result |
|-------|--------|
| Scoped worker only (known `dispatch_id`) | Yes — not generic FIFO drain |
| Meta queue mutated | No |
| TikTok queue mutated | No |
| Nextdoor queue mutated | No |
| Unrelated `google_ads` rows processed | No — single scoped claim |
| Live `googleads.googleapis.com` called | No |
| `dry_run: false` sent | No |
| Production project touched | No |

---

## Files added/changed (4H sprint)

### Code

| File | Role |
|------|------|
| `src/lib/tracking/canonical/resolveGoogleClickIdentifiers.ts` | Click-ID merge helper (identity → attribution → query_params) |
| `supabase/functions/_shared/tracking/canonical/resolveGoogleClickIdentifiers.ts` | Edge copy of merge helper |
| `src/lib/tracking/canonical/mapToGoogle.ts` | Mapper consumes merged click IDs |
| `supabase/functions/_shared/tracking/canonical/mapToGoogle.ts` | Edge copy |
| `src/lib/tracking/canonical/dispatchWorker.ts` | Batch-fetches attribution for `google_ads` rows |
| `supabase/functions/_shared/tracking/canonical/dispatchWorker.ts` | Edge copy |
| `supabase/functions/qa-google-attribution-event/index.ts` | Staging-only QA helper |
| `supabase/functions/_shared/qaHelperGuard.ts` | Fail-closed staging guard |
| `supabase/functions/_shared/qaHelperGuard.test.ts` | Guard unit tests |
| `src/lib/tracking/canonical/__tests__/resolveGoogleClickIdentifiers.test.ts` | Merge helper tests |

### Ops docs

| File | Role |
|------|------|
| [GOOGLE_ADS_4H_ATTRIBUTION_MERGE_RUNBOOK.md](./GOOGLE_ADS_4H_ATTRIBUTION_MERGE_RUNBOOK.md) | Attribution merge sprint notes |
| [GOOGLE_ADS_4H_G_QA_HELPER_RUNBOOK.md](./GOOGLE_ADS_4H_G_QA_HELPER_RUNBOOK.md) | QA helper deploy/smoke/cleanup |
| [GOOGLE_ADS_4F_SCOPED_WORKER_CLAIM_RUNBOOK.md](./GOOGLE_ADS_4F_SCOPED_WORKER_CLAIM_RUNBOOK.md) | Scoped worker smoke shape |
| [GOOGLE_ADS_4E_FORCED_DRY_RUN_BRIDGE_RUNBOOK.md](./GOOGLE_ADS_4E_FORCED_DRY_RUN_BRIDGE_RUNBOOK.md) | Dry-run envelope bridge |

### Related prior sprints (unchanged in 4H closeout)

- **4E** — forced dry-run worker bridge
- **4F** — scoped dispatch claim RPC + worker body shape
- **4B/4C** — internal sender design + dry-run scaffold

---

## What remains disabled

| Control | State |
|---------|-------|
| `QA_HELPER_ENABLED` on staging | **`false`** (set at closeout — helper returns 404) |
| `GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY` | **`true`** — worker cannot send live conversions |
| Live Google Ads API | **Blocked** — no approved `dry_run: false` path |
| Production Google secrets / deploy | **Not set** |
| Generic FIFO worker drain on staging backlog | **Not authorized** without explicit scope |

Optional follow-up (human-operated, not required for 4H sign-off):

- Undeploy `qa-google-attribution-event` from staging
- Delete synthetic QA rows (`source = qa_google_4h_clickid_proof`, `event_id LIKE 'wmc_qa_4hg_%'`) — see [GOOGLE_ADS_4H_G_QA_HELPER_RUNBOOK.md](./GOOGLE_ADS_4H_G_QA_HELPER_RUNBOOK.md) cleanup section

---

## What remains future work

| Item | Notes |
|------|-------|
| **Nextdoor CAPI / dispatch** | Next platform after Google 4H closeout |
| Live Google `dry_run: false` | Separate sprint; production OAuth, conversion action IDs, operator approval |
| Enqueue gate tightening | `lead_captured` → `no_google_mapping` (deferred in 4H) |
| `sold` → `wm_sale_confirmed` alias | Deferred |
| Production Google deploy | Via human-operated `scripts/deploy-functions-forensic-v2-live.ps1` only when approved |
| Synthetic QA row cleanup | Optional housekeeping on staging |

---

## What not to touch

- **Do not** invoke `dispatch-platform-events` without scoped `dispatch_id` on staging backlog
- **Do not** set `dry_run: false` or call live Google Ads API without a dedicated live sprint
- **Do not** set `QA_HELPER_ENABLED=true` on production
- **Do not** modify Meta, TikTok, or Nextdoor senders as part of Google closeout
- **Do not** run migrations, `db push`, OTP, scanner, upload, or report-reveal paths for measurement proof
- **Do not** use `scripts/deploy-functions-forensic-v2-live.ps1` for the QA helper

Protected surfaces: see [.cursor/PROTECTED_FILES.md](../../.cursor/PROTECTED_FILES.md) and [CAPI_OPERATOR_HANDOFF_PACKET.md](../measurement/CAPI_OPERATOR_HANDOFF_PACKET.md).

---

## Next platform: Nextdoor

Google Ads staging dry-run is **complete**. The next measurement sprint should focus on **Nextdoor CAPI / dispatch** integration using the same canonical event → `wm_platform_dispatch_log` → scoped worker patterns established for Meta, TikTok, and Google.

Reference starting points:

- [GOOGLE_ADS_4B_INTERNAL_SENDER_DESIGN.md](./GOOGLE_ADS_4B_INTERNAL_SENDER_DESIGN.md) — multi-platform dispatch architecture
- [EVENT_OWNERSHIP_MODEL.md](../tracking/EVENT_OWNERSHIP_MODEL.md) — business vs telemetry lanes
- [CANONICAL_MEASUREMENT_ARCHITECTURE.md](../measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md) — browser vs server policy

---

*Closeout recorded after scoped Google dry-run worker proof. QA helper disabled on staging (`QA_HELPER_ENABLED=false`). No worker invoked during this closeout pass.*
