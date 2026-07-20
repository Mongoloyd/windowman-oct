# Google Ads 4H — Attribution Merge Runbook

> **Operational role note:** References to **staging** mean LIVE_ACTIVE (`zgsofkgddpcntdvpckdq`). See [SUPABASE_ENVIRONMENT_REGISTRY.md](./SUPABASE_ENVIRONMENT_REGISTRY.md).

Sprint **4H** merges persisted Google click identifiers into the Google dispatch mapping path.

## Problem (pre-4H)

`gclid`, `gbraid`, and `wbraid` were captured on the frontend and persisted to `leads` / `wm_event_log.attribution` / `wm_event_log.query_params`, but `mapToGoogle` only read `payload.identity`. Staging dry-runs matched `hashed_phone` only.

## Fix (4H)

1. **`resolveGoogleClickIdentifiers`** — pure helper with merge priority:
   - `identity` → `attribution` → `query_params`
2. **`mapToGoogle(canonical, context?)`** — optional context carries attribution snapshots.
3. **`dispatchWorker` Google branch** — batch-fetches `wm_event_log.attribution` + `query_params` (same pattern as TikTok) and passes them to `mapToGoogle`.

Hashed `emailHash` / `phoneHash` fallback is unchanged. Raw email/phone are never emitted.

## Files

| File | Role |
|------|------|
| `resolveGoogleClickIdentifiers.ts` | Click-ID merge helper |
| `mapToGoogle.ts` | Mapper consumes merged click IDs |
| `dispatchWorker.ts` | Fetches attribution for `google_ads` rows |

Both `src/lib/tracking/canonical/` and `supabase/functions/_shared/tracking/canonical/` copies are updated.

## Verification (local, no deploy)

```powershell
npx vitest run src/lib/tracking/canonical/__tests__/resolveGoogleClickIdentifiers.test.ts
npx vitest run src/lib/tracking/canonical/__tests__/mappers.test.ts
npx vitest run src/lib/tracking/canonical/__tests__/dispatchWorker.test.ts
npm run build
```

## Post-deploy smoke (human-operated, staging)

**Do not run in this sprint.** After deploy:

1. Create a Google-attributed QA lead (synthetic URL with `gclid` / `gbraid` / `wbraid`).
2. Complete OTP so `phone_verified` canonical event exists with attribution on `wm_event_log`.
3. Run scoped Google dry-run worker smoke (see `GOOGLE_ADS_4F_SCOPED_WORKER_CLAIM_RUNBOOK.md`).
4. Confirm `match_identifier_types` includes click IDs, not only `hashed_phone`.

## Safety

- `GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY` unchanged — no live Google API from worker.
- No migration, RPC, or claim-shape changes required.
- Meta / TikTok / Nextdoor paths unchanged.

## Not in scope

- Enqueue gate tightening (`lead_captured` → `no_google_mapping`)
- `sold` → `wm_sale_confirmed` alias
- Live `dry_run: false`
