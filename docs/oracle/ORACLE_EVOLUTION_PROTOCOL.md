# WindowMan Oracle Evolution Protocol

## Continuous Intelligence · Human-Gated Evolution

**Status:** Canonical Oracle evolution policy
**Applies to:** Window Oracle, data-quality intelligence, continual-learning workflows, recommendation engines, Evolution Queue concepts, future AI analyst features
**Does not authorize:** schema changes, backend mutations, production UI mutations, deployments, or autonomous code changes

---

## 1. Purpose

WindowMan should become more intelligent as it accumulates legitimate:

```text
quotes
analyses
normalized observations
market observations
contractor outcomes
verified sold outcomes
operator usage patterns
data-quality history
```

This document defines what **continual learning** means inside WindowMan.

The governing rule is:

> **The system may continuously improve its knowledge. It may not autonomously rewrite its production architecture.**

---

## 2. The Evolution Loop

```text
NEW EVIDENCE
→ STRUCTURED OBSERVATION
→ NORMALIZATION
→ DETERMINISTIC ANALYSIS
→ PATTERN DETECTION
→ INTELLIGENCE
→ RECOMMENDATION
→ HUMAN REVIEW
→ APPROVED SPRINT
→ IMPLEMENTATION
→ VERIFICATION
→ MEASUREMENT
→ FURTHER LEARNING
```

This is the WindowMan human-gated evolution model.

---

## 3. What Learning Means

WindowMan may learn from persisted evidence by detecting or measuring:

### Market vocabulary

* new brands
* new manufacturers
* new series
* new product/configuration values
* new contractors
* new ZIPs / counties / territories
* new glass, frame, product-code, financing, warranty, permit, or scope concepts where evidence supports them

### Market behavior

* changing quoted-price distributions
* changing verified-sold distributions
* quote-to-sold spread
* contractor activity
* product/geography patterns
* project composition patterns
* time trends
* cohort density changes

### Data quality

* field-completeness trends
* recurring extraction failures
* recurring ambiguity
* duplicate/alias candidates
* anomalous observations
* invalid cohorts
* weak provenance
* thin sold-outcome coverage

### Product intelligence

* common Oracle searches
* zero-result searches
* low-confidence searches
* frequent fallbacks
* underused extracted fields
* repeated operator workarounds
* candidate new filters
* candidate new visualizations
* candidate new screens
* candidate new intelligence dimensions

Learning must be grounded in persisted evidence.

Do not describe unsupported intuition as learned market truth.

---

## 4. AI vs Deterministic Responsibilities

Permanent rule:

```text
AI reads messy evidence.
AI interprets aggregate patterns.
AI proposes hypotheses and recommendations.

Deterministic TypeScript calculates truth.
Backend persists authoritative state.
Frontend renders authorized results.
Humans authorize structural evolution.
```

### AI may

* summarize patterns already calculated
* identify possible relationships
* identify likely aliases
* identify underused information
* identify candidate dimensions
* suggest investigations
* explain data-quality changes
* draft structured recommendations
* draft implementation prompts after human request

### AI may not be the authority for

* counts
* totals
* averages
* medians
* percentiles
* distributions
* deterministic confidence
* eligibility
* approved inclusion/exclusion
* approved cohort fallback
* final business rules
* authorization

If deterministic code can calculate it, deterministic code should calculate it.

---

## 5. Market Intelligence vs Software Mutation

Strictly distinguish:

```text
MARKET INTELLIGENCE
```

from:

```text
SOFTWARE MUTATION
```

Market intelligence may evolve continuously.

Software architecture may not evolve autonomously.

### AI has zero autonomous authority to

* create / alter / drop tables
* add / remove columns
* execute migrations
* modify RLS
* modify grants
* create/drop RPCs or triggers
* modify storage policies
* modify Supabase config
* modify project linkage
* modify secrets
* modify/deploy Edge Functions
* edit generated database types
* alter scanner extraction
* alter deterministic scoring
* alter OTP / Twilio
* alter Verify-to-Reveal
* alter report-access authorization
* alter tracking / GTM / CAPI
* alter deduplication
* alter Stripe
* alter contractor routing
* mount production routes
* rewrite production React components
* deploy
* commit
* push

unless the user explicitly authorizes a bounded sprint/action.

Observation is not authorization.

Recommendation is not authorization.

Confidence is not authorization.

---

## 6. Human-Gated Evolution

All structural evolution follows:

```text
DETECT
→ QUANTIFY
→ RECOMMEND
→ HUMAN REVIEW
→ APPROVED SPRINT
→ IMPLEMENT
→ VERIFY
→ MEASURE
```

