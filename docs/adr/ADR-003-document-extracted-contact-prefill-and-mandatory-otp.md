# ADR-003: Document-Extracted Contact Prefill and Mandatory Exact-Session SMS OTP

Status: Accepted

Implementation authority: None

Operator approval required: Yes

The document is accepted governing law.

Acceptance does not authorize protected implementation.
A separately authorized implementation sprint remains required.

Date: 2026-08-04

Repository-truth baseline: `d7e19f5d49a8054e39d2f5cf944df26ae11871fa`

Governance adoption: the documents were committed as Proposed at `d828b157`, independently audited,
explicitly approved, and subsequently promoted to Accepted/CANONICAL status in repository history.

Decision owner: WindowMan Architecture

Scope: Future document-extracted contact proposal, guarded lead attachment, and mandatory exact-session SMS OTP policy, including the proposed ADR-005 `/scan` intake.

> **GOVERNING TARGET CONTRACT** — This ADR is accepted governing law registered as CANONICAL in
> [`DOC_STATUS_REGISTRY.md`](../ops/DOC_STATUS_REGISTRY.md) and routed by
> [`START_HERE.md`](../START_HERE.md). It does not authorize protected implementation.
> [ADR-005](./ADR-005-server-minted-quote-intake-capability.md) remains Proposed and
> implementation-blocked except where its prerequisites 1–4 are satisfied by upstream governance
> adoption.

## Evidence labels

- **BASELINE EXECUTABLE CODE** — behavior present in inspected code at the baseline commit.
- **BASELINE SCHEMA/POLICY INTENT** — checked-in migration or generated-type intent; not deployment proof.
- **DEPLOYED STATE UNKNOWN** — live state was not inspected.
- **GOVERNING TARGET CONTRACT** — An accepted architectural or security requirement governing future authorized work. It does not claim that the target behavior is already implemented or deployed.
- **IMPLEMENTATION PREREQUISITE** — proof or work required before implementation.
- **DECISION REQUIRED** — unresolved operator policy.

## 1. Authority and dependencies

**GOVERNING TARGET CONTRACT** — This ADR is subordinate to
[`AGENTS.md`](../../AGENTS.md), [`.cursor/PROTECTED_FILES.md`](../../.cursor/PROTECTED_FILES.md),
and [Protected Systems](../architecture/PROTECTED_SYSTEMS.md).

**GOVERNING TARGET CONTRACT** — Route behavior is governed by
[`ROUTE_SCAN.md`](../architecture/ROUTE_SCAN.md).

**GOVERNING TARGET CONTRACT** — ADR-005 defines the proposed technical mechanics used to satisfy
this ADR's contact-trust and mandatory exact-session OTP policy. ADR-005 does not own or weaken
ADR-003 policy decisions. When ADR-005 mechanics conflict with Protected Systems, ROUTE_SCAN, or
ADR-003, ADR-005 requires reconciliation before implementation.

**GOVERNING TARGET CONTRACT** — Normative policy relationship:

```text
PROTECTED_SYSTEMS
→ governs every protected boundary

ROUTE_SCAN
→ governs future /scan route behavior

ADR-003
→ governs document-extracted contact trust
→ governs lead-before-OTP ordering
→ governs mandatory exact-session OTP policy
```

**GOVERNING TARGET CONTRACT** — Implementation conformance (ADR-005 mechanics must conform upstream):

```text
ADR-005 proposed mechanics
→ must conform to PROTECTED_SYSTEMS
→ must conform to ROUTE_SCAN
→ must conform to ADR-003
```

**GOVERNING TARGET CONTRACT** — ADR-003 owns policy: OTP cannot be skipped; OCR is not verification;
confirmation is not verification; lead attachment precedes OTP; exact-session isolation is mandatory;
cross-scan unlock is forbidden.

**GOVERNING TARGET CONTRACT** — ADR-005 owns proposed mechanics including capability minting,
capability hashing and expiration, upload binding, OTP reservation RPC mechanics, claim-token
mechanics, transaction A, external Twilio call, transaction B compare-and-set finalization,
intake-specific legacy-call rejection, and outbox/event mechanics.

**GOVERNING TARGET CONTRACT** — Approval of this ADR alone does not authorize ADR-005, OTP,
scanner, schema, RLS, route, tracking, or deployment changes.

### 1.1 Target perimeter and legacy exclusion

**GOVERNING TARGET CONTRACT** — This ADR governs future document-extracted contact flows, including
the proposed `/scan` intake.

