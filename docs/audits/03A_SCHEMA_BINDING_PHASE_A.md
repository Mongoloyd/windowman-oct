# Schema Binding Phase A — Remote Metadata Discovery

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Schema Binding Phase A — Remote Metadata Discovery and Query-Pack Gate |
| UTC execution time | `2026-08-30T21:53:18.1527590Z` |
| Execution environment | `CODEX`, local Windows PowerShell with connected Supabase metadata tools |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status before this artifact | No staged or tracked changes; pre-existing untracked Audit 01, Audit 02, and Audit 03 Markdown artifacts |
| Configured upstream | `origin/forensic_report_v2` |
| Remote Git parity verified | `NO`; network authorization was restricted to exact-project Supabase metadata reads |
| Operator-declared database environment | `PRODUCTION / LIVE_ACTIVE` |
| Operator-declared project ref | `zgsofkgddpcntdvpckdq` |
| Independently verified project ref | `NONE` |
| PostgreSQL version for the authorized target | `UNKNOWN`; the target project could not be resolved |
| Production read authorization | Metadata-only authorization for the exact supplied project ref |
| Database/application-data authorization | `NONE` |
| SQL execution authorization | `NONE` |
| Audit condition | Stopped at target verification before schema metadata discovery |
| Applicable governance | User-supplied `00_AUDIT_PROTOCOL_AND_SEQUENCE.md` from task history; repository `AGENTS.md`; completed Audits 01–03 |
| On-disk protocol limitation | No repository file named `00_AUDIT_PROTOCOL_AND_SEQUENCE.md` was found; the complete protocol supplied in this task was used instead |
| Repository mutation authorization | Exactly this supplemental Markdown artifact only |
| Auditor limitations | No SQL, data rows, aggregate profiling, Storage objects, logs, keys, secrets, Edge invocations, RPCs, tests, builds, deployments, type generation, Git mutation, or configuration changes |

### Method

1. Read the completed Audit 01, Audit 02, and Audit 03 artifacts.
2. Applied the complete protocol previously supplied in this task; recorded that no on-disk protocol artifact exists.
3. Used project-list metadata as the first remote operation.
4. Used exact-ref project-detail metadata only after the list result failed to contain the authorized ref.
5. Stopped all further remote discovery when the exact target could not be resolved.
6. Withheld the catalog SQL pack because its environment binding gate did not pass.

No finding about the accessible alternative project is promoted to a finding about the authorized production target.

## 2. Operator authorization recorded verbatim

```text
Target environment:
PRODUCTION / LIVE_ACTIVE

Non-secret Supabase project identifier:
zgsofkgddpcntdvpckdq

Production read authorization:
AUTHORIZED FOR METADATA-ONLY SCHEMA BINDING

Read-only network authorization:
AUTHORIZED only for Supabase metadata reads against the exact project
zgsofkgddpcntdvpckdq.

Authorized access method:
Connected Supabase metadata tools.

Authorized non-SQL metadata operations:

- Identify and verify the exact project with list-project/get-project metadata.
- List deployed tables and column metadata.
- List applied migrations.
- List deployed Edge Functions and deployment metadata.
- List installed extension names only if required to interpret schema behavior.
- Inspect metadata needed to determine schemas, object existence, columns, types,
  RLS-enabled state, and migration/deployment inventory.

Not authorized in Phase A:

- execute_sql
- apply_migration
- Any DDL or DML
- Database row retrieval
- Aggregate data profiling
- Raw application-table SELECT queries
- Edge Function or RPC invocation
- Storage-object access
- Logs
- API keys, JWTs, database credentials, connection strings, or secrets
- get_publishable_keys
- Type generation
- Branch/project creation, deletion, reset, merge, or rebase
- Deployment or configuration changes
- Repository source/configuration changes
- Tests, builds, services, commits, or pushes
```

Operator-approved limits for proposed metadata SQL were also recorded as supplied:

```text
- statement_timeout: 10 seconds
- lock_timeout: 1 second
- idle_in_transaction_session_timeout: 15 seconds
- maximum returned metadata rows per query: 500
- no unbounded wildcard object searches
- no application-table scans
```

These limits did not authorize SQL execution and were not used.

## 3. Verified target identity

