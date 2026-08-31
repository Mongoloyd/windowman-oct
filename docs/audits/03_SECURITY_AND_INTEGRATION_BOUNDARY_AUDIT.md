# Audit 03 — Security, Data Rights, and Integration Boundary Audit

## Execution identity

| Field | Value |
|---|---|
| Audit name | Audit 03 — Security, Data Rights, and Integration Boundary Audit |
| UTC execution time | 2026-08-30T20:54:54Z–2026-08-30T20:59:59Z |
| Execution environment | CODEX, local Windows PowerShell |
| Current working directory | `C:\Projects\wm-mvp-github-clean` |
| Canonical repository root | `C:\Projects\wm-mvp-github-clean` |
| Checkout type | Canonical primary checkout; one worktree observed |
| Active branch | `forensic_report_v2` |
| Current commit SHA | `7a497a5f1cba752d26ce1721f39d0a8288306a51` |
| Working-tree status | No staged or tracked modifications. Pre-existing untracked `docs/audits/01_REPOSITORY_AND_INGESTION_AUDIT.md` observed and not modified. |
| Configured upstream | `origin/forensic_report_v2` at the same locally stored SHA |
| Remote parity actually verified | **NO** — no network authorization; local remote-tracking state is not live parity |
| Database environment | **UNKNOWN** — operator did not select an environment |
| Database project identifier | **UNKNOWN** — repository docs name candidates, but none was supplied as the authorized target |
| PostgreSQL version | **UNKNOWN** |
| Production read authorization | **NOT_AUTHORIZED** — not explicitly supplied |
| Database metadata-read authorization | **NONE SUPPLIED** |
| Network authorization | **NOT_AUTHORIZED** |
| Applicable governance | `AGENTS.md`; `.cursor/PROTECTED_FILES.md`; `docs/START_HERE.md`; `docs/ops/DOC_STATUS_REGISTRY.md`; `docs/ops/SUPABASE_ENVIRONMENT_REGISTRY.md`; `docs/ops/SUPABASE_TARGETING.md`; `docs/reveal/VERIFY_TO_REVEAL_CONTRACT.md` |
| Audit 01/02 identity consistency | Same root, branch, SHA, and working-tree state |
| Audit status | **COMPLETE_WITH_BLOCKERS** |
| Auditor limitations | Repository evidence only. No database, dashboard, Storage, Edge Function, RPC, AI provider, network, build, test, or deployment invocation occurred. |
| Repository changes | **NONE** — this report was not saved to the repository |

The audit method kept Data API exposure, SQL grants, RLS, function/view security mode, and application authorization as distinct controls.

## Executive security assessment

The repository contains a credible backend Verify-to-Reveal mechanism: `get_analysis_full` requires an exact verified phone-verification row bound to the same scan session and lead before returning `full_json`. Browser source contains no service-role credential consumer, and preview transport strips `full_json`.

That protection does not establish overall build readiness:

- **CONFIRMED:** The latest repository migration grants `get_analysis_full` execution to `anon` and `authenticated`, contradicting source comments that it is service-role-only. The database predicate still protects the payload, but the declared Edge-only transport boundary is not enforced by repository migration intent.
- **CONFIRMED:** `scan-quote` uses service-role authority after accepting only a scan-session UUID; it does not authenticate the caller or prove ownership of that session.
- **CONFIRMED:** Preview and status access are knowledge-based. Preview can disclose contractor identity and report teaser fields to a caller possessing the scan-session UUID.
- **CONFIRMED:** Upload object keys retain the normalized original filename, and browser diagnostics log the filename, object path, and session identifier. Filenames can contain PII.
- **CONFIRMED:** The existing `refresh-benchmarks` source scans every completed `analyses.full_json`, joins lead geography, and uses a five-record minimum without revision, duplicate, contractor-concentration, test-data, consent, or bounded-scan controls.
- **CONFIRMED:** The Truth Report currently consumes hardcoded county proxy benchmarks. The generated benchmark table is documented as a future path, not the current report source.
- **UNKNOWN:** No deployed grant, RLS, bucket, function, cron, environment-variable, Data API schema, or migration state was verified.
- **BUILD BLOCKER:** Repository evidence alone cannot authorize profiling or implementation.

Boundary verdict:

> **SAFE_POST_ANALYSIS_BOUNDARY_INFERRED**

A durable state pair—`analyses.analysis_status = 'complete'` plus `scan_sessions.status = 'preview_ready'`—is visible in source, and non-fatal event insertion demonstrates an isolation pattern. No durable, independently retryable intelligence job, ownership contract, deployment proof, feature flag, or rollback control confirms the boundary as safe.

## Trust-boundary diagram

```text
Browser / publishable key
  ├─ direct private-bucket upload
  │    └─ quotes/<session>/<size>_<normalized-original-name>
  ├─ start-upload-scan-session
  │    └─ service-role DB writes and signed-URL existence probe
  ├─ scan-quote
  │    ├─ service-role Storage download
  │    ├─ raw document → Google Gemini
  │    ├─ runtime validation + deterministic scoring
  │    └─ analyses.full_json + preview state
  ├─ report-access preview
  │    └─ service-role → SECURITY DEFINER preview RPC
  ├─ send-otp / verify-otp
  │    ├─ Twilio
  │    └─ exact phone + scan + lead verification
  └─ report-access full
       └─ service-role → get_analysis_full
            └─ authorized full_json → in-memory React rendering
```

