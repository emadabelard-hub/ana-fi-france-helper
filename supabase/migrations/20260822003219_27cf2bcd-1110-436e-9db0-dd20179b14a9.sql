ALTER TABLE public.chantier_reports ADD COLUMN IF NOT EXISTS signed_pdf_url text;

DROP FUNCTION IF EXISTS public.get_chantier_report_by_token(uuid);

CREATE OR REPLACE FUNCTION public.get_chantier_report_by_token(_token uuid)
RETURNS TABLE(
  id uuid,
  report_number text,
  report_date date,
  status text,
  chantier_name text,
  client_name text,
  supervisor_name text,
  submitted_by_name text,
  pdf_url text,
  signed_pdf_url text,
  client_signer_name text,
  client_signed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.report_number, r.report_date, r.status,
         ch.name, cl.name, r.supervisor_name, r.submitted_by_name,
         r.pdf_url, r.signed_pdf_url, r.client_signer_name, r.client_signed_at
  FROM public.chantier_reports r
  LEFT JOIN public.chantiers ch ON ch.id = r.chantier_id
  LEFT JOIN public.clients cl ON cl.id = r.client_id
  WHERE r.client_signature_token = _token
    AND r.status IN ('envoye_client', 'signe_client')
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_chantier_report_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chantier_report_by_token(uuid) TO service_role;