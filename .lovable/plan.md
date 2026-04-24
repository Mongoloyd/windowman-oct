
## Partner Portal Sitemap (what exists today)

Every `/partner/*` route already in `src/App.tsx`:

```text
PUBLIC (no PartnerLayout, no auth required)
  /partner/login                 → ContractorLogin.tsx        Sign in / request access
  /partner/reset-password        → PartnerResetPassword.tsx   Password reset landing
  /partner/accept-invite?token=  → AcceptInvite.tsx           One-time invite redemption
  /partner/onboarding            → ContractorOnboarding.tsx   Routing/territory wizard
                                                              (only shown right after invite accept
                                                               or from approval modal)

IN-PORTAL (wrapped by PartnerLayout — header + PartnerPortalNav + Outlet)
  /partner/opportunities         → ContractorOpportunitiesPage.tsx   Lead market (the home)
  /partner/dossier/:id?          → PartnerDossier.tsx                Per-lead intelligence detail
```

Identity model (from `usePartnerAuth.ts`): a logged-in partner is one `auth.users` row linked 1:1 to a `contractor_profiles` row (`status='active'`). Everything they see is filtered server-side by `auth.uid()` via RLS — there are no client-specific URLs, no `/partner/:tenantId/...` segments. That's correct and stays that way.

So a **logged-in partner today** has exactly two product surfaces they navigate between:

1. **Opportunity Market** (`/partner/opportunities`) — the list of leads available to them
2. **Lead Dossier** (`/partner/dossier/:id`) — the detail view for one lead, reached by clicking a card in the market

Everything else (`login`, `reset-password`, `accept-invite`, `onboarding`) is a **pre-portal flow** — a partner only sees those once and should never need a nav link to them.

---

## What's missing right now

The `PartnerPortalNav` only exposes one tab ("Opportunity Market") plus a `mailto:` Support link. That's fine for the current product surface, BUT:

- From inside a **Dossier**, there is no nav-level "← back to Market" affordance other than the (already-active) top tab.
- There is no surfaced **Account / Sign Out** control inside the portal shell — once logged in, the only way to sign out is to manually visit `/partner/login`.
- The brand logo links to `/partner/opportunities` but that isn't obvious.

These are the only real navigation gaps for a logged-in partner.

---

## Proposed changes (UI-only, no new routes, no backend)

### 1. `src/components/partner/PartnerPortalNav.tsx`
Keep the single primary tab (Opportunity Market) — it correctly stays highlighted on `/partner/dossier/*` thanks to the existing `matchPrefixes` logic. Add two right-aligned utility items so partners always have an exit and a help channel:

- **Support** — keep existing `mailto:partners@windowman.pro`
- **Sign Out** — new button; calls `supabase.auth.signOut()` then `window.location.href = "/partner/login"`

(No "Account Settings" page exists yet, so we will not add a dead link. If/when one is built, it slots in here.)

### 2. `src/pages/PartnerDossier.tsx` (small addition only)
Add a single "← Back to Opportunity Market" link at the top of the dossier body (under the layout header), using `<Link to="/partner/opportunities">`. This matches the existing subpage-navigation memory pattern (`mem://layout/subpage-navigation-patterns`) used elsewhere in the admin/partner shells.

### 3. No changes to
- `App.tsx` routes (sitemap is complete for the current product scope)
- `PartnerLayout.tsx` chrome (header already correct)
- `usePartnerAuth.ts` / RLS / any edge function
- The pre-portal pages (`login`, `reset-password`, `accept-invite`, `onboarding`)

---

## Multi-tenant safety confirmation

- No client/tenant ID is added to any URL — partner scoping stays 100% server-side via `contractor_profiles.id = auth.uid()` and the existing RLS policies on `contractor_credits`, `contractor_unlocked_leads`, `contractor_opportunity_routes`, etc.
- Sign Out simply clears the Supabase session; the next request to any `/partner/*` in-portal route will be re-evaluated by the existing auth check.
- No new data fetches, no new tables, no schema changes.

---

## Definition of Done

- [ ] Logged-in partner on `/partner/opportunities` sees: Opportunity Market (active), Support, Sign Out.
- [ ] Logged-in partner on `/partner/dossier/:id` sees: Opportunity Market (still active), Support, Sign Out, **and** a "← Back to Opportunity Market" link inside the page body.
- [ ] Sign Out returns the user to `/partner/login` with no session.
- [ ] No new routes added; no backend, RLS, edge function, or auth logic touched.
- [ ] `npm run typecheck` passes.

Approve and I'll switch to default mode and implement the two file edits above.