| Identity check | Required value | Observed metadata | Classification | Consequence |
|---|---|---|---|---|
| Project discovery | Exact ref `zgsofkgddpcntdvpckdq` must be present | Project list returned one accessible project with ref `wkrcyxcnzhwjtdpmfpaf`, name `WMProd`, status `ACTIVE_HEALTHY`; the authorized ref was absent | `CONTRADICTED` for the current connected-tool visibility | The listed project was not inspected or treated as a fallback |
| Exact project lookup | Detail response must resolve to `zgsofkgddpcntdvpckdq` | `NotFoundException: Project not found` | `CONTRADICTED` | Exact target could not be independently confirmed |
| Environment role | Exact resolved project must be confirmed as `LIVE_ACTIVE / PRODUCTION` | No exact project record was available | `UNKNOWN` | Operator label remains unverified remote metadata |
| Project status | Status for exact target | Unavailable | `UNKNOWN` | No health/status claim for the target |
| PostgreSQL version | Version for exact target | Unavailable | `UNKNOWN` | A version returned for a different project was deliberately not adopted |

The alternative ref was recorded only as evidence of the identity conflict. No table, migration, Edge Function, extension, Storage, log, key, or SQL operation targeted it.

## 4. Non-SQL metadata call ledger

| Call ID | Operation | Input scope | Sanitized result | Classification | Follow-on action |
|---|---|---|---|---|---|
| `SB-NS-001` | Supabase project list | User-visible project metadata only | One accessible project returned; its ref differed from the authorized ref | `CONFIRMED` | Did not inspect that project; performed one exact-ref detail check |
| `SB-NS-002` | Supabase project detail | Exact ID `zgsofkgddpcntdvpckdq` only | `Project not found` | `CONFIRMED` | Stopped all remote schema discovery |

### Operations deliberately not called

| Operation | Status | Reason |
|---|---|---|
| List tables/columns/PKs/FKs | `NOT_CALLED` | Exact target not verified |
| List applied migrations | `NOT_CALLED` | Exact target not verified |
| List Edge Functions | `NOT_CALLED` | Exact target not verified |
| List extensions | `NOT_CALLED` | Exact target not verified and not needed before target resolution |
| Get project URL | `NOT_CALLED` | Not required for metadata binding; target unresolved |
| Get publishable keys | `PROHIBITED_NOT_CALLED` | Explicitly outside authorization |
| Get logs | `PROHIBITED_NOT_CALLED` | Explicitly outside authorization |
| Execute SQL | `PROHIBITED_NOT_CALLED` | Explicitly outside authorization |
| Apply migration | `PROHIBITED_NOT_CALLED` | Explicitly outside authorization |
| Generate types | `PROHIBITED_NOT_CALLED` | Explicitly outside authorization |
| Invoke Edge Function/RPC/Storage | `PROHIBITED_NOT_CALLED` | Explicitly outside authorization |

## 5. Deployed-object comparison

No deployed-object metadata was obtained for the authorized target. The repository column below preserves earlier audit evidence only; it is not promoted to deployed truth.

| Allowlisted scope | Repository evidence from Audits 01–03 | Exact-target remote metadata | Phase A disposition |
|---|---|---|---|
| Schemas `public`, `storage`, `auth` | Referenced by migrations/runtime; deployment previously unknown | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `leads` | Repository migration/runtime table | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `quote_files` | Repository migration/runtime table | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `scan_sessions` | Repository migration/runtime table | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `analyses` | Repository canonical lifecycle table with protected `full_json` intent | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `phone_verifications` | Repository migration/runtime table | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `wm_quote_facts` | Repository-defined and runtime-written candidate fact projection | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `quote_observations` | Repository migration/helper candidate; absent from generated types | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `quote_line_items` | Repository migration/helper candidate; absent from generated types | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `normalization_failures` | Repository migration/helper candidate; absent from generated types | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `wm_quote_reviews` | Repository migration-only candidate | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `wm_pricing_index_snapshots` | Repository migration-only candidate | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `county_benchmarks` | Runtime writer expects it; no repository table DDL/type authority found | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `quote_intelligence_facts` | Exact object absent from verified repository scope | Not inspected | Repository contradiction remains; remote existence unknown |
| `wm_event_log` | Repository canonical event table | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `lead_events` | Repository operational event table | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `event_logs` | Repository operational event table | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| `contractor_outcomes` | Repository downstream outcome table | Not inspected | `UNKNOWN_TARGET_UNVERIFIED` |
| Relevant views | Repository evidence includes invoker-security admin views | Not inspected | Owners, definitions, grants, exposure, and RLS interaction unknown |
| Relevant triggers | Repository evidence includes lifecycle/timestamp/lead triggers; no confirmed intelligence trigger | Not inspected | Deployed trigger inventory unknown |
| Relevant functions/RPCs | Repository candidates include preview/full/status/pointer/operator/consent functions | Not inspected | Signatures, owners, modes, search paths, grants, and deployed definitions unknown |

