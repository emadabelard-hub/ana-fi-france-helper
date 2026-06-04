-- Restrict SECURITY DEFINER functions: revoke from anon and PUBLIC where access
-- is not intentional. Intentionally public-callable functions are kept open:
--   * increment_promo_views, increment_promo_clicks (anon promo tracking)
--   * get_document_verification (public document verification page)
--   * get_signature_request_by_token (public signing page)
--   * submit_signature (signature-finalize public flow)

-- is_admin: do not expose to anon; keep callable by authenticated to allow
-- self-check from the client.
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- get_next_document_number: only authenticated artisans need this.
REVOKE EXECUTE ON FUNCTION public.get_next_document_number(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_document_number(uuid, text) TO authenticated, service_role;

-- Trigger functions: never need direct execute by clients.
REVOKE EXECUTE ON FUNCTION public.generate_chantier_reference() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_daily_message_count() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_factures() FROM anon, PUBLIC;
