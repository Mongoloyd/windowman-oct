# `/scan` Route Law — Proposed Perimeter Contract

Status: Proposed

Implementation authority: None

Operator approval required: Yes

Date: 2026-08-04

Repository-truth baseline: `d7e19f5d49a8054e39d2f5cf944df26ae11871fa`

Scope: Future production `/scan` route only

> **PROPOSED TARGET CONTRACT** — Creating this file does not mount `/scan`, make this document
> canonical, or authorize implementation. It becomes binding only after an independent
> repository-truth audit, explicit operator approval, a separate commit, and reconciliation with
> [ADR-005](../adr/ADR-005-server-minted-quote-intake-capability.md).

## Evidence labels

- **BASELINE EXECUTABLE CODE** — behavior present in inspected code at the baseline commit.
- **BASELINE SCHEMA/POLICY INTENT** — checked-in migration or generated-type intent; not deployment proof.
- **DEPLOYED STATE UNKNOWN** — live state was not inspected.
- **PROPOSED TARGET CONTRACT** — route law proposed here.
- **IMPLEMENTATION PREREQUISITE** — proof or work required before implementation.
- **DECISION REQUIRED** — unresolved operator policy.

## 1. Authority and dependencies

**PROPOSED TARGET CONTRACT** — This route contract is subordinate to
[`AGENTS.md`](../../AGENTS.md), [`.cursor/PROTECTED_FILES.md`](../../.cursor/PROTECTED_FILES.md),
and [Protected Systems](./PROTECTED_SYSTEMS.md).

**PROPOSED TARGET CONTRACT** — Contact prefill and mandatory exact-session OTP **policy** is
governed by [ADR-003](../adr/ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md).

**PROPOSED TARGET CONTRACT** — Proposed [ADR-005](../adr/ADR-005-server-minted-quote-intake-capability.md)
defines intake capability, signed upload, scanner dispatch, and capability-bound OTP **mechanics**.
ADR-005 does not own or weaken ADR-003 policy. When ADR-005 mechanics conflict with Protected
Systems, this document, or ADR-003, ADR-005 requires reconciliation before implementation.

**PROPOSED TARGET CONTRACT** — Document ownership (reading order: see Protected Systems §2.4):

| Document | Owns | Does not own |
| --- | --- | --- |
| `PROTECTED_SYSTEMS.md` | Repository-wide protected-system law | Detailed route or implementation mechanics |
| `ROUTE_SCAN.md` | Future `/scan` route behavior, route state, route-specific security constraints | OTP transaction mechanics or physical schema |
| ADR-003 | Document-extracted contact trust, guarded lead-attachment ordering, mandatory exact-session OTP policy | Capability schema, RPC signatures, claim-token mechanics |
| ADR-005 | Proposed intake capability, signed upload, scanner dispatch, event, OTP reservation/claim/finalization mechanics | Authority to weaken upstream contact-trust or OTP policy |
| ADR-004 | Quoted-observation versus verified-outcome trust law | Contact, OTP, route, or intake capability policy |

**PROPOSED TARGET CONTRACT** — **Normative authority** (policy chain):

```text
PROTECTED_SYSTEMS
→ ROUTE_SCAN
→ ADR-003
```

**PROPOSED TARGET CONTRACT** — **Implementation conformance**:

```text
ADR-005 proposed mechanics
→ must conform to PROTECTED_SYSTEMS
→ must conform to ROUTE_SCAN
→ must conform to ADR-003
```

**PROPOSED TARGET CONTRACT** — None of these links authorize ADR-005 implementation or the
Dormant Schema Sprint.

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

## 3. Inspected route baseline

**BASELINE EXECUTABLE CODE** — `src/pages/ScanFunnelPage.tsx` exists.

**BASELINE EXECUTABLE CODE** — `ScanFunnelPage.tsx` renders `PreUploadIntake`.

**BASELINE EXECUTABLE CODE** — `PreUploadIntake` identifies itself as a visual harness with no
Supabase, production routing, or analytics wiring.

**BASELINE EXECUTABLE CODE** — `src/App.tsx` does not import or register `ScanFunnelPage`.

