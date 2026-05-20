# FORENSIC_PROPS_CONTRACT — ForensicAuditReport ↔ Backend Data

Source-of-truth mapping from every prop on [`ForensicAuditReportProps`](../../src/components/forensic-report/ForensicAuditReport.tsx) (lines 26–60) to its real backend source path, with explicit mock callouts.

**Phase 1 documentation only.** No runtime code, mapper, components, routes, Supabase, or schema changes are made by this doc.

Companion doc: [SIGNAL_CONTAINER_MAP.md](./SIGNAL_CONTAINER_MAP.md).

---

## 1. Product principle — findings-first, pillar-backed

Truth Report V2 is **FINDINGS-FIRST in presentation, PILLAR-BACKED in scoring.**

| Layer | Role |
|-------|------|
| 5 pillars ([`scoring.ts`](../../supabase/functions/scan-quote/scoring.ts) lines 206–540) | Backend scoring engine — letter grade, hard caps, severity. **Under the hood.** |
| Flags / warnings / missing items ([`flagging.ts`](../../supabase/functions/scan-quote/flagging.ts), [`reportCompiler.ts`](../../supabase/functions/scan-quote/reportCompiler.ts)) | Finding engine — visceral "what's wrong" signals. |
| Partial reveal ([`PartialRevealHero.tsx`](../../src/components/forensic-report/PartialRevealHero.tsx)) | Tension engine — grade, danger counts, blurred truth trail. |
| Full reveal ([`ForensicAuditReport.tsx`](../../src/components/forensic-report/ForensicAuditReport.tsx)) | Action engine — findings expand into decision plan. |
| Adaptive sections | Story engine — sections appear/collapse based on **real backend data only**. |

Homeowner experience target: **grade → danger → evidence → action**.

### Reveal contract (enforced by backend)

| Field class | Preview (pre-OTP) | Full (post-OTP) |
|-------------|-------------------|-----------------|
| `grade` | Yes ([RPC line 31](../../supabase/migrations/20260322100001_redact_preview_create_gated_full.sql)) | Yes |
| `flag_red_count` / `flag_amber_count` (aggregates) | Yes ([RPC lines 33–38](../../supabase/migrations/20260322100001_redact_preview_create_gated_full.sql)) | derivable |
| `preview_json` (status-only pillars, teasers, bands) | Yes ([RPC line 40](../../supabase/migrations/20260322100001_redact_preview_create_gated_full.sql)) | Yes |
| `flags[]` array | **No** | Yes ([RPC line 92](../../supabase/migrations/20260322100001_redact_preview_create_gated_full.sql)) |
| `full_json` (numeric pillars, `derived_metrics`, `extraction`) | **No** | Yes ([RPC line 93](../../supabase/migrations/20260322100001_redact_preview_create_gated_full.sql)) |
| `proof_of_read` (`opening_count`, `line_item_count`, `contractor_name`, etc.) | Yes ([RPC line 39](../../supabase/migrations/20260322100001_redact_preview_create_gated_full.sql)) | Yes |

[`ForensicAuditReport.tsx`](../../src/components/forensic-report/ForensicAuditReport.tsx) lines 65–70 also force-clear `flags` in preview mode as a defense-in-depth measure. Any future mapper **must rely on the backend gate**, not on this UI clear.

### Adaptive-section rule

A V2 section may render **only** when a backend-real adaptive trigger is met (see §10 of [SIGNAL_CONTAINER_MAP.md](./SIGNAL_CONTAINER_MAP.md)). No invented frontend claims, no "CLEAR" placeholders for unimplemented signals.

---

## 2. ForensicAuditReportProps — verified citations

Interface defined at [`ForensicAuditReport.tsx`](../../src/components/forensic-report/ForensicAuditReport.tsx) lines 26–60.

Legend for **Backend Available?**:
- **Yes (file:line)** — verified real source
- **Partial** — adjacent source exists, gap noted
- **No — derived** — can be computed from existing real fields
- **No — needs wiring** — real source exists but not mapped into `AnalysisData` today
- **No — future Scanner Brain** — no backend source at all

### 2.1 Identity / always-present

