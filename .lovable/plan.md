# WindowMan.PRO — Read-Only Recovery Audit (FINAL)

> Read-only. No files changed. No SQL mutations. No deploys.
> Live Supabase project `wkrcyxcnzhwjtdpmfpaf` introspected directly.

---

## 1. Executive Summary

| Question | Answer |
|---|---|
| Caused by local Claude Code branch? | **No evidence.** Cannot affect Lovable/GitHub/Supabase unless pushed/merged/deployed. Nothing in repo, deployed Edge Functions, or live DB requires a Claude branch to explain. |
| GitHub `main` affected? | **Unknown** (no GitHub API access from sandbox — verify in GitHub UI). |
| Lovable sandbox affected? | **No structural break.** Files inspected match hardened patterns. |
| Lovable live affected? | **Unknown** (verify in Lovable → History panel). |
| Live Supabase affected? | **No.** Schema, CHECK constraint, RPC, columns, and migrations all align with — and exceed — the `625e931` baseline. |
| OTP structurally intact? | **Yes.** |
| Full report reveal structurally intact? | **Mostly yes — one moat concern: Realtime publication includes `analyses` and `scan_sessions`.** See §8. |
| Confirmed failure before OTP? | **Yes.** |
| Confirmed failure = scanner timeout handling? | **Yes — confirmed in DB and code.** Scan session `d2e527bd-69a1-4ef4-96f1-7d46ef0fabc7` is **still stuck in `processing` with zero `analyses` rows**. |
| Blank screen = frontend error handling? | **Yes (likely).** `scan-quote` deliberately returns a 504 + `processing` status on Gemini timeout so a retry can resume — but the frontend appears to treat the 504 as a fatal runtime error. |

**Bottom line:** OTP and Verify-to-Reveal are intact. The current user-visible failure is a **scanner Gemini timeout** that the backend handles "soft" (keeps state in `processing` for retry) but the frontend handles "hard" (uncaught runtime error → blank screen). There is also a **separate, independent Realtime exposure concern** for `analyses` that should be triaged.

---

## 2. Current Deployment Map

| Surface | Current Version / Evidence | Matches Expected? | Unknowns | Notes |
|---|---|---|---|---|
| GitHub `main` | Not directly inspectable from sandbox | Unknown | Latest SHA | Check on github.com |
| Lovable sandbox (this repo) | Inspected directly | n/a | — | OTP/scanner code matches `625e931` hardening + forward additions |
| Lovable live | Not inspectable | Unknown | Last Publish SHA + timestamp | Check Lovable → History → "Published" entries |
| Supabase Edge Functions | Auto-deployed from sandbox saves | Likely matches | Per-function "last deployed" timestamps | Confirm in Supabase dashboard → Functions |
| Supabase migrations | Latest in repo: `20260428120000_restore_get_analysis_full_strict_scan_binding.sql` | ✅ Matches live | — | Verified: `phone_verifications.status` CHECK includes `expired`; `leads.phone_verified` + `phone_verified_at` exist; `get_analysis_full` is the strict-binding version |
| Twilio Verify config | Not directly inspected | Unknown | secret values | Confirm in Supabase → Functions → Secrets |

---

## 3. Confirmed Runtime Failure Summary

**Incognito test failure:**
- `scan_session_id`: `d2e527bd-69a1-4ef4-96f1-7d46ef0fabc7`
- 504 response: `{"error":"AI extraction timed out","analysis_status":"processing","scan_session_status":"processing"}`
- Frontend: `has_blank_screen: true`, `RUNTIME_ERROR` originating from `supabase/functions/scan-quote/index.ts`

**Live DB state for that session (read-only, 2026-05-08):**
| Field | Value |
|---|---|
| `scan_sessions.id` | d2e527bd-69a1-4ef4-96f1-7d46ef0fabc7 |
| `scan_sessions.status` | **`processing`** (still) |
| `scan_sessions.lead_id` | 7a9f94c3-6e12-4141-ac63-0437c0ebb3c5 |
| `scan_sessions.created_at` | 2026-05-08 00:35:22 UTC |
| `scan_sessions.updated_at` | 2026-05-08 00:35:23 UTC (1 second later — set when `scan-quote` flipped it to processing) |
| `analyses` row | **None exist for this scan_session_id.** |

**What this proves:**
- The session is **stuck in `processing` indefinitely**. There is no recovery sweep or client retry.
- No analysis row was ever created — the Gemini timeout aborted before insert.
- The 504 is the *correct* backend behavior (soft timeout, preserves session for retry); the *missing* piece is a frontend retry/recovery UI and a backend stale-session sweeper.

