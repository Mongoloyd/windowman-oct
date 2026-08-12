# Canonical Identity Glossary — Lead Intake & Measurement

**Status:** Proposed — operator review requested
**Implementation authority:** None
**Audience:** Engineers, measurement operators, agents touching lead intake, tracking, or schema
**Scope:** Browser identity, persisted lead identity, intake orchestration IDs, scanner lifecycle IDs, and their relationship to authorization and vendor dispatch

> **Architectural precedence:** This glossary defines **target meanings**. The route/event matrix, executable audit checklist, and protected implementation sprint must measure and implement **against these definitions** — not against today's inconsistent runtime names.
> **Subordinate to:** [AGENTS.md](../../AGENTS.md), [VERIFY_TO_REVEAL_CONTRACT.md](../reveal/VERIFY_TO_REVEAL_CONTRACT.md), [CANONICAL_MEASUREMENT_ARCHITECTURE.md](../measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md), [EVENT_OWNERSHIP_MODEL.md](./EVENT_OWNERSHIP_MODEL.md), [.cursor/PROTECTED_FILES.md](../../.cursor/PROTECTED_FILES.md)
> **Does not authorize:** schema migrations, Edge Function deploys, `AppTrackingProvider` edits, or new browser conversion events without an explicit named sprint.

---

## 1. Why this document exists

WindowMan currently uses overlapping names for different identity concepts:

| Runtime name today | File | Actual behavior today | Target concept |
|---|---|---|---|
| `getLeadId()` / `wm_lead_id` | `src/lib/useLeadId.ts` | Persistent anonymous browser profile UUID | **`visitor_id`** |
| `lead_id` in pre-capture dataLayer | `src/lib/tracking/dataLayer.ts` | Copied from `getLeadId()` before any lead exists | **Drift — must not equal `public.leads.id`** |
| `sessionId` (component state) | `src/pages/CampaignNQ/useCampaignNqCapture.ts` | New UUID per component mount | **`session_id`** — should be tab-scoped, centrally owned |
| `wm_first_quote_session_id` | `src/services/windowmanFirstQuoteLeadCapture.ts` | Tab-scoped sessionStorage UUID | **`session_id`** — correct scope, wrong owner/key |
| `public.leads.id` | Postgres `gen_random_uuid()` | Server-created lead row | **`lead_id`** |
| `scan_session_id` | `public.scan_sessions.id` | Quote upload / scanner lifecycle | **`scan_session_id`** — separate domain |

Conflating **visitor** and **lead** makes deduplication, consent withdrawal, shared-device behavior, and privacy retention materially harder. This glossary locks the separation before any route matrix or migration work proceeds.

---

## 2. Non-negotiable identity law

1. **`visitor_id` must not map to `public.leads.id`.**
2. **`lead_id` identifies one persisted lead** — returned only after successful server persistence.
3. **`visitor_id` identifies an anonymous browser profile** — may relate to zero, one, or many leads over time.
4. **`session_id` identifies one browser visit** — not OTP authorization, not report authorization, not Supabase Auth.
5. **`scan_session_id` identifies one quote upload / scanner lifecycle** — server-bound; never interchangeable with `session_id`.
6. **None of these IDs grants OTP, full-report reveal, or Supabase Auth authorization.** Backend authorization remains authoritative per [VERIFY_TO_REVEAL_CONTRACT.md](../reveal/VERIFY_TO_REVEAL_CONTRACT.md).

---

## 3. Canonical ID glossary

