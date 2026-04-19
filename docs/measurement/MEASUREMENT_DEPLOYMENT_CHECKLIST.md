# Measurement Deployment Checklist

> One-page QA gate for WindowMan's Meta measurement stack.
> Long-form context: [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md) · [`MEASUREMENT_OPERATOR_RUNBOOK.md`](./MEASUREMENT_OPERATOR_RUNBOOK.md)

---

## When to use

- ☐ **Before launch** — pre-deploy gate
- ☐ **After deploy** — production smoke test
- ☐ **Staging verification** — quick sanity pass
- ☐ **Triage** — Meta Events Manager / GTM looks off

---

## 1. Browser checks

Open prod/staging in an incognito window with DevTools → Network (filter `facebook.com/tr`).

- ☐ `VITE_META_PIXEL_ID` present in deployed bundle
- ☐ `typeof window.fbq === "function"` on initial load
- ☐ Pixel initializes **once** (no duplicate init)
- ☐ **Exactly 1** `ev=PageView` request on initial load
- ☐ **Exactly +1** `ev=PageView` per SPA route change
- ☐ `_fbp` cookie present after first PageView
- ☐ `_fbc` cookie present **when** URL contains `?fbclid=...`
- ☐ **Zero** browser conversion events (`Lead`, `CompleteRegistration`, `Purchase`, `SubmitApplication`, `Schedule`)
- ☐ **Zero** browser requests to `/functions/v1/capi-event`

---

## 2. Server checks

Inspect Supabase → Functions → `capi-event` → Logs (or Meta Events Manager → Test Events).

- ☐ `capi-event` returns 2xx for recent dispatches
- ☐ `fbp` passes through unchanged when present in payload
- ☐ `fbc` passes through unchanged when present in payload
- ☐ Hashed `em` present (64-char hex) for events with email
- ☐ Hashed `ph` present (64-char hex) for events with phone
- ☐ Hashed `external_id` present (64-char hex) where expected
- ☐ Pre-hashed inputs **not** double-hashed (input hex == output hex)
- ☐ `client_ip_address` populated (not `0.0.0.0`) — header chain healthy
- ☐ `client_user_agent` populated — falls back to request `user-agent` when payload omits it

---

## 3. Repo proof / CI checks

- ☐ `npm run typecheck` — green
- ☐ `npm run build` — green
- ☐ `npm run proof:pageview` — green
- ☐ `deno test --allow-net --allow-env supabase/functions/capi-event/index.test.ts` — all 27 pass
- ☐ CI workflow `pageview-guardrail` — green on `main`
- ☐ CI workflow `capi-event-guardrail` — green on `main`
- ☐ Forbidden-pattern grep returns **zero** hits (see runbook §7c)

---

## 4. Red flags 🚩

If any of these appear, **stop and triage** before continuing the deploy.

- 🚩 0 or 2+ `PageView` requests on initial load
- 🚩 Any browser-side `Lead` / `CompleteRegistration` / `Purchase` / `SubmitApplication` / `Schedule`
- 🚩 Any browser-originated POST to `capi-event`
- 🚩 `_fbp` missing on a normal session
- 🚩 `_fbc` missing when `fbclid` was in the landing URL
- 🚩 Match quality score collapses in Meta Events Manager (likely double-hash)
- 🚩 Outbound `fbp`/`fbc` differ from inbound values (pass-through broken)
- 🚩 `client_ip_address: "0.0.0.0"` on most events
- 🚩 PageView or `capi-event` CI guardrail red
- 🚩 Direct edit to a protected file appears in a measurement PR

---

## 5. Escalation

| Situation | Action |
|---|---|
| Red flag in §4 involves browser conversion ownership or `capi-event` from browser | **Stop. Open dedicated sprint.** |
| Protected file (`verify-otp`, `send-otp`, `PostScanReportSwitcher`, `PhoneVerifyModal`, `VerifyGate`) needs change | **Open scoped sprint.** Never touch as cleanup. |
| Twilio behavior is involved | **Open dedicated sprint.** Off-limits to measurement work. |
| New event taxonomy needed | **Open dedicated sprint.** |
| Broaden browser Meta beyond `init` + `PageView` | **Open dedicated architecture sprint.** |
| Tiny inline fix (e.g., restore `isSha256Hex` guard, fix IP/UA fallback) | Safe — re-run §3 checks after fix |

Full escalation matrix: [`MEASUREMENT_OPERATOR_RUNBOOK.md` §8](./MEASUREMENT_OPERATOR_RUNBOOK.md#8-escalation-rules)

---

## 6. References

- 📘 [`CANONICAL_MEASUREMENT_ARCHITECTURE.md`](./CANONICAL_MEASUREMENT_ARCHITECTURE.md) — architecture source of truth
- 📗 [`MEASUREMENT_OPERATOR_RUNBOOK.md`](./MEASUREMENT_OPERATOR_RUNBOOK.md) — long-form troubleshooting
- 📙 [`BROWSER_META_DECOUPLING_COMPLETE.md`](./BROWSER_META_DECOUPLING_COMPLETE.md) — historical record
- 🧪 PageView proof: `scripts/pageview-dedupe-test.tsx` (run via `npm run proof:pageview`)
- 🧪 `capi-event` regression suite: `supabase/functions/capi-event/index.test.ts`
- ⚙️ CI workflow: `.github/workflows/pageview-guardrail.yml`
- ⚙️ CI workflow: `.github/workflows/capi-event-guardrail.yml`
