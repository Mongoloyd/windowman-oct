## Audit Findings — Why Financial Forensics Renders After Diagnosis Round-Trip But Not After Initial OTP

### The actual root cause (verified in code)

This is **not** a backend issue, **not** a React batching timing issue, and **not** a data-shape problem. The backend is populating `full_json.derived_metrics`, `full_json.warnings`, and `full_json.missing_items` correctly. Two pieces of evidence prove this:

1. The console log already shows `[FETCH_FULL_FORENSIC] success {grade:"F"}` — full payload arrives successfully.
2. After the user navigates to `/diagnosis` and clicks "back to report", they land on `/report/classic/:scanSessionId` (`src/pages/ReportClassic.tsx`), which **does** render Financial Forensics. That page reads from the exact same `useAnalysisData` hook and the exact same `buildFullData` mapper — proving the data is in the payload.

### The real bug — a prop-forwarding gap in PostScanReportSwitcher

There are two render paths for the report:

| Path | Component | derivedMetrics passed? |
|---|---|---|
| Post-OTP, same page (homepage) | `Index.tsx` → `PostScanReportSwitcher` → `TruthReportClassic` | **NO** |
| Direct `/report/classic/:id` route (after diagnosis back button) | `ReportClassic.tsx` → `TruthReportClassic` | YES |

`src/pages/ReportClassic.tsx` (lines 572–583) explicitly passes:
- `derivedMetrics={analysisData.derivedMetrics as any}`
- `warnings={analysisData.warnings}`
- `missingItems={analysisData.missingItems}`
- plus `summary`, `topWarning`, `topMissingItem`, `pricePerOpening`, etc.

`src/pages/Index.tsx` (lines 704–732) does **not** pass any of these to `PostScanReportSwitcher`. And `PostScanReportSwitcher`'s `Props` type (lines 38–69) does not declare them. So even though `<TruthReportClassic {...props} />` spreads, those keys are simply absent.

Result: in the in-page post-OTP flow, `TruthReportClassic` receives `derivedMetrics === undefined`, `warnings === undefined`, `missingItems === undefined`. The guards on lines 889/893/897 (`isFull && derivedMetrics && ...`) silently fail. Financial Forensics never renders.

The Diagnosis → back-to-report navigation works because it routes the user to a different React tree (`ReportClassic.tsx`) that wires the props correctly. Same data, different parent.

---

## Fix Plan

A single surgical change. No backend work. No changes to `useAnalysisData`, no changes to `TruthReportClassic`, no changes to `ReportClassic.tsx`, no changes to scoring, no changes to OTP/Verify-to-Reveal.

### File 1 — `src/components/post-scan/PostScanReportSwitcher.tsx`

Extend the `Props` type (lines 38–69) to include the missing fields that `TruthReportClassic` consumes in full mode:

```
derivedMetrics?: Record<string, unknown> | null;
warnings?: unknown[];
missingItems?: unknown[];
summary?: string | null;
topWarning?: string | null;
topMissingItem?: string | null;
pricePerOpening?: number | null;
pricePerOpeningBand?: "low" | "market" | "high" | "extreme" | null;
paymentRiskDetected?: boolean;
scopeGapDetected?: boolean;
summaryTeaser?: string | null;
missingItemsCount?: number;
```

The render block (line 689) already uses `<TruthReportClassic {...props} ... />`, so once the props are declared and forwarded by the parent, no JSX change is needed inside the switcher.

### File 2 — `src/pages/Index.tsx`

In the `<PostScanReportSwitcher ... />` block (lines 704–732), pass through the same fields from `activeData`, mirroring how `ReportClassic.tsx` does it:

```
derivedMetrics={activeData.derivedMetrics as any}
warnings={activeData.warnings}
missingItems={activeData.missingItems}
summary={activeData.summary}
topWarning={activeData.topWarning}
topMissingItem={activeData.topMissingItem}
pricePerOpening={activeData.pricePerOpening}
pricePerOpeningBand={activeData.pricePerOpeningBand}
paymentRiskDetected={activeData.paymentRiskDetected}
scopeGapDetected={activeData.scopeGapDetected}
summaryTeaser={activeData.summaryTeaser}
missingItemsCount={activeData.missingItemsCount}
```

That's it. The double-guards in `TruthReportClassic` stay as-is — they're correct defensive code; they were just being starved of data on this one route.

---

## Why Not the Three Solutions Suggested in the Prompt

- **Solution 1 (loosen guards)**: would mask the real bug and ship empty Financial Forensics shells on the homepage path while ReportClassic continues to render real data — inconsistent UX.
- **Solution 2 (diagnostic logs)**: the diagnostic is already conclusive without adding logs — the `/report/classic` route renders the same payload correctly, which is empirical proof the data exists. Adding logs is busywork.
- **Solution 3 (rewrite TruthReportClassic guards + add internal null-tolerance to QuotePriceMath/RedFlagsList)**: a much larger refactor that touches presentation components which are intentionally pure. The actual defect is upstream prop wiring; fix it where it broke.

---

## Verification After Implementation

1. Fresh OTP flow on homepage → after verify, scroll past Forensic Findings → Financial Forensics (`QuotePriceMath`), Red Flags list, Missing Items list all render inline. No diagnosis round-trip required.
2. Direct `/report/classic/:id` route → unchanged behavior (still renders, since that path was never broken).
3. No new network calls, no new RPCs, no Verify-to-Reveal regression — full data still arrives via the existing `fetchFull` → `get_analysis_full` path; we are only forwarding props that already exist in `analysisData`.
4. Typecheck passes (Props type extended, optional fields).

---

## Files Changed

- `src/components/post-scan/PostScanReportSwitcher.tsx` — extend `Props` type only
- `src/pages/Index.tsx` — forward the fields to `<PostScanReportSwitcher />`

No other files touched.
