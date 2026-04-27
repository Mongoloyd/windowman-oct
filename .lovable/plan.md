[AUTONOMOUS SPRINT MODE: RECURSIVE STATE AUDIT]

STEP 0 — GIT + DB RECONCILIATION

Before starting implementation, run:

- git log -n 5 --oneline

- git branch --show-current

- git status --short --untracked-files=all

- git diff --name-only

- git diff HEAD~1 --name-only

- git diff HEAD~1

Then verify connected Supabase DB objects with SQL or equivalent checks:

select

  to_regclass('public.contractor_outcomes') as contractor_outcomes,

  to_regclass('public.event_logs') as event_logs,

  to_regclass('public.client_platform_configs') as client_platform_configs,

  to_regprocedure('public.admin_revenue_signal_eligibility()') as admin_revenue_signal_eligibility,

  to_regprocedure('public.admin_sync_revenue_signals(integer, boolean)') as admin_sync_revenue_signals,

  to_regprocedure('public.admin_revenue_dispatch_readiness()') as admin_revenue_dispatch_readiness;

Also verify Phase 3F/3G artifacts exist:

- `src/services/revenueSignalIntegration.ts`

- `src/services/revenueDispatchReadiness.ts`

- `supabase/functions/admin-sync-revenue-signals/index.ts`

- `supabase/functions/admin-client-platform-config/index.ts`

- `docs/syndicate/phase-3f-revenue-truth-conversion-signal.md`

- `docs/syndicate/phase-3g-syndicate-health-tenant-isolation-closeout.md` if already created

If Phase 3F is missing or broken, STOP and report:

“3F Revenue Truth → Conversion Signal Integration must be completed before 3H.”

If Phase 3G-A/B is missing but 3F is complete, continue only if this sprint does not depend on 3G UI files.

Do not rebuild 3F.

Do not rebuild 3G.

Do not create a second revenue signal system.

Do not duplicate platform config systems.

Do not touch homeowner funnel UI.

Do not touch TruthGateFlow or county dropdown work in this sprint.

CURRENT PRIMARY MISSION

PHASE 3H — REVENUE SIGNAL IDEMPOTENCY + PLATFORM READINESS HARDENING

MODE:

build / repair / reconcile / strict / revenue-integrity / platform-readiness / no-live-dispatch / no-ui-regression

ROLE

Act as a Senior Revenue Infrastructure Engineer, Supabase Data Integrity Engineer, Conversion Systems Architect, and Multi-Tenant Platform Configuration Auditor specializing in idempotency, event ledgers, canonical revenue keys, typed platform readiness, and no-dispatch dry-run safety.

MISSION

Harden the two highest-risk pre-Phase-4 systems:

1. Canonical lifecycle-level revenue signal idempotency

2. Canonical typed platform readiness matrix

This sprint must make revenue signals and platform readiness deterministic across:

- contractor outcomes

- event logs

- revenue signal eligibility

- sync RPC

- dispatch readiness

- platform config validation

- future dispatch/outbox materialization

This is not a dry-run report UI sprint.

This is not a contractor portal sprint.

This is not a live dispatch sprint.

This is not a homeowner funnel UI sprint.

This is not a TruthGate/county dropdown sprint.

NORTH STAR

Prevent WindowMan from inflating revenue truth or misclassifying client destination readiness before Phase 4 introduces contractor-facing workflows and more operators.

GOAL

After this sprint:

1. Revenue signals have one canonical deterministic lifecycle key.

2. Duplicate sold revenue signals are blocked at the DB/function level.

3. Existing outcome-derived sold event logs are backfilled or safely recognized with the canonical key.

4. Multiple sold outcomes for the same business opportunity are detected and flagged.

5. Platform readiness is evaluated by exact platform definitions, not substring heuristics.

6. `meta`, `tiktok`, `google_ads`, `ga4`, `gtm_server`, `crm_webhook`, `internal`, and `other` have explicit readiness rules.

7. Admin platform config validation and revenue dispatch readiness use the same readiness semantics.

8. Malformed or unknown platform config JSON cannot crash the admin UI.