**GOVERNING TARGET CONTRACT** — This ADR does not modify current homepage, Nextdoor, Report Classic,
or other legacy OTP behavior until those callers are separately audited, migrated, tested, and
approved under an explicit implementation sprint.

**GOVERNING TARGET CONTRACT** — Approval of this ADR does not itself authorize changes to
UploadZone, usePhonePipeline, phoneVerificationService, send-otp, verify-otp, or existing
null-session fallback behavior.

**GOVERNING TARGET CONTRACT** — Legacy surfaces may continue their inspected baseline behavior until
a separately authorized migration changes them.

**GOVERNING TARGET CONTRACT** — The contact-trust hierarchy, browser-distrust model, and
Verify-to-Reveal invariants remain globally applicable.

**GOVERNING TARGET CONTRACT** — Applying ADR-003 target mechanics to an existing legacy surface
requires:

- exact caller inventory;
- current behavior audit;
- parity tests;
- denied-path tests;
- cross-session tests;
- rollback;
- explicit protected-system authority.

## 2. Shared terminology

**GOVERNING TARGET CONTRACT** — The four accepted governance documents use these definitions:

| Term | Definition used by the four accepted governance documents |
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

**BASELINE EXECUTABLE CODE** — The inspected `scan-quote` extraction contract does not contain a
dedicated document-contact proposal contract with field-level provenance and confidence.

**BASELINE EXECUTABLE CODE** — Current browser OTP transport sends `phone_e164` and optional
`scan_session_id` through `phoneVerificationService.ts` to `send-otp` and `verify-otp`.

**BASELINE EXECUTABLE CODE** — Current `send-otp` can create a pending verification with a null
scan binding when no scan is provided.

**BASELINE EXECUTABLE CODE** — Current `verify-otp` contains a legacy fallback to a pending
verification whose scan binding is null.

**BASELINE EXECUTABLE CODE** — Current `verify-otp` resolves the lead from `scan_sessions.lead_id`
when a scan is provided and fails if the scan has no lead.

**BASELINE SCHEMA/POLICY INTENT** — The checked-in `get_analysis_full(uuid, text)` predicate
requires a verified phone-verification row bound to the exact requested scan and matching lead.

**DEPLOYED STATE UNKNOWN** — Live function versions, Twilio configuration, verification rows,
feature flags, RPC bodies, and grants were not inspected.

## 4. Decision

**GOVERNING TARGET CONTRACT** — OCR may propose contact fields to reduce manual entry.

**GOVERNING TARGET CONTRACT** — OCR does not verify identity, phone ownership, lead ownership, or
report authorization.

**GOVERNING TARGET CONTRACT** — User confirmation does not verify identity or phone ownership.

**GOVERNING TARGET CONTRACT** — Exact-session SMS OTP remains mandatory even when a proposed phone
has high extraction confidence, the user confirms it, or the phone appears on an existing verified
lead.

**GOVERNING TARGET CONTRACT** — The required sequence is:

```text
OCR proposal
→ confidence and provenance
→ user review or manual entry
→ deterministic normalization
→ guarded canonical lead attachment
→ backend OTP reservation
→ SMS verification
→ exact-session reveal authorization
```

## 5. Contact trust model

**GOVERNING TARGET CONTRACT** — Contact data follows:

```text
OCR-proposed
< user-confirmed
< backend-attached unverified
< backend exact-session verified
```

**GOVERNING TARGET CONTRACT** — `OCR-proposed` means a model identified visible contact text and
reported field-level confidence and evidence provenance.

**GOVERNING TARGET CONTRACT** — `user-confirmed` means the user reviewed or replaced the proposal.
It remains unverified input.

**GOVERNING TARGET CONTRACT** — `backend-attached unverified` means a guarded backend process
normalized the confirmed input and attached one canonical lead to the exact scan.

**GOVERNING TARGET CONTRACT** — `backend exact-session verified` means a protected backend process
committed Twilio approval against the exact canonical phone, lead, verification row, and scan
required by the authorization predicate.

## 6. OCR proposal contract

**GOVERNING TARGET CONTRACT** — Each proposed contact field must carry:

- the proposed value;
- field-level confidence;
- document/page or equivalent provenance;
- extraction status;
- ambiguity or conflict indication;
- whether user review is required.

**GOVERNING TARGET CONTRACT** — Low confidence must be visible to the user.

**GOVERNING TARGET CONTRACT** — Missing fields must fall back to manual entry.