| ID | Canonical meaning | Scope & TTL | Authoritative storage | Created by | Persisted when |
|---|---|---|---|---|---|
| **`visitor_id`** | Optional anonymous browser-profile UUID for cross-visit correlation where privacy/consent policy permits | Cross-visit; **proposed 90-day rolling TTL** (policy-gated) | First-party browser storage (`localStorage` + cookie when permitted); copied into versioned capture metadata when permitted | Browser bootstrap (future: dedicated helper; **not** `public.leads.id`) | Capture submit + canonical event metadata when permitted |
| **`lead_id`** | Server-created identity of **one persisted lead** | Durable per lead-retention policy | `public.leads.id` (UUID, Postgres-generated) | **`capture-truth-gate-lead`** (or approved server writers) on successful insert/reuse response | Always on successful lead persistence |
| **`session_id`** | One **tab-instance site visit** | Survives SPA navigation and reload within that tab instance; ends on tab close or **proposed 30-minute inactivity rotation**. **D4:** `sessionStorage` copy-on-duplicate is **not** uniqueness — clone detection required before D3. | **`sessionStorage` + tab-instance ID** (target); `public.leads.session_id` (persistence) | **`AppTrackingProvider`** (target owner) | Lead capture submit; canonical server events |
| **`capture_attempt_id`** | One opening of an intake UI (modal, inline form, multi-step host) | Created on open; stable across retries within that open; **new UUID after close/reopen** | React state until submit; then consent + capture metadata | **Intake host** (`UniversalIntakeHost`, TruthGate shell, etc.) | Consent `submission_id`; `lead_capture_metadata.initial_capture_attempt_id`; event log |
| **`landing_visit_id`** | One mount of a landing-page experience | Created on landing mount; ends on unmount/navigation away from landing host | React/context for visit lifetime | **Landing-page host** | Capture metadata + event log on submission |
| **`scan_session_id`** | Server-created quote upload / scanner lifecycle | Separate from marketing visit; durable per quote/analysis retention | `public.scan_sessions.id` | **`start-upload-scan-session`** (trusted upload flow) | Upload bootstrap only — **not** created by landing-page lead capture |

### Field casing at boundaries

| Layer | Casing | Examples |
|---|---|---|
| Postgres / Supabase payloads | `snake_case` | `lead_id`, `session_id`, `scan_session_id`, `visitor_id` |
| TypeScript canonical event input | `camelCase` | `leadId`, `sessionId`, `scanSessionId` |
| dataLayer (sanitized) | `snake_case` | Same as persistence |

Convert at the boundary. Do not globally rename layers. See [CANONICAL_TRACKING_RULES.md](./CANONICAL_TRACKING_RULES.md) §2.

---

## 4. Ownership matrix (target architecture)

```text
AppTrackingProvider
  → owns session_id (tab-scoped visit UUID)

Landing-page host
  → owns landing_visit_id (per landing mount)

Intake host
  → owns capture_attempt_id (per modal/form open)

Route adapter
  → maps route-specific answers into canonical payload
  → does NOT mint competing session_id sources

capture-truth-gate-lead
  → validates payload
  → atomically creates or reuses lead
  → persists consent (keyed by lead_id + submission_id + purpose)
  → persists lead_capture_metadata (initial capture identity — no overwrite on reuse)
  → records canonical server event (when enabled)

Successful response
  → returns lead_id + session_id
  → enables post-success UI dataLayer only (lead_magnet_captured, etc.)
```

### Non-OTP landing pages

- Continue using **`capture-truth-gate-lead`** — do not add another browser INSERT path.
- Persist leads with **`phone_verified = false`** and all reveal fields locked.
- Store route-specific answers in **versioned `query_params` / metadata** — not ad hoc scalar sprawl.
- **Never** treat `lead_id + session_id` as OTP or report authorization.
- Create **`scan_session_id` only** when the separate trusted upload flow begins.

---

## 5. Session & lead deduplication decision

### Target invariant

**One browser visit (`session_id`) → at most one canonical lead (`lead_id`).**

This matches the **intended** behavior of `capture-truth-gate-lead` session lookup:

```724:731:supabase/functions/capture-truth-gate-lead/index.ts
  // ── Idempotency: lookup existing lead bound to this session_id ───────────
  // If found, reuse it. Do not insert a duplicate. Do not update OTP /
  // verified state. Do not overwrite PII in this pass.
  try {
    const { data: existing, error: lookupErr } = await admin.rpc(
      "get_lead_by_session",
      { p_session_id: payload.session_id },
```

### Tab-scoped visit session (recommended)

