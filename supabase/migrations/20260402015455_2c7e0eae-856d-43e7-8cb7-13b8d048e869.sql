
-- Drop the 4 "Emergency restore" policies that expose all data to any authenticated user

DROP POLICY IF EXISTS "Emergency restore: authenticated can read expenses" ON public.expenses;
DROP POLICY IF EXISTS "Emergency restore: authenticated can read clients" ON public.clients;
DROP POLICY IF EXISTS "Emergency restore: authenticated can read documents" ON public.documents_comptables;
DROP POLICY IF EXISTS "Emergency restore: authenticated can read chantiers" ON public.chantiers;
