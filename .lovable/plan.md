Sprint A — Partner Route Guard Plan

Confirmed file scope:
- Modify exactly one file: `src/routes/PartnerRoutes.tsx`
- Do not modify `src/App.tsx`, `src/pages/Index.tsx`, `vite.config.ts`, `index.html`, Supabase files, migrations, Edge Functions, tracking, scanner, OTP, report reveal, package files, admin routes, or public homeowner/contractor routes.

Current evidence:
- `src/routes/PartnerRoutes.tsx` currently keeps public partner routes separate:
  - `login`
  - `join`
  - `reset-password`
  - `accept-invite`
- The private partner app routes are currently nested under `<PartnerLayout />` without `PartnerGuard`:
  - `portal`
  - `opportunities`
  - `revenue`
  - `dossier/:id?`
- `src/pages/ContractorOnboarding.tsx` already imports and wraps its form with `PartnerGuard`, so `/partner/onboarding` should be left unchanged at the route level.
- `PartnerGuard` is an existing default export at `@/components/auth/PartnerGuard`, and can be imported cleanly into `PartnerRoutes.tsx`.

Implementation approach:
1. In `src/routes/PartnerRoutes.tsx`, add one import:
   - `import PartnerGuard from "@/components/auth/PartnerGuard";`
2. Wrap the existing `PartnerLayout` route group with `PartnerGuard`, not the public auth/invite routes.
3. Keep all lazy page imports and route paths unchanged.
4. Leave `/partner/onboarding` unchanged as `<Route path="onboarding" element={<ContractorOnboarding />} />`, relying on its existing internal `PartnerGuard` wrapper.

Expected route structure after implementation:
```tsx
<Route path="login" element={<ContractorLogin />} />
<Route path="join" element={<ContractorLogin initialView="register" />} />
<Route path="reset-password" element={<PartnerResetPassword />} />
<Route path="accept-invite" element={<AcceptInvite />} />
<Route path="onboarding" element={<ContractorOnboarding />} />
<Route
  element={
    <PartnerGuard>
      <PartnerLayout />
    </PartnerGuard>
  }
>
  <Route path="portal" element={<ContractorPortal />} />
  <Route path="opportunities" element={<ContractorOpportunitiesPage />} />
  <Route path="revenue" element={<PartnerRevenueDashboard />} />
  <Route path="dossier/:id?" element={<PartnerDossier />} />
</Route>
<Route path="*" element={<NotFound />} />
```

Behavioral outcome:
- Public partner routes remain public:
  - `/partner/login`
  - `/partner/join`
  - `/partner/reset-password`
  - `/partner/accept-invite`
- Private partner app routes become guarded before `PartnerLayout` renders:
  - `/partner/portal`
  - `/partner/opportunities`
  - `/partner/revenue`
  - `/partner/dossier/:id?`
- `PartnerLayout` will be inside `PartnerGuard`, so portal chrome and child pages should not render for unauthenticated, unlinked, suspended, or pending-review states unless `PartnerGuard` allows them.
- `/partner/onboarding` remains unchanged and continues using its existing self-wrapped `PartnerGuard` behavior.

Verification plan after implementation:
1. Confirm changed files are exactly:
   - `src/routes/PartnerRoutes.tsx`
2. Verify public routes still render without route-level guard interference:
   - `/partner/login`
   - `/partner/join`
   - `/partner/reset-password`
   - `/partner/accept-invite`
3. Verify unauthenticated private routes no longer render private partner UI and are handled by `PartnerGuard`:
   - `/partner/portal`
   - `/partner/opportunities`
   - `/partner/revenue`
   - `/partner/dossier`
4. Confirm `/partner/onboarding` route definition was not changed.
5. Confirm no changes to admin, homepage, scanner, OTP/Twilio, report reveal/full_json gating, tracking/Meta CAPI, package, Vite, Supabase, or public contractor/homeowner files.

Stop conditions:
- Stop if importing `PartnerGuard` causes TypeScript issues requiring edits outside `src/routes/PartnerRoutes.tsx`.
- Stop if public partner routes would be affected.
- Stop if `PartnerLayout` requires a rewrite.
- Stop if Supabase, RPC, Edge Function, tracking, scanner, OTP, report, admin, homepage, package, or Vite files appear necessary.
- Stop if `PartnerGuard` behavior cannot be preserved as-is.

Final report after implementation will include:
- Exact files changed
- Which routes are public
- Which routes are guarded
- Whether `PartnerLayout` is inside the guard
- Whether `/partner/onboarding` was left unchanged
- Whether any stop condition occurred