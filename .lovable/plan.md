# Fix: "Failed to start scan session. Please try again."

## Root cause (confirmed, not guessed)

The error string comes from one specific branch in `src/components/UploadZone.tsx`:

```
failWith("scan_sessions_insert", "Failed to start scan session. Please try again.", ssError);
```

…which fires when the browser-side `supabase.from("scan_sessions").insert(...)` is rejected by Postgres RLS.

I checked the live RLS policies on the four tables UploadZone touches:

| Table | INSERT policy | Roles allowed |
|---|---|---|
| `leads` | `leads_anon_insert_constrained` | **anon only** |
| `quote_files` | `quote_files_anon_insert_only` + `quote_files_authenticated_insert_only` | anon + authenticated |
| `scan_sessions` | `anon_insert_scan_sessions` (requires `user_id IS NULL`) | **anon only** |
| `event_logs` | `anon_insert_event_logs` | **anon only** |

You are logged into the admin/operator portal in the same browser, so the Supabase client sends an **authenticated** JWT. PostgREST runs the request with `role = authenticated`, the only matching policy on `scan_sessions` is `TO anon`, and Postgres returns:

> `42501 — new row violates row-level security policy for table "scan_sessions"`

This is the **same class of bug** Step 1 had, just one table further down the funnel. Step 1 was fixed by routing `leads` insert through `capture-truth-gate-lead` (service role). The browser path through `scan_sessions` and the lead-fallback `leads` insert never got the same treatment, so the error simply moved one step.

Confidence: very high. The error message is unique to that branch, the policies on `scan_sessions` truly have no `authenticated` insert path, and `quote_files` (which DOES have an authenticated policy) is the only one of the three that succeeds for you today.

## Fix (same pattern as Step 1, scoped to UploadZone)

### 1. New edge function: `start-upload-scan-session`

- File: `supabase/functions/start-upload-scan-session/index.ts`
- Service-role client (never exposed to browser)
- Input (validated with zod):
  - `session_id` (UUID v4, required) — funnel session
  - `storage_path` (non-empty string, required) — the deterministic path UploadZone already builds and uploaded to
  - `file_name`, `file_size`, `file_type` (optional, for telemetry)
- Behavior (idempotent + matches existing UploadZone semantics):
  1. Validate inputs.
  2. Resolve `lead_id` via `get_lead_by_session(session_id)`. If none, create a minimal `leads` row (`session_id`, `source: "direct_upload"`, safe defaults — same fields as the current browser fallback at line 372–379, no privilege escalation).
  3. Look up an existing `quote_files` row by `storage_path`. If found, reuse it; else insert a new one bound to `lead_id`.
  4. Look up an existing `scan_sessions` row for that `quote_file_id`. If found, reuse it; else insert a new one with `status: "uploading"`, `lead_id`, `quote_file_id`, `user_id: NULL` (preserves the anon ownership semantics the table is policy-shaped around).
  5. Return `{ scan_session_id, quote_file_id, lead_id }`.
- CORS handled via `corsHeaders`. No auth required from caller — it's a public funnel entry, identical trust model to `capture-truth-gate-lead`.
- Telemetry: structured non-PII logs only.

### 2. Refactor `UploadZone.tsx` (one block, lines ~364–397)

Replace the three direct browser inserts (`leads` fallback → `quote_files` → `scan_sessions`) with a single call:

```ts
const { data, error } = await supabase.functions.invoke("start-upload-scan-session", {
  body: { session_id: sessionScope, storage_path: filePath,
          file_name: file.name, file_size: file.size, file_type: file.type },
});
```

- On error: route through the existing `failWith("scan_sessions_insert", ...)` so the visible UX (orange "Try Again" panel) is unchanged.
- On success: use returned `scan_session_id` / `quote_file_id` exactly where the locally-minted UUIDs were used today.
- Keep the deterministic storage path, the storage upload, the in-memory retry path, the cross-component retry-by-path lookup (read-only `select`s — those work fine for both anon and authenticated), and the call to `scan-quote`.

### 3. Out of scope (explicitly NOT touched)

- OTP / Twilio / `send-otp` / `verify-otp`
- `scan-quote` edge function
- Scoring, reports, `ReportClassic`, route guards
- RLS policies — **not weakened**. We're moving the writer to the service-role plane, not granting authenticated browsers new write capability.
- Admin/partner dashboards
- The `event_logs` insert at line 165 (still authenticated-failing, but non-blocking and out of scope for this ticket)

## Definition of done

- Anonymous homepage upload still works.
- Logged-in admin/operator upload now works end-to-end (the exact scenario in your screenshot).
- UploadZone reaches the `scan-quote` invoke step.
- Retry button still resolves to the same `scan_session_id` (no duplicate rows).
- `npx tsc --noEmit` passes.
- No changes to OTP, scoring, RLS, scan-quote, or report code.

## Files

- **Created:** `supabase/functions/start-upload-scan-session/index.ts`
- **Edited:** `src/components/UploadZone.tsx` (one block replacement, ~30 lines)
