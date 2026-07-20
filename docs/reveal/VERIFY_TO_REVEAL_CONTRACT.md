# Verify-to-Reveal Contract — WindowMan.PRO

> **Authority:** This document is the canonical Verify-to-Reveal **transport and protection** contract for WindowMan.PRO. If another doc describes the browser calling `get_analysis_preview` or `get_analysis_full` via `supabase.rpc()`, **this document wins** until a deliberate doc sprint updates the other file.

---

## 1. Purpose

WindowMan is **Verify-to-Reveal**: preview may be shown before SMS verification; the full report (`full_json`, exact grade, full flags) must never reach the browser until backend authorization succeeds.

This contract defines:

- The **live production browser path** for OTP and full-report fetch
- Which files orchestrate the gate
- Locked behaviors agents and developers must preserve
- Where to read deeper operational detail

---

## 2. Live browser transport (production)

End-to-end chain:

```
upload → scan-quote
       → report-access (preview mode)
       → usePhonePipeline → phoneVerificationService.ts → send-otp / verify-otp
       → useAnalysisData → reportService.ts → report-access (full mode) → service-role RPC get_analysis_full
       → full UI render
```

### Preview fetch

- **Client:** `useAnalysisData` (phase 1) → `reportService.fetchAnalysisPreview()`
- **Transport:** `supabase.functions.invoke("report-access", { body: { mode: "preview", scan_session_id } })`
- **Backend:** Edge Function `report-access` calls service-role RPC `get_analysis_preview`

### OTP send and verify

- **Client:** `usePhonePipeline` → `phoneVerificationService.ts` (sole transport)
- **Send:** `supabase.functions.invoke("send-otp", { body: { phone_e164, scan_session_id } })`
- **Verify:** `supabase.functions.invoke("verify-otp", { body: { phone_e164, code, scan_session_id } })`
- **Rule:** Components must **not** invoke `send-otp` or `verify-otp` directly — extend the service or hook.

### Full report fetch (post-OTP)

- **Client:** `useAnalysisData.fetchFull()` → `reportService.fetchAnalysisFull(scanSessionId, phoneE164)`
- **Transport:** `supabase.functions.invoke("report-access", { body: { mode: "full", scan_session_id, phone_e164 } })`
- **Backend:** Edge Function `report-access` calls service-role RPC `get_analysis_full`
- **Unauthorized:** Proxy returns `{ ok: true, authorized: false, locked: true, reason: "unauthorized" }` (HTTP 200). `reportService` maps this to `{ ok: false, code: "unauthorized" }`. The browser does **not** see the raw `__UNAUTHORIZED__` grade sentinel.

### Explicit prohibition

**Production browser code must not call `get_analysis_preview` or `get_analysis_full` directly via `supabase.rpc()`.** Those RPCs are `SECURITY DEFINER` and intended for service-role execution behind `report-access`.

Do not restore or add direct browser RPC calls on production paths.

---

## 3. Live orchestrators and gate UI

Two **live** orchestrators own OTP + reveal wiring:

| Path | Role |
|------|------|
| `src/components/post-scan/PostScanReportSwitcher.tsx` | In-page post-scan orchestrator (Index flow) |
| `src/pages/ReportClassic.tsx` | Classic route orchestrator (`/report/classic/:sessionId`) |

**Live gate UI shell:** `src/components/LockedOverlay.tsx` — presentation only; orchestration stays in the orchestrators above.

**Possibly deprecated (not on live import path):** `PhoneVerifyModal.tsx`, `VerifyGate.tsx` — see [Event Ownership Model](../tracking/EVENT_OWNERSHIP_MODEL.md). Remain protected until a deprecation sprint confirms removal.

---

## 4. Backend authority

### After OTP verify (`verify-otp`)

- Updates `phone_verifications` (verified status, timestamps, session binding)
- Updates `leads.phone_verified`, `leads.phone_verified_at`, `leads.phone_e164`
- Persists canonical server-side events (`phone_verified`, `report_revealed`) with deterministic event IDs returned to the client for dedup

### Before full reveal (`report-access` → `get_analysis_full`)

- Service-role RPC re-checks verification state (phone + session binding)
- Returns full payload only when authorized; otherwise returns unauthorized envelope (not raw full data)

**Client state is never authoritative** for verification or full-report access.

---

## 5. Locked behaviors

Applies to **any file**, including unlisted paths:

1. **No `full_json` before SMS verification** — backend gate, not CSS/DOM hiding
2. **No client OTP generation or validation** — Twilio Verify + Edge Functions own codes
3. **No CSS/DOM-only unlock substitute** — blur, hidden DOM, or client booleans are not authorization
4. **`usePhonePipeline` modes:** `validate_only` and `validate_and_send_otp` only — no third mode without a cross-repo sprint
5. **No production use of `OTP_QA_BYPASS_*`** — QA bypass env vars are for controlled non-production testing only

---

## 6. Dev-only exceptions

- `supabase/functions/dev-report-unlock/**` — dev/staging full-report bypass; must **not** be wired into production reveal
- Dev tooling (e.g. `DevQuoteGenerator`, scanner lab) may call RPCs or alternate paths — must remain `import.meta.env.DEV`-gated and must not become the production funnel

---

## 7. Pointers (read deeper)

| Doc | Use when |
|-----|----------|
| [`.cursor/PROTECTED_FILES.md`](../../.cursor/PROTECTED_FILES.md) | Tier A/B protected paths; override phrase |
| [`docs/ops/SUPABASE_FUNCTION_MANIFEST.md`](../ops/SUPABASE_FUNCTION_MANIFEST.md) | Edge Function deploy matrix, env var names, smoke priorities |
| [`docs/v2-cutover/REPORT_ACCESS_BROWSER_QA.md`](../v2-cutover/REPORT_ACCESS_BROWSER_QA.md) | Signed Classic OTP + report-access browser QA |
| [`docs/tracking/EVENT_OWNERSHIP_MODEL.md`](../tracking/EVENT_OWNERSHIP_MODEL.md) | Business event ownership on OTP/reveal path |

Also read before OTP/reveal edits:

- `.cursor/rules/twilio.mdc`
- [AGENTS.md](../../AGENTS.md) — "Non-Negotiable Product and Security Rules" and "Repo Truth Before Advice"
- [docs/START_HERE.md](../START_HERE.md) — invoke `developer-babysitter` before Tier A–D edits

---

## 8. Override protocol

Tier A paths require explicit user approval:

```text
SPRINT APPROVAL: <sprint-name> — <one-line scope>
```

Only files **explicitly named** in the one-line scope may be edited. Invoke the **`developer-babysitter`** subagent before editing protected surfaces (see [AGENTS.md](../../AGENTS.md) "Protected Systems and Mutation Safety" and [docs/START_HERE.md](../START_HERE.md)).

---

## 9. Maintenance

When the live transport changes (new proxy, new orchestrator, RPC rename):

1. Update **this file first**
2. Update `.cursor/PROTECTED_FILES.md`
3. Add or refresh stale banners on superseded docs — do not leave contradictory transport docs unmarked
