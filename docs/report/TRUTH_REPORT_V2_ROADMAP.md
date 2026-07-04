# WindowMan Truth Report V2 — Visual + Data Presentation Roadmap

## Purpose

This document is the master architectural blueprint for the remaining Truth Report V2 visual and data-presentation work.

It exists to help Cursor, Claude, and future AI coding agents understand:

- the current report architecture
- the Verify-to-Reveal security model
- protected system boundaries
- completed sprint history
- remaining sprint sequence
- success criteria for each sprint
- what files must be protected
- what kinds of suggestions are allowed
- what must never be changed without explicit approval

This document is **not an implementation prompt**.

Do not execute from this document directly.  
Each sprint must be converted into its own focused ASK / PLAN / AGENT prompt before any code changes.

---

# 1. Canonical Product Spine

WindowMan is a Verify-to-Reveal quote-intelligence system.

Canonical flow:

```txt
lead/intake
→ private quote upload
→ quote metadata
→ scan session
→ scan-quote
→ analysis persistence
→ safe preview
→ OTP
→ backend-authorized full report access
→ full Truth Report reveal
→ downstream contractor/admin/action flows
```

Permanent rules:

- Preview before OTP is allowed.
- Full report before OTP is forbidden.
- `full_json` must never be fetched, preloaded, logged, cached, stored in localStorage, or sent to the browser before backend authorization.
- CSS hiding, disabled buttons, localStorage, and client route guards are not security.
- Backend authorization decides full report reveal.
- One verified phone / scan session must not unlock another scan session.
- Quote files are private assets.
- Contractor/admin/partner access does not equal homeowner report unlock.
- Dev, visual, and sandbox routes must not become production scanner, OTP, report, or paid-media conversion paths.

---

# 2. Separation of Concerns

## Gemini / AI Layer

Gemini may:

- extract visible evidence
- classify document type
- report extraction confidence
- identify missing visible evidence

Gemini must not:

- invent values
- determine final grade
- determine pillar scores
- determine markup risk
- determine price fairness
- calculate hard caps
- authorize report access
- decide what appears before OTP

## Deterministic TypeScript Layer

TypeScript owns:

- validation
- financial metrics
- price per opening
- overpayment range
- pillar scoring
- hard caps
- red flag classification
- grades
- report interpretation
- preview/full payload shaping
- source labeling when deterministic

Rule:

```txt
Gemini reads.
TypeScript calculates.
Deterministic scoring judges.
Backend persists.
Frontend renders.
```

## Backend / Report Access Layer

Backend owns:

- full report authorization
- full/preview projection
- service-role boundaries
- storage access
- full report transport
- curated `v2_source` fields
- private quote file boundaries

## React Presentation Layer

React owns:

- visual hierarchy
- source label rendering
- card layout
- OTP/preview UI surface
- full report rendering
- user-facing action layer

React must not:

- decide authorization
- fetch full-only data pre-OTP
- hide full data with CSS as security
- query protected tables directly
- access service-role secrets
- infer protected truth from local state

---

# 3. Current Report Architecture Anchors

Before every sprint, verify the current repo state.

Known components/systems involved:

```txt
src/components/forensic-report/ForensicAuditReport.tsx
src/components/forensic-report/ReportClassicDarkV2Full.tsx
src/components/forensic-report/ReportClassicDarkV2Partial.tsx
src/lib/productionV2ReportHarness.ts
src/hooks/useV2ReportModules.ts
src/components/forensic-report/adapters/reportAccessAdapter.source.ts
src/components/forensic-report/adapters/reportAccessAdapter.types.ts
src/pages/DevReportPreview.tsx
```

Known current behavior to preserve:

- Preview and full branches are separated inside `ForensicAuditReport`.
- Preview mode drops real flags before rendering.
- Full mode renders `PropertyProfileCard`, source labels, and `fullEvidenceStack`.
- `ReportClassicDarkV2Full` builds the evidence stack from V2 modules.
- `ReportClassicDarkV2Partial` must remain protected unless a sprint explicitly authorizes preview work.
- `DevReportPreview` is lab/sandbox only and must not become production behavior.
- Non-PII property context has been promoted to full report using curated adapter data, not raw `full_json`.

