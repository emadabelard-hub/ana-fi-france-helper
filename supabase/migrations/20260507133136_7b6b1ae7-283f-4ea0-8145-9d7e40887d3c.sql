CREATE TABLE public.milestone_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  devis_id uuid NOT NULL,
  devis_number text NOT NULL,
  milestone_index integer NOT NULL,
  milestone_label text,
  milestone_percent numeric,
  montant_ttc numeric,
  facture_id uuid,
  facture_number text,
  statut text NOT NULL DEFAULT 'facturee',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.milestone_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestone_invoices_owner_all" ON public.milestone_invoices
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_milestone_invoices_devis ON public.milestone_invoices(devis_id, milestone_index);
CREATE INDEX idx_milestone_invoices_user ON public.milestone_invoices(user_id);

CREATE TRIGGER update_milestone_invoices_updated_at
BEFORE UPDATE ON public.milestone_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();