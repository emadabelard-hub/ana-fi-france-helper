
ALTER TABLE public.supplier_invoices ADD COLUMN chorus_reference VARCHAR(255) UNIQUE NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.supplier_invoices ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.supplier_invoices DROP CONSTRAINT IF EXISTS supplier_invoices_user_id_fkey;

ALTER TABLE public.suppliers ADD CONSTRAINT unique_supplier_siret UNIQUE (siret);

CREATE POLICY "view_pdp_supplier_invoices" ON public.supplier_invoices
FOR SELECT
USING (user_id = auth.uid() OR (user_id IS NULL AND auth.jwt() ->> 'role' = 'authenticated'));
