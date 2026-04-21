-- Allow anon to UPDATE objects in the quotes bucket so storage upsert succeeds.
-- Required because UploadZone.tsx uses upsert: true for deterministic retry paths.
CREATE POLICY "Allow anonymous upsert updates to quotes bucket"
ON storage.objects
FOR UPDATE
TO anon
USING  (bucket_id = 'quotes')
WITH CHECK (bucket_id = 'quotes');

-- Same for authenticated (so signed-in users on /vault/upload also work).
CREATE POLICY "Allow authenticated upsert updates to quotes bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING  (bucket_id = 'quotes')
WITH CHECK (bucket_id = 'quotes');

-- Mirror INSERT for authenticated (current INSERT policy is anon-only).
CREATE POLICY "Allow authenticated uploads to quotes bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'quotes');