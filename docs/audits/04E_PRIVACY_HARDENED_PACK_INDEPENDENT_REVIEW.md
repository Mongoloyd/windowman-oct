# Audit 04E — Independent Review of the Privacy-Hardened Profiling Pack

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 04E — Independent Review of the Privacy-Hardened Profiling Pack |
| UTC execution time | `2026-08-31T02:55:35Z` |
| Execution environment | CODEX; local read-only artifact inspection and static SQL review |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status before Audit 04E | No tracked or staged changes; 15 pre-existing untracked audit artifacts under `docs/audits/` |
| Configured upstream | `origin/forensic_report_v2` |
| Remote | `origin` → `https://github.com/Mongoloyd/wm-mvp.git`; no credential-bearing portion observed |
| Remote parity actually verified | `NO`; no fetch or network request was made |
| Database environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD`; Supabase branch `forensic_report_v1` |
| Non-secret project identifier | `zgsofkgddpcntdvpckdq`; prohibited parent `wkrcyxcnzhwjtdpmfpaf` |
| PostgreSQL version | `17.6`, from Audit 03C |
| Production read authorization used | `NONE`; this review did not access production |
| Network authorization used | `NONE`; network access was prohibited |
| Applicable governance | `AGENTS.md`; Audits 00, 03C–04D; operator Audit 04E prompt |
| Audit status | `COMPLETE_WITH_BLOCKERS` |
| Auditor limitations | Static text review only; no PostgreSQL parser, planner, permission, data, performance, timeout, database, service, Storage, log, network, build, test, or runtime proof |

## 2. Scope and proof limitations

This audit independently reviews Audit 04D rather than inheriting its assembly claims. Static compatibility means only that no incompatibility was identified by text inspection. It does not prove PostgreSQL parsing, planning, permissions, workload, timeout behavior, data-dependent suppression, Dashboard target identity, or execution safety.

The Supabase/PostgreSQL guidance reinforces least privilege, explicit JSON safety, short timeout-protected transactions, and index review. The expected role has `BYPASSRLS=true`; therefore exact SQL, relation allowlisting, aggregate projections, suppression, and execution discipline—not RLS—form the privacy boundary.

No SQL, database, network, Supabase CLI, external service, build, test, linter, type check, formatter, or generator was executed.

## 3. Authorized-input manifest with hashes

| Input | Bytes | Lines | SHA-256 |
|---|---:|---:|---|
| `docs\audits\00_AUDIT_PROTOCOL_AND_SEQUENCE.md` | 14,222 | 436 | `B690A53F0D3A32076F337F10E4EB8A652E2E98018EF7A601425A2FE866DD0383` |
| `docs\audits\03C_SCHEMA_BINDING_EXECUTION_RESULTS.md` | 35,303 | 323 | `5B43395FF47EDE83855A9F5EE6ECE7CED82BC8A634784FC8557A4F7FF2DB7564` |
| `docs\audits\03D_DEPLOYED_EXTRACTION_CONTRACT_AUDIT.md` | 57,961 | 476 | `3EECD8FEE831B25D9EBBDD8821AC447F89CBB7E44386B916AE0D822213C84317` |
| `docs\audits\03E_SEMANTIC_BINDING_DECISION_REGISTER.md` | 52,438 | 662 | `092152A16619BFF99A33D9DCF53900871D89B4EBFB2A9D3A7B700F75988C9805` |
| `docs\audits\03F_SEMANTIC_BINDING_APPROVAL_AND_SPECIALIST_REVIEW.md` | 35,846 | 534 | `EBF60210AC29BCE10B52089751D07307BF6D0F61D769AA02ADA1C9CB3F60090B` |
| `docs\audits\04_DATA_PROFILING_QUERY_GENERATOR.md` | 86,612 | 1,586 | `618BDF0124D90952859C56B1F077336DB4BC0A762BED996D64DA7C8965742CFC` |
| `docs\audits\04A_TECHNICAL_SQL_REVIEW_AND_OPERATOR_DECISION_RECORD.md` | 44,383 | 575 | `85BE6C446B253D992370E48531878395846B0A00F9CE7236FEC3CD1646B48D29` |
| `docs\audits\04B_CORRECTED_DATA_PROFILING_QUERY_PACK.md` | 97,777 | 1,778 | `E0FD036C406DBC751CBBD5221E75A7DA643DDA5348E32940A2D7BE94316BA78E` |
| `docs\audits\04C_CORRECTED_PACK_TECHNICAL_REVIEW.md` | 91,722 | 1,850 | `3AC8CE43C7ACDF9337C282938089AFA100D5166A418796F208673583C6845ADC` |
| `docs\audits\04D_PRIVACY_HARDENED_DATA_PROFILING_QUERY_PACK.md` | 133,770 | 2,694 | `EC10D1A689042DAA82839FF8DFAEB33320BC9A46672A014DCE61F526C051B6FD` |

All ten inputs existed and were read completely. Section 20 records the post-write rehash requirement.

## 4. Entry-validation results

| Gate | Result | Evidence |
|---|---|---|
| Ten authorized inputs exist | PASS | A04E-001 |
| Audit 04D exact size, lines, and SHA-256 | PASS | A04E-002 |
| Six unique preflight IDs and ten unique application IDs | PASS | A04E-003 |
| No missing or duplicate query ID | PASS | A04E-003 |
| Audit 04D exact terminal state | PASS | A04E-004 |
| Eight preserved SQL blocks equal Audit 04B | PASS | A04E-005 |
| Eight incorporated SQL blocks equal Audit 04C | PASS | A04E-006 |
| Audit 04E output absent before creation | PASS | A04E-007 |
| Initial tracked/staged diff empty | PASS | A04E-008 |

### Pre-flight terminal command ledger

| Command | Exit code | Sanitized result |
|---|---:|---|
| `Get-Location` | N/A; PowerShell cmdlet | `C:\Projects\wm-mvp-github-clean` |
| `git rev-parse --show-toplevel` | 0 | `C:/Projects/wm-mvp-github-clean` |
| `git rev-parse --abbrev-ref HEAD` | 0 | `forensic_report_v2` |
| `git rev-parse HEAD` | 0 | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| `git status --short` | 0 | No tracked/staged changes; 15 pre-existing untracked audit artifacts |
| `git branch -vv` | 0 | Active branch tracks `origin/forensic_report_v2` |
| `git remote -v` | 0 | Origin URL shown above; no embedded credential observed |
| Input-identity PowerShell block | N/A | Ten files hashed/read |
| `rg` query-heading inventory | 0 | Six PF and ten PR headings |
| `rg` structural-control inventory | 0 | Sixteen query wrappers plus documentation references |

The Git warning that the global ignore file was inaccessible did not change Git’s successful exit codes. Live remote parity remains unverified.

## 5. Query inventory

| Class | IDs | Count | Frozen source |
|---|---|---:|---|
| PREFLIGHT | `A04-PF-001`–`A04-PF-006` | 6 | PostgreSQL catalogs/information schema only |
| APPLICATION_PROFILE | `A04-PR-001`–`A04-PR-010` | 10 | `public.analyses`, `public.scan_sessions`, `public.quote_files`, `public.leads` only |

All sixteen packages retain a read-only transaction, the three timeouts, frozen search path, terminal rollback, positive output documentation, and an output maximum of 100 or fewer. PR-001 is an ungrouped scalar aggregate with a static one-row maximum; PR-002–010 use `LIMIT 100`.

## 6. Query-by-query status table

| Query | Status | Static compatibility and scope | Privacy/JSON assessment | Runtime dependency / required action |
|---|---|---|---|---|
| A04-PF-001 | APPROVED_AS_WRITTEN | Catalog/session metadata; one row | No application values | Dashboard branch ref still requires operator confirmation |
| A04-PF-002 | APPROVED_AS_WRITTEN | Exact four-relation metadata check | No application rows | Require exact expected rows |
| A04-PF-003 | APPROVED_AS_WRITTEN | Exact required-column/type/nullability check | No application rows | Require exact expected rows |
| A04-PF-004 | APPROVED_AS_WRITTEN | Exact constraint comparison | No application rows | Require exact expected rows |
| A04-PF-005 | APPROVED_AS_WRITTEN | Bounded index metadata | Exactly 100 rows is truncation-ambiguous | Hard stop at 100 rows |
| A04-PF-006 | APPROVED_AS_WRITTEN | Catalog estimates and relation sizes | No application values | Negative/unavailable/oversize values hard-stop |
| A04-PR-001 | APPROVED_AS_WRITTEN | Four allowed sources; frozen date; one scalar row | Aggregate distinct counts only | Quiescence required before combining with subset outputs |
| A04-PR-002 | APPROVED_AS_WRITTEN | Fixed analysis states; shared A/J/Q/R gate | Local bucket and complement protection coherent | Same-run/no-write control required |
| A04-PR-003 | APPROVED_AS_WRITTEN | Fixed session states; shared A/J/Q/R gate | Local bucket and complement protection coherent | Same-run/no-write control required |
| A04-PR-004 | APPROVED_AS_WRITTEN | First-failure partition of date population | Parent-first CASE guards; whole-distribution suppression | Same-run/no-write control required with subset queries |
| A04-PR-005 | APPROVED_AS_WRITTEN | Shared gate plus PR-004 funnel and entity gates | Array length is CASE-guarded; no identifiers output | Same-run/no-write control required |
| A04-PR-006 | APPROVED_AS_WRITTEN | Fixed confidence buckets over Q | Shared and bucket gates coherent | Same-run/no-write control required |
| A04-PR-007 | APPROVED_AS_WRITTEN | Fixed document-validity states over Q | Shared and bucket gates coherent | Same-run/no-write control required |
| A04-PR-008 | APPROVED_AS_WRITTEN | Fixed line-item array states over Q | CASE branch order safely guards every array-length call | Same-run/no-write control required |
| A04-PR-009 | REQUIRES_CORRECTION | Intended scope and output remain authorized | `jsonb_array_elements` receives an unguarded path expression after a foldable filtering CTE | Guard the function argument directly; complete proposal in section 15 |
| A04-PR-010 | REQUIRES_CORRECTION | Shape/length suppression and successful-empty behavior are coherent | Same unguarded set-returning function argument as PR-009 | Guard the function argument directly; complete proposal in section 15 |

Totals: 14 `APPROVED_AS_WRITTEN`, 2 `REQUIRES_CORRECTION`, 0 `REJECTED`.

## 7. Detailed review of all eight incorporated replacements

Definitions used below:

- A = all analyses in the frozen persistence interval.
- J = rows with joined session/document/lead and `is_test=false`.
- Q = J rows with complete analysis and a successful session state.
- R = Q rows satisfying the restricted document/confidence/type/JSON/line-item predicate.
- G = the shared gate over A/J/Q/R counts for analysis, session, document, and lead units plus every A−J, A−Q, A−R, J−Q, J−R, and Q−R complement.

| Query | Population and local gate | Shared-gate correctness | Zero/empty behavior | Independent status |
|---|---|---|---|---|
| PR-002 | J analysis-status buckets | G covers every externally comparable A/J/Q/R count and complement; local states suppress 1–4 | Empty J yields zero rows safely | APPROVED_AS_WRITTEN |
| PR-003 | J session-status buckets | Same specific J/Q/R relationships are correctly represented for distinct sessions | Empty J yields zero rows safely | APPROVED_AS_WRITTEN |
| PR-005 | R entity totals plus complete PR-004 first-failure partition | G, funnel gate, and entity gates jointly suppress all metrics; PR-004 logic is reproduced | Zero R produces an unsuppressed zero aggregate only when no protected complement is 1–4 | APPROVED_AS_WRITTEN |
| PR-006 | Q confidence buckets | G protects all parent/subset differences; local fixed buckets protect cells | Empty Q yields zero rows safely | APPROVED_AS_WRITTEN |
| PR-007 | Q document-validity buckets | G protects all parent/subset differences; local fixed buckets protect cells | Empty Q yields zero rows safely | APPROVED_AS_WRITTEN |
| PR-008 | Q array-state buckets | G protects all parent/subset differences; local fixed states protect cells; no expansion | Empty Q yields zero rows safely | APPROVED_AS_WRITTEN |
| PR-009 | R line-item description-shape buckets | G and local shape gate close the prior disclosure paths; units differ from parent entities | Empty R yields zero rows, but array expansion is not guarded at its argument | REQUIRES_CORRECTION |
| PR-010 | R nonempty description-length buckets plus PR-009 shape gate | G plus shape and length gates prevent reconstruction of a suppressed `nonempty` count | No nonempty items yields safe `SUCCESSFUL_EMPTY`; expansion defect remains | REQUIRES_CORRECTION |

G is deliberately conservative: it suppresses when any protected population count itself or any pairwise complement is 1–4, even when a particular query would not expose all such values. This does not create an output leak because G is internal and releases only a Boolean decision.

## 8. JSON-safety review

| Query | JSON operation | Structural result |
|---|---|---|
| PR-002/003/006/007 | `jsonb_typeof`, `->`, CASE-guarded `jsonb_array_length` for R membership | SAFE BY STATIC INSPECTION |
| PR-004 | Parent-first CASE: null/type branches precede `jsonb_array_length` | SAFE BY STATIC INSPECTION |
| PR-005 | CASE-guarded R membership; duplicated PR-004 CASE is also ordered safely | SAFE BY STATIC INSPECTION |
| PR-008 | CASE classifies missing/wrong type before every length bucket | SAFE BY STATIC INSPECTION |
| PR-009 | R membership is safe, but `jsonb_array_elements(path)` relies on the filtered `restricted_parent` CTE being enforced before the set-returning function | CORRECTABLE DEFECT |
| PR-010 | Same set-returning function pattern as PR-009 | CORRECTABLE DEFECT |

The PR-009/010 defect is not that a known non-array necessarily reaches the function under the expected plan. The defect is that the function argument itself is not type-safe and the CTE is not declared `MATERIALIZED`; therefore static SQL does not establish a planner-independent safety barrier. The narrow repair wraps the argument in a `CASE` that returns the confirmed array or `[]::jsonb`.

For line-item elements, non-object values are classified as `wrong_type`. JSON extraction operators yield safe null states for absent/nonmatching description members, and the CASE expressions prevent content from reaching output. No query projects raw JSON or description content.

JSON-safety verdict: `CORRECTION_REQUIRED_FOR_PR_009_AND_PR_010`.

## 9. Complete 45-pair disclosure matrix

The shared G gate resolves the same-snapshot subtraction defects. Pairs marked conditional still require one unchanged population across separate executions. “Overlap” means populations intersect, but dimensions or entity units do not establish an exact hidden cell.

| Pair | Shared population / denominator / unit | Algebra and suppression interaction | Separate-snapshot control | Classification |
|---|---|---|---|---|
| 1/2 | A versus J; analysis/session/document/lead | A−J exact; PR-002 G suppresses 1–4 | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/3 | A versus J; entity counts | A−J exact; PR-003 G suppresses 1–4 | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/4 | A scalar totals versus A first-failure partition | PR-004 hides its entire partition if any cell is 1–4; no hidden label/count is recoverable | Not disclosure-critical | NO_RECONSTRUCTION_PATH_IDENTIFIED |
| 1/5 | A versus R; entity counts | A−R exact; PR-005 G suppresses 1–4 | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/6 | A versus Q; analysis/entity counts | A−Q exact; PR-006 G suppresses 1–4 | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/7 | A versus Q | A−Q exact; PR-007 G suppresses 1–4 | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/8 | A versus Q | A−Q exact; PR-008 G suppresses 1–4 | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/9 | A entities versus R line items | Different units; no exact subtraction/sum identifies a hidden cell | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 1/10 | A entities versus R nonempty line items | Different units | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 2/3 | Same J rows expressed as analysis/session distributions | Totals coincide under deployed one-analysis-per-session constraint; both use G | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/4 | J versus A partition | A−J exact; PR-002 G protects complement | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/5 | J versus R | J−R exact; both shared gates protect | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/6 | J complete state versus Q | J−Q and complete-minus-successful relationships protected by G/local buckets | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/7 | J versus Q | J−Q protected by G | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/8 | J versus Q | J−Q protected by G | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/9 | J analysis states versus R line-item shapes | Different units and nested dimensions | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 2/10 | J analysis states versus R length buckets | Different units | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 3/4 | J sessions versus A partition | A−J exact under one-to-one constraint; PR-003 G protects | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/5 | J versus R sessions/entities | J−R exact; shared gates protect | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/6 | Successful J sessions versus Q | Difference protected by G/local states | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/7 | J versus Q | J−Q protected by G | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/8 | J versus Q | J−Q protected by G | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/9 | J session states versus R line-item shapes | Different units | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 3/10 | J session states versus R length buckets | Different units | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 4/5 | A partition versus R entities | PR-005 repeats PR-004 gate and G; A−R protected | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 4/6 | A partition versus Q confidence | A−Q exact; PR-006 G protects | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 4/7 | A partition versus Q validity | A−Q protected | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 4/8 | A partition versus Q array states | A−Q protected | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 4/9 | A analysis states versus R line-item shapes | Different units | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 4/10 | A analysis states versus R length buckets | Different units | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 5/6 | R versus Q | Q−R exact; both shared gates protect | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 5/7 | R versus Q | Q−R protected | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 5/8 | R versus Q | Q−R protected | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 5/9 | R parent entities versus R line-item shapes | Parent and element units differ | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 5/10 | R parent entities versus R length buckets | Parent and element units differ | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 6/7 | Same Q analysis population, different marginal dimensions | Totals must coincide; each local bucket distribution suppresses small cells | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 6/8 | Same Q population, different marginals | Totals coincide; no cross-tab is exposed | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 6/9 | Q analyses versus R line items | Different units and nested populations | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 6/10 | Q analyses versus R nonempty line items | Different units | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 7/8 | Same Q population, different marginals | Totals coincide; no cross-tab is exposed | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 7/9 | Q analyses versus R line-item shapes | Different units | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 7/10 | Q analyses versus R length buckets | Different units | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 8/9 | Q parent array states versus R element shapes | Parent versus element units; no exact hidden cell | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 8/10 | Q parent array states versus R element lengths | Parent versus element units | Preserve one run | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 9/10 | Same expanded R line items | Length buckets sum PR-009 `nonempty`; PR-010 repeats shape and length gates | Required | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |

Pair totals:

- `NO_RECONSTRUCTION_PATH_IDENTIFIED`: 1
- `OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE`: 16
- `CONDITIONAL_EXECUTION_CONTROL_REQUIRED`: 28
- `CONFIRMED_RECONSTRUCTION_DEFECT`: 0
- Total: 45

## 10. Comparison with Audit 04C’s 22 confirmed defects

Each prior exact subtraction path is blocked within the replacement query by G. Because the broad and subset queries execute separately, each moves to conditional rather than unconditional clearance.

| Prior defect pair | Audit 04C failure | Audit 04D same-snapshot result | Audit 04E classification |
|---|---|---|---|
| 1/2 | A−J | G protects A, J, and A−J | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/3 | A−J | G protects A, J, and A−J | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/5 | A−R | G protects A, R, and A−R | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/6 | A−Q | G protects A, Q, and A−Q | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/7 | A−Q | G protects A, Q, and A−Q | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/8 | A−Q | G protects A, Q, and A−Q | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/4 | A−J | PR-002 G protects complement to PR-004 total | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/5 | J−R | Both replacement gates protect | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/6 | J−Q | Both replacement gates protect | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/7 | J−Q | Both replacement gates protect | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/8 | J−Q | Both replacement gates protect | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/4 | A−J | PR-003 G protects complement to PR-004 total | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/5 | J−R | Both replacement gates protect | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/6 | J−Q | Both replacement gates protect | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/7 | J−Q | Both replacement gates protect | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/8 | J−Q | Both replacement gates protect | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 4/6 | A−Q | PR-006 G protects complement | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 4/7 | A−Q | PR-007 G protects complement | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 4/8 | A−Q | PR-008 G protects complement | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 5/6 | Q−R | Both replacement gates protect | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 5/7 | Q−R | Both replacement gates protect | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 5/8 | Q−R | Both replacement gates protect | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |

Result: all 22 prior same-snapshot defects are structurally resolved. All 22 remain conditional on an unchanged population across separate execution. No prior defect is silently dropped.

## 11. Execution-consistency and quiescence assessment

Classification: `TECHNICALLY_SPECIFIED_AWAITING_OPERATOR_PROOF`.

Audit 04D explicitly requires:

- No relevant writes to the four sources during the application run.
- One uninterrupted run.
- Preflights accepted immediately beforehand.
- Related queries adjacent.
- No isolated retry.
- Whole-run invalidation after timeout, error, reset, drift, unexpected output, or suspected write.
- No combination of outputs from different runs.

These controls are technically coherent and could preserve the same effective population, but the SQL Editor cannot prove that other writers were quiescent. Operator evidence must identify who can write, how writes are paused or excluded, the start/end time, and who attests to the no-write interval. Until then:

`IF_QUIESCENCE_CANNOT_BE_CONFIRMED_APPLICATION_EXECUTION_IS_BLOCKED`

## 12. Operational-limit assessment

| Limit/control | Static finding | Remaining proof |
|---|---|---|
| Read-only transaction | Present in all 16 SQL blocks | Runtime transaction state unproven |
| Statement timeout 10s | Present | Runtime load/timeout unproven |
| Lock timeout 1s | Present | Runtime lock behavior unproven |
| Idle timeout 15s | Present | Session behavior unproven |
| Output maximum | PR-001 scalar one row; all other PRs ≤100 | Actual result shape unproven |
| Source row threshold | PF-006 compares estimates to 10,000 | Estimate freshness/accuracy limited |
| Combined source bytes | PF-006 compares to 50,000,000 | Actual scan bytes unproven |
| Index dependency | PF-005 inventories relevant indexes | Planning/use unproven |
| JSON expansion | PR-009/010 can multiply parent rows by array length | Statement timeout only; fix JSON argument before any execution decision |
| Error cleanup | Explicit reviewed rollback or session discard required | Operator runbook not yet approved |

## 13. Special-case assessment

| Special case | Finding |
|---|---|
| PF-005 exactly 100 rows | Correctly documented as `HARD_STOP_TRUNCATION_AMBIGUOUS` |
| PF-006 negative/unavailable estimate | Correctly hard-stopped |
| Missing `analyses.created_at` index | Correctly requires explicit bounded-full-scan review after PF-006 |
| PR-010 zero rows | Correctly classified `SUCCESSFUL_EMPTY`, not suppression/failure |
| Timeout/error cleanup | Correctly requires separately reviewed rollback or full session discard |
| `BYPASSRLS=true` | Correctly treated as requiring exact-query/projection safety rather than RLS reliance |

## 14. Findings ordered by severity

| Evidence ID | Severity | Finding | Affected query/scope | Required action |
|---|---|---|---|---|
| A04E-009 | HIGH | Set-returning JSON expansion argument is not intrinsically type-safe and depends on filtered-CTE/planner placement | PR-009, PR-010 | Apply section 15 replacements and independently re-review |
| A04E-010 | HIGH | Cross-query suppression safety depends on an operator-proven no-write interval | All 28 conditional pairs | Provide quiescence proof before application execution |
| A04E-011 | MEDIUM | JSON array expansion may multiply up to the data-dependent element count | PR-009, PR-010 | Require accepted size/index preflights and timeout; runtime remains unproven |
| A04E-012 | MEDIUM | Exactly 100 PF-005 rows cannot prove an untruncated index inventory | PF-005 | Preserve hard stop |
| A04E-013 | MEDIUM | Timeout/error may prevent the terminal rollback statement from being reached | All queries | Reviewed explicit rollback or session discard |
| A04E-014 | INFORMATIONAL | All 22 prior same-snapshot disclosure paths are blocked by G | PR-002/003/005–010 with PR-001/004 relationships | Preserve gates; retain quiescence condition |
| A04E-015 | INFORMATIONAL | No prohibited output projection or raw-content path was identified | All queries | Verify actual output columns if later executed |

## 15. Complete replacement SQL for correctable defects

Both proposals preserve the exact frozen sources, date interval, output columns, local/global suppression gates, and query purpose. The only material SQL change is a direct `CASE` guard around the `jsonb_array_elements` argument.

### A04-PR-009

`PROPOSED_REPLACEMENT_SQL_NOT_AUTHORIZED`

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH date_population AS (
  SELECT
    a.id AS analysis_id,
    a.analysis_status,
    a.document_is_window_door_related,
    a.confidence_score,
    a.document_type,
    a.full_json,
    s.id AS scan_session_id,
    s.status AS scan_session_status,
    qf.id AS uploaded_document_id,
    l.id AS lead_id,
    l.is_test
  FROM public.analyses AS a
  LEFT JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  LEFT JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  LEFT JOIN public.leads AS l ON l.id = a.lead_id
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), joined_flagged AS (
  SELECT
    date_population.*,
    (
      scan_session_id IS NOT NULL
      AND uploaded_document_id IS NOT NULL
      AND lead_id IS NOT NULL
      AND is_test IS FALSE
    ) AS is_joined_non_test
  FROM date_population
), quality_flagged AS (
  SELECT
    joined_flagged.*,
    (
      is_joined_non_test
      AND analysis_status = 'complete'
      AND scan_session_status IN ('preview_ready', 'awaiting_verification', 'revealed')
    ) AS is_quality_precursor
  FROM joined_flagged
), population_flagged AS (
  SELECT
    quality_flagged.*,
    (
      is_quality_precursor
      AND document_is_window_door_related IS TRUE
      AND confidence_score BETWEEN 0.4 AND 1
      AND document_type IS NOT NULL
      AND btrim(document_type) <> ''
      AND lower(btrim(document_type)) <> 'unknown'
      AND full_json IS NOT NULL
      AND jsonb_typeof(full_json) = 'object'
      AND jsonb_typeof(full_json -> 'extraction') = 'object'
      AND CASE
        WHEN jsonb_typeof(full_json -> 'extraction' -> 'line_items') = 'array'
        THEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') >= 1
        ELSE false
      END
    ) AS is_restricted
  FROM quality_flagged
), population_counts AS (
  SELECT
    COUNT(*) AS all_analysis_count,
    COUNT(DISTINCT scan_session_id) AS all_session_count,
    COUNT(DISTINCT uploaded_document_id) AS all_document_count,
    COUNT(DISTINCT lead_id) AS all_lead_count,
    COUNT(*) FILTER (WHERE is_joined_non_test) AS joined_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_joined_non_test) AS joined_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_joined_non_test) AS joined_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_joined_non_test) AS joined_lead_count,
    COUNT(*) FILTER (WHERE is_quality_precursor) AS quality_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_quality_precursor) AS quality_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_quality_precursor) AS quality_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_quality_precursor) AS quality_lead_count,
    COUNT(*) FILTER (WHERE is_restricted) AS restricted_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_restricted) AS restricted_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_restricted) AS restricted_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_restricted) AS restricted_lead_count
  FROM population_flagged
), privacy_values AS (
  SELECT privacy_value
  FROM population_counts AS pc
  CROSS JOIN LATERAL (
    VALUES
      (pc.all_analysis_count), (pc.all_session_count), (pc.all_document_count), (pc.all_lead_count),
      (pc.joined_analysis_count), (pc.joined_session_count), (pc.joined_document_count), (pc.joined_lead_count),
      (pc.quality_analysis_count), (pc.quality_session_count), (pc.quality_document_count), (pc.quality_lead_count),
      (pc.restricted_analysis_count), (pc.restricted_session_count), (pc.restricted_document_count), (pc.restricted_lead_count),
      (pc.all_analysis_count - pc.joined_analysis_count),
      (pc.all_session_count - pc.joined_session_count),
      (pc.all_document_count - pc.joined_document_count),
      (pc.all_lead_count - pc.joined_lead_count),
      (pc.all_analysis_count - pc.quality_analysis_count),
      (pc.all_session_count - pc.quality_session_count),
      (pc.all_document_count - pc.quality_document_count),
      (pc.all_lead_count - pc.quality_lead_count),
      (pc.all_analysis_count - pc.restricted_analysis_count),
      (pc.all_session_count - pc.restricted_session_count),
      (pc.all_document_count - pc.restricted_document_count),
      (pc.all_lead_count - pc.restricted_lead_count),
      (pc.joined_analysis_count - pc.quality_analysis_count),
      (pc.joined_session_count - pc.quality_session_count),
      (pc.joined_document_count - pc.quality_document_count),
      (pc.joined_lead_count - pc.quality_lead_count),
      (pc.joined_analysis_count - pc.restricted_analysis_count),
      (pc.joined_session_count - pc.restricted_session_count),
      (pc.joined_document_count - pc.restricted_document_count),
      (pc.joined_lead_count - pc.restricted_lead_count),
      (pc.quality_analysis_count - pc.restricted_analysis_count),
      (pc.quality_session_count - pc.restricted_session_count),
      (pc.quality_document_count - pc.restricted_document_count),
      (pc.quality_lead_count - pc.restricted_lead_count)
  ) AS protected_values(privacy_value)
), related_population_gate AS (
  SELECT
    COALESCE(bool_or(privacy_value BETWEEN 1 AND 4), false)
      AS suppress_related_population
  FROM privacy_values
),
restricted_parent AS (
  SELECT full_json
  FROM population_flagged
  WHERE is_restricted
), classified AS (
  SELECT
    CASE
      WHEN jsonb_typeof(line_item.value) <> 'object' THEN 'wrong_type'
      WHEN line_item.value -> 'description' IS NULL THEN 'missing'
      WHEN jsonb_typeof(line_item.value -> 'description') <> 'string' THEN 'wrong_type'
      WHEN length(line_item.value ->> 'description') = 0 THEN 'empty'
      ELSE 'nonempty'
    END AS description_shape_state
  FROM restricted_parent
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(
        restricted_parent.full_json -> 'extraction' -> 'line_items'
      ) = 'array'
      THEN restricted_parent.full_json -> 'extraction' -> 'line_items'
      ELSE '[]'::jsonb
    END
  ) AS line_item(value)
), bucket_counts AS (
  SELECT description_shape_state, COUNT(*) AS extracted_line_item_count
  FROM classified
  GROUP BY description_shape_state
  HAVING COUNT(*) > 0
), bucket_gate AS (
  SELECT COALESCE(bool_or(extracted_line_item_count BETWEEN 1 AND 4), false) AS suppress_bucket
  FROM bucket_counts
), decision AS (
  SELECT
    bucket_gate.suppress_bucket
    OR related_population_gate.suppress_related_population AS suppress_distribution
  FROM bucket_gate
  CROSS JOIN related_population_gate
), output_rows AS (
  SELECT
    true AS distribution_suppressed,
    5 AS suppression_threshold,
    NULL::text AS description_shape_state,
    NULL::bigint AS extracted_line_item_count
  FROM decision
  WHERE suppress_distribution
  UNION ALL
  SELECT
    false,
    5,
    bucket_counts.description_shape_state,
    bucket_counts.extracted_line_item_count
  FROM bucket_counts
  CROSS JOIN decision
  WHERE NOT suppress_distribution
)
SELECT
  distribution_suppressed,
  suppression_threshold,
  description_shape_state,
  extracted_line_item_count
FROM output_rows
ORDER BY description_shape_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

### A04-PR-010

`PROPOSED_REPLACEMENT_SQL_NOT_AUTHORIZED`

```sql
BEGIN TRANSACTION READ ONLY;

SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL search_path = pg_catalog, information_schema, public;

WITH date_population AS (
  SELECT
    a.id AS analysis_id,
    a.analysis_status,
    a.document_is_window_door_related,
    a.confidence_score,
    a.document_type,
    a.full_json,
    s.id AS scan_session_id,
    s.status AS scan_session_status,
    qf.id AS uploaded_document_id,
    l.id AS lead_id,
    l.is_test
  FROM public.analyses AS a
  LEFT JOIN public.scan_sessions AS s ON s.id = a.scan_session_id
  LEFT JOIN public.quote_files AS qf ON qf.id = s.quote_file_id
  LEFT JOIN public.leads AS l ON l.id = a.lead_id
  WHERE a.created_at >= TIMESTAMPTZ '2026-01-01T00:00:00Z'
    AND a.created_at < TIMESTAMPTZ '2026-08-31T00:35:24Z'
), joined_flagged AS (
  SELECT
    date_population.*,
    (
      scan_session_id IS NOT NULL
      AND uploaded_document_id IS NOT NULL
      AND lead_id IS NOT NULL
      AND is_test IS FALSE
    ) AS is_joined_non_test
  FROM date_population
), quality_flagged AS (
  SELECT
    joined_flagged.*,
    (
      is_joined_non_test
      AND analysis_status = 'complete'
      AND scan_session_status IN ('preview_ready', 'awaiting_verification', 'revealed')
    ) AS is_quality_precursor
  FROM joined_flagged
), population_flagged AS (
  SELECT
    quality_flagged.*,
    (
      is_quality_precursor
      AND document_is_window_door_related IS TRUE
      AND confidence_score BETWEEN 0.4 AND 1
      AND document_type IS NOT NULL
      AND btrim(document_type) <> ''
      AND lower(btrim(document_type)) <> 'unknown'
      AND full_json IS NOT NULL
      AND jsonb_typeof(full_json) = 'object'
      AND jsonb_typeof(full_json -> 'extraction') = 'object'
      AND CASE
        WHEN jsonb_typeof(full_json -> 'extraction' -> 'line_items') = 'array'
        THEN jsonb_array_length(full_json -> 'extraction' -> 'line_items') >= 1
        ELSE false
      END
    ) AS is_restricted
  FROM quality_flagged
), population_counts AS (
  SELECT
    COUNT(*) AS all_analysis_count,
    COUNT(DISTINCT scan_session_id) AS all_session_count,
    COUNT(DISTINCT uploaded_document_id) AS all_document_count,
    COUNT(DISTINCT lead_id) AS all_lead_count,
    COUNT(*) FILTER (WHERE is_joined_non_test) AS joined_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_joined_non_test) AS joined_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_joined_non_test) AS joined_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_joined_non_test) AS joined_lead_count,
    COUNT(*) FILTER (WHERE is_quality_precursor) AS quality_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_quality_precursor) AS quality_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_quality_precursor) AS quality_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_quality_precursor) AS quality_lead_count,
    COUNT(*) FILTER (WHERE is_restricted) AS restricted_analysis_count,
    COUNT(DISTINCT scan_session_id) FILTER (WHERE is_restricted) AS restricted_session_count,
    COUNT(DISTINCT uploaded_document_id) FILTER (WHERE is_restricted) AS restricted_document_count,
    COUNT(DISTINCT lead_id) FILTER (WHERE is_restricted) AS restricted_lead_count
  FROM population_flagged
), privacy_values AS (
  SELECT privacy_value
  FROM population_counts AS pc
  CROSS JOIN LATERAL (
    VALUES
      (pc.all_analysis_count), (pc.all_session_count), (pc.all_document_count), (pc.all_lead_count),
      (pc.joined_analysis_count), (pc.joined_session_count), (pc.joined_document_count), (pc.joined_lead_count),
      (pc.quality_analysis_count), (pc.quality_session_count), (pc.quality_document_count), (pc.quality_lead_count),
      (pc.restricted_analysis_count), (pc.restricted_session_count), (pc.restricted_document_count), (pc.restricted_lead_count),
      (pc.all_analysis_count - pc.joined_analysis_count),
      (pc.all_session_count - pc.joined_session_count),
      (pc.all_document_count - pc.joined_document_count),
      (pc.all_lead_count - pc.joined_lead_count),
      (pc.all_analysis_count - pc.quality_analysis_count),
      (pc.all_session_count - pc.quality_session_count),
      (pc.all_document_count - pc.quality_document_count),
      (pc.all_lead_count - pc.quality_lead_count),
      (pc.all_analysis_count - pc.restricted_analysis_count),
      (pc.all_session_count - pc.restricted_session_count),
      (pc.all_document_count - pc.restricted_document_count),
      (pc.all_lead_count - pc.restricted_lead_count),
      (pc.joined_analysis_count - pc.quality_analysis_count),
      (pc.joined_session_count - pc.quality_session_count),
      (pc.joined_document_count - pc.quality_document_count),
      (pc.joined_lead_count - pc.quality_lead_count),
      (pc.joined_analysis_count - pc.restricted_analysis_count),
      (pc.joined_session_count - pc.restricted_session_count),
      (pc.joined_document_count - pc.restricted_document_count),
      (pc.joined_lead_count - pc.restricted_lead_count),
      (pc.quality_analysis_count - pc.restricted_analysis_count),
      (pc.quality_session_count - pc.restricted_session_count),
      (pc.quality_document_count - pc.restricted_document_count),
      (pc.quality_lead_count - pc.restricted_lead_count)
  ) AS protected_values(privacy_value)
), related_population_gate AS (
  SELECT
    COALESCE(bool_or(privacy_value BETWEEN 1 AND 4), false)
      AS suppress_related_population
  FROM privacy_values
),
restricted_parent AS (
  SELECT full_json
  FROM population_flagged
  WHERE is_restricted
), expanded AS (
  SELECT
    CASE
      WHEN jsonb_typeof(line_item.value) <> 'object' THEN 'wrong_type'
      WHEN line_item.value -> 'description' IS NULL THEN 'missing'
      WHEN jsonb_typeof(line_item.value -> 'description') <> 'string' THEN 'wrong_type'
      WHEN length(line_item.value ->> 'description') = 0 THEN 'empty'
      ELSE 'nonempty'
    END AS description_shape_state,
    CASE
      WHEN jsonb_typeof(line_item.value) = 'object'
       AND jsonb_typeof(line_item.value -> 'description') = 'string'
       AND length(line_item.value ->> 'description') >= 1
      THEN length(line_item.value ->> 'description')
      ELSE NULL::integer
    END AS description_length
  FROM restricted_parent
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(
        restricted_parent.full_json -> 'extraction' -> 'line_items'
      ) = 'array'
      THEN restricted_parent.full_json -> 'extraction' -> 'line_items'
      ELSE '[]'::jsonb
    END
  ) AS line_item(value)
), shape_bucket_counts AS (
  SELECT description_shape_state, COUNT(*) AS extracted_line_item_count
  FROM expanded
  GROUP BY description_shape_state
  HAVING COUNT(*) > 0
), shape_gate AS (
  SELECT COALESCE(bool_or(extracted_line_item_count BETWEEN 1 AND 4), false) AS suppress_shape
  FROM shape_bucket_counts
), length_bucket_counts AS (
  SELECT
    CASE
      WHEN description_length <= 80 THEN 'short_1_to_80'
      WHEN description_length <= 240 THEN 'medium_81_to_240'
      WHEN description_length <= 500 THEN 'long_241_to_500'
      ELSE 'oversized_501_plus'
    END AS description_length_state,
    COUNT(*) AS extracted_line_item_count
  FROM expanded
  WHERE description_length IS NOT NULL
  GROUP BY description_length_state
  HAVING COUNT(*) > 0
), length_gate AS (
  SELECT COALESCE(bool_or(extracted_line_item_count BETWEEN 1 AND 4), false) AS suppress_length
  FROM length_bucket_counts
), decision AS (
  SELECT
    shape_gate.suppress_shape
    OR length_gate.suppress_length
    OR related_population_gate.suppress_related_population AS suppress_distribution
  FROM shape_gate
  CROSS JOIN length_gate
  CROSS JOIN related_population_gate
), output_rows AS (
  SELECT
    true AS distribution_suppressed,
    5 AS suppression_threshold,
    NULL::text AS description_length_state,
    NULL::bigint AS extracted_line_item_count
  FROM decision
  WHERE suppress_distribution
  UNION ALL
  SELECT
    false,
    5,
    length_bucket_counts.description_length_state,
    length_bucket_counts.extracted_line_item_count
  FROM length_bucket_counts
  CROSS JOIN decision
  WHERE NOT suppress_distribution
)
SELECT
  distribution_suppressed,
  suppression_threshold,
  description_length_state,
  extracted_line_item_count
