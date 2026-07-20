# Supabase LIVE_ACTIVE Verification

Verify **LIVE_ACTIVE** Supabase (`zgsofkgddpcntdvpckdq`) is safe and schema-complete **before** wiring React V2 routes or running live funnel smoke.

> **Operational role note:** Filename and headings retain legacy **staging** wording. Per [SUPABASE_ENVIRONMENT_REGISTRY.md](../ops/SUPABASE_ENVIRONMENT_REGISTRY.md): **`zgsofkgddpcntdvpckdq` = LIVE_ACTIVE** (default Forensic V2 remote target). **`wkrcyxcnzhwjtdpmfpaf` = LEGACY_PARENT** (forbidden unless explicitly authorized).

**Do not modify** migrations, RLS, storage policies, or Edge Function source during verification-only work.

---

## Operator blockers (before runtime QA)

- [ ] Create `.env.local` from [`.env.example`](../../.env.example).
- [ ] Fill with **LIVE_ACTIVE** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (`zgsofkgddpcntdvpckdq`).
- [ ] Confirm project ref is **not** LEGACY_PARENT `wkrcyxcnzhwjtdpmfpaf`.
- [ ] Confirm LIVE_ACTIVE migrations match `main` (see checklist below).
- [ ] Confirm Twilio, Gemini/scanner, and other Edge Function secrets exist on LIVE_ACTIVE before real OTP/`scan-quote` smoke tests.

**Do not run** `npm run typegen` / `npm run typegen:check` against LEGACY_PARENT — current scripts target LIVE_ACTIVE (`zgsofkgddpcntdvpckdq`) per [`package.json`](../../package.json).

---

## LIVE_ACTIVE target

| Item | Local CLI config | LIVE_ACTIVE (operator) |
|------|------------------|------------------------|
| Project ref in `supabase/config.toml` | `wm-mvp-forensic-v2-local` (local Docker namespace) | **`zgsofkgddpcntdvpckdq`** — see [SUPABASE_TARGETING.md](../ops/SUPABASE_TARGETING.md) |
| `package.json` typegen | Targets LIVE_ACTIVE ref | `zgsofkgddpcntdvpckdq` |
| Frontend env | N/A | `.env.local` LIVE_ACTIVE URL + anon key |

Hostname check: `VITE_SUPABASE_URL` should be `https://zgsofkgddpcntdvpckdq.supabase.co` and must **not** contain `wkrcyxcnzhwjtdpmfpaf` unless intentionally testing legacy parent (not recommended).

---

## Canonical data path

```
Storage bucket `quotes` (private)
  → table `quote_files` (metadata: storage_path, lead_id, status)
  → table `scan_sessions` (per upload; status machine)
  → Edge Function `scan-quote`
  → table `analyses` (canonical; preview_json + full_json)
```

**Naming correction (mandatory):**

- Storage bucket id: **`quotes`**
- Database table: **`quote_files`**
- There is **no** `quote_files` bucket. Do not conflate bucket and table names in runbooks or code reviews.

---

## Tables to verify

### `leads`

| Check | Expected |
|-------|----------|
| Table exists | `public.leads` |
| RLS enabled | Yes |
| Client insert | Constrained anon insert (`leads_anon_insert_constrained`) — OTP fields false on insert |
| Funnel writes | Prefer Edge Functions with service role: `capture-truth-gate-lead`, `start-upload-scan-session` |
| `client_slug` | NOT NULL on creation (fallback chain documented in claude.md / AGENTS.md) |

### `quote_files`

| Check | Expected |
|-------|----------|
| Role | Metadata row linking `storage_path` → object in `quotes` bucket |
| Anon SELECT | **Denied** (dropped in migration `20260319224422`) |
| Anon INSERT | Allowed (write-only for clients) |
| Reads | Service role / Edge Functions only |

### `scan_sessions`

| Check | Expected |
|-------|----------|
| FK | `quote_file_id` (unique), `lead_id` |
| Anon SELECT | **Denied** — status only via RPC `get_scan_status` |
| Anon INSERT | Allowed with `user_id IS NULL` for anonymous funnel |
| Status values | See RPC polling + `scan-quote` terminals below |

**Status drift risk:** Frontend [`useScanPolling.ts`](../../src/hooks/useScanPolling.ts) treats `error`, `failed`, `unreadable` as terminal. DB CHECK constraint in early migrations may list a narrower set — verify on staging DB if inserts/updates fail.

### `analyses` (canonical)

| Check | Expected |
|-------|----------|
| Written by | `scan-quote` (service role upsert on `scan_session_id`) |
| Client direct SELECT | **Denied** for anon — use RPCs |
| Preview exposure | `get_analysis_preview` — no `full_json`, no `flags` array |
| Full exposure | `get_analysis_full` — after OTP gate only |

### `quote_analyses` (legacy — do not wire V2 here)

| Check | Expected |
|-------|----------|
| Status | **Legacy / audit-only** unless grep proves active writes |
| Current `scan-quote` | Writes to **`analyses`**, not `quote_analyses` |
| RLS | `quote_analyses_service_role_all` (service role only) |
| V2 rule | **Do not** read or write `quote_analyses` in V2 funnel without explicit repo proof (migration + live code path) |

---

## Storage: bucket `quotes`