## Trust-boundary inventory

| Component | Trust/identity | Sensitive input/output | Authorization and failure boundary | Evidence |
|---|---|---|---|---|
| Supabase browser client | Untrusted browser; publishable/anon key | Session IDs, phone, files, report payloads | No browser service-role key found | A03-REP-002 |
| Quotes Storage upload | Anonymous or authenticated browser | Raw source document; filename-derived key | RLS write policies; no read policy in repository intent | A03-REP-013, A03-REP-014 |
| `start-upload-scan-session` | Public Edge route acting as service role | Lead/session binding, object path, file metadata | Strict binding only when `ENFORCE_CONTACT_OWNED_UPLOAD=1`; deployed value unknown | A03-REP-006 |
| `scan-quote` | Public Edge route acting as service role | Raw document, extraction, `full_json` | Session UUID existence, rate limit, lifecycle guard; no caller/owner check | A03-REP-005 |
| Gemini | External processor | Complete uploaded document and prompt | Server API key; timeout; provider contract not inspected | A03-REP-015, A03-DOC-002 |
| `analyses` | Protected database object | Raw extraction, deterministic report, grade | Intended RLS; full access through protected RPC/admin paths | A03-REP-009 |
| `report-access` preview | Public Edge route acting as service role | Contractor name and teaser fields | UUID-only; defensive `full_json` stripping | A03-REP-003, A03-REP-019 |
| OTP functions | Public Edge routes acting as service role | Phone, code, scan ID | Pending row and exact scan/lead binding; phone/IP limits | A03-REP-007 |
| `report-access` full | Public Edge route acting as service role | Full report and `full_json` | Exact phone/scan/lead predicate in RPC | A03-REP-003, A03-REP-004 |
| Admin Edge routes | Authenticated user, role checked, then service role | Cross-lead operational data | JWT `getUser()` plus stored role; optional environment-gated dev bypass | A03-REP-008 |
| Contractor document route | Authenticated contractor | Raw source document signed URL | Requires unlocked lead or released opportunity route; five-minute URL | A03-REP-016 |
| `refresh-benchmarks` | Secret-header cron, service role | All completed `full_json`, county, project type | Shared-secret header; no bounded query | A03-REP-018 |
| React Truth Report | Authorized browser state | Full report and raw `full_json` projection | Full response held in component state; verified phone/session resume hint is rechecked by backend | A03-REP-017 |

## Role and access matrix

| Role | Intended access | Material qualification |
|---|---|---|
| `anon` / publishable browser | Storage insert/update; public Edge routes; scan status; preview; OTP | `verify_jwt=false` on all 59 configured functions means handler-level controls are decisive. |
| `authenticated` homeowner | Similar public funnel access | Authentication alone is not resource authorization. No general homeowner row-ownership model was found for analyses. |
| Authenticated internal operator | Selected direct reads through `is_internal_operator()` RLS policies | Depends on JWT `app_metadata.role` and underlying table grants. Deployed claims are unknown. |
| Admin Edge caller | JWT validation plus role lookup, then service-role queries | Shared admin helper also supports a dev-secret super-admin bypass when explicitly enabled. |
| Contractor | Contractor-owned/released objects | Raw quote access is mediated by an authenticated Edge route and signed URL. |
| `service_role` | Scanner, OTP, report proxy, normalization, benchmark, and admin operations | Must remain server-only; no browser consumer was found. |
| `PUBLIC` | Function defaults and explicitly granted objects | Effective deployed defaults are unknown. `get_analysis_full` is explicitly granted to browser roles. |

## Table, RLS, and grant matrix

“Deployed” is **UNKNOWN** for every row.

| Object | Repository-intended RLS/grants | Client access | Risk/condition |
|---|---|---|---|
| `public.analyses` | RLS enabled; service-role all policy; authenticated internal-operator select policy | Report RPCs and admin/service paths | Table owner, forced RLS, and effective grants unknown. Holds `full_json`. |
| `public.scan_sessions` | RLS enabled; anon insert constrained to `user_id IS NULL`; no anon select policy | `get_scan_status` exposes UUID/status | Edge scanner lacks caller ownership proof. |
| `public.quote_files` | RLS enabled; anon insert policy; direct selects removed | Service-role resolution only | Storage and relational deletion are not coupled in source. |
| `public.phone_verifications` | RLS enabled; browser table privileges revoked; service-role all policy | OTP and report RPC only | Strict scan binding is present in latest full-report function. |
| `public.lead_consent_events` | RLS enabled; browser privileges revoked; service-role RPC only | Service-role writers/readers | Append-only version evidence exists; withdrawal workflow is not end-to-end. |
| `public.wm_quote_facts` | RLS enabled; service-role all policy | No production reader or writer established by Audits 01/02 | Contains relational IDs and county; not inherently de-identified. |
| `public.quote_observations` | Browser/public revoked; explicit authenticated SELECT plus internal-operator RLS; service-role all | Internal operators | Contains lead ID, ZIP, raw contractor name, and source keys. |
| `public.quote_line_items` | Same internal/service model | Internal operators | Contains raw descriptions, raw dimensions, brands, locations, and tags. |
| `public.normalization_failures` | Same internal/service model | Internal operators | Can retain a redacted source excerpt and survives analysis deletion. |
| `public.county_benchmarks` | Repository policy allows public read | Candidate aggregate output | Five-row minimum exists only in refresher source; small-cell policy is not approved or deployed. |
| `public.quote_intelligence_facts` | No repository definition or use found | None established | Exact expected object is **CONTRADICTED** in repository scope. |