| Prop | Type | Required | Access | Source Path | Currently Mocked? | Backend Available? | Adaptive Trigger | Future Work |
|------|------|----------|--------|-------------|-------------------|--------------------|-----------------|-------------|
| `accessLevel` | `"preview" \| "full"` | Yes | both | UI orchestrator (e.g. `useReportAccess`) based on `phone_verified_at` from `verify-otp` flow | No | Yes (gate logic) | Always | None |
| `analysisId` | `string \| null \| undefined` | Yes | both | `RawPreviewRow.analysis_id` / `RawFullRow.analysis_id`; via `AnalysisData.analysisId` at [`useAnalysisData.ts:221`](../../src/hooks/useAnalysisData.ts) | Mocked `"abcd-1234-ef56-7829"` at [`DevReportPreview.tsx:113`](../../src/pages/DevReportPreview.tsx) | Yes | Always | None |
| `grade` | `string` | Yes | both | RPC `grade` → `AnalysisData.grade` at [`useAnalysisData.ts:222`](../../src/hooks/useAnalysisData.ts); produced by `gradeResult.letterGrade` at [`scan-quote/index.ts:1630`](../../supabase/functions/scan-quote/index.ts) | Mocked `"D-"` at [`DevReportPreview.tsx:114`](../../src/pages/DevReportPreview.tsx) — **note: backend produces single letters A/B/C/D/F per [`scoring.ts:197–201`](../../supabase/functions/scan-quote/scoring.ts); the `-` suffix is mock-only** | Yes (letter only) | Always | Decide whether plus/minus modifiers should be added to scoring or stripped from UI mock. |
| `confidenceScore` | `number \| null` | Yes | both | `RawPreviewRow.confidence_score` / `RawFullRow.confidence_score` (RPC) → `AnalysisData.confidenceScore` at [`useAnalysisData.ts:228`](../../src/hooks/useAnalysisData.ts); persisted from `extraction.confidence` at [`scan-quote/index.ts:1684`](../../supabase/functions/scan-quote/index.ts); extracted at [`scoring.ts:46`](../../supabase/functions/scan-quote/scoring.ts) | Mocked `78` at [`DevReportPreview.tsx:115`](../../src/pages/DevReportPreview.tsx) | Yes | Always (Executive Summary) | None |

### 2.2 Counts (preview-safe aggregates)

| Prop | Type | Required | Access | Source Path | Currently Mocked? | Backend Available? | Adaptive Trigger | Future Work |
|------|------|----------|--------|-------------|-------------------|--------------------|-----------------|-------------|
| `flagRedCount` | `number` | Yes | both | RPC `flag_red_count` (Critical + High aggregate, [`migration lines 33–35`](../../supabase/migrations/20260322100001_redact_preview_create_gated_full.sql)) → `AnalysisData.flagRedCount` at [`useAnalysisData.ts:225, 282`](../../src/hooks/useAnalysisData.ts) | Mocked `4` at [`DevReportPreview.tsx:118`](../../src/pages/DevReportPreview.tsx) | Yes | Drives Tension Hero / Top Findings count | None |
| `flagAmberCount` | `number` | Yes | both | RPC `flag_amber_count` (Medium aggregate, [`migration lines 36–38`](../../supabase/migrations/20260322100001_redact_preview_create_gated_full.sql)) → `AnalysisData.flagAmberCount` at [`useAnalysisData.ts:226, 283`](../../src/hooks/useAnalysisData.ts) | Mocked `3` at [`DevReportPreview.tsx:119`](../../src/pages/DevReportPreview.tsx) | Yes | Drives warning band | None |
| `flagClearCount` | `number?` | No | both | **Derived**: `flagCount - flagRedCount - flagAmberCount` (includes severity `Low` and any unbucketed). Not stored on `AnalysisData` today. | Mocked `24` at [`DevReportPreview.tsx:120`](../../src/pages/DevReportPreview.tsx) | No — derived | Optional CLEAR rail | Mapper computes from existing counts. **Note:** "Clear" includes severity `Low` flags — it is not a "confirmed OK" checklist. |
| `signalsExtracted` | `number? \| null` | No | both | **No backend field.** Closest semantic: `confidenceScore`. UI label "Signals Extracted" at [`ExecutiveSummaryCard.tsx:73`](../../src/components/forensic-report/ExecutiveSummaryCard.tsx) is mock-only. | Mocked `31` at [`DevReportPreview.tsx:116`](../../src/pages/DevReportPreview.tsx) | **No — future Scanner Brain** | None until backend registry exists | Either remove the prop, rename it (`signalCoverage` → confidence), or add a backend `signal_coverage` registry (Tier A sprint). |
| `signalsTotal` | `number? \| null` | No | both | **No backend field.** Spreadsheet target is 37. | Mocked `37` at [`DevReportPreview.tsx:117`](../../src/pages/DevReportPreview.tsx) | **No — future Scanner Brain** | None | Same as `signalsExtracted`. |