**BASELINE EXECUTABLE CODE** — `src/App.tsx` has no `/scan` route.

**BASELINE EXECUTABLE CODE** — The catch-all `*` route renders `NotFound`; therefore `/scan` falls
through to `NotFound` in the inspected React router.

**DEPLOYED STATE UNKNOWN** — Hosting or edge rewrites outside the inspected route graph were not
live-verified.

## 4. Current production upload boundary

**BASELINE EXECUTABLE CODE** — Production `UploadZone` callers are the homepage `Index.tsx` and
Nextdoor `NextdoorQuoteUpload.tsx`.

**BASELINE EXECUTABLE CODE** — `UploadZone` currently chooses a deterministic Storage path under a
browser-held session scope and uploads directly to the private `quotes` bucket.

**BASELINE EXECUTABLE CODE** — `UploadZone` then invokes `start-upload-scan-session` and receives
canonical quote and scan IDs from the backend.

**BASELINE EXECUTABLE CODE** — `UploadZone` invokes `scan-quote` from the browser with the returned
`scan_session_id` and an event ID.

**BASELINE SCHEMA/POLICY INTENT** — Checked-in Storage policy intent allows broad browser writes to
the `quotes` bucket so current callers can upload and retry.

**DEPLOYED STATE UNKNOWN** — Live Storage policies, bucket configuration, function versions, and
`ENFORCE_CONTACT_OWNED_UPLOAD` were not inspected.

## 5. Proposed route purpose

**PROPOSED TARGET CONTRACT** — `/scan` is the future quote-first intake perimeter.

**PROPOSED TARGET CONTRACT** — The route may stage user input and display backend lifecycle
projections. It never owns canonical identity, upload completion, scanner eligibility, OTP truth,
report authorization, or outcome truth.

**PROPOSED TARGET CONTRACT** — Route name and route entry confer no privilege.

## 6. Proposed target flow

**PROPOSED TARGET CONTRACT** — The route sequence is:

```text
route entry
→ capability mint
→ exact-path signed upload
→ validation and quarantine
→ canonical quote/scan binding
→ protected scanner dispatch
→ processing
→ optional proof and preview projections when eligible
→ contact confirmation
→ guarded lead attachment
→ OTP reservation and verification
→ report-access full request
→ exact-session full reveal
```

**PROPOSED TARGET CONTRACT** — `classifyScanGate` termination creates a rejected or safe-recovery
state and does not continue into report readiness.

**PROPOSED TARGET CONTRACT** — Later extraction failure may create `needs_better_upload` or another
safe failure state. It does not fabricate report readiness.

**PROPOSED TARGET CONTRACT** — A report preview may be requested only through `report-access`.

**PROPOSED TARGET CONTRACT** — Full reveal may occur only after exact-session backend authorization.

## 7. Capability and browser custody

**PROPOSED TARGET CONTRACT** — The browser may temporarily hold only the raw intake capability and
allowlisted lifecycle projection needed for its own intake.

**PROPOSED TARGET CONTRACT** — Preferred capability custody is memory.

**PROPOSED TARGET CONTRACT** — Same-tab recovery may use `sessionStorage` only if ADR-005's final
approved contract permits it.

**PROPOSED TARGET CONTRACT** — The capability, claim token, OTP, raw OCR text, and `full_json`
must not enter persistent browser storage, the navigable address bar, route parameters, query
strings, URL fragments, browser history, analytics, dataLayer, logs, support payloads, or third-party
error payloads.

**PROPOSED TARGET CONTRACT** — Browser memory is untrusted and is permitted only as transient
custody required to perform the authorized upload.

**PROPOSED TARGET CONTRACT** — An exact-path **signed upload URL** may exist transiently in browser
memory and in the single authorized upload request. It must not be:

- persisted in `localStorage` or `sessionStorage`;
- placed in React route state intended for persistence;
- placed in the browser address bar;
- appended to route parameters, query strings, or URL fragments;
- written into browser history;
- logged;
- copied into analytics or dataLayer;
- sent to operational telemetry;
- included in support payloads;
- included in third-party error reports;
- reused outside its exact path, HTTP method, content constraints, or expiration window.

**PROPOSED TARGET CONTRACT** — A signed upload URL is a short-lived write grant for one approved
object path and upload operation. A **private quote read URL** is a separately protected read
capability that is not granted by the signed upload URL.

**PROPOSED TARGET CONTRACT** — A signed upload URL does not confer read authority, list authority,
update or delete authority (unless an approved Storage contract explicitly defines otherwise), scan
binding, report access, or reveal. It is not a resume token or marketing URL.

## 8. Primary lifecycle state machine

**PROPOSED TARGET CONTRACT** — The following identifiers are **primary lifecycle states** for
future `/scan` UX and backend coordination. They do not claim equivalent React state currently
exists. Proof, preview, and full-reveal authorization are **projections** (§8.1), not lifecycle
states.

| Current state | Allowed next primary states |
| --- | --- |
| `idle` | `selecting` |
| `selecting` | `idle`, `minting`, `rejected` |
| `minting` | `uploading`, `expired_intake`, `retryable_failure`, `terminal_failure` |
| `uploading` | `validating`, `offline_recovery`, `expired_intake`, `retryable_failure`, `terminal_failure` |
| `validating` | `bound`, `rejected`, `manual_review`, `retryable_failure`, `terminal_failure` |
| `bound` | `scan_queued`, `stale_session`, `retryable_failure`, `terminal_failure` |
| `scan_queued` | `processing`, `stale_session`, `retryable_failure`, `terminal_failure` |
| `processing` | `contact_required`, `rejected`, `manual_review`, `retryable_failure`, `terminal_failure` |
| `contact_required` | `lead_attached`, `manual_review`, `retryable_failure`, `terminal_failure` |
| `lead_attached` | `otp_pending`, `stale_session`, `retryable_failure`, `terminal_failure` |
| `otp_pending` | `otp_claimed`, `expired_intake`, `retryable_failure`, `terminal_failure` |
| `otp_claimed` | `verified`, `otp_pending`, `retryable_failure`, `terminal_failure` |
| `verified` | `stale_session`, `terminal_failure` |
| `rejected` | `selecting`, `terminal_failure` |
| `manual_review` | `contact_required`, `idle`, `terminal_failure` |
| `retryable_failure` | `rehydrating`, `expired_intake`, `terminal_failure` |
| `rehydrating` | any explicitly allowlisted resumable primary state, `expired_intake`, `stale_session`, or `terminal_failure` |
| `expired_intake` | `idle`, `minting` |
| `stale_session` | `rehydrating`, `terminal_failure` |
| `offline_recovery` | `rehydrating`, `expired_intake`, `terminal_failure` |
| `terminal_failure` | `idle`, `selecting` |

**PROPOSED TARGET CONTRACT** — Allowlisted resumable primary states after `rehydrating` are:

```text
selecting
minting
uploading
validating
bound
scan_queued
processing
contact_required
lead_attached
otp_pending
otp_claimed
verified
```

**PROPOSED TARGET CONTRACT** — `manual_review` is fail-closed. It is not phone verification and
is not full-reveal authorization.

**PROPOSED TARGET CONTRACT** — The physical representation of resume-state metadata is **DECISION
REQUIRED** and is not defined as a database column by this document.

**PROPOSED TARGET CONTRACT** — UI transition labels are not canonical database enum names.

**DECISION REQUIRED** — Final user-visible labels, polling cadence, recovery windows, and terminal
retry limits require an implementation sprint and accessibility review.

### 8.1 Availability and authorization projections

**PROPOSED TARGET CONTRACT** — Projections describe backend-authorized availability. They are not
primary lifecycle states and do not move the lifecycle backward.

| Projection | Meaning |
| --- | --- |
| `proof_available` | A minimal proof-of-read projection is available |
| `preview_available` | A teaser-safe report preview is available through `report-access` |
| `full_reveal_authorized` | The backend exact-session full-report predicate succeeded for the current request |

**PROPOSED TARGET CONTRACT** — Rules:

- Multiple projections may coexist.
- A projection may become false when canonical backend state changes.
- Browser state does not own projection truth.
- `full_reveal_authorized` is request-scoped backend authorization, not durable browser authority.
- Full report rendering is a UI action after authorization, not a lifecycle state.
- `manual_review` is a lifecycle state and never reveal authority.

## 9. Upload and quarantine law

**PROPOSED TARGET CONTRACT** — `/scan` supports only PDF, JPEG, PNG, and WebP under the approved
intake limit.

**PROPOSED TARGET CONTRACT** — Declared MIME and extension are advisory. Trusted backend
validation of actual bytes is authoritative.

**PROPOSED TARGET CONTRACT** — HEIC/HEIF, active-content PDF, encrypted PDF, unsupported archive,
HTML, SVG, Office document, and executable input fail safely under ADR-005's proposed rules.

**PROPOSED TARGET CONTRACT** — Failed or indeterminate quarantine never reaches Gemini.

**IMPLEMENTATION PREREQUISITE** — Reconcile the 10 MiB proposed intake limit with scanner and
deployed Storage limits.

## 10. Scanner dispatch and proof-of-read

**BASELINE EXECUTABLE CODE** — Current `scan-quote` performs `classifyScanGate` before full
extraction validation.

**PROPOSED TARGET CONTRACT** — `/scan` must not invoke intake-bound `scan-quote` directly.

**PROPOSED TARGET CONTRACT** — A trusted backend dispatch must bind the exact canonical scan and
intake provenance before scanner execution.

**PROPOSED TARGET CONTRACT** — Proof-of-read may demonstrate that the file was read without
exposing `full_json`, raw OCR text, protected contact evidence, exact full flags, or reconstructable
full-report detail.

### 10.1 Proof-of-read versus report preview

**PROPOSED TARGET CONTRACT** — **Proof-of-read** is a minimal allowlisted backend projection
showing that WindowMan read and classified enough of the uploaded document to present safe
document-level evidence.

Permitted conceptual categories may include safe document classification; page count when separately
approved; readable/unreadable status; limited non-PII processing evidence; and safe recovery reason.

Proof-of-read must not expose `full_json`, raw OCR text, contact PII, complete extracted line items,
exact protected findings, complete flags, full grade, reconstructable report content, contractor-routing
data, or capability or Storage material.

Proof-of-read does not prove deep extraction completion, deterministic scoring completion, grade
completion, report-preview availability, contact confirmation, lead attachment, OTP verification, or
full reveal authorization.

**PROPOSED TARGET CONTRACT** — **Report preview** is a separately allowlisted teaser report
projection returned through `report-access` preview mode. It may include only fields approved by the
preview contract. It must not include `full_json`, raw OCR text, raw contact PII, signed Storage
URLs, capability material, or content that reconstructs the full report. It must not imply
exact-session verification or complete extraction unless backend lifecycle status explicitly proves
completion. It must not be returned through a raw browser RPC.

**PROPOSED TARGET CONTRACT** — Conceptual ordering:

```text
classifyScanGate continue
→ processing
→ proof_available may become true
→ preview_available may later become true
→ contact review or manual entry
→ guarded lead attachment
→ OTP reservation and verification
→ full_reveal_authorized may become true
```

**PROPOSED TARGET CONTRACT** — `proof_available` and `preview_available` are independent
projections. Neither is reveal authority. Neither changes the contact-trust tier. Neither permits OTP
bypass. Preview may be displayed before contact confirmation only if an accepted allowlist and
product policy explicitly permit it. The exact pre-contact preview policy remains **DECISION
REQUIRED** unless ADR-005 or accepted governance already resolves it. This document does not decide
CRO ordering in this sprint.

## 11. Contact, lead, and OTP law

**PROPOSED TARGET CONTRACT** — OCR contact fields are proposals only.

**PROPOSED TARGET CONTRACT** — User review or manual entry precedes deterministic normalization.

**PROPOSED TARGET CONTRACT** — Guarded canonical lead attachment must commit before OTP start.

**PROPOSED TARGET CONTRACT** — Lead attachment is unverified and does not authorize reveal.

**PROPOSED TARGET CONTRACT** — Intake-bound OTP uses the protected reservation,
serialized-claim, external-Twilio, and conditional-finalization contract proposed by ADR-005.

**PROPOSED TARGET CONTRACT** — One phone or lead verified for another scan cannot unlock this scan.

## 12. Preview and full reveal

**PROPOSED TARGET CONTRACT** — `/scan` must use the approved report service and `report-access` for
both preview and full retrieval.

**PROPOSED TARGET CONTRACT** — `/scan` must not call `get_analysis_preview` or
`get_analysis_full` directly.

**PROPOSED TARGET CONTRACT** — Preview and full are distinct `report-access` modes. Each call
revalidates current backend state.

**PROPOSED TARGET CONTRACT** — Full UI rendering occurs only after `full_reveal_authorized` for the
current request. Rendering is not a lifecycle state. Prior render success does not grant future
authorization.

**PROPOSED TARGET CONTRACT** — Preview responses exclude `full_json`.

**PROPOSED TARGET CONTRACT** — Full responses require the backend exact-session predicate to
succeed at request time.

**PROPOSED TARGET CONTRACT** — A prior browser success, verified-access cache, route state, or
rendered preview does not replace that backend re-check.

## 13. Route prohibitions

**PROPOSED TARGET CONTRACT** — `/scan` must not:

- use browser-selected canonical IDs as authority;
- call legacy intake-unsafe OTP contracts directly;
- call raw preview or full report RPCs;
- call intake-bound `scan-quote` directly;
- use `localStorage` as authorization or capability custody;
- preload, cache, log, or hide `full_json`;
- bypass capability requirements because the route is named `/scan`;
- expose raw OCR text or unconfirmed contact PII through status polling;
- turn contact confirmation into phone verification;
- turn proof-of-read into analysis completion;
- turn upload or quote grade into verified outcome;
- emit raw PII into tracking;
- create contractor opportunity, consent, transaction, or outcome truth.

## 14. Tracking boundary

**BASELINE EXECUTABLE CODE** — Current legacy `UploadZone` and `scan-quote` both participate in
`quote_uploaded` browser/server behavior under the existing event-ownership model.

**PROPOSED TARGET CONTRACT** — ADR-005's intake outbox and event-ID proposal remains subject to
measurement-owner approval.

**PROPOSED TARGET CONTRACT** — Browser Lane A remains disabled for intake-v1 unless the accepted
measurement policy is explicitly amended.

**PROPOSED TARGET CONTRACT** — Route telemetry uses the operational lane and does not become
business, authorization, or transaction truth.

## 15. Legacy migration boundary

**BASELINE EXECUTABLE CODE** — Homepage and Nextdoor remain the current production `UploadZone`
callers.

**PROPOSED TARGET CONTRACT** — Those callers remain protected production behavior until a
separately approved migration changes them.

**IMPLEMENTATION PREREQUISITE** — Inventory and migrate every browser Storage writer, retry path,
bootstrap caller, scanner caller, report caller, and OTP caller before removing broad legacy
policies or rejecting legacy transport.

**IMPLEMENTATION PREREQUISITE** — Canary and rollback must prove homepage and Nextdoor continuity
until their deliberate cutover.

**PROPOSED TARGET CONTRACT** — `/scan` must not silently reuse the legacy upload perimeter merely
to avoid migration work.

## 16. Mount, canary, and rollback gate

**IMPLEMENTATION PREREQUISITE** — Mounting `/scan` requires explicit Tier D route approval and
protected-surface approvals for every connected backend change.

**IMPLEMENTATION PREREQUISITE** — Before mount, verify denied direct scanner calls, denied raw
report RPCs, denied legacy intake OTP calls, cross-session denial, and no pre-OTP `full_json`.

**IMPLEMENTATION PREREQUISITE** — Canary controls must be server-authoritative and must not create
a route-name bypass.

**IMPLEMENTATION PREREQUISITE** — Rollback must disable new route entry while preserving already
bound intakes through a defined safe completion or support path.

**DECISION REQUIRED** — Final canary cohort, feature-control owner, expiration behavior during
rollback, and customer-support recovery policy require operator approval.

## 17. Baseline evidence appendix

**BASELINE EXECUTABLE CODE** — Route evidence:

- [`src/App.tsx`](../../src/App.tsx), lines 145–204: registered routes and catch-all `NotFound`.
- [`src/pages/ScanFunnelPage.tsx`](../../src/pages/ScanFunnelPage.tsx), lines 1–26: file exists and
  renders `PreUploadIntake`.
- [`src/components/forensic-report/PreUploadIntake.tsx`](../../src/components/forensic-report/PreUploadIntake.tsx),
  lines 33–41 and 76–129: visual-harness statement and session draft behavior.
- [`src/pages/NotFound.tsx`](../../src/pages/NotFound.tsx), lines 4–21: fallback page.

**BASELINE EXECUTABLE CODE** — Production caller evidence:

- [`src/pages/Index.tsx`](../../src/pages/Index.tsx), lines 806–819: homepage `UploadZone`.
- [`src/components/nextdoor/NextdoorQuoteUpload.tsx`](../../src/components/nextdoor/NextdoorQuoteUpload.tsx),
  lines 18–36: Nextdoor guard and `UploadZone`.
- [`src/components/UploadZone.tsx`](../../src/components/UploadZone.tsx), lines 519–568 and
  659–995: browser scanner call, Storage upload, bootstrap, and event behavior.
- [`src/services/reportService.ts`](../../src/services/reportService.ts), lines 70–154:
  `report-access` preview/full transport.
- [`src/services/phoneVerificationService.ts`](../../src/services/phoneVerificationService.ts),
  lines 66–130: legacy OTP browser transport.

**BASELINE SCHEMA/POLICY INTENT** — Storage evidence:

- [`20260318033459_e89c0529-98a4-418d-ab84-852d4730de94.sql`](../../supabase/migrations/20260318033459_e89c0529-98a4-418d-ab84-852d4730de94.sql),
  lines 6–18.
- [`20260421202348_ace6c8d1-961a-4fee-8929-caabf2014fac.sql`](../../supabase/migrations/20260421202348_ace6c8d1-961a-4fee-8929-caabf2014fac.sql),
  lines 1–23.

**DEPLOYED STATE UNKNOWN** — No browser, hosting, or live Supabase environment was exercised while
creating this Proposed route contract.

## 18. Review checklist

- [ ] `/scan` baseline remains explicitly unmounted.
- [ ] `ScanFunnelPage` and `PreUploadIntake` are not represented as production wiring.
- [ ] Every target state is labeled proposed.
- [ ] Route entry grants no authority.
- [ ] Exact-path upload and backend validation precede binding.
- [ ] Trusted dispatch precedes intake-bound scanner execution.
- [ ] `classifyScanGate` continuation precedes proof/report progression.
- [ ] OCR proposal and user confirmation do not skip OTP.
- [ ] Lead attachment commits before OTP start.
- [ ] Exact-session SMS OTP remains mandatory.
- [ ] Preview/full retrieval uses `report-access` only.
- [ ] `full_json` is never available before backend authorization.
- [ ] Homepage and Nextdoor legacy callers remain protected pending migration.
- [ ] Broad Storage policy removal is blocked on caller migration.
- [ ] Tracking and PII boundaries remain intact.
- [ ] ADR-005 remains Proposed and implementation-blocked.
- [ ] Every primary lifecycle state is defined.
- [ ] Every transition destination is a defined primary state.
- [ ] No action text is represented as a state.
- [ ] Proof, preview, and full authorization are projections, not lifecycle states.
- [ ] Full UI rendering is not represented as stored authority.
- [ ] Proof-of-read and report preview are separately defined.
- [ ] Proof availability is independent of preview availability.
- [ ] Neither projection contains full_json.
- [ ] Neither projection authorizes reveal.
- [ ] Exact pre-contact preview policy remains explicit or DECISION REQUIRED.
