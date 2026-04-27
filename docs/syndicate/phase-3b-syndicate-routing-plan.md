# Phase 3B — Syndicate Multi-Tenant Routing + Revenue Feedback Loop

## 1. Phase 3B Goal

Phase 3B defines the internal Syndicate control layer that WindowMan needs before expanding from single-client routing into a multi-tenant market-maker operating model. The plan establishes how qualified homeowner leads, scan intelligence, contractor assignments, partner outcomes, revenue truth, and conversion feedback should move through the system by `client_slug` and syndicate membership without tenant leakage, duplicate ownership, or attribution drift. This sprint is documentation-only: it does not create schema, change routing behavior, call external providers, or touch scanner, OTP, or report reveal logic.

## 2. North Star

WindowMan can prove, for every qualified lead, who owns it, why they own it, what happened to it, which outcome is authoritative, and which client/platform should receive any future conversion signal.

## 3. Why This Matters

WindowMan’s conversion control plane can already capture attribution, preserve `client_slug`, inspect revenue dispatch readiness, materialize dry-run outbox rows, simulate attempts, and prove that live dispatch is disabled. The business model now needs an equally auditable ownership layer. Without explicit Syndicate routing and outcome truth, the system risks assigning a homeowner to the wrong contractor, feeding revenue back to the wrong client, allowing contractors to infer competitor data, double-counting sold revenue, or training ad platforms from stale ownership assumptions. A Syndicate layer makes routing, reassignment, outcome updates, and dispatch eligibility deterministic rather than inferred from URL slugs, lead rollups, or UI state.

## 4. Definition of Success

- A Syndicate is defined as an internal WindowMan-controlled routing group, not a public homeowner or contractor-facing marketplace concept.
- `client_slug`, client, contractor, and syndicate boundaries are explicit and non-interchangeable.
- Lead ownership is represented by an assignment state machine and append-only history, not inferred from `leads.status` or URL attribution alone.
- `contractor_outcomes` remains the source of truth for sold/lost revenue outcomes.
- `leads` remains a rollup and routing context surface only.
- Routing decisions are deterministic, explainable, and reproducible from stored inputs.
- Reassignment and recycling preserve prior owners and reason codes.
- Tenant isolation rules prevent contractors or clients from reading competing contractor data.
- Admin operators have a clear board for assignment, reassignment, recycling, disputes, and outcome inspection.
- Conversion dispatch consumes canonical revenue signals derived from authoritative outcomes, not assignment alone.
- Platform config and outbox routing remain keyed by the correct `client_slug`.
- No live ad-platform dispatch is introduced by the Syndicate plan.
- Scanner, OTP, and report reveal boundaries remain untouched.
- The roadmap for 3C through 3G is clear enough to implement incrementally with RLS and rollback plans.

## 5. Current State Audit

