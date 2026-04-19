# Browser Meta Policy — Canonical Memo

> Canonical reference for browser-side Meta behavior. Read before
> proposing any tracking, pixel, or conversion-routing change.
>
> **This memo supersedes all earlier "browser Meta fully eliminated"
> statements.** Browser Meta is no longer fully eliminated. It is now
> permitted in exactly one narrow, intentional form described below.

---

## 1. Status

**Browser-side Meta is allowed in one narrow, approved form: a single
WindowMan-controlled pixel that fires `init` and `PageView` only.**

All conversion ownership remains server-side. The browser pixel exists
solely to support top-of-funnel measurement (page-level reach,
attribution cookie seeding) — it does not own any business event.

This state is intentional and load-bearing. Do not regress it in either
direction:

- Do **not** delete the approved browser PageView pixel during future
  cleanup sprints.
- Do **not** broaden browser Meta beyond `init` + `PageView` without a
  dedicated, explicitly scoped sprint.

---

## 2. Current architecture

### Browser layer (allowed surface)

The frontend is permitted to:

- Initialize one WindowMan-controlled Meta pixel via
  `fbq("init", VITE_META_PIXEL_ID)`.
- Fire `fbq("track", "PageView")` on initial app mount.
- Fire `fbq("track", "PageView")` on each SPA route change (exactly
  once per navigation — see CI guardrail in
  `.github/workflows/pageview-guardrail.yml` and proof in
  `scripts/pageview-dedupe-test.tsx`).
- Allow Meta's pixel to set and read the passive `_fbp` first-party
  cookie.
- Support passive `_fbc` cookie behavior via the existing `fbclid`
  capture path (URL parameter capture only — no extra Meta SDK calls).

### Server layer (conversion ownership)

All Meta conversion events remain server-side. The server owns:

- All Meta CAPI dispatch (Lead, CompleteRegistration, Purchase, etc.).
- OTP-verified events.
- Report-revealed events.
- Per-client Meta pixel routing (multi-tenant CAPI fan-out is a
  server-side responsibility, not a browser one).
- Deduplication, identity hashing, and `event_id` minting for CAPI.

The browser must never originate a conversion event or call the
server-side `capi-event` endpoint directly.

---

## 3. Hard rules

### ✅ Allowed browser Meta behavior

- One WindowMan-controlled pixel only.
- `fbq("init", VITE_META_PIXEL_ID)` once per app mount.
- `fbq("track", "PageView")` on initial mount and on each SPA route
  change.
- Passive `_fbp` cookie (set by Meta's pixel script).
- Passive `_fbc` support via the existing `fbclid` URL capture path.
- The `VITE_META_PIXEL_ID` frontend env var (publishable pixel ID
  only — no access tokens).

### ❌ Forbidden browser Meta behavior

- ❌ Browser-side `Lead` event.
- ❌ Browser-side `CompleteRegistration` event.
- ❌ Browser-side `Purchase` event.
- ❌ Browser-side `SubmitApplication` / `Schedule` / any other Meta
  conversion event.
- ❌ Browser-side OTP-verified events.
- ❌ Browser-side report-revealed events.
- ❌ Browser-side `fetch(... /functions/v1/capi-event ...)` calls or
  any future server-conversion endpoint called from the browser.
- ❌ Multi-pixel browser routing (more than one `fbq("init", ...)`
  with different pixel IDs, or any client-side per-tenant pixel
  switching).
- ❌ Meta access tokens or any non-publishable Meta credentials in
  frontend code, env vars, or bundled output.
- ❌ Loading any additional Meta SDK beyond the standard
  `fbevents.js` pixel script needed for the approved init/PageView
  surface.

---

## 4. Protected areas

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

These files do not own browser Meta behavior and must not be modified
to add, remove, or "tidy" Meta calls.

---

## 5. Audit rules

When auditing the repo for Meta references in the future, classify
results as follows:

### Not a regression

- `fbq("init", ...)` in the approved app-level pixel module
  (`src/lib/metaBrowserPixel.ts`) or its provider
  (`src/components/AppTrackingProvider.tsx`).
- `fbq("track", "PageView")` in the approved app-level pixel module
  or provider, including the SPA route-change effect.
- References to `VITE_META_PIXEL_ID` in the approved pixel module or
  provider.
- Documentation references to any of the above (this memo, code
  comments, changelog entries, CI guardrail workflow).

### Regression — must be removed

- Any browser-side `fbq("track", "Lead" | "CompleteRegistration" |
  "Purchase" | "SubmitApplication" | "Schedule" | ...)` call.
- Any browser-side `fetch` to `/functions/v1/capi-event` or an
  equivalent server-conversion endpoint.
- Any second `fbq("init", ...)` with a different pixel ID, or any
  client-side per-tenant pixel switching.
- Any reintroduced `metaConversions`, `shadowPixel`, or equivalent
  browser conversion-bridge module.
- Any Meta access token or non-publishable Meta credential in
  frontend code or env.

If a regression appears in a non-protected file, open a narrowly
scoped cleanup sprint to remove just that reference. If a regression
appears in a protected file (Section 4), do not edit ad-hoc — open a
dedicated protected-file sprint.

---

## 6. Operator instruction

When future prompts touch Meta, tracking, or pixel code:

- **Do not delete** `fbq("init", ...)` or `fbq("track", "PageView")`
  in the approved app-level pixel module / provider during cleanup
  sprints. The PageView-only browser pixel is the approved policy.
- **Do not broaden** browser Meta beyond `init` + `PageView` without
  a dedicated sprint with explicit scope, success criteria, and
  rollback plan.
- **Do not move** conversion ownership back into the browser under
  any framing ("just for testing", "just one event", "while we're
  here", etc.).
- **Do not edit protected files** (Section 4) as a side effect of
  any tracking work.
- **Do not add** Meta access tokens or per-tenant pixel routing to
  the frontend. Multi-tenant CAPI routing is a server responsibility.

---

## Reference: canonical search patterns

Use these exact patterns when verifying state:

```bash
# Approved surface — matches in the app-level pixel module / provider are OK.
grep -rn 'fbq("init"\|fbq("track", "PageView")' src/

# Forbidden surface — any match is a regression.
grep -rn 'fbq("track", "Lead"\|fbq("track", "CompleteRegistration"\|fbq("track", "Purchase"\|fbq("track", "SubmitApplication"\|fbq("track", "Schedule"' src/
grep -rn "capi-event" src/
grep -rn "metaConversions\|shadowPixel\|FacebookConversionProvider" src/

# Frontend env — publishable pixel ID only; never an access token.
grep -rn "VITE_META_PIXEL_ID\|META_ACCESS_TOKEN\|FB_ACCESS_TOKEN" src/
```

Expected:

- The first pattern matches only inside the approved app-level pixel
  module and its provider.
- All other patterns return no runtime matches. Documentation-only
  references (this memo, comments asserting the rules) are fine.
