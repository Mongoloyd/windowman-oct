# Audit 04O — Fresh Application Execution Results Closeout

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 04O — Fresh Application Execution Results Closeout |
| UTC execution time | 2026-08-31T06:16:41Z |
| Execution environment | CODEX; local read-only repository inspection plus one authorized Markdown artifact write |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Git common directory | `.git` |
| Checkout type | Canonical local checkout |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status | Dirty before this audit; pre-existing tracked and untracked changes were preserved |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity actually verified | NO |
| Database environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD` |
| Database project identifier | Supabase branch ref `zgsofkgddpcntdvpckdq` |
| PostgreSQL version | `17.6`, from operator-executed A04-PF-001 evidence |
| Production read authorization | Operator manual execution was authorized for the completed fresh sequence; authorization is now consumed |
| Network authorization | No network access used by the audit agent |
| Applicable governance instructions | Repository `AGENTS.md`; Audit 00 protocol; Audits 04F, 04G, 04K, 04L, 04M, and 04N |
| Audit status | COMPLETE_WITH_BLOCKERS |
| Auditor limitations | The audit agent did not access Supabase, execute SQL, inspect application rows, or independently observe the SQL Editor session. Execution facts are operator-supplied evidence. |

## 2. Authoritative inputs and hashes

All six inputs existed and were hashed locally before this artifact was created.

| Input | SHA-256 | Role | Verification |
|---|---|---|---|
| `docs/audits/04F_DIRECT_JSON_GUARD_CORRECTED_QUERY_PACK.md` | `60A894F2D86F763367D5FA06045DFBAA345D0223488ADEF53C501797D7F7A237` | Exact SQL authority | MATCHED frozen identity |
| `docs/audits/04G_DIRECT_JSON_GUARD_PACK_INDEPENDENT_REVIEW.md` | `9CFB42B3AD8E387C809AC87D47F6F83B511D18C98227C3F8EB80DEC38682191C` | Independent technical and privacy review | PRESENT and unchanged at closeout entry |
| `docs/audits/04K_BOUNDED_FULL_SCAN_EXCEPTION_AND_PREFLIGHT_CLOSEOUT.md` | `155B574B0F1AE1DDC0D7AEF56590B326283F2B3DDBB45847915BEB5EE04944FD` | Metadata-preflight closeout and one-run exception | MATCHED recorded identity |
| `docs/audits/04L_APPLICATION_EXECUTION_PLAN_AND_QUIESCENCE_ATTESTATION.md` | `A035FC598DA19948D99C55ACEDA67D1031BD5C5C9EA392CEBC34C588E078DEFF` | Execution controls and attestation design | PRESENT and unchanged at closeout entry |
| `docs/audits/04M_QUIESCENCE_ATTESTATION_AND_APPLICATION_EXECUTION_AUTHORIZATION.md` | `A4A1BC1151C5C285CAA02054110EA3C5E140F19E851C6373658E50B49B7711D5` | Earlier authorization record and invalidated-sequence history | PRESENT; not used as result evidence |
| `docs/audits/04N_FRESH_APPLICATION_SEQUENCE_REAUTHORIZATION.md` | `108FDFEE4F9C469C35AA60EA54961F2CB326F5E958C2951EB723DAD79EF9E831` | Authority for the fresh sequence | PRESENT and unchanged at closeout entry |

Audit 04G records 16 `APPROVED_AS_WRITTEN`, zero `REQUIRES_CORRECTION`, and zero `REJECTED`. Audit 04N supersedes the invalidated application run only by authorizing a wholly fresh sequence; it does not rehabilitate or reuse prior results.

## 3. Target and authorization identity

| Binding | Closed value |
|---|---|
| Supabase project display | `WMProd` |
| Target branch | `forensic_report_v1` |
| Target branch ref | `zgsofkgddpcntdvpckdq` |
| Prohibited parent ref | `wkrcyxcnzhwjtdpmfpaf` |
| Database | `postgres` |
| Execution role | `postgres`; non-superuser; `BYPASSRLS=true` |
| PostgreSQL version | `17.6` |
| Exact query set | `A04-PR-001` through `A04-PR-010` from Audit 04F |
| Source allowlist | `public.analyses`, `public.scan_sessions`, `public.quote_files`, `public.leads` |
| Operational date field | `public.analyses.created_at` |
| Date interval | `2026-01-01T00:00:00Z` inclusive through `2026-08-31T00:35:24Z` exclusive |
| Date meaning | Analysis-persistence interval only |
| Fresh authorization window | `2026-08-31T05:42:26Z` inclusive through `2026-08-31T06:42:26Z` exclusive |
| Execution mode | Operator manual execution, one query at a time, exact order, one stable SQL Editor session |
| Quiescence basis | Contemporaneous operator attestation; not a database-enforced snapshot |
| Current application authorization | Consumed; no further SQL is authorized |

The operator attested for every fresh query that the target was visually confirmed, the prohibited parent was not selected, exact Audit 04F SQL was used without edits, execution occurred once between the supplied timestamps, no batching or retry occurred, SQL Editor status was `SUCCESS`, duration was `NOT DISPLAYED`, no unexpected or sensitive output appeared, and no relevant write, session change, or interruption was observed.

The pre-execution and post-execution timestamps bound the operator workflow. They are not represented as database query durations.

## 4. Preflight closeout summary

| Query ID | Purpose | Closed status | Material result | Limitation |
|---|---|---|---|---|
| A04-PF-001 | Database, version, and role identity | PASS | `postgres`; PostgreSQL 17.6; non-superuser; role inheritance and `BYPASSRLS=true` | Operator-supplied execution evidence |
| A04-PF-002 | Four-table presence, kind, and RLS state | PASS | Four required `public` tables present; RLS enabled; forced RLS false | Does not prove value quality or row visibility |
| A04-PF-003 | Required columns, types, and nullability | PASS | All 15 frozen bindings matched | Deployed metadata only |
| A04-PF-004 | Required constraints | PASS | All eight frozen constraint bindings matched | Does not prove date-index support |
| A04-PF-005 | Index inventory and date-index evidence | HARD_STOP_ACCEPTED_FOR_ONE_BOUNDED_REVIEW | Required PK and unique indexes valid and ready; no simple `public.analyses.created_at` index | PF-005 is not PASS; exception is consumed and non-recurring |
| A04-PF-006 | Catalog row estimates and relation sizes | PASS | Estimates nonnegative and under limits; combined source bytes `5,750,784` | Catalog estimates are approximate and proved stale or incomplete for `analyses` |

## 5. Fresh execution-window record

| Control | Observation | Status |
|---|---|---|
| Window start | `2026-08-31T05:42:26Z` inclusive | CONFIRMED |
| First fresh pre-execution timestamp | `2026-08-31T05:45:27Z` | IN_WINDOW |
| Last fresh post-execution timestamp | `2026-08-31T06:11:34Z` | IN_WINDOW |
| Window end | `2026-08-31T06:42:26Z` exclusive | CONFIRMED |
| Query order | A04-PR-001 through A04-PR-010 in exact numeric order | CONFIRMED |
| Execution count | Once per query | OPERATOR_ATTESTED |
| Edits, batching, retries, skips, duplicates | None | OPERATOR_ATTESTED |
| SQL Editor status | `SUCCESS` for every query | OPERATOR_ATTESTED |
| Displayed query duration | `NOT DISPLAYED` for every query | LIMITATION |
| Known write, session change, or interruption | None observed | OPERATOR_ATTESTED |
| Unexpected or sensitive output | None observed | OPERATOR_ATTESTED |
| Cross-query snapshot | Not database-enforced | LIMITATION |

## 6. Fresh query-by-query execution ledger

| Query ID | Pre-execution UTC | Post-execution UTC | Expected output shape | Observed rows | Validation | Result class |
|---|---|---|---|---:|---|---|
| A04-PR-001 | `2026-08-31T05:45:27Z` | `2026-08-31T05:46:44Z` | Four unsegmented operational counts | 1 | PASS | AGGREGATE_RELEASED |
| A04-PR-002 | `2026-08-31T05:47:41Z` | `2026-08-31T05:50:08Z` | Fixed distribution or one suppressed control | 1 | PASS | SUPPRESSED |
| A04-PR-003 | `2026-08-31T05:51:31Z` | `2026-08-31T05:52:55Z` | Fixed distribution or one suppressed control | 1 | PASS | SUPPRESSED |
| A04-PR-004 | `2026-08-31T05:54:23Z` | `2026-08-31T05:55:24Z` | Fixed exclusion funnel or one suppressed control | 1 | PASS | SUPPRESSED |
| A04-PR-005 | `2026-08-31T05:56:41Z` | `2026-08-31T05:57:39Z` | Aggregate entity counts or one suppressed control | 1 | PASS | SUPPRESSED |
| A04-PR-006 | `2026-08-31T05:58:52Z` | `2026-08-31T05:59:53Z` | Fixed confidence distribution or one suppressed control | 1 | PASS | SUPPRESSED |
| A04-PR-007 | `2026-08-31T06:01:02Z` | `2026-08-31T06:02:23Z` | Fixed validity distribution or one suppressed control | 1 | PASS | SUPPRESSED |
| A04-PR-008 | `2026-08-31T06:04:30Z` | `2026-08-31T06:05:29Z` | Fixed line-item-array distribution or one suppressed control | 1 | PASS | SUPPRESSED |
| A04-PR-009 | `2026-08-31T06:06:44Z` | `2026-08-31T06:07:40Z` | Fixed description-shape distribution or one suppressed control | 1 | PASS | SUPPRESSED |
| A04-PR-010 | `2026-08-31T06:09:43Z` | `2026-08-31T06:11:34Z` | Fixed description-length distribution, one suppressed control, or successful empty | 1 | PASS | SUPPRESSED |

All timestamps are ordered, lie inside the Audit 04N authorization window, and describe one uninterrupted fresh sequence according to the operator attestations. The ledger does not incorporate any execution from the invalidated prior sequence.

## 7. Sanitized aggregate results

| Query ID | Permitted aggregate result | Conservative interpretation |
|---|---|---|
| A04-PR-001 | `mutable_analysis_row_count=31`; `scan_session_count=31`; `uploaded_document_count=31`; `lead_count=28` | Operational source-identity counts for the frozen `analyses.created_at` persistence interval only |
| A04-PR-002 | `distribution_suppressed=true`; threshold `5`; state and count `NULL` | Analysis-status distribution was not released |
| A04-PR-003 | `distribution_suppressed=true`; threshold `5`; state and count `NULL` | Scan-session-status distribution was not released |
| A04-PR-004 | `distribution_suppressed=true`; threshold `5`; state and count `NULL` | Exclusion-funnel distribution was not released |
| A04-PR-005 | `distribution_suppressed=true`; threshold `5`; all four permitted entity metrics `NULL` | Restricted-population entity totals were not released |
| A04-PR-006 | `distribution_suppressed=true`; threshold `5`; state and count `NULL` | Confidence-state distribution was not released |
| A04-PR-007 | `distribution_suppressed=true`; threshold `5`; state and count `NULL` | Document-type-validity distribution was not released |
| A04-PR-008 | `distribution_suppressed=true`; threshold `5`; state and count `NULL` | Line-item-array-state distribution was not released |
| A04-PR-009 | `distribution_suppressed=true`; threshold `5`; state and count `NULL` | Description-shape distribution was not released |
| A04-PR-010 | `distribution_suppressed=true`; threshold `5`; state and count `NULL` | Description-length distribution was not released |

A04-PR-001 confirms only four operational counts within the frozen persistence interval. The terms mean 31 mutable analysis rows, 31 scan sessions, 31 uploaded documents, and 28 leads. They do not establish quote, project, revision, duplicate, immutable attempt, monetary, opening, product, contractor, geography, market, or benchmark semantics.

## 8. Suppression register

| Register ID | Queries | Observation | Permitted conclusion | Prohibited inference |
|---|---|---|---|---|
| A04O-SUP-001 | A04-PR-002–A04-PR-010 | Each returned exactly one suppression control with threshold 5 and all dimension/metric outputs `NULL` | The coordinated disclosure gate prohibited distribution release | Which bucket or complement triggered suppression |
| A04O-SUP-002 | A04-PR-002–A04-PR-010 | No segmented label or count was released | Privacy control behaved according to the reviewed output contract | Any hidden count, minimum count, number of small buckets, or total |
| A04O-SUP-003 | A04-PR-009–A04-PR-010 | Shape and length outputs were both suppressed | No description-derived distribution is available | Description content, shape mix, length mix, or category inference |
| A04O-SUP-004 | Entire packet | A04-PR-001 is the only released non-null application aggregate | Only the four operational counts may be reported numerically | Reconstructing suppressed values by difference or overlap |

Suppression proves only that the reviewed gate prevented release. It does not identify a suppressed bucket, count, distribution, failure stage, confidence mix, document-type mix, line-item distribution, description shape, or description length.

## 9. Invalidated-sequence exclusion

The application sequence preceding Audit 04N was procedurally invalidated. No result from that sequence appears in sections 6–8, contributes to any aggregate, supports any conclusion, or is combined with the fresh sequence. Audit 04M is retained only as historical authorization lineage. This closeout uses only the fresh operator records whose timestamps begin at `2026-08-31T05:45:27Z` and end at `2026-08-31T06:11:34Z`.

## 10. Catalog-estimate discrepancy and limitations

A04-PF-006 reported an approximate `public.analyses` catalog estimate of 18 rows. A04-PR-001 later returned an exact date-window operational count of 31 mutable analysis rows. The catalog estimate was therefore stale or incomplete for comparison with the executed population. This is not classified as an application-query failure because catalog estimates are approximate, the discrepancy does not alter the frozen query contract, and both 18 and 31 remain far below the approved 10,000-row ceiling.

The comparison does not prove why the estimate differed. It may not be used to infer write timing, production activity, table growth rate, planner behavior, or exact rows outside the frozen date interval.

Additional limitations:

- PF-005 remains non-PASS because no simple supporting index on `public.analyses.created_at` was present.
- The one-time bounded full-scan exception is consumed and cannot support recurring, scheduled, retried, edited, or materially larger profiling.
- Runtime duration was not displayed; the pre/post operator timestamps are not query durations.
- The ten queries ran in separate read-only transactions. Operator-attested quiescence is not a database-enforced snapshot.
- The execution evidence was supplied by the operator and was not independently observed by the audit agent.
- Historical unversioned analyses remain restricted to approved pipeline-health and quality evidence.
- Semantic and market-profile eligibility remains false.

## 11. Privacy and sensitive-output confirmation

The supplied results contain only the four approved unsegmented operational counts and nine suppression-control rows. They contain no customer record, source-document text, protected payload content, description content, individual identifier, sample identifier, stable hash, homeowner information, contractor name, filename, Storage path, price, monetary value, or free-text value.

The `BYPASSRLS=true` execution role means output safety depended on the exact reviewed SQL, source allowlist, positive output-column allowlists, suppression logic, timeouts, manual review, and operator controls—not on RLS visibility.

## 12. Prohibited interpretations

This packet does not support claims about:

- quote, project, revision, duplicate, immutable-attempt, current-record, or supersession identity;
- prices, cents, totals, taxes, fees, discounts, financing, allowances, optional work, or market value;
- opening count, quantity, dimensions, united inches, products, or per-opening calculations;
- contractors, manufacturers, geography, campaigns, outcomes, cohorts, markets, or benchmarks;
- extraction accuracy beyond the narrow runtime-enforced quality subset;
- the contents or frequency of any suppressed state;
- representativeness, selection bias resolution, production-wide quality, or historical comparability;
- a stable recurring profiling cost or production-safe recurring access path.

Unsupported metrics and cohorts remain disabled. No arbitrary extraction path is promoted to a deployed semantic binding.

## 13. Remaining blockers

| Blocker ID | Severity | Finding | Behavior at risk | Resolution evidence | Owner |
|---|---|---|---|---|---|
| A04O-B-001 | HIGH | No simple `public.analyses.created_at` index; PF-005 remains non-PASS | Recurring or materially larger profiling may require unbounded work | Separate implementation plan, migration review, deployment authorization, and post-deployment evidence | Data platform / founder |
| A04O-B-002 | HIGH | Nine segmented outputs are suppressed | Pipeline-state and restricted quality distributions remain unknown | Additional safe population growth or separately reviewed privacy approach; no weakening of threshold | Founder / privacy / data platform |
| A04O-B-003 | HIGH | Semantic and market-profile eligibility remains false | Monetary, market, cohort, benchmark, opening, and product claims | Future runtime-enforced contracts, canonical units, durable identities, and approved profiling evidence | Founder / extraction / finance / data platform |
| A04O-B-004 | MEDIUM | Quiescence was operator-attested, not snapshot-enforced | Cross-query consistency cannot be independently proven | Future separately authorized snapshot-safe design if required | Data platform / security |
| A04O-B-005 | MEDIUM | Catalog estimate differed from exact date-window count | Catalog sizing cannot be treated as exact population evidence | Refresh metadata under separate authorization when needed; retain exact/estimate distinction | Data platform |
| A04O-B-006 | HIGH | Audit 05 has not been separately authorized | Premature readiness synthesis could overstate evidence | Founder reviews this closeout and issues separate Audit 05 authorization | Founder |

## 14. Recurring-profile index blocker

`RECURRING_PROFILE_INDEX_REQUIREMENT: OPEN_BUILD_BLOCKER`

The missing date-access index was accepted only for the completed bounded Phase 0 sequence. Before any recurring, scheduled, productionized, retried, materially larger, or broader profiling is considered, a separate implementation plan must evaluate an appropriate migration for the approved access pattern. This audit does not create, approve, or authorize an index or migration.

## 15. Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Build implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|
| A04O-001 | CONFIRMED | Exact Audit 04F identity remained frozen at closeout entry | Current committed/working-tree artifact | `WORKING_TREE`; `docs/audits/04F_DIRECT_JSON_GUARD_CORRECTED_QUERY_PACK.md`; SHA-256 in section 2 | Hash matched `60A894...A237` | The executed SQL authority is identifiable | High | Rehash only if later drift is suspected |
| A04O-002 | CONFIRMED | Audit 04G approved all 16 query packages as written | Repository audit artifact | `WORKING_TREE`; `docs/audits/04G_DIRECT_JSON_GUARD_PACK_INDEPENDENT_REVIEW.md`; approval totals | 16 approved, zero correction, zero rejection | Static technical/privacy review gate was satisfied | High | Preserve exact SQL identity |
| A04O-003 | CONFIRMED | Metadata preflights closed with one bounded PF-005 exception | Repository audit artifact | `WORKING_TREE`; `docs/audits/04K_BOUNDED_FULL_SCAN_EXCEPTION_AND_PREFLIGHT_CLOSEOUT.md`; PF ledger | PF-001–004 and PF-006 PASS; PF-005 remains non-PASS | One-time execution was permitted; recurring profiling is blocked | High | Separate index implementation review before recurring use |
| A04O-004 | CONFIRMED | Audit 04N authorized one wholly fresh sequence | Repository audit artifact | `WORKING_TREE`; `docs/audits/04N_FRESH_APPLICATION_SEQUENCE_REAUTHORIZATION.md`; window and terminal status | Fresh window and exact ten-query order were recorded | Only fresh results are admissible | High | Do not reuse invalidated results |
| A04O-005 | CONFIRMED | All ten fresh executions occurred inside the authorized window in exact order | Operator-supplied execution records | A04-PR-001 through A04-PR-010; section 6 | Ordered timestamps span `05:45:27Z` through `06:11:34Z` | Fresh execution sequence is procedurally complete | High, operator-attested | Founder review of this closeout |
| A04O-006 | CONFIRMED | A04-PR-001 returned four approved operational counts | Operator-supplied aggregate result | A04-PR-001; section 7 | 31 analysis rows, 31 sessions, 31 documents, 28 leads | Limited pipeline-volume evidence is available | High, operator-supplied | Preserve operational-only semantics |
| A04O-007 | CONFIRMED | A04-PR-002 through A04-PR-010 returned valid suppressed controls | Operator-supplied aggregate results | A04-PR-002 through A04-PR-010; sections 7–8 | Each returned one `true`/5/NULL control row | No segmented quality distribution may be inferred | High, operator-supplied | Retain suppression restrictions |
| A04O-008 | CONFIRMED | No invalidated result was used in this closeout | Current artifact construction ledger | Sections 6–9 | Only Audit 04N fresh timestamps and supplied results are recorded | Evidence packet is not contaminated by the invalid run | High | Keep prior sequence historical only |
| A04O-009 | CONFIRMED | PF-006 estimate and PR-001 exact count differ | Operator-supplied metadata and aggregate evidence | PF-006 estimate 18; A04-PR-001 count 31 | Catalog estimate is stale or incomplete for this comparison | Sizing estimates must not be treated as exact | High | Preserve discrepancy in Audit 05 handoff |
| A04O-010 | CONFIRMED | Privacy controls withheld all segmented results | Operator-supplied aggregate results | Sections 7–8 | Nine distributions were suppressed without labels or counts | Privacy boundary was preserved; quality findings remain limited | High | Do not reconstruct or weaken suppression |
| A04O-011 | CONFIRMED | Application authorization is consumed | Audit 04N and completed ledger | Exact ten-query set completed at A04-PR-010 | No further SQL is authorized | Prevents continuation or retry | High | New review and authorization for any future execution |
| A04O-012 | CONFIRMED | The audit agent did not execute SQL or access the database | Tool/action ledger for Audit 04O | Local repository reads, hashes, Git inspection, and one Markdown write only | No Supabase, network, database, Storage, function, or service call occurred | Production state was not changed by the agent | High | None |
| A04O-013 | UNKNOWN | Cross-query state was perfectly unchanged at database level | Operator attestation only | Ten independent transactions; section 5 | No relevant write was observed, but no database-enforced snapshot existed | Fine-grained cross-query consistency remains unproven | Medium | Future snapshot-safe design only if required |
| A04O-014 | CONTRADICTED | Catalog estimate 18 is an exact count of the executed date population | PF-006 and A04-PR-001 | Section 10 | Exact date-window count was 31 | Catalog estimates cannot bind population counts | High | Keep estimates and exact aggregates separate |

## 16. Repository-state preservation

Initial `git status --short` showed pre-existing working-tree state, including:

- modified `supabase/functions/generate-contractor-brief/index.ts`;
- untracked `supabase/functions/generate-contractor-brief/index.test.ts`;
- untracked audit artifacts from Audit 00 through Audit 04N and the Audit 04 generator.

Those files were not modified by Audit 04O. The only task-caused working-tree delta is creation of `docs/audits/04O_FRESH_APPLICATION_EXECUTION_RESULTS_CLOSEOUT.md`. Remote parity was not checked, and no Git mutation occurred.

## 17. Audit 05 handoff requirements

The Audit 04 application sequence and sanitized results packet are complete with privacy suppression. Audit 05 is not started or authorized by this artifact.

Before Audit 05 may begin, the founder must:

1. review this closeout artifact;
2. confirm its ledger exactly matches the fresh operator evidence;
3. accept that only A04-PR-001 released non-null application aggregates;
4. accept all suppression and semantic limitations;
5. carry forward the PF-005 recurring-index blocker, catalog-estimate discrepancy, restricted-contract boundary, and unresolved market/semantic eligibility;
6. issue a separate explicit authorization naming Audit 05.

Audit 05 must not reinterpret suppression as evidence of a specific small cell, treat the operational counts as quote or project populations, or infer monetary, market, opening, product, contractor, geography, cohort, or benchmark readiness.

## 18. Conclusion

The one authorized fresh application sequence completed in exact query order inside its approved window. A04-PR-001 released four bounded operational counts. A04-PR-002 through A04-PR-010 each returned the valid privacy-suppressed control shape and therefore provide no publishable segmented distribution. The prior invalidated sequence was not reused. The one-time bounded full-scan exception and application SQL authorization are consumed. No further SQL, recurring profiling, implementation, or Audit 05 action is authorized.

AUDIT_04_APPLICATION_SEQUENCE: COMPLETE
AUDIT_04_RESULTS_CLOSEOUT: COMPLETE_WITH_PRIVACY_SUPPRESSION
FRESH_QUERY_RESULTS: A04-PR-001_THROUGH_A04-PR-010_VALIDATED
PRIOR_SEQUENCE_RESULTS: INVALIDATED_AND_NOT_REUSED
BOUNDED_FULL_SCAN_EXCEPTION: CONSUMED
APPLICATION_SQL_EXECUTION_AUTHORIZATION: EXPIRED_NO_FURTHER_SQL_AUTHORIZED
RECURRING_PROFILE_INDEX_REQUIREMENT: OPEN_BUILD_BLOCKER
AUDIT_05_STATUS: BLOCKED_PENDING_SEPARATE_FOUNDER_AUTHORIZATION