---

# 4. Global Protected Systems

The following areas are protected by default.

## Protected Frontend Systems

Do not touch without explicit sprint approval:

```txt
src/components/forensic-report/ReportClassicDarkV2Partial.tsx
src/hooks/useAnalysisData.ts
src/hooks/usePhonePipeline.ts
src/hooks/useReportAccess.ts
src/hooks/useScanPolling.ts
src/services/reportService.ts
src/services/phoneVerificationService.ts
src/pages/ReportClassic.tsx
src/App.tsx
src/main.tsx
src/components/post-scan/PostScanReportSwitcher.tsx
```

## Protected Backend / Supabase Systems

Do not touch without explicit sprint approval:

```txt
supabase/**
supabase/functions/**
supabase/migrations/**
src/integrations/supabase/types.ts
```

## Protected Tracking Systems

Do not touch without explicit sprint approval:

```txt
src/lib/trackConversion.ts
src/lib/trackEvent.ts
src/components/AppTrackingProvider.tsx
```

Tracking rules:

- Business/conversion events flow through `trackConversion`.
- Operational telemetry flows through `trackEvent`.
- Do not hardcode `fbq` or TikTok calls in React components.
- Do not post directly to CAPI from arbitrary browser components.
- High-value conversion events fire only after backing API/server success.

## Protected Environment / Secret Systems

Do not touch without explicit sprint approval:

```txt
.env
.env.local
.env.example
```

Server-only secrets must not live in `.env.local` for normal Vite browser dev.

Server-only secrets belong in Supabase secrets or the appropriate local Edge Function runtime env mechanism.

Never print secret values.

---

# 5. PII Policy Baseline

Until a product owner explicitly changes policy:

## Never render in preview

```txt
homeowner name
phone
email
street address
ZIP
raw full_json
quote file URL
full flags
specific full findings
line item details
contractor questions from full evidence
```

## Never render in report for now

```txt
phone
email
street address
ZIP
raw full_json
```

## Full-only with source label allowed

```txt
code jurisdiction
quote-stated HVHZ
opening mix
benchmark source
quote math confidence
contractor name if quote-visible
quote identity if quote-visible and non-PII
```

## Safe source labels

Only use labels when actually supported by data:

```txt
quote-visible
derived
benchmark reference
not disclosed
manual review recommended
```

Do not invent source labels.  
Do not label fallback county as benchmark-backed.  
Do not infer HVHZ from county, ZIP, city, municipality, or jurisdiction.

---

# 6. Cursor Autonomy Rules

Cursor may suggest improvements, but must classify every suggestion as one of:

```txt
IN-SCOPE NOW
SAFE FOLLOW-UP
REQUIRES ASK AUDIT
REQUIRES PROTECTED APPROVAL
DEFER
DO NOT DO
```

Cursor must not implement suggestions outside the current sprint scope.

If Cursor discovers a better idea while working:

- mention it in final report
- classify risk
- list likely files
- do not implement it unless already in allowed scope

Cursor must stop if:

- file structure differs from assumptions
- a protected file must be edited but was not authorized
- a requested change would weaken preview/full separation
- a change requires backend/Supabase/Gemini/tracking/secrets
- a change would render PII
- a change requires new dependencies

---

# 7. Sprint Mode Rules

## ASK Mode

Use for:

- audits
- architecture review
- data-path discovery
- product policy decisions
- flow critique
- file inventory
- risk classification

ASK Mode must:

- edit no files
- stage nothing
- commit nothing
- deploy nothing
- mutate no backend systems

## PLAN Mode

Use for:

- translating audit findings into an implementation plan
- defining allowed files
- defining exact edit sequence
- identifying tests and QA

PLAN Mode must not edit files.

## AGENT Mode

Use only when:

