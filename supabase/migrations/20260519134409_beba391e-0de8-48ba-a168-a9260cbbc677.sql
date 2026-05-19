CREATE UNIQUE INDEX IF NOT EXISTS invoice_drafts_user_document_type_uidx
ON public.invoice_drafts (user_id, document_type);

DROP TRIGGER IF EXISTS update_invoice_drafts_updated_at ON public.invoice_drafts;

CREATE TRIGGER update_invoice_drafts_updated_at
BEFORE UPDATE ON public.invoice_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();