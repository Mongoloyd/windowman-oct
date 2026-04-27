# Phase 3E Contractor Outcome Hardening

## 1. Goal
Harden contractor outcome feedback so `contractor_outcomes` is the explicit, auditable sold/lost revenue source of truth.

## 2. North Star
WindowMan can trust contractor-reported sold/lost outcomes before they feed conversion dispatch, client reporting, or Syndicate health.

## 3. What Was Built
- Added an additive schema migration for outcome integrity fields and admin read RPC.
- Added `src/services/contractorOutcomeIntegrity.ts` for typed outcome integrity reads, local integrity computation, reason formatting, and KPI summaries.
- Added `src/components/admin/ContractorOutcomeInspector.tsx` for internal admin inspection.
- Wired `/admin/outcome-inspector` and the `Outcome Inspector` admin tab.
- Hardened `partner-update-disposition` to require explicit value basis for sold outcomes and stamp integrity metadata proving no dispatch.

## 4. Contractor Outcomes Source-of-Truth Boundary
`contractor_outcomes` owns sold/lost revenue truth. Sold value, lost reason, value basis, verification posture, and integrity reasons live there.

## 5. Leads Rollup-Only Rule
`leads` may mirror convenience fields such as deal status, deal value, revenue amount, and closed time. Those fields are rollups only and must not become authoritative revenue truth.

## 6. Lead Assignments Operational-Only Rule
`lead_assignments` represents operational ownership and routing state only. Assignment status does not prove sold revenue and must not create conversion truth.

## 7. Outcome Status Model
Supported statuses are:
- `new`
- `attempting_contact`
- `contacted`
- `meeting_scheduled`
- `scheduled`
- `quote_delivered`
- `sold_closed`
- `lost_dead`
- `disputed`
- `manual_review`
- `invalid`

Existing partner statuses map forward without breaking older rows:
- `attempting_contact` remains a contacted/in-progress state.
- `meeting_scheduled` remains the scheduling equivalent.
- `quote_delivered` remains non-terminal.

## 8. Value Basis Model
Supported value basis values are:
- `contract_total`
- `gross_sale_value`
- `true_margin`
- `estimated_contract_value`
- `unknown`

Rules:
- `sold_closed` requires a positive `final_value_cents` value.
- `sold_closed` requires explicit `value_basis` and partner updates cannot submit `unknown`.
- `gross_sale_value` is flagged as a proxy, not true margin.
- Homeowner savings are not sold revenue.

## 9. Integrity Statuses
Integrity statuses:
- `valid`
- `warning`
- `blocked`
- `needs_review`

`blocked` is used for hard failures such as missing sold value, lost reason, client mismatch, or disputed outcomes. `warning` is used for usable but caveated states such as gross-value proxy.

## 10. Integrity Reason Codes
Reason codes implemented:
- `missing_client_slug`
- `missing_assignment`
- `missing_contractor_account`
- `sold_missing_value`
- `sold_invalid_value`
- `sold_missing_value_basis`
- `lost_missing_reason`
- `value_basis_gross_proxy`
- `value_basis_unknown`
- `outcome_disputed`
- `assignment_client_mismatch`
- `contractor_client_mismatch`
- `manual_review_required`
- `outcome_not_terminal`
- `eligible_for_future_signal`
- `not_eligible_for_signal`

## 11. Partner Update Disposition Behavior
`partner-update-disposition` remains the existing contractor-facing mutation path. It now:
- validates `value_basis` for sold outcomes
- rejects unknown value basis on partner sold updates
- computes integrity status/reasons for the update payload
- stamps metadata proving `external_dispatch: false`
- preserves non-fatal internal canonical event behavior without calling external platforms

## 12. Admin UI Sections
The 3E inspector includes:
- safety banner
- KPI strip
- filters for client slug, outcome status, integrity status, value basis, review-only, sold-only, lost-only, and ID search
- outcome table
- detail drawer
- integrity reason explainer
- future conversion signal eligibility preview
- no-dispatch and revenue-truth proof

## 13. No External Dispatch Proof
This sprint does not call Meta, Google, TikTok, GTM, CRM webhooks, retry workers, schedulers, or live dispatch endpoints. The inspector is read-only. Metadata uses `external_dispatch: false` and `dispatch_created: false`.

## 14. Privacy / Redaction Rules
The admin read surface excludes raw homeowner email, phone, quote file URLs, platform tokens, Vault secret IDs, and raw click IDs. IDs are masked in the UI table and drawer.

## 15. Known Deferrals
- The connected database had not yet applied Phase 3C `lead_assignments`, so the live migration tool rejected the 3E migration with `relation "public.lead_assignments" does not exist`.
- Apply migrations in order: Phase 3C, Phase 3D, then Phase 3E.
- Regenerate Supabase types after all migrations are applied.
- Existing `AdminOutcomeInspector` remains as an older rollup audit component, but the admin tab now points to the 3E `ContractorOutcomeInspector`.

## 16. Handoff To Phase 3F
Phase 3F should consume `contractor_outcomes` integrity state and reason codes to decide whether a contractor outcome can generate a canonical revenue signal. It must not use `leads` or `lead_assignments` as revenue truth and must preserve no-dispatch until explicit dispatch materialization rules are approved.
