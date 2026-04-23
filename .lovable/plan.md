

## DEV-only client bypass via `localStorage` prompt — no backend changes

Replace every `import.meta.env.VITE_DEV_BYPASS_SECRET` reference with a runtime `localStorage` lookup that prompts once per browser. `VerifyGate` short-circuits in DEV when a secret is present. Production is untouched because every code path is wrapped in `import.meta.env.DEV`.

### New file

**`src/lib/devSecret.ts`** (~30 lines)
```ts
const KEY = 'wm_dev_secret';

export function getDevSecret(): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    let v = localStorage.getItem(KEY);
    if (v) return v;
    const entered = window.prompt('Enter DEV_BYPASS_SECRET (cancel to use normal OTP flow):');
    if (entered && entered.trim()) {
      v = entered.trim();
      localStorage.setItem(KEY, v);
      return v;
    }
    return null; // user cancelled → fall back to normal flow
  } catch {
    return null;
  }
}

export function peekDevSecret(): string | null {
  if (!import.meta.env.DEV) return null;
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function clearDevSecret(): void {
  try { localStorage.removeItem(KEY); } catch {}
}
```

Two accessors on purpose:
- `getDevSecret()` — may prompt. Used by explicit user actions (clicking a DEV scenario button, manually requesting unlock).
- `peekDevSecret()` — never prompts. Used by `VerifyGate` auto-skip and by passive admin fetches so we don't pop a prompt on every page load.

### File changes

**1. `src/components/TruthReportFindings/VerifyGate.tsx`**
- Add `useEffect` on mount: if `import.meta.env.DEV` and `peekDevSecret()` returns a value, call `onVerified()` immediately and return.
- Do **not** call `send-otp` or `verify-otp` in that branch. No prompt — if no secret is stored, the gate behaves exactly as today (normal OTP flow).
- Production build: `import.meta.env.DEV` is false, the effect bails, behavior is identical to today.

**2. `src/hooks/useAnalysisData.ts`**
- Replace all `import.meta.env.VITE_DEV_BYPASS_SECRET` reads with `peekDevSecret()`.
- The dev-bypass fetch path activates only when both `import.meta.env.DEV` is true and `peekDevSecret()` returns a string.
- Real-user `fetchFull(phoneE164)` path unchanged.

**3. `src/services/adminDataService.ts`**
- Replace `const devSecret = import.meta.env.DEV ? import.meta.env.VITE_DEV_BYPASS_SECRET : undefined;` with `const devSecret = peekDevSecret();` in `invokeAdminData`, `dialLead`, `sendContractorHandoff`.
- Header still sent as `x-dev-secret` exactly as today, so the existing server-side `DEV_BYPASS_SECRET` check in `admin-data`/`dial-lead`/`send-contractor-handoff` keeps working unchanged.
- Production session-JWT path unchanged.

**4. `src/components/dev/DevQuoteGenerator.tsx`**
- Remove the module-level `const DEV_SECRET = import.meta.env.VITE_DEV_BYPASS_SECRET ...`.
- Inside `runScenario`, call `getDevSecret()` (the prompting variant — user explicitly clicked a scenario button, so a one-time prompt is fine).
- If it returns `null` (user cancelled), set `result.error = 'DEV bypass cancelled'` and return.
- Status text updates: `peekDevSecret() ? 'Bypass: ✓ secret stored in localStorage' : '⚠️ Click a scenario to be prompted for DEV_BYPASS_SECRET'`.
- Component is already wrapped in `if (!import.meta.env.DEV) return null;` — production never renders it.

**5. `.env.example`**
- Remove the `VITE_DEV_BYPASS_SECRET=...` line.
- Add a one-line comment: `# DEV bypass: stored in browser localStorage at runtime via window.prompt — see src/lib/devSecret.ts`.

**6. `.lovable/memory/features/dev-bypass.md`**
- Update Secrets section: drop `VITE_DEV_BYPASS_SECRET`. Document that the client side now prompts once and stores in `localStorage.wm_dev_secret`. Server-side `DEV_BYPASS_SECRET` remains the only real enforcement.

### What is NOT touched (confirmed)

- No new edge functions, no token server, no HMAC/JWT, no host allowlist.
- No changes to `send-otp`, `verify-otp`, `scan-quote`, `dev-report-unlock`, `admin-data`, `dial-lead`, `send-contractor-handoff`, or any other backend file.
- No changes to Twilio config, OTP rate limits, upload, scanner, scoring, GTM, CAPI, report email, or homeowner flow.
- No DB/RLS changes.
- Existing server-side `DEV_BYPASS_SECRET` env var stays exactly as it is — it remains the only real enforcement boundary.

### How you use it in preview

1. Open the preview URL, navigate to any OTP-gated shell (`/diagnosis` post-scan, report view, admin pages).
2. The first explicit DEV action (clicking a scenario in `DevQuoteGenerator`, or manually clearing storage and reloading on a gated page) prompts: `"Enter DEV_BYPASS_SECRET (cancel to use normal OTP flow):"`. Paste the same secret you set for the server-side `DEV_BYPASS_SECRET`. It persists in `localStorage.wm_dev_secret`.
3. From that point on, `VerifyGate` auto-skips on every page load, admin fetches send the `x-dev-secret` header, and DEV scenarios run without burning Twilio.
4. To revert to real OTP testing in DEV: open DevTools console, run `localStorage.removeItem('wm_dev_secret')`, reload. (Or call `clearDevSecret()` from a future DEV button if you want one.)
5. Cancel the prompt at any time → falls back cleanly to the normal Twilio OTP flow with zero errors.

### Definition of done checklist

- [ ] `grep -r "VITE_DEV_BYPASS_SECRET" src/` returns zero hits.
- [ ] `.env.example` no longer mentions `VITE_DEV_BYPASS_SECRET`.
- [ ] In DEV with secret stored: `VerifyGate` auto-completes, no `send-otp`/`verify-otp` calls in Network tab.
- [ ] In DEV with no secret stored (or user cancelled): normal OTP flow runs unchanged.
- [ ] In production build (`wmmvp.lovable.app`): `import.meta.env.DEV` is false, every dev branch is dead code, OTP flow runs as today.
- [ ] Server-side `DEV_BYPASS_SECRET` check in existing edge functions is the sole authority — rotating it instantly invalidates every browser's stored secret.

