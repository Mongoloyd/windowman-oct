# WindowMan — Sandbox / GitHub / Supabase Reconciliation Audit

Audit-only. No edits made. Protected systems untouched.

---

## 1. Sandbox / GitHub Sync

- **Repo (origin)**: `git.private.lovable-gcp.code.storage/781a03d7-2be6-4262-afc6-b26e850256c2.git` (Lovable-managed mirror) — **VERIFIED**
- **Active branch**: `edit/edt-f446164f-c0f6-410f-9426-8055597a44b2` (Lovable preview branch, normal) — **VERIFIED**
- **HEAD commit**: `95598900` — "Added cron secret guards" — **VERIFIED**
- **Working tree**: clean — zero modified, zero staged, zero untracked — **VERIFIED**
- **Sandbox-only changes**: none — **VERIFIED**
- **Update/Sync risk**: clicking Update would pull main into the preview branch; since the sandbox has no uncommitted local changes, nothing would be overwritten — **INFERRED** (Lovable internal sync state not directly inspectable)
- **Publish target**: would deploy commit `95598900` to `wmmvp.lovable.app` — **VERIFIED**

## 2. Supabase Binding

- **Frontend client**: `src/integrations/supabase/client.ts` — **VERIFIED**
- **URL**: `https://wkrcyxcnzhwjtdpmfpaf.supabase.co` (env `VITE_SUPABASE_URL`, fallback hardcoded to the same project) — **VERIFIED**
- **Project ref**: `wkrcyxcnzhwjtdpmfpaf` — matches expected — **VERIFIED**
- **Anon key**: `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY` (publishable, safe) — **VERIFIED**
- **No conflicting/wrong project URLs found in source** — **VERIFIED**
- **All `supabase` imports route through `@/integrations/supabase/client**` — **VERIFIED**

## 3. Scanner Spine Contract


| #   | Call                        | File                                        | Body / Params                                                                                                                                                                                                 | Status              |
| --- | --------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| A   | `start-upload-scan-session` | `src/components/UploadZone.tsx` L408        | `{ session_id, storage_path, file_name, file_size, file_type }` — storage upload happens before bootstrap; storage_path is `${session_id}/...`; response stores `scan_session_id`, `quote_file_id`, `lead_id` | **PASS — VERIFIED** |
| B   | `scan-quote`                | `UploadZone.tsx` L176                       | `{ scan_session_id, event_id }` — only fired after bootstrap success                                                                                                                                          | **PASS — VERIFIED** |
| C   | `get_analysis_preview`      | `services/reportService.ts` L42             | `{ p_scan_session_id }` — preview-only payload, no `full_json`                                                                                                                                                | **PASS — VERIFIED** |
| D   | `send-otp`                  | `services/phoneVerificationService.ts` L71  | `{ phone_e164, scan_session_id }` — single transport, no component-level invocations                                                                                                                          | **PASS — VERIFIED** |
| E   | `verify-otp`                | `services/phoneVerificationService.ts` L105 | `{ phone_e164, code, scan_session_id }` — verified phone preserved and forwarded to fetchFull                                                                                                                 | **PASS — VERIFIED** |
| F   | `get_analysis_full`         | `services/reportService.ts` L80             | `{ p_scan_session_id, p_phone_e164 }` — only invoked from `onVerified` or valid `verifiedAccess` resume                                                                                                       | **PASS — VERIFIED** |


## 4. Protected-Data Audit


