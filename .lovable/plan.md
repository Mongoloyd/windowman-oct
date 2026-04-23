

## Admin Foundation Pass — Audit & Plan

### A. What exists today (admin-related)

| Path | File | Status |
|---|---|---|
| `/admin` | `src/components/AdminDashboard.tsx` | Renders, **no auth guard wired in `App.tsx`**. Header is a thin strip with title + tiny gear icon. No identity, no sign-out. **35 tabs** in one wrapped row. |
| `/admin/settings` | `src/pages/AdminSettings.tsx` | Wraps itself in `AuthGuard` + `useCurrentUserRole`. Polished trust-centric design (good reference). |
| `/admin/partners` | `src/pages/AdminPartners.tsx` | Wraps itself in `AuthGuard` + `useCurrentUserRole`. Functional CRUD. |
| `/admin/login` | — | **Missing.** |
| `/admin/forgot-password` | — | **Missing.** |
| `/admin/reset-password` | — | **Missing.** |
| `AuthGuard` | `src/components/auth/AuthGuard.tsx` | Exists. **DEV bypass active**. Redirects to `/` when unauthenticated (wrong target for admin). |
| `useCurrentUserRole` | `src/hooks/useCurrentUserRole.ts` | Reads `user_roles` table. **DEV bypass returns fake `super_admin`**. |
| Partner login | `src/pages/ContractorLogin.tsx` | Has email/password + forgot-password in one component. Partner-branded ("Partner Portal", sky-blue dark theme). |
| Partner reset | `src/pages/PartnerResetPassword.tsx` | Clean Supabase recovery loop. Partner-branded. |
| RLS gate | `is_internal_operator()` | Reads `auth.jwt().app_metadata.role IN ('operator','admin','super_admin')`. This is the real backend gate. |

### B. What's safe to reuse from partner auth

- **Logic patterns only** — `signInWithPassword`, `resetPasswordForEmail({ redirectTo })`, `onAuthStateChange('PASSWORD_RECOVERY')`, `updateUser({ password })`. Lifted as logic into new admin components.
- **Not reused**: partner branding, dark sky-blue theme, "Partner Portal" copy, `usePartnerAuth` hook (it routes to contractor opportunities). Admin gets its own light, premium shell that matches `AdminSettings`/`/about` typography direction.

### C. Admin tab inventory & recommendation

The current `AdminDashboard` exposes **35 tabs** in one wrapped row. Most are speculative scaffolding:

**Keep as primary (real, meaningful):**
- Launch Control · Command Center · Active Pipeline · Routing · Ghost Recovery · Needs Review · Dialer Desk · Contractors · Onboarding · Outcomes · Attribution · Delivery Inspector · Session Diag

**Demote to a secondary "Ops Tools" group (functional but secondary):**
- Reporting · Lifecycle · Feedback · Shared Market · Report Prep · Audit · Health Check · Data Quality · Exceptions · Pilot Readiness

**Hide from primary nav (planning surfaces / decision frameworks — not operator workflow):**
- Surface Map · Training / SOP · Rollout · Docs / Handoff · Pilot Learnings · Change Mgmt · Governance · Scenario Drills · Expansion · Tech Debt · Consistency · Prioritization

These are not deleted — components stay in the file, just removed from the visible tab strip. Re-introduce them deliberately later via a "More" menu or a separate `/admin/playbooks` page if/when they become real.

### D. Files added

