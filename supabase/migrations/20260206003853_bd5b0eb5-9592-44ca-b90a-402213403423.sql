-- Create storage bucket for signed documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('signed-documents', 'signed-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own signed documents
CREATE POLICY "Users can upload their own signed documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'signed-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to view their own signed documents
CREATE POLICY "Users can view their own signed documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'signed-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own signed documents
CREATE POLICY "Users can delete their own signed documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'signed-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);