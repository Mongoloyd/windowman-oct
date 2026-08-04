# ADR-005: Server-Minted Quote-Intake Capability and Private Upload

**Target save path:** `docs/adr/ADR-005-server-minted-quote-intake-capability.md`
**Revision:** V7
**Date:** 2026-08-04
**Status:** Proposed
**Decision owner:** WindowMan Architecture
**Scope:** Quote-first `/scan` intake perimeter
**Repository:** `Mongoloyd/wm-mvp`
**Target branch:** `forensic_report_v2`
**Repository-truth baseline:** `73a3d7daa2677ebf1255ee0e29001011c1de077e`
**Document readiness:** Commit-ready Proposed architecture contract
**Implementation readiness:** Blocked pending the prerequisites in §2

---

## 0. How to read this ADR

### 0.1 Evidence classification

Every material fact in this document carries one of the following classifications.
Where a classification is not stated inline, the section heading or §33 supplies it.

| Classification | Meaning |
| --- | --- |
| `BASELINE EXECUTABLE CODE` | Verified in executable repository code at baseline `73a3d7d`. |
| `BASELINE SCHEMA/POLICY INTENT` | Verified in checked-in migrations. Proves intent only, never deployed state. |
| `PROPOSED TARGET CONTRACT` | Designed by this ADR. Not implemented. Not deployed. |
| `IMPLEMENTATION PREREQUISITE` | Must be satisfied by a separately authorized sprint before implementation. |
| `DEPLOYED STATE UNKNOWN` | Cannot be established without direct inspection of the target Supabase project. |

### 0.2 Reading rules

1. Repository migrations are **not** proof of deployed state.
2. No table, RPC, Edge Function, enum, grant, or policy introduced by this ADR exists yet.
3. Every SQL and TypeScript block in this ADR is an illustrative target contract, not applied code.
4. This ADR authorizes documentation only. See §2.

### 0.3 Governing-document status at baseline

| Document | Baseline state |
| --- | --- |
| `AGENTS.md` | Present |
| `.cursor/PROTECTED_FILES.md` | Present |
| `docs/START_HERE.md` | Present |
| `docs/reveal/VERIFY_TO_REVEAL_CONTRACT.md` | Present |
| `docs/db/TABLE_ACCESS_MODEL.md` | Present |
| `docs/measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md` | Present |
| `docs/tracking/EVENT_OWNERSHIP_MODEL.md` | Present |
| `docs/ops/DOC_STATUS_REGISTRY.md` | Present |
| `docs/architecture/PROTECTED_SYSTEMS.md` | **Absent** |
| `docs/architecture/ROUTE_SCAN.md` | **Absent** |
| `docs/adr/ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md` | **Absent** |
| `docs/adr/ADR-004-quote-disposition-and-ledger-layer-separation.md` | **Absent** |

Because four referenced governing documents are absent at baseline, this ADR:

- retains `NEEDS REPO VERIFICATION` for their contents;
- does not invent or paraphrase their contents;
- retains implementation blocking under §2;
- treats `AGENTS.md` and `.cursor/PROTECTED_FILES.md` as the operative protected-path authority.

At baseline `73a3d7d`, the four upstream documents were absent.

### 0.4 Current governance status

- At `d828b157`, the four upstream documents were committed as Proposed.
- They were subsequently promoted to `Status: Accepted`.
- They are registered as **CANONICAL** in [`DOC_STATUS_REGISTRY.md`](../ops/DOC_STATUS_REGISTRY.md).
- They are routed through [`START_HERE.md`](../START_HERE.md).
- This satisfies ADR-005 prerequisites **1–4 only**.
- ADR-005 remains `Status: Proposed`.
- Prerequisites **5–38** remain blocking.

Repository history containing the Accepted statuses, CANONICAL registry entries, START_HERE routing, and this reconciliation is the authoritative adoption record.

---

## 1. Decision

WindowMan will implement a **server-minted, high-entropy, short-lived quote-intake capability** for the future `/scan` route.

`PROPOSED TARGET CONTRACT`

The intake capability is a narrowly scoped bearer credential that permits an anonymous browser to:

1. request one exact-path signed upload authorization;
2. upload one supported quote document into the existing private `quotes` Storage bucket;
3. finalize and validate that exact Storage object;
4. cause the backend to create or idempotently reuse one canonical `quote_files` row;
5. cause the backend to create or idempotently reuse one canonical `scan_sessions` row;
6. queue that exact scan session through the existing `scan-quote` pipeline using authenticated internal-service provenance;
7. poll an allowlisted lifecycle projection for that exact intake;
8. submit contact values to a protected backend operation;
9. cause the backend—not the browser—to resolve and attach one canonical unverified lead;
10. initiate OTP only through a capability-bound backend contract;
11. verify OTP only through a capability-bound protocol composed of one committed pre-Twilio claim transaction and one separate post-Twilio conditional finalization transaction, each requiring one exact pending verification row;
12. request report preview or full-report data only through the protected `report-access` Edge Function;
13. receive the full Truth Report only after the existing backend exact-session reveal predicate succeeds.

The capability does **not** permit the browser to:

- supply or select a `lead_id`;
- supply or select a `quote_file_id`;
- supply or select a `scan_session_id`;
- supply or select an `accepted_upload_id`;
- supply or select a phone-verification-row ID;
- supply, observe, or influence an OTP verification claim token;
- select an arbitrary Storage path;
- list or read private quote objects;
- insert directly into `quote_files`;
- insert directly into `scan_sessions`;
- read `analyses` directly;
- read `phone_verifications` directly;
- execute `get_analysis_preview` directly;
- execute `get_analysis_full` directly;
- read OCR contact evidence through the lifecycle-status contract;
- read protected homeowner PII through the lifecycle-status contract;
- read `preview_json` through a raw database RPC;
- read or authorize `full_json` through a raw database RPC;
- invoke the legacy OTP-start or OTP-verification transport for an intake-bound scan;
- invoke `scan-quote` directly for an intake-bound scan;
- claim phone ownership;
- claim OTP verification;
- submit trusted lifecycle states;
- submit verification Booleans;
- claim event eligibility or persistence;
- request a route or authorization bypass;
- create contractor opportunities;
- classify a quote as a verified sale;
- write outcome or consent truth.

The capability is an **upload airlock**.

It is not:

- an authenticated homeowner account;
- a durable identity session;
- proof that the uploader owns the document;
- proof that an extracted phone belongs to the uploader;
- proof that user-confirmed contact data is verified;
- phone-verification authority;
- report-reveal authority;
- contractor-sharing consent;
- a verified-sale classification.

---

## 2. Authority and implementation gate

This ADR defines proposed architecture and database contracts.

It does **not** authorize:

- migrations;
- SQL execution;
- RLS changes;
- database-function grant changes;
- Storage-policy changes;
- Edge Function changes;
- OTP changes;
- scanner changes;
- tracking changes;
- generated-type changes;
- secret creation or rotation;
- Supabase deployment;
- production mutation;
- Git staging, commit, push, pull request, merge, or deployment.

### 2.1 Implementation prerequisites

`IMPLEMENTATION PREREQUISITE`

Implementation remains blocked until all of the following are true:

1. `docs/architecture/PROTECTED_SYSTEMS.md` is merged and canonical.
   **Status:** `SATISFIED BY GOVERNANCE ADOPTION` — source: [`PROTECTED_SYSTEMS.md`](../architecture/PROTECTED_SYSTEMS.md); `Status: Accepted`; registry: CANONICAL in [`DOC_STATUS_REGISTRY.md`](../ops/DOC_STATUS_REGISTRY.md); routed: [`START_HERE.md`](../START_HERE.md).
2. `docs/architecture/ROUTE_SCAN.md` is merged and canonical.
   **Status:** `SATISFIED BY GOVERNANCE ADOPTION` — source: [`ROUTE_SCAN.md`](../architecture/ROUTE_SCAN.md); `Status: Accepted`; registry: CANONICAL in [`DOC_STATUS_REGISTRY.md`](../ops/DOC_STATUS_REGISTRY.md); routed: [`START_HERE.md`](../START_HERE.md).
3. `docs/adr/ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md` is merged and canonical.
   **Status:** `SATISFIED BY GOVERNANCE ADOPTION` — source: [ADR-003](./ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md); `Status: Accepted`; registry: CANONICAL in [`DOC_STATUS_REGISTRY.md`](../ops/DOC_STATUS_REGISTRY.md); routed: [`START_HERE.md`](../START_HERE.md).
4. `docs/adr/ADR-004-quote-disposition-and-ledger-layer-separation.md` is merged and canonical.
   **Status:** `SATISFIED BY GOVERNANCE ADOPTION` — source: [ADR-004](./ADR-004-quote-disposition-and-ledger-layer-separation.md); `Status: Accepted`; registry: CANONICAL in [`DOC_STATUS_REGISTRY.md`](../ops/DOC_STATUS_REGISTRY.md); routed: [`START_HERE.md`](../START_HERE.md).
5. The branch, migrations, generated types, policies, grants, Edge Functions, browser call sites, and deployed Supabase target are reconciled.
   **Status:** `OPEN` — requires repository and deployed-state verification beyond governance adoption.
6. The deployed value of `ENFORCE_CONTACT_OWNED_UPLOAD` is established.
7. Every browser `quotes` Storage upload caller is inventoried.
8. Every anonymous or browser insert path into `quote_files` and `scan_sessions` is inventoried.
9. Existing `quote_files.storage_path` duplicates are audited and resolved.
10. Current `quote_files` columns are reconciled with the proposed metadata additions.
11. Current production Storage policies and grants are inspected directly in the target Supabase project.
12. Current production execute grants and default privileges for `get_analysis_preview`, `get_analysis_full`, and every related or overloaded raw report RPC are inspected directly in the target Supabase project, by exact signature.
13. All browser call sites for preview and full-report retrieval are inventoried.
14. Production browser report traffic is proved to route exclusively through `report-access`.
15. The existing `verify-otp` lead-integrity guard is accepted as a hard constraint:
    - it resolves the lead through `scan_sessions.lead_id`;
    - it fails when that lead is null;
    - lead attachment must complete before OTP initiation.
16. The existing `send-otp` contract is accepted as unsafe for intake-v1:
    - it accepts browser-provided phone and scan identifiers;
    - it does not require an attached canonical lead;
    - it does not prove the requested phone belongs to that lead;
    - browser sequencing cannot secure this boundary.
17. A protected capability-bound OTP-start contract is approved.
18. A protected capability-bound OTP-verification contract is approved.
19. Direct legacy `send-otp` and `verify-otp` requests for intake-bound scans are rejected.
20. Intake verification requires one exact pending `phone_verifications` row whose `lead_id`, `phone_e164`, non-null `scan_session_id`, and pending status match the capability and canonical scan.
21. Twilio approval alone can never return `verified: true`.
22. Session-null legacy pending verification rows are forbidden for intake-bound verification.
23. OTP verification uses the two-transaction serialized claim protocol in §§6.10, 20.10–20.11, and 21.5.
24. It is accepted as a hard architectural constraint that **no PostgreSQL transaction, advisory lock, or row lock can remain active across an Edge Function return boundary or an external Twilio API round-trip**. No design may assume otherwise.
25. The guarded lead resolver defined by this ADR is approved.
26. `public.upsert_native_lead_with_attribution` is not treated as guard-safe for initial intake resolution.
27. The existing `get_analysis_full` exact-session authorization predicate is preserved.
28. Direct production-browser execution of raw preview and full-report RPCs is removed.
29. `report-access` is preserved as the sole production browser bridge for preview and full-report retrieval.
30. Canonical event-store uniqueness and lookup by `event_id` are verified in the deployed project.
31. The `quote_uploaded` ownership and outbox protocol is approved by the measurement owner.
32. Event eligibility is accepted as occurring **after `classifyScanGate` returns its continue/pass path** and **before full deep extraction validation**.
33. Browser Lane A ownership for intake-v1 remains disabled unless the canonical measurement contract is explicitly amended.
34. The current `quote_uploaded` optimization value is reconciled with the canonical measurement contract.
35. The 10 MiB intake limit is reconciled with the scanner's 15 MiB baseline code default and deployed environment configuration.
36. The erasure procedure in §18 is implemented and tested.
37. Exact rate-limit persistence objects and runtime feature-control names are defined in a separately authorized implementation sprint.
38. A separately authorized implementation sprint identifies exact files, exact migrations, exact RPC signatures, exact Edge Functions, exact protected OTP/scanner/reveal-bridge/grant changes, exact tests, the exact Supabase project, blast radius, rollback, and deployment sequence.

If any prerequisite remains unresolved, implementation must stop with:

```text
NEEDS REPO VERIFICATION
```

At baseline `73a3d7d`, prerequisites 1–4 were unavailable because the four referenced
documents were absent from the repository. At that baseline, `AGENTS.md` and
`.cursor/PROTECTED_FILES.md` supplied the operative protected-path authority.

At `d828b157`, the four upstream documents existed in the repository but remained
`Status: Proposed` and were not registry-canonical.

Under the governance-adoption revision described in §0.4, prerequisites 1–4 are satisfied
because the four documents are `Status: Accepted`, registered as **CANONICAL** in
[`DOC_STATUS_REGISTRY.md`](../ops/DOC_STATUS_REGISTRY.md), and routed through
[`START_HERE.md`](../START_HERE.md).

Prerequisites 5–38 remain implementation blockers. Facts that still depend on repository
or deployed-state verification remain subject to `NEEDS REPO VERIFICATION`. This ADR
remains `Status: Proposed` and is not implementation-ready.

