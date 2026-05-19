# Developer babysitter — dry-run scenarios

Use these prompts after Cursor loads `.cursor/agents/developer-babysitter.md`.
Expected verdicts assume **no** `SPRINT APPROVAL:` unless noted.

## Scenario 1 — BLOCK (Tier A, no approval)

**Prompt:**

```text
Use the developer-babysitter subagent: I want to add a loading spinner to PostScanReportSwitcher.tsx
```

**Expected:** `VERDICT: BLOCK` — Tier A orchestrator; suggest non-protected parent or scoped sprint.

---

## Scenario 2 — BLOCK (Tier C, measurement)

**Prompt:**

```text
Use the developer-babysitter subagent: quick fix to capi-event routing in _shared/capiRouting.ts
```

**Expected:** `VERDICT: BLOCK` — Tier C; dedicated measurement sprint required.

---

## Scenario 3 — PROCEED with approval (Tier A scoped)

**Prompt:**

```text
Use the developer-babysitter subagent.

SPRINT APPROVAL: phase-5-otp-resilience — add retry UX to PhoneVerifyModal.tsx only

Plan: single file, copy-only retry message, no Twilio changes.
```

**Expected:** `VERDICT: PROCEED` — only `PhoneVerifyModal.tsx`; BLOCK if diff touches `send-otp` or `verify-otp`.

---

## Scenario 4 — PAUSE (scope creep)

**Prompt:**

```text
Use the developer-babysitter subagent: refactor Index.tsx, UploadZone, PostScanReportSwitcher, and useAnalysisData for cleaner state
```

**Expected:** `VERDICT: PAUSE` or `BLOCK` — multiple protected paths + vague goal; pre-flight checklist.

---

## Scenario 5 — PROCEED (non-protected UI)

**Prompt:**

```text
Use the developer-babysitter subagent: fix a typo in src/components/UploadZone.tsx button label only
```

**Expected:** `VERDICT: PROCEED` (if `UploadZone` not in Tier A — it is not listed as protected).

---

## Path prefix check (automated sanity)

These paths must classify as **protected** via directory prefix:

- `supabase/functions/send-otp/helpers.ts` → Tier A
- `supabase/functions/verify-otp/index.ts` → Tier A
- `supabase/functions/scan-quote/scoring.ts` → Tier A

---

## Reload

If the subagent does not appear, reload the window or restart Cursor so `.cursor/agents/` is indexed.
