# Canonical Tracking Rules — forensic_report_v2

**Status:** Active guardrail (repo-grounded cold-start audit, 2026-06-30)  
**Audience:** Cursor agents, humans touching protected tracking / vendor dispatch  
**Scope:** Field casing, `client_slug`, Meta mapping authority, event ID dedupe, stop-and-report gates

This document is the **canonical rules-of-engagement** reference. It does **not** authorize fixes for known gaps listed in §8. Those require explicit sprint approval.

---

## 1. Branch Truth

| Item | Value |
|------|-------|
| **Source branch** | `forensic_report_v2` |
| **Canonical baseline** | `origin/forensic_report_v2` |
| **Baseline commit (audit)** | `5bf10f7c928e9d231425193fcb483239731ec0ed` |

**Rule:** All protected tracking work must start from a **clean working tree** on the expected branch with **local HEAD verified against `origin/forensic_report_v2`** before edits.

```powershell
git branch --show-current
git status --short
git rev-parse HEAD
git rev-parse origin/forensic_report_v2
```

If branch is wrong or working tree is dirty → **STOP AND REPORT** (do not proceed).

---

## 2. Field Casing Rules

The repo uses **layer-specific casing**. This is intentional, not drift.

### Snake_case (persistence / attribution layer)

Use for:

- Database columns
- Supabase insert/update payloads (1:1 with columns)
- `attribution` / `query_params` JSON keys
- Persisted `wm_event_log.event_id` column
- Vendor-facing logs and SQL

**Canonical field names:**

- `lead_id`
- `session_id`
- `scan_session_id`
- `client_slug`
- `event_id`

### CamelCase (typed TypeScript API layer)

Use for:

- Canonical event **input** interfaces (`CreateCanonicalEventInput`, etc.)
- `payload.identity` / `payload.journey` sub-objects as defined in repo `types.ts`
- React state and typed function parameters where the repo already uses camelCase

**Canonical field names:**

- `leadId`
- `sessionId`
- `scanSessionId`
- `eventId`
- `clientSlug` (TS input only; persists as `client_slug`)

### Boundary rule — convert, do not globally rewrite

> **Do not globally rewrite camelCase → snake_case or snake_case → camelCase.**  
> Keep each style inside its layer and **convert at the boundary**.

**Correct boundary patterns (from production code):**

```typescript
// supabase/functions/_shared/tracking/canonical/createCanonicalEvent.ts
lead_id: input.leadId ?? normalizedIdentity.leadId ?? null,
scan_session_id: input.scanSessionId ?? input.payload.journey.scanSessionId ?? null,
client_slug: resolvedClientSlug,
event_id: canonicalEvent.eventId,
```

```typescript
// supabase/functions/_shared/emitLeadActivity.ts — TS input leadId → DB lead_id
lead_id: leadId,
```

**Wrong (drift risk):**

- Writing `leadId` into a Supabase insert object that maps to `leads.lead_id`
- Writing `lead_id` into a `CreateCanonicalEventInput` without a typed migration plan
- Mixing `sessionId` in a JSON payload field the repo expects as `session_id` (or vice versa) without boundary conversion

### Vendor mapper output

Use **mapper-defined field names only** (e.g. Meta `em`/`ph`/`external_id`, Nextdoor `click_id`). Do not invent aliases.

---

## 3. client_slug Rules

### Canonical capture source

| File | Role |
|------|------|
| [`src/lib/useUtmCapture.ts`](../../src/lib/useUtmCapture.ts) | Primary attribution capture; defines `CLIENT_SLUG_KEYS` and fallback chain |

### Accepted URL aliases

Captured from query params (first non-empty wins among):

- `client_slug`
- `client`
- `partner`
- `syndicate`

### Fallback chain (organic / general traffic)

```
URL param (CLIENT_SLUG_KEYS) → localStorage["wm_client_slug"] → "direct"
```

Implemented in `useUtmCapture.ts` (required fallback order documented in source).

### Truth Gate submit resolution

[`src/components/TruthGateFlow.tsx`](../../src/components/TruthGateFlow.tsx):

```
funnel?.clientSlug ?? ?client= query param ?? utm.client_slug ?? localStorage ?? null
```

### Nextdoor handoff

[`src/lib/nextdoor/attributionHelpers.ts`](../../src/lib/nextdoor/attributionHelpers.ts) **strips `direct`** from handoff URLs:

```
stored.client_slug !== "direct" ? stored.client_slug : null
```

### Routing / dispatch usage

| Layer | Rule |
|-------|------|
| Lead insert | `client_slug` column (snake_case) |
| `wm_event_log` | Resolved via `createCanonicalEvent.resolveClientSlug` (lead → scan_session → analysis fallback) |
| Dispatch worker | `resolveVerifiedClientSlug`; null slug → Nextdoor suppression `nextdoor_missing_client_slug` |

### Acceptability

| Value | Organic/direct traffic | Paid Nextdoor dispatch |
|-------|------------------------|-------------------------|
| Real tenant slug (e.g. `acme-windows`) | OK | **Required** |
| `"direct"` | OK (intended fallback) | **Not acceptable** |
| `null` | Risky; may fail dispatch | **Not acceptable** |

