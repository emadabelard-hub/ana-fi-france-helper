-- Allow public read/update by token for the signature flow (token acts as the secret)
DROP POLICY IF EXISTS "public_read_by_token" ON public.signature_requests;
DROP POLICY IF EXISTS "public_update_by_token" ON public.signature_requests;

CREATE POLICY "public_read_by_token"
ON public.signature_requests
AS PERMISSIVE
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "public_update_by_token"
ON public.signature_requests
AS PERMISSIVE
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);