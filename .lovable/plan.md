

## Decisions locked in
1. Meta browser pixel: PageView only (cookie seed). All conversion events server-side via `capi-event`.
2. Multi-tenant from day 1. WindowMan = default row in `meta_configurations`. No hardcoding.
3. Each client supplies own Pixel ID + System User token, stored in `meta_configurations`.
4. Delivery = outbound webhook + email. Client portal deferred.
5. Google Ads via GTM client-side. No new tables this sprint.
6. Per-lead credit system for clients (mirrors contractor credit pattern).
7. Shared/recycled leads — need `lead_assignments` table.
8. "Minimalist Advisor" visual rebuild executes in parallel as Sprint A2.

## Switchboard verification (truth check)
**Already correct in repo.** `supabase/functions/capi-event/index.ts` (Tier 1 → `clients` slug → `meta_configurations`; Tier 2 → `is_default=true` row; Tier 3 → env). Validated by `scripts/verify-capi-fallback.ts`. **Gap:** `meta_configurations` table exists but I have not confirmed how many rows are populated — that's a data check, not code. Per the user's question: starting with the WindowMan default row only.

---

## Sprint A — Multi-tenant plumbing (this sprint)

### A1. Strip browser conversion tracking, keep PageView
**File:** `src/components/FacebookConversionProvider.tsx`
- Keep `initMetaPixel()` + `fbq('track','PageView')` on route change (drops `_fbp`).
- Keep `captureFbc()` (URL `fbclid` → `_fbc` cookie).
- Audit `src/lib/metaPixel.ts` `metaConversions.*` helpers — reroute every conversion call to fire `capi-event` only, drop the `fbq.track(...)` mirror.
- Audit `src/lib/shadowPixel.ts` — confirm no rogue `fbq('track', ...)`.
- Add `event_id` (UUID) to every CAPI call so Meta dedups if a stray pixel fires.

### A2. Stamp `client_slug` on every lead write
- `src/state/scanFunnel.tsx` already carries `initialClientSlug`. Audit:
  - `supabase/functions/qualify-homepage-lead/index.ts` — accept + persist `client_slug`.
  - `src/components/TruthGateFlow.tsx` attribution write — add `client_slug` from `useScanFunnel()`.
  - `supabase/functions/scan-quote/sessionRecovery.ts` lead create path — add `client_slug`.
- Forward `client_slug` from frontend → `capi-event` body for every conversion.

### A3. Schema additions (one migration)
```text
client_destinations
  id, client_id (FK clients), kind ('webhook'|'email'),
  url, secret_hash, email_to, payload_format ('json_v1'),
  active, created_at, updated_at
  RLS: internal-operator only

client_credits
  client_id PK (FK clients), balance int, updated_at
  RLS: internal-operator only

client_credit_ledger
  id, client_id, delta, balance_after, entry_type
  ('seed','lead_debit','admin_adjustment','refund'),
  reference_type, reference_id, notes, created_at
  RLS: internal-operator read

lead_assignments       -- enables shared/recycled "Power Grid"
  id, lead_id, client_id, assigned_at, assignment_reason,
  status ('queued','delivered','accepted','declined','expired','recycled'),
  delivery_attempted_at, delivery_succeeded_at, delivery_error,
  recycled_at, recycle_reason, contractor_id (nullable),
  outcome ('contacted','quoted','won','lost', null), outcome_value
  RLS: internal-operator full; service role full
  UNIQUE (lead_id, client_id)         -- no duplicate routing to same client

webhook_deliveries (existing) — add columns:
  client_id, assignment_id, attempt_count default 0,
  next_retry_at, last_error, hmac_signature
```

Plus DB function `assign_lead_to_client(lead_id, client_id, reason)` that:
- locks `client_credits`, debits 1, writes ledger
- inserts `lead_assignments` row (idempotent on unique)
- enqueues `webhook_deliveries` row
- writes `lead_events` audit

### A4. Outbound delivery edge function
**New:** `supabase/functions/deliver-lead-to-client/index.ts`
- Triggered by cron (every 60s) OR direct invoke from updated `fire_crm_handoff` flow.
- Reads `webhook_deliveries` where `status='pending'` and `next_retry_at <= now()`.
- For each: looks up `client_destinations`, builds `json_v1` payload (lead snapshot fields, masked phone until accepted, county, project_type, window_count, quote_amount, grade, top flags, attribution).
- Signs with HMAC-SHA256 using `WEBHOOK_HMAC_SECRET` + per-client `secret_hash`.
- POSTs; on 2xx → mark delivered + `lead_assignments.delivery_succeeded_at`. On 4xx/5xx → exponential backoff (1m, 5m, 30m, 2h, 12h), max 5 attempts → dead-letter.
- Optional email fallback via Resend (already in secrets).

### A5. CAPI event tightening
- `supabase/functions/capi-event/index.ts` — already correct. Add: when `client_slug` resolves but config missing, log structured warning + still return 202 degraded (today's behavior). Confirm `event_id` is forwarded as `event_id` (it is).
- Add `Purchase` event firing path: when `lead_assignments.outcome='won'` is recorded, fire CAPI `Purchase` with `value` + `currency` to that client's pixel — closes the loop for Meta value optimization.

### A6. New secrets needed
- `WEBHOOK_HMAC_SECRET` — signs outbound client webhooks. **Will request via add_secret when implementing.**

---

## Sprint A2 — Visual rebuild "Minimalist Advisor" (parallel track)

### Scope
- New design tokens: slate/zinc/white palette in `tailwind.config.ts` + `src/index.css`. Replace red/amber severity colors with neutral slate + single restrained accent (deep indigo or graphite).
- Typography: Inter for UI, system serif (Charter / "Source Serif 4") for headings. Remove Barlow Condensed everywhere.
- Components to retire/reskin (high-alert offenders):
  - `OrangeScanner.tsx`, `XRayScannerBackground.tsx`, `ScanTheatrics.tsx` (red terminal aesthetic)
  - `TopViolationSummaryStrip.tsx`, `CriticalFlagCard.tsx` (red/amber → neutral severity tags)
  - `ForensicShiftDemoSection.tsx`, `Forensicshift.jsx` (loud forensic styling)
  - `HomepageBackdrop.tsx` (saturated backdrop → off-white paper texture)
- Keep functional structure intact; restyle only. No routing changes.
- Severity language stays ("Critical / Concern / Note") but uses neutral chips with thin border, no fills.

### Memory updates required after rebuild
- Overwrite `mem://style/critical-finding-colors`
- Overwrite `mem://style/mode-b-fragmentation-audit`
- Add `mem://style/minimalist-advisor-system`
- Update Core in `mem://index.md` to reflect new aesthetic as law

---

## What I am NOT doing this sprint
- Client onboarding admin UI (Sprint B)
- Client login portal (Sprint B)
- Google Ads per-client config table (deferred — GTM client-side only)
- Meta Custom Audience nightly export (Sprint D)
- Stripe billing for client credits (Sprint C — manual top-up via admin RPC for now)

---

## Open data check (you, not me)
Confirm in Supabase dashboard whether `meta_configurations` has a row with `is_default=true` and a real WindowMan pixel + token. If empty, the switchboard falls through to env vars (`META_PIXEL_ID`, `META_CAPI_TOKEN`) which I do not see in your secrets list — meaning conversions currently degrade gracefully (202) but do not actually fire. **First action after plan approval: seed the WindowMan default row.**