**GOVERNING TARGET CONTRACT** — Conflicting values must be shown as ambiguous and must not be
silently merged.

**GOVERNING TARGET CONTRACT** — Raw OCR text is protected backend evidence and must not be returned
merely to implement prefill.

**GOVERNING TARGET CONTRACT** — The browser may receive only the minimum allowlisted proposal needed
for review.

**DECISION REQUIRED** — Approved contact fields, confidence vocabulary, confidence thresholds,
provenance granularity, and proposal retention period are not defined by inspected repository
truth.

## 7. User review and deterministic normalization

**GOVERNING TARGET CONTRACT** — The user must be able to accept, edit, or replace each proposal
before OTP starts.

**GOVERNING TARGET CONTRACT** — A prefilled phone is visually identified as extracted rather than
verified.

**GOVERNING TARGET CONTRACT** — Client validation exists for UX only.

**GOVERNING TARGET CONTRACT** — Trusted backend code repeats format and policy validation.

**GOVERNING TARGET CONTRACT** — Phone normalization is deterministic and produces the canonical
format required by the approved OTP contract.

**GOVERNING TARGET CONTRACT** — Ambiguous identity or conflicting canonical matches fail closed.

**BASELINE EXECUTABLE CODE** — Current `send-otp` enforces US E.164.

**DECISION REQUIRED** — Supported phone regions and the approved canonicalization rules require
operator policy. This Proposed ADR does not silently make the inspected baseline a permanent
product decision.

## 8. Guarded canonical lead attachment

**GOVERNING TARGET CONTRACT** — Canonical lead attachment must commit before OTP reservation begins.

**GOVERNING TARGET CONTRACT** — The backend resolves or creates the lead from guarded rules and
canonical relationships. The browser does not select the authoritative `lead_id`.

**GOVERNING TARGET CONTRACT** — The attached lead must be bound to the exact canonical scan before
OTP start.

**GOVERNING TARGET CONTRACT** — Lead attachment remains unverified.

**GOVERNING TARGET CONTRACT** — Native-lead resolution or any existing upsert helper must not be
assumed guard-safe for intake until its exact conflict, tenant, attribution, and identity behavior
is audited.

**IMPLEMENTATION PREREQUISITE** — Define and test duplicate, conflict, tenant, prior-verification,
and ambiguous-match behavior in an authorized implementation sprint.

## 9. Mandatory exact-session OTP

**GOVERNING TARGET CONTRACT** — ADR-003 defines the mandatory, non-skippable, exact-session OTP
policy.

**GOVERNING TARGET CONTRACT** — Proposed [ADR-005](./ADR-005-server-minted-quote-intake-capability.md)
§§6.9–6.10 define the proposed reservation, claim, external-call, and conditional-finalization
mechanics used to implement that policy.

**GOVERNING TARGET CONTRACT** — An extracted phone may prefill the OTP form.

**GOVERNING TARGET CONTRACT** — An extracted phone never skips SMS OTP.

**GOVERNING TARGET CONTRACT** — User confirmation never skips SMS OTP.

**GOVERNING TARGET CONTRACT** — Existing lead-level verification never implicitly authorizes a new
scan.

**GOVERNING TARGET CONTRACT** — Intake-bound OTP start requires a backend reservation tied to the
capability, attached lead, canonical phone, and exact non-null scan.

**GOVERNING TARGET CONTRACT** — Intake-bound OTP verification requires one exact pending
verification row matching the capability, lead, canonical phone, non-null scan, pending state, and
expiry.

**GOVERNING TARGET CONTRACT** — Concurrent verification uses ADR-005's two-transaction protocol:
serialized database claim, external Twilio call after commit, then compare-and-set finalization in
a separate transaction.

**GOVERNING TARGET CONTRACT** — Twilio approval alone does not produce `verified: true`.

**GOVERNING TARGET CONTRACT** — Only committed exact-session backend verification may advance to
reveal authorization.

## 10. Reveal and report data

**GOVERNING TARGET CONTRACT** — `full_json` remains backend-gated.

**GOVERNING TARGET CONTRACT** — A browser receives the full report only through `report-access`
after the exact-session predicate succeeds.

**GOVERNING TARGET CONTRACT** — OCR contact confidence, user confirmation, lead attachment, OTP sent,
OTP entered, or local verified state is insufficient for full-report access.

**GOVERNING TARGET CONTRACT** — One verified phone/session cannot unlock another scan.

