
-- Fix request-files storage bucket: add owner-based isolation

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can upload request files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own request files" ON storage.objects;

-- Owner-isolated INSERT
CREATE POLICY "Users can upload to own request files folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'request-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Owner-isolated SELECT
CREATE POLICY "Users can view own request files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'request-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Owner-isolated UPDATE
CREATE POLICY "Users can update own request files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'request-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Owner-isolated DELETE
CREATE POLICY "Users can delete own request files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'request-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admin access to all request files
CREATE POLICY "Admins can view all request files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'request-files'
  AND public.is_admin(auth.uid())
);
