Codex Master Goal — Build the WindowMan Quote-First /scan Funnel

Use this entire document as one Codex Goal. It is both the product contract and the authorization boundary for an autonomous local implementation.

Goal title

Build the production-ready WindowMan quote-first /scan intake funnel on forensic_report_v2, locally, end to end

Local implementation authorization

SPRINT APPROVAL — LOCAL ONLY: Implement the complete /scan quote-first journey described below, including the bounded protected changes required in frontend scan/upload state, private Supabase Storage contracts, schema migrations and RLS, existing Edge Functions, OCR evidence handling, contact confirmation, document-based report authorization, canonical SMS OTP fallback, backend-authorized report access, project-status separation, consent-safe contractor opportunity projection, and measurement tests. This authorization covers local files and local verification only. It does not authorize remote database changes, remote function deployment, secrets, production/staging data mutation, generated production types, commit, push, PR, merge, or deployment.

Do not ask the user to approve each local sprint again. The sprint-specific approvals in this Goal are explicit. Stop only for one of the hard blockers listed below.

Role

Operate as the principal React, TypeScript, Supabase, PostgreSQL, Edge Functions, security, and conversion architect for WindowMan. Build against repository truth. Preserve the Verify-to-Reveal system and evolve it for the explicitly approved /scan exception without creating a second scanner, OTP, report, consent, tracking, or contractor-routing stack.

Mission

Build /scan as the dedicated entry point for:

Facebook-ad visitors who already have a contractor estimate ready to upload.

Email recipients who clicked a direct “upload your quote or estimate for a free analysis” link.

The estimate is the form. Before upload, ask for no name, email, phone, project questionnaire, account, or OTP.

The complete experience is:

anonymous /scan visit
→ private quote upload
→ server validation and scan-session binding
→ OCR/extraction and deterministic analysis
→ safe proof-of-read with prefilled contact/project candidates
→ user confirms or corrects candidates
→ canonical lead is created/enriched with phone_verified=false
→ project status is recorded as self-reported
→ confident document-contact path OR canonical SMS OTP fallback
→ backend-authorized full Truth Report fetch
→ full report reveal
→ optional, separately consented contractor opportunity

The user experience should feel almost magical: upload one real estimate, watch WindowMan read it, see recognizable details appear, correct anything necessary, and receive the report with minimal effort.

Source-of-truth order

Before editing, read completely and obey:

AGENTS.md.

docs/START_HERE.md and the current canonical documents it identifies.

.cursor/PROTECTED_FILES.md and applicable repository rules.

Current runtime call sites.

Current migrations, generated types, Edge Functions, and configuration.

Current tests.

CANONICAL_REPO_EVIDENCE.md and DB_PREFLIGHT_STATUS.md where still current.

Supplied scan/OCR/Truth Report documents only as context.

Executable repository truth outranks historical plans. Do not implement the pasted greenfield Next.js design literally. This repository is Vite + React + TypeScript, not a new Next.js app. Do not create /scan.tsx, raw_intake_sessions, proven_sales, unsold_quotes, anonymized_bidding_feed, process-estimate-upload, confirm-estimate-intake, or a mock OTP stack merely because they appeared in an old proposal. Reuse and safely extend the canonical WM-MVP spine.

Branch and worktree preflight

Confirm the repository remote is Mongoloyd/wm-mvp.

Fetch only what is necessary to resolve the latest origin/forensic_report_v2; do not push.

Record the exact base SHA in the final report.

If the selected checkout is dirty or is not based on origin/forensic_report_v2, preserve it untouched and create a clean sibling worktree for this Goal.

Create a local feature branch named feature/scan-quote-first-intake only if branch creation is necessary for the worktree. Do not commit it.

Never discard, overwrite, stash, reset, or clean user changes.

Supabase implementation rule

Before implementing a Supabase feature:

Read the current Supabase changelog index and current official documentation for the exact Storage, Edge Function, RLS, view, auth, or CLI behavior being used.