| System area | Current implementation | Files/tables inspected | Maturity | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Lead capture | Homeowner capture and scan flows persist lead/session context; `client_slug` is expected to exist with a `direct` fallback. | `leads`, `scan_sessions`, `analyses`, `src/components/TruthGateFlow.tsx`, `src/lib/useUtmCapture.ts` | Functional for acquisition and scan lineage | Lead ownership is not equivalent to current contractor assignment. | Keep `leads` as canonical homeowner identity and rollup context; add a separate assignment ledger in 3C/3D. |
| `client_slug` attribution | URL/query keys `client_slug`, `client`, `partner`, and `syndicate` are captured, stored, and refreshed at submit time; `useClientSlug` validates `?client=` against active clients. | `src/lib/useUtmCapture.ts`, `src/lib/useClientSlug.ts`, `clients` | Strong for attribution capture | `syndicate` query alias currently maps into `client_slug`, which is useful for acquisition but not sufficient for internal syndicate membership. | Preserve fallback chain; in 3C model syndicates separately and map clients to syndicates explicitly. |
| Client configs | Platform metadata and token presence are managed through an admin Edge Function; UI masks token secret presence. | `client_platform_configs`, `src/services/clientPlatformConfigs.ts`, `src/components/admin/ClientPlatformConfigs.tsx` | Mature for dry-run readiness | Platform config is client-scoped, not syndicate-scoped. Wrong client ownership can route conversion feedback to wrong platform config. | Use assignment/outcome truth to resolve `client_slug`; keep platform configs client-owned. |
| Contractor outcomes | Partner disposition updates validate transitions, update `contractor_outcomes`, roll up summary fields to `leads`, and emit canonical sold events with revenue truth metadata. | `contractor_outcomes`, `supabase/functions/partner-update-disposition/index.ts`, `src/components/admin/AdminOutcomeInspector.tsx` | Strong foundation | Outcome ownership is tied to opportunity/contractor but not yet to immutable lead assignment history. | Treat `contractor_outcomes` as revenue truth; link future assignment rows to opportunities/outcomes. |
| Partner update disposition | Contractor JWT is resolved to contractor identity; sold requires `final_value_cents`; lost requires reason; canonical event emission is non-fatal and PII-free. | `supabase/functions/partner-update-disposition/index.ts` | Strong but single-path | Canonical sold event can fail non-fatally after outcome write; future reconciliation must surface missing canonical revenue signals. | 3E should harden outcome-to-event reconciliation without rolling back outcome writes. |
| Revenue dispatch readiness | Read-only RPC inspects `wm_event_log`, resolves `client_slug`, platform config presence, attribution strength, value basis, and contractor context. | `src/services/revenueDispatchReadiness.ts`, `src/components/admin/RevenueDispatchReadiness.tsx`, `20260427114454_admin_revenue_dispatch_readiness.sql` | Strong audit surface | Readiness currently spans canonical events and rollup metadata; source alignment with outbox candidates is still documented as a gap. | 3F should consume canonical revenue signals only after assignment/outcome truth is resolved. |
| Dispatch outbox | Dry-run-only outbox materialization stores event identity, `client_slug`, platform config, mapper version, idempotency, value, redacted snapshots, and no-live lifecycle fields. | `platform_dispatch_outbox`, `src/services/dispatchOutbox.ts`, `DispatchOutboxControl`, `20260427130426...sql` | Strong dry-run control plane | Outbox candidate path currently uses `event_logs` while readiness uses `wm_event_log`; live source selection remains unresolved. | Do not connect Syndicate directly to live dispatch until 3F reconciles canonical source selection. |
| Attempt simulation | Attempt ledger writes dry-run-only audit rows; provider response fields remain null by DB guard and UI copy. | `platform_dispatch_attempts`, `supabase/functions/admin-simulate-dispatch-attempt/index.ts`, `src/services/dispatchAttempts.ts`, `DispatchAttemptReconciliation` | Strong no-live proof | No live attempt response storage exists yet; recovery/retry phases are blocked until live sender architecture exists. | Keep 3B independent of live attempts; conversion feedback should stop at readiness/outbox candidate design. |
| Governance | Dispatch Governance is read-only with `liveDispatchEnabled: false`, `dryRunRequired: true`, `killSwitchEngaged: true`, and no live-enable control. | `src/services/dispatchGovernance.ts`, `src/components/admin/DispatchGovernanceConsole.tsx`, `docs/dispatch-control-plane/governance-1U.md` | Strong no-live governance | Governance is not yet Phase 2B live alpha governance; no provider live gates are active. | Syndicate plan must not assume live dispatch; integrate with governance only as a future eligibility gate. |
| Admin UI | Admin has Routing Desk, Outcome Inspector, Revenue Dispatch Readiness, Platform Configs, Dry-Run Queue, Dispatch Outbox, Attempt Reconciliation, and Dispatch Governance tabs. | `src/components/AdminDashboard.tsx`, `src/components/admin/shell/AdminPrimaryTabs.tsx`, listed admin components | Broad but fragmented | Many surfaces expose related concepts without a single ownership timeline. | 3G should add a Syndicate Health/Assignment view rather than further fragmenting ownership across tabs. |

## 6. Target Data Model

The minimum viable model should add only the objects needed to separate syndicate membership, lead ownership, routing audit, and capacity/recycling policy. Existing `leads`, `clients`, `contractors`, `contractor_opportunities`, `contractor_opportunity_routes`, `contractor_outcomes`, `client_platform_configs`, `wm_event_log`, and dispatch tables remain in place.

