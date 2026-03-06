-- Emergency restoration read-access policies for public access mode
-- Keep existing policies, add explicit authenticated read policies to restore visibility.

CREATE POLICY "Emergency restore: authenticated can read documents"
ON public.documents_comptables
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Emergency restore: authenticated can read clients"
ON public.clients
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Emergency restore: authenticated can read chantiers"
ON public.chantiers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Emergency restore: authenticated can read expenses"
ON public.expenses
FOR SELECT
TO authenticated
USING (true);