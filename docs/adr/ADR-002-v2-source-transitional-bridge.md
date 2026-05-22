# ADR-002: V2 Source Transitional Bridge (Legacy full_json Fallback)

**Status:** Accepted — transitional  
**Date:** 2026-05-22  
**Scope:** Frontend adapter layer only (`reportAccessAdapter.source.ts`)

---

## Context

WindowMan V2 Forensic Report modules (Quote Math Ledger, Change Order Defense Matrix, Scope Gap Checklist) consume a curated **`V2SourceProjection`** surfaced as public **`V2ReportSource`** (`proof_of_read`, `confidence_score`, `v2_source_version`, `v2_source`).

The intended long-term path is:

1. Authorized full fetch via `report-access` (Edge Function).
2. Edge returns **`data.v2_source`** and **`v2_source_version`** on authorized full responses only.
3. Frontend `rawFullRowToV2ReportSource(row)` prefers Edge projection.
4. `useV2ReportModules` maps `V2ReportSource` into module props via existing adapters.

At the time of this ADR, **`report-access` does not yet project `data.v2_source`**. The frontend transport layer (`RawFullRow`, `useAnalysisData.v2ReportSource`) is in place, but Edge projection is pending.

Classic Truth Report rendering still uses the existing authorized **`full_json`** path internally. V2 modules need a bridge so lab and early integration work can proceed without treating raw `full_json` as the public V2 contract.

---

## Decision

Inside **`rawFullRowToV2ReportSource(row)`** only:

1. **Primary:** If `row.v2_source` parses safely, use it and preserve `row.v2_source_version`.
2. **Transitional fallback:** If Edge projection is absent, derive a curated **`V2SourceProjection`** from internal **`row.full_json.extraction`** (and minimal `derived_metrics` where required) via **`deriveV2SourceProjectionFromLegacyFullJson`**.
3. Set fallback **`v2_source_version`** to **`v2-source-legacy-full-json-fallback`** (`LEGACY_FULL_JSON_V2_SOURCE_VERSION`).
4. **Empty:** If neither path yields a useful projection, return `v2_source: null`.

**`toV2AdapterSource`** continues to adapt only public **`V2ReportSource.v2_source`** into the synthetic adapter shim. It does not read legacy `full_json` from the public surface.

---

## Why This Is Acceptable Temporarily

- **Single internal boundary:** Legacy `full_json` is read only inside the authorized full-row transform, not on `V2ReportSource` or hook results.
- **Curated output:** Fallback builds module-scoped slices (`quote_math`, `change_order`, `scope_gap`) with fields current adapters need—no raw OCR, flags dump, or broad document text.
- **Precedence preserved:** Edge `v2_source` always wins when present; fallback is never preferred over server projection.
- **Classic path unchanged:** `AnalysisData` / classic report behavior does not depend on this bridge.
- **Unblocks V2 module wiring** in dev/lab without faking Edge projection or exposing `full_json` on public hooks.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Fallback mistaken for canonical contract | This ADR + prominent inline comment; version string `v2-source-legacy-full-json-fallback` is explicitly non-Edge |
| Drift between client derivation and future Edge projection | Delete fallback once Edge ships; do not extend fallback field set without adapter need |
| Partial legacy rows (only some V2 groups populated) | By design; adapters must tolerate partial slices |
| Sensitive data in `full_json` | No runtime logging; no exposure on `V2ReportSource`; reads limited to adapter module |
| Permanent dual-path maintenance | **Removal condition below** — fallback is delete-target, not expand-target |

---

## Removal Condition

Remove the transitional bridge when **`report-access` reliably returns**:

- `data.v2_source` — curated `V2SourceProjection` for authorized full responses, and  
- `data.v2_source_version` — stable version string for that projection  

…such that production authorized full fetches no longer depend on client-side derivation from `full_json` for V2 modules.

**Verification signal:** Authorized full responses in staging/production show Edge `v2_source`; `v2_source_version` is not `v2-source-legacy-full-json-fallback`; V2 modules render correctly without the fallback code path.

---

## Removal Targets (code)

Delete from `src/components/forensic-report/adapters/reportAccessAdapter.source.ts`:

- `LEGACY_FULL_JSON_V2_SOURCE_VERSION`
- `deriveV2SourceProjectionFromLegacyFullJson`
- `buildQuoteMathFromLegacy`
- `buildChangeOrderFromLegacy`
- `buildScopeGapFromLegacy`
- `buildScopeGapInstallationFromLegacy`
- `buildScopeGapPermitsFromLegacy`
- Fallback branch in `rawFullRowToV2ReportSource` (legacy derivation call)

Retain:

- `parseV2SourceProjection` primary path
- `toV2AdapterSource` shim from curated `v2_source`
- Public `V2ReportSource` shape (no `full_json` on public surface)

After removal, archive or supersede this ADR (e.g. status → **Superseded by Edge v2_source projection**).

---

## Non-Goals

- **Not** implementing `report-access` Edge `v2_source` projection (separate sprint).
- **Not** changing `useAnalysisData`, `reportService`, RLS, OTP, or Supabase.
- **Not** editing V2 visual components or module adapters in this bridge.
- **Not** exposing `full_json`, `extraction`, `RawFullRow`, raw OCR, or PII on `V2ReportSource` or `UseAnalysisDataResult`.
- **Not** adding Permit Compliance, Warranty Radar, or future modules to the fallback.
- **Not** making `v2-source-legacy-full-json-fallback` a permanent version identifier.
- **Not** expanding the fallback field matrix beyond current adapter-required slices.

---

## References

- Inline comment: `src/components/forensic-report/adapters/reportAccessAdapter.source.ts` (above `LEGACY_FULL_JSON_V2_SOURCE_VERSION`)
- Types: `src/types/v2ReportTransport.ts`, `src/components/forensic-report/adapters/reportAccessAdapter.types.ts`
- Hook surface: `src/hooks/useAnalysisData.ts` (`v2ReportSource` only)
- Module mapping: `src/hooks/useV2ReportModules.ts`