9. No external dispatch is added.

10. Dry-run reporting enhancements remain deferred to the next sprint.

WHY THIS MATTERS

Phase 3F made contractor outcomes able to produce internal revenue signals.

But before Phase 4, WindowMan must prevent two quiet failure modes:

1. Duplicate revenue truth:

   - duplicate sold outcomes

   - duplicate event logs

   - retry-created sold events

   - competing contractor claims

   - future outbox rows using a different key

2. False-ready platform destinations:

   - `ga4` not recognized by substring checks

   - stale configs counted as ready

   - inactive or unvalidated configs appearing dispatch-ready

   - inconsistent rules between admin config validation and readiness mapping

If either happens, TikTok/Meta/Google optimization can be trained on false revenue or wrong destination readiness.

TOP 5 AMBIGUITY CLARIFICATIONS

1. “Revenue signal key”

A revenue signal key is a deterministic lifecycle-level key representing one active canonical revenue signal for a business opportunity and disposition. It is not merely the contractor_outcome_id.

2. “Lifecycle-level idempotency”

Lifecycle-level idempotency means the same business opportunity cannot create multiple active sold signals just because multiple contractor_outcomes rows, retries, or event logs exist. Legitimate corrections/reversals must be represented explicitly and must not create duplicate active sold signals.

3. “Business opportunity”

A business opportunity is the best available stable entity for the revenue lifecycle. Use this fallback order:

- lead_assignment_id

- lead_id

- scan_session_id

- analysis_id

- contractor_outcome_id as last resort only, with a weak-key reason code

4. “Platform readiness”

Platform readiness means a typed, exact, deterministic evaluation of whether a client destination config is usable for internal readiness and future dispatch. It does not mean any external API has been called.

5. “Ready”

Ready requires more than `is_active = true`. A platform config is ready only when active state, validation status, required destination fields, and required token policy all pass for the exact platform type.

SUCCESS DEFINITION

Phase 3H succeeds when:

Revenue Signal Key:

- A canonical revenue signal key function or equivalent deterministic generator exists.

- The key is based on:

  - client_slug

  - stable business opportunity identity

  - disposition_state

  - key version

- The key is exposed by `admin_revenue_signal_eligibility()`.

- The key is written into outcome-derived sold `event_logs` metadata.

- `admin_sync_revenue_signals()` uses the key for duplicate detection.

- DB-level uniqueness blocks duplicate active sold signals by key.

- Existing outcome-derived sold signal rows are backfilled or safely recognized.

- Duplicate terminal sold outcomes per opportunity are detected and flagged.

- Missing/malformed metadata cannot bypass duplicate checks silently.

- Corrections/reversals/disputes are not treated as new active sold signals unless explicitly allowed.

Platform Readiness:

- A canonical typed platform readiness matrix exists.

- Exact platform names are used:

  - meta

  - tiktok

  - google_ads

  - ga4

  - gtm_server

  - crm_webhook

  - internal

  - other

- No substring platform checks remain for readiness decisions.

- `ga4` is handled explicitly.

- `admin-client-platform-config` validation aligns with the matrix.

- `revenueDispatchReadiness.ts` aligns with the matrix.

- `admin_revenue_dispatch_readiness()` returns typed platform config readiness metadata.

- Malformed platform config JSON is normalized defensively.

- Unknown platforms are classified as `other` or `unknown` with reason codes, not treated as ready.

Safety:

- No external provider calls are added.

- No dispatch attempts are created.

- No outbox rows are marked sent.

- No scanner/OTP/report files are touched.

- No homeowner funnel files are touched.

- Build/typecheck/Deno checks pass.

ABSOLUTE RULES

DO NOT TOUCH TRUTHGATEFLOW.

DO NOT TOUCH COUNTY DROPDOWN WORK.

DO NOT TOUCH HOMEOWNER FUNNEL UI.

DO NOT SEND EVENTS TO META.

DO NOT SEND EVENTS TO GOOGLE.

DO NOT SEND EVENTS TO TIKTOK.

DO NOT SEND EVENTS TO GTM SERVER.

