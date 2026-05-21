-- Remove dangerous public RLS policies on signature_requests.
-- Anon access to signature data is intentionally routed through SECURITY DEFINER
-- edge functions (signature-info, signature-finalize, signature-email-copy),
-- which use the service role and bypass RLS. Owners still access their own rows
-- via the existing owner_select/insert/update/delete policies.
DROP POLICY IF EXISTS "public_read_by_token" ON public.signature_requests;
DROP POLICY IF EXISTS "public_update_by_token" ON public.signature_requests;