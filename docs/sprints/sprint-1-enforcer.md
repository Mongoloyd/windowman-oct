# AGENT MODE — Sprint 1 V2 Backend Enforcer: Contact-Owned Upload Contract

## Overview & Requirements

### Mode Targeting

Run this in **AGENT Mode**.

Reason: This is a protected backend enforcement sprint. The goal is to make `start-upload-scan-session` stop creating shell leads on public enforced upload paths. This is backend-only. No frontend refactor is authorized in this sprint.

### Explicit SPRINT APPROVAL

SPRINT APPROVAL: Implement Sprint 1 V2 Backend Enforcer for contact-owned uploads.

Authorized:

- Modify `start-upload-scan-session` request/validation behavior
- Add feature-flagged contact-owned lead enforcement
- Add stable lower_snake_case error codes
- Add service-role-only admin/dev transport bypass
- Add/update Deno tests
- Add/adjust pure helper functions inside allowed files if needed for testability

Not authorized:

- No frontend changes
- No UploadZone changes
- No TruthGateFlow changes
- No Index changes
- No NextdoorQuoteUpload changes
- No capture-truth-gate-lead changes
- No capture-arbitrage-lead changes
- No scan-quote changes
- No send-otp / verify-otp changes
- No report-access changes
- No storage/RLS changes
- No CAPI/dispatch/tracking worker changes
- No migrations
- No generated Supabase types
- No release activity
- No secrets set
- No production touch

### Strategic Context

WindowMan is moving from a qualification-first scanner funnel to a contact-owned upload contract.

Future invariant:

No homeowner-facing upload may create `quote_file` or `scan_session` unless attached to:

- a contact-owned `lead_id`
- a valid `session_id` bound to that lead
- attribution/query_params preserved

Important distinction:

`lead_id` existing ≠ valid contact-owned `lead_id`

A shell lead must not satisfy the new contract.

### Current Problem

Audit-confirmed current behavior:

- UploadZone does not currently pass `lead_id`.
- UploadZone calls `start-upload-scan-session` with `session_id` + storage metadata.
- `start-upload-scan-session` resolves lead by `session_id`.
- If no lead is found, it inserts a new shell lead.
- The shell lead can lack `first_name`, `email`, `phone_e164`, and `zip`.
- The paid `has_quote` shortcut can reveal UploadZone with only a random `sessionId` and no contact-created lead.

Current dangerous path:

```text
paid has_quote
→ random sessionId
→ UploadZone visible
→ start-upload-scan-session
→ no lead found
→ shell lead inserted
→ quote_file + scan_session created under shell lead
```

This sprint must close that backend hole under a server-side feature flag.

### Verified Current File Facts

Use these as repo facts, then verify them locally before editing:

`supabase/functions/start-upload-scan-session/index.ts`

- Handler uses `Deno.serve`.
- Request JSON is parsed before `RequestSchema.safeParse`.
- `RequestSchema.safeParse` currently runs before Supabase env/client setup.
- `jsonResponse` validates every outgoing response against `ResponseSchema`.
- `badRequest` / `serverError` wrap `jsonResponse`.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are read in the handler.
- `createClient` is already imported and used.
- Existing lead resolution calls `admin.rpc("get_lead_by_session", { p_session_id: session_id })`.
- Existing fallback branch inserts into `leads` when no lead is found.
- Existing `quote_file` and `scan_session` creation blocks can be preserved.

`supabase/functions/start-upload-scan-session/contracts/schemas.ts`

- `RequestSchema` is strict.
- `RequestSchema` currently has `session_id`, `storage_path`, file metadata, `client_slug`, `attribution`, `query_params`.
- `RequestSchema` currently does not include `lead_id`.
- `ErrorCode` enum exists and is used by `ResponseSchema`.
- `ResponseSchema` rejects unknown error codes.

`supabase/functions/start-upload-scan-session/contracts/schemas.test.ts`

- Existing pure Deno contract tests exist.
- Existing test `"rejects unknown property via .strict()"` currently uses `lead_id` as the unknown key.
- That test must be updated because `lead_id` becomes a known optional field.

### Current Request Shape

Current request body is approximately:

```ts
{
  session_id: string;
  storage_path: string;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  client_slug?: string | null;
  attribution?: Record<string, unknown> | null;
  query_params?: Record<string, unknown>;
}
```

