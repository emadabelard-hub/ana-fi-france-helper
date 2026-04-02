
-- Step 1: Drop the old trigger first (freeing the function)
DROP TRIGGER IF EXISTS protect_and_number_factures_on_documents_comptables ON public.documents_comptables;

-- Step 2: Drop the old function
DROP FUNCTION IF EXISTS public.protect_and_number_factures();

-- Step 3: Create new simpler protection function
CREATE OR REPLACE FUNCTION public.protect_factures()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.document_type = 'facture'
       AND (OLD.status IN ('finalized', 'cancelled') OR COALESCE(OLD.payment_status, 'unpaid') = 'paid') THEN
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
    ) THEN
      RAISE EXCEPTION 'Une facture annulée est figée et ne peut plus être modifiée';
    END IF;

    IF OLD.status IN ('finalized', 'cancelled')
       AND NEW.document_number IS DISTINCT FROM OLD.document_number THEN
      RAISE EXCEPTION 'Le numéro officiel d''une facture ne peut pas être modifié';
    END IF;

    IF COALESCE(OLD.payment_status, 'unpaid') = 'paid'
       AND NEW.document_number IS DISTINCT FROM OLD.document_number THEN
      RAISE EXCEPTION 'Le numéro officiel d''une facture payée ne peut pas être modifié';
    END IF;

    IF OLD.status = 'finalized' THEN
      IF NOT (
        (NEW.status = 'finalized' AND NEW.payment_status IN ('unpaid', 'paid'))
        OR (NEW.status = 'cancelled' AND NEW.document_number = OLD.document_number)
      ) THEN
        RAISE EXCEPTION 'Transition de statut facture non autorisée';
      END IF;
    END IF;

    IF COALESCE(OLD.payment_status, 'unpaid') = 'paid'
       AND NEW.status NOT IN ('finalized', 'cancelled') THEN
      RAISE EXCEPTION 'Une facture payée ne peut pas revenir à un autre statut';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Step 4: Create new trigger
CREATE TRIGGER protect_factures_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.documents_comptables
  FOR EACH ROW EXECUTE FUNCTION public.protect_factures();
