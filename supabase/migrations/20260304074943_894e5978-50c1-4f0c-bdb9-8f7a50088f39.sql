
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'expense-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their own receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'expense-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own receipts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'expense-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
