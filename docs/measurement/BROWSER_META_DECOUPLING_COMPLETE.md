# Browser-Side Meta Decoupling — Complete

> Canonical closeout memo. Read before proposing any tracking, pixel, or
> conversion-routing change.

---

## 1. Status

**Browser-side Meta cleanup is complete.**

The WindowMan frontend no longer ships, imports, initializes, or invokes any
Meta/Facebook browser SDK code. All Meta conversion ownership has moved
server-side. The frontend is vendor-agnostic and routes business events
through GTM / `window.dataLayer` only.

This state is intentional and load-bearing. Do not regress it.

---

## 2. What was removed

The following browser-side Meta surfaces have been deleted or rewired:

- Direct `fbq(...)` and `window.fbq(...)` calls anywhere in `src/`.
- The `src/lib/metaPixel.ts` helper module (pixel init, `fbqTrack`,
  `metaConversions`, browser → CAPI bridge).
- The `src/lib/shadowPixel.ts` helper module.
- The app-level `FacebookConversionProvider` wrapper component.
- The `FacebookShareButton` component (orphaned consumer).
- All browser-side `fetch(... /functions/v1/capi-event ...)` calls.
- All frontend reads of `VITE_META_PIXEL_ID` / `META_PIXEL_ID`.
- The `metaConversions.otpVerified(...)` calls inside the protected
  `PhoneVerifyModal` and `VerifyGate` (replaced with the existing canonical
  `trackGtmEvent("otp_verified", ...)` + `trackGtmEvent("report_revealed", ...)`
  calls those files already emitted).

---

## 3. What remains true

- **OTP and reveal flows remain intact.** Phone verification and report
  unlock behavior was not changed by the cleanup. Session-binding,
  rate-limiting, and gate enforcement are unchanged.
- **Meta conversion ownership is server-side.** Any Meta CAPI dispatch must
  originate from a Supabase Edge Function (e.g., the `capi-event` /
  canonical event dispatcher path), never from the browser.
- **Frontend tracking is vendor-agnostic.** Components emit canonical
  business events through `trackBusinessEvent` / `trackGtmEvent` /
  `BUSINESS_EVENTS` only. Vendor routing is GTM's responsibility.
- **GTM / `window.dataLayer` is the browser event layer.** No vendor SDK
  may be loaded, queued, or invoked from app code.
- **Protected files must not be casually refactored.** The OTP/reveal gate
  is a monetization and trust boundary; touching it requires a dedicated,
  explicitly scoped sprint.

---

## 4. Hard rules for future prompts

The following are non-negotiable and apply to every future change:

- ❌ Do not reintroduce `fbq` or `window.fbq` anywhere in `src/`.
- ❌ Do not reintroduce `metaPixel`, `metaConversions`, or any equivalent
  browser Meta wrapper module.
- ❌ Do not reintroduce `shadowPixel` or any "shadow" browser pixel helper.
- ❌ Do not call `capi-event` (or any future server-side conversion endpoint)
  directly from the browser.
- ❌ Do not add frontend Meta pixel env vars (`VITE_META_PIXEL_ID`,
  `META_PIXEL_ID`, or equivalents).
- ❌ Do not load `https://connect.facebook.net/en_US/fbevents.js` from
  the browser, including from `index.html`, providers, or dynamic injection.
- ✅ Add new business events through the canonical tracking utilities only.
- ✅ Any work that touches protected OTP/reveal files requires a dedicated
  sprint with its own scope, success criteria, and rollback plan.

---

## 5. Protected areas

The following files are part of the OTP / report-reveal monetization
boundary. They are **not** to be edited as a side effect of tracking,
analytics, or pixel work. Any change requires a dedicated, explicitly
scoped sprint:

- `supabase/functions/verify-otp/**`
- `supabase/functions/send-otp/**`
- `src/components/post-scan/PostScanReportSwitcher.tsx`
- `src/components/TruthReportFindings/PhoneVerifyModal.tsx`
- `src/components/TruthReportFindings/VerifyGate.tsx`
- Any hook or service directly used by OTP success or report reveal.

---

## 6. When work is allowed again

Further browser-Meta or protected-path work is only justified when:

- A new tracked issue appears (e.g., a real measurement gap shows up in
  GA4, GTM, or Meta Events Manager and is documented), **or**
- A deliberate server-side measurement change is explicitly approved
  (e.g., adding a new server-side conversion event from a verified Edge
  Function), **or**
- A dedicated protected-file sprint is explicitly scoped, with frozen
  files, success criteria, and rollback steps written up front.

Cleanup, refactor, or "while we're here" tracking edits are **not**
sufficient justification.

---

## 7. Operator instruction

When auditing the repo for Meta references in the future:

- If `grep` / search results contain **only** documentation references
  (this memo, code comments asserting the absence of `fbq`/`capi-event`,
  changelog entries, etc.), then **stop**. Do not refactor further. The
  state is correct.
- If `grep` / search results contain a **live runtime reference** in a
  safe (non-protected) file, open a narrowly scoped cleanup sprint to
  remove just that reference.
- If `grep` / search results contain a **live runtime reference** in a
  protected file, do **not** edit it ad-hoc. Open a dedicated
  protected-file sprint instead.

---

## Reference: canonical search patterns

Use these exact patterns when verifying state:

```bash
grep -rn "fbq\|window\.fbq" src/
grep -rn "metaPixel\|metaConversions\|shadowPixel" src/
grep -rn "fbevents\.js\|META_PIXEL_ID\|VITE_META_PIXEL" src/
grep -rn "FacebookConversionProvider" src/
grep -rn "capi-event" src/
```

Expected: matches only inside documentation comments asserting these
patterns must not exist. Any other match is a regression.