Use the installed CLI’s --help; do not guess commands or flags.

Derive every schema change from the existing migration history and current types.

Create a migration with supabase migration new <descriptive-name> if the local CLI is available. If local Supabase is unavailable, create a review-ready migration only after determining the repository’s real naming convention; do not apply it remotely.

Views over protected data must not silently bypass RLS. Prefer an unexposed schema or security_invoker = true where supported, with explicit revokes/grants.

Never expose a service-role/secret key to browser code.

Do not add SECURITY DEFINER merely to fix permissions. Any unavoidable privileged function must have a locked search path, explicit grants/revokes, strict input and ownership/capability checks, and negative tests.

Locked product decisions

1. /scan is upload-first

The upload control is the dominant action.

No identity form appears before upload.

Attribution from Facebook/email/UTMs is captured silently through existing mechanisms.

The homepage, Nextdoor path, paid-search pages, and their contact-first rules remain unchanged.

2. Phone-on-document does not mean SMS-verified

An extracted phone number is document evidence, not telecom verification. The /scan exception may skip SMS only through a distinct server-owned authorization method named clearly as document-based authorization.

Document authorization:

must never set leads.phone_verified, accounts.phone_verified_at, an OTP-verified field, or an equivalent telecom-verification flag;

must never emit the canonical phone_verified conversion/event;

must be bound to the exact scan_session_id, analysis, quote file/checksum, confirmation record, and authorization purpose;

must not unlock another scan session;

must be replay-resistant and short-lived;

must be issued only by the backend after the user proves possession of the active upload capability and confirms the extracted candidate;

must fail closed to the existing SMS OTP path when evidence is missing, ambiguous, low-confidence, contractor/salesperson-owned, or edited to a different number.

3. OCR confidence alone cannot identify the homeowner

Extraction must return phone candidates with visible-text confidence, semantic role, provenance/page evidence, and ambiguity. Supported roles should include at least homeowner/customer, contractor office, salesperson, installer, and unknown.

Do not hardcode an uncalibrated confidence threshold as truth. Add a configurable, default-off document-authorization feature flag and a fixture-backed calibration rule. Until the fixture corpus demonstrates the approved threshold, fail closed to OTP. A likely initial candidate is >= 0.90, but code and tests must make the policy explicit and adjustable.

4. Lead creation occurs after user confirmation, before OTP

OCR output creates candidates, not a canonical CRM lead.

The user confirms or corrects the allowed contact fields.

The server transactionally creates or enriches the canonical lead.

phone_verified=false remains true for both unverified manual entry and document-authorized entry.

Existing verified lead data must never be downgraded or overwritten by lower-trust OCR.

Preserve first-touch/latest-touch attribution according to the existing canonical CRM contract.

5. Two clean business buckets without two duplicate masters

The UI asks after showing proof that the quote was read:

“I’m still shopping / I want better bids.”

“I already signed or purchased this project.”

Store this as an append-only, server-owned self-reported project-status assertion with source and timestamp. Do not call a self-reported answer a verified sale.

Enforce two distinct downstream populations:

Active estimate candidate: self-reported still shopping; may become contractor-opportunity eligible only after separate contractor-sharing consent and all eligibility checks.

Purchased estimate observation: self-reported already signed/purchased; excluded from active bidding and rejected-quote analytics. It may enter the proven-sales benchmark only after the existing outcome system records an approved verified contracted/sold outcome.

Prefer existing canonical rows plus typed assertions, constraints, and protected projections. Do not duplicate full quote/PII rows into parallel proven_sales and unsold_quotes master tables.

6. Contractor sharing is optional and separate

The report cannot be conditioned on contractor sharing or marketing consent.

The product promise may explain:

WindowMan can remove your personal details and the original contractor’s identity, then share only the project scope with participating contractors so they can compete for the opportunity.

Do not claim that a bid was sent or competition occurred unless the server actually created and dispatched an eligible opportunity.

An active estimate may route only after a separate, versioned contractor-sharing grant. Never expose to contractors:

