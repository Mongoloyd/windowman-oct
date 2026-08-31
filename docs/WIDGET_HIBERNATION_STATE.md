# WindowMan Contractor Widget — Hibernation State

Status: `HIBERNATED AFTER PROMPT 2`

Widget build authorization: `NOT AUTHORIZED`

Last verified: `2026-08-31`

Resume point: `PROMPT 3 — CANONICAL TENANT AND PLACEMENT AUTHORITY`

- Prompts 1 and 2 are **complete**.
- The contractor widget itself has **not** been built.
- Prompt 3 or later must **not** begin without new explicit authorization.
- The repository is intentionally frozen before any new widget schema, session, upload, routing, billing, or UI infrastructure.

Evidence labels used below: **CONFIRMED**, **DECIDED**, **DEFERRED**, **UNKNOWN**, **PROPOSED**.

---

## 1. Status banner

| Field | Value |
|---|---|
| Product track | Contractor widget SaaS / embed |
| Hibernation reason | Security spine for `generate-contractor-brief` is implemented, merged, deployed, and probed. Widget product work is not authorized. |
| Implemented and deployed | Official publishable admission + fail-closed exact-session authorization on live `generate-contractor-brief` v49 |
| Audited or decided only | Pilot commercial/consent/routing decisions; Phase 0 intelligence-layer audit |
| Blocked or deferred | Canonical contractor identity, placement authority, upload boundary, widget UI, billing, analytics |
| Explicitly not built | The widget SaaS systems listed in §8 |
| Resume | Prompt 3, after a new `SPRINT APPROVAL` scoped to identity and placement authority |

Do not present proposed widget architecture as existing implementation.

---

## 2. Canonical repository snapshot