### STOP condition

**STOP if paid Nextdoor code resolves to `client_slug=null` or `client_slug="direct"` without explicit sprint approval.**

Known repo location (audit finding — not permission to fix):

- [`src/services/nextdoorLeadCapture.ts`](../../src/services/nextdoorLeadCapture.ts) — submits `client_slug: null` on the paid Nextdoor path.

---

## 4. Meta Mapping Rules

### Production-authoritative file

```
supabase/functions/_shared/tracking/canonical/mapToMeta.ts
```

Imported by the **edge** dispatch worker:

```
supabase/functions/_shared/tracking/canonical/dispatchWorker.ts
```

This is what runs in production when `dispatch-platform-events` processes Meta rows.

### Mirror / test file (parity only)

```
src/lib/tracking/canonical/mapToMeta.ts
```

Imported by the **frontend mirror** dispatch worker and unit tests. Must stay in sync with the Supabase authoritative file when Meta mapping changes are approved.

### Editing rules

1. **Do not edit only the mirror.** Any approved Meta mapping change must update the Supabase authoritative file first, then the mirror.
2. **Do not touch Meta mapping if Meta is out of scope** for the current sprint.
3. **`lead_captured` is currently unmapped** in `META_EVENT_MAP` (both files). Worker suppresses with `no_meta_mapping`. Fixing this requires **explicit sprint approval** — not implicit permission from this document.

### Related docs

- [`PLATFORM_MAPPER_RULES.md`](./PLATFORM_MAPPER_RULES.md) — suppress conditions and payload shape (note: lists `src/` paths; edge `_shared/` paths are authoritative at runtime)

---

## 5. Event ID / Dedupe Rules

### Canonical source

| Item | Rule |
|------|------|
| **Authoritative ID** | `wm_event_log.event_id` (snake_case column) |
| **DB uniqueness** | `wm_event_log_event_id_key UNIQUE (event_id)` |
| **Server generator** | `defaultCreateId()` in `supabase/functions/_shared/tracking/canonical/createCanonicalEvent.ts` |
| **Browser parity generator** | `buildCanonicalEventId()` in `src/lib/tracking/canonicalEventId.ts` |

### ID format (default server formula)

```
wmc_{eventName}_{entitySegments}_{timeBucket}
```

Truth-gate `lead_captured` uses an explicit deterministic override:

```
wmc_lead_captured_lead-{leadId}_session-{sessionId}
```

(passed as `eventId` into `persistCanonicalEvent` from `capture-truth-gate-lead`)

### Platform dispatch dedupe

- `wm_platform_dispatch_log` rows key on `(event_log_id, platform_name)`.
- Vendor payloads must **reuse the parent canonical `event_id`** (Meta `event_id`, Google `transaction_id`, etc.).
- **No random event IDs per retry** — retries reuse the same canonical ID.
- Duplicate insert on `wm_event_log.event_id` is recovered idempotently; do not mint a new ID on retry.

### Forbidden without approval

- New `event_id` formulas outside `defaultCreateId` / `buildCanonicalEventId` / existing approved overrides (e.g. truth-gate `lead_captured` pattern)
- Regenerating `event_id` downstream after initial persist

### Boundary casing

- DB / JSON persistence: `event_id`
- TypeScript canonical API: `eventId`
- Convert at boundary (same pattern as `lead_id` / `leadId`)

---

## 6. Mandatory Stop-and-Report Guardrails

Stop immediately and report (do not implement around the block):

1. **STOP** if branch is not `forensic_report_v2` (or the explicitly approved feature branch).
2. **STOP** if working tree is dirty before starting protected work.
3. **STOP** if the change would modify generated types (`src/integrations/supabase/types.ts`) or `supabase/migrations/` without explicit approval.
4. **STOP** if new code uses `leadId` / `sessionId` / `scanSessionId` / `clientSlug` where the **target layer is snake_case** (DB insert, persisted JSON key).
5. **STOP** if new code uses `lead_id` / `session_id` inside a **repo-defined camelCase TS input** without boundary conversion.
6. **STOP** if `client_slug` source cannot be verified against §3.
7. **STOP** if paid Nextdoor resolves to `client_slug=null` or `client_slug="direct"` without explicit approval.
8. **STOP** if Meta mapping is touched while Meta is out of scope for the sprint.
9. **STOP** if only the `src/lib/.../mapToMeta.ts` mirror is edited without updating the Supabase authoritative file.
10. **STOP** if a new `event_id` formula is introduced outside approved helpers (§5).
11. **STOP** if PII enters `dataLayer`, console logs, URL params, or vendor-facing logs.
12. **STOP** if acquisition/tracking code calls scanner / upload / OTP / report internals (Verify-to-Reveal boundary).

When stopped, produce a **Drift Report** classifying findings: `CANONICAL`, `ACCEPTED_LAYER_DIFFERENCE`, `LEGACY_BUT_SAFE`, `DRIFT_RISK`, `STOP_AND_REPORT_REQUIRED`.

---

## 7. Validation Commands Before Commit

