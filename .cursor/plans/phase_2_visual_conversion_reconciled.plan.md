# Truth Report V2 — Phase 2 Visual + Conversion Reconciled Plan

**Status:** Phase 2A (narrowed visual-lab polish) **cleared to start**. Classic `report-access` Browser QA **practically passed** (deferred wrong-phone binding caveat). Production V2 wiring **still blocked**.

**Source audit:** generated from a read-only reconciliation pass against the post-`report-access` repo state. Anchors back to [docs/report/SIGNAL_CONTAINER_MAP.md](../../docs/report/SIGNAL_CONTAINER_MAP.md) and [docs/report/FORENSIC_PROPS_CONTRACT.md](../../docs/report/FORENSIC_PROPS_CONTRACT.md) for data-shape ground truth, and to [.cursor/plans/truth_report_v2_ritual_fb8e206c.plan.md](./truth_report_v2_ritual_fb8e206c.plan.md) for the FOG → CASE FILE → TAP → EVIDENCE → BRIEFCASE ritual.

---

## 0. Current Verified State

- Wave 1 created [supabase/functions/report-access/index.ts](../../supabase/functions/report-access/index.ts) (service-role proxy for `get_analysis_preview` / `get_analysis_full`).
- Wave 2 modified [src/services/reportService.ts](../../src/services/reportService.ts) to invoke `report-access` instead of direct RPCs (see lines 49 and 93).
- [supabase/config.toml](../../supabase/config.toml) declares `[functions.report-access] verify_jwt = false` (lines 93–94).
- API tests passed against `.env.local` Supabase project (per user).
- `report-access` is deployed to the app-linked Supabase project (per user).
- **Classic `report-access` Browser QA practically passed** — recorded in [docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md](../../docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md) (2026-05-21). Happy-path full unlock, wrong OTP, and resend/cooldown verified. **Wrong verified phone binding against same `scan_session_id` remains DEFERRED.** No Playwright fixture; no HAR binary in repo yet.
- Production report path: `/report/:sessionId` → `<Navigate>` to `/report/classic/:sessionId` → [`ReportClassic`](../../src/pages/ReportClassic.tsx) → `<TruthReportClassic .../>` (see [src/App.tsx:51–54, 140–142](../../src/App.tsx)).
- V2 components (`ForensicAuditReport`, `PartialRevealHero`, `WindowManMark`, `ExecutiveSummaryCard`, etc.) are **lab-only**. Only [src/pages/DevReportPreview.tsx](../../src/pages/DevReportPreview.tsx) imports `ForensicAuditReport`.
- `/visual/report-preview`, `/sandbox/report-preview` (dev), `/dev/report-preview` (dev) all render `DevReportPreview` with `noindex,nofollow` and a "VISUAL LAB · MOCK DATA · NOT PRODUCTION FLOW" banner.
- Existing V2 visual work already shipped in [src/components/forensic-report/PartialRevealHero.tsx](../../src/components/forensic-report/PartialRevealHero.tsx) (grade-tinted frost ritual, severity counts, locked teaser) and [src/components/forensic-report/WindowManMark.tsx](../../src/components/forensic-report/WindowManMark.tsx) (abstract 4-pane mark, no mascot, no animation).
- [src/hooks/useAnalysisData.ts](../../src/hooks/useAnalysisData.ts) reads `ServiceResult` from `reportService.ts` and never sees the raw `__UNAUTHORIZED__` sentinel. **Compatible.**
- `__UNAUTHORIZED__` sentinel is translated by `report-access` ([supabase/functions/report-access/index.ts:185–193](../../supabase/functions/report-access/index.ts)) → `{ ok: true, authorized: false, locked: true, reason: "unauthorized" }` → re-translated by `reportService` ([src/services/reportService.ts:100–108](../../src/services/reportService.ts)) → `{ ok: false, code: "unauthorized" }`.
- No production browser code path directly calls `get_analysis_preview` or `get_analysis_full`. Dev-only tooling ([src/components/dev/DevQuoteGenerator.tsx](../../src/components/dev/DevQuoteGenerator.tsx), [src/components/dev/scanner-lab/tabs/BackendRunnerTab.tsx](../../src/components/dev/scanner-lab/tabs/BackendRunnerTab.tsx)) still does; harmless because dev clients use service-role-equivalent setups.

