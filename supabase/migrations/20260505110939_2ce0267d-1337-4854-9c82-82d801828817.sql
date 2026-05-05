
-- 1. Create storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS policies for 'documents' bucket
-- Users can view their own files (folder = user_id)
CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Create documents catalog table
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  type text NOT NULL CHECK (type IN ('devis', 'facture', 'note_frais')),
  numero text,
  nom_fichier text NOT NULL,
  pdf_url text NOT NULL,
  storage_path text NOT NULL,
  taille_kb integer NOT NULL DEFAULT 0,
  amount numeric,
  status text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_type ON public.documents(type);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_owner_select"
ON public.documents FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "documents_owner_insert"
ON public.documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_owner_delete"
ON public.documents FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
