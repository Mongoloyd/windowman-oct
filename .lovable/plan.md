# SYSTEM COMMAND: MISSION CONTROL TRUTH STRIP — FINAL BUILD PLAN

MODE: strict / anti-hallucination / admin-only / no-rebuild / smallest-safe-diff / build-must-end-green

IMPORTANT:

This prompt supersedes earlier Mission Control plans.

Do NOT rethink the architecture.

Do NOT propose a new direction.

Do NOT run another strategy cycle.

Execute this exact build plan.

You are not rebuilding Mission Control.

You are finishing and canonicalizing the existing implementation with the least blast radius.

==================================================

CANONICAL OBJECTIVE

==================================================

Complete the existing `MasterCommandCenter` so it becomes the single canonical admin funnel surface and gains a zero-friction forensic drilldown for:

- Evidence

- Logic

- Jump-to-Dossier

This is an additive admin-only upgrade.

Do NOT touch:

- schema / migrations

- scanner flow

- `scan-quote`

- `send-otp`

- `verify-otp`

- Twilio

- partner UI

- partner dossier

- public pages

- storage bucket definitions

- RLS rules

==================================================

CANONICAL REPO TRUTHS — ACCEPT THESE

==================================================

1. `MasterCommandCenter.tsx` already owns the canonical Truth Strip:

   - scope toggle

   - prior-period deltas

   - closed revenue using `closed_at` + canonical closed statuses + `COALESCE(deal_value, revenue_amount, 0)`

   - daily goal in localStorage

   Keep all of that.

2. The current bug is:

   - “Scanned” is still derived from a `latest_analysis_id` proxy

   - it must switch to the repo-real rule:

     `scan_count > 0` AND `updated_at` in scope

3. The current contradiction is:

   - `AdminDashboard.tsx` still mounts the legacy `<CommandCenter />` under the `command` tab

   - legacy `CommandCenter.tsx` and `ConversionFunnel.tsx` still compute cached/string-style funnel logic

   - this creates two visibly disagreeing funnel systems

4. The current missing feature is:

   - Truth Strip tile clicks do not open the forensic drilldown

   - there is no dedicated admin action for fetching quote evidence by `lead_id`

5. `fetch_lead_analysis` already returns enough Logic payload:

   - `grade`

   - `dollar_delta`

   - `confidence_score`

   - `flags`

   - `full_json`

6. `LeadDossierSheet` is the canonical admin dossier surface.

   Reuse it.

   Do NOT invent a new dossier.

==================================================

CRITICAL RISK LOCKS — MANDATORY

==================================================

RISK LOCK 1 — QUOTE EVIDENCE LOOKUP

Do NOT guess the `quote_files` schema.

Do NOT assume columns such as:

- `created_at`

- `file_name`

- any ordering column

unless explicitly verified in the repo.

You must mirror the exact working quote-file resolution path already used in the existing `fetch_needs_review` admin-data code path.

Safe rule:

- start from `leads.latest_scan_session_id`

- resolve the linked quote file using the same join pattern already present

- only use already-verified storage fields needed to generate the signed URL

- if friendly filename metadata is not clearly present, return `file_name: null`

- do NOT invent a new lookup path

- do NOT invent “latest quote file” logic based on guessed timestamps

RISK LOCK 2 — LEGACY IMPORT / TEST SURFACE

Do NOT delete `CommandCenter.tsx` or `ConversionFunnel.tsx` in this pass unless you verify there are zero remaining imports, tests, or dev references.

Safe rule:

- remove legacy components from visible dashboard mounts first

- mark them `@deprecated`

- preserve exports if there is any uncertainty

- only physically delete them in a later cleanup pass

==================================================

STEP 0 — REQUIRED AUDIT BEFORE BUILD

==================================================

Read and reconcile:

1. `src/components/admin/MasterCommandCenter.tsx`

2. `src/components/admin/CommandCenter.tsx`

3. `src/components/admin/ConversionFunnel.tsx`

4. `src/components/AdminDashboard.tsx`

5. `src/components/admin/types.ts`

6. `src/services/adminDataService.ts`

7. `supabase/functions/admin-data/index.ts`

8. the exact `fetch_needs_review` block that resolves signed quote URLs

9. existing `LeadDossierSheet` usage

10. `src/components/admin/missionControl/exportSnapshot.ts` if present

Before coding, verify:

- the exact quote-file lookup path already working in admin-data

- the minimum verified `quote_files` fields actually used by that path

- whether `CommandCenter.tsx` / `ConversionFunnel.tsx` still have imports or test references

- whether removing the `CommandCenter` mount in `AdminDashboard.tsx` is enough to eliminate visible contradiction

Do not guess.

Do not hallucinate.

Do not silently “clean up” beyond what is required.

==================================================

PHASE 1 — EDGE FUNCTION (ADDITIVE, READ-ONLY)

==================================================

File:

- `supabase/functions/admin-data/index.ts`

Add to:

- `ActionName`

- `ACTION_ROLES`

Roles for both new actions:

- `super_admin`

- `operator`

- `viewer`

