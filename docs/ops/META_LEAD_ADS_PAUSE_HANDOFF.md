# Meta Lead Ads pause handoff

Recorded: 2026-09-23. Status: PAUSED at the user's request.

This is a preservation and continuation record, not implementation or deployment
authorization. The next session must not automatically configure secrets, invoke
workers, activate schedules, or start vendor tests.

## Reviewed implementation and backup boundary

- Canonical checkout: `C:\Projects\wm-mvp-github-clean`.
- Branch: `codex/meta-lead-ads-launch`.
- Reviewed implementation checkpoint: `cf83ab9d571e856bef1860c8ddbb22f3c2fff4e8`.
- Existing verified origin: `https://github.com/Mongoloyd/wm-mvp.git`.
- Production target: `zgsofkgddpcntdvpckdq`, displayed as `forensic_report_v1`.
- Only this document is authorized for the preservation commit. Do not amend the
  implementation commit, change source, create a PR, merge, rebase, tag, or deploy.
- Git preserves the implementation and this note; it is not a production database
  backup and does not preserve production secret values.

### Fresh checks made during this preservation task

The checkout root, branch, and initial HEAD matched the values above. Staged,
unstaged, and untracked sets were empty. The worktree inventory contained this
branch only at the canonical checkout. Origin fetch and push URLs matched the
repository documented in the README.

The first remote lookup failed to connect in the restricted execution environment.
A network-permitted lookup then reached GitHub and returned exit code 2 for the
exact branch, establishing that the branch was absent, not merely missing from a
local tracking ref. A separate origin HEAD lookup succeeded. No credentials or
remote configuration were changed.

The authorized normal push is to this same origin and branch only. Its final
backup receipt is reported after the documentation commit: independently compare
the remote branch SHA with local HEAD and verify the reviewed checkpoint remains
an ancestor. Do not infer backup success from this note or a missing/present local
tracking ref. Recheck those facts when resuming.

No current production metadata, secrets, database state, subscriptions, or
schedules were inspected during this preservation task. Production facts below
are historical verification receipts from the preceding work, not fresh claims.

## Historical production verification receipts

| Area | Recorded result | Scope of proof |
| --- | --- | --- |
| Mapping prerequisite | `POST_REPAIR_PASS`; mapping migration `20260904090400` recorded once and `field_mapping_overrides` contract verified | Prerequisite/history repair was completed before package application |
| Meta schema application | `SCHEMA_APPLY_PASS` for `20260922200843`; no catalog failures | 9 package tables, 19 package functions; 10 table, 19 function, 12 index, and 2 sequence contracts checked |
| Separate ledger recording | `LEDGER_RECORD_PASS`; Meta history count 1 | Dashboard-applied schema was separately recorded in migration history |
| Read-only post-application check | `CURRENT_STATE_PASS_COMPARE_RECEIPTS`; Meta, mapping, and freeze history counts each 1 | All five recorded preservation fingerprints matched across application, ledger, and verification receipts |
| Contractor freeze | Function body inspected as inert; both branches returned the row with no writes or enqueue; trigger binding preserved | Freeze function/trigger and freeze migration `20260716165508` were not modified by package deployment |
| Function deployment | All five scoped functions deployed and accepted | `process-meta-outbox`, `process-meta-lead`, `meta-intake-replay`, `admin-data`, `import-facebook-lead-ad` |
| Importer acceptance | `ACTIVE`, version 58, `verify_jwt=false`; deployment exit 0; source comparison PASS against the reviewed checkpoint | PUT rejection 405 and unauthenticated POST rejection 401; other 46 function metadata records unchanged at that deployment check |
| Verify-token runtime check | Correct token: 200 with exact challenge match; wrong token: 403 with expected verification error | `CHALLENGE_ONLY_VERIFICATION_PASS`; no lead processing |
| App Secret runtime check | Wrong signature: 401/unauthorized; correct signature: 200 | Followed by the scoped receipt verification below; `APP_SECRET_VALIDATION_PASS` |

