# AGENTS.md — WindowMan / wm-mvp
## Canonical Product Law + AI Agent Operating Contract

> **Authority:** This is the canonical repo-level product and agent policy for `wm-mvp`.
> Supporting files such as `claude.md`, `.cursor/PROTECTED_FILES.md`, `.cursor/rules/**`,
> sprint docs, README files, and historical planning docs may add detail, but they must not
> weaken or contradict this file.
>
> **Repo-truth rule:** Executable code, migrations, current generated types, active configuration,
> and current runtime call sites outrank stale planning documents. When evidence conflicts, verify
> the current branch before making repo-specific claims.

---

## 1. Product Mission

WindowMan is a **Verify-to-Reveal consumer quote-intelligence and broker opportunity system**
for residential window and door projects.

WindowMan is not:

- a generic lead form
- a contractor directory
- a construction contractor
- a law firm
- a government agency
- a fake AI demo
- a second parallel scanner/report stack

### Core product promise

A homeowner can bring WindowMan an existing contractor quote, receive structured quote intelligence,
see a safe preview, verify identity by SMS, unlock the full Truth Report through backend authorization,
and optionally advance into downstream broker / contractor / negotiation / comparison workflows.

### Canonical product spine

```text
lead / intake
→ private quote upload
→ quote metadata
→ scan session
→ scan-quote
→ analysis persistence
→ safe preview
→ SMS OTP
→ backend-authorized full report access
→ full Truth Report reveal
→ broker / contractor / admin / action flows
→ final outcomes
→ market learning
```

Protect this spine above convenience.

---

## 2. Active Sprint Rule

The active sprint is defined by the user's latest explicit approved scope.

Do not treat old sprint-order sections in historical docs as current authority.

For every implementation task:

1. confirm the current branch
2. inspect repo truth
3. identify protected systems
4. state the smallest safe scope
5. modify only approved surfaces
6. verify the result
7. do not expand into adjacent systems without approval

### Scope discipline

Do not turn a bounded feature into a platform rewrite.

Prefer:

```text
small
atomic
testable
reversible
repo-grounded
```

over:

```text
broad
speculative
duplicative
greenfield
```

---

## 3. Non-Negotiable Product and Security Rules

1. **Preview before OTP is allowed. Full report before OTP is forbidden.**

2. **`full_json` must never be fetched, preloaded, logged, cached, stored in browser persistence,
   hidden in the DOM, or otherwise sent to the browser before backend authorization.**

3. **Backend authorization decides report reveal.**
   CSS hiding, disabled buttons, localStorage, sessionStorage, client route guards, and UI state are
   not security.

4. **One verified phone / scan session must not unlock another scan session.**

5. **`analyses` is canonical unless current repo evidence proves otherwise.**
   `quote_analyses` is legacy unless current repo evidence proves otherwise.

6. **Quote files are private assets.**
   Do not make the quotes bucket public. Use controlled backend access / signed access where required.

7. **Do not weaken RLS, grants, tenant isolation, identity integrity, storage policy, or admin authority
   for convenience.**

8. **Do not expose service-role secrets, Twilio secrets, ad-platform secrets, Stripe secrets, or other
   server-only credentials to browser code.**

9. **Do not invent repo architecture.**
   Never invent files, routes, tables, RPCs, Edge Functions, hooks, fields, env vars, scanner states,
   tracking events, or Supabase project targets.

10. **Do not build fake production UI that implies functionality that does not exist.**
    Fixture/dev/visual labs must be clearly labeled and must not masquerade as live intelligence.

11. **Do not bypass Verify-to-Reveal through contractor, admin, partner, dev, sandbox, or visual access.**

12. **Do not automatically deploy, migrate, mutate production data, change secrets, change project
    targets, generate types, or commit/push unless the user explicitly authorizes that action.**

If a requested change conflicts with these rules, stop and surface the conflict.

---

## 4. Repo Truth Before Advice

Before repo-specific implementation advice, verify the relevant:

```text
branch
file
route
Edge Function
table / view / RPC
migration / RLS policy
runtime call path
tracking owner
deployment target
```

When repo context is incomplete:

```text
UNKNOWN
or
NEEDS REPO VERIFICATION
```

Do not fill gaps with plausible architecture.

### Evidence hierarchy

Prefer, in order:

1. current runtime call sites / executable code
2. current migrations and schema definitions
3. current generated types
4. current machine-readable configuration
5. current canonical docs explicitly identified by `docs/START_HERE.md`
6. historical planning docs only as context

Comments and docs may explain intent, but do not override current executable truth.

---

## 5. Scanner Brain Rule

### Permanent separation of responsibilities

```text
Gemini / AI reads.
TypeScript calculates.
Deterministic scoring judges.
Backend persists.
Frontend renders.
```

### AI / extraction layer may

