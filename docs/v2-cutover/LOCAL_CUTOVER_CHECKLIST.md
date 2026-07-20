# V2 Local Cutover Checklist

Sequential checklist for local development and promotion of the V2 `/scan` funnel and `/report/forensic/:sessionId` dark forensic reveal.

**Scope:** Documentation and operator prep only. This checklist does **not** authorize edits to Edge Functions, migrations, RLS, storage policies, OTP/Twilio, `scan-quote`, CAPI, or report reveal authorization logic.

**Locked architecture** (from [`.lovable/plan.md`](../../.lovable/plan.md)):

| Route | Decision |
|-------|----------|
| `/` | Stays existing homepage (`src/pages/Index.tsx`) — no cutover |
| `/scan` | V2 intake + funnel (`PreUploadIntake` + production wiring) |
| `/report/forensic/:sessionId` | Dark forensic reveal (`ForensicAuditReport`) |
| `/report/classic/:sessionId` | Fallback until forensic QA passes |

---

## Operator blockers (complete before runtime QA)

These are **hard gates**. Do not run live funnel smoke on staging until all are done.

- [ ] **1. Create `.env.local`** from [`.env.example`](../../.env.example) (Vite loads `.env.local` over `.env`; keep secrets out of git).
- [ ] **2. Fill staging values:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` — all must point at the **staging** Supabase project.
- [ ] **3. Confirm staging project ref is not production.** `supabase/config.toml` uses local namespace `wm-mvp-forensic-v2-local` ([`supabase/config.toml`](../../supabase/config.toml)); staging `VITE_SUPABASE_PROJECT_ID` and URL hostname must **not** match legacy production ref `wkrcyxcnzhwjtdpmfpaf` unless you intentionally accept prod risk. See [SUPABASE_TARGETING.md](../ops/SUPABASE_TARGETING.md).
- [ ] **4. Confirm staging migrations match `main`.** Especially `get_analysis_full` strict scan binding (`20260428120000_restore_get_analysis_full_strict_scan_binding.sql`). Use [SUPABASE_STAGING_VERIFICATION.md](./SUPABASE_STAGING_VERIFICATION.md) and `scripts/validation/verify-schema-spec.ts` with staging `DATABASE_URL`.
- [ ] **5. Confirm staging Edge Function secrets** exist for real OTP/scan smoke: Twilio Verify (`TWILIO_*`), Gemini/scanner keys for `scan-quote`, and any other secrets required by the funnel functions. CAPI secrets are server-only; browser must not call `capi-event`.

**Typegen:** [`package.json`](../../package.json) `typegen` targets staging ref `<SUPABASE_PROJECT_REF>` per [SUPABASE_TARGETING.md](../ops/SUPABASE_TARGETING.md). Do not run typegen against legacy production unless explicitly approved.

---

## Phase 0 — Git and branch

- [ ] Checkout branch `forensic_report_v2` (staging work branch).
- [ ] `git status --short` is empty (clean working tree).
- [ ] Branch tracks `origin/forensic_report_v2` and is synced (`0` ahead / `0` behind remote).
- [ ] Understand divergence vs `origin/main`: run `git rev-list --left-right --count origin/main...HEAD` and `git diff --name-status origin/main...HEAD`. At cutover doc time, branch may match `main` byte-for-byte until V2 wiring lands.
- [ ] Do not commit `.env`, `.env.local`, or any file containing secrets ([`.gitignore`](../../.gitignore) blocks `.env*` except `.env.example`).

```bash
git branch --show-current
git status --short
git fetch origin
git rev-list --left-right --count origin/main...HEAD
```

---

## Phase 1 — Supabase staging branch

- [ ] Create or confirm a **Supabase database branch** (or dedicated staging project) separate from production.
- [ ] Record staging project ref in team vault (not in git): `STAGING_PROJECT_REF=____________`
- [ ] Apply same migration history as `main` on staging.
- [ ] Deploy Edge Functions to staging (read-only verification from this repo — do not modify function source during doc phase).
- [ ] Complete [SUPABASE_STAGING_VERIFICATION.md](./SUPABASE_STAGING_VERIFICATION.md) before wiring React.

---

## Phase 2 — Local environment safety

- [ ] Copy [`.env.example`](../../.env.example) → `.env.local`.
- [ ] Set only **publishable** (anon) key in frontend env — never service role in Vite env.
- [ ] Verify `npm run dev` loads staging: in browser DevTools → Network, Supabase host should contain **staging** project ref, not `wkrcyxcnzhwjtdpmfpaf`.
- [ ] Optional: set `VITE_META_PIXEL_ID` to a test pixel or leave unset per measurement policy.
- [ ] Do not enable prod `DEV_BYPASS` on staging unless deliberately testing dev unlock paths.

---

## Phase 3 — Deno CI hygiene (read-only on functions)

Edge Function **source must not change** during doc-only phase. Before any future PR that touches `supabase/functions/`:

- [ ] Locally (optional): `deno lint --compact supabase/functions/`
- [ ] Locally (optional): `deno fmt --check supabase/functions/`
- [ ] Locally (optional): per-file `deno check` as in [`.github/workflows/edge-functions-typecheck.yml`](../../.github/workflows/edge-functions-typecheck.yml)

CI workflows (trigger on `main` PRs):

- `edge-functions-lint.yml` — `deno lint`, `deno fmt --check`
- `edge-functions-typecheck.yml` — `deno check` on all function entrypoints

---

## Phase 4 — Type regeneration (staging only)

- [ ] **Skip** `npm run typegen` / `npm run typegen:check` unless you have confirmed the script targets your intended staging ref (see [SUPABASE_TARGETING.md](../ops/SUPABASE_TARGETING.md)).
- [ ] When staging ref is confirmed, run typegen **once** against staging:

```bash
npx supabase gen types typescript --project-id <STAGING_PROJECT_REF> > src/integrations/supabase/types.ts
```

- [ ] Then: `npm run typecheck` and `npm run build` (after implementation PRs only — not required for doc creation).

See [docs/db/TYPEGEN_WORKFLOW.md](../db/TYPEGEN_WORKFLOW.md).

---

## Phase 5 — Local smoke tests (after env + staging verification)

- [ ] `npm run test:critical` — OTP, analysis gate, UploadZone unit tests (no live Supabase required).
- [ ] `npm run typecheck` — if types were regenerated against staging.
- [ ] Manual happy path on **staging** env (see [FUNNEL_SUPABASE_CALL_MAP.md](./FUNNEL_SUPABASE_CALL_MAP.md)):
  - Intake → `capture-truth-gate-lead`
  - Upload to bucket `quotes` → `start-upload-scan-session` → `scan-quote`
  - Poll `get_scan_status` → `get_analysis_preview`
  - `send-otp` / `verify-otp` → `get_analysis_full`
- [ ] Do **not** treat `tests/golden-thread.spec.ts` as canonical scanner proof (legacy suite).
- [ ] `test:e2e:scanner-smoke` is a **TODO stub** in `package.json` — not implemented.

---

## Phase 6 — `/scan` route wiring checklist (implementation gate)

**Do not edit `src/App.tsx` or homepage `/` until explicitly approved for promotion.**

When implementing (future PR):

- [ ] Add lazy route `/scan` → new page shell (e.g. `ScanFunnelPage`) — **not** `Index`.
- [ ] Compose `PreUploadIntake` (V2 UI) with production backends mirroring `TruthGateFlow` + `UploadZone` + `ScanTheatrics` patterns from [`src/pages/Index.tsx`](../../src/pages/Index.tsx).
- [ ] Wrap in existing `ScanFunnelProvider` ([`src/state/scanFunnel.tsx`](../../src/state/scanFunnel.tsx)).
- [ ] Reuse hooks: `useAnalysisData`, `usePhonePipeline`, `useScanPolling`, `useReportAccess` — do not duplicate RPC/EF calls in components.
- [ ] Homepage `/` CTAs remain unchanged until promotion; optional later link to `/scan` is a **separate** promotion step.
- [ ] Dev-only harness stays: `/sandbox/intake`, `/sandbox/report-preview`.

---

## Phase 7 — `/report/forensic/:sessionId` wrapper checklist (implementation gate)

- [ ] Add route `/report/forensic/:sessionId` → new page (e.g. `ReportForensic.tsx`) — **does not exist yet**.
- [ ] `sessionId` param = `scan_sessions.id` (UUID); validate with [`src/lib/routeIdGuards.ts`](../../src/lib/routeIdGuards.ts).
- [ ] Data: `useAnalysisData` preview on mount; full only after OTP via `fetchFull(phoneE164)`.
- [ ] UI: `ForensicAuditReport` with `accessLevel="preview"` and **`flags=[]`** until full authorized.
- [ ] OTP slot: `PreviewUnlockSlot` + `usePhonePipeline` (`validate_and_send_otp` only unless architecture upgraded repo-wide).
- [ ] Fallback link to `/report/classic/:sessionId` for QA comparison.
- [ ] Never pass real `flags` or full pillar payloads before `get_analysis_full` succeeds.

---

## Phase 8 — OTP verification checklist

- [ ] OTP send: `phoneVerificationService.sendOtp(phoneE164, scanSessionId)` → Edge Function `send-otp`.
- [ ] OTP verify: `verifyOtp(phoneE164, code, scanSessionId)` → `verify-otp`.
- [ ] Full fetch: RPC `get_analysis_full(p_scan_session_id, p_phone_e164)` only after verify success.
- [ ] Unauthorized sentinel: RPC returns `grade = '__UNAUTHORIZED__'` → client maps to `unauthorized` (see [`src/services/reportService.ts`](../../src/services/reportService.ts)).
- [ ] Resume: `wm_verified_access` in localStorage (24h) + `tryResume()` in `useAnalysisData` — UX hint only; server re-checks every time.
- [ ] Do not weaken cross-unlock: OTP must bind to the same `scan_session_id`.

---

## Phase 9 — QA and promotion

- [ ] Complete [QA_MATRIX.md](./QA_MATRIX.md) on staging.
- [ ] Forensic reveal QA passes; classic fallback still works.
- [ ] PR from `forensic_report_v2` → `main` with route changes only after QA sign-off.
- [ ] Production deploy: update env on host (Netlify/etc.) — separate from staging `.env.local`.
- [ ] Rollback plan: remove `/scan` and `/report/forensic` routes; revert CTAs; classic route remains.

---

## References

- Canonical live path audit: [docs/sprints/phase-0-repo-truth-audit.md](../sprints/phase-0-repo-truth-audit.md) (note: UploadZone section may predate `start-upload-scan-session` — prefer [FUNNEL_SUPABASE_CALL_MAP.md](./FUNNEL_SUPABASE_CALL_MAP.md)).
- Table access: [docs/db/TABLE_ACCESS_MODEL.md](../db/TABLE_ACCESS_MODEL.md)
- AGENTS.md / claude.md guardrails at repo root (`AGENTS.md` is canonical; `claude.md` is supporting).