No relevant sequence-based identity was found for these UUID-keyed objects. Sequence ownership and privileges in deployed state remain unknown.

## Storage security matrix

| Concern | Repository evidence | Assessment |
|---|---|---|
| Bucket | `quotes` changed from public to private | **CONFIRMED repository intent** |
| Limits | 10 MiB; PDF, JPEG, PNG, WebP, HEIC | **CONFIRMED repository intent** |
| Browser upload | Anonymous/authenticated insert; update for retry/upsert | Write-only intent, but object-name scope is not enforced by the Storage policies themselves |
| Browser read | Initial anonymous read policy is dropped | No repository-intended direct browser read policy |
| Object key | `<session-id>/<size>[_rN]_<normalized-original-filename>` | Original filename can retain names, addresses, or contractor identity |
| Server read | `scan-quote` downloads with service role | Raw quote crosses Storage→Edge→Gemini |
| Contractor read | Five-minute signed URL after JWT plus release/unlock check | Protected service pattern exists |
| Admin read | One-hour signed URL through admin role path | Longer exposure window; deployed behavior unknown |
| Existence probe | `start-upload-scan-session` creates a 60-second signed URL but does not return it | Low direct exposure; still requires server log hygiene |
| Delete/retention | DB foreign-key cascades exist, but no corresponding Storage object cleanup was found | Orphaning and erasure completeness unresolved |
| Object listing | Not performed | Deployed bucket contents and policies unknown |

## Views, functions, RPCs, and triggers

| Object/group | Security mode and grants | Finding |
|---|---|---|
| `get_analysis_preview(uuid)` | `SECURITY DEFINER`, `search_path='public'`; no later explicit revoke found | UUID-only teaser. Function comments do not prove service-role-only execution. |
| `get_analysis_full(uuid,text)` | `SECURITY DEFINER`, `search_path='public'`; explicitly granted to `anon, authenticated` | Exact scan/phone/lead authorization is strong, but this contradicts the Edge-only transport claim. |
| `get_scan_status(uuid)` | `SECURITY DEFINER`; explicitly granted to `anon, authenticated` | Returns only ID/status; UUID knowledge is the access condition. |
| `get_lead_by_session(text)` | `SECURITY DEFINER`, returns a lead ID | No explicit ownership check or grant hardening found in its defining migration. |
| `persist_lead_consent_batch(...)` | `SECURITY DEFINER`, empty search path; revoked from public/browser roles; service-role execute | Strong repository-intended privilege posture. |
| Latest-analysis pointer RPC | `SECURITY INVOKER`, empty search path; browser execution revoked; service-role execute | Appropriate separation from report authorization. |
| `is_internal_operator()` | `SECURITY DEFINER`, `search_path='public'`; checks authenticated JWT app metadata | Used widely by internal RLS. Owner and effective execute grants require deployed verification. |
| Admin diagnostic views | Later definitions use `security_invoker=true`; selected views granted to authenticated/service role | Underlying RLS remains relevant; deployed definitions unknown. |
| Core triggers | Timestamp maintenance, lead/analysis inheritance, event/audit helpers | No trigger writing an intelligence fact table after scanner completion was found. |
| Cron/network objects | Repository contains `pg_cron`, Vault, and HTTP-post machinery for other operational paths | Active schedules and secrets were not inspected. |

## PII and sensitive-data flow

| Flow | Data class | Transformation/control | Residual risk |
|---|---|---|---|
| Browser → Storage | Source document; original filename | Private bucket; normalized filename | Filename remains recoverable in key and browser logs |
| Storage → Gemini | Complete document bytes | Base64 inline provider request; server API key; timeout | Third-party processing and retention terms unverified |
| Gemini → validation | Extracted quote content | JSON normalization and runtime validation | Provider error snippets up to 240 characters can be logged |
| Validation → `analyses.full_json` | Raw/derived extraction, prices, terms, contractor data | Service-role persistence and RLS intent | Retention and deletion policy not operationally defined |
| Analysis → preview | Grade, contractor name, counts, warning/missing-item teaser | Preview projection strips `full_json` | UUID possession discloses contractor/commercial context |
| Analysis → full browser | Full report and `full_json` | Exact scan/phone/lead backend check | Browser receives protected data after authorization, as intended |
| Browser resume | Phone and scan identifiers | Stored resume record is revalidated by backend | Phone and identifiers are retained in local storage |
| Phone → Twilio | Phone number, lookup/OTP traffic | Server-side provider call; masked logs | Provider contract and retention unverified |
| Analysis → benchmark refresher | All completed `full_json`, lead county/project type | Numeric extraction and aggregate output | No duplicate, revision, concentration, consent, or test exclusion |
| Analysis → contractor | Raw quote via signed URL | JWT plus release/unlock predicate | Complete source-document disclosure occurs after contractor authorization |
| Scanner → logs | Lead ID, county, derived metrics | Structured trace | Identifiable quote economics can be correlated in logs |
| Upload → browser logs/events | Filename, object key, session ID, size/type | None beyond console/event routing | PII may appear in diagnostics or telemetry |

## Data-rights and review register

| Issue | Existing evidence | Missing evidence | Required review |
|---|---|---|---|
| Service/marketing/contractor consent | Versioned append-only consent events with granted/declined/withdrawn states | Complete withdrawal and downstream suppression coverage | **REQUIRES PRIVACY REVIEW** |
| Aggregate quote intelligence | Landing content says anonymized aggregated patterns may be used | Consent purpose, de-identification standard, data-use basis, opt-out handling | **REQUIRES PRIVACY REVIEW** |
| Non-partner contractor data | Quotes can retain contractor names, terms, prices, products | Permitted analytics use, disclosure, dispute/correction process | **REQUIRES CONTRACT REVIEW** and **REQUIRES COMPETITION-LAW REVIEW** |
| Gemini processing | Privacy content identifies Google Gemini processing | Current DPA, region, retention, training/use settings, subprocessor terms | **REQUIRES PRIVACY REVIEW** and **REQUIRES CONTRACT REVIEW** |
| Retention | Purpose-based policy language exists | Concrete TTLs, backup rotation, log retention, source/derived separation | **REQUIRES PRIVACY REVIEW** |
| Deletion/erasure | Relational cascades exist | Storage deletion, derived facts, event logs, normalization failures, backups, third parties | **REQUIRES PRIVACY REVIEW** |
| Access/export/correction | Policy provides an email request process | Operational workflow, verification, export format, correction lineage, SLA evidence | **REQUIRES PRIVACY REVIEW** |
| Consent records | Version and source fields exist | Whether all funnels persist the same required evidence | **REQUIRES PRIVACY REVIEW** |
| Benchmark small cells | Existing refresher uses minimum sample size 5 | Approved threshold, contractor concentration, geography/revision safeguards | **REQUIRES PRIVACY REVIEW** and **REQUIRES COMPETITION-LAW REVIEW** |
| Incident response | General security language exists | Runbook, owners, notification workflow, evidence retention | **REQUIRES PRIVACY REVIEW** |

The policy statements are repository evidence, not legal conclusions or proof that the workflows are operational.

## Truth Report integration-boundary map

| Stage | Acting identity | Input → output / side effect | Success and failure boundary | Evidence |
|---|---|---|---|---|
| Upload | Browser publishable key | File → private Storage object | Storage SDK result; filename-derived key | A03-REP-013, A03-REP-014 |
| Bootstrap | Public Edge route/service role | Session, object path, optional lead → lead/file/scan rows | Optional contact-owned feature flag; idempotent lookup by object path | A03-REP-006 |
| Extraction invocation | Public Edge route/service role | Scan UUID → session and private object | No caller ownership check; lifecycle and rate-limit guards | A03-REP-005 |
| AI extraction | Edge→Gemini | Raw document + prompt → JSON candidate | Timeout/network/malformed-output branches | A03-REP-015 |
| Validation | Edge | Candidate JSON → validated extraction | Classification gate and runtime validation precede complete persistence | A03-REP-015 |
| Deterministic analysis | Edge TypeScript | Validated extraction → scores, flags, metrics, compiled report | Metrics failure is non-fatal | A03-REP-019 |
| Persistence | Service role | Compiled payload → `analyses` upsert | Unique scan-session key; no transaction encompassing following status write | A03-REP-019 |
| Pointer/events | Service role | Analysis ID → latest pointer and events | Pointer failure leaves analysis complete/session processing; events are non-fatal | A03-REP-019 |
| Durable reveal-ready marker | Service role | Processing → `preview_ready` | Failed status write triggers compensating analysis-status rollback | A03-REP-019 |
| Preview delivery | Public Edge/service role | Scan UUID → redacted preview | UUID-only; `full_json` stripped | A03-REP-003 |
| OTP | Public Edge/service role/Twilio | Phone, code, scan → verified phone/lead | Exact pending phone+scan row and lead binding | A03-REP-007 |
| Full delivery | Public Edge/service role | Scan+phone → gated RPC → full row | Unauthorized sentinel on mismatch | A03-REP-004 |
| Browser rendering | React | Full row → in-memory report model | No full payload loaded before successful backend response | A03-REP-017 |
| Email delivery | Public Edge/service role | Scan UUID → email to server-resolved verified lead | Triggerable by UUID; sends only to persisted lead email; idempotent sent status | A03-REP-020 |

### Candidate boundaries

| Candidate | Durable success | Isolation/retry | Report independence | Missing proof |
|---|---|---|---|---|
| Immediately after `analyses.complete` upsert | Partial | Analysis may later be reset to processing; pointer can fail | Not independent | Stable final-state contract |
| Non-fatal `scan_completed`/canonical event insertion | Analysis is durable, but session may still be processing | Event failures are isolated | Mostly independent | Durable outbox, consumer, replay, and idempotency contract |
| After both analysis complete and session `preview_ready` | Strongest source-level success marker | Re-invocation returns terminal no-op | Report can already render | No asynchronous activation mechanism or deployed lifecycle proof |
| Existing `refresh-benchmarks` cron | Independent from report request | Upsert by cohort key | Report does not currently consume it | Unsafe/unbounded source selection and no confirmed schedule |

**Boundary conclusion: `SAFE_POST_ANALYSIS_BOUNDARY_INFERRED`.**

