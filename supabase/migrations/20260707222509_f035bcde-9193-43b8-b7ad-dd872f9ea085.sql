
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'facturx read own' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "facturx read own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'factures-facturx' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'facturx insert own' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "facturx insert own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'factures-facturx' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'facturx update own' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "facturx update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'factures-facturx' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