---

## 1. What Changed After `report-access`

- Browser ↔ private RPC direct path is gone for production code. All preview/full fetches flow through `report-access` (a Supabase Edge Function with `verify_jwt = false` that holds the service-role key).
- `reportService.ts` is now the only translation surface between the proxy contract and the `ServiceResult` shape.
- `useAnalysisData.ts` is **unchanged behaviorally**.
- The `__UNAUTHORIZED__` sentinel is still emitted by the DB RPC, but is **invisible to the browser** — it is converted to the new locked envelope inside `report-access`.

---

## 2. What Is Already Built

- **Visual lab harness:** [`DevReportPreview`](../../src/pages/DevReportPreview.tsx) with banners, `noindex,nofollow`, mode/version params (`?v=v3&mode=preview|full`, `?v=classic`).
- **FOG ritual visuals:** [`PartialRevealHero`](../../src/components/forensic-report/PartialRevealHero.tsx) (frost, scanlines, grade-tinted plate, WindowMan mark, severity counts, 3 metric tiles, locked teaser).
- **WindowMan presence:** [`WindowManMark`](../../src/components/forensic-report/WindowManMark.tsx) SVG mark (no face, no mascot, no animation, `aria-hidden`).
- **Shell:** [`ForensicAuditReport`](../../src/components/forensic-report/ForensicAuditReport.tsx) with preview/full mode-switching and force-cleared `flags=[]` in preview as defense-in-depth (lines 67–70).
- **Quote Math evidence:** [`QuotePriceMath`](../../src/components/report/QuotePriceMath.tsx) renders `county_benchmark` + `per_opening` + `coverage` math against real `derivedMetrics` (currently used inside `TruthReportClassic`, ready for reuse in V2).

---

## 3. What Is Obsolete

- **Original Phase 2A scope** "FOG visual upgrade only" is now mostly complete; remaining work is **preview-safety polish** (strip `"D-"`, suppress `signalsExtracted/Total` when null).
- **Old V2 plan's mapper-as-step-3 framing** ([.cursor/plans/truth_report_v2_ritual_fb8e206c.plan.md](./truth_report_v2_ritual_fb8e206c.plan.md) §14 Phase 2C) is still architecturally right but its position in the build order is unchanged — what changed is that the **earlier visual phase is already shipped in the lab**.
- **Old V2 plan's data-flow diagram** does not yet mention `report-access` as the proxy step. Diagram needs a doc-only update (out of scope for this plan).
- **Direct-RPC playbook docs** ([docs/v2-cutover/FUNNEL_SUPABASE_CALL_MAP.md](../../docs/v2-cutover/FUNNEL_SUPABASE_CALL_MAP.md), [docs/COPILOT_LOVABLE_INTEGRATION_SPEC.md](../../docs/COPILOT_LOVABLE_INTEGRATION_SPEC.md), [docs/sprints/phase-0-repo-truth-audit.md](../../docs/sprints/phase-0-repo-truth-audit.md), [docs/ops/WINDOWMAN_V2_BACKEND_DIAGNOSIS.md](../../docs/ops/WINDOWMAN_V2_BACKEND_DIAGNOSIS.md), [docs/v2-cutover/LOCAL_CUTOVER_CHECKLIST.md](../../docs/v2-cutover/LOCAL_CUTOVER_CHECKLIST.md)) describe the pre-transport-repair flow.

---

## 4. What Must Wait

- All V2 **production** wiring remains blocked until explicit later approval (and completion of deferred wrong-phone binding QA before promotion).
- Case File / Tap / Evidence / Briefcase visual prototypes wait until FOG preview-safety polish lands (small).
- Mapper foundation waits until visual prototypes are signed off.
- Conversion / CAPI new event spec waits until visual ritual ships.
- Prescription Room remains unspecified; needs its own spec before any build.
- `get_county_by_scan_session` cleanup waits — independent of V2 visual work.

---

## 5. Next Safest Build Step