DO NOT SEND EVENTS TO CRM WEBHOOKS.

DO NOT CALL ANY EXTERNAL ENDPOINT.

DO NOT CREATE LIVE DISPATCH.

DO NOT CREATE DISPATCH ATTEMPTS.

DO NOT MARK OUTBOX ROWS AS SENT.

DO NOT MAKE leads REVENUE TRUTH.

DO NOT MAKE lead_assignments REVENUE TRUTH.

DO NOT TREAT HOMEOWNER SAVINGS AS PURCHASE VALUE.

DO NOT DELETE EXISTING OUTCOMES.

DO NOT AUTO-MERGE DUPLICATE OUTCOMES.

DO NOT SILENTLY DROP DUPLICATES.

DO NOT WEAKEN RLS.

DO NOT EXPOSE RAW PII.

DO NOT EXPOSE PLATFORM TOKENS.

DO NOT EXPOSE VAULT SECRET IDS.

DO NOT EXPOSE RAW CLICK IDS.

DO NOT TOUCH OTP VERIFY-TO-REVEAL.

DO NOT TOUCH SEND-OTP OR VERIFY-OTP.

DO NOT TOUCH SCANNER ANALYSIS.

DO NOT TOUCH REPORT REVEAL.

ALLOWED FILES

Likely create:

- `src/services/platformReadinessMatrix.ts`

- `docs/syndicate/phase-3h-revenue-key-platform-readiness-hardening.md`

Likely modify:

- `src/services/revenueSignalIntegration.ts`

- `src/services/revenueDispatchReadiness.ts`

- `supabase/functions/admin-sync-revenue-signals/index.ts`

- `supabase/functions/admin-client-platform-config/index.ts`

- `supabase/functions/_shared/platformReadiness.ts` if shared Deno matrix is appropriate

- Phase 3H migration file:

  - `supabase/migrations/YYYYMMDDHHMMSS_revenue_signal_key_platform_readiness_hardening.sql`

Optional modify:

- `docs/syndicate/phase-3f-revenue-truth-conversion-signal.md` only to add 3H handoff notes

- `docs/syndicate/phase-3g-syndicate-health-tenant-isolation-closeout.md` only to reference 3H hardening if already present

Do not modify:

- `src/components/TruthGateFlow.tsx`

- county data files

- scanner files

- OTP files

- report reveal files

- contractor portal files

- provider sender files

- package files unless absolutely required

IMPLEMENTATION ORDER

Execute in this exact order:

1. Validate prerequisites and connected DB.

2. Audit existing duplicate sold signal risk.

3. Add canonical revenue signal key function/contract.

4. Backfill or safely derive keys for existing outcome-derived sold event logs.

5. Add uniqueness enforcement only after duplicate audit passes or is safely scoped.

6. Update `admin_revenue_signal_eligibility()`.

7. Update `admin_sync_revenue_signals()`.

8. Create typed platform readiness matrix.

9. Refactor frontend readiness mapping to use exact platform matrix.

10. Align Edge Function platform config validation.

11. Update `admin_revenue_dispatch_readiness()` output if needed.

12. Add/repair documentation.

13. Run validation.

14. Final report.

Do not begin platform readiness work until revenue key preflight is complete.

Do not add unique indexes before duplicate preflight.

Do not create destructive migrations.

PART 1 — CANONICAL REVENUE SIGNAL KEY

Create a stable database-side function or equivalent deterministic mechanism.

Preferred DB function:

`public.compute_revenue_signal_key(...)`

Inputs should be derived server-side from existing outcome/assignment context, not trusted from frontend.

Key components:

- key version: `revenue-signal-key-v1`

- client_slug

- business opportunity type

- business opportunity id

- disposition_state

Business opportunity fallback order:

1. lead_assignment_id

2. lead_id

3. scan_session_id

4. analysis_id

5. contractor_outcome_id only as last resort

Example string shape:

`revenue-signal-key-v1:{client_slug}:{opportunity_type}:{opportunity_id}:{disposition_state}`

Normalize:

- lowercase client_slug

