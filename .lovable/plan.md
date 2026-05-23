# Plan: Zod Contract Tests for `start-upload-scan-session`

## Scope (hard isolation)
- **Touched:** `supabase/functions/start-upload-scan-session/` only.
- **Not touched:** any other Edge Function, `src/`, DB schema, RLS, storage policies, secrets, `.lovable/plan.md`, `App.tsx`, `/` route.

## Files to create

### 1. `supabase/functions/start-upload-scan-session/contracts/schemas.ts`
Single source of truth for request + response shapes. Exports:

- `UUID` — `z.string().uuid()`
- `StoragePath` — `z.string().min(1).max(1024)` + `.refine()` enforcing the existing scope rules (no leading `/`, no `//`, no `..`, must start with `${session_id}/`, non-empty filename). The refinement runs as a cross-field check inside `RequestSchema.superRefine`, not in `StoragePath` alone.
- `FileName` — `z.string().min(1).max(512).nullish()`
- `FileSize` — `z.number().int().nonnegative().nullish()`
- `FileType` — `z.string().max(128).nullish()`
- `RequestSchema` — `z.object({ session_id: UUID, storage_path: z.string().min(1).max(1024), file_name: FileName, file_size: FileSize, file_type: FileType }).strict().superRefine(...)` for the cross-field storage-path scope check.
- `ErrorCode` — `z.enum(["invalid_json","invalid_payload","storage_path_scope_mismatch","storage_object_missing","method_not_allowed","server_misconfigured","lead_create_failed","quote_file_create_failed","scan_session_create_failed","unexpected_error"])` mirroring the codes already emitted by the handler.
- `SuccessResponseSchema` — `z.object({ success: z.literal(true), scan_session_id: UUID, quote_file_id: UUID, lead_id: UUID }).strict()`
- `ErrorResponseSchema` — `z.object({ success: z.literal(false), code: ErrorCode, message: z.string().min(1), details: z.unknown().optional() }).strict()`
- `ResponseSchema` — `z.discriminatedUnion("success", [SuccessResponseSchema, ErrorResponseSchema])`
- Inferred types: `BootstrapRequest`, `BootstrapResponse`, `BootstrapSuccess`, `BootstrapError`.

Zod imported as `import { z } from "npm:zod@3.23.8";` to match the project's existing `npm:` specifier pattern (no `deno.json` import-map edit required).

### 2. `supabase/functions/start-upload-scan-session/contracts/schemas.test.ts`
Deno-native (`Deno.test`) suite, no network, no env. Asserts:

**Request — valid:**
- Minimal valid body parses (UUID `session_id`, scoped `storage_path`, all optional fields absent).
- Full valid body parses (`file_name`, `file_size`, `file_type`, including explicit `null`s).

**Request — invalid (each its own test, asserts `.success === false` AND the expected `issues[0].path`):**
- Missing `session_id`.
- Non-UUID `session_id`.
- Missing `storage_path`.
- `storage_path` over 1024 chars.
- `storage_path` with leading `/`.
- `storage_path` with `//`.
- `storage_path` with `../`.
- `storage_path` not prefixed by `${session_id}/` (cross-field).
- `storage_path` equal to `${session_id}/` (empty filename).
- `file_size` negative.
- `file_size` non-integer.
- `file_type` over 128 chars.
- `file_name` over 512 chars.
- Extra/unknown property (e.g. `lead_id` injected) — rejected by `.strict()`.
- Body is array / string / null.

**Response — valid:**
- Success envelope with three UUIDs parses.
- Each known error code parses with a message.

**Response — invalid:**
- `success: true` with missing `scan_session_id` fails.
- `success: false` with unknown `code` fails enum.
- Extra property on success envelope rejected by `.strict()`.
- Mixing `success: true` with an error `code` field fails the discriminated union.

All tests use `assert`/`assertEquals` from `https://deno.land/std@0.224.0/assert/...` (already used elsewhere in this project). No `--allow-net` required.

### 3. `supabase/functions/start-upload-scan-session/index.ts` — minimal handler update
Two surgical changes, no behavior change for currently-valid traffic:

- **Request:** Replace the hand-rolled `parsePayload` body (kept as-is for safe `file_*` defaulting fallback? — **no**, fully replace) with `RequestSchema.safeParse(raw)`. On failure return `badRequest("invalid_payload", "Payload validation failed: " + firstIssue)` and audit `validation_failed` exactly as today. The existing `validateStoragePathScope` helper is removed because `RequestSchema.superRefine` now owns it — the `storage_path_scope_mismatch` error code remains reachable via a dedicated branch that re-checks after parse OR, simpler, the scope failure now surfaces as `invalid_payload` with `path: ["storage_path"]`. **Decision needed (open item below).**
- **Response:** Before every `jsonResponse(...)` return inside the main handler, wrap the body in `ResponseSchema.parse(body)`. On throw, log `unexpected_error` audit and return a hard-coded `500 { success:false, code:"unexpected_error", message:"Response contract violation." }`. Wrap in a single helper `respond(status, body)` to keep diffs tight.

No changes to: CORS headers, storage probe, lead/quote_file/scan_session resolution logic, audit persistence rules, service-role usage.

## Open items (need your call before I write code)

1. **Scope-mismatch error code preservation.** The handler currently returns a distinct `storage_path_scope_mismatch` (HTTP 400) so the frontend / event_logs can distinguish it from generic shape errors. With Zod owning the cross-field check, options are:
   - **(a)** Keep `validateStoragePathScope` *after* Zod parse and keep emitting `storage_path_scope_mismatch` as a separate code. (Recommended — preserves observability.)
   - **(b)** Fold it into `invalid_payload` and retire the code from `ErrorCode` enum. (Cleaner, but breaks any consumer keying on the code string.)

2. **`.strict()` vs `.passthrough()` on the request.** The current frontend caller is `UploadZone`. If you want me to first `code--view` it and confirm no extra keys are sent before locking `.strict()`, say so; otherwise I'll ship `.strict()` and note it in the PR description as a deliberate tightening.

3. **Zod pin.** OK to introduce `npm:zod@3.23.8` for this function only (no `deno.json` change needed thanks to `nodeModulesDir: true`)?

## Non-goals
- No changes to other functions (`scan-quote`, `verify-otp`, etc.).
- No `src/` updates, no shared type export to the frontend (can be a follow-up).
- No CI workflow changes.
- No live-network contract job.
- No DB, RLS, or storage changes.
