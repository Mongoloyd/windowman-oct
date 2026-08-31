# WindowMan Intelligence Layer Phase 0 — Repository and Ingestion Audit

| Field | Value |
|---|---|
| Audit name | `01_REPOSITORY_AND_INGESTION_AUDIT` |
| UTC execution time | `2026-08-30T20:11:31.754Z` |
| Execution environment | `CODEX` on local Windows / PowerShell |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status | `CLEAN` at the evidence baseline, before this explicitly authorized audit artifact was created |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity actually verified | `UNKNOWN` — HEAD equals the existing local remote-tracking ref, but no authorized network comparison was performed |
| Database environment | `UNKNOWN` |
| Database project identifier | `UNKNOWN` — repository configuration contains non-secret local/live identifiers, but the operator did not bind this audit to a database environment |
| PostgreSQL version | `UNKNOWN` |
| Production read authorization | `NOT_AUTHORIZED` |
| Network authorization | `NOT_AUTHORIZED` |
| Applicable governance instructions | User-supplied `00_AUDIT_PROTOCOL_AND_SEQUENCE.md`; `AGENTS.md`; `docs/START_HERE.md`; `.cursor/PROTECTED_FILES.md`; `.cursor/rules/00-windowman-core.mdc`; `.cursor/rules/supabase.mdc`; `.cursor/rules/deployment-env.mdc`; `.cursor/rules/twilio.mdc`; `.cursor/rules/ui-ux.mdc`; `claude.md` |
| Audit status | `COMPLETE_WITH_BLOCKERS` |
| Auditor limitations | Repository-only static inspection. No database connection, SQL execution, remote comparison, external documentation lookup, build, test, typecheck, lint, service start, Edge Function invocation, Storage request, Gemini request, deployment, migration, type generation, or production proof. |

## 1. Safety rules for this executable audit

This audit used only read-only repository inspection before creating this report. It did not invoke application code or external services.

Permitted and used:

- `Get-Location`, `Get-Content`, `Test-Path`
- `git rev-parse`, `git status`, `git branch -vv`, `git log`, `git worktree list`, `git ls-files`
- `rg`, `rg --files`
- read-only PowerShell selection and counting over repository paths

Explicitly not performed:

- no source, migration, configuration, generated-type, lockfile, or database changes
- no Git fetch, pull, checkout, switch, branch, reset, stash, clean, commit, push, tag, or worktree mutation
- no package installation, build, test, typecheck, lint, format, generation, or cache-producing command
- no Supabase CLI/MCP connection, SQL, migration, function, RPC, Storage, or dashboard operation
- no Gemini/OCR/provider invocation
- no secret-value or customer-record access
- no raw extraction JSON, source-document text, customer PII, signed URL, or real Storage object path is reproduced in this report

### Artifact-location exception

The initiating operator instruction explicitly authorized exactly one repository write: this report at `docs/audits/01_REPOSITORY_AND_INGESTION_AUDIT.md`. That instruction is a specific exception to the protocol text's default `RESPONSE_ONLY` or outside-repository artifact rule. No other file was created or modified.

## 2. Operator inputs recorded

| Input | Recorded value | Effect |
|---|---|---|
| Canonical repository path | `C:\Projects\wm-mvp-github-clean` | Verified by working directory and `git rev-parse --show-toplevel`. |
| Expected branch | `forensic_report_v2` | Verified active. |
| Execution environment | `CODEX` | Local repository inspection only. |
| Target Supabase environment | `UNKNOWN` | No deployed-state claim may be made. |
| Production read authorization | `NOT_AUTHORIZED` | Production inspection prohibited. |
| Read-only database authorization | `NONE` | No database query generated or executed in Audit 01. |
| Read-only network authorization | `NOT_AUTHORIZED` | No `git ls-remote`, web request, or external documentation lookup. |
| Audit-artifact location | `docs/audits/01_REPOSITORY_AND_INGESTION_AUDIT.md` | Explicit one-file operator exception recorded above. |
| Known repository governance | Paths listed in the execution-identity table | Applied as repository constraints. |
| Operational limits | Strict read-only audit; no source/config/SQL/database mutation; no builds/tests; no PII/secrets/raw JSON/source text | Observed. |

Repository configuration indicators are not operator environment bindings:

- `supabase/config.toml:1` names the local namespace `wm-mvp-forensic-v2-local`.
- `package.json:18-19` contains type-generation scripts with a non-secret project ref.
- `.cursor/rules/deployment-env.mdc` describes a live Forensic V2 ref and human-only deployment rules.

None of those establishes the target environment, authorization, current deployed schema, or current deployment parity for this audit.

## 3. Method and evidence domains

### 3.1 Verified search scope

At the audited commit, tracked-file enumeration reported:

| Scope | Count |
|---|---:|
| All tracked files | 1,603 |
| Tracked files under `src/` | 995 |
| Tracked files under `supabase/migrations/` | 165 |
| Tracked files under `supabase/functions/` | 190 |
| Directories under `supabase/functions/` | 62 |
| Candidate Edge Function directories excluding `_shared` and `tests` | 60 |

Searches covered exact expected object names, ingestion function names, Supabase table access, Storage access, ORM dependencies/imports/configuration, extraction interfaces, report transport, normalization code, benchmark code, and generated database types.

### 3.2 Evidence-domain separation