**Phase 2A (narrowed): FOG preview-safety polish on visual lab only** — **next build step** (see [docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md](../../docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md)).

Phase 2-PRE Browser QA is **practically closed** (Classic happy path + wrong OTP + resend). Deferred: wrong verified phone binding trial. If authorization anomalies appear, triage `report-access` / DB sentinel before V2 production promotion.

---

## 6. Allowed Files for Phase 2-PRE (Browser QA)

- No file edits. Only inspection and recording of QA evidence in a markdown note (e.g. `docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md` — created in a separate prompt, not in this plan).

---

## 7. Allowed Files for Phase 2A (Narrowed)

After QA passes:

- [src/pages/DevReportPreview.tsx](../../src/pages/DevReportPreview.tsx) — strip `grade="D-"` → `"D"`; null-out `signalsExtracted` and `signalsTotal`; remove the `"DP 50, single-hung"` mock string from `overpaymentBasis` or replace with a generic placeholder.
- Optionally, [src/components/forensic-report/ExecutiveSummaryCard.tsx](../../src/components/forensic-report/ExecutiveSummaryCard.tsx) — verify the "Signals Extracted" block gating on `signalsExtracted != null && signalsTotal != null` (already gated at lines 71–78).
- Optionally, [src/components/forensic-report/PartialRevealHero.tsx](../../src/components/forensic-report/PartialRevealHero.tsx) — confirm `gradeBand` first-letter behavior survives `null/empty` (already strips suffix via `charAt(0)` at lines 40–47).

---

## 8. Forbidden Files for Phase 2A

- [src/App.tsx](../../src/App.tsx) — no route changes.
- [src/pages/ReportClassic.tsx](../../src/pages/ReportClassic.tsx) — production route untouched.
- [src/services/reportService.ts](../../src/services/reportService.ts) — no transport changes.
- [src/hooks/useAnalysisData.ts](../../src/hooks/useAnalysisData.ts) — must not be modified, refactored, or rewritten.
- [supabase/functions/report-access/index.ts](../../supabase/functions/report-access/index.ts) — no Edge Function changes.
- `supabase/migrations/*` — no migrations.
- `supabase/functions/scan-quote/*`, `supabase/functions/send-otp/*`, `supabase/functions/verify-otp/*` — protected paths.
- Any RLS policy file.
- Any tracking / CAPI file ([src/lib/trackEvent.ts](../../src/lib/trackEvent.ts), [src/lib/trackConversion.ts](../../src/lib/trackConversion.ts)).
- Any Prescription Room file — does not exist; do not create.

---

## 9. Acceptance Criteria

### Phase 2-PRE (Browser QA gate)

- [x] Open `/report/classic/{realSessionId}` in a real browser; preview renders with grade + counts from `report-access` preview mode.
- [x] DevTools Network panel shows POSTs to `/functions/v1/report-access` with `mode: "preview"`, **and no** direct browser calls to `/rest/v1/rpc/get_analysis_preview`.
- [x] OTP send → `/functions/v1/send-otp` returns 200.
- [x] OTP submit → `/functions/v1/verify-otp` returns 200 (correct OTP).
- [x] Full reveal triggers POST to `/functions/v1/report-access` with `mode: "full"`, `scan_session_id`, `phone_e164`; response `{ ok: true, mode: "full", authorized: true, data: { ... } }`; flags + full report render. Session: `8ecb10ff-5c29-45be-a44e-4e933358d68b`.
- [x] Wrong OTP: `verify-otp` failure (400); report did not unlock; cooldown/resend; correct OTP after retest unlocks.
- [ ] **DEFERRED** Wrong-phone trial: different verified phone, same `scan_session_id` → `{ ok: true, mode: "full", authorized: false, locked: true, reason: "unauthorized" }` + locked UI, no flag leak. **Do not mark passed.**
- [x] QA note captured: [docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md](../../docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md) (network shapes + behavioral evidence; HAR binary optional follow-up).

### Phase 2A (Narrowed, after QA gate)

