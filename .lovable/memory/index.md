# Memory: index.md
Updated: 2026-04-16

WindowMan.PRO design system and architecture constraints

## Phase 1 Schema (completed)
- `quotes` bucket: private, 10MB limit, PDF/JPEG/PNG/WEBP/HEIC only
- New tables: `scan_sessions`, `analyses`, `phone_verifications`, `event_logs`
- `analyses` = canonical scoring table; `quote_analyses` = legacy (do not write to)
- `analyses` and `phone_verifications`: service-role + internal operator SELECT only (no anon/auth direct access)
- `scan_sessions` and `event_logs`: temporary anon INSERT only
- All FKs use ON DELETE CASCADE (except event_logs.lead_id = SET NULL)
- `update_updated_at()` trigger on scan_sessions, analyses, phone_verifications
- scan_sessions.quote_file_id is UNIQUE (one session per upload)
- Status fields have CHECK constraints

## Security model
- full_json never sent to client before SMS verification
- No anon SELECT on analyses or phone_verifications
- Storage: no public URLs, signed URLs only via edge functions
- `leads` anon INSERT constrained: cannot forge phone_verified, otp_state, or report_unlocked_at
- Deny policies on conversion_events and user_role_audit_log use RESTRICTIVE type
- All functions have explicit SET search_path = public

## Phase 1 Preflight Hardening (completed 2026-04-16)
- 8 zero-policy tables now have explicit RLS policies (see docs/db/TABLE_ACCESS_MODEL.md)
- Critical fix: leads anon INSERT constrained to prevent OTP gate bypass
- Type generation: `npm run typegen` and `npm run typegen:check` scripts added
- Documentation: TABLE_ACCESS_MODEL.md, FK_HARDENING_PLAN.md, AUDIT_STRATEGY.md, TYPEGEN_WORKFLOW.md
- DB_PREFLIGHT_STATUS.md tracks all changes and deferred items

## Phase 3.3 — Contractor Monetization (completed)
- Tables: `contractors`, `contractor_opportunities`, `contractor_opportunity_routes`
- Edge function: `generate-contractor-brief` (builds anonymized brief, computes priority_score)
- `ContractorMatch.tsx` calls edge function on "Make the Introduction"
- `AdminDashboard.tsx` has Contractor Queue tab with routing console
- One canonical opportunity per scan_session_id (UNIQUE constraint)
- Cached brief on analyses: contractor_brief, contractor_brief_json, contractor_brief_generated_at

## Phase 3.4 — Billable Release Layer (completed)
- New tables: `billable_intros` (revenue ledger), `contractor_outcomes` (post-release tracking)
- Extended `contractor_opportunity_routes` with: interested_at, interest_notes, release_status, release_reviewed_at/by, release_denial_reason
- Extended `contractor_opportunities` with: release_ready, last_interest_at, last_release_at
- Edge function: `contractor-actions` (5 actions: mark_interest, review_release, release_contact, update_billing_status, update_outcome)
- AdminDashboard: 4 tabs (Call Queue, Contractor Queue, Release Review, Revenue)
- Status constants centralized in `src/lib/statusConstants.ts`
- billable_intros.route_id has UNIQUE constraint (one intro per route)
- contractor_outcomes.billable_intro_id has UNIQUE constraint
- Release requires explicit approval → then explicit contact release → creates billable intro + outcome stub
- All billing/release/outcome actions fire events to event_logs

## Phase 3.4A — Immediate Match + Call Momentum (completed)
- Extended `contractor_opportunities` with 14 new columns: suggested_match_*, last_call_*, cta_source
- `generate-contractor-brief` now runs deterministic match scoring + persists top candidate + top 3
- New edge function: `voice-followup` (phonecall.bot webhook, CTA-aware)
- `ContractorMatch.tsx` rebuilt: dual CTAs (intro + report help), immediate match card, process strip
- `/how-we-beat-window-quotes` — manifesto/trust/SEO page
- `src/shared/matchReasons.ts` — shared match reason taxonomy
- AdminDashboard shows suggested match panel (contractor, confidence, reasons, call intent, webhook status)
- Secret needed: PHONECALL_BOT_WEBHOOK_URL (optional — gracefully skips)

## Memories
- [Sprint 1 — Tenant Lockdown](mem://revenue-os/sprint-1-tenant-lockdown) — direct sentinel, slug-integrity trigger, idempotent fire_crm_handoff, four v_admin_* views
- [Sprint 2 — Contractor↔Client Bridge](mem://revenue-os/sprint-2-contractor-client-bridge) — contractor_client_assignments table, resolve_contractors_for_client_slug, four v_admin_assignments_* views
- [Sprint 3 — Tenant Propagation](mem://revenue-os/sprint-3-tenant-propagation) — analyses + contractor_opportunities auto-inherit client_slug from parent lead via BEFORE INSERT/UPDATE triggers; three v_admin_*_slug_* views
- [Sprint 4 — Routing Resolver](mem://revenue-os/sprint-4-routing-resolver) — resolve_route_for_lead/slug return single chosen receiver (primary → priority ASC → created_at ASC) with typed no_route_reason; three v_admin_routing_* views; read-only, no delivery
- [Sprint 5 — Lead Dispatcher](mem://revenue-os/sprint-5-lead-dispatcher) — dispatch-lead edge function drains webhook_deliveries via SKIP LOCKED claim, delivers webhook/Resend; every attempt writes one row to append-only webhook_delivery_attempts; trigger stamps routing snapshot at enqueue and pg_net wakes the worker; four v_admin_*_deliveries_* views
