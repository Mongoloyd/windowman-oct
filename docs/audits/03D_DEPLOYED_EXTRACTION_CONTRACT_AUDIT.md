# Audit 03D — Deployed Extraction Contract Forensic Audit

## Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 03D — Deployed Extraction Contract Forensic Audit |
| UTC execution time | 2026-08-31T00:03:41Z |
| Execution environment | CODEX; local, read-only archive and repository inspection |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Checkout type | Standard checkout; Git common directory `.git` |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status before report creation | No tracked or staged changes. Existing untracked audit artifacts: Audits 01, 02, 03, 03A, 03B, and 03C. |
| Configured upstream | `origin/forensic_report_v2` |
| Remote parity actually verified | UNKNOWN — no fetch, network request, or remote comparison was authorized or performed |
| Target Supabase environment | `LIVE_ACTIVE / PRODUCTION WORKLOAD` (operator-confirmed) |
| Target project / branch ref | WMProd / `forensic_report_v1` / `zgsofkgddpcntdvpckdq` (operator-confirmed) |
| Dormant parent/main ref | `wkrcyxcnzhwjtdpmfpaf`; explicitly out of scope and not inspected |
| Function | `scan-quote`; endpoint and source archive identity operator-confirmed |
| Function JWT setting | Dashboard displayed JWT verification disabled; operator observation, not independently queried |
| Function ID / numeric deployment version / exact deployment timestamp | UNKNOWN / UNKNOWN / UNKNOWN |
| PostgreSQL version | 17.6 from prior operator-executed metadata evidence in Audit 03C; no database access in this audit |
| Production read authorization | Archive and repository inspection only; no database read performed |
| Network authorization used | None |
| Applicable governance | Repository `AGENTS.md`; audit protocol and Audits 01–03C |
| Audit status | `COMPLETE_WITH_BLOCKERS` |
| Auditor limitations | The archive was operator-supplied and its fingerprint was independently verified, but no deployment ID or timestamp cryptographically binds it to a specific deployment record. No code, SQL, function, service, or customer data was executed or inspected. |

## Terminal conclusion

**`GATE_CONTRACT: SATISFIED_WITH_RESTRICTED_PROFILEABLE_SUBSET`**

The archive establishes the actual source contract represented by the operator-downloaded production-branch package. It does **not** establish a closed extraction schema. The complete-success path runtime-enforces only:

1. a root object;
2. `document_type` as a string after coercion;
3. `is_window_door_related` as `true` after classification normalization and gating;
4. `confidence` as a number accepted by the gate (`0.4` through `1`, inclusive, for this rubric);
5. `line_items` as an array with at least one element; and
6. every `line_items[]` element as a non-null object whose `description` is a string.

All other prompt-declared, TypeScript-declared, and undeclared properties lack extraction-response runtime type enforcement. They can be absent, null, incorrectly typed, or arbitrarily added and can survive into `analyses.full_json.extraction`. Audit 04 may therefore bind only the narrow subset stated in this report, and even that subset remains subject to Audit 03C's unresolved identity, semantic, eligibility, revision, test-data, and fact-ownership decisions. **Audit 04 must not start automatically.**

## Scope and methodology

This audit performed only the following read-only actions:

1. Read archive metadata and bytes without extracting files.
2. Calculated the archive SHA-256 and per-entry SHA-256 values.
3. Read every entry stream and ran a CRC integrity test.
4. Mapped `src/*` entries to `supabase/functions/scan-quote/*` and `_shared/*` entries to `supabase/functions/_shared/*`.
5. Compared byte content against the audited working tree, which had no tracked changes and therefore represented committed SHA `7a497a5f…` for these paths.
6. Parsed static relative import declarations as text and resolved them against the archive manifest.
7. Read the deployed prompt, request schema, provider call, response normalization/parser, classification gate, coercion, manual validator, scoring, report construction, and persistence source without running it.
8. Kept operator attestation, archive evidence, repository source, and prior deployed-database metadata as separate evidence domains.

No archive entry was imported, evaluated, transpiled, type-checked, tested, or written to disk. No secret value, source document, customer record, raw extraction, `full_json` value, Storage object name/path, or log was inspected or included.

Classification meanings follow the shared protocol: `CONFIRMED`, `INFERRED`, `UNKNOWN`, and `CONTRADICTED`.

## Archive provenance, fingerprint, and integrity

| Property | Expected | Observed | Classification | Evidence |
|---|---:|---:|---|---|
| Archive path | Operator attachment | `C:\Users\Dell\Desktop\wm-mvp\scan-quote.zip` | CONFIRMED | A03D-002 |
| Size | 60,473 bytes | 60,473 bytes | CONFIRMED | A03D-002 |
| Entry count | 23 | 23 | CONFIRMED | A03D-002 |
| SHA-256 | `8AC6F822D3F4177A120C8EACEB20E3662579A4D5AE03A51BB383AB53A5E6C073` | Exact match | CONFIRMED | A03D-002 |
| Stream readability | All entries readable | All 23 read to EOF | CONFIRMED | A03D-002 |
| ZIP CRC integrity | Valid | `PASS`; no bad entry | CONFIRMED | A03D-002 |
| Source project/branch/function | WMProd / `forensic_report_v1` / `zgsofkgddpcntdvpckdq` / `scan-quote` | Operator-confirmed; not independently queried | CONFIRMED as operator attestation; independent deployment binding UNKNOWN | A03D-001, A03D-016 |

## Sanitized archive manifest and repository comparison

Classification scope:

- `IDENTICAL`: archive bytes equal the corresponding repository file bytes at audited SHA.
- `DIFFERENT`: both exist, but bytes differ.
- `DEPLOYED_ONLY`: archive entry has no mapped repository file.
- `REPOSITORY_ONLY`: relevant repository source/support file is absent from the archive.

