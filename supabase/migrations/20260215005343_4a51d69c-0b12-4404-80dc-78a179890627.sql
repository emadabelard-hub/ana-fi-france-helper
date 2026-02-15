-- Fix 1: Make company-assets bucket private
UPDATE storage.buckets SET public = false WHERE id = 'company-assets';

-- Fix 2: Make signed-documents bucket private  
UPDATE storage.buckets SET public = false WHERE id = 'signed-documents';

-- Fix 3: Update company-assets SELECT policy to owner-scoped
DROP POLICY IF EXISTS "Company assets are publicly accessible" ON storage.objects;
CREATE POLICY "Users can view their own company assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'company-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Fix 4: Restrict lesson-images upload/update/delete to admins only
DROP POLICY IF EXISTS "Allow authenticated users to upload lesson images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update lesson images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete lesson images" ON storage.objects;

CREATE POLICY "Admins can upload lesson images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lesson-images' 
  AND public.is_admin(auth.uid())
);

CREATE POLICY "Admins can update lesson images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'lesson-images' 
  AND public.is_admin(auth.uid())
);

CREATE POLICY "Admins can delete lesson images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'lesson-images' 
  AND public.is_admin(auth.uid())
);