the uploaded document;

homeowner name, phone, email, or street address;

raw OCR text;

original contractor name, salesperson, license number, logo, or uniquely identifying free text;

full_json or internal scoring evidence not approved for the contractor packet.

Reuse the existing contractor opportunity/outcome/dispatch domain. Do not build a second bidding queue.

7. Manual fallback is a future-upload lead, not a fake quote

“Don’t have your estimate handy?” opens a minimal recovery form using the existing canonical lead-capture path. Capture only the approved minimum fields and intent/attribution. Mark it as awaiting/future upload. Do not create a quote, scan session, analysis, active estimate, unsold quote, proven sale, or contractor opportunity without a document.

Do not promise an emailed return link unless the existing system actually sends and supports one. If it does not, use honest copy such as “Come back when your estimate is ready” and persist only what the current backend can fulfill.

Permanent security invariants

The browser never receives full_json or an equivalent full report before a backend authorization decision.

Safe preview/proof-of-read is a dedicated server projection, never a full payload hidden with CSS.

Authorization is scan-bound and cannot cross sessions.

Quote storage remains private.

The client cannot submit otp_verified, document_authorized, phone_verified, final lifecycle truth, or routing eligibility as trusted booleans.

Tokens/capabilities are scoped, expiring, replay-resistant, and stored/compared safely.

Extracted strings are untrusted input and must not create XSS, prompt injection, log injection, SQL injection, or contractor-packet leakage.

No raw PII enters dataLayer, conversion payloads, URLs, browser persistence, or general diagnostic logs.

A contractor has no access to the homeowner quote file or raw analysis through this feature.

Service-role operations exist only in protected server code.

Functional requirements

/scan landing state

Build a mobile-first, distraction-free route with:

minimal WindowMan header and no navigation menu;

headline: “Drop Your Estimate Here. Get an Independent Truth Report.”;

concise subtext explaining instant quote intelligence, not a contractor sales call;

dominant drag/drop and file-picker control;

accepted formats shown clearly: PDF, PNG, JPG/JPEG, HEIC/HEIF, WEBP;

maximum size shown clearly: 15 MB per intake, enforced consistently client-side, bucket-side where supported, and server-side;

privacy reassurance that the quote is private and contractor sharing is optional;

three compact value points: price/scope clarity, fine-print/warranty risks, and code/safety evidence;

a subtle no-document escape hatch;

no pre-upload PII form;

accessible keyboard, focus, contrast, screen-reader, reduced-motion, and mobile-camera behavior.

Do not add a new dependency for drag/drop if the existing stack can implement it cleanly.

Upload and processing states

Implement explicit UI and recoverability for:

idle;

file selected;

invalid type/size;

uploading with progress where technically available;

server validation;

extracting;

safe preview ready;

needs better upload;

non-estimate document;

password-protected/corrupt PDF;

manual review pending;

retryable timeout/vendor failure;

offline/interrupted upload;

expired session;

fatal error.

Users must be able to retry or replace the file without producing duplicate canonical records.

Partial reveal / proof-of-read

The partial reveal must prove that WindowMan read the document without leaking the full report. Display only a server allowlist such as:

detected homeowner/customer contact candidates with masking and confidence treatment;

project address at an appropriately safe display level;

original contractor name to the homeowner only;

total quoted price;

opening/window count;

a short, non-editable scope summary;

warranty term if clearly observed;

analysis/progress status;

at most a small number of safe teaser findings approved by the existing preview contract.

Never return or render the complete grade, full findings, full line-item evidence, hidden report JSON, or internal authorization data through the preview response unless current canonical policy explicitly allows it.

Confirmation

Allow the homeowner to confirm/correct the approved editable contact fields. Preserve:

raw OCR value;

normalized candidate value;

role and confidence;

user-confirmed value;

whether modified;

source analysis/run and scan session;

confirmation timestamp and idempotency key.

Do not overwrite immutable OCR evidence. Quote scope/price corrections that can change deterministic analysis require an explicit re-analysis or feedback contract; do not silently mutate the evidence that produced the report.