- sprint scope is approved
- allowed files are explicit
- forbidden files are explicit
- verification commands are explicit
- rollback/block conditions are explicit

Agent Mode must:

- stay inside allowed files
- stop on protected diff
- report files changed
- run build/typecheck/tests when applicable
- not stage/commit unless the prompt explicitly says so

---

# 8. Completed Sprint Stack

These are completed or substantially completed. Do not redo them without a focused defect audit.

---

## Sprint V0 — Forensic Visual Token Foundation

### Goal

Establish the dark forensic visual system.

### Achieved

- `.report-dark`
- `.fr-*` tokens
- luminance ladder
- card elevation
- pills
- glow utilities
- accent rails
- print fallback

### Success Standard

The report has a consistent premium visual language across cards, pills, numbers, severity states, and surfaces.

### Protect

Avoid repeated `src/index.css` token churn unless a sprint specifically authorizes token work.

---

## Sprint V1 — Core Report Visual Sweep

### Goal

Apply the forensic hierarchy to core report cards.

### Achieved

Upgraded:

```txt
ExecutiveSummaryCard
MoneyAtRiskCard
TopFindingsList
SigningRiskSummary
ScopeOverviewCard
PropertyProfileCard
```

### Success Standard

The top report experience now communicates risk, money, and summary clarity faster.

### Protect

Do not re-style these broadly without a flow or defect reason.

---

## Sprint V2 — Evidence Stack Visual Reshape

### Goal

Upgrade deeper evidence sections into proof/warning/critical modules.

### Achieved

Upgraded:

```txt
FinancialIntegritySection
CodeComplianceProofSection
ScopeGapChecklist
ChangeOrderDefenseMatrix
```

### Success Standard

Verified proof, warning, and critical evidence are visually distinct.

---

## Sprint D1 — Derived Scope Metadata Bridge

### Goal

Surface existing deterministic `derivedMetrics` metadata in the full report without Gemini/backend changes.

### Achieved

Added:

```txt
opening count source
quote math confidence
benchmark source label
benchmark updated-at metadata
```

### Success Standard

Scope Overview is more evidence-backed and preview remains safe.

---

## Sprint D2 — Lab Property/Jurisdiction Prototype

### Goal

Prototype non-PII property context in the visual lab.

### Achieved

Added lab-only:

```txt
quote-stated HVHZ
opening mix
jurisdiction/source labels
```

### Success Standard

Lab full mode shows non-PII property context. Preview remains unchanged.

---

## Sprint D3 — Production Non-PII Property Context

### Goal

Promote safe non-PII property context to the authorized full production report using curated adapter fields.

### Achieved

Promoted:

```txt
code jurisdiction source label
quote-stated HVHZ
opening mix
```

### Success Standard

Production full report may show non-PII context after authorization. Preview remains unchanged. No raw `full_json` is passed to render components.

---

# 9. Remaining Sprint Roadmap

The remaining work should proceed sprint-by-sprint. Do not combine sprints unless explicitly approved.

---

# Sprint R1 — Full Report Flow Audit

## Recommended Mode

ASK Mode only.

## Goal

Determine whether the full report order is psychologically, logically, and commercially optimal.

## Why It Matters

The report has improved visuals. Now the story order must be validated before more section polishing.

## Questions To Answer

- Does the report start with the strongest "why this matters" moment?
- Are repeated warnings redundant?
- Should financial, compliance, scope, and change-order sections be grouped under one "Evidence Stack" narrative?
- Are there too many cards with equal visual weight?
- Is the homeowner guided toward the next action?
- Does the sequence match homeowner decision psychology?
- Does the current order bury the financial or signing danger?

## Must Achieve

Cursor must produce:

```txt
current render order
recommended render order
redundancy map
section purpose table
what to merge
what to move
what to leave alone
R2 implementation recommendation
```

## Success Looks Like

- We know exactly what to reorder and why.
- No code changes happen.
- R2 has a clear scope.

## Files To Inspect