FROM output_rows
ORDER BY description_length_state NULLS FIRST
LIMIT 100;

ROLLBACK;
```

## 16. Preflight recommendation

All six preflight queries are `APPROVED_AS_WRITTEN` by static inspection and may be presented to the operator for a separate decision only after the operator confirms the exact Dashboard branch and reviews the command/runbook. This audit does not authorize their execution.

PF-005 must hard-stop at exactly 100 rows. PF-006 must hard-stop on negative/unavailable estimates, any relation estimate above 10,000, or combined bytes above 50,000,000. A missing `analyses.created_at` index requires separate bounded-full-scan review.

## 17. Application-query recommendation

Do not authorize application-query execution from Audit 04D.

Before a new candidate can be considered:

1. Incorporate the exact PR-009 and PR-010 proposals in section 15.
2. Independently verify the corrected SQL.
3. Recompute all 45 pairs.
4. Preserve the shared G gates.
5. Obtain operator proof that the quiescence contract is feasible.
6. Keep execution separately unauthorized until a human decision.

## 18. Remaining blockers

| Blocker ID | Severity | Condition | Resolution evidence |
|---|---|---|---|
| A04E-B01 | HIGH | PR-009 unguarded set-returning function argument | Corrected candidate plus independent review |
| A04E-B02 | HIGH | PR-010 unguarded set-returning function argument | Corrected candidate plus independent review |
| A04E-B03 | HIGH | Quiescence is specified but not proven | Named operator, write-control procedure, and bounded attestation |
| A04E-B04 | MEDIUM | Parser/planner/permission/runtime behavior unproven | Separately authorized preflights after corrected-pack approval |
| A04E-B05 | MEDIUM | PF-005/PF-006/index gates not executed | Separately authorized and validated metadata results |

## 19. Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Build implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|
| A04E-001 | CONFIRMED | Ten inputs existed and were read | Local files | Section 3 | Exact identities recorded | Entry gate satisfied | High | Rehash after write |
| A04E-002 | CONFIRMED | Audit 04D exact identity matched | Audit 04D | Size/hash/lines | 133,770 bytes; 2,694 lines; required SHA | Correct target reviewed | High | Preserve |
| A04E-003 | CONFIRMED | Six PF and ten PR packages exist uniquely | Audit 04D | Query headings | No omission/duplicate | Complete inventory | High | Preserve |
| A04E-004 | CONFIRMED | Audit 04D remained unreviewed/unauthorized | Audit 04D | Terminal lines | Exact required state | No inferred approval | High | Preserve |
| A04E-005 | CONFIRMED | Eight preserved SQL blocks match Audit 04B | In-memory comparison | PF-001–006, PR-001, PR-004 | Exact text equality | Provenance intact | High | None |
| A04E-006 | CONFIRMED | Eight incorporated blocks match Audit 04C | In-memory comparison | PR-002/003/005–010 | Exact text equality | Provenance intact | High | Independent logic review completed here |
| A04E-007 | CONFIRMED | Authorized output was absent | Filesystem | Pre-write check | No overwrite risk | Creation allowed | High | Create only 04E |
| A04E-008 | CONFIRMED | Initial tracked/staged diff was empty | Git | Required terminal commands | Existing audit artifacts untracked | Scope can be verified | High | Final status |
| A04E-009 | CONFIRMED | PR-009/010 expansion arguments lack direct type guards | Audit 04D SQL | `restricted_parent` → `jsonb_array_elements(path)` | Safety depends on planner/filter placement | Correctable runtime-risk blocker | High | Use direct CASE argument |
| A04E-010 | CONFIRMED | Separate transactions lack a common snapshot | Audit 04D | Sixteen wrappers | G decisions can diverge across writes | Quiescence proof required | High | Operator control |
| A04E-011 | CONFIRMED | All 22 prior same-snapshot complements are included in G | Replacement SQL | `privacy_values` | Protected counts and pairwise differences all checked for 1–4 | Prior disclosure defect closed within statement | High | Preserve across correction |
| A04E-012 | CONFIRMED | Pairwise review covers all 45 unique PR pairs | Section 9 | 10 choose 2 | 45 classifications | Complete disclosure review | High | Re-run after correction |
| A04E-013 | CONFIRMED | PR-010 empty length population yields zero rows | PR-010 CTE flow | `length_bucket_counts` empty | Safe successful-empty result | Ledger must distinguish | High | Preserve |
| A04E-014 | CONFIRMED | No prohibited output projection identified | All SQL SELECT lists | Query packages | Aggregate/control columns only | Privacy projection preserved | High | Runtime output verification |
| A04E-015 | UNKNOWN | PostgreSQL parser/planner/permission/load behavior | Not executed | Entire pack | Static inspection only | No execution approval | High | Correct, re-review, then separate preflight decision |

## 20. Operator-decision section

| Field | Value |
|---|---|
| Founder/operator identity or role | `NOT_RECORDED` |
| Decision | `NOT_RECORDED` |
| UTC decision time | `NOT_RECORDED` |
| Approved query IDs | `NONE` |
| Approved branch ref | `NOT_RECORDED` |
| Approved execution method | `NOT_RECORDED` |
| Additional restrictions | `NOT_RECORDED` |

### Completion verification fields

| Item | Result |
|---|---|
| Output artifact path | `docs\audits\04E_PRIVACY_HARDENED_PACK_INDEPENDENT_REVIEW.md` |
| Queries reviewed | 16 |
| Query statuses | 14 approved; 2 require correction; 0 rejected |
| Query pairs reviewed | 45 |
| Pair classifications | 1 no path; 16 overlap; 28 conditional; 0 confirmed defects |
| Prior defects | 22 same-snapshot paths structurally resolved; all conditional on quiescence |
| New defects | 1 defect class affecting PR-009 and PR-010 |
| JSON-safety verdict | `CORRECTION_REQUIRED_FOR_PR_009_AND_PR_010` |
| Quiescence verdict | `TECHNICALLY_SPECIFIED_AWAITING_OPERATOR_PROOF` |
| Input-hash verification after write | `PASS` — all ten authoritative input hashes remained unchanged |
| Initial Git status | No tracked/staged changes; 15 pre-existing untracked audit artifacts |
| Final Git status | `PASS` — no tracked or staged change; this authorized Audit 04E artifact is the only file created by this task |
| Files created | This 04E artifact only |
| Files modified | None authorized |
| SQL executed | NO |
| Database accessed | NO |
| Network accessed | NO |
| Builds/tests/type checks/linters | NO — NOT APPLICABLE |
| Operator decision | `NOT_RECORDED` |
| Execution authorization | `NOT_AUTHORIZED` |

TECHNICAL_SQL_REVIEW: CORRECTIONS_REQUIRED
OPERATOR_DECISION: NOT_RECORDED
SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED
