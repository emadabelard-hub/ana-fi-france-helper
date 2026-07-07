
CREATE TABLE public.invoice_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents_comptables(id) ON DELETE CASCADE,
  client_email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'sent',
  viewed_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_tokens TO authenticated;
GRANT ALL ON public.invoice_tokens TO service_role;

ALTER TABLE public.invoice_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_tokens" ON public.invoice_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_can_insert_tokens" ON public.invoice_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_can_update_tokens" ON public.invoice_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_invoice_tokens_token ON public.invoice_tokens(token);
CREATE INDEX idx_invoice_tokens_document ON public.invoice_tokens(document_id);

CREATE TABLE public.invoice_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES public.invoice_tokens(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.invoice_access_log TO authenticated;
GRANT ALL ON public.invoice_access_log TO service_role;

ALTER TABLE public.invoice_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_access_log" ON public.invoice_access_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.invoice_tokens t
      WHERE t.id = invoice_access_log.token_id AND t.user_id = auth.uid()
    )
  );