**Ruled out:** stale browser storage (incognito), OTP regression, Twilio drift (failure is pre-OTP), `get_analysis_full` regression, Supabase schema drift.

**Not ruled out:** Gemini latency/quota at the moment of the test, oversized file, model config drift via `GEMINI_SCAN_MODEL` / `GEMINI_SCAN_TIMEOUT_MS` env vars.

---

## 4. Scanner 504 Timeout Runtime Diagnosis

### Backend behavior (verified in `supabase/functions/scan-quote/index.ts` lines 1185–1246)

```
const geminiController = new AbortController();
const geminiTimeout = setTimeout(
  () => geminiController.abort("gemini_timeout"),
  scannerCfg.geminiTimeoutMs,  // configurable via GEMINI_SCAN_TIMEOUT_MS
);
// fetch(geminiUrl, { signal: geminiController.signal })
// On abort/network error:
//   - keeps scan_sessions.status = 'processing' (intentional: enables retry)
//   - returns 504 with body { error: "AI extraction timed out",
//                              analysis_status: "processing",
//                              scan_session_status: "processing" }
//   - does NOT insert an analyses row
```

This is correct fail-open-for-retry semantics on the backend — but the contract is only useful if the frontend implements a polling/retry loop. It does not.

### Question-by-question

| # | Question | Answer |
|---|---|---|
| 1 | Frontend invoker of `scan-quote`? | `useGatedAIScanner` / `useQuoteScanner` (call `supabase.functions.invoke('scan-quote', ...)`). Need read pass to confirm exact file. |
| 2 | Frontend throws on non-2xx? | **Likely yes.** `supabase-js`'s `functions.invoke` returns `{ error }` on non-2xx; if not branched on, downstream code that destructures `data` throws. |
| 3 | Differentiates timeout vs other errors? | **Backend yes** (`error: "AI extraction timed out"` + status fields). **Frontend unknown** — needs targeted read. |
| 4 | Why blank screen? | Uncaught error in scanner React subtree without a local error boundary. |
| 5 | Local error boundary? | Not detected at scanner level — root error boundary likely shows blank. |
| 6 | Why didn't a boundary catch it cleanly? | If only `App`-level boundary exists, it likely renders nothing or a generic state. |
| 7 | Persists final failure on timeout? | **No.** Intentionally leaves `processing` so retry can resume. |
| 8 | Why both statuses `processing`? | Same — by design. |
| 9 | Can session be stuck forever? | **Yes, currently.** No sweeper, no client retry. Confirmed by live DB row 12+ hours stale. |
| 10 | Safe way to check later state? | Use the read-only SQL run above (no mutation). |
| 11 | Polling/retry path after timeout? | **None visible.** |
| 12 | Retry creates duplicates? | If implemented correctly via `scan_session_id` upsert, no. Current code uses `eq(scan_session_id)` upserts. |
| 13 | Likely cause of timeout? | Most probable: Gemini latency spike or model timeout too tight (`scannerCfg.geminiTimeoutMs`). Less likely: oversized file, prompt size growth. |
| 14 | Homeowner-safe message? | **No** — raw error JSON exposed in console; UI blank. |
| 15 | Manual review fallback? | Backend supports `analysis_status='needs_better_upload'` and `'invalid_document'`. UI rendering of those states needs verification. |
| 16 | "Try another upload" fallback? | Not on the timeout path. |
| 17 | "Check again" / polling? | Not implemented for stuck-processing case. |
| 18 | Failure before OTP? | **Yes.** |
| 19 | Affects Verify-to-Reveal? | **No** — no analysis row exists, so nothing to reveal even with a verified phone. |
| 20 | Smallest safe future change? | Frontend: catch 504 + `analysis_status:"processing"`, render "Still analyzing — check back" + retry button. Backend: optional cron sweeper to flip stale `processing` rows older than N minutes to `error` or `needs_better_upload`. |

### Failure point table

| Failure Point | Evidence | File / Function | Current Behavior | Expected Safe Behavior | Code Change Needed Later? |
|---|---|---|---|---|---|
| Gemini extraction timeout | 504 + abort | `scan-quote/index.ts` ~L1209–1246 | Returns 504, leaves `processing` | Same (correct) — but emit a clearer recoverable error code | Optional |
| Frontend handling of 504 | blank screen | `useGatedAIScanner` (TBD) | Throws / blanks | Show recoverable timeout UI, allow retry on same `scan_session_id` | **Yes** |
| Stuck processing session | DB row 12h+ in `processing` | `scan_sessions` row | No sweeper | Cron edge function to finalize stale rows | Optional but recommended |
| Missing scanner error boundary | runtime metadata `has_blank_screen:true` | scanner React subtree | None local | Local `<ErrorBoundary>` around scanner with retry | **Yes** |

