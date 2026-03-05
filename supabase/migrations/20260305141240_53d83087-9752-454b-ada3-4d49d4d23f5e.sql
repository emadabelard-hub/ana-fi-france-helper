
ALTER TABLE public.expenses ADD COLUMN document_id uuid REFERENCES public.documents_comptables(id) ON DELETE SET NULL DEFAULT NULL;
