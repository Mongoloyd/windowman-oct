# Canonical Measurement Architecture

> **Status:** Approved production policy. This is the single source of truth
> for browser ↔ server Meta measurement in the WindowMan repo. Future prompts
> and sprints MUST defer to this memo before touching any tracking code.
>
> **Companion memos:**
> - [`BROWSER_META_DECOUPLING_COMPLETE.md`](./BROWSER_META_DECOUPLING_COMPLETE.md) — historical reconciliation note
> - `.github/workflows/pageview-guardrail.yml` — CI guardrail
> - `supabase/functions/capi-event/index.test.ts` — regression tests
> - `scripts/pageview-dedupe-test.tsx` — runtime PageView proof

---

## 1. Status

WindowMan's measurement architecture is **intentionally split** between a
narrow browser layer and an authoritative server layer.

- **Browser Meta is allowed in one narrow form only:** a single
  WindowMan-controlled pixel firing `init` + `PageView`.
- **All conversion ownership remains server-side.** OTP-verified events,
  report-revealed events, leads, and purchases are emitted exclusively
  through the canonical server-side dispatch pipeline.
- This split is deliberate. It is not a transitional state. Do not collapse
  it without a dedicated, explicitly-scoped sprint.

---

## 2. Browser layer (narrow, top-of-funnel only)

### 2.1 What the browser layer does

| Behavior | Allowed | Notes |
|---|---|---|
| `fbq("init", VITE_META_PIXEL_ID)` | ✅ | One WindowMan-controlled pixel only. |
| `fbq("track", "PageView")` on initial mount | ✅ | Exactly once per page load. |
| `fbq("track", "PageView")` on SPA route change | ✅ | Exactly once per real route change. |
| Passive `_fbp` cookie support | ✅ | Seeded by Meta's pixel snippet. |
| Passive `_fbc` cookie via existing `fbclid` capture path | ✅ | Captured by `useUtmCapture` and persisted on the lead. |

### 2.2 What the browser layer is NOT

The browser layer is **not** a conversion ownership boundary. It exists only
to:

- seed `_fbp` and `_fbc` for downstream server-side match quality
- power top-of-funnel audience signal and PageView traffic
- give Meta enough first-party context to enrich the server-side events
  it later receives via CAPI

Conversions never originate in the browser. See §3.

### 2.3 Regression guardrails for the browser layer

- **Runtime proof:** `scripts/pageview-dedupe-test.tsx` (run via
  `vitest.proof.config.ts`) proves exactly one initial `PageView` and exactly
  one additional `PageView` per SPA route change.
- **CI guardrail:** `.github/workflows/pageview-guardrail.yml` enforces
  this proof on every change so the dedupe behavior cannot silently regress.

---

## 3. Server layer (authoritative conversion ownership)

### 3.1 Responsibilities

- Emit canonical business events (`lead`, `otp_verified`, `report_revealed`,
  etc.) from server-side code paths only.
- Dispatch enriched Meta events through `supabase/functions/capi-event` and
  the canonical mapper (`mapToMeta`).
- Guarantee match-quality enrichment for every event that has the data.
- Log every dispatch to `capi_signal_logs` with already-hashed PII for
  observability.

### 3.2 Match-quality rules (enforced in `capi-event`)

These rules are **load-bearing**. The recent double-hash defect proved that
silent breakage here destroys match quality without any visible failure.

1. **`_fbp` passes through unchanged** when present.
2. **`_fbc` passes through unchanged** when present (derived from
   previously-captured `fbclid`).
3. **`client_ip_address`** resolves from request headers in this exact
   precedence:
   1. `cf-connecting-ip`
   2. first hop of `x-forwarded-for` (whitespace-trimmed)
   3. `x-real-ip`
   4. fallback `0.0.0.0`
4. **`client_user_agent`** prefers a payload-provided value; otherwise it
   falls back to the request's `user-agent` header. If neither exists, the
   field is left undefined (do not invent one).
5. **Email (`em`) and phone (`ph`)** must be normalized + SHA-256 hashed
   server-side:
   - email: trim + lowercase
   - phone: strip all non-digits, then hash
6. **Pre-hashed values must NEVER be double-hashed.** A 64-character hex
   string in `em`, `ph`, or `external_id` is treated as already-hashed and
   forwarded as-is (lowercased). The canonical server-side dispatch lane
   (`mapToMeta`) hashes before calling `capi-event`; double-hashing silently
   destroys match quality.
7. **Hashed PII shape:**
   - `em` → single-element array of the lowercase hex hash
   - `ph` → single-element array of the lowercase hex hash
   - `external_id` → bare lowercase hex hash (not array)

### 3.3 Regression guardrails for the server layer