- trim strings

- never include raw PII

- never include click IDs

- never include token or endpoint values

If the function must return null:

- missing client_slug

- missing disposition_state

- no usable business opportunity identity

If fallback reaches contractor_outcome_id:

- allow key generation

- add reason code `weak_lifecycle_key`

- do not falsely classify lifecycle duplicate protection as strong

REVENUE KEY STORAGE / BACKFILL

Use existing columns if present. Otherwise add additive fields only if needed:

Potential additive fields on `contractor_outcomes`:

- `revenue_signal_key text null`

- `revenue_signal_key_version text null`

- `revenue_signal_key_basis text null`

- `revenue_signal_key_reasons text[] not null default '{}'::text[]`

Do not add fields if existing metadata pattern is safer.

For `event_logs`, use metadata:

- `metadata->>'revenue_signal_key'`

- `metadata->>'revenue_signal_key_version'`

- `metadata->>'revenue_signal_key_basis'`

- `metadata->>'revenue_truth_source' = 'contractor_outcomes'`

- `metadata->>'external_dispatch' = 'false'`

- `metadata->>'dispatch_created' = 'false'`

Backfill:

- existing outcome-derived sold event logs should receive `revenue_signal_key` where safely derivable.

- if key cannot be derived, flag with reason `missing_revenue_signal_key`.

- do not delete or rewrite historic facts destructively.

DUPLICATE AUDIT BEFORE UNIQUE INDEX

Before creating uniqueness enforcement, audit:

1. multiple sold outcomes per lead_assignment_id

2. multiple sold outcomes per lead_id

3. multiple sold event_logs missing contractor_outcome_id

4. sold event_logs missing revenue_signal_key

5. duplicate candidate revenue_signal_key values

6. sold aliases not exactly event_name = 'sold'

If duplicates exist:

- do not delete them

- do not auto-merge them

- do not silently pick a winner

- create/report duplicate reason codes

- only create partial unique index scoped to clean eligible active sold signals, or stop and report if safe uniqueness cannot be added

DB UNIQUENESS REQUIREMENTS

Add physical uniqueness enforcement if safe.

Required:

- unique index on `event_logs(metadata->>'revenue_signal_key')`

- only for outcome-derived sold revenue signals

- only where `revenue_signal_key` is not null

- only where `metadata->>'revenue_truth_source' = 'contractor_outcomes'`

- only where event represents active sold signal

- exclude explicit corrections/reversals if such metadata exists

Also enforce duplicate protection in `admin_sync_revenue_signals()` before insert.

If adding contractor_outcomes uniqueness:

- do it only for active eligible sold outcomes

- use a partial unique index

- do not block legitimate non-terminal, lost, disputed, corrected, reversed, or manual_review rows

- if existing schema cannot safely express this, document Context Debt instead of creating an unsafe constraint

LIFECYCLE EXCEPTIONS

Explicitly handle or document:

- correction of sold amount

- disputed sold outcome

- reversed/cancelled sale

- reassigned lead

- two contractors claiming sold on same business opportunity

- admin override

- weak lifecycle key fallback

Rules:

- corrections must not create a second active sold signal unless explicitly modeled as a correction event.

- reversals must not create a new active sold signal.

- disputes should block active sold signal eligibility or require manual review.

- competing sold claims should be flagged as duplicate/manual_review.

- admin override must be explicit, auditable, and not hidden.

UPDATE `admin_revenue_signal_eligibility()`

The RPC must expose:

- `revenue_signal_key`

- `revenue_signal_key_basis`

- `revenue_signal_key_version`

- `revenue_signal_key_reasons`

- duplicate key status

- lifecycle duplicate warning/blocking reasons

- weak key warning if fallback uses contractor_outcome_id

- active sold signal eligibility

Eligibility must block sold signal creation when:

- missing client_slug

- missing sold amount

- invalid sold amount

- missing value_basis

- disputed

- manual_review

- invalid outcome

- duplicate active sold signal exists

- competing terminal sold outcome exists

- revenue_signal_key cannot be derived

UPDATE `admin_sync_revenue_signals()`