| Archive entry | Raw / compressed bytes | Archive SHA-256 | Corresponding repository path | Classification |
|---|---:|---|---|---|
| `src/index.ts` | 60,730 / 13,783 | `3F0EBD7B7307D7F5451762FA97CF5152822B60B9E773F7B9AA60378C671C405A` | `supabase/functions/scan-quote/index.ts` | DIFFERENT |
| `_shared/metrics.ts` | 17,341 / 4,320 | `E1AD2C3386C9E32E66641A7864313CD9670228C18E3A4545F58E799A7CE8BD4A` | `supabase/functions/_shared/metrics.ts` | IDENTICAL |
| `_shared/countyBenchmarks.ts` | 3,816 / 1,079 | `3AE7872E148E0F30F5C28976BA646BA382C687A85FFFCBB91437FBA58CA50A69` | `supabase/functions/_shared/countyBenchmarks.ts` | IDENTICAL |
| `_shared/tracking/canonicalBridge.ts` | 2,588 / 820 | `0EFC954394CA58A30A6E79254272DF9398A52F3BCEB64CCDA6CA3B62297E2C2F` | `supabase/functions/_shared/tracking/canonicalBridge.ts` | DIFFERENT |
| `_shared/tracking/canonical/createCanonicalEvent.ts` | 18,318 / 4,192 | `0746AE3E53AC05EFFA498FE34F60B1DA032F0E9333A5A50F4FEC427AE5706C34` | `supabase/functions/_shared/tracking/canonical/createCanonicalEvent.ts` | DIFFERENT |
| `_shared/attributionMerge.ts` | 8,494 / 2,321 | `EF3ADCF2FE3083ED52E433D986C169C1C69B9CAD4D33DBAF40F3BB5189C0F167` | `supabase/functions/_shared/attributionMerge.ts` | IDENTICAL |
| `_shared/tracking/canonical/constants.ts` | 1,344 / 565 | `C72D871A8ABAFC24D724DA5CA9BE70C3F58FA74873FD7DD77EF3BB5F76B4B7BE` | `supabase/functions/_shared/tracking/canonical/constants.ts` | DIFFERENT |
| `_shared/tracking/canonical/nextdoorDispatchEligibility.ts` | 3,636 / 1,122 | `36A9368F2E7E306239A60F55E635439050C7429BFBF7620D37679D1F8E749AC0` | `supabase/functions/_shared/tracking/canonical/nextdoorDispatchEligibility.ts` | IDENTICAL |
| `_shared/tracking/canonical/tiktokDispatchEligibility.ts` | 1,632 / 545 | `2B74DF09E013655E4D02CD4F64C22A5B03D87108605EFDEF9FE241E1C22138C0` | `supabase/functions/_shared/tracking/canonical/tiktokDispatchEligibility.ts` | IDENTICAL |
| `_shared/tracking/canonical/mapToTikTok.ts` | 7,274 / 2,405 | `E4CC34E257DC7342A6BC1A18A3BA3D757A7174690B53DBA3B18DB44C1F740BD4` | `supabase/functions/_shared/tracking/canonical/mapToTikTok.ts` | IDENTICAL |
| `_shared/tracking/canonical/identity.ts` | 4,340 / 1,257 | `01046B12122B957DB51CA2AB00D1C3CC0E72D1C0B0778A0684090752AD3F7A35` | `supabase/functions/_shared/tracking/canonical/identity.ts` | IDENTICAL |
| `_shared/tracking/canonical/trustScore.ts` | 3,272 / 966 | `6245BB3051C087C14A89B4288F1E9B042C1952A80279A214ED6DCAA4409A3A19` | `supabase/functions/_shared/tracking/canonical/trustScore.ts` | IDENTICAL |
| `_shared/tracking/canonical/anomaly.ts` | 3,056 / 901 | `B2D20665D1409626E47AC907F5BBCBC0BA73DE94525B04DA7AEC9E82C3E57791` | `supabase/functions/_shared/tracking/canonical/anomaly.ts` | IDENTICAL |
| `_shared/tracking/canonical/valueModel.ts` | 1,606 / 604 | `AD87DE770EC875A0E66F524DD2F997FAD77F2672DF38837717CC45FE9728ED9B` | `supabase/functions/_shared/tracking/canonical/valueModel.ts` | IDENTICAL |
| `_shared/scannerConfig.ts` | 4,447 / 1,709 | `1A668E49904DFF6C960BC27A11EC054559A234B5AD124B465A288A54683359E5` | `supabase/functions/_shared/scannerConfig.ts` | IDENTICAL |
| `_shared/geminiJson.ts` | 3,702 / 1,288 | `B2D5D8E5CDB93776E7A339209F8FBFB91EFD5710D68E1E4302EDA48617E74EAF` | `supabase/functions/_shared/geminiJson.ts` | IDENTICAL |
| `_shared/scannerLogger.ts` | 2,423 / 1,065 | `3093120D26C2875DFD3F91334EE0F8DD38991FD76404CF04A7C0537825122F36` | `supabase/functions/_shared/scannerLogger.ts` | IDENTICAL |
| `src/requestSchema.ts` | 3,697 / 1,772 | `025A0BE25EF7804A13E019CD59E4EEF6F0270D0CCAA8D9170A898226D77963EE` | `supabase/functions/scan-quote/requestSchema.ts` | IDENTICAL |
| `src/sessionRecovery.ts` | 3,250 / 1,311 | `CA8BA8747F904701EDBA5AB6EA1E1D9F8651AB727AF25244DE9D28FFC0D3CDA9` | `supabase/functions/scan-quote/sessionRecovery.ts` | IDENTICAL |
| `src/scoring.ts` | 31,377 / 5,107 | `F006A9C4E57C323CCC27752862EDBCA7D898848ED17DBE41AE122BB399E9BF95` | `supabase/functions/scan-quote/scoring.ts` | IDENTICAL |
| `src/reportCompiler.ts` | 14,848 / 3,660 | `30F1E570BC462D4D764BB881CB686A9ED3AC1D98257A76885FE8AA96162B0F41` | `supabase/functions/scan-quote/reportCompiler.ts` | IDENTICAL |
| `src/flagging.ts` | 14,217 / 2,855 | `0645663A83D288A176ADB422BD958063EBBBCC9F4A62C228FD9BC2598E8C2E62` | `supabase/functions/scan-quote/flagging.ts` | IDENTICAL |
| `src/classificationGate.ts` | 4,463 / 1,306 | `05F7158A52C961EC444D6ADF8016A65584E2C87201027CCEAC9D2E148E73E1D9` | `supabase/functions/scan-quote/classificationGate.ts` | IDENTICAL |

Summary: 19 `IDENTICAL`, 4 `DIFFERENT`, 0 `DEPLOYED_ONLY` among the 23 archive entries.

