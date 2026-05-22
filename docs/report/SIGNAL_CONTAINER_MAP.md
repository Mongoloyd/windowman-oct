# SIGNAL_CONTAINER_MAP — Truth Report V2

Source-of-truth mapping from the **37-signal spreadsheet** to the **real backend fields** in [`supabase/functions/scan-quote/`](../../supabase/functions/scan-quote/), with citations and explicit gap labels.

**Phase 1 documentation only.** No runtime code, mapper, components, routes, Supabase, or schema changes are made by this doc.

---

## 1. Product principle — findings-first, pillar-backed

Truth Report V2 is **FINDINGS-FIRST in presentation, PILLAR-BACKED in scoring.**

| Layer | Role |
|-------|------|
| 5 pillars ([`scoring.ts`](../../supabase/functions/scan-quote/scoring.ts)) | Backend scoring engine. Determines letter grade, hard caps, severity context. **Stays under the hood.** |
| Flags / warnings / missing items ([`flagging.ts`](../../supabase/functions/scan-quote/flagging.ts), [`reportCompiler.ts`](../../supabase/functions/scan-quote/reportCompiler.ts)) | Finding engine. Produces visceral "what's wrong" signals shown to the homeowner. |
| Partial reveal ([`PartialRevealHero.tsx`](../../src/components/forensic-report/PartialRevealHero.tsx)) | Tension engine. Big grade, top-level danger counts, blurred truth trail, OTP gate. |
| Full reveal ([`ForensicAuditReport.tsx`](../../src/components/forensic-report/ForensicAuditReport.tsx)) | Action engine. Findings expand into a decision plan with evidence. |
| Adaptive sections | Story engine. Sections appear/collapse based on what the quote actually contains — adaptive behavior must come from known backend data, never invented frontend claims. |

### Rules

- The 5 pillars remain the **deterministic scoring authority**. They do not disappear; they just stop being the visible organizing principle of the UI.
- The UI must **not** be organized primarily as five pillar sections.
- Partial reveal: *"Something is wrong. I can see enough to know I should not ignore this."*
- Full reveal: *"Now I know exactly what is wrong, why it matters, and what to do next."*
- Homeowner experience target: **grade → danger → evidence → action**.
- Do not fake unsupported "37 signal" coverage. The spreadsheet is a **product target**, not the current backend reality.

### Scanner Brain — extraction vs interpretation

Gemini extracts quote evidence. Deterministic TypeScript computes grades, flags, derived financial metrics, bands, and report interpretation (`scoring.ts` → `flagging.ts` → `computeDerivedMetrics` → `reportCompiler.ts` in [`scan-quote/index.ts`](../../supabase/functions/scan-quote/index.ts)).

Legacy nullable display fields `price_fairness`, `markup_estimate`, and `negotiation_leverage` remain pass-through keys on `full_json` and `analyses` columns, but the current Gemini extraction prompt does **not** request them. Prefer `derived_metrics`, `price_per_opening`, and `price_per_opening_band` for financial interpretation. The Classic UI label **FINANCIAL FORENSICS** is a presentation section name only — it does not imply Gemini produces pricing judgment.

---

## 2. Source verification discipline

Every signal in this map must be classified as one of:

| Status | Meaning |
|--------|---------|
| **Yes (file:line)** | Field verified in `supabase/functions/scan-quote/`. Cite the path + line. |
| **Partial (file:line)** | Some adjacent extraction exists, but the spreadsheet's exact concept is not fully captured. Cite and note the gap. |
| **No — future Scanner Brain** | No extraction field, no flag, no metric. The spreadsheet row is product vision, not current behavior. |
| **Source unresolved** | Appears in Classic UI / marketing copy but no canonical extraction/flag/metric field is found in `supabase/functions/scan-quote/`. Treat as **observed finding, source unresolved** until verified. |

**Do not assert any field is a confirmed backend boolean unless the file path and line are cited.**

---

## 3. Preview vs full enforcement (backend-enforced)

From [`20260322100001_redact_preview_create_gated_full.sql`](../../supabase/migrations/20260322100001_redact_preview_create_gated_full.sql):