----------------------------------------

ACTION A: `fetch_quote_evidence`

----------------------------------------

Payload:

- `{ lead_id: string }`

Return shape:

- `{ signed_url: string | null, file_name: string | null, scan_session_id: string | null, expires_in: 3600 }`

Required behavior:

1. Read `leads.latest_scan_session_id`

2. If null:

   return

   - `signed_url: null`

   - `file_name: null`

   - `scan_session_id: null`

   - `expires_in: 3600`

3. Resolve quote evidence using the exact same proven path already used in `fetch_needs_review`

4. Generate signed URL via the existing `quotes` private bucket pattern

5. If file exists:

   - return `signed_url`

   - return `scan_session_id`

   - return `file_name` only if the repo already exposes verified filename metadata

   - otherwise return `file_name: null`

6. If no file exists:

   - return `signed_url: null`

   - return `file_name: null`

   - return the resolved `scan_session_id`

   - return `expires_in: 3600`

Hard rules:

- do NOT guess new `quote_files` columns

- do NOT guess ordering logic

- do NOT sort by invented `created_at`

- do NOT create new buckets

- do NOT create schema changes

----------------------------------------

ACTION B: `fetch_stage_leads`

----------------------------------------

Payload:

- `{ stage, scope, limit?: number }`

Where:

- `stage` ∈ `"captured" | "verified" | "scanned" | "routed" | "booked" | "closed"`

- `scope` ∈ `"today" | "7d" | "all"`

- default `limit = 200`

Return shape:

- `{ leads: StageLeadRow[] }`

Return compact rows only:

- `id`

- `first_name`

- `last_name`

- `city`

- `county`

- `grade`

- `flag_count`

- `red_flag_count`

- `latest_analysis_id`

- `latest_scan_session_id`

- `latest_opportunity_id`

- `deal_value`

- `revenue_amount`

- `deal_status`

- `stage_timestamp`

Canonical predicates:

- `captured` → `created_at` in scope

- `verified` → `phone_verified_at` in scope

- `scanned` → `scan_count > 0 AND updated_at in scope`

- `routed` → `routed_to_contractor_at in scope`

- `booked` → `appointment_booked_at in scope`

- `closed` → `closed_at in scope AND lower(deal_status) IN ('won','sold','sold_closed','closed_won','closed')`

Use repo-real columns only.

Do NOT invent fields.

Do NOT add schema.

==================================================

PHASE 2 — SHARED FUNNEL ENGINE

==================================================

New file:

- `src/components/admin/missionControl/funnelMetrics.ts`

Extract pure helpers out of `MasterCommandCenter`:

Exports:

- `Scope`

- `StageKey`

- `CLOSED_STATUSES`

- `getScopeWindow(scope)`

- `computeFunnelMetrics(leads, scope)`

- `computeTodayRevenue(leads)`

Requirements:

- `computeFunnelMetrics` returns per-stage:

  - `count`

  - `prevCount`

  - `delta`

  - `deltaPct`

  - `convPct`

- `computeTodayRevenue` must preserve the current closed-revenue logic:

  - `closed_at`

  - canonical sold/won statuses

  - `COALESCE(deal_value, revenue_amount, 0)`

Critical correction:

- the frontend “Scanned” predicate must switch to:

  - `scan_count > 0`

  - AND `updated_at` in scope

Do not widen this into a broader refactor.

==================================================

PHASE 3 — SERVICES + TYPES

==================================================

File:

- `src/services/adminDataService.ts`

Add:

- `fetchQuoteEvidence(leadId)`

- `fetchStageLeads(stage, scope, limit?)`

Extend:

- `AdminAction`

- payload typing

- response typing

File:

- `src/components/admin/types.ts`

Additive only:

- `StageKey`

- `StageLeadRow`

- `QuoteEvidence`

Do not break existing admin types.

==================================================

PHASE 4 — DIAGNOSTIC DRILLDOWN COMPONENT

==================================================

New file:

- `src/components/admin/TruthStripDrilldown.tsx`

Build a right-side `Sheet` with enterprise SaaS / glass styling:

- `w-full sm:w-[640px] lg:w-[820px]`

- `bg-card/95`

- `backdrop-blur-md`

Props:

- `open`

- `onOpenChange`

- `stage`

- `scope`

- `onJumpToDossier(lead)`

Behavior:

1. Lazy fetch stage leads with React Query:

   - key: `["truth-strip-drilldown", stage, scope]`

   - source: `fetchStageLeads`

2. Header shows:

   - stage label

   - scope

   - total count

3. Each row shows:

   - lead name

   - city/county

   - grade chip

   - flag chips

   - stage timestamp

   - revenue if closed

4. Per-row inline actions:

   Evidence

   - lazy key: `["quote-evidence", leadId]`

   - source: `fetchQuoteEvidence`

   - inline expand

   - render signed image or PDF link

   - on absence: show “No quote on file” + scan session id if present

   Logic

   - lazy key: `["lead-analysis", analysisId]`

   - source: existing `fetchLeadAnalysis`

   - inline expand

   - render:

     - grade

     - confidence

     - flag counts

     - top 5 flags

   Jump to Dossier

   - call `onJumpToDossier(lead)`

   - parent closes drilldown

   - parent opens `LeadDossierSheet`

