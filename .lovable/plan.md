

## Diagnostic Pass — Capture the Real Storage Error

Strict instrumentation-only pass. No fix applied. We will not touch path strategy, bucket privacy, retry logic, OTP, or admin UI. The single objective is to surface the exact `storageErr` payload from `supabase.storage.from("quotes").upload(...)` so the next fix is targeted, not inferred.

---

### What changes (one file, instrumentation only)

**`src/components/UploadZone.tsx`** — three additive edits, zero behavior change:

1. **Pre-upload structured console log** (immediately before the `supabase.storage.from("quotes").upload(...)` call):
   ```
   console.info("[UploadZone] storage.upload →", {
     bucket: "quotes",
     filePath,                      // the exact computed key
     upsert: true,                  // what we actually pass
     contentType: file.type,        // browser-reported MIME (may be "")
     fileName: file.name,
     fileSize: file.size,
     isRetry,                       // already tracked via uploadedOnceRef
     sessionId,
     leadId,
   });
   ```
   No object stringification — structured so DevTools shows the expanded tree.

2. **Full error capture inside the `if (storageErr)` branch** (before calling `failWith`):
   ```
   console.error("[UploadZone] storage.upload FAILED", {
     message:     storageErr?.message,
     name:        storageErr?.name,
     statusCode:  (storageErr as any)?.statusCode,
     status:      (storageErr as any)?.status,
     error:       (storageErr as any)?.error,        // supabase storage often nests here
     cause:       (storageErr as any)?.cause,
     raw:         storageErr,                         // full object, not JSON.stringify'd
   });
   ```

3. **Server-side telemetry into `event_logs`** (fire-and-forget — does not block the existing `failWith` toast):
   ```
   trackEvent({
     event_name: "storage_upload_failed",
     session_id: sessionId,
     metadata: {
       message:     storageErr?.message      ?? null,
       name:        storageErr?.name         ?? null,
       statusCode:  (storageErr as any)?.statusCode ?? (storageErr as any)?.status ?? null,
       errorBody:   (storageErr as any)?.error ?? null,
       bucket:      "quotes",
       filePath,
       fileName:    file.name,
       fileType:    file.type || null,
       fileSize:    file.size,
       upsert:      true,
       isRetry,
       leadId,
     },
   });
   ```
   Uses the existing `trackEvent` helper in `src/lib/trackEvent.ts` (writes to the `event_logs` table — already in the schema, already RLS-permitted for anon insert).

---

### What does NOT change

- `buildDeterministicStoragePath` — unchanged.
- `upsert: true` — unchanged.
- No `attemptId`, no path mutation, no MIME inference.
- No new storage policies.
- No bucket privacy changes.
- `failWith` still fires the same toast and same `console.error`. The new `console.info` + `console.error` + `trackEvent` calls are purely additive, placed AROUND the existing flow.
- No changes to `scan-quote`, `send-otp`, `verify-otp`, `DemoClassic`, scoring, RLS, or routing.

---

### Reproduction protocol after deploy

1. Open the homepage → answer Truth Gate questions → upload the same `111 abc.png` file you used before.
2. When the toast fires "Upload failed. Please try again.", open DevTools console and capture both:
   - the `[UploadZone] storage.upload →` info log (the pre-upload payload)
   - the `[UploadZone] storage.upload FAILED` error log (the full `storageErr` tree)
3. I will then query `event_logs WHERE event_name = 'storage_upload_failed' ORDER BY created_at DESC LIMIT 1` to pull the server-side row with the exact `message`, `statusCode`, and `errorBody`.

### Report I will return (after you reproduce)

Exactly three things, nothing else:

1. The exact `storageErr.message` + `statusCode` + `errorBody` payload.
2. Confirmation of which storage operation failed: **INSERT** (path did not exist → RLS INSERT denied / MIME rejected / size rejected / bucket misconfig) **vs UPDATE** (path already existed → upsert triggered an UPDATE that RLS or owner semantics blocked) **vs network/CORS** (no statusCode, fetch-level failure).
3. The single targeted fix that addresses that specific cause — proposed only after the signal is in hand.

### Files touched in this pass

- `src/components/UploadZone.tsx` — instrumentation only (~20 added lines, 0 removed).

No migration. No edge function changes. No DB writes outside the existing `event_logs` insert path.

