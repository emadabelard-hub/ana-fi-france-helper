
-- Independent sequential counters for Devis and Factures per user per year
CREATE TABLE public.document_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('devis', 'facture')),
  year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, document_type, year)
);

ALTER TABLE public.document_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own counters" ON public.document_counters
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Atomic function to get next document number
CREATE OR REPLACE FUNCTION public.get_next_document_number(
  p_user_id uuid,
  p_document_type text,
  p_year integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next integer;
  v_prefix text;
BEGIN
  -- Validate type
  IF p_document_type NOT IN ('devis', 'facture') THEN
    RAISE EXCEPTION 'Invalid document type: %', p_document_type;
  END IF;

  -- Upsert and increment atomically
  INSERT INTO public.document_counters (user_id, document_type, year, last_number)
  VALUES (p_user_id, p_document_type, p_year, 1)
  ON CONFLICT (user_id, document_type, year)
  DO UPDATE SET last_number = document_counters.last_number + 1, updated_at = now()
  RETURNING last_number INTO v_next;

  -- Build formatted number
  v_prefix := CASE WHEN p_document_type = 'devis' THEN 'D' ELSE 'F' END;
  RETURN v_prefix || '-' || p_year::text || '-' || LPAD(v_next::text, 3, '0');
END;
$$;