Sync must:

- compute key server-side

- never trust frontend key

- include key in event log metadata

- check key before insert

- return existing backward-compatible counts:

  - inserted

  - duplicate_protected

  - blocked

  - dry_run

  - external_dispatch: false

  - dispatch_created: false

Do not implement full dry-run audit report yet. That is Prompt 3 / Phase 3I.

PART 2 — CANONICAL PLATFORM READINESS MATRIX

Create a typed readiness matrix.

Preferred frontend file:

`src/services/platformReadinessMatrix.ts`

Preferred Edge shared file if safe:

`supabase/functions/_shared/platformReadiness.ts`

If one physical shared module cannot be safely imported by both frontend and Edge Functions, create mirrored modules with identical rules and document parity.

Supported platforms:

1. `meta`

2. `tiktok`

3. `google_ads`

4. `ga4`

5. `gtm_server`

6. `crm_webhook`

7. `internal`

8. `other`

Every platform must have:

- display label

- isExternal boolean

- token policy:

  - required

  - optional

  - forbidden

  - not_applicable

- required destination fields

- readiness blocking reasons

- readiness warning reasons

- safe fallback behavior

Platform rules:

meta:

- requires token

- requires `pixel_id` or `dataset_id`

- external destination

tiktok:

- requires token

- requires `pixel_id`

- external destination

google_ads:

- requires token

- requires `conversion_id` or `conversion_label`

- external destination

ga4:

- define explicitly

- requires token/API secret if current schema stores it as token_secret_id

- requires measurement/destination identifier from existing schema fields

- must not fall through to google_ads

- external destination

gtm_server:

- requires valid https endpoint

- token optional unless existing policy requires it

- external destination

crm_webhook:

- requires valid https endpoint

- token optional or required based on explicit policy

- external destination

internal:

- no external destination required

- token not required

- should never be treated as provider dispatch destination

other:

- requires endpoint or destination identifier

- token policy explicit

- not automatically ready

Readiness requires all of:

- `is_active = true`

- `config_state = active`

- `validation_status = validation_passed`

- platform-specific destination requirements pass

- platform-specific token policy passes

- no malformed platform config data

If `config_state` or `validation_status` is missing from legacy rows:

- do not crash

- mark as warning or blocked based on safest existing state

- document reason code

Remove substring heuristics like:

- `platform.includes("google")`

Replace with exact normalized platform names.

DEFENSIVE PLATFORM CONFIG NORMALIZATION

Malformed platform config JSON must not crash UI.

Implement safe normalization:

- unknown platform -> `other` or `unknown` with reason

- missing array -> empty array

- malformed row -> blocked config with reason

- missing destination -> blocked

- stale validation -> warning or blocked according to matrix

- paused/retired/invalid -> blocked

- inactive -> blocked

Readiness result should include:

- platform_name

- display_label

- is_external

- is_active

- config_state

- validation_status

- token_present

- destination_present

- readiness_status:

  - ready

  - warning

  - blocked

  - unknown

- reason_codes

- destination_summary

- safe metadata only

Do not expose:

- raw token

- Vault secret ID

- raw endpoint URL if sensitive

- raw click IDs

- raw PII

ALIGN THESE LOCATIONS

Update:

1. `src/services/revenueDispatchReadiness.ts`

   - use canonical matrix

   - no substring platform matching

   - normalize malformed `platform_configs`

   - handle `ga4` explicitly

2. `supabase/functions/admin-client-platform-config/index.ts`

   - align validation behavior with same platform matrix

   - do not create different readiness rules

3. `admin_revenue_dispatch_readiness()`

   - if it emits platform_configs JSONB, include typed fields and reason codes

   - do not break existing frontend shape unless frontend is updated in same sprint

4. Documentation

   - document exact platform matrix and fallback behavior

DOCUMENTATION

Create:

`docs/syndicate/phase-3h-revenue-key-platform-readiness-hardening.md`

Required sections:

1. Goal

2. North Star

3. What Was Built

4. Revenue Signal Key Contract

5. Business Opportunity Identity Fallback Order