| Table | Purpose | Key columns | Source-of-truth role | RLS posture | Required now or deferred | Why it exists |
| --- | --- | --- | --- | --- | --- | --- |
| `syndicates` | Defines an internal WindowMan market/routing group. | `id`, `slug`, `name`, `market_type`, `geography_scope`, `vertical`, `status`, `created_at`, `updated_at`, `metadata` | Source of truth for internal market grouping. | Internal operators read/write; service role all; contractors no direct access unless summarized through scoped views. | Required in 3C | Prevents overloading `client_slug` as a market/syndicate concept. |
| `syndicate_clients` | Maps active clients to syndicates with business terms and routing role. | `id`, `syndicate_id`, `client_id`, `role`, `exclusivity_mode`, `priority`, `status`, `starts_at`, `ends_at` | Source of truth for client membership in markets. | Internal operators read/write; client scoped reads only if a future client portal exists; contractors no access. | Required in 3C | A client can participate in one or more markets without changing attribution slug. |
| `contractor_accounts` | Optional hardened bridge for contractor operational account state if current `contractors`/`contractor_profiles` split becomes insufficient. | `id`, `contractor_id`, `auth_user_id`, `account_status`, `visibility_scope`, `billing_scope`, `created_at` | Deferred identity wrapper; current `contractors` remains marketplace entity. | Internal operators read/write; contractor can read own account only. | Deferred | Avoids immediate duplication while leaving room for stricter multi-tenant contractor identity. |
| `lead_assignments` | Append-only/current ownership ledger for qualified leads. | `id`, `lead_id`, `syndicate_id`, `client_id`, `client_slug`, `contractor_id`, `opportunity_id`, `assignment_state`, `is_current`, `assigned_at`, `released_at`, `reason_code`, `assigned_by`, `previous_assignment_id`, `idempotency_key`, `metadata` | Source of truth for lead ownership and assignment state. | Internal operators all; service role writes; contractor reads only rows where `contractor_id` maps to `auth.uid()` and only safe fields; no contractor updates. | Required in 3C/3D | Makes current and historical ownership explicit and auditable. |
| `lead_routing_events` | Immutable audit log of routing decisions, reassignments, recycling, disputes, and overrides. | `id`, `lead_id`, `assignment_id`, `event_type`, `from_assignment_id`, `to_assignment_id`, `actor_type`, `actor_id`, `reason_code`, `decision_snapshot`, `created_at` | Source of truth for why ownership changed. | Internal operators all; service role insert; contractor can read own safe subset only if needed. | Required in 3D | Explains who changed ownership, when, and why. |
| `lead_recycling_rules` | Defines when leads can be recycled or reassigned. | `id`, `syndicate_id`, `client_id`, `contractor_id`, `freshness_hours`, `no_contact_hours`, `lost_reason_policy`, `max_reassignments`, `status` | Policy source for recycling eligibility. | Internal operators read/write; service role read; contractors no direct access. | Deferred to 3D unless manual-only routing ships first | Keeps recycling deterministic and prevents hidden operator heuristics. |
| `contractor_capacity_rules` | Controls contractor eligibility and throttling by geography, project type, value, and volume. | `id`, `contractor_id`, `syndicate_id`, `service_counties`, `project_types`, `min_value_cents`, `max_active_assignments`, `max_weekly_assignments`, `status`, `updated_at` | Policy source for routing capacity. | Internal operators read/write; contractor read own summary only; service role read. | Deferred to 3D | Prevents over-assignment and supports deterministic routing. |

Minimal 3C schema should create `syndicates`, `syndicate_clients`, `lead_assignments`, and `lead_routing_events` first. `lead_recycling_rules`, `contractor_capacity_rules`, and `contractor_accounts` can remain deferred until routing automation needs policy depth.

## 7. Lead Ownership Model

Ownership must be represented by `lead_assignments`, with exactly one current assignment per lead where `is_current = true`, enforced by a partial unique index in 3C. Assignment state must be explicit and cannot be inferred from `client_slug`, `leads.status`, or `contractor_opportunities.status` alone.

### States