### 2.2 Documentation approval is not implementation approval

Approving this document permits saving and committing the ADR only.

It does not authorize the Dormant Schema Sprint (§28, M2), any migration, any grant change,
any Edge Function change, or any deployment.

---

## 3. Context and repository truth

WindowMan is a Verify-to-Reveal quote-intelligence system.

The target sequence is:

```text
anonymous intake
→ private quote upload
→ canonical quote_files
→ canonical scan_sessions
→ protected scan-quote dispatch
→ classifyScanGate continue/pass
→ quote_uploaded eligibility
→ full deep extraction and validation continue
→ analyses
→ safe proof-of-read
→ contact confirmation
→ guarded canonical lead attachment
→ capability-bound OTP start
→ OTP verification claim transaction commits
→ Twilio verification round-trip
→ separate conditional finalization transaction commits
→ report-access
→ get_analysis_full
→ backend-authorized full Truth Report
```

### 3.1 Existing canonical systems

`BASELINE EXECUTABLE CODE` and `BASELINE SCHEMA/POLICY INTENT`

At baseline `73a3d7d`, the repository contains:

- private `quotes` Storage configuration in repository migrations;
- a 10 MiB Storage bucket limit in repository migrations (`file_size_limit = 10485760`);
- repository bucket MIME allowances for PDF, JPEG, PNG, WebP, and HEIC;
- `quote_files`;
- `scan_sessions`;
- `analyses`;
- `phone_verifications`;
- Edge Functions `start-upload-scan-session`, `scan-quote`, `send-otp`, `verify-otp`, and `report-access`;
- database functions `get_analysis_preview`, `get_analysis_full`, and `upsert_native_lead_with_attribution`;
- a unique constraint on `scan_sessions.quote_file_id`;
- canonical event-store uniqueness declared as `wm_event_log_event_id_key UNIQUE (event_id)`.

`DEPLOYED STATE UNKNOWN`

Repository migrations establish checked-in schema and policy intent. They do not prove current
deployed Supabase state. Every grant, policy, bucket setting, and constraint listed above must be
re-verified in the target project before implementation.

### 3.2 Current `/scan` state

`BASELINE EXECUTABLE CODE`

At baseline:

- `src/pages/ScanFunnelPage.tsx` exists and documents itself as the `/scan` funnel;
- it is unmounted scaffolding — `src/App.tsx` contains no reference to it and registers no `/scan` route;
- it would render the visual-only `PreUploadIntake`;
- a request to `/scan` falls through to `NotFound`.

The production browser upload path remains the existing `UploadZone` flow used by homepage and
Nextdoor surfaces.

ADR-005 defines a future `/scan` perimeter. It does not describe an existing production route.

### 3.3 Current upload perimeter

`BASELINE EXECUTABLE CODE`

The current browser flow includes:

- browser-generated scope;
- browser-selected Storage path;
- direct browser upload to `quotes`;
- subsequent invocation of `start-upload-scan-session`;
- browser-accessible retry and context operations.

The target intake capability replaces that authority model for `/scan` only.

### 3.4 Current Storage posture

`BASELINE SCHEMA/POLICY INTENT`

Repository migrations configure `quotes` as private, but repository policy history still contains
browser write authority, including:

- `"Allow anonymous uploads to quotes bucket"`;
- `"Allow anonymous upsert updates to quotes bucket"`;
- authenticated upload and update policies;
- table-level `SELECT`, `INSERT`, and `UPDATE` grants on `storage.objects` to `anon`;
- corresponding grants to `authenticated`.

The signed-only posture in this ADR is a `PROPOSED TARGET CONTRACT`.

### 3.5 Current canonical-table posture

`BASELINE SCHEMA/POLICY INTENT`

Repository migrations still permit anonymous insertion through policies including:

- `"Allow anonymous insert on quote_files"`;
- `anon_insert_scan_sessions`.

Therefore the statement:

```text
The browser cannot create canonical quote or scan rows
```

is a target enforcement requirement, not current executable truth.

### 3.6 Current OTP perimeter

`BASELINE EXECUTABLE CODE`

Current `send-otp`:

- accepts browser-provided phone and scan-session identifiers without proving that the scan exists,
  that the scan has an attached lead, that the phone belongs to that lead, or that the caller
  possesses a matching intake capability;
- calls the Twilio Verify send endpoint with `fetch`, then afterwards expires prior rows and inserts
  the new `phone_verifications` row. The pending row is created **after** the external call.

Current `verify-otp`:

- selects a pending row, preferring a row matching the requested `scan_session_id`, and otherwise
  falling back to a legacy row whose `scan_session_id` is null;
- calls the Twilio `VerificationCheck` endpoint with `fetch`;
- performs its database writes afterwards as separate statements;
- guards the pending-row update with a presence check on the selected row, so when no pending row
  was found the verified-row write is skipped while the response path can still continue;
- updates canonical lead verification fields in a further separate statement.

`BASELINE EXECUTABLE CODE` — architectural consequence

Every database interaction in both functions is an independent, individually committed
Supabase client call. **No transaction and no row lock spans the Twilio `fetch`.** This is not a
defect of the client library; it is a structural property of calling an external HTTP API from an
Edge Function. Any contract that appears to hold a lock "across verification" is unimplementable.

ADR-005 therefore requires both:

```text
start-quote-intake-otp
verify-quote-intake-otp
```

as protected capability-bound wrappers around shared canonical OTP logic, each explicitly
structured as *commit → external call → separate conditional commit*.

### 3.7 Verification schema qualification

`BASELINE SCHEMA/POLICY INTENT`

At baseline, `phone_verifications.scan_session_id` is added as a plain `uuid` column with **no**
foreign key to `scan_sessions`. The `phone_verifications` table itself declares a foreign key only
on `lead_id`.

Intake verification must therefore enforce exact scan-session consistency through:

- protected RPC checks;
- serialized capability state;
- exact pending-row identity;
- claim tokens;
- conditional updates;
- capability equality;
- canonical lead equality;
- canonical phone equality.

This ADR does not assume referential integrity that the baseline schema does not provide.

### 3.8 Current report-RPC grant posture

`BASELINE SCHEMA/POLICY INTENT`

Repository migration intent permits direct browser-role execution of at least one raw full-report
RPC signature:

- the current `get_analysis_full(uuid, text)` definition migration ends with an explicit
  `GRANT EXECUTE ... TO anon, authenticated`;
- no migration revokes execute authority on `get_analysis_preview(uuid)` from `PUBLIC`, `anon`, or
  `authenticated`, so PostgreSQL's default `PUBLIC` execute privilege for newly created functions
  is left in place by migration intent.

`BASELINE EXECUTABLE CODE` — conflicting documentation

`src/services/reportService.ts` routes preview and full retrieval through `report-access` and its
header comment asserts that these RPCs are "executable only by `service_role`" and that direct
browser `supabase.rpc()` calls "will always fail". That comment conflicts with the migration grant
intent above. **Transport code correctly uses the bridge, but the database is not proved to enforce
it.** The bridge is currently a convention, not a boundary.

That posture conflicts with the target production transport law:

```text
browser
→ report-access
→ service-role database client
→ approved preview/full RPC
```

`DEPLOYED STATE UNKNOWN`

Repository migration history does not prove current deployed grants. ADR-005 requires explicit
execute-grant reconciliation by exact signature before public `/scan` traffic. See §19.2.

### 3.9 Current scanner event timing

`BASELINE EXECUTABLE CODE`

In `supabase/functions/scan-quote/index.ts`, the ordering at baseline is:

1. step 8 normalizes the classification and calls `classifyScanGate`;
2. when the gate returns `action: "terminate"`, the function returns through `terminateScan` and
   **no** `quote_uploaded` event is persisted;
3. when the gate returns `action: "continue"`, the function immediately persists the canonical
   `quote_uploaded` event, in a block commented as firing "only after the content gate passes";
4. step 9 then runs `validateExtraction`, followed by scoring, flag detection, derived metrics,
   report compilation, and analysis persistence.

`classifyScanGate` in `supabase/functions/scan-quote/classificationGate.ts` returns exactly
`{ action: "continue" }` or `{ action: "terminate", ... }`.

Therefore canonical `quote_uploaded` persistence occurs **after `classifyScanGate` returns its
continue/pass path** and **before full deep extraction validation**. A later failure in
`validateExtraction` terminates the scan but does not remove or reverse the already persisted event.

`BASELINE EXECUTABLE CODE` — durability gap

Baseline canonical persistence is wrapped in a try/catch that logs the failure as non-fatal.
A transient persistence failure therefore results in permanent silent loss of the event for that
scan. The proposed outbox in §16 exists to close that gap without moving the eligibility point.

ADR-005 preserves the baseline semantic boundary. It does not redefine `quote_uploaded` as proof
that all extracted fields are valid, that deep extraction completed, that an analysis was
persisted, that a grade exists, or that the report is revealable.

---

## 4. Business driver

The quote-ready homeowner should not complete a contact form before uploading an estimate.

The intended experience is:

```text
ad or email
→ future /scan
→ choose quote
→ private upload
→ early scanner acceptance
→ recognizable proof-of-read
→ confirm contact
→ receive OTP
→ verify OTP
→ reveal report
```

Reduced friction cannot permit:

- unrestricted anonymous writes;
- arbitrary Storage paths;
- forged lifecycle state;
- arbitrary OTP initiation;
- verification without an exact pending row;
- concurrent duplicate OTP finalization;
- verified success derived from Twilio approval alone;
- untrusted direct scanner execution;
- direct browser execution of raw report RPCs;
- cross-session access;
- duplicate quote records;
- cross-intake file claims;
- orphaned uploads;
- uncontrolled scanner cost;
- duplicate canonical event identities;
- silent permanent event loss;
- OCR-derived phone verification.

### 4.1 HEIC and HEIF limitation

`BASELINE SCHEMA/POLICY INTENT` — baseline repository migrations configure the private `quotes`
bucket to allow `image/heic`.

`DEPLOYED STATE UNKNOWN` — deployed bucket configuration remains unknown until the target Supabase
project is inspected.

`PROPOSED TARGET CONTRACT` — Sprint 2 intake does not support HEIC/HEIF. Required behavior:

- reject declared HEIC/HEIF before minting;
- validate actual bytes after upload;
- reject raw HEIC/HEIF even if Storage accepted them;
- show a specific recovery message;
- suggest screenshot, PDF, or JPEG conversion;
- never relabel HEIC bytes as JPEG;
- never send unsupported HEIC bytes to Gemini.

Production HEIC/HEIF conversion is deferred to the mobile-upload sprint.

---

## 5. Layered architecture

`PROPOSED TARGET CONTRACT`

| Layer | Name | Owns | Never owns |
| --- | --- | --- | --- |
| L1 | UI | File selection, progress, contact input, OTP-code input, recovery messaging | Canonical IDs, lifecycle truth, verification truth |
| L2 | Client state | In-memory token, same-tab recovery, advisory validation | Persistence, authorization, canonical ownership |
| L3 | Protected services | Token minting, signed upload, byte validation, quarantine, lead resolution, OTP wrappers, trusted scanner dispatch, outbox delivery, `report-access` | Deterministic scoring, direct raw report authorization, cross-boundary locking |
| L4 | Database authority | Constraints, RLS, atomic binding, same-intake enforcement, lead attachment, OTP reservations and claims, conditional verification finalization, event outbox, audit | Rendering, Twilio calls, Storage-byte parsing |
| L5 | Reveal authority | Exact verified state, `report-access`, `get_analysis_preview`, `get_analysis_full` | Trust in browser assertions or direct browser RPC execution |

Authority flow:

```text
L1/L2
→ untrusted user input

L3
→ authenticated service action and validated data
→ external provider calls, always outside any database transaction

L4
→ authoritative persistence and relational proof
→ short atomic transactions only

L5
→ service-role preview/full retrieval
→ exact-session authorization and reveal
```

**Transaction-boundary rule for L3 and L4:** a database transaction may never contain an outbound
network call, and an outbound network call may never assume that a previously held lock is still
held. Cross-boundary serialization is achieved with committed claim state, not with locks.

---

## 6. Non-negotiable security invariants

`PROPOSED TARGET CONTRACT` unless a subsection states otherwise.

### 6.1 Verify-to-Reveal

`full_json` must never be selected for an unauthorized request, returned, preloaded, cached,
logged, browser-stored, placed in the DOM, or transmitted to the browser before backend
exact-session SMS OTP authorization.

### 6.2 Exact-session isolation

A verification associated with one lead, phone, quote, or scan cannot unlock another scan session.

The reveal predicate must continue to require agreement among:

- requested scan session;
- canonical scan-session lead;
- canonical lead;
- phone-verification lead;
- phone-verification scan session;
- verified phone;
- backend verified state.

### 6.3 Browser distrust

The browser cannot provide trusted values for:

```text
lead_id
quote_file_id
scan_session_id
accepted_upload_id
phone_verification_id
otp_claim_token
user_id
phone_verified
otp_verified
verification_status
report_authorized
full_report_unlocked
scan_queued
storage_validated
event_eligible
event_persisted
canonical lifecycle state
route exemption
authorization mode
scanner provenance
```

A browser may request a transport mode (`preview` or `full`) from `report-access`, but mode
selection must never weaken, substitute for, or bypass the backend authorization predicate. See
§6.11 and §20.14.

### 6.4 Trust tiers

```text
OCR-proposed
< user-confirmed
< backend-attached unverified lead
< backend exact-session SMS verified
```

Only the final tier may authorize full reveal.

### 6.5 Canonical spine

The system reuses:

```text
quote_files
→ scan_sessions
→ analyses
```