- read PDF/image quote evidence
- classify document type
- extract visible fields
- extract line items
- extract brand / series / dimensions / product evidence where present
- report field/document confidence
- identify missing visible evidence
- identify ambiguity or contradictions
- return strict structured output

### AI / extraction layer must not own

- final grade
- pillar scores
- hard caps
- deterministic financial math
- market percentile calculations
- price fairness judgment
- markup-risk judgment
- negotiation leverage
- report authorization
- final broker qualification
- final market statistics

### Deterministic TypeScript owns

- validation
- normalization where rules are deterministic
- financial metrics
- counts / totals / PPO
- pillar scoring
- hard caps
- red flags
- grades
- deterministic report interpretation
- preview/full payload shaping
- Oracle statistics
- approved confidence calculations
- approved eligibility / fallback logic

### Missing / uncertain evidence

Never fake certainty.

Use explicit states/warnings such as:

```text
needs_better_upload
unreadable_quote
manual_review_pending
insufficient_information
```

where supported by the actual architecture.

---

## 6. Oracle Evolution Protocol — Continuous Intelligence, Human-Gated Evolution

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

But **continual learning does not mean autonomous software mutation**.

### Core evolution loop

```text
new evidence
→ structured observation
→ normalization
→ deterministic analysis
→ pattern detection
→ intelligence
→ recommendation
→ human approval
→ bounded implementation
→ verification
→ measurement
→ further learning
```

### What WindowMan may learn

The system may identify:

- new brands
- new series
- new contractors
- new product/configuration values
- new ZIP/county/geographic patterns
- changing quoted-price distributions
- changing verified-sold distributions
- extraction completeness changes
- recurring missing fields
- likely aliases / normalization inconsistencies
- anomalous observations
- underused extracted information
- common Oracle queries
- zero-result / low-confidence query patterns
- candidate new intelligence dimensions
- candidate new filters
- candidate new operator views
- candidate business opportunities

### What learning does NOT authorize

Observation is not authorization.

Recommendation is not authorization.

Confidence is not authorization.

AI may not autonomously:

- create/alter/drop tables or columns
- run migrations
- change RLS, grants, RPCs, triggers, storage policies, or Supabase configuration
- change project linkage or secrets
- modify/deploy Edge Functions
- edit generated database types
- alter scanner extraction/scoring
- alter OTP/Twilio or Verify-to-Reveal
- alter report-access authorization
- alter tracking / GTM / CAPI / dedup
- alter Stripe
- alter contractor routing
- mount production routes
- rewrite production React flows
- deploy
- commit or push without explicit approval

### Human-gated evolution

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

### Evolution recommendation contract

When meaningful evidence suggests WindowMan should evolve, structure the recommendation as:

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

Allowed recommendation types:

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

Do not invent evidence to complete the structure.

### Evolution Queue

`Evolution Queue` is the architectural concept for human-reviewed improvement recommendations.

Do not assume a real table, RPC, route, or queue exists unless repo evidence proves it.

Until persistence is deliberately implemented, recommendations may live in:

- Oracle lab output
- read-only analyses
- audit documents
- sprint proposals
- explicitly requested planning artifacts

AI may draft recommendations.

AI may never approve its own recommendation or treat it as permission to mutate protected systems.

### Normalization / alias learning

AI may flag likely aliases such as:

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

Do not destructively merge identities solely from semantic similarity.

Prefer:

```text
provenance
affected-observation count
confidence
reversible alias mapping
human review where ambiguity exists
```

### New field / dimension discovery

AI may recommend a new dimension only when evidence shows the concept is:

- recurring
- extractable with useful reliability
- analytically/commercially useful
- not already adequately represented

A recommendation for a field does not imply a database column.

First determine whether it belongs in:

```text
existing extraction JSON
normalized facts
derived read model
Oracle observation
existing table
or nowhere
```

Schema comes only after architecture review and explicit approval.

### Self-observation metrics

Where supported, WindowMan should measure its own intelligence quality:

```text
ZIP coverage
county coverage
contractor-name coverage
brand coverage
series coverage
dimension coverage
opening-type coverage
usable PPO coverage
trusted/index-approved rate
verified-sold outcome coverage
query success rate
zero-result rate
fallback frequency
confidence distribution
```

Surface meaningful changes.

### Full protocol

For Oracle / continual-learning / Evolution Engine work, also read:

```text
docs/oracle/ORACLE_EVOLUTION_PROTOCOL.md
```

---

## 7. Broker Deal Engine Boundaries

WindowMan's Broker Deal Engine is separate from the Scanner Brain and separate from the Oracle.

### Domain separation

