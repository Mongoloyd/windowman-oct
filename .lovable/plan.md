# Phase 10 — Pilot Ops Human Context Layer  
  
1. Human context capture mounts only after verified full report unlock.

2. Handoff consent copy and status mapping are fixed.

3. Phase 10 is operator-only unless explicitly stated otherwise.

4. leads owns property + handoff; diagnosis_intakes owns motivation; routes own assignment.

5. opening script uses full_json.topFindings first, never preview_json or invented findings.

## Audit Summary (real repo, no guesses)

**What already exists and we will reuse:**

- `diagnosis_intakes` table captures `primary_diagnosis` (price_shock, trust_breakdown, financial, timing, scope_mismatch, other), `secondary_clarifiers`, `counter_offer`, `window_intelligence`, `confidence`, `prescription_path`. This is our **motivation source of truth**. Already wired via `submit-diagnosis-intake` and `useDiagnosticIntake`.
- `leads` table already has: `timeline_bucket`, `intent`, `urgency_score`, `qualification_status`, `qualification_answers_json`, `homeowner`, `report_help_call_requested_at`, `last_call_intent`, `last_call_booking_intent`, `appointment_booked_at`, `report_unlocked_at`, `phone_verified_at`, `routed_to_contractor_at`.
- `contractor_opportunities`: `homeowner_contact_released_at`, `release_ready`, `internal_notes`, `last_call_intent`, `brief_text/json`.
- `contractor_opportunity_routes`: `route_status`, `release_status`, `contact_released`, `interested_at`, `routing_reason`, `response_notes`.
- Operator dossier: `src/pages/AdminLeadDossierPage.tsx` (route `/admin/leads/:id`), with `LeadStatusPanel`, `LeadNotesPanel`, `LeadTasksPanel`, `LeadTimelinePanel`.
- Routing surface: `src/components/admin/RoutingDesk.tsx`.
- Backend: `supabase/functions/admin-data/index.ts` already serves `fetch_lead_detail`. We extend it to also return `diagnosis_intake`, latest `opportunity`, latest `route`, and the `analysis` summary in one round-trip.

**Gaps (small, real):**