| Domain | Status in this audit |
|---|---|
| Current committed source | Inspected at SHA `7a497a5f1cba752d26ce1721f39d0a8288306a51`. |
| Uncommitted working tree | None at baseline. This report is the only authorized post-baseline artifact. |
| Repository migrations | Inspected as authored migration intent only. |
| Applied migration history | `UNKNOWN`; no database access. |
| Deployed database state | `UNKNOWN`; no database access. |
| Generated database types | Inspected at `src/integrations/supabase/types.ts`; treated as a snapshot, not the security boundary or proof of current deployment. |
| Tests and fixtures | Inspected only as authored evidence; not executed. |
| Repository documentation | Used for routing/governance and corroboration only; not treated as current deployment proof. |
| External documentation | Not accessed because network authorization was not granted. |

## 4. Expected-context claim disposition

| Claim ID | Classification | Result | Direct basis | Limitation |
|---|---|---|---|---|
| EXP-001 | `CONFIRMED` | Canonical repository is `C:\Projects\wm-mvp-github-clean`. | `git rev-parse --show-toplevel`; `AGENTS.md:743`. | No limitation for local identity. |
| EXP-002 | `CONFIRMED` | Active branch is `forensic_report_v2`. | `git branch --show-current`; `git status --short --branch`. | Current remote parity remains `UNKNOWN`. |
| EXP-003 | `CONFIRMED` | Frontend uses React and TypeScript. | `package.json:80,118`; `.tsx` source and `tsconfig.app.json`. | Build was not run. |
| EXP-004 | `CONFIRMED` | Frontend tooling includes Vite. | `package.json:8,120`; `vite.config.ts`. | Build was not run. |
| EXP-005 | `CONFIRMED` | Repository backend architecture uses Supabase PostgreSQL migrations, private Storage access, and Edge Functions. | `supabase/migrations/**`; `src/integrations/supabase/client.ts`; `src/components/UploadZone.tsx:793-797`; `supabase/functions/scan-quote/index.ts:528`; `supabase/functions/start-upload-scan-session/index.ts:735-863`. | Deployed services and applied schema are `UNKNOWN`. |
| EXP-006 | `CONFIRMED` | Server code is Deno-compatible. | `deno.json`; `Deno.serve` and `Deno.env` in Edge Functions; Deno-compatible URL/npm imports. | Exact deployed Deno runtime version is `UNKNOWN`. |
| EXP-007 | `CONFIRMED` | Gemini performs AI extraction in `scan-quote`. | `supabase/functions/scan-quote/index.ts:370-526,870-1082`; `_shared/scannerConfig.ts:77-104`. | No provider request was executed; deployment/model configuration is `UNKNOWN`. |
| EXP-008 | `CONFIRMED` | `scan-quote` exists. | `supabase/functions/scan-quote/index.ts` and adjacent modules/tests; `supabase/config.toml:150-151`. | Deployment parity is `UNKNOWN`. |
| EXP-009 | `CONFIRMED` | Current repository analysis storage contract includes `analyses.full_json`. | Migration `20260318033459...sql:57-76`; generated types `types.ts:17-40`; writer `scan-quote/index.ts:1291-1311`. | Current deployed column is `UNKNOWN`. |
| EXP-010 | `CONFIRMED` | `wm_quote_facts` exists in current repository schema/types and has an active server-side writer on the successful scan path. | Migration `20260414110000...sql:141-202`; generated types `types.ts:4483-4518`; `_shared/tracking/canonical/createCanonicalEvent.ts:560-618`. | Current deployed object/coverage is `UNKNOWN`; field quality is not build-ready. |
| EXP-011 | `INFERRED` | `quote_observations` is authored in a committed migration and pgTAP test, but is absent from generated types and has no production invocation in the inspected call graph. | Migration `20260806144716...sql:1-34`; `supabase/tests/quote_normalization_layer.test.sql`; `_shared/normalizeAnalysis.ts:573-740`. | Applied/deployed existence is `UNKNOWN`; runtime population is unproven. |
| EXP-012 | `CONTRADICTED` | No exact `quote_intelligence_facts` object exists in the verified tracked repository scope. | Exhaustive exact-name search across `src`, `supabase`, and `docs` returned zero files. | A similarly purposed table does not confirm this exact name; an uninspected remote-only object remains outside scope. |
| EXP-013 | `CONFIRMED` | A homeowner Truth Report exists under the actual route/component names. | `src/App.tsx:168-170`; `src/pages/ReportClassic.tsx:23-24,630-642`; `src/components/post-scan/PostScanReportSwitcher.tsx:2-13,874-884`. | Runtime rendering was not executed. |
| EXP-014 | `CONTRADICTED` | Drizzle status is no longer unknown for the tracked repository: no Drizzle dependency, config, import, schema, or migration evidence was found. Direct Supabase JS is used. | Exhaustive tracked-name search plus dependency/source search; `package.json:66`; `src/integrations/supabase/client.ts`. | This conclusion is repository-scoped; it does not inspect unrelated external systems. |

## 5. Runtime and dependency inventory

