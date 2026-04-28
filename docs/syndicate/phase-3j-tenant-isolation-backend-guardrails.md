# Phase 3J — Tenant Isolation + Backend Guardrails

## 1. Goal

Create a pre-Phase-4 validation layer that proves, where runtime context allows, that tenant boundaries and revenue ledger integrity are enforced by backend/RLS controls rather than frontend UI assumptions.

## 2. North Star

Before contractor-facing Phase 4 work begins, the system must not bleed homeowner-sensitive tenant data and must not accept malformed, spoofed, or contradictory contractor outcome payloads as trusted revenue truth.

## 3. What Was Validated

- Required git reconciliation commands were run against current `HEAD`.
- Phase 3I-D closeout artifacts were verified.
- Build and TypeScript checks passed before starting Phase 3J work.
- Connected DB object presence was verified with read-only Supabase catalog queries.
- RLS policy posture was inspected for protected Syndicate/control-plane tables.
- Anonymous REST/RPC probes were run with the publishable anon key.
- Edge Function unauthenticated probes were run against `partner-update-disposition` and `admin-sync-revenue-signals`.
- `partner-update-disposition` backend validation was reviewed for malformed payload and tenant-spoofing guards.
- Revenue signal duplicate/lifecycle safety was reviewed in the connected DB function definitions.
- Phase 3J-related files were scanned for forbidden provider endpoint calls.
- Non-destructive validation artifacts were created.

## 4. Tenant Isolation Test Matrix

| Actor / Attempt | Expected | Actual | Status |
| --- | --- | --- | --- |
| anon reads `syndicates` | Denied or zero rows | `401 permission denied` | Pass |
| anon reads `syndicate_clients` | Denied or zero rows | `401 permission denied` | Pass |
| anon reads `contractor_accounts` | Denied or zero rows | `401 permission denied` | Pass |
| anon reads `lead_assignments` | Denied or zero rows | `401 permission denied` | Pass |
| anon reads `lead_routing_events` | Denied or zero rows | `401 permission denied` | Pass |
| anon reads `contractor_outcomes` | Denied or zero rows | `401 permission denied` | Pass |
| anon reads `event_logs` | No readable data | `200 []` | Pass |
| anon reads `revenue_signal_dry_run_audits` | No readable data | `200 []` | Pass with grant-review note |
| anon calls `admin_revenue_signal_eligibility()` | No data | `200 []` because function body returns for non-internal actors | Pass with grant-review note |
| anon calls `admin_sync_revenue_signals(1,true)` | No mutation, no dispatch | `200 { ok: false, error: forbidden, external_dispatch: false, dispatch_created: false }` | Pass with grant-review note |
| unauthenticated calls `partner-update-disposition` | Rejected before mutation | `401 unauthenticated` | Pass |
| unauthenticated calls `admin-sync-revenue-signals` Edge Function | Rejected before RPC | `401 unauthorized` | Pass |
| contractor-like cross-client read | Denied or zero rows | No isolated contractor/client JWT fixtures available | Context Debt |
| contractor-like cross-contractor read | Denied or zero rows | No isolated contractor/client JWT fixtures available | Context Debt |

## 5. RLS / Access Findings

Connected DB catalog query confirmed RLS is enabled on:

- `syndicates`
- `syndicate_clients`
- `contractor_accounts`
- `lead_assignments`
- `lead_routing_events`
- `contractor_outcomes`
- `event_logs`
- `revenue_signal_dry_run_audits`

Policy posture:

- Syndicate tables are internal-operator scoped plus service-role maintenance.
- `contractor_accounts` permits internal operator reads and own-account authenticated reads via `auth_user_id = auth.uid()`.
- `lead_assignments` permits internal operator reads and own-contractor reads through a contractor-account ownership join.
- `contractor_outcomes` is internal-operator scoped; partner writes go through Edge Function service-role validation.
- `event_logs` has anon insert only and no anon select policy; runtime anon read returned `[]`.
- `revenue_signal_dry_run_audits` has internal-operator select and service-role all policies; runtime anon read returned `[]`.

Grant-review note: `admin_revenue_signal_eligibility` and `admin_sync_revenue_signals` are EXECUTE-granted broadly, but both fail closed in function body for non-internal/non-service actors. Before real contractor access, revoke broad grants or keep explicit fail-closed tests in CI.

## 6. Cross-Client Read Attempt

Runtime seeded cross-client reads were not performed because connected dataset has no `syndicates`, `syndicate_clients`, `contractor_accounts`, `lead_assignments`, or `lead_routing_events` rows to safely use as isolated fixtures, and this sprint forbids mutating production tenant records without explicit isolated setup and cleanup.

Static evidence:

- `lead_assignments_select_own_contractor` scopes rows by a join to `contractor_accounts.auth_user_id = auth.uid()`.
- `contractor_accounts_select_own` scopes rows to `auth_user_id = auth.uid()`.
- Internal operator policies use `is_internal_operator()`.
- No anon select policies exist on Syndicate control tables.

