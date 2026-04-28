# Phase 4C-B — Lead Release Queue + Contractor Contact Panel

## 1. Goal

Finish the 4C operating layer on top of commit `b1e35e5`: internal operators can manage contractor contact release decisions, and contractors can see only server-approved, allow-listed contact fields for their own assigned opportunities.

## 2. North Star

No contractor sees homeowner contact details unless an internal, auditable, server-verified release decision exists for the exact `lead_assignment_id`, `contractor_account_id`, and `client_slug`.

## 3. What Was Built

- `src/services/leadReleaseQueue.ts` for queue loading, detail loading, release decisions, status formatting, and allow-list formatting.
- `src/components/admin/LeadReleaseQueue.tsx` with safety banner, KPI strip, filters, queue table, and drawer entry point.
- `src/components/admin/lead-release/LeadReleaseQueueTable.tsx` for masked assignment/contractor queue rows.
- `src/components/admin/lead-release/LeadReleaseDecisionDrawer.tsx` for approve, hold, block, revoke, and manual-review decisions.
- `src/components/admin/lead-release/LeadReleaseTimeline.tsx` for release decision audit history.
- `src/services/contractorLeadRelease.ts` for contractor-safe release state and RPC-backed contact retrieval.
- `src/components/partner/ContractorContactReleasePanel.tsx` for loading, approved, not-released, held, revoked, blocked, manual-review, and error states.
- Contractor lead detail integration in `src/components/partner/ContractorLeadDetail.tsx` and `src/services/contractorLeads.ts`.
- Admin navigation and route alias for `Lead Release`.

## 4. Release Schema Used

4C-B uses the release foundation from `b1e35e5`:

- `public.lead_contact_releases`
- `public.lead_contact_release_events`
- `public.get_contractor_released_contact(_lead_assignment_id uuid)`

No duplicate release tables were created.

## 5. Admin Release Queue

The admin `Lead Release` surface shows assigned contractor opportunities with:

- masked assignment ID
- masked contractor account ID
- contractor display name
- `client_slug`
- assigned date
- assignment status
- release status
- project type
- county
- allow-listed fields
- warning chips
- review action

Filters cover release status, client, contractor, assignment status, and needs-attention rows.

## 6. Release Decision Flow

Operators submit one of five decisions:

- approve
- hold
- block
- revoke
- manual review

Every decision requires a reason. Approved decisions persist selected fields from the strict contact allow-list. Non-approved decisions clear allowed fields. The service derives `contractor_account_id` and `client_slug` from the assignment lookup rather than trusting frontend-supplied values.

## 7. Contractor Contact Reveal Flow

Contractor lead detail first resolves the authenticated contractor account, then loads the assigned opportunity constrained by:

- `assignmentId`
- authenticated contractor account ID
- contractor account `clientSlug`

The contact panel then calls `get_contractor_released_contact(_lead_assignment_id)` only after release state is approved. The RPC resolves the authenticated contractor through `auth.uid()` and returns only allow-listed fields.

## 8. Allowed Contact Fields

Only these fields may be exposed:

- `first_name`
- `last_name`
- `phone`
- `email`
- `city`
- `county`

Quote files, exact address, raw lead rows, report JSON, analysis JSON, attribution IDs, platform configs, tokens, and secret IDs are not exposed.

## 9. RLS / Server Safety

- Release tables have RLS enabled.
- Anonymous users have no release-table access policies.
- Contractors have own-account read visibility only.
- Contractors do not have release-row mutation policies.
- Internal operator writes depend on existing internal operator RLS policies.
- The contractor contact reveal path uses the `SECURITY DEFINER` RPC and `auth.uid()` assignment/account validation.
- Frontend-provided contractor account IDs, client slugs, release status, and URL params are not authorization sources.

## 10. Audit Trail

Each release decision inserts an event in `lead_contact_release_events` with:

- release ID
- assignment ID
- contractor account ID
- client slug
- event type
- decision
- actor ID
- allowed fields
- reason
- optional notes
- audit metadata marking no dispatch, no quote exposure, and no outcome submission

Revoked releases preserve history and hide future contractor contact views.

## 11. No Quote File Exposure

4C-B does not query storage, generate signed URLs, expose `quote_files`, render quote download controls, or include quote file URLs in contractor contact payloads.

## 12. No Outcome Submission

4C-B does not add sold/lost buttons, appointment updates, disposition controls, contractor outcome mutation, revenue-truth mutation, or 4D outcome submission UX.

## 13. No Live Dispatch

4C-B does not call Meta, Google, TikTok, GTM Server, CRM webhooks, dispatch attempts, outbox senders, or provider APIs.

## 14. Validation Results

Completed in this sprint:

- Git audit confirmed `b1e35e5` added the release schema/RLS foundation and generated RPC types.
- Connected DB check confirmed `contractor_accounts`, `lead_assignments`, `lead_routing_events`, `lead_contact_releases`, `lead_contact_release_events`, and `get_contractor_released_contact(uuid)` exist.
- Generated Supabase types include release tables and `get_contractor_released_contact`.
- Removed stale `as never` table cast from contractor lead summary release lookup.

Validation commands run after edits are recorded in final handoff.

## 15. Remaining Context Debt

- Runtime fixture proof still requires two authenticated contractor users, two contractor accounts, two clients, and approved/held/blocked/revoked/missing release rows.
- Authenticated abuse testing is still required before real contractor production exposure.
- Broad RPC grant review remains required before real contractor production exposure.
- Internal operator write path currently uses existing RLS-backed client writes; an Edge Function can be considered later if policy review requires stronger server-side operator decision validation.

## 16. Handoff To 4D Contractor Outcome Submission Flow

4D may proceed for internal pilot only after this 4C-B surface lands and fixture testing confirms contractor isolation. 4D must consume release state and must not bypass contact release gates.
