
-- Update the trigger to accept user-provided invoice numbers (custom numbering)
-- If a valid F-YYYY-XXX number is provided and status is finalized, keep it (after uniqueness check)
CREATE OR REPLACE FUNCTION public.protect_and_number_factures()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year integer;
  v_dup_count integer;
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
    -- Check if user provided a valid custom number (not a placeholder)
    IF NEW.document_number IS NOT NULL 
       AND NEW.document_number <> '' 
       AND NEW.document_number !~ '^BROUILLON-'
       AND NEW.document_number ~ '^F-[0-9]{4}-[0-9]{3,}$' THEN
      -- User provided a custom number: check uniqueness for this user
      SELECT COUNT(*) INTO v_dup_count
      FROM public.documents_comptables
      WHERE user_id = NEW.user_id
        AND document_number = NEW.document_number
        AND document_type = 'facture'
        AND (TG_OP = 'INSERT' OR id <> OLD.id);
      
      IF v_dup_count > 0 THEN
        RAISE EXCEPTION 'Le numéro de facture % existe déjà', NEW.document_number;
      END IF;
      -- Keep user-provided number as-is
    ELSE
      -- Auto-assign next sequential number
      v_year := EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::integer;
      NEW.document_number := public.assign_next_facture_number(NEW.user_id, v_year);
    END IF;

    -- Final format validation
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
$function$;