| Layer | Repository evidence | Audit conclusion |
|---|---|---|
| Frontend | React `^18.3.1`, TypeScript `^5.8.3`, Vite `^7.3.2`, React Router, TanStack Query | Confirmed React/TypeScript/Vite application. |
| Browser data client | `@supabase/supabase-js`; `src/integrations/supabase/client.ts` consumes only `VITE_SUPABASE_URL` plus publishable/anon key names | Browser uses a typed public Supabase client; no service-role consumer was found in that client. |
| Edge runtime | `deno.json`, `Deno.serve`, `Deno.env`, URL/npm imports | Confirmed Deno-compatible Edge Function source. |
| Database source | 165 tracked SQL migration files; generated `Database` type | PostgreSQL/Supabase schema intent is substantial, but applied history is not proven. |
| Storage | Browser writes to bucket name `quotes`; server verifies and downloads through service-role paths | Private quote Storage is part of the current ingestion path. Actual bucket policies are Audit 03 scope. |
| AI extraction | `scan-quote` builds a Gemini request from the uploaded document and parses JSON | Gemini is extraction/classification input, not the deterministic grader. |
| Deterministic analysis | `scoring.ts`, `flagging.ts`, `_shared/metrics.ts`, `reportCompiler.ts` | TypeScript computes grade, flags, financial metrics, and report output after extraction validation. |
| ORM | No Drizzle/Prisma/TypeORM/Sequelize/Kysely dependency or usage found | Direct Supabase client/PostgREST/RPC usage is the current pattern. |

No version claim is made for PostgreSQL, deployed Edge runtime, Gemini model, or remote Supabase components.

## 6. Current ingestion call graph

### 6.1 Canonical homepage/Nextdoor path

```text
contact capture / trusted lead + session pair
  -> Index or NextdoorQuoteUpload mounts UploadZone
  -> deterministic private Storage path
  -> browser uploads to quotes bucket
  -> start-upload-scan-session
       -> validates strict body and session-scoped storage path
       -> optionally enforces contact-owned lead identity
       -> verifies object existence via server-side signed probe
       -> resolves/creates lead in legacy mode
       -> resolves/creates quote_files row by storage_path
       -> resolves/creates scan_sessions row by quote_file_id
       -> returns lead_id + quote_file_id + scan_session_id
  -> scan-quote(scan_session_id, event_id)
       -> loads session and enforces recovery/rate-limit rules
       -> downloads private quote object
       -> Gemini extracts/classifies structured data
       -> fail-closed classification + extraction validation
       -> deterministic scoring, flags, metrics, report compilation
       -> analyses upsert keyed by scan_session_id
       -> monotonic latest-analysis pointer RPC
       -> lead event + canonical event persistence
       -> wm_quote_facts upsert through canonical event writer
       -> scan_sessions.status = preview_ready
  -> browser polls get_scan_status
  -> report-access preview RPC path
  -> homeowner Truth Report partial view
  -> OTP / backend-authorized full path (out of ingestion write scope)
```

Primary anchors:

- Upload mount/identity guard: `src/pages/Index.tsx:450-480,893-919`; `src/components/nextdoor/NextdoorQuoteUpload.tsx:18-36`.
- Storage/retry/bootstrap/invoke: `src/components/UploadZone.tsx:527-600,700-903,906-1030`.
- Bootstrap contract: `supabase/functions/start-upload-scan-session/contracts/schemas.ts:79-149,153-190`.
- Bootstrap server writes: `start-upload-scan-session/index.ts:964-1009,1129-1345`.
- Scanner lifecycle and persistence: `scan-quote/index.ts:638-732,769-1082,1140-1324,1326-1548`.
- Polling: `src/hooks/useScanPolling.ts:57-178`.
- Preview/full transport: `src/services/reportService.ts:68-158`; `supabase/functions/report-access/index.ts:372-528`.

### 6.2 Feature-flagged `/scan` path

`src/App.tsx:141-144,224-226` mounts `/scan` only when `VITE_SCAN_ROUTE_MOUNTED === "true"`. `src/components/scan/useRealScanBridge.ts:1-7` labels itself temporary. It performs the same Storage → bootstrap → `scan-quote` → poll → safe-preview sequence at `useRealScanBridge.ts:172-325`.

Material difference: the bridge does not supply `lead_id` to bootstrap (`useRealScanBridge.ts:201-215`). If contact-owned upload enforcement is active for public calls, the backend can reject it with `contact_required_before_upload` (`useRealScanBridge.ts:219-229`). This route is not evidence of a stable additive intelligence integration point.

### 6.3 Server ownership and browser boundary

- Browser uploads the private asset and invokes public Edge Function envelopes.
- `start-upload-scan-session`, `scan-quote`, and `report-access` create service-role clients from server-only environment-variable names.
- The report client calls `report-access`; it does not directly call the protected full/preview analysis RPCs (`reportService.ts:7-13,70-154`).
- Preview mode defensively removes `full_json` (`report-access/index.ts:435-464`).
- Full mode requires a scan-session/phone pair and relies on the backend RPC's authorization sentinel (`report-access/index.ts:474-522`).

This source evidence confirms the intended boundary. It does not prove deployed grants, RLS, RPC definitions, or runtime denial behavior; those remain Audit 02/03 work.

## 7. Extraction contract candidates

Audit 01 found multiple candidate authorities that Audit 02 must reconcile rather than treating any one document as complete by assumption:

| Candidate | Exact reference | Role |
|---|---|---|
| Gemini output prompt schema | `supabase/functions/scan-quote/index.ts:370-526` | Requested JSON keys and extraction instructions. |
| TypeScript extraction model | `supabase/functions/scan-quote/scoring.ts:11-159` | `LineItem` and `ExtractionResult` consumed by deterministic logic. |
| Runtime classification normalizer/gate | `supabase/functions/scan-quote/classificationGate.ts:14-131` | Fail-closed relatedness, confidence, and line-item eligibility. |
| Runtime extraction validator | `supabase/functions/scan-quote/index.ts:201-244,1140-1158` | Coerces and validates the parsed provider response before scoring. |
| Deterministic scoring | `supabase/functions/scan-quote/scoring.ts:163-180,530+` | Rubric version `1.6.0`, thresholds, grade computation. |
| Deterministic financial metrics | `supabase/functions/_shared/metrics.ts:234+,420-477` | Quote math and current benchmark comparison. |
| Deterministic report compiler | `supabase/functions/scan-quote/reportCompiler.ts:390+` | Warnings, missing items, summary, and report fields. |
| Persisted analysis payload | `supabase/functions/scan-quote/index.ts:1226-1311` | `proof_of_read`, teaser-safe `preview_json`, protected `full_json`, and scalar analysis fields. |

Contract observations for Audit 02:

1. The prompt says absent fields should be explicit `null`, while the TypeScript interface marks many fields optional. Runtime coercion/validation is therefore material.
2. `price_fairness`, `markup_estimate`, and `negotiation_leverage` remain optional TypeScript/persistence fields but are not present in the inspected Gemini response schema. They must not be assumed extracted.
3. The provider emits numeric money-like values without an explicit cents contract. The normalizer separately converts dollar-like inputs to integer cents. Monetary source units remain a blocker until reconciled.
4. Opening identity is line-index/text based in extraction. No canonical quote/document/revision/opening identity law was established in Audit 01.
5. The complete field inventory, JSON-path authority, optionality, source provenance, and PII classification remain Audit 02 gates.

## 8. Persistence readers and writers

### 8.1 Ingestion-critical objects

| Object | Current writer(s) | Current reader(s) in the audited path | Evidence-domain caveat |
|---|---|---|---|
| Storage bucket `quotes` | Browser `UploadZone`; feature-flagged scan bridge | `start-upload-scan-session` existence probe; `scan-quote` download | Bucket existence/policies/deployed privacy not queried. |
| `leads` | Existing capture functions; legacy bootstrap may create shell lead | Bootstrap validation/resolution; scanner county lookup; downstream services | Contact-owned flag state is deployment configuration and `UNKNOWN`. |
| `quote_files` | `start-upload-scan-session` | Bootstrap retry/reuse; `scan-quote` resolves storage path | Deployed uniqueness/index behavior not queried. |
| `scan_sessions` | Bootstrap insert; scanner status updates | Scanner recovery; browser status RPC; downstream report path | Deployed constraints/RPC grants not queried. |
| `analyses` | `scan-quote` upsert on `scan_session_id` | Report RPCs; admin/downstream functions; benchmark refresh | `full_json` is protected; deployed RLS/grants unknown. |
| `lead_events` | `scan-quote` non-critical completion insert | Downstream operational readers | Not an intelligence fact store. |
| `wm_event_log` | Canonical event writer | Canonical lookup/dispatch logic | Measurement/operational purpose differs from quote-fact truth. |
| `wm_quote_facts` | Canonical event writer called from successful `scan-quote` | Broker/Oracle-support code and generated types | Current fields include provisional/default quality values; coverage unknown. |
| `quote_observations` | `normalizeAnalysis()` helper only | No production invocation found | Committed migration intent; absent generated types; deployed state unknown. |
| `quote_line_items` | `normalizeAnalysis()` helper only | No production invocation found | Same limitation; contains source-derived text fields. |
| `normalization_failures` | `normalizeAnalysis()` helper only | No production invocation found | Schema permits a bounded redacted excerpt field; privacy review required. |

### 8.2 `analyses` readers outside the immediate report path

Repository search found server readers in `admin-data`, `persist-diagnosis-start`, `lead-reactivation`, `generate-contractor-brief`, `get-contractor-dossier`, `dispatch-lead`, `get-contractor-document-url`, `dial-lead`, `dev-report-unlock`, `generate-negotiation-script`, `submit-diagnosis-intake`, `send-report-email`, `request-callback`, `send-contractor-handoff`, `refresh-benchmarks`, `voice-followup`, and canonical event helpers.

Audit 02/03 must classify each reader by selected columns, role, response projection, and whether it can observe protected `full_json`. Presence of a server reader is not proof of safe least privilege.

## 9. Existing intelligence-layer assets and gaps

### 9.1 `wm_quote_facts`: active but not quality-authoritative

The successful scan path calls `persistCanonicalEvent` after analysis persistence (`scan-quote/index.ts:1396-1479`). The server canonical writer upserts `wm_quote_facts` when an `analysisId` and quote payload exist (`_shared/tracking/canonical/createCanonicalEvent.ts:560-618`).

However, the scanner currently supplies provisional/default analytics values: fixed identity strength, zero anomaly/trust values, `review` anomaly status, and empty reasons (`scan-quote/index.ts:1434-1463`). The writer defaults index/ads approvals to false unless an optimization payload supplies them (`createCanonicalEvent.ts:589-595`). Therefore:

- the table is not proof of analytics eligibility;
- `trust_score`, `cohort_fit_score`, and related columns must not be treated as validated cohort-quality measures merely because they are populated;
- field semantics and actual row coverage require deployed aggregate profiling.

### 9.2 `quote_observations`: authored normalization layer, not runtime-wired

The committed migration creates `quote_observations`, `quote_line_items`, and `normalization_failures` with RLS/policies (`20260806144716_quote_normalization_layer.sql:1-223`). `_shared/normalizeAnalysis.ts` provides a versioned, idempotent transform and integer-cent conversion (`normalizeAnalysis.ts:1-14,573-740`).

