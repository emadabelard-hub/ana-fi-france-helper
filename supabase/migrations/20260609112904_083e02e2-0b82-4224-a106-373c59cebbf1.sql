
-- Fix 1: Realtime policy should allow all participants (owner of service_request), not only sender
DROP POLICY IF EXISTS "users_own_request_messages" ON realtime.messages;
CREATE POLICY "users_own_request_messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE (sr.id)::text = (messages.payload ->> 'request_id')
      AND sr.user_id = auth.uid()
  )
);

-- Fix 2: Admin storage uploads/updates must target a folder owned by a real service_request user
DROP POLICY IF EXISTS "Admins can upload to request files" ON storage.objects;
CREATE POLICY "Admins can upload to request files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'request-files'
  AND public.is_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE sr.user_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Admins can update request files" ON storage.objects;
CREATE POLICY "Admins can update request files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'request-files' AND public.is_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'request-files'
  AND public.is_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.service_requests sr
    WHERE sr.user_id::text = (storage.foldername(name))[1]
  )
);
