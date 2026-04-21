-- Restore standard table-level grants on storage.objects that the existing
-- RLS policies (e.g. "Allow anonymous uploads to quotes bucket") rely on.
--
-- RLS is evaluated AFTER the table-level grant check. Without these grants,
-- the policy never gets a chance to allow the write — Postgres rejects it
-- first and the storage REST layer surfaces it as a generic 403
-- "new row violates row-level security policy", which is misleading.
--
-- Scope is intentionally minimal:
--   • anon          → INSERT only (matches the existing anon INSERT policy on `quotes`)
--                     + SELECT (required by the PostgREST/storage SDK to read back
--                       the just-inserted row metadata; gated by NO anon SELECT
--                       policy on quotes, so this does NOT expose any object data)
--                     + UPDATE (matches the existing anon UPDATE policy used by
--                       upsert: true on retries)
--   • authenticated → same set, matching the existing authenticated policies
--
-- Bucket `quotes` remains private. No new RLS policies are created.
-- No public read surface is introduced — anon SELECT on storage.objects is
-- still gated by RLS and there is no anon SELECT policy for bucket_id='quotes'.

GRANT SELECT, INSERT, UPDATE ON storage.objects TO anon;
GRANT SELECT, INSERT, UPDATE ON storage.objects TO authenticated;