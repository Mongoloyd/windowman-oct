# Forensic Audit Report Reskin — Partial + Full Reveal

## Goal

Replace the current partial-reveal and full-reveal UI with a unified, premium "Forensic Audit" report shell matching the two reference mockups. One component, two access modes — the lock "lifts" rather than the page swapping.

## Non-negotiables (preserved)

- Zero changes to `scan-quote`, `send-otp`, `verify-otp`, `usePhonePipeline`, OTP gating, `useAnalysisData`, RLS, scoring, or `PostScanReportSwitcher` orchestration.
- `full_json` stays server-gated. The blur in the partial mockup is decorative — no real full data is ever fetched pre-verification.
- No new fonts, no CDNs. System stack + existing mono.
- Design tokens only (HSL in `index.css` + `tailwind.config.ts`). No raw hex in components.

## Architecture

One shell, two modes:

```text
src/components/forensic-report/
├── ForensicAuditReport.tsx        shell, prop: accessLevel: "preview" | "full"
├── ReportHeader.tsx               WINDOWMAN TRUTH REPORT + Report ID + audit chip
├── ExecutiveSummaryCard.tsx       grade dial, confidence bar, flag counts, overpayment range
├── TopFindingsList.tsx            top 3 critical flag cards (blurred + locked overlay in preview)
├── PartialUnlockOverlay.tsx       centered lock + verify CTA (preview only)
├── PropertyProfileCard.tsx        homeowner / address / wind zone / jurisdiction (full only, graceful)
├── ScopeOverviewCard.tsx          openings / price-per-opening / contract price
└── tokens.ts                      shared spacing constants
```

`PostScanReportSwitcher` keeps every prop, every callback, every state machine. We swap the rendered child from `TruthReportClassic` → `ForensicAuditReport` and forward the same data. `LockedOverlay` and the OTP modal stay exactly where they are.

## Reconciliation map

| Today | New | Notes |
|---|---|---|
| `TruthReportClassic` (preview mode) | `ForensicAuditReport accessLevel="preview"` | Same props |
| `TruthReportClassic` (full mode) | `ForensicAuditReport accessLevel="full"` | Same props |
| `LockedOverlay` (OTP gate) | Unchanged | Owned by switcher |
| `CriticalFlagCard` | Reused inside `TopFindingsList` | Already on-aesthetic; minor spacing tune |
| `ExecutiveSummaryStrip` | Replaced by `ExecutiveSummaryCard` | New layout w/ grade dial |
| `VerifyBanner` | Unchanged | Stays below report |

## Confirmed decisions

1. **Overpayment range** — derive deterministically (±band) in the TS scoring engine. Add `price_overpayment_low` / `price_overpayment_high` to the analysis payload. Backend-only addition, no AI involvement, preserves Scanner Brain rule.
2. **Report ID** — formatted from `analysis_id` (e.g. `WM-{YYYY}-{MM}-{last4}`). Pure display derivation in a `formatReportId()` util. No schema change.
3. **Property Profile** — render row-by-row, hide rows with null fields, hide the whole card if every field is null.
4. **TruthReportClassic** — keep one release as fallback, then delete.

## Mobile stack order (proposed)

Header → Executive Summary → Top Findings (with overlay in preview) → Property Profile → Scope Overview → Verify CTA.

## Phasing

**Phase 1 — Tokens + shell (no user-facing change)**
- Add dark-report HSL tokens (deep navy bg, cyan accent, gold lock, danger/caution/success).
- Build `ForensicAuditReport` + child components behind `report_v3` flag.
- Mount in `/dev/report-preview` with existing fixtures for both modes.

**Phase 2 — Backend: overpayment range**
- Extend deterministic scoring to emit `price_overpayment_low` / `_high` from existing benchmark data.
- Surface on `preview_json` and `full_json`. RPC shapes in `serviceResults.ts` updated.

**Phase 3 — Partial reveal cutover**
- Wire `accessLevel="preview"` path. Verify lock overlay sits over blurred Top Findings. Verify no `full_json` is ever in the DOM pre-OTP (DevTools + RLS check).

**Phase 4 — Full reveal cutover**
- Wire `accessLevel="full"` path. QA grade dial, exec summary, property profile (graceful degradation), scope overview.

**Phase 5 — Flag flip + cleanup**
- `report_v3` default-on. After one release, delete `TruthReportClassic` and dead presentational children.

## QA gates per phase

- Visual diff vs. mockup (desktop + 390px mobile).
- Network panel: confirm `get_analysis_full` is **not** called during preview render.
- Definition of Done checklist from `AGENTS.md` §12.

## Risks

- Blur effect must be CSS-only over **placeholder** content, never real data. Component contract: in `accessLevel="preview"`, `TopFindingsList` receives `flags={[]}` and renders skeleton placeholders styled like cards. The full flags come only after gated fetch.
- Mobile parity for the grade dial — needs an SVG component, not a fixed-size raster.

## What changes vs. doesn't

**Changes:** presentational components only, plus one deterministic scoring addition (overpayment band).

**Does not change:** scan pipeline, OTP, RLS, storage, `usePhonePipeline`, `useAnalysisData`, `PostScanReportSwitcher`, AI extraction, tracking lanes.
