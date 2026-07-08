
DROP POLICY IF EXISTS users_can_view_own_access_log ON public.invoice_access_log;
CREATE POLICY users_can_view_own_access_log ON public.invoice_access_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoice_tokens t WHERE t.id = invoice_access_log.token_id AND t.user_id = auth.uid()));

CREATE POLICY no_anonymous_sessions ON public.invoice_access_log
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

DROP POLICY IF EXISTS users_can_insert_tokens ON public.invoice_tokens;
DROP POLICY IF EXISTS users_can_update_tokens ON public.invoice_tokens;
DROP POLICY IF EXISTS users_can_view_own_tokens ON public.invoice_tokens;

CREATE POLICY users_can_insert_tokens ON public.invoice_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_can_update_tokens ON public.invoice_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_can_view_own_tokens ON public.invoice_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY no_anonymous_sessions ON public.invoice_tokens
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

CREATE POLICY no_anonymous_sessions ON public.suppliers
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

CREATE POLICY no_anonymous_sessions ON public.supplier_invoices
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

CREATE POLICY no_anonymous_sessions ON public.supplier_invoice_lines
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

CREATE POLICY no_anonymous_sessions ON public.accountant_access
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

CREATE POLICY no_anonymous_sessions ON public.admin_diagnostic_alerts
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);
