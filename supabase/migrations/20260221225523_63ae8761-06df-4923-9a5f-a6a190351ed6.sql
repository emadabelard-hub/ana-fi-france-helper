
-- Fix signed-documents policies: change from public role to authenticated role
-- This ensures only authenticated users (including anonymous/guest) can access, not unauthenticated visitors

-- DROP the overly permissive public-role policies
DROP POLICY IF EXISTS "Users can delete their own signed documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own signed documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own signed documents" ON storage.objects;

-- Recreate with authenticated role (covers both registered and anonymous/guest users)
CREATE POLICY "Users can view their own signed documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'signed-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload their own signed documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signed-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own signed documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'signed-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
