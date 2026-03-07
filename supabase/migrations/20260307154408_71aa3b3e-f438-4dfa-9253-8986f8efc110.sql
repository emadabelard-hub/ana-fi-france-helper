
-- Add reference_number column to chantiers
ALTER TABLE public.chantiers ADD COLUMN IF NOT EXISTS reference_number text;

-- Create a function to auto-generate reference numbers
CREATE OR REPLACE FUNCTION public.generate_chantier_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  seq_num integer;
  year_str text;
BEGIN
  year_str := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CASE WHEN reference_number LIKE 'CH-' || year_str || '-%'
    THEN CAST(SUBSTRING(reference_number FROM 'CH-\d{4}-(\d+)') AS integer)
    ELSE 0 END
  ), 0) + 1 INTO seq_num FROM public.chantiers;
  NEW.reference_number := 'CH-' || year_str || '-' || LPAD(seq_num::text, 4, '0');
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate reference on insert (drop first if exists)
DROP TRIGGER IF EXISTS set_chantier_reference ON public.chantiers;
CREATE TRIGGER set_chantier_reference
  BEFORE INSERT ON public.chantiers
  FOR EACH ROW
  WHEN (NEW.reference_number IS NULL)
  EXECUTE FUNCTION public.generate_chantier_reference();
