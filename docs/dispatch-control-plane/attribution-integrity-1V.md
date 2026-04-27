# Sprint 1V Attribution Integrity + Chapter Closeout

## Goal

Close out the Conversion / UTM / Attribution Control Plane chapter by auditing the full lineage from landing URL/query attribution through canonical event identity, dry-run mapper diagnostics, outbox materialization, simulated attempt reconciliation, and governance posture without enabling live dispatch.

## North Star

WindowMan can prove the conversion-control-plane golden thread end-to-end while keeping all dispatch paths dry-run-only, redaction-safe, and impossible to send live by accident.

## Definition of Success

- `client_slug` fallback is explicit: URL/query slug, existing storage, then `direct`.
- Standard UTMs are captured and surfaced into submit-time attribution payloads.
- Major click IDs and browser IDs are captured or represented as safe presence fields.
- Submit-time attribution calls refresh storage/cookies instead of relying on stale React hook state.
- Canonical event identity can be traced into readiness rows, dry-run rows, outbox rows, and attempt rows.
- Platform config identity can be traced by `platform_config_id`, `platform_name`, and `client_slug`.
- Mapper versions are visible in dry-run services and governance, with remaining database-label drift documented.
- Outbox rows remain `dry_run_only = true`, `send_enabled = false`, and `lifecycle_status = materialized_not_sendable`.
- Attempt simulation writes only safe dry-run ledger rows and leaves provider response fields null.
- Admin surfaces expose presence booleans, masked IDs, mapper versions, reason codes, and redacted snapshots only.
- Governance proves live dispatch disabled, kill switch engaged, and no live enable control exists.
- Phase 2 live-dispatch planning requirements are explicitly listed.

## Executive Verdict

`chapter_partially_ready_with_manual_validation`

The attribution and dispatch-control-plane architecture is connected and dry-run locked. Phase 2 planning can begin, but live alpha must not start until mapper-version labels are aligned between the frontend mapper layer and database candidate RPC, deterministic canonical `event_id` enforcement is reviewed on all source writers, and live runtime guard status is manually verified against the deployed database.

## Golden Thread Map

```text
Landing URL/query params
  → src/lib/useUtmCapture.ts
  → getAttributionPayload() fresh submit-time payload
  → leads / scan_sessions / wm_event_log attribution + query_params columns where writers populate them
  → canonical revenue event row identity
  → admin_revenue_dispatch_readiness()
  → Dispatch Dry-Run Queue / dispatchSimulator.ts
  → admin_dispatch_outbox_candidates()
  → platform_dispatch_outbox
  → platform_dispatch_attempts via admin-simulate-dispatch-attempt
  → Dispatch Governance Console / dispatchGovernance.ts
```

Field-level proof chain:

| Field | Source | Readiness / dry-run | Outbox | Attempts | Governance |
| --- | --- | --- | --- | --- | --- |
| `client_slug` | `useUtmCapture`, lead/session/event storage | readiness row + dry-run row | `platform_dispatch_outbox.client_slug` | joined via outbox | client matrix |
| `lead_id` | lead/session/event | readiness row and external ID presence | source event linkage | indirect via outbox snapshot if present | aggregate only |
| `session_id` / `scan_session_id` | scan/session event context | readiness RPC exposes `scan_session_id` | source event linkage | indirect via outbox snapshot | not a primary governance dimension |
| canonical event row ID | `event_logs.id` or `wm_event_log.id` | `event_row_id` | `canonical_event_log_id` | `outbox_id` relation | outbox health |
| canonical `event_id` | event metadata / `wm_event_log.event_id` | `event_id` / `canonicalEventId` | `canonical_event_id` | redacted request snapshot presence/masked value | readiness warnings/blockers |
| platform config ID | `client_platform_configs.id` | config summary / dry-run row | `platform_config_id` | gate preflight requires it | platform/client matrices |
| idempotency key | candidate RPC formula | candidate row | `idempotency_key` unique | joined outbox context | duplicate safety evidence |
| outbox row ID | materialization function | existing-row proof | `platform_dispatch_outbox.id` | `platform_dispatch_attempts.outbox_id` | outbox health |
| attempt row ID | simulator insert | n/a | n/a | `platform_dispatch_attempts.id` | attempt health |
| mapper version | mapper constants + candidate RPC | dry-run payload/debug + candidate row | `mapper_version` | redacted snapshot | mapper coverage panel |
| attribution/click presence | URL/cookie capture + event metadata | presence booleans | redacted payload snapshot | sanitized redacted request snapshot | warnings/readiness only |

