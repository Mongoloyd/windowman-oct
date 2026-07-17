# Native-Lead Atomic RPC Runbook

Status: **local implementation only — no remote installation authorized**

Migration:
`supabase/migrations/20260716134535_native_lead_atomic_rpc.sql`

Durable test:
`supabase/tests/upsert_native_lead_with_attribution.test.sql`

## Safety boundary

- Never run this packet against production or a linked Supabase project without
  a separate installation approval.
- Never use `supabase db push`, `supabase link`, `supabase migration repair`, or
  an Edge Function deploy command for this review.
- The RPC is server-only. Browser, `anon`, and `authenticated` callers must not
  receive `EXECUTE`.
- The RPC does not emit paid-media, CAPI, GTM, conversion, routing, assignment,
  delivery, dispatch, or contractor-handoff events.
- Edge Function integration remains a separate, unapproved change.

## Current compatibility hard stop

Global homeowner identity is implemented as approved: phone/email matching is
not scoped by `client_slug`, new leads use `direct`, and an existing lead keeps
its current slug.

Repository evidence also shows that `leads.client_slug` is not merely passive
legacy metadata:

- `resolve_route_for_lead()` resolves delivery from the lead's slug.
- `trg_fire_crm_handoff` snapshots that slug when a later phone-verification /
  analysis transition queues delivery.
- downstream analyses and opportunities inherit the lead slug.
- contractor release access requires assignment, contractor, and lead slugs to
  agree.

The RPC does not cause those transitions and does not mutate routing state, so
ingestion itself cannot dispatch a lead. However, a globally matched lead that
already has a non-`direct` slug can later follow that historical client's route
when another authorized workflow changes verification/analysis state.

**Do not authorize remote installation until the product owner explicitly
accepts this preserve-and-later-route behavior or a separately reviewed
downstream routing decoupling is complete.** Do not solve the conflict by
reintroducing tenant-scoped deduplication.

## Request and response contract

Call:

```sql
SELECT *
FROM public.upsert_native_lead_with_attribution(
  p_lead := '{}'::jsonb,
  p_attribution := '{}'::jsonb
);
```

Response columns:

```text
lead_id uuid
attribution_id uuid
duplicate boolean
resolution_status text
review_required boolean
```

Required input:

- both arguments are JSON objects;
- `p_attribution.raw_payload` is an object;
- platform is `meta`, `google`, `nextdoor`, or `tiktok`;
- `facebook` is accepted only as an existing legacy attribution replayed by an
  incoming `meta` request;
- `platform_lead_id` is nonblank and at most 255 characters;
- at least one normalized email or strict E.164 phone is present;
- `session_id` is required only when the call must create a lead.

Input bounds:

- `p_lead`: 256 KiB;
- entire `p_attribution`: 256 KiB;
- `raw_payload`: 1 MiB (checked first so its stable error remains observable);
- provider IDs: 255 characters;
- campaign/ad/adset names and source details: 500 characters;
- UTM/click identifiers: 1,000 characters;
- landing/referrer/path values: 2,048 characters;
- custom answers: 50 entries, 120-character keys, 2,000-character scalar
  strings.

Identity keys are rejected when oversized and are never truncated.

## Resolution states

- `provider_replay`
- `matched_both`
- `matched_phone`
- `matched_email`
- `phone_priority_soft_conflict`
- `email_priority_soft_conflict`
- `ambiguous_created`
- `created`
- `dedup_suppressed_created`

Provider identity locks first, then eligible phone, then eligible email. Lead
rows are locked in UUID order. A unique phone wins a split identity; email is
the fallback only when there is no unique phone winner.

## Fake-contact behavior

The RPC mirrors `src/utils/screenPhone.ts` for dedup eligibility:

- explicit blocked numbers;
- invalid NANP area/exchange shape;
- ascending/descending sequences;
- repeated digits;
- `555` exchanges;
- toll-free prefixes.

Email dedup suppression covers `test@test.com` and the `example.com`,
`example.net`, and `example.org` domains.

Suppressed identities are still captured. They do not participate in identity
matching, set `review_required=true`, and record suppression evidence.

## Enrichment and metadata

Matched leads and provider replays fill only missing/blank safe tracking
fields. Existing nonblank tracking values, canonical phone/email, existing
`client_slug`, OTP state, report state, status, scoring, assignment, and routing
state are preserved.

The latest accepted provider replay replaces `raw_payload`. Tracking identifiers
without attribution-table columns (`ttclid`, `msclkid`, `wbraid`, `gbraid`) are
also retained in `qualification_answers_json.native_lead.tracking`.

Reserved and control-plane metadata keys are compared with
`lower(btrim(key))`. Ignored evidence contains normalized key names only, never
submitted values.

## Stable validation and retry errors

All validation failures use SQLSTATE `22023`. Stable messages include:

```text
invalid_p_lead
invalid_p_attribution
p_lead_too_large
p_attribution_too_large
invalid_raw_payload
raw_payload_too_large
invalid_source_platform
missing_platform_lead_id
platform_lead_id_too_long
session_id_too_long
invalid_email
invalid_phone_e164
missing_identity
invalid_received_at
invalid_platform_created_time
invalid_imported_at
first_name_too_long
last_name_too_long
zip_too_long
county_too_long
source_channel_too_long
source_detail_too_long
provider_field_id_too_long
provider_field_name_too_long
tracking_field_too_long
url_field_too_long
invalid_native_lead_metadata
invalid_native_lead_namespace
custom_answers_too_many_entries
custom_answer_key_too_long
custom_answer_value_too_long
missing_session_id
selected_lead_missing
```

Unexpected attribution races use SQLSTATE `40001`:

```text
attribution_race_retry
attribution_lead_mismatch
```

The trusted caller must retry the entire RPC transaction on `40001`. The
function never manually deletes a losing lead; transaction rollback prevents a
partial lead/attribution commit.

## Read-only preflight

Run before any approved installation and save the complete result:

```sql
WITH target AS (
  SELECT p.oid, p.proowner, p.prosecdef, p.proconfig, p.proacl
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'upsert_native_lead_with_attribution'
    AND p.proargtypes = '3802 3802'::oidvector
),
expanded_acl AS (
  SELECT
    t.oid,
    COALESCE(r.rolname, 'PUBLIC') AS grantee,
    acl.privilege_type,
    acl.is_grantable
  FROM target AS t
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(t.proacl, pg_catalog.acldefault('f', t.proowner))
  ) AS acl
  LEFT JOIN pg_catalog.pg_roles AS r ON r.oid = acl.grantee
)
SELECT
  (SELECT count(*) FROM target) AS function_exists,
  (SELECT pg_catalog.pg_get_functiondef(oid) FROM target) AS definition,
  (SELECT pg_catalog.md5(pg_catalog.pg_get_functiondef(oid)) FROM target) AS definition_md5,
  (SELECT pg_catalog.pg_get_userbyid(proowner) FROM target) AS owner,
  (SELECT prosecdef FROM target) AS security_definer,
  (SELECT proconfig FROM target) AS function_config,
  (SELECT proacl FROM target) AS raw_acl,
  (
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'grantee', grantee,
        'privilege', privilege_type,
        'is_grantable', is_grantable
      )
      ORDER BY grantee, privilege_type
    )
    FROM expanded_acl
  ) AS expanded_acl,
  (
    SELECT pg_catalog.has_function_privilege(
      'anon', oid, 'EXECUTE'
    ) FROM target
  ) AS anon_execute,
  (
    SELECT pg_catalog.has_function_privilege(
      'authenticated', oid, 'EXECUTE'
    ) FROM target
  ) AS authenticated_execute,
  (
    SELECT pg_catalog.has_function_privilege(
      'service_role', oid, 'EXECUTE'
    ) FROM target
  ) AS service_role_execute;
```

When absent, this returns one row with `function_exists=0` and NULL privilege
columns.

## Effective execution-role isolation

Direct ACLs are asserted by the migration. This read-only query additionally
detects direct, PUBLIC, or inherited effective execution for unexpected
non-superuser roles:

```sql
WITH target AS (
  SELECT p.oid, p.proowner
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = pg_catalog.to_regprocedure(
    'public.upsert_native_lead_with_attribution(jsonb,jsonb)'
  )
)
SELECT
  r.rolname,
  r.rolinherit,
  pg_catalog.pg_get_userbyid(t.proowner) AS function_owner,
  pg_catalog.has_function_privilege(r.oid, t.oid, 'EXECUTE') AS effective_execute
FROM target AS t
CROSS JOIN pg_catalog.pg_roles AS r
WHERE NOT r.rolsuper
  AND r.oid <> t.proowner
  AND r.rolname <> 'service_role'
  AND pg_catalog.has_function_privilege(r.oid, t.oid, 'EXECUTE')
ORDER BY r.rolname;
```

Expected result: zero rows. Owner and superuser capabilities are unavoidable
and reviewed separately.

## Environment targeting

See [SUPABASE_ENVIRONMENT_REGISTRY.md](../ops/SUPABASE_ENVIRONMENT_REGISTRY.md).

- **LIVE_ACTIVE** is `zgsofkgddpcntdvpckdq` — the only project receiving current
  leads. Do not treat `wkrc…` (WMProd) or `aqypt…` (empty V2 preview) as live.
- This RPC migration is **not installed on live** unless separately authorized.
- Phase 0A was applied directly on live (~2026-07-16) but is not yet in that
  project's migration ledger; ledger debt and native-lead installation are
  separate concerns.
- Never run broad `supabase db push` against live or legacy parent until
  migration history is reconciled.

## Local installation and tests

Use a disposable local database created from the repository migration chain at
`127.0.0.1`. Never substitute a linked project. Every CLI command must include
`--local` for local work.