ADR-005 does not create a second quote, scanner, OTP, analysis, or report stack.

### 6.6 Lead attachment ordering

A provisional intake may initially have null lead references.

Before OTP initiation:

1. the browser submits contact values only;
2. the protected service validates and normalizes those values;
3. the guarded resolver resolves or creates one safe unverified lead;
4. the database attaches that lead to the exact quote file, the exact scan session, all analyses for
   that exact scan, and the intake capability;
5. only then may the capability-bound OTP-start wrapper invoke Twilio.

### 6.7 Lead attachment is not verification

Attachment does not set `phone_verified`, set `phone_verified_at`, create a verified verification
row, authorize `full_json`, or unlock another scan.

### 6.8 Guarded lead resolution is mandatory

`BASELINE SCHEMA/POLICY INTENT` — at baseline, `upsert_native_lead_with_attribution` is not
guard-safe for initial intake resolution because it may mutate candidate lead data before the
caller can reject verified leads, ambiguous matches, `review_required`, conflicting identity, or
different scan bindings. The existing native-lead RPC is not currently part of the OTP/reveal path.

`PROPOSED TARGET CONTRACT` — under ADR-005 it may be used only as a downstream canonical writer
after all intake guard decisions succeed. A protected pre-mutation guard wrapper must:

- normalize contact deterministically;
- locate candidate leads without mutation;
- lock candidate rows;
- reject more than one viable candidate, ambiguity, `review_required`, existing backend-verified
  phone state, conflicting normalized phone or email, attachment to another active scan, and
  conflicting quote, scan, analysis, or capability lead;
- call the canonical writer only after candidate safety is established;
- create a new unverified lead when no safe candidate exists;
- preserve verified fields;
- never downgrade existing trust;
- attach the resolved lead in the same database transaction while candidate locks remain active.

This guard is entirely internal to the database, so its locks are legitimate: no external network
call occurs inside it.

### 6.9 Capability-bound OTP start

`/scan` must not invoke the existing public `send-otp` contract directly.

The protected operation:

```text
start-quote-intake-otp
```

must use a two-phase reservation-and-delivery protocol. The Twilio send is external, so it sits
between two independent commits.

#### Phase A — atomic reservation (commits before Twilio)

One database transaction must:

- accept the intake token and no canonical IDs;
- hash the token;
- resolve and lock the capability;
- resolve and lock the exact canonical scan;
- resolve and lock the attached lead;
- require a non-null attached lead;
- require identical lead binding across capability, quote file, scan session, and analyses;
- derive the phone from canonical lead state;
- reject a browser phone override;
- reject an existing unexpired active OTP-start reservation;
- insert or reserve one exact pending verification row containing canonical `lead_id`, canonical
  `phone_e164`, the exact non-null `scan_session_id`, and `status = 'pending'`;
- store that pending-row ID on the capability;
- set capability OTP state to `pending`;
- commit.

#### Phase B — external Twilio send (outside any transaction)

After Phase A commits:

- invoke shared internal Twilio-send logic using the server-derived phone;
- assume no Phase A lock is still held;
- record send success or failure through a separate conditional database operation;
- preserve the same pending-row identity;
- prevent a second active reservation through capability locking and state checks inside that
  separate operation.

This ordering intentionally differs from baseline `send-otp`, which inserts the pending row after
the Twilio call (§3.6).

The existing public `send-otp` endpoint must reject a direct request when the requested scan is
intake-bound.

### 6.10 Capability-bound OTP verification

`/scan` must not invoke the existing public `verify-otp` contract directly.

The protected operation:

```text
verify-quote-intake-otp
```

must accept only the intake token and the OTP code. It must not accept a trusted scan-session ID,
lead ID, phone, verification-row ID, claim token, or verification Boolean.

#### 6.10.1 The boundary that forces two transactions

A database transaction and its row locks cannot survive:

```text
RPC return
→ Edge Function execution
→ Twilio API round-trip
→ second RPC
```

`BASELINE EXECUTABLE CODE` confirms this is how the platform actually behaves (§3.6).

The verification contract therefore uses **two independent atomic transactions separated by the
external Twilio call**. Serialization across that gap is provided by committed claim state, never
by a held lock.

#### 6.10.2 Transaction A — serialized verification claim

The claim transaction must:

- hash the intake token;
- resolve and lock the capability;
- require a non-null attached lead;
- resolve and lock the exact canonical scan;
- resolve and lock the canonical lead;
- select and lock the exact pending verification row identified by the capability;
- require that row to have:
  - `status = 'pending'`;
  - `lead_id` equal to the capability lead;
  - `phone_e164` equal to the canonical lead phone;
  - a non-null `scan_session_id` equal to the capability scan session;
- reject missing pending rows, duplicate eligible pending rows, session-null legacy rows, phone
  mismatch, lead mismatch, scan mismatch, and expired or revoked capability;
- reject an existing unexpired verification claim;
- create a cryptographically unpredictable internal claim token;
- store the exact pending-row ID, the claim token, the claim timestamp, the claim-expiration
  timestamp, and OTP state `claimed`;
- increment the verification-attempt counter;
- commit atomically.

The internal claim token is never returned to the browser. It is held only in protected Edge
Function process memory for the duration of the request.

Transaction A commits **before** any Twilio call. Its locks are released at commit, by design.

#### 6.10.3 External Twilio verification (outside any transaction)

After Transaction A commits:

- the Edge Function calls Twilio using the server-derived canonical phone and the submitted OTP code;
- no database lock is assumed to remain held;
- concurrent verification attempts read the committed active claim and fail closed with
  `verification_in_progress`;
- the Twilio outcome is classified as approved, denied, or indeterminate (timeout, network error,
  or unparseable response).

#### 6.10.4 Transaction B — conditional finalization (compare-and-set)

A second, independent database transaction must:

- resolve and lock the capability;
- resolve and lock the exact pending verification row;
- resolve and lock the canonical scan and canonical lead;
- require all of:
  - capability OTP state is `claimed`;
  - the stored claim token equals the protected caller's claim token;
  - the claim is unexpired;
  - the stored pending-row ID matches the row being finalized;
  - the row status remains `pending`;
  - the row lead, phone, and scan still match canonical state;
- only then process the Twilio outcome.

When Twilio approved:

- update the exact pending row from `pending` to `verified`;
- persist `verified_at`;
- persist canonical lead verification fields required by the existing OTP contract;
- persist capability OTP state `verified`;
- persist `otp_verified_at`;
- clear the active claim fields;
- require the pending-row affected count to equal exactly one;
- require all canonical verification updates to succeed;
- commit atomically;
- return `verified: true` only after that commit.

When Twilio denied:

- do not mark verification successful;
- keep or restore the row to the approved retryable `pending` state;
- clear the claim;
- record only a sanitized failure code;
- enforce the attempt limit;
- commit;
- return no verified success.

When the outcome is indeterminate:

- call the conditional finalizer with an indeterminate outcome where possible;
- never mark the row verified;
- clear or expire the claim according to policy;
- permit safe retry only after claim release or expiration.

#### 6.10.5 Stale-claim recovery

A stale claim may be reclaimed only inside a database transaction that:

- locks the capability;
- observes that the stored claim expiration time has passed;
- observes that the pending row still has status `pending`;
- observes that canonical lead, phone, and scan still match the capability;
- then issues a **new** claim token with a new expiry, replacing the stale one atomically.

Recovery never reuses a stale claim token and never infers success from an abandoned claim.

#### 6.10.6 Approval is never sufficient

Twilio approval alone must never produce:

```json
{
  "verified": true
}
```

unless Transaction B successfully updated exactly one expected pending row and committed all
canonical verification state.

The existing public `verify-otp` endpoint must reject direct verification for an intake-bound scan.

### 6.11 Raw report-RPC browser isolation

Production browser traffic must not execute raw preview or full-report RPCs directly.

The sole production browser transport is:

```text
browser
→ report-access Edge Function
→ service-role database client
→ approved get_analysis_preview or get_analysis_full signature
```

The following are prohibited:

```text
browser
→ raw get_analysis_preview RPC

browser
→ raw get_analysis_full RPC
```

Required rules:

1. `get_analysis_preview` and `get_analysis_full` execute grants must be reconciled using their
   exact deployed signatures, including any overload or compatibility signature.
2. Direct execute authority must be revoked from `PUBLIC`, `anon`, and `authenticated`. Revoking
   from `PUBLIC` is mandatory because PostgreSQL grants execute to `PUBLIC` by default on function
   creation.
3. Required execute authority is granted only to `service_role`, or to another separately approved
   non-browser database role.
4. Browser code must not call `supabase.rpc('get_analysis_preview', ...)` or
   `supabase.rpc('get_analysis_full', ...)`.
5. Browser code must use the approved report service that invokes `report-access`.
6. `report-access` must use the service-role client, resolve preview/full mode server-side, enforce
   exact-session verification before full retrieval, prevent `full_json` from appearing in preview
   responses, and return sanitized errors.
7. The exact-session predicate inside `get_analysis_full` must be preserved unchanged.
8. A browser-supplied mode must never select a weaker authorization path.

Possession of `scan_session_id` remains insufficient for full-report authorization. Route guards,
CSS hiding, client state, and `localStorage` remain non-authoritative.

`BASELINE SCHEMA/POLICY INTENT` — repository migration intent currently includes browser-role
execute authority for at least one full-report RPC signature, and leaves default `PUBLIC` execute
in place for the preview RPC (§3.8). That authority must be removed before public `/scan` traffic.

`IMPLEMENTATION PREREQUISITE` — the grant changes described here have **not** been executed. They
are proposed. See §19.2 and §28 (M9).

### 6.12 New intake `SECURITY DEFINER` functions

Every new intake `SECURITY DEFINER` function must:

- use a fixed `search_path`;
- avoid dynamic SQL;
- be revoked from `PUBLIC`, `anon`, and `authenticated`;
- be granted only to `service_role`;
- never identify the invoker through `current_user`.

This rule is scoped to new ADR-005 intake functions. The baseline repository contains existing
functions that use `current_user`. This ADR does not authorize modifying those unrelated functions.

---

## 7. Scope

### 7.1 In scope

- random intake tokens;
- token hashing;
- exact-path signed upload;
- 10 MiB intake limit;
- MIME and magic-byte validation;
- PDF quarantine;
- durable file metadata;
- same-intake accepted-upload enforcement;
- canonical quote and scan binding;
- protected lifecycle status;
- guarded lead resolution;
- atomic lead attachment;
- capability-bound OTP start;
- OTP-start pending-row reservation committed before Twilio;
- capability-bound OTP verification;
- serialized pre-Twilio verification claim transaction;
- separate post-Twilio conditional finalization transaction;
- stale-claim recovery;
- direct legacy OTP rejection for intake scans;
- direct public scanner rejection for intake scans;
- raw preview/full RPC browser isolation;
- `report-access` as sole production browser report bridge;
- durable event identity;
- transactional event outbox;
- `classifyScanGate` event-eligibility boundary;
- anonymous canonical-table lockdown;
- signed-only `quotes` Storage cutover;
- migration of every production `UploadZone` caller;
- cleanup and retention;
- route-specific enforcement separation.

### 7.2 Out of scope

- OCR contact-candidate schema;
- contact-confirmation UI;
- quote outcome;
- contractor consent;
- contractor dispatch;
- market ledgers;
- multi-file upload;
- production HEIC decoding;
- authenticated homeowner accounts;
- deterministic scoring changes;
- replacement of `get_analysis_full`;
- replacement of the final exact-session reveal predicate;
- recovery for an already verified lead;
- changes to the current `quote_uploaded` optimization value;
- exact rate-limit persistence schema;
- final runtime feature-control names;
- changes to legacy non-intake OTP, upload, or scanner behavior beyond the intake-bound guards.

### 7.3 Deferred implementation contracts

This ADR defines normative abuse limits and rollout behavior, but intentionally does not invent:

- the rate-limit persistence table name;
- the rate-limit RPC name;
- network-subject hashing schema;
- scheduler implementation;
- the OTP claim-lifetime constant;
- final runtime feature-control names.

A future authorized implementation sprint must define those objects, their RLS, privacy guarantees,
tests, and rollback before runtime use.

---

## 8. Lifecycle enums

`PROPOSED TARGET CONTRACT` — none of these types exist.

```sql
CREATE TYPE public.quote_intake_state AS ENUM (
  'minted',
  'uploading',
  'uploaded',
  'validating',
  'bound',
  'scan_queued',
  'consumed',
  'abandoned',
  'expired',
  'rejected'
);

CREATE TYPE public.quote_intake_upload_state AS ENUM (
  'url_issued',
  'uploading',
  'uploaded',
  'quarantined',
  'validating',
  'accepted',
  'rejected',
  'abandoned',
  'cleanup_pending',
  'deleted'
);

CREATE TYPE public.quote_intake_quarantine_state AS ENUM (
  'not_applicable',
  'pending',
  'passed',
  'failed',
  'indeterminate'
);

CREATE TYPE public.quote_intake_cleanup_state AS ENUM (
  'not_due',
  'pending',
  'claimed',
  'complete',
  'failed'
);

CREATE TYPE public.quote_intake_event_state AS ENUM (
  'unreserved',
  'reserved',
  'eligible',
  'persisting',
  'persisted',
  'delivery_pending',
  'delivered',
  'failed'
);

CREATE TYPE public.quote_intake_outbox_state AS ENUM (
  'pending',
  'claimed',
  'persisted',
  'failed'
);

CREATE TYPE public.quote_intake_otp_state AS ENUM (
  'idle',
  'pending',
  'claimed',
  'verified',
  'failed',
  'expired'
);
```

