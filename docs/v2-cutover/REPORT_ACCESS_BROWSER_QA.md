# Report-Access Browser QA — Classic Verify-to-Reveal

**Last updated:** 2026-05-21  
**Environment:** Local dev (`npm run dev`) against linked Supabase project  
**Production route under test:** Classic Truth Report (`/report/classic/:sessionId`)

---

## QA verdict (summary)

| Area | Verdict |
|------|---------|
| Classic happy-path Verify-to-Reveal | **PASS** |
| Wrong OTP handling | **PASS** |
| Resend / cooldown behavior | **PASS** |
| Wrong verified phone binding (same `scan_session_id`, different verified phone) | **DEFERRED** — not formally proven |
| Practical gate for narrowed Phase 2A visual-lab polish | **Acceptable to proceed** |
| Production V2 route migration | **Blocked** until explicit later approval |

**Overall:** Classic `report-access` browser QA is **practically passed** with one explicit deferred caveat. Proceed to Phase 2A (visual lab only). Do **not** treat wrong-phone verified-binding QA as passed.

---

## 1. Route tested

```
http://localhost:8080/report/classic/8ecb10ff-5c29-45be-a44e-4e933358d68b
```

- `scan_session_id`: `8ecb10ff-5c29-45be-a44e-4e933358d68b`
- Path: `/report/classic/:sessionId` → `ReportClassic` → `TruthReportClassic` / post-scan orchestration

---

## 2. Happy-path full unlock — PASS

Observed end-to-end:

1. Phone gate rendered and accepted input.
2. TCPA checkbox worked (required before send).
3. **Send Unlock Code** succeeded (`send-otp`).
4. OTP entry screen appeared.
5. Correct OTP submitted (`verify-otp` success).
6. Full report rendered in the UI (flags and full content visible).
7. **No visible phone-entry flicker** after the `deriveGateMode` verifying fix (gate stayed stable through verify → reveal).

---

## 3. Network evidence — full reveal (`report-access`)

Captured in browser DevTools (Network tab). Representative full-mode request/response:

### Request

- **Endpoint:** `POST /functions/v1/report-access`
- **Body fields observed:**
  - `mode`: `"full"`
  - `scan_session_id`: `"8ecb10ff-5c29-45be-a44e-4e933358d68b"`
  - `phone_e164`: E.164 verified phone (e.g. `"+1..."`)

### Response

- `ok`: `true`
- `mode`: `"full"`
- `authorized`: `true`
- `data`: present (full analysis payload)
- `data.flags`: present (full flag list available to UI)

### UI correlation

- Full report rendered after this response.
- No direct browser call to `/rest/v1/rpc/get_analysis_full` or `get_analysis_preview` on the production Classic path.

### Supporting calls (happy path)

| Call | Result | Role |
|------|--------|------|
| `report-access` `mode: "preview"` | Success | Teaser / locked preview |
| `send-otp` | 200 | Unlock code delivery |
| `verify-otp` | 200 | Phone verification + session binding |
| `report-access` `mode: "full"` | `authorized: true` | Full report fetch |

> **Note:** HAR/screenshot binaries are not committed in this pass; this document records observed network shapes and behavioral outcomes. Attach HAR under `docs/v2-cutover/evidence/` in a follow-up if binary artifacts are required.

---

## 4. Wrong OTP behavior — PASS

| Step | Result |
|------|--------|
| Submit incorrect OTP | `verify-otp` failure (**400**); report **did not** unlock |
| UI after wrong code | Cooldown / countdown before resend allowed |
| Resend after cooldown | New code request succeeded |
| Same OTP after short window | **Expected** — Twilio Verify validity window may return the same code |
| Re-enter correct OTP | Unlock succeeded; full report rendered |

The `verify-otp` **400** on wrong entry is **intentional test traffic**, not a regression.

---

## 5. Deferred caveat — wrong verified phone binding

**Status: DEFERRED (not passed)**

The following scenario was **not** completed in this QA pass:

1. Open Classic report for scan session `8ecb10ff-5c29-45be-a44e-4e933358d68b`.
2. Complete OTP with phone **A** (happy path above).
3. In a **new private window**, same `scan_session_id`, complete OTP with phone **B** (different verified number).
4. Assert `report-access` full response: `{ ok: true, mode: "full", authorized: false, locked: true, reason: "unauthorized" }`.
5. Assert UI: locked / re-verify state; **no** full flag DOM leak.

**Confidence:** High based on architecture (`report-access` → RPC with `phone_e164`; DB sentinel for unauthorized full fetch). **Not formally proven** in browser.

**If authorization anomalies appear in production or staging, revisit this test immediately** before any V2 production route promotion.

---

## 6. Known non-blocking issues

| Issue | Classification | Notes |
|-------|----------------|-------|
| `get_county_by_scan_session` **404** | Known tech debt | `useCountyForSession` falls back; not blocking lab or Classic reveal QA |
| `event_logs` **201** | Expected | Frontend telemetry via `trackEvent("preview_rendered")` → `event_logs` INSERT; **not** `report-access` authorization |
| React Router future-flag warnings | Non-blocking | Dev console only |
| Preload warning | Non-blocking | Dev/build tooling |
| `verify-otp` **400** during QA | Explained | Caused by deliberate wrong OTP entry (§4) |
| `PostScanReportSwitcher.test.tsx` TypeScript errors | Pre-existing | Unrelated to `report-access` transport |
| V2 visual WIP (`ForensicAuditReport`, FOG, etc.) | Separate track | Lab-only; not part of this Classic QA gate |

---

## 7. Preview path (prior verification)

Preview Browser QA was recorded earlier in [.cursor/plans/phase_2_visual_conversion_reconciled.plan.md](../../.cursor/plans/phase_2_visual_conversion_reconciled.plan.md) §11:

- `report-access` `mode: "preview"` — **Passed**
- Grade + severity counts render; no direct browser RPC to `get_analysis_preview`

Full happy-path + wrong OTP retests above supersede the prior “pending retest” state for OTP/full reveal, except the **deferred wrong-phone binding** trial.

---

## 8. event_logs clarification

During Classic preview/load, Network may show `event_logs` **201**.

**Path:** `useAnalysisData` → `trackEvent("preview_rendered")` → `trackEvent.ts` → `event_logs` INSERT.

`report-access` does **not** write to `event_logs`. Telemetry is separate from report authorization.

---

## 9. What this gate allows / blocks

### Allowed after this QA closeout

- **Phase 2A (narrowed):** FOG preview-safety polish in **visual lab only** (`DevReportPreview.tsx` per reconciled plan).
- Continued Classic production route (`/report/classic/:sessionId`) with current `report-access` transport.

### Still blocked

- Production V2 route migration (`ForensicAuditReport` on live funnel).
- Claiming **wrong verified phone binding** as tested/passed.
- Any change to protected surfaces without `SPRINT APPROVAL:` (see `.cursor/PROTECTED_FILES.md`).

---

## 10. Sign-off

| Role | Status |
|------|--------|
| Classic Verify-to-Reveal (happy path) | Signed off **PASS** — 2026-05-21 |
| Wrong OTP / resend | Signed off **PASS** — 2026-05-21 |
| Wrong verified phone binding | **DEFERRED** — revisit before V2 production wiring |
| Phase 2A visual-lab entry | **Approved** (practical gate) |
