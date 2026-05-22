# Track A Phase 3B — Dark V2 Live Transport QA Results

**Status:** Template — awaiting staging execution  
**Sprint:** `truth-report-v2-transport` — Phase 3B evidence capture  
**Related:** Phase 3A lab-only `source=live` implementation

---

## 1. QA Metadata

| Field | Value |
|-------|-------|
| QA date | |
| Tester | |
| Branch | |
| Commit SHA | |
| Staging environment | |
| Staging Supabase project ref | |
| Frontend deploy URL | |
| report-access deploy timestamp | |
| Browser | |
| Test scan_session_id | |
| Verified phone available | yes / no |
| Wrong-phone negative test available | yes / no |

---

## 2. Scope

This QA validates the lab-only `source=live` transport path for Dark V2. It does not validate production rollout. Production remains `TruthReportClassic`.

This document records staging evidence. It is not an implementation plan and does not authorize production routing changes.

**In scope:**

- Lab route `/visual/report-preview` with `source=live`
- Preview transport boundary (no full payload exposure)
- Full transport boundary (phone-gated, explicit fetch)
- Authorization gating and local lock behavior
- `rawFullRowToV2ReportSource` → `useV2ReportModules` module derivation
- PII isolation for `phone_e164`
- Regression check: fixture, adapter, and production Classic paths unchanged

**Out of scope:**

- Production Dark V2 rollout
- Edge Function or report-access code changes
- OTP/Twilio flow validation beyond confirming lab path does not invoke them
- Visual completeness of all seven thematic modules on live data
- Scanner brain, scoring, migrations, RLS

---

## 3. Routes Tested

| # | Route | Expected behavior | Actual behavior | Pass/Fail | Evidence link / screenshot reference | Notes |
|---|-------|-------------------|-----------------|-----------|-------------------------------------|-------|
| 1 | `/visual/report-preview?v=v3&mode=preview` | Fixture preview unchanged; locked preview shell; no evidence modules | | TBD | | |
| 2 | `/visual/report-preview?v=v3&mode=full` | Fixture full unchanged; seven-module stack + CTA | | TBD | | |
| 3 | `/visual/report-preview?v=v3&mode=full&source=adapter` | Adapter fixture unchanged; adapter mappers; no fixture overrides for ledger/matrix/scope | | TBD | | |
| 4 | `/visual/report-preview?v=v3&source=live&mode=preview&scan_session_id={uuid}` | Auto preview fetch; preview shell only; no evidence modules; diagnostic strip shows `transport path: preview`; no `v2_source` | | TBD | | |
| 5 | `/visual/report-preview?v=v3&source=live&mode=full&scan_session_id={uuid}` | Phone input panel; no fetch until button click; no modules | | TBD | | |
| 6 | Same full route after verified phone submit | `fetchAnalysisFull` runs; authorized full row; `rawFullRowToV2ReportSource` used; modules render from live source only; no fixture patching | | TBD | | |
| 7 | Same full route after wrong phone submit | Local lab lock panel; no modules; no redirect; no OTP UI; no full payload | | TBD | | |
| 8 | `/visual/report-preview?v=v3&source=live&mode=preview` | Lab error panel (missing `scan_session_id`); no fetch | | TBD | | |

---

## 4. Network Evidence Checklist

Record redacted network snippets in Section 11. Do not paste raw `full_json`, extraction blobs, flags arrays, or PII.

### Preview live response

- [ ] Uses report-access preview transport.
- [ ] Does not include `full_json`.
- [ ] Does not include flags array.
- [ ] Does not include raw extraction.
- [ ] Does not include `v2_source`.
- [ ] Does not include `phone_e164`.

### Full authorized response

- [ ] Uses report-access full transport.
- [ ] `authorized` is true.
- [ ] `v2_source` is present when projection is useful.
- [ ] `v2_source_version` observed:
- [ ] `rawFullRowToV2ReportSource` path confirmed.
- [ ] Module props derived count:
- [ ] No fixture patching observed.

### Full unauthorized response

- [ ] Local lab lock panel rendered.
- [ ] No modules rendered.
- [ ] No redirect occurred.
- [ ] No OTP component rendered.
- [ ] No full payload shown.

---

## 5. PII / Phone Safety Checklist

Verify in DevTools: Application (storage), Network (request URL/body), Console, and lab diagnostic strip.