Add support for:

```ts
lead_id?: string;
```

Future enforced request contract:

```ts
{
  lead_id: string;
  session_id: string;
  storage_path: string;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  client_slug?: string | null;
  attribution?: Record<string, unknown> | null;
  query_params?: Record<string, unknown>;
}
```

But only require `lead_id` when:

```text
ENFORCE_CONTACT_OWNED_UPLOAD === "1"
AND service-role bypass is false
```

### Allowed Files

Edit only:

```text
supabase/functions/start-upload-scan-session/index.ts
supabase/functions/start-upload-scan-session/contracts/schemas.ts
supabase/functions/start-upload-scan-session/contracts/schemas.test.ts
supabase/functions/start-upload-scan-session/index_test.ts
```

If no `index_test.ts` exists, create it only if needed.

Do not edit `schemas_test.ts`; the real existing file is:

```text
supabase/functions/start-upload-scan-session/contracts/schemas.test.ts
```

Do not edit any other file without returning `SAFETY_STOP`.

### Execution Constraints

Do NOT:

- edit frontend
- perform release activity
- run migrations
- modify secrets
- touch production

Scope limited to:

```text
supabase/functions/start-upload-scan-session
```

## Phase 1A: Preflight Inventory

### Phase 1A — Caller / Creator Search

Before editing, run:

```bash
rg -n "start-upload-scan-session|get_lead_by_session|insert\\(.*leads|from\\(['\"]leads['\"]\\)|quote_files|scan_sessions" supabase src -S
```

Summarize findings and classify:

- in-scope
- out-of-scope
- protected / do not touch
- unknown

Do not modify callers in this sprint.

### Required Files to Inspect First

Before editing, inspect:

```text
supabase/functions/start-upload-scan-session/index.ts
supabase/functions/start-upload-scan-session/contracts/schemas.ts
supabase/functions/start-upload-scan-session/contracts/schemas.test.ts
.github/workflows/edge-functions-typecheck.yml
```

Report in the final output:

- existing request parser / schema location
- existing ErrorCode enum location
- existing response envelope helper/pattern
- existing Supabase client/dependency pattern
- existing service-role key usage
- existing lead fallback creation block location
- existing contract test that used `lead_id` as unknown property
- Deno typecheck command used or mirrored from workflow

## Implementation Pattern: The Enforcer Logic

### REQUIRED Implementation Pattern

Use this exact control-flow pattern.

- Keep `RequestSchema` strict.
- Add `lead_id: UUID.optional()` to `RequestSchema`.
- Do not make `lead_id` globally required at parse time.
- Preserve the existing JSON parse → `RequestSchema.safeParse` sequence.
- After successful parse, read env vars and create the Supabase admin client as the function already does.
- Immediately after admin client creation, compute:

```ts
const enforceContactOwnedUpload =
  Deno.env.get("ENFORCE_CONTACT_OWNED_UPLOAD") === "1";

const authorization = req.headers.get("Authorization");

const isServiceRoleBypass =
  Boolean(SERVICE_ROLE) && authorization === `Bearer ${SERVICE_ROLE}`;
```

If `enforceContactOwnedUpload && !isServiceRoleBypass`, run contact-owned lead validation **before any storage probe, `quote_file` insert, `scan_session` insert, or fallback lead insert**.

If `!enforceContactOwnedUpload || isServiceRoleBypass`, run the legacy session lookup/fallback path.

Do not use any other implementation order.

**Why:** removes ambiguity and enforces consistent control flow.

### Critical Implementation Corrections

#### Correction 1 — Do not globally require `lead_id` at raw parse time

Do **not** make `lead_id` unconditionally required in `RequestSchema`.

Required behavior:

```text
ENFORCE_CONTACT_OWNED_UPLOAD !== "1"
→ preserve old behavior, including existing fallback shell-lead creation.

ENFORCE_CONTACT_OWNED_UPLOAD === "1"
→ require and validate lead_id before quote_file / scan_session creation.
→ no public fallback shell-lead creation.
```

Because `RequestSchema` is strict, you must add `lead_id` as an **optional UUID field** so enforced callers can send it without being rejected as `invalid_payload`.

Use this pattern unless local code proves a better equivalent:

```ts
lead_id: UUID.optional()
```