No shortcut bypasses human approval.

A recommendation may be high-confidence and still require approval.

---

## 7. Evolution Recommendation Contract

Every meaningful recommendation should use this structure when enough evidence exists:

```text
TYPE:
TITLE:
OBSERVED EVIDENCE:
SAMPLE / COVERAGE:
CONFIDENCE:
WHY IT MATTERS:
RECOMMENDATION:
AFFECTED SYSTEMS:
PROTECTED SYSTEM TRIGGER:
SMALLEST SAFE SPRINT:
VERIFICATION:
```

### Recommendation types

```text
DATA_QUALITY
NORMALIZATION
NEW_DIMENSION
MARKET_INSIGHT
NEW_FILTER
NEW_SCREEN
EXTRACTION_OPPORTUNITY
OPERATOR_WORKFLOW
BUSINESS_OPPORTUNITY
TECHNICAL_DEBT
UNKNOWN / NEEDS INVESTIGATION
```

Do not invent values merely to fill the contract.

Use:

```text
UNKNOWN
NEEDS MORE DATA
NEEDS REPO VERIFICATION
```

where appropriate.

---

## 8. Evolution Queue

`Evolution Queue` is the architectural concept for human-reviewed system-improvement recommendations.

Do not assume a real:

```text
database table
RPC
route
Edge Function
queue service
```

exists unless repo evidence proves it.

Until persistence is explicitly implemented, Evolution Queue recommendations may appear in:

* fixture/dev Oracle labs
* audits
* planning docs
* operator reports
* requested analysis outputs

### Authority rule

AI may:

```text
draft
rank
explain
support with evidence
```

AI may not:

```text
self-approve
self-deploy
self-mutate protected systems
```

---

## 9. Normalization and Alias Learning

Examples:

```text
Win Guard
Winguard
WinGuard
```

or:

```text
ABC Windows Inc.
ABC Windows
ABC Window & Door
```

AI may identify likely relationships.

Do not automatically merge canonical identities based only on semantic similarity.

For material normalization proposals, prefer:

```text
source provenance
affected observation count
examples
confidence
reversible alias mapping
human review where ambiguity exists
```

Never destroy historical source truth merely to make reporting cleaner.

---

## 10. Candidate Dimension Discovery

AI may recommend a new intelligence dimension when recurring evidence shows the concept is:

* frequently present
* extractable with useful reliability
* analytically/commercially valuable
* not already adequately represented

Example:

```text
TYPE:
NEW_DIMENSION

TITLE:
Frame color may justify a normalized Oracle dimension.

OBSERVED EVIDENCE:
Frame-color language appears repeatedly in usable quote observations.

SAMPLE / COVERAGE:
382 usable recent quotes; 63% contain interpretable frame-color evidence.

CANDIDATE VALUES:
White
Bronze
Black
Almond

WHY IT MATTERS:
Potential price segmentation, product-trend analysis, contractor specialization.

RECOMMENDATION:
Audit existing extraction ownership and determine whether frame color belongs in
existing extraction JSON, normalized observations, a derived read model, or nowhere.
```

This does not authorize:

```sql
ALTER TABLE ...
```

A field recommendation is not a schema recommendation until architecture review proves the correct storage owner.

---

## 11. Self-Observation

WindowMan should measure the quality of its own intelligence where data/contracts support it.

Candidate metrics:

```text
ZIP coverage
county coverage
contractor-name coverage
brand coverage
series coverage
dimension coverage
opening-type coverage
usable PPO coverage
trusted/index-approved observation rate
verified-sold outcome coverage
query success rate
zero-result rate
fallback frequency
confidence distribution
```

### Example alert

```text
TYPE:
DATA_QUALITY

TITLE:
Series coverage declined materially.

OBSERVED EVIDENCE:
Previous 30 days: 61%
Current 30 days: 34%

PRIMARY AFFECTED COHORT:
ES-related quotes

CONFIDENCE:
HIGH

RECOMMENDATION:
Inspect representative recent source documents and extraction output before changing
the production extraction prompt.
```

The system should recommend investigation before mutation.

---

## 12. Pattern Discovery

Deterministic code should identify statistical patterns.

Examples:

```text
Broward PGT quoted median PPO changed X%
Palm Beach vs Broward cohort difference
verified-sold median vs initial quoted median
contractor observations by territory
brand/series distribution changes
```

AI may then explain:

* why the pattern may matter
* plausible hypotheses
* what additional data would strengthen the conclusion
* what product/ops question should be investigated

