# V2 Staging QA Matrix

Run on **staging** Supabase with `.env.local` pointing at staging (not production `wkrcyxcnzhwjtdpmfpaf`).

**Routes under test:**

- `/scan` (after implementation)
- `/report/forensic/:sessionId` (after implementation)
- `/report/classic/:sessionId` (existing fallback)

**Confirm unchanged:** `/` homepage behavior and production routes until explicit promotion.

---

## Operator blockers (before this matrix)

- [ ] `.env.local` created from `.env.example` with staging URL, publishable key, project ID
- [ ] Staging project ref confirmed ≠ production
- [ ] Staging migrations match `main`
- [ ] Twilio + Gemini/scanner secrets on staging for live OTP/scan tests
- [ ] Do not run `npm run typegen` against production

---

## Definition of done (every row)

From AGENTS.md / claude.md (AGENTS.md is canonical):

- [ ] Full report not sent to client before SMS verification
- [ ] Scores from deterministic TypeScript (`scan-quote`), not client-side AI
- [ ] Quote files in private `quotes` bucket only
- [ ] RLS unchanged by V2 frontend work
- [ ] Forensic UI never shows real `flags` / full pillar data before `get_analysis_full` succeeds

---

## Matrix legend

| Column | Meaning |
|--------|---------|
| **Steps** | Minimal reproduction |
| **Expected backend** | Authoritative server behavior |
| **Expected UI** | User-visible outcome |
| **Pass** | Checkbox when verified on staging |

---

## A. Route smoke (happy path)

| ID | Scenario | Steps | Expected backend | Expected UI | Pass |
|----|----------|-------|------------------|-------------|------|
| A1 | `/scan` full funnel | Intake → upload PDF → wait → OTP → reveal | `capture-truth-gate-lead` → storage `quotes` → `start-upload-scan-session` → `scan-quote` → `get_analysis_preview` → OTP EFs → `get_analysis_full` | Forensic preview then full bands | |
| A2 | Forensic deep link | Open `/report/forensic/:scanSessionId` with valid UUID | Preview RPC without OTP; full only after verify | Preview locked; unlock works | |
| A3 | Classic fallback | From forensic, open `/report/classic/:sameId` | Same RPCs | Classic report renders; same grade | |
| A4 | Classic-only link | Open `/report/classic/:id` cold | Preview + OTP path | Works without visiting `/scan` | |
| A5 | Legacy redirect | `/report/:id` | N/A | 302/Navigate to `/report/classic/:id` | |

---

## B. Refresh and navigation

| ID | Scenario | Steps | Expected backend | Expected UI | Pass |
|----|----------|-------|------------------|-------------|------|
| B1 | Refresh before upload | Start `/scan`, fill partial intake, F5 | No `scan_sessions` yet | Restore intake or clear state per design | |
| B2 | Refresh after upload, before OTP | Complete upload, F5 on `/scan` | `scan_sessions` + `analyses` exist | Resume scan session from funnel storage **or** explicit re-entry UX | |
| B3 | Refresh during OTP | Send code, F5 | `phone_verifications` pending row | OTP UI recoverable with same `scan_session_id` | |
| B4 | Refresh after verified full | Complete OTP, F5 forensic URL | `get_analysis_full` succeeds with stored phone | Full report without re-OTP if `wm_verified_access` valid | |
| B5 | Back button | Preview → browser back | No extra full fetch | No full data flash; no flags leak | |
| B6 | Mobile viewport | Repeat A1 at 375px width | Same | Usable intake, upload, OTP, scroll | |

---

## C. File and upload failures

| ID | Scenario | Steps | Expected backend | Expected UI | Pass |
|----|----------|-------|------------------|-------------|------|
| C1 | Invalid file type | Upload non-PDF/image if restricted | Storage or client reject | Validation message; no scan session | |
| C2 | Oversized file | Upload over limit | Storage 413 or client guard | Clear error; retry | |
| C3 | Storage upload fails | Simulate offline / policy deny | No `start-upload-scan-session` success | `storage_upload_failed` retry UI | |
| C4 | Session create fails | Break EF or invalid `storage_path` | `{ success: false }` | Stay on upload; retry | |
| C5 | Invalid quote content | Upload non-quote PDF | `scan-quote` → `invalid_document` or `needs_better_upload` | Terminal error state; no fake grade | |

