
-- 1. Add reference column (nullable initially for backfill)
ALTER TABLE public.opportunite_annonces ADD COLUMN IF NOT EXISTS reference text;

-- 2. Counter table per year
CREATE TABLE IF NOT EXISTS public.opportunite_reference_counters (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.opportunite_reference_counters TO authenticated;
GRANT ALL ON public.opportunite_reference_counters TO service_role;
ALTER TABLE public.opportunite_reference_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Nobody direct write" ON public.opportunite_reference_counters;
CREATE POLICY "Nobody direct write" ON public.opportunite_reference_counters FOR ALL USING (false) WITH CHECK (false);

-- 3. Generator function
CREATE OR REPLACE FUNCTION public.generate_opportunite_reference(_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next integer;
BEGIN
  INSERT INTO public.opportunite_reference_counters (year, last_number, updated_at)
  VALUES (_year, 1, now())
  ON CONFLICT (year) DO UPDATE
    SET last_number = opportunite_reference_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO _next;
  RETURN 'OPP-' || _year::text || '-' || LPAD(_next::text, 6, '0');
END;
$$;

-- 4. Trigger to assign reference on insert (immutable after)
CREATE OR REPLACE FUNCTION public.set_opportunite_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _year integer;
  _attempts integer := 0;
  _exists boolean;
  _ref text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reference IS NULL OR NEW.reference = '' THEN
      _year := EXTRACT(YEAR FROM COALESCE(NEW.published_at, now()))::integer;
      LOOP
        _attempts := _attempts + 1;
        IF _attempts > 100 THEN
          RAISE EXCEPTION 'Impossible de générer une référence unique';
        END IF;
        _ref := public.generate_opportunite_reference(_year);
        SELECT EXISTS(SELECT 1 FROM public.opportunite_annonces WHERE reference = _ref) INTO _exists;
        EXIT WHEN NOT _exists;
      END LOOP;
      NEW.reference := _ref;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reference is immutable once set
    IF OLD.reference IS NOT NULL AND NEW.reference IS DISTINCT FROM OLD.reference THEN
      NEW.reference := OLD.reference;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_opportunite_reference ON public.opportunite_annonces;
CREATE TRIGGER trg_set_opportunite_reference
  BEFORE INSERT OR UPDATE ON public.opportunite_annonces
  FOR EACH ROW EXECUTE FUNCTION public.set_opportunite_reference();

-- 5. Backfill existing annonces in stable order (published_at ASC, id ASC), grouped by year
DO $$
DECLARE
  r record;
  _year integer;
  _cur_year integer := 0;
  _seq integer := 0;
BEGIN
  FOR r IN
    SELECT id, EXTRACT(YEAR FROM published_at)::integer AS y
    FROM public.opportunite_annonces
    WHERE reference IS NULL
    ORDER BY EXTRACT(YEAR FROM published_at), published_at ASC, id ASC
  LOOP
    IF r.y <> _cur_year THEN
      _cur_year := r.y;
      SELECT COALESCE(last_number, 0) INTO _seq FROM public.opportunite_reference_counters WHERE year = _cur_year;
      IF _seq IS NULL THEN _seq := 0; END IF;
    END IF;
    _seq := _seq + 1;
    UPDATE public.opportunite_annonces SET reference = 'OPP-' || _cur_year::text || '-' || LPAD(_seq::text, 6, '0') WHERE id = r.id;
    INSERT INTO public.opportunite_reference_counters (year, last_number, updated_at)
    VALUES (_cur_year, _seq, now())
    ON CONFLICT (year) DO UPDATE SET last_number = GREATEST(opportunite_reference_counters.last_number, _seq), updated_at = now();
  END LOOP;
END $$;

-- 6. Unique index + not-null after backfill
CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunite_annonces_reference ON public.opportunite_annonces(reference);
ALTER TABLE public.opportunite_annonces ALTER COLUMN reference SET NOT NULL;