`quote_intake_otp_state` distinguishes `pending` (a reservation exists and Twilio has been asked to
send a code) from `claimed` (a verification attempt has committed a claim and an external Twilio
verification round-trip is in flight or was abandoned). The `claimed` state is what makes
serialization possible without holding a lock.

---

## 9. Intake lifecycle

Primary path:

```text
minted
→ uploading
→ uploaded
→ validating
→ bound
→ scan_queued
→ consumed
```

Recoverable and terminal branches:

```text
minted | uploading | uploaded | validating
→ abandoned | expired | rejected
```

Lead attachment is not a lifecycle state. It is represented by:

```text
lead_id
lead_attached_at
```

OTP-start eligibility requires:

```text
state IN ('bound', 'scan_queued', 'consumed')
AND lead_id IS NOT NULL
AND lead_attached_at IS NOT NULL
AND capability is not expired or revoked
AND otp_state IN ('idle', 'failed', 'expired')
```

OTP-verification-claim eligibility requires:

```text
otp_pending_verification_id IS NOT NULL
AND capability is not expired or revoked
AND (
  otp_state = 'pending'
  OR (
    otp_state = 'claimed'
    AND otp_verification_claim_expires_at <= now()
  )
)
```

The second branch is the stale-claim recovery path of §6.10.5. An unexpired `claimed` state is not
eligible and fails closed with `verification_in_progress`.

OTP-verification finalization eligibility requires:

```text
otp_state = 'claimed'
AND otp_verification_claim_token = supplied claim token
AND otp_verification_claim_expires_at > now()
AND otp_pending_verification_id = the row being finalized
```

---

## 10. Token and idempotency contract

### 10.1 Token generation

Generate 32 cryptographically random bytes server-side.

```ts
function createRandomIntakeToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
```

The token is not derived from the idempotency key.

### 10.2 Hash-at-rest

```text
token_hash = SHA-256(raw_token)
```

The raw token is never persisted, logged, tracked, placed in a URL, placed in `dataLayer`, placed
in audit metadata, or included in a Storage path.

### 10.3 Idempotency key

```text
idempotency_key_hash =
HMAC-SHA-256(
  INTAKE_IDEMPOTENCY_SECRET,
  normalized UUID-v4 idempotency key
)
```

The idempotency hash locates replayed mint requests. It does not derive the bearer token.

### 10.4 Replay

A repeated idempotency key must also present the original token. Without it:

```text
409 Conflict
```

```json
{
  "ok": false,
  "code": "idempotency_token_required"
}
```

### 10.5 Browser storage

| Disposition | Location |
| --- | --- |
| Preferred | in-memory |
| Permitted for same-tab recovery | `sessionStorage` |
| Forbidden | `localStorage`, URL query, URL fragment, `dataLayer`, `event_logs`, console, third-party error payload |

---

## 11. File contract

### 11.1 Intake limit

```text
10 MiB
10,485,760 bytes
```

Enforced at:

- browser advisory preflight;
- mint validation;
- Storage configuration;
- Storage metadata inspection;
- actual downloaded byte length before binding.

`BASELINE EXECUTABLE CODE` — `supabase/functions/_shared/scannerConfig.ts` sets a 15 MiB default
maximum, overridable through `SCAN_MAX_FILE_BYTES`.

`DEPLOYED STATE UNKNOWN` — the deployed value of `SCAN_MAX_FILE_BYTES` is unknown.

The scanner's broader or environment-overridden ceiling does not redefine intake eligibility. An
intake object above 10 MiB must not reach scanner dispatch.

### 11.2 Supported types

| Disposition | Types |
| --- | --- |
| Allowed | PDF, JPEG, PNG, WebP |
| Rejected | HEIC, HEIF, SVG, HTML, ZIP, Office files, executables, encrypted PDFs, active-content PDFs |

### 11.3 Storage path

```text
intake/{intake_id}/{upload_id}.{extension}
```

The path contains no PII, original filename, lead ID, token, scan-session ID, or contractor
identity.

### 11.4 Filename

The backend stores a sanitized filename as protected canonical metadata. The filename is never used
as object-path authority, telemetry, audit metadata, or contractor-facing data.

---

## 12. PDF quarantine

Before scanner dispatch, PDFs must be inspected with a parser capable of traversing indirect and
compressed objects.

Reject at minimum:

```text
/JavaScript
/JS
/OpenAction
/AA
/Launch
/EmbeddedFile
/EmbeddedFiles
/RichMedia
/XFA
/SubmitForm
/ImportData
/GoToR
/Encrypt
```

Results:

```text
passed
failed
indeterminate
```

`failed` and `indeterminate` do not reach Gemini. A regex-only scan is insufficient.

---

## 13. Canonical `quote_files` metadata

`PROPOSED TARGET CONTRACT`

```sql
ALTER TABLE public.quote_files
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS content_sha256 bytea;
```

Canonical creation status remains `pending`.

`IMPLEMENTATION PREREQUISITE` — Storage-path duplicate audit before uniqueness:

```sql
SELECT storage_path, count(*)
FROM public.quote_files
GROUP BY storage_path
HAVING count(*) > 1;
```

After remediation:

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  quote_files_storage_path_uidx
ON public.quote_files (storage_path);
```

The concurrent index must run outside a transaction block.

---

## 14. Capability table

`PROPOSED TARGET CONTRACT` — this table does not exist.

```sql
CREATE TABLE public.quote_intake_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  token_hash bytea NOT NULL UNIQUE
    CHECK (octet_length(token_hash) = 32),

  idempotency_key_hash bytea NOT NULL UNIQUE
    CHECK (octet_length(idempotency_key_hash) = 32),

  token_version smallint NOT NULL DEFAULT 1
    CHECK (token_version > 0),

  state public.quote_intake_state NOT NULL DEFAULT 'minted',

  upload_expires_at timestamptz NOT NULL,
  status_expires_at timestamptz NOT NULL,

  max_upload_attempts smallint NOT NULL DEFAULT 3
    CHECK (max_upload_attempts BETWEEN 1 AND 5),

  upload_attempt_count smallint NOT NULL DEFAULT 0
    CHECK (
      upload_attempt_count >= 0
      AND upload_attempt_count <= max_upload_attempts
    ),

  accepted_upload_id uuid,

  quote_file_id uuid UNIQUE
    REFERENCES public.quote_files(id)
    ON DELETE RESTRICT,

  scan_session_id uuid UNIQUE
    REFERENCES public.scan_sessions(id)
    ON DELETE RESTRICT,

  lead_id uuid
    REFERENCES public.leads(id)
    ON DELETE RESTRICT,

  client_slug text,
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  query_params jsonb NOT NULL DEFAULT '{}'::jsonb,

  quote_uploaded_event_id uuid UNIQUE,

  quote_uploaded_event_state public.quote_intake_event_state
    NOT NULL DEFAULT 'unreserved',

  quote_uploaded_event_reserved_at timestamptz,
  quote_uploaded_event_eligible_at timestamptz,
  quote_uploaded_event_persisted_at timestamptz,
  quote_uploaded_delivery_ack_at timestamptz,
  quote_uploaded_event_last_error_code text,

  otp_state public.quote_intake_otp_state
    NOT NULL DEFAULT 'idle',

  otp_pending_verification_id uuid UNIQUE,
  otp_verification_claim_token uuid UNIQUE,
  otp_verification_claimed_at timestamptz,
  otp_verification_claim_expires_at timestamptz,

  otp_verification_attempt_count integer NOT NULL DEFAULT 0
    CHECK (otp_verification_attempt_count >= 0),

  otp_verified_at timestamptz,
  otp_last_error_code text,

  last_error_code text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),

  scan_dispatch_attempt_count integer NOT NULL DEFAULT 0
    CHECK (scan_dispatch_attempt_count >= 0),

  scan_dispatch_last_at timestamptz,
  scan_dispatch_last_error_code text,

  consumed_at timestamptz,
  lead_attached_at timestamptz,
  verified_linked_at timestamptz,
  abandoned_at timestamptz,
  expired_at timestamptz,
  rejected_at timestamptz,
  revoked_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quote_intake_binding_pair_chk
    CHECK (
      (quote_file_id IS NULL AND scan_session_id IS NULL)
      OR
      (quote_file_id IS NOT NULL AND scan_session_id IS NOT NULL)
    ),

  CONSTRAINT quote_intake_bound_state_chk
    CHECK (
      state NOT IN ('bound', 'scan_queued', 'consumed')
      OR (
        accepted_upload_id IS NOT NULL
        AND quote_file_id IS NOT NULL
        AND scan_session_id IS NOT NULL
        AND quote_uploaded_event_id IS NOT NULL
      )
    ),

  CONSTRAINT quote_intake_lead_binding_chk
    CHECK (
      lead_id IS NULL
      OR (
        quote_file_id IS NOT NULL
        AND scan_session_id IS NOT NULL
        AND lead_attached_at IS NOT NULL
      )
    ),

  CONSTRAINT quote_intake_event_reservation_chk
    CHECK (
      (
        quote_uploaded_event_id IS NULL
        AND quote_uploaded_event_state = 'unreserved'
      )
      OR
      (
        quote_uploaded_event_id IS NOT NULL
        AND quote_uploaded_event_state <> 'unreserved'
        AND quote_uploaded_event_reserved_at IS NOT NULL
      )
    ),

  CONSTRAINT quote_intake_otp_pending_row_chk
    CHECK (
      (
        otp_state = 'idle'
        AND otp_pending_verification_id IS NULL
      )
      OR
      (
        otp_state IN ('pending', 'claimed', 'verified', 'failed', 'expired')
        AND otp_pending_verification_id IS NOT NULL
      )
    ),

  CONSTRAINT quote_intake_otp_claim_chk
    CHECK (
      (
        otp_state = 'claimed'
        AND otp_verification_claim_token IS NOT NULL
        AND otp_verification_claimed_at IS NOT NULL
        AND otp_verification_claim_expires_at IS NOT NULL
        AND otp_verification_claim_expires_at > otp_verification_claimed_at
      )
      OR
      (
        otp_state <> 'claimed'
        AND otp_verification_claim_token IS NULL
        AND otp_verification_claimed_at IS NULL
        AND otp_verification_claim_expires_at IS NULL
      )
    ),

  CONSTRAINT quote_intake_otp_verified_chk
    CHECK (
      otp_state <> 'verified'
      OR otp_verified_at IS NOT NULL
    )
);

ALTER TABLE public.quote_intake_capabilities
  ADD CONSTRAINT quote_intake_capability_event_pair_uniq
  UNIQUE (id, quote_uploaded_event_id);
```

Notes on the claim columns:

- `quote_intake_otp_claim_chk` makes claim state and claim identity inseparable: a capability is
  either exactly one live claim, or no claim at all. There is no partially claimed state.
- `otp_verification_claim_token` is `UNIQUE`, so two concurrent claims cannot coexist for one
  capability even under retry storms.
- Stale-claim recovery (§6.10.5) replaces the token and expiry inside one transaction while state
  remains `claimed`, so the constraint holds throughout.
- The event UUID is minted once inside the canonical binding transaction. Retries reuse the stored
  UUID.
- The OTP pending-row ID is a protected correlation identifier.

`BASELINE SCHEMA/POLICY INTENT` — no baseline foreign key from the capability to
`phone_verifications` is assumed, because `phone_verifications.scan_session_id` itself has no
foreign key (§3.7). Exact pending-row integrity is enforced transactionally by the OTP RPC
contracts in §§20.8–20.11.

---

## 15. Upload-attempt same-intake enforcement

`PROPOSED TARGET CONTRACT`

```sql
CREATE TABLE public.quote_intake_upload_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  intake_id uuid NOT NULL
    REFERENCES public.quote_intake_capabilities(id)
    ON DELETE CASCADE,

  attempt_no smallint NOT NULL
    CHECK (attempt_no > 0),

  state public.quote_intake_upload_state
    NOT NULL DEFAULT 'url_issued',

  quarantine_state public.quote_intake_quarantine_state
    NOT NULL DEFAULT 'not_applicable',

  quarantine_reason_codes text[]
    NOT NULL DEFAULT ARRAY[]::text[],

  storage_bucket text NOT NULL DEFAULT 'quotes'
    CHECK (storage_bucket = 'quotes'),

  storage_path text NOT NULL UNIQUE,

  file_name text NOT NULL,
  declared_extension text NOT NULL,
  declared_mime_type text NOT NULL,

  declared_size_bytes bigint NOT NULL
    CHECK (
      declared_size_bytes > 0
      AND declared_size_bytes <= 10485760
    ),

  signed_upload_expires_at timestamptz NOT NULL,

  detected_mime_type text,
  detected_size_bytes bigint,

  content_sha256 bytea
    CHECK (
      content_sha256 IS NULL
      OR octet_length(content_sha256) = 32
    ),

  storage_etag text,

  pdf_is_encrypted boolean,
  pdf_page_count integer,
  validation_error_code text,

  uploaded_at timestamptz,
  validated_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,

  cleanup_state public.quote_intake_cleanup_state
    NOT NULL DEFAULT 'not_due',

  cleanup_after timestamptz,
  cleanup_claim_token uuid,
  cleanup_claimed_at timestamptz,

  cleanup_attempt_count integer NOT NULL DEFAULT 0
    CHECK (cleanup_attempt_count >= 0),

  cleanup_completed_at timestamptz,
  cleanup_last_error_code text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (intake_id, attempt_no),
  UNIQUE (intake_id, id)
);
```

The capability-to-accepted-attempt relation must enforce same-intake ownership:

```sql
ALTER TABLE public.quote_intake_capabilities
  ADD CONSTRAINT quote_intake_accepted_upload_same_intake_fk
  FOREIGN KEY (id, accepted_upload_id)
  REFERENCES public.quote_intake_upload_attempts (
    intake_id,
    id
  )
  ON DELETE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;
