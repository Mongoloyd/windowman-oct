# WindowMan Intelligence Layer Phase 0 — Audit Protocol and Sequence

## Purpose

This document governs the WindowMan Intelligence Layer Phase 0 audit suite.

Phase 0 gathers evidence. It does not authorize implementation, migrations, repository changes, database changes, deployment, backfills, production configuration changes or external service invocation.

The audit must determine whether WindowMan can safely build an additive intelligence pipeline that:

- Receives an existing successful quote-analysis result.
- Creates de-identified quote-level and opening-level facts.
- Determines data quality and analytics eligibility.
- Produces server-owned comparative cohorts.
- Optionally supplies a feature-flagged benchmark to the Truth Report.
- Preserves existing OCR, extraction, scoring, reporting and production behavior.

## Required Audit Files

The suite consists of:

- `00_AUDIT_PROTOCOL_AND_SEQUENCE.md`
- `01_REPOSITORY_AND_INGESTION_AUDIT.md`
- `02_DATABASE_AND_EXTRACTION_MODEL_AUDIT.md`
- `03_SECURITY_AND_INTEGRATION_BOUNDARY_AUDIT.md`
- `04_DATA_PROFILING_QUERY_GENERATOR.md`
- `05_BUILD_READINESS_SYNTHESIS.md`

Each executable audit must contain its own safety rules. It may depend on earlier artifacts only when those inputs are explicitly declared.

## Expected but Unverified Context

Treat these as claims to investigate:

| Claim ID | Expected claim |
|---|---|
| EXP-001 | Canonical repository is `C:\Projects\wm-mvp-github-clean`. |
| EXP-002 | Expected branch is `forensic_report_v2`. |
| EXP-003 | Frontend uses React and TypeScript. |
| EXP-004 | Frontend tooling includes Vite. |
| EXP-005 | Backend uses Supabase PostgreSQL, Storage and Edge Functions. |
| EXP-006 | Server code is Deno-compatible. |
| EXP-007 | Gemini performs AI extraction. |
| EXP-008 | An extraction function named `scan-quote` exists. |
| EXP-009 | Analysis storage includes `analyses.full_json`. |
| EXP-010 | `wm_quote_facts` exists. |
| EXP-011 | `quote_observations` exists. |
| EXP-012 | `quote_intelligence_facts` exists. |
| EXP-013 | A homeowner Truth Report exists. |
| EXP-014 | Drizzle ORM status is unknown. |

Apply these classifications:

- `CONFIRMED`: Direct evidence supports the exact claim.
- `INFERRED`: Evidence supports the claim, but a material step remains unproven.
- `UNKNOWN`: Evidence is inaccessible, incomplete or insufficient.
- `CONTRADICTED`: Direct evidence conflicts with the claim, or a documented exhaustive search of the verified scope establishes that the exact item is absent.

A similar component does not confirm an expected component. Report actual alternatives under their real names.

## Required Operator Inputs

Before Audit 01, record:

| Input | Required value |
|---|---|
| Canonical repository path | Explicit absolute path |
| Expected branch | Explicit branch name |
| Execution environment | `LOCAL_CURSOR`, `CURSOR_CLOUD`, `CODEX`, or described alternative |
| Target Supabase environment | `LOCAL`, `DEVELOPMENT`, `STAGING`, `PRODUCTION`, or `UNKNOWN` |
| Production read authorization | `AUTHORIZED` or `NOT_AUTHORIZED` |
| Read-only database authorization | Authorized environment and access method, or `NONE` |
| Read-only network authorization | `AUTHORIZED` or `NOT_AUTHORIZED`, with scope |
| Audit-artifact location | Authorized path outside the repository, or `RESPONSE_ONLY`, unless explicitly overridden by the operator |
| Known repository governance | Known `AGENTS.md` and other instruction paths |
| Operational limits | Time, scan, privacy or tooling restrictions |

Tool availability, configured credentials, an open dashboard or prior access does not constitute authorization.

## Artifact Rules

Audit agents must return Markdown in their responses.

They must not save audit results inside the repository unless the operator explicitly authorizes a named artifact and path.

Generated SQL is text for review. Its generation does not authorize execution.

## Repository Safety

Permitted operations are limited to clearly read-only inspection, such as:

- `Get-Location` or `pwd`
- `git rev-parse`
- `git status`
- `git branch -vv`
- `git remote -v`, with credential-bearing portions omitted
- `git log`
- `git diff --no-ext-diff`
- `git show`
- `git ls-files`
- `git ls-tree`
- `rg`
- `Get-Content`
- Other demonstrably read-only file viewers

Prohibited operations include:

