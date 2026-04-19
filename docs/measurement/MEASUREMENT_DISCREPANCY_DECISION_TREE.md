# Measurement Discrepancy Decision Tree

> **Fastest triage artifact in the repo.** Use this first. Drop into the [Operator Runbook](./MEASUREMENT_OPERATOR_RUNBOOK.md) only if a branch tells you to.

---

## Start here

**What's the symptom?**

- 🅰 [PageView missing](#a-pageview-missing)
- 🅱 [PageView duplicated](#b-pageview-duplicated)
- 🅲 [Conversion missing in Meta](#c-conversion-missing-in-meta)
- 🅳 [Weak match quality](#d-weak-match-quality)
- 🅴 [`_fbc` missing](#e-_fbc-missing)
- 🅵 [`_fbp` missing](#f-_fbp-missing)
- 🅶 [Meta vs GTM disagreement](#g-meta-vs-gtm-disagreement)
- 🅷 [Suspect a protected file](#h-suspect-a-protected-file)

---

## 🅰 PageView missing

1. Run `npm run proof:pageview` → if it **fails**, that is your evidence. Fix in app shell, not in tests.
2. In DevTools console: `typeof window.fbq` → if not `"function"`, pixel script never loaded.
3. Check `VITE_META_PIXEL_ID` is present in the deployed bundle. If missing, env var was not injected at build.
4. If `fbq` exists but no `ev=PageView` request: pixel init ran, but PageView call did not. Check app shell mount path.
5. If browser PageView is fine but Meta Events Manager shows nothing: **not a browser issue** → jump to 🅲.

---

## 🅱 PageView duplicated

1. Run `npm run proof:pageview` → if it **fails on dedupe**, that is your evidence.
2. Reproduce: load page once, check Network for `ev=PageView` count. Should be **exactly 1**.
3. Navigate to a new SPA route. Should see **exactly +1**. If +2, double-fire on route change.
4. Same route firing twice → likely double-mount of the PageView effect. Inspect router/effect dependencies.
5. If browser PageView is correctly 1+1 but Meta or GTM shows duplicates → **reporting/dedup layer issue**, not a code regression. Jump to 🅶.

---

## 🅲 Conversion missing in Meta

1. **First, confirm expectation:** browser does **not** own conversions. Browser PageView present + no browser conversion event = **expected**.
2. Server owns conversions via `capi-event`. Check Supabase → Functions → `capi-event` → Logs for the relevant `event_id`.
3. If no log entry: server dispatch was never invoked. Trace upstream (which call site should have triggered it?).
4. If log entry exists with 2xx: payload was sent to Meta. Check Meta Events Manager → Test Events with `test_event_code` for delivery.
5. If log entry exists with 4xx/5xx: read the response body in the log; fix the payload shape.
6. **Forbidden remediation:** do **not** add a browser-side conversion event or browser call to `capi-event`. If that feels necessary, **stop** and open a dedicated sprint.

---

## 🅳 Weak match quality

1. Open a recent `capi-event` log entry. Inspect outbound `user_data`.
2. Is `fbp` present and **byte-identical** to the inbound payload? If not → pass-through broken.
3. Is `fbc` present (when it should be)? If not → see 🅴.
4. Is `em` a 64-char SHA256 hex? Hash the same raw email yourself and compare:
   - Match → healthy.
   - Different → **double-hash regression**. Run `deno test --allow-net --allow-env supabase/functions/capi-event/index.test.ts`. The `isSha256Hex` guard in `buildHashedUserData()` must be intact.
5. Same check for `ph` (digit-normalized then SHA256) and `external_id`.
6. Is `client_ip_address` populated (not `0.0.0.0`)? If always `0.0.0.0`, header chain regressed (`cf-connecting-ip` → `x-forwarded-for` first hop → `x-real-ip`).
7. Is `client_user_agent` populated? If empty, payload UA omitted *and* request UA header was missing — confirm the caller, then fix the fallback.

---

## 🅴 `_fbc` missing

1. Was the URL of the landing page `?fbclid=...`? **No** → `_fbc` absence is **expected, not a defect**. Stop.
2. Yes, but cookie missing: pixel init ran *after* the route was rendered, so `_fbc` was never seeded. Confirm pixel init lives in the app shell, not lazy-loaded.
3. Cookie blocker / consent layer may have suppressed it. Verify in incognito with consent accepted.
4. If `_fbc` is present in the cookie but **not** forwarded to `capi-event` → pass-through regression in server payload assembly. Run the regression suite.

---

## 🅵 `_fbp` missing

1. In DevTools console: `typeof window.fbq` → if not `"function"`, the Meta script never loaded. Treat as 🅰.
2. `fbq` exists but `_fbp` cookie absent: pixel init did not call `track("PageView")` (init alone does not seed `_fbp`).
3. Cookie consent / privacy extension may be blocking `_fbp`. Verify in incognito.
4. If `_fbp` is present in browser but **not** forwarded to `capi-event` → pass-through regression. Run the regression suite.

---

## 🅶 Meta vs GTM disagreement

1. Confirm browser PageView is healthy (🅰/🅱 proofs green).
2. Confirm forbidden browser conversion events are **absent** (grep §7c of the runbook). Their absence is correct, not a defect.
3. Confirm server-side `capi-event` is dispatching (🅲).
4. **Most likely causes** (in order):
   - Meta reporting delay (4–48h is normal, especially for fresh events).
   - GTM-side dedup or filter rule masking the event.
   - Different attribution windows between Meta UI views.
5. Treat reporting/UI discrepancy as the default explanation **only after** browser proof is green and server logs show successful dispatch.
6. Do **not** "fix" Meta UI discrepancies by adding browser-side conversion events. That is a regression, not a fix.

---

## 🅷 Suspect a protected file

If a measurement issue appears to live in any of:

- `supabase/functions/verify-otp/**`
- `supabase/functions/send-otp/**`
- `src/components/post-scan/PostScanReportSwitcher.tsx`
- `src/components/TruthReportFindings/PhoneVerifyModal.tsx`
- `src/components/TruthReportFindings/VerifyGate.tsx`

→ **Stop. Do not edit.** Open a dedicated, scoped protected-file sprint with explicit approval. These files are off-limits to ad-hoc measurement cleanup.

Twilio code, secrets, or behavior → same rule. Off-limits to measurement work.

---

## When to stop

Stop and reassess if **any** of these apply:

- The fix would broaden browser Meta beyond `init` + `PageView`.
- The fix would add a browser-side conversion event.
- The fix would add a browser call to `/functions/v1/capi-event`.
- The fix touches a protected file (see 🅷).
- A grep "match" is only in docs/comments, not runtime code → no defect, stop.
- A CI guardrail (`pageview-guardrail`, `capi-event-guardrail`) is **already red** → use it as your evidence; do not guess. Make the proof green before re-deploying.
- The fix requires modifying tests or CI to pass → **wrong direction**. Restore behavior, not the assertion.

---

## References

- 📘 [Canonical Measurement Architecture](./CANONICAL_MEASUREMENT_ARCHITECTURE.md)
- 📗 [Operator Runbook](./MEASUREMENT_OPERATOR_RUNBOOK.md)
- 📋 [Deployment Checklist](./MEASUREMENT_DEPLOYMENT_CHECKLIST.md)
- 📙 [Browser Meta Decoupling (historical)](./BROWSER_META_DECOUPLING_COMPLETE.md)
- 🧪 PageView proof: `scripts/pageview-dedupe-test.tsx` (`npm run proof:pageview`)
- 🧪 `capi-event` regression suite: `supabase/functions/capi-event/index.test.ts`
- ⚙️ CI: `.github/workflows/pageview-guardrail.yml`, `.github/workflows/capi-event-guardrail.yml`