An exhaustive invocation search found only:

- the function definition;
- comments; and
- unit-test calls.

No production Edge Function, scanner call site, scheduled job, trigger, or application service imports/invokes `normalizeAnalysis`. The helper is also explicitly non-atomic: header upsert and child replacement are sequential, so a crash can leave stale children until retry (`normalizeAnalysis.ts:1-8`).

This is a central Phase 0 finding: the repository contains a candidate normalization implementation and schema, but not an established successful-analysis ingestion pipeline.

### 9.3 De-identification is not established by the existing normalization schema

The normalization migration includes identifiers and source-derived text fields such as `lead_id`, ZIP, raw contractor name, raw line descriptions/dimensions, opening location/tag, product-assignment text, and a bounded failure excerpt column (`20260806144716_quote_normalization_layer.sql:5-32,39-69,95-122`). No values were inspected or reproduced.

Those fields may be operationally useful, but their presence means the current schema cannot be labeled a de-identified intelligence layer without Audit 02 field classification and Audit 03 data-rights/security decisions. A de-identified analytical projection may need to be distinct from the operational normalization store.

### 9.4 `quote_intelligence_facts`: missing exact object

No tracked source, migration, type, test, or documentation reference uses the exact name `quote_intelligence_facts`. Existing alternatives must be reported under their actual names (`wm_quote_facts`, `quote_observations`, `quote_line_items`); they do not confirm the expected object.

### 9.5 Current benchmark paths are split and not build-ready

Two different mechanisms exist:

1. The current report metric path uses hardcoded South Florida county constants. `_shared/countyBenchmarks.ts:18-75` returns static values, and lines 78-94 describe a future live-query replacement. `_shared/metrics.ts:470-475` calls this current static function.
2. `refresh-benchmarks` is a separate secret-header Edge Function that reads every completed analysis containing `full_json`, groups prices, and upserts `county_benchmarks` (`refresh-benchmarks/index.ts:70-257`).

Repository evidence does not establish a live closed loop between them:

- no current consumer queries `county_benchmarks`; the only executable `.from("county_benchmarks")` call is the refresh writer;
- the table is absent from generated types;
- migrations only conditionally add policies if `county_benchmarks` already exists; no tracked `CREATE TABLE county_benchmarks` was found;
- current deployment/schedule status is `UNKNOWN`;
- the refresh reads an unbounded completed-analysis set and has no observed eligibility, duplicate, revision, test-data, contractor-concentration, selection-bias, or recency policy beyond a per-price sanity bound and minimum bucket count.

This existing function must not be treated as the Phase 0 server-owned cohort design or as proof that the Truth Report consumes empirical WindowMan cohorts.

## 10. Status, retry, and lifecycle evidence

### 10.1 Current scan state machine

Observed states include:

```text
idle / uploading
  -> processing
  -> preview_ready or complete
  -> invalid_document / needs_better_upload / error
```

Additional frontend unions recognize `failed` and `unreadable` as terminal error aliases (`UploadZone.tsx:65-81`; `useScanPolling.ts:7-32`).

### 10.2 Idempotency and recovery

- Browser storage paths are deterministic for a session/file pair (`src/components/uploadZone/storagePath.ts`).
- Upload retry queries `get_upload_retry_context`, reuses existing quote/session mappings, and avoids overwriting an orphaned private object without a database context (`UploadZone.tsx:700-903`).
- Bootstrap reuses `quote_files` by `storage_path` and `scan_sessions` by `quote_file_id` (`start-upload-scan-session/index.ts:1129-1341`).
- Scanner analysis persistence upserts on `scan_session_id` (`scan-quote/index.ts:339-351`).
- Scanner recovery skips terminal states, rejects recent concurrent `processing`, and permits stale takeover after a configured threshold (`sessionRecovery.ts:58-96`).
- Lead latest-analysis ownership/order is delegated to `set_latest_complete_analysis_pointer`; scanner code does not directly overwrite the pointer (`leadPointerSync.ts:1-13,194-231`).
- Browser polling defaults to 2.5 seconds, 60 polls, and a fatal stop after three consecutive RPC failures (`useScanPolling.ts:17-20,40-66,92-178`).

### 10.3 Intelligence-pipeline lifecycle gap

Neither the active `wm_quote_facts` writer nor the orphaned `normalizeAnalysis` helper establishes an explicit durable status model for:

- normalization queued/running/succeeded/failed;
- quote/opening facts version;
- analytics eligibility decision version;
- cohort inclusion/exclusion reason;
- benchmark generation/version;
- Truth Report benchmark exposure flag/version;
- reprocessing/supersession across analyses or quote revisions.

Audit 02 must determine whether any of these exist under other exact names before build planning.

## 11. Logging and sensitive-data boundary observations

No sensitive values were read or reproduced. Static code inspection found boundaries Audit 03 must examine:

- `UploadZone` diagnostic/telemetry paths include field names for file name and Storage path (`UploadZone.tsx:769-835`). An intelligence pipeline must not consume these operational logs as de-identified facts.
- `scan-quote` logs deterministic derived-metric objects with lead/county identifiers (`scan-quote/index.ts:1203-1216`). Whether those logs satisfy production privacy/retention rules is unproven.
- `normalizeAnalysis` can persist bounded diagnostic excerpts when a caller supplies one (`normalizeAnalysis.ts:454-465,582-590`), although inspected tests include fail-closed cases. Audit 03 must decide whether any source excerpt is allowed.
- `refresh-benchmarks` reads protected `full_json` server-side. Server-side placement is necessary but does not by itself prove least privilege, bounded load, de-identification, or safe cohort logic.