| Field | `get_analysis_preview` (preview RPC) | `get_analysis_full` (full RPC, post-OTP) |
|-------|--------------------------------------|------------------------------------------|
| `grade` | Yes (line 31) | Yes (line 91) |
| `flag_count` | Yes (line 32) | — |
| `flag_red_count` | Yes — Critical + High aggregate (lines 33–35) | derivable from flags |
| `flag_amber_count` | Yes — Medium aggregate (lines 36–38) | derivable from flags |
| `proof_of_read` | Yes (line 39) | Yes (line 94) |
| `preview_json` | Yes (line 40) | Yes (line 95) |
| `confidence_score` | Yes (line 41) | Yes (line 96) |
| `document_type` | Yes (line 42) | Yes (line 97) |
| `flags[]` array | **No** | Yes (line 92) |
| `full_json` (incl. `extraction`, numeric pillars, `derived_metrics`) | **No** | Yes (line 93) |

**Findings-first implication:** Partial reveal can show **grade + counts + bands + teasers**. It must **not** show full flag detail, numeric pillar scores, `derived_metrics`, or `extraction`.

---

## 4. preview_json shape (canonical teaser)

From [`scan-quote/index.ts`](../../supabase/functions/scan-quote/index.ts) lines 1629–1649:

| Field | Source |
|-------|--------|
| `grade` | `gradeResult.letterGrade` |
| `flag_count` | `flags.length` |
| `opening_count_bucket` | derived bucket: `1-5` / `6-10` / `11-20` / `20+` (lines 1611–1618) |
| `quality_band` | `good` / `fair` / `poor` from `weightedAverage` |
| `hard_cap_applied` | `gradeResult.hardCapApplied` |
| `has_warranty` | `!!extraction.warranty` |
| `has_permits` | `!!extraction.permits` |
| `pillar_scores` | **Status-only** per pillar (`pass`/`warn`/`fail`), via `buildPreviewPillarScores` |
| `top_warning` | `compiledReport.top_warning` |
| `top_missing_item` | `compiledReport.top_missing_item` |
| `missing_items_count` | `compiledReport.missing_items.length` |
| `payment_risk_detected` | boolean |
| `scope_gap_detected` | boolean |
| `price_per_opening_band` | `low` / `market` / `high` / `extreme` / null |
| `summary_teaser` | string |

**No** numeric pillar scores, **no** flag details, **no** derived metric numbers, **no** extraction object in preview.

---

## 5. full_json shape (post-OTP)

From [`scan-quote/index.ts`](../../supabase/functions/scan-quote/index.ts) lines 1652–1673:

| Field | Source |
|-------|--------|
| `grade` | letter grade |
| `weighted_average` | numeric 0–100 |
| `hard_cap_applied` | string \| null |
| `pillar_scores` | **Numeric** `{ safety, install, price, finePrint, warranty }` |
| `flags` | Full `Flag[]` array |
| `extraction` | Full `ExtractionResult` |
| `derived_metrics` | Deterministic financial breakdown + `county_benchmark` (`computeDerivedMetrics`, post-extraction) |
| `rubric_version` | e.g. `"1.6.0"` |
| `price_fairness`, `markup_estimate`, `negotiation_leverage` | Legacy nullable display/pass-through fields copied from `extraction.*` if present ([`index.ts`](../../supabase/functions/scan-quote/index.ts) ~1678–1680). Not requested by the current Gemini prompt. Not scoring authority. Use `derived_metrics` / `reportCompiler` outputs instead. |
| `warnings` | `string[]` |
| `missing_items` | `string[]` |
| `summary` | string |
| `top_warning`, `top_missing_item` | strings |
| `price_per_opening` | `reportCompiler` from `derived_metrics` (deterministic) |
| `price_per_opening_band` | `reportCompiler.resolvePricePerOpeningBand(derived_metrics)` (deterministic) |
| `payment_risk_detected`, `scope_gap_detected` | booleans |

---

## 6. Container map (findings-first naming)

These are the UI sections the V2 forensic report can present. Findings drive container visibility, not pillars.

| Container | Adaptive trigger (must be backend-real) | Reveal phase |
|-----------|----------------------------------------|--------------|
| **Executive Summary** | Always | preview (grade only) + full (full version) |
| **Tension Hero (locked)** | Always in preview | preview only |
| **Top Forensic Findings** | `flags.length > 0` (preview shows blurred placeholders only) | preview (blurred) + full (real) |
| **Code & Jurisdiction Fit** | Any flag with pillar `safety`, OR `dp_coverage_pct`/`noa_coverage_pct` < 100, OR `state_jurisdiction_mismatch === true` | full |
| **Financial Integrity** | Any flag with pillar `price` or `finePrint`, OR `deposit_percent > 33`, OR warranty year tiers tripped | full |
| **Market Intelligence** | `derived_metrics.county_benchmark.comparison_available === true` | full |
| **Scope Overview** | `proof_of_read.opening_count > 0` | preview (count only) + full (per-opening math) |
| **Property Profile** | Lead/intake data present | full (currently **not** wired into `buildFullData`) |
| **Action Plan / Next Steps** | Any red or amber flag count > 0 | full |