1. `src/pages/AdminLogin.tsx` — `/admin/login`. Email + password form. Inline "Forgot password?" link toggles to recovery view (single page, like `ContractorLogin`). Calls `signInWithPassword`; on success → `/admin`. If already authenticated, redirects to `/admin`.
2. `src/pages/AdminForgotPassword.tsx` — `/admin/forgot-password`. Standalone route the user can be linked to directly. Calls `resetPasswordForEmail(email, { redirectTo: ${origin}/admin/reset-password })`. Success state with "Check your email" confirmation.
3. `src/pages/AdminResetPassword.tsx` — `/admin/reset-password`. Mirrors `PartnerResetPassword` logic (PASSWORD_RECOVERY listener, hash detection, `updateUser({ password })`), but with admin styling and redirects to `/admin/login` on success.
4. `src/components/admin/AdminAuthGate.tsx` — Wraps admin routes. Honors existing DEV bypass (no behavior change in sandbox). In production: no session → `<Navigate to="/admin/login" replace />`. Optional role check via `is_internal_operator` RPC; failure renders an "Unauthorized" panel with sign-out + "Use a different account" actions (does not redirect to `/`).
5. `src/components/admin/shell/AdminShell.tsx` — Shared shell layout: sticky top header (page title + breadcrumb slot + identity bar), light surface, consistent spacing. Used by `AdminDashboard`, `AdminSettings`, `AdminPartners`.
6. `src/components/admin/shell/AdminIdentityBar.tsx` — Right side of header. Shows `email` + role badge (`Super Admin` / `Operator` / `Viewer` / `DEV bypass`), session-alive dot, sign-out button. Click → `signOut()` → `/admin/login`.
7. `src/components/admin/shell/AdminPrimaryTabs.tsx` — Curated tab strip with only the **kept primary** tabs from §C. Wraps the existing `<Tabs>` from `AdminDashboard` so the underlying content components are unchanged. Tabs use real focus rings, hover states, and high-contrast active state.

### E. Files modified (minimal)

8. `src/App.tsx`
   - Add lazy imports for `AdminLogin`, `AdminForgotPassword`, `AdminResetPassword`.
   - Add 3 public routes: `/admin/login`, `/admin/forgot-password`, `/admin/reset-password`.
   - Wrap the 3 existing admin routes with `<AdminAuthGate>`.
   - No other route changes.

9. `src/components/AdminDashboard.tsx`
   - Replace inline header `<div className="border-b bg-card">…` with `<AdminShell title="Lead Sniper CRM" subtitle="…leads · Updated…">`.
   - Replace the 35-tab `TabsList` with `<AdminPrimaryTabs activeTab={activeTab} onTabChange={setActiveTab} ghostCount={…} needsReviewCount={…} />`.
   - Hidden tabs' `<TabsContent>` blocks remain in the file (still mounted via `<Tabs>` value), so no logic is lost — they simply have no trigger in the visible strip. Or, cleaner: gate the hidden `<TabsContent>` behind a `showAdvanced` toggle later. For this pass, just remove the triggers.

10. `src/pages/AdminSettings.tsx` & `src/pages/AdminPartners.tsx`
    - Swap the existing custom header/back link for `<AdminShell title="Role Management" backTo="/admin">…children…</AdminShell>` so all three admin pages share the same chrome.
    - No business logic changes, no API call changes.

### F. Visual hierarchy (admin shell)

```text
┌──────────────────────────────────────────────────────────────────┐
│ AdminShell (sticky, bg-card, border-b, shadow-sm)                │
│ ┌──────────────┐                          ┌──────────────────┐   │
│ │ Eyebrow      │                          │ Identity bar     │   │
│ │ "ADMIN"      │   Page title (display)   │ email · role     │   │
│ │ Subtitle     │   Subtitle (muted)       │ ● session · Out  │   │
│ └──────────────┘                          └──────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│ AdminPrimaryTabs (12-13 curated tabs, pill style, focus rings)   │
├──────────────────────────────────────────────────────────────────┤
│ <main> page content (consistent max-width, padding)              │
└──────────────────────────────────────────────────────────────────┘
```

### G. Typography & contrast tokens

Reusing the `/about` hero direction and existing tokens — no new fonts, no hardcoded colors:

