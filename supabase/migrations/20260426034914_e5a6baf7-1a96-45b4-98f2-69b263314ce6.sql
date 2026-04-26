DROP POLICY IF EXISTS "clients_owner_only" ON public.clients;
DROP POLICY IF EXISTS "chantiers_owner_only" ON public.chantiers;
DROP POLICY IF EXISTS "documents_comptables_owner_only" ON public.documents_comptables;
DROP POLICY IF EXISTS "expenses_owner_only" ON public.expenses;

CREATE POLICY "clients_owner_only"
ON public.clients
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "chantiers_owner_only"
ON public.chantiers
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "documents_comptables_owner_only"
ON public.documents_comptables
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "expenses_owner_only"
ON public.expenses
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL AND auth.uid() = user_id);