- [ ] `DevReportPreview` no longer ships `"D-"` or non-null `signalsExtracted/Total`.
- [ ] `/visual/report-preview?v=v3&mode=preview` renders FOG with the "Missing Regulatory Items" tile falling back to `flagAmberCount` (because `signalsExtracted/Total` are null).
- [ ] Production route untouched; no V2 promotion.
- [ ] Defense-in-depth `flags=[]` enforcement in `ForensicAuditReport` (lines 67–70) is not weakened.
- [ ] Reduced-motion behavior unchanged (no new animation introduced).
- [ ] No tests broken.
- [ ] No new lint errors; `npm run build` succeeds.

---

## 10. Rollback Plan

- **Phase 2-PRE:** No code changed; nothing to roll back. If QA fails, do not advance to Phase 2A.
- **Phase 2A:** Single-file revert of [src/pages/DevReportPreview.tsx](../../src/pages/DevReportPreview.tsx) (the only file edited). Visual lab returns to pre-polish state instantly. No production state to restore.

---

## 11. Browser QA Gate

**Status (2026-05-21): Practically passed — proceed to Phase 2A lab work.** Production V2 wiring **remains blocked.**

Practical gate checklist:

- [x] Real-browser smoke: `/report/classic/8ecb10ff-5c29-45be-a44e-4e933358d68b` — preview `report-access` in DevTools.
- [x] OTP success → full reveal with `authorized: true` (TCPA, send, verify, full render; no phone-entry flicker post `deriveGateMode` fix).
- [x] Wrong OTP → `verify-otp` 400, no unlock, cooldown/resend, correct OTP recovery.
- [ ] **DEFERRED** Wrong verified phone binding (same `scan_session_id`, different phone) → `authorized: false` + locked UI. **Not passed; do not claim.**
- [x] Repo QA note: [docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md](../../docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md).

> Wrong-phone verified-binding QA is the only open P0-class browser test before V2 **production** promotion. Phase 2A visual-lab polish does not require it.

### Browser QA Update — practically passed (2026-05-21)

**Verdict:** Classic Verify-to-Reveal **PASS** · Wrong OTP **PASS** · Resend/cooldown **PASS** · Wrong verified phone binding **DEFERRED** · Phase 2A **cleared** · V2 production routes **blocked**

| Check | Status | Notes |
|---|---|---|
| Preview: `/report/classic/{sessionId}` + `report-access` `mode: "preview"` | **Passed** | Grade + counts; no direct browser RPC to `get_analysis_preview`. |
| Full OTP → `report-access` `mode: "full"` `authorized: true` | **Passed** | `scan_session_id` + `phone_e164` in body; `data` + `flags`; full UI render. Local: `http://localhost:8080/report/classic/8ecb10ff-5c29-45be-a44e-4e933358d68b`. |
| Wrong OTP / resend / cooldown | **Passed** | Deliberate wrong code → verify-otp 400; cooldown; resend; same-code Twilio window expected; correct OTP unlocks. |
| Wrong verified phone binding (unauthorized full) | **DEFERRED** | Not run. High architectural confidence; not formally proven. Revisit before V2 prod wiring. |
| Repo evidence | **Passed (doc)** | [REPORT_ACCESS_BROWSER_QA.md](../../docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md). HAR binary optional follow-up. |

### event_logs Telemetry Clarification

During `/report/classic/:sessionId` preview Browser QA, the Network tab showed an `event_logs` **201** request.

This request is **frontend operational telemetry**, not an internal `report-access` write.

**Actual path:**

`useAnalysisData.ts` → `trackEvent("preview_rendered")` → `trackEvent.ts` → `event_logs` INSERT.

`report-access` does **not** insert into `event_logs`; it validates the request, calls the private report RPC with a service-role client, strips unsafe preview fields, and returns the response.

Gemini’s earlier statement that `report-access` logs access before retrieval is **inaccurate** for this codebase (code audit: no `event_logs` references in [supabase/functions/report-access/index.ts](../../supabase/functions/report-access/index.ts); telemetry fires **after** a successful preview fetch in [src/hooks/useAnalysisData.ts](../../src/hooks/useAnalysisData.ts)).

**Security impact:** none. Telemetry is separate from report authorization and does not control preview/full access.