- File creation, editing, deletion or renaming except exact operator-authorized audit artifacts
- Source or configuration edits
- Shell redirection that writes files
- Package installation or upgrades
- Builds, tests, type checks or lint commands that may create artifacts or caches
- Git checkout, switch, branch creation, fetch, pull, reset, clean or stash
- Commits, tags, pushes or worktrees
- Formatting or generation commands
- Starting or deploying services
- Supabase mutation or deployment commands
- Edge Function, RPC, webhook, queue or scheduled-job invocation
- Gemini, OCR or other external-provider invocation

A remote comparison may use a narrowly scoped `git ls-remote` only when network access is authorized. It must not modify local refs or reveal credentials.

Existing remote-tracking refs do not prove current remote parity.

## Database Safety

Database inspection requires:

- Identified environment
- Non-secret project identifier
- Explicit read authorization for that environment
- Reviewed query
- Stable query ID
- Bounded scope
- Aggregate or metadata-only output
- Approved timeouts

Prohibit:

- DDL and DML
- `COPY`, `TRUNCATE`, `VACUUM` or `ANALYZE`
- Migration commands
- `CALL`, procedural `DO` or dynamic SQL
- RPC or Edge Function invocation
- User-defined or unknown functions
- Network, filesystem, foreign-server or extension calls
- Row-locking statements
- `EXPLAIN ANALYZE`
- Raw row, source-text, raw-JSON, file-path or PII output

When supported, use:

- A read-only transaction
- Local statement timeout
- Local lock timeout
- Local idle-in-transaction timeout
- `ROLLBACK`

Do not call queries “non-locking.” Describe them as read-only, bounded, timeout-protected and low-impact.

## Secret and Sensitive-Data Rules

Audits may identify:

- Environment-variable names
- Credential consumers
- Configuration locations
- Browser-versus-server exposure boundaries

Never output:

- Secret values
- API keys
- JWTs
- Database credentials
- Connection strings
- Signed Storage URLs
- Customer records
- Source-document text
- Raw extraction JSON
- Raw AI requests or responses
- Homeowner names, addresses, phone numbers or emails
- Real Storage object paths

If sensitive material is encountered, omit the value and record only the safe location and exposure concern.

## Shared Execution Identity

Every audit report must begin with:

| Field | Value |
|---|---|
| Audit name | |
| UTC execution time | |
| Execution environment | |
| Current working directory | |
| Canonical repository root | |
| Active branch | |
| Current commit SHA | |
| Working-tree status | |
| Configured upstream | |
| Remote parity actually verified | `YES`, `NO`, or `UNKNOWN` |
| Database environment | |
| Database project identifier | Non-secret identifier or `UNKNOWN` |
| PostgreSQL version | Confirmed version or `UNKNOWN` |
| Production read authorization | |
| Network authorization | |
| Applicable governance instructions | |
| Audit status | `COMPLETE`, `COMPLETE_WITH_BLOCKERS`, `PARTIAL_STOP`, or `STOPPED` |
| Auditor limitations | |

## Shared Evidence Ledger

Use stable IDs prefixed by audit:

- `A01-*`
- `A02-*`
- `A03-*`
- `A04-*`
- `A05-*`

Use:

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Build implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|

Repository evidence must include:

- Commit SHA or `WORKING_TREE`
- Repository-relative path
- Symbol, configuration key or stable line range
- Concise sanitized evidence

Database evidence must include:

- Query ID
- Environment
- Project identifier
- UTC execution time
- Query purpose
- Metadata or aggregate result
- Scope and limitations

Keep these evidence domains separate:

- Current committed source
- Uncommitted working tree
- Repository migrations
- Applied migration history
- Deployed database state
- Generated database types
- Tests and fixtures
- Repository documentation
- External documentation

External documentation may interpret observed behavior but cannot confirm WindowMan’s deployment.

## Execution Hard Stops and Build Blockers

### `EXECUTION_HARD_STOP`

Stop the affected action when continuing could:

- Inspect the wrong repository
- Violate repository instructions
- Modify protected state
- Expose PII or secrets
- Query an unauthorized environment
- Require unavailable authority
- Produce unsafe database load
- Invoke external services
- Depend on irreconcilable environment identity

Return safely gathered evidence, the stopped scope and the exact operator action required.

### `BUILD_BLOCKER`

A build blocker prevents planning or implementation but does not terminate independent safe investigation.

Examples:

- Extraction authority unresolved
- Deployed schema unverified
- Fact-table ownership unresolved
- Monetary units unknown
- Quote/revision identity ambiguous
- Safe integration point unknown
- Security or data-rights review unresolved
- Data quality insufficient
- Cohort feasibility unproven

Carry every blocker into downstream handoffs.