Recorded migration source SHA-256:
`5fdbb16859587534317d47370b07265fa3b79586040cc939c04fd3ae6572c0a4`.

Recorded importer bundle SHA-256 at version 58:
`674eaac1724b5ad31efa36e282568867a2b4c962e49ef8526a31dc0bc95bb484`.

Earlier uniform function version increments were reconciled with unchanged source,
IDs, and JWT settings. The association with the two secret saves was strongly
corroborated, not direct causal proof. Do not equate a version counter change alone
with a source change, or claim current metadata without rechecking it.

### Successful signed-POST receipt verification

One authorized read-only production query scoped to the two synthetic payload
hashes returned:

- Incorrect-signature receipt count: 0.
- Correct-signature receipt count: exactly 1.
- `global_test_mode`: true.
- Receipt status: `pending`.
- Processing attempts: 0; processing timestamp and lease fields unset.
- Associated `meta_lead_inbox` row count: 0.
- Combined row-verification result: true.

The synthetic receipt was intentionally retained. Do not delete it or replay it
without authorization. The old all-package-tables-empty assertion is no longer an
appropriate expectation after this successful persistence test. A persisted empty
receipt does not prove Graph retrieval, canonical lead creation, CRM visibility,
automatic intake, or vendor delivery.

## Last reported operating state; not freshly rechecked

- `META_GHL_DELIVERY_ENABLED`, `META_CRM_FEEDBACK_ENABLED`, and
  `META_CRM_LIVE_SEND_ENABLED` were absent: outbound lanes remained disabled.
- `META_CRM_TEST_EVENT_CODE` was absent. The differently named
  `META_TEST_EVENT_CODE` already existed and was left untouched.
- `META_WEBHOOK_TEST_MODE` was absent; the reviewed importer defaults to test mode
  unless explicitly set to false. The verified receipt captured true.
- `META_APP_SECRET` and `META_WEBHOOK_VERIFY_TOKEN` were the two configured and
  runtime-validated credentials. Do not replace or disclose them.
- `FACEBOOK_LEAD_AD_IMPORT_SECRET` was last reported absent; native signed intake
  does not require enabling the separate trusted-import path.
- No Meta package or contractor schedule activation was reported. This is not a
  claim that unrelated project schedules do not exist.
- No authorized worker processing, Meta Graph lead retrieval, GHL delivery, or
  CRM CAPI send was reported. Earlier worker rejection probes were not successful
  processing runs. Paid traffic remains deferred.

## Configuration and behavior still unverified or incomplete

- Worker configuration was assessed only; no configuration packet was executed.
  Provisioning/runtime validity of `META_WORKER_SECRET`, `META_PAGE_ACCESS_TOKEN`,
  and `META_GRAPH_API_VERSION` remain unverified. The Graph version has no default;
  a version string in a mocked test is not a current compatibility guarantee.
- Current Meta permission requirements, Page lead-access assignment, token
  lifetime/validity, selected supported Graph version, and actual app/Page
  subscriptions require separately authorized verification.
- Dedicated test Page/Form identifiers, approved intake/forms, mapping revisions,
  and form/disclosure-linked consent rules are not established by the credential
  tests. Consent approval must predate the receipt being tested.
- No real client GHL location/token is established. GHL must not block local
  development or the goal of independent Facebook-to-WindowMan intake.
- CRM feedback uses client-scoped dataset/token configuration via the existing
  database/Vault resolver; it does not inherit global website CAPI credentials.
  That client configuration and Meta Test Events acceptance remain unverified.
- Scheduler Vault bindings and authenticated processing remain unverified. Secret
  presence, deployment, authentication, persistence, and automated operation are
  separate proof domains.
- Test mode marks eligible intake as test data and prevents outbound qualification
  work; it does not suppress Graph calls by an invoked intake worker.