| State | Meaning | Allowed next states |
| --- | --- | --- |
| `unassigned` | Lead is qualified enough for routing but has no current contractor owner. | `assigned`, `manual_review`, `lost_dead` |
| `assigned` | WindowMan assigned the lead to a contractor/client owner. | `accepted`, `contacted`, `reassigned`, `recycled`, `disputed`, `manual_review` |
| `accepted` | Contractor acknowledged or unlocked/accepted the lead. | `contacted`, `scheduled`, `lost_dead`, `disputed` |
| `contacted` | Contractor attempted or completed homeowner contact. | `scheduled`, `lost_dead`, `recycled`, `disputed` |
| `scheduled` | Appointment or consultation is booked. | `sold_closed`, `lost_dead`, `disputed` |
| `sold_closed` | Authoritative outcome shows sale closed. | Terminal except dispute correction by operator. |
| `lost_dead` | Authoritative outcome or operator action shows no active sales path remains. | `recycled`, `manual_review` |
| `recycled` | Lead is intentionally returned to a routing pool after policy conditions. | `assigned`, `manual_review` |
| `reassigned` | Ownership moved to a new assignment. | Terminal for old assignment; new assignment starts as `assigned`. |
| `disputed` | Ownership or revenue claim is under operator review. | `assigned`, `reassigned`, `sold_closed`, `lost_dead`, `manual_review` |
| `manual_review` | Assignment cannot safely progress automatically. | Any operator-approved state with reason code. |

### Ownership fields and audit requirements

- **Owner type:** MVP owner type is `contractor`; future owner types may include `client`, `syndicate_pool`, or `internal_operator_queue` but should not be added until needed.
- **Current owner:** Current assignment is `lead_assignments.is_current = true` with non-null `contractor_id` when assigned to a contractor.
- **Previous owners:** Historical assignments remain immutable with `is_current = false`, `released_at`, and `previous_assignment_id` linking transitions.
- **Assignment timestamp:** `assigned_at` is required when state first becomes `assigned`.
- **Reason code:** Required for every assignment, reassignment, recycle, dispute, manual override, and dead/lost transition.
- **Operator override rules:** Overrides require internal operator auth, typed reason, decision snapshot, and a `lead_routing_events` row. Overrides cannot delete or rewrite previous assignments.
- **Audit requirements:** Every state change writes `lead_routing_events` with old/new state, actor, reason, and a redacted decision snapshot. No raw platform tokens, Vault IDs, raw click IDs, endpoint URLs, or full homeowner PII should be stored in routing event snapshots.

## 8. Routing Logic

Routing must be deterministic, auditable, and side-effect constrained. The routing service should compute a decision from current data, then write assignment and routing event rows only after explicit operator or approved service action.

### Inputs

- `client_slug`: attribution and platform config routing key. It selects the client context but does not alone prove assignment ownership.
- County/geography: lead county/city/zip and contractor service counties/regions.
- Project type: window/door/project category from lead intake and scan context.
- Quote uploaded or no quote: scan-backed leads can carry more confidence; no-quote leads may require manual review or lower routing priority.
- Estimated value: quote amount, final quote range, or deterministic estimate; must be tagged by value basis.
- Homeowner intent: report unlock, callback request, intro request, diagnostic intake, or partner handoff intent.
- Contractor capacity: active assignments, weekly caps, service fit, and availability.
- Exclusivity rules: syndicate/client membership may be exclusive, rotating, pooled, or manual-only.
- Lead freshness: age since capture, unlock, intro request, last contact, or last route.
- Prior assignment history: previous owners, disputes, lost reasons, no-contact windows, recycle count.

### Outputs

- Selected `syndicate_id` and syndicate slug.
- Selected `client_id` and `client_slug`.
- Selected `contractor_id` when eligible.
- `routing_status`: `assigned`, `unassigned`, `manual_review`, `blocked`, `recycled`, or `no_eligible_contractor`.
- `routing_reason`: typed reason code such as `primary_client_match`, `geo_capacity_match`, `exclusive_client_route`, `manual_override`, `capacity_blocked`, `stale_recycle`, or `dispute_hold`.
- `fallback_status`: `direct_pool`, `manual_review`, `no_active_syndicate`, `client_inactive`, `capacity_exhausted`, or `missing_required_context`.
- Redacted decision snapshot containing inputs, scores, policy version, and excluded contractors with non-sensitive reason codes.