| Field | Frozen value |
|---|---|
| Repository | [Mongoloyd/wm-mvp](https://github.com/Mongoloyd/wm-mvp) |
| Canonical local root | `C:/Projects/wm-mvp-github-clean` |
| Canonical branch | `forensic_report_v2` |
| Implementation freeze commit | [`a5c894a2bc8c648972256e520f52a6e2fe916a98`](https://github.com/Mongoloyd/wm-mvp/commit/a5c894a2bc8c648972256e520f52a6e2fe916a98) |
| Merged PR | [#248](https://github.com/Mongoloyd/wm-mvp/pull/248) |
| PR merge timestamp | `2026-08-31T22:20:42Z` |
| Prompt 2A commit | [`a996503693e1ea603c25a006c7a26ee255c25cd3`](https://github.com/Mongoloyd/wm-mvp/commit/a996503693e1ea603c25a006c7a26ee255c25cd3) |
| Existing fail-closed commit | [`ac8f40b5ea7abb75e2f800b6eaa10c81836faf62`](https://github.com/Mongoloyd/wm-mvp/commit/ac8f40b5ea7abb75e2f800b6eaa10c81836faf62) |
| Phase 0 audit commit | [`f03c7a0a801f291bb94a0e5d8dbae295cb31803f`](https://github.com/Mongoloyd/wm-mvp/commit/f03c7a0a801f291bb94a0e5d8dbae295cb31803f) |
| Working tree at freeze | Clean |
| Staging at freeze | Empty |

**CONFIRMED:** At documentation closeout, local and remote `forensic_report_v2` both pointed at the implementation freeze commit above, with a clean working tree and empty staging.

The documentation commit created by this closeout is the next commit after the implementation freeze commit. Future resume checks must use ancestry of `a5c894a2`, not exact HEAD equality, because this hibernation document (and unrelated legitimate work) may follow it.

---

## 3. Prompt 1 completion — admission evidence

**CONFIRMED:** Prompt 1 established the live caller contract for contractor-brief generation.

Only production browser caller identified at freeze:

- `src/pages/ReportClassic.tsx`

Caller contract:

- The caller uses `supabase.functions.invoke("generate-contractor-brief", …)`.
- The anonymous Twilio OTP flow does **not** create a Supabase Auth session.
- The browser uses a publishable key (`VITE_SUPABASE_PUBLISHABLE_KEY` or the `VITE_SUPABASE_ANON_KEY` alias).
- The browser sends that key as `apikey` and, without a session, uses the same credential in `Authorization`.
- A publishable key is **application admission** — not homeowner identity and not resource authorization.
- A live probe proved `verify_jwt = true` rejected the legitimate anonymous caller **before handler execution**.

Selected contract (**DECIDED** and later implemented in Prompt 2):

- `verify_jwt = false`
- Official handler-level `auth: "publishable"`
- Mandatory exact-session `get_analysis_full` authorization afterward

Do not print, persist, or treat publishable, anon, or service-role values as documentation.

---

## 4. Prompt 2 completion — implementation

**CONFIRMED:** Prompt 2 implemented, merged, deployed, and verified the selected contract.

| Item | Frozen value |
|---|---|
| Exact dependency | `@supabase/server@1.5.1` |
| Governing dependency files | `deno.json`, `deno.lock` |
| Production API | `createSupabaseContext(request, { auth: "publishable" })` |
| Handler | `supabase/functions/generate-contractor-brief/index.ts` |
| Focused tests | `supabase/functions/generate-contractor-brief/index.test.ts` |
| Config | `supabase/config.toml` `[functions.generate-contractor-brief] verify_jwt = false` (unchanged; live gateway set with `--no-verify-jwt`) |

Security order (**CONFIRMED** in committed source and live v49):

1. Credential-free CORS `OPTIONS`
2. Official publishable admission
3. JSON/body validation
4. Exact-session `get_analysis_full`
5. Privileged reads or mutations

Enforcement results:

- Missing or failed admission returns generic handler `401` `{ "error": "Unauthorized." }` when the request reaches the handler.
- Invalid API keys may be rejected earlier by Supabase’s gateway with its own generic `401`. That platform body is outside the handler contract and must not be normalized in code.
- Sentinel / null / empty resource authorization returns generic `403`.
- RPC errors, malformed rows, or wrong cardinality return generic `5xx`.
- No privileged `.from(...)` operation occurs before both security layers pass.
- Sensitive phone, credential, UUID, sentinel, and report-payload logging was removed.
- Fourteen focused Deno tests pass.
- TypeScript checks pass (`npx --no-install tsc --noEmit`).

Request body shape used by the browser caller and handler:

```text
{ scan_session_id, phone_e164, cta_source }
```

`cta_source` is optional; the handler defaults it to `"intro_request"`. `scan_session_id` and `phone_e164` are required after admission.

---

## 5. Production deployment record

| Field | Value |
|---|---|
| Supabase project | `zgsofkgddpcntdvpckdq` |
| Environment classification | `LIVE_ACTIVE` |
| Function | `generate-contractor-brief` |
| Version | `49` |
| Status | `ACTIVE` |
| `verify_jwt` | `false` |
| Updated | `2026-08-31T22:51:39.114Z` |
| Deployed SHA | `5fee3d079f2613bf136d96b1f3459296ce83dd8041c634ec86a3cea41a5c42e6` |
| Deploying repository commit | `a5c894a2bc8c648972256e520f52a6e2fe916a98` |
| CLI used | `2.102.0` |

**CONFIRMED:**

- Only `generate-contractor-brief` was deployed in this sprint.
- No SQL, migration, Storage, RLS, or production-row mutation occurred.
- The available CLI update was intentionally not applied during the security sprint.
- Agents did not run the deploy. A human operator deployed the single named function with `verify_jwt` disabled.

---

## 6. Production verification matrix

**CONFIRMED** across two bounded production passes. Request 3 was reclassified as gateway fail-closed; requests 4 and 5 completed on the resumed two-request budget.

| Probe | Expected enforcement layer | Verified result |
|---|---|---|
| `OPTIONS` without credentials | CORS | `200`, no business work |
| Missing admission | Handler admission | Generic `401`, zero RPC |
| Invalid API key | Supabase gateway | Gateway `401`, no isolate boot |
| Valid admission with `{}` | Body validation | Generic `400`, zero RPC |
| Valid admission with synthetic unauthorized resource | Exact-session RPC | Generic `403`, exactly one authorization RPC, no downstream work |

Additional freeze facts:

- Exactly **five** production probe requests were made across the two bounded passes.
- All used synthetic or empty inputs.
- No real homeowner identifier or service-role credential was used.
- No rejected probe caused a cache update, brief, opportunity, delivery, tracking event, or external request.
- `postgres_logs` were unavailable, so production row-level non-mutation is supported by handler ordering, HTTP results, function logs, edge logs, and 14 focused regression tests — **not** claimed from unavailable database logs.

---

## 7. Deferred non-blocking hygiene

**DEFERRED:** `scan_session_id` is currently required by truthiness before the RPC but is not explicitly UUID-validated in the handler.

- Invalid UUID input fails closed through the RPC / internal-error path.
- This is input-validation hygiene, not an identified authorization bypass.
- It does not reopen Prompt 2.
- Addressing it later requires a separately approved focused PR.
- Copilot review thread on merged PR #248 recorded this finding; it is leftover hygiene, not a merge blocker.

---

## 8. What remains unbuilt

**CONFIRMED:** none of these widget systems exist yet as product infrastructure. Existing files `public/windowman-widget.js`, `public/widget-host.html`, and `docs/widget-embed.md` remain a **Slice 1 shell** (embed loader + branded hosted shell that routes to the hosted scanner). They must not be mistaken for the finished SaaS product.

Not built:

- Canonical widget placement authority
- Approved-origin registry
- Server-minted widget bootstrap/session capability
- Placement kill switch
- Exact-path widget upload authorization
- Embedded OTP/upload/report experience
- Widget-specific qualification engine
- Thirty-day exclusivity scheduler
- Three-recipient marketplace router
- Widget allowance and overage ledger
- Operator widget administration
- Contractor self-service dashboard
- Production widget CSP/frame-ancestor deployment contract
- Production widget accessibility suite
- Automated widget Stripe billing

**PROPOSED** architecture from planning docs is not implementation authority.

---

## 9. Known blockers still open

These remain open and **must not** be treated as solved by Prompt 2:

- Contractor identity remains split across `clients`, `contractors`, `contractor_profiles`, and `contractor_accounts`.
- No canonical reviewed mapping yet governs widget placement ownership.
- Quotes Storage browser-write policies remain broader than the proposed exact-path widget boundary.
- Original-document delivery does not yet enforce separate document-specific consent.
- Generated Supabase types require reconciliation with committed/live schema.
- Local `generate-negotiation-script` remains undeployed and needs fail-closed remediation before any future deployment.
- Other function-source and `verify_jwt` parity items remain outside this completed sprint.
- Combined mandatory widget consent requires qualified counsel review.
- Benchmark production eligibility still requires trustworthy quote-date and approved read-model rules.
- Live runtime flags and deployment headers must be re-audited when the widget resumes.
- No widget pricing hypothesis should be treated as validated commercial truth.

---

## 10. Frozen product decisions

These are **DECIDED** pilot decisions, **not** implemented behavior:

- Managed contractor onboarding
- Exact-domain approval
- Public opaque placement IDs are non-authoritative
- WindowMan-owned audit with visible contractor sponsorship
- No mascot in V1
- Floating and inline modes
- WCAG 2.2 AA target
- Phone-first exact-session OTP
- Quote-derived geography with ZIP recovery
- Sponsor receives contact plus sanitized summary
- Original document requires separate consent
- Sponsor exclusivity lasts 30 days
- Up to three approved marketplace recipients afterward
- Ninety-day duplicate window
- `$500/month` and 20 included billable deliveries during the pilot
- No automatic overage
- Held lead 21+ requires explicit `$49` approval
- Immutable delivery/credit ledger
- No contractor dashboard during the managed pilot
- Quotes are observations, not verified sales
- At sample size 10–19, median/range only — no rank or percentile

---

## 11. Remaining roadmap — Prompts 3 through 11

Do not start any of these without a new explicit sprint approval. Sequence is dependency-ordered.

### Prompt 3 — Canonical tenant and placement authority

Reconcile existing contractor identities and produce the approved ownership/placement ADR. Define the reviewed mapping between `clients` and recipient contractor identities. Do not create a fourth contractor identity.

**Done when:** a human-approved ADR names the canonical placement owner without adding a new contractor identity table.

### Prompt 4 — Placement, origin, and widget-session security

Add service-owned placement, approved-origin, capability, session, revocation, expiry, and kill-switch authority through additive schema and narrow server endpoints.

**Done when:** a widget request cannot obtain session or upload capability without a live, unrevoked, origin-matched placement record.

### Prompt 5 — Exact-path private upload boundary

Replace broad widget upload authority with short-lived exact-object-path authorization, finalize verification, fingerprinting, MIME/size enforcement, and one canonical scanner dispatch.

**Done when:** widget uploads can write only the authorized object path and still enter the existing private `quotes` → `quote_files` → `scan_sessions` → `scan-quote` spine.

### Prompt 6 — Consent and original-document authorization

Implement versioned widget purposes, withdrawal effects, recipient restrictions, and exact document-specific authorization. Reconcile `get-contractor-document-url` before any widget document sharing.

**Done when:** original-document access is impossible without document-specific consent, and withdrawal blocks later sharing.

### Prompt 7 — Hardened embed surface

Build the cross-origin loader/iframe protocol with server-owned branding, origin/source/nonce validation, CSP `frame-ancestors`, iframe sandboxing, restrictive permissions, floating/inline layouts, and accessibility behavior.

**Done when:** the embed only runs on an approved origin with server-owned branding and a production CSP/`frame-ancestors` contract.

### Prompt 8 — Canonical OTP, scanner, and report integration

Connect widget sessions to existing Twilio OTP, `scan_sessions`, `scan-quote`, canonical `analyses`, and protected report retrieval. Do not build a second scanner or bypass `report-access`.

**Done when:** a widget homeowner can complete Verify-to-Reveal through the existing OTP and report-access path with no parallel scanner.

### Prompt 9 — Qualification and routing

Implement deterministic exclusions, duplicate rules, sponsor delivery, 30-day exclusivity, consent withdrawal, and delayed routing to no more than three eligible partners.

**Done when:** a qualified delivery goes only to the sponsor during exclusivity, then to at most three eligible partners, and withdrawn consent stops routing.

### Prompt 10 — Usage ledger and operator administration

Implement anniversary periods, 20 included deliveries, explicit `$49` approval for held overages, credits, suppression imports, operator placement controls, suspension, cancellation, and exports. Do not activate automatic Stripe metering.

**Done when:** billable deliveries are recorded on an immutable ledger, included quota is enforced, and overages stay held until explicit `$49` approval.

### Prompt 11 — Privacy-safe analytics, QA, and controlled pilot

Complete cross-tenant, security, accessibility, consent, billing-idempotency, benchmark-suppression, CSP, telemetry, kill-switch, rollback, and controlled-pilot acceptance testing.

**Done when:** a named controlled-pilot checklist passes without cross-tenant leakage, Verify-to-Reveal bypass, or automatic overage charging.

---

## 12. Unrelated branch map

### Intelligence Console WIP

| Field | Value |
|---|---|
| Branch | `codex/intelligence-console-v0` |
| Frozen WIP commit | [`2d2246c6435c60f4b29a3262e35168aec5761d06`](https://github.com/Mongoloyd/wm-mvp/commit/2d2246c6435c60f4b29a3262e35168aec5761d06) |
| State at hibernation | One unique WIP commit ahead; two commits behind `forensic_report_v2` |
| Merge base | `ac8f40b5ea7abb75e2f800b6eaa10c81836faf62` |

**CONFIRMED:** this branch contains synthetic Intelligence Console / Oracle UI, fixtures, routes, and tests.

- Must remain separate.
- Must not be merged merely to eliminate a “behind” indicator.
- When resumed, update the WIP branch from current `origin/forensic_report_v2` before continuing.

### Contractor admission branch

- `codex/contractor-brief-publishable-admission`
- PR [#248](https://github.com/Mongoloyd/wm-mvp/pull/248) is merged.
- Local branch may remain for traceability.
- Remote branch may have been automatically deleted.
- It is **not** the active development branch.

---

## 13. Exact future resume preflight

Run from the canonical checkout:

```powershell
cd C:\Projects\wm-mvp-github-clean

git fetch origin
git switch forensic_report_v2
git pull --ff-only origin forensic_report_v2

git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short --branch
git diff --name-status
git diff --cached --name-status

git merge-base --is-ancestor `
  a5c894a2bc8c648972256e520f52a6e2fe916a98 `
  HEAD
```

Rules:

- The ancestry check — not exact HEAD equality — is required because legitimate work may occur during hibernation.
- Stop if the ancestry check fails.
- Stop if the checkout is dirty.
- Stop if another agent is writing to the shared checkout.
- Reinspect current repository policy before creating the Prompt 3 branch.
- Reverify live Supabase function parity without printing secrets or accessing production rows.
- Confirm `generate-contractor-brief` has not regressed from the version-49 admission/authorization contract.
- Read the required architecture/security files before Prompt 3.

Required reading list:

- `AGENTS.md`
- `docs/WIDGET_HIBERNATION_STATE.md`
- `docs/architecture/PROTECTED_SYSTEMS.md`
- `docs/reveal/VERIFY_TO_REVEAL_CONTRACT.md`
- `docs/adr/ADR-004-quote-disposition-and-ledger-layer-separation.md`
- `docs/widget-embed.md`
- `public/windowman-widget.js`
- `public/widget-host.html`
- `supabase/config.toml`
- `supabase/functions/generate-contractor-brief/index.ts`
- `supabase/functions/get-contractor-document-url/index.ts`
- Consent, strict-report-binding, and quote-normalization migrations
- `src/integrations/supabase/types.ts`

---

## 14. Prompt 3 authorization boundary

Do not begin Prompt 3 based solely on this document. Obtain a new explicit `SPRINT APPROVAL:` scoped to canonical contractor identity and placement authority. Prompt 3 begins with read-only identity reconciliation and an ADR; it does not begin with widget UI, billing, or upload implementation.

---

## 15. Future Restart Prompt

To resume this project, paste the following into a fresh coding-agent chat:

```markdown
Resume the WindowMan Contractor Widget from the committed hibernation checkpoint.

Historical hibernation checkpoint commit:
`dc26a1d605fc50fa60bf2f4485c310f485f2361f`

Implementation freeze commit:
`a5c894a2bc8c648972256e520f52a6e2fe916a98`

The current hibernation document may have later documentation-only commits. Treat the SHAs above as historical anchors, not assumptions about the current branch name or current HEAD.

First read:

- `AGENTS.md`
- `docs/WIDGET_HIBERNATION_STATE.md`
- Every required file listed in its resume-preflight section

Perform a read-only resumption audit before editing:

1. Identify the current canonical branch and current repository policy.
2. Confirm the historical hibernation commit is an ancestor of the current canonical HEAD.
3. Confirm the checkout is clean and no concurrent agent is writing to it.
4. Compare current repository migrations, generated types, Edge Function sources, configuration, grants, RLS, Storage policies, contractor identities, and consent contracts against live Supabase project `zgsofkgddpcntdvpckdq`.
5. Reverify that the current deployed `generate-contractor-brief` preserves official publishable admission followed by exact-session resource authorization.
6. Identify every material repository, database, function, policy, dependency, and product-decision change since hibernation.
7. Classify each change as compatible, conflicting, security-sensitive, irrelevant, or unknown.
8. Decide whether Prompt 3 remains safe and correctly scoped.

Do not assume:

- The canonical branch is still named `forensic_report_v2`.
- Production is still function version 49.
- The database, generated types, grants, RLS, Storage policies, or Supabase APIs remain unchanged.
- Frozen pilot decisions were implemented.
- Existing widget shell files represent completed widget infrastructure.

Do not modify files, create or switch development branches, deploy, run SQL, access production rows, or invoke production functions during this audit.

Return:

1. Current repository, branch, and live-environment state
2. Hibernation-commit ancestry result
3. Repository-to-live parity assessment
4. Material drift matrix
5. New blockers or resolved blockers
6. Current `generate-contractor-brief` admission/authorization parity
7. Whether Prompt 3 remains the correct next action
8. A bounded Prompt 3 execution prompt if and only if the evidence supports it

Prompt 3 must begin with canonical contractor-identity and placement-authority reconciliation. It must not begin with widget UI, uploads, billing, or production schema mutations without separate approval.
```
