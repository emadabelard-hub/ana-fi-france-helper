
-- Phase 3 : rentabilité chantier — colonnes additives sur expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS supplier_invoice_id uuid NULL REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount_type text NULL;

-- Contrainte : amount_type doit être HT, TTC ou NULL
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_amount_type_check'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_amount_type_check
      CHECK (amount_type IS NULL OR amount_type IN ('HT','TTC'));
  END IF;
END $$;

-- Une dépense ne peut être liée qu'à une seule facture fournisseur ; unicité côté supplier_invoice_id
-- (déjà garantie par la clé primaire de expenses ; on empêche seulement qu'une même dépense
-- soit dupliquée). On ajoute un index unique partiel : chaque supplier_invoice ne peut être
-- lié qu'à une dépense (relation 1-1).
CREATE UNIQUE INDEX IF NOT EXISTS expenses_supplier_invoice_id_unique
  ON public.expenses(supplier_invoice_id)
  WHERE supplier_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS expenses_chantier_id_idx ON public.expenses(chantier_id);

-- Contrôle de propriété : la facture fournisseur liée doit appartenir au même user
CREATE OR REPLACE FUNCTION public.validate_expense_supplier_invoice_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.supplier_invoice_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.supplier_invoices
      WHERE id = NEW.supplier_invoice_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Facture fournisseur introuvable ou non autorisée';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expenses_validate_supplier_invoice_ownership ON public.expenses;
CREATE TRIGGER expenses_validate_supplier_invoice_ownership
  BEFORE INSERT OR UPDATE OF supplier_invoice_id, user_id ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_expense_supplier_invoice_ownership();