Routing should use an idempotency key such as `lead_id | syndicate_id | client_id | contractor_id | routing_policy_version | reason_code` to prevent duplicate current assignments from operator double-clicks or repeated function calls.

## 9. Revenue Feedback Loop

- `contractor_outcomes` owns sold/lost truth. It is the authoritative source for `disposition_state`, `final_value_cents`, `projected_value_cents`, `disposition_reason_code`, `closed_at`, and partner outcome notes.
- `leads` is rollup-only. Fields such as `deal_status`, `deal_value`, `revenue_amount`, and `closed_at` may summarize the latest authoritative outcome but must not override it.
- A sold outcome requires `final_value_cents > 0`, `disposition_state = 'sold_closed'`, linked `lead_id`, linked `opportunity_id`, linked `contractor_id`, and a valid assignment relationship or manual review exception.
- A lost outcome requires `disposition_state = 'lost_dead'` and a typed `disposition_reason_code`.
- True margin is separate from contract value. If only gross sale value exists, conversion metadata must set `optimization_value_basis = 'gross_sale_value'`, `true_margin_available = false`, and `margin_model_version = null`.
- Gross proxy values must be visible as warnings in readiness and health surfaces.
- Outcome closure should generate a canonical revenue signal with `revenue_truth_source = 'contractor_outcomes'` and `revenue_rollup_target = 'leads'`.
- Dispatch readiness consumes the canonical revenue signal and validates `client_slug`, platform config, attribution strength, event identity, idempotency, destination, token presence, and value basis.
- Assignment does not equal conversion. A routed or accepted lead is operational ownership only; sold dispatch eligibility begins only after the authoritative outcome closes.
- Lost outcomes block sold dispatch and should generate either no sold event or a separate non-optimization operational event, depending on future taxonomy approval.

## 10. Tenant Isolation / RLS Strategy

- **Internal operators:** May read and mutate syndicates, membership, assignments, routing events, capacity rules, and recycling rules through admin UI and Edge Functions guarded by `public.is_internal_operator()`.
- **Contractors:** May read only their own contractor profile, opportunities, routes, outcomes, and safe assignment summaries where `contractor_id` maps to their authenticated identity. They must not see competing contractors, excluded candidates, platform configs, raw attribution, or full decision snapshots.
- **Clients:** If a future client portal exists, clients may read aggregate syndicate/client health for their own `client_id` only. They must not see contractor-level competitor data unless explicitly part of the business contract.
- **Service-role writes:** Routing, reassignment, recycling, and outcome canonicalization should write through Edge Functions using service role after caller auth and authorization checks.
- **Contractor restrictions:** Contractors cannot mutate attribution identity, `client_slug`, syndicate membership, assignment ownership, routing policy, canonical event identity, dispatch outbox, or conversion dispatch state.
- **Platform token restrictions:** Raw platform tokens, Vault secret IDs, token secret IDs, raw endpoint URLs, and token fingerprints beyond approved prefixes must never be exposed to contractors, clients, routing snapshots, or broad admin tables.
- **RLS design:** New tables should enable RLS by default, grant all to service role, grant internal select/write policies to authenticated `is_internal_operator()`, and add narrow contractor select policies only where a direct contractor ownership relationship exists.
- **Security-definer helpers:** Use security-definer functions for role checks and contractor identity resolution to avoid recursive RLS issues.

## 11. Admin UI Requirements

