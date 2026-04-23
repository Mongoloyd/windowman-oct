

# Phase 20 Verification — Pass/Fail Report + Implementation Task

## Pass/Fail report (4 verification checks)

### ✅ Check 1 — Auth Redirection: PASS
`AdminAuthGate.tsx` (lines 85-93) emits `<Navigate to="/admin/login" replace />` whenever the session check resolves `anonymous`. Both `/admin/leads` and `/admin/leads/:id` are wrapped in `<AdminAuthGate>` at `App.tsx:138-139`. The existing 26-test integration suite already proves this pattern works for `/admin`, `/admin/settings`, `/admin/partners` — extending the matrix to the two new paths gives mechanical coverage.

**Proof to land:** add `/admin/leads` and `/admin/leads/abc-123` to `ADMIN_ROUTES` in `AdminAuthGate.test.tsx`. Test count grows 26 → ~44 with no new logic.

### ✅ Check 2 — Nested Tab Highlighting: PASS
`AdminPrimaryTabs.tsx` computes:
```ts
const isActive = t.matchPrefixes.some(
  (prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`)
);
```
For `Lead Inbox` with `matchPrefixes: ["/admin/leads"]`:
- `/admin/leads` → exact match → **active**
- `/admin/leads/abc-123` → prefix match → **active**
- `/admin/settings` or `/admin` → **inactive**

**Proof to land:** new `AdminPrimaryTabs.test.tsx` rendering inside `<MemoryRouter>` for each path and asserting `data-state` + `aria-current`.

### ✅ Check 3 — Tab Bar Layout: PASS, no styling change required
Container is `flex w-full flex-wrap gap-1`; items are `flex-1 min-w-[110px]` + `whitespace-nowrap` + `truncate`. With 14 entries × ~124px ≈ 1736px, the bar wraps cleanly on 1366px (most common admin width) and below — no overflow, no clipping, no horizontal scroll. The `truncate` only triggers if a single tab gets squeezed below `min-w-[110px]`, which `flex-wrap` prevents.

### ✅ Check 4 — Event Propagation: PASS
`AdminLeadInbox.tsx:363` has `onClick={(e) => e.stopPropagation()}` on the `<Link>` inside the row. The link click does not bubble to the row's `onClick={() => onView(l.id)}`, so `navigate('/admin/leads/${id}')` fires once.

**Proof to land:** new `AdminLeadInbox.test.tsx` with mocked `useNavigate` asserting one call per click.

## Implementation task — Dossier "Back to Inbox" button

`AdminLeadDossierPage.tsx` already has a small `← Back to inbox` chip via `<AdminShell backTo="/admin/leads">`. Phase 20 wants a **prominent button** at the top of the page content.

**Approach:** Add a button row at the top of the success-state return (above the 3-column grid):
```tsx
<div className="mb-5">
  <Button asChild variant="outline" size="sm">
    <Link to="/admin/leads" className="inline-flex items-center gap-1.5">
      <ArrowLeft className="h-3.5 w-3.5" />
      Back to Inbox
    </Link>
  </Button>
</div>
```
Uses react-router `<Link>` so navigation is client-side (no full reload, session/state preserved).

**Honest note on tab-state persistence:** `AdminPrimaryTabs` is mounted inside `AdminDashboard` (which renders only on `/admin`). The lead pages don't currently mount the tab strip, so the spec's "tab remains highlighted" applies only when the operator subsequently navigates to `/admin` — at which point the tab strip re-renders against `location.pathname === '/admin'` and Lead Inbox correctly becomes inactive. To keep the tab strip visible (and highlighted) on `/admin/leads*`, the tab strip would need to move into `AdminShell` or be mounted by the lead pages themselves. That's a larger refactor I'm flagging for a follow-up sprint and **not** doing in Phase 20 to honor the "frontend polish only" constraint.

## Files to change

| File | Change | Lines |
|---|---|---|
| `src/components/admin/__tests__/AdminAuthGate.test.tsx` | Extend `ADMIN_ROUTES` + `ROUTE_TESTID` + `<Routes>` map with `/admin/leads` and `/admin/leads/:id`; update docblock. | ~30 edited |
| `src/components/admin/shell/__tests__/AdminPrimaryTabs.test.tsx` | NEW — ~5 tests for route-tab active state, `aria-current`, panel-tab kind. | ~80 new |
| `src/pages/__tests__/AdminLeadInbox.test.tsx` | NEW — mocks `useNavigate` + `invokeAdminData`; asserts View link `aria-label` and single navigate call. | ~70 new |
| `src/pages/AdminLeadDossierPage.tsx` | Add prominent `Back to Inbox` button above the grid; add `ArrowLeft` import + `Button` import + `Link` (already imported). | ~12 added |

## Out of scope (per Phase 20 constraints)
- DB / Edge Functions / Supabase schema.
- OTP / scanner / homeowner funnel logic.
- Restyling the 13 existing panel tabs (Check 3 passed).
- Mounting `AdminPrimaryTabs` on lead pages (architectural; flagged for follow-up).

## Verification after implementation
- `npx tsc --noEmit -p tsconfig.app.json` → 0 errors.
- `npx vitest run` on the three test files → green; auth-gate 26 → ~44, plus ~5 primary-tabs, plus ~2 inbox.
- Dev-server log → no HMR errors.

