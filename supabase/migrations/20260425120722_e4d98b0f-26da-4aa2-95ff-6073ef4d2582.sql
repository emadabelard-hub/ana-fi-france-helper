-- ============================================================
-- Renforcement de la numérotation atomique des devis/factures
-- ============================================================

-- 1) Index unique anti-doublon : impossible d'avoir deux documents
--    avec le même numéro pour un même utilisateur et type
CREATE UNIQUE INDEX IF NOT EXISTS uniq_documents_user_type_number
  ON public.documents_comptables (user_id, document_type, document_number)
  WHERE document_number IS NOT NULL
    AND document_number !~ '___';

-- 2) Renforcer get_next_document_number :
--    - LOCK explicite via INSERT ... ON CONFLICT (déjà atomique)
--    - Boucle anti-doublon : si le numéro calculé existe déjà
--      (cas exceptionnel : import manuel, ancien doublon),
--      on incrémente jusqu'à trouver un numéro libre.
CREATE OR REPLACE FUNCTION public.get_next_document_number(_user_id uuid, _document_type text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _year integer;
  _prefix text;
  _next_num integer;
  _formatted text;
  _attempts integer := 0;
  _exists boolean;
BEGIN
  -- Validate document type
  IF _document_type NOT IN ('devis', 'facture') THEN
    RAISE EXCEPTION 'Invalid document type: %', _document_type;
  END IF;

  _year := EXTRACT(YEAR FROM now())::integer;
  _prefix := CASE WHEN _document_type = 'facture' THEN 'F' ELSE 'D' END;

  -- Boucle anti-doublon : on garantit qu'on retourne un numéro
  -- qui n'existe pas déjà dans documents_comptables.
  LOOP
    _attempts := _attempts + 1;
    IF _attempts > 100 THEN
      RAISE EXCEPTION 'Impossible de réserver un numéro libre après 100 tentatives';
    END IF;

    -- UPSERT atomique : incrémente le compteur de manière sûre
    INSERT INTO public.document_counters (user_id, document_type, year, last_number, updated_at)
    VALUES (_user_id, _document_type, _year, 1, now())
    ON CONFLICT (user_id, document_type, year)
    DO UPDATE SET
      last_number = document_counters.last_number + 1,
      updated_at = now()
    RETURNING last_number INTO _next_num;

    _formatted := _prefix || '-' || _year::text || '-' || LPAD(_next_num::text, 3, '0');

    -- Vérifier qu'aucun document n'utilise déjà ce numéro
    -- (anti-doublon défensif : couvre les imports manuels passés)
    SELECT EXISTS (
      SELECT 1 FROM public.documents_comptables
      WHERE user_id = _user_id
        AND document_type = _document_type
        AND document_number = _formatted
    ) INTO _exists;

    EXIT WHEN NOT _exists;
  END LOOP;

  RETURN _formatted;
END;
$function$;