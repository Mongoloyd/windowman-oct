# Phase 3G-A/B — Syndicate Health + Tenant Isolation Closeout

## 1. Goal
Build one internal admin control room for Syndicate health, tenant-boundary audit, and closeout readiness across the Phase 3C through 3F ownership layer.

## 2. North Star
WindowMan can inspect syndicates, clients, contractor accounts, assignments, outcomes, and outcome-derived revenue signal readiness without granting contractor/client access or mutating source-of-truth records.

## 3. What Was Built
- `src/services/syndicateHealth.ts` for deterministic internal health summaries, matrices, and operational actions.
- `src/services/tenantIsolationAudit.ts` for tenant warning generation, RLS posture classification, closeout verdicts, and readiness states.
- `src/components/admin/SyndicateHealthDashboard.tsx` for the Syndicate Health admin tab.
- `src/components/admin/TenantIsolationAudit.tsx` embedded inside Syndicate Health as a major Tenant Isolation Audit section.
- Admin navigation and route alias for `/admin/syndicate-health`.

## 4. Systems Audited
- `syndicates`
- `syndicate_clients`
- `contractor_accounts`
- `lead_assignments`
- `lead_routing_events`
- `contractor_outcomes`
- outcome-derived `event_logs` revenue signals from Phase 3F
- Revenue Dispatch Readiness RPC/service output

## 5. Data Sources
Data is read from existing Supabase tables and the existing `admin_revenue_dispatch_readiness()` path. No fake data, sample rows, or synthetic warnings are created.

## 6. Evidence Levels
Implemented evidence levels:
- `runtime_verified`: runtime policy/table inspection succeeds.
- `static_migration_review`: browser/runtime introspection is unavailable, but migration/docs evidence is available.
- `unknown`: no reliable evidence is available.

Current UI service can downgrade to `static_migration_review` when `pg_tables`/`pg_policies` are not readable from the client context.

## 7. Health Status Model
Health statuses are deterministic:
- `critical`: blocked outcomes, duplicate assignment risk, missing tenant scope, client/contractor mismatch, blocked revenue signals, missing sold/lost outcome requirements.
- `manual_review`: manual-review assignments/outcomes or ambiguous revenue metadata.
- `warning`: stale assignments, recycled/reassigned load, gross proxy value use, unavailable signal source, optional context gaps.
- `healthy`: no detected conditions.
- `unknown`: required source tables/services are unreadable.

## 8. Global KPI Definitions
- Active Syndicates: active rows in `syndicates`.
- Active Clients: active memberships in `syndicate_clients`.
- Active Contractors: active rows in `contractor_accounts`.
- Current Assignments: `lead_assignments.is_current = true`.
- Stale Assignments: current assigned/contacted/manual-review assignments past the 7/14 day threshold with no terminal outcome.
- Sold Outcomes: `contractor_outcomes.disposition_state = sold_closed`.
- Blocked Signals: Revenue Dispatch Readiness rows with blocked status.
- Operational Actions: real detected action items generated from source conditions.

## 9. Syndicate Matrix Definitions
Syndicate rows aggregate active clients, active contractors, current assignments, stale assignments, sold outcomes, blocked outcomes, blocked signals, and health reasons by syndicate membership/client scope.

## 10. Client Matrix Definitions
Client rows aggregate contractor, assignment, outcome, and revenue signal health by `client_slug` and active syndicate membership.

## 11. Contractor Matrix Definitions
Contractor rows aggregate current assignments, stale assignments, sold outcomes, blocked outcomes, and manual-review outcomes by contractor account.

## 12. Operational Action Queue
Actions are generated only from detected conditions, including stale assignments, manual assignments, blocked/disputed outcomes, missing revenue signals, missing client slugs, missing contractor accounts, gross proxy values, duplicate assignment risk, and tenant mismatches.

## 13. Tenant Warning Model
Tenant warnings include severity, code, masked entity ID, client context, related client context, syndicate context, explanation, suggested action, source table, evidence level, timestamp, and metadata summary.

## 14. RLS / Access Posture
RLS posture covers `syndicates`, `syndicate_clients`, `contractor_accounts`, `lead_assignments`, `lead_routing_events`, `contractor_outcomes`, and `event_logs`. Runtime verification is attempted; otherwise the service downgrades to static migration review and does not claim full runtime readiness.

