# Phase 3F Revenue Truth → Conversion Signal Integration

## Goal
Connect authoritative contractor outcome truth to internal conversion-signal readiness without sending anything externally.

## Source of truth
`contractor_outcomes` is the only revenue-truth source for sold/lost outcomes. `leads` remains a rollup surface and `lead_assignments` remains operational ownership context.

## Built / repaired
- Added `src/services/revenueSignalIntegration.ts` for admin-only eligibility reads and safe sync calls.
- Added `admin-sync-revenue-signals` Edge Function as the server path for dry-run or internal-only signal sync.
- Added the Phase 3F database repair migration with:
  - outcome integrity functions
  - revenue signal eligibility RPC
  - internal sync RPC
  - duplicate sold-signal guard
  - Revenue Dispatch Readiness support for outcome-derived signals
- Updated Revenue Dispatch Readiness frontend mapping to accept both partner and admin sync outcome-derived signal sources.

## Eligibility rules
A contractor outcome is eligible only when:
- `disposition_state = sold_closed`
- `final_value_cents` is positive
- `value_basis` is explicit and not `unknown`
- tenant context resolves to a `client_slug`
- assignment/client and contractor/client consistency checks do not fail
- the outcome has not already produced a sold revenue signal

## Duplicate protection
Duplicate sold signals are prevented by a unique index on `event_logs` for `sold` rows whose metadata includes:
- `revenue_truth_source = contractor_outcomes`
- `contractor_outcome_id`

The sync path also reports existing matching signals as `duplicate_protected`.

## No external dispatch
Phase 3F does not call Meta, Google, TikTok, GTM Server, CRM, webhooks, provider senders, retry workers, or live dispatch endpoints. Created rows are internal `event_logs` signals only and stamp:
- `external_dispatch: false`
- `dispatch_created: false`

## Revenue Dispatch Readiness
`admin_revenue_dispatch_readiness()` now reads outcome-derived sold rows from `event_logs` and preserves metadata proving:
- `revenue_truth_source = contractor_outcomes`
- `revenue_rollup_target = leads`
- `source_system = admin-sync-revenue-signals` or `partner-update-disposition`
- `disposition_state = sold_closed`

## Handoff to 3G-A
3G-A may proceed only after validation confirms eligibility, duplicate protection, and readiness visibility remain intact. 3G-A must still not enable live external provider sends unless explicitly approved in a later phase.
