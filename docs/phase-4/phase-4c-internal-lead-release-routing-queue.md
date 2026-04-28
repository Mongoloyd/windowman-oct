# Phase 4C — Internal Lead Release / Routing Queue

## 1. Goal

Create the internal control plane that decides whether one assigned contractor opportunity may reveal limited homeowner contact details to the contractor portal.

## 2. North Star

No contractor sees homeowner contact details unless an internal, auditable, server-verified release decision exists for that exact `lead_assignment_id`, `contractor_account_id`, and `client_slug`.

## 3. What Was Built

- Minimal release decision table: `public.lead_contact_releases`.
- Append-only release event table: `public.lead_contact_release_events`.
- Server-verified contact envelope RPC: `public.get_contractor_released_contact(uuid)`.
- Internal operator service: `src/services/leadReleaseQueue.ts`.
- Contractor release service: `src/services/contractorLeadRelease.ts`.
- Admin Lead Release tab and queue UI.
- Decision drawer with approve, hold, block, revoke, and manual review actions.
- Release timeline component.
- Contractor contact release panel integrated into the 4B redacted lead detail.

## 4. Release Data Model

`lead_contact_releases` stores one current release decision for each assignment/contractor pair:

- `lead_assignment_id`
- `contractor_account_id`
- `client_slug`
- `release_status`
- `released_at`, `released_by`
- `revoked_at`, `revoked_by`
- `hold_reason`, `block_reason`, `release_notes`
- `allowed_contact_fields`
- `audit_metadata`

A trigger rejects assignment/contractor/client mismatches.

## 5. Release Status Model

Allowed statuses:

- `not_released`
- `held`
- `approved`
- `revoked`
- `blocked`
- `manual_review`

Only `approved` can produce a contractor-facing contact envelope.

## 6. Contact Field Allow-List

Allowed fields:

- `first_name`
- `last_name`
- `phone`
- `email`
- `city`
- `county`

The MVP decision drawer defaults to `first_name`, `phone`, and `email`, but operators may narrow or expand within the allow-list. Quote files, raw report JSON, analysis JSON, attribution IDs, platform config, and secret IDs are not part of this model.

## 7. Internal Operator Queue

The Admin tab `Lead Release` shows:

- assigned opportunities awaiting or carrying release decisions
- masked assignment and contractor account IDs
- contractor display name
- `client_slug`
- assignment status
- release status
- safe project metadata
- warning chips
- allowed fields
- decision action

Filters include release status, client, contractor, assignment status, and needs-attention.

## 8. Release Decision Flow

Operators open a decision drawer and choose:

- approve
- hold
- block
- revoke
- manual review

Every decision requires a reason. Approve persists selected contact fields. Non-approved states clear contact fields in the release row. Every decision also inserts an event into `lead_contact_release_events`.

## 9. Contractor Contact Visibility Rules

The contractor detail panel shows contact only when:

1. The authenticated user resolves to an active contractor account.
2. The assignment belongs to that contractor account.
3. The assignment `client_slug` matches the contractor account context.
4. A release row exists for that exact assignment/contractor/client.
5. `release_status = 'approved'`.
6. The requested contact field is listed in `allowed_contact_fields`.
7. The server RPC returns the allow-listed envelope.

Missing, held, blocked, revoked, and manual-review rows do not show contact details.

## 10. RLS / Server Safety

- `lead_contact_releases` and `lead_contact_release_events` have RLS enabled.
- Anonymous users have no policies.
- Internal operators can select and manage release decisions.
- Contractors can select only their own release rows/events for active accounts.
- Contractors cannot insert, update, or delete release rows.
- The contact RPC is `SECURITY DEFINER`, accepts only an assignment ID, resolves contractor/account/client through `auth.uid()`, and returns only allow-listed fields.

## 11. Audit Trail

`lead_contact_release_events` records each decision with:

- release ID
- assignment ID
- contractor account ID
- client slug
- event type
- decision
- actor ID
- allowed fields
- reason/notes
- audit metadata

Revocation appends an event and preserves prior history.

## 12. No Quote File Exposure

4C does not query storage buckets, generate signed URLs, expose `quote_files`, or render quote file controls in contractor contact release UI.

## 13. No Outcome Submission

4C does not add outcome forms, sold/lost buttons, appointment updates, revenue truth mutation, or contractor outcome submission.

## 14. No Live Dispatch

4C does not call Meta, Google, TikTok, GTM Server, CRM webhooks, dispatch attempts, outbox sends, or provider sender functions.

## 15. Validation Results

Completed:

- Previous sprint audit confirmed 4A/4B services and UI exist.
- Connected DB schema had required Phase 4 tables before 4C.
- Existing release model was absent, so the minimal release model was added.
- `bun run build` passed after 4C UI/service changes.
- `npx tsc --noEmit` passed after 4C service changes.
- No Edge Functions were touched.

Pending runtime fixture proof:

- Two authenticated contractor users.
- Two contractor accounts across clients.
- Assigned opportunities for each contractor.
- Approved, revoked, held, blocked, and missing-release fixture rows.

## 16. Remaining Context Debt

- Generate Supabase types after the migration so `lead_contact_releases`, `lead_contact_release_events`, and `get_contractor_released_contact` are first-class in `types.ts`.
- Run authenticated two-contractor runtime tests with real JWTs.
- Review broad RPC grants across the project before real contractor production exposure.
- Decide whether contact release should later include exact address; 4C intentionally does not include it.

## 17. Handoff To 4D Contractor Outcome Submission Flow

4D is allowed for internal pilot only after fixture tests prove contact release isolation across two contractors and two clients. 4D should consume this release state and must not bypass it.

Verdict: `phase_4d_allowed_for_internal_pilot_only_with_fixture_and_typegen_debt`.
