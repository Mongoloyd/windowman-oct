# 03E — Semantic Binding Decision Register

## Execution identity

| Field | Value |
|---|---|
| Audit name | Phase 0 supplemental semantic-binding decision register |
| UTC execution time | 2026-08-31T00:14:49Z |
| Execution environment | CODEX, local read-only inspection plus one authorized Markdown artifact write |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status before this artifact | Pre-existing untracked Audit 01–03D artifacts; no tracked-file change reported by `git status --short` |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity actually verified | NO; no network operation was authorized or performed |
| Database environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD`, Supabase branch `forensic_report_v1` |
| Database project identifier | Branch instance ref `zgsofkgddpcntdvpckdq`; dormant parent `wkrcyxcnzhwjtdpmfpaf` remains out of scope |
| PostgreSQL version | 17.6, from operator-executed `SB-MD-001` evidence |
| Production read authorization | Prior operator authorization was metadata-only; no database access was performed for this register |
| Network authorization | No network call performed |
| Applicable governance | `AGENTS.md`; Phase 0 protocol; Audits 03C and 03D |
| `SB-MD-022` / `SB-MD-023` | SUPPLIED AND VALIDATED in Audit 03C |
| Audit status | COMPLETE_WITH_BLOCKERS — recommendations are recorded, but founder and specialist approvals remain outstanding |
| Auditor limitations | No SQL execution, application-row inspection, raw `full_json` inspection, service invocation, test, build, or implementation |

## Purpose and present gate state

This register converts `FD-03D-001` through `FD-03D-008` into explicit founder decisions without broadening the deployed runtime contract established by Audit 03D.

Current state:

- `GATE_CONTRACT: SATISFIED_WITH_RESTRICTED_PROFILEABLE_SUBSET`.
- `NEEDS_SCHEMA_BINDING: UNRESOLVED_PENDING_DECISIONS_AND_SIGN-OFFS`.
- `GATE_DATABASE: NOT SATISFIED`.
- Audit 04 has not started.
- `SB-MD-022` established the SQL Editor role's visibility attributes; `SB-MD-023` established deployed checks, defaults, and enum labels. Neither establishes business semantics.

## Method and evidence boundaries

This register uses only:

1. operator-supplied, successfully executed metadata results validated in Audit 03C;
2. the fingerprinted deployed `scan-quote` archive and runtime-control-flow findings in Audit 03D; and
3. repository source and migrations at commit `7a497a5f1cba752d26ce1721f39d0a8288306a51`.

The evidence domains remain separate:

| Domain | What it can establish | What it cannot establish |
|---|---|---|
| Deployed catalog metadata | Objects, columns, types, constraints, defaults, RLS flags, role visibility, and migration inventory | Business meaning, active writer ownership, or row quality |
| Deployed scanner archive | The downloaded function's runtime extraction, validation, scoring, and persistence behavior | Exact deployment version/time, behavior of unrelated deployed functions, or historical row quality |
| Repository source/migrations | Intended logic, callers visible at the audited commit, and migration intent | Current deployment or actual data population |
| Founder decision | Product policy and accepted exclusions | Technical validation of data quality or hidden deployed behavior |

No object is promoted to analytics authority merely because it exists. No field name is treated as proof of units. Unsupported metrics and cohorts are disabled, not guessed.

## Binding principles that apply to every decision

- Future monetary intelligence facts must use integer USD cents.
- A field is not dollars or cents without evidence beyond its name.
- Arbitrary `full_json` paths are prohibited.
- `lead_id` is not a quote, revision, project, or processing-attempt identity.
- A line-item count is not an opening count.
- Current-record, duplicate, revision, and supersession handling cannot be claimed where the schema has no supporting identity or rule.
- PII, source text, contractor raw names, addresses, filenames, Storage paths, raw JSON, and free-text descriptions are excluded from output and grouping.
- Audit 03D's restricted runtime subset cannot be broadened by founder preference alone; broader use requires later technical evidence and separately authorized review.

---

## FD-03D-001 — Valid extraction and analytics eligibility

### Exact decision required

Approve the exact population rule for records that may enter restricted quality profiling, and decide whether that rule is sufficient for any broader analytics. It is not sufficient for monetary, opening, product, geography, contractor, or market cohorts unless those semantics are independently bound.

### Confirmed relevant fields and evidence

| Field/state | Confirmed fact | Evidence |
|---|---|---|
| `analyses.analysis_status` | Non-null; deployed allowed states are `pending`, `processing`, `complete`, `failed`, `invalid_document`, and `needs_better_upload` | A03C-005, A03C-016 |
| `analyses.scan_session_id` | Unique; one analysis row per scan session | A03C-006 |
| `scan_sessions.status` | Deployed allowed states include `preview_ready`, `awaiting_verification`, and `revealed` after processing | A03C-016 |
| `scan_sessions.quote_file_id` | Unique; one scan session per uploaded quote-file row | A03C-006 |
| `analyses.lead_id` / `leads.id` | Lead linkage exists; lead identity remains distinct from quote identity | A03C-005, A03D-017 |
| `leads.is_test` | Non-null boolean, default `false`; default does not prove classification completeness | A03C-005, A03C-016 |
| `analyses.document_is_window_door_related` | Structured projection of a runtime-enforced `true` on the complete scanner path | A03D-010, A03D-014 |
| `analyses.confidence_score` | Structured projection of runtime-normalized confidence accepted in `[0.4,1]` on the complete path | A03D-010, A03D-014 |
| `analyses.document_type` | Structured projection of a runtime-enforced string; empty string and fallback `unknown` remain possible | A03D-010, A03D-014 |
| `analyses.full_json.extraction.line_items` | Runtime-enforced non-empty array on the complete path; every element is an object with string `description` | A03D-010, A03D-014, A03D-017 |

### Recommended conservative choice

Approve a two-level rule:

1. `eligible_restricted_quality_profile` is true only when the exact candidate predicate below is true.
2. `eligible_semantic_or_market_profile` remains false until the relevant monetary, quantity, identity, test-data, ownership, and historical-version decisions are approved and specialist-reviewed.

### Exact candidate predicate

The following is a binding expression for review, not executable profiling SQL:

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

Required aliases are `a = public.analyses`, `s = public.scan_sessions`, `qf = public.quote_files`, and `l = public.leads`. IDs may be used only for joins and distinct internal counts; they must never appear in output.

This predicate does not certify the meaning of any non-enforced extraction field. It also does not certify that a record represents a unique quote, project, revision, or immutable attempt.

### Why recommended

It uses deployed columns, deployed lifecycle states, the only confirmed test indicator, and Audit 03D's runtime-enforced subset. It excludes terminal classification failures, incomplete lifecycle states, unknown/empty document type, orphaned identity links, and test leads. It avoids relying on `quote_observations.is_stats_eligible` or `wm_quote_facts.approved_for_index`, whose defaults and writer authority do not define an approved population.

### Reasonable alternatives and risks

| Alternative | Risk |
|---|---|
| Admit all `analysis_status='complete'` rows | Includes unknown document types, missing lead/test classification, and rows whose restricted JSON shape cannot be safely assumed |
| Use `quote_observations.is_stats_eligible=true` | Writer ownership and the predicate setting the field are unconfirmed; default `false` is not semantic authority |
| Use `wm_quote_facts.approved_for_index=true` | The active writer/approval workflow and source semantics are not sufficiently bound for authority |
| Block all profiling | Safest but prevents even bounded pipeline-health and enforced-field quality assessment |

### Exact proposed binding or exclusion rule

- Bind the predicate above only to restricted pipeline-health and extraction-shape quality metrics.
- Exclude all rows that fail any predicate term.
- Set monetary, opening, dimension, product, contractor, geography, quote-level, revision, duplicate, and market-cohort eligibility to `DISABLED_UNTIL_BOUND`.
- Do not emit `document_type` raw values; profile only nonblank/unknown/approved-category aggregate states. No category allowlist is approved in this register.

### Approval sufficiency and required review

Founder approval is necessary but not sufficient. Required: data-platform review of joins and population reproducibility; extraction review of complete-path invariants; QA review of lifecycle/test exclusions; privacy/security review of output suppression.

**Approval:** ☐ APPROVE_RECOMMENDATION ☐ APPROVE_WITH_CHANGES ☐ DEFER_UNSUPPORTED

---

## FD-03D-002 — Currency and complete monetary semantics

### Exact decision required

Decide which fields, if any, represent USD money; their unit, basis, treatment of tax/fees/discounts/financing/allowances/optional work, and rounding rule. The decision must not infer units from names.

### Field-by-field semantic manifest

| Field/path | Deployed/source fact | Unit and basis authority | Recommended binding for Phase 0/Audit 04 | Evidence |
|---|---|---|---|---|
| `full_json.extraction.total_quoted_price` | Prompt/TypeScript field can persist, but runtime does not validate its type, currency, completeness, or basis | UNKNOWN | EXCLUDED | A03D-011–A03D-013 |
| `full_json.extraction.deposit_amount` | Same unvalidated extraction behavior | UNKNOWN | EXCLUDED | A03D-011–A03D-013 |
| Tax, fee, discount, financing, allowance, optional-work extraction paths | Prompt-declared values are outside the restricted runtime subset | UNKNOWN | EXCLUDED individually and from reconciliation | A03D-011–A03D-015 |
| `full_json.extraction.line_items[].unit_price` | Runtime type and price basis are not enforced | UNKNOWN | EXCLUDED | A03D-011–A03D-014 |
| `full_json.extraction.line_items[].total_price` | Runtime type, extension rule, and inclusion basis are not enforced | UNKNOWN | EXCLUDED | A03D-011–A03D-014 |
| `wm_quote_facts.quote_amount` | Deployed `numeric`; active scanner event path can project a value, but units and full-price basis are unbound | UNKNOWN | PROVISIONAL; exclude from monetary metrics | A03C-005, A03C-014; A03D-012–A03D-013 |
| `wm_quote_facts.price_per_opening` | Deployed `numeric`; depends on unbound money and opening semantics | UNKNOWN | EXCLUDED | A03C-005, A03C-014 |
| `wm_quote_facts.deposit_percent` | Deployed numeric percentage candidate, not a money field; source validation and denominator are unbound | UNKNOWN | EXCLUDED from financial reconciliation | A03C-005, A03C-014 |
| `quote_observations.contract_total_cents` | Deployed `bigint`; repository name/normalizer intent says cents, but active production writer and source conversion are not proven | COLUMN NAME ONLY; insufficient | EXCLUDED pending writer and transformation proof | A03C-005, A03C-014; repository migration `20260806144716_quote_normalization_layer.sql` |
| `quote_line_items.unit_price_cents` | Deployed `bigint`; source unit, quantity basis, and writer ownership are unbound | COLUMN NAME ONLY; insufficient | EXCLUDED | A03C-005, A03C-014 |
| `quote_line_items.extended_price_cents` | Deployed `bigint`; extension and inclusion rules are unbound | COLUMN NAME ONLY; insufficient | EXCLUDED | A03C-005, A03C-014 |
| `quote_line_items.cents_per_united_inch` | Deployed `bigint`; both monetary and dimensional denominator semantics are unbound | COLUMN NAME ONLY; insufficient | EXCLUDED | A03C-005, A03C-014 |
| `contractor_outcomes.projected_value_cents` / `final_value_cents` | Deployed cents-named fields in a downstream outcome domain | Separate outcome semantics; not quote extraction | Exclude from quote profiling; separate future outcome review required | A03C-005, A03C-014 |
| `contractor_outcomes.sold_currency` | Deployed currency field/default exists | Applies only to the outcome record; default does not prove quote currency | Do not use to impute extraction currency | A03C-005, A03C-016 |
| Deterministic `full_json` financial metrics | Produced from cast extraction fields that were not runtime-validated | Derivation does not cure source ambiguity | EXCLUDED from market/cohort use | A03D-012–A03D-015 |

### Recommended conservative choice

Approve integer USD cents as the only future canonical monetary representation, but approve **no current extracted monetary field for Audit 04 profiling**. Treat every current quote-price, line-price, deposit, tax, fee, discount, financing, allowance, and optional-work metric as unbound until the active writer, source-unit conversion, currency, inclusion basis, and rounding rule are proven.

### Why recommended

The runtime-enforced subset contains no monetary field. `bigint` and a `_cents` suffix establish storage shape, not source correctness. The deployed normalizer's production ownership is unknown, and arbitrary or incorrectly typed extraction values can reach deterministic calculations and persistence.

### Reasonable alternatives and risks

| Alternative | Risk |
|---|---|
| Treat `*_cents bigint` as authoritative cents | Confuses naming intent with active transformation proof and may scale values by 100 incorrectly |
| Treat `wm_quote_facts.quote_amount` as dollars | Unit, currency, tax/fee basis, and optional-work inclusion are unknown |
| Infer USD from South Florida operations | Geography does not prove document currency |
| Profile unvalidated extraction prices only after type guards | Type validity still does not establish unit, basis, or business meaning |

### Exact proposed binding or exclusion rule

- Canonical future intelligence money: signed/unsigned behavior separately specified, stored and calculated as integer USD cents; no floating-point arithmetic.
- Current Audit 04: `MONETARY_PROFILE = DISABLED_UNBOUND_SEMANTICS`.
- No cross-field reconciliation, per-opening price, tax/fee/discount treatment, price cohort, or benchmark calculation.
- A future field may be admitted only after evidence binds source currency, source unit, total/line basis, inclusion/exclusion rules, null/zero semantics, active writer, conversion formula, and rounding.

### Approval sufficiency and required review

Founder approval is sufficient to approve the exclusion and future integer-cent policy, but insufficient to admit a current monetary field. Required before admission: finance/data-owner approval, data-platform verification of writer and conversion, extraction-owner validation, and QA reconciliation tests.

**Approval:** ☐ APPROVE_RECOMMENDATION ☐ APPROVE_WITH_CHANGES ☐ DEFER_UNSUPPORTED

---

## FD-03D-003 — Quantity, opening count, line count, and dimensions

### Exact decision required

Decide which observable represents line count, quantity, physical opening count, and dimensions, including units and aggregation rules. These concepts must remain distinct.

### Field-by-field semantic manifest

| Field/path | Confirmed behavior | Safe meaning | Recommended binding | Evidence |
|---|---|---|---|---|
| `jsonb_array_length(full_json.extraction.line_items)` | Array is runtime-enforced non-empty on complete path | Number of extracted line-item elements only | Bind as `extracted_line_item_count` for aggregate quality buckets | A03D-010, A03D-014 |
| `line_items[].description` | Runtime-enforced string; empty allowed | Description presence/type/empty/approved length bucket only | RESTRICTED; never output content | A03D-010, A03D-014 |
| `line_items[].quantity` | Runtime type and semantics unvalidated | None | EXCLUDED | A03D-011–A03D-014 |
| `wm_quote_facts.opening_count` | Deployed integer candidate; source extraction semantics unbound | None | EXCLUDED | A03C-005, A03C-014 |
| `quote_observations.total_openings` | Deployed integer; production writer and derivation unproven | None | EXCLUDED | A03C-005, A03C-014 |
| `quote_observations.line_item_count` | Deployed integer/default; writer authority unproven | None | EXCLUDED; do not substitute for runtime array length | A03C-005, A03C-016 |
| `quote_observations.product_line_count` / `adder_line_count` | Deployed integer candidates; classification/writer authority unproven | None | EXCLUDED | A03C-005, A03C-014 |
| `quote_line_items.quantity` | Deployed numeric; source and unit semantics unproven | None | EXCLUDED | A03C-005, A03C-014 |
| `line_items[].dimensions` | Unvalidated free-text extraction | None; sensitive source-derived text | EXCLUDED from content and grouping | A03D-011–A03D-015 |
| `quote_line_items.width_inches` / `height_inches` / `united_inches` | Deployed numeric columns; repository normalizer has intended conversion logic, but active writer and source-unit correctness are unproven | None for deployed analytics | EXCLUDED | A03C-005, A03C-014; repository `normalizeAnalysis.ts` |
| `quote_observations.total_united_inches` | Deployed numeric aggregate; denominator and writer authority unproven | None | EXCLUDED | A03C-005, A03C-014 |
| `quote_line_items.line_index` | Unique only with `observation_id` | Ordinal within one normalized observation, not durable opening identity | Internal ordering only if that model is later admitted | A03C-006 |

### Recommended conservative choice

Bind only runtime array length as `extracted_line_item_count`. Do not infer openings, summed quantity, products, units, or dimensions. Disable per-opening, per-unit, united-inch, and opening-level cohort metrics.

### Why recommended

The deployed scanner validates only the array/container and description string. A single line can represent one unit, multiple units, an adder, a discount, tax, labor, or another scope element. Repository normalizer logic is not proof that the deployed rows were produced by that logic or that its source assumptions hold.

### Reasonable alternatives and risks

| Alternative | Risk |
|---|---|
| Array length equals opening count | Systematic over/under-counting where rows are adders, bundles, or multiple quantities |
| Sum `line_items[].quantity` | Runtime accepts missing, strings, invalid numbers, and ambiguous units |
| Trust `total_openings` or `opening_count` by name | Writer and derivation are unbound |
| Parse dimensions during profiling | Broadens the contract, touches source-derived text, and invents unit conversions without proof |

### Exact proposed binding or exclusion rule

- `extracted_line_item_count := jsonb_array_length(full_json.extraction.line_items)` only after FD-03D-001 predicate and JSON type guards.
- `opening_count`, `summed_quantity`, `product_line_count`, `adder_line_count`, `width`, `height`, `united_inches`, and all per-opening/per-dimension calculations: `DISABLED_UNBOUND_SEMANTICS`.
- Array position and `line_index` are not opening identities.
- Description metrics are restricted to presence/type/empty and separately approved length buckets; no text, distinct values, hashes, or tokens.

### Approval sufficiency and required review

Founder approval is sufficient to approve these exclusions and the line-count label. Admission of quantity/opening/dimensions requires extraction-owner, data-platform, domain/estimating, and QA review.

**Approval:** ☐ APPROVE_RECOMMENDATION ☐ APPROVE_WITH_CHANGES ☐ DEFER_UNSUPPORTED

---

## FD-03D-004 — Identity, revision, attempt, duplicate, current record, and supersession

### Exact decision required

Approve the identities that can be used for restricted profiling and explicitly decide how unsupported quote, revision, attempt, duplicate, current-record, and supersession concepts are handled.

### Confirmed identity model

| Concept | Confirmed object/key | Cardinality or lifecycle evidence | Binding decision |
|---|---|---|---|
| Lead identity | `public.leads.id`; referenced by `analyses.lead_id` and `quote_files.lead_id` where present | Business/contact identity; `leads.is_test` resides here | Internal join/test-exclusion identity only; never quote/revision identity |
| Uploaded document identity | `public.quote_files.id` | One scan session per `quote_file_id` is enforced by a unique constraint | Bind as uploaded-document row identity; Storage path remains excluded |
| Scan-session identity | `public.scan_sessions.id` | `scan_sessions.quote_file_id` unique | Bind as processing-session identity |
| Analysis-row identity | `public.analyses.id` | `analyses.scan_session_id` unique; scanner upserts on `scan_session_id` | Bind as mutable analysis-row identity |
| Quote identity | No authoritative deployed quote entity/key established | A lead may have multiple documents; document identity does not prove quote identity | UNSUPPORTED |
| Revision identity | No authoritative revision entity, parent revision, sequence, or effective rule established | No current/revision lineage binding | UNSUPPORTED |
| Immutable processing-attempt identity | No attempt table/key established; scanner upsert overwrites the analysis row for the same scan session | Retry history is not durably separated by the known model | UNSUPPORTED |
| Duplicate identity/fingerprint | No bound document/quote fingerprint or duplicate constraint; `duplicate_suspected` defaults false but does not establish a detector | No authoritative duplicate rule | UNSUPPORTED |
| Current-record rule | One mutable analysis row per session is not the same as one current quote revision | No quote/revision population | UNSUPPORTED |
| Supersession rule | No authoritative supersedes/superseded-by relationship | No lineage | UNSUPPORTED |

Evidence: A03C-005, A03C-006, A03C-014, A03C-016; A03D-012, A03D-017.

### Recommended conservative choice

For restricted Audit 04 quality profiling, use the enforced document → scan session → analysis chain only. Treat each `analyses.id` as one current mutable analysis row for one scan session, not as a unique market quote, revision, or immutable attempt. Disable all project-, quote-, revision-, duplicate-, supersession-, current-quote-, and reprocessing-frequency metrics.

### Why recommended

This matches deployed keys and scanner upsert behavior without inventing identities. It prevents a lead, uploaded file, session, or mutable analysis row from being mislabeled as a quote or revision.

### Reasonable alternatives and risks

| Alternative | Risk |
|---|---|
| Treat `lead_id` as project or quote | Collapses multiple documents/bids and creates false uniqueness |
| Treat `quote_file_id` as quote identity | A file may be a revision, duplicate, non-quote, or multiple-document component |
| Treat `analysis.id` as immutable attempt | Upsert-on-session can overwrite the same row across processing attempts |
| Use `duplicate_suspected=false` as dedupe proof | Default false does not prove a detector ran or that duplicates are absent |
| Choose latest timestamp as current revision | No revision lineage or supersession semantics exist to support the choice |

### Exact proposed binding or exclusion rule

- Allowed internal chain: `leads.id <- analyses.lead_id`; `quote_files.id <- scan_sessions.quote_file_id`; `scan_sessions.id <- analyses.scan_session_id`.
- Output identifiers: none.
- Distinct counts may use `analysis.id`, `scan_session.id`, `quote_file.id`, and `lead.id` internally only, labeled by their actual entity names.
- `quote_id`, `revision_id`, `attempt_id`, duplicate rule, current-record rule, and supersession rule: `UNSUPPORTED_AND_DISABLED`.
- Do not calculate re-analysis frequency, multiple attempts per quote, multiple revisions, leave-one-quote-out cohorts, or project counts.

### Approval sufficiency and required review

Founder approval is sufficient to accept the restricted identity labels and exclusions. Creating or admitting quote/revision/attempt semantics requires future data-platform architecture, migration, scanner lifecycle, QA, and privacy/security review; that work is outside Phase 0.

**Approval:** ☐ APPROVE_RECOMMENDATION ☐ APPROVE_WITH_CHANGES ☐ DEFER_UNSUPPORTED

---

## FD-03D-005 — Test, demo, and internal exclusion

### Exact decision required

Approve the only evidence-supported exclusion predicate and decide how records with no confirmed lead linkage are handled.

### Confirmed relevant fields and evidence

- `public.leads.is_test` is deployed, non-null, and defaults to `false` (A03C-005, A03C-016).
- No other source marker, email pattern, name pattern, campaign string, environment string, or internal-user list is confirmed as an authoritative test indicator.
- A default of `false` does not prove historical or operational classification completeness.

### Recommended conservative choice

Include only records joined to a lead where `leads.is_test IS FALSE`. Exclude `is_test=true` and exclude records without a resolvable lead. Do not invent fallback marker strings.

### Why recommended

It uses the only deployed, bounded indicator and fails closed when classification cannot be established. It does not pretend the indicator has been population-validated.

### Reasonable alternatives and risks

| Alternative | Risk |
|---|---|
| Include missing-lead records as non-test | Bypasses the only confirmed test control |
| Exclude only `is_test=true` but admit unresolved joins | Allows unclassified records into the population |
| Infer test data from names, emails, source, or campaigns | Invents unconfirmed markers and may process PII |
| Block every record until aggregate QA | Strongest protection but prevents restricted profiling |

### Exact proposed binding or exclusion rule

`TEST_EXCLUSION := INNER JOIN public.leads l ON l.id = a.lead_id AND l.is_test IS FALSE`.

No additional marker is authorized. The limitation “test labeling completeness not yet aggregate-validated” must appear in Audit 04 results.

### Approval sufficiency and required review

Founder approval is necessary but not sufficient. QA/data-owner review must confirm the operational process that sets `is_test`, and a later separately authorized aggregate query must measure missing lead linkage and test-flag prevalence without returning rows or identifiers.

**Approval:** ☐ APPROVE_RECOMMENDATION ☐ APPROVE_WITH_CHANGES ☐ DEFER_UNSUPPORTED

---

## FD-03D-006 — Authoritative fact model and production ownership

### Exact decision required

Approve which deployed objects are authoritative for restricted profiling and which remain provisional, dormant, unsupported, or of unknown ownership.

Classification is scoped to Phase 0 analytics authority. It does not rename or alter operational database ownership.

### Object classification

| Object/implementation | Classification | Evidence-based scope and limitation |
|---|---|---|
| `public.analyses` | AUTHORITATIVE | Authoritative operational scanner-result/lifecycle row and structured projections for Audit 03D's restricted subset only. `full_json` as a whole is not authoritative analytics data. |
| `public.wm_quote_facts` | PROVISIONAL | Deployed and written by the audited canonical event path, but monetary/opening proxies, approval semantics, and broad normalized JSON are not fully bound. Not authoritative for Audit 04 facts. |
| `public.quote_observations` | UNKNOWN_OWNERSHIP | Deployed schema exists. Repository `normalizeAnalysis` contains a writer, but the audited production call search found only the helper and tests; no active deployed production caller is proven. |
| `public.quote_line_items` | UNKNOWN_OWNERSHIP | Same normalizer ownership gap; structured columns do not establish active provenance or semantics. |
| `public.normalization_failures` | UNKNOWN_OWNERSHIP | Deployed diagnostic object and repository helper writer exist, but active production caller is unproven; raw excerpts remain prohibited. |
| Repository `_shared/normalizeAnalysis.ts` path | DORMANT | The implementation exists and is tested, but no production caller was found in the audited repository scope and it was not part of the deployed scanner runtime path. This classifies the implementation path, not every possible external writer. |
| `public.wm_quote_reviews` | UNKNOWN_OWNERSHIP | Deployed review object exists; active authoritative review workflow/writer was not established. |
| `public.wm_pricing_index_snapshots` | UNKNOWN_OWNERSHIP | Deployed object exists; no scheduled `cron.job` row existed at metadata execution time, but absence of cron does not exclude manual or unrelated writers. |
| `public.contractor_outcomes` | PROVISIONAL | Separate downstream outcome domain with active repository use, not a substitute for quote extraction facts or verified-sold authority without its own integrity rule. |
| `public.wm_event_log` | PROVISIONAL | Event/audit transport evidence, not an authoritative normalized quote-fact model. |
| `public.lead_events` / `public.event_logs` | PROVISIONAL | Event records are not quote-level analytic fact authority and must not substitute for quote/revision identity. |
| `public.county_benchmarks` | UNSUPPORTED | Confirmed absent from deployed relation metadata. |
| `public.quote_intelligence_facts` | UNSUPPORTED | Confirmed absent from deployed relation metadata. |

Evidence: A03C-004–A03C-007, A03C-010, A03C-013–A03C-016; A03D-004, A03D-012–A03D-015; repository `createCanonicalEvent.ts` writer references and `_shared/normalizeAnalysis.ts`.

### Recommended conservative choice

Use `public.analyses` plus `scan_sessions`, `quote_files`, and `leads` only for the restricted profile population and allowed fields. Do not profile application values from any provisional, dormant, unsupported, or unknown-ownership fact object in the initial Audit 04 pack.

### Why recommended

This is the only source whose deployed scanner persistence and restricted field contract were traced end to end. It keeps normalization schema intent separate from active deployed ownership.

### Reasonable alternatives and risks

| Alternative | Risk |
|---|---|
| Declare `quote_observations` authoritative because it is structured | Object existence and column names do not prove writer, source version, or semantics |
| Declare `wm_quote_facts` authoritative because it is actively written | Active writes can still persist unvalidated proxies and default approval flags |
| Substitute a similar object for absent tables | Violates exact-object evidence and conceals incompatible contracts |
| Use multiple fact objects and reconcile later | Creates silent double counting and unresolved source-of-truth conflicts |

### Exact proposed binding or exclusion rule

- Initial Audit 04 application source allowlist: `analyses`, `scan_sessions`, `quote_files`, `leads` only.
- All other fact-like objects: metadata/preflight inspection only; no application-value profiling until ownership and semantics are separately proven.
- No absent object may be referenced.
- Promotion requires an identified production writer, deployed-call evidence, version/provenance rule, idempotency/identity rule, semantic manifest, and QA evidence.

### Approval sufficiency and required review

Founder approval is sufficient to adopt the conservative source allowlist and exclusions. Promotion of any other object requires data-platform ownership review, extraction/domain review as applicable, security/RLS review, and QA evidence.

**Approval:** ☐ APPROVE_RECOMMENDATION ☐ APPROVE_WITH_CHANGES ☐ DEFER_UNSUPPORTED

---

## FD-03D-007 — Historical unversioned analyses

### Exact decision required

Decide whether analyses lacking persisted model, prompt, extraction-schema, and parser versions may be compared, segmented, excluded, or used only for limited quality counts.

### Confirmed relevant fields and evidence

- The model is environment-overridable; exact active override history is unknown (A03D-007, A03D-016).
- Model, prompt, extraction-schema, and parser versions are not persisted per analysis (A03D-012, A03D-015).
- The prompt, TypeScript contract, and runtime acceptance differ; arbitrary fields can survive (A03D-011–A03D-013).
- No catalog metadata can reconstruct historical runtime versions.

### Recommended conservative choice

Admit historical unversioned analyses only to limited operational and restricted-contract quality counts after the FD-03D-001 predicate. Exclude them from monetary, product, opening, geography, contractor, benchmark, market, and cross-version cohort claims. Do not fabricate version segments.

### Why recommended

It allows assessment of pipeline volume, status, structured-field presence/range, and runtime-enforced array shape without claiming that model-dependent extracted values are comparable over time.

### Reasonable alternatives and risks

| Alternative | Risk |
|---|---|
| Treat all history as one comparable version | Conceals unknown model/prompt/parser changes and can create false trends |
| Segment only by date | Date is not a runtime-version identifier |
| Exclude all historical records from every count | Prevents useful pipeline-health assessment, though it is defensible if reviewers prefer maximum caution |
| Infer version from current deployed source | Retroactively assigns current behavior to unknown historical executions |

### Exact proposed binding or exclusion rule

- Assign an analytical label only: `contract_version_state = 'UNVERSIONED_UNKNOWN'`; do not persist it.
- `restricted_quality_count_eligible = FD-03D-001 predicate`.
- `semantic_cohort_eligible = FALSE`.
- `benchmark_eligible = FALSE`.
- Permitted metrics: aggregate lifecycle counts; presence/range checks for structured restricted fields; guarded line-item array-length and description-shape quality counts.
- Prohibited: trend claims implying model comparability, extracted-value reconciliation, and all market intelligence.

### Approval sufficiency and required review

Founder approval is necessary. Extraction-owner and data-platform review must confirm the historical limitation; QA must approve the exact quality-only measures. No specialist can reconstruct missing version lineage from metadata alone.

**Approval:** ☐ APPROVE_RECOMMENDATION ☐ APPROVE_WITH_CHANGES ☐ DEFER_UNSUPPORTED

---

## FD-03D-008 — Non-runtime-enforced extraction fields

### Exact decision required

Decide whether a non-runtime-enforced extraction field may ever be profiled after a separately authorized quality study.

### Confirmed relevant fields and evidence

- Zod validates the HTTP request, not the Gemini response (A03D-009).
- Runtime response validation is shallow; unknown and incorrectly typed fields survive to `full_json.extraction` (A03D-010–A03D-013).
- Audit 03D classified every extraction path outside the restricted subset as `BLOCKED` or `NO` for profiling (A03D-014, A03D-015).

### Recommended conservative choice

`DEFER_UNSUPPORTED`. No non-runtime-enforced extraction path may be included in Audit 04. A future study must be separately authorized per exact path and cannot automatically promote the path to production analytics.

### Why recommended

JSON type guards can measure representation but cannot establish semantic truth, currency, units, provenance, privacy safety, or stable versioned behavior. Profiling arbitrary paths would broaden the contract that Audit 03D explicitly restricted.

### Reasonable alternatives and risks

| Alternative | Risk |
|---|---|
| Allow presence/type counts for every prompt field | Becomes arbitrary `full_json` mining and may touch sensitive/free-text values |
| Allow paths after founder approval alone | Product approval cannot create missing runtime enforcement or privacy evidence |
| Allow a single exact path after separate study | Potentially reasonable later, but still requires path-specific extraction, privacy, semantics, QA, and version evidence |

### Exact proposed binding or exclusion rule

- Initial Audit 04: every non-runtime-enforced path is `NOT_PROFILED_UNBOUND` or `NOT_PROFILED_PII` as appropriate.
- No wildcard traversal, key enumeration, raw value output, distinct text, hashes, snippets, or inferred casts.
- A later path-specific study must bind exact JSON path, runtime types, missing/null/empty/false/zero semantics, sensitivity class, version scope, source evidence, allowed aggregate, suppression, and promotion criteria.
- Study success would authorize a new decision review, not automatic inclusion.

### Approval sufficiency and required review

Founder approval is sufficient to keep the exclusion. Any future exception requires extraction, privacy, security, data-platform, and QA approval; finance review is additionally required for monetary paths.

**Approval:** ☐ APPROVE_RECOMMENDATION ☐ APPROVE_WITH_CHANGES ☐ DEFER_UNSUPPORTED

---

## Specialist-review register

| Review ID | Specialist | Decisions | Required determination | Current status |
|---|---|---|---|---|
| SR-03E-001 | Data platform owner | 001, 004, 006, 007, 008 | Reproducible joins, source ownership, identity labels, historical scope, and exact restricted allowlist | REQUIRED / NOT_RECORDED |
| SR-03E-002 | Extraction owner | 001, 003, 007, 008 | Complete-path invariants, line-count label, historical comparability, and no contract broadening | REQUIRED / NOT_RECORDED |
| SR-03E-003 | Finance/data owner | 002 | Approve integer USD-cent policy and exclusion of all currently unbound monetary fields | REQUIRED / NOT_RECORDED |
| SR-03E-004 | QA/data quality | 001, 003, 005, 007 | Lifecycle predicate, test-flag process, missing-link behavior, and quality-only metrics | REQUIRED / NOT_RECORDED |
| SR-03E-005 | Privacy | 001, 005, 008 | PII/free-text exclusions, safe description metrics, and future path-study conditions | REQUIRED / NOT_RECORDED |
| SR-03E-006 | Security | 001, 006, 008 | Role/RLS visibility assumptions, output restrictions, source allowlist, and no raw JSON exposure | REQUIRED / NOT_RECORDED |
| SR-03E-007 | Domain/estimating | 003 | Confirm that no current line/quantity/opening/dimension equivalence is authorized | REQUIRED / NOT_RECORDED |

## Exact conditions for resolving `NEEDS_SCHEMA_BINDING`

`NEEDS_SCHEMA_BINDING` is resolved for a **restricted profiling pack only** when all conditions below are recorded:

1. Founder selects one approval state for every `FD-03D-001` through `FD-03D-008`.
2. Any `APPROVE_WITH_CHANGES` response supplies exact replacement wording without expanding Audit 03D's runtime subset.
3. The FD-03D-001 quality-population predicate is approved by founder, data platform, extraction, QA, privacy, and security reviewers.
4. FD-03D-002 is approved as either a fully proven field-level monetary manifest or, as recommended here, a binding exclusion of all current monetary profiling.
5. FD-03D-003 is approved as either proven field-level count/unit semantics or, as recommended, line-array-length quality metrics only with all opening/quantity/dimension metrics disabled.
6. FD-03D-004 acknowledges that quote, revision, immutable attempt, duplicate, current-record, and supersession identities are unsupported and disables dependent metrics.
7. FD-03D-005 adopts the exact `leads.is_test IS FALSE` fail-closed predicate and records the QA limitation.
8. FD-03D-006 approves `analyses` as the sole authoritative restricted source and excludes values from provisional/dormant/unsupported/unknown-ownership fact objects.
9. FD-03D-007 approves quality-count-only use of unversioned history or a stricter exclusion.
10. FD-03D-008 remains `DEFER_UNSUPPORTED` for every non-runtime-enforced path.
11. Required specialist approvals in `SR-03E-001` through `SR-03E-007` are recorded.
12. The target remains branch ref `zgsofkgddpcntdvpckdq`, the execution role visibility remains equivalent to validated `SB-MD-022`, and no later deployment/schema evidence conflicts with 03C/03D.

No additional catalog SQL is presently identified as capable of resolving these business-semantic decisions. `SB-MD-022` and `SB-MD-023` are complete and not pending.

## Exact conditions for satisfying `GATE_DATABASE`

`GATE_DATABASE` may be marked `SATISFIED_FOR_RESTRICTED_PROFILE_GENERATION` only after:

- all `NEEDS_SCHEMA_BINDING` conditions above are met;
- the exact Audit 04 binding manifest is frozen to the restricted table/field/path allowlist below;
- unsupported monetary, opening, quantity, dimension, quote, revision, duplicate, supersession, current-record, project, contractor-name, and market-cohort metrics are explicitly disabled;
- PII, free text, raw JSON, filenames, Storage paths, and identifiers are prohibited from output;
- the later Audit 04 operator supplies date scope, timeouts, scan/output limits, suppression threshold, authorization, and human SQL review;
- preflight relation-size/index evidence does not exceed those later limits; and
- no environment, role, schema, migration, or deployed-function mismatch is observed.

Because founder and specialist responses are not yet recorded, this report does **not** satisfy `GATE_DATABASE`.

## Exact restricted bindings proposed for Audit 04 handoff

These are proposed bindings, not authorization to generate or execute Audit 04 SQL.

| Audit 04 input | Restricted bound value | Status now | Safe for initial application-data profiling after approvals? |
|---|---|---|---|
| Environment | WMProd branch `forensic_report_v1`, ref `zgsofkgddpcntdvpckdq`; parent ref excluded | CONFIRMED_OPERATOR_AND_METADATA_EVIDENCE | YES |
| PostgreSQL / role visibility | PostgreSQL 17.6; reviewed SQL Editor evidence used role `postgres`, non-superuser, `BYPASSRLS=true` | CONFIRMED_DEPLOYED_OPERATOR_EVIDENCE | YES only with equivalent role and authorization |
| Authoritative application relations | `public.analyses`, `public.scan_sessions`, `public.quote_files`, `public.leads` | PROPOSED_PENDING_APPROVAL | YES |
| Join chain | `analyses.scan_session_id -> scan_sessions.id`; `scan_sessions.quote_file_id -> quote_files.id`; `analyses.lead_id -> leads.id` | CONFIRMED_DEPLOYED_KEYS; semantic use pending approval | YES internally only |
| Restricted population | Exact FD-03D-001 predicate | PROPOSED_PENDING_APPROVAL | YES for quality profiling only |
| Analysis statuses | `pending`, `processing`, `complete`, `failed`, `invalid_document`, `needs_better_upload` | CONFIRMED_DEPLOYED | YES for aggregate pipeline health |
| Scan-session statuses | `idle`, `uploading`, `processing`, `preview_ready`, `awaiting_verification`, `revealed`, `invalid_document`, `needs_better_upload` | CONFIRMED_DEPLOYED | YES for aggregate pipeline health |
| Test exclusion | Joined `leads.is_test IS FALSE`; unresolved lead excluded | PROPOSED_PENDING_APPROVAL/QA | YES after approval |
| Structured restricted fields | `analyses.analysis_status`, `document_is_window_door_related`, `confidence_score`, `document_type` | CONFIRMED_RESTRICTED | YES for presence/range/approved-state aggregates; no raw unexpected labels |
| Restricted JSON root/path | `analyses.full_json.extraction.line_items[]` and `line_items[].description` | CONFIRMED_RESTRICTED | YES only with parent-first JSON type guards; array-count and description-shape metrics only |
| Historical versions | Label analytically as unversioned/unknown; no imputation | CONFIRMED_GAP; rule pending approval | Quality counts only |
| Monetary fields | None | UNBOUND / EXCLUDED | NO |
| Quantity/opening/dimensions | Array element count only, labeled `extracted_line_item_count`; all others excluded | PROPOSED_PENDING_APPROVAL | Restricted count only |
| Quote/project/revision/attempt identity | None; actual document/session/analysis/lead identities retain their exact labels | UNSUPPORTED | NO for quote/project/revision/attempt metrics |
| Duplicate/current/supersession rule | None | UNSUPPORTED | NO |
| Fact-model values outside `analyses` | Excluded; metadata-only preflight permitted | UNKNOWN/PROVISIONAL/DORMANT/UNSUPPORTED | NO |
| PII and sensitive exclusions | Names, addresses, phones, emails, contractor raw names, descriptions/content, filenames, Storage paths, IDs in output, raw JSON/source text | CONFIRMED POLICY | NO |
| Non-runtime-enforced extraction fields | All excluded | BLOCKED | NO |
| Document type categories | No raw/distinct output; no category allowlist approved here | UNBOUND | Presence/unknown quality counts only |
| Date field | `analyses.created_at` may bound operational date windows; it is persistence time, not quote effective date | REPOSITORY/DEPLOYED COLUMN EVIDENCE; semantics limited | YES for ingestion volume only after date-scope approval |
| Relation size/index inputs | Catalog estimates and indexes from `SB-MD-007`/`008`; estimates are not exact counts | CONFIRMED_DEPLOYED_METADATA | Preflight planning only |

## Founder response template

Copy, complete, and return this block:

```text
FD-03D-001: APPROVE_RECOMMENDATION | APPROVE_WITH_CHANGES: ... | DEFER_UNSUPPORTED
FD-03D-002: APPROVE_RECOMMENDATION | APPROVE_WITH_CHANGES: ... | DEFER_UNSUPPORTED
FD-03D-003: APPROVE_RECOMMENDATION | APPROVE_WITH_CHANGES: ... | DEFER_UNSUPPORTED
FD-03D-004: APPROVE_RECOMMENDATION | APPROVE_WITH_CHANGES: ... | DEFER_UNSUPPORTED
FD-03D-005: APPROVE_RECOMMENDATION | APPROVE_WITH_CHANGES: ... | DEFER_UNSUPPORTED
FD-03D-006: APPROVE_RECOMMENDATION | APPROVE_WITH_CHANGES: ... | DEFER_UNSUPPORTED
FD-03D-007: APPROVE_RECOMMENDATION | APPROVE_WITH_CHANGES: ... | DEFER_UNSUPPORTED
FD-03D-008: APPROVE_RECOMMENDATION | APPROVE_WITH_CHANGES: ... | DEFER_UNSUPPORTED