## Attribution Capture Audit

`src/lib/useUtmCapture.ts` is present and materially matches the required control-plane behavior.

Confirmed capture:

- Standard UTMs: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`.
- Click IDs: `ttclid`, `fbclid`, `gclid`, `wbraid`, `gbraid`, `msclkid`.
- Browser / platform cookies: `_fbc`, `_fbp`, `_ttp`, exported as `fbc`, `fbp`, `ttp`.
- `fbclid` synthesizes `_fbc` when present.
- Full raw query string is stored as `raw_query_string`.
- Normalized query params are stored as `query_params`, preserving repeated keys as arrays.
- `landing_page` and path-with-query `landing_page_url` are captured without URL hash noise.
- `client_slug` fallback order is explicit: URL keys `client_slug` / `client` / `partner` / `syndicate`, then existing localStorage, then `direct`.
- `getAttributionPayload()` calls `captureUtmFromUrl()` at submit/event time, refreshing localStorage and cookies to avoid stale React closure state.

Important compatibility note:

- `getUtmPayload()` intentionally emits only legacy `leads` columns to avoid PostgREST unknown-column failures.
- Newer neutral-plane fields (`ttclid`, `wbraid`, `gbraid`, `msclkid`, `ttp`, raw query, structured attribution) belong in structured JSON columns through `getAttributionPayload()` writers.

## Database Lineage Audit

Audited migration sources show these storage paths:

- `leads`: additive `client_slug`, `query_params`, and `attribution` columns exist for first-touch URL/query and structured attribution snapshots.
- `scan_sessions`: additive `client_slug`, `query_params`, and `attribution` columns exist for scan/session propagation.
- `wm_event_log`: additive `client_slug`, `query_params`, and `attribution` columns exist for canonical event routing.
- `event_logs`: legacy canonical event source used by the Sprint 1N outbox candidate RPC; it relies on `metadata` and `lead_id` joins for attribution/client information.
- `admin_revenue_dispatch_readiness()`: reads `wm_event_log`, joins `leads` and `scan_sessions`, resolves `client_slug`, and exposes click/UTM presence booleans.
- `admin_dispatch_outbox_candidates()`: reads `event_logs`, joins `leads`, resolves client/platform config, computes idempotency, and builds redacted `decision_snapshot`.
- `platform_dispatch_outbox`: stores canonical event identity, `client_slug`, `platform_config_id`, mapper version, idempotency key, candidate fingerprint, decision snapshot, redacted payload snapshot, dry-run flags, and no-live lifecycle state.
- `platform_dispatch_attempts`: stores only outbox-linked dry-run attempt audit rows.

Acceptable before Phase 2 planning:

- Readiness and outbox candidate flows currently span `wm_event_log` and `event_logs`; this is acceptable for audit visibility but must be reconciled before live alpha.
- Some historical rows may lack `query_params`, `attribution`, or deterministic `event_id`; these should surface as warnings/blockers rather than being patched silently.

Blocks live alpha until resolved:

- Canonical event source selection must be finalized (`wm_event_log` vs `event_logs`) for the live sender.
- Every live-dispatchable source writer must guarantee non-null `client_slug` and stable `event_id`.
- Candidate RPC mapper labels must align to the approved mapper constants.

## Event Identity Audit

The current identity chain is auditable but not yet live-alpha hardened:

1. Landing/session identity is captured by URL/query, localStorage, cookies, and lead/session context.
2. `lead_id` is carried into readiness rows and used as external ID presence proof in dry-run mappers.
3. `scan_session_id` and `analysis_id` are exposed by readiness where available.
4. Canonical event row ID is the durable row anchor.
5. Canonical `event_id` is surfaced as `eventId` / `canonicalEventId`; missing values block or warn depending on layer.
6. Platform config identity is resolved through `client_slug` → `clients` → `client_platform_configs`.
7. Idempotency key formula is `wm_dispatch:v1:md5(canonical_event_log_id | canonical_event_id | platform_config_id | platform_name | client_slug)`.
8. Outbox rows store source event ID, canonical event ID, config ID, mapper version, idempotency key, and candidate fingerprint.
9. Attempt rows reference `outbox_id` and derive request hashes from redacted outbox snapshots.

Weak links documented:

- Historical or legacy source events may have fallback event IDs based on row ID.
- Governance is aggregate/read-only; it proves outbox/attempt safety but does not inspect browser runtime capture directly.
- Candidate RPC currently uses older mapper labels for several platforms, while `dispatchSimulator.ts` and governance expose the approved Sprint 1R/1S constants.

## Mapper Coverage Audit

Approved dry-run mapper constants are present in `src/services/dispatchSimulator.ts` and surfaced in the dry-run queue/governance UI:

| Platform | Expected mapper version | Status |
| --- | --- | --- |
| TikTok | `tiktok-dry-run-v1` | Present |
| Meta | `meta-capi-dry-run-v1` | Present in frontend mapper layer |
| Google Ads / GA4 | `google-ads-ga4-dry-run-v1` | Present in frontend mapper layer |
| GTM Server | `gtm-server-dry-run-v1` | Present in frontend mapper layer |
| CRM Webhook | `crm-webhook-dry-run-v1` | Present in frontend mapper layer |
| Generic Endpoint | `generic-endpoint-dry-run-v1` | Present in frontend mapper layer |

Mapper diagnostics show safe endpoint-shaped payloads with:

- platform event name,
- value/currency/value basis,
- event ID presence/masked proof,
- attribution and click-ID presence booleans,
- destination/token presence,
- warning/block reason codes,
- dry-run/debug flags.

Known mapper-label drift:

- `admin_dispatch_outbox_candidates()` still emits `meta-draft-simulation`, `google-draft-simulation`, `endpoint-draft-simulation`, and `platform-draft-simulation` for some rows.
- This was not changed in Sprint 1V because schema/RPC modification was outside the safe closeout scope.
- Phase 2 must align database candidate mapper labels with the approved constants before live alpha.

## Redaction/Privacy Audit

Checked surfaces:

- Dispatch Dry-Run Queue payload/detail drawer.
- Dispatch Outbox candidate/outbox detail drawer.
- Materialization result summary.
- Dispatch Attempt Reconciliation result/detail drawer.
- Dispatch Governance Console.

Confirmed safe patterns:

- Admin payloads use presence booleans for tokens, destinations, click IDs, and browser IDs.
- IDs are masked in table/detail summaries where appropriate.
- Materialization stores `redacted_payload_snapshot`, not raw provider payloads.
- Attempt simulator sanitizes redacted snapshots again before hashing or writing `redacted_request_snapshot`.
- Attempt hash is derived from sanitized redacted payload snapshot only.
- Provider/external response fields remain null and are labelled as provider response fields, not Edge Function HTTP responses.

Forbidden data was not intentionally exposed by the audited dry-run surfaces:

- raw tokens or Vault secret values,
- Vault secret IDs,
- raw email or phone,
- raw full `fbc`, `fbp`, `fbclid`, `ttclid`, `ttp`, `gclid`, `gbraid`, `wbraid`, or `msclkid`,
- raw IP or user agent,
- Authorization headers or bearer tokens,
- raw endpoint/webhook URLs in payload snapshots.

Manual validation still required before live dispatch:

- Inspect representative deployed rows to confirm historical `decision_snapshot` or `redacted_payload_snapshot` records do not contain raw legacy values.

## Outbox Integrity Audit

Confirmed from `platform_dispatch_outbox` schema and materialization function:

- `dry_run_only` defaults to true and is constrained true.
- `send_enabled` defaults to false and is constrained false.
- `sent_at` and `external_event_id` are constrained null.
- Worker lock and retry schedule fields are constrained null.
- `lifecycle_status` is limited to non-sendable states including `materialized_not_sendable`.
- Unique idempotency key and `(canonical_event_log_id, platform_config_id)` constraints provide duplicate protection.
- `decision_snapshot` and `redacted_payload_snapshot` are stored.
- `candidate_fingerprint` is stored.
- Materialization recomputes candidates server-side before insert.
- Preview modes write nothing.
- Materialize modes require `MATERIALIZE_DRY_RUN_ONLY`.
- Materialization inserts outbox rows only; it does not mutate source-of-truth events, leads, or outcomes.
- Result payload explicitly returns `external_apis_called: false` and `attempts_written: false`.

## Attempt Simulation Audit

Confirmed from `admin-simulate-dispatch-attempt` and reconciliation UI:

- `preview_attempt` writes nothing.
- `simulate_attempt` and `simulate_selected` require `SIMULATE_DRY_RUN_ATTEMPT_ONLY`.
- `simulate_selected` is capped at 25 outbox IDs by request schema and UI.
- Attempt statuses are limited to `simulated`, `failed_preflight`, and `blocked_by_gate` at the service/UI level.
- Database check allows only non-sending statuses and dry-run rows.
- `response_status_code` and `response_excerpt` are always inserted as null and protected by database guard.
- `request_payload_hash` is computed from sanitized redacted snapshot data only.
- Outbox rows are not updated by simulation.
- Attempt counts in the UI are derived from `platform_dispatch_attempts`, not trusted from outbox metadata.
- Result payload returns `external_apis_called: false`, `outbox_rows_updated: false`, and provider response counts as zero.

## Governance Audit

Sprint 1U governance is present:

- `src/components/admin/DispatchGovernanceConsole.tsx` exists.
- `src/services/dispatchGovernance.ts` exists.
- `docs/dispatch-control-plane/governance-1U.md` exists.

Confirmed governance posture:

- `liveDispatchEnabled: false`.
- `dryRunRequired: true`.
- `killSwitchEngaged: true`.
- `externalDispatchWorkersEnabled: false`.
- `canSendExternally: false`.
- `futureLiveMigrationRequired: true`.
- Platform matrix exists.
- Client matrix exists.
- Guard status panel exists.
- Future live requirements are visible.
- No live enable button or sender control exists.
- Governance derives outbox and attempt health from loaded database rows.

Governance limitations:

- Guard status is source-audit proof from migrations, not live database introspection.
- Browser attribution capture is marked manual review because governance does not execute a browser/session test.
- No provider token validation or endpoint health check is performed.

## Known Gaps Before Live Dispatch

Blockers for live alpha:

- Align database candidate mapper labels to `meta-capi-dry-run-v1`, `google-ads-ga4-dry-run-v1`, `gtm-server-dry-run-v1`, `crm-webhook-dry-run-v1`, and `generic-endpoint-dry-run-v1`.
- Select one canonical live event ledger and reconcile `wm_event_log` versus `event_logs` usage.
- Enforce deterministic `event_id` generation for every live-dispatchable source event.
- Prove all live-dispatchable events have non-null, tenant-resolved `client_slug`.
- Perform deployed database guard introspection before relaxing any dry-run constraints.
- Add provider-specific sender only in a later approved live-dispatch sprint.

Warnings / manual validation:

- Historical records may lack attribution JSON, query params, true margin data, or event IDs.
- Readiness uses presence booleans and does not prove match-quality success against provider APIs.
- Endpoint-backed configs validate URL shape/presence but do not perform health checks or DNS probes.
- Governance proves no-send posture, not provider readiness.

## Phase 2 Entry Criteria

Before live dispatch alpha:

- Governance console remains complete and visible to internal operators.
- DB guard status is verified against the deployed database, not only migration source.
- A live migration design is reviewed and approved, including how dry-run guards are intentionally relaxed.
- Exactly one provider sender is selected for first alpha.
- Token validation and rotation strategy is defined without exposing secrets.
- Retry, locking, idempotency, and dead-letter design is finalized.
- Provider test-event plan is defined using sandbox/test modes where available.
- Rollback plan and emergency disable/kill-switch path are documented.
- Monitoring and alerting plan is defined for sends, retries, response classes, duplicates, and data leakage.
- Redaction rules for provider responses are provider-specific and approved.
- Deterministic event ID and tenant resolution are enforced at source writers.
- Runtime QA proves no raw PII/click IDs/tokens/endpoint URLs appear in admin-visible payloads.

## No External Dispatch Proof

Sprint 1V did not add or run any live dispatch worker, retry worker, scheduler, provider SDK, GTM Server sender, CRM webhook sender, or endpoint client.

Audited dry-run code paths call only Supabase reads/invocations for internal admin functionality:

- `admin_revenue_dispatch_readiness()` is read-only.
- `admin_dispatch_outbox_candidates()` is read-only.
- `admin-materialize-dispatch-outbox` recomputes candidates and inserts dry-run outbox rows only.
- `admin-simulate-dispatch-attempt` reads outbox rows and optionally inserts dry-run attempt rows only.
- Governance reads configs, outbox rows, and attempt rows.

No Meta, TikTok, Google, GTM Server, CRM webhook, generic endpoint, browser pixel conversion, DNS probe, or external platform API was called by this sprint.

## Final Chapter Closeout

The chapter is ready for Phase 2 planning, not live dispatch. The golden thread is visible from URL/query capture through governance, the dry-run materialization and attempt simulation layers are guarded, and admin-visible payloads are designed to be redaction-safe. Phase 2 must begin with alignment and runtime proof work before any provider sender exists.