### 2.3 Pricing (mostly full-only)

| Prop | Type | Required | Access | Source Path | Currently Mocked? | Backend Available? | Adaptive Trigger | Future Work |
|------|------|----------|--------|-------------|-------------------|--------------------|-----------------|-------------|
| `overpaymentLow` | `number? \| null` | No | **full only** (no preview source today) | `full_json.derived_metrics.county_benchmark.delta_amount` and benchmark range fields at [`scan-quote/index.ts:451–488`](../../supabase/functions/scan-quote/index.ts) + county comparator block (later in same file). **Not on `AnalysisData` directly** — mapper must derive from `AnalysisData.derivedMetrics` ([`useAnalysisData.ts:272, 304`](../../src/hooks/useAnalysisData.ts)). `analyses.dollar_delta` column is always `null` per [`scan-quote/index.ts:1687`](../../supabase/functions/scan-quote/index.ts). | Mocked `3400` at [`DevReportPreview.tsx:121`](../../src/pages/DevReportPreview.tsx) | **Partial** — only when `county_benchmark.comparison_available === true` AND `status === 'above_county_range'` | Show Money-at-Risk card when delta exists | Consider Tier B preview teaser field. |
| `overpaymentHigh` | `number? \| null` | No | **full only** | Same as `overpaymentLow`; mapper may use `delta_amount ± 10%` or `benchmark_price_per_opening_high * total_openings` for a range. | Mocked `4200` at [`DevReportPreview.tsx:122`](../../src/pages/DevReportPreview.tsx) | **Partial** | Same as `overpaymentLow` | Same. |
| `overpaymentBasis` | `string? \| null` | No | **full only** | Compose from `county_benchmark.county_label` + `compared_metric` + DP from line items | Mocked `"Based on Central Florida Impact Window Index, DP 50, single-hung"` at [`DevReportPreview.tsx:123`](../../src/pages/DevReportPreview.tsx) | **Partial** — county label exists; "DP 50, single-hung" copy is mock | Same | Document a deterministic basis-string formatter in Phase 2 mapper. |
| `pricePerOpening` | `number? \| null` | No | both modes carry it on `AnalysisData`, but **value present only in full** | `full_json.price_per_opening` at [`scan-quote/index.ts:1669`](../../supabase/functions/scan-quote/index.ts) (from `compiledReport.price_per_opening`, which reads `derived_metrics.per_opening.installed_price_per_opening` at [`reportCompiler.ts:33–35`](../../supabase/functions/scan-quote/reportCompiler.ts)) → `AnalysisData.pricePerOpening` at [`useAnalysisData.ts:313–314`](../../src/hooks/useAnalysisData.ts). Preview sets it to `null` ([`useAnalysisData.ts:252`](../../src/hooks/useAnalysisData.ts)). | Mocked `1833` at [`DevReportPreview.tsx:124`](../../src/pages/DevReportPreview.tsx) | Yes (full only) | Always show in full when value exists | None |
| `pricePerOpeningBand` | `"low" \| "market" \| "high" \| "extreme" \| null` | No | **both** | `preview_json.price_per_opening_band` at [`scan-quote/index.ts:1647`](../../supabase/functions/scan-quote/index.ts) and `full_json.price_per_opening_band` at [`scan-quote/index.ts:1670`](../../supabase/functions/scan-quote/index.ts); thresholds in [`reportCompiler.ts:41–50`](../../supabase/functions/scan-quote/reportCompiler.ts) (<800 low, ≤1500 market, ≤2000 high, else extreme); on `AnalysisData.pricePerOpeningBand` at [`useAnalysisData.ts:253, 315`](../../src/hooks/useAnalysisData.ts) | Mocked `"high"` at [`DevReportPreview.tsx:125`](../../src/pages/DevReportPreview.tsx) | Yes | Band coloring | None |
| `marketLow` | `number? \| null` | No | **full only** | `full_json.derived_metrics.county_benchmark.benchmark_price_per_opening_low` (not on `AnalysisData` today — mapper must read `derivedMetrics`) | Mocked `1120` at [`DevReportPreview.tsx:126`](../../src/pages/DevReportPreview.tsx) | **Partial** — only when benchmark available | Show range in Market Intelligence + Scope Overview tile | None |
| `marketHigh` | `number? \| null` | No | **full only** | `derived_metrics.county_benchmark.benchmark_price_per_opening_high` | Mocked `1350` at [`DevReportPreview.tsx:127`](../../src/pages/DevReportPreview.tsx) | **Partial** | Same | None |
| `totalContractPrice` | `number? \| null` | No | **full only** | `full_json.derived_metrics.totals.contract_total` at [`scan-quote/index.ts:453`](../../supabase/functions/scan-quote/index.ts); also `extraction.total_quoted_price` at [`scoring.ts:70`](../../supabase/functions/scan-quote/scoring.ts) | Mocked `22000` at [`DevReportPreview.tsx:128`](../../src/pages/DevReportPreview.tsx) | Yes (full only) | Always show in Scope/Financial when present | None |
| `totalOpenings` | `number? \| null` | No | **both** | `proof_of_read.opening_count` at [`scan-quote/index.ts:1622`](../../supabase/functions/scan-quote/index.ts) (preview-safe); `derived_metrics.counts.total_openings` at [`scan-quote/index.ts:461`](../../supabase/functions/scan-quote/index.ts) (full); `AnalysisData.openingCount` at [`useAnalysisData.ts:232, 290`](../../src/hooks/useAnalysisData.ts) | Mocked `12` at [`DevReportPreview.tsx:129`](../../src/pages/DevReportPreview.tsx) | Yes | Scope Overview tile | None |

