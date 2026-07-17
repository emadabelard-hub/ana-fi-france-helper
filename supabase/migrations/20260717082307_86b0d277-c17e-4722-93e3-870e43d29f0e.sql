
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS chantier_id uuid REFERENCES public.chantiers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_chantier_id ON public.supplier_invoices(chantier_id);
CREATE INDEX IF NOT EXISTS idx_documents_comptables_chantier_id ON public.documents_comptables(chantier_id);
CREATE INDEX IF NOT EXISTS idx_expenses_chantier_id ON public.expenses(chantier_id);

CREATE OR REPLACE FUNCTION public.validate_supplier_invoice_chantier_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chantier_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.chantiers
      WHERE id = NEW.chantier_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Chantier introuvable ou non autorisé';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_supplier_invoice_chantier ON public.supplier_invoices;
CREATE TRIGGER trg_validate_supplier_invoice_chantier
BEFORE INSERT OR UPDATE OF chantier_id, user_id ON public.supplier_invoices
FOR EACH ROW EXECUTE FUNCTION public.validate_supplier_invoice_chantier_ownership();
