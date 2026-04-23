

## Plan: Read-only Session Diagnostic Panel

### Goal
Surface the live browser auth/session truth inside the admin shell so we can prove which of these is the real PR-1 blocker: no session, stale JWT, wrong user, broken `/signin`, missing `app_metadata.role`, or DEV-bypass masking the real state.

### Constraints honored
- Read-only. No writes (no `user_roles`, no `auth.users`, no schema, no RPCs).
- No protected-path edits (no changes to `phoneVerificationService.ts`, `PhoneVerifyModal.tsx`, `VerifyGate.tsx`, `AuthGuard.tsx`, `useCurrentUserRole.ts`, edge functions, or RLS).
- No PR-2 work.
- New code is additive only.

---

### Files

**Add:** `src/components/admin/diagnostics/SessionDiagnosticPanel.tsx`
A self-contained component that reads the live browser auth state and renders it. No props. No mutations. Re-runs on `onAuthStateChange` and on a manual "Refresh" button.

**Modify (minimal):** `src/components/AdminDashboard.tsx`
- Add one tab trigger: `<TabsTrigger value="session-diag">Session Diag</TabsTrigger>`
- Add one matching `<TabsContent value="session-diag">` rendering `<SessionDiagnosticPanel />`
- No other changes.

That's it — 2 files, one new and one tab-only addition.

---

### What the panel will show (live, from the browser)

Rendered as a single read-only card with labeled rows:

1. **Session presence** — `supabase.auth.getSession()` → has `data.session` (yes/no), error if any.
2. **`auth.uid`** — `session.user.id` or `(none)`.
3. **Email** — `session.user.email` or `(none)`.
4. **Access token presence** — `!!session.access_token` and token length (no token printed).
5. **Decoded JWT `app_metadata.role`** — base64-decode the JWT payload client-side and surface `app_metadata.role` (and `role`, `aud`, `exp`). This is the exact field `is_internal_operator()` reads.
6. **Anonymous vs authenticated** — derived: `aud === 'authenticated' && uid present`.
7. **App's "is internal operator" judgment** — what `useCurrentUserRole` currently returns in this browser (role, isSuperAdmin, isOperator, hasWriteAccess, isLoading, error). Includes a banner if `import.meta.env.DEV` is true so we can SEE that the dev-bypass is masking real state.
8. **Live RLS probe** — one read-only `select id from public.contractors limit 1` so the panel surfaces the exact `permission denied` error code (e.g. `42501`) and message under the live session, without going through the Inspector.
9. **JWT expiry** — `exp` decoded to a human time + "expires in N minutes" so a stale token is obvious.
10. **Refresh button** — calls `supabase.auth.getSession()` again and re-runs the contractors probe.

### Defensive details

- JWT decode is pure client-side (`atob(payload)`), wrapped in try/catch; never throws.
- All values rendered as strings; `null`/`undefined` shown as `(none)`.
- No secrets printed (token value masked, only length + first 6 chars).
- Component handles `onAuthStateChange` cleanup properly.
- Uses semantic tokens (`bg-card`, `text-muted-foreground`, `border`, `text-destructive`) — no hardcoded colors.
- Mounts under a new tab so it does not displace any existing surface.

### Critical finding the panel will make obvious

`AuthGuard` and `useCurrentUserRole` both have hard `import.meta.env.DEV` short-circuits that pretend the user is `super_admin` with no real session. The live preview at `id-preview--…lovable.app` runs with `DEV=true`, so:

- `AuthGuard` lets ANY visitor through.
- `useCurrentUserRole` returns a fabricated `super_admin` role.
- But the actual `supabase.auth` session in the browser may be **anonymous** (no JWT, no `app_metadata.role`).
- `is_internal_operator()` runs against the REAL JWT in the network call → returns `false` → `permission denied for table contractors`.

The panel surfaces this gap directly: "App thinks: super_admin (DEV bypass) | Real JWT: anonymous | RLS probe: 42501". That is the diagnosis.

### What I will NOT touch
- `AuthGuard.tsx` — DEV bypass stays.
- `useCurrentUserRole.ts` — DEV bypass stays.
- `phoneVerificationService.ts`, `PhoneVerifyModal.tsx`, `VerifyGate.tsx`.
- Inspector components.
- Any RLS policy or DB function.
- `/signin` route (you flagged it as broken — out of scope for this diagnostic).

### PR-1 status statement
PR-1 remains **not done**. The diagnostic panel is the instrument we use to determine what to fix next. I will not declare PR-1 done until the Inspector reads real rows under a real, non-bypassed admin browser session.

### Acceptance for this step
- Build clean (`tsc --noEmit` exit 0).
- `/admin` → "Session Diag" tab renders the 10 rows above without crashing.
- The contractors probe row shows either real rows or the exact Postgres error code/message under the live session.
- No protected paths modified.