**GOVERNING TARGET CONTRACT** — Admin, contractor, or partner access does not equal homeowner
report authorization.

## 11. Privacy and tracking

**GOVERNING TARGET CONTRACT** — OCR text, proposed contact values, confirmed contact PII, OTP codes,
verification-row IDs, capability material, and claim tokens are protected.

**GOVERNING TARGET CONTRACT** — Raw contact PII must not enter `window.dataLayer`, `event_logs`,
console logs, URLs, filenames, Storage paths, or third-party error payloads.

**GOVERNING TARGET CONTRACT** — Business events follow
`trackConversion`/`trackGtmEvent → dataLayer → GTM`.

**GOVERNING TARGET CONTRACT** — Operational telemetry follows `trackEvent → event_logs`.

**GOVERNING TARGET CONTRACT** — Telemetry may record sanitized state and reason codes only. It is
not verification truth.

## 12. Decision table

**GOVERNING TARGET CONTRACT** — The table defines target behavior and does not claim these branches
currently exist.

| Scenario | Required target behavior | Forbidden result |
|---|---|---|
| High-confidence phone | Prefill with confidence/provenance, require user review, normalize on backend, attach lead, reserve exact-session OTP, verify by SMS. | Auto-verification or reveal. |
| Low-confidence phone | Mark uncertainty visibly; require correction or explicit review; continue only through normal OTP sequence. | Hidden uncertainty or threshold-based OTP bypass. |
| No phone | Require manual phone entry and backend validation before lead attachment/OTP. | Fabricated phone or reveal without OTP. |
| Conflicting phones | Present ambiguity or require manual entry; fail closed until one value is explicitly chosen and normalized. | Silent merge or model-selected identity. |
| Existing verified lead | Resolve under guarded rules; require a new exact-session OTP binding for this scan. | Lead-wide or prior-scan unlock. |
| Ambiguous lead match | Stop guarded attachment and require approved recovery or manual review. | Browser-selected `lead_id` or arbitrary merge. |
| OTP timeout | Keep report locked; safely release or expire the claim under backend policy; permit retry only through approved reservation state. | Treat timeout as approval. |
| OTP denial | Keep report locked; persist sanitized denial state and apply abuse limits. | Reveal, verified lead mutation, or raw Twilio error leakage. |
| Stale verification claim | Recover under a locked backend transaction; reject stale finalization. | Reuse stale claim token or accept late approval blindly. |
| Duplicate verification request | One request may own an active claim; others receive a safe in-progress/idempotent response. | Two successful finalizations. |
| Manual-review requirement | Preserve protected evidence and route to approved review without granting reveal. | Manual-review flag used as authorization. |

## 13. Failure semantics

**GOVERNING TARGET CONTRACT** — Distinct user-safe states include:

- contact proposal unavailable;
- low-confidence proposal;
- conflicting proposal;
- invalid manual entry;
- ambiguous lead match;
- lead attachment failed;
- OTP reservation failed;
- OTP rate limited;
- OTP send failed;
- wrong or expired code;
- verification in progress;
- stale claim;
- Twilio timeout or indeterminate response;
- finalization failed after Twilio response;
- stale or mismatched scan;
- unauthorized full-report request;
- manual review required.

**GOVERNING TARGET CONTRACT** — Every failure keeps the full report locked unless backend
authorization independently succeeds on a later request.

## 14. AI and deterministic ownership

**GOVERNING TARGET CONTRACT** — AI extracts contact evidence, candidate values, conflicts, and
confidence.

**GOVERNING TARGET CONTRACT** — Deterministic TypeScript validates field shape, normalizes phone
format under approved rules, applies route policy, and shapes allowlisted proposals.

**GOVERNING TARGET CONTRACT** — Protected backend/database code owns lead attachment, OTP
reservation, verification persistence, exact-session authorization, and reveal.

**GOVERNING TARGET CONTRACT** — AI cannot select canonical identity, set phone verification, or
authorize reveal.

## 15. Implementation prerequisites

**IMPLEMENTATION PREREQUISITE** — Reconcile the final contact extraction contract with current
scanner schema, protected payload shaping, and raw OCR retention law.

**IMPLEMENTATION PREREQUISITE** — Approve field-level confidence and provenance semantics without
inventing unsupported numeric thresholds.

**IMPLEMENTATION PREREQUISITE** — Approve the guarded lead resolver and exact conflict behavior.

**IMPLEMENTATION PREREQUISITE** — Approve ADR-005 capability-bound OTP wrappers and legacy intake
guards.

