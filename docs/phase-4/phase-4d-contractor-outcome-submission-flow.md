# Phase 4D — Contractor Outcome Submission Flow

## Scope

Phase 4D adds the contractor-facing outcome submission path after 4C contact release. It is assignment-first and contractor-account-first.

## Server write path

Contractor outcome writes go through `supabase/functions/contractor-submit-outcome/index.ts` only.

The function:

- Resolves the authenticated Supabase user from the JWT.
- Resolves active `contractor_accounts` linked to `auth.uid()`.
- Verifies the supplied `lead_assignment_id` belongs to that contractor account and exact `client_slug`.
- Requires the assignment to be current and not recycled.
- Enforces approved contact release before accepting contacted, scheduled, proposal, sold, or lost states.
- Rejects client-supplied server-owned fields:
  - `contractor_account_id`
  - `client_slug`
  - `operator_id`
  - `revenue_signal_key`
  - `external_dispatch`
  - `dispatch_created`
- Upserts the single active canonical `contractor_outcomes` row for the assignment/account/client tuple.
- Rejects `sold_closed` without positive `final_value_cents` and explicit `value_basis`.
- Rejects `lost_dead` without `disposition_reason_code` and notes.
- Always returns `external_dispatch: false` and `dispatch_created: false`.

## Database hardening

The Phase 4D migration relaxes legacy-only `contractor_outcomes` requirements so assignment-first outcomes do not need legacy `billable_intro_id` or `opportunity_id` rows. It also adds a partial unique index for one active outcome per `client_slug + lead_assignment_id + contractor_account_id`.

RLS remains internal-operator scoped. Contractors do not receive direct browser write policies on `contractor_outcomes`.

## Frontend integration

The contractor lead detail page now renders `ContractorOutcomeSubmissionPanel` next to contact release state.

The frontend:

- Calls `src/services/contractorOutcomeSubmission.ts`.
- Uses `supabase.functions.invoke("contractor-submit-outcome")`.
- Does not insert, update, or upsert `contractor_outcomes` directly.
- Fails closed if the Edge Function ever returns dispatch flags as true.

## Explicit non-goals

Phase 4D does not:

- Call provider APIs.
- Create dispatch attempts.
- Mark dispatch outbox rows sent.
- Change homeowner funnel behavior.
- Add a contractor performance dashboard.
- Claim production contractor readiness.

## 4E gate

4E Contractor Performance Dashboard may proceed only after 4D validation confirms:

- The Edge Function exists and passes Deno check.
- The frontend service exists and only invokes the Edge Function.
- The contractor detail UI includes the outcome panel.
- No frontend direct writes to `contractor_outcomes` exist.
- Build and TypeScript checks pass.
