# Audit 05 — Build-Readiness Synthesis and Phase 0 Closeout

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 05 — Build-Readiness Synthesis and Phase 0 Closeout |
| UTC execution time | `2026-08-31T06:28:07Z` |
| Execution environment | `CODEX`; local read-only repository inspection plus one authorized Markdown write |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Checkout type | Standard Git working tree; common directory `.git` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status at entry | Dirty from pre-existing modified and untracked files; listed in section 2 |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity actually verified | `NO` |
| Database environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD` |
| Supabase project display | `WMProd` |
| Target Supabase branch | `forensic_report_v1` |
| Database project identifier | Branch ref `zgsofkgddpcntdvpckdq` |
| Prohibited parent | `wkrcyxcnzhwjtdpmfpaf`; not in scope |
| PostgreSQL version | `17.6`, operator-executed metadata evidence |
| Reviewed execution role | `postgres`; non-superuser; role inheritance true; `BYPASSRLS=true` |
| Production read authorization | Prior bounded metadata and aggregate execution completed; no current database authorization |
| Network authorization | Not authorized or used for this audit |
| Applicable governance | Root `AGENTS.md`; Audit 00 protocol; Phase 0 evidence packet |
| Audit status | `COMPLETE_WITH_BLOCKERS` |
| Auditor limitations | No database, network, runtime, deployment, customer-record, Storage-object, or external-service access; no build or test execution; source findings remain anchored to the audited commit and deployed-artifact evidence |

### Methodology

This synthesis reconciles current committed source, uncommitted working-tree state, repository migrations, generated types, operator-supplied deployed metadata, the downloaded deployed scanner artifact, technical review records, founder decisions, and the valid fresh Audit 04 aggregate-result sequence. Evidence domains remain separate. Later validated Audit 04 artifacts supersede earlier drafts only where their lineage explicitly says so: Audit 04F is the executed SQL authority, 04G its successful static review, 04K the bounded preflight exception, 04N the valid fresh authorization, and 04O the authoritative result closeout. The earlier invalidated application sequence is excluded.

No SQL, application code, source-code fence, migration, implementation instruction, database call, or external invocation is included in this report.

## 2. Files reviewed and SHA-256 hashes

| Artifact | Bytes | Lines | SHA-256 |
|---|---:|---:|---|
| `00_AUDIT_PROTOCOL_AND_SEQUENCE.md` | 14,222 | 436 | `B690A53F0D3A32076F337F10E4EB8A652E2E98018EF7A601425A2FE866DD0383` |
| `01_REPOSITORY_AND_INGESTION_AUDIT.md` | 45,540 | 498 | `8065F24772095AFC3320543E135F86B1BCC84CC2D4CB8F99B675AE0E28A17BFA` |
| `02_DATABASE_AND_EXTRACTION_MODEL_AUDIT.md` | 78,356 | 521 | `5858609B167FB3F4F454576E8A549718E492573D7606BFF78B98C6C19FDEFA73` |
| `03_SECURITY_AND_INTEGRATION_BOUNDARY_AUDIT.md` | 44,004 | 423 | `99A410645B4DD27FBD725C0D5BA02AC0684855A86F353A77C3EB677A2E4994FD` |
| `03A_SCHEMA_BINDING_PHASE_A.md` | 19,172 | 255 | `0F89940D54089A64ADF9B75F2FD88909068EDB5219F7000AE325FB42D958D865` |
| `03B_SCHEMA_BINDING_METADATA_QUERY_PACK.md` | 42,322 | 1,223 | `1B1D52BC33A04427C741BDC7697D965AEC7E65631A0FF2BB3BE1F6F72DC5FC7B` |
| `03C_SCHEMA_BINDING_EXECUTION_RESULTS.md` | 35,303 | 323 | `5B43395FF47EDE83855A9F5EE6ECE7CED82BC8A634784FC8557A4F7FF2DB7564` |
| `03D_DEPLOYED_EXTRACTION_CONTRACT_AUDIT.md` | 57,961 | 476 | `3EECD8FEE831B25D9EBBDD8821AC447F89CBB7E44386B916AE0D822213C84317` |
| `03E_SEMANTIC_BINDING_DECISION_REGISTER.md` | 52,438 | 662 | `092152A16619BFF99A33D9DCF53900871D89B4EBFB2A9D3A7B700F75988C9805` |
| `03F_SEMANTIC_BINDING_APPROVAL_AND_SPECIALIST_REVIEW.md` | 35,846 | 534 | `EBF60210AC29BCE10B52089751D07307BF6D0F61D769AA02ADA1C9CB3F60090B` |
| `04_DATA_PROFILING_QUERY_GENERATOR.md` | 86,612 | 1,586 | `618BDF0124D90952859C56B1F077336DB4BC0A762BED996D64DA7C8965742CFC` |
| `04A_TECHNICAL_SQL_REVIEW_AND_OPERATOR_DECISION_RECORD.md` | 44,383 | 575 | `85BE6C446B253D992370E48531878395846B0A00F9CE7236FEC3CD1646B48D29` |
| `04B_CORRECTED_DATA_PROFILING_QUERY_PACK.md` | 97,777 | 1,778 | `E0FD036C406DBC751CBBD5221E75A7DA643DDA5348E32940A2D7BE94316BA78E` |
| `04C_CORRECTED_PACK_TECHNICAL_REVIEW.md` | 91,722 | 1,850 | `3AC8CE43C7ACDF9337C282938089AFA100D5166A418796F208673583C6845ADC` |
| `04D_PRIVACY_HARDENED_DATA_PROFILING_QUERY_PACK.md` | 133,770 | 2,694 | `EC10D1A689042DAA82839FF8DFAEB33320BC9A46672A014DCE61F526C051B6FD` |
| `04E_PRIVACY_HARDENED_PACK_INDEPENDENT_REVIEW.md` | 49,955 | 811 | `592E2440D14E4D22D3746BA2F40C478022BE177B7D606E9C625733994056A8B6` |
| `04F_DIRECT_JSON_GUARD_CORRECTED_QUERY_PACK.md` | 137,809 | 2,751 | `60A894F2D86F763367D5FA06045DFBAA345D0223488ADEF53C501797D7F7A237` |
| `04G_DIRECT_JSON_GUARD_PACK_INDEPENDENT_REVIEW.md` | 59,181 | 371 | `9CFB42B3AD8E387C809AC87D47F6F83B511D18C98227C3F8EB80DEC38682191C` |
| `04H_PREFLIGHT_OPERATOR_DECISION_AND_EXECUTION_RUNBOOK.md` | 38,888 | 748 | `0CA207CCA02D0F7068A6FBFFB81F77D4DBD1CAC9E25733B8E3FBE67E9EB325A7` |
| `04I_PREFLIGHT_EXECUTION_RESULTS_AND_VALIDATION.md` | 13,514 | 202 | `A37B0118D52FD59FBE1A002F2D602FC8336029EDCE0E7968DFE8682739B5823F` |
| `04J_PREFLIGHT_REAUTHORIZATION_AFTER_PROCEDURAL_STOP.md` | 8,025 | 177 | `0D72DFA477EFBE9BCB0A80F3D3F8E38571B9C74D17E71BB2D76996855F2B24D4` |
| `04K_BOUNDED_FULL_SCAN_EXCEPTION_AND_PREFLIGHT_CLOSEOUT.md` | 21,288 | 249 | `155B574B0F1AE1DDC0D7AEF56590B326283F2B3DDBB45847915BEB5EE04944FD` |
| `04L_APPLICATION_EXECUTION_PLAN_AND_QUIESCENCE_ATTESTATION.md` | 15,434 | 250 | `A035FC598DA19948D99C55ACEDA67D1031BD5C5C9EA392CEBC34C588E078DEFF` |
| `04M_QUIESCENCE_ATTESTATION_AND_APPLICATION_EXECUTION_AUTHORIZATION.md` | 13,857 | 220 | `A4A1BC1151C5C285CAA02054110EA3C5E140F19E851C6373658E50B49B7711D5` |
| `04N_FRESH_APPLICATION_SEQUENCE_REAUTHORIZATION.md` | 9,317 | 171 | `108FDFEE4F9C469C35AA60EA54961F2CB326F5E958C2951EB723DAD79EF9E831` |
| `04O_FRESH_APPLICATION_EXECUTION_RESULTS_CLOSEOUT.md` | 25,544 | 254 | `B39386A9CC9D115F1B898A3BD6F305C0AFB16D2D9C3C05CF1525B143494E8DA6` |

The initial working tree contained a pre-existing modification to `supabase/functions/generate-contractor-brief/index.ts`, a pre-existing untracked related test, and the untracked Phase 0 audit packet. These were not altered. The Audit 05 target did not exist at entry.

## 3. Executive summary

WindowMan has enough evidence to plan a narrowly bounded additive foundation, but not enough to plan an end-to-end production intelligence or benchmark rollout as though its semantics, population quality, security, and data rights were settled.

The current production path is clear: private upload and scan-session bootstrap lead to the deployed `scan-quote` function; Gemini reads the document; TypeScript performs shallow extraction checks plus deterministic scoring and report compilation; the backend persists a mutable analysis row; report access remains server-authorized; and the browser renders preview or full Truth Report projections. This separation is a protected strength.

The deployed extraction response is not governed by a closed runtime schema. Only document classification, confidence, a non-empty line-item array, and line-item description shape are enforced before the full object is cast and persisted. Every broader field remains unsafe for profiling unless separately enforced and rebound. The database has durable lead, uploaded-document, scan-session, and mutable-analysis-row identities, but no proven quote, project, revision, immutable-attempt, duplicate, current-record, or supersession identity.

Audit 04 established a valid, privacy-preserving execution process. It released only four operational persistence-window counts: 31 mutable analysis rows, 31 scan sessions, 31 uploaded documents, and 28 leads. The other nine application distributions were withheld by whole-distribution suppression. Those controls preserved privacy but left quality composition, analytics eligibility, cohort feasibility, and market representativeness unknown. The one-time full-scan exception is consumed, and the missing simple index on `public.analyses.created_at` remains a blocker for recurring or materially larger profiling.

Accordingly, detailed planning may begin only for the identity, provenance, eligibility, strict-contract, failure-isolation, and governance foundation. Monetary intelligence, opening-level facts, contractor/geography/product cohorts, benchmarks, and Truth Report integration must remain explicitly excluded until their gates advance. This verdict is planning authority only; it is not implementation authority.

## 4. Phase-gate matrix

| Gate | Status | Decisive evidence | Limitation | Exact requirement to advance |
|---|---|---|---|---|
| `GATE_REPOSITORY` | `SATISFIED_WITH_LIMITATION` | Canonical root, branch, SHA, governance, runtime call graph, and protected report path established in A01-001–A01-019 | Live remote parity was not verified; current working tree contains unrelated pre-existing changes | Before implementation, reconcile the approved plan to a clean, current canonical checkout and verify remote parity under separate authorization |
| `GATE_CONTRACT` | `SATISFIED_WITH_RESTRICTED_PROFILEABLE_SUBSET` | Deployed scanner archive and runtime trace in A03D-001–A03D-015 | No closed extraction-response schema; unknown and wrongly typed fields can persist | Define and independently review a versioned, closed runtime extraction contract before any broader field is admitted |
| `GATE_DATABASE` | `SATISFIED_RESTRICTED_ONLY` | Deployed metadata, role, objects, columns, keys, RLS state, and migrations in A03C; founder binding in A03F | No quote/revision/attempt lineage; generated types drift; repository has later migration intent; fact ownership unresolved | Approve durable identities, provenance/version columns, fact ownership, generated-type reconciliation, and deployed migration plan before implementation |
| `GATE_SECURITY` | `NOT_SATISFIED_FOR_IMPLEMENTATION` | Verify-to-Reveal and private Storage patterns are evidenced; deployed full-report function grants are restricted | Public scanner invocation has unresolved resource authorization; preview/status enumeration, filename/log exposure, retention, erasure, and data-rights issues remain | Independent security/privacy review must approve caller ownership, least privilege, data minimization, retention/erasure, server-only delivery, feature flags, and rollback |
| `GATE_PROFILE` | `SATISFIED_RESTRICTED_ONLY` | A04-PF-001–004 and 006 passed; PF-005 had a one-run exception; A04-PR-001–010 were validated in 04O | Nine distributions were suppressed; exception and SQL authorization are consumed | New authorization and a separately reviewed access/index plan are required for any further profiling; suppression must not be weakened |
| `GATE_QUALITY` | `NOT_SATISFIED_FOR_ANALYTICS` | A04-PR-001 provides bounded operational counts; A04-PR-002–010 prove suppression controls operated | No released evidence of test prevalence, join-loss distribution, field quality mix, confidence mix, line-item mix, or semantic correctness | Accumulate or safely assess enough governed data to produce non-disclosive quality evidence and approve an analytics-eligibility rule |
| `GATE_DECISIONS` | `SATISFIED_RESTRICTED_ONLY` | FD-03D-001–007 approved; FD-03D-008 deferred; SR-03E-001–007 completed as three PASS and four conditional technical reviews | Independent implementation/production reviews remain required in every specialist domain; market and benchmark semantics remain unapproved | Record implementation-specific data-platform, extraction, finance, QA, privacy, security, domain, contract, and competition-law decisions |
| `GATE_BUILD` | `CONDITIONAL_PLANNING_ONLY` | A failure-isolated additive foundation can be scoped without using unsupported fields or changing current report behavior | Production intelligence, cohorts, benchmarks, and report activation remain blocked | Approve a Phase 1 planning brief limited to identity, provenance, strict eligibility, security/data-rights closure, and rollback-safe integration contracts |

## 5. Final expected-claim disposition

| Claim | Expected value | Final observed value | Classification | Evidence | Consequence |
|---|---|---|---|---|---|
| `EXP-001` | Canonical repository is `C:\Projects\wm-mvp-github-clean` | Exact root confirmed | `CONFIRMED` | A01-001; current identity | Repository-scoped conclusions are anchored correctly |
| `EXP-002` | Expected branch is `forensic_report_v2` | Active branch confirmed | `CONFIRMED` | A01-001; current identity | Source audit uses expected branch; remote freshness remains unverified |
| `EXP-003` | React and TypeScript frontend | Declared and used | `CONFIRMED` | A01-003 | Browser integration planning must preserve current typed React boundary |
| `EXP-004` | Vite tooling | Declared and configured | `CONFIRMED` | A01-003 | Frontend build system is known; no build was run |
| `EXP-005` | Supabase PostgreSQL, Storage, and Edge Functions | Repository and deployed metadata/artifact evidence support all three | `CONFIRMED` | A01-004; A03C; A03D | Future intelligence must remain within the protected server/data boundary |
| `EXP-006` | Deno-compatible server code | Edge Function source is Deno-compatible | `CONFIRMED` | A01-004 | Server planning must preserve Deno-compatible patterns |
| `EXP-007` | Gemini performs AI extraction | Deployed scanner calls Gemini directly | `CONFIRMED` | A03D-007–A03D-010 | AI remains an evidence reader, not the owner of deterministic judgment |
| `EXP-008` | Function named `scan-quote` exists | Repository and downloaded deployed artifact confirm it | `CONFIRMED` | A01-004; A03D-001–A03D-004 | Existing critical path is protected and must not be burdened by intelligence failure |
| `EXP-009` | Analysis storage includes `analyses.full_json` | Deployed nullable `jsonb` column and scanner write confirmed | `CONFIRMED` | A01-007; A03C-005; A03D-012, A03D-017 | It remains protected raw evidence, not a browser intelligence API |
| `EXP-010` | `wm_quote_facts` exists | Exists deployed and has a repository-evidenced successful-scan writer | `CONFIRMED` | A01-008–A01-009; A03C object inventory | Existence and writes do not make it authoritative; values remain excluded |
| `EXP-011` | `quote_observations` exists | Exists deployed; helper/migration exist; active production writer remains unproven | `CONFIRMED` for existence; ownership `UNKNOWN` | A01-010–A01-012; A03C | It cannot be adopted as the authoritative fact model without ownership and transactional design |
| `EXP-012` | `quote_intelligence_facts` exists | Absent from tracked repository and deployed allowlisted inventory | `CONTRADICTED` | A01-014; A03C | No plan may target this invented object |
| `EXP-013` | Homeowner Truth Report exists | Route, backend transport, preview/full separation, and rendering path exist | `CONFIRMED` | A01-015–A01-016; Audit 03 boundary trace | Optional intelligence must remain server-owned, additive, and feature-flagged |
| `EXP-014` | Drizzle ORM status unknown | Drizzle and other inspected ORMs are absent; handwritten migrations and Supabase clients are used | `CONTRADICTED` | A02-004–A02-005 | ORM adoption is not implied or recommended |

## 6. Authoritative current-state architecture

| Stage | Current authority | Durable effect | Evidence-supported boundary |
|---|---|---|---|
| Lead and upload bootstrap | Browser upload flow plus server bootstrap | Lead, private uploaded-document metadata, and scan session | Server validates/reuses identities; private quote asset remains protected |
| Extraction invocation | `scan-quote` Edge Function | Reads the private source document and calls Gemini | Server-side; deployed JWT verification is disabled and resource authorization remains unresolved |
| AI extraction | Gemini direct HTTP request | Candidate structured text only | Prompt-declared shape is not a provider-enforced response schema |
| Parse and classification | JSON normalization, syntax parse, classification normalization, gate, shallow coercion | Complete-path decision | Only the restricted subset receives runtime shape checks |
| Deterministic analysis | TypeScript scoring, flagging, metrics, and report compiler | Scores, findings, preview, full report payload | AI does not own final grade or deterministic judgment |
| Persistence | Backend upsert into `analyses` by scan session | One mutable analysis row plus protected `full_json` | Not an immutable processing-attempt ledger |
| Downstream lifecycle | Pointer/event/fact side effects and scan-session status | Report-ready lifecycle marker | Some downstream side effects are non-transactional; no durable intelligence outbox is established |
| Preview and verification | Backend preview/status and SMS verification flows | Safe preview and per-scan authorization state | UUID knowledge-based surfaces still require security review |
| Full Truth Report | Backend full-report function and browser renderer | Authorized report projection | Deployed function grants are restricted; `full_json` is not sent before authorization |
| Existing benchmark behavior | Static county constants in report metrics; separate refresh function exists | No proven empirical report cohort | Refresh path is not a safe or report-integrated cohort authority |

Protected architectural law remains: Gemini/AI reads; TypeScript calculates; deterministic scoring judges; backend persists; frontend renders.

## 7. Safe post-analysis integration boundary

The narrowest evidence-supported candidate is after both conditions are durable:

- the analysis row is in its successful complete state; and
- its scan session is in a report-ready state such as `preview_ready`, `awaiting_verification`, or `revealed`.

This boundary is `INFERRED`, not a confirmed implementation point. It is stronger than inserting intelligence work inside the scanner because successful analysis and report readiness already exist independently. It is not yet safe to implement because the repository does not establish a durable outbox/queue, immutable event identity, retry ledger, transactional handoff, dead-letter behavior, or idempotent normalization ownership.

Any future plan must make intelligence activation additive and failure-isolated: a normalization or aggregation failure must never change the successful analysis state, block preview/full report delivery, alter OTP authorization, or rewrite deterministic scoring. The default-off path must be behaviorally identical to today.

## 8. Extraction-contract findings

- The deployed artifact is forensically stable: the inspected archive matched its expected size, entry count, integrity, and hash; 19 entries were identical to the audited commit and four differed.
- Extraction-critical prompt, provider request shape, normalization, JSON parsing, classification gate, shallow coercion, `validateExtraction`, scoring, relevant `full_json` construction, and analysis persistence were identical between deployed artifact and repository evidence.
- Zod validates the HTTP request boundary, not Gemini's extraction response.
- Complete-path runtime enforcement covers only an object root, string document type, related classification, bounded confidence, a non-empty line-item array, object elements, and string descriptions.
- Shallow coercion preserves undeclared root keys; nested fields are not closed-schema validated. Arbitrary or incorrectly typed values can therefore survive into protected extraction storage and be trusted by deterministic consumers.
- The only previously approved profileable extraction subset was classification validity, confidence-state quality, guarded line-item array length labeled `extracted_line_item_count`, and description shape/length aggregates. Audit 04 suppression released none of the segmented distributions.
- The current contract is adequate only for planning a strict versioned projection and migration strategy. It is not a complete intelligence fact contract.

## 9. Schema-authority findings

- Intended reproducible schema is owned by ordered handwritten Supabase migrations. Runtime querying uses Supabase clients and handwritten SQL/RPCs. No ORM owns schema work.
- Deployed metadata confirms the four restricted source relations, required columns, primary/foreign/unique constraints, RLS-enabled state, and PostgreSQL 17.6 on the exact active branch instance.
- Repository migration intent was ahead of the applied deployment ledger by two migrations at Audit 03C time. Repository intent therefore must not be substituted for deployed state.
- Generated database types lag migration/deployed evidence and are not schema authority.
- Deployed object presence is not writer ownership. `analyses` is the canonical current lifecycle source; fact-like objects remain provisional, dormant, unsupported, or of unknown ownership.
- The SQL Editor role bypasses RLS. Future internal jobs must use a deliberately reviewed least-privilege role rather than inherit the Phase 0 manual role as architecture.

## 10. Security and data-rights findings

### Evidence-supported strengths

- Private quote Storage and backend-mediated report delivery are established patterns.
- Preview shaping removes protected full-report material before release.
- Full report retrieval is bound to backend authorization and exact scan/verified-phone relationships.
- Deployed full-report-related function execute grants were narrower than an earlier repository migration concern, resolving that specific deployed ACL contradiction.
- No service-role credential was found in browser code.

### Conditions still blocking implementation

- The deployed scanner endpoint has JWT verification disabled; exact caller authentication and resource ownership enforcement remain unresolved.
- Preview/status lookup remains vulnerable to knowledge-of-identifier risk unless endpoint authorization and enumeration resistance are independently verified.
- Original upload names and correlation-rich logs present minimization and retention concerns.
- The source document is transmitted to Gemini; provider retention, contractual terms, notice, consent, and reprocessing rights are not established by repository evidence.
- Relational deletion, Storage deletion, derived-fact deletion/dissociation, correction history, export, and consent withdrawal are not proven end-to-end.
- Homeowner aggregate-intelligence disclosure, non-partner contractor-data treatment, competition-law review, and benchmark publication rights remain unresolved.
- RLS, grants, Data API exposure, Storage policies, and function ACLs are separate controls and must remain separately reviewed.

These are technical findings, not legal, privacy-professional, or security-professional certifications.

## 11. Profiling and data-quality findings

Audit 04's fresh valid sequence produced one released aggregate row and nine suppression controls.

| Measure | Valid result | Permitted interpretation |
|---|---:|---|
| Mutable analysis rows | 31 | Rows persisted in the frozen `analyses.created_at` operational interval |
| Scan sessions | 31 | Distinct supported scan-session entities represented by the query |
| Uploaded documents | 31 | Distinct uploaded-document entities represented by the query |
| Leads | 28 | Distinct lead entities represented by the query |

These figures do not describe quotes, projects, revisions, attempts, customers, contractors, openings, products, markets, or benchmarks. The PF-006 estimate of 18 analysis rows was an approximate catalog statistic and differed from the exact date-window count of 31; it was stale or incomplete for that comparison, not an application-query failure.

Audit 04 did not release evidence of lifecycle composition, restricted-population size, confidence mix, document-type validity mix, line-item distribution, description shape, or description length. Consequently:

- analytics eligibility remains false;
- semantic correctness remains unmeasured;
- historical comparability remains unknown;
- test-label completeness remains unvalidated;
- selection bias and representativeness remain unknown; and
- cohort feasibility is unproven.

## 12. Privacy-suppression interpretation

A04-PR-002 through A04-PR-010 each returned one valid suppression-control row with threshold five and null dimension/metric outputs. This confirms that the coordinated disclosure gate withheld each distribution. It does not reveal which bucket caused suppression, how many small buckets existed, any hidden total, or any distribution shape.

No suppressed value may be inferred by subtraction, overlap, lifecycle logic, or comparison with the four operational totals. Suppression is a successful privacy outcome and an evidence limitation at the same time. It cannot be weakened merely to obtain a build-readiness answer.

## 13. Entity and identity findings

| Concept | Current representation | Finding | Intelligence consequence |
|---|---|---|---|
| Lead | `leads.id` | Durable lead identity; not a project or quote | May support ownership joins only under approved policy |
| Uploaded document | `quote_files.id` | Durable uploaded-file metadata identity; one session relationship is constrained | A document is not automatically a quote or revision |
| Scan session | `scan_sessions.id` | Durable processing/report-session identity | Suitable lifecycle parent, not immutable attempt identity |
| Mutable analysis row | `analyses.id`, upserted by scan session | Canonical current analysis row | Overwrite/re-scan behavior prevents attempt-history claims |
| Quote | No authoritative object/identifier | Unsupported | Quote-level facts and deduplication remain blocked |
| Project | No authoritative object/identifier | Unsupported; lead is not project | Project counts and multiple-bid analysis remain blocked |
| Revision | No lineage object or supersession rule | Unsupported | Current/revised quote selection remains blocked |
| Immutable processing attempt | No durable append-only attempt identity | Unsupported | Retry rates, model-version comparison, and correction lineage remain blocked |

Array position is not an opening identity. A line item can represent mixed product, labor, fee, permit, discount, or scope concepts and must not be promoted into an opening entity without an approved domain contract.

## 14. Fact-table ownership assessment

| Object | Assessment | Evidence-supported use | Build implication |
|---|---|---|---|
| `analyses` with `scan_sessions`, `quote_files`, and `leads` | `AUTHORITATIVE` for restricted current lifecycle only | Existing analysis/report path and bounded quality source | Foundation planning may reference these entities without changing their behavior |
| `wm_quote_facts` | `PROVISIONAL` | Actively written event projection with default/provisional quality inputs | Do not use as analytics eligibility or benchmark authority |
| `quote_observations` | `UNKNOWN_OWNERSHIP` | Deployed object plus repository normalizer helper | No proven production caller; not approved as authoritative |
| `quote_line_items` | `UNKNOWN_OWNERSHIP` | Deployed child fact candidate | Opening identity and writer ownership unresolved |
| `normalization_failures` | `UNKNOWN_OWNERSHIP` | Deployed failure candidate | No active recovery/transaction contract established |
| `wm_quote_reviews` | `DORMANT` | Migration/deployed object evidence only | Excluded until writer and semantics are proven |
| `wm_pricing_index_snapshots` | `DORMANT` | Migration/deployed object evidence only | Excluded from benchmark planning inputs |
| `county_benchmarks` | `UNSUPPORTED` | Absent in deployed allowlisted inventory | Existing refresh code is not a production cohort authority |
| `quote_intelligence_facts` | `UNSUPPORTED` | Exact object absent | Must not appear in a build plan |

No object is approved as the future authoritative intelligence fact model merely because it exists.

## 15. Duplicate, reprocessing, supersession, and test-data assessment

- Bootstrap reuse, deterministic Storage paths, analysis upsert, stale takeover, and bounded polling provide operational retry controls.
- These controls do not create quote deduplication, revision lineage, immutable attempts, or supersession history.
- Admin re-scan can delete/replace prior analysis state; historical failed and partial attempts are not a reliable append-only ledger.
- An upsert by scan session is idempotent for the mutable row target, not proof of business-level idempotency for a quote or intelligence event.
- `leads.is_test IS FALSE` is the only approved test exclusion. Missing lead linkage is fail-closed. Audit 04 did not release the test/exclusion distribution, so test-label completeness remains unknown.
- Backfill, correction, and reprocessing must not proceed until an immutable source identity, version lineage, idempotency key, current-selection rule, and correction history are approved.

## 16. Monetary, quantity, opening, and price-basis assessment

- All current monetary fields remain excluded. Currency, total-price basis, line-price basis, tax, fee, discount, financing, allowance, optional-work, precision, and rounding semantics are unproven.
- Integer USD cents is approved only as a future canonical representation. Existing numeric or cent-named fields are not thereby certified or convertible.
- Quantity, physical opening count, dimensions, united inches, product count, and price-per-opening are disabled.
- Guarded line-item array length may be called only `extracted_line_item_count`. Audit 04 did not release its distribution.
- No monetary reconciliation, opening-level fact, or price benchmark can be planned as a usable product feature until field-level source/basis rules and domain validation are approved.

## 17. Cohort and benchmark feasibility

Cohort and benchmark feasibility is not established. The evidence lacks durable quote/project/revision identities, duplicate and supersession rules, canonical monetary units and price basis, opening/product semantics, adequate released quality distributions, contractor/geography concentration evidence, recency behavior, outcome selection-bias evidence, and data-rights approval.

The current Truth Report comparison uses static constants. The separate benchmark-refresh function reads protected analysis payloads with insufficient eligibility, version, revision, concentration, and bias controls and is not proven to feed the report. It must not be adopted as the Phase 0 cohort design.

Any future benchmark must be server-owned, aggregate-only, small-cell protected, contributor-concentration limited, provenance-bearing, recency-bound, duplicate/revision aware, and explicit about quoted versus verified-sold populations. No such benchmark is currently ready for implementation.

## 18. Truth Report integration readiness

The Truth Report transport and Verify-to-Reveal boundary are suitable protected consumers of a future additive benchmark, but the benchmark itself is not ready. Integration planning may define a future interface and feature-flag contract only; it must not choose cohort metrics or expose data yet.

Required preconditions are:

1. a server-owned aggregate response that contains no raw facts or contributor identity;
2. durable subject/cohort identity and leave-one-subject-out policy where applicable;
3. approved quality, recency, geography, product, and concentration rules;
4. independent privacy, security, contract, and competition-law review;
5. default-off server feature flag and kill switch;
6. report behavior that remains unchanged when intelligence is absent, stale, suppressed, disabled, or failed; and
7. regression evidence that preview/full authorization and teaser safety are unchanged.

## 19. Feature-flag and rollback requirements

- Separate server-owned flags are required for fact production, aggregation, and Truth Report consumption. A browser flag must never grant data access.
- All flags default off in every environment until separately promoted.
- Intelligence work must be outside the scanner's success transaction and outside report authorization.
- The fail-safe behavior is to omit the additive intelligence output, not fail quote analysis or report delivery.
- Every material version must be attributable: extraction schema, parser/normalizer, fact schema, eligibility policy, deterministic analysis, cohort policy, and report projection.
- Rollback means disabling producers/consumers and returning to existing behavior without deleting canonical analysis evidence or rewriting historical facts.
- No rollback may weaken Verify-to-Reveal, RLS, private Storage, or report ownership checks.

## 20. Monitoring, correction, retention, and erasure requirements

Future planning must define, before implementation:

- immutable event/job correlation and attempt identifiers distinct from analysis-row identity;
- idempotent producer keys and transactional handoff or durable outbox semantics;
- pending, succeeded, failed, retryable, terminal, superseded, and correction states;
- bounded retries, concurrency policy, dead-letter/recovery ownership, and replay authorization;
- latency, error, suppression, eligibility, drift, stale-version, and contributor-concentration metrics;
- alerts that do not log raw extraction, source text, row identifiers, customer details, or object paths;
- human correction provenance and non-destructive history;
- retention schedules for source documents, raw extraction, normalized facts, aggregates, logs, and audit records;
- relational/Storage/derived-data erasure or irreversible dissociation rules;
- export, correction, consent withdrawal, and third-party processing workflows; and
- environment separation, deployment promotion evidence, and rollback drills.

## 21. Remaining contradictions

| ID | Contradiction | Current resolution | Consequence |
|---|---|---|---|
| `A05-C-001` | Prompt and TypeScript declare a broad shape, while runtime validation is shallow | Runtime behavior governs; only restricted subset is bound | Broad extraction fields are excluded |
| `A05-C-002` | Generated types omit later deployed/migration-defined objects and fields | Deployed metadata and migrations outrank generated types | Type regeneration is future protected work, not Phase 0 action |
| `A05-C-003` | Repository migration intent was ahead of applied production migration history | Keep repository intent and deployed state separate | Any implementation plan must rebind exact deployment state |
| `A05-C-004` | Earlier repository concern suggested broader full-report execute access; deployed ACL evidence was narrower | Deployed ACL controls the target-state finding | Retain drift checks; do not erase the repository/deployment mismatch |
| `A05-C-005` | PF-006 estimated 18 analysis rows while PR-001 counted 31 in the date window | Catalog estimate was stale or incomplete | Sizing estimates are not exact population facts |
| `A05-C-006` | Existing benchmark code implies empirical aggregation while the report consumes static constants | Neither proves a safe live benchmark pipeline | Existing components cannot be relabeled as the future solution |
| `A05-C-007` | `wm_quote_facts` and normalization objects exist, but authority/quality claims exceed proven writers and semantics | Classify separately as provisional or unknown ownership | Object existence does not settle architecture |

## 22. Remaining unknowns

| Unknown ID | Question | Why unresolved | Build impact | Required evidence / owner |
|---|---|---|---|---|
| `A05-U-001` | Is local source current with the remote branch? | Live remote parity was never authorized in the audit | Implementation baseline may drift | Authorized immutable remote comparison; release owner |
| `A05-U-002` | What exact deployed scanner version and timestamp produced each analysis? | Function deployment identity and per-row versions are absent | Reproducibility and historical comparison blocked | Deployment metadata plus persisted version lineage; extraction owner |
| `A05-U-003` | What is the durable quote/project/revision/attempt model? | No authoritative objects or policy exist | Facts, duplicates, revisions, and cohorts blocked | Founder/data-platform ADR and schema plan |
| `A05-U-004` | Are test labels complete and joins consistently populated? | Relevant distributions were suppressed | Eligibility denominator uncertain | Future governed QA evidence; QA owner |
| `A05-U-005` | Are broader extraction values semantically correct? | Runtime does not enforce them and raw values were not inspected | Product/monetary/opening facts blocked | Versioned validator plus separately authorized quality study |
| `A05-U-006` | Are privacy, contractual, and competition-law rights sufficient for aggregation and publication? | Repository evidence cannot establish legal authority | Benchmark reuse and external claims blocked | Independent privacy, contract, and competition-law review |
| `A05-U-007` | Can a durable post-analysis handoff be retried without duplicate facts? | No outbox/queue/immutable event contract is established | Additive writer implementation blocked | Failure-mode design and tests; data platform/security |
| `A05-U-008` | What is the effective retention and erasure behavior across DB, Storage, derived facts, and providers? | End-to-end workflows are not proven | Production derived data blocked | Data inventory, retention schedule, deletion proof; privacy/security |
| `A05-U-009` | Is a representative, sufficiently diverse cohort feasible? | Segmented outputs were suppressed; identities/semantics missing | Benchmarks blocked | Governed population growth and later approved aggregate profiling |
| `A05-U-010` | What role should own production intelligence reads/writes? | Phase 0 SQL used a BYPASSRLS role only for reviewed manual work | Least-privilege service design blocked | Role/grant/RLS design and deployed security review |

## 23. Complete blocker register

| Blocker ID | Severity | Classification | Finding | Behavior at risk | Resolution evidence | Owner |
|---|---|---|---|---|---|---|
| `A05-B-001` | Critical | `CONFIRMED` | No closed, versioned extraction-response runtime schema | Incorrect or arbitrary facts can persist | Strict validator/projection, schema version, compatibility tests | Extraction / QA |
| `A05-B-002` | Critical | `CONFIRMED` | Quote, project, revision, immutable attempt, duplicate, current-record, and supersession identities are unsupported | Double counting, stale selection, irreproducible facts | Approved identity ADR, keys, constraints, lifecycle tests | Founder / data platform |
| `A05-B-003` | Critical | `UNKNOWN` | Data rights for aggregate intelligence and contractor-derived comparisons are unresolved | Unauthorized reuse or publication | Independent privacy, contract, and competition-law decisions | Founder / counsel / privacy |
| `A05-B-004` | High | `CONFIRMED` | Current monetary and price-basis semantics are unbound | Incorrect prices and benchmarks | Field-level units/basis contract, integer-cent conversion proof, finance QA | Finance / extraction / data platform |
| `A05-B-005` | High | `CONFIRMED` | Opening, quantity, dimension, and line semantics are unbound | Misstated openings and per-opening metrics | Domain contract, validator, durable opening identity, QA | Domain / extraction |
| `A05-B-006` | High | `CONFIRMED` | Model, prompt, extraction-schema, parser, normalizer, and attempt lineage are not persisted completely | Historical comparability and replay | Version/provenance contract and immutable attempts | Extraction / data platform |
| `A05-B-007` | High | `UNKNOWN` | Fact-table production ownership is unresolved | Competing writers and inconsistent facts | One approved owner, contract, transactional write path, deprecation plan | Data platform |
| `A05-B-008` | High | `CONFIRMED` | Nine quality/lifecycle distributions were suppressed | Analytics eligibility and cohort feasibility unknown | More governed data or separately approved non-disclosive method | Founder / privacy / QA |
| `A05-B-009` | High | `CONFIRMED` | Public scanner resource authorization is unresolved with JWT verification disabled | Unauthorized processing or cross-resource access | Independent endpoint ownership/auth review and tests | Security |
| `A05-B-010` | High | `UNKNOWN` | Preview/status identifier-enumeration resistance is not proven | Cross-user metadata exposure | Endpoint authorization and abuse-case evidence | Security |
| `A05-B-011` | High | `CONFIRMED` | Candidate normalization is not runtime-wired and is non-atomic | Partial/stale facts and retry corruption | Failure-isolated transactional/outbox design and recovery tests | Data platform |
| `A05-B-012` | High | `CONFIRMED` | No intelligence feature flag, kill switch, or proven report fallback exists | Intelligence failure could affect production if coupled | Server-owned default-off flags and report regression contract | Platform / report owner |
| `A05-B-013` | High | `CONFIRMED` | No simple `analyses.created_at` index; one-time exception consumed | Recurring profiling load | Separate index/access-pattern implementation plan and deployed proof | Data platform |
| `A05-B-014` | High | `UNKNOWN` | Retention, correction, export, consent withdrawal, and derived-data erasure are incomplete | Data-rights noncompliance and stale facts | Approved lifecycle/erasure policy and end-to-end tests | Privacy / security / operations |
| `A05-B-015` | High | `CONFIRMED` | Existing benchmark refresh lacks required eligibility, revision, bias, and bounded-load controls | Misleading or unsafe benchmark | Do not reuse; future server aggregation only after upstream gates | Data platform / product |
| `A05-B-016` | Medium | `CONFIRMED` | Generated types and deployed/migration schema have drift | Compile-time blind spots | Protected type regeneration and drift checks after schema decisions | Data platform |
| `A05-B-017` | Medium | `UNKNOWN` | Original upload-name and logging minimization/retention are not proven | Sensitive metadata leakage | Logging/path review and redaction/retention evidence | Security / privacy |
| `A05-B-018` | Medium | `UNKNOWN` | Test/demo labeling completeness is unvalidated | Contaminated quality populations | Governed QA process and aggregate evidence | QA / operations |
| `A05-B-019` | Medium | `UNKNOWN` | Cross-query quiescence was attested, not snapshot-enforced | Fine-grained result consistency | Snapshot-safe future design only if required | Data platform / security |
| `A05-B-020` | Medium | `UNKNOWN` | Live remote parity and exact deployment lineage remain unverified | Plan/source drift | Rebind before implementation | Release owner / operator |

## 24. Risk-ranked recommendations

1. **P0 — Approve only a Phase 1 planning brief.** Limit it to canonical identities, immutable provenance, eligibility states, strict version contracts, and an additive failure-isolated handoff. Do not include implementation.
2. **P0 — Close security and data-rights decisions before any new persistence.** Resolve scanner ownership, report/status enumeration, least-privilege roles, source/provider rights, retention, erasure, and external benchmark rights.
3. **P0 — Define the immutable processing model.** Separate lead, document, scan session, quote, revision, processing attempt, analysis projection, and current/superseded state. Do not retrofit business identities from existing IDs.
4. **P0 — Define a closed versioned extraction projection.** Admit no new field until runtime-enforced type, nullability, unit, provenance, and consumer behavior are specified and tested.
5. **P1 — Select one authoritative additive fact owner.** Reconcile or deprecate provisional/dormant candidates; require transactional/idempotent writes and recovery semantics.
6. **P1 — Preserve current product behavior with server-owned flags.** Default off, fail isolated, and make absence/suppression/staleness a normal report state.
7. **P1 — Plan the recurring access pattern and index separately.** The Phase 0 exception is consumed; no recurring scan should inherit it.
8. **P2 — Establish governed quality evidence before cohort work.** Maintain suppression and concentration protections; wait for sufficient data rather than infer hidden distributions.
9. **P3 — Design cohorts only after identity, units, quality, and rights are closed.** Include recency, revision, duplicate, project, contributor-diversity, leave-one-subject-out, and selection-bias rules.
10. **P4 — Integrate with the Truth Report last.** Use a server-owned aggregate DTO behind a default-off flag; never expose raw facts or make report success depend on intelligence availability.

## 25. Architecture Decision Record

### Decision context

WindowMan seeks an additive intelligence layer that learns from successful quote analyses while preserving the existing scanner, deterministic scoring, Verify-to-Reveal, Truth Report, private Storage, RLS, and production behavior. Phase 0 proved the current path and a restricted extraction subset, but did not prove broad semantics or cohort quality.

### Evidence

The decision relies on A01's complete ingestion/report trace, A02's schema and identity model, A03's trust-boundary findings, A03C's deployed metadata, A03D's deployed scanner contract, A03E–03F's restricted founder decisions, and A04O's validated but mostly suppressed profiling results.

### Chosen direction

Plan an additive, server-owned, failure-isolated intelligence pipeline beginning with canonical identity, immutable provenance/versioning, explicit eligibility, and a durable post-success handoff. The future pipeline may consume a deliberately projected versioned extraction contract after successful analysis/report readiness; it must not treat protected raw extraction storage as its public contract.

### Rejected alternatives

- Synchronous normalization or cohort work inside the critical scanner success path.
- Client-side exploration or delivery of protected raw extraction payloads.
- Declaring `wm_quote_facts`, `quote_observations`, or any similarly named object authoritative based on existence alone.
- Wiring the current non-atomic normalizer directly into production.
- Reusing the existing benchmark refresh as the cohort engine.
- Treating lead, uploaded document, scan session, mutable analysis row, or array position as quote/revision/attempt/opening identity.
- Publishing benchmarks from the current operational counts or suppressed distributions.
- Moving deterministic scoring or market judgment into Gemini.

### Protected invariants

- Gemini/AI reads; TypeScript calculates; deterministic scoring judges; backend persists; frontend renders.
- Verify-to-Reveal and per-scan authorization remain unchanged.
- Protected raw extraction is never a browser intelligence API.
- Intelligence failure cannot break successful quote analysis, preview, verification, full report delivery, or current deterministic scoring.
- Quote files remain private.
- No automatic schema, policy, function, deployment, or software evolution occurs; structural change remains human-approved.

### Consequences

Foundation planning can proceed, but it must be explicit about exclusions and sequencing. Broader facts, cohorts, benchmarks, and report activation remain later gated work. Additional tables or services are not predetermined; planning must first reconcile existing objects and ownership.

### Unresolved decisions

Durable entity model, strict extraction contract, fact ownership, least-privilege role, transaction/outbox mechanism, provider/data rights, retention/erasure, monetary and opening semantics, quality thresholds, cohort policies, benchmark presentation, and production flag governance.

### Rollback principle

Every future step must be additive and default off. Disabling the intelligence producer and consumer must restore current behavior without rewriting canonical analyses, changing authorization, or deleting evidentiary history. Partially produced intelligence must never become report-authoritative.

### Implementation authorization status

No implementation, migration, SQL execution, database mutation, deployment, or production change is authorized by this ADR.

## 26. Founder and specialist decision register

### Founder decisions

| Decision | Recorded outcome | Continuing effect |
|---|---|---|
| `FD-03D-001` | `APPROVE_RECOMMENDATION` | Restricted quality predicate only; semantic/market eligibility false |
| `FD-03D-002` | `APPROVE_RECOMMENDATION` | Current monetary fields excluded; integer USD cents is future policy only |
| `FD-03D-003` | `APPROVE_RECOMMENDATION` | Only guarded extracted line-item count; opening/quantity/dimensions disabled |
| `FD-03D-004` | `APPROVE_RECOMMENDATION` | Unsupported quote/revision/attempt/duplicate/current/supersession identities remain disabled |
| `FD-03D-005` | `APPROVE_RECOMMENDATION` | Only joined `is_test` false records enter the restricted population |
| `FD-03D-006` | `APPROVE_RECOMMENDATION` | Restricted source is analyses plus the three identity joins; fact-like tables are not authoritative |
| `FD-03D-007` | `APPROVE_RECOMMENDATION` | Unversioned history is limited to pipeline-health and restricted quality counts |
| `FD-03D-008` | `DEFER_UNSUPPORTED` | Every non-runtime-enforced extraction path remains excluded |

### Specialist technical reviews

| Review | Finding | Founder accountability for restricted Phase 0 | Independent review before implementation/production |
|---|---|---|---|
| `SR-03E-001` Data platform | `CONDITIONAL_PASS` | Sufficient | Required |
| `SR-03E-002` Extraction | `PASS` | Sufficient | Required |
| `SR-03E-003` Financial data | `PASS` | Sufficient because domain is excluded | Required before monetary use |
| `SR-03E-004` QA/data quality | `CONDITIONAL_PASS` | Sufficient for restricted pack | Required |
| `SR-03E-005` Privacy | `CONDITIONAL_PASS — TECHNICAL ONLY` | Sufficient for restricted pack controls | Independent privacy/legal review required |
| `SR-03E-006` Security | `CONDITIONAL_PASS — TECHNICAL ONLY` | Sufficient for restricted pack controls | Independent security review required |
| `SR-03E-007` Domain/estimating | `PASS` | Sufficient because unsupported semantics are excluded | Required for expansion |

Founder accountability closed the restricted profiling policy only. It does not substitute for independent implementation, production, legal, privacy, security, finance, extraction, QA, data-platform, or domain approval.

## 27. Phased build outline

This is a planning outline, not an implementation plan or authorization. Phase 1 planning may begin under the verdict. Later phases remain conditional on their prerequisites.

### Phase 1 — Canonical identity, provenance, and eligibility foundation

- **Objective:** Specify durable quote, project, revision, immutable attempt, analysis projection, provenance/version, and eligibility concepts without changing current runtime behavior.
- **Prerequisites:** Founder/data-platform identity decisions; security/privacy/data-rights review scope; current deployed-schema rebind.
- **Protected systems:** Scanner, `analyses`, Verify-to-Reveal, report RPCs, Storage, RLS, existing events and facts.
- **Likely artifacts:** ADRs, entity/lifecycle model, field/version registry, privacy classification, role/access model, migration/test plan drafts.
- **Tests and evidence:** Constraint model review, lifecycle state tables, threat model, erasure model, compatibility matrix.
- **Rollback boundary:** Planning documents only; no runtime effect.
- **Explicit exclusions:** No migration, writer, backfill, cohort, benchmark, report change, or client exposure.

### Phase 2 — Additive post-analysis normalization

- **Objective:** Plan one server-owned versioned projection and failure-isolated writer after durable analysis/report readiness.
- **Prerequisites:** Phase 1 approvals; closed runtime extraction schema; authoritative owner; least-privilege role; transactional/outbox decision.
- **Protected systems:** Scanner success path and latency, deterministic scoring, report delivery, raw extraction access.
- **Likely artifacts:** Normalization contract, producer interface, idempotency design, source-to-fact lineage, migration and deployment plan.
- **Tests and evidence:** Golden contract fixtures, malformed-input rejection, duplicate delivery, partial-failure recovery, no-change scanner/report regression.
- **Rollback boundary:** Producer default off; no consumer dependency; additive data can be ignored safely.
- **Explicit exclusions:** No historical backfill, no report benchmark, no broad field admission.

### Phase 3 — Quality controls and reprocessing/idempotency

- **Objective:** Plan quality states, immutable attempts, correction/replay rules, and safe backfill/reprocessing governance.
- **Prerequisites:** Phase 2 contract; version lineage; founder-approved eligibility; privacy/retention approval.
- **Protected systems:** Existing retry/session recovery, current analysis selection, admin re-scan behavior.
- **Likely artifacts:** Quality-state machine, replay authorization, correction history, dead-letter/recovery plan, operational runbooks.
- **Tests and evidence:** Concurrent delivery, replay, supersession, correction, erasure, version drift, test/demo isolation.
- **Rollback boundary:** Stop producer/replay; never mutate canonical analysis evidence silently.
- **Explicit exclusions:** No market claims or automated cohort publication.

### Phase 4 — Server-owned aggregation and cohort safeguards

- **Objective:** Plan bounded aggregate cohorts only after sufficient governed facts exist.
- **Prerequisites:** Quality gate advanced; durable identities; monetary/opening semantics as needed; sufficient non-suppressed evidence; data-rights approvals; recurring access/index plan.
- **Protected systems:** Raw facts, contributor identity, RLS/grants, production query load.
- **Likely artifacts:** Cohort policy ADR, aggregate DTO, small-cell/concentration rules, recency and leave-one-subject-out policies.
- **Tests and evidence:** Suppression/difference-attack tests, contributor concentration, duplicate/revision exclusion, selection-bias reporting, load evidence.
- **Rollback boundary:** Aggregator and outputs disabled independently; no report dependency.
- **Explicit exclusions:** No claim of a representative market without evidence; no raw contractor or homeowner output.

### Phase 5 — Feature-flagged Truth Report benchmark integration

- **Objective:** Plan an optional aggregate-only benchmark presentation that cannot affect report success or authorization.
- **Prerequisites:** Approved cohort evidence, security/privacy/legal review, server DTO, default-off flags, rollback and monitoring.
- **Protected systems:** Preview/full separation, OTP, report RPCs, static current report behavior, teaser safety.
- **Likely artifacts:** Additive response contract, feature-flag specification, UI states for unavailable/suppressed/stale data, release plan.
- **Tests and evidence:** Authorization regression, no pre-verification leakage, flag-off parity, cohort omission, timeout/failure fallback.
- **Rollback boundary:** Disable report consumer; current report remains unchanged.
- **Explicit exclusions:** No raw fact or protected extraction delivery; no client-owned cohort query.

### Phase 6 — Operator/Oracle intelligence UI

- **Objective:** Plan an authorized operator surface over approved aggregates and quality/provenance metadata.
- **Prerequisites:** Stable server APIs, role model, audit logging, privacy/competition review, data-source labeling.
- **Protected systems:** Admin authority, report reveal, tenant isolation, raw evidence.
- **Likely artifacts:** Read-model contract, permission matrix, synthetic visual harness, operator decision workflow.
- **Tests and evidence:** Role isolation, empty/thin-data states, source labels, quoted-versus-sold separation, no raw payload exposure.
- **Rollback boundary:** UI and API disabled without affecting ingestion or reports.
- **Explicit exclusions:** No browser-side raw JSON mining; no synthetic data presented as production truth.

### Phase 7 — Monitoring, correction, retention, and governance

- **Objective:** Plan ongoing operational controls and human-gated evolution.
- **Prerequisites:** All preceding contracts; accountable owners; approved retention and incident policies.
- **Protected systems:** Logs, correction rights, erasure, deployment promotion, Oracle evolution governance.
- **Likely artifacts:** SLOs, alert policy, correction/erasure runbooks, audit records, version registry, evolution decision queue.
- **Tests and evidence:** Incident simulations, rollback drills, erasure proof, correction lineage, alert redaction, environment promotion checks.
- **Rollback boundary:** Disable affected intelligence capability while preserving current scanner/report and evidentiary history.
- **Explicit exclusions:** No autonomous schema/code/deployment mutation; every structural change remains human-approved.

## 28. Future bounded-prompt manifest

These are future planning-task descriptors only. They are not executable implementation prompts.

| Manifest ID | Title | Objective | Dependencies | Protected boundaries | Definition of done |
|---|---|---|---|---|---|
| `A05-PM-001` | Phase 1 identity and provenance planning brief | Produce the canonical entity/lifecycle ADR and provenance registry | Audit 05 approval | No source/schema/runtime edits | Founder and specialist decisions recorded; unsupported identity substitutions prohibited |
| `A05-PM-002` | Extraction contract hardening plan | Define the versioned closed response projection and compatibility strategy | A05-PM-001; extraction/QA review | Scanner behavior unchanged | Field-by-field runtime contract, errors, versions, and tests specified |
| `A05-PM-003` | Security, privacy, and data-rights closure plan | Resolve endpoint ownership, roles, retention, erasure, provider and benchmark rights | Independent reviewers | Verify-to-Reveal, private Storage, least privilege | Signed decision register and threat/data-flow model complete |
| `A05-PM-004` | Additive handoff and fact-ownership plan | Select one failure-isolated writer and transactional/idempotent handoff | PM-001–003 | Scanner/report success independent | Owner, state machine, recovery, rollback, and deprecation strategy approved |
| `A05-PM-005` | Quality and governed reprocessing plan | Define eligibility, correction, replay, and historical segmentation | PM-002–004 | No unversioned semantic claims | Quality gates, immutable attempts, and replay evidence plan approved |
| `A05-PM-006` | Cohort feasibility re-evaluation plan | Specify future safe evidence needed for cohorts | Quality gate advancement | Suppression and concentration controls | Required sample, diversity, bias, revision, and rights evidence defined |
| `A05-PM-007` | Truth Report benchmark integration plan | Define default-off aggregate DTO and failure-safe presentation | Cohort gate and independent approvals | OTP/reveal and current report unchanged | Flag-off parity, privacy, fallback, and rollback criteria approved |
| `A05-PM-008` | Oracle/operator governance plan | Define authorized aggregate intelligence UI and human-gated evolution | Server aggregation and role model | No raw browser payloads or autonomous mutation | Access, provenance, thin-data, correction, and evolution controls approved |

No implementation prompt is generated because material implementation and production gates remain unresolved.

## 29. Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Build implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|
| `A05-001` | `CONFIRMED` | Canonical repository, branch, and SHA are established | Git/read-only inspection; Audit 01 | A01-001; section 1 | Expected local identity matched | Planning can anchor to this snapshot | High | Verify remote parity before implementation |
| `A05-002` | `CONFIRMED` | Current ingestion/report architecture preserves AI/deterministic/backend/frontend separation | Current source audit | A01-004–A01-007, A01-015 | Scanner, scoring, persistence, preview/full boundaries traced | Future intelligence must remain additive | High | Regression contract in plan |
| `A05-003` | `CONFIRMED` | Handwritten Supabase migrations own repository schema intent; no ORM does | Audit 02 | A02-004–A02-007 | Generated types lag later schema | Rebind deployment and typing before implementation | High | Drift/type plan |
| `A05-004` | `CONFIRMED` | Target deployed metadata supports only the restricted source bindings | Audit 03C | Object, column, constraint, RLS, migration, role ledgers | Exact branch and role verified manually | Database planning can be bounded | High, operator-supplied | Reverify before changes |
| `A05-005` | `CONFIRMED` | Deployed extraction has only a restricted runtime-enforced subset | Audit 03D | A03D-007–A03D-015 | Broad prompt/type shape is not runtime enforced | Broad facts remain blocked | Very high | Closed versioned contract |
| `A05-006` | `CONFIRMED` | Unknown and incorrectly typed extraction fields can persist | Audit 03D | A03D-012–A03D-013 | Shallow coercion/cast preserves fields | Raw extraction cannot be fact authority | Very high | Projection/validation design |
| `A05-007` | `CONFIRMED` | Founder decisions close semantics only for restricted quality profiling | Audits 03E–03F | FD-03D-001–008; A03F-001–A03F-006 | Unsupported domains explicitly excluded | Conditional foundation planning only | High | Implementation decisions later |
| `A05-008` | `CONFIRMED` | Specialist record contains three PASS and four conditional technical reviews | Audit 03F | SR-03E-001–007 | No domain blocked restricted generation; all require later independent review | Technical review is not certification | High | Independent reviews |
| `A05-009` | `CONFIRMED` | Audit 04 final SQL source passed static independent review | Audits 04F–04G | 16 packages approved as written | Reviewed privacy and SQL controls were frozen | Results are procedurally admissible | High | Preserve source hash |
| `A05-010` | `CONFIRMED` | Preflights closed with a one-run missing-index exception | Audit 04K | PF-001–006 closeout | PF-005 never became PASS; PF-006 passed size gates | Recurring profiling remains blocked | High | Separate index/access plan |
| `A05-011` | `CONFIRMED` | Fresh application sequence produced four operational counts | Audit 04O | A04O-005–A04O-006 | 31 analysis rows, 31 sessions, 31 documents, 28 leads | Volume evidence only | High, operator-supplied | Preserve operational semantics |
| `A05-012` | `CONFIRMED` | Nine distributions were withheld by whole-distribution suppression | Audit 04O | A04O-007, A04O-010 | No label or count was released | Quality and cohort readiness remain unknown | High, operator-supplied | Do not infer or weaken |
| `A05-013` | `CONTRADICTED` | Catalog estimate 18 was an exact executed population count | Audit 04O | A04O-009, A04O-014 | Exact date-window count was 31 | Catalog estimates are sizing aids only | High | Retain distinction |
| `A05-014` | `INFERRED` | Best additive boundary is after durable complete analysis and report-ready session | Audits 01–03 | Lifecycle and boundary matrices; `SAFE_POST_ANALYSIS_BOUNDARY_INFERRED` | Report can proceed independently, but handoff is not durable | Planning may specify, not implement, the handoff | Medium-high | Transaction/outbox/idempotency decision |
| `A05-015` | `CONFIRMED` | Existing fact-like objects are not collectively authoritative | Audits 01–03F | A01-008–A01-014; FD-03D-006 | Active, provisional, dormant, and absent objects differ | One owner must be chosen deliberately | High | Ownership/deprecation ADR |
| `A05-016` | `CONFIRMED` | Current benchmark behavior is not a safe empirical cohort pipeline | Audit 01 and Audit 03 | A01-016–A01-018; security findings | Static report constants and separate unsafe refresh are disconnected | Benchmark implementation blocked | High | Cohort gates first |
| `A05-017` | `UNKNOWN` | Data rights and retention authorize derived intelligence | Audit 03 | Data-rights register and PII flows | Consent, provider, contractor, erasure, and publication rights unresolved | Implementation/production use blocked | High | Independent reviews |
| `A05-018` | `CONFIRMED` | Phase 0 SQL and full-scan authorization are consumed | Audit 04O | A04O-011 | No further SQL is authorized | Audit 05 cannot trigger more profiling | High | New authorization only if later needed |
| `A05-019` | `INFERRED` | A bounded additive foundation can be planned without resolving every downstream cohort decision | Synthesis of A05-001–A05-018 | Gate matrix and ADR | Planning can preserve exclusions and define prerequisites | Supports conditional planning verdict | High | Approve Phase 1 planning brief only |

## 30. Audit 05 handoff and Phase 0 closeout

Phase 0 is complete as an evidence-gathering suite. It established the repository and deployed target, traced the production ingestion/report path, bounded the deployed extraction contract, reconciled deployed metadata, recorded founder decisions, tested a privacy-preserving restricted profile, and preserved all material blockers.

Phase 0 did not authorize or prove an intelligence implementation. It did not establish semantic or market eligibility, cohort feasibility, benchmark validity, de-identification, production data rights, durable quote/revision/attempt identities, or a safe operational writer. Those limitations are carried forward rather than waived.

The next action is one human-approved planning task for Phase 1 identity, provenance, eligibility, strict-contract, and security/data-rights closure. No migration, source edit, database access, deployment, or report integration may be bundled into that planning task.

PHASE_0_AUDIT_SUITE: COMPLETE
AUDIT_05_READINESS_VERDICT: CONDITIONALLY_READY_FOR_BUILD_PLANNING
IMPLEMENTATION_AUTHORIZATION: NOT_AUTHORIZED
NEXT_REQUIRED_ACTION: Approve a bounded Phase 1 planning brief for canonical identity, provenance, eligibility, strict-contract, and security/data-rights closure.