**Pillar-based section names** (e.g. "Safety & Code Match", "Install & Scope Clarity") may remain in [`useAnalysisData.ts`](../../src/hooks/useAnalysisData.ts) `PILLAR_DEFS` (lines 84–90) for internal scoring, but the V2 UI should not lead with them.

---

## 7. Signal map — 37 spreadsheet rows

Legend: **Implemented?** = `Yes (file:line)` / `Partial` / `No — future Scanner Brain` / `Source unresolved`.

### Homeowner & Property (rows 1–5)

| # | Signal | Supabase Field | Implemented? | Data Type | Preview Safe? | Container | Display | Notes |
|---|--------|---------------|--------------|-----------|---------------|-----------|---------|-------|
| 1 | Homeowner Name | None in `ExtractionResult` ([`scoring.ts`](../../supabase/functions/scan-quote/scoring.ts) lines 43–159) | **No — needs leads/intake wiring** | text | No | Property Profile | text | Available in `leads` table but **not** mapped in [`useAnalysisData.buildFullData`](../../src/hooks/useAnalysisData.ts) (lines 264+). Mocked at [`DevReportPreview.tsx:131`](../../src/pages/DevReportPreview.tsx). |
| 2 | Property Address | None in `ExtractionResult` | **No — needs leads/intake wiring** | text | No | Property Profile | text | Same gap as #1. Mocked at [`DevReportPreview.tsx:132`](../../src/pages/DevReportPreview.tsx). |
| 3 | Property Type | None in `ExtractionResult` | **No — needs leads/intake wiring** | enum | No | Property Profile | badge | Mocked at [`DevReportPreview.tsx:133`](../../src/pages/DevReportPreview.tsx). |
| 4 | Wind Zone / Exposure Category | `hvhz_zone?: boolean` at [`scoring.ts:73`](../../supabase/functions/scan-quote/scoring.ts) | **Partial** (HVHZ boolean only; no full Exposure B/C/D enum) | boolean / future enum | Currently No (not in `preview_json`) | Property Profile / Code & Jurisdiction | badge | UI prop `windZone` mocked at [`DevReportPreview.tsx:134`](../../src/pages/DevReportPreview.tsx). |
| 5 | Building Code Jurisdiction | `contractor_address_text?: string` at [`scoring.ts:157`](../../supabase/functions/scan-quote/scoring.ts); plus county passed to `computeDerivedMetrics` | **Partial** (contractor address + county; no parsed jurisdiction string) | text | No | Property Profile / Code & Jurisdiction | text | UI prop `codeJurisdiction` mocked at [`DevReportPreview.tsx:135`](../../src/pages/DevReportPreview.tsx). |

### Project Scope (rows 6–11)