```txt
src/components/forensic-report/ForensicAuditReport.tsx
src/components/forensic-report/ReportClassicDarkV2Full.tsx
src/lib/productionV2ReportHarness.ts
src/hooks/useV2ReportModules.ts
src/components/forensic-report/**
src/pages/DevReportPreview.tsx
```

## Protect

All files. ASK only.

## Cursor Suggestions Allowed

Cursor may suggest:

- better grouping
- better section names
- order changes
- redundancy removal
- CTA placement
- evidence narrative improvements

Cursor may not implement.

---

# Sprint R2 — Report Sequence / Redundancy Reshape

## Recommended Mode

PLAN first, then AGENT only after approval.

## Goal

Reorder and group the full report into a cleaner homeowner decision narrative.

## Target Narrative

```txt
1. Case File Unlocked
2. Executive Verdict
3. Money at Risk
4. Top 3 Risks
5. Scope / Property / Opening Context
6. Evidence Stack
   - Financial Integrity
   - Code Compliance
   - Scope Gaps
   - Change Orders
   - Warranty / Fine Print
7. Contractor Questions
8. Next Action / Better Quote Plan
```

## Must Achieve

- Improve story flow.
- Reduce repeated warning fatigue.
- Group evidence into a coherent case-file structure.
- Preserve preview/full separation.
- Preserve all existing data sources.
- Avoid broad refactor unless R1 proves it is needed.

## Success Looks Like

- Full report feels guided.
- User understands what is wrong, why it matters, what proof exists, and what to do.
- No preview behavior changes.
- No data authorization changes.
- No tracking changes.

## Likely Files

```txt
src/components/forensic-report/ForensicAuditReport.tsx
src/components/forensic-report/ReportClassicDarkV2Full.tsx
src/components/forensic-report/NextActionCard.tsx
src/components/forensic-report/ContractorQuestionPacket.tsx
```

## Protect

```txt
src/components/forensic-report/ReportClassicDarkV2Partial.tsx
src/hooks/**
src/services/**
supabase/**
tracking files
App.tsx
ReportClassic.tsx
```

## Cursor Suggestions Allowed

Cursor may suggest a grouping component or section divider if it reduces duplication and does not change authorization.

---

# Sprint R3 — Source + Confidence Label System

## Recommended Mode

ASK first, then PLAN, then AGENT.

## Goal

Every major displayed fact should subtly show where it came from.

## Labels

Allowed labels:

```txt
quote-visible
derived
benchmark reference
not disclosed
manual review recommended
```

## Must Achieve

- Improve trust.
- Avoid "AI said so."
- Never invent labels.
- Use source labels only where source is known.
- Keep labels subdued.

## Success Looks Like

Source/confidence labels appear on:

```txt
opening count
price per opening
market benchmark
quote math confidence
wind zone
code jurisdiction
financial proof
compliance proof
warranty/fine print facts
payment schedule
change-order terms
```

## Likely Files

```txt
src/components/forensic-report/SourceLabel.tsx
src/components/forensic-report/ScopeOverviewCard.tsx
src/components/forensic-report/PropertyProfileCard.tsx
src/components/forensic-report/FinancialIntegritySection.tsx
src/components/forensic-report/CodeComplianceProofSection.tsx
src/components/forensic-report/WarrantyFinePrintSection.tsx
src/lib/productionV2ReportHarness.ts
src/lib/visualState.ts
```

## Protect

```txt
ReportClassicDarkV2Partial.tsx
useAnalysisData.ts
supabase/**
Gemini prompts
tracking files
```

## Cursor Suggestions Allowed

Cursor may suggest a centralized `SourceLabel` component, but must not force centralization if local section-specific labels are safer.

---

# Sprint R4 — Warranty / Fine Print Visual Upgrade

## Recommended Mode

ASK audit first, then AGENT if visual-only.

## Goal

Bring Warranty / Fine Print up to the same visual standard as financial/code/scope/change-order sections.

## Must Achieve

Separate:

```txt
documented protection
missing / unclear warranty
payment risk
fine-print risk
contractor questions
```

## Success Looks Like

- Missing warranty terms are no longer buried.
- Payment-before-inspection risks are obvious.
- Contractor questions are tied to warranty/fine-print gaps.
- Section uses `.fr-*` tokens.
- No scoring or extraction changes.

## Likely Files

```txt
src/components/forensic-report/WarrantyFinePrintSection.tsx
src/components/forensic-report/ContractorQuestionPacket.tsx
src/components/forensic-report/visualState.ts
```

## Protect

```txt
scan-quote
Gemini prompts
supabase/**
ReportClassicDarkV2Partial.tsx
tracking files
```

## Cursor Suggestions Allowed

Cursor may suggest whether warranty and payment-risk should be split or grouped.

---

# Sprint R5 — Contractor Identity + Quote Identity Upgrade

## Recommended Mode

ASK first.

## Goal

Make contractor/quote identity feel like a forensic case header without exposing homeowner PII.

## Safe Candidate Fields

```txt
contractor name
document type
quote date
quote ID/reference number
extracted line-item count
document confidence
rubric version
analysis ID
```

## Forbidden Unless Explicitly Approved

```txt
homeowner name
phone
email
street address
ZIP
full property address
raw quote text
raw full_json
```

## Must Achieve

- Increase trust that the report is tied to a real quote.
- Avoid homeowner PII.
- Avoid raw full data.
- Keep source labels honest.

## Success Looks Like

- A clear case/quote identity block exists or existing card is upgraded.
- It does not duplicate contractor identity elsewhere.
- It hides unavailable fields cleanly.
- It does not alter report authorization.

## Likely Files

```txt
src/components/forensic-report/ContractorQuoteIdentityCard.tsx
src/components/forensic-report/ReportClassicDarkV2Full.tsx
src/components/forensic-report/adapters/reportAccessAdapter.source.ts
src/components/forensic-report/adapters/reportAccessAdapter.types.ts
src/lib/productionV2ReportHarness.ts
```

## Protect

```txt
ReportClassicDarkV2Partial.tsx
useAnalysisData.ts
supabase/**
Gemini prompts
tracking files
```

## Cursor Suggestions Allowed

Cursor may recommend improving the existing contractor identity card or creating a new case header, but must justify with repo evidence.

---

# Sprint R6 — Preview / OTP Value Gate Upgrade

## Recommended Mode

ASK first. AGENT only with strict preview-safe allowlist.

## Goal

Make the pre-OTP preview more persuasive without leaking full report data.

## Preview-Safe Inputs

Only use fields that already exist in preview-safe payload/rendering:

```txt
grade
red/amber counts
weakest pillar if already preview-safe
top missing category if already preview-safe
general teaser summary
full report ready state
safe proof-of-read summary
```

## Forbidden Pre-OTP

```txt
full flags
full_json
line items
specific full findings
financial details not already preview-safe
contractor questions from full evidence
full source labels
PII
```

## Must Achieve

- Increase OTP completion.
- Make locked report feel valuable.
- Do not leak specific findings.
- Do not hide real data with CSS.
- Preserve backend authorization.

## Success Looks Like

- Preview CTA is stronger.
- Locked findings feel compelling but not exposed.
- DOM/accessibility tree does not contain full data.
- Full report still feels meaningfully richer.

## Likely Files

```txt
src/components/forensic-report/PartialRevealHero.tsx
src/components/forensic-report/PartialUnlockOverlay.tsx
src/components/forensic-report/PreviewUnlockSlot.tsx
src/components/forensic-report/TopFindingsList.tsx
src/components/forensic-report/ForensicAuditReport.tsx
```

## Protect

```txt
ReportClassicDarkV2Partial.tsx unless sprint explicitly authorizes it
useAnalysisData.ts
usePhonePipeline.ts
useReportAccess.ts
supabase/**
tracking files
localStorage authorization logic
```

## Cursor Suggestions Allowed

