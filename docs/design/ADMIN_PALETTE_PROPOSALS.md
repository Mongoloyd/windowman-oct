# Admin Dashboard — Dark Canvas / Light Surface Palette Proposals

**Status:** Recovered design proposal and historical visual evidence. None of the palettes in this
document is implemented on `forensic_report_v2` at baseline
`b8e1cdf8fe83c83a8cf4cb3382ba68ad966fdb65`.

Palette 4 — Strategic Cobalt — was the preferred direction in the recovered design exercise. Any
implementation requires a separate approved UI sprint and fresh accessibility and route-boundary
verification against the then-current tree.

**Scope proposed:** `/admin/*` routes and admin components only.
**Out of scope:** Public homeowner flows, scanner/report skins, and the partner dashboard
(`PartnerLayout` must remain on its existing system unless separately approved).

**Proposed architecture:** Deep blue **canvas** (page background plus optional chrome) → **pure
white / ultra-light** card surfaces → **dark slate/black** typography inside cards → **vivid
semantic** colors for status, warnings, and metric deltas.

---

## Current repository truth

At the recovery baseline:

- `src/components/admin/shell/AdminShell.tsx` still renders
  `wm-dashboard-surface min-h-screen bg-white text-slate-950`.
- No `.wm-admin-canvas` or `.wm-admin-chrome` implementation exists under `src/`.
- No `AdminCanvasScreen` component exists under `src/`.
- The historical route and contrast results later in this document came from an unpublished local
  design experiment. They do not verify the current branch.

This document is design reference only. It does not authorize or imply runtime, route,
authentication, or styling changes.

## Proposed tokens

The recovered preferred direction proposed defining these variables on a future, admin-scoped
`.wm-admin-canvas` selector in `src/index.css`. They are not present on the current baseline, and
nothing should be added to `:root` as part of this proposal.

| Variable | Proposed value | Proposed use |
|----------|----------------|--------------|
| `--wm-admin-canvas` | `213 55% 10%` (`#0B1828`) | page background |
| `--wm-admin-chrome` | `213 50% 13%` (`#111E31`, `/0.92` where backdrop-filter is supported) | sticky header |
| `--wm-admin-canvas-border` | `212 34% 26%` | chrome borders |
| `--wm-admin-on-canvas` | `210 40% 96%` | titles on the canvas |
| `--wm-admin-on-canvas-muted` | `213 27% 82%` | body copy on the canvas |

**Proposed entry points**

| Class / component | Intended scope |
|---|---|
| Future `.wm-admin-canvas` plus `.wm-admin-chrome` in `AdminShell.tsx` | `/admin/*` pages rendered through the shell |
| Possible future `AdminCanvasScreen.tsx` using `.wm-admin-canvas` only | shell-less admin pages such as login, forgot-password, reset-password, and health |

The recovered design proposed omitting `wm-dashboard-surface` from a possible
`AdminCanvasScreen`, because that shared layer restyles form controls and its card-shadow rule can
outrank `button:focus-visible`. This is a design warning, not a current implementation fact.

## Proposed usage rules

1. **Cards keep their own text colours.** The canvas should set a background only. Do not add a
   blanket text-colour rule to `.wm-admin-canvas`; it could wash out text inside white and pale
   panels.
2. **Text directly on the canvas should opt in** through dedicated title and body classes. Existing
   dark text utilities can become unreadable on a dark canvas.
3. **Surfaces that sit directly on the canvas should be opaque.** A translucent tint can let the
   dark canvas through and reduce label contrast. Tints inside a white card can remain independent.
4. Any opacification of shared destructive or card utilities must remain admin-scoped.
5. Danger text on pale panels must meet contrast requirements without changing global semantic
   tokens used by public and partner surfaces.
6. Portal content such as dialogs, popovers, and sheets needs explicit verification because it may
   render outside the canvas.
7. Use solid semantic tokens on dark canvas and soft semantic tokens on white cards.

---

## Palette 1 — Midnight Fintech

**One-line fit:** Cold navy and surgical white surfaces suggest institutional trading terminals:
calm, authoritative, and suitable for dense KPI reading sessions.