| View | Purpose | Fields shown | Allowed actions | Forbidden actions | Safety copy |
| --- | --- | --- | --- | --- | --- |
| Syndicate Overview | Show internal markets, active clients, contractor coverage, and routing posture. | Syndicate name/slug, market, status, clients, active contractors, open leads, blocked reasons. | Filter, inspect, pause planning status after future approval. | No public syndicate publishing, no live dispatch. | “Syndicates are internal routing groups; homeowners never see this label.” |
| Lead Assignment Board | Operational queue for unassigned, assigned, accepted, stale, recycled, and disputed leads. | Lead masked identity, `client_slug`, syndicate, contractor, state, age, value band, reason code. | Assign, reassign, recycle, mark manual review through Edge Functions. | Direct edits to `leads`, direct sold marking, cross-tenant visibility. | “Assignment controls operational ownership only; it is not a conversion.” |
| Assignment Detail Drawer | Explain one lead’s ownership timeline and routing decision. | Current assignment, prior owners, decision snapshot, excluded reasons, outcome link, revenue readiness link. | Add operator note, request reassignment, open outcome inspector. | Delete history, reveal raw tokens/click IDs, edit scanner/report data. | “History is append-only; corrections create new events.” |
| Contractor Outcome Feed | Show outcome updates tied to assignments and opportunities. | Contractor, opportunity, state, value, reason, last action, canonical event status. | Inspect, flag mismatch, request correction workflow. | Overwrite partner outcome from UI in 3B/3C. | “`contractor_outcomes` is revenue truth; lead fields are rollups.” |
| Recycle/Reassign Queue | Surface stale, lost, no-contact, capacity-blocked, or disputed rows requiring operator action. | State, stale age, prior attempts, recycle eligibility, policy reason, risk flags. | Recycle, reassign, dispute hold, manual review. | Automatic bulk reassignment without approval. | “No automatic recycling is active; every ownership change is audited.” |
| Revenue Truth Inspector | Connect sold/lost outcomes to canonical revenue signals and dispatch readiness. | Outcome ID, final value, value basis, lead rollup status, canonical event ID, readiness blockers. | Open readiness/outbox previews, flag missing signal. | Dispatch conversion directly. | “Sold dispatch eligibility starts from outcome truth, not assignment state.” |
| Client/Syndicate Health Matrix | Compare tenant routing health without leaking contractor-specific competitor data. | Client slug, syndicate, active configs, lead counts, assignment counts, sold/lost counts, warnings. | Filter, export safe internal report. | Contractor-level data export to other tenants. | “Aggregates are tenant-scoped; competitor details remain hidden.” |

## 12. Edge Function / Service Layer Plan

| Function/service | Auth | Input schema | Output schema | Source of truth | Idempotency | Audit log | Forbidden behavior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `generate-routing-decision` | Internal operator or service role after validated caller context. | `lead_id`, optional `syndicate_id`, optional `client_slug`, `mode: preview|commit`, policy version. | Decision with selected syndicate/client/contractor, excluded candidates, reasons, fallback, redacted snapshot. | Reads `leads`, `clients`, `syndicate_clients`, contractors, capacity rules, prior assignments. | Preview is read-only; commit uses deterministic assignment idempotency key. | On commit writes `lead_routing_events`. | No external dispatch, no direct outcome writes, no raw PII in snapshot. |
| `admin-route-lead` | Authenticated internal operator only. | `lead_id`, `contractor_id`, `syndicate_id`, `client_id`, `reason_code`, `operator_note`, confirmation. | Created/current assignment summary and routing event ID. | `lead_assignments` current row. | Unique current assignment and request idempotency key. | Required routing event. | Cannot assign inactive contractor/client/syndicate; cannot bypass duplicate current owner. |
| `admin-reassign-lead` | Authenticated internal operator only. | `lead_id`, `from_assignment_id`, `to_contractor_id`, `reason_code`, `operator_note`, confirmation. | Old assignment closed, new assignment created, event IDs. | `lead_assignments`. | Transaction closes old current row and creates one new current row. | Required event with previous/new assignment IDs. | Cannot rewrite prior assignment; cannot reassign sold terminal outcome without dispute workflow. |
| `admin-recycle-lead` | Authenticated internal operator only. | `lead_id`, `assignment_id`, `reason_code`, `operator_note`, optional target pool. | Assignment state `recycled` or new unassigned pool state. | `lead_assignments` and recycling policy. | One recycle event per assignment/reason unless explicitly overridden. | Required event. | No automatic broad recycle; no contractor notification without separate approved workflow. |
| `admin-syndicate-health` | Authenticated internal operator only. | Filters: syndicate, client, market, date range. | Aggregates for assignments, outcomes, capacity, warnings, conversion readiness. | Read-only joins across assignment/outcome/readiness tables. | Read-only. | None except optional admin access logs if later required. | No raw PII, raw tokens, raw click IDs, or cross-tenant contractor detail export. |

Shared services should include `computeRoutingDecision()`, `computeAssignmentState()`, `computeRecycleEligibility()`, `resolveCurrentLeadOwner()`, and `buildRevenueSignalFromOutcome()` once schema is approved.