## 15. Assignment Boundary Findings
Assignment checks cover missing client slug, missing syndicate, missing contractor account, duplicate current assignment risk, missing routing events, inactive syndicate membership, contractor/client mismatch, manual review, and `direct` fallback on routed assignments.

## 16. Contractor Account Boundary Findings
Contractor account checks cover missing client slug, inactive contractors with current assignments, and mismatches through linked assignments/outcomes.

## 17. Outcome Boundary Findings
Outcome checks cover missing client slug, missing assignment, assignment/client mismatch, contractor/client mismatch, missing sold value, missing lost reason, manual-review integrity, and disputes.

## 18. Revenue Signal Boundary Findings
Revenue signal checks cover sold outcomes missing internal signals, signals without valid outcomes, signal/outcome tenant mismatch, duplicate signal risk, blocked readiness, and ambiguous historical integrity metadata.

## 19. Contractor-Facing Access Readiness
Status: `deferred` when no critical warnings are present; `blocked` when critical warnings exist. No contractor-facing access was added.

## 20. Client-Facing Reporting Readiness
Status: `ready_for_review` only when no critical/warning/manual-review issues remain. Otherwise it is `deferred` or `blocked` based on warnings. No client-facing reporting access was added.

## 21. Dashboard / UI Changes
Admin now has a visible `Syndicate Health` tab/route. The dashboard includes global KPIs, filters, syndicate matrix, client matrix, contractor account matrix, operational action queue, health detail drawer, embedded Tenant Isolation Audit, final verdict card, warning KPI strip, warning table, RLS posture panel, contractor/client readiness panels, closeout checklist, and tenant warning detail drawer.

## 22. Final Verdict
The implemented verdict is computed at runtime:
- `syndicate_layer_blocked` if critical tenant/RLS warnings are present.
- `syndicate_layer_partially_ready_with_manual_review` if warnings/manual-review/static evidence remain.
- `syndicate_layer_ready_for_internal_operations` only with no critical tenant warnings and strong safe evidence.

## 23. Remaining Risks
- Client-side runtime access to `pg_tables`/`pg_policies` may be unavailable, forcing static migration review.
- Some source relationships depend on legacy nullable fields and may require manual repair.
- Dashboard metrics are operational indicators, not source-of-truth records.

## 24. Required Fixes Before Contractor Portal
- Resolve critical assignment/outcome/client mismatches.
- Confirm contractor-facing redacted data contract.
- Runtime-verify RLS policies for contractor-account and assignment own-access.
- Keep raw homeowner PII, quote files, tokens, click IDs, and platform configs out of contractor surfaces.

## 25. Required Fixes Before Client Reporting
- Resolve tenant warnings for client slug and signal/outcome alignment.
- Define reporting-safe aggregate contracts.
- Verify no cross-client row exposure under runtime RLS.

## 26. Required Fixes Before Scaling Live Dispatch
- Resolve blocked revenue signals.
- Confirm each sold signal has valid contractor outcome provenance.
- Verify duplicate protection remains active.
- Add explicit approval for provider dispatch in a later phase.

## 27. No External Dispatch Proof
No Meta, Google, TikTok, GTM Server, CRM webhook, provider sender, or external endpoint calls were added. The dashboard/audit services only read existing Supabase data and existing readiness service output.

## 28. No Raw PII Exposure Proof
The UI displays masked entity IDs and operational metadata summaries. It does not display raw homeowner PII, raw quote file URLs, raw click IDs, endpoint URLs, platform tokens, Vault secret IDs, or platform config secrets.

## 29. Context Debt
- RLS posture may be `static_migration_review` rather than `runtime_verified` depending on browser access to policy catalogs.
- Supabase generated types may remain stale for newer 3C/3F objects, so services use guarded Supabase client typing.
- Warning volume depends on real operational data currently present in the connected database.

## 30. Handoff To Phase 4
Phase 4 may proceed only as internal operations planning unless runtime audit output is clean. Contractor portal, client reporting, and live dispatch must remain deferred or blocked until the 3G dashboard shows no critical cross-tenant or revenue-signal boundary issues and RLS evidence is runtime-verified or explicitly accepted for review.