---

## 12. Mock Upgrade Spec (apply during Phase 2C, not 2A)

| Mock Field Path | Current Shape | Required Shape | Preview or Full | Sample Safe Value | Why Needed |
|---|---|---|---|---|---|
| `DevReportPreview.MOCK_FLAGS` | Flat `AnalysisFlag[]` (post-hook) | Two fixtures: (a) post-hook `AnalysisFlag[]`, (b) raw `full_json.flags[]` with `{ flag, severity, pillar: "safety"\|"install"\|"price"\|"finePrint"\|"warranty", detail, tip }[]` for future mapper input | Full only | See `mapFlags` reverse-engineering at [src/hooks/useAnalysisData.ts:151–161](../../src/hooks/useAnalysisData.ts) | Real `full_json` from `report-access` uses pre-normalized pillar keys; mapper tests need raw fixtures. |
| `DevReportPreview.MOCK_PILLARS` | Flat `PillarScore[]` (post-hook) | Three fixtures: (a) post-hook `PillarScore[]`, (b) raw `preview_json.pillar_scores` `Record<string, { score?: number; status?: "pass"\|"warn"\|"fail"\|"pending" }>`, (c) raw `full_json.pillar_scores` `{ safety: number, install: number, price: number, finePrint: number, warranty: number }` | Both (different shapes per phase) | Preview: `{ safety_code: { status: "fail" }, install_scope: { status: "warn" }, price_fairness: { status: "warn" }, fine_print: { status: "fail" }, warranty: { status: "warn" } }`; Full: `{ safety: 25, install: 40, price: 55, finePrint: 30, warranty: 45 }` | Live RPC delivers nested shapes the hook flattens; lab cannot exercise real path without raw fixtures. |
| `DevReportPreview.renderForensicReport.grade` | `"D-"` | `"D"` (single letter only) | Both | `"D"` | Backend produces A/B/C/D/F only per [supabase/functions/scan-quote/scoring.ts:197–201](../../supabase/functions/scan-quote/scoring.ts). |
| `DevReportPreview.signalsExtracted` / `signalsTotal` | `31` / `37` | `null` / `null` (or remove props entirely) | Both | `null` | No backend `signal_coverage` registry per [docs/report/SIGNAL_CONTAINER_MAP.md §9](../../docs/report/SIGNAL_CONTAINER_MAP.md). |
| `DevReportPreview.flagClearCount` | `24` ("Clear") | Render as `flagLowCount` semantically (includes Low + uncategorized), or omit | Both | Derived: `flagCount − flagRedCount − flagAmberCount` | Per [docs/report/FORENSIC_PROPS_CONTRACT.md §4](../../docs/report/FORENSIC_PROPS_CONTRACT.md) "Clear" includes Low severity; misleading label. |
| `DevReportPreview.overpaymentLow/High/Basis/marketLow/High/pricePerOpening/totalContractPrice` | Flat numbers/string passed in preview mode | Full-only. Source from `full_json.derived_metrics.county_benchmark.{delta_amount, benchmark_price_per_opening_low/high, ...}` and `derived_metrics.per_opening.installed_price_per_opening` and `derived_metrics.totals.contract_total`. Pass `null` in preview. | Full only | `null` in preview; real numbers from `derived_metrics` in full | Preview RPC does not expose `derived_metrics`. |
| `DevReportPreview` `homeownerName/propertyAddress/propertyType/windZone/codeJurisdiction` | Mock strings | `null` until `buildFullData` is extended with leads/intake wiring (Tier A reveal sprint) | Full only | `null` | Not mapped today per [docs/report/FORENSIC_PROPS_CONTRACT.md §2.4](../../docs/report/FORENSIC_PROPS_CONTRACT.md). |
| New: `DevReportPreview` raw `full_json` fixture | Does not exist | Add a raw `full_json` fixture matching live shape: `{ grade, weighted_average, hard_cap_applied, pillar_scores, flags, extraction, derived_metrics: { totals, per_opening, coverage, county_benchmark }, rubric_version, price_fairness, markup_estimate, negotiation_leverage, warnings, missing_items, summary, top_warning, top_missing_item, price_per_opening, price_per_opening_band, payment_risk_detected, scope_gap_detected }` | Full only | See [docs/report/SIGNAL_CONTAINER_MAP.md §5](../../docs/report/SIGNAL_CONTAINER_MAP.md) and [supabase/functions/scan-quote/index.ts:1652–1673](../../supabase/functions/scan-quote/index.ts) | Required for the future mapper to be tested against realistic input. `price_fairness` / `markup_estimate` / `negotiation_leverage` are legacy nullable pass-through keys (not current Gemini prompt outputs); fixture may set them `null`. |