Status: Context Debt for seeded contractor JWT proof; no runtime bleed observed in anon probes.

## 7. Cross-Contractor Read Attempt

Runtime seeded cross-contractor reads were not performed for the same fixture limitation. Static review found own-account/own-assignment scoping on the future contractor-readable tables, and no broad contractor outcome select policy.

Status: Context Debt for 4A: create two contractor accounts with separate auth users, assignments, and client slugs in an isolated environment, then assert each actor receives only own rows.

## 8. Homeowner PII Exposure Review

Reviewed Phase 3J-related surfaces and services for raw PII or secrets. The validation artifacts and dry-run paths expose counts, masked IDs, booleans, and status/reason codes only.

No Phase 3J change exposes:

- raw homeowner phone
- raw homeowner email
- raw quote file URL
- raw click IDs
- tokens
- Vault secret IDs
- raw endpoint URLs

`revenueDispatchReadiness` exposes attribution presence booleans, not raw click identifiers.

## 9. Backend Outcome Payload Abuse Tests

Target: `supabase/functions/partner-update-disposition/index.ts`.

Runtime probe without auth returned `401 unauthenticated`, proving the function rejects unauthenticated requests before body mutation.

Static backend guards verified:

| Abuse case | Backend behavior | Status |
| --- | --- | --- |
| Missing required fields | Requires `opportunity_id` and `disposition_state` | Static Pass |
| Invalid disposition enum | `VALID_STATES` allow-list rejects invalid states | Static Pass |
| Sold with zero value | `final_value_cents` must be positive integer > 0 | Static Pass |
| Sold with negative value | Negative value rejected | Static Pass |
| Sold with missing value basis | `value_basis` required | Static Pass |
| Sold with unknown value basis | `unknown` rejected | Static Pass |
| Lost with missing reason | reason code and typed notes required | Static Pass |
| Mismatched assignment/client | server-resolved client compared to assignment client | Static Pass |
| Mismatched contractor/client | server-resolved client compared to contractor account client | Static Pass |
| Spoofed `client_slug` | caller slug compared to server-resolved context | Static Pass |
| Spoofed contractor account | account `auth_user_id` compared to JWT user | Static Pass |
| Spoofed operator/admin ID | no trusted caller-supplied operator/admin ID path | Static Pass |
| Unexpected extra fields | destructured allow-list only reaches update payload | Static Pass |
| Terminal duplicate update | transition map blocks terminal state transitions | Static Pass |

Authenticated mutation abuse tests are Context Debt because no isolated contractor fixture/token was available and this sprint forbids destructive production mutation.

## 10. Revenue Ledger Integrity Checks

Connected DB snapshot of `contractor_outcomes` returned:

- total outcomes: `1`
- outcomes missing client slug: `1`
- sold invalid value: `0`
- sold missing/unknown basis: `0`
- lost missing reason: `0`
- blocked or review outcomes: `1`

Interpretation: the existing connected data includes one non-ready/review outcome and no invalid sold-value rows. This is not a production readiness issue by itself, but it is a guardrail reminder that contractor access must not expose or trust review rows until resolved.

## 11. Duplicate Lifecycle / Duplicate Signal Checks

Connected function definition for `admin_revenue_signal_eligibility()` confirms:

- Duplicate lifecycle keys are grouped in `duplicate_lifecycle`.
- Weak lifecycle keys using `contractor_outcome_id` are flagged.
- Missing/invalid sold value emits `sold_missing_or_invalid_value`.
- Missing/unknown value basis emits `sold_missing_value_basis`.
- Duplicate active revenue signal keys set `duplicate_revenue_signal_key` and `duplicate_protected`.
- Non-internal/non-service callers return no rows.

Connected `admin_sync_revenue_signals(integer, boolean)` returned `forbidden` with both dispatch flags false for anon REST access.

## 12. Forbidden Endpoint Scan

Scan command:

```bash
rg -n "graph\.facebook\.com|business-api\.tiktok\.com|googleads\.googleapis\.com|google-analytics\.com/mp/collect|collect\?v=2|gtm|webhook|fetch\(" src/services/revenueSignalDryRunAudit.ts src/services/revenueSignalIntegration.ts src/services/revenueDispatchReadiness.ts src/services/tenantIsolationAudit.ts supabase/functions/admin-sync-revenue-signals/index.ts supabase/functions/partner-update-disposition/index.ts src/services/dispatchGovernance.ts src/services/dispatchOutbox.ts src/services/signalDispatch.ts src/services/clientPlatformConfigs.ts src/components/admin
```

Result:

- No direct Meta, TikTok, Google Ads, GA4 Measurement Protocol, GTM Server, or CRM webhook endpoint calls were found in the Phase 3J validation/dry-run/outcome-update paths.
- `fetch(` hits were internal Supabase Edge Function calls or admin UI refresh handlers.
- Provider terms in admin files are labels, simulation copy, or dry-run mapping descriptors.