Do not use `.nullish()` for `lead_id` unless you explicitly handle `null` as missing in the enforced validation helper and test it. Prefer `.optional()`.

#### Correction 2 — Error codes must be added before handler use

`jsonResponse` validates outgoing responses against `ResponseSchema`. If the handler returns a code that is not in `ErrorCode`, the response becomes a 500 `"Response contract violation"`.

Therefore, add these codes to `ErrorCode` in `schemas.ts` before or with any handler use:

```text
contact_required_before_upload
session_mismatch_with_lead
```

Use this exact lower_snake_case casing to match existing enum style.

Do not use uppercase error codes.

#### Correction 3 — Feature flag off must preserve legacy behavior

When `ENFORCE_CONTACT_OWNED_UPLOAD` is unset or any value other than `"1"`, the function must behave as it does today.

Specifically:

- `lead_id` is not required.
- existing `session_id` lookup still runs.
- existing fallback shell-lead creation remains allowed.
- existing `quote_file` / `scan_session` behavior is preserved.

#### Correction 4 — Service-role bypass is not adminAuth

A reusable `_shared/adminAuth.ts` helper may exist, but it performs JWT + RBAC admin authorization and is not the correct abstraction here.

Do **not** reuse `validateAdminRequest` or `_shared/adminAuth.ts` for this sprint.

This sprint needs a distinct service-role transport bypass:

```ts
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const authorization = req.headers.get("Authorization");
const isServiceRoleBypass =
  Boolean(serviceRoleKey) && authorization === `Bearer ${serviceRoleKey}`;
```

If the local code already names the service-role variable `SERVICE_ROLE`, use the definitive implementation pattern:

```ts
const authorization = req.headers.get("Authorization");
const isServiceRoleBypass =
  Boolean(SERVICE_ROLE) && authorization === `Bearer ${SERVICE_ROLE}`;
```

Only this exact service-role bearer check may bypass contact-owned upload enforcement.

No request body flag, cookie, query param, attribution flag, or client-side flag may bypass enforcement.

#### Correction 5 — Do not check `lead.status` in Sprint 1

Do not add `lead.status` validation in this sprint.

A contact-owned lead is defined only by:

- lead exists
- `lead.session_id` matches request `session_id`
- `first_name` is non-empty after trim
- `email` is non-empty after trim

Phone and ZIP are intentionally not required in Sprint 1.

#### Correction 6 — Production flag must stay off until Sprint 2

Current live frontend caller UploadZone does not pass `lead_id`.

Therefore:

```text
ENFORCE_CONTACT_OWNED_UPLOAD=1 would reject current public uploads until Sprint 2 ships.
```

This PR must include an explicit rollout note:

```text
Do not enable ENFORCE_CONTACT_OWNED_UPLOAD in production until Sprint 2 Frontend Lead-Gate Refactor is deployed and verified.
```

### Feature Flag

After `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are read and after the Supabase admin client is created, define:

```ts
const enforceContactOwnedUpload =
  Deno.env.get("ENFORCE_CONTACT_OWNED_UPLOAD") === "1";
```

Also define the service-role bypass at the same point:

```ts
const authorization = req.headers.get("Authorization");
const isServiceRoleBypass =
  Boolean(SERVICE_ROLE) && authorization === `Bearer ${SERVICE_ROLE}`;