| Role | Tailwind (suggested) | Hex |
|------|----------------------|-----|
| **Canvas** | `bg-[#0B1220]` or `bg-slate-950` | `#0B1220` |
| **Surface (cards/modals)** | `bg-white` | `#FFFFFF` |
| **Surface alt (nested panels)** | `bg-slate-50` | `#F8FAFC` |
| **Primary text (in cards)** | `text-slate-950` | `#020617` |
| **Secondary text (in cards)** | `text-slate-700` | `#334155` |
| **Success** | `text-emerald-600` / soft: `bg-emerald-100 text-emerald-950 border-emerald-300` | `#059669` |
| **Danger** | `text-red-600` / soft: `bg-red-100 text-red-950 border-red-300` | `#DC2626` |
| **Warning (amber)** | `text-amber-600` / soft: `bg-amber-100 text-amber-950 border-amber-300` | `#D97706` |
| **Metric highlight (yellow)** | `text-yellow-500` / soft: `bg-yellow-100 text-yellow-950 border-yellow-300` | `#EAB308` |
| **Interactive accent** | `text-blue-400` / `bg-blue-600` | `#2563EB` |

---

## Palette 2 — Deep Ocean Enterprise

**One-line fit:** Saturated midnight blue reads as maritime depth and enterprise stability:
premium without the sterility of a flat gray admin tool.

| Role | Tailwind (suggested) | Hex |
|------|----------------------|-----|
| **Canvas** | `bg-blue-950` | `#172554` |
| **Surface** | `bg-white` | `#FFFFFF` |
| **Surface alt** | `bg-zinc-50` | `#FAFAFA` |
| **Primary text** | `text-gray-950` | `#030712` |
| **Secondary text** | `text-gray-700` | `#374151` |
| **Success** | `text-green-600` / soft: `bg-green-100 text-green-950 border-green-300` | `#16A34A` |
| **Danger** | `text-rose-600` / soft: `bg-rose-100 text-rose-950 border-rose-300` | `#E11D48` |
| **Warning** | `text-amber-500` / soft: `bg-amber-100 text-amber-950 border-amber-300` | `#F59E0B` |
| **Metric highlight** | `text-lime-500` / soft: `bg-lime-100 text-lime-950 border-lime-300` | `#84CC16` |
| **Interactive accent** | `text-sky-400` / `bg-sky-600` | `#0284C7` |

---

## Palette 3 — Command Indigo

**One-line fit:** Indigo-night canvas with crisp white modules signals control-room intelligence
for an operations-heavy admin with many simultaneous status streams.

| Role | Tailwind (suggested) | Hex |
|------|----------------------|-----|
| **Canvas** | `bg-indigo-950` | `#1E1B4B` |
| **Surface** | `bg-white` | `#FFFFFF` |
| **Surface alt** | `bg-indigo-50/40` on white or `bg-slate-50` | `#F8FAFC` |
| **Primary text** | `text-slate-950` | `#020617` |
| **Secondary text** | `text-slate-600` | `#475569` |
| **Success** | `text-emerald-500` / soft: `bg-emerald-50 text-emerald-900 border-emerald-200` | `#10B981` |
| **Danger** | `text-red-500` / soft: `bg-red-50 text-red-900 border-red-200` | `#EF4444` |
| **Warning** | `text-orange-500` / soft: `bg-orange-100 text-orange-950 border-orange-300` | `#F97316` |
| **Metric highlight** | `text-yellow-400` / soft: `bg-yellow-50 text-yellow-900 border-yellow-200` | `#FACC15` |
| **Interactive accent** | `text-indigo-300` / `bg-indigo-600` | `#4F46E5` |

---

## Palette 4 — Strategic Cobalt (preferred recovered proposal)

**One-line fit:** Anchors to existing WindowMan cobalt authority (`--color-cobalt` / primary blue)
while proposing a deep blue-black admin canvas.

| Role | Tailwind (suggested) | Hex |
|------|----------------------|-----|
| **Canvas** | `bg-[#0C1929]` | `#0C1929` |
| **Surface** | `bg-white` | `#FFFFFF` |
| **Surface alt** | `bg-slate-50` | `#F8FAFC` |
| **Primary text** | `text-slate-950` | `#020617` |
| **Secondary text** | `text-slate-700` | `#334155` |
| **Success** | `text-emerald-600` / soft: `bg-emerald-100 text-emerald-950 border-emerald-300` | `#059669` |
| **Danger** | `text-red-700` / soft: `bg-red-100 text-red-950 border-red-300` | `#C62828` |
| **Warning** | `text-amber-600` / soft: `bg-amber-100 text-amber-950 border-amber-300` | `#F59E0B` |
| **Metric highlight** | `text-yellow-600` / soft: `bg-yellow-100 text-yellow-950 border-yellow-300` | `#D4A017` |
| **Interactive accent** | `text-blue-500` / `bg-blue-600` | `#2563EB` |