Record the self-reported project-status answer here, after proof-of-read. Contractor-sharing consent is a separate control and must not be preselected.

Conditional authorization

Implement two server-owned branches:

Document-contact authorization: only when the extracted candidate passes role/confidence/ambiguity policy, the user confirms it unchanged, the feature flag is on, and the active upload capability/session binding is valid.

SMS OTP authorization: reuse phoneVerificationService, send-otp, verify-otp, phone_verifications, report-access, and strict get_analysis_full binding for missing, ambiguous, low-confidence, or changed phone.

Do not implement mock OTP in the production route. Existing real OTP code may be mocked only in automated tests.

Full report

The frontend requests the full report from the protected backend only after one of the approved scan-bound authorization modes succeeds. The backend rechecks authorization; it does not trust a browser flag or token purpose not intended for report reveal.

Preserve the existing Classic Truth Report renderer and current report route unless repo truth shows an approved V2 production renderer. Do not redesign or replace the report as part of this Goal.

Provide clean states for:

authorized but analysis still processing;

authorization expired;

unauthorized/cross-session attempt;

report fetch retry;

session resume on the same browser without treating local storage as authorization.

Backend and data requirements

Canonical spine

Reuse and safely extend:

leads / canonical intake
→ quote_files
→ scan_sessions
→ scan-quote
→ analyses
→ report-access
→ strict full-report RPC
→ existing contractor opportunity/outcome domain

analyses remains canonical unless executable repo truth proves otherwise. quote_analyses remains legacy.

Schema delta

After inspecting the real schema, implement the smallest normalized delta needed for:

/scan intake channel/source and attribution binding;

immutable contact candidate provenance if not safely representable in canonical analysis evidence;

append-only user contact confirmations/corrections;

append-only self-reported project-status assertions;

distinct document-authorization records or an equivalently auditable existing authorization structure;

versioned contractor-sharing consent through the existing consent system;

idempotency/replay protection;

cleanup/expiry ownership;

safe opportunity projection/packet generation.

Use existing tables/columns when semantically correct. Add narrowly scoped records when history or authority must remain append-only. Never use CREATE TABLE IF NOT EXISTS as a substitute for reconciling an existing table’s actual shape.

Add constraints and indexes that encode invariants, including scan binding, allowed enums/checks, confidence range, unique idempotency, and one-way authorization semantics. Define foreign-key delete behavior deliberately.

All sensitive tables must have RLS and explicit grants/revokes appropriate to their real access model. Do not assume “no policies” is the full security design. Test anon and authenticated denial directly.

Upload ownership

Prefer an approved evolution of start-upload-scan-session rather than a parallel upload function.

The server must:

create/bind the anonymous technical scan session;

mint a narrowly scoped capability or signed upload token for an exact private object path;

enforce a shorter application acceptance deadline even if the underlying Supabase signed-upload token has a longer fixed validity;

validate actual stored object ownership/path, size, allowed content, and metadata after upload;

compute or independently verify the canonical checksum server-side;

make confirmation idempotent and resistant to replay;

clean up expired/orphaned uploads according to an explicit local migration/function contract.

Do not make the bucket public. Do not trust extension or client-provided MIME/checksum alone.

OCR and deterministic analysis

Reuse scan-quote, shared Gemini parsing helpers, the current extraction contract, deterministic financial metrics, scoring, and report compiler. Do not introduce parseEstimate() with hardcoded Jane Doe production output.

Gemini/AI may read and classify visible evidence. Deterministic TypeScript owns normalization rules, math, flags, scores, grades, safe-preview shaping, report compilation, and eligibility.

Extraction must represent:

raw visible text/evidence;

page/source provenance where available;

normalized values;

confidence;

semantic role;

multiple/conflicting candidates;

missing/unreadable/ambiguous states;

model/prompt/schema/parser version;

truncation and retry status.

