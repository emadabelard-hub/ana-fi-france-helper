
DROP POLICY IF EXISTS "users_own_messages" ON realtime.messages;
CREATE POLICY "users_own_messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid()::text = COALESCE(
    (payload->>'sender_id')::text,
    (payload->>'user_id')::text
  )
);

DROP POLICY IF EXISTS "Admins can upload to request files" ON storage.objects;
CREATE POLICY "Admins can upload to request files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'request-files' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update request files" ON storage.objects;
CREATE POLICY "Admins can update request files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'request-files' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'request-files' AND public.is_admin(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_chantier_reference() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_factures() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.reset_daily_message_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_next_document_number(uuid, text) FROM anon, authenticated, public;
