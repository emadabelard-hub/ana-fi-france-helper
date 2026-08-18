ALTER TABLE public.chantier_reports
  ADD COLUMN IF NOT EXISTS client_signature_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS sent_to_client_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_signer_name text,
  ADD COLUMN IF NOT EXISTS client_signature_data text;

CREATE UNIQUE INDEX IF NOT EXISTS chantier_reports_client_signature_token_key
  ON public.chantier_reports (client_signature_token);

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
         r.pdf_url, r.client_signer_name, r.client_signed_at
  FROM public.chantier_reports r
  LEFT JOIN public.chantiers ch ON ch.id = r.chantier_id
  LEFT JOIN public.clients cl ON cl.id = r.client_id
  WHERE r.client_signature_token = _token
    AND r.status IN ('envoye_client', 'signe_client')
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.submit_chantier_report_signature(_token uuid, _signer_name text, _signature_data text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.chantier_reports;
BEGIN
  IF _signer_name IS NULL OR length(trim(_signer_name)) < 2 THEN
    RAISE EXCEPTION 'Nom invalide';
  END IF;
  IF _signature_data IS NULL OR length(_signature_data) < 100 THEN
    RAISE EXCEPTION 'Signature invalide';
  END IF;

  SELECT * INTO _row FROM public.chantier_reports WHERE client_signature_token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lien invalide';
  END IF;
  IF _row.status = 'signe_client' THEN
    RAISE EXCEPTION 'Rapport déjà signé';
  END IF;
  IF _row.status <> 'envoye_client' THEN
    RAISE EXCEPTION 'Rapport non disponible pour signature';
  END IF;

  UPDATE public.chantier_reports
  SET client_signer_name = trim(_signer_name),
      client_signature_data = _signature_data,
      client_signed_at = now(),
      status = 'signe_client'
  WHERE client_signature_token = _token;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.get_chantier_report_by_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_chantier_report_signature(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chantier_report_by_token(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_chantier_report_signature(uuid, text, text) TO service_role;