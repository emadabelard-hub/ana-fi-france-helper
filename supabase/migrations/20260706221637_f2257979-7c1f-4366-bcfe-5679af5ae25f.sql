
-- 1. suppliers
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  siret VARCHAR(14),
  email VARCHAR(255),
  phone VARCHAR(20),
  iban VARCHAR(34),
  bic VARCHAR(11),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_supplier_per_user UNIQUE(user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_can_insert_suppliers" ON public.suppliers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_can_update_suppliers" ON public.suppliers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_can_delete_suppliers" ON public.suppliers
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. supplier_invoices
CREATE TABLE public.supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_number VARCHAR(30) NOT NULL,
  supplier_reference VARCHAR(100),
  invoice_date DATE NOT NULL,
  amount_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  amount_tva NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_ttc NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'received',
  source VARCHAR(30) NOT NULL DEFAULT 'manual',
  pdf_url TEXT,
  factur_x_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_invoice_number_per_user UNIQUE(user_id, invoice_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invoices TO authenticated;
GRANT ALL ON public.supplier_invoices TO service_role;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_supplier_invoices" ON public.supplier_invoices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users_can_insert_supplier_invoices" ON public.supplier_invoices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_can_update_supplier_invoices" ON public.supplier_invoices
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_can_delete_supplier_invoices" ON public.supplier_invoices
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_supplier_invoices_updated_at
  BEFORE UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_supplier_invoices_user ON public.supplier_invoices(user_id, invoice_date DESC);
CREATE INDEX idx_supplier_invoices_supplier ON public.supplier_invoices(supplier_id);

-- 3. supplier_invoice_lines
CREATE TABLE public.supplier_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  description VARCHAR(500),
  amount_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  category_code VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invoice_lines TO authenticated;
GRANT ALL ON public.supplier_invoice_lines TO service_role;
ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_invoice_lines_select" ON public.supplier_invoice_lines
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.supplier_invoices si
      WHERE si.id = supplier_invoice_id AND si.user_id = auth.uid())
  );
CREATE POLICY "supplier_invoice_lines_insert" ON public.supplier_invoice_lines
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.supplier_invoices si
      WHERE si.id = supplier_invoice_id AND si.user_id = auth.uid())
  );
CREATE POLICY "supplier_invoice_lines_update" ON public.supplier_invoice_lines
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.supplier_invoices si
      WHERE si.id = supplier_invoice_id AND si.user_id = auth.uid())
  );
CREATE POLICY "supplier_invoice_lines_delete" ON public.supplier_invoice_lines
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.supplier_invoices si
      WHERE si.id = supplier_invoice_id AND si.user_id = auth.uid())
  );

-- 4. Auto-numbering ACH-YYYY-NNN (per user)
CREATE OR REPLACE FUNCTION public.get_next_supplier_invoice_number(_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  _next_num INTEGER;
  _formatted TEXT;
  _attempts INTEGER := 0;
  _exists BOOLEAN;
BEGIN
  LOOP
    _attempts := _attempts + 1;
    IF _attempts > 100 THEN
      RAISE EXCEPTION 'Impossible de réserver un numéro ACH libre après 100 tentatives';
    END IF;

    INSERT INTO public.document_counters (user_id, document_type, year, last_number, updated_at)
    VALUES (_user_id, 'supplier_invoice', _year, 1, now())
    ON CONFLICT (user_id, document_type, year)
    DO UPDATE SET last_number = document_counters.last_number + 1, updated_at = now()
    RETURNING last_number INTO _next_num;

    _formatted := 'ACH-' || _year::text || '-' || LPAD(_next_num::text, 3, '0');

    SELECT EXISTS (
      SELECT 1 FROM public.supplier_invoices
      WHERE user_id = _user_id AND invoice_number = _formatted
    ) INTO _exists;

    EXIT WHEN NOT _exists;
  END LOOP;

  RETURN _formatted;
END;
$$;