### Status field table

| Status Field | Observed | Where Set | Should it stay? | Risk |
|---|---|---|---|---|
| `scan_session_id` | d2e527bd… | `start-upload-scan-session` | Yes (preserve for retry) | None |
| `scan_session_status` | `processing` | `scan-quote` L968 + L1018 | Yes for ~10–15 min, then sweep to `error`/`needs_better_upload` | Stuck rows pile up |
| `analysis_status` | `processing` (no row) | n/a (row never inserted) | After sweep, insert row with `error` status | Reveal path safe (no row → nothing to leak) |

---

## 5. End-to-End Verify-to-Reveal Flow Map

| Step | File / Function | Input | Output | Persistence | Failure Mode | Safe? | 504 related? |
|---|---|---|---|---|---|---|---|
| 1. Upload | `UploadZone` → `start-upload-scan-session` | file | `scan_session_id` | `scan_sessions`, `quote_files` | upload error | ✅ | No |
| 2. Scan start | `scan-quote` | scan_session_id | session→`processing` | `scan_sessions.status='processing'` | DB write fail returns error | ✅ | No |
| 3. Gemini extract | `scan-quote` ~L1209 | file bytes | extraction JSON | none | **timeout → 504, status stays `processing`** | ⚠️ Backend safe, frontend brittle | **YES** |
| 4. Scoring | `scan-quote` deterministic TS | extraction | grade/pillars | `analyses` upsert | needs_better_upload paths handled | ✅ | No |
| 5. Preview | `Index.tsx` / `TruthGateFlow` | scan_session_id | locked teaser | none | n/a | ✅ | No |
| 6. send-otp | `send-otp` | phone, scan_session_id | success | `phone_verifications` pending row bound to scan_session_id | Twilio/DB error → fails closed | ✅ | No |
| 7. verify-otp | `verify-otp` | phone, code, scan_session_id | verified payload + canonical event_ids | `phone_verifications.status='verified' + scan_session_id + lead_id`, `leads.phone_verified=true + phone_verified_at` | DB write fail → 500 | ✅ | No |
| 8. Reveal | `useAnalysisData` → RPC `get_analysis_full(uuid,text)` | scan_session_id, phone | analysis OR `__UNAUTHORIZED__` sentinel | none | unauthorized → sentinel | ✅ | No |
| 9. Render | `TruthReportClassic` | full_json | report | none | n/a | ✅ | No |

---

## 6. Last-Known-Good Baseline Comparison vs `625e931`

| Area | State |
|---|---|
| `phone_verifications.status` CHECK includes `expired` | ✅ Verified live |
| `verify-otp` fails closed on DB persistence error | ✅ Lines ~250 and ~295 |
| `verify-otp` sets `leads.phone_verified` + `phone_verified_at` | ✅ Lines ~277–286 |
| `verify-otp` binds `scan_session_id` on verified row | ✅ |
| `fire_crm_handoff` reads `phone_verified_at` | ✅ (older migration) |
| **Forward additions**: canonical event persistence, strict-binding `get_analysis_full`, dev-report-unlock | ✅ Present, none weaken security |

No regression vs `625e931`.

---

## 7. Root Cause Candidates (re-ranked for confirmed 504)

| Rank | Candidate | Evidence | How to verify | Scanner? | OTP? | Reveal? | Code later? |
|---|---|---|---|---|---|---|---|
| 1 | **Gemini extraction timeout + frontend has no recoverable-error UI** | Live DB row stuck in `processing`; no `analyses` row; `scan-quote` L1209–1246 returns 504 by design | Re-test scanner; check Edge Function logs for that session | ✅ | – | – | **Yes** (frontend) |
| 2 | No stale-`processing` sweeper | Row 12h+ stale | `select count(*) from scan_sessions where status='processing' and created_at < now() - interval '15 min'` | ✅ | – | – | Optional |
| 3 | Lovable live ≠ sandbox commit | Cannot inspect from here | Check Lovable History | ✅/⚠ | ⚠ | ⚠ | Republish |
| 4 | Gemini env var drift (`GEMINI_SCAN_TIMEOUT_MS` too tight, model swapped) | Conjecture | Check Supabase Functions → Secrets | ✅ | – | – | No |
| 5 | Twilio Verify env drift | None observed | Supabase secrets | – | ✅ | – | No |
| 6 | Browser stale state | Incognito test still failed → ruled out | – | – | – | – | – |
| 7 | Local Claude branch | No evidence | git log on desktop | – | – | – | – |

