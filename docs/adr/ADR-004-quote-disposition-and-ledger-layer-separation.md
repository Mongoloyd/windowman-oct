# ADR-004: Quote Disposition and Market-Observation / Verified-Outcome Separation

Status: Proposed

Implementation authority: None

Operator approval required: Yes

Date: 2026-08-04

Repository-truth baseline: `d7e19f5d49a8054e39d2f5cf944df26ae11871fa`

Decision owner: WindowMan Architecture

Scope: Quoted-market observations, dispositions, verified outcomes, benchmarks, and recommendations

> **PROPOSED TARGET CONTRACT** — “Ledger” in the filename describes a conceptual trust and audit
> layer. This ADR does not claim a quote ledger table exists and does not propose a physical table,
> view, RPC, or migration.

> **PROPOSED TARGET CONTRACT** — Creating this ADR does not make it accepted or canonical and does
> not authorize implementation. It becomes binding only after an independent repository-truth
> audit, explicit operator approval, a separate commit, and reconciliation with
> [ADR-005](./ADR-005-server-minted-quote-intake-capability.md).

## Evidence labels

- **BASELINE EXECUTABLE CODE** — behavior present in inspected code at the baseline commit.
- **BASELINE SCHEMA/POLICY INTENT** — checked-in migration or generated-type intent; not deployment proof.
- **DEPLOYED STATE UNKNOWN** — live state was not inspected.
- **PROPOSED TARGET CONTRACT** — decision proposed by this ADR.
- **IMPLEMENTATION PREREQUISITE** — proof or work required before implementation.
- **DECISION REQUIRED** — unresolved operator policy.

## 1. Authority and dependency

**PROPOSED TARGET CONTRACT** — This ADR is subordinate to
[`AGENTS.md`](../../AGENTS.md), [`.cursor/PROTECTED_FILES.md`](../../.cursor/PROTECTED_FILES.md),
and [Protected Systems](../architecture/PROTECTED_SYSTEMS.md).

**PROPOSED TARGET CONTRACT** — Its dependency direction is:

```text
PROTECTED_SYSTEMS
→ ADR-004
```

**PROPOSED TARGET CONTRACT** — Proposed
[ADR-005](./ADR-005-server-minted-quote-intake-capability.md) may reference this ADR as an
implementation prerequisite. This ADR does not authorize ADR-005 or the Dormant Schema Sprint.

## 2. Shared terminology

**PROPOSED TARGET CONTRACT** — The four proposed governance documents use these definitions:

| Term | Definition used by the four proposed governance documents |
|---|---|
| Canonical analysis | The analysis lifecycle stored in `analyses`; `quote_analyses` remains legacy unless later repository evidence proves otherwise. |
| Report preview | A teaser-safe, allowlisted projection that excludes `full_json` and cannot reconstruct the full report. |
| Full report | The protected report payload containing `full_json` and other post-authorization detail. |
| Intake capability | The short-lived, server-minted, narrowly scoped bearer credential proposed by ADR-005 for future `/scan` intake. It is not identity or reveal authority. |
| Scan session | The per-scan canonical identity represented by `scan_session_id`; it must not be confused with a browser session or a lead. |
| Lead | Persistent canonical contact identity represented by `lead_id`; attachment does not prove phone ownership. |
| Phone verification | A backend-persisted Twilio Verify result bound to the exact canonical phone, lead, and scan required by the authorization contract. |
| Quoted-market observation | Evidence of an offer or estimate, not evidence that a transaction was booked, completed, or paid. |
| Verified outcome | A status-specific outcome accepted by a protected backend process under approved evidence and provenance rules. |
| Backend authorization | A protected server/database decision made from canonical state; never a browser flag, route, storage value, or UI condition. |
| Deployed-state unknown | Checked-in evidence exists, but the relevant live project, grant, policy, function version, secret, or configuration was not inspected. |

## 3. Context and baseline

**BASELINE SCHEMA/POLICY INTENT** — `quote_files` stores uploaded quote evidence and `scan_sessions`
binds a quote to a scan lifecycle.

**BASELINE SCHEMA/POLICY INTENT** — `analyses` is the canonical analysis lifecycle and contains
structured report data derived from quote evidence.

**BASELINE SCHEMA/POLICY INTENT** — `quote_analyses` remains a legacy table.

