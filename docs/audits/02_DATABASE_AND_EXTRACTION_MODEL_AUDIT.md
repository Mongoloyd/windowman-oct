# Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 02 — Database Authority and Extraction Model Audit |
| UTC execution time | 2026-08-30T20:48:59Z |
| Execution environment | CODEX, local read-only repository inspection |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status | Tracked files clean; existing untracked `docs/audits/01_REPOSITORY_AND_INGESTION_AUDIT.md`. It was not opened or modified. |
| Configured upstream | `origin/forensic_report_v2` at local SHA `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Remote parity actually verified | NO |
| Database environment | UNKNOWN |
| Database project identifier | UNKNOWN. A project-ref candidate appears in `package.json`, but it was not operator-bound to the target environment. |
| PostgreSQL version | UNKNOWN |
| Production read authorization | NOT_AUTHORIZED |
| Network authorization | NOT_AUTHORIZED |
| Database access method | NONE |
| Audit 01 identity | Same root, branch, commit, and working-tree condition; reconciled |
| Applicable governance | `AGENTS.md`; `.cursor/PROTECTED_FILES.md`; `docs/START_HERE.md`; `docs/ops/DOC_STATUS_REGISTRY.md`; `docs/ops/SUPABASE_TARGETING.md`; `docs/ops/SUPABASE_ENVIRONMENT_REGISTRY.md`; `docs/oracle/ORACLE_EVOLUTION_PROTOCOL.md` |
| Audit-artifact location | RESPONSE_ONLY |
| Audit status | COMPLETE_WITH_BLOCKERS |
| Auditor limitations | No network, database, Storage, Edge Function, RPC, AI-provider, build, test, migration, type-generation, or package-manager execution. No customer records, raw JSON, source documents, secrets, or environment files were inspected. Git could not read the user-global ignore file, but tracked/untracked repository status was established. |
| Repository changes caused by Audit 02 | NONE |

## Executive findings

1. **Repository schema authority is confirmed:** intended reproducible schema is owned by 164 ordered, handwritten Supabase SQL migrations under `supabase/migrations`. Runtime querying uses Supabase clients and handwritten SQL/RPCs. No ORM owns schema work. [A02-004, A02-005]

2. **Drizzle status:** `ABSENT_CONFIRMED`. The same result applies to Prisma, TypeORM, Sequelize, Kysely, MikroORM, and Knex within the verified repository scope. [A02-005]

3. **Deployed schema remains UNKNOWN.** No target environment, database authorization, applied-migration ledger, metadata snapshot, or live schema evidence was supplied. Repository migrations and generated types cannot establish deployment. [A02-008]

4. **Generated types are not current schema authority.** `src/integrations/supabase/types.ts` omits the later migration-defined `quote_observations`, `quote_line_items`, `normalization_failures`, and `leads.is_test`. [A02-007]

5. **The canonical scanner TypeScript contract is identifiable, but the exclusive runtime extraction contract is not.** `scan-quote/scoring.ts::ExtractionResult` drives scoring and report compilation, while runtime validation enforces only four root properties and line-item descriptions before casting the entire object. Additional undeclared keys can therefore survive into `analyses.full_json`. [A02-016, A02-018]

6. **Prompt, TypeScript, and runtime nullability conflict.** The prompt requires literal `null` for missing fields; many TypeScript fields are optional but do not permit `null`; runtime validation does not reconcile the difference. Some derived projections also collapse `0`, empty string, and missing values through truthiness operations. [A02-017, A02-020]

7. **Existing fact ownership is divided:**
   - `wm_quote_facts` is actively written by the canonical event path.
   - `quote_observations`, `quote_line_items`, and `normalization_failures` have migrations and a normalization helper, but the helper has no production caller.
   - `wm_quote_reviews` and `wm_pricing_index_snapshots` are migration-only.
   - `quote_intelligence_facts` is absent from the verified repository scope.
   - `county_benchmarks` has writer source but no repository table definition. [A02-022–A02-025]

8. **Quote, revision, and attempt identity are insufficiently modeled for intelligence profiling.** There is no explicit quote or revision entity. One `analyses` row is upserted per scan session, stale retries overwrite it, and admin re-scan deletes the prior analysis before invoking the scanner. [A02-010–A02-015, A02-031]

9. **Monetary semantics are not profile-safe yet.** Scanner extraction and derived metrics use JavaScript numbers interpreted as dollar-scale values without a currency field or reliable installed/product-price basis. The dormant normalization helper can convert those values to integer cents, but it is not part of the active scanner path. [A02-021, A02-022]

10. **No Audit 04 SQL binding is safe.** Repository intent alone does not establish deployed objects, JSON populations, table sizes, role visibility, indexes, units, or data quality. [A02-032]

# Schema-authority verdict

| Concern | Verdict | Evidence |
|---|---|---|
| Intended reproducible schema | `SUPABASE_MIGRATIONS_CONFIRMED` | 164 handwritten SQL migrations; A02-004 |
| Migration authoring owner | Handwritten PostgreSQL/Supabase SQL | A02-004 |
| Migration application authority | UNKNOWN | No applied ledger or authorized environment; A02-008 |
| Live deployed schema | UNKNOWN | A02-008 |
| Runtime querying | Supabase JavaScript clients, RPC calls, and handwritten SQL functions | A02-006, A02-009 |
| Runtime typing | Generated Supabase types, but demonstrably drifted | A02-007 |
| Drizzle status | `ABSENT_CONFIRMED` | A02-005 |
| Other ORM status | `ABSENT_CONFIRMED` for searched ORMs | A02-005 |
| Test schema | Repository SQL tests and ephemeral CI migration replay | A02-004, A02-033 |
| Schema drift detection | Migration-chain workflow exists; type-generation comparison is not enforced by that workflow | A02-006, A02-007 |
| Rollback convention | Mostly forward migrations; some human-operated rollback comments/docs | A02-004 |
| Extraction contract authority | Compile-time/scoring authority confirmed; exclusive runtime shape unresolved | A02-016–A02-019 |
| Audit 04 readiness | `NEEDS_SCHEMA_BINDING` | A02-032 |

## Schema-authority artifact inventory

| Artifact | Path | Intended role | Invoked by | Form | Environment | Freshness evidence | Authority classification | Evidence |
|---|---|---|---|---|---|---|---|---|
| Supabase migrations | `supabase/migrations/*.sql` | Reproducible intended schema, policies, functions, triggers | Supabase/release processes | Handwritten SQL | Environment-independent intent | 164 ordered SQL files through 2026-08-29 | Primary repository schema authority | A02-004 |
| Supabase configuration | `supabase/config.toml` | Local/function configuration | Supabase CLI | Handwritten config | Local/deployment intent | Contains function declarations including `calculate-estimate-metrics` | Configuration authority only | A02-006 |
| Generated database types | `src/integrations/supabase/types.ts` | TypeScript query/result typing | Frontend and services | Generated | Source snapshot of an unidentified deployed state | Missing later migration objects/columns | Non-authoritative, drifted | A02-007 |
| Type-generation scripts | `package.json:30-31` | Generate/compare types against a hardcoded project-ref candidate | Operator-run npm scripts | Script | Target not operator-confirmed | Not executed | Procedure only | A02-006 |
| Type-generation documentation | `docs/db/TYPEGEN_WORKFLOW.md:1-50` | Human workflow | Operator | Documentation | Describes remote project access | States generated file is sole output | Supporting, not schema authority | A02-006 |
| Migration integrity workflow | `.github/workflows/supabase-migration-integrity.yml:1-364` | Replay migration chain on ephemeral PostgreSQL; optional staging smoke | Manual GitHub workflow | CI YAML | Ephemeral PostgreSQL 15; optional staging | Current execution status unavailable | Validation mechanism, NOT_EXECUTED | A02-004, A02-033 |
| SQL tests | `supabase/tests/*.sql` | pgTAP/schema-policy assertions | Test workflow/operator | Handwritten SQL | Test | 11 files | Test evidence only, NOT_EXECUTED | A02-033 |
| Normalization release script | `scripts/apply-pr173-four-migrations-live.ps1` | Guarded allowlisted migration application and metadata checks | Human operator | PowerShell/SQL | Intended live environment | No supplied execution ledger | Deployment tooling only | A02-008 |
| Normalization helper | `supabase/functions/_shared/normalizeAnalysis.ts` | Transform `full_json` into normalized facts | No production caller found | TypeScript | Edge/server candidate | Tested source, not wired | Dormant writer implementation | A02-022 |
| ORM artifacts | Verified manifests, lockfiles, source, functions, scripts, workflows | None found | None | None | N/A | Exhaustive named search | `ABSENT_CONFIRMED` | A02-005 |

# Repository-versus-database authority matrix

| Concern | Repository migrations | Applied migration evidence | Live schema | Generated types | ORM | Runtime | Tests/docs | Conflict | Authority conclusion | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| Intended schema | 164 ordered SQL files | None supplied | Not inspected | Partial snapshot | None | Assumes migration objects | CI can replay chain | Types lag migrations | Migrations authoritative for intent | A02-004, A02-007 |
| Deployed schema | Candidate definitions only | UNKNOWN | UNKNOWN | Unbound snapshot | None | Code names expected objects | No current deployment proof | Multiple evidence domains unbound | UNKNOWN | A02-008 |
| Migration authoring | Handwritten SQL | UNKNOWN | UNKNOWN | N/A | None | N/A | Release scripts | None | Handwritten Supabase SQL | A02-004, A02-005 |
| Migration application | Release tooling exists | No ledger/output | UNKNOWN | N/A | None | N/A | Workflow optional | Tooling is not execution proof | UNKNOWN | A02-008 |
| Runtime querying | N/A | N/A | UNKNOWN | Types assist some callers | None | Direct Supabase queries/RPCs | Tests cover selected paths | Runtime references objects absent from types | Runtime source is query authority, not schema authority | A02-006, A02-007 |
| Test schema | SQL fixtures/assertions | NOT_EXECUTED | N/A | N/A | None | Tests/stubs | Ephemeral PG workflow | Test pass status unknown | Test intent only | A02-033 |
| Seed behavior | No canonical production seed identified | UNKNOWN | UNKNOWN | N/A | None | Dev scenario creates synthetic rows | Test fixtures exist | `is_test` propagation incomplete | UNKNOWN | A02-030 |
| Environment differences | Repository targeting docs/scripts exist | UNKNOWN | UNKNOWN | Project-ref candidate only | None | Environment variables select behavior | No authorized environment | Target identity unresolved | UNKNOWN | A02-008 |
| Drift detection | Migration replay workflow | No current result supplied | Not inspected | Typegen check exists as script | None | N/A | No observed enforced current typegen result | Confirmed type drift | PARTIAL | A02-006, A02-007 |
| Rollback | Forward migrations plus limited operator comments/docs | UNKNOWN | UNKNOWN | N/A | None | Admin rescan deletes analysis data | Tests not run | No global rollback contract | PARTIAL | A02-004, A02-015 |
| Profiling bindings | Candidate tables and paths | UNKNOWN | UNKNOWN | Incomplete | None | Active and dormant fact writers differ | No aggregate data | No deployed confirmation | Unsafe for SQL generation | A02-032 |

# Relevant object inventory

## Objects and ownership

| Object ID | Evidence domain | Schema/object | Kind | Definition source | Repository writers | Repository readers | Deployed status | Evidence |
|---|---|---|---|---|---|---|---|---|
| OBJ-01 | Migrations/types/runtime | `public.leads` | Table | `20260317051701...sql`, later alterations | Intake functions, admin and lifecycle functions | Scanner, admin, routing, reporting | UNKNOWN | A02-009 |
| OBJ-02 | Migrations/types/runtime | `public.quote_files` | Table | `20260317051701...sql:18-25` | `start-upload-scan-session` | Scanner/session bootstrap | UNKNOWN | A02-009, A02-011 |
| OBJ-03 | Migrations/types/runtime | `public.scan_sessions` | Table | `20260318033459...sql:29-55` | Bootstrap, scanner, admin, OTP/reveal flows | Scanner, report and admin paths | UNKNOWN | A02-009–A02-012 |
| OBJ-04 | Migrations/types/runtime | `public.analyses` | Canonical lifecycle table | `20260318033459...sql:57-87` plus alterations | `scan-quote` upsert; admin rescan deletes | Preview/full RPCs, admin and report consumers | UNKNOWN | A02-009–A02-015 |
| OBJ-05 | Migrations/types | `public.quote_analyses` | Legacy table | `20260317051701...sql:27-35` | No production writer found | No production reader found | UNKNOWN | A02-024 |
| OBJ-06 | Migrations/types/runtime | `public.phone_verifications` | Table | Base migration plus strict scan-binding migration | OTP functions | `get_analysis_full`, OTP/admin readers | UNKNOWN | A02-014 |
| OBJ-07 | Migrations/types/runtime | `public.wm_event_log` | Canonical event table | `20260414110000...sql:82-139` | Canonical event persistence | Dispatch/admin paths | UNKNOWN | A02-023 |
| OBJ-08 | Migrations/types/runtime | `public.wm_quote_facts` | Fact-like table | `20260414110000...sql:141-202` | Canonical event persistence upsert | No direct production DB reader found; optional in-memory qualification support exists | UNKNOWN | A02-023 |
| OBJ-09 | Migrations/types | `public.wm_quote_reviews` | Review table | `20260414110000...sql:204-242` | None found | None found | UNKNOWN | A02-024 |
| OBJ-10 | Migrations/types | `public.wm_pricing_index_snapshots` | Snapshot table | `20260414110000...sql:244-270` | None found | None found | UNKNOWN | A02-024 |
| OBJ-11 | Migrations/helper | `public.quote_observations` | Normalized quote fact header | `20260806144716...sql:5-34` | Dormant `normalizeAnalysis` helper | No production reader found | UNKNOWN | A02-022 |
| OBJ-12 | Migrations/helper | `public.quote_line_items` | Normalized repeatable facts | `20260806144716...sql:39-87` | Dormant `normalizeAnalysis` helper | No production reader found | UNKNOWN | A02-022 |
| OBJ-13 | Migrations/helper | `public.normalization_failures` | Diagnostic table | `20260806144716...sql:95-116` | Dormant `normalizeAnalysis` helper | No production reader found | UNKNOWN | A02-022 |
| OBJ-14 | Runtime source only | `public.county_benchmarks` | Expected benchmark table | No table definition found | `refresh-benchmarks` function source | Active metrics use static constants; DB reader is commented out | UNKNOWN | A02-025 |
| OBJ-15 | Migrations/types/runtime | `public.contractor_outcomes` | Outcome table | `20260324043022...sql` plus alterations | Contractor/admin outcome paths | Revenue/contractor/admin paths | UNKNOWN | A02-029 |
| OBJ-16 | Search result | `public.quote_intelligence_facts` | Expected fact table | No exact repository artifact found | None | None | UNKNOWN/absent from repository | A02-024 |
| OBJ-17 | Migrations/runtime | `public.lead_attribution_details` plus attribution fields on `leads` | Attribution model | `20260425064117...sql` and lead alterations | Intake/tracking paths | Admin/tracking | UNKNOWN | A02-009 |
| OBJ-18 | Migrations/runtime | Contractor/account/opportunity/assignment tables | Contractor lifecycle | Multiple migrations beginning `20260324033303...sql` | Contractor/admin/routing functions | Contractor/admin/routing | UNKNOWN | A02-029 |

## Key column inventory

| Object | Column/group | Type and nullability from repository intent | Default/key behavior | PII potential | Runtime use | Deployed evidence | Evidence |
|---|---|---|---|---|---|---|---|
| `leads` | `id` | `uuid NOT NULL` | PK, generated | Identifier | Parent identity | None | A02-009 |
| `leads` | `session_id` | `text NOT NULL` | No verified global uniqueness | Pseudonymous identifier | Browser/intake continuity | None | A02-009 |
| `leads` | `first_name`, `email`, `phone_e164`, address/geography fields | Nullable text | Various later additions | Direct PII | Intake, OTP, routing | None | A02-009, A02-033 |
| `leads` | `latest_analysis_id` | Nullable UUID | Indexed; pointer maintained through RPC | Identifier | Current completed analysis pointer | None | A02-013 |
| `leads` | `is_test` | `boolean NOT NULL DEFAULT false` in later migration | Missing from generated types | Data-classification flag | Trigger guards; not reliably populated by dev writer | None | A02-007, A02-030 |
| `quote_files` | `id`, `lead_id`, `storage_path`, `status`, `created_at` | UUID/text/timestamp; `storage_path NOT NULL` | No repository unique constraint on `storage_path` found | Storage path may be sensitive | Upload registration and scanner lookup | None | A02-009, A02-011 |
| `scan_sessions` | `id`, `lead_id`, `quote_file_id`, `status` | UUIDs/text; `quote_file_id` nullable but unique | One scan-session row per non-null quote file | Identifiers | Canonical scanner/session identity | None | A02-009, A02-010 |
| `analyses` | `id`, `scan_session_id`, `lead_id` | UUIDs | PK; unique index on `scan_session_id` | Identifiers | One mutable analysis row per scan session | None | A02-009, A02-010 |
| `analyses` | `proof_of_read`, `preview_json`, `full_json`, `flags` | Nullable/defaulted `jsonb` | `flags` defaults to `[]` | `full_json` may contain protected raw extraction/free text | Scanner persistence; report RPCs | None | A02-009, A02-020 |
| `analyses` | `grade`, `confidence_score`, `document_type`, `rubric_version`, AI judgment columns | Text/numeric, nullable | Updated by scanner upsert | Low PII except derived linkage | Report/scoring lifecycle | None | A02-009, A02-020 |
| `analyses` | `analysis_status` | Text, non-null | `pending`; check permits pending/processing/complete/failed/invalid_document/needs_better_upload | No | Lifecycle gate | None | A02-010 |
| `wm_event_log` | identity/version/status/payload groups | Typed columns plus `jsonb` payloads | Unique `event_id` | Payload/raw payload may contain sensitive material | Event persistence/dispatch | None | A02-023 |
| `wm_quote_facts` | `analysis_id` | `uuid NOT NULL` | FK cascade; unique | Identifier | Upsert conflict key | None | A02-023 |
| `wm_quote_facts` | trust/quality/approval fields | Bounded numerics, booleans, enum | Several false/zero-like defaults supplied by writer | No direct PII | Canonical event projection | None | A02-023 |
| `wm_quote_facts` | `quote_amount`, `price_per_opening`, `deposit_percent` | PostgreSQL numeric | Nonnegative checks | Financial | Dollar-scale source semantics unresolved | None | A02-021, A02-023 |
| `wm_quote_facts` | `normalized_facts`, `trust_inputs` | `jsonb NOT NULL` | `{}` default | May retain source-derived text | Canonical quote projection | None | A02-023 |
| `quote_observations` | identifiers/geography/contractor fields | UUID/text nullable except `analysis_id` | Unique `analysis_id`; lead FK SET NULL | Geography and contractor name may be identifying | Dormant normalizer | None | A02-022 |
| `quote_observations` | cents/count/eligibility fields | `bigint`, integer, numeric, booleans | `line_item_count=0`, eligibility false | Financial | Dormant normalizer | None | A02-022 |
| `quote_line_items` | description/dimensions/product fields | Text/numeric/booleans | Unique `(observation_id,line_index)` | Free-form source text | Dormant normalizer | None | A02-022 |
| `normalization_failures` | analysis/stage/reason/excerpt/version | UUID/text/timestamp | No analysis FK; excerpt limited to 500 chars | Excerpt may retain sensitive source text despite intended redaction | Dormant normalizer | None | A02-022, A02-033 |
| `contractor_outcomes` | outcome and value fields | Mixed identifiers, statuses, cents and text | Includes verification/integrity state | Notes/URL may be sensitive | Outcome/revenue lifecycle | None | A02-029 |
| `contractor_outcomes` | `signed_contract_url` | Nullable text | Not a contract entity | Sensitive link/path potential | Reference only | None | A02-029 |
| `contractor_outcomes` | `final_value_cents`, `projected_value_cents`, `sold_currency` | Nullable integer-like generated number; currency non-null in types | Explicit cent/currency semantics | Financial | Sold outcome | None | A02-029 |

## Key constraints, indexes, and relationships

| Object | Constraint/index | Kind | Columns/expression | Referenced object | Delete behavior | Intended status | Deployed status | Evidence |
|---|---|---|---|---|---|---|---|---|
| `scan_sessions` | `quote_file_id UNIQUE` | Unique/FK | `quote_file_id` | `quote_files.id` | CASCADE | Intended | UNKNOWN | A02-009, A02-010 |
| `analyses` | `analyses_scan_session_id_unique` | Unique index | `scan_session_id` | — | — | Intended | UNKNOWN | A02-010 |
| `analyses` | Session/lead FKs | Foreign keys | `scan_session_id`, `lead_id` | `scan_sessions`, `leads` | CASCADE | Intended | UNKNOWN | A02-009 |
| `quote_files` | Lead FK | Foreign key | `lead_id` | `leads.id` | CASCADE | Intended | UNKNOWN | A02-009 |
| `quote_files` | Storage-path uniqueness | No definition found | `storage_path` | — | — | Absent from repository intent | UNKNOWN | A02-011 |
| `wm_event_log` | Event ID unique | Unique | `event_id` | — | — | Intended | UNKNOWN | A02-023 |
| `wm_quote_facts` | Analysis unique | Unique/FK | `analysis_id` | `analyses.id` | CASCADE | Intended | UNKNOWN | A02-023 |
| `quote_observations` | Analysis unique | Unique/FK | `analysis_id` | `analyses.id` | CASCADE | Intended | UNKNOWN | A02-022 |
| `quote_line_items` | Observation/line unique | Unique/FK | `(observation_id,line_index)` | `quote_observations.id` | CASCADE | Intended | UNKNOWN | A02-022 |
| `normalization_failures` | No analysis FK | Intentional omission | `analysis_id` | None | Survives deletion | Intended | UNKNOWN | A02-022 |
| `phone_verifications` | Phone/scan/status indexes | Indexes | `phone_e164`, `scan_session_id`, `status` | Logical scan binding | — | Intended | UNKNOWN | A02-014 |
| `leads` | Latest pointer index | Partial index | `latest_analysis_id WHERE NOT NULL` | Logical pointer; no confirmed FK | — | Intended | UNKNOWN | A02-013 |

# Entity relationship model

| Concept | Actual object/type | Primary identifier | Parent | Children | Cardinality supported by repository | Creation/update path | Supersession/deletion | Evidence |
|---|---|---|---|---|---|---|---|---|
| Homeowner/project | `leads` conflates lead identity and project attributes | `leads.id` | None | Files, sessions, analyses, opportunities, outcomes | One lead can have multiple files/sessions/analyses | Intake/lead functions | No project revision model | A02-009, A02-028 |
| Source document | `quote_files` plus private Storage object | `quote_files.id` | Lead | One scan session at most | Many files per lead; one session per file by unique constraint | `start-upload-scan-session` | Lead deletion cascades; no document version chain | A02-009–A02-011 |
| Quote | No explicit quote entity | Inferred from file/session/analysis | Lead/file | Analysis/report | Ambiguous | Scanner path | No quote-level supersession | A02-028 |
| Quote revision | No entity or lineage field | None | Quote/project | None | Unresolved | None | None | A02-028 |
| Analysis attempt | `analyses`, but one mutable row per scan session | `analyses.id` | Session and lead | Facts/events/report projection | At most one row per scan session; not an attempt history | Upsert on `scan_session_id` | Retry overwrites; admin rescan deletes | A02-010, A02-012, A02-015 |
| Truth Report | Computed projection from `analyses` | `analysis_id`/`scan_session_id` | Analysis | Browser payload | One current projection per selected complete analysis | Preview/full RPC and report-access | No stored report revision | A02-014, A02-020 |
| Opening/line item | `ExtractionResult.line_items[]`; dormant `quote_line_items` | Array position / `(observation_id,line_index)` | Analysis/observation | Product attributes | Repeatable; array index is not durable across re-extraction | AI extraction; optional normalizer | Full child replacement on normalization retry | A02-016, A02-022 |
| Contractor | `contractors`, accounts/profiles; extraction uses raw name/address strings | Contractor UUIDs in contractor domain | None | Opportunities/outcomes | No FK from extraction contractor string | Separate contractor paths | Unresolved matching | A02-028, A02-029 |
| Manufacturer/product | No dedicated manufacturer/product entity | None | Line item | None | Raw `brand`/`series` only | Extraction | None | A02-028 |
| Lead/referral | `leads`, attribution JSON/columns, `lead_attribution_details` | Lead/event IDs | None | Events | Referral is attribution, not an explicit entity | Intake/tracking | No referral revision model | A02-009, A02-028 |
| Outcome event | `contractor_outcomes`, event tables | Outcome UUID | Opportunity/contractor/lead assignment | Revenue events | Multiple downstream records possible | Contractor/admin workflows | Integrity/status model exists | A02-029 |
| Signed contract | `contractor_outcomes.signed_contract_url` only | None | Outcome | None | Reference, not modeled contract | Outcome update | No contract revisions | A02-029 |
| Change order | Extraction fields only | None | Analysis | None | No relational entity | AI extraction | No lifecycle | A02-016, A02-028 |
| Final invoice | No dedicated entity found | None | Outcome/project | None | Unresolved | None | None | A02-028 |

# Quote, revision, and analysis lifecycle

## State model

| Object | State | Entry condition/writer | Next state | Terminal | Retryable | Partial failure representation | Supersession | Evidence |
|---|---|---|---|---|---|---|---|---|
| `quote_files` | `pending` | Bootstrap insert | No complete repository state machine established | UNKNOWN | UNKNOWN | Separate scan/session state | None | A02-011 |
| `scan_sessions` | `idle`/`uploading` | Base/admin/bootstrap | `processing` | No | Yes | Session row exists without complete analysis | None | A02-009, A02-011, A02-012 |
| `scan_sessions` | `processing` | Scanner | `preview_ready`, `invalid_document`, `needs_better_upload` | No | Fresh invocation blocked; stale row can be taken over | May coexist with a complete analysis if pointer/session finalization fails | None | A02-012 |
| `scan_sessions` | `preview_ready` | Analysis and pointer completed, status write succeeds | OTP/reveal lifecycle outside this audit | Scanner treats as terminal | No scanner retry | Report available | None | A02-012 |
| `scan_sessions` | `invalid_document` / `needs_better_upload` | Classification/parser/validation termination | Upload/retry requires external flow | Scanner terminal | Not on same invocation | Analysis may contain classification-only fields | None | A02-012 |
| `analyses` | `pending` | DB default | `processing` | No | Yes | Sparse row possible | Same row overwritten | A02-010, A02-012 |
| `analyses` | `processing` | Scanner upsert or compensation | `complete` or terminal classification state | No | Yes via stale recovery | Can retain full report fields after compensation rollback to processing | Same row overwritten | A02-012 |
| `analyses` | `complete` | Full scanner upsert | Current pointer sync and session `preview_ready` | Report-selectable | Same-session upsert can overwrite | Can remain complete while session remains processing on pointer failure | Lead pointer selects newest complete | A02-012–A02-014 |
| `analyses` | `invalid_document` / `needs_better_upload` | Classification gate | Terminal for scanner call | Yes | External rescan possible | Sparse classification record | Admin rescan deletes it | A02-012, A02-015 |
| Lead analysis pointer | Current completed analysis | Service-role RPC validates same lead and `complete` status | Advances by `(created_at,id)` | N/A | Idempotent | Invalid pointer can be repaired | Monotonic newest completed analysis | A02-013 |
| Admin re-scan | Existing latest scan | Admin sets session `idle`, deletes analysis, invokes scanner | New analysis row after deletion | No | Yes | Delete can succeed before scanner invocation fails | Previous analysis/facts are removed through cascades | A02-015 |

The lifecycle is not transactional across analysis upsert, lead-pointer RPC, canonical events, and scan-session finalization. A compensating update returns the analysis to `processing` if the final session status update fails, but no single database transaction covers the sequence. [A02-012]

# Extraction-contract authority

## Candidate contracts

| Candidate | Path and symbol | Producer | Runtime enforcement | Persistence link | Consumers | Versioned | Conflicts | Authority status | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Scanner contract | `supabase/functions/scan-quote/scoring.ts:11-159`, `ExtractionResult` | Gemini prompt/parser | Compile-time only except shallow validator | Entire object stored under `full_json.extraction` | Scoring, diagnostics, flags, report compiler, scanner | Rubric `1.6.0`; extraction schema itself unversioned | Prompt nullability and runtime acceptance differ | Canonical compile-time/scoring contract | A02-016–A02-018 |
| Runtime validator | `scan-quote/index.ts:201-235`, `validateExtraction` | Parsed Gemini response | Enforces object; three typed root fields; line-item array; description strings | Cast result persisted | Scanner | Unversioned | Accepts undeclared properties and wrong types for all other declared fields | Actual minimum runtime gate | A02-018 |
| Prompt-declared shape | `scan-quote/index.ts:368-526` | Static Gemini prompt | Provider instructed, not response-schema enforced | Parsed then shallow-validated | Scanner | No prompt version | Requires nulls; omits some TypeScript fields | Advisory producer contract | A02-017 |
| Classification coercion | `scan-quote/index.ts:1087-1142` | Parser/classification normalizer | Coerces classification fields before full validation | Passed into extraction | Classification gate | Unversioned | Does not enforce complete field shape | Partial runtime authority | A02-018 |
| Metrics endpoint contract | `calculate-estimate-metrics/index.ts:37-69` | Endpoint caller | Only checks an extraction object before deterministic processing | Does not persist analysis | Standalone endpoint | “V2.0” comment only | Smaller nullable contract; no repository caller found | Present, independent role unresolved | A02-019 |
| Normalization read contract | `_shared/normalizeAnalysis.ts:573-740` | Stored `full_json` | Defensive per-field coercion | Would write observation/line tables | No production caller | `NORMALIZATION_VERSION="v1"` | Accepts fields not declared in canonical interface, including width/height aliases | Dormant normalization contract | A02-022 |
| Truth Report V2 projection | `report-access/index.ts:50,331-367` | Authorized `full_json` | Defensive selective projection | Response-only | Full report caller | `v2-source-2026-05` | Report projection version is not persisted with analysis | Consumer projection, not extraction authority | A02-020 |

**Extraction authority verdict:** the declared scanner field inventory below is complete for `scoring.ts::ExtractionResult`, but complete enumeration of all runtime-accepted fields is impossible because the validator retains arbitrary extra keys. `COMPLETE_DECLARED_CONTRACT / INCOMPLETE_EXCLUSIVE_RUNTIME_CONTRACT`. [A02-016–A02-018]

# Complete declared field coverage matrix

Notation:

- `required` means required by the TypeScript interface.
- `optional` means the key may be absent.
- `nullable` means explicit `null` is allowed by the TypeScript interface.
- “Prompt nullable” records the conflicting producer instruction.
- Every extraction value is retained in `analyses.full_json.extraction` on the complete path.
- No declared field carries a source-page or evidence-region reference.

| Source path(s) | Declared type / optionality | Cardinality | Raw/derived | Unit/basis | PII class | Current additional persistence/consumers | Analytics relevance and audit disposition | Evidence |
|---|---|---|---|---|---|---|---|---|
| `document_type`; `is_window_door_related`; `confidence` | Required `string`; `boolean`; number `[0,1]` runtime-checked | One | AI classification/confidence | Confidence ratio | Non-PII | Direct analysis columns; classification/scoring | Candidate quality/provenance fields; deployed binding required | A02-016, A02-018, A02-020 |
| `page_count` | Optional number; prompt nullable | One | Extracted | Pages | Non-PII | `proof_of_read.page_count`; `0` becomes null through `||` | Provenance candidate; null/zero semantics blocked | A02-016, A02-017, A02-020 |
| `line_items`; `line_items[]` | Required array/container; repeatable object | Zero or more | Extracted | N/A | May contain source text | Scoring, metrics, report; dormant line normalization | Central candidate branch; array position not durable identity | A02-016, A02-018, A02-022 |
| `line_items[].description`; `.quantity`; `.unit_price`; `.total_price` | Description required string; others optional number but prompt nullable | Per item | Extracted | Quantity unknown basis; prices presumed dollar-scale | Description may contain sensitive text | Metrics/scoring; dormant cents normalization | Numeric candidates blocked by basis/currency; description excluded from profiling output | A02-016, A02-017, A02-021, A02-022 |
| `line_items[].brand`; `.series`; `.dp_rating`; `.noa_number`; `.dimensions` | Optional string; prompt nullable | Per item | Extracted | Dimensions remain raw printed units | Product evidence; low PII | Scoring/report; dormant normalized columns | Candidate facts, but dimensions/unit parsing and approval semantics require binding | A02-016, A02-017, A02-022 |
| `line_items[].glass_package_text`; `.glass_makeup_type`; `.glass_low_e_present`; `.glass_argon_present`; `.glass_tint_text`; `.glass_spec_complete` | Optional explicit nullable; makeup enum or null | Per item | Extracted/classified | Text/boolean | Free text may be sensitive | Scoring/report; dormant line columns | Candidate product facts; free text excluded from aggregate output | A02-016 |
| `line_items[].opening_location`; `.opening_tag`; `.product_assignment_text` | Optional explicit nullable strings | Per item | Extracted | Text | Location/tag may reveal room/location details | Scoring/report; dormant line columns | Potentially sensitive; not safe for profiling without de-identification review | A02-016, A02-033 |
| `warranty`; `warranty.labor_years`; `.manufacturer_years`; `.transferable`; `.details` | Optional object with optional non-null leaves; prompt permits nullable object/leaves | One | Extracted | Years/boolean/text | Details are free text | Scoring/report | Numeric/boolean candidates; details excluded; nullability conflict | A02-016, A02-017 |
| `permits`; `permits.included`; `.responsible_party`; `.details` | Optional object with optional non-null leaves; prompt nullable | One | Extracted | Boolean/text | Responsible party/details may identify entities | Scoring/report/metrics | Boolean candidate; text restricted; nullability conflict | A02-016, A02-017 |
| `installation`; `installation.scope_detail`; `.disposal_included`; `.accessories_mentioned` | Optional object with optional non-null leaves; prompt nullable | One | Extracted | Text/boolean | Scope is source text | Scoring/report/metrics | Booleans candidates; free text excluded | A02-016, A02-017 |
| `cancellation_policy`; `total_quoted_price`; `opening_count`; `contractor_name`; `hvhz_zone` | Optional string/number/number/string/boolean; prompt nullable | One | Extracted/classified | Price presumed dollars; count; geography flag | Contractor name identifying; policy text sensitive | Analysis proof/metrics/report; contractor name in dormant observation | Numeric/boolean candidates blocked by units; names/text excluded | A02-016, A02-017, A02-021 |
| `price_fairness`; `markup_estimate`; `negotiation_leverage` | Optional strings; not present in current prompt output schema | One | AI judgment | Unspecified | Non-PII derived | Direct analysis columns and report | Not extraction facts; authority/provenance unresolved | A02-016, A02-017, A02-020 |
| `subject_to_remeasure_present`; `subject_to_remeasure_text`; `deposit_percent`; `deposit_amount`; `final_payment_before_inspection`; `payment_schedule_text` | Optional non-null TS fields; prompt nullable | One | Extracted | Percent, presumed dollars, text/boolean | Contract/payment text sensitive | Scoring/flags/report; deposit percent projected to facts | Numeric/boolean candidates blocked by price basis; text excluded | A02-016, A02-017, A02-021 |
| `terms_conditions_present` | Optional boolean; prompt nullable | One | Extracted | Boolean | Non-PII | Scoring/flags/report | Candidate fact; unknown/null distinction must be preserved | A02-016, A02-017 |
| `wall_repair_scope`; `stucco_repair_included`; `drywall_repair_included`; `paint_touchup_included`; `debris_removal_included`; `engineering_mentioned`; `engineering_fees_included`; `permit_fees_itemized` | Optional string/booleans; prompt nullable | One | Extracted | Text/boolean | Scope text sensitive | Scoring/flags/report | Boolean candidates; free text excluded | A02-016, A02-017 |
| `insurance_proof_mentioned`; `licensing_proof_mentioned`; `completion_timeline_text`; `lead_paint_disclosure_present` | Optional booleans/string; prompt nullable | One | Extracted | Boolean/text | Timeline/free text potentially sensitive | Scoring/flags/report | Boolean candidates; timeline excluded | A02-016, A02-017 |
| `generic_product_description_present` | Optional boolean; prompt nullable | One | Extracted classification | Boolean | Non-PII | Scoring/report | Candidate quality flag | A02-016, A02-017 |
| `opening_level_glass_specs_present`; `blanket_glass_language_present`; `mixed_glass_package_visibility` | Optional nullable booleans | One | Extracted classification | Boolean | Non-PII | Scoring/report | Candidate quality/product facts | A02-016 |
| `opening_schedule_present`; `opening_schedule_room_labels_present`; `opening_schedule_dimensions_complete`; `opening_schedule_product_assignments_present`; `bulk_scope_blob_present` | Optional nullable booleans | One | Extracted classification | Boolean | Non-PII | Scoring/report | Candidate completeness facts | A02-016 |
| `change_order_policy_text`; `written_change_order_required`; `homeowner_approval_required_for_change_orders`; `unilateral_price_adjustment_allowed`; `substrate_condition_clause_present`; `rot_unit_pricing_present`; `buck_replacement_unit_pricing_present`; `substrate_allowance_text`; `remeasure_price_adjustment_cap_present` | Optional nullable text/booleans | One | Extracted | Text/boolean; unit-pricing presence only | Contract text sensitive | Scoring/flags/report; V2 report projection | Boolean candidates; text excluded; no change-order entity | A02-016, A02-020, A02-028 |
| `anchoring_method_text`; `anchor_spacing_specified`; `fastener_type_specified`; `waterproofing_method_text`; `sealant_specified`; `buck_treatment_method_text`; `manufacturer_install_compliance_stated`; `code_compliance_install_statement_present` | Optional nullable text/booleans | One | Extracted | Text/boolean | Source text sensitive | Scoring/report | Boolean candidates; text excluded | A02-016 |
| `warranty_execution_details_present`; `warranty_service_provider_type`; `warranty_service_provider_name`; `leak_callback_sla_days`; `labor_service_sla_days`; `callback_process_text`; `post_install_stucco_excluded`; `post_install_paint_excluded`; `water_intrusion_damage_excluded` | Optional nullable boolean/enum/string/numbers/text | One | Extracted | Days/boolean/text | Provider/name/process may identify entities | Scoring/report | Numeric/boolean/enum candidates; names/text excluded | A02-016 |
| `contractor_address_text` | Optional string in TS; prompt nullable | One | Extracted | Address text | Direct identifying location | Used for jurisdiction inference; stored in full JSON | Exclude from profile/output; de-identification required | A02-016, A02-017, A02-033 |
| `state_jurisdiction_mismatch` | Optional boolean; not prompt-declared | One | Deterministically mutated after extraction under a narrow address condition | Boolean | Non-PII derived from PII-like address | Scoring/report | Derived candidate only; derivation/version absent | A02-016, A02-018 |
| Undeclared extra keys, including normalizer-recognized `line_items[].width`, `.height`, `.raw_dimensions` | Unbounded because runtime validator preserves extra properties | Unknown | Unknown | Unknown | Unknown | Persisted within raw extraction if returned; normalizer may consume some | Complete field enumeration impossible; blocked | A02-018, A02-022 |

## Required category reconciliation

| Required category | Contract paths | Coverage | Ambiguity | Build implication | Evidence |
|---|---|---|---|---|---|
| Prices/totals/deposits | Root and line price fields, deposit fields | PARTIAL | Currency absent; product/installed basis absent | Monetary profile binding blocked | A02-021 |
| Fees/discounts/taxes/financing | Only line descriptions and deterministic keyword buckets | PARTIAL | No dedicated extraction fields; financing absent | Cannot profile exact categories | A02-021 |
| Precision/currency | JavaScript number and PostgreSQL numeric; dormant cents converter | PARTIAL | Currency and source precision absent | Cents normalization not established on active path | A02-021, A02-022 |
| Opening/line counts and quantity | `opening_count`, line array length, quantities | PARTIAL | Explicit count versus inferred core quantity can differ | Cohort denominator unresolved | A02-021 |
| Dimensions/units | Raw `dimensions`; dormant parser | PARTIAL | Mixed/no units allowed; unsupported units become null | Dimension statistics blocked pending semantics | A02-017, A02-022 |
| Product/style/frame/impact/manufacturer | Description, brand, series, glass, DP, NOA | PARTIAL | No canonical product type, frame, impact boolean, or manufacturer entity | Product cohort semantics incomplete | A02-016, A02-019 |
| Design pressure/approval | DP and NOA strings | PARTIAL | No parsed approval authority/version | Exact approval comparison unsafe | A02-016 |
| Installation/permit/engineering/repairs | Multiple booleans/text fields | SUBSTANTIAL | Text free-form; unknown/null conflict | Boolean candidates only after binding |
| Warranty/payment/contract terms | Multiple fields | SUBSTANTIAL | Text sensitive; nullability conflict | Restricted projection required |
| Flags/findings | Deterministic scoring/flag output in `full_json` | DERIVED | Versioned only by rubric | Must remain separate from extraction facts | A02-020, A02-026 |
| Confidence/evidence references | Root confidence only | INSUFFICIENT | No per-field confidence, page, region, or citation | Provenance blocker | A02-027 |
| Geography | HVHZ flag plus lead county/ZIP | PARTIAL | Extraction and lead geography have different provenance | Cohort geography binding unresolved | A02-016, A02-022 |
| Contractor/homeowner identifiers | Contractor name/address only; homeowner PII in lead | PARTIAL/SENSITIVE | No normalized contractor linkage | PII and entity-resolution blocker | A02-028, A02-033 |
| Dates | No quote/document date in extraction | MISSING | `scanned_at` is analysis persistence time | Recency/quote-effective-date profile blocked | A02-022, A02-027 |
| Model/prompt/schema/parser metadata | Not in extraction/analysis | MISSING | Environment model can change without persisted value | Reproducibility blocker | A02-026 |
| Human verification/corrections | No extraction correction history | MISSING | Review/outcome fields are separate domains | Ground-truth lineage blocker | A02-026, A02-027 |

# Fact-table ownership assessment

| Object | Repository classification | Definition | Production writer | Production reader | Tests | Deployed status | Ownership assessment | Evidence |
|---|---|---|---|---|---|---|---|---|
| `analyses` | `ACTIVE_READER_AND_WRITER` | Migrations | `scan-quote` upsert | Report RPCs, report-access, admin/contractor paths | Scanner/report tests | UNKNOWN | Canonical analysis lifecycle and protected raw report store | A02-009–A02-014 |
| `quote_analyses` | `STALE_CONFIRMED` | Initial migration/types | None found | None found | None material | UNKNOWN | Legacy source artifact | A02-024 |
| `wm_quote_facts` | `ACTIVELY_WRITTEN` | Canonical event migration | Canonical event persistence | No direct production DB reader found | Canonical event tests | UNKNOWN | Event-derived projection, not proven analytics fact authority | A02-023 |
| `wm_quote_reviews` | `MIGRATION_ONLY` | Canonical event migration/types | None found | None found | None material | UNKNOWN | Unowned review table | A02-024 |
| `wm_pricing_index_snapshots` | `MIGRATION_ONLY` | Canonical event migration/types | None found | None found | None material | UNKNOWN | Unowned snapshot table | A02-024 |
| `quote_observations` | `MIGRATION_ONLY` | Normalization migration | Dormant helper only | None found | SQL/helper tests | UNKNOWN | Intended normalization header, not active pipeline | A02-022 |
| `quote_line_items` | `MIGRATION_ONLY` | Normalization migration | Dormant helper only | None found | SQL/helper tests | UNKNOWN | Intended normalized lines, not active pipeline | A02-022 |
| `normalization_failures` | `MIGRATION_ONLY` | Normalization migration | Dormant helper only | None found | SQL/helper tests | UNKNOWN | Intended diagnostics, not active pipeline | A02-022 |
| `county_benchmarks` | `UNKNOWN` | No table DDL found | `refresh-benchmarks` source expects it | Active metrics use static constants; DB reader commented | No deployment proof | UNKNOWN | Ownership/schema authority unresolved | A02-025 |
| `quote_intelligence_facts` | `ABSENT_CONFIRMED` | None | None | None | None | UNKNOWN | Exact expected object absent from verified repository | A02-024 |

`wm_quote_facts` should not be interpreted as a validated profiling table solely because it is actively written. The scanner’s canonical event supplies `identityStrength=0.4`, `anomalyScore=0`, `trustScore=0`, `anomalyStatus="review"`, derives several quality scores from rubric pillars, and omits an actual duplicate detector, causing the fact writer’s duplicate fallback to remain false. [A02-023]

# Provenance and versioning assessment

| Capability | Current representation | Writer | Reader | Enforcement | Deployed evidence | Gap/build implication | Evidence |
|---|---|---|---|---|---|---|---|
| Source-document ID | `quote_file_id` | Bootstrap/session paths | Scanner/events | FK in repository intent | None | Present if deployed | A02-009 |
| Storage reference | `quote_files.storage_path` | Bootstrap | Scanner | Non-null, not unique | None | Sensitive path; duplicate race possible | A02-011 |
| Page/evidence references | `page_count` only | AI extraction | Proof of read | None | None | No field-to-page/region lineage | A02-027 |
| Document fingerprint | None in production scanner model | None | None | None | None | Duplicate-document detection unavailable | A02-027 |
| Quote/revision fingerprint | None | None | None | None | None | Revision lineage unavailable | A02-027 |
| Analysis ID | `analyses.id` | Scanner upsert | Reports/facts/events | PK | None | Identifies mutable row, not immutable attempt | A02-010, A02-012 |
| Attempt ID/counter | None | None | None | None | None | Retry history unavailable | A02-026 |
| Model name/version | Runtime env-selected model; optional event column | Scanner config | Logs/event store | Not persisted by observed scan event call | None | Exact model per analysis unavailable | A02-026 |
| Prompt version | Static prompt constant only | Source | Scanner | No version field | None | Prompt evolution not attributable per row | A02-026 |
| Extraction schema version | None | None | None | None | None | Contract evolution not attributable | A02-026 |
| Parser/transformer version | None for parser; dormant normalizer uses `v1` | Source/helper | Normalizer | Not attached to analysis | None | Parser behavior not reproducible per analysis | A02-026 |
| Deterministic analysis version | `rubric_version="1.6.0"` | Scanner | Reports/events | Persisted on analysis | None | Strongest current version provenance | A02-016, A02-026 |
| Report version | Runtime projection constant `v2-source-2026-05` | `report-access` | Browser | Attached dynamically, not stored | None | Historical report reconstruction uncertain | A02-020, A02-026 |
| Human verification | `leads.manually_reviewed`, outcome verification, dormant quote-review table | Admin/outcome paths | Admin/revenue paths | Separate from extraction | None | No field-level correction lineage | A02-026 |
| Correction history | No extraction correction table/history | None | None | None | None | Corrected versus AI-original values cannot be distinguished | A02-026 |
| Supersession history | Lead latest-analysis pointer only | Pointer RPC | Admin/routing | Monotonic completed-analysis rule | None | No quote/revision supersession | A02-013, A02-027 |
| Created/completed/effective dates | Analysis created/updated timestamps | DB/scanner | Multiple | No explicit completed/effective/quote date | None | Recency basis ambiguous | A02-027 |
| Audit-log linkage | Lead events and canonical event log carry IDs | Scanner/event path | Admin/dispatch | Event IDs partly unique | None | Useful operational lineage, but not complete extraction lineage | A02-023 |

# Duplicate, retry, and reprocessing assessment

| Scenario | Trigger | Identity key | DB enforcement | Application enforcement | Resulting records | Current-selection rule | Failure behavior | Assessment | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Repeat bootstrap, same path | Same `storage_path` | Storage path | No unique constraint found | Lookup newest matching row | Usually reuses file/session, but concurrent inserts can duplicate files | Newest matching file | Insert race unresolved | APP_ONLY_IDEMPOTENCY | A02-011 |
| Same quote file | Bootstrap retry | `quote_file_id` | Unique on `scan_sessions.quote_file_id` | Lookup/reuse | One session per file | Existing session | Concurrent unique violation possible | PARTIAL_DB_IDEMPOTENCY | A02-010, A02-011 |
| Same scan invocation | Duplicate request | `scan_session_id` | Unique analysis index | Terminal/in-flight/stale guard | Same analysis row | Exact session | Fresh processing returns 202; stale can take over | GUARDED | A02-010, A02-012 |
| Scanner stale recovery | Processing exceeds configured threshold | `scan_session_id` | Analysis unique index | Recovery decision | Upsert overwrites prior analysis state | Exact session | Leaves processing for future retry after crashes | OVERWRITE_RETRY | A02-012 |
| Multiple documents per lead | New upload path | New file/session IDs | Allowed | Bootstrap creates/reuses by path | Multiple analyses per lead | `latest_analysis_id` selects newest complete by `(created_at,id)` | Older completion cannot replace newer pointer | SUPPORTED_WITHOUT_QUOTE_IDENTITY | A02-011, A02-013 |
| Admin re-scan | `rescan_lead` | Latest session | None preserving attempt history | Set session idle; delete analysis; invoke scanner | Old analysis and cascading facts removed; new row created | New completed analysis | Scanner failure can follow successful deletion | DESTRUCTIVE_REPROCESSING | A02-015 |
| Fact-event repeat | Canonical event repeat | Event ID / analysis ID | Unique event ID; unique fact analysis ID | Duplicate event recovery and fact upsert | Event reused; facts overwritten | One fact row per analysis | Non-fatal scanner event failure | PARTIAL_IDEMPOTENCY | A02-023 |
| Normalization repeat | Hypothetical helper invocation | Analysis ID | Unique observation analysis ID | Header upsert, child delete/insert | One header; full line replacement | Current replacement only | Not atomic; crash can leave stale/partial children | DORMANT_PARTIAL_IDEMPOTENCY | A02-022 |
| Quote/document duplicate | Same content under different path/name | None | None found | No production content hash | Separate file/session/analysis possible | Latest completed analysis only | Duplicate marker not backed by detector | UNRESOLVED | A02-023, A02-027 |
| Test/demo exclusion | Dev scenario or QA lead | `leads.is_test`, source markers | Column default false | Dev writer uses source/client markers but did not show `is_test` assignment | Synthetic rows may remain indistinguishable to profiling | None | Trigger guards depend on `is_test` | UNSAFE_FOR_PROFILE | A02-030 |

# Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Build implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|
| A02-001 | CONFIRMED | Canonical checkout, branch, and commit were established | Git metadata | `7a497...`; root/branch/status commands at 2026-08-30T20:48:59Z | One canonical worktree; expected branch active | Repository evidence attributable | High | None |
| A02-002 | CONFIRMED | Governance was available and applicable | Repository governance | `AGENTS.md`; `.cursor/PROTECTED_FILES.md`; `docs/START_HERE.md` | Migrations/executable source outrank docs; protected data rules apply | Closed-world audit required | High | None |
| A02-003 | CONFIRMED | Audit 01 and Audit 02 describe the same checkout | Audit 01 handoff plus Git | Root, branch, SHA, dirty state | Identity reconciled | Cross-audit handoff accepted | High | None |
| A02-004 | CONFIRMED | Intended schema is governed by handwritten Supabase migrations | Current committed source | `supabase/migrations/*.sql`; 164 SQL files; `.github/workflows/supabase-migration-integrity.yml:90-274` | Ordered migration chain and ephemeral replay workflow exist | Repository schema authority established | High | Supply current CI result separately if needed |
| A02-005 | CONFIRMED | Drizzle and searched ORMs are absent | Exhaustive repository search | Manifests, locks, `src`, `supabase`, `scripts`, `.github` at `7a497...` | No exact ORM package/config/schema/import usage found | ORM does not own schema work | High | Recheck only if repository scope changes |
| A02-006 | CONFIRMED | Generated types and typegen scripts are supporting artifacts | Source/docs | `package.json:30-31`; `docs/db/TYPEGEN_WORKFLOW.md:1-50` | Scripts target a candidate ref; generated file identified | Project target still unbound | High | Operator must bind environment/project |
| A02-007 | CONTRADICTED | Generated types are current with migrations | Migrations vs generated types | `20260806144716...sql:5-220`; `20260820134959...sql:1-5`; no matching symbols in `types.ts` | Three normalization tables and `leads.is_test` are missing from types | Types unsafe as sole schema manifest | High | Regenerate only in a separately authorized implementation task |
| A02-008 | UNKNOWN | Applied and deployed schema match repository intent | Deployment/database evidence | None supplied | No DB authorization, migration ledger, metadata snapshot, or live proof | GATE_DATABASE fails | High | Authorized metadata packet required |
| A02-009 | CONFIRMED | Repository defines lead→file→session→analysis spine | Migrations/types | `20260317051701...sql:2-35`; `20260318033459...sql:29-87` | Canonical identities and FKs exist in intent | Initial entity model established | High | Confirm deployment |
| A02-010 | CONFIRMED | At most one non-null scan session per file and one analysis per scan session are intended | Migrations | `20260318033459...sql:30-38`; `20260318105250...sql:1-2` | Unique file/session and session/analysis relationships | Analysis is mutable current row, not attempt history | High | Confirm deployed constraints |
| A02-011 | INFERRED | Bootstrap idempotency is application-level for storage path | Runtime/migrations | `start-upload-scan-session/index.ts:1129-1338`; no storage-path unique definition found | Lookup-then-insert can race | Duplicate files remain possible | High | Deployed constraints plus aggregate duplicate profiling |
| A02-012 | CONFIRMED | Scanner persistence is sequential, compensated, and non-transactional | Runtime source | `scan-quote/index.ts:638-705,1241-1324,1481-1562`; `sessionRecovery.ts:18-96` | Analysis upsert, pointer, events, and session updates are separate | Partial states and overwrite retries possible | High | Runtime incident/aggregate evidence |
| A02-013 | CONFIRMED | Lead current-analysis selection is monotonic among completed analyses | Migration/runtime | `20260808170000...sql:5-120`; `leadPointerSync.ts:1-231` | Same-lead complete validation and `(created_at,id)` ordering | Current analysis is lead-level, not quote-revision-level | High | Confirm RPC deployed |
| A02-014 | CONFIRMED | Report selection is exact-session and complete-analysis gated in repository intent | Migrations/runtime | `20260420000000...sql:5-34`; `20260428120000...sql:15-92`; `report-access/index.ts:331-367,435-510` | Full path binds verified phone to exact scan session | Report is a projection, not stored entity | High | Audit 03 authorization/RPC review |
| A02-015 | CONFIRMED | Admin re-scan deletes the prior analysis before rescanning | Runtime source | `admin-data/index.ts:807-860` | Session set idle, analysis deleted, function invoked | Attempt and fact history can be lost | High | Founder/security decision on evidence retention |
| A02-016 | CONFIRMED | `scoring.ts::ExtractionResult` is canonical compile-time scanner contract | Runtime source | `scan-quote/scoring.ts:11-163`; imports in scoring/report/flagging | Directly consumed by production scanner modules | Declared fields can be enumerated | High | Runtime enforcement still unresolved |
| A02-017 | CONTRADICTED | Prompt schema and TypeScript nullability are equivalent | Runtime source | `scan-quote/index.ts:368-526` vs `scoring.ts:11-159` | Prompt mandates null; many TS properties are optional non-null; some TS fields absent from prompt | Missing/null semantics unreliable | High | Versioned runtime validator/schema evidence |
| A02-018 | CONFIRMED | Runtime validation is shallow and permits extra fields | Runtime source | `scan-quote/index.ts:201-235,1087-1167` | Only key root fields and descriptions validated; result is cast | Exclusive runtime field enumeration impossible | High | Runtime schema validation design decision |
| A02-019 | INFERRED | `calculate-estimate-metrics` is a separate incompatible contract with unresolved production use | Runtime/config/CI | Function `index.ts:37-69`; `supabase/config.toml:66`; no caller found | Smaller nullable interface and duplicated logic exist | Multiple contracts must not be conflated | Medium-high | Deployment/caller evidence |
| A02-020 | CONFIRMED | Full report persistence retains extraction and derived output while some projections collapse states | Runtime source | `scan-quote/index.ts:1226-1311`; `report-access/index.ts:331-367` | `||` collapses zero/empty values in proof/report fields; raw extraction remains in full JSON | Unknown/null/zero semantics differ by representation | High | Semantic binding manifest |
| A02-021 | CONFIRMED | Active financial calculations use dollar-scale JavaScript numbers without currency | Runtime source | `_shared/metrics.ts:29-76,139-227,392-477` | Keyword buckets and `round2`; no currency/price-basis field | Monetary profile unsafe | High | Currency, unit, and basis confirmation |
| A02-022 | CONFIRMED | Normalization schema/helper exists but is not wired into production | Migration/runtime search | `20260806144716...sql:1-228`; `_shared/normalizeAnalysis.ts:1-14,573-740`; no external production reference | Converts dollars to cents and replaces child lines non-atomically | Cannot treat normalized tables as active authority | High | Deployed object and invocation evidence |
| A02-023 | CONFIRMED | `wm_quote_facts` is actively written as canonical-event projection | Migration/runtime | `20260414110000...sql:141-202`; `createCanonicalEvent.ts:487-618`; scanner event `index.ts:1396-1473` | Upsert on analysis ID; several trust fields are defaults/proxies | Fact semantics require review before profiling | High | Aggregate inspection and owner decision |
| A02-024 | CONFIRMED | Legacy/migration-only/absent fact candidates are distinguishable | Runtime/migration search | `quote_analyses` base migration; `wm_quote_reviews`/snapshots migration; exhaustive `quote_intelligence_facts` search | No production readers/writers for legacy/migration-only objects; exact intelligence table absent | Similar names cannot substitute | High | Confirm deployed remnants |
| A02-025 | CONTRADICTED | `county_benchmarks` has complete repository schema authority | Runtime/migration/type search | `refresh-benchmarks/index.ts:1-15,209-243`; no CREATE TABLE or generated type | Writer expects table; active metrics use static constants | Benchmark authority unresolved | High | Exact deployed DDL and scheduler evidence |
| A02-026 | CONFIRMED | Extraction model/prompt/schema/parser versions are not persisted per analysis | Runtime/schema | `scannerConfig.ts:18-40,75-104`; event types/creation; scanner event call | Rubric persists; model can be env-overridden; prompt/parser unversioned | Reproducibility blocker | High | Version lineage evidence/decision |
| A02-027 | CONFIRMED | Document evidence, quote revisions, corrections, and effective dates lack complete lineage | Contract/schema search | Extraction contract; core tables; no matching production lineage fields | No page refs, fingerprints, revision chain, or correction history | Provenance blocker | High | Source/revision/correction authority |
| A02-028 | CONFIRMED | Quote, revision, report, manufacturer, product, opening, change-order, and invoice entities are absent as dedicated tables | Migration/object search | All 59 table definitions at `7a497...` | Alternatives are raw fields, arrays, or references | Entity cardinality unresolved | High | Founder/domain decisions plus deployed proof |
| A02-029 | CONFIRMED | Downstream outcomes exist but do not supply complete quote revision/invoice truth | Generated types/migrations | `types.ts:1362-1477` | Outcome values/currency/verification and contract URL exist | Useful downstream domain remains separate | High | Deployed/state-quality evidence |
| A02-030 | CONTRADICTED | Synthetic/test rows are reliably identifiable through `is_test` | Migration/types/runtime | `20260820134959...sql:1-35`; `dev-create-quote-scenario/index.ts:14,136`; missing generated type | Migration flag exists, but dev writer evidence uses source markers and types omit flag | Test/demo exclusion unsafe | High | Deployed column plus population audit |
| A02-031 | CONFIRMED | Reprocessing does not preserve immutable analysis attempts | Runtime/migrations | Analysis upsert and admin rescan paths | Same-session retry overwrites; admin rescan deletes | Duplicate/revision analytics unsafe | High | Attempt/revision policy decision |
| A02-032 | UNKNOWN | Audit 04 has safe deployed bindings | All evidence domains | No authorized deployed metadata | Every candidate remains repository-intent-only | SQL generation must stop | High | Complete authorized schema binding packet |
| A02-033 | UNKNOWN | Relevant tests currently pass at this commit | Tests/workflows | `supabase/tests/quote_normalization_layer.test.sql`; `normalizeAnalysis.test.ts`; scanner tests; CI workflow | Tests inventoried but not executed; no admissible same-commit CI result supplied | Regression status unknown | High | Current same-SHA CI evidence or separately authorized execution |

# Contradictions

| ID | Contradiction | Consequence | Evidence |
|---|---|---|---|
| C-01 | Generated types omit later migration-defined tables and `leads.is_test` | Generated types cannot bind Audit 04 | A02-007 |
| C-02 | Prompt requires nulls while TypeScript disallows null on many optional properties | Null, missing, and invalid values are not consistently represented | A02-017 |
| C-03 | Runtime validator claims “full extraction validation” but validates only a small subset | Arbitrary undeclared fields and wrong declared-field types can persist | A02-018 |
| C-04 | TypeScript includes `price_fairness`, `markup_estimate`, `negotiation_leverage`, and derived jurisdiction mismatch, but the current prompt output schema does not declare all of them | Producer/consumer contract is incomplete | A02-016, A02-017 |
| C-05 | `county_benchmarks` writer code exists without repository table DDL or generated type | Benchmark schema ownership and deployment are unresolved | A02-025 |
| C-06 | Session recovery’s source type includes `complete`/`error` but omits migration-valid `awaiting_verification`/`revealed` | Repository status contracts are not identical, although no active writer for omitted states was found | A02-009, A02-012 |
| C-07 | Expected `quote_intelligence_facts` has no exact repository match | Similar fact tables cannot substitute for it | A02-024 |
| C-08 | Drizzle status was expected to be unknown; verified scope establishes it is absent | ORM adoption/ownership must not be assumed | A02-005 |

# Unknowns

| Unknown ID | Question | Why unresolved | Checks performed | Build impact | Owner | Required evidence |
|---|---|---|---|---|---|---|
| U-01 | Which database environment is targeted? | No operator binding | Repository targeting/config inspected | GATE_DATABASE blocked | Operator | Environment name and non-secret project identifier |
| U-02 | Which migrations are applied? | No ledger or DB access | Migration/release tooling inspected | Object/constraint deployment unknown | Database operator | Read-only migration-history evidence |
| U-03 | What PostgreSQL/Supabase versions are deployed? | No metadata access | Config and CI inspected | SQL feature/behavior binding unknown | Database operator | Authorized metadata query result |
| U-04 | What are table sizes, row counts, date ranges, and index states? | Profiling not authorized | No data queries executed | Scan safety and cohort feasibility unknown | Data owner | Reviewed aggregate metadata queries |
| U-05 | Is the project-ref candidate in `package.json` the target? | Script is not authorization or environment identity | Package/config/docs inspected | Environment confusion risk | Operator | Explicit project/environment binding |
| U-06 | Are normalization migrations deployed and is `normalizeAnalysis` invoked externally? | No caller or deployment proof | Full repository symbol search | Fact ownership unresolved | Data platform owner | Deployed objects, job/function caller, run ledger |
| U-07 | Which undeclared extraction keys exist in actual records? | Raw customer JSON inspection prohibited | Runtime validator and parser inspected | Complete runtime schema impossible | Extraction owner | Versioned schema—not raw-row inspection |
| U-08 | What currency, price basis, and quantity semantics apply? | Contract omits them | Scanner/metrics/normalizer inspected | Monetary cohorts blocked | Product/data owner | Approved semantic definitions |
| U-09 | What duplicate/revision rate exists? | No fingerprint or aggregate execution | Identity and reprocessing paths inspected | Selection bias and double counting unknown | Data owner | Authorized aggregate profiling |
| U-10 | How are human corrections represented? | No field-level correction lineage found | Schema/runtime search | Ground-truth status unknown | Operations/data owner | Correction workflow and audit-log evidence |
| U-11 | Do current tests pass at this SHA? | Execution prohibited | Tests and CI definitions inventoried | Regression confidence incomplete | Engineering/CI | Same-commit CI result |

# Hard stops

| Hard-stop ID | Affected scope | Reason | Safely gathered evidence | Required operator action |
|---|---|---|---|---|
| A02-HS-001 | Deployed database inspection, applied migration history, table sizes, grants, policies, and data profiling | Target environment and project identity are unknown; production/database read authorization is absent | Repository migrations, generated types, runtime readers/writers, tests, and deployment tooling | Supply exact environment, non-secret project identifier, read-only authorization and access method, reviewed query IDs, aggregate/metadata-only scope, and approved timeouts |

No repository hard stop occurred. Governance, branch, commit, and Audit 01 identity were established, and the untracked Audit 01 artifact did not overlap committed application/schema evidence.

# Build blockers

| Blocker ID | Severity | Classification | Finding | Evidence | Behavior at risk | Resolution evidence | Owner |
|---|---|---|---|---|---|---|---|
| B-01 | CRITICAL | UNKNOWN | Deployed schema and applied migrations are unknown | A02-008, A02-032 | Any database plan/profile | Authorized deployed metadata | Operator/database owner |
| B-02 | HIGH | CONTRADICTED | Extraction prompt, TS contract, and runtime validation are incompatible | A02-016–A02-018 | Complete field inventory and safe parsing | Versioned runtime schema/validator authority | Extraction owner |
| B-03 | HIGH | UNKNOWN | Currency, price basis, and quantity semantics are unresolved | A02-021 | Financial comparisons/cohorts | Approved semantic definitions | Product/data owner |
| B-04 | HIGH | CONFIRMED | No explicit quote/revision/immutable attempt model | A02-010, A02-015, A02-028, A02-031 | Deduplication, recency, supersession | Founder/domain decisions and lifecycle evidence | Founder/product owner |
| B-05 | HIGH | UNKNOWN | Existing fact-table ownership/deployment is unresolved | A02-022–A02-025 | Additive intelligence source selection | Deployed objects, active jobs, explicit owner register | Data platform owner |
| B-06 | HIGH | CONFIRMED | Model/prompt/schema/parser provenance is missing | A02-026 | Reproducibility and backfill comparability | Persisted version lineage | Extraction owner |
| B-07 | HIGH | CONFIRMED | Admin re-scan deletes prior analysis/facts | A02-015, A02-031 | Historical evidence and revision analysis | Approved retention/supersession policy | Founder/security/data owner |
| B-08 | HIGH | CONTRADICTED | Test/demo exclusion is not reliably populated or typed | A02-030 | Cohort contamination | Deployed flag and population guarantees | Data/QA owner |
| B-09 | MEDIUM | CONTRADICTED | Generated types lag migrations | A02-007 | Static contract confidence | Authorized fresh generation and drift proof | Engineering |
| B-10 | HIGH | CONFIRMED | Free-form descriptions, addresses, contractor names, and raw JSON require isolation | A02-016, A02-020, A02-022, A02-033 | PII/source-text exposure | Audit 03 security/data-rights approval | Security/privacy owner |
| B-11 | HIGH | CONFIRMED | Dormant normalizer is non-atomic | A02-022 | Partial observation/line state | Transaction/recovery authority decision | Data platform owner |
| B-12 | CRITICAL | UNKNOWN | Audit 04 has no confirmed deployed bindings | A02-032 | Safe profiling SQL | Complete Audit 03→04 binding packet | Operator/audit owner |

# Audit 03 handoff

## Object and programmable-object inventory

Audit 03 should verify, without treating repository intent as deployment:

- Protected data tables: `analyses`, `quote_files`, `scan_sessions`, `phone_verifications`.
- Fact-like tables: `wm_quote_facts`, `quote_observations`, `quote_line_items`, `normalization_failures`, `wm_quote_reviews`, `wm_pricing_index_snapshots`.
- Event/log tables: `wm_event_log`, `lead_events`, `event_logs`.
- Outcome/contractor tables, particularly `contractor_outcomes`.
- Functions/RPCs:
  - `get_analysis_preview(uuid)`
  - `get_analysis_full(uuid,text)`
  - `get_scan_status(uuid)`
  - `set_latest_complete_analysis_pointer(uuid,uuid)`
  - `is_internal_operator()`
  - `update_updated_at()`
  - lead-side trigger functions and any deployed benchmark job
- Triggers:
  - Analysis/observation/fact updated-at triggers
  - Lead handoff and summary triggers
- Storage:
  - Private `quotes` bucket intent
  - `quote_files.storage_path`
  - Signed-URL generation path in `start-upload-scan-session`

## PII and sensitive-data classes

| Class | Fields/paths |
|---|---|
| Direct homeowner PII | Lead name, email, phone, address/geography fields |
| Protected source data | `analyses.full_json`, line descriptions, policy/scope text, warranty/payment text |
| Sensitive location/entity data | Contractor address/name, opening location/tag, Storage paths |
| Sensitive operational data | Phone verification rows, raw event payloads, error/excerpt fields |
| Financial data | Quote prices, deposits, line prices, outcome values |
| Safer aggregate candidates | Counts, bounded booleans/enums, de-identified cent values only after semantic confirmation |

## Client-facing and server boundaries

- Preview and full report access are mediated by repository RPC intent and `report-access`.
- `get_analysis_preview` returns only curated preview fields for complete analyses.
- `get_analysis_full` returns `full_json` only after exact phone/lead/scan binding in the latest repository definition.
- `wm_quote_facts` and normalization tables are intended service-role/internal-operator surfaces; deployed grants and RLS must be checked.
- The browser-facing canonical-event duplicate module and any direct Supabase imports require Audit 03 reachability review.
- Scanner logging includes a structured derived-metrics trace containing lead ID, county, and derived financial metrics; logging retention/redaction requires security review.
- `normalization_failures.raw_excerpt` is intended to be redacted and length-limited, but its actual redaction sufficiency and deployed access require review.

# Audit 04 binding table

> **REPOSITORY EVIDENCE ALONE DOES NOT AUTHORIZE DATA PROFILING.**

| Audit 04 input | Bound value | Environment | Evidence | Status | Safe for SQL | Gap |
|---|---|---|---|---|---|---|
| Target environment | None | UNKNOWN | A02-008 | UNKNOWN | NO | Operator binding absent |
| Read authorization | None | UNKNOWN | A02-HS-001 | UNKNOWN | NO | Explicit authorization absent |
| Project identifier | None | UNKNOWN | A02-006, A02-008 | UNKNOWN | NO | Script candidate is not authorization |
| Schemas | Candidate `public`, `storage`, `auth` references | UNKNOWN | A02-004, A02-009 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Deployed schemas unverified |
| Core objects | `leads`, `quote_files`, `scan_sessions`, `analyses` | UNKNOWN | A02-009 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Deployment unverified |
| Fact objects | `wm_quote_facts`, normalization tables, review/snapshot tables | UNKNOWN | A02-022–A02-024 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Deployment/ownership unverified |
| `county_benchmarks` | Writer expects object; no DDL | UNKNOWN | A02-025 | CONTRADICTED | NO | Exact schema and deployment absent |
| Columns and types | Repository inventory above | UNKNOWN | A02-009, A02-022, A02-023 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Live columns/types unverified |
| JSON column | `analyses.full_json jsonb` | UNKNOWN | A02-009 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Population and deployed column unverified |
| JSON extraction root | `full_json.extraction` | UNKNOWN | A02-020 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Runtime admits undeclared keys |
| JSON derived root | `full_json.derived_metrics` | UNKNOWN | A02-020, A02-021 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Version/unit semantics unresolved |
| Monetary unit | Scanner dollar-scale number; dormant normalizer integer cents | UNKNOWN | A02-021, A02-022 | INFERRED | NO | Currency and active normalization unresolved |
| Price basis | Contract/core/installed proxies | UNKNOWN | A02-021 | UNKNOWN | NO | Installed versus product basis unresolved |
| Opening representation | Optional `opening_count`, inferred core quantity, line array | UNKNOWN | A02-016, A02-021 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Denominator and durable identity unresolved |
| Project identifier | `leads.id` is current proxy | UNKNOWN | A02-028 | INFERRED | NO | Lead/project conflation unresolved |
| Document identifier | `quote_files.id` | UNKNOWN | A02-009 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Deployment unverified |
| Quote identifier | None | UNKNOWN | A02-028 | UNKNOWN | NO | No explicit entity |
| Revision identifier | None | UNKNOWN | A02-028 | UNKNOWN | NO | No lineage |
| Analysis identifier | `analyses.id` | UNKNOWN | A02-009 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Mutable row, not immutable attempt |
| Current/supersession rule | Lead pointer newest completed `(created_at,id)` | UNKNOWN | A02-013 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Quote-level applicability unresolved |
| Duplicate indicator | `wm_quote_facts.duplicate_suspected`, but scanner supplies no detector | UNKNOWN | A02-023 | INFERRED | NO | Semantics unreliable |
| Test/demo indicator | `leads.is_test` migration plus source/client markers | UNKNOWN | A02-030 | CONTRADICTED | NO | Population/type drift |
| PII exclusions | Exclude lead contact data, addresses/names, source text, raw JSON, Storage paths | UNKNOWN | A02-033 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Audit 03 approval required |
| Date fields | Analysis persistence timestamps only; no quote date | UNKNOWN | A02-022, A02-027 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Recency semantics unresolved |
| Role visibility | Repository RLS/grant intent only | UNKNOWN | A02-022, A02-023 | CONFIRMED_REPOSITORY_INTENT_ONLY | NO | Deployed grants/RLS unverified |
| Size estimates | None | UNKNOWN | A02-008 | UNKNOWN | NO | Metadata query not authorized |
| Applied migration history | None | UNKNOWN | A02-008 | UNKNOWN | NO | Migration ledger absent |
| PostgreSQL version | None | UNKNOWN | A02-008 | UNKNOWN | NO | Metadata absent |
| Approved scan limits/timeouts | None | UNKNOWN | A02-HS-001 | UNKNOWN | NO | Human SQL review has not occurred |

No SQL was generated or executed. No repository, database, Storage, service, deployment, or Git state was modified.

# NEEDS_SCHEMA_BINDING