```

The feature flag and bypass decision should be available before lead resolution begins.

Do not move the feature flag before JSON parsing or `RequestSchema.safeParse`. Instead, make `lead_id` optional in `RequestSchema` so the existing parse sequence remains safe.

Behavior:

If `ENFORCE_CONTACT_OWNED_UPLOAD` is not exactly `"1"`:

- Run legacy behavior.
- Do not require `lead_id`.
- Preserve old fallback lead creation.

If `ENFORCE_CONTACT_OWNED_UPLOAD` is exactly `"1"` and service-role bypass is false:

- Run strict public validation.
- Require `lead_id`.
- Validate lead ownership and contact fields.
- Do not fallback-create shell leads.

If service-role bypass is true:

- Skip new enforcement entirely.
- Run legacy behavior.
- Existing fallback lead creation may run if legacy code would have done so.

### Service-Role Admin / Dev Bypass

Implement a server-side-only bypass.

Bypass is active only if:

```ts
SERVICE_ROLE && req.headers.get("Authorization") === `Bearer ${SERVICE_ROLE}`
```

If bypass is active:

- Skip new contact-owned enforcement entirely.
- Run legacy behavior exactly as before.
- Existing fallback lead creation may run if legacy code would have done so.
- This is intended only for admin/dev/server-side tools.

Add a clear structured log when bypass is active:

```ts
console.log(JSON.stringify({
  admin_bypass: true,
  timestamp: new Date().toISOString(),
  lead_id: body.lead_id ?? null,
  session_id: body.session_id ?? null,
}));
```

Use the parsed request body variable name that exists locally. If `body` is not the local name, adapt exactly.

Do not log:

- service role key
- email
- phone
- first_name
- ZIP
- storage_path
- full attribution payload
- full query params

Forbidden bypasses:

- No client flag
- No cookie
- No query param
- No request body `allow_shell` flag
- No request body `admin_bypass` flag
- No attribution flag

Only exact service-role bearer authorization may bypass.

### Enforced Public Validation Logic

When:

```text
ENFORCE_CONTACT_OWNED_UPLOAD === "1"
AND service-role bypass is false
```

perform validation before any `quote_files` or `scan_sessions` insert.

Do not perform storage, `quote_file`, `scan_session`, or fallback lead insert as a substitute for this validation.

In enforced public mode, contact-owned lead validation must run before:

- storage existence probing
- any DB insert
- any `quote_file` lookup reuse

In legacy flag-off mode and service-role bypass mode, preserve the existing ordering as much as practical.

#### Step 1 — Require `lead_id`

If `lead_id` is missing, empty, invalid UUID, or not accepted by the optional UUID schema, return HTTP 400 with:

```json
{
  "success": false,
  "code": "contact_required_before_upload",
  "message": "Contact is required before upload."
}
```

Use the existing response envelope.

#### Step 2 — Fetch lead by `lead_id`

Use the existing Supabase admin client.

Query `public.leads` by:

```text
id = lead_id
```

Select only:

```text
id
session_id
first_name
email
```

Do not fetch phone or ZIP in Sprint 1 unless local code requires it for typing; do not validate them.

#### Step 3 — Verify lead exists

If no lead is found, return HTTP 400 with:

```json
{
  "success": false,
  "code": "contact_required_before_upload",
  "message": "Contact is required before upload."
}
```

If the database query errors unexpectedly, preserve existing 500-style behavior using existing `serverError` / `unexpected_error` conventions unless there is already a more appropriate helper.

#### Step 4 — Verify contact-owned fields

For this sprint, a contact-owned lead means:

```ts
String(lead.first_name ?? "").trim().length > 0
AND
String(lead.email ?? "").trim().length > 0
```

Whitespace-only values are invalid.

If invalid, return HTTP 400 with:

```json
{
  "success": false,
  "code": "contact_required_before_upload",
  "message": "Contact is required before upload."
}
```

Do not validate `lead.status`.

Do not require `phone_e164`.

Do not require `zip`.

#### Step 5 — Verify session ownership

Compare:

```ts
lead.session_id === body.session_id
```

If mismatch, return HTTP 400 with:

```json
{
  "success": false,
  "code": "session_mismatch_with_lead",
  "message": "Upload session does not match the lead."
}
```

#### Step 6 — Use this lead only

After validation passes:

- Use the fetched lead id as the authoritative `lead_id`.
- Do not call `get_lead_by_session` as the authority in enforced mode.
- Do not insert a new lead in enforced mode.
- Continue existing `quote_file` creation.
- Continue existing `scan_session` creation.
- Ensure `quote_files.lead_id = validated lead_id`.
- Ensure `scan_sessions.lead_id = validated lead_id`.

If existing code expects a `lead_id` variable, assign it from the validated lead.

Do not construct a broad synthetic lead object unless required. Keep the change minimal.

## Guardrails

### Existing Quote File Ownership Rule

In enforced public mode, the validated `lead_id` remains authoritative.

The existing `quote_files` lookup may find a row by `storage_path`. If that row has `lead_id` and it differs from the validated `lead_id`, do NOT overwrite the validated `lead_id`.

Return HTTP 400:

```json
{
  "success": false,
  "code": "session_mismatch_with_lead",
  "message": "Upload session does not match the lead."
}
```

Required behavior:

- Flag OFF → preserve legacy overwrite behavior
- Service-role bypass → preserve legacy behavior
- Flag ON (public) → never allow existing `quote_file.lead_id` override

### Fallback Shell-Lead Creation Rule

Locate the existing block in:

```text
supabase/functions/start-upload-scan-session/index.ts
```

that inserts into `leads` when no lead is found by `get_lead_by_session`.

Required behavior:

Flag off:

- block may run exactly as before.

Service-role bypass:

- block may run exactly as before.

Flag on, public request:

- block must never run.
- no shell lead may be inserted.

Preferred implementation:

- Split lead resolution into a small, explicit branch:
  - enforced public path: validate `lead_id` → set `lead_id` → skip legacy session lookup/fallback.
  - legacy/bypass path: run existing `get_lead_by_session` / fallback logic unchanged.

Avoid an unclear one-line patch if it makes control flow ambiguous.

Do not leave any enforced public path where `lead_id` remains null and fallback insert can execute.

### Error Codes

In:

```text
supabase/functions/start-upload-scan-session/contracts/schemas.ts
```

add these exact lower_snake_case literals to `ErrorCode`:

```text
contact_required_before_upload
session_mismatch_with_lead
```

Then update:

```text
supabase/functions/start-upload-scan-session/contracts/schemas.test.ts
```

so `"ResponseSchema accepts each known error code"` includes both new codes.

Do not create a second enum.

Do not use uppercase versions.

### Attribution Logging

MUST remain:

```ts
client_source: body.attribution?.utm_source ?? null
```

Do not use `source`.

### Structured Logging for Rejected Public Uploads

Whenever an enforced public request is rejected for:

```text
contact_required_before_upload
session_mismatch_with_lead
```

log one structured JSON object:

```ts
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  error_code,
  session_id: body.session_id ?? null,
  lead_id: body.lead_id ?? null,
  client_source: body.attribution?.utm_source ?? null,
}));
```

Use the actual parsed body variable name.

`AttributionPayloadSchema` does not have a bare `source` key. Use `utm_source` if available; otherwise null.

Do not log:

- `first_name`
- `email`
- `phone`
- `zip`
- `storage_path`
- service role key
- full attribution payload
- full query params

### Response Contract

Follow existing response envelope patterns.

Existing response shape is:

```ts
{ success: false, code, message, details? }
```

Required HTTP statuses:

```text
Missing/invalid lead_id: 400
Lead not found: 400
Missing first_name/email: 400
Session mismatch: 400
Unexpected database error: preserve existing 500 behavior
```

Stable codes:

```text
contact_required_before_upload
session_mismatch_with_lead
```

### Helper Extraction for Testability

The existing handler is monolithic. If necessary, extract narrow pure/internal helpers in allowed files only.

Acceptable helpers:

```ts
isServiceRoleBypass(...)
hasContactOwnedFields(...)
buildRejectedUploadLogPayload(...)
validateContactOwnedUploadLead(...)
```

If helpers need a DB dependency, pass a tiny interface/stub rather than requiring a live Supabase client.

Do not move shared helpers to `_shared`.

Do not create new directories.

Do not add new dependencies.

## Testing & Typecheck Requirements

### Testing Requirements

Use Deno tests.

Existing test file:

```text
supabase/functions/start-upload-scan-session/contracts/schemas.test.ts
```

Add or create:

```text
supabase/functions/start-upload-scan-session/index_test.ts
```

only if needed for helper/handler validation.

Do not require a live database.

Mock Supabase database calls with simple stubs if testing helper behavior.

Priority:

- Contract tests required
- Helper/enforcement tests required
- Handler tests if feasible
- Do NOT refactor handler just for testing
- If handler tests skipped → document limitation

Required test coverage:

#### Test 1 — RequestSchema accepts optional valid `lead_id`

Input:

```text
valid minimal body + lead_id as valid UUID
```

Expected:

```text
RequestSchema.safeParse succeeds
```

#### Test 2 — RequestSchema rejects invalid `lead_id`

Input:

```text
valid minimal body + lead_id = "not-a-uuid"
```

Expected:

```text
RequestSchema.safeParse fails on lead_id
```

#### Test 3 — strict unknown property remains strict

Input:

```text
valid minimal body + bogus_field = "nope"
```

Expected:

```text
RequestSchema.safeParse fails because bogus_field is unknown
```

#### Test 4 — ResponseSchema accepts new error codes

Input:

```text
contact_required_before_upload
session_mismatch_with_lead
```

Expected:

```text
ResponseSchema.safeParse succeeds for both codes
```

#### Test 5 — enforced mode rejects missing `lead_id`

Input:

```text
ENFORCE_CONTACT_OWNED_UPLOAD = "1"
no service-role Authorization
body has session_id + storage_path but no lead_id
```

Expected:

```text
HTTP/helper result 400
code = contact_required_before_upload
no quote_file insert
no scan_session insert
no lead insert
```

If testing full HTTP handler is impractical, test the extracted enforcement helper and state this clearly.

#### Test 6 — enforced mode rejects nonexistent lead

Input:

```text
lead_id provided
Supabase lead lookup returns no rows
```

Expected:

```text
400 or helper rejection
code = contact_required_before_upload
```

#### Test 7 — enforced mode rejects missing contact fields

Input:

```text
lead exists
session_id matches
first_name missing, null, empty, or whitespace-only
OR email missing, null, empty, or whitespace-only
```

Expected:

```text
400 or helper rejection
code = contact_required_before_upload
```

#### Test 8 — enforced mode rejects session mismatch

Input:

```text
lead_id exists
lead.session_id !== body.session_id
first_name and email present
```

Expected:

```text
400 or helper rejection
code = session_mismatch_with_lead
```

#### Test 9 — enforced mode accepts valid contact-owned lead

Input:

```text
lead_id exists
lead.session_id === body.session_id
first_name present after trim
email present after trim
storage_path valid
```

Expected:

```text
enforcement helper succeeds
validated lead_id is returned/used
```

If full handler is testable with stubs, additionally verify:

```text
quote_file insert uses validated lead_id
scan_session insert uses validated lead_id
no fallback lead insert occurs
```

If not full-handler testable, report helper-level coverage and explain what remains manual/staging-only.

#### Test 10 — feature flag off preserves legacy behavior

Input:

```text
ENFORCE_CONTACT_OWNED_UPLOAD unset or not "1"
body lacks lead_id
```

Expected:

```text
enforcement helper does not require lead_id
legacy path remains selected
```

Do not require a live DB.

#### Test 11 — service-role admin bypass preserves legacy behavior

Input:

```text
ENFORCE_CONTACT_OWNED_UPLOAD = "1"
Authorization = Bearer ${SUPABASE_SERVICE_ROLE_KEY}
body lacks lead_id
```

Expected:

```text
enforcement is skipped
legacy path remains selected
admin_bypass log payload can be produced without secret exposure
```

#### Test 12 — no client bypass

Input:

```text
ENFORCE_CONTACT_OWNED_UPLOAD = "1"
body contains allow_shell / admin_bypass / dev flag
no service-role Authorization
```

Expected:

```text
enforcement still runs
missing lead_id rejected with contact_required_before_upload
```

### Request Schema Test Updates

Update the existing contract tests.

Required changes:

1. Add a test that `RequestSchema` accepts a valid optional `lead_id` UUID.
2. Add a test that `RequestSchema` rejects an invalid `lead_id`.
3. Update the existing `"rejects unknown property via .strict()"` test so it uses a truly unknown field such as `bogus_field` instead of `lead_id`.
4. Keep the legacy minimal body parse test passing to prove flag-off callers are not broken.

Do not remove strictness. `RequestSchema` should remain `.strict()`.

### Commands to Run

Run narrow Deno tests:

```bash
deno test supabase/functions/start-upload-scan-session/
```

Run Deno typecheck for touched Edge Function files:

```bash
deno check supabase/functions/start-upload-scan-session/index.ts
deno check supabase/functions/start-upload-scan-session/contracts/schemas.ts
deno check supabase/functions/start-upload-scan-session/contracts/schemas.test.ts
```

If you create `index_test.ts`, also run:

```bash
deno check supabase/functions/start-upload-scan-session/index_test.ts
```

Also report that CI typechecks every Edge Function file under `supabase/functions` per:

```text
.github/workflows/edge-functions-typecheck.yml
```

Do not force full repo Deno check unless safe.

Do not use `npm run build` as the main backend verification. This is a Deno Edge Function sprint. You may run `npm run build` only if you need an extra repo sanity check, but it is not a substitute for `deno check`.

Run grep sanity:

```bash
rg -n "contact_required_before_upload|session_mismatch_with_lead|ENFORCE_CONTACT_OWNED_UPLOAD|SUPABASE_SERVICE_ROLE_KEY|admin_bypass|insert\\(.*leads|from\\(['\"]leads['\"]\\)|get_lead_by_session|lead_id" supabase/functions/start-upload-scan-session
```

Do not run:

```text
supabase secrets set
supabase db push
supabase migration up
supabase gen types
```

## Local Logic Verification

After implementation, verify local backend logic only.

Required local verification commands:

```bash
deno test supabase/functions/start-upload-scan-session/
```

```bash
deno check supabase/functions/start-upload-scan-session/index.ts
deno check supabase/functions/start-upload-scan-session/contracts/schemas.ts
deno check supabase/functions/start-upload-scan-session/contracts/schemas.test.ts
```

If `index_test.ts` exists, also run:

```bash
deno check supabase/functions/start-upload-scan-session/index_test.ts
```

Verification requirements:

- `deno test supabase/functions/start-upload-scan-session/` must pass.
- `deno check` must pass for all touched Edge Function files.
- No live database access is required for tests.
- No frontend build is required for this backend sprint.
- No release activity is authorized by this document.
- No production environment access is authorized by this document.
- No secrets may be inspected, printed, modified, or set.
- No migrations may be generated or run.
- No storage/RLS changes may be made.

## Rollout & Safety Safeguards

### Rollout Safety

Human requirement:

- Do NOT enable flag in production yet
- Confirm Sprint 2 frontend deployed first
- Cursor must NOT inspect or modify secrets

### Manual Staging Verification Plan to Include in PR Description

Include this plan. Do not execute it in this sprint.

Manual staging plan:

1. After the updated `start-upload-scan-session` function is available in staging through an authorized release process outside this document, leave `ENFORCE_CONTACT_OWNED_UPLOAD` off and confirm current upload behavior is unchanged.
2. Set `ENFORCE_CONTACT_OWNED_UPLOAD=1` in staging only.
3. Use `capture-truth-gate-lead` to create a lead with `first_name` + `email` and capture its `lead_id` + `session_id`.
4. Upload a quote using `start-upload-scan-session` with that `lead_id` + `session_id`.
5. Confirm `quote_files.lead_id = lead_id`.
6. Confirm `scan_sessions.lead_id = lead_id`.
7. Confirm `scan_sessions.quote_file_id = quote_files.id`.
8. Confirm `wm_event_log quote_uploaded`, if emitted in this flow, references the same `lead_id` / `scan_session_id`.
9. Simulate paid `has_quote` / bare-session upload with no `lead_id`.
10. Confirm HTTP 400 `contact_required_before_upload`.
11. Confirm no second shell lead was created for that `session_id`.

### PR Description Requirements

At the end of implementation, return a PR-style description with:

```text
Title:
Summary:
Files changed:
Behavior with ENFORCE_CONTACT_OWNED_UPLOAD off:
Behavior with ENFORCE_CONTACT_OWNED_UPLOAD on:
Service-role bypass:
Error codes:
Tests:
Deno typecheck:
Manual staging plan:
Rollout note:
Next-step recommendation:
```

#### Rollout Note

Include this paragraph:

```text
Rollout note: ENFORCE_CONTACT_OWNED_UPLOAD defaults to off because unset or any value other than "1" preserves the legacy start-upload-scan-session behavior. After this PR is released through the normal approved process, staging can enable ENFORCE_CONTACT_OWNED_UPLOAD=1 for golden-thread verification using manual lead_id requests. Production must remain off until Sprint 2 Frontend Lead-Gate Refactor is deployed and verified, because the current UploadZone caller does not send lead_id. No database migrations are required.
```

#### Next-Step Recommendation

Include this paragraph:

```text
After this backend enforcer is released and verified in staging, the next recommended sprint is Sprint 2 – Frontend Lead-Gate Refactor. It will give UploadZone a required leadId prop, make the identity gate the first step for all CTAs, and remove the old four-question scanner. This order is safe because the backend can reject any upload without a contact-owned lead when ENFORCE_CONTACT_OWNED_UPLOAD=1.
```

### Final Cursor Wrapper

Use exactly:

```text
# AGENT MODE — Execute Sprint 1 V2 Backend Enforcer