**BASELINE SCHEMA/POLICY INTENT** — Checked-in migrations define downstream
`contractor_outcomes.disposition_state`, value fields, integrity fields, `outcome_verified`, and
`outcome_verified_at`.

**BASELINE SCHEMA/POLICY INTENT** — Checked-in migrations also define operator lead-desk fields
such as `leads.admin_disposition`.

**BASELINE SCHEMA/POLICY INTENT** — Those structures belong to downstream contractor-outcome and
lead-desk workflows. They are not a quote-file disposition ledger.

**DEPLOYED STATE UNKNOWN** — Applied migrations, RLS, grants, Edge Function versions, data quality,
evidence contents, verification practice, and row populations were not inspected.

**PROPOSED TARGET CONTRACT** — The existence of a status column or `outcome_verified` Boolean does
not by itself prove that a row satisfies this ADR's future evidence policy.

## 4. Decision

**PROPOSED TARGET CONTRACT** — WindowMan separates quoted-market observations from
backend-verified outcomes.

**PROPOSED TARGET CONTRACT** — Uploaded quote evidence enters the quoted-market observation class.

**PROPOSED TARGET CONTRACT** — No uploaded quote enters the verified-outcome class automatically.

**PROPOSED TARGET CONTRACT** — Promotion to a verified outcome requires protected backend
acceptance of status-specific evidence under an approved verification policy.

**PROPOSED TARGET CONTRACT** — The two trust classes remain separately queryable and separately
labeled in reports, Oracle statistics, benchmarks, recommendations, and operator tools.

## 5. Trust class A — quoted-market observations

**PROPOSED TARGET CONTRACT** — Quoted-market observations may include:

- uploaded estimates;
- asking prices;
- proposed scope;
- quoted financing;
- quoted warranty;
- losing bids;
- abandoned bids;
- declined proposals;
- unknown outcomes.

**PROPOSED TARGET CONTRACT** — These records describe offers or stated terms. They do not prove a
booking, signed contract, installation, completion, payment, contractor performance, or final
installed scope.

**PROPOSED TARGET CONTRACT** — A quote may retain later disposition context such as won, lost,
abandoned, superseded, or unknown only when that context is clearly labeled by source and trust
level.

**PROPOSED TARGET CONTRACT** — A report grade, deterministic score, OCR confidence, high quote
value, homeowner interest, or contractor match does not promote an observation.

## 6. Trust class B — backend-verified outcomes

**PROPOSED TARGET CONTRACT** — Verified outcomes are status-specific. Examples may include:

- booked job;
- completed installation;
- paid transaction value;
- verified final scope;
- verified installed product;
- verified fulfillment contractor;
- verified outcome date.

**PROPOSED TARGET CONTRACT** — “Booked,” “completed,” and “paid” are distinct claims.

**PROPOSED TARGET CONTRACT** — A booked job does not prove installation or payment.

**PROPOSED TARGET CONTRACT** — A completed installation does not prove the amount was paid.

**PROPOSED TARGET CONTRACT** — A paid amount does not prove that quoted scope and installed scope
are identical.

**PROPOSED TARGET CONTRACT** — Each verified claim must identify exactly which status and facts
were verified. Verification must not spill into facts unsupported by the evidence.

## 7. Minimum verification-evidence contract

**PROPOSED TARGET CONTRACT** — Promotion into the verified-outcome class requires all of:

1. evidence received or reviewed through a protected backend or operator-authorized process;
2. binding to the exact relevant lead, opportunity, contractor, and scan/analysis when those
   identities exist;
3. an approved source type and source identity;
4. evidence specific to the claimed state;
5. deterministic validation of required value, currency, scope, product, contractor, and date
   fields when those facts are claimed;
6. conflict detection against existing canonical relationships and prior outcome claims;
7. recorded provenance, verification actor or trusted source, verification time, and policy
   version;
8. auditable transition from prior trust class and disposition;
9. fail-closed handling for missing, contradictory, stale, or unverifiable evidence.

**PROPOSED TARGET CONTRACT** — Booked status requires approved evidence of accepted commercial
intent tied to the exact opportunity. It does not imply field verification, completion, or payment.

**PROPOSED TARGET CONTRACT** — Completed status requires approved completion evidence tied to the
exact job and outcome. A booking record alone is insufficient.

**PROPOSED TARGET CONTRACT** — Paid status requires approved settled-payment evidence tied to the
exact transaction and value basis. A quote, invoice, conversion event, or “sold” label alone is
insufficient.