### 2.4 Full-only

| Prop | Type | Required | Access | Source Path | Currently Mocked? | Backend Available? | Adaptive Trigger | Future Work |
|------|------|----------|--------|-------------|-------------------|--------------------|-----------------|-------------|
| `flags` | `AnalysisFlag[]?` | No | **full only** — preview shell force-clears to `[]` at [`ForensicAuditReport.tsx:67–70`](../../src/components/forensic-report/ForensicAuditReport.tsx) | RPC `flags` ([`migration line 92`](../../supabase/migrations/20260322100001_redact_preview_create_gated_full.sql)) → `mapFlags()` at [`useAnalysisData.ts:151–161`](../../src/hooks/useAnalysisData.ts) → `AnalysisData.flags` at [`useAnalysisData.ts:280`](../../src/hooks/useAnalysisData.ts) | Mocked array `MOCK_FLAGS` passed at [`DevReportPreview.tsx:130`](../../src/pages/DevReportPreview.tsx) | Yes (full only) | Drives Top Findings, Code, Financial, Action Plan sections | None |
| `homeownerName` | `string? \| null` | No | full only | **Not in** `ExtractionResult` or `buildFullData`. Available on `leads` table from intake but unmapped. | Mocked `"Maria Gonzalez"` at [`DevReportPreview.tsx:131`](../../src/pages/DevReportPreview.tsx) | **No — needs wiring** | Property Profile section | Tier A reveal sprint to extend `buildFullData` with lead context. |
| `propertyAddress` | `string? \| null` | No | full only | Closest backend candidate: `extraction.contractor_address_text` at [`scoring.ts:157`](../../supabase/functions/scan-quote/scoring.ts) — **but that is the contractor's address, not the property address**. True property address lives on `leads` and is unmapped. | Mocked `"4521 NW 18th Ct, Coconut Creek, FL 33073"` at [`DevReportPreview.tsx:132`](../../src/pages/DevReportPreview.tsx) | **No — needs wiring** | Property Profile section | Same as `homeownerName`. Do not confuse with `contractor_address_text`. |
| `propertyType` | `string? \| null` | No | full only | None in `ExtractionResult`. Intake-only. | Mocked `"Single Family"` at [`DevReportPreview.tsx:133`](../../src/pages/DevReportPreview.tsx) | **No — needs wiring** | Property Profile section | Tier A sprint. |
| `windZone` | `string? \| null` | No | full only | `extraction.hvhz_zone?: boolean` at [`scoring.ts:73`](../../supabase/functions/scan-quote/scoring.ts) — only HVHZ flag, not full Exposure B/C/D enum. Not exposed in `AnalysisData`. | Mocked `"HVHZ"` at [`DevReportPreview.tsx:134`](../../src/pages/DevReportPreview.tsx) | **Partial** — HVHZ boolean exists but unmapped to UI | Property Profile / Code & Jurisdiction | Tier A: map `hvhz_zone` → `windZone: "HVHZ" \| null` and decide whether full Exposure category should be extracted. |
| `codeJurisdiction` | `string? \| null` | No | full only | County label is passed into `computeDerivedMetrics` and reachable via `derived_metrics.county_benchmark.county_label`. Not on `AnalysisData` directly. | Mocked `"Broward County"` at [`DevReportPreview.tsx:135`](../../src/pages/DevReportPreview.tsx) | **Partial** — county exists via `derivedMetrics`; full jurisdiction string (city/county/FBC edition) requires additional wiring | Property Profile / Code & Jurisdiction | Map county from `derivedMetrics.county_benchmark.county_label`. |

