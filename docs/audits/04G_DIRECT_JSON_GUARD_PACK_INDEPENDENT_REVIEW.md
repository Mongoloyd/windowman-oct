# Audit 04G — Independent Review of the Direct-JSON-Guard Pack

## 1. Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 04G — Independent Review of the Direct-JSON-Guard Pack |
| UTC review time | `2026-08-31T03:29:21Z` |
| Execution environment | CODEX; local read-only artifact inspection and static SQL review |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity verified | `NO`; network prohibited |
| Initial working-tree status | No tracked/staged changes; 17 pre-existing untracked audit artifacts |
| Target environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD` |
| Supabase branch | `forensic_report_v1` |
| Branch ref | `zgsofkgddpcntdvpckdq` |
| Prohibited parent ref | `wkrcyxcnzhwjtdpmfpaf` |
| PostgreSQL | `17.6` from deployed metadata evidence |
| Expected role | `postgres`; non-superuser; `BYPASSRLS=true` |
| SQL/database/network execution | `NONE` |
| Review status | `COMPLETE` |
| Pack-level verdict | `APPROVED_FOR_OPERATOR_DECISION` |
| Operator decision | `NOT_RECORDED` |
| SQL execution authorization | `NOT_AUTHORIZED` |

## 2. Scope and proof limitations

This review independently inspects the exact Audit 04F text. It does not inherit Audit 04E approval, execute SQL, invoke a parser or planner, prove permissions or cost, inspect application rows, prove production quiescence, or authorize execution.

Static PostgreSQL 17.6 compatibility means no syntax or semantic contradiction was identified by inspection against confirmed bindings. It is not parser, planner, permission, performance, timeout, or runtime validation. With `BYPASSRLS=true`, exact source allowlisting, aggregate-only projections, suppression, output-column allowlists, and controlled execution—not RLS—form the privacy boundary.

## 3. Input manifest with hashes

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
| `docs\audits\04E_PRIVACY_HARDENED_PACK_INDEPENDENT_REVIEW.md` | 49,955 | 811 | `592E2440D14E4D22D3746BA2F40C478022BE177B7D606E9C625733994056A8B6` |
| `docs\audits\04F_DIRECT_JSON_GUARD_CORRECTED_QUERY_PACK.md` | 137,809 | 2,751 | `60A894F2D86F763367D5FA06045DFBAA345D0223488ADEF53C501797D7F7A237` |

All twelve inputs existed and were read completely before review.

## 4. Entry-validation results

| Gate | Result | Evidence |
|---|---|---|
| Twelve authorized inputs exist | PASS | Section 3 |
| Audit 04F exact identity | PASS | 137,809 bytes; 2,751 lines; required SHA-256 |
| Six PF IDs and ten PR IDs | PASS | Structural inventory |
| Missing or duplicate query IDs | PASS: NONE | Sixteen unique headings |
| Fourteen SQL blocks equal Audit 04D | PASS | Exact normalized fence-body comparison |
| PR-009/010 equal Audit 04E proposals | PASS | Exact normalized fence-body comparison |
| Audit 04F terminal state | PASS | Five required terminal lines exact |
| Initial Git state captured | PASS | No tracked/staged changes |
| Audit 04G output absent | PASS | Read-only existence check |

## 5. Sixteen-query inventory

| Query | Class | Population/purpose | Unit | Output form |
|---|---|---|---|---|
| A04-PF-001 | PREFLIGHT | Database/version/role identity | Catalog/session | One row |
| A04-PF-002 | PREFLIGHT | Exact table kind and RLS state | Relation metadata | Four rows |
| A04-PF-003 | PREFLIGHT | Required columns/types/nullability | Column metadata | Fifteen rows |
| A04-PF-004 | PREFLIGHT | Required PK/unique/FK bindings | Constraint metadata | Eight rows |
| A04-PF-005 | PREFLIGHT | Index validity/readiness/date-index evidence | Index metadata | Up to 100 rows |
| A04-PF-006 | PREFLIGHT | Relation estimates and size gates | Relation metadata | Four rows |
| A04-PR-001 | APPLICATION_PROFILE | Date-bounded A population | Analysis/session/document/lead | One aggregate row |
| A04-PR-002 | APPLICATION_PROFILE | Joined non-test J lifecycle | Analysis | Fixed suppressed distribution |
| A04-PR-003 | APPLICATION_PROFILE | Joined non-test J lifecycle | Distinct session | Fixed suppressed distribution |
| A04-PR-004 | APPLICATION_PROFILE | A first-failure funnel | Analysis | Complete suppressed partition |
| A04-PR-005 | APPLICATION_PROFILE | Restricted R population | Analysis/session/document/lead | One gated aggregate row |
| A04-PR-006 | APPLICATION_PROFILE | Quality Q confidence states | Analysis | Fixed suppressed distribution |
| A04-PR-007 | APPLICATION_PROFILE | Quality Q document validity | Analysis | Fixed suppressed distribution |
| A04-PR-008 | APPLICATION_PROFILE | Quality Q line-item array states | Analysis | Fixed suppressed distribution |
| A04-PR-009 | APPLICATION_PROFILE | Restricted R description shapes | Expanded line item | Fixed suppressed distribution |
| A04-PR-010 | APPLICATION_PROFILE | Restricted R nonempty description lengths | Expanded line item | Fixed suppressed distribution or successful empty |

## 6. Query-by-query independent review

Common findings for all sixteen: the required read-only transaction, three local timeouts, fixed search path, and terminal `ROLLBACK;` are present. Every query is bounded to at most 100 rows by SQL structure or scalar aggregation. Every application query uses the frozen date interval and only the four allowlisted application relations. PK/FK joins target single right-side identities; distinct entity counts prevent cross-unit overstatement. Runtime behavior remains unproven.

| Query | Static compatibility and shell | Sources/date/join cardinality | Population and gates | Output/suppression/empty behavior | JSON safety | Runtime dependency | Status |
|---|---|---|---|---|---|---|---|---|
| A04-PF-001 | Catalog/session syntax coherent; required read-only shell | Catalog only; date/joins N/A | Exact role/version binding; one row | No app output; LIMIT 1 | No JSON | Runtime identity must match | APPROVED_AS_WRITTEN |
| A04-PF-002 | Catalog joins and relkind/RLS checks coherent | Exact four relations; date N/A | Exact relation binding | No app output; LIMIT 100; exactly four required | No JSON | Catalog visibility/runtime result required | APPROVED_AS_WRITTEN |
| A04-PF-003 | Catalog type/nullability comparison coherent | Exact required columns; date N/A | Frozen type manifest | No app output; LIMIT 100 | No JSON | Must return exact PASS set | APPROVED_AS_WRITTEN |
| A04-PF-004 | Constraint catalog logic coherent | Four relations; date N/A | Eight required constraint bindings | No app output; LIMIT 100 | No JSON | Unique index delegated to PF-005 | APPROVED_AS_WRITTEN |
| A04-PF-005 | Index inventory syntax coherent | Exact relation OIDs; date N/A | Index validity/readiness and date-index review | No app output; LIMIT 100 | No JSON | Exactly 100 is truncation hard stop | APPROVED_AS_WRITTEN |
| A04-PF-006 | Catalog estimate/size logic coherent | Exact relation OIDs; date N/A | Per-relation and combined gates | No app output; four rows, LIMIT 100 | No JSON | Negative/stale estimate and size gates require review | APPROVED_AS_WRITTEN |
| A04-PR-001 | Read-only shell coherent | A date population; PK/FK joins do not multiply right-side rows | Unsegmented operational totals | One aggregate row; no identifiers projected | No JSON | PF-005/006 and possible full scan unresolved | APPROVED_AS_WRITTEN |
| A04-PR-002 | Shell and fixed status CASE coherent | J joined/non-test analyses; frozen date | Shared G plus local analysis-status gate | Whole-distribution suppression; zero safe | Restricted-membership JSON uses guarded array length | Runtime output and snapshot remain unproven | APPROVED_AS_WRITTEN |
| A04-PR-003 | Shell and fixed session CASE coherent | J joined/non-test sessions; frozen date; distinct session unit | Shared G plus local session-status gate | Whole-distribution suppression; zero safe | Restricted-membership JSON uses guarded array length | Runtime output and snapshot remain unproven | APPROVED_AS_WRITTEN |
| A04-PR-004 | First-failure CASE is exhaustive and ordered | A analysis rows; frozen date; one-to-one right joins | No shared G needed; complete partition gate | Entire partition suppressed if any 1–4; zero safe | Parent-first type guards; no expansion | Possible bounded full scan requires review | APPROVED_AS_WRITTEN |
| A04-PR-005 | Nested counts and funnel coordination coherent | R restricted population; four supported entity units | Shared G, funnel gate, and per-metric gate | One suppressed control row or aggregate totals; no IDs | Guarded array length; no expansion | Quiescence and preflights required | APPROVED_AS_WRITTEN |
| A04-PR-006 | Frozen confidence buckets coherent | Q quality-precursor analyses; frozen date | Shared G plus local confidence gate | Whole-distribution suppression; empty safe | Guarded restricted-membership check only | No model-comparison meaning; runtime unproven | APPROVED_AS_WRITTEN |
| A04-PR-007 | Frozen validity states coherent | Q quality-precursor analyses; frozen date | Shared G plus local validity gate | No raw types; whole-distribution suppression | Guarded restricted-membership check only | Runtime output and snapshot unproven | APPROVED_AS_WRITTEN |
| A04-PR-008 | Parent-first array-state CASE coherent | Q quality-precursor analyses; frozen date | Shared G plus local array-state gate | Fixed states; whole-distribution suppression | Every array-length call CASE-guarded; no expansion | Array length remains line-item count only | APPROVED_AS_WRITTEN |
| A04-PR-009 | Direct expansion guard is statically coherent | R restricted line-item descendants; frozen date | Shared G plus local shape gate | No descriptions; full suppression or ≤4 fixed rows | Function argument directly CASE-guards exact path | Parser/runtime and snapshot unproven | APPROVED_AS_WRITTEN |
| A04-PR-010 | Direct expansion and coordinated shape/length logic coherent | R nonempty-description line-item descendants; frozen date | Shared G plus shape and length gates | No content; suppression, ≤4 rows, or SUCCESSFUL_EMPTY | Function argument directly CASE-guards exact path | Parser/runtime and snapshot unproven | APPROVED_AS_WRITTEN |

Totals: 16 `APPROVED_AS_WRITTEN`, 0 `REQUIRES_CORRECTION`, 0 `REJECTED`.

## 7. Direct JSON-guard assessment

| Check | PR-009 | PR-010 |
|---|---|---|
| Function argument directly guarded | PASS | PASS |
| Exact `full_json -> 'extraction' -> 'line_items'` value tested | PASS | PASS |
| Confirmed array returned on array branch | PASS | PASS |
| `'[]'::jsonb` returned otherwise | PASS | PASS |
| Depends on filtered CTE/materialization/planner order | NO | NO |
| Restricted population unchanged | PASS | PASS |
| Shape/length buckets unchanged | Shape states unchanged | Shape and length states unchanged |
| Shared/local suppression gates unchanged | PASS | PASS |
| Output columns unchanged | PASS | PASS |
| Raw description or JSON output | NONE | NONE |

For SQL NULL, missing key, JSON null, scalar, or object input, `jsonb_typeof(...) = 'array'` is not true and the `ELSE '[]'::jsonb` branch is passed to the set-returning function. A physically malformed JSON token cannot exist as a `jsonb` value; semantically malformed/wrong-type states take the safe branch. No non-array expression is passed to `jsonb_array_elements` by the reviewed text.

**Audit 04E direct-guard defect verdict: `RESOLVED`.**

This is static structural proof only. Parser, planner, permissions, data behavior, and performance remain unexecuted.

## 8. Shared-gate assessment

Each reviewed G block contains 40 protected values: A, J, Q, and R counts for analysis, session, document, and lead units, plus every adjacent and externally comparable nested complement represented by the pack. The block is text-identical across the eight affected queries.

| Query | Parent/subset and unit | Comparable complements | Local-cell gate | Suppressed output | Zero behavior | Population broadened | New path | Verdict |
|---|---|---|---|---|---|---|---|---|
| PR-002 | J analysis statuses; G covers four A/J/Q/R units | All supplied 40 G values | Any nonzero status cell 1–4 | One row; state/count NULL | Empty buckets return zero rows safely | NO | NONE | PASS |
| PR-003 | J distinct-session statuses; G retains all four units | All supplied 40 G values | Any nonzero session cell 1–4 | One row; state/count NULL | Empty buckets return zero rows safely | NO | NONE | PASS |
| PR-005 | R entity totals for four supported units | All supplied 40 G values; funnel and entity metrics also gated | Funnel cell or entity metric 1–4 | One row; all metrics NULL | Zero R metrics can return unsuppressed zeros only when protected complements are safe | NO | NONE | PASS |
| PR-006 | Q analysis confidence buckets | All supplied 40 G values | Any confidence cell 1–4 | One row; state/count NULL | Empty Q returns zero rows safely | NO | NONE | PASS |
| PR-007 | Q analysis validity buckets | All supplied 40 G values | Any validity cell 1–4 | One row; state/count NULL | Empty Q returns zero rows safely | NO | NONE | PASS |
| PR-008 | Q analysis array-state buckets | All supplied 40 G values | Any array-state cell 1–4 | One row; state/count NULL | Empty Q returns zero rows safely | NO | NONE | PASS |
| PR-009 | R expanded line-item shape buckets; entity G plus local line-item unit | All supplied 40 entity G values | Any shape cell 1–4 | One row; shape/count NULL | Empty R expansion returns zero rows safely | NO | NONE | PASS |
| PR-010 | R nonempty line-item lengths coordinated with all shape cells | All supplied 40 entity G values | Any shape or length cell 1–4 | One row; length/count NULL | No nonempty descriptions returns `SUCCESSFUL_EMPTY` when no gate suppresses | NO | NONE | PASS |

Shared-gate verdict: `PASS_STATIC`. Every nonzero protected G value from one through four suppresses the affected query; every local 1–4 cell suppresses its complete distribution; suppressed rows reveal no metric, total, label, identifier, or sensitive dimension. The gates remain dependent on one stable application population across separate transactions.

## 9. Complete 45-pair disclosure matrix

Population notation: A = date-bounded analyses; J = fully joined non-test; Q = quality precursor; R = restricted runtime-enforced subset. G protects the four supported entity units across A/J/Q/R and their comparable complements.

| Pair | Shared population | Entity unit | Denominator relationship | Subtraction path | Summation path | Suppression interaction | Separate-snapshot concern | Required control | Classification |
|---|---|---|---|---|---|---|---|---|---|
| 1/2 | Nested frozen populations A/J within A ⊇ J ⊇ Q ⊇ R | analysis/session/document/lead totals ↔ analysis-status rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/3 | Nested frozen populations A/J within A ⊇ J ⊇ Q ⊇ R | analysis/session/document/lead totals ↔ distinct scan sessions | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/4 | Same A date population | analysis/session/document/lead totals ↔ analysis first-failure rows | PR-001 A analysis total versus PR-004 complete A partition | Unavailable when any PR-004 cell is 1–4 because the entire partition is hidden | When released, all nonzero partition cells are ≥5 and sum to A; no hidden cell | PR-004 whole-distribution gate | Drift does not create a same-snapshot hidden-cell path | Normal one-run discipline; no additional SQL correction | NO_RECONSTRUCTION_PATH_IDENTIFIED |
| 1/5 | Nested frozen populations A/R within A ⊇ J ⊇ Q ⊇ R | analysis/session/document/lead totals ↔ analysis/session/document/lead totals | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/6 | Nested frozen populations A/Q within A ⊇ J ⊇ Q ⊇ R | analysis/session/document/lead totals ↔ analysis confidence rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/7 | Nested frozen populations A/Q within A ⊇ J ⊇ Q ⊇ R | analysis/session/document/lead totals ↔ analysis validity rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/8 | Nested frozen populations A/Q within A ⊇ J ⊇ Q ⊇ R | analysis/session/document/lead totals ↔ analysis array-state rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 1/9 | A/R overlap through R descendants | analysis/session/document/lead totals ↔ expanded line items by shape | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 1/10 | A/R overlap through R descendants | analysis/session/document/lead totals ↔ nonempty-description line items by length | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 2/3 | Nested frozen populations J/J within A ⊇ J ⊇ Q ⊇ R | analysis-status rows ↔ distinct scan sessions | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/4 | Nested frozen populations J/A within A ⊇ J ⊇ Q ⊇ R | analysis-status rows ↔ analysis first-failure rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/5 | Nested frozen populations J/R within A ⊇ J ⊇ Q ⊇ R | analysis-status rows ↔ analysis/session/document/lead totals | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/6 | Nested frozen populations J/Q within A ⊇ J ⊇ Q ⊇ R | analysis-status rows ↔ analysis confidence rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/7 | Nested frozen populations J/Q within A ⊇ J ⊇ Q ⊇ R | analysis-status rows ↔ analysis validity rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/8 | Nested frozen populations J/Q within A ⊇ J ⊇ Q ⊇ R | analysis-status rows ↔ analysis array-state rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 2/9 | J/R overlap through R descendants | analysis-status rows ↔ expanded line items by shape | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 2/10 | J/R overlap through R descendants | analysis-status rows ↔ nonempty-description line items by length | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 3/4 | Nested frozen populations J/A within A ⊇ J ⊇ Q ⊇ R | distinct scan sessions ↔ analysis first-failure rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/5 | Nested frozen populations J/R within A ⊇ J ⊇ Q ⊇ R | distinct scan sessions ↔ analysis/session/document/lead totals | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/6 | Nested frozen populations J/Q within A ⊇ J ⊇ Q ⊇ R | distinct scan sessions ↔ analysis confidence rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/7 | Nested frozen populations J/Q within A ⊇ J ⊇ Q ⊇ R | distinct scan sessions ↔ analysis validity rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/8 | Nested frozen populations J/Q within A ⊇ J ⊇ Q ⊇ R | distinct scan sessions ↔ analysis array-state rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 3/9 | J/R overlap through R descendants | distinct scan sessions ↔ expanded line items by shape | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 3/10 | J/R overlap through R descendants | distinct scan sessions ↔ nonempty-description line items by length | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 4/5 | Nested frozen populations A/R within A ⊇ J ⊇ Q ⊇ R | analysis first-failure rows ↔ analysis/session/document/lead totals | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 4/6 | Nested frozen populations A/Q within A ⊇ J ⊇ Q ⊇ R | analysis first-failure rows ↔ analysis confidence rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 4/7 | Nested frozen populations A/Q within A ⊇ J ⊇ Q ⊇ R | analysis first-failure rows ↔ analysis validity rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 4/8 | Nested frozen populations A/Q within A ⊇ J ⊇ Q ⊇ R | analysis first-failure rows ↔ analysis array-state rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 4/9 | A/R overlap through R descendants | analysis first-failure rows ↔ expanded line items by shape | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 4/10 | A/R overlap through R descendants | analysis first-failure rows ↔ nonempty-description line items by length | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 5/6 | Nested frozen populations R/Q within A ⊇ J ⊇ Q ⊇ R | analysis/session/document/lead totals ↔ analysis confidence rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 5/7 | Nested frozen populations R/Q within A ⊇ J ⊇ Q ⊇ R | analysis/session/document/lead totals ↔ analysis validity rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 5/8 | Nested frozen populations R/Q within A ⊇ J ⊇ Q ⊇ R | analysis/session/document/lead totals ↔ analysis array-state rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 5/9 | R/R overlap through R descendants | analysis/session/document/lead totals ↔ expanded line items by shape | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 5/10 | R/R overlap through R descendants | analysis/session/document/lead totals ↔ nonempty-description line items by length | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 6/7 | Nested frozen populations Q/Q within A ⊇ J ⊇ Q ⊇ R | analysis confidence rows ↔ analysis validity rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 6/8 | Nested frozen populations Q/Q within A ⊇ J ⊇ Q ⊇ R | analysis confidence rows ↔ analysis array-state rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 6/9 | Q/R overlap through R descendants | analysis confidence rows ↔ expanded line items by shape | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 6/10 | Q/R overlap through R descendants | analysis confidence rows ↔ nonempty-description line items by length | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 7/8 | Nested frozen populations Q/Q within A ⊇ J ⊇ Q ⊇ R | analysis validity rows ↔ analysis array-state rows | Same date interval; same or nested supported entity/analysis denominator | A visible parent-minus-subset/comparable total could expose a 1–4 complement absent G; G includes all comparable complements | Released fixed buckets can expose their population total; local gate and G coordinate release | Any protected G value or local nonzero bucket 1–4 suppresses the complete affected output | Separate transactions can break the algebra represented by G | Confirmed no-write interval; uninterrupted adjacent run; no isolated retry; invalidate all results on drift/error | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |
| 7/9 | Q/R overlap through R descendants | analysis validity rows ↔ expanded line items by shape | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 7/10 | Q/R overlap through R descendants | analysis validity rows ↔ nonempty-description line items by length | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 8/9 | Q/R overlap through R descendants | analysis array-state rows ↔ expanded line items by shape | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 8/10 | Q/R overlap through R descendants | analysis array-state rows ↔ nonempty-description line items by length | Entity/analysis denominator is not commensurate with expanded line-item denominator | No exact cross-unit subtraction identifies a hidden cell | Line-item buckets cannot reconstruct entity/analysis cells | Entity-side G/local gates and line-item local/G gates remain independent | Drift changes overlap but creates no exact same-snapshot algebra | Preserve one-run discipline; no SQL correction | OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE |
| 9/10 | Same R expanded line-item population | expanded line items by shape ↔ nonempty-description line items by length | PR-010 nonempty-description subset of PR-009 shape population | Shape minus nonempty can identify non-nonempty total only when coordinated gates permit release | PR-010 length buckets sum to PR-009 nonempty bucket | PR-010 repeats the shape gate and combines it with length and G gates | Separate transactions can desynchronize shape and length totals | No-write interval; adjacent execution; no isolated retry; invalidate run on drift | CONDITIONAL_EXECUTION_CONTROL_REQUIRED |

## 10. Comparison with Audit 04E pair totals

| Classification | Audit 04E | Independent Audit 04G | Difference |
|---|---:|---:|---:|
| NO_RECONSTRUCTION_PATH_IDENTIFIED | 1 | 1 | 0 |
| OVERLAPPING_BUT_NOT_EXACTLY_RECONSTRUCTABLE | 16 | 16 | 0 |
| CONDITIONAL_EXECUTION_CONTROL_REQUIRED | 28 | 28 | 0 |
| CONFIRMED_RECONSTRUCTION_DEFECT | 0 | 0 | 0 |

The totals match, but were recomputed from Audit 04F's exact query populations, entity units, denominators, suppression gates, and direct-guarded PR-009/010 bodies. No total was forced to match. The 28 conditional pairs remain conditional solely because separately committed read-only transactions do not share one snapshot.

## 11. Quiescence assessment

Classification: `TECHNICALLY_SPECIFIED_AWAITING_OPERATOR_PROOF`.

The contract explicitly requires:

1. no relevant writes to `public.analyses`, `public.scan_sessions`, `public.quote_files`, or `public.leads`;
2. one uninterrupted application-query run;
3. accepted preflights immediately beforehand;
4. adjacent execution of related queries;
5. no isolated retries;
6. complete result-set invalidation after timeout, error, session reset, role drift, target drift, unexpected output, or suspected write; and
7. no combination of outputs across runs.

These controls are technically explicit and can support operator consideration. They are not proven operationally available. Application execution remains blocked until the operator establishes and records the no-write interval and separately authorizes execution.

`IF_QUIESCENCE_CANNOT_BE_CONFIRMED_APPLICATION_EXECUTION_IS_BLOCKED`

## 12. Operational-limit assessment

| Control | Static finding | Runtime proof required | Verdict |
|---|---|---|---|
| 10-second statement timeout | Present in all 16 blocks | Whether workload completes | PASS_STATIC |
| 1-second lock timeout | Present in all 16 blocks | Lock behavior | PASS_STATIC |
| 15-second idle-in-transaction timeout | Present in all 16 blocks | Session behavior | PASS_STATIC |
| Read-only transaction and rollback | Present in all 16 blocks | Server enforcement | PASS_STATIC |
| Four-relation source allowlist | No extra application relation found | Role visibility/permissions | PASS_STATIC |
| 10,000-row relation estimates | PF-006 hard-stops over/unknown values | Actual catalog result and freshness | PASS_STATIC |
| 50,000,000 combined bytes | PF-006 hard-stops breach | Actual catalog result | PASS_STATIC |
| 100-row output bound | LIMIT/scalar structure present | Actual result shape | PASS_STATIC |
| Date-index dependency | PF-005 inventories; missing index blocks pending review | Actual index result/cost | PASS_STATIC |
| BYPASSRLS privacy boundary | SQL does not rely on RLS | Exact target/role confirmation | PASS_STATIC |

## 13. Special-case assessment

| Special case | Required treatment | Independent finding | Verdict |
|---|---|---|---|
| PF-005 exactly 100 rows | `HARD_STOP_TRUNCATION_AMBIGUOUS` | Explicitly documented; LIMIT cannot distinguish truncation | PASS |
| PF-006 negative/unavailable estimate | Hard stop | `estimated_rows < 0`/unavailable is blocked | PASS |
| PF-006 relation estimate >10,000 | Hard stop | Per-relation gate present | PASS |
| PF-006 combined bytes >50,000,000 | Hard stop | Combined gate present | PASS |
| Missing `analyses.created_at` index | `HARD_STOP_PENDING_FULL_SCAN_REVIEW` | Explicitly documented | PASS |
| PR-010 zero rows | `SUCCESSFUL_EMPTY` | Empty length set yields zero rows when suppression is false | PASS |
| Timeout/error | Reviewed explicit rollback or session discard | Explicitly required; full run invalidated | PASS |
| `BYPASSRLS=true` | SQL/output controls, not RLS, form privacy boundary | Explicitly documented | PASS |

Prohibited-output review: no query projects PII, identifiers, raw rows, raw JSON, descriptions, source text, filenames, Storage paths, contractor names, free text, snippets, tokens, distinct text, hashes, money, quantity, opening count, dimensions, product/contractor/geography/market cohorts, quote/project/revision/duplicate/current/supersession identity, benchmarks, or historical-model claims. Internal identifiers are confined to joins and approved aggregate distinct counts.

## 14. Findings ordered by severity

| Finding ID | Severity | Classification | Finding | Impact | Required action |
|---|---|---|---|---|---|
| A04G-F-001 | BLOCKER_FOR_APPLICATION_EXECUTION | CONDITIONAL | Production quiescence is specified but unproven | Cross-query G relationships can drift across transactions | Operator must prove a no-write interval and uninterrupted run |
| A04G-F-002 | BLOCKER_FOR_ANY_EXECUTION | CONDITIONAL | No operator decision or SQL authorization exists | Neither preflights nor application SQL may run | Obtain a separate, exact operator decision |
| A04G-F-003 | RUNTIME_UNKNOWN | UNKNOWN | Parser, planner, permissions, catalog results, costs, and data-dependent outputs were not executed | Static review cannot establish runtime behavior | Execute only separately authorized preflights, then review results |
| A04G-F-004 | RESOLVED_DEFECT | CONFIRMED | Both JSON set-returning function arguments are intrinsically guarded | Audit 04E planner-placement concern is removed structurally | No SQL correction required |
| A04G-F-005 | DISCLOSURE_REVIEW | CONFIRMED | Independent 45-pair review found zero confirmed reconstruction defects | Pack is suitable for operator consideration under execution controls | Preserve G gates, suppression, and run invalidation |

No correctable SQL or documentation defect was identified. No query is rejected.

## 15. Complete proposed replacement SQL for correctable defects

`NONE`

No correctable defect was identified. No replacement SQL is proposed.

## 16. Preflight recommendation

Recommendation: `APPROVED_FOR_OPERATOR_DECISION`.

The six preflight queries are technically coherent by static inspection and may be presented to the human operator for a separate preflight-only decision. This recommendation does not authorize execution. Any operator decision must identify the exact query IDs, branch ref, execution method, and restrictions. Preflights must run in sequence and stop on any mismatch, error, timeout, unexpected output, or hard-stop state.

## 17. Application-query recommendation

The ten application-query SQL bodies are `APPROVED_AS_WRITTEN` for technical coherence, direct JSON type safety, and same-snapshot disclosure controls. They are not authorized to execute.

Application execution remains blocked until all of the following are separately proven and recorded:

- exact target and role confirmation;
- all six preflights executed under separate authorization and accepted;
- relation estimates, sizes, constraints, indexes, and output shapes pass;
- any missing date-index/full-scan issue receives explicit bounded review;
- a no-write interval across all four relations is established;
- one uninterrupted adjacent run is operationally controlled;
- security/privacy review approves the exact execution plan; and
- the operator separately authorizes the exact application query IDs.

## 18. Remaining blockers

| Blocker ID | Scope | Condition | Resolution evidence | Owner |
|---|---|---|---|---|
| A04G-B-001 | Any SQL execution | Operator decision and execution authorization absent | Exact signed/recorded operator decision | Founder/operator |
| A04G-B-002 | Application SQL | Quiescence not proven | Recorded no-write interval and uninterrupted-run procedure | Operator/data platform |
| A04G-B-003 | Application SQL | Preflight results absent | Separately authorized PF-001–006 results reviewed and accepted | Operator/reviewer |
| A04G-B-004 | Application SQL | Runtime parse/plan/permission/cost/output behavior unknown | Accepted preflights and separately authorized controlled execution | Operator/reviewer |

These blockers do not require SQL correction. They prevent execution, not presentation of the pack for an operator decision.

## 19. Evidence ledger

| Evidence ID | Classification | Claim | Source | Exact reference | Observation | Implication | Confidence | Follow-up |
|---|---|---|---|---|---|---|---|---|
| A04G-001 | CONFIRMED | Twelve input identities matched | Local files | Section 3 | Bytes, lines, SHA-256 recorded | Entry gate passed | High | Rehash after creation |
| A04G-002 | CONFIRMED | Audit 04F contains 16 unique packages | Audit 04F | Query headings | Six PF and ten PR | Complete review scope | High | Preserve artifact |
| A04G-003 | CONFIRMED | Fourteen SQL bodies equal Audit 04D | Normalized comparison | PF-001–006; PR-001–008 | Exact fence-body equality | Provenance intact | High | None |
| A04G-004 | CONFIRMED | PR-009/010 equal Audit 04E proposals | Normalized comparison | Audit 04E section 15 | Exact fence-body equality | Correct fixes reviewed | High | None |
| A04G-005 | CONFIRMED | All 16 queries passed static independent review | Audit 04F SQL | Section 6 | No correction/rejection | Eligible for operator decision | High | Runtime remains unproven |
| A04G-006 | CONFIRMED | Direct JSON defect is resolved structurally | PR-009/010 | Section 7 | Exact argument CASE returns array or `[]::jsonb` | No planner-placement dependency | High | Runtime remains unproven |
| A04G-007 | CONFIRMED | Eight G blocks retain 40 protected values and local gates | PR-002/003/005–010 | Section 8 | Nested units/complements and whole suppression retained | Same-snapshot disclosure control coherent | High | Quiescence required |
| A04G-008 | CONFIRMED | All 45 pairs independently classified | Audit 04F SQL | Section 9 | 1 no-path; 16 overlap; 28 conditional; 0 defect | Matches Audit 04E independently | High | Preserve run controls |
| A04G-009 | CONFIRMED | Quiescence contract is technically explicit | Audit 04F | Section 11 | No-write, adjacency, invalidation, no cross-run merge | Operator consideration allowed | High | Operator proof required |
| A04G-010 | CONFIRMED | Special cases are correctly represented | Audit 04F | Sections 12–13 | Size, truncation, index, empty, timeout controls present | Hard stops retained | High | Verify during preflights |
| A04G-011 | CONFIRMED | No prohibited output was identified | Sixteen SQL bodies | Section 13 | Aggregate/fixed labels only | Privacy scope preserved | High | Human review still required |
| A04G-012 | UNKNOWN | Runtime parse, plan, permissions, cost, timeout, and output behavior | Not executed | Entire pack | Static review only | Execution remains unauthorized | High | Separate authorization |
| A04G-013 | CONFIRMED | No SQL, database, network, build, test, or external operation occurred | Execution record | This task | Local reads and one Markdown creation only | No protected-state impact | High | Preserve non-authorization |

### Read-only command and exit-code ledger

| Command/check | Exit code | Result |
|---|---:|---|
| `Get-Location` | N/A (PowerShell cmdlet) | Canonical working directory |
| `git rev-parse --show-toplevel` | 0 | Canonical root confirmed |
| `git rev-parse --abbrev-ref HEAD` | 0 | `forensic_report_v2` |
| `git rev-parse HEAD` | 0 | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Initial `git status --short` | 0 | No tracked/staged changes; 17 untracked audits |
| `git branch -vv` | 0 | Upstream recorded; no live parity check |
| `git remote -v` | 0 | Sanitized origin; no embedded credential |
| Twelve-file metadata/hash inventory | 0 | Entry identities passed |
| Complete twelve-file read | 0 | All inputs read |
| `rg` query inventory | 0 | Six PF and ten PR headings |
| `rg` guard/wrapper inventory | 0 | Two direct expansions and required shell markers |
| Final input rehash | 0 | All twelve inputs remained hash-identical |
| Final `git status --short` | 0 | Only Audit 04G was added relative to initial status |
| Final `git diff --no-ext-diff -- docs/audits` | 0 | No tracked audit diff |

Git emitted a read-only global-ignore permission warning. Git commands still returned exit code 0 and no repository state was changed.

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

Pack-level verdict: `APPROVED_FOR_OPERATOR_DECISION`.

This verdict permits presentation to the operator for a separate preflight-only decision. It authorizes neither preflights nor application queries. Application execution remains blocked pending accepted preflights, quiescence proof, human security/privacy review, and a separate exact authorization.

TECHNICAL_SQL_REVIEW: APPROVED_FOR_OPERATOR_DECISION
QUIESCENCE_STATUS: TECHNICALLY_SPECIFIED_AWAITING_OPERATOR_PROOF
OPERATOR_DECISION: NOT_RECORDED
SQL_EXECUTION_AUTHORIZATION: NOT_AUTHORIZED