**PROPOSED TARGET CONTRACT** — Verified scope, product, contractor, and date each require evidence
that directly supports that fact.

**PROPOSED TARGET CONTRACT** — A contractor claim alone is insufficient unless an explicitly
approved verification policy later identifies a narrowly defined contractor assertion as adequate
for the specific claim.

**DECISION REQUIRED** — The approved evidence-source allowlist, corroboration requirements,
reviewer roles, recency windows, dispute policy, and status-specific evidence standards require
operator approval.

## 8. Disposition versus verification

**PROPOSED TARGET CONTRACT** — Disposition describes workflow state or what a participant reports
happened.

**PROPOSED TARGET CONTRACT** — Verification describes whether approved evidence supports a
specific outcome claim.

**PROPOSED TARGET CONTRACT** — A disposition such as `sold_closed` is not automatically a verified
installation or paid transaction.

**PROPOSED TARGET CONTRACT** — “Lost,” “abandoned,” and “unknown” observations remain useful market
evidence without becoming completed-transaction evidence.

**PROPOSED TARGET CONTRACT** — Disputed or contradictory outcomes remain outside verified
benchmark populations until resolved under approved policy.

## 9. Promotion and demotion law

**PROPOSED TARGET CONTRACT** — Promotion is a protected backend transition, not a browser update.

**PROPOSED TARGET CONTRACT** — AI cannot promote or demote an outcome.

**PROPOSED TARGET CONTRACT** — A contractor, homeowner, partner, or admin UI may submit evidence or
a claim. The UI submission itself is not verification.

**PROPOSED TARGET CONTRACT** — Revocation, correction, dispute, and supersession must retain prior
provenance and transition history.

**PROPOSED TARGET CONTRACT** — A corrected outcome must not rewrite historical quote evidence.

**PROPOSED TARGET CONTRACT** — Destructive relabeling that erases the original trust class is
forbidden.

## 10. Audit and provenance

**PROPOSED TARGET CONTRACT** — Every disposition or verification transition records:

- prior and resulting trust class;
- prior and resulting disposition;
- exact entity bindings;
- source type and source identifier;
- actor or trusted process;
- timestamp;
- evidence references;
- policy/version used;
- sanitized reason codes;
- correction, dispute, or supersession linkage when applicable.

**PROPOSED TARGET CONTRACT** — Audit metadata excludes raw secrets, OTPs, intake capabilities, raw
OCR text, unnecessary contact PII, and unrestricted private-document content.

**PROPOSED TARGET CONTRACT** — Private evidence remains behind appropriate storage, RLS, and
authorization controls.

## 11. Query and benchmark separation

**PROPOSED TARGET CONTRACT** — Observation queries and verified-outcome queries must be separately
addressable.

**PROPOSED TARGET CONTRACT** — A combined analytical output may include both populations only when
the classes are separately labeled, separately counted, and methodologically justified.

**PROPOSED TARGET CONTRACT** — Every benchmark or market claim discloses:

- trust class;
- quoted versus verified-sold population;
- sample size;
- geography;
- time window;
- value basis;
- scope normalization;
- provenance category;
- fallback or broadened cohort;
- known limitations.

**PROPOSED TARGET CONTRACT** — Thin, mixed, or low-quality samples must not be presented as
certainty.

**PROPOSED TARGET CONTRACT** — Median and distribution context is preferred where supported; an
average alone must not conceal sample limitations.

## 12. Recommendation and counter-offer boundary

**PROPOSED TARGET CONTRACT** — The intelligence engine may derive deterministic,
scope-normalized guidance from approved data.

**PROPOSED TARGET CONTRACT** — Guidance must identify whether its basis is quoted-market
observations, verified outcomes, or a labeled combination.

**PROPOSED TARGET CONTRACT** — Guidance must disclose sample limitations and fallback broadening.

**PROPOSED TARGET CONTRACT** — An unverified quote must not be presented as a completed-sale
benchmark.

**PROPOSED TARGET CONTRACT** — Observations and verified outcomes must not be mixed without
labeling.

**PROPOSED TARGET CONTRACT** — WindowMan guidance does not create a binding contractor offer or
final installed-price guarantee.

**PROPOSED TARGET CONTRACT** — An LLM cannot set final benchmark values, verified disposition, or
binding counter-offer terms.

## 13. AI, deterministic logic, and human authority