This is not implementation approval.

## Operational safety assessment

| Capability | Current mechanism | Classification and build implication |
|---|---|---|
| Idempotency | Unique analysis per scan session; upsert; quote-file/scan reuse | **CONFIRMED**, but does not establish intelligence-job idempotency |
| Concurrent scan handling | Terminal/in-flight/stale-takeover decision | **CONFIRMED** source behavior |
| Transactionality | Sequential writes plus compensating rollback | **INFERRED partial**; no encompassing transaction |
| Scanner retries | Stale processing takeover; browser preview retry | **CONFIRMED** |
| OTP limits | Phone-window, IP, cooldown controls | **CONFIRMED** source behavior |
| Preview limits | No route-specific rate limit found | **BUILD BLOCKER** for enumeration/abuse analysis |
| Error isolation | Scanner operational events are non-fatal | **CONFIRMED pattern**, not a durable intelligence queue |
| Dead letter/recovery | No intelligence-specific queue or dead-letter path | **UNKNOWN/ABSENT in inspected scope** |
| Observability | Structured logs, audit rows, event records | No alerting or log-retention proof; some logs carry identifiers/economics |
| Feature flags | Upload enforcement and dev bypass flags exist | No intelligence/Truth Report benchmark flag found |
| Rollback | Migration comments and report fallbacks exist | No runtime benchmark kill switch or deployed rollback proof |
| Test/demo isolation | `leads.is_test` exists for selected side effects | Benchmark refresher does not filter it |
| Environment separation | Governance maps LIVE_ACTIVE and legacy projects | Operator target and live parity were not established |
| CORS | Upload bootstrap uses an allowlist; report/scanner/OTP routes use `*` | CORS is not authorization; inconsistent posture requires review |
| Benchmark scan scope | All completed analyses loaded with no date/row bound | Unsuitable for authorized profiling or production activation |
| Current report benchmark | Hardcoded regional/city proxy module | Database benchmark output is not coupled to Truth Report runtime |

## Test and fixture inventory

No tests were executed. Status for every row is **NOT_EXECUTED**.

| Test group | Protected behavior | Gap |
|---|---|---|
| `verify-otp/handler.test.ts`, `pendingRowBinding.test.ts` | Exact pending phone/scan/lead binding | No deployed RLS/function proof |
| `useAnalysisData.fetchFull.test.ts`, dev-bypass precedence tests | Full-fetch gate and dev precedence | No browser E2E or production proof |
| `useReportAccess.test.ts`, `ReportClassic.test.tsx`, `PostScanReportSwitcher.test.tsx` | Preview/full rendering states | No network/runtime test performed |
| `start-upload-scan-session/index_test.ts`, schema tests | Lead/session/consent/path validation | Enforcement environment value unknown |
| `UploadZone.test.tsx`, `storagePath.test.ts` | Upload/retry/path behavior | Filename privacy risk is not prohibited |
| `scan-quote` request, recovery, pointer, classification, scoring tests | Scanner lifecycle and deterministic analysis | No caller-authorization test found |
| `_shared/adminAuth_test.ts` | JWT/role and disabled dev bypass | Deployed environment flags unknown |
| Window Oracle fixture and PII tests | Synthetic DTO PII exclusion | Fixtures do not prove live facts or delivery safety |
| Migration SQL tests | Pointer/outcome contracts | No current applied-migration evidence |
| Privacy/consent UI tests | Notice and local consent behavior | No end-to-end rights/deletion test |

## Deployment and environment assessment

Repository governance names `zgsofkgddpcntdvpckdq` as **LIVE_ACTIVE** and `wkrcyxcnzhwjtdpmfpaf` as **LEGACY_PARENT**, but these are documentation claims, not selected operator inputs or current deployment proof.

Additional repository drift was observed:

- Current source has 60 function directories excluding `_shared` and `tests`.
- `supabase/config.toml` has 59 function entries.
- `nextdoor-capi-event` lacks a matching config block.
- The function manifest still claims 54 functions and contains dated deployment observations.
- `supabase/config.toml` identifies only a local namespace, not a remote project.
- No `[api]` exposed-schema configuration was found in `config.toml`; dashboard Data API settings remain unknown.

## Database query log

| Query ID | Environment | Project | UTC | Purpose | Result |
|---|---|---|---|---|---|
| None | UNKNOWN | UNKNOWN | — | Database access was not authorized | No database query was prepared or executed |

## Evidence ledger