6. Lifecycle Exceptions

7. Duplicate Audit Rules

8. Event Log Uniqueness Rules

9. Contractor Outcome Duplicate Rules

10. Eligibility RPC Changes

11. Sync RPC Changes

12. Platform Readiness Matrix

13. Platform Readiness Reason Codes

14. Defensive JSON Normalization

15. No External Dispatch Proof

16. Privacy / Redaction Rules

17. Validation Results

18. Known Deferrals

19. Handoff To Phase 3I Dry-Run Audit Reporting

20. Handoff To Phase 4

Known deferrals must include:

- full dry-run audit report with would_insert/client breakdown

- forbidden endpoint scan

- migration/type reconciliation sprint

- TruthGate county dropdown micro-fix

VALIDATION

Run:

- git diff --name-only

- bun run build

- npx tsc --noEmit

For touched Edge Functions:

- deno check supabase/functions/admin-sync-revenue-signals/index.ts

- deno check supabase/functions/admin-client-platform-config/index.ts

If a shared Edge module is created:

- deno check every Edge Function importing it

For migrations:

- validate SQL syntax if available

- verify DB objects if migration applied

- if duplicate audit blocks unique index creation, report exact duplicate rows/counts and do not fake pass

PASS CONDITIONS

Revenue Key:

1. Canonical revenue signal key exists.

2. Key is exposed by eligibility RPC.

3. Key is written into sold event log metadata.

4. Sync RPC checks key before insert.

5. Duplicate active sold signals are DB-blocked or explicitly reported as migration-blocking Context Debt.

6. Duplicate sold outcomes per business opportunity are detected.

7. Weak fallback keys are flagged.

8. Corrections/reversals/disputes do not create duplicate active sold signals.

9. No external dispatch added.

Platform Readiness:

10. Typed readiness matrix exists.

11. Exact platform matching replaces substring checks.

12. `ga4` is explicit.

13. Admin config validation aligns with readiness mapping.

14. Readiness UI/service cannot crash on malformed platform config JSON.

15. Active readiness requires state + validation + destination + token policy.

16. Reason codes are shown or returned.

17. Platform tokens/Vault IDs are not exposed.

General:

18. Documentation exists.

19. No TruthGate/county files touched.

20. No scanner/OTP/report files touched.

21. No live dispatch/provider calls added.

22. Build/typecheck passes.

23. Relevant Deno checks pass.

24. Final report states whether Phase 3I or Phase 4 is allowed to proceed.

STEP 4 — AUTONOMOUS COMPLETION CONTRACT

No Placeholders:

Do not leave TODOs, fake duplicate audits, fake readiness rows, fake platform configs, fake warnings, fake migrations, or incomplete service calls.

The Handoff:

In your final response, summarize:

1. Previous sprint audit result.

2. Files read.

3. Files changed.

4. Migrations added/skipped.

5. Duplicate audit result.

6. Revenue signal key contract implemented.

7. Unique constraints/indexes added or explicitly deferred with reason.

8. Eligibility RPC changes.

9. Sync RPC changes.

10. Platform readiness matrix implemented.

11. Locations aligned with matrix.

12. Defensive fallback behavior.

13. Safety constraints preserved.

14. Validation results.

15. Whether Phase 3I dry-run audit reporting is allowed to proceed.

16. Whether Phase 4 remains blocked or allowed after 3I.

Self-Correction:

Before finalizing, review:

- no homeowner funnel files touched

- no TruthGate/county work mixed in

- no scanner/OTP/report reveal regressions

- no raw PII/token/click-ID exposure

- no unauthorized live dispatch

- no provider API calls

- no dispatch attempts created

- no outbox rows marked sent

- no duplicate sold signal bypass

- no substring platform matching

- no fake readiness state

- no broad “ready/live/enabled” ambiguity

FINAL ACTION:

Commit with:

feat(phase-3h): harden revenue keys and platform readiness

If this environment cannot commit, report:

- exact git status --short

- exact intended commit message

- exact files ready to commit

Prepare the workspace so the next agent sees a clean, valid Git state.