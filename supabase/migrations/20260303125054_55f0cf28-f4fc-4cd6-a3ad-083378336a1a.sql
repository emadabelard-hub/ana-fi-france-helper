
CREATE TABLE public.documents_comptables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type text NOT NULL DEFAULT 'devis',
  document_number text NOT NULL,
  client_name text NOT NULL DEFAULT '',
  client_address text DEFAULT '',
  work_site_address text DEFAULT '',
  nature_operation text DEFAULT '',
  subtotal_ht numeric NOT NULL DEFAULT 0,
  tva_rate numeric NOT NULL DEFAULT 0,
  tva_amount numeric NOT NULL DEFAULT 0,
  total_ttc numeric NOT NULL DEFAULT 0,
  tva_exempt boolean NOT NULL DEFAULT false,
  document_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  pdf_url text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.documents_comptables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own documents"
  ON public.documents_comptables FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents"
  ON public.documents_comptables FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON public.documents_comptables FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON public.documents_comptables FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all documents"
  ON public.documents_comptables FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_documents_comptables_updated_at
  BEFORE UPDATE ON public.documents_comptables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