### 2.5 Slot

| Prop | Type | Required | Access | Source Path | Currently Mocked? | Backend Available? | Adaptive Trigger | Future Work |
|------|------|----------|--------|-------------|-------------------|--------------------|-----------------|-------------|
| `unlockSlot` | `React.ReactNode?` | No | **preview only** (passed as `undefined` in full mode at [`DevReportPreview.tsx:136`](../../src/pages/DevReportPreview.tsx)) | UI composition — orchestrator passes the OTP gate component (`PreviewUnlockSlot` / production analog). No backend data. | `<PreviewUnlockSlot />` at [`DevReportPreview.tsx:136`](../../src/pages/DevReportPreview.tsx) | N/A | Always in preview | Gating ownership stays **outside** this shell. Do not embed OTP logic in `ForensicAuditReport`. |

---

## 3. Default skeleton vs adaptive sections

The full-reveal shell currently renders (in order, [`ForensicAuditReport.tsx:74–145`](../../src/components/forensic-report/ForensicAuditReport.tsx)):

1. `UnlockedHeader` (full only)
2. `PartialRevealHero` (preview) **or** `ExecutiveSummaryCard` (full)
3. `MoneyAtRiskCard` (conditional: `hasOverpayment` flag)
4. `TopFindingsList` (always — `safeFlags` array; preview overlay)
5. `ExecutiveSummaryBand`
6. `ScopeOverviewCard`
7. `PropertyProfileCard` (full only)
8. `NextActionCard` (full only)

### Findings-first V2 target

Sections **must** appear adaptively based on backend data, in this priority order:

1. **Executive Summary** — always
2. **Tension Hero / Locked teaser** — preview only
3. **Top Forensic Findings** — always (preview = blurred placeholders only)
4. **Money at Risk** — if `derived_metrics.county_benchmark.status === 'above_county_range'`
5. **Code & Jurisdiction Fit** — if safety-pillar flags OR coverage gaps OR `state_jurisdiction_mismatch === true`
6. **Financial Integrity** — if price/finePrint flags OR `payment_risk_detected === true` OR `deposit_percent > 33`
7. **Market Intelligence** — if `county_benchmark.comparison_available === true`
8. **Warranty** — if `extraction.warranty` present AND warranty flags/tiers tripped
9. **Scope Overview** — if `opening_count > 0`
10. **Property Profile** — only when lead/intake address is wired (currently never)
11. **Action Plan / Next Steps** — if any red or amber flags