| Check | Expected |
|-------|----------|
| Bucket id | `quotes` |
| Visibility | **Private** (not public) |
| Anonymous upload | Allowed via Supabase Storage SDK from browser (anon key) |
| Path pattern | `{session_id}/{timestamp}_{filename}` (see UploadZone) |
| Public read/list | **Forbidden** — no public URLs for quote PDFs |
| Download for scan | `scan-quote` uses service role + signed download |

Forbidden behaviors:

- Public bucket or anon read policy on `storage.objects` for download
- Exposing `full_json` or full `flags` via preview RPC or client-side preload
- CSS/DOM hiding as substitute for backend gating

---

## SECURITY DEFINER RPCs

Run on staging (SQL editor or `psql`):

```sql
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname IN ('get_scan_status', 'get_analysis_preview', 'get_analysis_full');
```

### `get_scan_status(p_scan_session_id uuid)`

- Returns: `id`, `status` only
- Migration: `20260318112259_7a111b45-4d4b-4ce9-ac6e-1409cf114ceb.sql`
- Client: [`reportService.fetchScanStatus`](../../src/services/reportService.ts), [`useScanPolling`](../../src/hooks/useScanPolling.ts)

### `get_analysis_preview(p_scan_session_id uuid)`

- Returns: `analysis_id`, `grade`, flag **counts**, `proof_of_read`, `preview_json`, `confidence_score`, `document_type`, `rubric_version`
- Does **not** return: `full_json`, `flags` array
- Latest shape includes `analysis_id`: `20260420000000_add_analysis_id_to_analysis_rpcs.sql`

### `get_analysis_full(p_scan_session_id uuid, p_phone_e164 text)`

- Authoritative gate: `20260428120000_restore_get_analysis_full_strict_scan_binding.sql`
- Requires: `phone_verifications` verified row bound to `scan_session_id` + `leads.phone_verified = true`
- Unauthorized: single row with `grade = '__UNAUTHORIZED__'` (not a Postgres error)
- Explicit `GRANT EXECUTE` to `anon, authenticated` in that migration

**Uncertainty to verify on staging:** `get_analysis_preview` and `get_scan_status` may rely on default execute grants — confirm anon can call them.

---

## Edge Functions (presence + config)

Verify deployed on staging (Dashboard → Edge Functions). **Do not change source** during verification.

| Function | Role | Browser calls? |
|----------|------|----------------|
| `capture-truth-gate-lead` | Truth Gate intake → `leads` | Yes |
| `start-upload-scan-session` | After storage upload → `quote_files` + `scan_sessions` | Yes |
| `scan-quote` | Scanner brain → `analyses` | Yes |
| `send-otp` | Twilio Verify + `phone_verifications` | Yes |
| `verify-otp` | Verify + update `leads` + canonical events | Yes |
| `capi-event` | Meta CAPI server bridge | **No** (server-side only) |

[`supabase/config.toml`](../../supabase/config.toml): funnel functions use `verify_jwt = false` (public invoke with anon key + body validation).

### Payload contracts (for smoke test design)

**`capture-truth-gate-lead`** (POST body): `session_id`, `first_name`, `email`, `phone_e164`, `county`, `project_type`, `window_count`, `quote_range`, `source`, `client_slug`, UTM/attribution fields.

**`start-upload-scan-session`** (POST body): `session_id`, `storage_path`, `file_name`, `file_size`, `file_type` — **does not receive the raw file** (file already in `quotes` bucket).

**`scan-quote`** (POST body): `scan_session_id` (UUID), optional `event_id`.

**`send-otp`**: `{ phone_e164, scan_session_id? }`

**`verify-otp`**: `{ phone_e164, code, scan_session_id? }`

---

## Automated schema verification

```bash
DATABASE_URL='postgres://postgres:<password>@db.<STAGING_REF>.supabase.co:5432/postgres' \
  npx tsx scripts/validation/verify-schema-spec.ts
```

Exit `0` = spec subset passes. See [scripts/validation/VERIFY_SCHEMA_SPEC.md](../../scripts/validation/VERIFY_SCHEMA_SPEC.md).

Also review:

- [docs/db/TABLE_ACCESS_MODEL.md](../db/TABLE_ACCESS_MODEL.md)
- [docs/db/DB_PREFLIGHT_STATUS.md](../db/DB_PREFLIGHT_STATUS.md)

---

## Migration parity checklist (staging vs `main`)

- [ ] All migrations through `20260428120000` applied (strict OTP binding for `get_analysis_full`)
- [ ] `get_analysis_preview` returns `analysis_id` (`20260420000000`)
- [ ] Private `quotes` bucket + storage grants (`20260421214258`)
- [ ] `phone_verifications.scan_session_id` column present for session binding

---

## Staging verification sign-off

| Area | Verified | Date | Operator |
|------|----------|------|----------|
| Project ref is staging | | | |
| Tables + RLS enabled | | | |
| Bucket `quotes` private | | | |
| RPCs exist + anon can execute | | | |
| Edge Functions deployed | | | |
| Secrets (Twilio, Gemini) set | | | |
| `quote_analyses` not on V2 path | | | |

When all rows are checked, proceed to React wiring per [LOCAL_CUTOVER_CHECKLIST.md](./LOCAL_CUTOVER_CHECKLIST.md).
