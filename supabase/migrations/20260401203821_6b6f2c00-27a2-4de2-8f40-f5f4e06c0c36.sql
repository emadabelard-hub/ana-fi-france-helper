CREATE OR REPLACE FUNCTION public.assign_next_facture_number(p_user_id uuid, p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next integer;
BEGIN
  INSERT INTO public.document_counters (user_id, document_type, year, last_number)
  VALUES (p_user_id, 'facture', p_year, 1)
  ON CONFLICT (user_id, document_type, year)
  DO UPDATE SET last_number = public.document_counters.last_number + 1, updated_at = now()
  RETURNING last_number INTO v_next;

  RETURN 'F-' || p_year::text || '-' || LPAD(v_next::text, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_and_number_factures()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.document_type = 'facture'
       AND (
         OLD.status IN ('finalized', 'cancelled')
         OR COALESCE(OLD.payment_status, 'unpaid') = 'paid'
       ) THEN
      RAISE EXCEPTION 'Suppression interdite pour une facture validée, payée ou annulée';
    END IF;

    RETURN OLD;
  END IF;

  IF NEW.document_type <> 'facture' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'cancelled' AND (
      NEW.status IS DISTINCT FROM OLD.status
      OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
      OR NEW.document_data IS DISTINCT FROM OLD.document_data
      OR NEW.subtotal_ht IS DISTINCT FROM OLD.subtotal_ht
      OR NEW.total_ttc IS DISTINCT FROM OLD.total_ttc
      OR NEW.tva_amount IS DISTINCT FROM OLD.tva_amount
      OR NEW.tva_rate IS DISTINCT FROM OLD.tva_rate
      OR NEW.client_name IS DISTINCT FROM OLD.client_name
      OR NEW.client_address IS DISTINCT FROM OLD.client_address
      OR NEW.work_site_address IS DISTINCT FROM OLD.work_site_address
      OR NEW.nature_operation IS DISTINCT FROM OLD.nature_operation
    ) THEN
      RAISE EXCEPTION 'Une facture annulée est figée et ne peut plus être modifiée';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status IN ('finalized', 'cancelled')
     AND NEW.document_number IS DISTINCT FROM OLD.document_number THEN
    RAISE EXCEPTION 'Le numéro officiel d''une facture ne peut pas être modifié';
  END IF;

  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.payment_status, 'unpaid') = 'paid'
     AND NEW.document_number IS DISTINCT FROM OLD.document_number THEN
    RAISE EXCEPTION 'Le numéro officiel d''une facture payée ne peut pas être modifié';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'finalized' THEN
    IF NOT (
      (NEW.status = 'finalized' AND NEW.payment_status IN ('unpaid', 'paid'))
      OR (NEW.status = 'cancelled' AND NEW.document_number = OLD.document_number)
    ) THEN
      RAISE EXCEPTION 'Transition de statut facture non autorisée';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.payment_status, 'unpaid') = 'paid' THEN
    IF NEW.status NOT IN ('finalized', 'cancelled') THEN
      RAISE EXCEPTION 'Une facture payée ne peut pas revenir à un autre statut';
    END IF;
  END IF;

  IF NEW.status = 'finalized' THEN
    IF NEW.document_number IS NULL OR NEW.document_number = '' OR NEW.document_number LIKE 'BROUILLON-%' THEN
      v_year := EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::integer;
      NEW.document_number := public.assign_next_facture_number(NEW.user_id, v_year);
    END IF;

    IF NEW.document_number !~ '^F-[0-9]{4}-[0-9]{3,}$' THEN
      RAISE EXCEPTION 'Format de numéro de facture invalide';
    END IF;
  ELSE
    IF NEW.document_number IS NULL OR NEW.document_number = '' THEN
      NEW.document_number := 'BROUILLON-F-' || EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::text || '-' || UPPER(substr(md5(gen_random_uuid()::text), 1, 4));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_and_number_factures_on_documents_comptables ON public.documents_comptables;

CREATE TRIGGER protect_and_number_factures_on_documents_comptables
BEFORE INSERT OR UPDATE OR DELETE ON public.documents_comptables
FOR EACH ROW
EXECUTE FUNCTION public.protect_and_number_factures();