---

## 13. Risk Classification (carried from audit)

| Priority | Risk | Evidence | Resolution |
|---|---|---|---|
| **P0** | Browser QA **practically passed**; wrong verified phone binding **deferred**. Playwright suites still intercept the **old** direct-RPC path ([tests/session-isolation.spec.ts:70, 173](../../tests/session-isolation.spec.ts), [tests/otp-resend.spec.ts:79](../../tests/otp-resend.spec.ts)). | [REPORT_ACCESS_BROWSER_QA.md](../../docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md) §5, §9. | Phase 2A lab OK. Complete deferred wrong-phone trial before V2 **production** promotion; optional HAR under `docs/v2-cutover/evidence/`. |
| **P0** | Config/env project mismatch risk. [supabase/config.toml:1](../../supabase/config.toml) hard-codes `project_id = "wkrcyxcnzhwjtdpmfpaf"`. | If `.env.local` points the browser at a different Supabase project, `supabase.functions.invoke("report-access", ...)` will fail because the Edge Function is not deployed to that project. | Confirm `.env.local` `VITE_SUPABASE_URL` matches the project where `report-access` is deployed before browser QA. |
| **P0** | V2 component touching full-only data in preview — none confirmed in production flow (no V2 component is production-routed). | Verified via [src/App.tsx](../../src/App.tsx) route audit; only [src/pages/DevReportPreview.tsx](../../src/pages/DevReportPreview.tsx) and the component itself import `ForensicAuditReport`. | Continue to gate V2 promotion behind QA. |
| **P1** | `[functions.report-access] verify_jwt = false` ([supabase/config.toml:93–94](../../supabase/config.toml)). Endpoint is open to abuse (rate-limit / enumeration); DB sentinel is the authorization gate for full mode. | [supabase/functions/report-access/index.ts:160–193](../../supabase/functions/report-access/index.ts) calls the RPC with the supplied `phone_e164` and only the DB-side check protects the full payload. | Acceptable — DB gate is canonical. Add rate-limit + structured logging before V2 promotion. |
| **P1** | Production V2 wiring blocked until explicit approval + deferred wrong-phone binding QA. | §5, §11. | Phase 2A lab polish may proceed; prod V2 routes may not. |
| **P1** | `get_county_by_scan_session` may be missing. [`useCountyForSession`](../../src/pages/ReportClassic.tsx) silently falls back to `"Your County"` on failure. | [src/pages/ReportClassic.tsx:62–72](../../src/pages/ReportClassic.tsx). | Independent of V2 work; verify RPC presence; if missing, redirect to `full_json.derived_metrics.county_benchmark.county_label` post-OTP. **Not blocking V2 lab work.** |
| **P2** | Outdated visual mocks in `DevReportPreview.tsx` (grade suffix `"D-"`, signalsExtracted/Total, flagClearCount as "Clear", flat pillar/flag shapes). | [src/pages/DevReportPreview.tsx:113–135](../../src/pages/DevReportPreview.tsx); Mock Upgrade Spec §12. | Update during Phase 2C mapper sprint. |
| **P2** | Dev-only direct `get_analysis_preview` calls in [src/components/dev/DevQuoteGenerator.tsx:89](../../src/components/dev/DevQuoteGenerator.tsx) and [src/components/dev/scanner-lab/tabs/BackendRunnerTab.tsx:9](../../src/components/dev/scanner-lab/tabs/BackendRunnerTab.tsx). | Confirmed by grep. | Migrate to `report-access` invocation in a dev-tooling cleanup pass. Not blocking. |
| **P2** | Stale code comments referencing direct RPC calls in [src/pages/ReportClassic.tsx:8](../../src/pages/ReportClassic.tsx) and `console.error("get_analysis_preview error:")` label in [src/hooks/useAnalysisData.ts:442](../../src/hooks/useAnalysisData.ts). | Confirmed. | Cosmetic fix during a docs-touch pass. |
| **P2** | Stale comments referencing the old `__UNAUTHORIZED__` sentinel as a frontend concern in [src/components/TruthReportFindings/VerifyGate.tsx:26, 165](../../src/components/TruthReportFindings/VerifyGate.tsx), [src/components/TruthReportFindings/PhoneVerifyModal.tsx:25, 77](../../src/components/TruthReportFindings/PhoneVerifyModal.tsx). Behavior is correct; comments describe the pre-transport-repair flow. | Confirmed by grep. | Cosmetic fix. |
| **P2** | Stale docs across [docs/v2-cutover/](../../docs/v2-cutover/), [docs/COPILOT_LOVABLE_INTEGRATION_SPEC.md](../../docs/COPILOT_LOVABLE_INTEGRATION_SPEC.md), [docs/sprints/phase-0-repo-truth-audit.md](../../docs/sprints/phase-0-repo-truth-audit.md), [docs/ops/WINDOWMAN_V2_BACKEND_DIAGNOSIS.md](../../docs/ops/WINDOWMAN_V2_BACKEND_DIAGNOSIS.md). | Confirmed by grep. | Doc refresh sprint. |
| **P2** | Mock pillar / flag shapes drift from raw `preview_json` / `full_json` shapes. If a future component reads raw `full_json` instead of going through `useAnalysisData`, it will crash on real data. | §12. | Add raw fixtures during Phase 2C. |