| # | Signal | Supabase Field | Implemented? | Data Type | Preview Safe? | Container | Display | Notes |
|---|--------|---------------|--------------|-----------|---------------|-----------|---------|-------|
| 6 | Total Number of Openings | `opening_count?: number` at [`scoring.ts:71`](../../supabase/functions/scan-quote/scoring.ts); `proof_of_read.opening_count` at [`index.ts:1622`](../../supabase/functions/scan-quote/index.ts); `derived_metrics.counts.total_openings` at [`index.ts:461`](../../supabase/functions/scan-quote/index.ts) | **Yes** | integer | Partial — `opening_count_bucket` in preview only ([`index.ts:1632`](../../supabase/functions/scan-quote/index.ts)) | Scope Overview / Executive Summary | number | Preview shows bucket (`1-5`/`6-10`/`11-20`/`20+`); full shows exact integer. |
| 7 | Opening Types Breakdown | `derived_metrics.counts.window_openings` / `door_openings` at [`index.ts:464–465`](../../supabase/functions/scan-quote/index.ts) | **Partial** (window vs door bucket counts only; not a per-opening jsonb breakdown) | jsonb (target) / counts (today) | No | Scope Overview | jsonb / list | |
| 8 | Opening Dimensions (per unit) | `line_items[].dimensions?: string` at [`scoring.ts:20`](../../supabase/functions/scan-quote/scoring.ts); `opening_schedule_dimensions_complete?: boolean` at [`scoring.ts:116`](../../supabase/functions/scan-quote/scoring.ts) | **Partial** (string + completeness boolean; not normalized W×H per opening) | jsonb (target) | No | Scope Overview | text/list | Spreadsheet marks as Phase 2. |
| 9 | Price Per Opening | `derived_metrics.per_opening.installed_price_per_opening` at [`index.ts:475`](../../supabase/functions/scan-quote/index.ts); `preview_json.price_per_opening_band` at [`index.ts:1647`](../../supabase/functions/scan-quote/index.ts); `full_json.price_per_opening` at [`index.ts:1669`](../../supabase/functions/scan-quote/index.ts) | **Yes** | decimal | **Band only** in preview; exact value full-only | Scope Overview / Market Intelligence | currency / band badge | |
| 10 | Installation Method / Lead Time | `installation.scope_detail?: string` at [`scoring.ts:64`](../../supabase/functions/scan-quote/scoring.ts); `anchoring_method_text` / `waterproofing_method_text` at [`scoring.ts:132–135`](../../supabase/functions/scan-quote/scoring.ts) | **Partial** (install scope + anchoring fields; no normalized method enum) | text | No | Scope Overview / Code & Jurisdiction | text | Missing-anchoring/waterproofing flags fire at [`flagging.ts:354–367`](../../supabase/functions/scan-quote/flagging.ts). |
| 11 | Projected Timeline / Lead Time | `completion_timeline_text?: string` at [`scoring.ts:102`](../../supabase/functions/scan-quote/scoring.ts) | **Partial** (text only) | integer (target) | No | Scope Overview | text / weeks | Spreadsheet marks as Phase 2. Missing flag fires at [`flagging.ts:177–183`](../../supabase/functions/scan-quote/flagging.ts). |

### Product Engineering (rows 12–19)

| # | Signal | Supabase Field | Implemented? | Data Type | Preview Safe? | Container | Display | Notes |
|---|--------|---------------|--------------|-----------|---------------|-----------|---------|-------|
| 12 | Brand / Manufacturer | `line_items[].brand?: string` at [`scoring.ts:16`](../../supabase/functions/scan-quote/scoring.ts) | **Yes** | text (per line) | No | Product Dossier | text | `unspecified_brand` flag at [`flagging.ts:74–82`](../../supabase/functions/scan-quote/flagging.ts). |
| 13 | Product Series / Line | `line_items[].series?: string` at [`scoring.ts:17`](../../supabase/functions/scan-quote/scoring.ts) | **Yes** | text (per line) | No | Product Dossier | text | |
| 14 | DP Rating | `line_items[].dp_rating?: string` at [`scoring.ts:18`](../../supabase/functions/scan-quote/scoring.ts); `derived_metrics.coverage.dp_coverage_pct` | **Yes** | text/decimal | No | Code & Jurisdiction Fit | score / coverage % | `missing_dp_rating` flag at [`flagging.ts:18`](../../supabase/functions/scan-quote/flagging.ts) (severity High → counted as red). |
| 15 | Impact Rating | None explicit. Closest: description regex for impact/hurricane mention in [`scoring.ts`](../../supabase/functions/scan-quote/scoring.ts) `scoreSafety`; `glass_makeup_type` enum at [`scoring.ts:24–31`](../../supabase/functions/scan-quote/scoring.ts) | **Partial** (description regex + glass enum; no normalized Impact/SM/Non-Impact enum) | enum (target) | No | Product Dossier / Code & Jurisdiction | badge | |
| 16 | Glass Composition | `line_items[].glass_makeup_type` enum at [`scoring.ts:24–31`](../../supabase/functions/scan-quote/scoring.ts); `glass_low_e_present`, `glass_argon_present`, `glass_spec_complete` at [`scoring.ts:32–35`](../../supabase/functions/scan-quote/scoring.ts) | **Yes** | enum + booleans | No | Product Dossier | badge | |
| 17 | Frame Material | None explicit in `ExtractionResult`. May surface in `line_items[].description`. | **No — future Scanner Brain** | enum (target) | No | Product Dossier | badge | |
| 18 | U-Factor | None in `ExtractionResult` | **No — future Scanner Brain** | decimal | No | Product Dossier | score | Spreadsheet marks as Phase 2. |
| 19 | SHGC (Solar Heat Gain Coefficient) | None in `ExtractionResult` | **No — future Scanner Brain** | decimal | No | Product Dossier | score | Spreadsheet marks as Phase 2. |