- The intake worker claims batches, not a single specified marker. Any future
  invocation needs an authorized queue review; it is not a read-only auth probe.

## Source-confirmed dependencies to review first next session

These are current implementation constraints, not proposed policy to preserve.

1. **Live intake is coupled to a GHL-bearing destination.**
   `supabase/migrations/20260922200843_meta_lead_ads_launch.sql:85` requires every
   `meta_form_destinations` row to have a client slug and nonempty location ID.
   At line 459, receipt completion uses an active, approved destination to admit
   non-test forms in live mode. Unapproved identifiers are quarantined. Global
   test mode permits test processing without that live destination. Review the
   smallest separation of approved Meta intake from downstream CRM destinations;
   never fabricate a GHL location ID to satisfy this contract.
2. **Scheduling is combined.** At migration line 1103,
   `meta_activate_worker_schedules()` requires both worker URLs and the shared
   worker secret in Vault and creates both `meta-lead-inbox-v1` and
   `meta-lead-outbox-v1`. The companion deactivation function also handles both.
   There is no intake-only activation option in that reviewed function. Review a
   narrowly scoped intake-only scheduling change before automatic intake; do not
   run the combined activation as an improvised workaround.
3. **Qualification currently drives outbound job creation.** The package's
   `meta_queue_qualification` path and outbox implement qualified-only delivery.
   This existing mechanism is not acceptance of future automatic contractor
   distribution policy. Keep outbound disabled until policy and implementation
   are separately approved.

## Existing local evidence directories

The following directory paths were confirmed to exist during preservation. Their
contents were not bulk-copied into Git or treated as a fresh production audit.

- `C:\Users\Dell\Documents\WindowMan\verification\meta-lead-ads\2026-09-22-7dd35fdd\checkpoint-records`
- `C:\Users\Dell\Documents\WindowMan\verification\meta-lead-ads\2026-09-22-7dd35fdd\evidence`
- `C:\Users\Dell\Documents\WindowMan\verification\meta-lead-ads\2026-09-22-7dd35fdd\staging-audit-records`
- `C:\Users\Dell\Documents\WindowMan\verification\meta-lead-ads\2026-09-23-production-packet`

Historical staging-oriented folder names do not prove the target was staging.
The recorded production target above is authoritative for the supplied receipts.
These are machine-local evidence locations, not Git-backed evidence or a database
backup. Do not upload their contents without a separate sanitized review.

## Future sprint boundaries; no implementation authorized here

### Next: finish Facebook to WindowMan

Complete reliable ingestion into the canonical WindowMan database and existing CRM
independently of any GHL account. First review the smallest intake/destination and
intake-only scheduling changes described above. Then, under separate approvals,
complete Meta configuration, forms/mappings/consent, subscription setup, controlled
testing, and automatic intake.

Completion requires real lead persistence, attribution, existing CRM visibility,
duplicate/retry handling, and test isolation. A successful webhook receipt or a
test-isolated smoke run alone is not completion.

### Subsequent: reusable GHL onboarding

Review and complete the existing adapter/onboarding infrastructure without client
credentials being required for local development and tests. Actual connection
verification and vendor delivery stay pending until a real approved client account
is available.

### Separate: operator-controlled contractor delivery

Design deliberate recipient selection, an appropriate contractor packet, delivery
and sales-outcome recording, and later routing to another recipient when eligible.
Preserve original lead identity and delivery history. Do not assume automatic
redistribution, simultaneous distribution, or qualification-triggered delivery is
the desired business policy.

## Next-session starting instruction

Read this handoff and the repository instructions; verify the branch, clean state,
remote backup, and reviewed-checkpoint ancestry. Begin with a read-only review of
the smallest change separating approved Meta intake from GHL destinations and
allowing intake-only scheduling. Present that bounded change for explicit approval.
Do not resume the older worker-secret-first sequence automatically. Do not change
production, credentials, subscriptions, schedules, or the frozen contractor queue.