### Repository/generated-type/documentation comparison

| Evidence-domain difference carried from prior audits | Exact-target deployed resolution |
|---|---|
| Generated types omit later normalization objects and `leads.is_test` | Unresolved |
| `county_benchmarks` has runtime writer source but no repository table authority | Unresolved |
| `quote_intelligence_facts` is absent from repository scope | Remote existence unresolved |
| Report source comments conflict with repository RPC grants | Effective deployed grants unresolved |
| Repository docs label `zgsofkgddpcntdvpckdq` as live while connected project discovery does not expose it | Identity conflict; no fallback allowed |

## 6. Applied migration and deployment comparison

| Domain | Repository/audit evidence | Exact-target metadata | Comparison result |
|---|---|---|---|
| Migration source | Audit 01 counted 165 tracked paths under `supabase/migrations`; Audit 02 described 164 ordered handwritten SQL migrations | Not listed | No applied-versus-repository comparison possible; the prior count distinction is preserved rather than reconciled here |
| Applied migration history | Previously unknown | Not listed | `UNKNOWN` |
| Latest applied migration | Previously unknown | Not listed | `UNKNOWN` |
| Migration gaps/order | Repository intent only | Not listed | `UNKNOWN` |
| Edge Function inventory | Repository source had 60 candidate function directories and 59 config entries | Not listed | Deployment parity unknown |
| Edge Function deployment metadata | Previously unknown | Not listed | `UNKNOWN` |
| Installed extension names | Repository migrations reference selected extensions | Not listed | `UNKNOWN` |

No metadata from the accessible alternative project was used to fill these cells.

## 7. Remaining schema and security unknowns

| Unknown ID | Question | Why unresolved | Build/profile impact | Required resolution evidence |
|---|---|---|---|---|
| `U-03A-001` | Why is the authorized project absent from connected project discovery? | Connected identity returned another project and exact lookup returned not found | Prevents all remote production claims | Correct connected Supabase account/organization visibility or a corrected operator-bound ref |
| `U-03A-002` | Is `zgsofkgddpcntdvpckdq` active, paused, deleted, transferred, or inaccessible? | Exact project detail unavailable | Environment identity cannot pass | Exact non-secret project metadata from an authorized connection |
| `U-03A-003` | Which schemas and allowlisted tables exist? | Table metadata call stopped | Schema binding blocked | Exact-target verbose table metadata |
| `U-03A-004` | What columns, types, nullability, PKs, FKs, and unique constraints are deployed? | Table metadata call stopped | Audit 04 object/semantic bindings blocked | Exact-target verbose table metadata and, if still unresolved, reviewed catalog SQL |
| `U-03A-005` | Which tables have RLS enabled or forced? | No exact-target table/catalog metadata | Security gate blocked | Exact-target metadata/catalog evidence |
| `U-03A-006` | What are effective grants, owners, policies, view modes, function modes, search paths, and RPC signatures? | Non-SQL tools were not reached and some properties require catalog SQL | Security gate blocked | Reviewed metadata-only catalog pack after target verification |
| `U-03A-007` | Which migrations are applied? | Migration listing stopped | Repository/deployment drift unknown | Exact-target migration ledger |
| `U-03A-008` | Which Edge Functions are deployed and at what versions/status? | Function listing stopped | Source/deployment parity unknown | Exact-target Edge Function metadata |
| `U-03A-009` | What PostgreSQL version runs on the target? | Exact project metadata unavailable | Version-sensitive behavior unknown | Exact-target project/database metadata |
| `U-03A-010` | What relation sizes, indexes, and visibility limits govern later profiling? | Phase A identity failed; profiling is not authorized | Audit 04 limits cannot be set | Exact-target metadata, then separately reviewed metadata SQL; no application scan |
| `U-03A-011` | What Data API schemas are exposed? | No exact-target dashboard/config metadata tool result | Exposure assessment incomplete | Authorized exact-target Data API configuration evidence |
| `U-03A-012` | What Storage bucket/policy state is deployed? | Target failed before Storage metadata; object access is prohibited | Source-document security remains unknown | Separately authorized metadata-only bucket/policy evidence, without object listing |