Cursor may suggest preview-safe copy, layout, and CTA improvements, but must classify each data element as preview-safe or full-only.

---

# Sprint R7 — Full Report Action Layer

## Recommended Mode

ASK first, then PLAN.

## Goal

Convert the report from analysis into "what to do next."

## Candidate Modules

```txt
Better Quote CTA
Contractor question packet
Negotiation checklist
send-this-to-contractor copy block
appointment / intro request
post-report diagnosis bridge
manual review request
```

## Must Achieve

- Homeowner knows the next step.
- CTA follows evidence.
- Contractor questions are tied to detected risk.
- Tracking, if touched, is explicitly approved and tested.
- No report authorization changes.

## Success Looks Like

- Clear primary CTA.
- Clear secondary CTA.
- No CTA spam.
- Action layer does not feel scammy.
- High-value events fire only after backing API success.

## Likely Files

```txt
src/components/forensic-report/NextActionCard.tsx
src/components/forensic-report/ContractorQuestionPacket.tsx
src/components/forensic-report/RevealDiagnosisBridgeCard.tsx
src/components/forensic-report/RevealDiagnosisStickyCta.tsx
src/components/forensic-report/ReportClassicDarkV2Full.tsx
```

## Protect

```txt
trackConversion.ts unless explicitly approved
trackEvent.ts unless explicitly approved
supabase/functions/**
contractor routing functions
App.tsx
ReportClassicDarkV2Partial.tsx
OTP/report-access code
```

## Cursor Suggestions Allowed

Cursor may suggest separating visual action-layer work from tracking/API work.

---

# Sprint R8 — Data Presentation QA / Visual Regression

## Recommended Mode

ASK or PLAN first.

## Goal

Freeze what "good" looks like and prevent visual/data regressions.

## Required Checks

```txt
preview mode no leaks
full mode renders all report modules
mobile no overflow
sticky CTA does not clip content
source labels readable but subdued
contrast passes
keyboard/tab acceptable
screen reader does not expose hidden full data
print mode readable
no console errors
no route conflicts
```

## Must Achieve

- Create repeatable QA protocol.
- Identify exact routes and query params.
- Define screenshot targets.
- Define DOM/accessibility leak checks.
- Define go/no-go blockers.

## Success Looks Like

Cursor produces or implements:

```txt
manual QA checklist
Playwright route list
screenshot baseline plan
preview/full leak checklist
mobile breakpoint checklist
commit gate checklist
```

## Likely Files

```txt
tests/**
playwright.config.*
docs/**
src/pages/DevReportPreview.tsx only if lab route labels/test IDs are needed
```

## Protect

```txt
production route logic
report-access hooks
supabase/**
tracking files
Gemini/scanner logic
```

## Cursor Suggestions Allowed

Cursor may propose no-code manual QA if Playwright is not configured.

---

# Sprint R9 — v2_source Curated Module Architecture

## Recommended Mode

ASK first, then PLAN. No AGENT without explicit approval.

## Goal

Stop growing `ForensicAuditReportProps` and move richer report data into curated modules.

## Target Future Shape

```txt
v2_source.property_context
v2_source.scope_context
v2_source.financial_context
v2_source.compliance_context
v2_source.warranty_context
v2_source.action_context
```

## Must Achieve

- Reduce shell prop bloat.
- Keep `full_json` behind adapters/projection.
- Make report modules typed.
- Preserve preview projection.
- Identify if Edge Function projection must change.

## Success Looks Like

- Cursor maps current shell props vs module props.
- Cursor identifies duplicated fields.
- Cursor proposes staged migration.
- No code changes until approval.

## Likely Files To Inspect

```txt
src/components/forensic-report/adapters/reportAccessAdapter.source.ts
src/components/forensic-report/adapters/reportAccessAdapter.types.ts
src/lib/productionV2ReportHarness.ts
src/components/forensic-report/ReportClassicDarkV2Full.tsx
src/components/forensic-report/ForensicAuditReport.tsx
src/hooks/useV2ReportModules.ts
supabase/functions/report-access/**
```