- `leads`: no `property_type`, no `hoa_or_condo_complexity`, no explicit `handoff_consent_status`.
- No persisted "expected contractor name" per lead (today it's only on the route).
- No deterministic opening script generator on the operator side (the homeowner-side `prescriptionSetup` is marketing copy, not a contractor cold-call opener).

**Decision:** add the **smallest** safe migration (3 nullable columns on `leads`), reuse everything else, and compute the opening script + lead-fit warnings client-side from already-canonical data.

## Data Model Decision

**Migration (single file, all nullable, no defaults that break existing rows):**

```sql
-- 20260424_add_human_context_to_leads.sql
alter table public.leads
  add column if not exists property_type_detail text,        -- single_family | condo | townhouse_villa | high_rise | multifamily_investment
  add column if not exists hoa_or_condo_complexity text,     -- none | hoa_simple | hoa_complex | high_rise_engineering | unknown
  add column if not exists handoff_consent_status text;      -- accepted_today | accepted_tomorrow | text_or_email_first | report_only | unknown

comment on column public.leads.property_type_detail is 'Phase 10: human-context property type for contractor brief';
comment on column public.leads.hoa_or_condo_complexity is 'Phase 10: HOA / engineering approval complexity hint for contractor';
comment on column public.leads.handoff_consent_status is 'Phase 10: explicit homeowner consent for warm contractor handoff';
```

`leads.property_type` already exists but is free-form / unused — we keep it untouched and add the constrained `property_type_detail` to avoid breaking the current scanner pipeline. `leads.timeline_bucket` is reused as-is for timeline. `diagnosis_intakes.primary_diagnosis` is reused as motivation.

No CHECK constraints (per WindowMan rule — use code-level validation in the edge function instead).

## Files Changed

**New:**

1. `supabase/migrations/20260424_add_human_context_to_leads.sql` — migration above.
2. `src/lib/humanContext.ts` — pure deterministic helpers:
  - `motivationFromDiagnosis(primary_diagnosis) → MotivationLabel`
  - `propertyComplexityHint(property_type_detail, hoa_or_condo_complexity) → string | null`
  - `deriveLeadFitWarnings(lead, intake, route) → LeadFitWarning[]`
  - `buildOpeningScript({ leadFirstName, contractorName, topFlag, motivation, propertyType, timeline, handoffConsent }) → string` — deterministic, rule-based (no AI).
3. `src/components/admin/lead-workspace/LeadHumanContextPanel.tsx` — the "Human Context" card (motivation, property, timeline, handoff status, fit warnings, opening script, copy-to-clipboard).
4. `src/components/HomeownerHumanContext/PropertyAndConsentStep.tsx` — small post-report capture (3 questions: property type + HOA complexity + handoff consent). Mounts at the report-CTA point, **never** before OTP unlock, **never** blocking the report.
5. `src/lib/humanContext.test.ts` — vitest unit tests for `buildOpeningScript` and `deriveLeadFitWarnings` (deterministic, no network).

**Modified:**
6. `supabase/functions/admin-data/index.ts` — extend `fetch_lead_detail` to also return `{ lead, diagnosis_intake, latest_opportunity, latest_route }` in one payload (no new action needed; same role gate). Add new write action `update_lead_human_context` (super_admin/operator) that updates the 3 new columns + writes a `lead_events` audit row.
7. `src/services/adminDataService.ts` — add typed `update_lead_human_context` action + `updateLeadHumanContext()` helper. Update `fetchLeadDetail` return type to include the 3 joined objects.
8. `src/pages/AdminLeadDossierPage.tsx` — render `<LeadHumanContextPanel />` directly under the Intake card in the left column. Pass through the new joined data from the extended `fetch_lead_detail`.
9. `src/components/admin/RoutingDesk.tsx` — add 4 compact badges per row: Timeline (from `lead.timeline_bucket`), Property (from `lead.property_type_detail`), Handoff (from `lead.handoff_consent_status`), Motivation (from joined `diagnosis_intakes.primary_diagnosis`). Tooltips for full text. No layout rewrite; badges slot into the existing row meta strip.
10. `src/pages/diagnosis/components/SuccessScreen.tsx` (or the post-report CTA host — confirmed during impl) — mount `<PropertyAndConsentStep />` as an optional "Help your contractor prep" step. Skippable. Persists via a new public edge function call `update-homeowner-context` that writes only to the homeowner's own `lead_id` derived from a verified scan session token (no contractor exposure, no full-report leak).
11. New edge function `supabase/functions/update-homeowner-context/index.ts` — accepts `{ lead_id, scan_session_id, property_type_detail, hoa_or_condo_complexity, handoff_consent_status }`, validates the `scan_session_id ↔ lead_id` binding, validates enum values server-side, updates only those 3 columns. Mirrors the security shape of `submit-diagnosis-intake`.

**Not changed:** scanner brain, scoring, OTP, Twilio, Verify-to-Reveal, RLS, preview/full split, contractor portal, any edge function not listed above.

## Operator Dossier — Human Context card layout

```text
┌────────────────────────────────────────────────────────────┐
│ HUMAN CONTEXT                                              │
│                                                            │
│ MOTIVATION                                                 │
│  Price felt high  ·  unclear scope                         │
│  (from homeowner diagnosis intake · 2h ago)                │
│                                                            │
│ PROPERTY                                                   │
│  Single-family · Broward County · HOA: simple              │
│                                                            │
│ TIMELINE                                                   │
│  Wants to move forward this month   [URGENT]               │
│                                                            │
│ HANDOFF STATUS                                             │
│  ✓ Warm handoff accepted — call today                      │
│  Homeowner was told: "A WindowMan-vetted contractor may    │
│  call today to review a same-scope option."                │
│                                                            │
│ LEAD FIT WARNINGS                                          │
│  • None                                                    │
│                                                            │
│ RECOMMENDED OPENING                                        │
│  "Hi Sarah, this is Mike with ABC Windows. WindowMan      │
│  asked me to review the quote you scanned. The main thing │
│  I noticed is your current quote does not clearly show    │
│  the NOA and installation scope, so I wanted to help you  │
│  compare apples-to-apples before you sign anything."      │
│  [Copy script]                                             │
└────────────────────────────────────────────────────────────┘
```

Fallback copy when fields are missing matches the spec exactly ("Motivation not captured yet", "Property type unknown — ask first", "Timeline unknown", "No explicit contractor handoff captured").

## Routing Desk — compact signals

Added to the existing row meta strip (no column rewrite):

- `[ASAP]` / `[This month]` / `[Researching]` chip from `timeline_bucket`
- `[Condo]` / `[High-rise]` chip when complexity ≠ `none` / `unknown`
- `[Warm: today]` / `[Warm: tomorrow]` / `[Text first]` / `[Report only]` chip from `handoff_consent_status`
- `[Price]` / `[Trust]` / `[Scope]` / `[Insurance]` chip from `primary_diagnosis`

`Report only` rows render with a muted ring and a tooltip: "Do not call as warm lead — homeowner requested report only." Routing actions remain enabled (operator override allowed) but the default "Send to contractor" CTA is replaced with "Send report only".

## Opening Script — deterministic rules (no AI)

```text
greeting   = "Hi {firstName ?? 'there'}, this is {contractorName ?? 'your assigned contractor'}"
preamble   = handoff_consent_status === 'report_only'
              ? "I'm following up on the report you requested from WindowMan."
              : "WindowMan asked me to follow up on the quote you scanned."
hook       = topFlag ? `The main thing I noticed is ${topFlag.flag}` : null
condoLine  = (property_type_detail ∈ {'condo','high_rise'}) || hoa_complex
              ? "Before we talk price, I want to confirm the HOA / engineering requirements."
              : null
focusLine  = match(primary_diagnosis):
              price_shock      → "so I want to walk you through an apples-to-apples comparison."
              trust_breakdown  → "and I'll keep this clear and pressure-free."
              financial        → "and I'll show you payment paths that actually fit."
              scope_mismatch   → "so we get the scope right before quoting."
              timing           → "no pressure on timing — I just want you informed."
              other / null     → "so you can compare on facts, not pressure."
urgencyTag = timeline_bucket ∈ {'asap','this_month'} ? '[URGENT]' : ''
```

Output is a 2–3 sentence script. Pure function, fully unit-tested, no network calls.

## Lead Fit Warnings — deterministic rules


| Condition                                                   | Warning                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `property_type_detail ∈ {condo, high_rise}`                 | Complex approval path — confirm HOA/engineering requirements before quoting. |
| `timeline_bucket = 'researching'`                           | Low immediate urgency — nurture before dispatching senior sales rep.         |
| `handoff_consent_status = 'report_only'`                    | Do not call as warm lead. Homeowner requested report only.                   |
| `property_type_detail` is null                              | Property type unknown — ask early before discussing price.                   |
| `primary_diagnosis = 'price_shock'` AND no scope clarifiers | Possible price shopper — lead with scope/value comparison, not discounting.  |


## Security / Verify-to-Reveal Compliance

- Capture step is shown **only after** `phone_verified_at` and report unlock (mounted at the post-report CTA).
- New `update-homeowner-context` edge function rebinds `lead_id` to the verified `scan_session_id` server-side. No lead can update another lead.
- Operator panel uses the existing `is_internal_operator()` RLS path via `admin-data`. No new RLS policies required.
- Contractor portal is **not** touched; contractors never get raw human-context fields. The opening script is rendered only inside operator-scoped surfaces (Dossier + Routing Desk).
- No change to scoring, OTP, Twilio, `scan-quote`, `send-otp`, `verify-otp`, `capi-event`, or report payload boundaries.

## Pass / Fail Checklist (target state)

- Human context captured from homeowner flow (post-report, optional)
- Persists to `leads` (3 cols) + reuses `diagnosis_intakes`
- Dossier shows Motivation, Property, Timeline, Handoff Status, Opening Script
- Routing Desk exposes compact badges
- Warm handoff status explicit (chip + dossier copy)
- Report-only users surfaced and de-emphasized in routing CTA
- Opening script is deterministic and context-aware (unit tested)
- Missing-data fallbacks match spec copy
- Scanner / OTP / Twilio / Verify-to-Reveal preserved
- No contractor blanket access; operator-scoped only
- No full report exposure pre-verification
- No unrelated dashboard redesign

---

## Principal Product Strategy Review — Top 3 Contractor-Value Features

> **Lens:** what makes a Florida impact-windows contractor say "I'd pay $X to be the first call on this lead" — beyond the forensic findings already in the report.

### 1. **"Same-Scope Re-Quote Sheet" — auto-generated apples-to-apples bid template**

**Why this closes the trust gap:**
The #1 reason contractors lose pilot leads is that the re-quote conversation devolves into "your price vs. their price." A South Florida contractor wins when they can say: "Here is the **same scope**, line for line, priced honestly." Right now we hand them prose findings — they still have to mentally translate that into a bid.

**What it is:**
A one-page printable / PDF-able sheet auto-derived from `analyses.full_json` + `diagnosis_intakes.window_intelligence` containing:

- Window-by-window opening list (count, type, dimensions if present)
- Required NOA/DP rating per opening (from county + project type)
- Permit / inspection line item explicitly called out
- Warranty terms the original quote was missing (as required line items the contractor must include)
- A blank price column

The contractor walks in with the homeowner's own scan, and a sheet that says "fill in honest numbers next to each line." The homeowner experiences *transparency theater* — the contractor experiences a closing tool.

**Tech path (existing schema):**

- Read `analyses.full_json` (already canonical) + `analyses.flags` (missing-spec flags become required line items)
- Join `county_benchmarks` for NOA/DP context per `lead.county` + `project_type`
- Render server-side in a new edge function `generate-rescope-sheet` (HTML → printable). Stored as a signed-URL artifact, never inlined into routes.
- Surface in the Dossier under Human Context as **"Generate Re-Quote Sheet"** button.
- No new tables. ~1 migration column on `contractor_opportunities` to cache `rescope_sheet_url` + `generated_at` for idempotency.

---

### 2. **Buyer Seriousness Score (BSS) — composite signal, not vanity**

**Why this closes the trust gap:**
Contractors burn out on "lead products" because they can't tell a tire-kicker from a buyer until call #3. We already have the raw signals. We've never composed them.

**What it is:**
A 0–100 score + a single-letter band (A/B/C/D) computed deterministically from:

- `phone_verified_at` present (+25, hard floor — unverified caps at C)
- `timeline_bucket ∈ {asap, this_month}` (+20)
- `handoff_consent_status = accepted_today` (+15)
- `last_call_completed_at` within 7d AND `last_call_booking_intent = true` (+15)
- `appointment_booked_at` not null (+15) — auto-A
- `diagnosis_intakes.counter_offer.terms_selected.length >= 2` (+10) — homeowner is *negotiating*, not browsing
- `quote_amount` populated AND `window_count >= 8` (+10)
- Penalty: `primary_diagnosis = timing` AND `timeline_bucket = researching` (-20)

A Florida contractor sees `BSS: 87 (A) — verified, this-month buyer, accepted warm handoff` and they call **first**. Today they have to read 6 fields to figure that out.

**Tech path (existing schema):**

- 100% deterministic TypeScript in `src/lib/buyerSeriousness.ts` (consistent with WindowMan rule: scoring is code, not AI).
- No migration. Compute on read in `fetch_lead_detail` so it's also exposed to Routing Desk for sorting.
- Add `priority_score` is already on `contractor_opportunities` — we either map BSS → `priority_score` on the next routing event, or display alongside (recommend display alongside; never overwrite a server-set score).
- Surface as a single chip on every Routing Desk row + a hero tile in the Dossier.

---

### 3. **One-Click "Warm Intro Text" — friction removal worth 5 minutes per lead**

**Why this saves operator time:**
Today the operator has to: open the dossier → copy homeowner first name → copy contractor name → write "Hey Sarah, this is John from ABC Windows, WindowMan asked me to follow up…" → switch to Twilio/RingCentral/SMS app → paste → send. Five minutes. Per lead. Multiplied across the pilot, that's the entire reason routing throughput stalls.

**What it is:**
A single button on the Dossier: **"Send warm intro text to homeowner"**. It uses the deterministic opening script we're already generating (Phase 10 above), strips it to SMS-length, and sends it from the **WindowMan-owned** Twilio number to the verified `phone_e164` — *then* texts the contractor a separate message: "Sarah just got a heads-up from us. Call her in the next 30 min. Script: [link to dossier]."

The homeowner gets warm permission. The contractor gets a hot timer. The operator gets back 5 minutes.

**Tech path (existing schema):**

- New edge function `send-warm-intro` that:
  1. Verifies operator role via existing `is_internal_operator()`.
  2. Re-checks `lead.phone_verified_at IS NOT NULL` (no SMS to unverified phones, ever).
  3. Re-checks `handoff_consent_status ∈ {accepted_today, accepted_tomorrow}` — **fail-closed** if `report_only` or null.
  4. Sends two Twilio messages (homeowner + contractor) using the existing Twilio creds already wired for `send-otp`. **Reuse the Twilio client; do not introduce a new SMS path.**
  5. Writes a `lead_events` row `warm_intro_sent` with both message SIDs.
- New columns on `contractor_opportunity_routes`: `warm_intro_sent_at timestamptz`, `warm_intro_message_sid text`. Both nullable.
- Idempotency: button disables for 60 min after `warm_intro_sent_at`.

This is the single highest-leverage UX action in the entire CRM. It also creates a **measurable conversion event** (`warm_intro_sent → contractor_first_call_within_30min`) — i.e. it doubles as a pilot-ops KPI.

---

**Sequencing recommendation:** ship Phase 10 (Human Context Layer) first because both Buyer Seriousness Score and Warm Intro depend on `handoff_consent_status` and `property_type_detail` being captured. Then BSS (1 day, pure read-side), then Re-Quote Sheet (2–3 days, new edge function + PDF), then Warm Intro (2 days, gated on Twilio reuse audit).