```text
Scanner / Truth Engine
= understands one quote

Window Oracle
= understands accumulated market evidence

Broker Opportunity Qualification
= decides whether evidence supports advancing a broker conversation

Broker LOI
= records presented conditional opportunity + homeowner intent

Contractor systems
= fulfillment / routing / field verification

Contractor outcomes
= downstream result / final ground truth
```

Do not collapse these into one table, one function, or one UI state machine.

### Broker business truth

- WindowMan is not the fulfillment contractor.
- Do not guarantee exact final installed price before contractor field verification.
- Contractor independently measures, verifies, discovers conditions, may revise price/scope, or may decline.
- Final construction agreement is between contractor and homeowner.
- A broker LOI is not the final construction contract.
- Payment/lock products must not silently become construction deposits or acceptance evidence.

### Broker qualification

Use:

```text
Broker Opportunity Qualification
```

not construction underwriting.

Commercial policy must be explicit and human-approved.

Do not invent thresholds.

---

## 8. Window Oracle Rules

The Window Oracle is a market-intelligence system, not a browser-side JSON explorer.

### Intended architecture

```text
raw quote / outcome evidence
→ extraction / canonical operational data
→ normalized observations / approved read model
→ server-authorized query / aggregation
→ OracleQueryResponse
→ Oracle UI
```

### Oracle invariants

1. Raw documents remain evidence.
2. Normalized structured facts become queryable intelligence.
3. SQL/RPC/server aggregation interrogates accumulated evidence.
4. React must not arbitrarily mine protected `full_json`.
5. Quoted and verified-sold populations must remain distinct.
6. Every market claim should carry sample size / provenance / date/geography context where available.
7. Median and distributions are generally more informative than average alone.
8. Thin data must not be presented as certainty.
9. Oracle UI must remain data-source agnostic where practical.
10. Synthetic/dev Oracle surfaces must be clearly labeled as synthetic.

### Current fixture/dev truth

A visual/dev Oracle lab may use synthetic observations to validate:

```text
query UX
statistics
confidence presentation
fallback behavior
quoted-vs-sold separation
contractor observations
data-quality presentation
Evolution Engine concepts
```

Fixture success does not prove live market truth.

---

## 9. Protected Systems and Mutation Safety

Canonical protected-path authority:

```text
.cursor/PROTECTED_FILES.md
```

Before editing Tier A–D protected paths, follow the current developer-babysitter / sprint-approval rules.

### Protected by default

Treat these domains as protected even if the specific file list evolves:

- scanner / extraction / scoring
- upload/session bootstrap
- OTP / Twilio
- report-access / reveal
- `full_json`
- private quote storage
- admin authority
- partner/contractor access
- contractor routing
- Supabase schema / migrations / RLS / grants / RPCs / triggers
- service-role paths
- generated DB types
- Supabase project targeting/config
- tracking / GTM / CAPI / vendor routing / dedup
- Stripe / payment infrastructure
- production deployment/env/secrets

### Mutation commands

Do not perform or recommend as routine actions without explicit approval:

```text
supabase db push
supabase db reset
supabase migration up
supabase functions deploy
supabase secrets set
supabase gen types
remote SQL mutation
production data mutation
project target changes
secret/env changes
git commit
git push
force push
```

When a protected mutation is explicitly requested, first state:

```text
target environment
blast radius
rollback path
verification steps
production/staging/local impact
```

Never assume local Supabase is production.

---

## 10. Supabase and Data Architecture Defaults

- Schema, constraints, indexes, and RLS come before major production UI dependencies.
- Use migrations for schema changes.
- Use views/RPCs/Edge Functions where clients should not see raw tables.
- Do not scatter raw Supabase queries through React components.
- Prefer typed services/repositories/hooks.
- Browser-persisted state is a resume hint, never authorization.
- Avoid `any` unless explicitly justified.
- Never show raw database or JSON errors to users.
- Handle loading, retry, offline, unauthorized, locked, and manual-review states.

### Canonical data caution

Do not rely on historical "minimum data model" lists.

Verify current schema before naming a table as canonical.

Known permanent rule:

```text
analyses = canonical analysis lifecycle unless current repo evidence proves otherwise
quote_analyses = legacy unless current repo evidence proves otherwise
```

---

## 11. Tracking / Measurement Rules

Keep two lanes separate.

### Business / conversion lane

```text
trackConversion
→ window.dataLayer
→ GTM
→ approved browser/server vendor routing
```

### Operational telemetry lane

```text
trackEvent
→ internal operational telemetry / diagnostics
```

Do not treat operational telemetry as paid-media truth.

### Rules

- Do not hardcode vendor SDK conversion calls in arbitrary React components.
- Do not post directly to server CAPI endpoints from arbitrary browser components.
- High-value conversion events fire only after backing API/server success.
- Preserve dedup-safe event IDs where required.
- Do not change measurement ownership casually.

Tracking/CAPI/GTM changes require the dedicated protected measurement workflow.