Sections without their trigger met **must be omitted**, not shown empty or with placeholder "CLEAR" rows.

---

## 4. Severity → UI color contract

From [`useAnalysisData.ts:112–119`](../../src/hooks/useAnalysisData.ts) `mapSeverity()`:

| Backend severity | UI color | Preview count source |
|------------------|----------|----------------------|
| `Critical`, `High` | `red` | `flag_red_count` |
| `Medium` | `amber` | `flag_amber_count` |
| `Low`, `info`, `pass`, `confirmed`, `green`, `ok`, `good` | `green` | derived (`flagCount - red - amber`) |
| Anything else | `amber` (default fallback) | counted as amber |

**Findings-first implication:** Partial reveal can honestly say *"X critical, Y warning"* using the RPC aggregates. It cannot describe individual findings — that requires `flags[]` (full only).

---

## 5. Adaptive section trigger sources (centralized for mapper)

Phase 2 mapper will need these source paths; documented here so Phase 2 does not invent new fields.

| Trigger | Source path |
|---------|-------------|
| Any safety flag | `flags.some(f => f.pillar === 'safety_code')` (after `normalizePillarKey` at [`useAnalysisData.ts:132–141`](../../src/hooks/useAnalysisData.ts)) |
| Any financial flag | `flags.some(f => f.pillar === 'price_fairness' \|\| f.pillar === 'fine_print')` |
| DP coverage gap | `derivedMetrics.coverage.dp_coverage_pct < 100` |
| NOA coverage gap | `derivedMetrics.coverage.noa_coverage_pct < 100` |
| Payment risk | `preview_json.payment_risk_detected === true` OR `extraction.final_payment_before_inspection === true` |
| High deposit | `extraction.deposit_percent > 33` (industry standard 30–33%) |
| County benchmark available | `derivedMetrics.county_benchmark.comparison_available === true` |
| Overpayment | `derivedMetrics.county_benchmark.status === 'above_county_range'` |
| Warranty present | `extraction.warranty` truthy AND (`labor_years < 5` OR `manufacturer_years < 10`) |
| State jurisdiction mismatch | `extraction.state_jurisdiction_mismatch === true` ([`scoring.ts:158`](../../supabase/functions/scan-quote/scoring.ts)) |

---

## 6. Open contract questions for Phase 2

Documented gaps — **not Phase 1 work**:

1. **Plus/minus grade modifiers.** Mock shows `"D-"`; backend produces single letters A–F ([`scoring.ts:197–201`](../../supabase/functions/scan-quote/scoring.ts)). Decide: extend rubric or strip suffix.
2. **`signalsExtracted` / `signalsTotal` props.** No backend source. Either remove these props from the interface, repurpose them to surface `confidence_score`, or add a Tier A `signal_coverage` registry to `full_json`.
3. **Property Profile fields.** `homeownerName`, `propertyAddress`, `propertyType`, `windZone`, `codeJurisdiction` need a sprint to map intake/lead data into `buildFullData`.
4. **Overpayment in preview.** `derived_metrics` is full-only by design. Decide if `preview_json` should carry a teaser-safe `overpayment_band` enum (Tier B migration).
5. **`overpaymentBasis` string.** Define a deterministic formatter (county label + DP + product type) instead of mock string.
6. **`flagClearCount` semantics.** Document that this includes severity `Low` — it is not a list of confirmed-OK items. Consider renaming to `flagLowCount` to avoid implying "everything passed."

---

## 7. Phase 2 — out of scope

Phase 2 will (with separate approval) add:
- `src/lib/mapAnalysisToForensicReport.ts` — pure mapper from `AnalysisData` + `accessLevel` → `ForensicAuditReportProps`
- Fixture-driven `DevReportPreview` (no more hardcoded mock props)
- New section components for Code & Jurisdiction, Financial Integrity, Market Intelligence (dark forensic skins)
- `ReportForensic` page wiring `useAnalysisData` → `ForensicAuditReport`

Phase 2 does **not** touch: `scan-quote`, `useAnalysisData`, `reportService`, RPCs, migrations, OTP, Twilio, `preview_json`/`full_json` schema.