---

## D. Scan and preview failures

| ID | Scenario | Steps | Expected backend | Expected UI | Pass |
|----|----------|-------|------------------|-------------|------|
| D1 | Scan timeout | Slow/hung scan (or mock) | Poll exhausts `maxPolls` | Timeout message; no infinite spinner | |
| D2 | Preview fetch fails | RPC error / no row | No preview data | Loading/error; no grade hallucination | |
| D3 | Missing analysis | Valid session, no `analyses` row | Preview null | Empty/error state | |
| D4 | `unreadable` / `failed` status | Corrupt scan | Terminal status from `get_scan_status` | Safe fallback copy | |

---

## E. OTP and authorization

| ID | Scenario | Steps | Expected backend | Expected UI | Pass |
|----|----------|-------|------------------|-------------|------|
| E1 | Wrong OTP | Enter bad code | `verify-otp` failure | Invalid code message | |
| E2 | Expired OTP | Wait past TTL / stale session | expired_session class | Resend prompt | |
| E3 | Resend OTP | Resend after cooldown | New `phone_verifications` pending | Code resent; rate limit respected | |
| E4 | Wrong phone on full reveal | Verify phone A, call full with phone B | `get_analysis_full` → `__UNAUTHORIZED__` | Stays locked; no full_json | |
| E5 | Verified user refresh | E4 opposite: valid resume | `get_analysis_full` OK | Full forensic without re-entering code | |
| E6 | Cross-session unlock | OTP on session A, open forensic URL for session B | Unauthorized full | No cross-unlock | |
| E7 | Forensic never preloads flags | Inspect network before OTP | Only `get_analysis_preview` | No `flags` array in preview; UI `flags=[]` | |

---

## F. Security and data boundaries

| ID | Scenario | Steps | Expected backend | Expected UI | Pass |
|----|----------|-------|------------------|-------------|------|
| F1 | No public quote URL | Copy storage path; open unauthenticated | 403 / no public URL | Cannot read PDF | |
| F2 | No direct `analyses` SELECT | Anon client query table | RLS deny | N/A (devtools) | |
| F3 | Preview RPC redaction | Call `get_analysis_preview` | No `full_json` in response | Teaser only | |
| F4 | CAPI not in browser | Use app normally | No `capi-event` from client | Network tab clean | |

---

## G. Regression — production paths

| ID | Scenario | Steps | Expected backend | Expected UI | Pass |
|----|----------|-------|------------------|-------------|------|
| G1 | Homepage `/` unchanged | Visit `/` on staging build without V2 promotion | Existing Index flow | Truth Gate + upload still on `/` | |
| G2 | Classic report still works | Full classic path on staging | Unchanged RPC/EF | No regression vs pre-V2 | |

---

## Automated test reference

| Suite | Use for V2? |
|-------|-------------|
| `npm run test:critical` | Yes — unit-level OTP, UploadZone, analysis gate (CI-safe) |
| `tests/golden-thread.spec.ts` | **No** — legacy; not canonical scanner path |
| `test:e2e:scanner-smoke` | **Not implemented** (TODO in package.json) |

Future: add Playwright suite mocking `get_analysis_preview` / `get_analysis_full` (see `tests/otp-resend.spec.ts`, `tests/session-isolation.spec.ts`).

---

## Sign-off

| Role | Name | Date | Staging ref used |
|------|------|------|------------------|
| Engineering | | | |
| QA | | | |

All **Pass** boxes required before promoting `/scan` and `/report/forensic/:sessionId` in `App.tsx` or changing homepage CTAs.

---

## Related

- [LOCAL_CUTOVER_CHECKLIST.md](./LOCAL_CUTOVER_CHECKLIST.md)
- [FUNNEL_SUPABASE_CALL_MAP.md](./FUNNEL_SUPABASE_CALL_MAP.md)
- [SUPABASE_STAGING_VERIFICATION.md](./SUPABASE_STAGING_VERIFICATION.md)
