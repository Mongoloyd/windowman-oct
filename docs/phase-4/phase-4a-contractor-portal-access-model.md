# Phase 4A — Contractor Portal Access Model

## 1. Goal

Create the internal-pilot contractor access foundation that resolves a signed-in contractor user's own account context without exposing homeowner, quote, lead-detail, outcome, or dispatch data.

## 2. North Star

An authenticated contractor can identify only their own contractor account context. Anonymous users, unrelated authenticated users, and other contractors cannot read or infer cross-tenant account data.

## 3. What Was Built

- `src/services/contractorAccess.ts` contractor access service.
- `fetchContractorAccountContext()` resolver using Supabase Auth identity and RLS-scoped `contractor_accounts` reads.
- `ContractorPortalShell` safe internal-pilot shell for `/partner/portal`.
- `ContractorAccountStatus` safe account metadata card.
- Minimal additive account metadata columns: `access_status`, `portal_role`, `last_portal_login_at`.
- Validation smoke-test script for future two-contractor/two-client runtime proofs.

## 4. Contractor Identity Model

Contractor identity is resolved through `contractor_accounts.auth_user_id = auth.uid()`.

The frontend does not pass or trust:

- `contractor_account_id`
- `client_slug`
- role values
- account status values

Those values come from the RLS-scoped database row returned for the currently authenticated user.

## 5. Contractor Account Context Resolver

`fetchContractorAccountContext()`:

1. Calls `supabase.auth.getUser()`.
2. Returns `unauthenticated` if no verified Supabase user exists.
3. Queries `contractor_accounts` through the existing typed Supabase client.
4. Filters by authenticated user identity only.
5. Returns `not_linked` when no account is visible.
6. Normalizes access status and portal role.
7. Masks account IDs before rendering.
8. Adds a `multiple_accounts_manual_review` warning if more than one account is returned.
9. Never throws raw Supabase errors to the UI.

## 6. Access States

Implemented states:

- `loading`
- `allowed`
- `pending`
- `suspended`
- `revoked`
- `not_linked`
- `unauthenticated`
- `error`

`allowed` requires `access_status = 'active'` and `is_active = true`.

## 7. RLS / Policy Posture

Existing policy posture was preserved:

- `contractor_accounts_select_own` allows authenticated contractors to view only rows where `auth_user_id = auth.uid()`.
- Internal operators retain existing internal read/update policies.
- Anonymous users have no contractor account read policy.
- No lead, quote, outcome, assignment, dispatch, provider, or file policies were widened.

4A added columns only; it did not add broad permissions.

## 8. Route / Shell

Added route:

- `/partner/portal`

The route is nested under the existing `PartnerLayout` conventions and does not replace `/partner/login`.

The shell displays:

- account display name
- masked contractor account ID
- client slug
- access status
- portal role
- linked/inactive badge
- safe access-state guidance

## 9. Safe Data Boundary

Returned/displayed safe context fields only:

- contractor account ID, masked for display
- client slug
- display name
- access status
- portal role
- active flag
- created/updated timestamps
- last portal login timestamp
- warnings

Not returned or displayed:

- homeowner phone
- homeowner email
- homeowner name
- quote file URLs
- raw quote files
- lead rows
- outcome rows
- attribution click IDs
- platform configs
- tokens
- vault secret IDs

## 10. Explicit Non-Goals

Deferred from 4A:

- assigned lead list
- assigned lead detail
- homeowner contact reveal
- quote file access
- contractor outcome submission
- performance dashboard
- contractor onboarding automation
- billing changes
- live dispatch
- client-facing reporting

## 11. Runtime Validation Results

Completed:

- Phase 3J artifacts and verdict verified.
- Connected DB object/policy posture inspected for required tables and functions.
- Minimal 4A migration applied successfully.
- Build passed.
- Typecheck passed after local service code used migration-aware runtime parsing.

Type generation debt:

- `bun run typegen:check` could not complete because the sandbox lacks `SUPABASE_ACCESS_TOKEN`, and the environment is missing `diff`.
- Required command once authenticated CLI access is available:

```bash
bun run typegen
```

## 12. Cross-Contractor Isolation Plan

Create isolated fixtures before 4B production-like access:

- `contractor_user_a`
- `contractor_user_b`
- `contractor_account_a` linked to user A
- `contractor_account_b` linked to user B
- separate lead assignment rows for each account

Assertions:

- anon sees no contractor account rows
- user A sees account A only
- user A cannot see account B
- user B sees account B only
- user B cannot see account A

## 13. Cross-Client Isolation Plan

Create isolated fixtures:

- `client_slug_a`
- `client_slug_b`
- contractor account A scoped to client A
- contractor account B scoped to client B

Assertions:

- user A cannot infer client B account data
- user B cannot infer client A account data
- frontend route never accepts `client_slug` as a scoping input

## 14. No PII Exposure Proof

4A code paths query only `contractor_accounts` safe metadata columns.

No 4A file queries:

- `leads`
- `quote_files`
- `analyses.full_json`
- `contractor_outcomes`
- `lead_assignments`
- storage buckets
- provider sender logs

No homeowner names, phone numbers, emails, or quote file URLs are rendered by the 4A portal shell.

## 15. Remaining Context Debt

- Generate Supabase types after CLI auth is available.
- Seed two-contractor/two-client runtime fixtures in an isolated environment.
- Run authenticated cross-contractor and cross-client probes with real test JWTs.
- Complete broad RPC grant review before real contractor production exposure.
- Decide whether invite onboarding should set `access_status = 'invited'` or `active` after operator approval.

## 16. Handoff To 4B Contractor Lead View

4B may proceed for internal pilot only after seeded runtime isolation fixtures exist or are created as part of 4B. The first 4B lead view must remain conservative: assigned opportunity list and redacted lead detail first, with explicit contact-release logic deferred until separately approved.

Verdict: `phase_4b_allowed_for_internal_pilot_only_with_fixture_debt`.