## Protect

All likely files are protected in implementation mode.

## Cursor Suggestions Allowed

Cursor may split into:

```txt
R9A audit current contracts
R9B define TypeScript module interfaces
R9C adapter-only module projection
R9D component consumption
R9E report-access projection update
```

---

# Sprint R10 — Extraction / Gemini Expansion Audit

## Recommended Mode

ASK only.

## Goal

Decide whether Gemini should extract additional visible facts.

## Candidate Fields

```txt
quote date
contractor license number
quote expiration date
NOA / FL approval references
DP rating
opening schedule
brand / series / model
warranty terms
payment milestones
exclusions
change-order language
permit responsibility
final payment before inspection
```

## Core Rule

Gemini extracts visible evidence only.

Gemini must not:

```txt
score
judge
estimate savings
calculate price fairness
grade quote
authorize report
decide visual severity
```

## Must Achieve

- Map current extraction schema.
- Map current prompt fields.
- Map current report usage.
- Identify desired fields not extracted.
- Identify extracted fields not used.
- Separate Gemini extraction from deterministic calculation.

## Success Looks Like

Cursor returns:

```txt
current extraction schema map
current prompt field map
current report usage map
candidate expansion table
risk classification
recommended sequence
files involved
do-not-touch list
```

## Likely Files

```txt
supabase/functions/scan-quote/**
scripts/diagnostics/gemini-raw-response-diagnostic.ts
src/lib/productionV2ReportHarness.ts
src/components/forensic-report/adapters/**
docs/**
```

## Protect

Do not edit scanner/Gemini files during audit.

## Cursor Suggestions Allowed

Cursor may split this into extraction truth audit, deterministic metric gap audit, schema proposal, prompt update, and QA fixture sprints.

---

# Sprint R11 — Quote Extraction QA Engine

## Recommended Mode

ASK first, then PLAN. AGENT only for pure local helpers unless explicitly approved.

## Goal

Detect bad OCR/extraction before the report looks falsely confident.

## Output States

```txt
clean scan
low confidence
contradictory values
missing critical fields
manual review recommended
```

## Candidate QA Checks

```txt
total price consistency
opening count consistency
line item total consistency
deposit vs deposit percent
payment schedule contradictions
NOA / FL approval format
DP rating format
brand/series missingness
warranty term missingness
permit responsibility missingness
final payment before inspection
confidence thresholds
```

## Must Achieve

- Prevent false certainty.
- Create deterministic QA rules.
- Keep Gemini extraction separate.
- Start as pure local functions or lab diagnostics.

## Success Looks Like

- Pure testable QA helpers exist first.
- Malformed extraction has tests.
- UI can later display manual review without faking certainty.
- No backend/database persistence until approved.

## Likely Files

Initial local/lab:

```txt
src/lib/extractionQuality/**
src/lib/productionV2ReportHarness.test.ts
src/pages/DevReportPreview.tsx
```

Future production:

```txt
supabase/functions/scan-quote/**
supabase/migrations/**
src/integrations/supabase/types.ts
admin/manual-review components
```

## Protect

Backend/database/scanner files until explicitly approved.

## Cursor Suggestions Allowed

Cursor may split this into pure helper, fixture tests, lab display, production persistence, and admin manual-review sprints.

---

# Sprint R12 — Final Production Readiness / Push Gate

## Recommended Mode

ASK / QA mode. AGENT only for fixes.

## Goal

Verify the entire Verify-to-Reveal spine before treating the report upgrade as finished.

## Required Flow Checks

```txt
quote upload works
scan completes
preview appears before OTP
full report never loads before OTP
OTP unlock fetches full report
full report source labels appear only after unlock
non-PII property context appears only in full mode
no unapproved PII appears
no tracking regressions
no console errors
no mobile layout failures
no route conflicts
no Supabase secret/config drift
```

## Must Achieve

- Validate security.
- Validate UX.
- Validate tracking boundaries.
- Validate mobile.
- Produce go/no-go.

