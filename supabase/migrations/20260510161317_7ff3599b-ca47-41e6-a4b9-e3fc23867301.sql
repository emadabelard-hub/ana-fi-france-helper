
-- =========================================================
-- POINT 1 — transfer_waitlist : INSERT auth non-anonyme
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can insert into waitlist" ON public.transfer_waitlist;
CREATE POLICY "auth_only_insert"
ON public.transfer_waitlist FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true'
  AND email IS NOT NULL
  AND length(trim(email)) > 0
);

-- =========================================================
-- POINT 2 — admin_users : bloquer INSERT/UPDATE/DELETE
-- =========================================================
CREATE POLICY "no_insert_admin"
ON public.admin_users AS RESTRICTIVE FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "no_update_admin"
ON public.admin_users AS RESTRICTIVE FOR UPDATE
TO authenticated, anon
USING (false);

CREATE POLICY "no_delete_admin"
ON public.admin_users AS RESTRICTIVE FOR DELETE
TO authenticated, anon
USING (false);

-- =========================================================
-- POINT 3 — Exclure sessions anonymes des policies existantes
-- Politique RESTRICTIVE globale par table : plus simple et sûr.
-- =========================================================

-- profiles
CREATE POLICY "no_anonymous_sessions"
ON public.profiles AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- clients
CREATE POLICY "no_anonymous_sessions"
ON public.clients AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- chantiers
CREATE POLICY "no_anonymous_sessions"
ON public.chantiers AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- documents
CREATE POLICY "no_anonymous_sessions"
ON public.documents AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- documents_comptables
CREATE POLICY "no_anonymous_sessions"
ON public.documents_comptables AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- expenses
CREATE POLICY "no_anonymous_sessions"
ON public.expenses AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- invoice_drafts
CREATE POLICY "no_anonymous_sessions"
ON public.invoice_drafts AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- assistant_conversations
CREATE POLICY "no_anonymous_sessions"
ON public.assistant_conversations AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- transactions
CREATE POLICY "no_anonymous_sessions"
ON public.transactions AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- support_tickets
CREATE POLICY "no_anonymous_sessions"
ON public.support_tickets AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- service_requests
CREATE POLICY "no_anonymous_sessions"
ON public.service_requests AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- request_messages
CREATE POLICY "no_anonymous_sessions"
ON public.request_messages AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- request_files
CREATE POLICY "no_anonymous_sessions"
ON public.request_files AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- translation_history
CREATE POLICY "no_anonymous_sessions"
ON public.translation_history AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- user_feedback
CREATE POLICY "no_anonymous_sessions"
ON public.user_feedback AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- milestone_invoices
CREATE POLICY "no_anonymous_sessions"
ON public.milestone_invoices AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- artisan_pricing
CREATE POLICY "no_anonymous_sessions"
ON public.artisan_pricing AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- artisan_price_catalog
CREATE POLICY "no_anonymous_sessions"
ON public.artisan_price_catalog AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- document_counters
CREATE POLICY "no_anonymous_sessions"
ON public.document_counters AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');

-- transfer_waitlist (insert seul, déjà restreint au point 1, on conserve cohérence)
CREATE POLICY "no_anonymous_sessions"
ON public.transfer_waitlist AS RESTRICTIVE FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
WITH CHECK ((auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true');