### Relevant repository-only files

| Repository path | Classification | Role relative to deployed package |
|---|---|---|
| `supabase/functions/scan-quote/leadPointerSync.ts` | REPOSITORY_ONLY | Current repository production dependency imported by repository `index.ts`; absent from deployed archive and explains the scanner entrypoint difference |
| `supabase/functions/scan-quote/scoringDiagnostics.ts` | REPOSITORY_ONLY | Unreferenced support/diagnostic source; no production import found |
| `supabase/functions/scan-quote/fixtures.ts` | REPOSITORY_ONLY | Test fixture support |
| `supabase/functions/scan-quote/flagging.test.ts` | REPOSITORY_ONLY | Test |
| `supabase/functions/scan-quote/index.test.ts` | REPOSITORY_ONLY | Test |
| `supabase/functions/scan-quote/leadPointerSync.test.ts` | REPOSITORY_ONLY | Test |
| `supabase/functions/scan-quote/requestSchema.test.ts` | REPOSITORY_ONLY | Test |
| `supabase/functions/scan-quote/scoring.test.ts` | REPOSITORY_ONLY | Test |
| `supabase/functions/scan-quote/sessionRecovery.test.ts` | REPOSITORY_ONLY | Test |
| `supabase/functions/_shared/tracking/canonical/types.ts` | REPOSITORY_ONLY | Referenced by seven deployed `import type` statements; absent from archive but not a runtime dependency |

Unrelated `_shared` repository modules outside the deployed import closure are not classified as repository-only for this function.

### Material differences

| File | Deployed behavior | Current repository behavior | Extraction-contract effect |
|---|---|---|---|
| `src/index.ts` | Directly updates lead snapshot fields after analysis persistence and treats failure as non-fatal | Uses repository-only monotonic lead-pointer synchronization and can stop before completion events/`preview_ready` when pointer sync fails | No difference in prompt, Gemini call, parse, classification, coercion, extraction validator, scoring, `full_json`, or analysis upsert blocks |
| `_shared/tracking/canonicalBridge.ts` | Awaits canonical event creation and returns `void` | Returns the canonical event result | None to extraction shape |
| `_shared/tracking/canonical/constants.ts` | Does not include `callback_requested` in event-name constants | Includes it | None to extraction shape |
| `_shared/tracking/canonical/createCanonicalEvent.ts` | Earlier dispatch behavior | Adds dispatch-policy/consent controls and duplicate-safe dispatch-row behavior | None to extraction shape; operational/measurement difference only |

## Relative-import completeness

The archive contains 34 static relative import declarations. Twenty-seven resolve to archive entries. Seven do not, all resolving to `_shared/tracking/canonical/types.ts`:

| Importing entry | Import line | Import kind | Runtime consequence |
|---|---:|---|---|
| `_shared/tracking/canonical/anomaly.ts` | 1 | `import type` | None after TypeScript erasure |
| `_shared/tracking/canonical/createCanonicalEvent.ts` | 19–24 | `import type` | None after TypeScript erasure |
| `_shared/tracking/canonical/identity.ts` | 1 | `import type` | None after TypeScript erasure |
| `_shared/tracking/canonical/nextdoorDispatchEligibility.ts` | 1 | `import type` | None after TypeScript erasure |
| `_shared/tracking/canonical/trustScore.ts` | 3–8 | `import type` | None after TypeScript erasure |
| `_shared/tracking/canonical/valueModel.ts` | 1 | `import type` | None after TypeScript erasure |
| `_shared/tracking/canonicalBridge.ts` | 3 | `import type` | None after TypeScript erasure |

**Finding:** no missing runtime relative dependency was identified. The archive is not a complete type-checkable source snapshot because `types.ts` is omitted, but that omission does not create a runtime module-resolution dependency. External URL imports were recorded but not fetched.

## Preliminary-observation disposition

| Preliminary observation | Result | Exact evidence |
|---|---|---|
| `scoring.ts` is identical to the repository | CONFIRMED | Exact byte equality; SHA-256 `F006A9…E9BF95` |
| Gemini prompt is identical | CONFIRMED | Exact extracted segment equality; SHA-256 `8A8248…F9221`; archive `src/index.ts:362-520` |
| `validateExtraction` is identical | CONFIRMED | Exact extracted segment equality; SHA-256 `B2DCC6…94014`; archive `src/index.ts:195-229` |
| Extraction coercion and validation invocation are identical | CONFIRMED | Coercion segment SHA-256 `5FFE63…7827F`; gate/coercion/validation segment SHA-256 `3EBA04…30C6A` |
| Relevant `full_json` construction is identical | CONFIRMED | Exact segment equality; SHA-256 `7AE98C…F5334`; archive `src/index.ts:1261-1283` |
| Overall deployed `src/index.ts` differs | CONFIRMED | Different full-file hashes; diff isolated to lead-pointer/snapshot logic and import |
| Zod validates request boundary, not complete Gemini response | CONFIRMED | `src/requestSchema.ts:22-65,84-96`; `src/index.ts:527-557`; response uses manual validator at `195-229` |
| `validateExtraction` checks only classification fields, `line_items`, and descriptions before casting | CONFIRMED WITH PRECISION | It checks root object; `document_type` string; related boolean; confidence number/range; `line_items` array; each item object and description string; then casts the unchanged object |

## Deployed extraction path