| Evidence ID | Classification | Claim | Source and exact reference | Observation / build implication | Confidence |
|---|---|---|---|---|---|
| A03-REP-001 | CONFIRMED | Canonical checkout identity | `7a497a5f`; Git root/branch/status/upstream inspection | Same checkout as Audits 01/02; live parity not proven | High |
| A03-CONFIG-001 | CONFIRMED | Gateway JWT verification is disabled for every configured function | `supabase/config.toml:3-178` | 59 entries use `verify_jwt=false`; handler controls are mandatory | High |
| A03-CONFIG-002 | CONFIRMED | Local config is not a remote target and does not declare exposed API schemas | `supabase/config.toml:1-178` | Dashboard/Data API state remains unknown | High |
| A03-REP-002 | CONFIRMED | Browser uses publishable/anon credentials only | `src/integrations/supabase/client.ts:6-26`; exhaustive browser search | No browser service-role consumer found | High |
| A03-REP-003 | CONFIRMED | Preview is UUID-only and full mode delegates to a phone-bound RPC | `supabase/functions/report-access/index.ts:372-528` | Preview strips `full_json`; no caller authentication | High |
| A03-REP-004 | CONFIRMED | Full report uses strict scan/phone/lead binding | `supabase/migrations/20260428120000_restore_get_analysis_full_strict_scan_binding.sql:15-92` | Prevents one verified scan from unlocking another | High |
| A03-REP-005 | CONFIRMED | Scanner has no caller identity/ownership check | `supabase/functions/scan-quote/index.ts:528-750` | A valid scan UUID invokes service-role processing | High |
| A03-REP-006 | CONFIRMED | Upload ownership enforcement is environment-conditional | `start-upload-scan-session/index.ts:552-730,844-971` | Flag-off behavior is materially weaker; deployed value unknown | High |
| A03-REP-007 | CONFIRMED | OTP verification is scan-bound | `send-otp/index.ts:105-145,194-435`; `verify-otp/index.ts:127-177,273-529` | Pending row, scan, lead, and canonical phone are checked | High |
| A03-REP-008 | CONFIRMED | Admin paths authenticate JWT and role before service-role DB use | `_shared/adminAuth.ts:197-390,419-447` | Dev-secret bypass must be disabled outside approved environments | High |
| A03-REP-009 | CONFIRMED | Analyses and verification RLS intent exists | `20260322100001...:106-110`; `20260416154937...:7-21,100-108`; `20260518140000...:10-15` | Effective owner/grants/forced RLS need deployed proof | High |
| A03-REP-010 | CONFIRMED | Latest migration permits browser-role direct full-RPC execution | `20260428120000...:92`; `reportService.ts:7-12`; `report-access/index.ts:4-7` | Direct contradiction in boundary ownership | High |
| A03-REP-011 | CONFIRMED | Status RPC is UUID-only and explicitly browser-executable | `20260318112259...:4-14`; `20260523120000...:1-7` | Leaks only ID/status but has no ownership predicate | High |
| A03-REP-012 | CONFIRMED | Candidate fact models remain protected but identifiable | `20260414110000_wm_canonical_event_foundation.sql:141-202`; `20260806144716_quote_normalization_layer.sql:5-122,163-223` | Not automatically de-identified | High |
| A03-REP-013 | CONFIRMED | Quotes bucket is private but accepts anonymous writes | `20260318033459...:6-18`; `20260421202348...:1-22` | Write policies do not bind object key to caller ownership | High |
| A03-REP-014 | CONFIRMED | Storage keys and browser diagnostics retain filename data | `storagePath.ts:10-44`; `UploadZone.tsx:769-810,938-954` | PII-in-path/log risk blocks de-identification claim | High |
| A03-REP-015 | CONFIRMED | Full documents are sent to Gemini and provider snippets can be logged | `scan-quote/index.ts:800-940,1029-1061` | Third-party and logging controls require review | High |
| A03-REP-016 | CONFIRMED | Contractor raw-document access uses resource authorization | `get-contractor-document-url/index.ts:25-203` | JWT plus unlock/release predicate; five-minute signed URL | High |
| A03-REP-017 | CONFIRMED | Full browser state is set only after authorized transport | `reportService.ts:117-154`; `useAnalysisData.ts:545-646` | Resume state is revalidated; full payload is browser-resident after unlock | High |
| A03-REP-018 | CONFIRMED | Existing benchmark refresher scans all completed analyses | `refresh-benchmarks/index.ts:70-284` | No bounded scan, duplicate/revision/test/concentration controls | High |
| A03-REP-019 | CONFIRMED | Durable scanner finalization is multi-step | `scan-quote/index.ts:1291-1394,1470-1548` | Analysis upsert, pointer, non-fatal events, then preview-ready; compensating rollback exists | High |
| A03-REP-020 | CONFIRMED | Report email is UUID-triggerable but server-addressed and verification-gated | `send-report-email/index.ts:248-359` | Abuse/notification risk remains; no payload exfiltration to caller found | High |
| A03-REP-021 | CONFIRMED | Truth Report currently uses hardcoded proxy benchmarks | `_shared/countyBenchmarks.ts:18-94`; `_shared/metrics.ts:161` | Database benchmark integration is future/comment-only | High |
| A03-REP-022 | CONFIRMED | Consent records are versioned and append-only | `20260801143000_lead_consent_events.sql:4-156`; `consentVersions.ts:1-20` | Does not establish aggregate-intelligence authorization | High |
| A03-DOC-001 | CONFIRMED | Governance requires private files and backend reveal | `AGENTS.md:103-121`; `VERIFY_TO_REVEAL_CONTRACT.md:26-54,83-96` | Current source mostly follows the full-report rule | High |
| A03-DOC-002 | CONFIRMED | Privacy content discloses Gemini, contractor sharing, retention, and rights | `privacyPolicyContent.ts:210-232,334-350,380-405,454-455`; `privacyPolicyMetadata.ts:40-85` | Policy evidence, not operational or legal proof | High |
| A03-DOC-003 | CONFIRMED | Repository docs identify competing environment roles | `SUPABASE_ENVIRONMENT_REGISTRY.md:7-28`; `SUPABASE_TARGETING.md:15-32` | Operator must still bind the audit to one environment | High |
| A03-REP-023 | CONTRADICTED | `quote_intelligence_facts` exists | Exhaustive repository search at `7a497a5f` | Exact object absent from tracked source | High |
| A03-REP-024 | CONFIRMED | Relevant later admin views use invoker security | `20260421062952...:11-57`; `20260421074222...:90-129` | Underlying RLS remains active in repository intent | Medium-high |
| A03-REP-025 | CONFIRMED | Test-data exclusion is incomplete for benchmarking | `20260820134959_add_is_test_trigger_guards.sql:1-34`; `refresh-benchmarks/index.ts:91-207` | Refresher does not filter `leads.is_test` | High |
| A03-DB-001 | UNKNOWN | Deployed security state | No authorized database source | All repository conclusions remain intent/source evidence only | High |
| A03-EXT-001 | UNKNOWN | Current external Supabase behavior/deployment documentation | Network not authorized | No external reference used | High |