Reset the disposable stack (confirm URL shows `127.0.0.1` before running):

```powershell
npx supabase status
npx supabase db reset --local --no-seed --yes
```

Apply pending local migrations if needed:

```powershell
npx supabase migration list --local
npx supabase migration up --local
```

Run the isolated native-lead pgTAP file:

```powershell
npx supabase test db supabase/tests/upsert_native_lead_with_attribution.test.sql --local
```

Run the full local pgTAP suite:

```powershell
npx supabase test db --local
```

### Local-only authentication for concurrency tests

The suite's second plan opens **two real PostgreSQL connections** via
`extensions.dblink_connect` with the disposable stack's default local
credentials. The connection target is `inet_server_addr()`, not `127.0.0.1`:
local Supabase `pg_hba.conf` trusts loopback, and PostgreSQL rejects
non-superuser dblink to trust-authenticated hosts even when a password is
present in the connection string. The server address on the Docker network
requires SCRAM, which satisfies dblink's non-superuser credential rules.

This uses password authentication — not `dblink_connect_u`, which remains
superuser-only and is not granted to the `supabase test db --local` runner.

Do not copy local connection strings to remote environments. Never read linked-
project passwords or print credentials in logs.

### Two-connection concurrency design

Functional assertions (plan 1) run inside an outer transaction that rolls back
DDL and fixture rows. `TRUNCATE` there would hold table locks and block concurrent
sessions, so concurrency coverage lives in a **separate transaction** (plan 2).

Plan 2:

1. Opens named dblink sessions `nlrpc_a` and `nlrpc_b` to the same local DB.
2. Seeds split phone/email owner rows through connection A.
3. Fires asynchronous RPC calls on both connections with reversed JSON key order.
4. Connection A holds an advisory workload (~2s) so B contends on the same identity.
5. Asserts both resolve to phone-priority soft conflict, same lead UUID, two
   attributions, zero orphan leads — then cleans up via dblink and rolls back.

The suite uses one pgTAP plan (56 assertions) declared outside rolled-back
transactions so functional rollback does not reset TAP state:

- 47 functional/security/catalog assertions, rolled back;
- 9 real two-connection concurrency assertions (including TCP-host guard),
  with explicit remote-session cleanup and a final rollback.

## Same-transaction recovery

If the installation transaction reports an assertion failure before `COMMIT`,
run exactly:

```sql
ROLLBACK;
```

## Post-commit reversal

If the preflight proved the exact function was absent:

```sql
BEGIN;
DROP FUNCTION public.upsert_native_lead_with_attribution(jsonb, jsonb);
COMMIT;
```

If the function existed before installation, stop. Do not reverse until the
saved exact definition, owner, ACL, function configuration, and MD5 are
available. Restoration must recreate that saved definition and ownership/ACL
exactly; a generic `DROP FUNCTION` is not a safe reversal.

## Read-only post-install verification

```sql
SELECT
  p.oid::regprocedure AS function_signature,
  pg_catalog.pg_get_function_result(p.oid) AS result_shape,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config,
  p.proacl AS raw_acl,
  pg_catalog.pg_get_userbyid(p.proowner) AS owner,
  pg_catalog.md5(pg_catalog.pg_get_functiondef(p.oid)) AS definition_md5
FROM pg_catalog.pg_proc AS p
WHERE p.oid = pg_catalog.to_regprocedure(
  'public.upsert_native_lead_with_attribution(jsonb,jsonb)'
);

SELECT
  i.indexrelid::regclass AS index_name,
  i.indisunique,
  i.indisvalid,
  i.indisready,
  i.indnkeyatts,
  i.indnatts,
  pg_catalog.pg_get_indexdef(i.indexrelid) AS index_definition,
  pg_catalog.pg_get_expr(i.indpred, i.indrelid, true) AS predicate
FROM pg_catalog.pg_index AS i
WHERE i.indrelid = 'public.lead_attribution_details'::regclass
  AND i.indisunique;

SELECT
  c.conname,
  c.convalidated,
  pg_catalog.pg_get_constraintdef(c.oid, true) AS definition
FROM pg_catalog.pg_constraint AS c
WHERE c.conrelid = 'public.lead_attribution_details'::regclass
  AND c.contype = 'f';
```

## Deferred identity indexes

Global candidate lookup currently evaluates:

```sql
btrim(leads.phone_e164)
lower(btrim(leads.email))
```

No identity index is added by this migration. At scale, these expressions may
scan `leads`; measure plans and volume before proposing expression indexes in a
separate reviewed migration.

## Edge Function and measurement status

- `ingest-native-lead` is not changed and does not call this RPC yet.
- `import-facebook-lead-ad` is not changed.
- Existing native-lead operational event names remain Edge Function-owned.
- The RPC emits no CAPI, GTM, paid-media, conversion, dispatch, assignment, or
  handoff event.
- A future adapter must call the RPC with `service_role`, retry SQLSTATE
  `40001`, and preserve existing event ownership.