These are audit findings, not authorization to edit logging or schemas.

## 12. Build blockers and execution hard stops

### 12.1 Build blockers carried forward

| Blocker ID | Blocker | Why it blocks planning/implementation | Required resolution |
|---|---|---|---|
| BB-A01-001 | Deployed schema and applied migration history are unknown. | Authored migrations/types may not match the target database. | Audit 02 with an explicitly bound, authorized environment and metadata-only schema evidence. |
| BB-A01-002 | Current remote parity is unknown. | Local source equals only the existing local remote-tracking ref. | Authorized narrow remote comparison or operator-provided immutable remote evidence. |
| BB-A01-003 | Extraction contract authority is not reconciled. | Prompt schema, optional TypeScript fields, coercion, validation, and persisted JSON can drift. | Audit 02 complete extraction coverage matrix and authoritative path bindings. |
| BB-A01-004 | `quote_observations` is not runtime-wired and is absent from generated types. | There is no proven successful-analysis → normalization execution path. | Audit 02 deployed-object verification and ownership decision; Audit 03 safe server-boundary decision. |
| BB-A01-005 | Existing normalizer is non-atomic. | Partial writes can leave stale opening rows after interruption. | Decide transactional/RPC/queue semantics and recovery authority before integration planning. |
| BB-A01-006 | De-identification/data-rights model is unresolved. | Existing candidate tables retain identifiers and source-derived text fields. | Audit 02 field classification plus Audit 03 retention, access, and projection decisions. |
| BB-A01-007 | Monetary units and price basis are not authoritative end-to-end. | Scanner uses generic numbers; `wm_quote_facts` uses numeric fields; normalization converts to BIGINT cents. | Bind every monetary JSON path/column to units and price basis in Audit 02. |
| BB-A01-008 | Quote/document/project/revision/opening identity and supersession are unresolved. | One analysis can be idempotent while duplicate/revised quotes still contaminate cohorts. | Audit 02 entity/lifecycle model and founder decision register. |
| BB-A01-009 | `wm_quote_facts` quality fields are provisional/defaulted. | Populated rows are not automatically analytics-eligible. | Audit 02 ownership/semantics; Audit 04 aggregate profiling after authorization. |
| BB-A01-010 | Existing benchmark refresh is not a safe cohort proof. | It scans all completed `full_json`, lacks required eligibility/revision/bias controls, and is not wired into report metrics. | Audit 02/03 model and access review; Audit 04 bounded profiling; founder policy decisions. |
| BB-A01-011 | Safe integration point is unresolved. | Synchronous work inside `scan-quote` could change latency/failure semantics; asynchronous ownership is not established. | Audit 03 boundary decision after Audit 02 contract/schema evidence. |
| BB-A01-012 | Production/staging data quality and cohort feasibility are unknown. | No authorized aggregate profiling occurred. | Audit 04 may generate SQL only after confirmed bindings; then human review and separately authorized execution. |

### 12.2 Execution hard stops applied

| Stopped scope | Reason | Operator action required |
|---|---|---|
| Database catalog/data inspection | Environment, project identifier, access method, reviewed query IDs, and read authorization were not supplied. | Explicitly bind an environment and non-secret project identifier; grant read-only metadata/aggregate authorization with approved access method and timeouts. |
| Network/remote parity check | Network authorization was `NOT_AUTHORIZED`. | Explicitly authorize a narrow `git ls-remote` scope or supply immutable remote evidence. |
| Builds/tests/typecheck | Protocol prohibits artifact/cache-producing verification in Phase 0 repository inspection. | Run only in a separately authorized verification task if needed. |
| Edge Function/Gemini/Storage/RPC invocation | External/service invocation is prohibited and no environment authorization exists. | Separate explicit authorization for a non-production safe environment and exact operation. |

No unsafe action was attempted.

## 13. Phase-gate status

| Gate | Status | Basis |
|---|---|---|
| `GATE_REPOSITORY` | `PASS_WITH_LIMITATION` | Canonical checkout, active branch, commit, clean baseline, governance, and single linked worktree are established. Remote parity is `UNKNOWN`. |
| `GATE_CONTRACT` | `BLOCKED` | Candidate extraction contracts are identified but not reconciled into a complete authoritative field inventory. |
| `GATE_DATABASE` | `BLOCKED` | Deployed schema, applied history, types parity, semantic bindings, and PostgreSQL version are unknown. |
| `GATE_SECURITY` | `NOT_EVALUATED` | Audit 03 depends on Audit 02. |
| `GATE_PROFILE` | `NOT_EVALUATED` | Required bindings and authorization are absent. |
| `GATE_QUALITY` | `NOT_EVALUATED` | No aggregate data profiling. |
| `GATE_DECISIONS` | `NOT_EVALUATED` | Founder/specialist decision register not available. |
| `GATE_BUILD` | `BLOCKED` | Earlier gates are incomplete. |

Audit 04 must return `NEEDS_SCHEMA_BINDING` if invoked before BB-A01-001, BB-A01-003, BB-A01-007, BB-A01-008, and the Audit 03 security bindings are resolved.

## 14. Audit 01 → Audit 02 handoff

### Repository identity

- Root: `C:\Projects\wm-mvp-github-clean`
- Branch: `forensic_report_v2`
- SHA: `7a497a5f1cba752d26ce1721f39d0a8288306a51`
- Baseline status: clean
- Upstream: `origin/forensic_report_v2`
- Current remote parity: `UNKNOWN`
- Single linked worktree: canonical root only

### Governance

- `AGENTS.md` is canonical repository law.
- `scan-quote/**`, report/OTP paths, and full reveal are Tier A.
- migrations/generated types/Storage/RLS are Tier B.
- No implementation/mutation authority is conveyed by this audit.

### Runtime/dependency inventory

- React + TypeScript + Vite frontend.
- Supabase JS browser client with publishable/anon key names only.
- Supabase PostgreSQL migration source, private Storage path, and Deno-compatible Edge Functions.
- Gemini extraction from server-side `scan-quote`.
- Deterministic TypeScript scoring, metrics, flags, and report compilation.
- Direct Supabase/RPC pattern; no Drizzle evidence.

### Ingestion call graph

Use Section 6 as the source-to-persistence map. The authoritative successful-analysis boundary is the `scan-quote` complete analysis upsert at `index.ts:1291-1324`, followed by pointer/event work and `preview_ready` at `1481-1548`.

### Extraction contract candidates

Reconcile all candidates in Section 7. Audit 02 must account for every field and JSON path, including explicit-null versus optional behavior and fields retained outside the active prompt.

### Persistence readers/writers

Use Section 8. Special attention:

- `wm_quote_facts` is runtime-written but contains provisional quality values.
- `quote_observations`/`quote_line_items` are migration-defined and helper-written only; no production caller exists.
- `refresh-benchmarks` is a protected raw-analysis reader and separate writer, not a trusted cohort authority.

### Status/retry/lifecycle

Use Section 10. Preserve existing scan idempotency, stale takeover, pointer monotonicity, terminal states, preview readiness, and browser polling semantics.

### Supabase locations

- Config: `supabase/config.toml`
- Migrations: `supabase/migrations/`
- Edge Functions: `supabase/functions/`
- Generated types: `src/integrations/supabase/types.ts`
- Browser client: `src/integrations/supabase/client.ts`

### Required Audit 02 outputs

1. Schema-authority verdict separated into migration intent, generated types, applied history, and deployed state.
2. Exact object inventory for `analyses`, `wm_quote_facts`, `quote_observations`, `quote_line_items`, `normalization_failures`, any benchmark objects, and relevant RPCs/functions/views/triggers.
3. Complete extraction and persistence coverage matrix from prompt key → runtime type → validator/coercion → deterministic consumer → persisted location → report exposure.
4. Entity/lifecycle model for quote, document, project, revision, scan session, analysis, observation, and opening.
5. Monetary-unit and price-basis bindings.
6. PII/source-text/data-rights classification for every candidate fact field.
7. Provenance/versioning, duplicate/reprocessing/supersession, test-data, and eligibility ownership findings.
8. Explicit deployed-state unknowns if authorization remains unavailable.
9. All blockers in Section 12 propagated unchanged unless closed by direct evidence.

## 15. Shared evidence ledger

| Evidence ID | Classification | Claim | Source domain | Exact reference | Observation | Build implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|
| A01-001 | `CONFIRMED` | Canonical local repository/branch/commit established. | Current working tree / Git | `git rev-parse`; `git status`; `git worktree list`; SHA `7a497a5f...` | Clean baseline on expected branch; only canonical linked worktree. | Repository inspection can proceed. | High | Verify remote parity only with authorization. |
| A01-002 | `UNKNOWN` | Current remote parity. | Remote Git | Existing local `origin/forensic_report_v2` ref only | Local equality does not prove current remote state. | Source freshness has a bounded uncertainty. | High | Authorized narrow remote comparison. |
| A01-003 | `CONFIRMED` | React/TypeScript/Vite frontend. | Current committed source/config | `package.json:8,80,118,120`; `vite.config.ts`; `tsconfig.app.json` | Expected frontend stack is present. | Frontend integration constraints are known. | High | None for Audit 02. |
| A01-004 | `CONFIRMED` | Supabase/Deno/Gemini scanner architecture. | Current committed source/config | `deno.json`; `scan-quote/index.ts:528,593-604,870-1082` | Server-side Gemini extraction in a Deno Edge Function. | Extraction boundary is server-owned in source. | High | Audit deployed config separately. |
| A01-005 | `CONFIRMED` | Scanner Brain separation exists in source. | Current committed source | `scoring.ts:1-5,530+`; `index.ts:1140-1224` | AI extraction is followed by deterministic validation/scoring/metrics/compiler. | Additive intelligence must not move grade/cohort judgment into AI. | High | Audit complete field/consumer matrix. |
| A01-006 | `CONFIRMED` | Bootstrap owns lead/file/session registration and reuse. | Current committed source | `start-upload-scan-session/index.ts:964-1009,1129-1345` | Service-role bootstrap validates asset existence and reuses keyed rows. | Preserve identity/idempotency boundaries. | High | Audit DB uniqueness and RLS in Audit 02/03. |
| A01-007 | `CONFIRMED` | `analyses.full_json` is a current repository contract and scanner write. | Migration/types/runtime source | Migration `20260318033459...:57-76`; `types.ts:17-40`; `scan-quote/index.ts:1291-1311` | Protected complete payload persists on successful extraction. | Intelligence derivation must remain server-side and post-success. | High | Verify deployed schema and data rights. |
| A01-008 | `CONFIRMED` | `wm_quote_facts` has an active successful-scan writer. | Migration/types/runtime source | Migration `20260414110000...:141-202`; canonical writer `:560-618` | Upsert keyed by `analysis_id` follows canonical event persistence. | Reuse/replace decision must be evidence-led. | High | Audit quality semantics and coverage. |
| A01-009 | `CONFIRMED` | `wm_quote_facts` quality fields are provisional. | Current committed source | `scan-quote/index.ts:1434-1463`; canonical writer `:569-607` | Scanner supplies fixed/default trust/anomaly/identity inputs. | Table population cannot equal analytics eligibility. | High | Define quality/eligibility ownership. |
| A01-010 | `INFERRED` | `quote_observations` is intended repository schema but current deployment/population is unproven. | Migration/tests/helper | Migration `20260806144716...:1-223`; helper `normalizeAnalysis.ts:573-740` | Object authored; no generated-type entry or production invocation. | Existing layer cannot be assumed live. | High | Deployed metadata and call ownership. |
| A01-011 | `CONTRADICTED` | Existing normalizer is integrated after successful analysis. | Current committed source | Exact `normalizeAnalysis(` invocation search | Only definition/comments/tests found. | A new integration boundary would be required and protected. | High | Audit 03 boundary decision; no implementation yet. |
| A01-012 | `CONFIRMED` | Existing normalizer is idempotent but non-atomic. | Current committed source | `normalizeAnalysis.ts:1-8,664-734` | Header upsert and child delete/insert are sequential. | Recovery/transaction design is a blocker. | High | Determine transactional ownership. |
| A01-013 | `CONFIRMED` | Candidate normalization schema retains identifiers/source-derived text. | Repository migration | `20260806144716...:5-32,39-69,95-122` | Fields are not automatically de-identified. | Security/data-rights review is mandatory. | High | Audit 02 PII matrix; Audit 03 access/retention. |
| A01-014 | `CONTRADICTED` | Exact `quote_intelligence_facts` exists in repository. | Exhaustive tracked search | Exact-name search across `src`, `supabase`, `docs` | Zero matches. | Use actual object names; do not design against an invented table. | High | Verify remote schema only if authorized. |
| A01-015 | `CONFIRMED` | Truth Report source path exists and uses backend report transport. | Current committed source | `App.tsx:168-170`; `reportService.ts:68-158`; `report-access/index.ts:435-522` | Preview/full envelope separation is present. | Optional benchmark must preserve backend authorization and teaser safety. | High | Audit RPC/grant/deployed behavior in Audit 03. |
| A01-016 | `CONFIRMED` | Current report benchmark comparison is static. | Current committed source | `_shared/countyBenchmarks.ts:18-94`; `_shared/metrics.ts:470-475` | Hardcoded constants are returned; live query is a commented future path. | Current report does not prove empirical cohort integration. | High | Founder policy + additive benchmark design after profiling. |
| A01-017 | `CONFIRMED` | Separate benchmark refresh reads raw completed analyses without the Phase 0 eligibility model. | Current committed source | `refresh-benchmarks/index.ts:91-207` | Unbounded completed `full_json` rows are grouped with limited filtering. | Do not adopt as trusted cohort engine. | High | Audit schema, load, eligibility, bias, duplicates, revisions, recency. |
| A01-018 | `UNKNOWN` | `county_benchmarks` deployed object/schedule exists. | Migration/types/docs/deployment | Conditional policy migration; no tracked create/type; no DB access | Repository source does not establish table or active schedule. | Benchmark writer may target a remote-only/legacy object. | High | Authorized deployed catalog/schedule evidence. |
| A01-019 | `CONFIRMED` | Current retry/lifecycle controls protect existing ingestion semantics. | Current committed source | `UploadZone.tsx:700-903`; `sessionRecovery.ts:58-96`; `useScanPolling.ts:57-178` | Deterministic path reuse, stale takeover, and bounded polling exist. | Additive work must avoid changing these semantics. | High | Include regression criteria in any later plan. |
| A01-020 | `UNKNOWN` | Cohort feasibility and data quality are sufficient. | Deployed aggregate data | No authorized query | No population, completeness, concentration, recency, duplicate, revision, or bias metrics. | Build planning is blocked. | High | Audit 04 only after schema/security binding and review. |

## 16. Audit conclusion

Audit 01 establishes that WindowMan has a real, protected server-owned scan pipeline and multiple partial intelligence assets. It does **not** establish a safe additive intelligence pipeline yet.

The most important repository facts are:

1. `scan-quote` is the successful-analysis authority and persists protected `analyses.full_json` after deterministic validation/scoring.
2. `wm_quote_facts` is actively written, but its current quality fields are provisional/defaulted and cannot establish cohort eligibility.
3. `quote_observations` plus opening rows and a normalizer are authored, but the normalizer has no production caller, is absent from generated types, and is non-atomic.
4. The candidate normalization schema is not de-identified by construction.
5. The current Truth Report benchmark uses static constants. A separate benchmark refresh is neither wired into the report nor sufficient as a safe cohort design.
6. Deployed database truth, data quality, cohort feasibility, security/rights, monetary units, identity/revision rules, and the integration point remain blocked.

**Audit 01 verdict:** `COMPLETE_WITH_BLOCKERS`. Proceed to Audit 02 only with every blocker and evidence-domain distinction in this report carried forward. Do not generate executable profiling SQL until required schema and semantic bindings are confirmed.