---

## Palette 5 — North Atlantic Slate-Blue

**One-line fit:** Blue-slate canvas between navy and graphite provides high contrast for white
cards while avoiding a generic purple or indigo appearance.

| Role | Tailwind (suggested) | Hex |
|------|----------------------|-----|
| **Canvas** | `bg-[#152238]` or `bg-slate-900` | `#152238` |
| **Surface** | `bg-white` | `#FFFFFF` |
| **Surface alt** | `bg-gray-50` | `#F9FAFB` |
| **Primary text** | `text-gray-950` | `#030712` |
| **Secondary text** | `text-gray-600` | `#4B5563` |
| **Success** | `text-teal-600` / soft: `bg-teal-100 text-teal-950 border-teal-300` | `#0D9488` |
| **Danger** | `text-red-600` / soft: `bg-red-100 text-red-950 border-red-300` | `#DC2626` |
| **Warning** | `text-amber-600` / soft: `bg-amber-100 text-amber-950 border-amber-300` | `#D97706` |
| **Metric highlight** | `text-yellow-500` / soft: `bg-amber-50 text-amber-900 border-amber-200` | `#EAB308` |
| **Interactive accent** | `text-cyan-400` / `bg-cyan-600` | `#0891B2` |

---

## Quick comparison

| Name | Canvas character | Best if you want… |
|------|------------------|-------------------|
| Midnight Fintech | Near-black navy | Maximum contrast and financial-terminal sobriety |
| Deep Ocean Enterprise | `blue-950` | Classic enterprise blue with approachable depth |
| Command Indigo | `indigo-950` | Distinct operations/control-room identity |
| Strategic Cobalt | Custom `#0C1929` plus cobalt CTAs | Continuity with WindowMan's public primary blue |
| North Atlantic Slate-Blue | Blue-gray `#152238` | Premium restraint without purple/indigo |

---

## Current styling considerations for a future redesign

| Area | Current baseline | Implication for a future redesign |
|------|------------------|-----------------------------------|
| Shell | `AdminShell.tsx` uses `wm-dashboard-surface min-h-screen bg-white text-slate-950` | A dark canvas would be a new implementation, not a token switch |
| Scoped CSS | `.wm-dashboard-surface` establishes the existing light dashboard layer | New admin-only classes must avoid changing shared behavior |
| Shared-class risk | `PartnerLayout.tsx` also uses `.wm-dashboard-surface` | Split admin from partner instead of redefining the shared class |
| Semantic badges | Admin uses soft-fill/dark-text status pairs | Verify both on-card and any future on-canvas variants |
| Route boundary | `AdminRoutes.tsx` mounts admin routes under `/admin/*` | Any future theme must remain below the admin boundary |

## Protected boundary checklist for any future implementation

- Do not change `:root` tokens used by public routes.
- Do not apply the dark canvas to `src/components/partner/PartnerLayout.tsx`.
- Keep new variables and classes admin-scoped.
- Preserve semantic badge readability across admin tables and identity surfaces.
- Do not change forms, handlers, redirects, session handling, authorization, or error semantics as
  part of a visual palette sprint.
- Verify public homeowner flows and scanner/report skins remain unchanged.
- Treat auth-gate and shell-less admin screens as separate review surfaces.

## Historical design evidence (not current verification)

The recovered source recorded a local, unpublished Strategic Cobalt experiment. It reported checks
at 1024 px and selected 390 px mobile layouts, including contrast measurements against WCAG AA
thresholds. Routes examined included admin authentication, health, command-center, leads, launch,
pipeline, routing, contractor, attribution, signal-dispatch, OTP operations, and outcome surfaces.

Those observations are retained only as historical design evidence:

- They do not establish current-route behavior.
- The supporting runtime and style changes are absent from this baseline.
- They must not be cited as proof that the proposal is implemented or accessible now.
- A future implementation must rerun accessibility, focus, portal, loading, empty, error, and
  responsive checks from the then-current code.

The historical exercise also noted risks around shared `wm-dashboard-surface` specificity,
shell-less authorization screens, a shared app-level suspense fallback, and authenticated-only
admin states. These are investigation prompts for a future sprint, not confirmed defects or
current acceptance results.
