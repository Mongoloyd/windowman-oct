# Phase 4B — Contractor Lead List + Redacted Lead Detail View

## 1. Goal

Give active internal-pilot contractors their first useful assigned-opportunity view while preserving tenant isolation and withholding uncontrolled homeowner PII, quote files, raw report data, outcomes, and dispatch behavior.

## 2. North Star

A contractor can see only opportunities assigned to their own authenticated contractor account, and manual URL/ID tampering cannot reveal another contractor's assignment or client context.

## 3. What Was Built

- `src/services/contractorLeads.ts` assigned-opportunity service.
- `ContractorLeadList` assigned opportunity list.
- `ContractorLeadCard` compact redacted assignment cards.
- `ContractorLeadDetail` read-only redacted detail view.
- `ContractorLeadEmptyState` safe empty state.
- Integrated assigned opportunities into the 4A `/partner/portal` shell.
- Validation smoke-test script for future two-contractor runtime proof.

## 4. Data Sources

4B reads only:

- current Supabase authenticated user through the 4A contractor access service
- `contractor_accounts` safe context through 4A
- `lead_assignments` rows scoped to the resolved contractor account and client slug

4B does not query:

- `leads`
- `quote_files`
- storage buckets
- `analyses.full_json`
- raw report JSON
- `contractor_outcomes`
- provider/platform config tables

## 5. Contractor Authorization Flow

1. `fetchContractorAssignedLeads()` and `fetchContractorAssignedLeadDetail()` first call `fetchContractorAccountContext()`.
2. If the user is unauthenticated, not linked, pending, suspended, revoked, or erroring, the service returns a safe non-data state.
3. If access is allowed, assignment reads filter by both:
   - `contractor_account_id = resolved contractorAccountId`
   - `client_slug = resolved clientSlug`
4. Detail fetches also filter by the assignment ID, but never trust that ID alone.
5. A non-owned or nonexistent assignment returns a generic not-found state without revealing existence.

## 6. Assigned Lead List Contract

Safe summary fields:

- masked assignment ID
- assigned date
- assignment status
- client slug
- project type from assignment metadata when present
- county/region from assignment metadata when present
- window count range, not raw lead row
- quote range only if already present in assignment metadata
- score/risk band only if already present in assignment metadata
- release state as redacted
- warnings for mismatched or non-current assignments

## 7. Redacted Lead Detail Contract

Safe detail fields:

- all summary fields
- safe project summary from assignment metadata or a controlled fallback
- safe findings from assignment metadata if present
- routing timeline from assignment timestamps
- contact release panel
- quote exposure panel
- safe next step

No outcome controls, sold/lost buttons, scheduling, file download, or edit actions exist.

## 8. Contact Release Policy

No explicit contractor-facing contact release field exists on `lead_assignments` in the current 4B data source. Therefore:

- `hasReleasedContact = false`
- `releaseStatus = redacted`
- contact panel always shows: “Contact details have not been released yet. WindowMan will release contact information only after internal routing approval.”

4B does not expose phone, email, full name, or address.

## 9. Quote File Exposure Policy

Quote files are not queried, signed, linked, previewed, downloaded, or exposed. The detail view always shows: “Quote files are not exposed in this contractor view.”

## 10. RLS / Server Safety

Existing RLS is used:

- `contractor_accounts_select_own` maps contractor account context to `auth.uid()`.
- `lead_assignments_select_own_contractor` permits contractor assignment reads only through a join to the caller-owned contractor account.
- 4B adds no anon policies and no broad authenticated policies.

The frontend also filters by resolved account ID and client slug, but backend RLS remains the enforcement layer.

## 11. UI States

Implemented states:

- loading assigned opportunities
- empty assigned opportunities
- unauthenticated/not-linked/pending/suspended/revoked access unavailable
- safe error
- assigned list
- redacted detail
- generic not-found detail for URL/ID tampering

## 12. Explicit Non-Goals

Deferred:

- homeowner contact release workflow
- quote file viewing/downloads
- assigned lead detail with PII
- contractor outcome submission
- sold/lost controls
- appointment scheduling
- performance dashboards
- live dispatch
- provider sends

## 13. No PII Exposure Proof

4B code does not select lead phone, lead email, homeowner name, address, raw attribution IDs, raw event IDs, raw analysis JSON, raw report JSON, or private file URLs.

The only variable project context comes from `lead_assignments.metadata` and is read through an allow-list of safe keys: project type, county, region, scope range, quote range, score band, safe summary, and safe findings.

## 14. Cross-Contractor Access Proof

Static proof:

- list and detail functions require an allowed 4A contractor context
- list query filters by resolved `contractorAccountId` and `clientSlug`
- detail query filters by `id`, resolved `contractorAccountId`, and resolved `clientSlug`
- RLS policy also scopes `lead_assignments` through `contractor_accounts.auth_user_id = auth.uid()`

Runtime proof remains fixture debt until two isolated contractor JWTs and assignment fixtures are available.

## 15. Validation Results

Completed:

- 4A git/audit baseline checked.
- Required schema objects verified in the connected DB.
- Generated Supabase types verified for contractor tables.
- Build passed.
- TypeScript passed.
- No Edge Functions were touched.
- No migrations were added.

## 16. Remaining Context Debt

- Seed `contractor_user_a`, `contractor_user_b`, separate contractor accounts, separate clients, and separate assignment rows in an isolated environment.
- Run authenticated detail tampering tests with assignment IDs from the opposite contractor.
- Decide the explicit future contact-release data contract before exposing any contact fields.
- Decide whether 4C creates a safe internal release queue or a contractor-facing contact reveal envelope.

## 17. Handoff To 4C Lead Release / Routing Queue or 4D Outcome Submission

Recommended next sprint: **4C — Internal Lead Release / Routing Queue**.

4D outcome submission should wait until the internal release/routing queue proves exactly which contractor can see which contact data and when.

Verdict: `phase_4c_allowed_for_internal_pilot_only_with_fixture_debt`.