```

This proves:

```text
capability.id = accepted upload attempt.intake_id
```

A capability cannot claim another intake's upload attempt. The binding RPC must independently
verify the same relationship under row locks.

---

## 16. Durable event outbox

`PROPOSED TARGET CONTRACT`

```sql
CREATE TABLE public.quote_intake_event_outbox (
  event_id uuid PRIMARY KEY,

  intake_id uuid NOT NULL UNIQUE,

  event_name text NOT NULL
    CHECK (event_name = 'quote_uploaded'),

  state public.quote_intake_outbox_state
    NOT NULL DEFAULT 'pending',

  payload jsonb NOT NULL,

  attempt_count integer NOT NULL DEFAULT 0
    CHECK (attempt_count >= 0),

  next_attempt_at timestamptz NOT NULL DEFAULT now(),

  claim_token uuid,
  claimed_at timestamptz,

  persisted_at timestamptz,
  last_error_code text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quote_intake_event_payload_is_object_chk
    CHECK (jsonb_typeof(payload) = 'object')
);

ALTER TABLE public.quote_intake_event_outbox
  ADD CONSTRAINT quote_intake_event_same_intake_fk
  FOREIGN KEY (intake_id, event_id)
  REFERENCES public.quote_intake_capabilities (
    id,
    quote_uploaded_event_id
  )
  ON DELETE CASCADE;
```

`intake_id UNIQUE` plus `event_id` as primary key is what guarantees exactly one outbox row per
intake, so a repeated eligibility call is idempotent rather than duplicative.

The payload uses a strict allowlist. Allowed keys are limited to approved non-PII event fields such
as:

- `event_id`;
- `event_name`;
- `intake_id`;
- `quote_file_id`;
- `scan_session_id`;
- `client_slug`;
- route or flow identifier;
- approved attribution fields;
- validated MIME type;
- validated file-size bucket;
- the `classifyScanGate` eligibility timestamp.

Forbidden keys and values include intake token, token hash, signed upload token, signed upload URL,
raw IP address, full user agent, original or sanitized filename, Storage path, name, email, phone,
address, ZIP when treated as contact PII, contractor identity, OCR text, extracted contact
candidates, `preview_json`, `full_json`, report grade, and report flags.

The outbox payload must be created server-side from an explicit allowlist. It must not accept
arbitrary browser JSON.

---

## 17. Immutable audit

`PROPOSED TARGET CONTRACT`

```sql
CREATE TABLE public.quote_intake_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  intake_id uuid NOT NULL,
  upload_id uuid,

  event_name text NOT NULL,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);
```

Service role receives only:

```sql
GRANT SELECT, INSERT
ON public.quote_intake_audit_events
TO service_role;
```

`UPDATE` and `DELETE` are prohibited through grants and a mutation-denial trigger.

### 17.1 Audit metadata allowlist

Audit metadata may contain only non-PII operational facts from an explicit server-side allowlist,
including reason code, previous state, next state, attempt number, validated MIME type, file-size
bucket, quarantine result, parser result code, event state, OTP state, claim-transition outcome,
retry count, HTTP status class, service operation name, and boolean indicators that do not reveal
PII.

Correlation UUIDs should use dedicated columns where available rather than arbitrary metadata.

### 17.2 Audit metadata denylist

Audit metadata must never contain raw intake token, token hash, idempotency key, signed upload
token, signed upload URL, raw IP address, full user agent, original filename, sanitized filename,
Storage path, name, email, phone, address, postal code when tied to a person, contractor identity,
raw file bytes, OCR output, extracted contact candidates, confirmation-form contents, OTP code,
OTP verification claim token, Twilio request or verification payload, `preview_json`, `full_json`,
report grade, report findings, or report flags.

The audit writer must reject non-allowlisted metadata keys.

Retention:

| Record | Retention |
| --- | --- |
| Capability | 90 days |
| Upload attempt | 90 days |
| Persisted outbox row | 90 days |
| Audit event | minimum 365 days |

---

## 18. Deletion and erasure contract

The baseline canonical spine cascades through lead-owned records.

The proposed intake sidecar uses `RESTRICT` references to the canonical lead, canonical quote file,
and canonical scan session. This intentionally prevents canonical deletion while an intake sidecar
remains.

`IMPLEMENTATION PREREQUISITE` — before these foreign keys are deployed, a protected erasure
procedure must:

1. locate dependent intake capabilities;
2. revoke active capabilities;
3. invalidate or resolve active OTP claims, including expired-but-uncleared claims;
4. preserve immutable audit events;
5. remove unaccepted Storage objects;
6. resolve or explicitly abandon pending event-outbox rows;
7. delete or archive eligible outbox rows;
8. delete upload attempts;
9. delete capability rows;
10. then delete canonical lead, quote, scan, analysis, and verification records under the approved
    canonical deletion contract.

The procedure must support data-subject erasure, operator deletion, QA cleanup, automated tests,
lead merge or replacement, and partial-failure retry.

Because baseline `phone_verifications.scan_session_id` has no foreign key to `scan_sessions`
(§3.7), the erasure procedure must explicitly locate and delete or retain verification rows
according to the approved retention policy. It must not rely on a nonexistent scan-session cascade.

Deploying the sidecar `RESTRICT` foreign keys without this erasure procedure is prohibited.

---

## 19. RLS, grants, and browser-isolation target

### 19.1 New intake tables

All new intake tables must:

- enable RLS;
- force RLS;
- expose no `anon` policy;
- expose no `authenticated` policy;
- revoke browser table privileges;
- grant required access only to `service_role`.

### 19.2 Raw preview/full RPC isolation

`IMPLEMENTATION PREREQUISITE` — none of the following has been executed. Each item is proposed work
for the authorized implementation sprint.

Before public `/scan` traffic:

1. inventory exact deployed signatures for `get_analysis_preview`, `get_analysis_full`, and any
   compatibility or overloaded report RPC;
2. inventory every browser, test, admin, and Edge Function caller;
3. migrate every production browser caller to `report-access`;
4. revoke direct execute authority on the raw preview/full RPCs from `PUBLIC`, `anon`, and
   `authenticated`;
5. grant execute only to `service_role`, or to another separately approved non-browser database
   role;
6. preserve the exact-session predicate inside `get_analysis_full` unchanged;
7. ensure preview responses contain no `full_json`;
8. ensure a browser-selected mode cannot choose a weaker authorization path;
9. verify `report-access` uses the authorized role;
10. verify no browser bundle contains direct raw preview/full RPC execution;
11. add negative tests proving direct raw-RPC invocation is rejected for `anon` and
    `authenticated`.

`BASELINE SCHEMA/POLICY INTENT` — repository migration intent currently includes browser-role
execute authority for at least one `get_analysis_full` signature, and does not revoke default
`PUBLIC` execute for `get_analysis_preview`.

`DEPLOYED STATE UNKNOWN` — the exact deployed grant state remains unknown until inspected in the
target Supabase project.

The grant cutover must preserve:

```text
production browser
→ report-access
→ exact authorized database RPC
```

It must prohibit:

```text
production browser
→ raw get_analysis_preview RPC

production browser
→ raw get_analysis_full RPC
```

### 19.3 Canonical tables

`IMPLEMENTATION PREREQUISITE` — before public `/scan` traffic, remove:

```sql
DROP POLICY IF EXISTS
  "Allow anonymous insert on quote_files"
ON public.quote_files;

DROP POLICY IF EXISTS
  anon_insert_scan_sessions
ON public.scan_sessions;
```

Also revoke any supporting direct anonymous insertion privileges. Equivalent authenticated
browser-write paths must be inventoried and removed or narrowed when present.

### 19.4 Storage cutover

`IMPLEMENTATION PREREQUISITE` — before public `/scan` traffic, remove or narrow:

```sql
DROP POLICY IF EXISTS
  "Allow anonymous uploads to quotes bucket"
ON storage.objects;

DROP POLICY IF EXISTS
  "Allow anonymous upsert updates to quotes bucket"
ON storage.objects;
```

Authenticated quote upload and upsert policies must also be inventoried. Current table-level grants
on `storage.objects` must be inventoried. Global revocation may affect unrelated buckets and cannot
occur without an all-bucket policy and caller audit.

### 19.5 Mandatory `UploadZone` migration

`BASELINE EXECUTABLE CODE` — at baseline, `UploadZone` is the browser `quotes` uploader used by
homepage flows and Nextdoor flows.

Direct legacy quote uploads cannot coexist with a globally signed-only `quotes` posture.

Before quote-bucket anonymous or authenticated write policies are removed or narrowed, every
production `UploadZone` caller must be migrated to an approved exact-path signed upload contract,
or to another non-bypassable backend-owned transport satisfying the same security properties.

Route names are not policy authority. Leaving broad policies in place for homepage compatibility
would allow `/scan` users to bypass the capability contract. Removing those policies before
migrating every `UploadZone` caller would break existing production upload behavior.

The cutover must be atomic at the release level:

```text
all production quote upload callers migrated
→ all production browser report callers migrated
→ negative bypass tests pass
→ broad quote Storage policies removed or narrowed
→ raw report RPC browser grants revoked
→ public /scan traffic enabled
```

Final acceptance requires:

```text
No grant-plus-policy combination permits browser bypass
of the signed intake contract for the quotes bucket.