---

## 8. Verify-to-Reveal Integrity (with one caveat)

| Check | Status |
|---|---|
| Full report preloaded before auth? | No |
| Hidden by CSS only? | No |
| Exposed via dev-report-unlock in prod? | **Only if `DEV_BYPASS_SECRET` is set in prod env.** Code is gated; remove the secret from prod to neutralize. |
| `get_analysis_full` enforces strict scan-bound auth? | ✅ Verified — joins `phone_verifications` + `scan_sessions` + `leads`, requires `pv.status='verified' AND pv.scan_session_id=p_scan_session_id AND l.phone_verified=true` |
| Verified phone unlock another scan? | ✅ Blocked |
| Scanner timeout exposes data? | No — no analysis row to expose |
| **Realtime exposure** | ⚠️ **`analyses` and `scan_sessions` ARE in `supabase_realtime` publication.** RLS on `analyses` is `analyses_select_internal` (`is_internal_operator()` only) + `analyses_service_role_all`, which *should* prevent anon subscribers from receiving rows. But this combination — sensitive `full_json` in a Realtime-published table — is a documented foot-gun. Recommend removing `analyses` from the publication regardless. |

---

## 9. OTP / Twilio Integrity

OTP path is structurally intact. Confirmed:
- `send-otp` binds pending row to `scan_session_id` at send time.
- `verify-otp` only matches scan-bound or NULL-session-legacy pending rows; never silently rebinds across scans; explicit `[VERIFY_OTP_SESSION_MISMATCH]` guard.
- Both DB persistence paths (`phone_verifications` update, `leads` update) return 500 on failure.
- Canonical event ids returned to client for CAPI dedup.

**The confirmed user failure is pre-OTP.**

---

## 10. Security Warning Triage

| Warning | In repo? | In live Supabase? | Real / Noise | Severity | Related to 504? | Fix later |
|---|---|---|---|---|---|---|
| `dev-report-unlock` bypasses OTP | Yes | Function deployed | Real but secret-gated | Med (prod only if secret set) | No | Remove `DEV_BYPASS_SECRET` from prod env |
| `send-contractor-handoff` unauth | `verify_jwt=false` | Yes | Needs body-validation review | Med | No | Add caller auth/signed token |
| `analyses` in Realtime publication | n/a (managed via SQL) | **Yes — confirmed live** | Real foot-gun even with RLS | Med-High | No | `ALTER PUBLICATION supabase_realtime DROP TABLE public.analyses;` (separate migration) |
| `scan_sessions` in Realtime publication | n/a | **Yes — confirmed live** | Lower risk (no full_json) | Low-Med | No | Same — drop from publication |
| Routing RPCs exposing CRM secrets | Not found | – | Noise here | – | – | – |
| Broad storage UPDATE on `quotes` | Not inspected this pass | – | Possible | Med | No | Audit storage policies |
| Unauth `refresh-benchmarks` | `verify_jwt=false` | Yes | Real if mutating | Low-Med | No | Add cron-secret header |
| `create-checkout-session` GET diagnostic | Not inspected | – | Noise | – | – | – |
| `x-dev-secret` in OTP CORS allow-list | OTP functions do **not** list it | – | Noise for OTP | – | – | – |
| Public SECURITY DEFINER fns | `get_analysis_full` SECURITY DEFINER — authorizes internally | Yes | Intended | – | – | Keep |
| GraphQL exposure | Not enabled | – | – | – | – | – |

---

## 11. Recovery Plan (no implementation)

