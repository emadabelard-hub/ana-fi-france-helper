
-- Atomic function to get next document number with no gaps
CREATE OR REPLACE FUNCTION public.get_next_document_number(
  _user_id uuid,
  _document_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year integer;
  _prefix text;
  _next_num integer;
  _formatted text;
BEGIN
  -- Validate document type
  IF _document_type NOT IN ('devis', 'facture') THEN
    RAISE EXCEPTION 'Invalid document type: %', _document_type;
  END IF;

  _year := EXTRACT(YEAR FROM now())::integer;
  _prefix := CASE WHEN _document_type = 'facture' THEN 'F' ELSE 'D' END;

  -- Atomically upsert and increment the counter
  INSERT INTO public.document_counters (user_id, document_type, year, last_number, updated_at)
  VALUES (_user_id, _document_type, _year, 1, now())
  ON CONFLICT (user_id, document_type, year)
  DO UPDATE SET
    last_number = document_counters.last_number + 1,
    updated_at = now()
  RETURNING last_number INTO _next_num;

  -- Format: F-2026-001 or D-2026-001
  _formatted := _prefix || '-' || _year::text || '-' || LPAD(_next_num::text, 3, '0');

  RETURN _formatted;
END;
$$;

-- Ensure unique constraint on document_counters for the upsert to work
-- Check if it exists first; if not, add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'document_counters_user_type_year_unique'
  ) THEN
    ALTER TABLE public.document_counters
    ADD CONSTRAINT document_counters_user_type_year_unique 
    UNIQUE (user_id, document_type, year);
  END IF;
END $$;