## 13. Conversion Control Plane Integration

| Source | Role in integration | Required rule |
| --- | --- | --- |
| Contractor outcome | Authoritative sold/lost business event. | Only `contractor_outcomes` or a future hardened outcome model can produce sold/lost revenue truth. |
| Canonical event | Durable conversion signal candidate. | Sold outcome emits a canonical revenue event with stable `event_id`, `lead_id`, `client_slug`, outcome linkage, value basis, and attribution metadata. |
| Dispatch readiness | Pre-outbox validation. | Blocks missing event ID, missing value, missing `client_slug`, unresolved tenant, weak attribution, missing platform config, and gross proxy warnings. |
| Platform config | Client-owned destination configuration. | Resolved through the outcome/assignment `client_slug`, never through contractor-visible data. |
| Outbox candidate | Dry-run/live-eligible dispatch unit. | Uses canonical event identity, platform config, idempotency key, redacted payload, and governance state. |
| Live dispatch eligibility | Future governed send decision. | Requires Phase 2B/2C/2D live governance/sender/reconciliation; Syndicate does not bypass dispatch gates. |

Clarifications:

- Lead assignment does not equal conversion.
- Sold outcome triggers the revenue signal; assignment only determines operational ownership and tenant context.
- Lost outcome blocks sold dispatch for that outcome.
- `client_slug` controls conversion routing to client platform configs.
- Syndicate membership controls operational routing, contractor eligibility, and market-level reporting.
- If assignment `client_slug` and outcome/canonical event `client_slug` disagree, dispatch readiness must block and require manual review.

## 14. Risk Register

| Risk | Severity | Mitigation | Required test |
| --- | --- | --- | --- |
| Duplicate assignment | Critical | Partial unique index for one current assignment per lead; idempotent route function. | Concurrent assignment test with two operator requests. |
| Wrong contractor receives lead | Critical | Deterministic routing decision snapshot and active contractor/client checks before commit. | Routing fixture where ineligible contractor is excluded with reason. |
| Revenue attributed to wrong client | Critical | Outcome-to-assignment/client consistency check before canonical revenue signal becomes dispatch-ready. | Sold outcome with mismatched assignment `client_slug` blocks readiness. |
| Stale `client_slug` | High | Store assignment `client_slug` at assignment time and compare against lead/current client state. | Client slug changed after assignment surfaces manual review warning. |
| Contractor edits source truth | Critical | Contractor writes only through validated Edge Functions; no direct RLS update to assignment or attribution tables. | Contractor session cannot update assignment/client/event rows. |
| Tenant leakage | Critical | RLS scoped by contractor identity and internal operator role; redacted admin/client exports. | Contractor A cannot select Contractor B assignment/outcome rows. |
| Unsupported reassignment | High | Reassign through append-only close/create transaction with reason code. | Reassignment preserves old assignment and creates routing event. |
| Sold value mismatch | High | `contractor_outcomes.final_value_cents` is authoritative; lead rollup mismatch inspector flags discrepancies. | Lead rollup value differs from outcome and is detected. |
| Dispute handling | High | `disputed` and `manual_review` states block recycling and dispatch until resolved. | Disputed assignment cannot be reassigned or dispatched without operator override. |
| Privacy exposure | Critical | Routing snapshots store booleans/masked IDs only; no raw tokens, Vault IDs, click IDs, endpoint URLs, email, or phone. | Snapshot sanitizer test rejects sensitive keys. |

## 15. Implementation Roadmap

### 3C — Syndicate Schema + RLS Implementation

- **Goal:** Create the minimum schema for syndicates, client membership, lead assignments, and routing events.
- **Likely files touched:** Supabase migration, generated types after migration, docs update.
- **DB objects:** `syndicates`, `syndicate_clients`, `lead_assignments`, `lead_routing_events`, enums/check constraints, RLS policies, partial unique index for current assignment.
- **Pass conditions:** RLS enabled; internal operators can read/write; contractors cannot read competitor data; no scanner/OTP/report files touched.
- **Rollback plan:** Drop new tables/policies only if no production assignments have been written; otherwise mark syndicates inactive and preserve audit rows.

### 3D — Lead Assignment Ledger + Routing Service