### Compliance (rows 20–25)

| # | Signal | Supabase Field | Implemented? | Data Type | Preview Safe? | Container | Display | Notes |
|---|--------|---------------|--------------|-----------|---------------|-----------|---------|-------|
| 20 | Florida Product Approval Number | `line_items[].noa_number?: string` at [`scoring.ts:19`](../../supabase/functions/scan-quote/scoring.ts) (used for both NOA and FL approval); `derived_metrics.coverage.noa_coverage_pct` | **Partial** (single field for NOA/FL approval — not separated) | text | No | Code & Jurisdiction Fit | text + verification link | `missing_noa_number` flag at [`flagging.ts:27`](../../supabase/functions/scan-quote/flagging.ts) (Medium → counted as amber). |
| 21 | Miami-Dade NOA Number | Same field as #20 (`line_items[].noa_number`) | **Partial** (shared with #20) | text | No | Code & Jurisdiction Fit | text + verification link | |
| 22 | Florida Building Code Edition Referenced | None explicit | **No — future Scanner Brain** | text | No | Code & Jurisdiction Fit | badge | |
| 23 | Permit Fee Disclosed | `permits?: { included?, responsible_party?, details? }` at [`scoring.ts:57–61`](../../supabase/functions/scan-quote/scoring.ts); `permit_fees_itemized?: boolean` at [`scoring.ts:97`](../../supabase/functions/scan-quote/scoring.ts) | **Yes** | boolean | `has_permits` boolean in preview ([`index.ts:1640`](../../supabase/functions/scan-quote/index.ts)) | Financial Integrity / Code & Jurisdiction | red flag card | `no_permits_mentioned` flag at [`flagging.ts:37`](../../supabase/functions/scan-quote/flagging.ts) (High → red). `permit_fees_unclear` flag at [`flagging.ts:154–161`](../../supabase/functions/scan-quote/flagging.ts). |
| 24 | Energy Code Compliance | None in `ExtractionResult` | **No — future Scanner Brain** | boolean | No | Code & Jurisdiction Fit | flag card | Spreadsheet marks as Phase 2. |
| 25 | Missing Code Language Flag | No explicit `missing_code_language` flag. Closest: missing-NOA/DP flags ([`flagging.ts:18–32`](../../supabase/functions/scan-quote/flagging.ts)); `install_compliance_unverified` flag at [`flagging.ts:378–388`](../../supabase/functions/scan-quote/flagging.ts) (manufacturer/code compliance statement missing). | **Partial** (no aggregate "code language" flag, but related sub-flags exist) | boolean (flag) | Counted via `flag_red_count` | Code & Jurisdiction Fit | flag card | |

### Financial Integrity (rows 26–32)

