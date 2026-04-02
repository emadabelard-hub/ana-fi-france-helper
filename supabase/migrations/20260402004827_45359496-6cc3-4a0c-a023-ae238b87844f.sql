
-- Drop the protection trigger (we'll keep protect_factures function but remove auto-numbering)
DROP TRIGGER IF EXISTS protect_factures_trigger ON public.documents_comptables;

-- Drop all auto-numbering functions
DROP FUNCTION IF EXISTS public.assign_next_facture_number(uuid, integer);
DROP FUNCTION IF EXISTS public.get_next_document_number(text, uuid, integer);
DROP FUNCTION IF EXISTS public.get_next_document_number(uuid, text, integer);

-- Re-create protect_factures without numbering logic (keep protection only)
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
    ) THEN
      RAISE EXCEPTION 'Une facture annulée est figée';
    END IF;

    IF OLD.status IN ('finalized', 'cancelled')
       AND NEW.document_number IS DISTINCT FROM OLD.document_number THEN
      RAISE EXCEPTION 'Le numéro d''une facture validée ne peut pas être modifié';
    END IF;

    IF COALESCE(OLD.payment_status, 'unpaid') = 'paid'
       AND NEW.document_number IS DISTINCT FROM OLD.document_number THEN
      RAISE EXCEPTION 'Le numéro d''une facture payée ne peut pas être modifié';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Re-create trigger
CREATE TRIGGER protect_factures_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.documents_comptables
  FOR EACH ROW EXECUTE FUNCTION public.protect_factures();
