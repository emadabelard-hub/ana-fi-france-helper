
-- Public verification function: returns sanitized document info for QR-code verification.
-- Exposes ONLY non-sensitive fields. No address details, no IBAN, no item lines.
CREATE OR REPLACE FUNCTION public.get_document_verification(_document_id uuid)
RETURNS TABLE (
  id uuid,
  document_number text,
  document_type text,
  status text,
  payment_status text,
  total_ttc numeric,
  created_at timestamptz,
  client_name text,
  company_name text,
  company_logo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.document_number,
    d.document_type,
    d.status,
    d.payment_status,
    d.total_ttc,
    d.created_at,
    d.client_name,
    p.company_name,
    p.logo_url AS company_logo_url
  FROM public.documents_comptables d
  LEFT JOIN public.profiles p ON p.user_id = d.user_id
  WHERE d.id = _document_id
    AND d.status IN ('finalized', 'converted', 'cancelled');
$$;

-- Allow anonymous/public access to this verification function only
GRANT EXECUTE ON FUNCTION public.get_document_verification(uuid) TO anon, authenticated;