| # | Signal | Supabase Field | Implemented? | Data Type | Preview Safe? | Container | Display | Notes |
|---|--------|---------------|--------------|-----------|---------------|-----------|---------|-------|
| 26 | Total Contract Price | `total_quoted_price?: number` at [`scoring.ts:70`](../../supabase/functions/scan-quote/scoring.ts); `derived_metrics.totals.contract_total` at [`index.ts:453`](../../supabase/functions/scan-quote/index.ts) | **Yes** | decimal | No (not in `preview_json`) | Financial Integrity / Scope Overview | currency | |
| 27 | Deposit Amount / Percentage | `deposit_percent?: number` at [`scoring.ts:81`](../../supabase/functions/scan-quote/scoring.ts); `deposit_amount?: number` at [`scoring.ts:82`](../../supabase/functions/scan-quote/scoring.ts) | **Yes** | decimal + % | Bucket via `payment_risk_detected` boolean ([`index.ts:1645`](../../supabase/functions/scan-quote/index.ts)) | Financial Integrity | currency + WARNING card | `deposit_over_40_percent` flag at [`flagging.ts:104–111`](../../supabase/functions/scan-quote/flagging.ts) — severity Critical if >50%, High if >40%. |
| 28 | Payment Schedule / Terms | `payment_schedule_text?: string` at [`scoring.ts:84`](../../supabase/functions/scan-quote/scoring.ts); `final_payment_before_inspection?: boolean` at [`scoring.ts:83`](../../supabase/functions/scan-quote/scoring.ts) | **Yes** | text + boolean | `payment_risk_detected` in preview | Financial Integrity | text + WARNING card | `payment_before_inspection` flag at [`flagging.ts:113–119`](../../supabase/functions/scan-quote/flagging.ts). |
| 29 | Financing Terms | None in `ExtractionResult` | **No — future Scanner Brain** | text | No | Financial Integrity | text | Spreadsheet marks as Phase 2. |
| 30 | Warranty Duration — Product | `warranty.manufacturer_years?: number` at [`scoring.ts:52`](../../supabase/functions/scan-quote/scoring.ts) | **Yes** | integer | `has_warranty` boolean only ([`index.ts:1639`](../../supabase/functions/scan-quote/index.ts)) | Financial Integrity / Warranty | number + tier badge | Tier deductions at [`scoring.ts:451–455`](../../supabase/functions/scan-quote/scoring.ts) (<10, <20). |
| 31 | Warranty Duration — Labor | `warranty.labor_years?: number` at [`scoring.ts:51`](../../supabase/functions/scan-quote/scoring.ts) | **Yes** | integer | `has_warranty` boolean only | Financial Integrity / Warranty | number + WARNING if short | Tier deductions at [`scoring.ts:440–446`](../../supabase/functions/scan-quote/scoring.ts) (undefined / <1 / <2 / <5). |
| 32 | Hidden Fees Detected | Composite: `debris_removal_included?: boolean` at [`scoring.ts:94`](../../supabase/functions/scan-quote/scoring.ts); `permit_fees_itemized?: boolean` at [`scoring.ts:97`](../../supabase/functions/scan-quote/scoring.ts); `engineering_fees_included?: boolean` at [`scoring.ts:96`](../../supabase/functions/scan-quote/scoring.ts); plus `top_missing_item`/`missing_items` from compiler | **Partial** (composite — no single `hidden_fees_detected` boolean) | boolean (composite) | `top_missing_item` + `missing_items_count` in preview | Financial Integrity / Action Plan | red flag card + list | Related flags fire in [`flagging.ts:140–162`](../../supabase/functions/scan-quote/flagging.ts) (debris, engineering, permit fees). |

### Forensic Vulnerabilities (rows 33–37) — NOT IMPLEMENTED

These rows from the spreadsheet are **product vision, not current backend behavior**. Do not show fake CLEAR rows for these in the UI.

| # | Signal | Supabase Field | Implemented? | Notes |
|---|--------|---------------|--------------|-------|
| 33 | Bait and Switch Flag | None | **No — future Scanner Brain** | No `bait_and_switch_flag` boolean and no matching flag rule in [`flagging.ts`](../../supabase/functions/scan-quote/flagging.ts). |
| 34 | Product Downgrade Flag | None | **No — future Scanner Brain** | No `product_downgrade_flag` and no matching flag rule. |
| 35 | Missing Line-Item Detail Flag | `missing_line_item_pricing` flag at [`flagging.ts:53–63`](../../supabase/functions/scan-quote/flagging.ts) (High → red) | **Partial** (covers per-line pricing; not the broader "lump-sum vs itemized" concept end-to-end) | Closest existing flag. |
| 36 | Pressure Rating Mismatch | None | **No — future Scanner Brain** | No `dp_rating_mismatch` boolean comparing extracted DP vs approval database. |
| 37 | Non-Approved Product Substitution Flag | None | **No — future Scanner Brain** | No `non_approved_substitution` flag; would require FL Product Approval lookup. |

---

## 8. Other findings present in code but NOT on the 37-signal spreadsheet

These show in flags/warnings but are not numbered spreadsheet signals. Document them so V2 UI knows where to place them.