- `supabase/functions/capi-event/index.test.ts` locks all rules in §3.2 with
  27 focused Deno tests, including explicit anti-double-hashing assertions
  for `em`, `ph`, and `external_id`.
- These tests must be kept green. If a change to `capi-event` requires a
  test update, the change must be deliberate and reviewed against this memo.

---

## 4. Hard rules

### 4.1 Browser is forbidden from

- firing `Lead`
- firing `CompleteRegistration`
- firing `Purchase`
- firing OTP-verified events
- firing report-revealed events
- POSTing to `supabase/functions/capi-event` (or any equivalent endpoint)
- holding Meta access tokens, CAPI tokens, or any server-only secret
- multi-pixel browser routing (one pixel only, no client-routed pixel
  selection in the browser)
- expanding beyond `init` + `PageView` without a dedicated sprint that
  explicitly amends this memo

### 4.2 Server is forbidden from

- weakening any match-quality rule in §3.2
- reintroducing double-hashing of pre-hashed PII
- bypassing the canonical mapper for ad-hoc Meta calls
- emitting business conversions from anywhere other than the canonical
  server-side dispatch path

---

## 5. Protected areas

These files are protected. Tracking and measurement sprints **must not**
modify them as a side effect:

- `supabase/functions/verify-otp/**`
- `supabase/functions/send-otp/**`
- `src/components/post-scan/PostScanReportSwitcher.tsx`
- `src/components/TruthReportFindings/PhoneVerifyModal.tsx`
- `src/components/TruthReportFindings/VerifyGate.tsx`

Twilio code, configuration, and behavior are **off-limits** for measurement
work. Any change that requires touching Twilio or the OTP/reveal files must
be opened as a separate, explicitly-scoped sprint with its own approval.

---

## 6. Regression guardrails (summary)

| Surface | Guardrail | Location |
|---|---|---|
| Browser PageView dedupe | Runtime proof | `scripts/pageview-dedupe-test.tsx` + `vitest.proof.config.ts` |
| Browser PageView dedupe | CI enforcement | `.github/workflows/pageview-guardrail.yml` |
| Server `capi-event` hashing / fallback / pass-through | Deno tests (27 cases) | `supabase/functions/capi-event/index.test.ts` |
| Server `capi-event` runtime defect (no double-hash) | Asserted directly in tests | same |

Future prompts must not bypass, weaken, or delete these safeguards.

---

## 7. Audit instructions

When auditing the repo for tracking regressions, use this rubric:

### 7.1 Acceptable grep results (NOT regressions)

- `fbq("init", ...)` in the approved app-level pixel mount file
- `fbq("track", "PageView")` in the approved app-level pixel mount file
  and the SPA route-change effect
- references to `_fbp` / `_fbc` / `fbclid` in attribution capture code
- references to `capi-event` from server-side code only

### 7.2 Regressions (STOP and report)

- any `fbq("track", ...)` for an event other than `PageView`
- any browser `fetch` / `supabase.functions.invoke("capi-event", ...)` call
- any browser code reading or sending a Meta access token
- any new browser pixel ID beyond `VITE_META_PIXEL_ID`
- any server-side change that removes the `isSha256Hex` pre-hashed
  pass-through, the IP/UA fallback, or the `em`/`ph` array wrapping
- any disabled or deleted PageView CI guardrail or `capi-event` test

### 7.3 When to stop

- If a proposed change requires touching protected files (§5), STOP.
- If a proposed change requires broadening the browser pixel scope, STOP.
- If a proposed change weakens any §3.2 match-quality rule, STOP.

In all three cases, do not proceed inline — open a dedicated sprint with
an explicit amendment to this memo.

---

## 8. Operator instruction

For any future agent or operator working on tracking, measurement, or
related cleanup sprints:

1. **Do not broaden browser Meta casually.** `init` + `PageView` is the
   ceiling. Any expansion requires a dedicated sprint and an explicit
   amendment to this memo.
2. **Do not weaken server-side match quality.** The rules in §3.2 are
   load-bearing. Removing or simplifying any of them requires a dedicated
   sprint and a documented Meta business justification.
3. **Do not reintroduce double-hashing.** The `isSha256Hex` guard in
   `capi-event` exists because the canonical server-side dispatch lane
   pre-hashes PII. Removing the guard silently destroys match quality.
4. **Do not delete the approved browser PageView path** during future
   "browser Meta cleanup" sprints. The PageView-only pixel is intentional.
5. **Do not touch protected files** (§5) during tracking cleanup work.
   Open a dedicated, explicitly-scoped sprint instead.
6. **Do not delete or disable** the runtime PageView proof, the CI
   guardrail, or the `capi-event` regression tests. They are the only
   defense against silent regression of this architecture.
