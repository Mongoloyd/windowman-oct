

## Quote Upload Fix — Both Root Causes Confirmed

I validated both hypotheses against the live code and DB. **Both are real and both need to be fixed in the same pass.**

---

### Issue 1 — Storage RLS (CONFIRMED, primary cause)

Live policy audit on `storage.objects` for the `quotes` bucket returned **exactly one** policy:

```
"Allow anonymous uploads to quotes bucket"
  command: INSERT
  roles:   { anon }
  check:   bucket_id = 'quotes'
```

No UPDATE policy. `UploadZone.tsx` line 319 calls `.upload(filePath, file, { upsert: true, ... })`. With `upsert: true`, Supabase Storage routes any "object already exists" case (and certain metadata writes) through PostgREST UPDATE on `storage.objects` → blocked → "Upload failed. Please try again." Bucket privacy stays intact (no SELECT added).

### Issue 2 — UploadZone sequencing (CONFIRMED, secondary cause)

Lines 360–374 of `UploadZone.tsx`:

```ts
uploadedOnceRef.current = true;
setActiveScanSessionId(newScanSessionId);
trackEvent({ event_name: "upload_completed", ... });
onScanStart?.(file.name, newScanSessionId);   // ← UI advances here
await invokeScan(newScanSessionId, leadId, quoteFileId);  // ← scan invoked AFTER
```

`onScanStart` advances the parent UI to the scanning view BEFORE `scan-quote` is invoked. If the edge function then fails (rate limit, transient, payload), the user is already on the next screen with `quote_files` + `scan_sessions` rows committed but no actual scan running. Result: stuck "Scanning…" state with no recovery path from this surface.

---

### Fix plan — narrow scope, two surgical changes

#### A) Migration: add the missing UPDATE policy (and authenticated mirrors)

Strictly scoped to `bucket_id = 'quotes'`. Preserves bucket privacy (no SELECT). Mirrors INSERT for `authenticated` so signed-in vault uploads also work.

```sql
CREATE POLICY "Allow anonymous upsert updates to quotes bucket"
ON storage.objects FOR UPDATE TO anon
USING  (bucket_id = 'quotes')
WITH CHECK (bucket_id = 'quotes');

CREATE POLICY "Allow authenticated upsert updates to quotes bucket"
ON storage.objects FOR UPDATE TO authenticated
USING  (bucket_id = 'quotes')
WITH CHECK (bucket_id = 'quotes');

CREATE POLICY "Allow authenticated uploads to quotes bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'quotes');
```

#### B) `src/components/UploadZone.tsx` — sequence fix (single block edit, ~6 lines)

Move `onScanStart` to fire **only after** `invokeScan` returns truthy — same pattern already used by the retry path on lines 255–257 and 308–311. This is a 1-line reorder + 1 conditional, no logic redesign.

**Before (lines 364–374):**
```ts
uploadedOnceRef.current = true;
setActiveScanSessionId(newScanSessionId);
trackEvent({ event_name: "upload_completed", ... });
onScanStart?.(file.name, newScanSessionId);   // fires too early
await invokeScan(newScanSessionId, leadId, quoteFileId);
```

**After:**
```ts
uploadedOnceRef.current = true;
setActiveScanSessionId(newScanSessionId);
trackEvent({ event_name: "upload_completed", ... });
const ok = await invokeScan(newScanSessionId, leadId, quoteFileId);
if (ok) {
  onScanStart?.(file.name, newScanSessionId);
}
// On !ok, invokeScan has already set uploadError + toast; the user
// stays on UploadZone with the existing retry button bound to the
// already-persisted scan_session_id (uploadedOnceRef = true).
```

Rationale:
- `quote_files` + `scan_sessions` rows still get persisted (canonical path preserved → retry can re-bind by `storage_path`).
- Retry button on the same surface re-invokes `invokeScan` against the existing session — no duplicate rows, no orphaned UI advance.
- Existing `failWith` / toast / `uploadError` plumbing inside `invokeScan` already handles user-facing errors.

---

### What does NOT change

- Bucket stays private (`public: false`). No SELECT policy added.
- No frontend redesign — only the order of two existing statements changes.
- No changes to: `scan-quote`, `send-otp`, `verify-otp`, OTP flow, scoring, scanner architecture, admin, GTM, hero CTAs, routing, RLS on `leads` / `quote_files` / `scan_sessions` / `analyses`, or any other policy.
- File size + MIME enforcement remain on the bucket (`10MB`, pdf/jpeg/png/webp/heic).

### Files touched

1. **New migration** — adds the 3 storage policies.
2. **`src/components/UploadZone.tsx`** — reorder lines 372–374 to gate `onScanStart` behind `invokeScan` success (matches the existing retry-path pattern).

### Verification after deploy

1. Homepage → Scan My Quote → answer questions → upload PDF → confirm UI only advances when scan actually starts (status pill goes `Uploading… → Scanning…`).
2. Re-upload same file in same session → retry path takes over, no duplicate rows.
3. Force a scan-quote failure (e.g. invalid payload) → user stays on UploadZone with the retry button, no orphan advance.
4. `event_logs` should show `upload_completed` followed by `scan-quote` invocation, not the reverse with a hanging session.