Run before every commit touching tracking or dispatch surfaces. **PowerShell-safe.**

```powershell
git branch --show-current
git status --short

# camelCase — expected in TS APIs; fail only on NEW wrong-layer usage
git grep -nE "\bleadId\b|\bsessionId\b|\bclientSlug\b" -- src supabase ":!node_modules" ":!dist" ":!build"

# snake_case — expected in DB/payload; fail only on NEW wrong-layer usage
git grep -nE "\blead_id\b|\bsession_id\b|\bclient_slug\b" -- src supabase ":!node_modules" ":!dist" ":!build"

# dedupe / canonical id integrity
git grep -nE "event_id|eventId|dedupe|dedup|wm_event_log_event_id|wmc_" -- src/lib/tracking supabase/functions ":!node_modules" ":!dist" ":!build"

# no direct browser vendor calls / client-side CAPI misuse
git grep -nE "fbq\(|ttq\(|gtag\(|snaptrk\(|pintrk\(|capi-event" -- src supabase/functions ":!node_modules" ":!dist" ":!build"

# protected surfaces must be empty unless explicitly approved
git diff -- .env .env.local .env.production supabase/migrations src/integrations/supabase/types.ts
git diff --name-only
git diff --cached --name-only
```

### Interpretation rule

> **Do not fail merely because camelCase exists.**  
> Fail only when **new or modified** code violates the layer-specific rules in §2–§5.

---

## 8. Known Current Gaps (Stop-and-Report — Not Implicit Fix Permission)

These were confirmed on `forensic_report_v2` at baseline `5bf10f7c`. They are **documentation of risk**, not approval to fix.

| # | Gap | Location | Classification |
|---|-----|----------|----------------|
| 1 | Paid Nextdoor capture submits `client_slug: null` | `src/services/nextdoorLeadCapture.ts` | **STOP_AND_REPORT_REQUIRED** — worker suppresses `nextdoor_missing_client_slug` |
| 2 | `lead_captured` missing from `META_EVENT_MAP` | `supabase/functions/_shared/tracking/canonical/mapToMeta.ts` (+ mirror) | **DRIFT_RISK** — Meta worker suppresses `no_meta_mapping` |
| 3 | Dual canonical trees must stay in sync | `supabase/functions/_shared/tracking/` vs `src/lib/tracking/canonical/` | **ACCEPTED_LAYER_DIFFERENCE** — edit both when approved |

Fixing gaps 1–2 requires explicit sprint approval (e.g. `SPRINT APPROVAL: vendor-dispatch — lead_captured Meta map + Nextdoor client_slug`) and developer-babysitter pre-flight for Tier A–D paths per [`.cursor/PROTECTED_FILES.md`](../../.cursor/PROTECTED_FILES.md).

---

## Backend Protection (This Document Does Not Authorize)

This guardrail does **not** permit:

- `supabase db push` / `supabase db reset`
- New migrations or generated type changes
- Edge Function deploys or secret changes
- GTM / CAPI / server-side tracking config changes
- Submitting lead data or invoking dispatch workers
- Calling vendor CAPI endpoints or scan/OTP/report endpoints

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [CANONICAL_IDENTITY_GLOSSARY.md](./CANONICAL_IDENTITY_GLOSSARY.md) | Target meanings for intake/measurement IDs (proposed — read before route matrix work) |
| [CANONICAL_INTAKE_ROUTE_MATRIX.md](./CANONICAL_INTAKE_ROUTE_MATRIX.md) | Current → target intake surfaces measured against the glossary (proposed — no implementation authority) |
| [EVENT_OWNERSHIP_MODEL.md](./EVENT_OWNERSHIP_MODEL.md) | Two-lane tracking (business vs operational) |
| [CANONICAL_EVENT_FOUNDATION.md](./CANONICAL_EVENT_FOUNDATION.md) | `wm_event_log` / dispatch foundation |
| [DISPATCH_WORKER_RUNBOOK.md](./DISPATCH_WORKER_RUNBOOK.md) | Worker lifecycle and SQL checks |
| [PLATFORM_MAPPER_RULES.md](./PLATFORM_MAPPER_RULES.md) | Mapper suppress rules |
| [docs/START_HERE.md](../START_HERE.md) | Task router for protected areas |

---

## Quick Reference — Layer Cheat Sheet

```
┌─────────────────────────┬──────────────────────────────────────────┐
│ Layer                   │ Casing / authority                       │
├─────────────────────────┼──────────────────────────────────────────┤
│ Postgres / Supabase row │ snake_case                               │
│ attribution JSON keys   │ snake_case                               │
│ TS canonical input      │ camelCase (convert at boundary)          │
│ payload.identity        │ camelCase (repo types)                   │
│ wm_event_log.event_id   │ snake_case column; TS: eventId           │
│ Meta map (production)   │ supabase/.../mapToMeta.ts                │
│ Meta map (mirror)       │ src/lib/.../mapToMeta.ts (sync only)     │
│ client_slug capture     │ useUtmCapture.ts → fallback "direct"     │
└─────────────────────────┴──────────────────────────────────────────┘
```