### Stage 1 — Confirm deployed state
1. Lovable → History panel: latest sandbox SHA + latest Published SHA + timestamps.
2. GitHub → `main` HEAD SHA.
3. Supabase dashboard → Functions → `scan-quote`, `verify-otp`, `send-otp`: "Last deployed" timestamps.
4. Supabase → Functions → Secrets: confirm `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `GEMINI_API_KEY`, `GEMINI_SCAN_MODEL`, `GEMINI_SCAN_TIMEOUT_MS` present (note current values).
5. Supabase → Logs → `scan-quote`: pull last 24h, find the entry for `d2e527bd-69a1-4ef4-96f1-7d46ef0fabc7` (currently no logs returned for that session — may have aged out or never logged).
6. Twilio Console → Verify logs: irrelevant for current 504 (pre-OTP).

### Stage 2 — Confirm scanner 504 cause
1. Re-run a scanner test in incognito with a small known-good PDF to isolate file-size/format effects.
2. SQL: `select count(*) from scan_sessions where status='processing' and created_at < now() - interval '15 minutes';` — if >0, sweeper is needed.
3. Inspect `GEMINI_SCAN_TIMEOUT_MS` value; if low (<60000ms) consider raising during recovery.
4. Repeat upload twice — does same `scan_session_id` reuse work?

### Stage 3 — Restore scanner health (future implementation, not now)
- Frontend: scanner-level `<ErrorBoundary>` with recoverable UI for 504 + `analysis_status:'processing'`.
- Frontend: "Still analyzing — retry" button that re-invokes `scan-quote` with the same `scan_session_id`.
- Optional: lightweight polling on the existing `scan_session_id` (same RPC contract).
- Backend: cron edge function to finalize stale `processing` rows older than N minutes to `error` / `needs_better_upload`.

### Stage 4 — OTP/report health
Not affected. No action required.

### Stage 5 — Security containment (separate work)
- Drop `analyses` and `scan_sessions` from `supabase_realtime` publication.
- Remove `DEV_BYPASS_SECRET` from production Supabase env.
- Audit `send-contractor-handoff` and `refresh-benchmarks` callers.

### Stage 6 — Rollback decision
**Do not rollback.** Forward-fix is correct. Rolling back to `625e931` would lose canonical event persistence, strict-binding `get_analysis_full`, and Phase 3/4 contractor pipeline migrations. The current failure is purely scanner UX/timeout handling — none of which the baseline addresses.

---

## 12. Do-Not-Touch List

- `supabase/functions/send-otp/index.ts`
- `supabase/functions/verify-otp/index.ts`
- `supabase/functions/scan-quote/index.ts` (until Stage 3 is approved)
- `public.get_analysis_full(uuid,text)`
- `public.phone_verifications` table + CHECK constraint
- `public.leads.phone_verified` / `phone_verified_at`
- Migration `20260428120000_restore_get_analysis_full_strict_scan_binding.sql`
- Twilio Verify config + secrets
- `quotes` storage bucket policies
- `usePhonePipeline.ts`, `phoneVerificationService.ts`, `VerifyGate.tsx`, `PhoneVerifyModal.tsx`
- Deterministic scoring under `scan-quote/scoring.ts`, `scan-quote/reportCompiler.ts`

---

## 13. Exact Next Implementation Prompt (use only after approval)

> **Scope: scanner timeout UX only. Do not touch OTP, verify-otp, send-otp, get_analysis_full, scoring, or RLS.**
>
> The backend `scan-quote` Edge Function currently returns HTTP 504 with body `{ error: "AI extraction timed out", analysis_status: "processing", scan_session_status: "processing" }` when Gemini extraction aborts. This is intentional — the `scan_session_id` is preserved so a retry can resume on the same session. The frontend currently treats this 504 as a fatal runtime error, producing a blank screen.
>
> Implement the smallest safe frontend change to convert this into a recoverable state:
>
> 1. In the scanner caller hook (likely `src/hooks/useGatedAIScanner.ts` or `src/hooks/useQuoteScanner.ts` — confirm by reading), branch on the `scan-quote` response:
>    - If `error` matches "AI extraction timed out" OR HTTP status is 504 with `analysis_status === 'processing'`, surface a recoverable-state object instead of throwing.
>    - Preserve `scan_session_id` in component state.
> 2. Add a local `<ErrorBoundary>` around the scanner subtree on `src/pages/Index.tsx` so any uncaught error renders a homeowner-safe fallback rather than a blank screen.
> 3. Render a recoverable-timeout UI (use existing design tokens — no inline styles, no new colors) with copy like "Still analyzing — this can take a moment. Try again." and a "Retry analysis" button that re-invokes `scan-quote` with the same `scan_session_id`.
> 4. Do not add a polling loop in this prompt — manual retry only.
> 5. Do not modify `scan-quote/index.ts`, `verify-otp`, `send-otp`, `get_analysis_full`, scoring, or any RLS/storage policies.
> 6. Do not introduce new packages.
>
> Verification:
> - In incognito, simulate the 504 by re-uploading and force a Gemini timeout (or use the existing dev fixture path that returns the same shape).
> - Confirm: no blank screen; recoverable UI shown; same `scan_session_id` reused on retry; OTP and reveal flows unchanged.
