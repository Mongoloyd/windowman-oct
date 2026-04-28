# Phase 4D Contractor Outcome Abuse-Test Checklist

Use this checklist against `contractor-submit-outcome`.

## Identity and assignment ownership

- Submit without JWT → expect 401.
- Submit with a user that has no active `contractor_accounts` row → expect 403.
- Submit a valid UUID for an assignment owned by another contractor account → expect 403.
- Submit an assignment from another `client_slug` → expect 403.
- Submit a recycled or non-current assignment → expect 409.

## Spoofed server fields

Payloads containing any of these keys must be rejected:

- `contractor_account_id`
- `client_slug`
- `operator_id`
- `revenue_signal_key`
- `external_dispatch`
- `dispatch_created`

Expected result: 422 with `external_dispatch: false` and `dispatch_created: false`.

## Contact release gate

Without an approved `lead_contact_releases` row for the assignment/account/client tuple, these states must be rejected:

- `contacted`
- `meeting_scheduled`
- `scheduled`
- `quote_delivered`
- `sold_closed`
- `lost_dead`

Expected result: 403 `contact_release_required`.

## Sold/lost validation

- `sold_closed` without `final_value_cents` → expect 422.
- `sold_closed` with zero or negative `final_value_cents` → expect 422.
- `sold_closed` without `value_basis` → expect 422.
- `lost_dead` without `disposition_reason_code` → expect 422.
- `lost_dead` without notes → expect 422.

## Dispatch isolation

Every successful and failed response must include:

- `external_dispatch: false`
- `dispatch_created: false`

The function must not call provider APIs, create dispatch attempts, or mark dispatch outbox rows sent.

## Frontend direct-write guard

Run:

```sh
rg -n "from\(['\"]contractor_outcomes['\"]\)\.(insert|update|upsert)" src
```

Expected result: no matches.
