
CREATE POLICY "Users read own creation docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents-creation' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users insert own creation docs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents-creation' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own creation docs" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents-creation' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own creation docs" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents-creation' AND auth.uid()::text = (storage.foldername(name))[1]);