---

## 12. Identity, Sessions, and Authorization

Treat identity types as different concepts.

Examples may include:

```text
lead identity
scan-session identity
auth user identity
contractor/admin identity
event/dedup identity
```

Do not conflate them.

### Authorization rules

- Browser state does not grant protected access.
- Contractor/admin/partner access does not equal homeowner report unlock.
- One verified scan must not unlock another.
- Resume state must not become authorization.
- Public anonymous flow may perform only the intentionally public actions supported by current backend design.

---

## 13. Routes / Dev / Visual / Sandbox Rules

Current route truth must be verified in `src/App.tsx` / route modules before implementation.

### Visual/dev harness rule

Routes such as:

```text
/visual/*
/sandbox/*
```

may exist as UI/fixture/QA surfaces.

They must not become:

- production scanner paths
- OTP bypasses
- paid-media conversion destinations
- public full-report bypasses
- sources of fake live-data claims

No autonomous route mounts to protected routing surfaces.

Use explicit sprint approval where required by `.cursor/PROTECTED_FILES.md`.

---

## 14. UX / CRO Rules

WindowMan should feel:

```text
fast
clear
credible
specific
high-value
mobile-capable
operator-useful
```

Avoid:

```text
generic SaaS sprawl
fake AI theater presented as real analysis
unnecessary choice overload
opaque data claims
weak contrast
over-rounded pill-heavy dashboards where an instrument-like UI is more appropriate
```

### Teaser / reveal

Before verification:

- prove the file was read
- show safe teaser value
- create legitimate curiosity
- never expose enough to reconstruct the full report

After authorization:

- reveal the full report
- give interpretation
- show next steps
- preserve evidence/provenance

CRO never overrides security.

---

## 15. Failure and Uncertainty Handling

Never fake certainty when evidence is weak.

Use explicit safe states supported by the real system.

For AI/market recommendations:

```text
OBSERVED
INFERRED
HYPOTHESIS
UNKNOWN
NEEDS REPO VERIFICATION
NEEDS MORE DATA
```

should be distinguishable where appropriate.

For statistical claims:

- include sample size where available
- distinguish quoted from sold
- distinguish exact cohort from broadened fallback
- surface fallback/broadening
- do not claim market leadership from incomplete observation coverage

---

## 16. Implementation Style

Prefer small atomic changes.

Separate:

```text
data logic
domain logic
authorization
UI
tracking
```

Preserve existing patterns unless clearly harmful.

For any implementation:

1. inspect actual code
2. state affected files
3. identify protected systems
4. make smallest safe change
5. test narrow behavior
6. run typecheck
7. inspect diff
8. list what was intentionally not changed

Do not broad-rewrite a stable system merely to make code aesthetically cleaner.

---

## 17. Definition of Done

A task is not done until relevant checks pass.

At minimum verify:

- [ ] requested objective is actually satisfied
- [ ] no invented repo facts
- [ ] Verify-to-Reveal not weakened
- [ ] no pre-OTP `full_json` leakage
- [ ] no cross-session unlock
- [ ] Scanner Brain separation preserved
- [ ] private quote assets remain private
- [ ] RLS/auth boundaries preserved
- [ ] no accidental tracking changes
- [ ] no accidental Stripe/payment changes
- [ ] no accidental contractor-routing changes
- [ ] no protected mutation without approval
- [ ] typecheck/tests appropriate to scope pass
- [ ] final diff contains only intended files
- [ ] runtime/user experience outside scope is unchanged or intentionally verified

---

## 18. Agent Decision Policy

When uncertain, prefer the option that:

1. protects Verify-to-Reveal
2. protects private data and identity boundaries
3. preserves deterministic truth
4. uses existing architecture before creating new architecture
5. separates market learning from software mutation
6. produces evidence before automation
7. reduces duplication
8. remains reversible
9. keeps the active sprint narrow
10. tells the user what is unknown instead of guessing

### One-line operating principle

> **WindowMan should continuously learn what the market is telling it, while humans remain the authority over how the software itself evolves.**

---

## 19. Canonical References

Start with:

```text
docs/START_HERE.md
```

Primary authorities:

```text
AGENTS.md
.cursor/PROTECTED_FILES.md
docs/reveal/VERIFY_TO_REVEAL_CONTRACT.md
docs/ops/SUPABASE_FUNCTION_MANIFEST.md
docs/ops/SUPABASE_TARGETING.md
docs/measurement/CANONICAL_MEASUREMENT_ARCHITECTURE.md
docs/oracle/ORACLE_EVOLUTION_PROTOCOL.md
```

Use `docs/ops/DOC_STATUS_REGISTRY.md` before trusting historical planning docs.

If a historical doc conflicts with current canonical policy or executable repo truth, do not implement from the stale doc.