AI must not present correlation as causation without evidence.

---

## 13. Underused Intelligence Detection

The system should ask:

> What are we already collecting that we are not using?

Example:

```text
TYPE:
NEW_DIMENSION

TITLE:
Financing intelligence may be underutilized.

OBSERVED EVIDENCE:
A meaningful share of usable quote observations contain financing-related evidence,
but current Oracle query surfaces do not expose financing comparisons.

WHY IT MATTERS:
Potential cash-vs-financed price intelligence and financing-risk analysis.

RECOMMENDATION:
Audit extraction completeness, normalization reliability, and business value before
adding a production financing dimension.
```

---

## 14. Operator-Behavior Learning

Where privacy/telemetry policy permits, the Oracle may learn from aggregate operator behavior such as:

* common filters
* repeated filter combinations
* zero-result searches
* frequently broadened cohorts
* repeated manual workarounds
* unused panels
* common phone-call workflows

This may justify recommendations such as:

```text
NEW_FILTER
NEW_SCREEN
OPERATOR_WORKFLOW
```

Do not turn operator telemetry into autonomous product changes.

---

## 15. New Screen Recommendations

AI may recommend a new screen when repeated evidence supports a distinct operator job.

Example:

```text
TYPE:
NEW_SCREEN

TITLE:
Contractor Territory Intelligence

OBSERVED EVIDENCE:
Operators repeatedly query contractor + geography + brand.

PROPOSED JOB:
Show contractor presence, observed brands, quoted/sold distributions, recent activity,
and cohort coverage.

PROTECTED SYSTEM TRIGGER:
MAYBE — depends on data source and routing.

SMALLEST SAFE SPRINT:
Fixture-only UX prototype before live-data integration.
```

A new-screen recommendation does not authorize a route mount.

---

## 16. Learning Maturity Stages

### Stage 0 — Synthetic / Fixture Intelligence

Purpose:

```text
prove contracts
prove UX
prove statistics
prove confidence/fallback concepts
```

No live market claims.

### Stage 1 — Live Project-Level Observations

Potential intelligence:

```text
county
ZIP where available
project type
opening count
quote total
PPO
trusted quote population
verified-sold outcomes where joinable
contractor observations
```

### Stage 2 — Opening / Product Normalization

Potential intelligence:

```text
brand
series
type
dimensions
configuration
impact
glass
frame
product approval
opening-level pricing
```

Only after extraction reliability and data architecture justify it.

### Stage 3 — Evolution Engine

Adds:

```text
data-quality drift
pattern discovery
underused signals
recommendations
Evolution Queue
human-approved improvement loop
```

---

## 17. Statistical Integrity

Every market conclusion should preserve context.

Where applicable include:

```text
sample size
source/provenance
date range
geography
cohort definition
fallback/broadening
confidence
```

Never make:

```text
3 observations
```

look like:

```text
3,000 observations
```

Prefer:

```text
median
P25/P75
distribution
sample size
```

over average alone.

Keep:

```text
QUOTED
```

and:

```text
VERIFIED_SOLD
```

distinct unless a comparison explicitly labels both populations.

---

## 18. No Self-Modifying Production System

WindowMan is not an autonomous code-writing/deployment organism.

The approved model is:

```text
Oracle detects
→ AI explains
→ Evolution Queue recommends
→ human approves
→ bounded Cursor/Codex sprint
→ tests
→ review
→ ship
→ measure
```

Future tooling may draft implementation prompts or branches only after explicit human authorization.

It may never silently mutate production.

---

## 19. Protected-System Escalation

If a recommendation touches:

```text
scan-quote
Gemini extraction prompt
scoring
full_json
OTP/Twilio
report-access
RLS
migrations
RPCs
storage
admin authority
tracking/CAPI/GTM
Stripe
contractor routing
Supabase targeting
generated types
production routes
```

mark:

```text
PROTECTED SYSTEM TRIGGER: YES
```

Then provide:

```text
exact affected system
why change may be needed
risk
smallest safe sprint
verification
approval question
```

Do not implement from the recommendation itself.

---

## 20. Final Operating Principle

Every legitimate quote should have the potential to make WindowMan more intelligent.

Every verified outcome should have the potential to improve market truth.

Every recurring data problem should have the potential to create an improvement recommendation.

Every structural change must remain:

```text
evidence-grounded
human-gated
bounded
testable
reversible where possible
subordinate to WindowMan's canonical security/product architecture
```

> **WindowMan should continuously learn what the market is telling it. It must never autonomously decide that learning gives it permission to rewrite the machine.**
