# Schema Binding Manual Execution Results

## Execution identity

| Field | Value |
|---|---|
| Audit name | Schema Binding Manual Execution Results (`03C`) |
| UTC report generation time | `2026-08-30T23:20:07.7190808Z` |
| Execution environment | `CODEX`, local Windows PowerShell; database execution was performed manually by the operator |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active Git branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status | No tracked or staged changes; Audits 01, 02, 03, 03A, and 03B were pre-existing untracked artifacts before this report |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity actually verified | `NO`; local tracking state was `+0/-0`, but no live remote request was made |
| Supabase organization/project | `WMProd` — operator-confirmed |
| Database environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD` — operator-confirmed |
| Target Supabase branch | `forensic_report_v1` — operator-confirmed |
| Database project identifier | Branch instance ref `zgsofkgddpcntdvpckdq` — operator-confirmed |
| Dormant parent/main ref | `wkrcyxcnzhwjtdpmfpaf` — operator-confirmed out of scope and not queried |
| PostgreSQL version | `17.6` / `170006` — operator-supplied result of `SB-MD-001` |
| SQL execution role | `postgres` for current and session role — operator-supplied result of `SB-MD-001` |
| Production read authorization | Operator-authorized manual, bounded, read-only metadata execution only |
| Agent/connector database execution | `NOT_AUTHORIZED / NOT_PERFORMED` |
| Applicable governance | Root `AGENTS.md`; Audit Protocol 00; Audits 01–03B |
| Source artifact | `C:\Users\Dell\Desktop\wm-mvp\03B_MANUAL_SQL_EXECUTION_RESULTS.md` |
| Source artifact SHA-256 | `00F0E94C6701E74A65BF163CAFA65AA52CDF637E9ABCE702B0F619F6095CE0C5` |
| Supplemental source artifact | `C:\Users\Dell\Desktop\wm-mvp\03B_MANUAL_SQL_EXECUTION_RESULTS (sb md  022  23.md` |
| Supplemental artifact SHA-256 | `6597ED38F8EA3B19BFC5F9E29E0F5B068DC4F7D04877B322317A4848E6B3C0FF` |
| Supplemental validation time | `2026-08-30T23:39:12.1686334Z` |
| Audit status | `COMPLETE_WITH_BLOCKERS` |
| Auditor limitations | Operator-supplied evidence only. No SQL, database connector, network request, Storage request, function invocation, profiling, build, test, migration, or deployment was performed by the auditor. Query execution timestamps and durations were not supplied for `SB-MD-001`–`023`. |

## Operator execution attestation

The operator attested that all 21 reviewed queries were executed manually in the Supabase Dashboard SQL Editor on branch instance `zgsofkgddpcntdvpckdq`, that the dormant parent/main database was not queried, that no SQL was modified, that every query succeeded, and that every transaction ended with `ROLLBACK`.

The operator subsequently attested the same target, exact-SQL, success, and rollback conditions for `SB-MD-022` and `SB-MD-023`.

This report treats the target identity and execution controls as operator-supplied evidence. PostgreSQL query output cannot independently prove the Supabase branch ref.

## Methodology and evidence handling

1. Read the complete 2,276-line operator artifact.
2. Delimited all 21 query/result sections.
3. Compared each visible result header with the expected aliases in Audit 03B.
4. Counted returned metadata rows and recorded successful-empty output separately.
5. Compared the 162 visible applied migration records with timestamped SQL migration filenames at repository SHA `7a497a5f1cba752d26ce1721f39d0a8288306a51`.
6. Kept operator-confirmed deployed metadata, repository intent, generated-type findings, and unverified semantics in separate evidence domains.
7. Did not inspect application rows, JSON values, source text, Storage objects, logs, customer records, or secrets.
8. Read the complete 269-line supplemental artifact, validated both expected result shapes, and classified all 136 returned `SB-MD-023` metadata rows by record type and object.

The attachment reproduces 21 `ROLLBACK` statements but only 20 `BEGIN TRANSACTION READ ONLY` and timeout preambles. `SB-MD-001` and `SB-MD-002` are also not labeled with their stable IDs in the attachment; they are identified by order and exact result shape. The missing reproduced preamble is confined to `SB-MD-002`. The operator's execution attestation is recorded, but byte-for-byte verification of that query's complete executed text is not possible from the attachment alone.

## Executive findings

- The target reports PostgreSQL `17.6` and SQL Editor role `postgres`.
- All expected schemas were visible: `auth`, `cron`, `extensions`, `public`, `storage`, and `supabase_migrations`.
- Nineteen of the 21 exact relation candidates exist. `public.county_benchmarks` and `public.quote_intelligence_facts` are confirmed absent in the operator-supplied deployed metadata.
- The normalization/fact objects `wm_quote_facts`, `quote_observations`, `quote_line_items`, `normalization_failures`, `wm_quote_reviews`, and `wm_pricing_index_snapshots` exist. Metadata does not establish their active production writer or semantic authority.
- All 15 present allowlisted public tables report RLS enabled and forced RLS disabled. The 18 visible public views all report `security_invoker=true`.
- `analyses.full_json` is deployed as nullable `jsonb`; metadata does not establish any JSON path, expected nested type, or extraction-contract version.
- `quote_observations` and `quote_line_items` expose structured cent-valued and dimensional columns, but names and PostgreSQL types do not prove currency, total-price basis, quantity, or opening semantics.
- The private `quotes` bucket exists with a 10 MiB limit and the five returned MIME types. No Storage objects or paths were read.
- The applied migration ledger contains 162 visible entries. The repository contains two later timestamped migrations not present in the ledger.
- `SB-MD-022` confirms role `postgres` is not a superuser, inherits roles, and has `BYPASSRLS`. The successful-empty `SB-MD-021` result therefore confirms no rows in `cron.job` at execution time, not merely an RLS-filtered empty result.
- `SB-MD-023` returned 136 deployed metadata rows with the expected five columns: 33 CHECK constraints, 72 column defaults, and 31 enum labels.
- Deployed state domains are now bound for analysis/session statuses, selected review/fact constraints, and three `wm_*` enums. Defaults confirm `quote_observations.is_stats_eligible=false`, `wm_quote_facts.approved_for_index=false`, and `leads.is_test=false`; defaults do not define the approved profiling eligibility rule.
- Schema presence is now substantially bound, but the semantic bindings required by Audit 04 remain incomplete. `NEEDS_SCHEMA_BINDING` is not resolved and `GATE_DATABASE` is not satisfied.

## Query execution ledger

All execution times and durations are `UNKNOWN_NOT_SUPPLIED`. `SUCCEEDED` means operator-reported successful manual execution.

| Query ID | Expected-column validation | Result | Classification | Visibility or scope limitation |
|---|---|---|---|---|
| `SB-MD-001` | `VALID` — 5/5 expected columns | 1 row: database `postgres`; current/session role `postgres`; PostgreSQL `17.6` (`170006`) | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Does not prove Supabase branch ref; role attributes are separately bound by `SB-MD-022` |
| `SB-MD-002` | `VALID` — 2/2 | 6 schemas with owners | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Exact SQL preamble is missing from the attachment reproduction |
| `SB-MD-003` | `VALID` — 7/7 | 21 candidates: 19 present, 2 absent | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Exact allowlist only; no unrelated objects |
| `SB-MD-004` | `VALID` — 5/5 | 18 public views; all `VIEW`, owner `postgres`, `security_invoker=true` | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | View definitions and underlying-object access were intentionally excluded |
| `SB-MD-005` | `VALID` — 15/15 | 344 column rows across 15 present public tables | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | `information_schema` is privilege-filtered; current role owns the public objects and `SB-MD-022` confirms RLS bypass |
| `SB-MD-006` | `VALID` — 13/13 | 50 PK, unique, and FK rows | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | CHECK constraints and exclusion constraints were outside this query |
| `SB-MD-007` | `VALID` — 10/10 | 84 indexes; every returned index valid and ready | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Expressions and predicates were reduced to presence booleans |
| `SB-MD-008` | `VALID` — 9/9 | 15 relation estimates/sizes | `CONFIRMED_DEPLOYED_METADATA_ESTIMATE` | `reltuples=-1` is unknown statistics, not zero rows; no application count was executed |
| `SB-MD-009` | `VALID` — 8/8 | 23 sanitized policies | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Policy expressions and ownership predicates intentionally excluded |
| `SB-MD-010` | `VALID` — 6/6 | 389 explicit relation-grant rows | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Does not establish effective privileges through role membership, schema ACLs, default ACLs, sequence grants, or RLS; omitted grantor causes duplicate-looking Storage rows |
| `SB-MD-011` | `VALID` — 11/11 | 8 exact routines | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Function bodies and authorization predicates intentionally excluded |
| `SB-MD-012` | `VALID` — 6/6 | 21 routine ACL rows | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Role inheritance and schema `USAGE` were not included |
| `SB-MD-013` | `VALID` — 14/14 | 15 enabled trigger rows | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Trigger definitions/bodies intentionally excluded; exact allowlisted tables only |
| `SB-MD-014` | `VALID` — 6/6 | 6 migration-history columns | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Metadata only |
| `SB-MD-015` | `VALID` — 3/3 | 162/162 visible migration rows; newest `20260820172613_update_wmchat_meta_dispatch_cadence` | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Applied ledger does not rule out ad hoc schema changes |
| `SB-MD-016` | `VALID` — 6/6 | 12 `storage.buckets` columns | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Bucket table metadata only |
| `SB-MD-017` | `VALID` — 7/7 | 1 `quotes` bucket row; private; 10 MiB limit | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Exact bucket only; no objects, paths, ownership IDs, or retention behavior |
| `SB-MD-018` | `VALID` — 8/8 | 4 sanitized `storage.objects` policies | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Policy predicates omitted; no object access occurred |
| `SB-MD-019` | `VALID` — 4/4 | `pg_cron` `1.6.4`; `cron.job` exists | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Extension/relation existence only |
| `SB-MD-020` | `VALID` — 6/6 | 9 `cron.job` columns | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | No commands, schedules, credentials, or run history returned |
| `SB-MD-021` | `EMPTY_NO_HEADER_OBSERVABLE` | `SUCCESSFUL_EMPTY`; zero rows | `CONFIRMED_DEPLOYED_EMPTY` | Expected aliases cannot be observed in an empty rendered result; `SB-MD-022` confirms the execution role bypasses RLS |
| `SB-MD-022` | `VALID` — 4/4 | 1 row: role `postgres`; `is_superuser=false`; `inherits_roles=true`; `bypasses_rls=true` | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Role attributes only; does not establish a future execution role unless the same SQL Editor role is used |
| `SB-MD-023` | `VALID` — 5/5 | 136 rows: 33 CHECK constraints, 72 column defaults, 31 enum labels | `CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE` | Defines database-enforced/default states, not business meaning, extraction authority, or analytics eligibility |

## Deployed object comparison

| Object | Deployed result | RLS | Key deployed binding | Repository-intent relationship |
|---|---|---:|---|---|
| `public.leads` | `TABLE` | Enabled; not forced | 87 columns; `id` PK; `session_id` conditionally unique; `latest_analysis_id`; non-null `is_test` | Deployed metadata confirms columns that Audit 02 said generated types did not fully represent |
| `public.quote_files` | `TABLE` | Enabled; not forced | `id` PK; nullable `lead_id` FK; non-null `storage_path` | Matches repository object intent; path remains prohibited from profiling output |
| `public.scan_sessions` | `TABLE` | Enabled; not forced | `id` PK; one row per `quote_file_id` unique; lead/file FKs; non-null text `status` | Deployment confirmed; status semantics remain unbound |
| `public.analyses` | `TABLE` | Enabled; not forced | `id` PK; unique `scan_session_id`; nullable `full_json jsonb`; non-null text `analysis_status` | Deployment confirmed; authoritative JSON/runtime contract remains unresolved |
| `public.phone_verifications` | `TABLE` | Enabled; not forced | 20 columns; lead FK; scan-session and status indexes | Deployment confirmed; application rows remain excluded |
| `public.wm_quote_facts` | `TABLE` | Enabled; not forced | Unique `analysis_id`; FKs to analysis/lead/session/file; numeric `quote_amount` and `price_per_opening`; `normalized_facts jsonb` | Exact candidate exists; unit/ownership/eligibility semantics are not confirmed by metadata |
| `public.quote_observations` | `TABLE` | Enabled; not forced | One row per `analysis_id`; `contract_total_cents bigint`; counts; dimensions; eligibility/confidence/version fields | Normalization schema is deployed; active writer and semantic authority remain unknown |
| `public.quote_line_items` | `TABLE` | Enabled; not forced | Unique `(observation_id,line_index)`; quantity/dimension fields; integer-cent prices; product/glass fields | Normalization schema is deployed; line/opening identity and price basis remain unknown |
| `public.normalization_failures` | `TABLE` | Enabled; not forced | Analysis key, stage/reason/version; includes prohibited `raw_excerpt` | Deployed; sensitive field remains excluded |
| `public.wm_quote_reviews` | `TABLE` | Enabled; not forced | Review/fact/analysis/lead keys and status fields | Deployed; human-correction lineage semantics remain incomplete |
| `public.wm_pricing_index_snapshots` | `TABLE` | Enabled; not forced | Unique `(snapshot_version,cohort_key)`; JSON stats/bands; effective timestamps | Deployed; no visible scheduled jobs and no population semantics confirmed |
| `public.contractor_outcomes` | `TABLE` | Enabled; not forced | Outcome, contractor, assignment, value, verification, and integrity fields | Deployed; outcome/business semantics are outside schema metadata |
| `public.county_benchmarks` | `ABSENT` | N/A | No deployed relation | Confirms repository finding that runtime expected a table for which no DDL was found |
| `public.quote_intelligence_facts` | `ABSENT` | N/A | No deployed relation | Confirms exact expected candidate is absent; similar objects are not substitutes |

## Deployed identity, cardinality, and index evidence

- One deployed `analyses` row is enforced per `scan_sessions.id` by a unique `analyses.scan_session_id` index.
- One deployed `scan_sessions` row is enforced per `quote_files.id` by `scan_sessions_quote_file_id_key`.
- One deployed `quote_observations` row is enforced per `analyses.id`.
- One deployed `wm_quote_facts` row is enforced per `analyses.id`.
- Line identity is unique only within an observation as `(observation_id,line_index)`; metadata does not establish durable opening identity across reprocessing or revisions.
- All 84 returned indexes were valid and ready. Index expression and predicate text was not returned, so expression/partial-index semantics remain repository intent unless separately bound.
- The deployed constraints establish document/session/analysis/fact linkage, but no project, quote, quote-revision, supersession, fingerprint, or immutable-attempt entity was found in the allowlisted schema.

## Relation size and statistics evidence

`SB-MD-008` returned catalog estimates, not exact counts.

| Relation | Estimated rows | Total bytes | Interpretation |
|---|---:|---:|---|
| `wm_event_log` | 1,958 | 6,168,576 | Largest allowlisted relation by catalog size |
| `analyses` | 18 | 4,333,568 | Estimate only; large TOAST contribution is possible |
| `event_logs` | 6,011 | 2,686,976 | Estimate only |
| `leads` | 63 | 688,128 | Estimate only |
| `wm_quote_facts` | 17 | 655,360 | Suggests possible population, but not an exact count |
| `lead_events` | 98 | 540,672 | Estimate only |
| `scan_sessions` | 28 | 491,520 | Estimate only |
| `phone_verifications` | 95 | 294,912 | Estimate only |
| `quote_files` | 19 | 237,568 | Estimate only |
| `contractor_outcomes`, `quote_line_items`, `quote_observations`, `normalization_failures`, `wm_pricing_index_snapshots`, `wm_quote_reviews` | `-1` | 32,768–147,456 each | Statistics unavailable/uninitialized; `-1` must not be interpreted as zero rows |

These sizes are sufficient to inform a later preflight review, but they do not authorize application-data scans.

## Deployed RLS, grants, routines, and Storage evidence

### Tables and views

- All 15 present allowlisted public tables report RLS enabled; none reports forced RLS.
- All 18 visible public views report `security_invoker=true`.
- Sanitized policy metadata confirms 23 policies, but exact `USING` and `WITH CHECK` expressions were deliberately excluded. Ownership enforcement therefore remains unverified.
- Relation grants are broad on several public tables for `anon` and `authenticated`. Grants alone do not establish row access because RLS and Data API exposure are separate controls.

### Selected functions and RPCs

| Routine | Mode | Deployed execute ACL result |
|---|---|---|
| `get_analysis_full(uuid,text)` | `SECURITY_DEFINER`, stable, `search_path=public` | `postgres`, `service_role` only |
| `get_analysis_preview(uuid)` | `SECURITY_DEFINER`, stable, `search_path=public` | `postgres`, `service_role` only |
| `get_lead_by_session(text)` | `SECURITY_DEFINER`, stable, `search_path=public` | `postgres`, `service_role` only |
| `get_scan_status(uuid)` | `SECURITY_DEFINER`, stable, `search_path=public` | `anon`, `authenticated`, `postgres`, `service_role` |
| `is_internal_operator()` | `SECURITY_DEFINER`, stable, `search_path=public` | `postgres`, `service_role` only |
| `persist_lead_consent_batch(...)` | `SECURITY_DEFINER`, volatile, empty search path | `postgres`, `service_role` only |
| `set_latest_complete_analysis_pointer(uuid,uuid)` | `SECURITY_INVOKER`, volatile, empty search path | `postgres`, `service_role` only |
| `update_updated_at()` | `SECURITY_INVOKER`, volatile, empty search path | `PUBLIC`, `anon`, `authenticated`, `postgres`, `service_role` |

The deployed ACL evidence does not show browser-role execution for `get_analysis_full`, resolving the prior repository-only direct-full-RPC concern in favor of the deployed metadata for this exact environment. Function-body authorization logic remains unverified because bodies were intentionally excluded.

### Storage

- Bucket `quotes` exists and is private (`public=false`).
- `file_size_limit=10485760` bytes.
- Allowed MIME types returned: PDF, JPEG, PNG, WebP, and HEIC.
- Four sanitized `storage.objects` policies were visible: anonymous/authenticated INSERT and UPDATE paths. No SELECT or DELETE policy appeared in the sanitized result.
- Policy expressions, object rows, object names, paths, signed URLs, and retention/deletion behavior were not inspected.

## Applied migration comparison

`SB-MD-015` returned all 162 visible migration rows because every row reported `total_visible_migrations=162`, below the 500-row cap.

| Domain | Result |
|---|---|
| Newest visible deployed migration | `20260820172613_update_wmchat_meta_dispatch_cadence` |
| Oldest visible deployed migration | `20260317051701_bdf3572f-5d3e-4662-b4db-31d55ae58ece` |
| Timestamped repository SQL migrations | 164 |
| Deployed ledger entries matching repository timestamp/name | 162 |
| Deployed entries absent from repository | None found |
| Repository migrations absent from deployed ledger | `20260828221015_intake_core_rls_remediation`; `20260829000939_repair_enqueue_lead_summary_http_post` |

The deployed state is therefore not identical to repository HEAD intent. The actual deployed metadata results in this report control deployed conclusions. The two later repository migrations must not be treated as applied.

## Repository intent versus confirmed deployed state

| Concern | Repository evidence before 03C | Confirmed deployed evidence | Conclusion |
|---|---|---|---|
| Normalization tables | Migration intent; deployment unknown | All four normalization objects exist | Deployment presence resolved; active writer remains unknown |
| `wm_quote_facts` | Migration and runtime references | Table, columns, keys, policies, indexes, and size estimate present | Exact table deployed |
| `county_benchmarks` | Runtime expectation without DDL | Exact relation absent | `CONTRADICTED` as a deployed object |
| `quote_intelligence_facts` | Exact repository object absent | Exact relation absent | `ABSENT_CONFIRMED` |
| Generated types | Audit 02 found they lagged normalization objects and `leads.is_test` | Objects and `leads.is_test` are deployed | Generated-type drift is confirmed; generated types are not deployed authority |
| Full-report RPC browser grant | Audit 03 found conflicting repository migrations/comments | Deployed ACL lists only `postgres` and `service_role` | Deployed environment does not expose the selected full RPC to `anon`/`authenticated` by direct EXECUTE grant |
| Private quote bucket | Repository intent | Private `quotes` bucket confirmed | Deployment matches intent for public/private state |
| Benchmark scheduling | Repository candidate/refresher evidence; deployment unknown | `pg_cron` exists; zero rows in `cron.job`; execution role has `BYPASSRLS` | No scheduled jobs were configured at execution time |
| Latest repository migrations | Two later migrations present at HEAD | Both absent from applied ledger | Repository HEAD is ahead of deployed migration history |

## Role-visibility assessment

| Result | Visibility assessment |
|---|---|
| `SB-MD-001` + `SB-MD-022` | Current/session role is `postgres`; it is not superuser, inherits roles, and has `BYPASSRLS` |
| `SB-MD-005` | Public-object column coverage is strong because `postgres` owns those objects and `SB-MD-022` confirms RLS bypass; `information_schema` still reflects SQL privilege visibility rather than Data API exposure |
| `SB-MD-010` | Incomplete as an effective-access model: `information_schema.table_privileges` omits role inheritance, schema ACLs, default ACLs, sequence ACLs, RLS effects, and implicit owner powers |
| `SB-MD-012` | Confirms routine ACL entries, not effective access through role membership or schema `USAGE` |
| `SB-MD-015` | `schema_migrations` has RLS disabled and is owned by `postgres`; the complete 162-row visible ledger is high-confidence for this execution role |
| `SB-MD-017` | Confirms the exact `quotes` bucket row was visible; does not establish ordinary client visibility |
| `SB-MD-021` + `SB-MD-022` | Successful-empty with `BYPASSRLS`; no scheduled rows existed in `cron.job` at execution time |

## Remaining exact schema bindings

Only the bindings below remain material to `GATE_DATABASE` and Audit 04 generation. `SB-MD-022` resolved execution-role RLS visibility, and `SB-MD-023` resolved deployed defaults/CHECK/enum metadata. The remaining items require authoritative non-row evidence or an owner decision; application-row inspection is not proposed.

| Missing binding | Why current evidence is insufficient | Safest query or evidence needed |
|---|---|---|
| Authoritative deployed extraction contract and every profileable JSON path/type | Catalog confirms `jsonb` columns only; Audit 02 found incompatible prompt/TS/runtime contracts | `NO SAFE CATALOG QUERY`; provide a versioned authoritative schema/validator plus deployed Edge Function artifact identity proving which contract runs |
| Valid-extraction and analytics-eligibility rule | Text status columns and booleans exist, but metadata cannot choose the successful/eligible population | `NO SAFE CATALOG QUERY`; extraction/data owner must approve an exact predicate using confirmed fields and states |
| Currency, total-price basis, line-price basis, tax/fee/discount/financing treatment, and rounding | `*_cents bigint` columns exist, while `wm_quote_facts.quote_amount` remains unit-ambiguous; names do not establish business semantics | `NO SAFE CATALOG QUERY`; product/data owner must approve a field-by-field semantic manifest |
| Quantity, opening-count, line-count, and dimension semantics | Quantity/count/dimension columns exist, but durable opening identity and denominator rules are not encoded in metadata | `NO SAFE CATALOG QUERY`; extraction/product owner must approve exact counting, unit, and reconciliation rules |
| Project, quote, revision, immutable-attempt, current-record, duplicate, and supersession mapping | Deployed schema confirms lead/file/session/analysis links but no explicit quote/revision/supersession entity | `NO SAFE CATALOG QUERY`; founder/data owner must approve a profiling identity and revision-exclusion rule or declare these cohorts unsupported |
| Test/demo exclusion | `leads.is_test` exists and is non-null, but propagation, completeness, and additional source/client markers are unbound | `NO SAFE CATALOG QUERY`; data/QA owner must approve the exclusion predicate and later validate it through separately authorized aggregates |
| Fact-table production ownership and normalization activation | Objects exist; no scheduled cron job and no deployed caller/writer proof was supplied | `NO SAFE CATALOG QUERY` without function bodies/logs/row data; provide deployed function inventory/caller evidence and an owner register |

## Supplemental binding results

### `SB-MD-022`

The expected columns `role_name`, `is_superuser`, `inherits_roles`, and `bypasses_rls` were present. One row returned:

| Role | Superuser | Inherits roles | Bypasses RLS |
|---|---:|---:|---:|
| `postgres` | `false` | `true` | `true` |

This resolves the SQL Editor role's RLS visibility for the recorded execution session. It also promotes `SB-MD-021` from role-visible empty to confirmed empty at execution time.

### `SB-MD-023`

The expected columns `record_type`, `schema_name`, `object_name`, `member_name`, and `metadata_detail` were present. The 136 returned rows break down as follows:

| Metadata class | Rows | Confirmed deployed scope |
|---|---:|---|
| CHECK constraints | 33 | Analysis/session statuses, selected outcome states/value checks, line categories, fact score/range checks, review states |
| Column defaults | 72 | Defaults across nine allowlisted tables |
| Enum labels | 31 | 4 anomaly, 9 dispatch, and 18 event labels |

Material deployed bindings include:

- `analyses.analysis_status`: `pending`, `processing`, `complete`, `failed`, `invalid_document`, `needs_better_upload`; default `pending`.
- `scan_sessions.status`: `idle`, `uploading`, `processing`, `preview_ready`, `awaiting_verification`, `revealed`, `invalid_document`, `needs_better_upload`; default `idle`.
- `quote_observations.is_stats_eligible` defaults to `false`; this does not define the predicate that may set it true.
- `wm_quote_facts.approved_for_index`, `approved_for_ads`, `duplicate_suspected`, `impossible_values_detected`, and `manual_review_required` default to `false`; `is_quote_document` defaults to `true`.
- `leads.is_test` defaults to `false`; metadata does not prove correct test-data classification.
- `quote_line_items.line_category` allows `window`, `door`, `screen`, `install`, `permit`, `trim`, `demo`, `discount`, `tax`, and `other`.
- Fact score constraints establish ranges, including 0–1 scores and 0–100 deposit percentage, but do not establish monetary unit or price basis.
- `contractor_outcomes.sold_currency` defaults to `USD`; that default applies to outcome records and does not establish extracted quote currency.
- Two contractor outcome business-rule constraints were reported `NOT VALID`, and duplicate non-negative checks exist for projected/final value. These are deployed schema observations, not Audit 04 semantic authority.

## Evidence ledger

| Evidence ID | Classification | Claim | Source and exact reference | Observation | Build implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|
| `A03C-001` | `CONFIRMED` | Operator executed the initial 21 reviewed queries and supplemental queries 022–023 on the named branch and reported success/rollback | Operator requests; both attachments in full | Manual execution attestation | Establishes evidence provenance, not independent target proof | High for attestation | Retain execution record |
| `A03C-002` | `CONFIRMED` | PostgreSQL is 17.6 and execution role is `postgres` | Original attachment lines 1–21; `SB-MD-001` | Exact expected result shape | Version-sensitive SQL can target PG17 | High | Role attributes resolved by `A03C-015` |
| `A03C-003` | `CONFIRMED` | Six relevant schemas are visible | Attachment lines 23–49; `SB-MD-002` | Owners returned for all six | Schema presence bound | High | Preserve SQL-text reproduction limitation |
| `A03C-004` | `CONFIRMED` | 19 relation candidates exist; two exact candidates are absent | Attachment lines 52–148; `SB-MD-003` | `county_benchmarks` and `quote_intelligence_facts` absent | Similar objects cannot substitute | High | None for existence |
| `A03C-005` | `CONFIRMED` | Live columns/types/nullability are available for 15 public objects | Original attachment lines 215–625; `SB-MD-005` | 344 rows | Physical schema bound; semantics not bound | High | Database domains resolved by `A03C-016`; owner semantics remain |
| `A03C-006` | `CONFIRMED` | Key identity/cardinality constraints and indexes are deployed | Attachment lines 626–920; `SB-MD-006`/`007` | 50 constraints; 84 valid/ready indexes | Safe joins can be designed only after semantic gate | High | Bind quote/revision/current rules |
| `A03C-007` | `CONFIRMED` | Catalog size estimates are available | Attachment lines 921–988; `SB-MD-008` | 15 relations; six estimates are `-1` | Supports later preflight planning, not row counts | High | Later authorized preflight |
| `A03C-008` | `CONFIRMED` | RLS is enabled on present public candidates and sanitized policies/grants were returned | Attachment lines 989–1517; `SB-MD-009`/`010` | 23 policies; 389 grant rows | Effective client access remains predicate-, schema-, and Data-API-limited | Medium-high | Separate security review |
| `A03C-009` | `CONFIRMED` | Selected routine signatures, modes, and ACLs are deployed | Attachment lines 1518–1675; `SB-MD-011`/`012` | 8 routines; 21 ACL rows | Full RPC direct browser grant not present in deployed ACL | High for ACLs | Function-body behavior remains separate |
| `A03C-010` | `CONFIRMED` | Fifteen relevant triggers are enabled | Attachment lines 1676–1759; `SB-MD-013` | Trigger names and handler identities only | No intelligence post-analysis trigger was identified | High for inventory | Caller/writer ownership evidence |
| `A03C-011` | `CONFIRMED` | 162 migrations are visible and two newer repository migrations are unapplied | Attachment lines 1760–1996; repository `supabase/migrations` at current SHA | Complete visible ledger under cap | Deployed and repository intent differ | High | Do not treat later migrations as deployed |
| `A03C-012` | `CONFIRMED` | Private `quotes` bucket and sanitized write policies are deployed | Attachment lines 1997–2143; `SB-MD-016`–`018` | One private bucket; four object policies | Storage object privacy still depends on predicates and lifecycle | High for returned metadata | Security/privacy review |
| `A03C-013` | `CONFIRMED` | No scheduled cron jobs were configured at execution time | Original attachment lines 2144–2276; supplemental attachment lines 1–13 | `cron.job` successful-empty; execution role has `BYPASSRLS` | Benchmark scheduling absence is deployed evidence | High | Recheck only if environment changes |
| `A03C-014` | `CONFIRMED` | Required semantic bindings remain absent | Audits 02–03 plus `SB-MD-003`–`023` | Metadata establishes shape/domains, not extraction or business semantics | `GATE_DATABASE` remains closed | High | Complete exact binding register above |
| `A03C-015` | `CONFIRMED` | SQL Editor role bypasses RLS | Supplemental attachment lines 1–13; `SB-MD-022` | `postgres`: non-superuser, inheriting, `BYPASSRLS=true` | Resolves recorded execution-role visibility | High | Use same role class for later reviewed execution |
| `A03C-016` | `CONFIRMED` | Deployed defaults, CHECK constraints, and selected enum labels are bound | Supplemental attachment lines 15–269; `SB-MD-023` | 136 rows: 33 checks, 72 defaults, 31 enum labels | Physical domains resolved; semantic rules remain owner-controlled | High | No further catalog query for business meaning |

## Contradictions and limitations

| ID | Finding | Consequence |
|---|---|---|
| `C-03C-001` | The operator attests exact reviewed SQL, but the attachment omits the `SB-MD-002` transaction/timeout preamble and omits stable headings for `SB-MD-001`/`002` | Execution controls are operator-attested rather than byte-for-byte reproducible for that section |
| `C-03C-002` | Repository HEAD contains two migrations absent from the deployed ledger | Repository intent must not be labeled deployed |
| `C-03C-003` | Audit 03's repository-only concern about browser EXECUTE on `get_analysis_full` is not present in deployed ACL metadata | Deployed ACL evidence supersedes repository-only deployment assumptions for this environment |
| `C-03C-004` | Several fact relations report `reltuples=-1` while existing repository/runtime materials discuss intelligence facts | Population and active ownership cannot be inferred from object presence or catalog statistics |

No application result was reclassified as globally complete where role visibility or sanitization prevented that conclusion.

## Gate decision and handoff

### `NEEDS_SCHEMA_BINDING` determination

`NEEDS_SCHEMA_BINDING` is **not resolved**.

Physical deployed-schema binding is now strong for the allowlisted objects, columns, keys, indexes, RLS flags, selected ACLs, migration history, Storage bucket, catalog size estimates, execution-role RLS visibility, defaults, CHECK constraints, and selected enums. The remaining blockers are extraction-contract and business-semantic bindings required by Audit 04's binding gate.

### `GATE_DATABASE`

`GATE_DATABASE: NOT SATISFIED`

Audit 04 profiling-pack generation must not begin until:

1. the authoritative deployed extraction contract and every profileable JSON path/type are bound;
2. the valid-extraction and analytics-eligibility predicate is approved; and
3. the monetary, quantity/opening, entity/revision, duplicate/current-record, test-data, and fact-ownership bindings receive authoritative non-row evidence or explicit owner decisions.

This is not a profiling authorization. No profiling SQL was generated or executed, and no database, Storage, function, migration, configuration, source, prior audit, or Git state was modified.

NEEDS_SCHEMA_BINDING