**PROPOSED TARGET CONTRACT** — AI may extract visible quote or outcome evidence and report
confidence, ambiguity, and contradictions.

**PROPOSED TARGET CONTRACT** — Deterministic TypeScript owns validation, normalization, cohort
membership, arithmetic, scope normalization, and benchmark calculation.

**PROPOSED TARGET CONTRACT** — Protected backend rules own trust-class transitions.

**PROPOSED TARGET CONTRACT** — Human approval owns structural evolution, evidence policy,
exception policy, and disputed-outcome resolution where automation cannot decide safely.

## 14. Tracking, event, and payment boundaries

**PROPOSED TARGET CONTRACT** — `event_logs` is operational telemetry and is not sales truth.

**PROPOSED TARGET CONTRACT** — Canonical marketing events and paid-media conversion events are not
outcome-verification evidence by themselves.

**PROPOSED TARGET CONTRACT** — A `quote_uploaded`, `phone_verified`, `report_revealed`,
appointment, lead, purchase, or conversion event does not prove a completed installation.

**PROPOSED TARGET CONTRACT** — A payment-intent, checkout, invoice, or purchase signal is not a
paid outcome unless the approved policy requires and verifies the relevant settled state and exact
entity binding.

**PROPOSED TARGET CONTRACT** — Tracking follows
`trackConversion`/`trackGtmEvent → dataLayer → GTM` and
`trackEvent → event_logs`; neither lane replaces the verified-outcome layer.

## 15. Relationship to current downstream structures

**BASELINE SCHEMA/POLICY INTENT** — Current checked-in contractor outcome fields include
disposition, final value, value basis, integrity status/reasons, outcome source, and verification
flags.

**BASELINE SCHEMA/POLICY INTENT** — Current checked-in lead fields include an operator
`admin_disposition` workflow.

**PROPOSED TARGET CONTRACT** — Lead-desk disposition remains distinct from contractor outcome,
quote observation, and verified transaction outcome.

**PROPOSED TARGET CONTRACT** — Existing `contractor_outcomes` may be evaluated as a candidate
implementation surface only after repository, deployed-schema, writer, evidence, RLS, audit, and
data-quality review.

**PROPOSED TARGET CONTRACT** — This ADR does not rename, replace, promote, or declare canonical any
existing downstream table.

## 16. Schema boundary

**PROPOSED TARGET CONTRACT** — This ADR defines logical trust classes and transition law only.

**PROPOSED TARGET CONTRACT** — It does not define physical tables, columns, enums, views, RPCs,
triggers, grants, policies, or indexes.

**DECISION REQUIRED** — Determine whether approved implementation extends existing
`contractor_outcomes`, creates a separate authorized read model, introduces a protected evidence
store, or uses another reviewed design.

**DECISION REQUIRED** — Determine how quoted observations link to later outcomes without changing
or erasing raw evidence.

**DECISION REQUIRED** — Determine immutable-audit, correction, dispute, deletion, and retention
mechanisms.

**DECISION REQUIRED** — Determine authorized writers, reviewers, tenant isolation, RLS, RPC
signatures, and generated-type workflow.

**DECISION REQUIRED** — Determine how booked, completed, installed, invoiced, paid, refunded,
canceled, and disputed states remain distinct.

## 17. Implementation prerequisites

**IMPLEMENTATION PREREQUISITE** — Inventory every current outcome and disposition writer,
including contractor, partner, admin, cron, webhook, and database paths.

**IMPLEMENTATION PREREQUISITE** — Inspect exact deployed tables, constraints, RLS, grants,
functions, views, and data populations.

**IMPLEMENTATION PREREQUISITE** — Audit whether any current code can set `outcome_verified` and
what evidence it requires.

**IMPLEMENTATION PREREQUISITE** — Approve the evidence-source allowlist and status-specific
verification policy.

**IMPLEMENTATION PREREQUISITE** — Define tenant, actor, identity, dispute, correction, and
retention controls.

**IMPLEMENTATION PREREQUISITE** — Prove browser input, AI output, contractor assertion alone,
event logs, and paid-media events cannot create verified outcome truth.

**IMPLEMENTATION PREREQUISITE** — Validate quoted and verified populations separately before
publishing benchmarks.

## 18. Failure semantics

**PROPOSED TARGET CONTRACT** — Missing evidence yields an unverified or needs-review state.