| Check                                                            | Result           | Evidence                                                                                                                                  |
| ---------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Direct frontend select of `analyses.full_json` (homeowner)       | **PASS**         | Only references are RPC return shape, admin paths, and `dev/fixtures.ts` (cosmetic) — VERIFIED                                            |
| Direct frontend select of `analyses.flags` (homeowner)           | **PASS**         | Only via `get_analysis_full` RPC — VERIFIED                                                                                               |
| Direct frontend read from `phone_verifications`                  | **PASS**         | No `from("phone_verifications")` calls in homeowner code — VERIFIED                                                                       |
| Direct frontend write to verification state                      | **PASS**         | All writes go through `verify-otp` Edge Function — VERIFIED                                                                               |
| `dev-report-unlock` reachable in production                      | **PASS (gated)** | `reportService.fetchFullViaDevBypass` exists but is only invoked when `peekDevSecret()` returns a value; no production trigger — VERIFIED |
| `forceUnlock` / `mockFullReport` / `forcePreview` / fake success | **PASS**         | No matches in `src/` outside test/fixture files — VERIFIED                                                                                |
| Full report fetched before OTP                                   | **PASS**         | `fetchFull` only fires from `onVerified` callback or verifiedAccess resume token — VERIFIED                                               |
| CSS-only hiding of full data                                     | **PASS**         | Preview/full are separate payloads via separate RPCs — VERIFIED                                                                           |


## 5. Publish Readiness

- **SAFE_TO_CLICK_UPDATE**: YES
- **SAFE_TO_PUBLISH**: YES
- **CONFIDENCE**: HIGH (frontend + sandbox state); MEDIUM on live Edge Function bundle drift (cannot inspect deployed bundles from sandbox)
- **VERIFIED_BLOCKERS**: none
- **WARNINGS**:
  - `public.wm_event_log` table missing in live DB — canonical tracking inserts fail non-fatally in `scan-quote` and `verify-otp`. Scanner spine and reveal gate are unaffected.
  - Supabase migration history drift (prior audits) — not a publish blocker but should be reconciled.
  - CodeQL findings outstanding — not a publish blocker.
- **DO_NOT_TOUCH** (frozen):
  - `supabase/functions/start-upload-scan-session`
  - `supabase/functions/scan-quote`
  - `supabase/functions/send-otp`
  - `supabase/functions/verify-otp`
  - `src/services/reportService.ts`
  - `src/services/phoneVerificationService.ts`
  - `src/hooks/useAnalysisData.ts`
  - `src/hooks/usePhonePipeline.ts`
  - Supabase schema, RLS, storage policies, Twilio secrets/logic

## 6. Next Safe Sequence

1. Click **Update/Sync** (safe — clean tree, no local divergence).
2. Run one final **incognito** end-to-end: upload → preview → OTP → full reveal.
3. Open GitHub issue: "Create `public.wm_event_log` migration + reconcile migration history drift".
4. Repair CodeQL findings (separate PR).
5. Repair full Supabase migration history.
6. Re-run scanner E2E test after migration repair.
7. Reskin Truth Report UI (presentation-only PR).
8. Tag a checkpoint: `git tag scanner-spine-known-good-95598900`.
9. Reattempt one-CTA branching architecture.

---

## FINAL VERDICT:

**SAFE_TO_CLICK_UPDATE:** YES
**SAFE_TO_PUBLISH:** YES
**CONFIDENCE:** HIGH (frontend/sandbox), MEDIUM (live Edge bundle drift not directly inspectable)
**BLOCKERS:** none
**WARNINGS:** missing `public.wm_event_log` (non-fatal canonical-tracking inserts fail in `scan-quote` + `verify-otp`); migration history drift; outstanding CodeQL findings
**NEXT_ACTION:** Click Update/Sync, then run one incognito upload→OTP→reveal smoke test before pressing Publish.  
  
Proceed only with Update/Sync/Publish of the currently audited state.

This is not a code-generation task.

Do not generate code.

Do not modify files.

Do not apply fixes.

Do not refactor.

Do not modify Supabase schema, RLS, storage policies, or Edge Functions.

Do not modify scanner, OTP, reveal, reportService, useAnalysisData, phoneVerificationService, or usePhonePipeline.

Do not create a new branch unless Lovable requires it for the publish/update operation.

Do not introduce UI changes.

Only perform the Lovable Update/Sync/Publish action using the current audited commit/state.

After update/publish, report:

- deployed commit/hash

- whether any files changed

- whether protected files were untouched

- whether publish/update succeeded

- any warnings