## Contradictions

| ID | Contradiction | Consequence |
|---|---|---|
| C-A03-001 | `reportService` and `report-access` state report RPCs are service-role-only; latest migration grants `get_analysis_full` to browser roles | Intended Edge-only boundary is not repository-enforced |
| C-A03-002 | Function manifest claims 54 matching functions; current tree has 60 folders and 59 config entries | Deployment/config inventory is stale |
| C-A03-003 | Landing copy says quote patterns are anonymized and aggregated; candidate tables retain relational IDs, ZIP, contractor names, and raw source text | De-identification claim requires a formal projection and privacy review |
| C-A03-004 | Scanner comment describes `full_json` as gated “on client”; actual protection correctly occurs in the database RPC | Comment is stale and could mislead future changes |
| C-A03-005 | Historical “staging/production” labels conflict with the current LIVE_ACTIVE/LEGACY_PARENT registry | Environment must be bound by project identifier, not label |

## Unknowns

| Unknown ID | Question | Checks performed | Build impact | Owner / required evidence | Authorization |
|---|---|---|---|---|---|
| U-A03-001 | Which Supabase environment is in scope? | Config and governance inspected | Blocks all deployed conclusions | Operator-selected environment and project ID | Required |
| U-A03-002 | Which migrations are applied? | Repository migration order inspected | Blocks schema/security binding | Read-only migration ledger | DB metadata read |
| U-A03-003 | What schemas are Data API exposed? | No `[api]` config found | Blocks exposure assessment | Dashboard/config metadata | DB/dashboard read |
| U-A03-004 | What are effective owners, grants, RLS and forced-RLS states? | Repository definitions inspected | Blocks vulnerability conclusions | Catalog metadata | DB metadata read |
| U-A03-005 | What are deployed Storage bucket and policy states? | Repository migrations inspected | Blocks source-document exposure conclusion | Storage metadata only | Authorized metadata read |
| U-A03-006 | Are dev/QA bypasses enabled? | Source flags inspected | Potential full-report bypass if misconfigured | Sanitized secret-name/config presence | Authorized config read |
| U-A03-007 | Is upload ownership enforcement enabled? | Source flag inspected | Determines public bootstrap posture | Sanitized environment flag state | Authorized config read |
| U-A03-008 | Is benchmark cron deployed or scheduled? | Source and dated docs inspected | Determines whether unsafe scan executes | Function/cron metadata | Authorized metadata read |
| U-A03-009 | Are logs retained/redacted appropriately? | Logging sites inspected | PII/data-rights blocker | Logging policy and sample-free configuration metadata | Privacy/ops review |
| U-A03-010 | Are Storage objects deleted with relational records? | Cleanup searches performed | Erasure and orphan blocker | Deletion workflow and tests | Product/privacy owner |
| U-A03-011 | What PostgreSQL/Supabase versions are deployed? | No authorized remote access | Needed for final view/function behavior claims | Version metadata | DB metadata read |
| U-A03-012 | What database size and query limits are approved? | No operator limits supplied | Blocks Audit 04 | Approved statement/lock/idle timeouts and scan cap | Operator |

## Hard stops

| Hard-stop ID | Stopped scope | Reason | Required operator action |
|---|---|---|---|
| HS-A03-001 | Deployed database/RLS/grant inspection | Environment, project ID, and metadata-read authorization absent | Select one environment and provide explicit read-only metadata authorization |
| HS-A03-002 | Storage and function deployment verification | No network or remote-service authorization | Authorize narrowly scoped metadata reads |
| HS-A03-003 | External version-sensitive documentation | Network authorization absent | Authorize official-documentation access if needed |
| HS-A03-004 | Profiling/query generation | No deployed bindings, limits, or execution-role visibility | Complete schema binding and security authorization first |

## Critical security blockers