**PROPOSED TARGET CONTRACT** — Contradictory evidence yields disputed or manual-review handling.

**PROPOSED TARGET CONTRACT** — Identity mismatch blocks promotion.

**PROPOSED TARGET CONTRACT** — Unsupported value basis blocks value-based benchmark inclusion.

**PROPOSED TARGET CONTRACT** — Unknown payment settlement blocks paid classification.

**PROPOSED TARGET CONTRACT** — Verification-system failure does not downgrade raw observation
evidence and does not fabricate a verified outcome.

## 19. Prohibited shortcuts

**PROPOSED TARGET CONTRACT** — The following are forbidden:

- uploaded quote automatically becomes a verified outcome;
- report grade proves a sale;
- OCR confidence proves a sale;
- phone verification proves a sale;
- contractor claim alone proves a verified outcome without approved policy;
- browser sets verified disposition;
- AI sets verified disposition;
- event logs become sales truth;
- paid-media conversions become ledger truth;
- booked automatically means installed, completed, or paid;
- one Boolean silently verifies every outcome fact;
- observation and outcome cohorts are mixed without labels;
- sample limitations are hidden;
- raw provenance is discarded;
- an ADR approval is treated as schema or migration authority.

## 20. Consequences

**PROPOSED TARGET CONTRACT** — Quote intelligence remains useful even when final outcome is
unknown.

**PROPOSED TARGET CONTRACT** — Verified sold benchmarks become smaller but more trustworthy.

**PROPOSED TARGET CONTRACT** — Operators and analytics must handle multiple status-specific trust
states instead of one ambiguous “won” field.

**PROPOSED TARGET CONTRACT** — Evidence collection, review, dispute, and audit add operational
cost.

**PROPOSED TARGET CONTRACT** — The separation prevents acquisition telemetry and optimistic
partner claims from contaminating market truth.

## 21. Evidence appendix

**BASELINE SCHEMA/POLICY INTENT** — Core quote and analysis evidence:

- [`20260317051701_bdf3572f-5d3e-4662-b4db-31d55ae58ece.sql`](../../supabase/migrations/20260317051701_bdf3572f-5d3e-4662-b4db-31d55ae58ece.sql),
  lines 3–35.
- [`20260318033459_e89c0529-98a4-418d-ab84-852d4730de94.sql`](../../supabase/migrations/20260318033459_e89c0529-98a4-418d-ab84-852d4730de94.sql),
  lines 30–100.

**BASELINE SCHEMA/POLICY INTENT** — Current downstream disposition/outcome evidence:

- [`20260424100000_add_disposition_to_contractor_outcomes.sql`](../../supabase/migrations/20260424100000_add_disposition_to_contractor_outcomes.sql),
  lines 1–106.
- [`20260427170000_contractor_outcome_integrity.sql`](../../supabase/migrations/20260427170000_contractor_outcome_integrity.sql),
  lines 1–190.
- [`20260611130000_add_admin_lead_disposition_fields.sql`](../../supabase/migrations/20260611130000_add_admin_lead_disposition_fields.sql),
  lines 1–27.
- [`src/integrations/supabase/types.ts`](../../src/integrations/supabase/types.ts), lines
  1362–1428 and 2672–2760.

**DEPLOYED STATE UNKNOWN** — No live schema, production data, private quote file, contractor
evidence, payment record, or remote Supabase state was accessed while creating this Proposed ADR.

## 22. Acceptance checklist

- [ ] Status remains Proposed.
- [ ] Implementation authority remains None.
- [ ] Operator approval remains required.
- [ ] “Ledger” is not represented as an existing table.
- [ ] Uploaded estimates remain quoted-market observations.
- [ ] Verified outcomes require status-specific backend evidence.
- [ ] Booked, completed, installed, and paid remain distinct.
- [ ] Contractor claim alone is insufficient absent approved policy.
- [ ] Browser and AI cannot set verified disposition.
- [ ] Report grades do not prove sales.
- [ ] Event logs and paid-media conversions are not sales truth.
- [ ] Provenance and transition audit are retained.
- [ ] Raw observations and verified outcomes are separately queryable.
- [ ] Benchmarks disclose class, sample, provenance, and limits.
- [ ] Recommendations do not become binding offers.
- [ ] No physical schema or RPC is invented.
- [ ] All schema choices remain **DECISION REQUIRED**.
- [ ] ADR-005 remains Proposed and implementation-blocked.