- [ ] `phone_e164` is not present in URL.
- [ ] `phone_e164` is not present in localStorage.
- [ ] `phone_e164` is not present in sessionStorage.
- [ ] `phone_e164` is not present in console logs.
- [ ] `phone_e164` is not present in debug strip.
- [ ] `phone_e164` is cleared on route/source/mode change.
- [ ] `phone_e164` is passed only to `fetchAnalysisFull`.

---

## 6. Diagnostic Strip Observations

Record values from the lab-only diagnostic strip on `source=live` routes. Do not record phone or raw payloads.

| Field | Preview live | Full idle | Full authorized | Full unauthorized |
|-------|--------------|-----------|-----------------|-------------------|
| source | | | | |
| mode | | | | |
| request state | | | | |
| authorized | | | | |
| locked | | | | |
| v2_source_version | | | | |
| v2_source present | | | | |
| module source ready | | | | |
| module props derived | | | | |
| transport path | | | | |
| transformer used | | | | |
| notes | | | | |

---

## 7. Module Rendering Matrix

Expected: preview live and full unauthorized render **no** evidence modules. Fixture/adapter full render full stack. Live full authorized renders only modules derivable from live source (may be fewer than 7).

| Module | Fixture full | Adapter full | Live full authorized | Live full unauthorized | Preview live | Notes |
|--------|--------------|--------------|----------------------|------------------------|--------------|-------|
| ContractorQuoteIdentityCard | | | | | | |
| QuoteMathLedger | | | | | | |
| CodeComplianceProofSection | | | | | | |
| ChangeOrderDefenseMatrix | | | | | | |
| ScopeGapChecklist | | | | | | |
| FinancialIntegritySection | | | | | | |
| WarrantyFinePrintSection | | | | | | |
| NextActionCard | | | | | | |

---

## 8. Production Safety Verification

Confirm via code review and/or spot-check on staging that production paths were not altered by Phase 3A.

- [ ] `/report/classic/:sessionId` still renders `TruthReportClassic`.
- [ ] `ForensicAuditReport` is not wired to production routes.
- [ ] `PostScanReportSwitcher` unchanged.
- [ ] `ReportClassic` unchanged.
- [ ] `App.tsx` unchanged.
- [ ] `useAnalysisData` unchanged.
- [ ] `report-access` unchanged.
- [ ] `scan-quote` unchanged.
- [ ] OTP/Twilio unchanged.

---

## 9. Known Expected Limitations

- Live thematic sections may show missing/unclear states if live `v2_source` lacks `lab_sections`.
- Sparse `v2_source` may produce fewer than 7 derived module prop sets.
- This is expected and does not fail the smoke test.
- Phase 3B validates transport, authorization, and gating — not final production content completeness.
- A visually incomplete live module stack is acceptable if the transport, authorization, transformer, and gating behavior are correct.

---

## 10. Pass / Fail Summary

| Field | Value |
|-------|-------|
| Overall result | TBD |
| Blocking issues | |
| Non-blocking issues | |
| Required fixes before Phase 4 | |
| Recommended next sprint | |

---

## 11. Evidence Attachments

Attach redacted artifacts only. Do not include real phone numbers, raw `full_json`, raw extraction text, raw flags arrays, or other PII.

| Attachment | File / link | Redaction notes |
|------------|---------------|-----------------|
| Screenshot: fixture preview | | |
| Screenshot: fixture full | | |
| Screenshot: adapter full | | |
| Screenshot: live preview | | |
| Screenshot: live full idle | | |
| Screenshot: live full authorized | | |
| Screenshot: live full unauthorized | | |
| Redacted network snippet: preview | | |
| Redacted network snippet: full authorized | | |
| Redacted network snippet: full unauthorized | | |

---

## Appendix — Tester Quick Reference

**Phase 3A implementation touchpoints (read-only reference):**

- Lab orchestrator: `src/pages/DevReportPreview.tsx`
- Transport helper: `src/lib/labLiveReportAccess.ts`
- Lab UI panel: `src/components/forensic-report/LabLiveReportAccessPanel.tsx`
- Transformer: `rawFullRowToV2ReportSource` in `src/components/forensic-report/adapters/reportAccessAdapter.source.ts`
- Module hook: `useV2ReportModules` (synchronous; receives converted source only after authorized full)

**Pre-test checklist:**

1. Staging frontend deployed with Phase 3A commit.
2. Staging `report-access` Edge Function deployed.
3. Valid test `scan_session_id` with completed analysis.
4. Verified phone bound to session lead (for authorized full test).
5. Wrong phone available for negative test (optional; mark N/A if unavailable).

**Do not use:** `dev-report-unlock` for this QA matrix.