| Finding | Source | Container | Reveal phase |
|---------|--------|-----------|--------------|
| State Jurisdiction Mismatch | `state_jurisdiction_mismatch?: boolean` at [`scoring.ts:158`](../../supabase/functions/scan-quote/scoring.ts); flag at [`flagging.ts:194–202`](../../supabase/functions/scan-quote/flagging.ts) (severity High → counted in `flag_red_count`); warning at [`reportCompiler.ts:88–92`](../../supabase/functions/scan-quote/reportCompiler.ts) | Code & Jurisdiction Fit | Preview: count-only via `flag_red_count`. Detailed explanation: full-only. |
| Subject-to-Remeasure Clause | `subject_to_remeasure_present?: boolean` at [`scoring.ts:79`](../../supabase/functions/scan-quote/scoring.ts); flag at [`flagging.ts:95–103`](../../supabase/functions/scan-quote/flagging.ts) (Critical → red) | Financial Integrity / Action Plan | Preview: count-only. Full: WARNING card with text. |
| Unilateral Price Adjustment | `unilateral_price_adjustment_allowed?: boolean` at [`scoring.ts:124`](../../supabase/functions/scan-quote/scoring.ts); flag at [`flagging.ts:298–306`](../../supabase/functions/scan-quote/flagging.ts) (Critical + hard cap D) | Financial Integrity / Action Plan | Preview: count-only. Full: critical alert + hard-cap note. |
| Cancellation Policy Missing | `!cancellation_policy` ([`scoring.ts:69`](../../supabase/functions/scan-quote/scoring.ts)); flag at [`flagging.ts:67–72`](../../supabase/functions/scan-quote/flagging.ts) (Medium → amber) | Financial Integrity | Preview: count-only. Full: flag card. |
| Insurance / Licensing Not Shown | `insurance_proof_mentioned`, `licensing_proof_mentioned` at [`scoring.ts:100–101`](../../supabase/functions/scan-quote/scoring.ts); flag at [`flagging.ts:165–176`](../../supabase/functions/scan-quote/flagging.ts) | Code & Jurisdiction / Trust | Preview: count-only. Full: flag card. |
| Generic Product Description | `generic_product_description_present?: boolean` at [`scoring.ts:106`](../../supabase/functions/scan-quote/scoring.ts); flag at [`flagging.ts:185–193`](../../supabase/functions/scan-quote/flagging.ts) (High → red); warning at [`reportCompiler.ts:94–98`](../../supabase/functions/scan-quote/reportCompiler.ts) | Product Dossier / Action Plan | Full only. |
| Glass-package ambiguity (multiple) | `opening_level_glass_specs_present`, `blanket_glass_language_present`, `mixed_glass_package_visibility`, `glass_spec_complete` at [`scoring.ts:108–111, 35`](../../supabase/functions/scan-quote/scoring.ts); flags at [`flagging.ts:204–249`](../../supabase/functions/scan-quote/flagging.ts) | Product Dossier | Full only. |
| Opening Schedule gaps | `opening_schedule_present`, `opening_schedule_dimensions_complete`, etc. at [`scoring.ts:113–118`](../../supabase/functions/scan-quote/scoring.ts); flags at [`flagging.ts:252–295`](../../supabase/functions/scan-quote/flagging.ts) | Scope Overview / Action Plan | Full only. |
| Substrate open-checkbook | `substrate_condition_clause_present`, `rot_unit_pricing_present`, `buck_replacement_unit_pricing_present` at [`scoring.ts:125–127`](../../supabase/functions/scan-quote/scoring.ts); flag at [`flagging.ts:328–339`](../../supabase/functions/scan-quote/flagging.ts) (High → red; hard cap C) | Financial Integrity / Action Plan | Full only. |
| Warranty execution gaps | `warranty_execution_details_present`, `warranty_service_provider_type`, `leak_callback_sla_days` at [`scoring.ts:142–150`](../../supabase/functions/scan-quote/scoring.ts); flags at [`flagging.ts:390–419`](../../supabase/functions/scan-quote/flagging.ts) | Financial Integrity / Warranty | Full only. |
| Water Intrusion Excluded | `water_intrusion_damage_excluded?: boolean` at [`scoring.ts:155`](../../supabase/functions/scan-quote/scoring.ts); flag at [`flagging.ts:440–449`](../../supabase/functions/scan-quote/flagging.ts) (High → red) | Financial Integrity / Warranty | Full only. |
| OCR Confidence | `extraction.confidence: number` at [`scoring.ts:46`](../../supabase/functions/scan-quote/scoring.ts); persisted as `analyses.confidence_score` at [`index.ts:1684`](../../supabase/functions/scan-quote/index.ts); exposed in both preview and full RPCs | Executive Summary | Both preview and full (as `confidence_score`). |

---

## 9. Mock vs real gap table