If quick and deep analysis are used, preserve immutable run history or otherwise make supersession explicit. Do not call evidence immutable and then overwrite it in place.

Performance measurement

Optimize perceived speed, but do not encode an impossible end-to-end promise.

Measure separately:

upload duration;

upload-confirmation/server-validation duration;

confirmation-to-safe-preview duration;

full-analysis duration;

OTP API acceptance and verification duration;

report authorization-to-render duration.

The target is a p95 safe-preview response under 3.5 seconds after server upload confirmation for the approved fixture cohort and warm-path conditions. Record the cohort, clock owner, cold-start handling, and fallback behavior. Do not include slow client upload time in the OCR SLO or market a fixed “3 seconds” until measured production evidence supports it.

Tracking and consent

Preserve the two lanes:

business conversions: canonical server success → trackConversion/approved server routing → dataLayer/vendor mapping;

operational telemetry: trackEvent/approved event logging for diagnostics.

Implement or map events only after their backing server success:

scan_page_viewed;

quote_upload_started;

quote_upload_persisted;

safe_preview_ready;

contact_candidates_confirmed;

lead_created;

document_contact_authorized;

phone_verified only for real OTP success;

full_analysis_ready;

report_revealed only after authorized full fetch;

project_status_recorded;

contractor_sharing_granted;

contractor_opportunity_created.

Reuse canonical names where the repository already defines them; do not create semantic duplicates. Preserve event-ID deduplication, attribution inheritance, and consent gating. No raw PII in dataLayer or vendor events. Do not touch Meta/OpenAI/TikTok/Google/Nextdoor routing until the dedicated measurement sprint.

Sprint execution order

Codex must maintain a plan and complete these in order. After each sprint, run the narrow tests and record results. Continue automatically when the sprint passes. If a sprint fails, fix it within scope before continuing.

Sprint 0 — Clean-base repo and contract preflight

Local approval: Read-only inspection plus local planning/test artifacts.

Resolve the clean base SHA.

Map the current /scan scaffold, routing, upload path, session bootstrap, scan-quote, preview, OTP, report-access, full RPC, consent, tracking, contractor opportunity, schema, RLS, and tests.

Produce docs/scan/SCAN_IMPLEMENTATION_EVIDENCE.md with confirmed paths, contracts, conflicts, and the final schema/API delta.

Identify exact allowed files for Sprints 1–8.

Do not change runtime code in Sprint 0.

Sprint 1 — Data, authority, and governance contract

Local protected approval: Local edits to the minimum canonical governance docs, migration files, RLS/grants, schema tests, and local types required to encode the approved /scan document-authorization exception and clean project-status separation.

Record document authorization as separate from phone verification.

Implement the minimal schema delta based on actual existing tables.

Add append-only confirmation/status/authorization evidence where needed.

Add constraints, indexes, RLS, grants/revokes, expiry/cleanup ownership, and migration tests.

Do not apply the migration remotely or generate remote types.

Sprint 2 — Quote-first private upload ownership

Local protected approval: Local edits to /scan upload components/services, start-upload-scan-session or its approved evolution, private-storage contracts/policies/migration, and tests.

Create the anonymous scan/session capability.

Use a server-minted exact-path signed upload flow.

Enforce formats and 15 MB consistently.

Validate stored objects server-side and bind quote_files/scan_sessions idempotently.

Preserve existing homepage and Nextdoor behavior.

Sprint 3 — Contact evidence extraction and calibration

Local protected approval: Local edits to scan-quote, shared extraction schemas/prompts/helpers, analysis persistence/projection, fixtures, and tests.

Extract contact candidates, semantic roles, confidence, provenance, and ambiguity.

Preserve immutable evidence.

Add a representative golden fixture corpus including contractor-phone-only and conflicting-phone documents.

Keep document authorization feature-flagged off until calibration tests pass.

Sprint 4 — Safe reveal, confirm/correct, lead promotion, and status assertion

Local protected approval: Local edits to safe-preview server projection, /scan UI/state/services, canonical lead-capture path, consent/status persistence, and tests.