| Stage | Deployed component | Input → output | Enforcement / behavior | Evidence |
|---|---|---|---|---|
| HTTP request parsing | `requestSchema.ts::ScanQuoteRequestSchema`; `parseScanQuoteRequest` | JSON body → request DTO | Zod request-boundary validation only | A03D-009 |
| Session and file lookup | `src/index.ts` | scan UUID → session, quote-file row, private object | Service-role client; no invocation performed | A03D-007 |
| Prompt | `GEMINI_EXTRACTION_PROMPT` | Static instructions + pseudo-schema | Plain prompt text, not a provider JSON Schema | A03D-007 |
| Provider request | direct Gemini `generateContent` HTTP call | prompt + base64 file → provider envelope | Model is env-overridable; default `gemini-3.1-flash-lite-preview`; temperature `0.1`; output default `8192`; timeout default 15s; no `responseMimeType` or `responseSchema` | A03D-007 |
| Envelope handling | `geminiResp.json()` | provider response → envelope object | Defensive envelope parse; first candidate text selected | A03D-008 |
| Text normalization | `_shared/geminiJson.ts::normalizeGeminiJsonText` | candidate text → normalized text | Trims/strips fences and a bare JSON label; does not repair or project fields | A03D-008 |
| Extraction parse | `JSON.parse(normalizedText)` | text → arbitrary JS value | Syntax only; no schema validation | A03D-008 |
| Classification normalization | `classificationGate.ts::normalizeClassification` | arbitrary value → normalized classification | Coerces related true/string-true; confidence number/numeric string in `[0,1]`; reads string document type; counts array length | A03D-010 |
| Classification gate | `classifyScanGate` | normalized classification → continue/terminate | Continue requires related, confidence at least `0.4`, and at least one line item | A03D-010 |
| Extraction coercion | `coerceParsedForExtraction` | parsed object → shallow-spread object | Overwrites only related, confidence, and document type; preserves every other root key | A03D-010, A03D-013 |
| Extraction validation | `validateExtraction` | coerced object → cast `ExtractionResult` | Manual shallow checks only; no Zod and no nested field schema | A03D-010 |
| Deterministic analysis | `scoring.ts`, `flagging.ts`, `metrics.ts`, `reportCompiler.ts` | cast extraction → scores, flags, metrics, report | TypeScript consumers trust fields that runtime did not validate | A03D-012 |
| `full_json` construction | `src/index.ts` | extraction + deterministic outputs → `fullJson` | Stores extraction object by reference under `full_json.extraction`; no allowlist or strip | A03D-012, A03D-013 |
| Persistence | `upsertAnalysisRecord` | analysis payload → `analyses` | Upsert conflict target `scan_session_id`; deployed schema confirms nullable `jsonb` `full_json` | A03D-012, A03D-017 |

## What Zod validates precisely

Zod is imported only by `src/requestSchema.ts`. Its object validates the incoming HTTP body:

- `scan_session_id`: required UUID-shaped string;
- `event_id`: tolerant preprocessing to a trimmed string or server-minted UUID, then length 1–128, optional with default;
- `dev_extraction_override`: optional `unknown` and therefore deliberately shape-unvalidated;
- `dev_secret`: optional string length 1–256.

The handler calls this Zod parser before database/provider work. Zod does **not** parse or validate Gemini's candidate text, the `JSON.parse` result, `line_items`, any nested extraction property, or `full_json`. The response path uses `normalizeClassification`, `coerceParsedForExtraction`, and the manual `validateExtraction` function. Therefore, describing this function as “Gemini response Zod validation” or “complete extraction Zod validation” is contradicted by deployed source.

## Extraction-field matrix

Matrix scope and notation:

- Prompt types are instructions embedded in text, not provider-enforced JSON Schema.
- `U` means **unenforced**: key may be missing; value may be `null` or any JSON type and still pass the extraction validator, subject only to downstream code not throwing.
- TypeScript optionality is compile-time only.
- `E` means persistence at the same path under `analyses.full_json.extraction`.
- Consumers: `G` classification/validator; `S` scoring; `F` flags; `M` metrics; `R` report compiler; `I` scanner/proof/canonical projection; `P` persistence only.
- “Extras survive” states whether undeclared sibling/object keys are retained. The deployed path does no schema strip.
- `YES` does not authorize profiling; it identifies a technically runtime-enforced, non-PII aggregate candidate. `RESTRICTED` permits only approved presence/type/count/allowlisted aggregate metrics. `NO` excludes sensitive/free-text content. `BLOCKED` means the path lacks deployed runtime type authority or required semantics.
- Matrix evidence: A03D-007, A03D-010–A03D-014; archive `src/index.ts:362-520,1081-1152,1261-1305` and `src/scoring.ts:11-159`.