| Mock (current lab) | Real source candidate | Status |
|--------------------|----------------------|--------|
| `signalsTotal = 37` ([`DevReportPreview.tsx:117`](../../src/pages/DevReportPreview.tsx)) | No backend field exists | **Product vision** — UI must not present "X of 37" as fact until a backend signal-coverage registry exists. |
| `signalsExtracted = 31` ([`DevReportPreview.tsx:116`](../../src/pages/DevReportPreview.tsx)) | Closest: `confidence_score` (extraction confidence, not "signals found") | **Misleading mock** — rename or remove. |
| `overpaymentLow = 3400` / `overpaymentHigh = 4200` ([`DevReportPreview.tsx:121–122`](../../src/pages/DevReportPreview.tsx)) | `full_json.derived_metrics.county_benchmark.delta_amount` (full-only) | Real, but **full-only**. Preview RPC does not expose `derived_metrics` today. |
| `marketLow = 1120` / `marketHigh = 1350` ([`DevReportPreview.tsx:126–127`](../../src/pages/DevReportPreview.tsx)) | `derived_metrics.county_benchmark.benchmark_price_per_opening_low/high` | Full-only. |
| `pricePerOpening = 1833` ([`DevReportPreview.tsx:124`](../../src/pages/DevReportPreview.tsx)) | `derived_metrics.per_opening.installed_price_per_opening` | Full-only. Preview shows band, not value. |
| `totalContractPrice = 22000` ([`DevReportPreview.tsx:128`](../../src/pages/DevReportPreview.tsx)) | `derived_metrics.totals.contract_total` | Full-only. |
| `totalOpenings = 12` ([`DevReportPreview.tsx:129`](../../src/pages/DevReportPreview.tsx)) | `proof_of_read.opening_count` (preview-safe via RPC) or `derived_metrics.counts.total_openings` (full) | Both — preview can show this without `derived_metrics`. |
| `homeownerName`, `propertyAddress`, `propertyType`, `windZone`, `codeJurisdiction` ([`DevReportPreview.tsx:131–135`](../../src/pages/DevReportPreview.tsx)) | Not in `buildFullData`; would require leads/intake/extraction wiring | **Needs follow-up sprint.** |
| Forensic vulnerability CLEAR rows (rows 33–37 — Pressure Rating Mismatch, Non-Approved Substitution shown CLEAR in mock) | No extraction booleans, no flags | **Do not show in V2** until backend implements. |

---

## 10. Adaptive section rules (must be backend-real)

A V2 section must only render if its **trigger condition** is met by real backend data. No hardcoded section visibility.

| Section | Show when |
|---------|-----------|
| Code & Jurisdiction Fit | `flags.some(f.pillar === 'safety')` OR coverage gaps in `derived_metrics.coverage.dp_coverage_pct` / `noa_coverage_pct` OR `state_jurisdiction_mismatch === true` |
| Financial Integrity | `flags.some(f.pillar === 'price' \|\| f.pillar === 'finePrint')` OR `payment_risk_detected === true` OR `deposit_percent > 33` (from extraction) |
| Market Intelligence | `derived_metrics.county_benchmark.comparison_available === true` |
| Warranty | `extraction.warranty` present AND (`labor_years < 5` OR `manufacturer_years < 10` OR warranty execution flags) |
| Action Plan | `flag_red_count > 0` OR `flag_amber_count > 0` |
| Property Profile | Lead/intake address fields present (requires future wiring) |

Sections that are **not** triggered should be omitted entirely (not shown empty or with "CLEAR" placeholders for unimplemented signals).

---

## 11. Open questions for Phase 2

These are documented gaps, not Phase 1 work:

1. Should `preview_json` get a teaser-safe `overpayment_band` field so partial reveal can show dollar urgency honestly? (Tier B / migration sprint.)
2. Should a canonical `signal_coverage` registry (`{ extracted: N, total: M, fields: [...] }`) be added to `full_json`? (Tier A scanner sprint.)
3. Should `buildFullData` ([`useAnalysisData.ts`](../../src/hooks/useAnalysisData.ts) lines 264+) map `extraction.contractor_address_text` and county into `propertyAddress` / `codeJurisdiction` UI fields? (Tier A reveal sprint.)
4. Should forensic vulnerability rows 33–37 land in `flagging.ts` first, or wait until extraction prompt + scoring rule pairs are designed together?

These are **questions, not commitments**.
