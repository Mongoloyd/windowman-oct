# Measurement Operator Runbook

> **Companion to:** [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md) and [`BROWSER_META_DECOUPLING_COMPLETE.md`](./BROWSER_META_DECOUPLING_COMPLETE.md)

---

## 1. Purpose

This runbook is for **operators, measurement engineers, and on-call reviewers** who need to verify, inspect, or troubleshoot WindowMan's Meta measurement stack in staging or production.

**This runbook IS for:**
- Diagnosing why Meta Events Manager looks wrong
- Confirming the browser pixel is firing correctly (and *only* what's allowed)
- Confirming server-side `capi-event` is preserving match-quality fields
- Choosing between a quick fix vs. a dedicated sprint

**This runbook IS NOT for:**
- Designing new tracking events (see canonical architecture memo)
- Modifying OTP, reveal, or protected runtime files
- Adding new browser-side conversion logic (forbidden)
- Twilio, send-otp, verify-otp, or reveal-flow troubleshooting

**Audience:** measurement architects, on-call backend engineers, QA reviewers.

---

## 2. Current Approved Architecture (One-Page Summary)

| Layer | Allowed | Forbidden |
|---|---|---|
| **Browser Meta** | `fbq("init", VITE_META_PIXEL_ID)` once, `fbq("track", "PageView")` on initial mount + each SPA route change | Any conversion event (`Lead`, `CompleteRegistration`, `Purchase`, `SubmitApplication`, `Schedule`); calling `/functions/v1/capi-event` directly |
| **Server-side (`capi-event`)** | All conversion ownership; passes through `_fbp`/`_fbc`; normalizes + hashes raw PII; preserves pre-hashed values | Double-hashing pre-hashed `em`/`ph`/`external_id`; dropping IP/UA fallback |
| **Identity (`_fbp` / `_fbc`)** | `_fbp` seeded by browser pixel; `_fbc` derived from `fbclid` query param when present; both forwarded server-side for match quality | — |
| **Protected files** | Read-only during measurement work | Editing `verify-otp`, `send-otp`, `PostScanReportSwitcher`, `PhoneVerifyModal`, `VerifyGate` |

---

## 3. Quick Health Checklist

Run through this list first when something looks off.

- [ ] `VITE_META_PIXEL_ID` env var is present in the deployed bundle
- [ ] `window.fbq` is defined on a fresh page load
- [ ] **Exactly one** browser `PageView` fires on initial mount
- [ ] **Exactly +1** browser `PageView` fires per SPA route change (no duplicates, no zero)
- [ ] No browser-side `Lead`, `CompleteRegistration`, `Purchase`, `SubmitApplication`, or `Schedule` events appear in the Network tab
- [ ] No browser-side `fetch`/`XHR` to `/functions/v1/capi-event`
- [ ] `_fbp` cookie is set on first PageView
- [ ] `_fbc` cookie is set when the page was reached via a `?fbclid=...` URL
- [ ] PageView guardrail CI is green on `main`
- [ ] `capi-event` guardrail CI is green on `main`
- [ ] Meta Events Manager shows server events with `event_source_url`, `client_ip_address`, `client_user_agent`, and at least one of (`fbp`, `fbc`, hashed `em`, hashed `ph`)

If every box is checked, the stack is healthy. If any box fails, jump to the relevant section below.

---

## 4. How to Verify Browser-Side Behavior

### 4a. DevTools — Network tab

1. Open the site in an incognito window with DevTools → **Network** open.
2. Filter by `facebook.com/tr` (the pixel endpoint).
3. **On initial load:** you should see exactly **one** request whose query string contains `ev=PageView`.
4. **Click an internal link** (any SPA route change). You should see exactly **one more** `ev=PageView` request.
5. **You should NOT see** any of:
   - `ev=Lead`
   - `ev=CompleteRegistration`
   - `ev=Purchase`
   - `ev=SubmitApplication`
   - `ev=Schedule`
6. **You should NOT see** any browser-originated request to `/functions/v1/capi-event`.

### 4b. DevTools — Console

```js
// Confirm fbq is present and the pixel ID is wired in
typeof window.fbq             // → "function"
window.fbq.queue              // → array (instrumentation queue)

// Inspect the cookies that drive match quality
document.cookie.split(";").map(c => c.trim()).filter(c => c.startsWith("_fb"))
// Expected on a normal session: ["_fbp=fb.1.<ts>.<rand>"]
// Expected when arriving via fbclid: ["_fbp=...", "_fbc=fb.1.<ts>.<fbclid>"]
```

### 4c. What is normal vs. abnormal

| Symptom | Normal? | Action |
|---|---|---|
| 1 `PageView` on load, +1 per route change | ✅ Normal | None |
| 0 `PageView` on load | ❌ Regression | Check `VITE_META_PIXEL_ID`, then run the PageView proof |
| 2+ `PageView` on load | ❌ Regression | Likely double-mount; run PageView proof and review router |
| Any browser conversion event | ❌ Regression | Stop. Open dedicated sprint. Do **not** patch in place. |
| Browser call to `capi-event` | ❌ Regression | Stop. Open dedicated sprint. Conversion ownership must stay server-side. |
| `_fbp` missing on PageView | ⚠️ Investigate | Confirm pixel init ran before first PageView |
| `_fbc` missing without `fbclid` in URL | ✅ Normal | None — `_fbc` only seeds when `fbclid` is present |
| `_fbc` missing **with** `fbclid` in URL | ❌ Regression | Verify pixel init order; check for cookie blockers |

---

## 5. How to Verify Server-Side Behavior

### 5a. Where to inspect

- **Edge Function logs:** Supabase → Functions → `capi-event` → Logs
- **Edge Function source:** `supabase/functions/capi-event/index.ts`
- **Regression tests:** `supabase/functions/capi-event/index.test.ts`
- **Meta Events Manager:** Test Events tab (use `test_event_code`) and Overview tab

### 5b. Required fields per dispatched event

A healthy outbound CAPI payload's `user_data` block should include, when available:

| Field | Source | Notes |
|---|---|---|
| `em` | hashed email | 64-char SHA256 hex; never double-hashed |
| `ph` | hashed phone | digit-normalized then SHA256; never double-hashed |
| `external_id` | hashed lead/user id | 64-char SHA256 hex; never double-hashed |
| `fbp` | request payload | passed through unchanged |
| `fbc` | request payload | passed through unchanged |
| `client_ip_address` | header fallback | precedence: `cf-connecting-ip` → `x-forwarded-for` (first hop) → `x-real-ip` → `0.0.0.0` |
| `client_user_agent` | payload, then `user-agent` request header | falls back to request header if payload omits it |

### 5c. Double-hash symptoms

If pre-hashed identifiers are being **double-hashed**, you will see one or more of:

- Meta Events Manager match-quality score drops sharply (often to ~3/10)
- Match rates collapse for known returning users
- Hashes in logs change between identical inputs (the second hash is non-deterministic relative to the first)
- A 64-char hex value enters `capi-event` and a *different* 64-char hex value leaves

**Verification:** the `isSha256Hex` guard in `buildHashedUserData()` short-circuits when the input is already a 64-char hex string. Run the regression suite to confirm:

```bash
deno test --allow-net --allow-env supabase/functions/capi-event/index.test.ts
```

All 27 tests must pass. If any of the "pre-hashed pass-through" tests fail, the double-hash defect has regressed.

### 5d. Pass-through symptoms (healthy)

- `fbp` value entering the function appears byte-identical in the outbound Meta payload
- `fbc` value entering the function appears byte-identical in the outbound Meta payload
- A pre-hashed `em` enters and exits unchanged
- A raw email enters and exits as `sha256(email.trim().toLowerCase())`
- A raw phone enters and exits as `sha256(phone.replace(/\D/g, ""))`

---

## 6. Interpreting Meta Events Manager Discrepancies

| Symptom in Events Manager | Likely root cause | First check |
|---|---|---|
| Browser `PageView` present but **no server conversion** | Server-side dispatch failed or was never invoked | Check `capi-event` Edge Function logs for the matching `event_id` |
| Conversion present but **weak match quality** (low score) | `fbp`/`fbc` not being forwarded, or PII not hashed correctly | Inspect `user_data` in `capi-event` logs; confirm hashed fields are 64-char hex |
| **Duplicated** events (browser + server both counted) | A browser conversion event was reintroduced (forbidden) | Run grep checks in §7; if any browser conversion fires, escalate |
| Missing `_fbc` but `fbclid` was in URL | Browser pixel init ran *after* the route change, so `_fbc` was never seeded | Confirm pixel init is in app shell, not lazy-loaded |
| Missing `_fbp` entirely | Cookie blocked, pixel never initialized, or `VITE_META_PIXEL_ID` missing in build | Inspect bundle for the env var; check cookie consent layer |
| Server event with `client_ip_address: "0.0.0.0"` | All four header sources missing (likely a misconfigured proxy) | Inspect raw request headers in Edge Function logs |
| Server event missing `client_user_agent` | Payload omitted UA *and* request had no `user-agent` header | Rare; usually a bot or misconfigured caller |

---

## 7. Canonical Repo Verification Commands

These are the **single source of truth** for "is the stack still correct?"

### 7a. PageView guardrail (browser)

```bash
npm run typecheck
npm run build
npm run proof:pageview
```

Enforced in CI by `.github/workflows/pageview-guardrail.yml`.

### 7b. `capi-event` regression suite (server)

```bash
deno check supabase/functions/capi-event/index.ts
deno test --allow-net --allow-env supabase/functions/capi-event/index.test.ts
```

Enforced in CI by `.github/workflows/capi-event-guardrail.yml`.

### 7c. Grep patterns — forbidden browser Meta behavior

Run from repo root. **Each of these should return zero matches in `src/`** (excluding the single approved init/PageView call site).

```bash
# Forbidden browser-side conversion events
grep -rEn "fbq\\(['\"]track['\"],\\s*['\"](Lead|CompleteRegistration|Purchase|SubmitApplication|Schedule)['\"]" src/

# Forbidden browser-side capi-event calls
grep -rEn "/functions/v1/capi-event" src/

# Forbidden direct Meta access tokens in browser code
grep -rEn "META_ACCESS_TOKEN|FACEBOOK_ACCESS_TOKEN" src/
```

Any non-empty result is a regression. Stop and escalate per §8.

### 7d. Grep patterns — sanity-check the allowed surface

These **should** return matches (the one approved init/PageView site):

```bash
grep -rEn "fbq\\(['\"]init['\"]" src/
grep -rEn "fbq\\(['\"]track['\"],\\s*['\"]PageView['\"]" src/
```

---

## 8. Escalation Rules

Use this matrix to decide whether you can fix something inline or must open a dedicated sprint.

| Situation | Action |
|---|---|
| PageView count is wrong (0 or 2+) on load | Safe inline fix in app shell / router; re-run PageView proof |
| Forbidden browser conversion event detected | **Stop. Open dedicated sprint.** Do not patch in place. |
| Browser-side call to `capi-event` detected | **Stop. Open dedicated sprint.** Conversion ownership is server-side only. |
| `capi-event` test failing for double-hash | Restore the `isSha256Hex` guard in `buildHashedUserData()`; do not modify tests to pass |
| `fbp`/`fbc` no longer pass through unchanged | Tiny inline fix in `capi-event`; re-run regression suite |
| IP/UA fallback regressed | Tiny inline fix in `extractClientIp()` or UA fallback block |
| Need to add a new conversion event | **Open dedicated sprint** — coordinate event taxonomy, server dispatch, and CI coverage |
| Need to broaden browser Meta beyond PageView | **Open dedicated sprint** — requires architecture review |
| Issue lives in a protected file (`verify-otp`, `send-otp`, `PostScanReportSwitcher`, `PhoneVerifyModal`, `VerifyGate`) | **Open dedicated scoped sprint.** Never touch as collateral cleanup. |
| Twilio behavior is involved | **Open dedicated sprint.** Twilio is off-limits to measurement work. |

---

## 9. Do-Not-Do List

- ❌ Do **not** reintroduce browser-side conversion ownership
- ❌ Do **not** call `/functions/v1/capi-event` from the browser
- ❌ Do **not** broaden browser Meta beyond `init` + `PageView`
- ❌ Do **not** add a second browser pixel without a dedicated architecture sprint
- ❌ Do **not** weaken server-side match-quality rules (hashing, IP/UA fallback, `fbp`/`fbc` pass-through)
- ❌ Do **not** double-hash pre-hashed identifiers; preserve the `isSha256Hex` guard
- ❌ Do **not** touch protected OTP/reveal files during measurement work
- ❌ Do **not** modify Twilio code, secrets, or behavior
- ❌ Do **not** modify the regression tests to make a failing build pass
- ❌ Do **not** disable or skip the PageView or `capi-event` CI guardrails

---

## 10. References

- [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md) — single source of truth for the architecture
- [`BROWSER_META_DECOUPLING_COMPLETE.md`](./BROWSER_META_DECOUPLING_COMPLETE.md) — historical record of the browser/server split
- `supabase/functions/capi-event/index.ts` — server-side dispatcher
- `supabase/functions/capi-event/index.test.ts` — 27 regression tests
- `.github/workflows/pageview-guardrail.yml` — browser CI guardrail
- `.github/workflows/capi-event-guardrail.yml` — server CI guardrail
