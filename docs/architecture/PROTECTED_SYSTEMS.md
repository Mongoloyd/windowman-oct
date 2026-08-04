# Protected Systems — Accepted Repository-Wide Governance

Status: Accepted

Implementation authority: None

Operator approval required: Yes

The document is accepted governing law.

Acceptance does not authorize protected implementation.
A separately authorized implementation sprint remains required.

Date: 2026-08-04

Repository-truth baseline: `d7e19f5d49a8054e39d2f5cf944df26ae11871fa`

Governance adoption: Proposed documents committed at `d828b157`; independent saved-artifact audit
(PASS_CONTINUE); explicit operator adoption decision; this adoption sprint (operator commit:
`PENDING OPERATOR COMMIT`).

Scope: WindowMan protected-system law

> **GOVERNING TARGET CONTRACT** — This document is accepted governing law registered as CANONICAL
> in [`DOC_STATUS_REGISTRY.md`](../ops/DOC_STATUS_REGISTRY.md) and routed by
> [`START_HERE.md`](../START_HERE.md). It does not authorize protected implementation, route mount,
> or deployment. [ADR-005](../adr/ADR-005-server-minted-quote-intake-capability.md) remains
> Proposed and implementation-blocked except where its prerequisites 1–4 are satisfied by this
> adoption.

## Evidence labels

Every material statement uses one of these labels:

- **BASELINE EXECUTABLE CODE** — behavior present in inspected code at the baseline commit.
- **BASELINE SCHEMA/POLICY INTENT** — checked-in migration or generated-type intent; not proof of deployment.
- **DEPLOYED STATE UNKNOWN** — a live environment was not inspected.
- **GOVERNING TARGET CONTRACT** — An accepted architectural or security requirement governing future authorized work. It does not claim that the target behavior is already implemented or deployed.
- **IMPLEMENTATION PREREQUISITE** — evidence or work required before a protected change.
- **DECISION REQUIRED** — operator policy or design choice not settled by repository truth.

## Shared terminology

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

## 1. Document status and authority

**GOVERNING TARGET CONTRACT** — This document is an accepted supporting governance layer beneath
[`AGENTS.md`](../../AGENTS.md) and [`.cursor/PROTECTED_FILES.md`](../../.cursor/PROTECTED_FILES.md).
It does not supersede either authority.

**GOVERNING TARGET CONTRACT** — Document arrows must name one relationship type only. Do not use one
diagram for authority, reading order, prerequisite merge, and implementation conformance together.

**Normative authority** (what may be built):

```text
AGENTS.md
→ .cursor/PROTECTED_FILES.md
→ accepted governing documents (per START_HERE / doc registry)
→ accepted ADRs
→ explicitly recorded sprint amendments or exceptions
```

**Normative policy chain for intake and contact** (Accepted governing chain):

```text
PROTECTED_SYSTEMS
→ ROUTE_SCAN
→ ADR-003
```

**Independent data-trust law** (Accepted governing chain):

```text
PROTECTED_SYSTEMS
→ ADR-004
```

**Implementation conformance** (Proposed [ADR-005](../adr/ADR-005-server-minted-quote-intake-capability.md)
mechanics must conform upstream; ADR-005 does not own ADR-003 policy):

```text
ADR-005 proposed mechanics
→ must conform to PROTECTED_SYSTEMS
→ must conform to ROUTE_SCAN
→ must conform to ADR-003
```

**Prerequisite merge order** (ADR-005 implementation gate — not policy subordination):

```text
PROTECTED_SYSTEMS, ROUTE_SCAN, ADR-003, and ADR-004 are accepted and CANONICAL (prerequisites 1–4).
ADR-005 implementation remains blocked until prerequisites 5–38 are satisfied.
```

**GOVERNING TARGET CONTRACT** — ADR-005 remains Proposed and implementation-blocked. Acceptance of
this document satisfies ADR-005 prerequisites 1–4 only and does not authorize its Dormant Schema
Sprint.

## 2. Normative authority and repository evidence

**GOVERNING TARGET CONTRACT** — Normative governance authority and descriptive repository evidence
are separate systems. Conflating them misleads operators and coding agents.

### 2.1 Normative governance authority

**GOVERNING TARGET CONTRACT** — Normative authority controls what agents and authorized sprints may
build.

Order:

1. [`AGENTS.md`](../../AGENTS.md).
2. [`.cursor/PROTECTED_FILES.md`](../../.cursor/PROTECTED_FILES.md).
3. Accepted repository governing documents routed by [`START_HERE.md`](../START_HERE.md) and the
   doc status registry (not **Status: Proposed** drafts alone).
4. Accepted ADRs (merged/canonical — not Proposed-only).
5. Explicitly authorized and recorded sprint amendments or exceptions.

Rules:

- **Status: Proposed** documents are candidate policy only; they do not become binding because they
  exist on disk.
- A sprint exception must identify the exact governing rule, protected path or boundary, sprint id,
  and allowed change scope.
- A sprint exception does not silently rewrite permanent governance.
- Generated prose, planning discussion, code comments, and agent summaries are not implementation
  authority.
- Explicit operator product direction may inform Proposed documents but does not silently override
  accepted security law unless recorded as an exact amendment or exception.

### 2.2 Descriptive repository evidence

**GOVERNING TARGET CONTRACT** — Descriptive evidence establishes what currently exists or what the
checked-in repository claims.

Order:

1. Directly verified deployed state (when operator or authorized inspection proves it).
2. Executable runtime code and active call sites at the stated baseline commit.
3. Checked-in migrations and generated types.
4. Tests and static configuration.
5. Historical or planning documentation.

Rules:

- Direct live verification is strongest for **current deployed truth** when it was actually
  performed; otherwise label **`DEPLOYED STATE UNKNOWN`**.
- Executable code proves **current repository behavior** at the baseline commit.
- Executable code does **not** override accepted governance; it states baseline fact.
- Migrations prove checked-in schema or policy **intent**, not deployment.
- Generated types may be stale; they are supporting evidence, not independent deployed proof.
- Tests prove expected behavior only to the extent they execute and pass.
- Historical planning documents are not runtime authority.

### 2.3 When governance and evidence differ

**GOVERNING TARGET CONTRACT** — When normative governance and descriptive repository evidence
differ:

- descriptive evidence states what currently exists;
- normative governance controls what may be authorized next;
- the discrepancy must be reported;
- it must not be silently reconciled by an agent.

### 2.4 Document ownership (policy versus mechanics)

**GOVERNING TARGET CONTRACT** — Ownership matrix:

| Document | Owns | Does not own |
| --- | --- | --- |
| `PROTECTED_SYSTEMS.md` | Repository-wide protected-system law | Detailed route mechanics or physical schema |
| [`ROUTE_SCAN.md`](./ROUTE_SCAN.md) | Future `/scan` route behavior, lifecycle, route constraints | OTP transaction RPC shapes, claim-token storage |
| [ADR-003](../adr/ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md) | Document-extracted contact trust, lead-before-OTP ordering, mandatory exact-session OTP **policy** | Capability schema, OTP claim/finalize mechanics |
| [ADR-005](../adr/ADR-005-server-minted-quote-intake-capability.md) | Proposed intake capability, upload, scanner dispatch, OTP reservation/claim/finalization, event **mechanics** | Authority to weaken upstream contact-trust or OTP policy |
| [ADR-004](../adr/ADR-004-quote-disposition-and-ledger-layer-separation.md) | Quoted observation versus verified-outcome trust law | Contact, OTP, route, or intake capability policy |

**GOVERNING TARGET CONTRACT** — [ADR-005](../adr/ADR-005-server-minted-quote-intake-capability.md)
defines proposed technical mechanics used to satisfy [ADR-003](../adr/ADR-003-document-extracted-contact-prefill-and-mandatory-otp.md)
contact-trust and mandatory exact-session OTP policy. ADR-005 does not own or weaken ADR-003 policy
decisions. When ADR-005 mechanics conflict with this document, `ROUTE_SCAN`, or ADR-003, ADR-005
requires reconciliation before implementation.

## 3. Verify-to-Reveal invariant

**BASELINE EXECUTABLE CODE** — `reportService.ts` invokes `report-access` for preview and full
retrieval. `report-access` strips `full_json` defensively in preview mode and calls
`get_analysis_full` in full mode.

**BASELINE SCHEMA/POLICY INTENT** — The checked-in `get_analysis_full(uuid, text)` definition
returns an unauthorized sentinel unless a verified `phone_verifications` row matches the requested
phone and exact `scan_session_id`, shares the scan's `lead_id`, and the lead is marked verified.

**DEPLOYED STATE UNKNOWN** — The deployed RPC body, grants, and Edge Function version were not
inspected for this document.

**GOVERNING TARGET CONTRACT** — `full_json` must never be fetched, preloaded, logged, cached, stored
in browser persistence, hidden in the DOM, or sent to a browser before backend exact-session SMS
OTP authorization succeeds.

**GOVERNING TARGET CONTRACT** — A preview may be available before OTP only when its allowlist cannot
expose or reconstruct the full report.

## 4. Exact-session isolation

**BASELINE EXECUTABLE CODE** — `send-otp` accepts `phone_e164` and an optional
`scan_session_id`, then writes the pending verification row after the Twilio send.

**BASELINE EXECUTABLE CODE** — `verify-otp` prefers a pending row bound to the requested scan and
contains a legacy fallback for a pending row whose `scan_session_id` is null.

**BASELINE SCHEMA/POLICY INTENT** — The latest checked-in full-report predicate requires the
verified row's `scan_session_id` to equal the requested scan.

**GOVERNING TARGET CONTRACT** — Verification for one scan must never authorize another scan, even
when the scans share a lead or phone.

**GOVERNING TARGET CONTRACT** — Intake-bound verification must reject missing, duplicate,
session-null, stale, or conflicting verification bindings.

## 5. Browser distrust

**GOVERNING TARGET CONTRACT** — Browser-supplied IDs, lifecycle states, completion flags,
verification flags, authorization modes, and outcome claims are untrusted input.

**GOVERNING TARGET CONTRACT** — The backend must mint or resolve canonical `lead_id`,
`quote_file_id`, `scan_session_id`, upload identity, verification-row identity, and protected event
identity when those values control a protected transition.

**GOVERNING TARGET CONTRACT** — `localStorage`, `sessionStorage`, navigable route/query/hash state,
route guards, hidden markup, and React state may support UX recovery only. None grants protected
access. Short-lived signed **upload** URLs are governed by [`ROUTE_SCAN.md`](./ROUTE_SCAN.md) §7;
they are not resume or marketing URLs.

## 6. Contact trust tiers

**GOVERNING TARGET CONTRACT** — Contact data follows this strict trust order:

```text
OCR-proposed
< user-confirmed
< backend-attached unverified
< backend exact-session verified
```

**GOVERNING TARGET CONTRACT** — Moving up one tier does not imply any higher tier. OCR confidence
does not verify identity. User confirmation does not verify phone ownership. Lead attachment does
not authorize reveal.

## 7. Canonical data ownership

**BASELINE SCHEMA/POLICY INTENT** — `analyses` is the checked-in canonical analysis table.

**BASELINE SCHEMA/POLICY INTENT** — `quote_analyses` remains present as a legacy, service-only
table.

**GOVERNING TARGET CONTRACT** — AI may extract evidence and confidence. Deterministic backend
TypeScript owns validation, normalization where rules are deterministic, scoring, flags, grades,
financial math, and report interpretation.

**GOVERNING TARGET CONTRACT** — `lead_id` is persistent contact identity.

**GOVERNING TARGET CONTRACT** — `scan_session_id` is per-scan identity.

**GOVERNING TARGET CONTRACT** — Neither identity is interchangeable with a browser session,
event ID, contractor identity, admin identity, or report authorization.

## 8. Protected-system inventory

**GOVERNING TARGET CONTRACT** — The following domains are protected:

- scanner extraction, classification, deterministic scoring, and analysis persistence;
- quote upload, private Storage, upload completion, quote/session binding, and cleanup;
- OTP send, OTP verification, Twilio configuration, rate limits, and QA bypasses;
- preview/full shaping, `report-access`, raw report RPCs, and reveal orchestration;
- `full_json`, OCR text, contact PII, quote files, and signed document access;
- schema, migrations, RLS, grants, `SECURITY DEFINER` functions, generated types, and project
  targeting;
- lead, scan, verification, event, admin, contractor, and tenant identity boundaries;
- conversion tracking, GTM, CAPI, vendor routing, event ownership, and deduplication;
- quote disposition, verified outcomes, revenue truth, payment, and contractor routing;
- production routes, deployment configuration, secrets, and service-role code.

**GOVERNING TARGET CONTRACT** — The authoritative path-level tiers remain in
[`.cursor/PROTECTED_FILES.md`](../../.cursor/PROTECTED_FILES.md).

## 9. Baseline versus target access matrix

| Surface | Evidence class | Inspected baseline | Target class | Proposed target |
|---|---|---|---|---|
| `send-otp` | BASELINE EXECUTABLE CODE | Public browser service sends phone plus optional scan; handler uses service role and app logic. | GOVERNING TARGET CONTRACT | Preserve legacy behavior pending migration; intake-bound scans use an approved capability-bound OTP-start contract and reject direct legacy intake calls. |
| `verify-otp` | BASELINE EXECUTABLE CODE | Public browser service sends phone, code, and optional scan; handler includes a null-session legacy fallback. | GOVERNING TARGET CONTRACT | Preserve legacy behavior pending migration; intake-bound scans use exact-session capability-bound verification and reject legacy fallback. |
| `report-access` | BASELINE EXECUTABLE CODE | Browser bridge for preview/full; service-role RPC caller; full mode includes phone and scan. | GOVERNING TARGET CONTRACT | Sole production browser bridge for preview/full; no browser-selected authorization bypass. |
| `scan-quote` | BASELINE EXECUTABLE CODE | Browser `UploadZone` invokes it with `scan_session_id` and event ID after bootstrap. | GOVERNING TARGET CONTRACT | Legacy callers remain until migrated; intake-bound scans require trusted internal dispatch and reject direct browser invocation. |
| `start-upload-scan-session` | BASELINE EXECUTABLE CODE | Browser-invoked bootstrap; app-logic checks; service-role writes; legacy or contact-enforced behavior depends on runtime flag. | GOVERNING TARGET CONTRACT | Existing callers remain protected pending migration; future `/scan` uses ADR-005 capability contracts instead of this legacy perimeter. |
| `get_analysis_preview` | BASELINE SCHEMA/POLICY INTENT | `SECURITY DEFINER` preview projection excludes `full_json`; exact deployed execute grants are unresolved. | GOVERNING TARGET CONTRACT | Callable by `report-access` through a non-browser role only. |
| `get_analysis_full` | BASELINE SCHEMA/POLICY INTENT | Strict exact-session body exists; checked-in migration grants execute to `anon, authenticated`. | GOVERNING TARGET CONTRACT | Preserve exact-session predicate; revoke browser-role execution for every deployed signature; call through `report-access` only. |
| `quotes` Storage | BASELINE SCHEMA/POLICY INTENT | Private bucket intent with broad bucket-wide browser write policies and grants. | GOVERNING TARGET CONTRACT | Exact-path signed upload for future `/scan`; remove broad policies only after every legacy caller is migrated. |

**DEPLOYED STATE UNKNOWN** — Gateway configuration, handler versions, function overloads, grants,
RLS policies, Storage bucket configuration, feature flags, and caller traffic require direct
environment inspection before implementation.

## 10. Edge Function rules

**BASELINE EXECUTABLE CODE** — The inspected function blocks in `supabase/config.toml` use
`verify_jwt = false`; their handler-level checks differ.

**GOVERNING TARGET CONTRACT** — `verify_jwt = false` must never be described as service-role-only
caller protection. Service-role database use inside a handler is distinct from caller
authentication.

**GOVERNING TARGET CONTRACT** — Every protected function must validate method, input, provenance,
identity relationships, lifecycle transition, idempotency, and abuse limits in trusted code.

**GOVERNING TARGET CONTRACT** — Intake-specific functions proposed by ADR-005 do not exist merely
because these documents name them.

**IMPLEMENTATION PREREQUISITE** — Inventory exact gateway config and handler gates before changing
any endpoint posture.

## 11. Raw RPC rules

**BASELINE EXECUTABLE CODE** — Production browser code inspected for this document uses
`report-access`; no direct production browser call to `get_analysis_preview` or
`get_analysis_full` was found.

**BASELINE SCHEMA/POLICY INTENT** — Checked-in migration intent grants
`get_analysis_full(uuid, text)` to `anon, authenticated`.

**DEPLOYED STATE UNKNOWN** — Exact deployed signatures, overloads, owners, and execute grants were
not inspected.

**GOVERNING TARGET CONTRACT** — Production browsers must not execute raw preview/full RPCs.

**IMPLEMENTATION PREREQUISITE** — Inventory all browser, admin, test, and Edge Function callers.

**IMPLEMENTATION PREREQUISITE** — Reconcile every deployed signature by revoking execute from
`PUBLIC`, `anon`, and `authenticated`, then granting only `service_role` or another separately
approved non-browser role.

## 12. Storage and RLS law

**BASELINE SCHEMA/POLICY INTENT** — Checked-in bucket intent is private, 10 MiB, and permits PDF,
JPEG, PNG, WebP, and HEIC.

**BASELINE SCHEMA/POLICY INTENT** — Checked-in policies permit broad `quotes` bucket INSERT/UPDATE
behavior for browser roles; table-level grants support those policies.

**DEPLOYED STATE UNKNOWN** — Live bucket privacy, MIME allowlist, size limit, policies, grants, and
object inventory were not inspected.

**GOVERNING TARGET CONTRACT** — Future `/scan` supports PDF, JPEG, PNG, and WebP up to the approved
intake limit. HEIC/HEIF remains rejected by ADR-005's proposed intake contract unless separately
approved.

**GOVERNING TARGET CONTRACT** — Future `/scan` uses exact-path signed upload and backend byte/type
validation before binding or scanner dispatch.

**IMPLEMENTATION PREREQUISITE** — Homepage and Nextdoor `UploadZone` callers must be deliberately
migrated before broad Storage writes or legacy canonical insert paths are removed.

**GOVERNING TARGET CONTRACT** — Quote files remain private. RLS and grants must fail closed.

## 13. Secrets and service-role law

**GOVERNING TARGET CONTRACT** — Service-role keys, Twilio credentials, ad-platform credentials,
database URLs, capability hashes, claim tokens, and other server secrets never enter browser code,
URLs, tracking, or user-visible errors.

**GOVERNING TARGET CONTRACT** — Service-role use is restricted to trusted server code and does not
replace caller authorization or relationship validation.

**GOVERNING TARGET CONTRACT** — Logs use sanitized codes and non-PII identifiers only where needed.

## 14. Tracking and event ownership

**BASELINE EXECUTABLE CODE** — The current `UploadZone` browser path emits `quote_uploaded` after
`scan-quote` returns a valid response.

**BASELINE EXECUTABLE CODE** — `scan-quote` persists canonical `quote_uploaded` after
`classifyScanGate` continues and before full extraction validation.

**GOVERNING TARGET CONTRACT** — Business events follow
`trackConversion`/`trackGtmEvent → window.dataLayer → GTM`.

**GOVERNING TARGET CONTRACT** — Operational telemetry follows `trackEvent → event_logs`.

**GOVERNING TARGET CONTRACT** — Operational telemetry, canonical event rows, and paid-media
conversions are not verified transaction or revenue truth.

**GOVERNING TARGET CONTRACT** — ADR-005 intake event ownership remains blocked on measurement-owner
approval and an explicit reconciliation with the accepted measurement documents.

## 15. AI-versus-deterministic logic boundary

**GOVERNING TARGET CONTRACT** — AI extracts visible evidence, classification, ambiguity, and
confidence.

**GOVERNING TARGET CONTRACT** — Deterministic TypeScript validates, normalizes deterministic fields,
calculates, scores, applies caps, sets flags and grades, and compiles report interpretation.

**GOVERNING TARGET CONTRACT** — AI cannot verify phone ownership, attach canonical authority,
authorize report reveal, set verified outcome, or determine final benchmark truth.

## 16. Protected modification authorization

**GOVERNING TARGET CONTRACT** — A proposed document is not a sprint approval.

**GOVERNING TARGET CONTRACT** — Protected implementation requires the approval phrase, path scope,
preflight, blast radius, rollback plan, verification plan, and human-gated deployment process
required by current repository law.

**GOVERNING TARGET CONTRACT** — Schema, grant, RLS, Storage, OTP, scanner, reveal, tracking,
generated-type, deployment, commit, and push changes each require their own authorized scope.

## 17. Required failure states

**GOVERNING TARGET CONTRACT** — Protected flows must distinguish at least:

- validation rejected;
- unsupported or unsafe file;
- `invalid_document`;
- `needs_better_upload`;
- missing, expired, revoked, or consumed intake capability;
- stale or mismatched scan session;
- upload missing, quarantined, or binding conflict;
- processing and retryable backend failure;
- offline recovery;
- OTP send failure, rate limit, wrong code, expired code, denial, and timeout;
- verification already in progress or stale claim;
- unauthorized full-report request;
- manual review required;
- terminal failure.

**GOVERNING TARGET CONTRACT** — A failure must never become fabricated success, fabricated
verification, or a client-only unlock.

## 18. Rollback and verification

**IMPLEMENTATION PREREQUISITE** — Every protected sprint must identify its target environment,
blast radius, reversible boundary, data rollback or forward-fix strategy, denied-path tests, and
legacy-caller compatibility.

**IMPLEMENTATION PREREQUISITE** — Reveal verification must prove preview exclusion, direct raw-RPC
rejection, unauthorized full denial, exact-session success, and cross-session denial.

**IMPLEMENTATION PREREQUISITE** — Upload verification must prove private reads, exact-path writes,
type/byte rejection, quarantine, idempotent binding, and legacy-caller continuity until migration.

**IMPLEMENTATION PREREQUISITE** — Outcome verification must prove quoted observations cannot be
promoted by browser input, AI output, contractor assertion alone, telemetry, or ad conversion.

## 19. Prohibited shortcuts

**GOVERNING TARGET CONTRACT** — The following are forbidden:

- CSS, DOM, route, or local-storage reveal gates;
- direct browser raw report RPCs;
- direct browser Twilio calls or frontend OTP validation;
- OCR or user confirmation as phone verification;
- cross-session or lead-wide implicit unlock;
- public quote-file reads or service-role keys in browser code;
- intake route-name exceptions to capability requirements;
- browser-selected canonical IDs or protected lifecycle states;
- AI-generated grades, verified dispositions, or benchmark truth;
- uploaded estimates treated as sales;
- event logs or paid-media events treated as transaction evidence;
- broad RLS/grant weakening for convenience;
- implementation inferred from acceptance of governing documents alone.

## 20. Audit checklist

- [ ] Document authority: Status is Accepted and governing.
- [ ] Runtime implementation: not authorized and not presumed present.
- [ ] Implementation authority remains None.
- [ ] Operator approval remains required.
- [ ] `AGENTS.md` and `.cursor/PROTECTED_FILES.md` remain superior.
- [ ] Baseline code, schema intent, deployed unknowns, and governing targets remain distinct.
- [ ] Normative authority is separate from descriptive evidence.
- [ ] Executable code and migrations are not represented as governing law.
- [ ] Governing requirements use **GOVERNING TARGET CONTRACT**; runtime behavior is not claimed implemented.
- [ ] ADR-003 policy ownership is distinct from ADR-005 mechanics.
- [ ] No pre-OTP `full_json` path exists.
- [ ] Exact-session verification and cross-session denial are tested.
- [ ] Browser IDs and flags are treated as untrusted.
- [ ] Contact trust tiers remain ordered and non-equivalent.
- [ ] `analyses` remains canonical and `quote_analyses` remains legacy.
- [ ] Private `quotes` Storage remains private.
- [ ] Legacy browser callers are migrated before restrictive policy removal.
- [ ] `report-access` remains the sole production browser report bridge.
- [ ] Raw report-RPC grants are reconciled by exact deployed signature.
- [ ] AI/deterministic ownership remains separated.
- [ ] Tracking lanes remain separated and contain no raw PII.
- [ ] Uploaded quotes do not become verified outcomes automatically.
- [ ] Required failure and rollback behavior is explicit.
- [ ] ADR-005 remains Proposed and implementation-blocked.

## Evidence references

**BASELINE EXECUTABLE CODE** — Route and browser evidence:

- [`src/App.tsx`](../../src/App.tsx), lines 145–204.
- [`src/components/UploadZone.tsx`](../../src/components/UploadZone.tsx), lines 519–568 and 659–995.
- [`src/services/reportService.ts`](../../src/services/reportService.ts), lines 70–154.
- [`src/services/phoneVerificationService.ts`](../../src/services/phoneVerificationService.ts),
  lines 66–130.
- [`supabase/functions/send-otp/index.ts`](../../supabase/functions/send-otp/index.ts), lines
  104–397.
- [`supabase/functions/verify-otp/index.ts`](../../supabase/functions/verify-otp/index.ts), lines
  90–575.
- [`supabase/functions/report-access/index.ts`](../../supabase/functions/report-access/index.ts),
  lines 370–530.
- [`supabase/functions/scan-quote/index.ts`](../../supabase/functions/scan-quote/index.ts), lines
  1081–1151.

**BASELINE SCHEMA/POLICY INTENT** — Migration and type evidence:

- [`20260318033459_e89c0529-98a4-418d-ab84-852d4730de94.sql`](../../supabase/migrations/20260318033459_e89c0529-98a4-418d-ab84-852d4730de94.sql),
  lines 6–18 and 30–110.
- [`20260421202348_ace6c8d1-961a-4fee-8929-caabf2014fac.sql`](../../supabase/migrations/20260421202348_ace6c8d1-961a-4fee-8929-caabf2014fac.sql),
  lines 1–23.
- [`20260428120000_restore_get_analysis_full_strict_scan_binding.sql`](../../supabase/migrations/20260428120000_restore_get_analysis_full_strict_scan_binding.sql),
  lines 15–92.
- [`src/integrations/supabase/types.ts`](../../src/integrations/supabase/types.ts), generated
  checked-in schema snapshot.

**DEPLOYED STATE UNKNOWN** — No live Supabase inspection was performed while authoring this
accepted governing document.