| Surface | Class |
|---|---|
| Page title | `font-display text-3xl md:text-4xl font-extrabold leading-tight tracking-tight text-foreground` |
| Section heading | `font-display text-xl md:text-2xl font-bold tracking-tight text-foreground` |
| Eyebrow / metadata label | `text-[11px] font-bold uppercase tracking-widest text-muted-foreground` |
| Body | `text-sm leading-relaxed text-foreground/80` |
| Identity email | `text-sm font-semibold text-foreground` |
| Role badge | reuse `RoleBadge` pattern from `AdminSettings` (rose/blue/emerald pills) |
| Tab trigger (default) | `text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60` |
| Tab trigger (active) | `bg-card text-foreground shadow-sm border border-border` |
| Tab trigger (focus) | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| Primary button | existing `Button` default (already passes contrast) |
| Disabled controls | `opacity-60 cursor-not-allowed` (intentional, not washed-out) |
| Empty state | centered card with icon + single-sentence explanation + one action |

All colors via semantic tokens (`--foreground`, `--muted-foreground`, `--card`, `--border`, `--ring`, `--destructive`). No raw `slate-400` etc. introduced.

### H. Auth flow (end to end)

```text
visitor → /admin
  AdminAuthGate
    DEV?  → render (existing bypass, unchanged)
    PROD: no session  → <Navigate to="/admin/login">
    PROD: session, role ok → render <AdminShell><AdminDashboard/>
    PROD: session, no operator role → "Unauthorized" panel + Sign out

visitor → /admin/login
  signed in? → <Navigate to="/admin">
  email+password → signInWithPassword → /admin
  "Forgot password?" → switch in-page OR link to /admin/forgot-password

/admin/forgot-password → resetPasswordForEmail → "Check your email"
recovery email link → /admin/reset-password
  onAuthStateChange('PASSWORD_RECOVERY') → show new-password form
  updateUser({password}) → /admin/login
```

### I. States covered

- **Empty**: intentional empty-state cards in dashboard (icon + sentence + single action).
- **Unauthorized**: dedicated panel inside `AdminAuthGate`, never blank.
- **Expired session**: `onAuthStateChange('SIGNED_OUT')` in `AdminAuthGate` → redirect to `/admin/login` with toast "Your session has expired".
- **Errors**: all auth surfaces use existing `useToast` with human-readable messages; no `[object Object]`.
- **Responsive**: `AdminShell` header stacks identity below title under `md`. `AdminPrimaryTabs` becomes horizontally scrollable on narrow widths instead of wrapping into 4 rows.
- **Focus/keyboard**: every interactive element has a real `focus-visible` ring (uses `--ring` token).

### J. What is explicitly NOT touched

- `phoneVerificationService.ts`, `PhoneVerifyModal.tsx`, `VerifyGate.tsx`
- All OTP / Twilio / homeowner upload paths
- `is_internal_operator()`, RLS, edge functions, schema, `auth.users`
- `ContractorLogin.tsx`, `PartnerResetPassword.tsx`, partner routes
- `SessionDiagnosticPanel.tsx`, `DeliveryInspectorPage.tsx`
- DEV bypass behavior in `AuthGuard` and `useCurrentUserRole` (left intact, just no longer the only thing standing between `/admin` and the world)
- PR-2 delivery work

### K. Acceptance

- `tsc --noEmit` exit 0.
- Visiting `/admin` while signed out (production build) → `/admin/login`. In sandbox DEV, existing bypass still works.
- `/admin/login`, `/admin/forgot-password`, `/admin/reset-password` all render, complete the round trip, and route into `/admin`.
- Admin shell on `/admin`, `/admin/settings`, `/admin/partners` shares one header + identity bar + sign-out.
- Identity bar always shows current email/role (or "DEV bypass" badge when applicable).
- Primary tab strip shows ~12-13 curated tabs, not 35.
- All headings use `font-display`/`font-extrabold`/`tracking-tight`. All controls have visible hover/focus/active states. No washed-out gray-on-gray.
- No protected paths modified.