Show the safe proof-of-read.

Persist confirmations/corrections append-only.

Create/enrich the canonical lead transactionally with phone_verified=false.

Record still-shopping versus already-signed as self-reported status.

Add the honest no-document escape hatch through the canonical lead route.

Sprint 5 — Document authorization and OTP fallback

Local protected approval: Local edits to the minimum report-access, strict full-report authorization/RPC migration, authorization service, /scan confirmation flow, existing OTP integration points, and tests. Do not weaken the existing OTP path for any other route.

Implement scan-bound document authorization behind a default-off kill switch.

Never set or emit phone verification for it.

Reuse real OTP for missing/ambiguous/changed contact.

Add replay, expiry, forged evidence, phone-role, and cross-session negative tests.

Ensure no full report reaches the browser before backend authorization.

Sprint 6 — Production /scan route and full state machine

Local protected approval: Local edits to App.tsx, ScanFunnelPage.tsx, new /scan-specific components/hooks/services/tests, and only the shared scan surfaces proven necessary by earlier sprints.

Mount /scan.

Replace the current pre-upload identity scaffold with the upload-first page.

Wire upload, validation, scan, safe reveal, confirmation, authorization branch, OTP fallback, report fetch, resume, retry, and error states.

Preserve existing Classic report rendering.

Do not alter the homepage/Nextdoor funnel behavior.

Sprint 7 — Privacy-safe contractor opportunity projection

Local protected approval: Local edits to existing contractor opportunity/dispatch backend, sanitized projection/packet code, consent checks, migrations/tests, and the /scan post-report opt-in UI.

Route only still-shopping, eligible, separately consented sessions.

Reuse existing contractor opportunities and durable routing mechanisms.

Add strict allowlist/redaction tests.

Suppress already-signed, duplicate, nonconsented, and ineligible sessions.

Do not release homeowner contact information in this sprint unless an existing, separately authorized contact-release contract already governs it.

Sprint 8 — Measurement and consent semantics

Local protected approval: Local edits to canonical tracking/consent mappings and tests only after Sprints 1–7 pass.

Add/reuse the approved event dictionary and exact server success boundaries.

Preserve browser/server event IDs and attribution.

Ensure document_contact_authorized is not mapped as phone_verified or OTP completion.

Add no-PII and no-duplicate-event tests.

Do not deploy tags, secrets, functions, or vendor configurations.

Sprint 9 — End-to-end verification and handoff

Local approval: Tests, local build, local Supabase verification where available, browser QA, and documentation only.

Run unit, component, Deno, schema/RLS, integration, and Playwright golden-thread tests.

Run TypeScript, lint, and production build.

Test mobile layouts and accessibility.

Exercise kill switches and rollback behavior locally.

Produce docs/scan/SCAN_LOCAL_BUILD_HANDOFF.md with changes, base SHA, exact commands/results, migrations not applied, remote actions not taken, known risks, and the later staging checklist.

Required golden-thread tests

At minimum, automate:

Fresh anonymous /scan visit has no PII gate.

Valid PDF upload reaches safe reveal.

Valid JPEG/PNG/HEIC/WEBP handling follows the same contract.

File over 15 MB, zero-byte, MIME-spoofed, corrupt, encrypted, and non-estimate files fail safely.

Homeowner phone confidently extracted and confirmed unchanged can use document authorization only when the feature flag and calibrated policy permit it.

Contractor/salesperson phone is never treated as homeowner contact.

Missing, ambiguous, low-confidence, or corrected phone requires real OTP.

Document authorization leaves phone_verified=false and emits no phone_verified event.

OTP success remains bound to the exact phone and scan session.

Cross-session, replayed, expired, modified, and forged authorization fails.

Browser cannot fetch, preload, cache, log, or reconstruct full report data before authorization.

Full report fetch succeeds only after backend authorization.

Still-shopping and already-signed assertions remain distinct.

Self-reported already-signed does not become a verified sale.

Already-signed never enters contractor routing.