Context retention rule:

The operator stays inside Mission Control unless they explicitly click Jump to Dossier.

==================================================

PHASE 5 — MASTER COMMAND CENTER WIRING

==================================================

File:

- `src/components/admin/MasterCommandCenter.tsx`

Required changes:

1. Replace the inline `funnelMetrics` `useMemo` with:

- `computeFunnelMetrics(leads, scope)`

2. Replace the scanned proxy:

- old behavior tied to `latest_analysis_id`

- new behavior must use `scan_count > 0`

3. Add local state:

- `drilldownStage: StageKey | null`

- `dossierLead: CRMLead | null`

4. Each `KpiTile.onClick` must open drilldown:

- `captured`

- `verified`

- `scanned`

- `routed`

- `booked`

- `closed`

Do NOT change the Quick-Action HUD links.

5. Mount at the bottom of the return tree:

- `<TruthStripDrilldown />`

- existing `<LeadDossierSheet />`

6. Keep current closed revenue logic unchanged.

7. CSV snapshot:

- additive only

- include per-stage `delta`

- include per-stage `convPct`

- do NOT remove existing fields

==================================================

PHASE 6 — ELIMINATE LEGACY CONTRADICTION

==================================================

File:

- `src/components/AdminDashboard.tsx`

Required change:

- remove the visible `<CommandCenter ... />` contradiction from the `command` tab

- replace it with `<MasterCommandCenter />`

- keep `OneContractorSummaryStrip`

- keep `MarketOpsFeed`

Goal:

The admin dashboard must not show two visible funnel engines that disagree.

Files:

- `src/components/admin/CommandCenter.tsx`

- `src/components/admin/ConversionFunnel.tsx`

Required handling:

- prepend `@deprecated` JSDoc

- point to `MasterCommandCenter` + `funnelMetrics.ts`

- preserve exports unless import graph is proven clean

Do NOT delete these files in this pass unless you explicitly verify zero remaining imports/tests/dev references.

==================================================

FILES TO CHANGE

==================================================

Required:

- `supabase/functions/admin-data/index.ts`

- `src/services/adminDataService.ts`

- `src/components/admin/types.ts`

- `src/components/admin/MasterCommandCenter.tsx`

- `src/components/AdminDashboard.tsx`

Create:

- `src/components/admin/missionControl/funnelMetrics.ts`

- `src/components/admin/TruthStripDrilldown.tsx`

Update if needed:

- `src/components/admin/missionControl/exportSnapshot.ts`

- `src/components/admin/CommandCenter.tsx`

- `src/components/admin/ConversionFunnel.tsx`

==================================================

OUT OF SCOPE — EXPLICITLY UNTOUCHED

==================================================

- schema / migrations

- RLS

- storage bucket definitions

- scanner pages

- deterministic scoring engine

- `scan-quote`

- `send-otp`

- `verify-otp`

- Twilio paths

- partner UI

- partner dossier

- `/partner/*`

- public homeowner pages

==================================================

DEFINITION OF DONE

==================================================

- `MasterCommandCenter` is the only visible funnel surface site-wide

- “Scanned” uses `scan_count > 0 AND updated_at in scope`

- every Truth Strip tile opens the drilldown sheet

- drilldown supports Evidence + Logic + Jump-to-Dossier

- `fetch_quote_evidence` uses the exact proven signed-URL path already present in admin-data

- no guessed `quote_files` schema is introduced

- closed revenue logic remains canonical:

  - `closed_at`

  - sold/won statuses

  - `COALESCE(deal_value, revenue_amount, 0)`

- CSV snapshot additively includes per-stage delta and conv%

- legacy contradiction is removed from visible mounts

- legacy files are deprecated, not deleted, unless deletion is explicitly proven safe

- `npx tsc --noEmit` returns 0

==================================================

PRE-COMPLETION CHECKLIST

==================================================

- [ ] Did I reuse the exact existing quote-file signed URL path instead of inventing one?

- [ ] Did I avoid guessing `quote_files` columns?

- [ ] Did I replace the scanned proxy with `scan_count > 0`?

- [ ] Did I remove the visible dashboard contradiction?

- [ ] Did I preserve legacy exports if imports/tests may still exist?

- [ ] Did I avoid deleting files without verifying import safety?

- [ ] Did I keep all changes admin-only?

- [ ] Did I run `npx tsc --noEmit` and fix all errors?

DO NOT MARK COMPLETE UNTIL THE BUILD IS GREEN.

==================================================

FINAL REPORT REQUIRED

==================================================

When finished, report:

1. exact quote evidence resolution path used

2. verified `quote_files` fields actually used

3. whether legacy files were deprecated vs deleted

4. how the visible contradiction was removed

5. exact scanned predicate used

6. files changed

7. CSV snapshot additions

8. `npx tsc --noEmit` result

9. any remaining risks

&nbsp;