---

## 14. No-Build Constraints

- [ ] No file edits during this plan creation pass (only this `.plan.md` is new).
- [ ] No deploys.
- [ ] No migrations.
- [ ] No protected-surface changes (scanner, OTP, Twilio, scan-quote, RLS, CAPI, tracking).
- [ ] No V2 production wiring.
- [ ] No `useAnalysisData.ts` or `reportService.ts` modifications unless a P0 regression is found (none found).
- [ ] No new routes.
- [ ] No persistence for Prescription Room (none specified).
- [ ] No conversion tracking changes.
- [ ] No fake CLEAR states.
- [ ] No `full_json` or `flags` in preview.
- [x] Browser QA documented in [docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md](../../docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md) (wrong-phone binding explicitly deferred).

---

## 15. Final Next-Step Prompts

### Prompt A — `report-access` Browser QA (completed 2026-05-21; wrong-phone binding deferred)

```
PROMPT: report-access Browser QA — Read-only smoke

Goal:
Manually verify the report-access transport works end-to-end in a real browser
against the linked Supabase project before any V2 production wiring.

Do not edit code.
Do not deploy.
Do not modify migrations.

Steps:
1. Confirm .env.local VITE_SUPABASE_URL matches the project where report-access
   is deployed (per supabase/config.toml project_id = "wkrcyxcnzhwjtdpmfpaf").
2. npm run dev locally.
3. Open a real browser (Chrome or Edge). Open DevTools → Network tab.
4. Navigate to /report/classic/{REAL_SCAN_SESSION_ID}.
5. Verify in DevTools Network:
   - A POST to /functions/v1/report-access with body { mode: "preview",
     scan_session_id: <uuid> }.
   - The response is { ok: true, mode: "preview", data: { ... } }.
   - NO direct call to /rest/v1/rpc/get_analysis_preview from the browser.
6. Confirm preview UI renders: grade, red/amber counts, locked overlay,
   no flags array in the DOM (Elements panel: search for flag detail text
   to confirm absence).
7. Trigger OTP send. Confirm /functions/v1/send-otp returns 200.
8. Enter the OTP code. Confirm /functions/v1/verify-otp returns 200.
9. Observe a second POST to /functions/v1/report-access with body
   { mode: "full", scan_session_id: <uuid>, phone_e164: "+1..." }.
10. Verify the response is { ok: true, mode: "full", authorized: true,
    data: { ... } } and full reveal renders flags.
11. Open a new private window. Repeat step 4 with the same scan_session_id
    but submit a DIFFERENT phone for OTP. Confirm response is
    { ok: true, mode: "full", authorized: false, locked: true,
    reason: "unauthorized" } and the UI shows a locked / re-verify state.
12. Capture a HAR file or screenshots of all four network exchanges.

Acceptance:
- All four network exchanges show report-access as the only path to the
  private RPCs.
- No browser-side direct calls to get_analysis_preview or get_analysis_full.
- Unauthorized path returns the new envelope and the UI does not leak flags.
- Evidence saved to the repo (HAR / screenshots) under a new
  docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md note — created in a separate
  prompt, not in this QA run.

If any step fails:
- Stop. Do not proceed to Phase 2A.
- Report which step failed, with the failing network response body.

If all steps pass:
- Browser QA is GREEN. Phase 2A (narrowed) becomes safe to start.

**2026-05-21 closeout:** Steps 1–10 and 12 passed for session
`8ecb10ff-5c29-45be-a44e-4e933358d68b`. Step 11 (wrong verified phone) **deferred**.
Phase 2A cleared. See REPORT_ACCESS_BROWSER_QA.md.
```

