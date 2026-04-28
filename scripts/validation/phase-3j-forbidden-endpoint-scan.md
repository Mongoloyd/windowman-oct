# Phase 3J — Forbidden Endpoint Scan

Scope scanned:

- `src/services/revenueSignalDryRunAudit.ts`
- `src/services/revenueSignalIntegration.ts`
- `src/services/revenueDispatchReadiness.ts`
- `src/services/tenantIsolationAudit.ts`
- `supabase/functions/admin-sync-revenue-signals/index.ts`
- `supabase/functions/partner-update-disposition/index.ts`
- `src/services/dispatchGovernance.ts`
- `src/services/dispatchOutbox.ts`
- `src/services/signalDispatch.ts`
- `src/services/clientPlatformConfigs.ts`
- `src/components/admin`

Search terms:

```bash
rg -n "graph\.facebook\.com|business-api\.tiktok\.com|googleads\.googleapis\.com|google-analytics\.com/mp/collect|collect\?v=2|gtm|webhook|fetch\(" ...
```

Result:

- No direct calls to `graph.facebook.com`, TikTok Business API, Google Ads API, GA4 Measurement Protocol, raw GTM Server endpoints, or raw CRM webhook endpoints were found in the 3J validation / dry-run / tenant-audit / outcome-update paths.
- Reviewed `fetch(` hits are internal Supabase Edge Function calls:
  - `src/services/revenueSignalIntegration.ts` calls `admin-sync-revenue-signals` with `dry_run: true`.
  - `src/services/clientPlatformConfigs.ts` calls `admin-client-platform-config`.
  - `src/services/dispatchOutbox.ts` calls `admin-materialize-dispatch-outbox` for controlled outbox materialization.
- Admin UI references to GTM/webhook are labels, filters, or simulation copy only.
- `partner-update-disposition` comments explicitly state that it does not call Meta / Google / TikTok / GTM and returns `external_dispatch: false`.

Verdict: pass for Phase 3J no-live-dispatch scope. No provider endpoint call was added.
