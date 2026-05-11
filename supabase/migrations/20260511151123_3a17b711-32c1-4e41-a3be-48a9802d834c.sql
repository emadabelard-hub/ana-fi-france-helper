
ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS signed_pdf_url text,
  ADD COLUMN IF NOT EXISTS signed_pdf_path text;

DROP FUNCTION IF EXISTS public.get_signature_request_by_token(uuid);

CREATE FUNCTION public.get_signature_request_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  status text,
  signer_name text,
  signed_at timestamptz,
  document_snapshot jsonb,
  signed_pdf_url text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, document_id, status, signer_name, signed_at, document_snapshot, signed_pdf_url, created_at
  FROM public.signature_requests
  WHERE token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_signature_request_by_token(uuid) TO anon, authenticated;
