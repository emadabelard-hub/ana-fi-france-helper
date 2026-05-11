
CREATE TABLE public.signature_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL,
  user_id uuid NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  signer_name text,
  signed_at timestamptz,
  signature_data text,
  status text NOT NULL DEFAULT 'pending',
  document_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_signature_requests_token ON public.signature_requests(token);
CREATE INDEX idx_signature_requests_document ON public.signature_requests(document_id);
CREATE INDEX idx_signature_requests_user ON public.signature_requests(user_id);

ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "owner_select_signature" ON public.signature_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_signature" ON public.signature_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_signature" ON public.signature_requests
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner_delete_signature" ON public.signature_requests
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Block anonymous sessions on owner side
CREATE POLICY "no_anonymous_signature" ON public.signature_requests
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
  WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

CREATE TRIGGER trg_signature_requests_updated_at
  BEFORE UPDATE ON public.signature_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public access via token: SECURITY DEFINER RPCs (no public table SELECT policy)
CREATE OR REPLACE FUNCTION public.get_signature_request_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  status text,
  signer_name text,
  signed_at timestamptz,
  document_snapshot jsonb,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, status, signer_name, signed_at, document_snapshot, created_at
  FROM public.signature_requests
  WHERE token = _token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.submit_signature(
  _token uuid,
  _signer_name text,
  _signature_data text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _row public.signature_requests;
BEGIN
  IF _signer_name IS NULL OR length(trim(_signer_name)) < 2 THEN
    RAISE EXCEPTION 'Nom invalide';
  END IF;
  IF _signature_data IS NULL OR length(_signature_data) < 100 THEN
    RAISE EXCEPTION 'Signature invalide';
  END IF;

  SELECT * INTO _row FROM public.signature_requests WHERE token = _token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lien invalide';
  END IF;
  IF _row.status = 'signed' THEN
    RAISE EXCEPTION 'Document déjà signé';
  END IF;

  UPDATE public.signature_requests
  SET signer_name = _signer_name,
      signature_data = _signature_data,
      signed_at = now(),
      status = 'signed',
      updated_at = now()
  WHERE token = _token;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_signature_request_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_signature(uuid, text, text) TO anon, authenticated;