| JSON path | Prompt-declared type | `ExtractionResult` TypeScript type | Actual runtime-enforced type | Nullability / absence reality | Extras survive | Downstream consumer | Persistence destination | Profileable |
|---|---|---|---|---|---|---|---|---|
| `document_type` | required string | required string | string; fallback `"unknown"` permitted | non-null on complete path; empty allowed | Yes | G, I | E + `analyses.document_type` + proof | RESTRICTED |
| `is_window_door_related` | required boolean | required boolean | boolean `true` on complete path | non-null | Yes | G, I | E + `analyses.document_is_window_door_related` | YES |
| `confidence` | required number | required number | number in `[0.4,1]` after number/numeric-string normalization | non-null on complete path | Yes | G, I | E + `analyses.confidence_score` | YES |
| `page_count` | required number or null | optional number | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | I | E + proof-of-read projection | BLOCKED |
| `contractor_name` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | I | E + proof-of-read projection | NO |
| `opening_count` | required number or null | optional number | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, M, I | E + proof/preview/canonical projections | BLOCKED |
| `total_quoted_price` | required number or null | optional number | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, M, I | E + derived/canonical projections | BLOCKED |
| `hvhz_zone` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S | E | BLOCKED |
| `cancellation_policy` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, R | E | NO |
| `subject_to_remeasure_present` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, R | E | BLOCKED |
| `subject_to_remeasure_text` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | P | E | NO |
| `deposit_percent` | required number or null | optional number | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, R, I | E + canonical/fact projection | BLOCKED |
| `deposit_amount` | required number or null | optional number | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | P | E | BLOCKED |
| `final_payment_before_inspection` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, R | E | BLOCKED |
| `payment_schedule_text` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, R | E | NO |
| `terms_conditions_present` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, R | E | BLOCKED |
| `wall_repair_scope` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, R | E | NO |
| `stucco_repair_included` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S | E | BLOCKED |
| `drywall_repair_included` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S | E | BLOCKED |
| `paint_touchup_included` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S | E | BLOCKED |
| `debris_removal_included` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, R | E | BLOCKED |
| `engineering_mentioned` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, R | E | BLOCKED |
| `engineering_fees_included` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S | E | BLOCKED |
| `permit_fees_itemized` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, R | E | BLOCKED |
| `insurance_proof_mentioned` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, R | E | BLOCKED |
| `licensing_proof_mentioned` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, R | E | BLOCKED |
| `completion_timeline_text` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, R | E | NO |
| `lead_paint_disclosure_present` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S | E | BLOCKED |
| `generic_product_description_present` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, R | E | BLOCKED |
| `contractor_address_text` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | I; jurisdiction derivation | E | NO |
| `opening_level_glass_specs_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `blanket_glass_language_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `mixed_glass_package_visibility` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `opening_schedule_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `opening_schedule_room_labels_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S | E | BLOCKED |
| `opening_schedule_dimensions_complete` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `opening_schedule_product_assignments_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `bulk_scope_blob_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `change_order_policy_text` | required string or null | optional string or null | U | prompt/TS nullable; runtime any/missing | Yes | P | E | NO |
| `written_change_order_required` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `homeowner_approval_required_for_change_orders` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `unilateral_price_adjustment_allowed` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `substrate_condition_clause_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `rot_unit_pricing_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `buck_replacement_unit_pricing_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `substrate_allowance_text` | required string or null | optional string or null | U | prompt/TS nullable; runtime any/missing | Yes | P | E | NO |
| `remeasure_price_adjustment_cap_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `anchoring_method_text` | required string or null | optional string or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | NO |
| `anchor_spacing_specified` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `fastener_type_specified` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S | E | BLOCKED |
| `waterproofing_method_text` | required string or null | optional string or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | NO |
| `sealant_specified` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S | E | BLOCKED |
| `buck_treatment_method_text` | required string or null | optional string or null | U | prompt/TS nullable; runtime any/missing | Yes | S | E | NO |
| `manufacturer_install_compliance_stated` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `code_compliance_install_statement_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `warranty_execution_details_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `warranty_service_provider_type` | required string or null | optional enum (`contractor`, `manufacturer`, `third_party`, `unknown`) or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `warranty_service_provider_name` | required string or null | optional string or null | U | prompt/TS nullable; runtime any/missing | Yes | S | E | NO |
| `leak_callback_sla_days` | required number or null | optional number or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `labor_service_sla_days` | required number or null | optional number or null | U | prompt/TS nullable; runtime any/missing | Yes | S | E | BLOCKED |
| `callback_process_text` | required string or null | optional string or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | NO |
| `post_install_stucco_excluded` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `post_install_paint_excluded` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `water_intrusion_damage_excluded` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `line_items` | required array | required `LineItem[]` | array, length at least 1 on complete path | non-null; non-empty | Yes | G, S, F, M, R, I | E | YES |
| `line_items[]` | required object element | `LineItem` | non-null object | non-null object; no closed shape | Yes | G, S, F, M, R | E | YES |
| `line_items[].description` | required string | required string | string; empty allowed | non-null on complete path | Yes | G, S, M | E | RESTRICTED |
| `line_items[].quantity` | required number or null | optional number | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | M | E | BLOCKED |
| `line_items[].unit_price` | required number or null | optional number | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, M | E | BLOCKED |
| `line_items[].total_price` | required number or null | optional number | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, M | E | BLOCKED |
| `line_items[].brand` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, M, R | E | BLOCKED |
| `line_items[].series` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, M, R | E | BLOCKED |
| `line_items[].dp_rating` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, M | E | BLOCKED |
| `line_items[].noa_number` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, M | E | BLOCKED |
| `line_items[].dimensions` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | P | E | BLOCKED |
| `line_items[].opening_location` | required string or null | optional string or null | U | prompt/TS nullable; runtime any/missing | Yes | P | E | NO |
| `line_items[].opening_tag` | required string or null | optional string or null | U | prompt/TS nullable; runtime any/missing | Yes | P | E | NO |
| `line_items[].product_assignment_text` | required string or null | optional string or null | U | prompt/TS nullable; runtime any/missing | Yes | P | E | NO |
| `line_items[].glass_package_text` | required string or null | optional string or null | U | prompt/TS nullable; runtime any/missing | Yes | P | E | NO |
| `line_items[].glass_makeup_type` | required string or null | optional enum (`monolithic_laminated`, `insulated_laminated`, `laminated`, `insulated`, `tempered`, `unknown`) or null | U | prompt/TS nullable; runtime any/missing | Yes | S | E | BLOCKED |
| `line_items[].glass_low_e_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S | E | BLOCKED |
| `line_items[].glass_argon_present` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S | E | BLOCKED |
| `line_items[].glass_tint_text` | required string or null | optional string or null | U | prompt/TS nullable; runtime any/missing | Yes | P | E | NO |
| `line_items[].glass_spec_complete` | required boolean or null | optional boolean or null | U | prompt/TS nullable; runtime any/missing | Yes | S, F | E | BLOCKED |
| `warranty` | required object or null | optional object, not explicitly nullable | U | prompt nullable; TS absent/object; runtime any/missing | Yes | S, F, M, R, I | E | BLOCKED |
| `warranty.labor_years` | required number or null | optional number | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S | E | BLOCKED |
| `warranty.manufacturer_years` | required number or null | optional number | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S | E | BLOCKED |
| `warranty.transferable` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S | E | BLOCKED |
| `warranty.details` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, R | E | NO |
| `permits` | required object or null | optional object, not explicitly nullable | U | prompt nullable; TS absent/object; runtime any/missing | Yes | S, F, M, I | E | BLOCKED |
| `permits.included` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S | E | BLOCKED |
| `permits.responsible_party` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | P | E | NO |
| `permits.details` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | P | E | NO |
| `installation` | required object or null | optional object, not explicitly nullable | U | prompt nullable; TS absent/object; runtime any/missing | Yes | S, F, M | E | BLOCKED |
| `installation.scope_detail` | required string or null | optional string | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S, F, M | E | NO |
| `installation.disposal_included` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S | E | BLOCKED |
| `installation.accessories_mentioned` | required boolean or null | optional boolean | U | prompt nullable; TS optional non-null; runtime any/missing | Yes | S | E | BLOCKED |
| `price_fairness` | not prompt-declared | optional string | U | runtime any/missing | Yes | I | E + top-level `full_json` + analysis column | BLOCKED |
| `markup_estimate` | not prompt-declared | optional string | U | runtime any/missing | Yes | I | E + top-level `full_json` + analysis column | BLOCKED |
| `negotiation_leverage` | not prompt-declared | optional string | U | runtime any/missing | Yes | I | E + top-level `full_json` + analysis column | BLOCKED |
| `state_jurisdiction_mismatch` | not prompt-declared | optional boolean | No invariant: handler may set `true`; any preexisting value otherwise survives | runtime any/missing unless overwritten | Yes | S, F, R, I | E | BLOCKED |
| undeclared root `*` | not declared | not declared | U | any JSON type/missing | Yes | Unknown; may be persistence-only | `analyses.full_json.extraction.*` | BLOCKED |
| undeclared `line_items[].*` | not declared | not declared | U | any JSON type/missing | Yes | Unknown; persistence-only unless another consumer recognizes it | `analyses.full_json.extraction.line_items[].*` | BLOCKED |

### Matrix reconciliation

- The prompt declares 65 root keys including `line_items`, 18 line-item leaves, three nested object containers, and ten nested leaves.
- TypeScript adds four non-prompt fields: `price_fairness`, `markup_estimate`, `negotiation_leverage`, and `state_jurisdiction_mismatch`.
- Runtime accepts an unbounded set of additional root and line-item keys.
- The prompt requires null for unknown values while many TypeScript fields model absence instead of null; runtime preserves either and also accepts wrong types.
- No source-page, region, field-confidence, extraction-schema version, prompt version, parser version, or model version is attached to individual extraction fields.

## Can arbitrary or incorrectly typed fields survive?

**Yes — CONFIRMED.** The survival chain is direct:

1. `JSON.parse` creates the full provider-returned value without a reviver or projection.
2. `coerceParsedForExtraction` shallow-spreads the root object and overwrites only three classification fields.
3. `validateExtraction` checks the six minimum invariants listed in the conclusion.
4. The function returns `raw as ExtractionResult`; a TypeScript cast performs no runtime conversion.
5. `fullJson.extraction` receives that same object without an allowlist.
6. `analyses.full_json` persists the `fullJson` object.

Consequently:

- unknown root keys survive;
- unknown line-item keys survive;
- declared fields other than the minimum gate may survive with incorrect JSON types;
- explicit null, missing, false, zero, empty string, and empty nested arrays/objects are not normalized consistently;
- downstream scoring/report code may silently coerce, ignore, misinterpret, or throw on malformed values;
- no exhaustive deployed runtime field inventory exists beyond the bounded, enforced subset.

## Narrowest safely profileable deployed subset

This is a contract binding, not profiling authorization.

| Path / measure | Allowed aggregate use after all other gates | Restrictions |
|---|---|---|
| `analyses.document_is_window_door_related` or `full_json.extraction.is_window_door_related` | Boolean presence/counts | Prefer the deployed structured column; complete analyses should be true, but eligibility predicate still needs owner approval |
| `analyses.confidence_score` or `full_json.extraction.confidence` | Bounded numeric completeness/distribution | Prefer structured column; distinguish classification-terminal and complete populations; do not infer model comparability across unknown model overrides |
| `analyses.document_type` or `full_json.extraction.document_type` | Presence/type and approved allowlisted categories | Free-form string; suppress unexpected/raw labels rather than outputting them |
| `jsonb_array_length(full_json->'extraction'->'line_items')` | Aggregate element-count distributions | Only for rows first proven to meet the successful-path predicate; array position is not an opening identity and length is not quantity |
| `line_items[].description` | Presence/type/empty-string/approved length buckets only | Never return content, distinct values, hashes, excerpts, or tokenized text |

Explicitly blocked:

- every arbitrary `full_json` path not listed above;
- every monetary, quantity, opening, dimension, product, glass, permit, warranty, scope, payment, change-order, or boolean extraction path not runtime-enforced;
- all free-text, names, addresses, room/location labels, source-derived descriptions, raw JSON, and undeclared keys;
- `derived_metrics` and deterministic outputs for market/cohort use until their units, versions, and eligibility semantics are bound;
- inference that a path is safe merely because a prompt, interface, dormant normalizer, generated type, migration, or existing row shape mentions it.

## Consequences for Audit 04

1. The extraction-contract portion of `NEEDS_SCHEMA_BINDING` is resolved **only for the restricted subset above**.
2. Audit 04 must not generate a query for every prompt/TypeScript field. Non-enforced paths must be recorded as `NOT_PROFILED_UNBOUND` or equivalent, not cast or profiled speculatively.
3. No JSON cast may rely on the prompt or TypeScript type. Even allowed fields require `jsonb_typeof` guards before extraction/casting.
4. Structured deployed columns should be preferred over `full_json` where they carry the same runtime-enforced value.
5. `line_items` array length must not be treated as summed quantity, durable opening identity, quote revision identity, or project identity.
6. `document_type` must not be emitted as unrestricted distinct text; use an approved allowlist and suppression.
7. Description text is presence/type/length-bucket only and must never be returned.
8. Historical model/prompt/parser comparability is unbound because model overrides are possible and these versions are not persisted per analysis.
9. Audit 03C's remaining semantic bindings still apply. `NEEDS_SCHEMA_BINDING` overall remains unresolved and `GATE_DATABASE` remains unsatisfied until owner decisions bind valid extraction/analytics eligibility, monetary and quantity semantics, identity/revision/duplicate rules, test/demo exclusion, and fact-table ownership.
10. No profiling SQL is generated by this audit.

## Founder and owner semantic decisions — separate from technical findings

The following are decisions, not facts that source inspection can choose:

| Decision ID | Required decision | Why the deployed contract cannot decide it | Owner |
|---|---|---|---|
| FD-03D-001 | Exact valid-extraction and analytics-eligibility predicate | Runtime success proves only a shallow gate, not analytical quality | Founder / data owner |
| FD-03D-002 | Currency, total-price basis, line-price basis, taxes, fees, discounts, financing, allowances, optional work, and rounding | No currency field or enforced monetary semantics | Founder / finance-data owner |
| FD-03D-003 | Quantity, opening count, line count, array length, and dimension-unit rules | Prompt preserves raw dimensions; runtime enforces none of these meanings | Founder / extraction owner |
| FD-03D-004 | Project, quote, document, revision, immutable attempt, current-record, duplicate, and supersession rules | Deployed core schema lacks an authoritative quote/revision lineage rule | Founder / data owner |
| FD-03D-005 | Test/demo/internal exclusion predicate | `leads.is_test` exists, but propagation/completeness and other markers are unbound | Data / QA owner |
| FD-03D-006 | Which fact model is production-authoritative | Metadata proves objects exist, not active writer/ownership semantics | Founder / data platform owner |
| FD-03D-007 | Whether historical analyses without model/prompt/schema/parser versions are comparable or must be segmented/excluded | Runtime configuration is overrideable and versions are not persisted | Founder / extraction owner |
| FD-03D-008 | Whether any future profiling may use non-enforced extraction fields after a separate quality study | Current runtime cannot support type authority for those paths | Founder / privacy / data owner |

## Contradictions

| Contradiction ID | Claim | Evidence-supported disposition | Impact |
|---|---|---|---|
| C-03D-001 | Scanner comments describe “Gemini extraction → Zod validation” | CONTRADICTED: Zod validates only the incoming request body; extraction uses a manual shallow validator | Complete extraction schema cannot be inferred from Zod |
| C-03D-002 | Prompt pseudo-schema equals runtime contract | CONTRADICTED: all but the minimum gate are unenforced; unknown keys survive | Arbitrary prompt paths are unsafe for Audit 04 |
| C-03D-003 | TypeScript `ExtractionResult` defines accepted runtime shape | CONTRADICTED: it is a compile-time consumer type applied after a cast | Wrongly typed/undeclared values can persist |
| C-03D-004 | Deployed scanner source equals current repository source | CONTRADICTED: four archive entries differ and one current production dependency is absent | Repository cannot substitute for deployed package identity |
| C-03D-005 | Missing relative source means deployed runtime dependency failure | CONTRADICTED for observed omissions: all seven are type-only imports | Type-check completeness is affected; runtime dependency closure is intact |

## Unknowns

| Unknown ID | Question | Why unresolved | Checks performed | Build/profile impact | Required evidence |
|---|---|---|---|---|---|
| U-03D-001 | Exact Function ID, deployment version, and timestamp | Not supplied by archive; no remote metadata call authorized | Fingerprint and source provenance recorded | Limits deployment lineage and reproducibility | Sanitized Dashboard deployment metadata |
| U-03D-002 | Exact active model/timeout/token env overrides | Secret/config values were prohibited and not inspected | Source defaults and env variable names inspected | Historical model comparability unknown | Sanitized non-secret config attestation or persisted version metadata |
| U-03D-003 | Whether dev bypass is configured in production | Environment values were not inspected | Request and handler gate read | A configured secret permits alternate extraction input path | Sanitized environment-presence attestation, no value |
| U-03D-004 | Population prevalence of malformed/undeclared fields | Application-row and raw `full_json` inspection prohibited | Runtime acceptance path proven | Non-enforced field quality remains unknown | Separately authorized aggregate-only type/presence profiling after gates |
| U-03D-005 | Whether deployed package source is tied to the latest active deployment | Operator confirms Dashboard download, but exact deployment metadata is unknown | Hash and archive contents verified | Narrow provenance limitation | Function ID/version/timestamp evidence matching archive download |

## Build/profile blockers

| Blocker ID | Severity | Classification | Finding | Evidence | Behavior at risk | Resolution evidence | Owner |
|---|---|---|---|---|---|---|---|
| B-03D-001 | Critical | CONFIRMED | Extraction response has no closed runtime schema | A03D-010–A03D-014 | Invalid casts, misleading completeness, unsafe cohort facts | Versioned strict runtime response validator and persisted schema version, or restricted subset only | Extraction owner |
| B-03D-002 | High | CONFIRMED | Prompt, TypeScript nullability, and runtime acceptance conflict | A03D-011 | Missing/null/false/zero state integrity | Approved semantic contract plus runtime enforcement | Extraction/data owner |
| B-03D-003 | High | CONFIRMED | Arbitrary fields and wrong types can persist in `full_json.extraction` | A03D-013 | Unsafe profiling and downstream coercion | Restrict profiling; future implementation requires separate approved work | Data/security owner |
| B-03D-004 | High | CONFIRMED | Model/prompt/schema/parser versions are not persisted per analysis | A03D-007, A03D-012 | Historical comparability and reproducibility | Version lineage contract and data-owner historical rule | Extraction owner |
| B-03D-005 | High | UNKNOWN | Monetary, quantity/opening, revision, duplicate, test, and fact-ownership semantics remain unbound | Audit 03C; FD-03D-001–008 | Audit 04 population and cohort validity | Recorded owner decisions and binding manifest | Founder/data owner |
| B-03D-006 | Medium | UNKNOWN | Exact deployed artifact version/timestamp is unavailable | A03D-016 | Deployment lineage | Sanitized deployment metadata | Operator |

## Hard stops

No execution hard stop prevented archive inspection. The following scopes remained stopped as required:

- executing or importing downloaded source;
- extracting archive files into the repository;
- invoking `scan-quote`, Gemini, Supabase, RPCs, Storage, or any external service;
- inspecting secrets, customer records, application rows, raw JSON, source text, filenames, object paths, or logs;
- running builds, tests, type checks, package installation, SQL, migrations, deployment, or Git mutation;
- starting Audit 04, Audit 05, or implementation.

## Evidence ledger

| Evidence ID | Classification | Claim | Source domain | Exact reference | Observation | Build implication | Confidence | Required follow-up |
|---|---|---|---|---|---|---|---|---|
| A03D-001 | CONFIRMED | Operator identifies the archive as the production-branch `scan-quote` download | Operator attestation | Current task statement | WMProd / `forensic_report_v1` / `zgsofkgddpcntdvpckdq`; dormant parent excluded | Establishes supplied provenance, not deployment version | High for attestation | Bind deployment ID/version/time |
| A03D-002 | CONFIRMED | Archive fingerprint and integrity match | Local archive bytes | ZIP size/hash; all entries; CRC test | 60,473 bytes; 23 entries; exact SHA-256; CRC pass | Artifact is stable and readable | Very high | None |
| A03D-003 | CONFIRMED | Sanitized archive manifest contains 23 TypeScript source entries | Archive central directory | Manifest table above | No data files or secret files listed | Defines comparison scope | Very high | None |
| A03D-004 | CONFIRMED | Nineteen entries are identical and four differ from audited commit | Archive bytes + committed working tree | Per-entry SHA table; SHA `7a497a5f…` | No deployed-only entry; relevant repository-only files listed separately | Deployed extraction-critical equality can be tested precisely | Very high | Bind deployment lineage |
| A03D-005 | CONFIRMED | Scanner entrypoint difference is isolated to lead-pointer/snapshot handling | Source diff | Deployed `src/index.ts:73-75,1317-1360`; repository `index.ts:75-81,1323-1370` | Prompt/parse/validator/scoring/full-json blocks unchanged | Extraction contract unaffected; lifecycle differs | High | Audit lifecycle separately if implementing |
| A03D-006 | CONFIRMED | Missing relative imports are type-only | Static import inventory | Seven `import type` references to `_shared/tracking/canonical/types.ts` | No missing runtime relative import | Runtime package closure intact | High | Include types file for reproducible source snapshot |
| A03D-007 | CONFIRMED | Deployed provider contract is prompt-only with direct Gemini HTTP | Deployed archive source | `src/index.ts:362-520,862-943`; `_shared/scannerConfig.ts:17-40,75-105` | No response schema/MIME enforcement; model overrideable | Prompt types are not runtime bindings | Very high | Persist model/prompt/schema versions |
| A03D-008 | CONFIRMED | Provider response receives syntax normalization and `JSON.parse`, not schema parsing | Deployed archive source | `_shared/geminiJson.ts:25-80`; `src/index.ts:945-1079` | Normalizer strips wrappers only | Arbitrary parsed shape reaches gate | Very high | Strict versioned validator needed for broader contract |
| A03D-009 | CONFIRMED | Zod validates the HTTP request only | Deployed archive source | `src/requestSchema.ts:15-96`; `src/index.ts:527-557` | Extraction override is `unknown`; Gemini response never enters Zod | Do not label Zod as extraction validation | Very high | Correct documentation in future approved work |
| A03D-010 | CONFIRMED | Complete-path runtime gate enforces only minimum classification/line-item invariants | Deployed archive source | `classificationGate.ts:29-131`; `src/index.ts:85-99,195-229,1081-1152` | Shallow spread + manual checks + cast | Restrict profileable paths | Very high | None for restricted subset |
| A03D-011 | CONFIRMED | Prompt and TypeScript contracts conflict in nullability and field set | Deployed archive source | `src/index.ts:416-520`; `src/scoring.ts:11-159` | Prompt requires keys/nulls; TS often models optional non-null; four TS-only fields | Missing/null semantics unbound | Very high | Owner semantic manifest |
| A03D-012 | CONFIRMED | Deterministic consumers and persistence trust the cast extraction | Deployed archive source | `src/index.ts:1163-1318`; `scoring.ts`; `flagging.ts`; `reportCompiler.ts`; `_shared/metrics.ts` | Full extraction is embedded in `full_json` | Malformed values can affect outputs | Very high | Strict validation or restricted use |
| A03D-013 | CONFIRMED | Unknown and incorrectly typed fields can survive to persistence | Deployed archive source | `src/index.ts:90-98,229,1261-1305` | No allowlist/strip between parse and `full_json.extraction` | Arbitrary paths blocked | Very high | Do not profile unbound paths |
| A03D-014 | CONFIRMED | Narrow runtime-enforced subset is technically bindable | Synthesis of deployed control flow | Gate and matrix above | Classification fields and line-item container/description shape only | Supports restricted profiling design after all other gates | High | Approve eligibility/security parameters |
| A03D-015 | CONFIRMED | Contract gate is satisfied only with a restricted subset | Audit synthesis | This report | Closed complete contract is absent | Audit 04 cannot claim full extraction coverage | High | Carry restrictions into binding manifest |
| A03D-016 | UNKNOWN | Archive exact deployment version/time is known | Operator evidence | Function ID/version/timestamp explicitly unknown | Approximate Dashboard age only | Reproducibility limitation | High | Sanitized deployment metadata |
| A03D-017 | CONFIRMED | Target deployed schema has nullable `analyses.full_json jsonb` | Prior deployed metadata evidence | Audit 03C A03C-005 and object comparison | Physical persistence column is deployed; JSON paths were not catalog-bound | Archive now binds only restricted JSON paths technically | High | Retain source-domain separation |

## Handoff to schema binding / future Audit 04 review

| Audit 04 input | Bound value | Evidence | Status | Safe for SQL generation now? |
|---|---|---|---|---|
| Deployed extraction source artifact | ZIP SHA-256 `8AC6F…C073`; operator-attributed to target branch | A03D-001–A03D-004 | CONFIRMED_WITH_DEPLOYMENT_METADATA_LIMITATION | No, by itself |
| JSON extraction root | `analyses.full_json.extraction` on complete path | A03D-012, A03D-017 | CONFIRMED | Only after all remaining gates |
| Runtime-enforced root fields | `document_type`, `is_window_door_related`, `confidence` | A03D-010, A03D-014 | CONFIRMED_RESTRICTED | Yes only for guarded aggregate queries after eligibility approval |
| Runtime-enforced repeatable branch | non-empty `line_items[]`; each element object; description string | A03D-010, A03D-014 | CONFIRMED_RESTRICTED | Count/type/presence only after eligibility approval |
| Other declared extraction fields | Prompt/TS declarations without response runtime enforcement | A03D-011–A03D-013 | CONTRADICTED_AS_RUNTIME_BINDING | No |
| Undeclared extraction fields | Unbounded and preserved | A03D-013 | BLOCKED | No |
| Monetary and quantity semantics | No currency/basis/rounding/count authority | A03D-011; FD-03D-002–003 | UNKNOWN | No |
| Valid-extraction / analytics eligibility | Founder/data-owner decision required | FD-03D-001 | UNKNOWN | No |
| Identity/revision/duplicate/current rule | Founder/data-owner decision required | FD-03D-004 | UNKNOWN | No |
| Test/demo exclusion | Data/QA decision required | FD-03D-005 | UNKNOWN | No |
| Fact ownership | Founder/data-platform decision required | FD-03D-006 | UNKNOWN | No |

**Handoff status:** the technical deployed extraction contract is now bounded, but only as a restricted subset. `NEEDS_SCHEMA_BINDING` is not fully resolved, `GATE_DATABASE` remains unsatisfied, and profiling-pack generation remains paused pending the listed semantic decisions and an explicit next authorization.

## Final status

`SATISFIED_WITH_RESTRICTED_PROFILEABLE_SUBSET`