## Required Sequence

| Step | Activity | Entry gate | Output |
|---|---|---|---|
| 1 | Repository and ingestion audit | Operator inputs complete | Audit 01 result |
| 2 | Database and extraction-model audit | Audit 01 result available | Audit 02 result |
| 3 | Security and integration-boundary audit | Audits 01–02 available | Audit 03 result |
| 4 | Profiling-pack generation | Required bindings confirmed | Audit 04 artifacts or `NEEDS_SCHEMA_BINDING` |
| 5 | Human SQL review | Generated SQL available | Review record |
| 6 | Authorized SQL execution | Exact environment authorized | Aggregate results |
| 7 | Build-readiness synthesis | Complete evidence packet | Audit 05 verdict |
| 8 | Founder and specialist review | Decision register available | Recorded decisions |
| 9 | Detailed build plan | Verdict is `READY_FOR_BUILD_PLANNING` | Approved phased plan |
| 10 | Implementation prompts | Approved plan and no material blockers | One bounded prompt at a time |

## Why SQL Must Follow Schema Discovery

Profiling depends on confirmed:

- Environment
- Schemas and objects
- Columns and types
- JSON paths
- Monetary units and price basis
- Quantity and opening semantics
- Quote, document, project, revision and analysis identities
- Duplicate and supersession rules
- Test-data indicators
- PII exclusions
- Date fields and indexes
- Approximate table sizes
- Execution-role visibility

Guessing these can produce invalid SQL, misleading results, excessive scans or sensitive output.

If required bindings are absent, Audit 04 must return:

`NEEDS_SCHEMA_BINDING`

## Handoff Contract

### Audit 01 → Audit 02

Provide:

- Repository identity
- Governance instructions
- Runtime and dependency inventory
- Ingestion call graph
- Extraction-contract candidates
- Persistence readers and writers
- Status, retry and lifecycle evidence
- Supabase configuration and migration locations
- Generated database-type locations
- ORM evidence
- Contradictions, unknowns and blockers

### Audit 02 → Audit 03

Provide:

- Schema-authority verdict
- Object and programmable-object inventories
- Entity and lifecycle model
- Complete extraction coverage matrix
- Fact-table ownership assessment
- PII field classifications
- Provenance and versioning findings
- Duplicate and reprocessing findings
- Deployed-state unknowns or evidence
- Contradictions and blockers

### Audit 03 → Audit 04

Provide:

- Target environment and authorization
- Confirmed schemas, tables, columns and types
- Confirmed JSON paths
- Monetary and quantity semantics
- Quote/project/document/revision/analysis identifiers
- Test-data indicators
- PII exclusions
- Role visibility
- Scan limits
- Security restrictions
- Relevant deployed-schema evidence

### Audit 04 → Audit 05

Provide:

- Generation identity
- Binding manifest
- Exact SQL pack
- Human-review record
- Execution authorization
- Query-execution ledger
- Aggregate results
- Disabled, failed or timed-out queries
- Data-quality and cohort findings
- Evidence ledger and limitations

### Audit 05 → Founder Review

Provide:

- Exactly one readiness verdict
- ADR
- Founder decision register
- Security and data-rights blockers
- Data-quality and cohort findings
- Remaining unknowns
- Phased outline
- Future build-prompt manifest only when ready

## Phase Gates

- `GATE_REPOSITORY`: canonical checkout, branch, commit, governance and worktree established.
- `GATE_CONTRACT`: authoritative extraction contract and complete field inventory established.
- `GATE_DATABASE`: deployed schema and semantic bindings established.
- `GATE_SECURITY`: protected access, PII isolation and safe server boundary established.
- `GATE_PROFILE`: safe SQL reviewed and authorized.
- `GATE_QUALITY`: normalization and analytics eligibility supported.
- `GATE_DECISIONS`: material founder and specialist decisions recorded.
- `GATE_BUILD`: synthesis returns `READY_FOR_BUILD_PLANNING`.

No implementation prompt may bypass these gates.

## Protocol Definition of Done

The protocol is satisfied when:

- All audits follow the same evidence classifications.
- Environments and source domains remain distinct.
- Unsafe actions are stopped without discarding safe evidence.
- All material blockers propagate downstream.
- Every extraction field is accounted for or explicitly blocked.
- No PII, secrets, raw JSON or source text appears in results.
- Profiling SQL uses only confirmed bindings.
- Cohort analysis includes projects, contractors, concentration, recency, duplicates, revisions and selection bias where supported; unsupported dimensions are explicitly disabled.
- Security covers RLS, grants, views, functions, RPCs, Storage, Edge Functions and browser exposure.
- Build prompts are generated only after an approved synthesis and build plan.