### Prompt B — Phase 2A (narrowed), FOG preview-safety polish (**use this next**)

```
PROMPT: Phase 2A (narrowed) — FOG preview-safety polish in visual lab only

Pre-condition: Classic report-access browser QA practically passed (2026-05-21);
wrong verified phone binding deferred. Evidence in
docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md.

Allowed file edits:
- src/pages/DevReportPreview.tsx (only)

Forbidden file edits:
- src/App.tsx (no route changes)
- src/pages/ReportClassic.tsx (production route untouched)
- src/services/reportService.ts (no transport changes; you found no P0 regression)
- src/hooks/useAnalysisData.ts (must not be modified, refactored, or rewritten)
- supabase/functions/report-access/index.ts (no Edge Function changes)
- supabase/migrations/* (no migrations)
- any scan-quote, send-otp, verify-otp, RLS, CAPI, or tracking file
- src/components/forensic-report/* (visual components already shipped;
  do not touch without a separate phase)

Goal:
Bring the visual-lab DevReportPreview mock data closer to backend reality so
the lab does not lie about the production payload shape.

Changes:
1. Replace grade="D-" with grade="D" (backend produces single letters only;
   evidence: docs/report/FORENSIC_PROPS_CONTRACT.md §2.1).
2. Replace signalsExtracted={31} with signalsExtracted={null}.
3. Replace signalsTotal={37} with signalsTotal={null}.
4. Replace overpaymentBasis="Based on Central Florida Impact Window Index,
   DP 50, single-hung" with overpaymentBasis={null} (no deterministic
   formatter exists yet).
5. Leave all other mocks alone for now — full Mock Upgrade Spec is Phase 2C.

Acceptance:
- /visual/report-preview?v=v3&mode=preview renders without crashing.
- Grade displays as "D" (not "D-").
- The "Missing Regulatory Items" tile in PartialRevealHero falls back to
  flagAmberCount (because signalsExtracted/Total are null).
- The ExecutiveSummaryCard "Signals Extracted X of Y" line is hidden when
  signalsExtracted/Total are null (already gated at line 71-78 of
  ExecutiveSummaryCard.tsx).
- The locked teaser footnote with overpaymentBasis is hidden when null
  (already gated at PartialRevealHero.tsx line 319).
- No new lint errors.
- npm run build succeeds.

Rollback:
- Single-file revert of src/pages/DevReportPreview.tsx restores the prior
  mock values.

If anything in production routes appears to change as a result of this work:
STOP. Revert. Do not deploy.
```

---

**Final verdict:** Classic `report-access` Browser QA **practically passed** (see [REPORT_ACCESS_BROWSER_QA.md](../../docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md)). **Phase 2A (narrowed) visual-lab polish may proceed.** Wrong verified phone binding QA **DEFERRED — not passed.** Production V2 route migration **remains blocked.**
