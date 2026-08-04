DOC-ONLY WRITE / SINGLE CREATABLE FILE

Create or replace only:

docs/adr/ADR-005-server-minted-quote-intake-capability.md

All other repository paths are read-only.

Do not modify code, migrations, RLS, grants, Storage policies, Edge Functions, generated types, dependencies, secrets, tracking, routing, Git history, or remote systems.

Do not stage, commit, push, merge, deploy, run migrations, generate types, or mutate Supabase.
OVERALL GOAL
Transform the complete ADR-005 V6 source supplied below into ADR-005 V7.

V7 must be an accurate, internally consistent, commit-ready Proposed architecture document.

Do not optimize wording to force a PASS_CONTINUE verdict. Resolve the documented defects according to repository evidence.

A documentation PASS permits saving and committing the ADR only. It does not authorize the Dormant Schema Sprint.
SPRINT OBJECTIVE
Verify the three final V6 findings against baseline repository evidence.

Apply only the bounded documentation corrections required for V7.

Propagate those corrections through every dependent ADR section.

Write the complete V7 document to the target path.

Validate Markdown, internal consistency, and one-file Git scope.

Change no runtime system.
PREVIOUS FINDINGS
Treat these as LOGGED findings to verify:

PostgreSQL transactions and row locks cannot remain active across an Edge Function’s Twilio API round-trip.

Baseline quote_uploaded eligibility occurs after classifyScanGate permits continuation and before full deep extraction validation.

Repository migration intent permits direct browser execution of at least one raw full-report RPC signature, while production architecture requires report-access as the browser bridge.
PREFLIGHT
Expected environment:

Repository: Mongoloyd/wm-mvp

Branch: forensic_report_v2

Local path: C:\Projects\wm-mvp-github-clean

Baseline: 73a3d7daa2677ebf1255ee0e29001011c1de077e

Verify repository, remote, branch, baseline, worktree state, and target-file state using read-only Git inspection.

If repository identity, branch, or baseline cannot be reconciled:

BLOCK_REPAIR — ENVIRONMENT MISMATCH

Write no file.

If the target file contains unrelated operator changes, stop with ASK rather than overwriting them.
REPO TRUTH
Classify material facts as:

BASELINE EXECUTABLE CODE

BASELINE SCHEMA/POLICY INTENT

PROPOSED TARGET CONTRACT

IMPLEMENTATION PREREQUISITE

DEPLOYED STATE UNKNOWN

Do not treat migrations as proof of deployed state.

Do not describe proposed tables, RPCs, Edge Functions, grants, or policies as implemented.
GOVERNING DOCUMENTS
Read:

AGENTS.md

.cursor/PROTECTED_FILES.md

docs/START_HERE.md

docs/architecture/PROTECTED_SYSTEMS.md

docs/architecture/ROUTE_SCAN.md

docs/reveal/VERIFY_TO_REVEAL_CONTRACT.md

docs/db/TABLE_ACCESS_MODEL.md

docs/measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md

docs/tracking/EVENT_OWNERSHIP_MODEL.md

Read ADR-003 and ADR-004 when present.

If route law or supporting ADRs are missing:

retain NEEDS REPO VERIFICATION;

retain implementation blocking;

do not invent their contents;

continue only with this bounded documentation patch.
PROTECTED SYSTEMS
Read-only inspection is permitted for:

supabase/functions/send-otp/index.ts

supabase/functions/verify-otp/index.ts

supabase/functions/report-access/index.ts

supabase/functions/scan-quote/index.ts

supabase/functions/scan-quote/classificationGate.ts

src/services/phoneVerificationService.ts

src/services/reportService.ts

src/hooks/useAnalysisData.ts

src/integrations/supabase/types.ts

Inspect migrations defining:

phone_verifications;

get_analysis_preview;

get_analysis_full;

raw report-RPC execute grants;

wm_event_log.event_id uniqueness.

Do not modify protected files or migrations.
AUTHORITY
Authorized:

inspect repository evidence;

create or replace the target ADR;

correct Markdown and internal references;

add proposed schema and contracts necessary to make V7 internally consistent.

Not authorized:

implement any proposed object;

alter runtime behavior;

change grants, policies, functions, or schemas;

begin the Dormant Schema Sprint;

claim deployed verification.
ALLOWED FILES
Writable

docs/adr/ADR-005-server-minted-quote-intake-capability.md

Read-only
Every other path.
DO NOT TOUCH
Do not modify:

src/**;

supabase/functions/**;

supabase/migrations/**;

generated types;

route configuration;

current tracking contracts;

package or lock files;

environment files;

CI configuration;

Git index or history.
TASK 1 — OTP CLAIM AND FINALIZATION PROTOCOL
Remove every implication that one database transaction or row lock surrounds the Twilio API round-trip.

Define:
Transaction A — serialized claim
One atomic service-role RPC transaction must:

hash and resolve the intake capability;

lock the capability;

lock the exact canonical scan and lead;

select and lock the exact pending verification row;

validate exact capability, lead, canonical phone, non-null scan, pending state, and expiry;

reject missing, duplicate, session-null, or conflicting rows;

reject an active unexpired claim;

generate an internal cryptographic claim token;

store:

pending-row ID;

claim token;

claim timestamp;

claim expiry;

OTP state claimed;

increment the attempt count;

commit.

The internal claim token is never returned to the browser.
External Twilio call
The protected Edge Function calls Twilio only after Transaction A commits.

No database transaction or row lock is assumed to survive the call.

Concurrent requests observing an active claim fail closed with:

verification_in_progress

Transaction B — compare-and-set finalization
One second atomic service-role RPC transaction must:

lock the capability and exact pending row;

require the exact stored claim token;

require an unexpired claim;

require unchanged pending state, lead, canonical phone, and exact scan;

conditionally process the Twilio result.

For approval:

update exactly one pending row to verified;

persist verified_at;

update canonical verified-lead state required by the existing OTP contract;

set capability OTP state to verified;

clear claim state;

require affected-row count of exactly one;

commit;

return verified: true only after commit.

For denial, timeout, or indeterminate outcome:

do not mark verification successful;

clear or expire the claim according to policy;

record only a sanitized error code;

allow retry only after safe claim release or expiry.

Define stale-claim recovery under a locked database transaction.

Propagate this protocol consistently through:

decision;

prerequisites;

architecture flow;

security invariants;

scope;

OTP enum and capability schema;

RPC contracts;

Edge Function contracts;

failures;

tests;

rollout;

acceptance criteria;

consequences;

final architectural rule.
TASK 2 — EXACT EVENT ELIGIBILITY POINT
Verify baseline scanner ordering.

Define:

quote_uploaded eligibility occurs after classifyScanGate returns

its continue/pass path and before full deep extraction validation.

“Full deep extraction validation” means later:

extraction;

normalization;

deterministic validation;

analysis persistence;

grading.

Required behavior:

classifyScanGate terminate path creates no eligibility transition or outbox row;

continue/pass path creates or reuses one idempotent outbox row;

deeper scanner processing continues afterward;

later extraction failure does not:

generate another event;

change the stored event ID;

retroactively reverse eligibility.

Apply the same boundary to:

architecture flow;

quote_uploaded meaning;

scanner callback;

outbox eligibility RPC;

tests;

rollout;

acceptance criteria;

consequences;

final architectural rule.

Do not redefine quote_uploaded as proof of completed extraction or report readiness.
TASK 3 — RAW PREVIEW/FULL RPC BROWSER ISOLATION
Verify repository grant intent and current report-access architecture.

Define the sole production browser transport as:

browser

→ report-access Edge Function

→ service-role database client

→ approved preview/full RPC

Prohibit:

browser

→ raw get_analysis_preview RPC



browser

→ raw get_analysis_full RPC

Require the implementation sprint to:

inventory exact deployed RPC signatures and overloads;

inventory all browser, admin, test, and Edge Function callers;

migrate every production browser caller to report-access;

revoke execute from:

PUBLIC;

anon;

authenticated;

grant execute only to:

service_role; or

another separately approved non-browser role;

preserve the exact-session predicate in get_analysis_full;

ensure preview responses contain no full_json;

reject browser-selected authorization modes;

test direct raw-RPC rejection.

Do not claim the grant changes have been executed.

Propagate this contract through:

decision;

prerequisites;

architecture layers;

security invariants;

scope;

RLS and grants;

service-role RPCs;

report-access;

failure semantics;

tests;

rollout;

acceptance criteria;

consequences;

final architectural rule.
EDGE CASES
V7 must address:

concurrent OTP verification attempts;

active and stale OTP claims;

Twilio timeout after claim commit;

Twilio approval followed by finalization failure;

pending-row mutation between transactions;

missing, duplicate, or session-null pending rows;

direct intake scan-quote invocation;

classifyScanGate termination;

deep-extraction failure after eligibility;

direct raw preview/full RPC invocation;

browser-role execute grants;

missing governing documents;

deployed-state uncertainty.
TRACKING
Preserve:

UUID-v4 intake event identity;

one stored event ID per intake;

eligibility after classifyScanGate passes;

eligibility before full deep extraction validation;

one idempotent outbox row;

at-least-once persistence with event-ID deduplication;

browser Lane A disabled unless measurement law is amended;

current optimization value unchanged.

Do not reintroduce deterministic wmc_ for intake quote_uploaded.
VALIDATION
After writing V7:

inspect the complete target file;

confirm all Markdown fences are balanced;

confirm all internal references resolve;

confirm no stale V5 or V6 revision label remains;

confirm Status: Proposed;

confirm implementation remains blocked;

confirm no lock is claimed across Twilio;

confirm Transaction A, Twilio, and Transaction B are separately defined;

confirm claim concurrency and stale recovery are covered;

confirm classifyScanGate timing is consistent everywhere;

confirm raw browser preview/full RPC execution is prohibited;

confirm report-access is the sole production browser bridge;

confirm grant changes are described as proposed;

confirm no proposed object is described as implemented;

inspect Git diff and status;

confirm the target ADR is the only modified path.

Do not run builds, tests, migrations, deployments, or type generation.
BINARY DONE CRITERIA
The sprint passes only when:

Repository, branch, and baseline are reconciled.

Complete V6 source was used.

Only the target ADR changed.

V7 defines a committed claim transaction before Twilio.

V7 defines a separate conditional finalization transaction after Twilio.

No database lock is claimed across Twilio.

Concurrent claims cannot both finalize.

Twilio approval alone cannot return verified success.

quote_uploaded eligibility follows classifyScanGate.

Eligibility precedes full deep extraction validation.

Later deep-extraction failure does not reverse eligibility.

Raw browser preview/full RPC execution is prohibited.

report-access is the sole production browser bridge.

Execute-grant reconciliation remains an implementation prerequisite.

Verify-to-Reveal remains unchanged.

The ADR remains Proposed and implementation-blocked.

Markdown and references validate.

No code, database, Supabase, tracking, deployment, or Git-history mutation occurred.
FINAL REPORT
Return:

target file created or replaced;

sections materially changed;

validation checklist with PASS/FAIL;

remaining implementation prerequisites;

Git status and diff scope;

explicit confirmation that no other file or system changed.

Do not stage or commit.


COMPLETE ADR-005 V6 SOURCE
[# ADR-005: Server-Minted Quote-Intake Capability and Private Upload

Target save path: docs/adr/ADR-005-server-minted-quote-intake-capability.md

Revision: V7 — Commit-Ready Final

Date: 2026-08-04

Status: Proposed

Decision owner: WindowMan Architecture

Scope: Quote-first /scan intake perimeter

Repository: Mongoloyd/wm-mvp

Target branch: forensic_report_v2

Repository-truth baseline: 73a3d7daa2677ebf1255ee0e29001011c1de077e

Document readiness: Commit-ready Proposed architecture contract, subject to final read-only repository comparison

Implementation readiness: Blocked pending the prerequisites in §2


1. Decision
WindowMan will implement a server-minted, high-entropy, short-lived quote-intake capability for the future /scan route.

The intake capability is a narrowly scoped bearer credential that permits an anonymous browser to:

request one exact-path signed upload authorization;

upload one supported quote document into the existing private quotes Storage bucket;

finalize and validate that exact Storage object;

cause the backend to create or idempotently reuse one canonical quote_files row;

cause the backend to create or idempotently reuse one canonical scan_sessions row;

queue that exact scan session through the existing scan-quote pipeline using authenticated internal-service provenance;

poll an allowlisted lifecycle projection for that exact intake;

submit contact values to a protected backend operation;

cause the backend—not the browser—to resolve and attach one canonical unverified lead;

initiate OTP only through a capability-bound backend contract;

verify OTP only through a capability-bound, serialized claim-and-finalize contract requiring one exact pending verification row;

request report preview or full-report data only through the protected report-access Edge Function;

receive the full Truth Report only after the existing backend exact-session reveal predicate succeeds.

The capability does not permit the browser to:

supply or select a lead_id;

supply or select a quote_file_id;

supply or select a scan_session_id;

supply or select an accepted_upload_id;

supply or select a phone-verification-row ID;

select an arbitrary Storage path;

list or read private quote objects;

insert directly into quote_files;

insert directly into scan_sessions;

read analyses directly;

read phone_verifications directly;

execute get_analysis_preview directly;

execute get_analysis_full directly;

read OCR contact evidence through the lifecycle-status contract;

read protected homeowner PII through the lifecycle-status contract;

read preview_json through a raw database RPC;

read or authorize full_json through a raw database RPC;

invoke the legacy OTP-start or OTP-verification transport for an intake-bound scan;

invoke scan-quote directly for an intake-bound scan;

claim phone ownership;

claim OTP verification;

submit trusted lifecycle states;

submit verification Booleans;

claim event eligibility or persistence;

request a route or authorization bypass;

create contractor opportunities;

classify a quote as a verified sale;

write outcome or consent truth.

The capability is an upload airlock.

It is not:

an authenticated homeowner account;

a durable identity session;

proof that the uploader owns the document;

proof that an extracted phone belongs to the uploader;

proof that user-confirmed contact data is verified;

phone-verification authority;

report-reveal authority;

contractor-sharing consent;

a verified-sale classification.


2. Authority and implementation gate
This ADR defines proposed architecture and database contracts.

It does not authorize:

migrations;

SQL execution;

RLS changes;

database-function grant changes;

Storage-policy changes;

Edge Function changes;

OTP changes;

scanner changes;

tracking changes;

generated-type changes;

secret creation or rotation;

Supabase deployment;

production mutation;

Git staging, commit, push, pull request, merge, or deployment.

Implementation remains blocked until all of the following are true:

docs/architecture/PROTECTED_SYSTEMS.md is merged and canonical.

docs/architecture/ROUTE_SCAN.md is merged and canonical.

docs/adr/ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md is merged and canonical.

docs/adr/ADR-004-quote-disposition-and-ledger-layer-separation.md is merged and canonical.

The branch, migrations, generated types, policies, grants, Edge Functions, browser call sites, and deployed Supabase target are reconciled.

The deployed value of ENFORCE_CONTACT_OWNED_UPLOAD is established.

Every browser quotes Storage upload caller is inventoried.

Every anonymous or browser insert path into quote_files and scan_sessions is inventoried.

Existing quote_files.storage_path duplicates are audited and resolved.

Current quote_files columns are reconciled with the proposed metadata additions.

Current production Storage policies and grants are inspected directly in the target Supabase project.

Current production execute grants for:

get_analysis_preview;

get_analysis_full;

related raw report RPCs

are inspected directly in the target Supabase project.

All browser call sites for preview and full-report retrieval are inventoried.

Production browser report traffic is proved to route exclusively through report-access.

The existing verify-otp lead-integrity guard is accepted as a hard constraint:

it resolves the lead through scan_sessions.lead_id;

it fails when that lead is null;

lead attachment must complete before OTP initiation.

The existing send-otp contract is accepted as unsafe for intake-v1:

it accepts browser-provided phone and scan identifiers;

it does not require an attached canonical lead;

it does not prove the requested phone belongs to that lead;

browser sequencing cannot secure this boundary.

A protected capability-bound OTP-start contract is approved.

A protected capability-bound OTP-verification contract is approved.

Direct legacy send-otp and verify-otp requests for intake-bound scans are rejected.

Intake verification requires one exact pending phone_verifications row whose:

lead_id;

phone_e164;

non-null scan_session_id;

and pending status

match the capability and canonical scan.

Twilio approval alone can never return verified: true.

Session-null legacy pending verification rows are forbidden for intake-bound verification.

OTP verification uses the two-transaction serialized claim protocol in §§6.10, 20.10–20.11, and 21.5.

No design assumes that a PostgreSQL row lock survives an Edge Function RPC return or external Twilio API round-trip.

The guarded lead resolver defined by this ADR is approved.

public.upsert_native_lead_with_attribution is not treated as guard-safe for initial intake resolution.

The existing get_analysis_full exact-session authorization predicate is preserved.

Direct production-browser execution of raw preview and full-report RPCs is removed.

report-access is preserved as the sole production browser bridge for preview and full-report retrieval.

Canonical event-store uniqueness and lookup by event_id are verified.

The quote_uploaded ownership and outbox protocol is approved by the measurement owner.

Event eligibility is accepted as occurring:

after classifyScanGate returns its continue/pass path;

before full deep extraction validation.

Browser Lane A ownership remains disabled unless the canonical measurement contract is explicitly amended.

The current quote_uploaded optimization value is reconciled with the canonical measurement contract.

The 10 MiB intake limit is reconciled with the scanner’s 15 MiB baseline code default and deployed environment configuration.

The erasure procedure in §18 is implemented and tested.

Exact rate-limit persistence objects and runtime feature-control names are defined in a separately authorized implementation sprint.

A separately authorized implementation sprint identifies:

exact files;

exact migrations;

exact RPC signatures;

exact Edge Functions;

exact protected OTP, scanner, reveal-bridge, and grant changes;

exact tests;

exact Supabase project;

blast radius;

rollback;

deployment sequence.

If any prerequisite remains unresolved, implementation must stop with:

NEEDS REPO VERIFICATION



At baseline 73a3d7d, prerequisites 1–4 are unavailable. Existing protected authority is provided by AGENTS.md and .cursor/PROTECTED_FILES.md.



3. Context and repository truth

WindowMan is a Verify-to-Reveal quote-intelligence system.

The target sequence is:

anonymous intake

→ private quote upload

→ canonical quote_files

→ canonical scan_sessions

→ protected scan-quote dispatch

→ classifyScanGate passes

→ quote_uploaded eligibility

→ deep extraction and validation continue

→ analyses

→ safe proof-of-read

→ contact confirmation

→ guarded canonical lead attachment

→ capability-bound OTP start

→ capability-bound OTP verification claim

→ Twilio verification

→ atomic conditional OTP finalization

→ report-access

→ get_analysis_full

→ backend-authorized full Truth Report



3.1 Existing canonical systems

At baseline 73a3d7d, the repository contains:

private quotes Storage configuration in repository migrations;

a 10 MiB Storage bucket limit in repository migrations;

repository bucket MIME allowances for:

PDF;

JPEG;

PNG;

WebP;

HEIC;

quote_files;

scan_sessions;

analyses;

phone_verifications;

start-upload-scan-session;

scan-quote;

send-otp;

verify-otp;

report-access;

get_analysis_preview;

get_analysis_full;

upsert_native_lead_with_attribution;

scan_sessions.quote_file_id UNIQUE;

canonical wm_event_log.event_id uniqueness.

Repository migrations establish checked-in schema and policy intent. They do not prove current deployed Supabase state.

3.2 Current /scan state

At baseline:

ScanFunnelPage.tsx exists as unmounted scaffolding;

it would render the visual-only PreUploadIntake;

src/App.tsx does not register a /scan route;

a request to /scan falls through to NotFound.

The production browser upload path remains the existing UploadZone flow used by homepage and Nextdoor surfaces.

ADR-005 defines a future /scan perimeter. It does not describe an existing production route.

3.3 Current upload perimeter

The current browser flow includes:

browser-generated scope;

browser-selected Storage path;

direct browser upload to quotes;

subsequent invocation of start-upload-scan-session;

browser-accessible retry and context operations.

The target intake capability replaces that authority model for /scan.

3.4 Current Storage posture

Repository migrations configure quotes as private, but repository policy history still contains browser write authority, including:

"Allow anonymous uploads to quotes bucket";

"Allow anonymous upsert updates to quotes bucket";

authenticated upload and update policies;

table-level SELECT, INSERT, and UPDATE grants on storage.objects to anon;

corresponding grants to authenticated.

The signed-only posture in this ADR is a target state.

3.5 Current canonical-table posture

Repository migrations still permit anonymous insertion through policies including:

"Allow anonymous insert on quote_files";

anon_insert_scan_sessions.

Therefore:

The browser cannot create canonical quote or scan rows



is a target enforcement requirement, not current executable truth.

3.6 Current OTP perimeter

Current send-otp accepts browser-provided phone and scan-session identifiers without proving:

the scan exists;

the scan has an attached lead;

the phone belongs to that lead;

the caller possesses the matching intake capability.

Current verify-otp:

may fall back to a session-null legacy pending row;

obtains Twilio approval independently of whether an exact pending row is available;

updates a pending row only when one was found;

may otherwise reach a success response without persisting the exact verified row required by the intended intake contract.

ADR-005 therefore requires both:

start-quote-intake-otp

verify-quote-intake-otp



as protected capability-bound wrappers around shared canonical OTP logic.

3.7 Verification schema qualification

At baseline:

phone_verifications.scan_session_id



is a UUID column but does not have a baseline foreign key to scan_sessions.

Intake verification must therefore enforce exact scan-session consistency through:

protected RPC checks;

serialized capability state;

exact pending-row identity;

claim tokens;

conditional updates;

capability equality;

canonical lead equality;

canonical phone equality.

This ADR does not assume referential integrity that the baseline schema does not provide.

3.8 Current report-RPC grant posture

Repository migration intent includes direct execute authority for browser roles on at least the current get_analysis_full signature.

That grant posture conflicts with the target production transport law:

browser

→ report-access

→ service-role RPC execution



ADR-005 therefore requires explicit execute-grant reconciliation.

Repository migration history does not prove current deployed grants.

3.9 Current scanner event timing

At baseline, canonical quote_uploaded persistence occurs:

after classifyScanGate permits processing to continue;

before full deep extraction validation completes.

ADR-005 preserves that semantic boundary.

It does not redefine quote_uploaded as proof that:

all extracted fields are valid;

deep extraction completed;

an analysis was persisted;

a grade exists;

the report is revealable.



4. Business driver

The quote-ready homeowner should not complete a contact form before uploading an estimate.

The intended experience is:

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



Reduced friction cannot permit:

unrestricted anonymous writes;

arbitrary Storage paths;

forged lifecycle state;

arbitrary OTP initiation;

verification without an exact pending row;

concurrent duplicate OTP finalization;

untrusted direct scanner execution;

direct browser execution of raw report RPCs;

cross-session access;

duplicate quote records;

cross-intake file claims;

orphaned uploads;

uncontrolled scanner cost;

duplicate canonical event identities;

silent permanent event loss;

OCR-derived phone verification.

4.1 HEIC and HEIF limitation

Baseline repository migrations configure the private quotes bucket to allow image/heic.

Deployed bucket configuration remains unknown until the target Supabase project is inspected.

Sprint 2 intake does not support HEIC/HEIF.

Required behavior:

reject declared HEIC/HEIF before minting;

validate actual bytes after upload;

reject raw HEIC/HEIF even if Storage accepted them;

show a specific recovery message;

suggest screenshot, PDF, or JPEG conversion;

never relabel HEIC bytes as JPEG;

never send unsupported HEIC bytes to Gemini.

Production HEIC/HEIF conversion is deferred to the mobile-upload sprint.



5. Layered architecture

Layer

Name

Owns

Never owns

L1

UI

File selection, progress, contact input, OTP-code input, recovery messaging

Canonical IDs, lifecycle truth, verification truth

L2

Client state

In-memory token, same-tab recovery, advisory validation

Persistence, authorization, canonical ownership

L3

Protected services

Token minting, signed upload, byte validation, quarantine, lead resolution, OTP wrappers, trusted scanner dispatch, outbox delivery, report-access

Deterministic scoring, direct raw report authorization

L4

Database authority

Constraints, RLS, atomic binding, same-intake enforcement, lead attachment, OTP reservations and claims, conditional verification finalization, event outbox, audit

Rendering, Twilio calls, Storage-byte parsing

L5

Reveal authority

Exact verified state, report-access, get_analysis_preview, get_analysis_full

Trust in browser assertions or direct browser RPC execution



Authority flow:

L1/L2

→ untrusted user input



L3

→ authenticated service action and validated data



L4

→ authoritative persistence and relational proof



L5

→ service-role preview/full retrieval

→ exact-session authorization and reveal





6. Non-negotiable security invariants

6.1 Verify-to-Reveal

full_json must never be:

selected for an unauthorized request;

returned;

preloaded;

cached;

logged;

browser-stored;

placed in the DOM;

or transmitted to the browser

before backend exact-session SMS OTP authorization.

6.2 Exact-session isolation

A verification associated with one lead, phone, quote, or scan cannot unlock another scan session.

The reveal predicate must continue to require agreement among:

requested scan session;

canonical scan-session lead;

canonical lead;

phone-verification lead;

phone-verification scan session;

verified phone;

backend verified state.

6.3 Browser distrust

The browser cannot provide trusted:

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



6.4 Trust tiers

OCR-proposed

< user-confirmed

< backend-attached unverified lead

< backend exact-session SMS verified



Only the final tier may authorize full reveal.

6.5 Canonical spine

The system reuses:

quote_files

→ scan_sessions

→ analyses



ADR-005 does not create a second quote, scanner, OTP, analysis, or report stack.

6.6 Lead attachment ordering

A provisional intake may initially have null lead references.

Before OTP initiation:

the browser submits contact values only;

the protected service validates and normalizes those values;

the guarded resolver resolves or creates one safe unverified lead;

the database attaches that lead to:

the exact quote file;

the exact scan session;

all analyses for that exact scan;

the intake capability;

only then may the capability-bound OTP-start wrapper invoke Twilio.

6.7 Lead attachment is not verification

Attachment does not:

set phone_verified;

set phone_verified_at;

create a verified verification row;

authorize full_json;

unlock another scan.

6.8 Guarded lead resolution is mandatory

At baseline, upsert_native_lead_with_attribution is not guard-safe for initial intake resolution because it may mutate candidate lead data before the caller can reject:

verified leads;

ambiguous matches;

review_required;

conflicting identity;

different scan bindings.

The existing native-lead RPC is not currently part of the OTP/reveal path. Under ADR-005, it may be used only as a downstream canonical writer after all intake guard decisions succeed.

A protected pre-mutation guard wrapper must:

normalize contact deterministically;

locate candidate leads without mutation;

lock candidate rows;

reject:

more than one viable candidate;

ambiguity;

review_required;

existing backend-verified phone state;

conflicting normalized phone or email;

attachment to another active scan;

conflicting quote, scan, analysis, or capability lead;

call the canonical writer only after candidate safety is established;

create a new unverified lead when no safe candidate exists;

preserve verified fields;

never downgrade existing trust;

attach the resolved lead in the same database transaction while candidate locks remain active.

6.9 Capability-bound OTP start

/scan must not invoke the existing public send-otp contract directly.

The protected operation:

start-quote-intake-otp



must use a two-phase reservation-and-delivery protocol.

Phase A — atomic reservation

One database transaction must:

accept the intake token and no canonical IDs;

hash the token;

resolve and lock the capability;

resolve and lock the exact canonical scan;

resolve and lock the attached lead;

require a non-null attached lead;

require identical lead binding across:

capability;

quote file;

scan session;

analyses;

derive the phone from canonical lead state;

reject a browser phone override;

reject an existing unexpired active OTP-start reservation;

insert or reserve one exact pending verification row containing:

canonical lead_id;

canonical phone_e164;

exact non-null scan_session_id;

status = 'pending';

store that pending-row ID on the capability;

set capability OTP state to pending;

commit.

Phase B — Twilio send

After Phase A commits:

invoke shared internal Twilio-send logic using the server-derived phone;

never assume Phase A row locks remain held;

record send success or failure through a separate conditional database operation;

preserve the same pending-row identity;

prevent a second active reservation through capability locking and state checks.

The existing public send-otp endpoint must reject a direct request when the requested scan is intake-bound.

6.10 Capability-bound OTP verification

/scan must not invoke the existing public verify-otp contract directly.

The protected operation:

verify-quote-intake-otp



must accept only:

intake token;

OTP code.

It must not accept a trusted:

scan-session ID;

lead ID;

phone;

verification-row ID;

claim token;

verification Boolean.

A database row lock cannot be held across:

RPC return

→ Edge Function execution

→ Twilio API round-trip

→ second RPC



The verification contract therefore uses two atomic database transactions separated by the Twilio call.

Transaction A — serialized verification claim

The claim transaction must:

hash the intake token;

resolve and lock the capability;

require a non-null attached lead;

resolve and lock the exact canonical scan;

resolve and lock the canonical lead;

select and lock the exact pending verification row identified by the capability;

require that row to have:

status = 'pending';

lead_id = capability.lead_id;

phone_e164 = canonical lead phone;

non-null scan_session_id = capability.scan_session_id;

reject:

missing pending rows;

duplicate eligible pending rows;

session-null legacy rows;

phone mismatch;

lead mismatch;

scan mismatch;

expired or revoked capability;

reject an existing unexpired verification claim;

create a cryptographically unpredictable internal claim token;

store:

exact pending-row ID;

claim token;

claim timestamp;

claim-expiration timestamp;

OTP state claimed;

increment the verification-attempt counter;

commit atomically.

The internal claim token is never returned to the browser.

External Twilio verification

After Transaction A commits:

the Edge Function calls Twilio using the server-derived canonical phone and submitted OTP code;

no database lock is assumed to remain held;

concurrent verification attempts observe the stored active claim and fail closed with verification_in_progress;

the Edge Function retains the internal claim token only in protected process memory.

Transaction B — conditional finalization

A second database transaction must:

resolve and lock the capability;

resolve and lock the exact pending verification row;

require:

capability OTP state is claimed;

stored claim token equals the protected caller’s claim token;

claim is unexpired;

stored pending-row ID matches the row being finalized;

row status remains pending;

row lead, phone, and scan still match canonical state;

process the Twilio outcome.

When Twilio approves:

update the exact pending row from pending to verified;

persist verified_at;

persist canonical lead verification fields required by the existing OTP contract;

persist capability OTP state verified;

clear the active claim token;

persist otp_verified_at;

require the exact verification-row update count to equal one;

require all canonical verification updates to succeed;

commit atomically;

return verified: true only after commit.

When Twilio denies:

keep or restore the row to the approved retryable pending state;

clear the claim;

record a sanitized failure code;

enforce the attempt limit;

commit;

return no verified success.

When Twilio or network processing is indeterminate:

call the conditional finalizer with an indeterminate outcome where possible;

clear or expire the claim according to policy;

never mark the row verified;

permit safe retry only after claim release or expiration.

A stale claim may be reclaimed only after:

its expiration time has passed;

a database transaction locks the capability;

the pending row remains pending;

canonical lead, phone, and scan still match.

Twilio approval alone must never produce:

{

  "verified": true

}



unless Transaction B successfully updates exactly one expected pending row and commits all canonical verification state.

The existing public verify-otp endpoint must reject direct verification for an intake-bound scan.

6.11 Raw report-RPC browser isolation

Production browser traffic must not execute raw preview or full-report RPCs directly.

The sole production browser transport is:

browser

→ report-access Edge Function

→ service-role database client

→ get_analysis_preview or get_analysis_full



Required rules:

get_analysis_preview and get_analysis_full execute grants must be reconciled using their exact deployed signatures.

Direct execute authority must be revoked from:

PUBLIC;

anon;

authenticated.

Required execute authority is granted only to service_role or another separately approved non-browser database role.

Browser code must not call:

supabase.rpc('get_analysis_preview', ...);

supabase.rpc('get_analysis_full', ...).

Browser code must use the approved report service that invokes report-access.

report-access must:

use the service-role client;

enforce preview/full mode;

enforce exact-session verification before full retrieval;

prevent full_json from being included in preview responses;

return sanitized errors.

Possession of scan_session_id remains insufficient for full-report authorization.

Route guards, CSS hiding, client state, and localStorage remain non-authoritative.

Repository migration intent currently includes browser-role execute authority for at least one full-report RPC signature. That authority must be removed before public /scan traffic.

6.12 New intake SECURITY DEFINER functions

Every new intake SECURITY DEFINER function must:

use a fixed search_path;

avoid dynamic SQL;

be revoked from PUBLIC, anon, and authenticated;

be granted only to service_role;

never identify the invoker through current_user.

This rule is scoped to new ADR-005 intake functions.

The baseline repository contains existing functions that use current_user. This ADR does not authorize modifying those unrelated functions.



7. Scope

7.1 In scope

random intake tokens;

token hashing;

exact-path signed upload;

10 MiB intake limit;

MIME and magic-byte validation;

PDF quarantine;

durable file metadata;

same-intake accepted-upload enforcement;

canonical quote and scan binding;

protected lifecycle status;

guarded lead resolution;

atomic lead attachment;

capability-bound OTP start;

OTP-start pending-row reservation;

capability-bound OTP verification;

serialized verification claims;

conditional post-Twilio verification finalization;

direct legacy OTP rejection for intake scans;

direct public scanner rejection for intake scans;

raw preview/full RPC browser isolation;

report-access as sole browser report bridge;

durable event identity;

transactional event outbox;

classifyScanGate event-eligibility boundary;

anonymous canonical-table lockdown;

signed-only quotes Storage cutover;

migration of every production UploadZone caller;

cleanup and retention;

route-specific enforcement separation.

7.2 Out of scope

OCR contact-candidate schema;

contact-confirmation UI;

quote outcome;

contractor consent;

contractor dispatch;

market ledgers;

multi-file upload;

production HEIC decoding;

authenticated homeowner accounts;

deterministic scoring changes;

replacement of get_analysis_full;

replacement of the final exact-session reveal predicate;

recovery for an already verified lead;

changes to the current quote_uploaded optimization value;

exact rate-limit persistence schema;

final runtime feature-control names.

7.3 Deferred implementation contracts

This ADR defines normative abuse limits and rollout behavior, but intentionally does not invent:

the rate-limit persistence table name;

the rate-limit RPC name;

network-subject hashing schema;

scheduler implementation;

final runtime feature-control names.

A future authorized implementation sprint must define those objects, their RLS, privacy guarantees, tests, and rollback before runtime use.



8. Lifecycle enums

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





9. Intake lifecycle

Primary path:

minted

→ uploading

→ uploaded

→ validating

→ bound

→ scan_queued

→ consumed



Recoverable and terminal branches:

minted/uploading/uploaded/validating

→ abandoned | expired | rejected



Lead attachment is not a lifecycle state.

It is represented by:

lead_id

lead_attached_at



OTP-start eligibility requires:

state IN ('bound', 'scan_queued', 'consumed')

AND lead_id IS NOT NULL

AND lead_attached_at IS NOT NULL

AND capability is not expired or revoked

AND otp_state IN ('idle', 'failed', 'expired')



OTP-verification eligibility requires:

otp_state = 'pending'

AND otp_pending_verification_id IS NOT NULL

AND capability is not expired or revoked





10. Token and idempotency contract

10.1 Token generation

Generate 32 cryptographically random bytes server-side.

function createRandomIntakeToken(): string {

  const bytes = new Uint8Array(32);

  crypto.getRandomValues(bytes);



  return btoa(String.fromCharCode(...bytes))

    .replaceAll("+", "-")

    .replaceAll("/", "_")

    .replaceAll("=", "");

}



The token is not derived from the idempotency key.

10.2 Hash-at-rest

token_hash = SHA-256(raw_token)



The raw token is never:

persisted;

logged;

tracked;

placed in a URL;

placed in dataLayer;

placed in audit metadata;

included in a Storage path.

10.3 Idempotency key

idempotency_key_hash =

HMAC-SHA-256(

  INTAKE_IDEMPOTENCY_SECRET,

  normalized UUID-v4 idempotency key

)



The idempotency hash locates replayed mint requests. It does not derive the bearer token.

10.4 Replay

A repeated idempotency key must also present the original token.

Without it:

409 Conflict



{

  "ok": false,

  "code": "idempotency_token_required"

}



10.5 Browser storage

Preferred:

in-memory



Permitted for same-tab recovery:

sessionStorage



Forbidden:

localStorage

URL query

URL fragment

dataLayer

event_logs

console

third-party error payload





11. File contract

11.1 Intake limit

10 MiB

10,485,760 bytes



Enforced at:

browser advisory preflight;

mint validation;

Storage configuration;

Storage metadata inspection;

actual downloaded byte length before binding.

Baseline scanner code has a 15 MiB default, overridable through:

SCAN_MAX_FILE_BYTES



The deployed value is unknown.

The scanner’s broader or environment-overridden ceiling does not redefine intake eligibility.

An intake object above 10 MiB must not reach scanner dispatch.

11.2 Supported types

Allowed:

PDF;

JPEG;

PNG;

WebP.

Rejected:

HEIC;

HEIF;

SVG;

HTML;

ZIP;

Office files;

executables;

encrypted PDFs;

active-content PDFs.

11.3 Storage path

intake/{intake_id}/{upload_id}.{extension}



The path contains no:

PII;

original filename;

lead ID;

token;

scan-session ID;

contractor identity.

11.4 Filename

The backend stores a sanitized filename as protected canonical metadata.

The filename is never used as:

object-path authority;

telemetry;

audit metadata;

contractor-facing data.



12. PDF quarantine

Before scanner dispatch, PDFs must be inspected with a parser capable of traversing indirect and compressed objects.

Reject at minimum:

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



Results:

passed

failed

indeterminate



failed and indeterminate do not reach Gemini.

A regex-only scan is insufficient.



13. Canonical quote_files metadata

Proposed additive columns:

ALTER TABLE public.quote_files

  ADD COLUMN IF NOT EXISTS file_name text,

  ADD COLUMN IF NOT EXISTS file_size bigint,

  ADD COLUMN IF NOT EXISTS mime_type text,

  ADD COLUMN IF NOT EXISTS content_sha256 bytea;



Canonical creation status remains:

pending



Storage-path duplicate audit:

SELECT storage_path, count(*)

FROM public.quote_files

GROUP BY storage_path

HAVING count(*) > 1;



After remediation:

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS

  quote_files_storage_path_uidx

ON public.quote_files (storage_path);



The concurrent index must run outside a transaction block.



14. Capability table

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



The event UUID is minted once inside the canonical binding transaction.

Retries reuse the stored UUID.

The OTP pending-row ID is a protected correlation identifier.

No baseline foreign key from the capability to phone_verifications is assumed. Exact pending-row integrity is enforced transactionally by the OTP RPC contracts.



15. Upload-attempt same-intake enforcement

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



The capability-to-accepted-attempt relation must enforce same-intake ownership:

ALTER TABLE public.quote_intake_capabilities

  ADD CONSTRAINT quote_intake_accepted_upload_same_intake_fk

  FOREIGN KEY (id, accepted_upload_id)

  REFERENCES public.quote_intake_upload_attempts (

    intake_id,

    id

  )

  ON DELETE NO ACTION

  DEFERRABLE INITIALLY DEFERRED;



This proves:

capability.id

=

accepted upload attempt.intake_id



A capability cannot claim another intake’s upload attempt.

The binding RPC must independently verify the same relationship under row locks.



16. Durable event outbox

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



The payload uses a strict allowlist.

Allowed keys are limited to approved non-PII event fields such as:

event_id;

event_name;

intake_id;

quote_file_id;

scan_session_id;

client_slug;

route or flow identifier;

approved attribution fields;

validated MIME type;

validated file-size bucket;

classifyScanGate eligibility timestamp.

Forbidden keys and values include:

intake token;

token hash;

signed upload token;

signed upload URL;

raw IP address;

full user agent;

original or sanitized filename;

Storage path;

name;

email;

phone;

address;

ZIP when treated as contact PII;

contractor identity;

OCR text;

extracted contact candidates;

preview_json;

full_json;

report grade;

report flags.

The outbox payload must be created server-side from an explicit allowlist. It must not accept arbitrary browser JSON.



17. Immutable audit

CREATE TABLE public.quote_intake_audit_events (

  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),



  intake_id uuid NOT NULL,

  upload_id uuid,



  event_name text NOT NULL,



  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,



  created_at timestamptz NOT NULL DEFAULT now()

);



Service role receives only:

GRANT SELECT, INSERT

ON public.quote_intake_audit_events

TO service_role;



UPDATE and DELETE are prohibited through grants and a mutation-denial trigger.

17.1 Audit metadata allowlist

Audit metadata may contain only non-PII operational facts from an explicit server-side allowlist, including:

reason code;

previous state;

next state;

attempt number;

validated MIME type;

file-size bucket;

quarantine result;

parser result code;

event state;

OTP state;

retry count;

HTTP status class;

service operation name;

boolean indicators that do not reveal PII.

Correlation UUIDs should use dedicated columns where available rather than arbitrary metadata.

17.2 Audit metadata denylist

Audit metadata must never contain:

raw intake token;

token hash;

idempotency key;

signed upload token;

signed upload URL;

raw IP address;

full user agent;

original filename;

sanitized filename;

Storage path;

name;

email;

phone;

address;

postal code when tied to a person;

contractor identity;

raw file bytes;

OCR output;

extracted contact candidates;

confirmation-form contents;

OTP code;

OTP verification claim token;

Twilio request or verification payload;

preview_json;

full_json;

report grade;

report findings;

report flags.

The audit writer must reject non-allowlisted metadata keys.

Retention:

capability: 90 days;

upload attempt: 90 days;

persisted outbox row: 90 days;

audit event: minimum 365 days.



18. Deletion and erasure contract

The baseline canonical spine cascades through lead-owned records.

The proposed intake sidecar uses RESTRICT references to:

canonical lead;

canonical quote file;

canonical scan session.

This intentionally prevents canonical deletion while an intake sidecar remains.

Before these foreign keys are deployed, a protected erasure procedure must:

locate dependent intake capabilities;

revoke active capabilities;

invalidate or resolve active OTP claims;

preserve immutable audit events;

remove unaccepted Storage objects;

resolve or explicitly abandon pending event-outbox rows;

delete or archive eligible outbox rows;

delete upload attempts;

delete capability rows;

then delete canonical lead, quote, scan, analysis, and verification records under the approved canonical deletion contract.

The procedure must support:

data-subject erasure;

operator deletion;

QA cleanup;

automated tests;

lead merge or replacement;

partial-failure retry.

Because baseline:

phone_verifications.scan_session_id



has no foreign key to scan_sessions, the erasure procedure must explicitly locate and delete or retain verification rows according to the approved retention policy. It must not rely on a nonexistent scan-session cascade.

Deploying the sidecar RESTRICT foreign keys without this erasure procedure is prohibited.



19. RLS, grants, and browser-isolation target

19.1 New intake tables

All new intake tables must:

enable RLS;

force RLS;

expose no anon policy;

expose no authenticated policy;

revoke browser table privileges;

grant required access only to service_role.

19.2 Raw preview/full RPC isolation

Before public /scan traffic:

inventory exact deployed signatures for:

get_analysis_preview;

get_analysis_full;

any compatibility or overloaded report RPC;

inventory every browser, test, admin, and Edge Function caller;

migrate production browser callers to report-access;

revoke direct execute authority on raw preview/full RPCs from:

PUBLIC;

anon;

authenticated;

grant execute only to:

service_role; or

another separately approved non-browser database role;

verify report-access uses the authorized role;

verify no browser bundle contains direct raw preview/full RPC execution.

Repository migration intent currently includes browser-role execute authority for at least one get_analysis_full signature.

The exact deployed state remains unknown until inspected.

The grant cutover must preserve:

production browser

→ report-access

→ exact authorized database RPC



It must prohibit:

production browser

→ raw get_analysis_preview RPC



production browser

→ raw get_analysis_full RPC



19.3 Canonical tables

Before public /scan traffic, remove:

DROP POLICY IF EXISTS

  "Allow anonymous insert on quote_files"

ON public.quote_files;



DROP POLICY IF EXISTS

  anon_insert_scan_sessions

ON public.scan_sessions;



Also revoke any supporting direct anonymous insertion privileges.

Equivalent authenticated browser-write paths must be inventoried and removed or narrowed when present.

19.4 Storage cutover

Before public /scan traffic, remove or narrow:

DROP POLICY IF EXISTS

  "Allow anonymous uploads to quotes bucket"

ON storage.objects;



DROP POLICY IF EXISTS

  "Allow anonymous upsert updates to quotes bucket"

ON storage.objects;



Authenticated quote upload and upsert policies must also be inventoried.

Current table-level grants on storage.objects must be inventoried.

Global revocation may affect unrelated buckets and cannot occur without an all-bucket policy and caller audit.

19.5 Mandatory UploadZone migration

At baseline, UploadZone is the browser quotes uploader used by:

homepage flows;

Nextdoor flows.

Direct legacy quote uploads cannot coexist with a globally signed-only quotes posture.

Before quote-bucket anonymous or authenticated write policies are removed or narrowed, every production UploadZone caller must be migrated to:

an approved exact-path signed upload contract; or

another non-bypassable backend-owned transport satisfying the same security properties.

Route names are not policy authority.

Leaving broad policies in place for homepage compatibility would allow /scan users to bypass the capability contract.

Removing those policies before migrating every UploadZone caller would break existing production upload behavior.

The cutover must be atomic at the release level:

all production quote upload callers migrated

→ negative bypass tests pass

→ broad quote Storage policies removed or narrowed

→ raw report RPC browser grants removed

→ public /scan traffic enabled



Final acceptance requires:

No grant-plus-policy combination permits browser bypass

of the signed intake contract for the quotes bucket.



No execute grant permits browser bypass

of the report-access bridge for preview or full-report retrieval.





20. Service-role RPC contracts

All RPC names are proposed.

20.1 mint_quote_intake_v1

Creates or resolves one capability by idempotency hash.

20.2 issue_quote_intake_upload_v1

Creates one exact-path upload attempt.

20.3 mark_quote_intake_uploaded_v1

Marks the expected Storage object as present but untrusted.

20.4 bind_quote_intake_upload_v1

The binding RPC:

locks capability and upload attempt;

verifies same-intake ownership;

validates file facts and quarantine status;

inserts quote_files with:

status = 'pending';

protected file metadata;

inserts scan_sessions with:

status = 'uploading';

capability attribution;

capability client_slug;

capability query_params;

mints one UUID-v4 quote_uploaded_event_id;

stores that UUID on the capability;

marks event state reserved;

binds quote and scan;

commits atomically.

Canonical scan creation preserves the existing unique scan_sessions.quote_file_id constraint.

20.5 mark_quote_intake_scan_queued_v1

Verifies exact stored scan binding before transition.

20.6 get_quote_intake_status_v1

Returns only:

intake state;

scan state;

analysis state;

preview_ready;

lead_attached;

otp_start_allowed;

otp_verification_pending;

otp_verification_in_progress;

event state;

retryability;

sanitized error code.

It returns no:

PII;

canonical lead ID;

Storage path;

OCR output;

preview payload;

full report payload;

OTP claim token.

20.7 intake_attach_lead_v1

Input:

p_token_hash

p_contact



No canonical IDs are accepted.

The RPC or its protected orchestration wrapper must use the mandatory pre-mutation lead guard.

It attaches the same lead to:

capability;

quote file;

scan session;

all analyses for that exact scan.

It fails closed on:

ambiguity;

verified lead state;

review_required;

conflicting identity;

conflicting scan binding;

conflicting canonical lead references.

20.8 reserve_quote_intake_otp_start_v1

Input:

p_token_hash



This RPC implements OTP-start Transaction A.

It must:

lock capability, quote, scan, lead, and relevant analyses;

derive canonical phone;

reject conflicting or already verified state;

reject an existing active pending verification;

create one exact pending verification row;

store that row ID on the capability;

set capability OTP state to pending;

commit atomically.

Returns only to the protected OTP-start service:

canonical phone;

masked phone;

pending-row ID;

exact scan-session ID;

server-owned send idempotency context.

The browser receives none of the canonical identifiers.

20.9 mark_quote_intake_otp_send_result_v1

Input:

p_token_hash

p_pending_verification_id

p_send_outcome

p_sanitized_error_code



Service-role only.

It must:

lock capability and exact pending row;

verify the stored pending-row ID;

reject mismatched lead, phone, or scan;

record successful delivery initiation or sanitized failure;

never mark the phone verified;

preserve safe retry semantics;

commit atomically.

20.10 claim_quote_intake_otp_verification_v1

Input:

p_token_hash



This RPC implements verification Transaction A.

It must:

lock capability, canonical scan, canonical lead, and exact pending row;

require capability OTP state pending, or an expired stale claim eligible for safe recovery;

validate exact lead, phone, scan, and pending status;

reject missing, duplicate, session-null, or conflicting rows;

reject an active unexpired claim;

generate a cryptographically unpredictable internal claim token;

store:

pending-row ID;

claim token;

claim timestamp;

claim expiry;

OTP state claimed;

increment the attempt count;

commit atomically.

Returns only to the protected OTP-verification service:

canonical phone;

exact pending-row ID;

internal claim token;

claim expiry.

The claim token is never returned to the browser.

20.11 finalize_quote_intake_otp_verification_v1

Input:

p_token_hash

p_claim_token

p_twilio_outcome

p_sanitized_error_code



This RPC implements verification Transaction B.

It must:

lock capability, exact pending row, canonical scan, and canonical lead;

require:

OTP state claimed;

exact claim-token equality;

unexpired claim;

exact pending-row identity;

pending-row status remains pending;

exact lead, phone, and scan equality;

process the Twilio outcome.

For an approved outcome:

update exactly one pending row to verified;

persist verified_at;

persist canonical verified-lead fields required by the existing OTP contract;

set capability OTP state verified;

set otp_verified_at;

clear claim fields;

require the pending-row affected count to equal one;

commit atomically;

return verified success only after commit.

For a denied or transient outcome:

do not mark the row verified;

clear or expire the claim according to policy;

record a sanitized failure code;

return the capability to a safe retryable or terminal state;

commit atomically.

20.12 mark_quote_uploaded_eligible_v1

Called only from trusted scan-quote execution immediately after:

classifyScanGate

→ continue/pass path



and before full deep extraction validation.

Input:

p_scan_session_id

p_event_id

p_payload



It:

resolves the capability by scan session;

verifies p_event_id equals the stored event ID;

validates the payload against an explicit allowlist;

requires that classifyScanGate permitted processing to continue;

transitions event state from reserved to eligible;

inserts one outbox row;

treats duplicate invocation as idempotent success;

commits atomically.

The operation does not assert that:

deep extraction validation passed;

analysis persistence completed;

a grade exists;

report preview is available.

20.13 Event-outbox claim and acknowledgement

A worker claims rows with:

FOR UPDATE SKIP LOCKED



After canonical event persistence, it must verify that the canonical event store contains the exact event ID before marking the outbox row persisted.

A transient persistence error remains retryable.

An event cannot be marked persisted solely because an HTTP request returned success.

20.14 Report-access bridge contract

Production preview and full-report retrieval must use:

report-access



The Edge Function must:

accept only allowlisted request fields;

resolve preview or full mode server-side;

use a service-role database client;

call the exact approved preview or full RPC signature;

enforce exact-session verification before full retrieval;

ensure preview responses contain no full_json;

return no raw database error;

prevent browser-selected authorization modes from weakening the predicate.

No intake RPC defined by ADR-005 returns preview_json or full_json.



21. Edge Function contracts

All function names are proposed.

21.1 mint-quote-intake

Accepts advisory file metadata and returns:

intake token;

exact Storage path;

signed upload token;

expirations.

21.2 finalize-quote-intake

It:

validates the actual Storage object;

computes digest;

quarantines PDF content;

calls atomic binding;

receives the durably stored UUID event ID;

dispatches scan-quote with trusted internal-service provenance and the stored UUID;

returns lifecycle status.

It does not persist or mark quote_uploaded eligible before classifyScanGate passes.

21.3 attach-quote-intake-lead

Accepts:

intake token;

contact values only.

It returns:

lead_attached: true



It returns no lead ID.

21.4 start-quote-intake-otp

Accepts:

intake token only



It does not accept:

scan-session ID;

lead ID;

phone override;

verification Boolean.

Sequence:

call reserve_quote_intake_otp_start_v1;

receive server-derived phone and pending-row identity;

commit the reservation before Twilio;

call shared internal Twilio-send logic;

call mark_quote_intake_otp_send_result_v1;

return masked destination, request status, and retry information.

No database lock is assumed to survive the Twilio call.

21.5 verify-quote-intake-otp

Accepts:

intake token;

OTP code.

It does not accept:

scan-session ID;

lead ID;

phone;

verification-row ID;

claim token;

verification Boolean.

Sequence:

call claim_quote_intake_otp_verification_v1;

receive:

server-derived canonical phone;

exact pending-row ID;

internal claim token;

commit Transaction A before Twilio;

call Twilio verification;

call finalize_quote_intake_otp_verification_v1 with:

intake token hash context;

protected internal claim token;

Twilio outcome;

return verified: true only when Transaction B reports committed verified success.

The Edge Function must not:

assume database locks survive the Twilio call;

call Twilio before the claim transaction commits;

return verified success when finalization fails;

expose the claim token;

retry finalization with a different claim token;

fall back to a session-null legacy row.

Concurrent requests with an active unexpired claim return:

verification_in_progress



A stale claim is recoverable only through the database rules in §6.10.

21.6 Legacy OTP guards

Existing send-otp must reject direct public OTP initiation when the requested scan is intake-bound:

intake_otp_wrapper_required



Existing verify-otp must reject direct public OTP verification when the requested scan is intake-bound:

intake_otp_verification_wrapper_required



Legacy non-intake behavior remains unchanged unless separately authorized.

21.7 Protected scan-quote dispatch

When a requested scan_session_id is linked to quote_intake_capabilities, scan-quote must reject any untrusted direct invocation.

The rejection must occur before:

scan lifecycle mutation;

private file retrieval;

Gemini invocation;

analysis mutation;

event eligibility;

event persistence.

Intake scans may be dispatched only through an approved authenticated internal-service contract.

Trusted provenance must include:

source fixed to intake-v1;

exact intake identifier;

exact scan-session identifier;

stored quote_uploaded_event_id.

scan-quote must independently verify:

the caller is authorized as an internal service;

the intake exists;

the scan belongs to that intake;

the provided event ID equals the stored event ID.

Browser-supplied provenance is never honored.

When intake provenance is missing, forged, expired, or inconsistent:

403 intake_scan_internal_dispatch_required



The function must not fall through to legacy scanner processing or legacy event persistence for an intake-bound scan.

Legacy non-intake scanner callers remain governed by their existing contract.

21.8 Scanner event-eligibility callback

For an authorized intake scan:

execute the existing early document-classification path;

call classifyScanGate;

when the gate terminates:

do not mark quote_uploaded eligible;

do not create an outbox row;

when the gate returns its continue/pass path:

call mark_quote_uploaded_eligible_v1;

create or reuse the one outbox row;

continue into full deep extraction and validation.

A later deep-extraction failure does not retroactively invalidate quote_uploaded.

21.9 Event-outbox worker

The worker:

claims pending rows;

invokes canonical event persistence;

uses the stored UUID;

verifies durable event presence by event ID;

marks persisted;

retries transient failures;

alerts on terminal failure.

21.10 Cleanup worker

The worker:

claims due rows safely;

deletes orphan objects through the Storage API;

never deletes directly from storage.objects;

preserves canonical accepted files;

preserves immutable audit records.

The exact scheduler, function name, rate-limit persistence schema, and runtime feature-control names are deferred to the authorized implementation sprint.

21.11 report-access

Production browser report requests must call report-access.

The browser must not call raw preview or full-report RPCs.

report-access must remain the only production browser bridge to those database functions.



22. quote_uploaded ownership and semantics

22.1 Event meaning and exact eligibility point

For intake-v1, quote_uploaded becomes eligible only when:

file passed intake upload validation

AND

canonical quote/scan binding committed

AND

scan-quote classifyScanGate returned its continue/pass path



Eligibility occurs immediately after classifyScanGate passes and before full deep extraction validation.

It does not require:

completion of all deep extraction;

successful deterministic field validation;

analysis-row persistence;

a complete grade;

preview readiness;

report reveal readiness.

It does not fire when classifyScanGate terminates the scan as non-qualifying at that early gate.

A failure that occurs after the early gate—during deeper extraction, normalization, deterministic validation, or later analysis persistence—does not retroactively invalidate the quote_uploaded event.

22.2 Event-ID format

Executable baseline upload behavior uses opaque UUID-v4 event IDs.

ADR-005 preserves UUID v4.

It does not migrate quote_uploaded to deterministic wmc_.

The UUID is moved from browser generation to server-side binding and stored durably.

The existing scanner input boundary may accept a broader nonempty string type. Intake-v1 narrows its own contract to the stored UUID-v4 value.

22.3 Delivery guarantee

Universal exactly-once delivery across distributed browser, server, and advertising systems is not promised.

ADR-005 guarantees:

one canonical event identity per intake;

one durable UUID stored before scanner dispatch;

one eligibility transition after classifyScanGate passes;

one outbox row per intake;

idempotent canonical persistence by event ID;

retries reuse the same UUID;

optional browser delivery reuses the same UUID;

downstream delivery is at-least-once with event-ID deduplication.

Prohibited states are:

two canonical event identities for one intake

silent permanent loss of the canonical event

event eligibility before classifyScanGate passes



22.4 Existing emitters

Surface

Baseline role

Intake-v1 treatment

UploadZone.tsx

Browser UUID generation and Lane A fire

Not used by future /scan; no global suppression

start-upload-scan-session

CRM lead activity

Not called by future /scan; no global suppression

scan-quote

Canonical event persistence after early classification gate

Shared path; intake event ownership moves to stored UUID plus outbox



22.5 Trusted scanner eligibility

For an authorized intake dispatch:

scan-quote executes the existing early classification logic;

classifyScanGate determines whether processing terminates or continues;

only the continue/pass path may call mark_quote_uploaded_eligible_v1;

the callback occurs before full deep extraction validation;

scan-quote skips its legacy direct quote_uploaded persistence block for that intake;

full extraction, deterministic validation, analysis writes, scoring, flags, and report processing continue afterward;

later extraction failure does not delete or reverse the already eligible quote_uploaded event.

An untrusted direct call for an intake-bound scan is rejected before mutation.

22.6 Browser Lane A measurement policy

Browser Lane A for intake-v1 is a proposed mirror, not currently authorized measurement ownership.

It remains disabled unless:

the measurement owner explicitly approves it;

docs/measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md is amended;

tracking ownership documentation is reconciled;

browser and server use the same stored UUID;

duplicate-delivery tests pass;

consent requirements are satisfied.

Canonical server persistence must not depend on browser delivery.

When browser Lane A remains disabled, the server-owned canonical event and approved server routing remain authoritative.

When later approved, the browser may call trackConversion only after status confirms:

quote_uploaded_event_state = 'persisted'



Refresh or retry must reuse the same stored UUID.

22.7 Optimization value

ADR-005 does not change the current optimization-value policy.

At baseline, the canonical helper assigns:

quote_uploaded = 250



Any value change belongs to a separate measurement decision.



23. Operational telemetry

Lane A:

trackConversion

→ window.dataLayer

→ GTM

→ approved browser/server routing



Lane B:

trackEvent

→ Supabase event_logs

→ diagnostics



Lane B may report non-PII operational events such as:

mint failure;

validation failure;

quarantine failure;

guarded lead-resolution rejection;

OTP reservation conflict;

OTP verification claim conflict;

stale OTP claim recovery;

direct OTP bypass attempt;

direct scanner bypass attempt;

raw report-RPC bypass attempt;

event-outbox retry;

cleanup failure;

rate-limit trigger.

Lane B contains no:

tokens;

claim tokens;

filenames;

Storage paths;

contact values;

OTP codes;

OCR text;

preview payload;

report payload.



24. Cleanup and retention

The cleanup worker claims rows through:

FOR UPDATE SKIP LOCKED



Storage deletion uses the Storage API, never direct SQL against storage.objects.

Retry schedule:

15 minutes

1 hour

6 hours

24 hours

24 hours



Retention:

Record

Retention

Capability

90 days

Upload attempt

90 days

Persisted outbox row

90 days

Audit event

minimum 365 days

Rate-limit record

implementation sprint must define; target operational window 48 hours

Canonical quote/file

canonical quote-retention policy



Canonical accepted files are never deleted by orphan cleanup.

Expired OTP claims must be cleared or transitioned through protected cleanup before capability deletion.



25. Normative abuse limits

Operation

Limit

Mint per network subject

5 per 10 minutes

Mint per network subject

20 per day

Concurrent unbound intakes

3

Upload attempts per intake

3

Finalize attempts per intake

6 per hour

Contact-attachment attempts

5 per hour

OTP-start attempts per intake

5 per hour

OTP-start attempts per network subject

20 per hour

Concurrent OTP-verification claims per intake

1

OTP-verification attempts per intake

implementation sprint must align with existing OTP policy

OTP claim lifetime

implementation sprint must define a short bounded duration

Status polls per intake

60 per 5 minutes

File size

10 MiB

Signed upload lifetime

10 minutes

Upload-authority lifetime

30 minutes

Status/contact/OTP authority lifetime

24 hours



These are normative policy limits.

The implementation sprint must define:

persistence schema;

atomic consumption behavior;

subject hashing;

privacy controls;

claim-expiry duration;

stale-claim recovery;

expiry cleanup;

tests;

final runtime configuration;

final feature-control names.

Rate limiting fails closed where the protected operation cannot safely distinguish allowed from disallowed traffic.



26. Failure semantics

Condition

HTTP

Code

Invalid request

400

invalid_request

Unsupported file

415

unsupported_file_type

HEIC/HEIF

415

heic_not_supported

Oversize

413

file_too_large

Unknown token

404

intake_not_found

Expired token

410

intake_expired

Cross-intake upload

409

upload_intake_mismatch

Already bound

409

intake_already_bound

Ambiguous lead

409

lead_resolution_review_required

Verified lead candidate

409

lead_already_verified

Conflicting lead

409

lead_binding_conflict

Lead missing before OTP

409

lead_attachment_required

Direct intake OTP start

403

intake_otp_wrapper_required

Direct intake OTP verify

403

intake_otp_verification_wrapper_required

Pending verification missing

409

intake_pending_verification_required

Pending verification ambiguous

409

intake_pending_verification_ambiguous

Legacy session-null pending row

409

intake_legacy_verification_forbidden

Verification claim active

409

verification_in_progress

Verification claim expired

409

verification_claim_expired

Verification claim mismatch

403

verification_claim_invalid

Verification finalization conflict

409

verification_finalize_conflict

Phone mismatch

409

intake_phone_mismatch

Lead mismatch

409

intake_lead_mismatch

Scan mismatch

409

intake_scan_mismatch

Direct intake scanner call

403

intake_scan_internal_dispatch_required

Direct raw report RPC

403

report_access_bridge_required

Unsafe PDF

415

unsafe_pdf_content

Encrypted PDF

415

password_protected_pdf

Event persistence pending

202

quote_uploaded_event_pending

Storage unavailable

503

storage_unavailable

Database unavailable

503

intake_temporarily_unavailable



Raw infrastructure errors never reach the browser.



27. Required tests

27.1 Same-intake upload binding

Capability A cannot reference Capability B’s upload.

Composite FK rejects cross-intake accepted-upload assignment.

Binding RPC rejects cross-intake attempts before mutation.

Concurrent finalization remains idempotent.

27.2 OTP-start security

Future /scan does not call legacy send-otp.

Legacy send-otp rejects intake-bound scans.

OTP-start wrapper accepts no browser scan ID.

OTP-start wrapper accepts no browser lead ID.

OTP-start wrapper accepts no phone override.

Null attached lead fails.

Conflicting lead fails.

Canonical phone mismatch fails.

Exact capability/lead/scan succeeds.

Pending row is created with exact lead, phone, and non-null scan ID.

Concurrent OTP-start reservations create no duplicate active pending row.

Twilio send occurs only after reservation commit.

27.3 OTP-verification concurrency and safety

Future /scan does not call legacy verify-otp.

Legacy verify-otp rejects intake-bound scans.

Verification wrapper accepts only intake token and OTP code.

Missing pending row fails closed.

Duplicate eligible pending rows fail closed.

Session-null legacy row fails closed.

Pending lead mismatch fails closed.

Pending phone mismatch fails closed.

Pending scan mismatch fails closed.

Transaction A creates one active claim.

A concurrent second claim returns verification_in_progress.

No row lock is assumed to survive the Twilio call.

Claim token is never returned to the browser.

Finalization with a wrong claim token fails.

Finalization with an expired claim fails.

Finalization when the pending row changed fails.

Twilio approval without successful exact-row update does not return verified success.

Approved finalization updates exactly one pending row.

Approved finalization updates canonical lead verification state atomically.

Network failure leaves no verified state.

Stale claim recovery requires expiry and revalidation.

Cross-session verification cannot unlock a report.

27.4 Guarded lead resolution

Existing verified lead fails closed.

Ambiguous match fails closed.

review_required fails closed.

Candidate attached to another scan fails closed.

No candidate creates one unverified lead.

Safe identical unverified candidate is reused.

Verified fields are never downgraded.

Existing native-lead RPC is not called before all guards pass.

Guard, canonical write, and attachment occur in one transaction.

27.5 Protected scanner dispatch

Public direct call for an intake-bound scan fails before lifecycle mutation.

Browser-forged provenance fails.

Missing provenance fails.

Event-ID mismatch fails.

Scan-session mismatch fails.

Valid internal-service provenance succeeds.

Legacy non-intake scanner behavior remains unchanged.

Rejected direct calls do not read the file or invoke Gemini.

27.6 Tracking eligibility and durability

Event UUID is stored in the binding transaction.

Retry reuses the stored UUID.

classifyScanGate terminate path creates no outbox row.

classifyScanGate continue/pass path creates one outbox row.

Outbox eligibility occurs before full deep extraction validation.

Later deep-extraction failure does not create a second event or reverse eligibility.

Duplicate eligibility call is idempotent.

Persistence retry uses the same UUID.

Canonical store contains no duplicate event ID.

Permanent failure alerts.

Browser Lane A remains disabled without measurement approval.

When later enabled, browser delivery occurs only after persisted status.

Browser retry reuses the same UUID.

Legacy homepage event behavior remains unchanged.

27.7 Verify-to-Reveal and report-RPC isolation

Capability cannot read full_json.

Lead attachment cannot read full_json.

OTP start cannot authorize a report.

Twilio approval without exact persisted verification cannot authorize a report.

Cross-session verification cannot unlock.

Final get_analysis_full exact-session predicate remains unchanged.

anon cannot execute raw get_analysis_full.

authenticated cannot execute raw get_analysis_full.

anon cannot execute raw get_analysis_preview.

authenticated cannot execute raw get_analysis_preview.

Production browser code contains no direct preview/full RPC call.

Preview requests route through report-access.

Full requests route through report-access.

Preview responses contain no full_json.

Possession of scan_session_id alone cannot retrieve full-report data.

27.8 RLS and Storage

Direct anonymous quote insert fails after cutover.

Direct anonymous scan insert fails after cutover.

Anonymous quote Storage bypass fails after cutover.

Authenticated quote Storage bypass fails after cutover unless explicitly approved.

Exact signed upload succeeds.

Every homepage UploadZone caller succeeds after migration.

Every Nextdoor UploadZone caller succeeds after migration.

Other buckets remain functional.

Deployed policy state is verified separately from migration history.

27.9 Audit privacy

Unknown audit metadata keys are rejected.

Tokens cannot be stored.

OTP claim tokens cannot be stored.

Filenames cannot be stored.

Storage paths cannot be stored.

Contact PII cannot be stored.

OCR, preview, and report payloads cannot be stored.

Approved operational metadata persists.

27.10 Route truth

Baseline /scan remains documented as unmounted.

Future route mounting occurs only in an authorized route sprint.

Future /scan uses no browser-selectable enforcement exemption.



28. M1–M10 rollout

Exact runtime feature-control names are deferred to the authorized implementation sprint.

The implementation must nevertheless support independent disablement of:

intake minting;

intake finalization;

intake scanner dispatch;

lead attachment;

OTP start;

OTP verification;

event-outbox processing;

cleanup;

public /scan traffic.

M1 — Governance and proof

merge governing documents;

verify target Supabase project;

audit Storage paths;

verify canonical event uniqueness;

inventory raw preview/full RPC grants and callers;

define rate-limit persistence;

define runtime controls;

design erasure procedure;

design OTP claim expiry and recovery.

M2 — Dormant schema

deploy capability, attempt, outbox, audit, and approved rate-limit schema;

include OTP state and claim columns;

leave runtime entry points disabled;

apply no public-route change.

M3 — Dark protected functions

deploy mint, finalize, status, lead attachment, OTP reservation, OTP claim, OTP finalization, outbox worker, and cleanup worker disabled for public traffic;

deploy no unapproved public route;

do not remove existing browser report-RPC grants until caller migration is proved.

M4 — Internal upload and binding

Gates:

cross-intake claims = 0;

duplicate quote/scan rows = 0;

unsupported files accepted = 0;

audit PII leakage = 0.

M5 — Internal scanner and event eligibility

Gates:

unauthorized intake scanner calls succeed = 0;

classifyScanGate terminate-path events = 0;

classifyScanGate continue-path outbox creation ≥ 99%;

duplicate event identities = 0;

later deep-extraction failures create no duplicate events.

M6 — Guarded lead attachment

Gates:

verified-lead attachment = 0;

ambiguous automatic attachment = 0;

cross-session attachment = 0;

trust downgrades = 0.

M7 — Protected OTP integration

Gates:

direct intake send-otp bypass success = 0;

direct intake verify-otp bypass success = 0;

OTP with null lead = 0;

session-null intake verification success = 0;

Twilio-only success without persisted row = 0;

phone or lead mismatch success = 0;

concurrent successful verification finalizations = 0;

active-claim bypass success = 0;

exact-session OTP success ≥ 99%.

M8 — Event outbox and ownership transfer

Gates:

one stored UUID per intake = 100%;

canonical persistence ≥ 99.9%;

silent permanent zero-event rate = 0;

duplicate canonical events = 0;

browser Lane A disabled unless measurement amendment is approved.

M9 — Legacy upload and report-transport migration

migrate every production UploadZone caller;

verify homepage upload;

verify Nextdoor upload;

migrate all production browser report retrieval through report-access;

remove or narrow anonymous and authenticated quote Storage writes;

remove anonymous canonical-table inserts;

revoke browser execute grants on raw preview/full RPCs;

prove unrelated buckets and admin tools remain operational.

M10 — Canary and progressive rollout

Progression:

1%

→ 10%

→ 50%

→ 100%



Expansion requires:

no security incident;

no cross-intake binding;

no unauthorized scanner execution;

no OTP verification without an exact pending row;

no concurrent duplicate OTP finalization;

no direct browser raw report-RPC execution;

no pre-OTP full_json;

no duplicate canonical event identity;

no silent permanent event loss;

cleanup within SLA;

rollback rehearsal complete.



29. Acceptance criteria

ADR-005 is implemented only when:

Anonymous users can upload without a pre-upload lead.

Tokens are random and hash-only at rest.

Browser-selected paths are impossible.

Signed exact-path upload is enforced.

Cross-intake accepted-upload references are impossible at the database level.

Actual bytes and PDF content are validated.

Canonical quote/scan binding is atomic.

Quote status is pending.

Scan status is uploading.

Durable file metadata persists.

One UUID-v4 event identity is stored during binding.

Intake scanner dispatch is internal-service-only.

Event eligibility occurs only after classifyScanGate passes.

Event eligibility occurs before full deep extraction validation.

One canonical event is eventually persisted using the stored UUID.

Browser delivery, when separately approved, reuses the stored UUID.

Browser cannot choose a lead.

Existing native-lead RPC is not invoked before guard checks.

Lead attachment completes before OTP initiation.

Future /scan does not call public legacy send-otp.

Future /scan does not call public legacy verify-otp.

Legacy OTP functions reject intake-bound scans.

OTP start creates one exact pending row with lead, phone, and non-null scan.

OTP verification uses one serialized active claim per intake.

No design assumes database locks survive the Twilio round-trip.

OTP finalization conditionally validates the exact claim and pending row.

Session-null legacy rows cannot verify intake sessions.

Twilio approval alone cannot return verified success.

Approved finalization updates exactly one pending row.

Intake verification enforces capability, lead, phone, pending row, claim, and exact-session agreement.

OTP success does not itself authorize full_json.

get_analysis_full remains the final exact-session gate.

Production browser traffic cannot execute raw preview/full RPCs.

Production browser preview/full requests route exclusively through report-access.

Anonymous canonical-table insertion is removed before public traffic.

Every production UploadZone caller is migrated before signed-only Storage cutover.

Browser quote Storage bypass is removed before public traffic.

Audit metadata is allowlisted and contains no secrets or PII.

Audit records outlive runtime intake rows.

Cleanup never deletes canonical files.

/scan route truth is accurately documented.

Existing homepage and Nextdoor behavior remains intact through deliberate migration.

No second scanner, OTP, analysis, or report stack exists.

Rate-limit persistence and runtime controls are defined before deployment.

Every protected modification receives separate authority.

Rollback is tested before public rollout.



30. Consequences

Positive

enables upload-first acquisition;

closes direct OTP-start abuse for intake sessions;

closes direct intake OTP-verification bypass;

serializes verification attempts across external Twilio calls;

requires exact pending-row persistence before verified success;

prevents cross-intake file claims;

rejects untrusted direct scanner execution;

prevents raw browser preview/full RPC bypass;

preserves report-access as the report bridge;

provides durable conversion-event identity;

prevents duplicate canonical event identities;

prevents silent permanent event loss;

preserves the existing classifyScanGate eligibility point;

preserves exact-session Verify-to-Reveal;

retains the canonical quote/scan/analysis spine;

supports deterministic cleanup and rollback;

prevents secrets and PII from entering intake audit metadata.

Negative

requires protected changes to:

send-otp;

verify-otp;

scan-quote;

report RPC execute grants;

report-access caller reconciliation;

requires capability-bound OTP wrappers;

requires serialized OTP claim state;

requires a guarded lead-resolution wrapper;

requires a durable event outbox;

requires an erasure procedure before sidecar foreign keys;

requires migration of every production UploadZone caller;

requires migration of every production browser report caller;

requires Storage, canonical-table, and database-function grant changes;

rejects raw HEIC/HEIF initially;

adds operational monitoring;

requires a separate implementation design for rate-limit persistence and runtime controls.

Neutral

does not change Gemini extraction;

does not change deterministic scoring;

does not change the final get_analysis_full predicate;

does not create contractor opportunities;

does not classify verified sales;

does not change the current quote_uploaded optimization value of 250;

does not migrate quote_uploaded from UUID v4 to wmc_;

does not make quote_uploaded proof of completed deep extraction;

does not assume deployed Supabase state from repository migrations.



31. Final architectural rule

The intake capability proves only that its holder possesses a short-lived,

server-minted right to upload one exact quote, submit contact information,

initiate capability-bound OTP, verify that OTP through one serialized claim

against one exact pending row, and observe the intake lifecycle.



It does not prove identity.

It does not verify a phone by itself.

It does not choose a lead.

It does not authorize report data.

It does not authorize contractor sharing.

It does not establish a verified sale.



The backend must safely resolve and attach one unverified canonical lead

before OTP initiation.



The database must prove that an accepted upload belongs to the same intake.



An intake-bound scan may be processed only through authenticated

internal-service dispatch.



An intake-bound verification requires one exact pending row whose lead,

phone, and non-null scan session match the capability and canonical records.



No database row lock is assumed to survive an external Twilio round-trip.



Verification therefore requires an atomic pre-Twilio claim transaction

and a separate atomic post-Twilio conditional finalization transaction.



Twilio approval alone is never sufficient.



quote_uploaded eligibility occurs after classifyScanGate passes

and before full deep extraction validation.



The system must durably reserve one quote_uploaded UUID before scanner dispatch

and persist that event idempotently through an outbox.



Production browser preview and full-report requests must route through

report-access. Raw preview and full RPCs are not browser interfaces.



Verify-to-Reveal remains backend-owned,

exact-session-bound,

and SMS-verified.

]

supabase/functions/_shared\tracking\canonical\nextdoorDispatchEligibility.ts:  "n",

supabase/functions/_shared\tracking\canonical\mapToTikTok.ts:  | "n"

supabase/functions/_shared\tracking\canonical\mapToTikTok.ts:  n: {

supabase/functions/_shared\tracking\canonical\mapToTikTok.test.ts:  ["n", "UploadQuote", "custom"],

supabase/functions/_shared\tracking\canonical\mapToTikTok.test.ts:  const custom = ["n", "report_revealed", "report_unlocked"];

docs/START_HERE.md:40:| **Lead capture / homepage** | [VERIFY_TO_REVEAL_CONTRACT.md](./reveal/VERIFY_TO_REVEAL_CONTRACT.md) | manifest (`qualify-homepage-lead`, `capture-truth-gate-lead`) | `ui-ux.mdc` | phase-0/funnel maps are **STALE WITH BANNER** for transport |

docs/START_HERE.md:44:| **Deprecated / stale docs** | [DOC_STATUS_REGISTRY.md](./ops/DOC_STATUS_REGISTRY.md) | Bannered funnel maps, phase-0, COPILOT spec | — | Do not implement from **STALE WITH BANNER** bodies |

docs/ops/DOC_STATUS_REGISTRY.md:9:3. **STALE WITH BANNER** docs may contain wrong transport/details in the body — follow the banner link to the canonical doc. **These docs must not be used to justify code changes**; the banner and linked canonical doc win.

docs/ops/DOC_STATUS_REGISTRY.md:12:6. **Update this registry** when promoting, demoting, or adding stale banners to docs.

docs/ops/DOC_STATUS_REGISTRY.md:68:## STALE WITH BANNER

Evidence gathering is complete. Let me verify report-access behavior so the ADR describes the baseline bridge accurately.




All three findings are confirmed against baseline evidence. Now writing the V7 document.

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