Use @docs/sprints/sprint-1-enforcer.md as source of truth.
Perform preflight, including rg search.
If any instruction conflicts with repo → return SAFETY_STOP with file/line.
Do not edit frontend.
Do not perform release activity.
Do not run migrations.
Do not set secrets.
Do not touch production.
Implement only:
supabase/functions/start-upload-scan-session
Return final checklist exactly as defined.
```

### Final Output Required

Return exactly:

```text
Sprint 1 V2 Backend Enforcer verdict: PASS / PARTIAL / BLOCKED / SAFETY_STOP

Preflight:
- Existing request parser / schema location:
- Existing ErrorCode enum location:
- Existing response envelope helper/pattern:
- Existing Supabase client/dependency pattern:
- Existing service-role key usage:
- Existing lead fallback creation block location:
- Existing strictness test updated:
- Deno typecheck command used:

Implementation:
- Feature flag added:
- Raw request schema preserves flag-off legacy behavior:
- RequestSchema accepts optional valid lead_id:
- RequestSchema rejects invalid lead_id:
- Enforced path requires lead_id:
- Enforced path fetches lead by lead_id:
- Enforced path validates trimmed first_name + email:
- Enforced path does not validate lead.status:
- Enforced path does not require phone/ZIP:
- Enforced path validates session_id ownership:
- Public fallback shell-lead creation blocked when flag on:
- Feature flag off preserves legacy behavior:
- Service-role bypass implemented:
- adminAuth helper reused:
- Client-side bypass impossible:
- Structured rejection logging added:
- Error codes added in lower_snake_case:

Files changed:
-

Tests:
- Deno tests:
- Deno typecheck:
- npm run build, if run:
- grep sanity:

Behavior:
- ENFORCE_CONTACT_OWNED_UPLOAD off:
- ENFORCE_CONTACT_OWNED_UPLOAD on:
- Service-role Authorization header:

PR description:
-

Local Logic Verification:
- deno test:
- deno check:
- index_test.ts typecheck, if applicable:

Safety:
- Frontend changed:
- Other Edge Functions changed:
- Migrations changed:
- Storage/RLS changed:
- OTP/report-access changed:
- Tracking/dispatch changed:
- Production touched:
- Release activity performed:
- Secrets changed:

Next recommended action:

Note: For adminAuth helper reused, expected answer should be no — intentionally not reused; standalone service-role bearer compare used.
```

### Safety Stop Criteria

Stop immediately and return `SAFETY_STOP` if:

- Any frontend change is required to complete this backend sprint.
- The feature flag cannot preserve legacy behavior while off.
- Adding optional `lead_id` to `RequestSchema` cannot be done without breaking strict schema behavior.
- The `ErrorCode` enum cannot be extended with lower_snake_case codes without broader response refactor.
- The service-role bypass cannot be made server-only via exact `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`.
- The implementation requires reusing `_shared/adminAuth.ts` / `validateAdminRequest`.
- The function cannot be tested without live database access and narrow helper extraction is not practical.
- The implementation would touch `scan-quote`, OTP, `report-access`, storage/RLS, dispatch, migrations, generated types, or frontend.
- Required columns `first_name`, `email`, or `session_id` do not exist on `leads`.
- Existing response envelope cannot support stable error codes without broader refactor.
- Any production release activity, secret change, or DB mutation is required.

Use:

```text
SAFETY STOP

Phase:
Reason:
Evidence:
Recommended next action:
```

### Exit Checklist

Confirm:

```text
Only allowed backend files changed.
No frontend code changed.
No release activity performed.
No migration run.
No secrets read or changed.
No production touched.
No OTP/report-access/scanner scoring changed.
No storage/RLS changed.
No tracking/dispatch changed.
Feature flag off preserves legacy behavior.
Feature flag on blocks public shell-lead creation.
Production flag must stay off until Sprint 2 ships.
```

### Final Status

This document is now:

- Control-flow locked ✅
- Storage-before-validation ambiguity removed ✅
- `quote_file` overwrite loophole sealed ✅
- Caller dependency awareness added ✅
- Production safety enforced ✅
- Repository documentation safe ✅

This is now safe as **authoritative Cursor spec (100% ready)**.