| Property | Decision |
|---|---|
| Storage key | Canonical visit key may live in `sessionStorage` for reload survival (replace per-route keys like `wm_first_quote_session_id`) |
| Shared across | `/nq`, `/nq2`, `/nq3`, `/nq4`, `/windowman`, `/quote-check`, and other browser intake routes **in the same tab instance** |
| Survives | SPA navigation, reload **in that tab instance** |
| Separate across | **Not guaranteed by `sessionStorage` alone.** Duplicate-tab / opener copy can clone `sessionStorage`. **D4:** mint a tab-instance ID regenerated in copied tabs (clone detection) before using `session_id` as a D3 lead-dedup boundary. |
| Rotates | Tab close; **proposed** 30-minute inactivity timeout (**D1** unresolved) |
| Explicit reset | Product-intentional “start new journey” only |

### Repo evidence for current fragmentation

| Route / surface | Current session source | Aligns with target? |
|---|---|---|
| `/nq` | Component-memory UUID per mount — `useCampaignNqCapture.ts:30` | **No** — not tab-stable |
| `/nq2` | Component-memory UUID per mount — `useCampaignNq2Capture.ts:31` | **No** — independent of `/nq` |
| `/nq3`, `/nq4` | Shared `sessionStorage` — `windowmanFirstQuoteLeadCapture.ts:21` | **Partial** — tab-scoped, but copy-on-duplicate (D4) and wrong owner/key |
| `/quote-check` and magnet landings | Per-page `sessionIdRef` — e.g. `PricingSearchLanding.tsx:100-107` | **No** — mount-scoped memory |
| TruthGate / `/` | `ScanFunnelProvider.sessionId` in `localStorage` | **No** — cross-tab, different semantics |
| Arbitrage intake | In-memory ref per funnel | **No** — explicit exception or adopt envelope |

### Safe migration prerequisites (implementation sprint — not authorized here)

1. **Audit** existing duplicate `leads.session_id` rows.
2. **Reconcile** legitimate duplicates (support, QA, race artifacts).
3. **Add** unique constraint/index on `leads.session_id` (if invariant accepted).
4. **Replace** lookup-then-insert with **one atomic** database operation; concurrent callers receive the same `lead_id`.
5. **Keep** consent idempotency keyed independently: `lead_id + submission_id + purpose`.
6. **Do not** treat a raw `sessionStorage` key as the D3 uniqueness boundary until **D4** clone detection (or a regenerated tab-instance ID) is specified and accepted.

**Alternative (if product requires multiple leads per visit):** Do **not** make `session_id` unique. Use **`capture_attempt_id`** (or dedicated idempotency key) as the lead-creation dedupe key instead. That is a different product contract — choose explicitly before schema work.

---

## 6. Capture metadata (target schema)

Store a **versioned, sanitized, non-PII** snapshot on the lead row — proposed column: `lead_capture_metadata JSONB`.

```json
{
  "schema_version": "1",
  "initial_capture_attempt_id": "uuid",
  "landing_visit_id": "uuid",
  "route": "/nq4",
  "variant": "number_to_beat",
  "entry_point": "hero_primary"
}
```

### Rules

- **Write once** on first successful insert — **do not overwrite** `initial_*` fields on reused leads.
- Later attempts belong in **append-only** consent history and canonical event log — not by mutating initial capture identity.
- **No PII** in this blob (names, email, phone belong in typed columns / consent tables only).
- If a separate **`capture_attempts`** table is introduced: server-writable only, explicit RLS/grants, **no anonymous browser access** (Supabase Data API defaults require explicit grants for new public tables).

---

## 7. Lifecycle event envelope (UI lane)

All intake UI events share one **sanitized** payload shape:

| Field | When present |
|---|---|
| `session_id` | Always |
| `capture_attempt_id` | Always |
| `landing_visit_id` | When landing host exists |
| `lead_id` | **Post-server-success only** |
| `route` | Always (normalized path, not hardcoded) |
| `variant` | When applicable |
| `entry_point` | CTA / modal entry identifier |
| `attribution` | Sanitized snapshot from `getAttributionPayload()` — **no raw PII** |

### Event meanings

| Event | Fires when | Authority |
|---|---|---|
| `lead_capture_opened` | Intake becomes visible | UI |
| `lead_capture_started` | First meaningful interaction | UI — once per attempt |
| `form_fields_completed` | Full **client** validation passes | UI — once per attempt |
| `lead_capture_completed` | Server confirms durable persistence | **Server-confirmed only** — UI may mirror after API success |
| `lead_magnet_captured` | Existing business signal after capture API success | UI dataLayer — **never** for client-only completion |

