## Phase 4L.7 — Stable Sandbox Report Preview Route + Safe V3 QA Harness

### Pre-flight findings
- `DevReportPreview` already imported in `App.tsx` line 27 via `React.lazy("./pages/DevReportPreview.tsx")`.
- `/dev/report-preview` exists at line 145, **inside** the `{isDevMode && (…)}` block (lines 142–152). In Lovable's published preview, `import.meta.env.DEV === false`, so this route 404s — confirms the visibility problem.
- `/sandbox/report-preview` does not exist.
- Greedy `:devAdminAlias` route lives inside the same dev block (line 150). Catch-all `*` is line 170.
- `DevReportPreview.tsx` has **no internal dev gate**, **no Supabase calls, no fetches, no useQuery** — 100% inline mock data. Safe to expose.
- It already parses `v` and `mode` via `useSearchParams`. No layout/provider wrapper needed beyond what `App.tsx` already provides.
- `react-helmet-async` is a project dependency and `<HelmetProvider>` wraps the app at line 124. Helmet usage is safe.
- Hero (`PartialRevealHero.tsx`) already says "FORENSIC AUDIT · PREVIEW LOCKED" — sufficient framing. No copy edit needed in this phase.

### Changes

**1. `src/App.tsx` — add the sandbox route outside the dev block**
- Insert one new route between line 152 (`)}` closing the dev block) and line 153 (`/contractors3`):
  ```tsx
  <Route path="/sandbox/report-preview" element={<DevReportPreview />} />
  ```
- Reuses the existing lazy import (line 27). No new import.
- Placement: outside `isDevMode`, above `:devAdminAlias` (which only mounts in dev anyway), above catch-all `*`, outside `PublicLayout` and `PartnerRoutes`. Same hierarchy as `/dev/report-preview`.
- `/dev/report-preview` is left exactly as-is.

**2. `src/pages/DevReportPreview.tsx` — sandbox-aware behavior**
- Add imports: `useEffect`, `useLocation`, `Navigate` from react-router-dom; `Helmet` from react-helmet-async.
- Compute `isSandboxPreview = location.pathname.startsWith("/sandbox/report-preview")`.
- **Bare-route + param normalization (sandbox only):** if `isSandboxPreview` and (`v !== "v3"` or `mode` is missing/not in `{preview, full}`), return `<Navigate to="/sandbox/report-preview?v=v3&mode=preview" replace />`. This guarantees sandbox visitors never see the legacy `TruthReportClassic` branch and always land on V3.
- `/dev/report-preview` behavior is untouched (still falls through to classic when params absent — that route's existing rollback contract).
- Render order inside the V3 branch (only when `isSandboxPreview`):
  - `<Helmet><meta name="robots" content="noindex,nofollow" /><title>Sandbox · Report Preview</title></Helmet>`
  - A small fixed-top banner: amber-on-slate, `text-xs`, full width, `z-50`, ~28px tall, copy: "SANDBOX PREVIEW — visual QA only, not production traffic". Wrap the existing `<ForensicAuditReport>` in a fragment so the banner sits above without altering report layout. Add `pt-7` to the wrapper only when sandbox to avoid mobile overlap.
- Mock-only is already guaranteed by the component (no fetches anywhere). No new logic added.

### Three safe improvements added (and why)

1. **Strict mode whitelist (`preview` | `full` only).** The existing `DevReportPreview` treats anything other than `mode=preview` as `full`. On the sandbox route we instead redirect unknown modes back to `?v=v3&mode=preview`. Why: prevents partner/QA reviewers from accidentally landing on full-data styling via a typo'd link, and removes the "silent default to full" footgun without changing `/dev/report-preview` semantics.

2. **`<title>Sandbox · Report Preview</title>` alongside the noindex meta.** Why: when a stakeholder has 5 tabs open during QA, the browser tab clearly identifies this as the sandbox harness — reinforces the banner and prevents confusion with `/dev/report-preview` or the production report. Costs nothing, uses the already-installed Helmet.

3. **`startsWith("/sandbox/report-preview")` instead of `includes(...)`.** Why: `includes` would also match a hypothetical future `/admin/sandbox/report-preview` or a query/hash like `?next=/sandbox/report-preview`. `startsWith` keeps sandbox-only behavior surgically scoped to the actual route, which matters because the banner + noindex + redirect logic must NEVER leak onto `/dev/report-preview` or any other surface.

### Token discipline note
The banner uses existing Tailwind utility classes (`bg-amber-500/15 text-amber-200 border-amber-500/30 backdrop-blur`). No new design tokens, no hex colors, no one-off CSS. Existing hardcoded `bg-slate-*` usage in the forensic shell is left for **4L.7.5 — Token Consolidation Pass** as recommended.

### Hero copy
No change. Current "FORENSIC AUDIT · PREVIEW LOCKED" eyebrow plus the existing report subtitle already communicates "neutral forensic second opinion." Recommended copy refinements (e.g. "A private quote-intelligence report before you sign.") are deferred to **4L.8 — Visual Polish & Copy** where they belong with the rest of the hero typography work.

### Guardrails honored
- No backend/Supabase/OTP/report-fetch/tracking/RLS/migration files touched.
- No package install, no lockfile change.
- `/dev/report-preview` and every production route untouched.
- Sandbox route is unlisted, unlinked, noindex/nofollow, mock-data only.
- Component cannot fetch real data — verified by `rg` (zero `fetch`/`supabase`/`useQuery`/`axios` matches).

### Files touched (2)
- `src/App.tsx` — one new `<Route>` line.
- `src/pages/DevReportPreview.tsx` — sandbox detection, normalization redirect, Helmet, banner.

### Verdict target
READY FOR LOVABLE SANDBOX VISUAL QA — assuming the harness build passes (it runs automatically).