Still-shopping without sharing consent never routes.

Eligible, consented still-shopping creates exactly one sanitized contractor opportunity.

Sanitized opportunity contains no homeowner PII, street address, original contractor identity, raw text, quote file, or full report JSON.

Manual fallback creates only an awaiting-upload lead/intake.

Resume/retry/duplicate-submit does not duplicate leads, quote files, analyses, authorizations, opportunities, or conversions.

No raw PII appears in URLs, local/session storage, dataLayer, vendor payloads, or general logs.

Homepage and Nextdoor regression tests remain green.

Binary Definition of Done

The Goal is complete only when every statement is true:

/scan is mounted locally and renders a polished upload-first page.

No identity field is shown before upload.

The private upload path is server-scoped and bound to a canonical scan session.

PDF, PNG, JPEG, HEIC/HEIF, and WEBP up to 15 MB have one consistent contract.

OCR shows safe, recognizable prefilled details and handles failure honestly.

Raw OCR evidence and user corrections remain distinguishable and auditable.

Canonical lead promotion happens only after user confirmation and never falsely verifies a phone.

The two self-reported project states cannot contaminate each other’s downstream populations.

Self-report never masquerades as verified sold truth.

Confident document-contact authorization is distinct, server-owned, scan-bound, replay-resistant, feature-flagged, and covered by negative tests.

Missing/ambiguous/changed phone uses the existing real OTP path.

Full report data never reaches the browser before a backend authorization decision.

Contractor sharing is optional, versioned, consented, eligible, sanitized, and uses the existing opportunity architecture.

Manual fallback does not fabricate quote data.

Tracking uses canonical success boundaries, dedupe IDs, and no raw PII.

Unit/component/Deno/schema/integration/E2E tests pass.

TypeScript, lint, and production build pass, or any pre-existing unrelated failure is proven with before/after evidence.

The diff contains no unrelated changes.

No remote migration, function deployment, secret change, data mutation, generated production type change, commit, push, PR, merge, or deployment occurred.

Hard stop conditions

Continue autonomously through normal implementation decisions. Stop and report a blocker only if:

the correct repository or forensic_report_v2 cannot be resolved;

no clean worktree can be created without risking user changes;

a required current schema fact cannot be established from repo/local evidence;

local implementation requires a secret value that is not already configured and cannot be safely mocked only at the test boundary;

a necessary action would mutate a remote Supabase project, production/staging data, deployed functions, secrets, GitHub, Netlify, or vendor configuration;

the requested behavior would expose full_json, cross-unlock sessions, mark document evidence as SMS verification, or leak PII to contractors;

repository truth reveals an architectural conflict that cannot be resolved by reusing the safer canonical path.

Do not stop merely to ask about component names, styling details, filenames, minor copy, test organization, or ordinary technical choices. Choose the smallest safe repo-consistent implementation and document the decision.

What not to touch

Unless a sprint above explicitly authorizes the minimum necessary file and the evidence packet proves it is required, do not change:

homepage /, Nextdoor, paid-search, signup, admin, partner, contractor, or dev/lab UX;

existing Truth Report visual design;

OTP/Twilio behavior for non-/scan routes;

Meta, Google, TikTok, Nextdoor, or OpenAI Ads vendor configuration;

production/staging Supabase targets, secrets, buckets, policies, data, or functions;

generated database types from a remote project;

unrelated migrations;

package dependencies or lockfiles unless unavoidable and explicitly justified;

PDFs/assets or unrelated user changes;

Git history or remote branches.

Final response format

Lead with the working outcome. Then provide:

base branch and SHA;

completed sprint table;

files changed grouped by frontend/backend/schema/tests/docs;

architecture decisions made autonomously;

security invariants proven;

exact verification commands and results;

known limitations or deferred remote-only checks;

explicit list of remote/destructive actions not taken;

the smallest later staging/deployment approval package.

Do not claim production completion from local tests. Call the result local implementation complete and staging-ready only when the binary Definition of Done passes.