### StrictMode deduplication (UI events)

Dedupe key:

```text
event_name + landing_visit_id + capture_attempt_id
```

Use in-memory + `sessionStorage` fallback (same pattern as `pushTruthGateViewedOnce` / `pushLeadMagnetCaptured`).

### Vendor dispatch

- Platform conversion dispatch keys off **canonical server events** — not UI lifecycle events.
- Proposed `wmc_lead_captured_lead-{leadId}_session-{sessionId}` format exists in `capture-truth-gate-lead` but is **gated** behind `CANONICAL_LEAD_CAPTURED_ENABLED`. **Do not adopt broadly** until reconciled with existing `defaultCreateId()` / `buildCanonicalEventId()` and [EVENT_OWNERSHIP_MODEL.md](./EVENT_OWNERSHIP_MODEL.md) ownership.

---

## 8. Route & ingestion exceptions

| Surface | Receives global IDs | Creates lead | Emits `lead_capture_completed` | Notes |
|---|---|---|---|---|
| **Standard non-OTP landings** | `session_id`, `landing_visit_id`, `capture_attempt_id` | Yes — via `capture-truth-gate-lead` | After server success only | Target contract |
| **`/scan`** | `session_id`, `landing_visit_id` | **No** on route/modal open | **Never** from `/scan` prototype path | Prototype modal is UI-only. Prototype **upload** may call `start-upload-scan-session` **without** `lead_id` (`useRealScanBridge.ts:201-213`). Excluded from the homepage trusted-lead upload rule until an authorized `/scan` intake sprint. |
| **Arbitrage intake** | Adopt shared envelope **or** document explicit exception | Via `capture-arbitrage-lead` (feature-gated) | Server path only | Currently **no** dataLayer — see `useIntakeCapture.ts` |
| **Partner / native ingestion** | **Do not fabricate** browser session IDs | Via `ingest-native-lead` etc. | Server only | Preserve platform lead IDs + server-generated ingestion identity |
| **OTP / reveal downstream** | Uses real **`scan_session_id`** | N/A | Separate security lifecycle | `verify-otp`, report-access — not intake |

---

## 9. Legacy naming drift (baseline — do not extend)

These are **documented drifts** against the target glossary. The route matrix should list each as a **Gap**.

| Location | Drift | Target remediation |
|---|---|---|
| `src/lib/useLeadId.ts` | Module named “lead ID”; stores `wm_lead_id` | Rename concept to **`visitor_id`**; decouple from `public.leads.id` |
| `src/lib/tracking/dataLayer.ts:86-87` | Sets both `visitor_id` and `lead_id` from `getLeadId()` | `lead_id` in dataLayer **only after server returns `lead_id`** |
| `AppTrackingProvider` | Exposes `leadId` from `useLeadId()` | Add **`session_id`**; rename exported visitor concept |
| `ScanFunnelProvider` | Persists marketing `sessionId` in **`localStorage`** (cross-tab) | Migrate visit session to **`AppTrackingProvider` / sessionStorage** |
| Consent payloads | `submissionId` ≈ `capture_attempt_id` | Standardize naming; same UUID, explicit mapping |
| `public.leads.session_id` | `TEXT NOT NULL`, no unique index | Add uniqueness after duplicate audit (if invariant accepted) |
| `get_lead_by_session` RPC | `LIMIT 1` lookup — race not atomic | Replace with atomic upsert path under sprint |

---

## 10. Authorization reminder

| Capability | Authoritative signal | **Not** sufficient |
|---|---|---|
| Full Truth Report reveal | Backend report-access after OTP | `lead_id`, `session_id`, funnel localStorage |
| OTP send / verify | `verify-otp` + session binding | Contact form success alone |
| Quote file access | Signed URL / backend session | Marketing `session_id` |
| Admin / contractor views | Supabase Auth + RLS | Homeowner intake IDs |

---

## 11. Protected implementation boundary

This glossary crosses **Tier B** (schema, migrations) and **Tier C** (measurement owners):

