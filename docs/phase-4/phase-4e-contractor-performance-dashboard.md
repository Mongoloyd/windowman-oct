# Phase 4E — Contractor Performance + Close Rate Dashboard

## 1. Goal

Build read-only contractor performance analytics from real Phase 4 assignment, contact release, and contractor outcome data.

## 2. North Star

WindowMan can evaluate contractor quality from real assignment, release, and outcome data without leaking homeowner PII, exposing quote files, inventing metrics, or corrupting revenue truth.

## 3. What Was Built

- `src/services/contractorPerformance.ts` centralizes frontend types, formatters, status rules, and Edge Function invocation.
- `admin-contractor-performance` returns internal aggregate summaries for admins/operators/viewers.
- `contractor-performance-summary` returns only the authenticated contractor account’s own aggregate summary.
- Admin UI: Contractor Performance dashboard with filters, KPI strip, table, and detail drawer.
- Contractor UI: My Performance panel in the contractor portal.

## 4. Data Sources

- `lead_assignments`: assigned lead counts and assignment timing.
- `lead_contact_releases`: approved/released contact release denominator.
- `contractor_outcomes`: contractor progress states, sold/lost counts, validated sold value, manual-review pressure.
- `contractor_accounts`: contractor display name, client slug, and authenticated contractor-account scope.

No lead rows, homeowner contact columns, quote file columns, analysis JSON, report JSON, attribution IDs, platform configs, or token fields are returned.

## 5. Metric Definitions

- `assigned_count`: count of lead assignments for the contractor in the selected window.
- `released_count`: count of approved/released contact releases for the contractor in the selected window.
- `attempting_contact_count`: outcomes with `attempting_contact`.
- `contacted_count`: outcomes at `contacted` or later progress states.
- `scheduled_count` / `meeting_scheduled_count`: outcomes at scheduled or later progress states.
- `quote_delivered_count`: outcomes at quote delivered or sold.
- `sold_count`: validated `sold_closed` outcomes only.
- `lost_count`: `lost_dead` outcomes.
- `manual_review_count`: outcomes with needs-review/manual-review/disputed integrity status.

## 6. Denominator Rules

Rates use `released_count` as the denominator:

- contact rate = contacted / released
- appointment rate = scheduled / released
- proposal rate = quote delivered / released
- close rate = sold / released
- loss rate = lost / released
- attempting-contact pressure = attempting contact / released

If released count is zero, UI renders `—` and does not show a fake 0%.

## 7. Revenue/Sold Value Rules

Sold value is sourced only from validated `sold_closed` contractor outcomes with positive `final_value_cents`.

- Confirmed sold value includes `contract_total` and `gross_sale_value` basis.
- `estimated_contract_value` is separated as estimated/proxy value.
- `true_margin` is separated as margin value and is not blended into gross sold value.
- Homeowner savings, quote delta, projected savings, AI estimates, and projected value are not counted as sold revenue.

## 8. Time Window Rules

Supported windows: last 7 days, last 30 days, last 90 days, all time. Default is 30 days.

- Assignment counts filter by `assigned_at`.
- Release counts filter by release row `created_at`.
- Outcome counts filter by outcome `updated_at`.

## 9. Admin Dashboard

Route/tab: Admin → Contractor Performance.

The admin dashboard shows aggregate contractor rows, KPI totals, filters, status recommendations, and an aggregate detail drawer. It is served by an internal-operator Edge Function and returns no PII or quote files.

## 10. Contractor Self Dashboard

The contractor portal now shows a My Performance panel before assigned opportunities. It calls the self-performance Edge Function, which derives contractor scope from the authenticated user’s active `contractor_accounts` row. The browser does not supply or trust contractor account IDs or client slugs.

## 11. Tenant Isolation Rules

- Admin function validates authenticated internal role from `user_roles` before returning cross-contractor aggregates.
- Contractor function resolves `auth.uid()` to active contractor account server-side.
- Contractor function filters every source query by that contractor account and client slug on the server.
- Contractor UI receives only the returned aggregate row.

## 12. No PII Exposure Proof

Function selects exclude homeowner phone, email, full name, lead raw rows, attribution IDs, and any homeowner identifiers. UI renders contractor name, client slug, aggregate counts, rates, status labels, and aggregate lost reason counts only.

## 13. No Quote File Exposure Proof

No function selects quote upload, quote file, signed URL, storage path, analysis JSON, or report JSON fields. UI contains no quote file links or preview surfaces.

## 14. No External Dispatch Proof

4E added read-only analytics functions only. It does not call Meta, Google, TikTok, GTM server, CRM webhooks, dispatch functions, or outbox/attempt mutation code.

## 15. Empty/Error States

- Admin: loading, safe error, and empty-window states.
- Contractor: loading, safe error, empty-window, and insufficient-data guidance states.

## 16. Validation Results

Validation commands required for final handoff:

- `git diff --name-only`
- `bun run build`
- `npx tsc --noEmit`
- `deno check supabase/functions/admin-contractor-performance/index.ts`
- `deno check supabase/functions/contractor-performance-summary/index.ts`

## 17. Remaining Context Debt

- Runtime smoke tests require real fixture users: internal operator, contractor A, contractor B, released assignments, and validated sold outcomes.
- Generated Supabase types were not changed because 4E did not add database objects.

## 18. Handoff To Phase 4 Closeout / Pilot Readiness

If validation passes, Phase 4F may proceed as internal pilot closeout and first-client readiness checklist. This is not a production contractor marketplace readiness claim.