Status: Pass.

## 13. Migration / Type Drift Review

Connected DB presence passed for:

- `public.syndicates`
- `public.syndicate_clients`
- `public.contractor_accounts`
- `public.lead_assignments`
- `public.lead_routing_events`
- `public.contractor_outcomes`
- `public.event_logs`
- `public.revenue_signal_dry_run_audits`
- `public.admin_route_lead_assignment(...)`
- `public.admin_revenue_signal_eligibility()`
- `public.admin_sync_revenue_signals(integer, boolean)`

Generated types include:

- `contractor_accounts`
- `lead_assignments`
- `contractor_outcomes`
- `revenue_signal_dry_run_audits`
- `admin_route_lead_assignment`
- `admin_revenue_signal_eligibility`
- `admin_sync_revenue_signals`

No type generation update was performed.

## 14. No External Dispatch Proof

- No provider endpoint calls were added.
- `admin-sync-revenue-signals` Edge Function rejects unauthenticated callers before sync.
- Direct anon RPC call to `admin_sync_revenue_signals(1,true)` returned `ok: false`, `external_dispatch: false`, `dispatch_created: false`.
- `partner-update-disposition` unauthenticated probe returned `401` before mutation.
- The outcome update function response contract includes `external_dispatch: false`.
- No outbox sent status, dispatch attempt, provider sender, scanner, OTP, report reveal, or homeowner funnel files were modified.

## 15. Pass / Fail Matrix

| Check | Result | Notes |
| --- | --- | --- |
| 3I-D closeout exists | Pass | Required doc present. |
| 3I-D no-write proof | Pass | Documented in closeout; no fake placeholder found in created 3J artifacts. |
| 3I-D endpoint proof | Pass | Documented and rescanned in 3J scope. |
| Pre-3J build/typecheck | Pass | `bun run build`, `npx tsc --noEmit`. |
| Required DB objects | Pass | Connected DB catalog query passed. |
| Required generated types | Pass | `types.ts` includes required tables/RPCs. |
| RLS enabled on target tables | Pass | Catalog query passed. |
| Anon protected table reads | Pass | Denied or zero rows. |
| Admin Edge auth guard | Pass | Missing auth rejected. |
| Partner Edge auth guard | Pass | Missing auth rejected. |
| Malformed outcome validation | Static Pass | Code-level validation covers requested cases. |
| Authenticated mutation abuse tests | Context Debt | No isolated contractor fixture/token available. |
| Cross-client runtime proof | Context Debt | No isolated tenant fixtures available. |
| Cross-contractor runtime proof | Context Debt | No isolated contractor fixtures available. |
| Duplicate lifecycle/signal protection | Static Pass | DB function definition confirms duplicate protection. |
| Forbidden endpoint scan | Pass | No provider endpoint calls found in scoped files. |
| No external dispatch | Pass | No sender calls or dispatch mutations added. |
| Final build/type/Deno | Pass | All required validation commands passed. |

## 16. Phase 4 Readiness Verdict

`phase_4_allowed_for_internal_pilot_only`

This is intentionally conservative. Core backend/RLS posture and no-dispatch guardrails pass under available checks, but seeded contractor-auth tenant isolation and authenticated payload-abuse fixtures remain required before real contractor-facing production exposure.

## 17. Remaining Risks

- Broad EXECUTE grants on some admin RPCs rely on fail-closed function bodies. This passed anon runtime probes but should be tightened or continuously tested before real contractor access.
- No seeded two-tenant/two-contractor fixture exists for runtime cross-tenant proof.
- Authenticated mutation abuse tests were not run against `partner-update-disposition` because no isolated contractor token/fixture was available.
- Existing connected data has one `contractor_outcomes` row missing `client_slug` and marked blocked/review, which should stay hidden from contractor-facing views until reconciled.

## 18. Required Fixes Before Real Contractor Access

- Create isolated 4A test fixtures for two clients and two contractor accounts with separate auth users.
- Add runtime tests proving each contractor can read only own account/assignment rows and cannot read cross-client rows.
- Add authenticated Edge Function abuse tests for sold/lost/mismatched payloads using disposable records and cleanup.
- Review/revoke broad EXECUTE grants for admin RPCs where possible, or add CI smoke tests proving fail-closed behavior.
- Resolve or quarantine existing blocked/review contractor outcome rows before exposing contractor data.

## 19. Handoff To 4A Contractor Portal Access Model

4A may proceed only as an internal pilot access-model sprint. It should not expose real production contractors until seeded tenant fixtures and authenticated abuse tests pass. Keep contractor surfaces redacted by default, avoid raw PII, preserve service-role-only mutation paths, and derive contractor identity from auth context rather than caller-supplied IDs.