No execute grant permits browser bypass
of the report-access bridge for preview or full-report retrieval.
```

---

## 20. Service-role RPC contracts

`PROPOSED TARGET CONTRACT` — all RPC names are proposed. None exists.

### 20.1 `mint_quote_intake_v1`

Creates or resolves one capability by idempotency hash.

### 20.2 `issue_quote_intake_upload_v1`

Creates one exact-path upload attempt.

### 20.3 `mark_quote_intake_uploaded_v1`

Marks the expected Storage object as present but untrusted.

### 20.4 `bind_quote_intake_upload_v1`

The binding RPC:

- locks capability and upload attempt;
- verifies same-intake ownership;
- validates file facts and quarantine status;
- inserts `quote_files` with `status = 'pending'` and protected file metadata;
- inserts `scan_sessions` with `status = 'uploading'`, capability attribution, capability
  `client_slug`, and capability `query_params`;
- mints one UUID-v4 `quote_uploaded_event_id`;
- stores that UUID on the capability;
- marks event state `reserved`;
- binds quote and scan;
- commits atomically.

Canonical scan creation preserves the existing unique `scan_sessions.quote_file_id` constraint.

### 20.5 `mark_quote_intake_scan_queued_v1`

Verifies exact stored scan binding before transition.

### 20.6 `get_quote_intake_status_v1`

Returns only:

- intake state;
- scan state;
- analysis state;
- `preview_ready`;
- `lead_attached`;
- `otp_start_allowed`;
- `otp_verification_pending`;
- `otp_verification_in_progress`;
- event state;
- retryability;
- sanitized error code.

It returns no PII, canonical lead ID, Storage path, OCR output, preview payload, full report
payload, or OTP claim token.

### 20.7 `intake_attach_lead_v1`

Input:

```text
p_token_hash
p_contact
```

No canonical IDs are accepted.

The RPC or its protected orchestration wrapper must use the mandatory pre-mutation lead guard of
§6.8. It attaches the same lead to the capability, the quote file, the scan session, and all
analyses for that exact scan.

It fails closed on ambiguity, verified lead state, `review_required`, conflicting identity,
conflicting scan binding, and conflicting canonical lead references.

### 20.8 `reserve_quote_intake_otp_start_v1`

Input:

```text
p_token_hash
```

This RPC implements OTP-start Transaction A (§6.9 Phase A). It must:

- lock capability, quote, scan, lead, and relevant analyses;
- derive canonical phone;
- reject conflicting or already verified state;
- reject an existing active pending verification;
- create one exact pending verification row;
- store that row ID on the capability;
- set capability OTP state to `pending`;
- commit atomically, before any Twilio call.

Returns only to the protected OTP-start service: canonical phone, masked phone, pending-row ID,
exact scan-session ID, and server-owned send idempotency context.

The browser receives none of the canonical identifiers.

### 20.9 `mark_quote_intake_otp_send_result_v1`

Input:

```text
p_token_hash
p_pending_verification_id
p_send_outcome
p_sanitized_error_code
```

Service-role only. It must:

- lock capability and exact pending row;
- verify the stored pending-row ID;
- reject mismatched lead, phone, or scan;
- record successful delivery initiation or sanitized failure;
- never mark the phone verified;
- preserve safe retry semantics;
- commit atomically.

This is a separate transaction from §20.8 because the Twilio send happens between them.

### 20.10 `claim_quote_intake_otp_verification_v1`

Input:

```text
p_token_hash
```

This RPC implements verification Transaction A (§6.10.2). It must:

- lock capability, canonical scan, canonical lead, and exact pending row;
- require capability OTP state `pending`, or a `claimed` state whose claim has expired and is
  eligible for safe recovery under §6.10.5;
- validate exact lead, phone, scan, and pending status;
- reject missing, duplicate, session-null, or conflicting rows;
- reject an active unexpired claim with `verification_in_progress`;
- generate a cryptographically unpredictable internal claim token;
- store the pending-row ID, claim token, claim timestamp, claim expiry, and OTP state `claimed`;
- increment the attempt count;
- commit atomically.

Returns only to the protected OTP-verification service: canonical phone, exact pending-row ID,
internal claim token, and claim expiry.

The claim token is never returned to the browser. The transaction commits before Twilio is called;
its locks are released at commit and are not relied upon afterwards.

### 20.11 `finalize_quote_intake_otp_verification_v1`

Input:

```text
p_token_hash
p_claim_token
p_twilio_outcome
p_sanitized_error_code
```

This RPC implements verification Transaction B (§6.10.4) as a compare-and-set. It must:

- lock capability, exact pending row, canonical scan, and canonical lead;
- require OTP state `claimed`, exact claim-token equality, an unexpired claim, exact pending-row
  identity, pending-row status still `pending`, and exact lead, phone, and scan equality;
- only then process the Twilio outcome.

For an approved outcome:

- update exactly one pending row to `verified`;
- persist `verified_at`;
- persist canonical verified-lead fields required by the existing OTP contract;
- set capability OTP state `verified`;
- set `otp_verified_at`;
- clear claim fields;
- require the pending-row affected count to equal one;
- commit atomically;
- return verified success only after commit.

For a denied outcome:

- do not mark the row verified;
- return the row to the approved retryable `pending` state, or to a terminal state at the attempt
  limit;
- clear the claim;
- record a sanitized failure code;
- commit atomically.

For an indeterminate outcome:

- do not mark the row verified;
- clear or expire the claim according to policy;
- record a sanitized failure code;
- leave the capability in a state that permits safe retry only after claim release or expiry;
- commit atomically.

If any precondition fails, the RPC must make no verification change and must return a conflict
outcome. A failed compare-and-set is never upgraded to success by retry with a different claim
token.

### 20.12 `mark_quote_uploaded_eligible_v1`

Called only from trusted `scan-quote` execution immediately after:

```text
classifyScanGate
→ continue/pass path
```

and before full deep extraction validation.

Input:

```text
p_scan_session_id
p_event_id
p_payload
```

It:

- resolves the capability by scan session;
- verifies `p_event_id` equals the stored event ID;
- validates the payload against an explicit allowlist;
- requires that `classifyScanGate` permitted processing to continue;
- transitions event state from `reserved` to `eligible`;
- inserts one outbox row;
- treats duplicate invocation as idempotent success;
- commits atomically.

The operation does **not** assert that deep extraction validation passed, that analysis persistence
completed, that a grade exists, or that report preview is available.

### 20.13 Event-outbox claim and acknowledgement

A worker claims rows with:

```sql
FOR UPDATE SKIP LOCKED
```

After canonical event persistence, it must verify that the canonical event store contains the exact
event ID before marking the outbox row `persisted`.

A transient persistence error remains retryable. An event cannot be marked `persisted` solely
because an HTTP request returned success.

### 20.14 Report-access bridge contract

Production preview and full-report retrieval must use:

```text
report-access
```

The Edge Function must:

- accept only allowlisted request fields;
- resolve preview or full mode server-side;
- use a service-role database client;
- call the exact approved preview or full RPC signature;
- enforce exact-session verification before full retrieval;
- ensure preview responses contain no `full_json`;
- return no raw database error;
- prevent a browser-supplied mode from weakening the authorization predicate.

`BASELINE EXECUTABLE CODE` — the baseline `report-access` function already validates the requested
mode, requires a phone for full mode, uses the service-role key, strips `full_json` from preview
responses, and normalizes the unauthorized sentinel returned by `get_analysis_full`. What is missing
is not the bridge but the database-level guarantee that the bridge cannot be bypassed (§3.8).

No intake RPC defined by ADR-005 returns `preview_json` or `full_json`.

---

## 21. Edge Function contracts

`PROPOSED TARGET CONTRACT` — all new function names are proposed.

### 21.1 `mint-quote-intake`

Accepts advisory file metadata and returns intake token, exact Storage path, signed upload token,
and expirations.

### 21.2 `finalize-quote-intake`

It:

- validates the actual Storage object;
- computes digest;
- quarantines PDF content;
- calls atomic binding;
- receives the durably stored UUID event ID;
- dispatches `scan-quote` with trusted internal-service provenance and the stored UUID;
- returns lifecycle status.

It does not persist or mark `quote_uploaded` eligible. Eligibility belongs to the scanner callback
after `classifyScanGate` passes (§21.8).

### 21.3 `attach-quote-intake-lead`

Accepts intake token and contact values only.

It returns:

```json
{
  "lead_attached": true
}
```

It returns no lead ID.

### 21.4 `start-quote-intake-otp`

Accepts the intake token only. It does not accept a scan-session ID, lead ID, phone override, or
verification Boolean.

Sequence:

1. call `reserve_quote_intake_otp_start_v1`;
2. receive server-derived phone and pending-row identity;
3. confirm the reservation transaction has committed;
4. call shared internal Twilio-send logic;
5. call `mark_quote_intake_otp_send_result_v1`;
6. return masked destination, request status, and retry information.

The Twilio call happens strictly between two committed transactions. No database lock is assumed to
survive it.

### 21.5 `verify-quote-intake-otp`

Accepts the intake token and the OTP code. It does not accept a scan-session ID, lead ID, phone,
verification-row ID, claim token, or verification Boolean.

Sequence:

1. call `claim_quote_intake_otp_verification_v1`;
2. receive server-derived canonical phone, exact pending-row ID, internal claim token, and claim
   expiry — this is Transaction A, and it is committed at this point;
3. call Twilio verification, with no database transaction open and no lock assumed;
4. call `finalize_quote_intake_otp_verification_v1` with the intake token hash context, the
   protected internal claim token, the Twilio outcome, and a sanitized error code — this is
   Transaction B;
5. return `verified: true` only when Transaction B reports committed verified success.

The Edge Function must not:

- assume database locks survive the Twilio call;
- call Twilio before the claim transaction commits;
- return verified success when finalization fails, conflicts, or is unreachable;
- expose the claim token to the browser or to logs;
- retry finalization with a different claim token;
- fall back to a session-null legacy row.

Concurrent requests that observe an active unexpired claim return:

```text
verification_in_progress
```

A stale claim is recoverable only through the database rules in §6.10.5.

### 21.6 Legacy OTP guards

Existing `send-otp` must reject direct public OTP initiation when the requested scan is
intake-bound:

```text
intake_otp_wrapper_required
```

Existing `verify-otp` must reject direct public OTP verification when the requested scan is
intake-bound:

```text
intake_otp_verification_wrapper_required
```

Legacy non-intake behavior remains unchanged unless separately authorized.

### 21.7 Protected `scan-quote` dispatch

When a requested `scan_session_id` is linked to `quote_intake_capabilities`, `scan-quote` must
reject any untrusted direct invocation.

The rejection must occur before scan lifecycle mutation, private file retrieval, Gemini invocation,
analysis mutation, event eligibility, and event persistence.

Intake scans may be dispatched only through an approved authenticated internal-service contract.
Trusted provenance must include a source fixed to intake-v1, the exact intake identifier, the exact
scan-session identifier, and the stored `quote_uploaded_event_id`.

`scan-quote` must independently verify that the caller is authorized as an internal service, that
the intake exists, that the scan belongs to that intake, and that the provided event ID equals the
stored event ID. Browser-supplied provenance is never honored.

When intake provenance is missing, forged, expired, or inconsistent:

```text
403 intake_scan_internal_dispatch_required
```

The function must not fall through to legacy scanner processing or legacy event persistence for an
intake-bound scan. Legacy non-intake scanner callers remain governed by their existing contract.

### 21.8 Scanner event-eligibility callback

For an authorized intake scan:

1. execute the existing early document-classification path;
2. call `classifyScanGate`;
3. when the gate returns `terminate`:
   - do not mark `quote_uploaded` eligible;
   - do not create an outbox row;
   - terminate through the existing path;
4. when the gate returns its continue/pass path:
   - call `mark_quote_uploaded_eligible_v1`;
   - create or reuse the one idempotent outbox row;
   - continue into full deep extraction and validation.

A later failure during deep extraction, normalization, deterministic validation, analysis
persistence, or grading does not generate another event, change the stored event ID, or
retroactively reverse eligibility.

### 21.9 Event-outbox worker

The worker claims pending rows, invokes canonical event persistence, uses the stored UUID, verifies
durable event presence by event ID, marks `persisted`, retries transient failures, and alerts on
terminal failure.

This replaces the baseline pattern in which a canonical-persistence failure is swallowed as
non-fatal (§3.9), without moving the eligibility point.

### 21.10 Cleanup worker

The worker claims due rows safely, deletes orphan objects through the Storage API, never deletes
directly from `storage.objects`, preserves canonical accepted files, and preserves immutable audit
records.

The exact scheduler, function name, rate-limit persistence schema, and runtime feature-control
names are deferred to the authorized implementation sprint.

### 21.11 `report-access`

Production browser report requests must call `report-access`. The browser must not call raw preview
or full-report RPCs. `report-access` must remain the only production browser bridge to those
database functions.

---

## 22. `quote_uploaded` ownership and semantics

### 22.1 Event meaning and exact eligibility point

For intake-v1, `quote_uploaded` becomes eligible only when:

```text
file passed intake upload validation
AND canonical quote/scan binding committed
AND scan-quote classifyScanGate returned its continue/pass path
```

The exact boundary is:

```text
quote_uploaded eligibility occurs after classifyScanGate returns
its continue/pass path and before full deep extraction validation.
```

"Full deep extraction validation" means the later stages: extraction, normalization, deterministic
validation, analysis persistence, and grading.

Eligibility does not require completion of all deep extraction, successful deterministic field
validation, analysis-row persistence, a complete grade, preview readiness, or report reveal
readiness.

It does not fire when `classifyScanGate` terminates the scan as non-qualifying at that early gate.

A failure that occurs after the early gate — during deeper extraction, normalization, deterministic
validation, or later analysis persistence — does not retroactively invalidate the `quote_uploaded`
event.

This boundary matches `BASELINE EXECUTABLE CODE` (§3.9). ADR-005 preserves it; it does not move it.

### 22.2 Event-ID format

`BASELINE EXECUTABLE CODE` — executable baseline upload behavior uses opaque UUID-v4 event IDs, and
`UploadZone` documents this as a forever rule.

ADR-005 preserves UUID v4. It does not migrate `quote_uploaded` to deterministic `wmc_`.

The UUID is moved from browser generation to server-side binding and stored durably.

The existing scanner input boundary may accept a broader nonempty string type. Intake-v1 narrows
its own contract to the stored UUID-v4 value.

### 22.3 Delivery guarantee

Universal exactly-once delivery across distributed browser, server, and advertising systems is not
promised.

ADR-005 guarantees:

- one canonical event identity per intake;
- one durable UUID stored before scanner dispatch;
- one eligibility transition, after `classifyScanGate` passes and before full deep extraction
  validation;
- one idempotent outbox row per intake;
- idempotent canonical persistence by event ID;
- retries reuse the same UUID;
- optional browser delivery reuses the same UUID;
- downstream delivery is at-least-once with event-ID deduplication.

Prohibited states are:

```text
two canonical event identities for one intake
silent permanent loss of the canonical event
event eligibility before classifyScanGate passes
event eligibility gated on full deep extraction success
```

### 22.4 Existing emitters

| Surface | Baseline role | Intake-v1 treatment |
| --- | --- | --- |
| `UploadZone.tsx` | Browser UUID generation and Lane A fire | Not used by future `/scan`; no global suppression |
| `start-upload-scan-session` | CRM lead activity | Not called by future `/scan`; no global suppression |
| `scan-quote` | Canonical event persistence after the early classification gate | Shared path; intake event ownership moves to stored UUID plus outbox |

### 22.5 Trusted scanner eligibility

For an authorized intake dispatch:

- `scan-quote` executes the existing early classification logic;
- `classifyScanGate` determines whether processing terminates or continues;
- only the continue/pass path may call `mark_quote_uploaded_eligible_v1`;
- the callback occurs before full deep extraction validation;
- `scan-quote` skips its legacy direct `quote_uploaded` persistence block for that intake;
- full extraction, deterministic validation, analysis writes, scoring, flags, and report processing
  continue afterward;
- later extraction failure does not delete or reverse the already eligible `quote_uploaded` event.

An untrusted direct call for an intake-bound scan is rejected before mutation.

### 22.6 Browser Lane A measurement policy

Browser Lane A for intake-v1 is a proposed mirror, not currently authorized measurement ownership.

It remains disabled unless:

- the measurement owner explicitly approves it;
- `docs/measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md` is amended;
- tracking ownership documentation is reconciled;
- browser and server use the same stored UUID;
- duplicate-delivery tests pass;
- consent requirements are satisfied.

Canonical server persistence must not depend on browser delivery. When browser Lane A remains
disabled for intake-v1, the server-owned canonical event and approved server routing remain
authoritative.

When later approved, the browser may call `trackConversion` only after status confirms:

```text
quote_uploaded_event_state = 'persisted'
```

Refresh or retry must reuse the same stored UUID.

Existing non-intake browser Lane A behavior on legacy surfaces is unchanged by this ADR.

### 22.7 Optimization value

ADR-005 does not change the current optimization-value policy.

`BASELINE EXECUTABLE CODE` — the canonical value model assigns:

```text
quote_uploaded = 250
```

Any value change belongs to a separate measurement decision.

---

## 23. Operational telemetry

Lane A:

```text
trackConversion
→ window.dataLayer
→ GTM
→ approved browser/server routing
```

Lane B:

```text
trackEvent
→ Supabase event_logs
→ diagnostics
```

Lane B may report non-PII operational events such as mint failure, validation failure, quarantine
failure, guarded lead-resolution rejection, OTP reservation conflict, OTP verification claim
conflict, stale OTP claim recovery, finalization conflict, direct OTP bypass attempt, direct
scanner bypass attempt, raw report-RPC bypass attempt, event-outbox retry, cleanup failure, and
rate-limit trigger.

Lane B contains no tokens, claim tokens, filenames, Storage paths, contact values, OTP codes, OCR
text, preview payload, or report payload.

---

## 24. Cleanup and retention

The cleanup worker claims rows through:

```sql
FOR UPDATE SKIP LOCKED
```

Storage deletion uses the Storage API, never direct SQL against `storage.objects`.

Retry schedule:

```text
15 minutes
1 hour
6 hours
24 hours
24 hours
```

Retention:

| Record | Retention |
| --- | --- |
| Capability | 90 days |
| Upload attempt | 90 days |
| Persisted outbox row | 90 days |
| Audit event | minimum 365 days |
| Rate-limit record | implementation sprint must define; target operational window 48 hours |
| Canonical quote/file | canonical quote-retention policy |

Canonical accepted files are never deleted by orphan cleanup.

Expired OTP claims must be cleared or transitioned through protected cleanup before capability
deletion.

---

## 25. Normative abuse limits

| Operation | Limit |
| --- | --- |
| Mint per network subject | 5 per 10 minutes |
| Mint per network subject | 20 per day |
| Concurrent unbound intakes | 3 |
| Upload attempts per intake | 3 |
| Finalize attempts per intake | 6 per hour |
| Contact-attachment attempts | 5 per hour |
| OTP-start attempts per intake | 5 per hour |
| OTP-start attempts per network subject | 20 per hour |
| Concurrent OTP-verification claims per intake | 1 |
| OTP-verification attempts per intake | implementation sprint must align with existing OTP policy |
| OTP claim lifetime | implementation sprint must define a short bounded duration |
| Status polls per intake | 60 per 5 minutes |
| File size | 10 MiB |
| Signed upload lifetime | 10 minutes |
| Upload-authority lifetime | 30 minutes |
| Status/contact/OTP authority lifetime | 24 hours |

These are normative policy limits.

The implementation sprint must define persistence schema, atomic consumption behavior, subject
hashing, privacy controls, claim-expiry duration, stale-claim recovery timing, expiry cleanup,
tests, final runtime configuration, and final feature-control names.

The OTP claim lifetime must exceed the maximum expected Twilio round-trip plus finalization time,
and must remain short enough that an abandoned attempt does not lock a homeowner out for long.

Rate limiting fails closed where the protected operation cannot safely distinguish allowed from
disallowed traffic.

---

## 26. Failure semantics

| Condition | HTTP | Code |
| --- | --- | --- |
| Invalid request | 400 | `invalid_request` |
| Unsupported file | 415 | `unsupported_file_type` |
| HEIC/HEIF | 415 | `heic_not_supported` |
| Oversize | 413 | `file_too_large` |
| Unknown token | 404 | `intake_not_found` |
| Expired token | 410 | `intake_expired` |
| Cross-intake upload | 409 | `upload_intake_mismatch` |
| Already bound | 409 | `intake_already_bound` |
| Ambiguous lead | 409 | `lead_resolution_review_required` |
| Verified lead candidate | 409 | `lead_already_verified` |
| Conflicting lead | 409 | `lead_binding_conflict` |
| Lead missing before OTP | 409 | `lead_attachment_required` |
| Direct intake OTP start | 403 | `intake_otp_wrapper_required` |
| Direct intake OTP verify | 403 | `intake_otp_verification_wrapper_required` |
| Pending verification missing | 409 | `intake_pending_verification_required` |
| Pending verification ambiguous | 409 | `intake_pending_verification_ambiguous` |
| Legacy session-null pending row | 409 | `intake_legacy_verification_forbidden` |
| Verification claim active | 409 | `verification_in_progress` |
| Verification claim expired | 409 | `verification_claim_expired` |
| Verification claim mismatch | 403 | `verification_claim_invalid` |
| Verification finalization conflict | 409 | `verification_finalize_conflict` |
| Verification outcome indeterminate | 409 | `verification_outcome_indeterminate` |
| Phone mismatch | 409 | `intake_phone_mismatch` |
| Lead mismatch | 409 | `intake_lead_mismatch` |
| Scan mismatch | 409 | `intake_scan_mismatch` |
| Direct intake scanner call | 403 | `intake_scan_internal_dispatch_required` |
| Direct raw report RPC | 403 | `report_access_bridge_required` |
| Unsafe PDF | 415 | `unsafe_pdf_content` |
| Encrypted PDF | 415 | `password_protected_pdf` |
| Event persistence pending | 202 | `quote_uploaded_event_pending` |
| Storage unavailable | 503 | `storage_unavailable` |
| Database unavailable | 503 | `intake_temporarily_unavailable` |

Raw infrastructure errors never reach the browser.

An indeterminate verification outcome is never reported to the browser as either success or a
definitive code failure; it is reported as a retryable operational condition once the claim is
released or expired.

---

## 27. Required tests

### 27.1 Same-intake upload binding

- Capability A cannot reference Capability B's upload.
- Composite FK rejects cross-intake accepted-upload assignment.
- Binding RPC rejects cross-intake attempts before mutation.
- Concurrent finalization remains idempotent.

### 27.2 OTP-start security

- Future `/scan` does not call legacy `send-otp`.
- Legacy `send-otp` rejects intake-bound scans.
- OTP-start wrapper accepts no browser scan ID.
- OTP-start wrapper accepts no browser lead ID.
- OTP-start wrapper accepts no phone override.
- Null attached lead fails.
- Conflicting lead fails.
- Canonical phone mismatch fails.
- Exact capability/lead/scan succeeds.
- Pending row is created with exact lead, phone, and non-null scan ID.
- Concurrent OTP-start reservations create no duplicate active pending row.
- The reservation transaction is committed before the Twilio send is attempted.

### 27.3 OTP-verification concurrency and safety

- Future `/scan` does not call legacy `verify-otp`.
- Legacy `verify-otp` rejects intake-bound scans.
- Verification wrapper accepts only intake token and OTP code.
- Missing pending row fails closed.
- Duplicate eligible pending rows fail closed.
- Session-null legacy row fails closed.
- Pending lead mismatch fails closed.
- Pending phone mismatch fails closed.
- Pending scan mismatch fails closed.
- Transaction A commits one active claim before any Twilio call.
- A concurrent second claim returns `verification_in_progress`.
- No test or implementation assumes a row lock survives the Twilio call.
- Claim token is never returned to the browser and never logged.
- Finalization with a wrong claim token fails.
- Finalization with an expired claim fails.
- Finalization when the pending row changed between transactions fails.
- Finalization when the pending row was deleted between transactions fails closed.
- Twilio approval without a successful exact-row update does not return verified success.
- Twilio timeout after claim commit leaves no verified state and permits recovery only after claim
  expiry.
- Approved finalization updates exactly one pending row.
- Approved finalization updates canonical lead verification state atomically.
- Two concurrent attempts cannot both finalize.
- Network failure between Transaction A and Transaction B leaves no verified state.
- Stale claim recovery requires expiry plus full revalidation and issues a new claim token.
- Cross-session verification cannot unlock a report.

### 27.4 Guarded lead resolution

- Existing verified lead fails closed.
- Ambiguous match fails closed.
- `review_required` fails closed.
- Candidate attached to another scan fails closed.
- No candidate creates one unverified lead.
- Safe identical unverified candidate is reused.
- Verified fields are never downgraded.
- Existing native-lead RPC is not called before all guards pass.
- Guard, canonical write, and attachment occur in one transaction.

### 27.5 Protected scanner dispatch

- Public direct call for an intake-bound scan fails before lifecycle mutation.
- Browser-forged provenance fails.
- Missing provenance fails.
- Event-ID mismatch fails.
- Scan-session mismatch fails.
- Valid internal-service provenance succeeds.
- Legacy non-intake scanner behavior remains unchanged.
- Rejected direct calls do not read the file or invoke Gemini.

### 27.6 Tracking eligibility and durability

- Event UUID is stored in the binding transaction.
- Retry reuses the stored UUID.
- `classifyScanGate` terminate path creates no eligibility transition and no outbox row.
- `classifyScanGate` continue/pass path creates exactly one outbox row.
- Outbox eligibility occurs before full deep extraction validation.
- Later deep-extraction failure creates no second event, does not change the stored event ID, and
  does not reverse eligibility.
- Duplicate eligibility call is idempotent.
- Persistence retry uses the same UUID.
- Canonical store contains no duplicate event ID.
- Permanent failure alerts instead of being silently swallowed.
- Browser Lane A remains disabled for intake-v1 without measurement approval.
- When later enabled, browser delivery occurs only after persisted status.
- Browser retry reuses the same UUID.
- Legacy homepage event behavior remains unchanged.

### 27.7 Verify-to-Reveal and report-RPC isolation

- Capability cannot read `full_json`.
- Lead attachment cannot read `full_json`.
- OTP start cannot authorize a report.
- Twilio approval without exact persisted verification cannot authorize a report.
- Cross-session verification cannot unlock.
- Final `get_analysis_full` exact-session predicate remains unchanged.
- `anon` cannot execute raw `get_analysis_full`.
- `authenticated` cannot execute raw `get_analysis_full`.
- `PUBLIC` has no execute on raw `get_analysis_full`.
- `anon` cannot execute raw `get_analysis_preview`.
- `authenticated` cannot execute raw `get_analysis_preview`.
- `PUBLIC` has no execute on raw `get_analysis_preview`.
- Every deployed overload of both RPCs is covered by the same negative tests.
- Production browser code contains no direct preview/full RPC call.
- Preview requests route through `report-access`.
- Full requests route through `report-access`.
- Preview responses contain no `full_json`.
- A browser-supplied mode cannot select a weaker authorization path.
- Possession of `scan_session_id` alone cannot retrieve full-report data.

### 27.8 RLS and Storage

- Direct anonymous quote insert fails after cutover.
- Direct anonymous scan insert fails after cutover.
- Anonymous quote Storage bypass fails after cutover.
- Authenticated quote Storage bypass fails after cutover unless explicitly approved.
- Exact signed upload succeeds.
- Every homepage `UploadZone` caller succeeds after migration.
- Every Nextdoor `UploadZone` caller succeeds after migration.
- Other buckets remain functional.
- Deployed policy state is verified separately from migration history.

### 27.9 Audit privacy

- Unknown audit metadata keys are rejected.
- Tokens cannot be stored.
- OTP claim tokens cannot be stored.
- Filenames cannot be stored.
- Storage paths cannot be stored.
- Contact PII cannot be stored.
- OCR, preview, and report payloads cannot be stored.
- Approved operational metadata persists.

### 27.10 Route truth

- Baseline `/scan` remains documented as unmounted.
- Future route mounting occurs only in an authorized route sprint.
- Future `/scan` uses no browser-selectable enforcement exemption.

---

## 28. M1–M10 rollout

Exact runtime feature-control names are deferred to the authorized implementation sprint.

The implementation must nevertheless support independent disablement of intake minting, intake
finalization, intake scanner dispatch, lead attachment, OTP start, OTP verification, event-outbox
processing, cleanup, and public `/scan` traffic.

### M1 — Governance and proof

- merge governing documents;
- verify target Supabase project;
- audit Storage paths;
- verify canonical event uniqueness in the deployed project;
- inventory raw preview/full RPC grants, default privileges, overloads, and callers;
- define rate-limit persistence;
- define runtime controls;
- design erasure procedure;
- define OTP claim lifetime, expiry semantics, and stale-claim recovery.

### M2 — Dormant schema

- deploy capability, attempt, outbox, audit, and approved rate-limit schema;
- include OTP state and claim columns;
- leave runtime entry points disabled;
- apply no public-route change.

This milestone requires its own explicit authorization. Approving this ADR does not start it.

### M3 — Dark protected functions

- deploy mint, finalize, status, lead attachment, OTP reservation, OTP send-result, OTP claim, OTP
  finalization, outbox worker, and cleanup worker disabled for public traffic;
- deploy no unapproved public route;
- do not remove existing browser report-RPC grants until caller migration is proved.

### M4 — Internal upload and binding

Gates:

- cross-intake claims = 0;
- duplicate quote/scan rows = 0;
- unsupported files accepted = 0;
- audit PII leakage = 0.

### M5 — Internal scanner and event eligibility

Gates:

- unauthorized intake scanner calls succeed = 0;
- `classifyScanGate` terminate-path events = 0;
- `classifyScanGate` continue-path outbox creation ≥ 99%;
- duplicate event identities = 0;
- later deep-extraction failures create no duplicate events and reverse no eligibility.

### M6 — Guarded lead attachment

Gates:

- verified-lead attachment = 0;
- ambiguous automatic attachment = 0;
- cross-session attachment = 0;
- trust downgrades = 0.

### M7 — Protected OTP integration

Gates:

- direct intake `send-otp` bypass success = 0;
- direct intake `verify-otp` bypass success = 0;
- OTP with null lead = 0;
- session-null intake verification success = 0;
- Twilio-only success without persisted row = 0;
- phone or lead mismatch success = 0;
- concurrent successful verification finalizations = 0;
- active-claim bypass success = 0;
- stale claims not recovered within policy = 0;
- exact-session OTP success ≥ 99%.

### M8 — Event outbox and ownership transfer

Gates:

- one stored UUID per intake = 100%;
- canonical persistence ≥ 99.9%;
- silent permanent zero-event rate = 0;
- duplicate canonical events = 0;
- browser Lane A disabled unless measurement amendment is approved.

### M9 — Legacy upload and report-transport migration

- migrate every production `UploadZone` caller;
- verify homepage upload;
- verify Nextdoor upload;
- migrate all production browser report retrieval through `report-access`;
- remove or narrow anonymous and authenticated quote Storage writes;
- remove anonymous canonical-table inserts;
- revoke browser and `PUBLIC` execute grants on raw preview/full RPCs, by exact signature;
- prove unrelated buckets and admin tools remain operational.

### M10 — Canary and progressive rollout

Progression:

```text
1%
→ 10%
→ 50%
→ 100%
```

Expansion requires:

- no security incident;
- no cross-intake binding;
- no unauthorized scanner execution;
- no OTP verification without an exact pending row;
- no concurrent duplicate OTP finalization;
- no verified success from Twilio approval alone;
- no direct browser raw report-RPC execution;
- no pre-OTP `full_json`;
- no duplicate canonical event identity;
- no silent permanent event loss;
- cleanup within SLA;
- rollback rehearsal complete.

---

## 29. Acceptance criteria

ADR-005 is implemented only when:

1. Anonymous users can upload without a pre-upload lead.
2. Tokens are random and hash-only at rest.
3. Browser-selected paths are impossible.
4. Signed exact-path upload is enforced.
5. Cross-intake accepted-upload references are impossible at the database level.
6. Actual bytes and PDF content are validated.
7. Canonical quote/scan binding is atomic.
8. Quote status is `pending`.
9. Scan status is `uploading`.
10. Durable file metadata persists.
11. One UUID-v4 event identity is stored during binding.
12. Intake scanner dispatch is internal-service-only.
13. Event eligibility occurs only after `classifyScanGate` returns its continue/pass path.
14. Event eligibility occurs before full deep extraction validation.
15. Later deep-extraction failure does not create a second event or reverse eligibility.
16. One canonical event is eventually persisted using the stored UUID.
17. Browser delivery, when separately approved, reuses the stored UUID.
18. Browser cannot choose a lead.
19. Existing native-lead RPC is not invoked before guard checks.
20. Lead attachment completes before OTP initiation.
21. Future `/scan` does not call public legacy `send-otp`.
22. Future `/scan` does not call public legacy `verify-otp`.
23. Legacy OTP functions reject intake-bound scans.
24. OTP start reserves one exact pending row with lead, phone, and non-null scan, and commits before
    the Twilio send.
25. OTP verification commits one serialized claim transaction per intake before calling Twilio.
26. No design, code, test, or document assumes a database transaction or lock survives the Twilio
    round-trip.
27. OTP finalization is a separate transaction that conditionally validates the exact claim token,
    claim expiry, and pending row before any state change.
28. Concurrent verification attempts cannot both finalize.
29. Session-null legacy rows cannot verify intake sessions.
30. Twilio approval alone cannot return verified success.
31. Approved finalization updates exactly one pending row and commits before success is returned.
32. Stale claims are recoverable only after expiry and full revalidation, with a new claim token.
33. Intake verification enforces capability, lead, phone, pending row, claim, and exact-session
    agreement.
34. OTP success does not itself authorize `full_json`.
35. `get_analysis_full` remains the final exact-session gate.
36. Production browser traffic cannot execute raw preview/full RPCs.
37. Execute authority on raw preview/full RPCs is revoked from `PUBLIC`, `anon`, and
    `authenticated`, for every deployed signature.
38. Production browser preview/full requests route exclusively through `report-access`.
39. Anonymous canonical-table insertion is removed before public traffic.
40. Every production `UploadZone` caller is migrated before signed-only Storage cutover.
41. Browser quote Storage bypass is removed before public traffic.
42. Audit metadata is allowlisted and contains no secrets or PII.
43. Audit records outlive runtime intake rows.
44. Cleanup never deletes canonical files.
45. `/scan` route truth is accurately documented.
46. Existing homepage and Nextdoor behavior remains intact through deliberate migration.
47. No second scanner, OTP, analysis, or report stack exists.
48. Rate-limit persistence and runtime controls are defined before deployment.
49. Every protected modification receives separate authority.
50. Rollback is tested before public rollout.

---

## 30. Consequences

### Positive

- enables upload-first acquisition;
- closes direct OTP-start abuse for intake sessions;
- closes direct intake OTP-verification bypass;
- serializes verification attempts across an external call using committed claim state rather than
  an impossible cross-boundary lock;
- requires exact pending-row persistence before verified success;
- makes Twilio approval insufficient by construction;
- prevents cross-intake file claims;
- rejects untrusted direct scanner execution;
- prevents raw browser preview/full RPC bypass;
- converts `report-access` from a convention into an enforced boundary;
- provides durable conversion-event identity;
- prevents duplicate canonical event identities;
- replaces baseline silent event loss with a retryable outbox;
- preserves the existing `classifyScanGate` eligibility point exactly;
- preserves exact-session Verify-to-Reveal;
- retains the canonical quote/scan/analysis spine;
- supports deterministic cleanup and rollback;
- prevents secrets and PII from entering intake audit metadata.

### Negative

- requires protected changes to `send-otp`, `verify-otp`, `scan-quote`, report RPC execute grants,
  and `report-access` caller reconciliation;
- requires capability-bound OTP wrappers;
- requires two-transaction OTP verification, adding one extra database round-trip per attempt;
- requires serialized OTP claim state, so an abandoned attempt briefly blocks retry until claim
  expiry;
- requires a guarded lead-resolution wrapper;
- requires a durable event outbox and its worker;
- requires an erasure procedure before sidecar foreign keys;
- requires migration of every production `UploadZone` caller;
- requires migration of every production browser report caller;
- requires Storage, canonical-table, and database-function grant changes;
- rejects raw HEIC/HEIF initially;
- adds operational monitoring;
- requires a separate implementation design for rate-limit persistence and runtime controls.

### Neutral

- does not change Gemini extraction;
- does not change deterministic scoring;
- does not change the final `get_analysis_full` predicate;
- does not create contractor opportunities;
- does not classify verified sales;
- does not change the current `quote_uploaded` optimization value of 250;
- does not migrate `quote_uploaded` from UUID v4 to `wmc_`;
- does not make `quote_uploaded` proof of completed deep extraction;
- does not move the baseline eligibility point;
- does not change legacy non-intake OTP, upload, scanner, or tracking behavior;
- does not assume deployed Supabase state from repository migrations.

---

## 31. Final architectural rule

```text
The intake capability proves only that its holder possesses a short-lived,
server-minted right to upload one exact quote, submit contact information,
initiate capability-bound OTP, verify that OTP through one serialized claim
against one exact pending row, and observe the intake lifecycle.
```

It does not prove identity.
It does not verify a phone by itself.
It does not choose a lead.
It does not authorize report data.
It does not authorize contractor sharing.
It does not establish a verified sale.

The backend must safely resolve and attach one unverified canonical lead before OTP initiation.

The database must prove that an accepted upload belongs to the same intake.

An intake-bound scan may be processed only through authenticated internal-service dispatch.

An intake-bound verification requires one exact pending row whose lead, phone, and non-null scan
session match the capability and canonical records.

**No database transaction, advisory lock, or row lock is assumed to survive an external Twilio
round-trip.**

Verification therefore requires an atomic pre-Twilio claim transaction that commits, then the
external Twilio call with no transaction open, then a separate atomic post-Twilio conditional
finalization transaction. Serialization across that gap is provided by committed claim state.

Twilio approval alone is never sufficient.

`quote_uploaded` eligibility occurs after `classifyScanGate` returns its continue/pass path and
before full deep extraction validation. Later deep-extraction failure never reverses it.

The system must durably reserve one `quote_uploaded` UUID before scanner dispatch and persist that
event idempotently through an outbox.

Production browser preview and full-report requests must route through `report-access`. Raw preview
and full RPCs are not browser interfaces, and their execute grants must be revoked from `PUBLIC`,
`anon`, and `authenticated`.

Verify-to-Reveal remains backend-owned, exact-session-bound, and SMS-verified.

---

## 32. Edge-case register

| Edge case | Governing section |
| --- | --- |
| Concurrent OTP verification attempts | §6.10.2, §6.10.3, §20.10, §27.3 |
| Active OTP claim observed by a second request | §6.10.3, §9, §21.5, §26 |
| Stale OTP claim after abandoned attempt | §6.10.5, §9, §20.10, §24 |
| Twilio timeout after claim commit | §6.10.4, §20.11, §26, §27.3 |
| Twilio approval followed by finalization failure | §6.10.4, §6.10.6, §20.11, §27.3 |
| Pending-row mutation between Transaction A and B | §6.10.4, §20.11, §27.3 |
| Missing pending row | §6.10.2, §26 |
| Duplicate eligible pending rows | §6.10.2, §26 |
| Session-null legacy pending row | §3.6, §6.10.2, §26 |
| Direct intake `scan-quote` invocation | §21.7, §26, §27.5 |
| `classifyScanGate` termination | §3.9, §21.8, §22.1, §27.6 |
| Deep-extraction failure after eligibility | §21.8, §22.1, §22.5, §27.6 |
| Direct raw preview/full RPC invocation | §6.11, §19.2, §26, §27.7 |
| Browser-role execute grants on report RPCs | §3.8, §6.11, §19.2, §28 M9 |
| Missing governing documents | §0.3, §2.1 |
| Deployed-state uncertainty | §0.1, §3.1, §3.8, §11.1, §19.2 |

---

## 33. Baseline evidence appendix

`BASELINE EXECUTABLE CODE` and `BASELINE SCHEMA/POLICY INTENT` at `73a3d7d`.

| Claim | Classification | Evidence location |
| --- | --- | --- |
| `classifyScanGate` returns `continue` or `terminate` | Executable code | `supabase/functions/scan-quote/classificationGate.ts` |
| Terminate path returns before any event persistence | Executable code | `supabase/functions/scan-quote/index.ts`, step 8 gate block |
| `quote_uploaded` persisted immediately after the continue path | Executable code | `supabase/functions/scan-quote/index.ts`, block commented "fires only after the content gate passes" |
| `validateExtraction` runs after that persistence | Executable code | `supabase/functions/scan-quote/index.ts`, step 9 |
| Canonical persistence failure is swallowed as non-fatal | Executable code | `supabase/functions/scan-quote/index.ts`, surrounding try/catch |
| `verify-otp` calls Twilio with `fetch`, then writes separately | Executable code | `supabase/functions/verify-otp/index.ts`, steps 3–6 |
| `verify-otp` pending-row update is guarded by row presence | Executable code | `supabase/functions/verify-otp/index.ts`, step 5 |
| `verify-otp` may fall back to a session-null legacy row | Executable code | `supabase/functions/verify-otp/index.ts`, pending-row selection |
| `send-otp` inserts the pending row after the Twilio send | Executable code | `supabase/functions/send-otp/index.ts` |
| No transaction spans the Twilio call in either function | Executable code | Both functions use independent Supabase client calls around `fetch` |
| `get_analysis_full(uuid, text)` granted to `anon`, `authenticated` | Schema/policy intent | `supabase/migrations/20260428120000_restore_get_analysis_full_strict_scan_binding.sql` |
| No migration revokes execute on `get_analysis_preview` | Schema/policy intent | Absence across `supabase/migrations/**` |
| `report-access` uses the service-role key and strips `full_json` from preview | Executable code | `supabase/functions/report-access/index.ts` |
| `reportService` routes preview/full through `report-access` | Executable code | `src/services/reportService.ts` |
| `phone_verifications.scan_session_id` has no foreign key | Schema/policy intent | `supabase/migrations/20260419175308_*.sql`, `supabase/migrations/20260428120000_*.sql` |
| `phone_verifications` declares a foreign key only on `lead_id` | Schema/policy intent | `supabase/migrations/20260318033459_*.sql` |
| `wm_event_log.event_id` is unique | Schema/policy intent | `supabase/migrations/20260414110000_wm_canonical_event_foundation.sql` |
| `quotes` bucket limit is 10 MiB | Schema/policy intent | `supabase/migrations/20260318033459_*.sql` |
| Scanner default maximum is 15 MiB, overridable by `SCAN_MAX_FILE_BYTES` | Executable code | `supabase/functions/_shared/scannerConfig.ts` |
| Anonymous `quote_files` insert and `anon_insert_scan_sessions` policies exist | Schema/policy intent | `supabase/migrations/20260317051701_*.sql`, `supabase/migrations/20260319224422_*.sql` |
| Anonymous `quotes` bucket upload and upsert policies exist | Schema/policy intent | `supabase/migrations/20260317051701_*.sql`, `supabase/migrations/20260421202348_*.sql` |
| `quote_uploaded` optimization value is 250 | Executable code | `supabase/functions/_shared/tracking/canonical/valueModel.ts` |
| `UploadZone` generates a UUID-v4 `event_id` in the browser | Executable code | `src/components/UploadZone.tsx` |
| `ScanFunnelPage` exists but is unmounted; no `/scan` route | Executable code | `src/pages/ScanFunnelPage.tsx`, `src/App.tsx` |
| `ENFORCE_CONTACT_OWNED_UPLOAD` is referenced by upload bootstrap | Executable code | `supabase/functions/start-upload-scan-session/index.ts` |
| `upsert_native_lead_with_attribution` exists | Schema/policy intent | `supabase/migrations/20260716134535_native_lead_atomic_rpc.sql` |

`DEPLOYED STATE UNKNOWN` — every row above describes repository content at `73a3d7d`. None of it
proves the current state of the target Supabase project.