### Evidence register

| Evidence ID | Classification | Claim | Source | Observation | Consequence |
|---|---|---|---|---|---|
| `A03A-001` | `CONFIRMED` | Required completed audit artifacts were read | Local files under `docs/audits` | Audits 01–03 available; on-disk protocol file absent | Prior blockers and source/deployment distinctions carried forward |
| `A03A-002` | `CONFIRMED` | Project discovery did not return the authorized ref | `SB-NS-001` | Only a different ref was visible | Alternative project could not be used |
| `A03A-003` | `CONFIRMED` | Exact target lookup failed | `SB-NS-002` | Project not found | Exact target not independently verified |
| `A03A-004` | `UNKNOWN` | Authorized target environment/status/version | No exact project record | Operator label could not be corroborated | No deployed claim is safe |
| `A03A-005` | `CONFIRMED` | Remote discovery stopped before schema calls | Tool-call ledger | No table/migration/function/extension calls occurred | No cross-project metadata exposure |
| `A03A-006` | `CONFIRMED` | No SQL was generated or executed | Task operation ledger | SQL tools were not called; catalog pack withheld | Human review has no executable pack in this stopped run |

## 8. Proposed `SB-MD-*` catalog query pack

### Pack disposition

No catalog SQL was generated.

The binding gate requires a remotely verified exact target before a query can be bound to an environment. Generating executable metadata SQL after the connected account failed to resolve the authorized project would create an unbound artifact that could be run against the wrong database. That would conflict with the closed-world protocol and the operator's no-fallback requirement.

Consequently:

- no `SB-MD-*` query IDs were issued;
- no speculative object or schema binding was embedded in SQL;
- no read-only transaction text was produced;
- no SQL was executed;
- the approved timeout and 500-row limits remain unused pending a new, identity-verified run.

After target identity is corrected and independently verified, a new Phase A run may generate a review-only pack limited to the unresolved catalog concerns: server version; allowlisted schemas/relations/columns; PK/FK/unique/check constraints; indexes; RLS/forced-RLS; policies; owners/grants; allowlisted views/functions/RPC signatures/security modes/search paths; triggers; migration-history metadata; and relation size estimates. That future pack must receive human review before any execution.

## 9. Human-review checklist

- [ ] Confirm the connected Supabase identity has visibility into project ref `zgsofkgddpcntdvpckdq`.
- [ ] Re-run project discovery and confirm the exact ref appears without substituting `wkrcyxcnzhwjtdpmfpaf` or another project.
- [ ] Re-run exact project detail and confirm the returned ref, status, organization context, and non-secret environment mapping.
- [ ] Confirm `PRODUCTION / LIVE_ACTIVE` against current authoritative project metadata.
- [ ] Re-authorize metadata-only discovery for the exact resolved project if the connection or ref changes.
- [ ] Only after identity passes, list allowlisted tables with verbose columns/PK/FK metadata.
- [ ] Only after identity passes, list applied migrations and deployed Edge Functions.
- [ ] List extension names only if needed to interpret an observed schema behavior.
- [ ] Keep alternative projects outside scope.
- [ ] Preserve the ban on application rows, raw JSON, PII, Storage objects, logs, keys, secrets, RPC/Edge invocation, and profiling.
- [ ] Generate a new `SB-MD-*` pack only for metadata properties still unavailable after authorized non-SQL discovery.
- [ ] Review every generated query for exact target identity, allowlisted objects, 10-second statement timeout, 1-second lock timeout, 15-second idle timeout, 500-row maximum, no application scans, and final `ROLLBACK`.
- [ ] Do not execute reviewed catalog SQL until the operator grants separate execution authorization.
- [ ] Do not start Audit 04 until deployed and semantic bindings satisfy its gate.

## 10. Terminal status

`TARGET_IDENTITY_MISMATCH`
