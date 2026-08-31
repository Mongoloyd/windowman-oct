# 03F — Semantic Binding Approval and Specialist Review

## Technical summary

The founder approved the conservative decisions in Audit 03E for a restricted Phase 0 profiling pack. The evidence-based specialist reviews below return three `PASS` and four `CONDITIONAL_PASS` findings. None authorizes implementation, production analytics, or SQL execution, and none is represented as independent human, legal, privacy-professional, or security-professional certification.

The approved exclusions resolve the semantic ambiguity by disabling unsupported data rather than assigning it guessed meaning. Therefore:

- **`NEEDS_SCHEMA_BINDING: RESOLVED_FOR_RESTRICTED_PROFILE_GENERATION_ONLY`**
- **`GATE_DATABASE: SATISFIED_FOR_RESTRICTED_PROFILE_GENERATION`**
- **Audit 04 SQL generation has not started.**
- **Audit 04 SQL execution is not authorized.**

This gate status applies only to a future SQL pack frozen to the approved source allowlist, predicate, fields, paths, aggregates, and exclusions recorded in Audits 03D–03F.

## Execution identity

| Field | Value |
|---|---|
| Audit name | Phase 0 semantic-binding approval and evidence-based specialist review |
| UTC execution time | `2026-08-31T00:35:24Z` |
| Execution environment | CODEX, local read-only evidence review plus one authorized Markdown artifact write |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status before this artifact | Pre-existing untracked Audit 01–03E artifacts; no tracked-file change reported by `git status --short` |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity actually verified | NO; no network operation was performed |
| Database environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD`, Supabase branch `forensic_report_v1` |
| Database project identifier | Branch instance ref `zgsofkgddpcntdvpckdq`; dormant parent ref `wkrcyxcnzhwjtdpmfpaf` remains out of scope |
| PostgreSQL version | 17.6, from operator-executed and Audit 03C-validated `SB-MD-001` evidence |
| Database access in this task | NONE |
| SQL execution | NONE |
| Network access in this task | NONE |
| Applicable governance | `AGENTS.md`; Phase 0 protocol; Audits 03C, 03D, and 03E |
| Audit status | COMPLETE — gate satisfied for restricted pack generation only, with execution and production-use conditions retained |
| Auditor limitations | No application rows, raw `full_json`, source documents, logs, credentials, Storage objects, services, tests, builds, migrations, or deployment state were accessed |

## Scope and review authority

The audit agent was authorized to issue evidence-based technical `PASS`, `CONDITIONAL_PASS`, or `BLOCKED` findings for `SR-03E-001` through `SR-03E-007`. These findings mean:

| Finding | Meaning in this report |
|---|---|
| `PASS` | Existing evidence and founder policy are sufficient for restricted profiling-pack generation without an unresolved condition in that domain, provided all global restrictions remain intact. |
| `CONDITIONAL_PASS` | Generation may proceed only if the stated conditions are encoded in the future pack and its human-review record. The condition does not permit execution. |
| `BLOCKED` | Evidence or authority is insufficient even to generate the restricted pack safely. |

These statuses are technical audit findings only. They are not independent professional certifications and do not replace human review required before SQL execution, implementation, benchmark publication, or production use.

## Evidence reviewed

The review used only:

1. Audit 03C's validated operator-executed deployed metadata, including `SB-MD-022` role visibility and `SB-MD-023` constraints/defaults/enums;
2. Audit 03D's fingerprinted deployed `scan-quote` source archive and restricted runtime-contract matrix;
3. Audit 03E's complete semantic manifests, exact population predicate, ownership classifications, exclusions, and gate conditions;
4. repository evidence at SHA `7a497a5f1cba752d26ce1721f39d0a8288306a51`; and
5. the founder authorization recorded in the current task.

No current application-data quality claim is made because no application row or aggregate was inspected in this task.

## Founder approval record

### Approval identity

| Field | Recorded value |
|---|---|
| Founder name/role | `[YOUR NAME], WindowMan Founder and Product Owner` |
| UTC decision time | `2026-08-31T00:35:24Z` |
| Decision source | Current operator message in this task |
| Scope | Restricted Phase 0 profiling-pack policy only |

The bracketed founder-name placeholder is preserved exactly as supplied; no personal name was inferred. The current task authorization and stated role are sufficient to record the technical policy decision, but this record is not a legal signature or identity-verification instrument.

### Eight decisions recorded exactly

```text
FD-03D-001: APPROVE_RECOMMENDATION
FD-03D-002: APPROVE_RECOMMENDATION
FD-03D-003: APPROVE_RECOMMENDATION
FD-03D-004: APPROVE_RECOMMENDATION
FD-03D-005: APPROVE_RECOMMENDATION
FD-03D-006: APPROVE_RECOMMENDATION
FD-03D-007: APPROVE_RECOMMENDATION
FD-03D-008: DEFER_UNSUPPORTED
```

### Approved meaning and restrictions

The founder explicitly approved all of the following:

1. Only the exact FD-03D-001 restricted quality-population predicate is approved.
2. Semantic and market-profile eligibility remains false.
3. All current monetary fields are excluded from profiling.
4. Integer USD cents are approved only as the future canonical monetary representation.
5. Only guarded line-item array length may be called `extracted_line_item_count`.
6. Opening count, quantity, dimensions, united inches, and per-opening calculations remain disabled.
7. `lead_id` is not a quote or project identity.
8. Quote identity, revision identity, immutable attempt identity, duplicate identity, current-quote selection, and supersession remain unsupported.
9. Only records joined to `leads.is_test IS FALSE` may enter the restricted population.
10. `analyses`, joined to `scan_sessions`, `quote_files`, and `leads`, is the only approved restricted source.
11. Existing fact-like tables are not approved as authoritative analytics sources.
12. Historical unversioned analyses may be used only for restricted quality and pipeline-health counts.
13. Historical unversioned analyses may not be used for monetary, market, benchmark, product, contractor, geography, opening, or cross-version claims.
14. Every non-runtime-enforced extraction path remains `NOT_PROFILED_UNBOUND` or `NOT_PROFILED_PII`.
15. No raw JSON, source text, descriptions, PII, identifiers, filenames, Storage paths, or contractor names may appear in outputs.
16. These decisions do not authorize Audit 04 execution, implementation, schema changes, migrations, or production changes.

## Frozen restricted population and source boundary

The approved population is the exact Audit 03E predicate reproduced below solely to freeze the binding. It is not an executable profiling query:

```sql
a.analysis_status = 'complete'
AND a.document_is_window_door_related IS TRUE
AND a.confidence_score BETWEEN 0.4 AND 1
AND a.document_type IS NOT NULL
AND btrim(a.document_type) <> ''
AND lower(btrim(a.document_type)) <> 'unknown'
AND s.id = a.scan_session_id
AND s.status IN ('preview_ready', 'awaiting_verification', 'revealed')
AND qf.id = s.quote_file_id
AND l.id = a.lead_id
AND l.is_test IS FALSE
AND a.full_json IS NOT NULL
AND jsonb_typeof(a.full_json) = 'object'
AND jsonb_typeof(a.full_json -> 'extraction') = 'object'
AND jsonb_typeof(a.full_json -> 'extraction' -> 'line_items') = 'array'
AND jsonb_array_length(a.full_json -> 'extraction' -> 'line_items') >= 1
```

Aliases remain fixed as `a = public.analyses`, `s = public.scan_sessions`, `qf = public.quote_files`, and `l = public.leads`. Identifiers may be used internally for joins and approved distinct counts under their actual entity names, but may not appear in output.

---

## SR-03E-001 — Data-platform technical review

### Evidence reviewed

- Deployed PK/FK/unique/index metadata and relation inventory: A03C-004–A03C-007.
- Deployed status/default/constraint evidence: A03C-016.
- Scanner upsert and persistence boundary: A03D-012, A03D-017.
- Approved identity restrictions, ownership classification, source allowlist, and historical rule: Audit 03E FD-03D-004, FD-03D-006, FD-03D-007; A03E-004, A03E-007, A03E-008.

### Finding

**`CONDITIONAL_PASS`**

The deployed constraints support reproducible joins from analysis to scan session, uploaded document, and lead. They do not support quote, revision, immutable-attempt, duplicate, current-record, or supersession semantics. The approved policy correctly labels the supported entities and disables dependent metrics.

### Conditions and limitations

- The initial application-value source allowlist is exactly `analyses`, `scan_sessions`, `quote_files`, and `leads`.
- Values from `wm_quote_facts`, `quote_observations`, `quote_line_items`, `normalization_failures`, `wm_quote_reviews`, `wm_pricing_index_snapshots`, event tables, and `contractor_outcomes` are excluded.
- `county_benchmarks` and `quote_intelligence_facts` remain absent and must not be referenced.
- No project, quote, revision, attempt, duplicate, current-record, supersession, re-analysis-frequency, or leave-one-quote-out metric may be generated.
- `analyses.id` is a mutable analysis-row identity because persistence upserts on `scan_session_id`; it is not an immutable processing-attempt identity.
- Missing lead/document/session joins are exclusion counts, not eligible records.
- Catalog size estimates remain estimates and must be rechecked by the future preflight gate before any application-data scan.

### Founder accountability sufficiency

**Sufficient for restricted profiling-pack generation:** YES. The founder is approving a fail-closed source and identity policy grounded in deployed keys, not asserting unsupported schema semantics.

### Independent review before implementation or production use

**Still required:** YES. An independent data-platform review is required before creating or promoting an intelligence fact model, adding identities, implementing writers, backfilling data, publishing cohorts, or using any excluded fact-like table in production analytics.

---

## SR-03E-002 — Extraction-contract technical review

### Evidence reviewed

- Deployed archive integrity and source comparison: A03D-001–A03D-006.
- Provider, normalization, parse, classification, coercion, validation, scoring, and persistence trace: A03D-007–A03D-013.
- Restricted contract and gate result: A03D-014, A03D-015.
- Approved field/count/history restrictions: Audit 03E FD-03D-001, FD-03D-003, FD-03D-007, FD-03D-008.

### Finding

**`PASS`**

The approved subset matches the complete-path runtime checks: object root; string `document_type`; related classification true; confidence in the accepted range; non-empty `line_items` array; object elements; and string descriptions. All non-enforced fields remain excluded.

### Conditions and limitations

- Structured columns are preferred for classification fields.
- Every JSON operation must use parent-first `jsonb_typeof` guards.
- `line_items` array length is labeled only `extracted_line_item_count`.
- Description content, distinct values, tokens, snippets, hashes, and labels are prohibited. Only aggregate presence/type/empty/approved length-bucket metrics may be generated, and no description value may appear in output.
- No prompt declaration, TypeScript type, deterministic output, or cast field outside the restricted subset becomes a runtime binding.
- Historical model/prompt/parser/schema comparability remains unknown; only quality and pipeline-health counts are allowed.
- Audit 03D's restricted subset may not be broadened by editing a future query pack.

### Founder accountability sufficiency

**Sufficient for restricted profiling-pack generation:** YES. The founder accepts the restricted deployed contract and the exclusion of all unvalidated paths.

### Independent review before implementation or production use

**Still required:** YES. Independent extraction review is required before changing response validation, admitting any additional path, assigning historical comparability, or using extracted values for production intelligence.

---

## SR-03E-003 — Financial-data technical review

### Evidence reviewed

- Unbound monetary fields and column types: A03C-005, A03C-014.
- Runtime absence of enforced monetary semantics: A03D-011–A03D-015.
- Complete monetary semantic manifest and exclusions: Audit 03E FD-03D-002; A03E-005.

### Finding

**`PASS`**

No current monetary field is approved for profiling. This removes the unresolved currency, unit, total-price basis, line-price basis, tax, fee, discount, financing, allowance, optional-work, and rounding questions from the restricted pack rather than guessing them.

### Conditions and limitations

- No current field with `price`, `amount`, `total`, `deposit`, `percent`, `_cents`, or deterministic financial output may be profiled, reconciled, grouped, or used for eligibility.
- No price-per-opening, line-total, tax/fee/discount, financing, currency, or benchmark query may be generated.
- `*_cents` names and `bigint` types do not prove source units or conversion correctness.
- Integer USD cents is a future canonical representation policy only. It does not certify current columns, authorize conversion, or authorize a migration.

### Founder accountability sufficiency

**Sufficient for restricted profiling-pack generation:** YES, because the decision excludes the entire unresolved financial domain.

### Independent review before implementation or production use

**Still required:** YES. Independent finance/data review and data-platform/QA validation are required before admitting any monetary field, conversion, reconciliation, price metric, cohort, benchmark, or production intelligence fact.

---

## SR-03E-004 — QA and data-quality technical review

### Evidence reviewed

- Deployed lifecycle states and defaults: A03C-005, A03C-016.
- Runtime complete-path conditions: A03D-010, A03D-014.
- Test-indicator evidence and limitation: A03E-006.
- Approved population, line-count, test exclusion, and historical-quality rules: Audit 03E FD-03D-001, FD-03D-003, FD-03D-005, FD-03D-007.

### Finding

**`CONDITIONAL_PASS`**

The predicate is reproducible from confirmed deployed columns and runtime states. However, no application rows or aggregates have yet tested test-label completeness, missing-link prevalence, historical distributions, unexpected output shapes, or scan-size feasibility.

### Conditions and limitations

- Audit 04 must report aggregate counts at each population exclusion step so the denominator is auditable without returning identifiers.
- `leads.is_test IS FALSE` is the only test predicate. Missing lead linkage is excluded, never treated as non-test.
- The results template must retain “test labeling completeness not yet aggregate-validated.”
- Pipeline-health counts must distinguish confirmed status values and an `other/unexpected` aggregate without emitting row details.
- Historical unversioned analyses may be counted only for pipeline health and restricted shape/presence/range quality.
- Quality counts must not be interpreted as semantic correctness, representativeness, or market eligibility.
- Query timeouts, schema mismatch, unexpected columns/output, suppression failure, or prohibited data are execution stop conditions.
- `NOT_EXECUTED` remains the pass-status for every generated query until manual execution evidence is supplied.

### Founder accountability sufficiency

**Sufficient for restricted profiling-pack generation:** YES. The future pack can encode the fail-closed rule and generate aggregate QA checks. Founder accountability does not validate the unseen population.

### Independent review before implementation or production use

**Still required:** YES. Independent QA/data-quality review is required before relying on results for implementation, production eligibility, benchmarks, or external claims. Human review of the exact generated SQL is required before any manual execution.

---

## SR-03E-005 — Privacy technical review

### Evidence reviewed

- PII and sensitive-data boundaries from Audit 03; raw-document and `full_json` restrictions from governance.
- Deployed extraction behavior showing arbitrary/free-text persistence risk: A03D-009–A03D-013.
- Approved exclusions and future path-study rule: Audit 03E FD-03D-001, FD-03D-005, FD-03D-008.
- Founder prohibition on raw JSON, source text, descriptions, PII, identifiers, filenames, Storage paths, and contractor names in outputs.

### Finding

**`CONDITIONAL_PASS — TECHNICAL PRIVACY REVIEW ONLY`**

The restricted pack can be generated without exposing direct identifiers or source content if it uses aggregate-only outputs, internal-only joins, approved suppression, and no value enumeration. This finding is not legal advice or independent privacy-professional certification.

### Conditions and limitations

- Prohibited in output and grouping: names, addresses, phone numbers, emails, contractor raw names, identifiers, filenames, Storage/object paths, raw JSON, source text, description text, snippets, distinct free-text values, hashes, and tokens.
- Description handling is limited to aggregate presence/type/empty/approved length buckets; no content may be selected or returned.
- `document_type` raw/unexpected labels must not be enumerated; only approved states or suppressed aggregate quality counts may be returned.
- Identifiers may be used internally only for joins and approved distinct counts; no identifier or stable row-level hash may be output.
- Geography, contractor, campaign, and other quasi-identifying groups remain disabled in the restricted pack; if later admitted, small-cell and concentration protections require separate binding.
- The future SQL pack must specify a positive output-column allowlist for every query.
- Any appearance of prohibited data is an immediate execution stop and incident record.

### Founder accountability sufficiency

**Sufficient for restricted profiling-pack generation:** YES, conditioned on encoding the exclusions above and retaining mandatory human review before execution.

### Independent review before implementation or production use

**Still required:** YES. Independent privacy/legal review remains required before reusing homeowner or contractor data for benchmarks, external reporting, production intelligence, retention changes, derived-data reuse, or any expansion beyond the restricted internal quality purpose.

---

## SR-03E-006 — Security technical review

### Evidence reviewed

- Deployed RLS, grants, role, function, trigger, and Storage metadata: A03C-008–A03C-010, A03C-012, A03C-015.
- SQL Editor role evidence: `postgres`, non-superuser, `BYPASSRLS=true` from `SB-MD-022`.
- Security/integration findings from Audit 03 and approved source/output restrictions from Audit 03E FD-03D-001, FD-03D-006, FD-03D-008.

### Finding

**`CONDITIONAL_PASS — TECHNICAL SECURITY REVIEW ONLY`**

Schema binding is sufficient to generate a read-only aggregate pack, but the reviewed SQL Editor role bypasses RLS. Therefore, RLS cannot be treated as an output-safety control for manual execution. Safety must come from exact query text, base-table allowlisting, aggregate-only projections, timeouts, rollback, result-shape review, and operator stop rules.

### Conditions and limitations

- Generation may target only the exact branch ref `zgsofkgddpcntdvpckdq`; the dormant parent remains prohibited.
- No SQL is authorized by this report. Future execution requires separate operator authorization and exact human review.
- Every SQL file must use a read-only transaction, reviewed literal timeouts, bounded catalog/application queries, and `ROLLBACK` as required by Audit 04.
- No user-defined function, RPC, Edge Function, trigger invocation, Storage access, logs, external service, dynamic SQL, DDL, DML, row lock, role change, or RLS bypass operation may be generated.
- The pack must not rely on RLS to filter rows because the reviewed role has `BYPASSRLS`.
- Only the approved four-table application source allowlist is permitted; fact-like values remain excluded.
- Query outputs must be aggregate-only, positively allowlisted, capped, and free of identifiers or sensitive data.
- Environment, project ref, role, schema, path, output-shape, permission, timeout, and suppression mismatches are hard stops.

### Founder accountability sufficiency

**Sufficient for restricted profiling-pack generation:** YES. The founder can accept a pack designed for later human review; founder accountability does not authorize execution or waive the privileged-role risk.

### Independent review before implementation or production use

**Still required:** YES. Independent security review is required before SQL execution against production unless the designated human reviewer has that role and accepts the exact pack, and before any implementation, scheduled job, service integration, role/grant change, benchmark endpoint, or production deployment.

---

## SR-03E-007 — Domain and estimating technical review

### Evidence reviewed

- Runtime line-item container and description checks: A03D-010, A03D-014.
- Lack of enforced quantity/opening/dimension semantics: A03D-011–A03D-015; A03E-005.
- Complete count/dimension semantic manifest and approved exclusions: Audit 03E FD-03D-003.

### Finding

**`PASS`**

The approved label `extracted_line_item_count` is technically accurate for guarded array length and does not imply physical openings, units, products, or dimensions. All domain-dependent calculations remain disabled.

### Conditions and limitations

- Array length may be reported only as extracted line-item element count.
- A line may represent an opening, multiple units, labor, permit, tax, discount, adder, or other scope; no domain class is inferred.
- Quantity, opening count, product/adder count, dimensions, united inches, price per opening, and opening-level cohorts remain disabled.
- Array position and any line index are not durable opening identities.

### Founder accountability sufficiency

**Sufficient for restricted profiling-pack generation:** YES. The approved terminology is deliberately non-domain-semantic.

### Independent review before implementation or production use

**Still required:** YES before admitting opening/quantity/dimension rules, per-opening calculations, product taxonomy, estimating logic, or customer/market claims. It is not required merely to generate guarded line-array quality counts.

## Specialist-review outcome register

| Review ID | Domain | Technical finding | Founder accountability sufficient for restricted generation | Independent review required before implementation/production use |
|---|---|---|---|---|
| SR-03E-001 | Data platform | CONDITIONAL_PASS | YES | YES |
| SR-03E-002 | Extraction | PASS | YES | YES |
| SR-03E-003 | Financial data | PASS | YES | YES |
| SR-03E-004 | QA/data quality | CONDITIONAL_PASS | YES | YES |
| SR-03E-005 | Privacy | CONDITIONAL_PASS — technical only | YES | YES |
| SR-03E-006 | Security | CONDITIONAL_PASS — technical only | YES | YES |
| SR-03E-007 | Domain/estimating | PASS | YES | YES for any domain-semantic expansion |

No review is `BLOCKED` for restricted profiling-pack generation. Conditional findings must be implemented as generation constraints and retained in the human-review checklist; they are not waivers.

## Resolution of `NEEDS_SCHEMA_BINDING`

### Determination

**`NEEDS_SCHEMA_BINDING: RESOLVED_FOR_RESTRICTED_PROFILE_GENERATION_ONLY`**

The required resolution conditions from Audit 03E are now met at the policy and technical-review level:

1. All eight founder decisions are recorded.
2. No `APPROVE_WITH_CHANGES` response expands or alters the restricted subset.
3. The exact FD-03D-001 predicate is approved and technically reviewed.
4. Every current monetary field is bound to exclusion.
5. Only guarded array length is bound as `extracted_line_item_count`; other count/unit fields are excluded.
6. Unsupported identity/revision/attempt/duplicate/current/supersession concepts are explicitly disabled.
7. The fail-closed `leads.is_test IS FALSE` rule is approved, with QA limitations retained.
8. `analyses` plus its three join relations is the sole approved restricted source.
9. Historical unversioned records are quality-count-only.
10. Every non-runtime-enforced extraction path remains deferred and excluded.
11. All seven specialist domains have evidence-based technical findings; conditional controls are explicit.
12. `SB-MD-022` and `SB-MD-023` are supplied and validated, not pending.

This does not resolve full semantic binding for monetary, market, benchmark, product, contractor, geography, opening, quote, revision, duplicate, current-record, or cross-version analytics. Those domains remain unsupported or excluded.

## `GATE_DATABASE` determination

### Gate result

**`GATE_DATABASE: SATISFIED_FOR_RESTRICTED_PROFILE_GENERATION`**

The gate is satisfied because the future generator can reference an exact deployed relation/column/path allowlist, a reproducible restricted population, confirmed lifecycle states, a fail-closed test rule, explicit identity labels, and binding exclusions for every unsupported semantic domain.

### What this gate permits

Only a separately requested Audit 04 generation task may produce a human-reviewable, read-only, aggregate-only SQL pack and results template using the frozen bindings in this report.

### What this gate does not permit

- It does not start Audit 04.
- It does not authorize SQL execution.
- It does not authorize application-row inspection.
- It does not authorize data profiling results or data-quality conclusions.
- It does not authorize schema changes, migrations, tables, functions, RPCs, Storage access, Edge Function invocation, deployment, backfill, implementation, commits, or pushes.
- It does not authorize monetary, market, benchmark, product, contractor, geography, opening, quote/revision, duplicate, current-record, supersession, or cross-version analytics.

### Entry requirements still needed when Audit 04 is separately requested

These are Audit 04 operational inputs, not unresolved schema bindings:

- explicit generation authorization;
- exact date range;
- statement, lock, and idle-transaction timeouts;
- maximum estimated rows and bytes;
- maximum output groups;
- small-cell threshold and suppression rule;
- approved output-row caps;
- deep-pack authorization status;
- operational reconciliation/cohort hypotheses only where their required fields are not disabled; for this restricted pack, unsupported hypotheses must be omitted or disabled;
- confirmation that the target, role, schema, migration state, and deployed contract have not changed; and
- a plan for human review before any execution request.

## Frozen Audit 04 restricted handoff

| Binding | Approved value |
|---|---|
| Target | WMProd branch `forensic_report_v1`, ref `zgsofkgddpcntdvpckdq`; parent ref prohibited |
| Source relations | `public.analyses`, `public.scan_sessions`, `public.quote_files`, `public.leads` only |
| Population | Exact FD-03D-001 predicate reproduced above |
| Allowed lifecycle fields | Confirmed `analyses.analysis_status` and `scan_sessions.status` domains |
| Allowed structured extraction projections | `analyses.document_is_window_door_related`, `analyses.confidence_score`, `analyses.document_type` |
| Allowed restricted JSON path | `analyses.full_json.extraction.line_items[]` and `line_items[].description` only, with parent-first type guards |
| Allowed JSON-derived measure | Array length labeled `extracted_line_item_count` |
| Allowed description measures | Aggregate presence/type/empty and approved length buckets only; never content |
| Allowed time meaning | `analyses.created_at` for operational ingestion/persistence windows only, not quote effective date |
| Test rule | Inner join to `leads.is_test IS FALSE`; unresolved lead excluded |
| Identifier use | Internal joins and approved distinct entity counts only; no identifiers in output |
| Historical rule | `UNVERSIONED_UNKNOWN`; restricted quality/pipeline counts only |
| Monetary fields | None; all excluded |
| Opening/quantity/dimension fields | None except array length as extracted line-item count |
| Quote/project/revision/attempt identity | Unsupported and disabled |
| Duplicate/current/supersession rule | Unsupported and disabled |
| Other fact-like application values | Excluded |
| Non-runtime-enforced paths | `NOT_PROFILED_UNBOUND` or `NOT_PROFILED_PII` |
| Sensitive outputs | Raw JSON, source text, descriptions, PII, identifiers, filenames, Storage paths, contractor names, free text, hashes, and snippets prohibited |
| Result class | Aggregate-only, bounded, suppressed, positive output-column allowlist |

## Conditions that remain beyond the database gate

| Condition | Blocks pack generation? | Blocks execution? | Blocks implementation/production use? |
|---|---|---|---|
| Audit 04 operational limits not yet supplied | YES until supplied in a later Audit 04 request | YES | N/A |
| Exact generated SQL not yet human-reviewed | NO, because SQL has not been generated | YES | N/A |
| No separate execution authorization | NO | YES | N/A |
| Test-label completeness not aggregate-validated | NO; pack may generate the bounded QA check | Does not block the QA check if separately authorized | YES for eligibility/market claims |
| Historical version lineage missing | NO because semantic/cross-version use is excluded | NO for restricted quality counts | YES for cross-version intelligence |
| No independent privacy/legal certification | NO for restricted technical pack generation | Human privacy review remains part of SQL review | YES for data reuse, benchmarks, and external/production use |
| No independent security certification | NO for restricted technical pack generation | Human security review of exact SQL/role is required | YES for services, schedules, endpoints, or production deployment |
| Unsupported fact ownership and quote/revision identities | NO because excluded | NO for restricted source | YES for broader intelligence architecture |

## Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Gate implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|
| A03F-001 | CONFIRMED | Founder approved FD-03D-001 through 007 and deferred 008 exactly as recorded | Operator authorization | Current task message | Restricted policy and exclusions explicitly accepted | Founder-decision condition satisfied | High | Preserve exact scope |
| A03F-002 | CONFIRMED | The founder accepts accountable-owner responsibility for the listed policy domains in restricted Phase 0 | Operator authorization | Current task message | Product/data/extraction/finance-exclusion/QA/domain policy accountability recorded | Technical reviews may determine restricted generation readiness | High | Does not substitute for later independent production review |
| A03F-003 | CONFIRMED | The deployed database supports the approved four-relation join chain and lifecycle states | Audit 03C | A03C-005, A03C-006, A03C-016 | Keys, constraints, columns, and states are deployed metadata evidence | Data-platform review conditionally passes | High | Reconfirm target before later execution |
| A03F-004 | CONFIRMED | The deployed scanner contract supports only the restricted subset | Audit 03D | A03D-009–A03D-015 | Response validation is shallow; approved fields match enforced checks | Extraction review passes only without broadening | Very high | Keep all other paths excluded |
| A03F-005 | CONFIRMED | Monetary/opening/dimension semantics remain unbound but are fully excluded by policy | Audits 03D/03E | A03D-011–A03D-015; A03E-005 | No guessed unit or count is needed for restricted pack | Exclusion resolves generation binding, not semantic truth | High | Independent reviews before future admission |
| A03F-006 | CONFIRMED | Quote/revision/attempt/duplicate/current/supersession identities remain unsupported and disabled | Audit 03E | A03E-004; FD-03D-004 | Actual entity labels are preserved | No dependent metric may be generated | High | Future architecture only under separate authorization |
| A03F-007 | CONFIRMED | `leads.is_test` is the only bound test indicator | Audits 03C/03E | A03C-005, A03C-016; A03E-006 | Fail-closed join approved; completeness untested | QA review conditionally passes | High for schema; limited for population quality | Later aggregate validation |
| A03F-008 | CONFIRMED | The reviewed SQL Editor role bypasses RLS | Audit 03C | A03C-015 / `SB-MD-022` | Query text and output restrictions, not RLS, must provide execution safety | Security review conditionally passes for generation only | High | Human review and separate authorization before execution |
| A03F-009 | CONFIRMED | No SQL, database, network, service, build, test, or implementation action occurred | This task | Tool/activity record | Only local evidence reads and this Markdown write occurred | No execution authority consumed | High | None |

## Limitations and retained unknowns

- No application-data distribution, null rate, test prevalence, join coverage, output size, or data quality has been measured.
- Exact historical model, prompt, parser, and extraction-schema versions remain unavailable.
- Exact scanner deployment version/timestamp linkage remains unavailable.
- Active ownership of excluded fact-like tables remains unresolved.
- Quote, revision, immutable attempt, duplicate, current-record, and supersession identities remain unsupported.
- Independent privacy, legal, security, finance, extraction, data-platform, QA, and domain certifications have not occurred.
- The founder-name placeholder remains as supplied; this report is a technical decision record, not a signature verification.

None of these limitations blocks generation of the restricted pack because the affected fields, identities, claims, or actions are excluded. They continue to block broader profiling, execution without review, implementation, and production use as specified above.

## Hard-stop rules carried forward

A future Audit 04 task or manual execution must stop if:

- the target is not exactly `zgsofkgddpcntdvpckdq`;
- the environment, role visibility, schema, constraints, or deployed contract differs from the reviewed evidence;
- a query references an unapproved relation, column, JSON path, function, RPC, or service;
- an operational limit or suppression parameter is missing;
- a query could return row-level data, identifiers, raw JSON, source text, descriptions, PII, filenames, Storage paths, contractor names, or other prohibited content;
- a timeout, permission error, unexpected result shape, full-scan breach, or size-gate failure occurs; or
- anyone attempts to treat SQL generation as execution authorization.

## Conclusion

The founder's conservative approvals and the seven bounded technical reviews close the database-binding gate only for generation of a restricted, read-only, aggregate-only Phase 0 profiling pack. The closure works by freezing a small supported source and disabling every unresolved semantic domain.

**`NEEDS_SCHEMA_BINDING: RESOLVED_FOR_RESTRICTED_PROFILE_GENERATION_ONLY`**

**`GATE_DATABASE: SATISFIED_FOR_RESTRICTED_PROFILE_GENERATION`**

**`AUDIT_04_STATUS: NOT_STARTED`**

**`SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED`**