**IMPLEMENTATION PREREQUISITE** — Preserve and test the exact-session `get_analysis_full`
predicate.

**IMPLEMENTATION PREREQUISITE** — Prove direct browser raw report RPCs and intake-bound legacy OTP
calls are rejected.

**IMPLEMENTATION PREREQUISITE** — Complete privacy, abuse, concurrency, retry, accessibility, and
manual-review threat modeling.

## 16. Decisions required

**DECISION REQUIRED** — Which contact fields may OCR propose?

**DECISION REQUIRED** — What confidence vocabulary and thresholds are approved?

**DECISION REQUIRED** — What provenance detail may be shown without exposing raw OCR text?

**DECISION REQUIRED** — What exact rules resolve an existing lead versus create a new lead?

**DECISION REQUIRED** — What happens when email and phone resolve to different candidate leads?

**DECISION REQUIRED** — Which phone regions are supported?

**DECISION REQUIRED** — What is the proposal and confirmed-PII retention/deletion policy?

**DECISION REQUIRED** — Who may perform manual review, and what evidence may that reviewer see?

**DECISION REQUIRED** — What user-facing recovery applies after Twilio approval but failed
database finalization?

## 17. Consequences

**GOVERNING TARGET CONTRACT** — Prefill can reduce typing while preserving mandatory verification.

**GOVERNING TARGET CONTRACT** — Explicit provenance and confidence make uncertainty visible.

**GOVERNING TARGET CONTRACT** — Exact-session OTP prevents a previously verified phone or lead from
implicitly unlocking a different scan.

**GOVERNING TARGET CONTRACT** — Guarded attachment introduces additional backend and recovery work.

**GOVERNING TARGET CONTRACT** — Ambiguous identity intentionally fails closed and may require manual
review.

## 18. Evidence appendix

**BASELINE EXECUTABLE CODE** — Browser and OTP:

- [`src/services/phoneVerificationService.ts`](../../src/services/phoneVerificationService.ts),
  lines 66–130.
- [`src/hooks/usePhonePipeline.ts`](../../src/hooks/usePhonePipeline.ts), pipeline modes and OTP
  calls.
- [`supabase/functions/send-otp/index.ts`](../../supabase/functions/send-otp/index.ts), lines
  104–397.
- [`supabase/functions/verify-otp/index.ts`](../../supabase/functions/verify-otp/index.ts), lines
  90–575.
- [`supabase/functions/scan-quote/index.ts`](../../supabase/functions/scan-quote/index.ts), current
  extraction and deterministic processing.

**BASELINE SCHEMA/POLICY INTENT** — Exact-session authorization:

- [`20260428120000_restore_get_analysis_full_strict_scan_binding.sql`](../../supabase/migrations/20260428120000_restore_get_analysis_full_strict_scan_binding.sql),
  lines 15–92.
- [`src/integrations/supabase/types.ts`](../../src/integrations/supabase/types.ts), lines
  3128–3170 for the checked-in `phone_verifications` shape.

**DEPLOYED STATE UNKNOWN** — No live verification flow, phone number, customer data, or Supabase
environment was accessed while authoring this accepted ADR.

## 19. Acceptance checklist

- [ ] Document authority: Status is Accepted and governing.
- [ ] Runtime implementation: not authorized and not presumed present.
- [ ] Implementation authority remains None.
- [ ] Operator approval remains required.
- [ ] OCR proposals include confidence and provenance.
- [ ] Low confidence remains visible.
- [ ] Missing fields have manual fallback.
- [ ] Conflicts fail closed.
- [ ] User confirmation does not become verification.
- [ ] Guarded canonical lead attachment commits before OTP start.
- [ ] Existing lead verification does not unlock a new scan.
- [ ] Exact-session SMS OTP remains mandatory.
- [ ] Twilio approval alone cannot return verified success.
- [ ] One scan cannot unlock another.
- [ ] `full_json` remains behind backend authorization.
- [ ] Raw OCR text and PII remain protected.
- [ ] No raw PII enters tracking.
- [ ] No confidence threshold or physical schema is invented.
- [ ] ADR-005 remains Proposed and implementation-blocked.
- [ ] ADR-003 is explicitly bounded to future document-extracted flows.
- [ ] Existing homepage, Nextdoor, Classic, and legacy OTP behavior remains unchanged until separately migrated.
- [ ] ADR-003 policy ownership is distinct from ADR-005 mechanics.