| Owner | Tier | Examples |
|---|---|---|
| `AppTrackingProvider.tsx` | C | Central `session_id` |
| `capture-truth-gate-lead/index.ts` | C | Protected measurement owner; schema/RPC changes it depends on are separately Tier B |
| Migrations | B | `lead_capture_metadata`, `session_id` uniqueness |
| Intake hosts | UI / C when emitting measurement | ID binding; lifecycle dataLayer events cross the Tier C measurement boundary |

**Requires:** named sprint approval + `developer-babysitter` pre-flight per [PROTECTED_FILES.md](../../.cursor/PROTECTED_FILES.md).

---

## 12. Next artifacts (prescribed order)

1. ✅ **Canonical ID glossary** — this document
2. ✅ **Current → Target route/event matrix** — [CANONICAL_INTAKE_ROUTE_MATRIX.md](./CANONICAL_INTAKE_ROUTE_MATRIX.md) (proposed; no implementation authority)
3. ⬜ **Executable audit checklist** — tests the matrix against this contract
4. ⬜ **Migration plan + protected implementation sprint** — schema, provider, intake hosts, Edge Function atomicity — only after operator sign-off on glossary + matrix decisions D1–D4

---

## 13. Related documents

| Document | Relationship |
|---|---|
| [CANONICAL_INTAKE_ROUTE_MATRIX.md](./CANONICAL_INTAKE_ROUTE_MATRIX.md) | Current → target surface matrix measured against this glossary (proposed) |
| [EVENT_OWNERSHIP_MODEL.md](./EVENT_OWNERSHIP_MODEL.md) | Business vs operational event owners |
| [CANONICAL_TRACKING_RULES.md](./CANONICAL_TRACKING_RULES.md) | Casing, event ID dedupe, known gaps |
| [CANONICAL_MEASUREMENT_ARCHITECTURE.md](../measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md) | Browser vs server measurement policy |
| [VERIFY_TO_REVEAL_CONTRACT.md](../reveal/VERIFY_TO_REVEAL_CONTRACT.md) | OTP/reveal authorization |
| [ADR-003](../adr/ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md) | Mandatory OTP policy |
| [ADR-005](../adr/ADR-005-server-minted-quote-intake-capability.md) | Proposed `/scan` server-minted intake (not implementation authority) |

---

## 14. Evidence appendix (repo baseline)

| Claim | Evidence |
|---|---|
| `/nq` session in component memory | `src/pages/CampaignNQ/useCampaignNqCapture.ts:30` — `useState(createUuid)` |
| `/nq2` session in component memory | `src/pages/CampaignNQ2/useCampaignNq2Capture.ts:31` — `useState(createUuid)` |
| `/quote-check` session in page ref | `src/pages/PricingSearchLanding.tsx:100-107` |
| `/nq3`, `/nq4` tab sessionStorage | `src/services/windowmanFirstQuoteLeadCapture.ts:21,78-98` |
| Lead UUID server-generated | `supabase/migrations/20260317051701_bdf3572f-5d3e-4662-b4db-31d55ae58ece.sql:3-4` |
| Session lookup idempotency (non-atomic) | `supabase/functions/capture-truth-gate-lead/index.ts:724-731` |
| Universal intake `capture_attempt_id` + `landing_visit_id` | `src/components/intake/universal/UniversalIntakeHost.tsx:133,152` |
| Visitor/lead conflation in dataLayer | `src/lib/tracking/dataLayer.ts:68-87` |
| `/scan` prototype — no persistence | `src/components/scan/LeadCaptureModal.tsx:1-5` |
| Scanner IDs not from landing capture | `scan_session_id` created in upload bootstrap — separate from lead intake services |

---

## Operator sign-off

| Field | Value |
|---|---|
| Decision owner | _pending_ |
| Review date | _pending_ |
| Accepted / rejected | _pending_ |
| Sprint name (if accepted) | _pending_ |

When accepted, promote this document to **CANONICAL** in [DOC_STATUS_REGISTRY.md](../ops/DOC_STATUS_REGISTRY.md) and add a row to [START_HERE.md](../START_HERE.md) task router.