| Blocker ID | Severity | Condition | Failure path / impact | Resolution evidence |
|---|---|---|---|---|
| SB-A03-001 | Critical | Deployed security state unknown | Repository intent could differ from live grants, policies, functions, or buckets | Authorized catalog/config metadata |
| SB-A03-002 | High | Report RPC ownership conflict | Browser roles may bypass intended Edge transport even though full predicate remains | Effective deployed grants and approved transport contract |
| SB-A03-003 | High | `scan-quote` lacks caller/resource ownership | Possession of a session UUID can invoke privileged scanning | Approved caller/capability contract and tests |
| SB-A03-004 | High | Upload enforcement is environment-conditional | Flag-off path can use legacy lead resolution | Confirmed environment value and behavior |
| SB-A03-005 | High | Filename-derived object keys and diagnostics | PII can enter paths, logs, or telemetry | Approved naming/redaction contract |
| SB-A03-006 | High | Benchmark refresher is unbounded and semantically unsafe | Reads all `full_json`; includes duplicates/tests/revisions and lacks concentration controls | Disabled/deployed proof plus approved bounded eligibility contract |
| SB-A03-007 | High | No confirmed additive intelligence lifecycle | Failure isolation, retry, and report independence remain incomplete | Durable success/event/idempotency specification |
| SB-A03-008 | High | No intelligence-specific feature flag/rollback | Unsafe benchmark output could couple to reports without a kill switch | Approved activation and rollback controls |
| SB-A03-009 | High | Aggregate-intelligence data rights unresolved | Existing consent purposes do not explicitly establish proposed processing | Privacy/contract/competition-law decisions |
| SB-A03-010 | High | Deletion and retention incomplete | DB deletion may leave Storage, logs, facts, failures, backups, and provider copies | End-to-end erasure and retention evidence |
| SB-A03-011 | Medium-high | Preview/status are UUID knowledge-based | Leaked identifiers disclose status and contractor/report teaser context | Approved exposure and abuse controls |
| SB-A03-012 | Medium-high | Dev bypass deployment unknown | Enabled bypass can return complete `full_json` without OTP | Sanitized environment proof and environment separation |
| SB-A03-013 | Medium-high | Test-data indicator is not consumed by benchmark refresher | Synthetic data can contaminate aggregates | Confirmed exclusion rule and test |
| SB-A03-014 | Medium | No monitoring/alerting proof | Failures or privacy leaks may remain undetected | Observability ownership and alert evidence |

## Conditions required before implementation

1. Bind the audit to an exact environment and non-secret project identifier.
2. Verify applied migrations, Data API schemas, owners, grants, RLS, forced RLS, function/view definitions, and Storage policies.
3. Resolve the direct-RPC versus Edge-only transport contradiction.
4. Establish caller and resource authorization for privileged scan invocation.
5. Confirm upload-enforcement and dev-bypass environment states.
6. Define and approve PII exclusions, filename/path handling, log redaction, and retention.
7. Obtain privacy, contract, and competition-law decisions for aggregate quote and contractor intelligence.
8. Establish duplicate, revision, supersession, test-data, contributor-concentration, and small-cell rules.
9. Confirm a durable, retryable, failure-isolated post-analysis lifecycle.
10. Establish feature-flag, rollback, monitoring, and correction controls.
11. Review and authorize exact bounded SQL before any profiling execution.

## Audit 04 handoff

> **REPOSITORY EVIDENCE ALONE DOES NOT AUTHORIZE DATA PROFILING.**

| Audit 04 input | Bound value | Status | Safe for SQL |
|---|---|---|---|
| Database environment | UNKNOWN | UNKNOWN | **NO** |
| Project identifier | Repository docs contain candidates; none operator-bound | UNKNOWN | **NO** |
| Execution role/visibility | UNKNOWN | UNKNOWN | **NO** |
| Profiling-permitted objects | None authorized | UNKNOWN | **NO** |
| Prohibited objects | All application tables until authorization; always exclude raw documents, paths, PII, `full_json`, raw descriptions/excerpts | CONFIRMED audit restriction | N/A |
| Candidate repository objects | `analyses`, `scan_sessions`, `quote_files`, `wm_quote_facts`, `quote_observations`, `quote_line_items`, `county_benchmarks` | REPOSITORY_INTENT_ONLY | **NO** |
| `quote_intelligence_facts` | Absent from repository | CONTRADICTED | **NO** |
| Test/demo indicator | `leads.is_test` candidate | REPOSITORY_INTENT_ONLY | **NO** |
| PII exclusions | Names, contact data, exact address/ZIP where identifying, source text, filenames/paths, contractor raw names, raw JSON | CONFIRMED audit restriction | N/A |
| Small-cell protection | Existing source threshold `n >= 5`; not approved | INFERRED/UNAPPROVED | **NO** |
| Time/scan limits | Not supplied | UNKNOWN | **NO** |
| Applied migration evidence | None | UNKNOWN | **NO** |

**Audit 04 status: `NEEDS_SCHEMA_BINDING`.**

## Audit 05 handoff

Audit 05 must carry forward:

- Deployed-state hard stop and all SB-A03 blockers.
- Exact scan-bound full-report authorization evidence.
- Direct-RPC/Edge-boundary contradiction.
- UUID-only scan, status, and preview concerns.
- Private-bucket intent, broad write policies, filename/path privacy risk, and incomplete deletion.
- Gemini document flow and provider/logging review requirements.
- Candidate fact-table RLS and PII classifications.
- Unsafe/unbounded benchmark refresher findings.
- Hardcoded current Truth Report benchmark behavior.
- `SAFE_POST_ANALYSIS_BOUNDARY_INFERRED`.
- Data-rights, contract, and competition-law review requirements.
- `NEEDS_SCHEMA_BINDING`; no SQL or profiling authorization.
- No implementation, deployment, database, Storage, or repository change occurred.