Founder name/role:
UTC decision time:
Specialist reviews attached: YES / NO
```

## Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Build implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|
| A03E-001 | CONFIRMED | Audits 03C and 03D describe the same audited repository SHA and target branch instance | Audit artifacts | 03C execution identity; 03D execution identity | Repository SHA `7a497a5f…`; target ref `zgsofkgddpcntdvpckdq` | Decision register can reconcile their evidence domains | High | Retain target verification before later execution |
| A03E-002 | CONFIRMED | `SB-MD-022` and `SB-MD-023` are supplied and validated | Audit 03C | A03C-015, A03C-016 | Role visibility and deployed domains/defaults resolved | They are not pending; no repeat catalog query is needed for them | High | Use equivalent role for later approved SQL |
| A03E-003 | CONFIRMED | Scanner complete-path authority is limited to the restricted subset | Audit 03D | A03D-009–A03D-015 | Shallow gate only; arbitrary fields survive | Audit 04 must not profile broader extraction paths | Very high | Preserve exclusions |
| A03E-004 | CONFIRMED | Deployed identity keys support document/session/analysis joins but not quote/revision/attempt lineage | Audit 03C and scanner persistence | A03C-005, A03C-006; A03D-012, A03D-017 | Unique session/file and analysis/session constraints; upsert on session | Dependent cohort and duplicate metrics disabled | High | Future architecture only after separate approval |
| A03E-005 | CONFIRMED | Monetary and physical-unit semantics are not established by deployed metadata or runtime validation | Audits 03C/03D | A03C-014; A03D-011–A03D-015 | Names/types exist; runtime semantics do not | Monetary/opening/dimension profiles disabled | High | Finance/extraction/data-platform decision |
| A03E-006 | CONFIRMED | `leads.is_test` is the only confirmed test indicator | Audit 03C | A03C-005, A03C-016 | Non-null, default false; completeness untested | Fail-closed join proposed | High for schema, medium for operational completeness | QA aggregate validation later |
| A03E-007 | INFERRED | `analyses` is the only safe initial application-value source | End-to-end scanner trace plus object ownership evidence | A03D-012–A03D-015; A03C-014 | Other fact objects are provisional, dormant, unsupported, or unknown ownership | Restrict Audit 04 source allowlist | High | Founder/data-platform approval |
| A03E-008 | CONFIRMED | Repository normalizer has no production caller in the audited source scope | Current committed source | SHA `7a497a5f…`, `_shared/normalizeAnalysis.ts`; tests; repository-wide production caller search | Helper writes observation objects, but only tests invoke it in visible source | Do not assign deployed authority to normalization tables | High for repository scope; unknown for external/deployed unrelated writers | Deployed writer provenance if promotion is proposed |
| A03E-009 | CONFIRMED | No SQL, row inspection, raw JSON inspection, service invocation, or implementation occurred | This task execution | Tool/activity log | Read-only inspection plus this Markdown write only | Phase 0 safety preserved | High | None |

## Contradictions, unknowns, blockers, and hard stops

### Contradictions retained

- `county_benchmarks` and `quote_intelligence_facts` are absent; similar objects do not confirm them.
- Prompt/TypeScript field declarations do not equal runtime-enforced extraction fields.
- Structured `_cents`/dimension columns do not by themselves confirm active writer ownership or semantics.

### Remaining unknowns

- Exact historical model, prompt, parser, and extraction-schema versions.
- Exact deployment version/timestamp linkage for the downloaded scanner archive.
- Operational completeness of `leads.is_test`.
- Active ownership and provenance for observation/review/snapshot objects outside the audited scanner path.
- Any quote, revision, immutable attempt, duplicate, current-record, or supersession identity.

### Build blockers

| Blocker ID | Severity | Finding | Resolution evidence |
|---|---|---|---|
| B-03E-001 | High | Founder decisions are not yet recorded | Completed founder response template |
| B-03E-002 | High | Specialist sign-offs are not yet recorded | Completed SR-03E register |
| B-03E-003 | High | Monetary/opening/dimension semantics are unbound | Accept binding exclusions or provide proven field manifests |
| B-03E-004 | High | Quote/revision/attempt/duplicate/current/supersession identities are unsupported | Keep dependent metrics disabled; future architecture is separate work |
| B-03E-005 | High | Historical semantic comparability is unsupported | Approve quality-count-only rule or stricter exclusion |
| B-03E-006 | High | Non-runtime-enforced extraction fields remain unsafe | Keep `DEFER_UNSUPPORTED` |

### Hard stops

No new execution hard stop was encountered. Audit 04 remains intentionally paused. A later action must stop if the target ref, role visibility, schema, deployed contract, authorization, or approved binding manifest differs from this evidence packet.

## Conclusion

The technical extraction contract is sufficient only for a restricted quality-profile population. This register recommends using `analyses` and its document/session/lead chain for pipeline health and the small runtime-enforced subset, while disabling monetary, opening, dimension, quote/revision, duplicate, current-record, supersession, and broader fact-model profiling.

`NEEDS_SCHEMA_BINDING` remains unresolved until founder selections and required specialist reviews are recorded. Consequently:

**`GATE_DATABASE: NOT SATISFIED`**

**Audit 04 remains paused.**