## Success Looks Like

Cursor returns:

```txt
build result
test result
typecheck result
manual QA result
preview leak check
full reveal check
tracking diff check
protected diff check
mobile QA notes
final git status
go/no-go verdict
```

## Files To Protect

Everything unless a verified bug has a scoped fix prompt.

---

# 10. Recommended Execution Order

Recommended order:

```txt
R1 — Full Report Flow Audit
R2 — Report Sequence / Redundancy Reshape
R4 — Warranty / Fine Print Visual Upgrade
R3 — Source + Confidence Label System
R5 — Contractor Identity + Quote Identity Upgrade
R6 — Preview / OTP Value Gate Upgrade
R7 — Full Report Action Layer
R8 — Data Presentation QA / Visual Regression
R12 — Final Production Readiness Gate
```

Then, only after presentation is stable:

```txt
R9 — v2_source Curated Module Architecture
R10 — Extraction / Gemini Expansion Audit
R11 — Quote Extraction QA Engine
```

Reason:

- R1/R2 lock the narrative.
- R4 finishes visual parity.
- R3/R5 improve trust and source clarity.
- R6 improves OTP conversion.
- R7 improves conversion/action.
- R8/R12 prevent regression.
- R9/R10/R11 are higher-risk data architecture/scanner-quality work.

---

# 11. Standing Sprint Output Format

Every ASK sprint must return:

```txt
1. Objective
2. Files inspected
3. Repo truth found
4. Risk classification
5. Recommended scope
6. Files likely touched later
7. Protected files
8. Open questions
9. Recommended next mode
10. If safe, draft next prompt
```

Every AGENT sprint must return:

```txt
1. Preflight result
2. Files changed
3. Files skipped/deferred
4. Exact changes by file
5. Test result
6. Build result
7. Typecheck result
8. Preview safety result
9. Full-mode QA result
10. Protected diff confirmation
11. Final git status --short
12. Commit recommendation
```

---

# 12. Standing Verification Commands

Every implementation sprint should run:

```bash
npm run build
npx tsc --noEmit
git status --short
git diff --name-only
```

If report authorization or preview/full behavior could be affected:

```bash
git diff -- src/components/forensic-report/ReportClassicDarkV2Partial.tsx
git diff -- src/hooks src/services supabase src/integrations/supabase/types.ts
git diff -- src/App.tsx src/main.tsx src/pages/ReportClassic.tsx
git diff -- src/lib/trackConversion.ts src/lib/trackEvent.ts src/components/AppTrackingProvider.tsx
git diff | grep -E "full_json|localStorage|window.location|URLSearchParams|supabase.from|invoke\\(|import.meta.env|process.env" || true
```

Manual QA routes:

```txt
/visual/report-preview?v=v3&mode=preview
/visual/report-preview?v=v3&mode=full
/visual/report-preview?v=v3&mode=unauthorized
/visual/report-preview?v=v3&mode=full&source=adapter
```

If live staging QA exists:

```txt
/visual/report-preview?v=v3&source=live&mode=preview&scan_session_id=<id>
/visual/report-preview?v=v3&source=live&mode=full&scan_session_id=<id>
```

---

# 13. Definition of Finished

The Truth Report V2 visual/data-presentation upgrade is finished when:

- full report has a coherent narrative order
- all major sections match the forensic visual standard
- source/confidence labels are consistent
- preview gate is more persuasive but safe
- full report has a clear next-action layer
- no homeowner PII appears without explicit product approval
- no `full_json` leaks pre-OTP
- no route/tracking/backend regressions
- mobile and desktop layouts are stable
- visual regression checklist exists
- final production readiness audit passes

---

# 14. Highest-Level Rule

If a requested change makes the product look better but weakens Verify-to-Reveal, do not do it.

If a requested change requires backend, Gemini, Supabase, tracking, OTP, secrets, generated types, report-access, or preview/full authorization changes, stop and ask for explicit approval.

If unsure, choose ASK Mode.