- **Goal:** Implement deterministic route/reassign/recycle service functions and internal admin mutation paths.
- **Likely files touched:** `supabase/functions/admin-route-lead`, `admin-reassign-lead`, `admin-recycle-lead`, frontend service wrappers, assignment board UI.
- **DB objects:** Optional policy helpers, routing reason enum/checks, idempotency indexes.
- **Pass conditions:** One current assignment per lead; all changes append routing events; operator confirmation required for overrides; no automatic broad routing.
- **Rollback plan:** Disable admin actions via feature flag/config state; retain assignment history for audit.

### 3E — Contractor Outcome Feedback Hardening

- **Goal:** Link outcomes to assignments and block ambiguous sold/lost truth.
- **Likely files touched:** `partner-update-disposition`, outcome inspector, migration adding assignment linkage if approved.
- **DB objects:** Optional `lead_assignment_id` on `contractor_outcomes` or join table if direct FK is unsafe for existing rows.
- **Pass conditions:** Sold requires value > 0 and assignment consistency; lost requires reason; mismatches become manual review.
- **Rollback plan:** Keep existing outcome writes; disable new consistency block by reverting function version while preserving audit logs.

### 3F — Revenue Truth → Conversion Signal Integration

- **Goal:** Ensure canonical revenue signals are emitted only from authoritative outcomes with assignment/client consistency.
- **Likely files touched:** canonical event service, revenue readiness RPC, outbox candidate RPC, readiness UI.
- **DB objects:** Possibly event metadata constraints or reconciliation RPCs; no live sender required.
- **Pass conditions:** `contractor_outcomes` source metadata is mandatory for sold dispatch readiness; `client_slug` mismatch blocks outbox materialization.
- **Rollback plan:** Return readiness to warning-only mode while keeping outcome truth intact.

### 3G — Syndicate Health Dashboard + Tenant Isolation Audit

- **Goal:** Add internal Syndicate Health views and prove RLS/tenant isolation.
- **Likely files touched:** Admin dashboard tab, `SyndicateOverview`, `LeadAssignmentBoard`, `RevenueTruthInspector`, service layer, docs.
- **DB objects:** Read-only health RPCs/views guarded by `is_internal_operator()`.
- **Pass conditions:** Operators can answer ownership/revenue/routing questions; contractor sessions cannot access competitor rows; no raw secrets/PII in UI.
- **Rollback plan:** Remove dashboard route/tab while retaining schema and assignment history.

## 16. Definition of Done

The 3B–3G family is complete when every qualified lead has a provable current or terminal ownership state, all ownership changes are append-only and reason-coded, routing decisions are reproducible from stored snapshots, contractor outcomes are linked to ownership context, sold/lost truth is authoritative in `contractor_outcomes`, revenue signals carry correct `client_slug` and value basis, dispatch readiness blocks ambiguous tenant or value state, RLS prevents contractor/client cross-tenant leakage, and operators have a single health surface to inspect assignment, outcome, and conversion readiness without exposing raw tokens, raw click IDs, raw endpoint URLs, or homeowner PII beyond approved internal contexts.

## 17. Open Questions / Assumptions

- Assumption: MVP syndicates are internal-only and do not need homeowner-facing or contractor-facing labels.
- Assumption: Existing `clients` remain the platform config owner, while `syndicates` group clients and contractors operationally.
- Assumption: `contractors` remains the marketplace contractor entity for 3C; `contractor_accounts` is deferred unless identity boundaries require it.
- Assumption: Initial routing can be operator-controlled/manual with deterministic previews before any automated assignment.
- Question: Should one lead be allowed to have multiple simultaneous contractor owners in pooled/non-exclusive syndicates, or does MVP require exclusive current ownership?
- Question: Should assignment state mirror `contractor_opportunities.status`, or should opportunities remain a downstream artifact of assignment?
- Question: Which canonical event source becomes the live dispatch source of truth: `wm_event_log` or `event_logs`?
- Question: Should gross sale value continue as the optimization proxy until cost/margin capture exists, or should some clients be excluded from optimization until true margin is available?
- Question: What operator role granularity is needed beyond `is_internal_operator()` for dispute resolution and reassignment approvals?

## 18. Approval Gate

Waiting for approval before creating migrations, modifying code, or changing routing behavior.
