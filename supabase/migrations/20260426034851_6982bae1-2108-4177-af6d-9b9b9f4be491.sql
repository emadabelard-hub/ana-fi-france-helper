ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid();

ALTER TABLE public.chantiers
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid();

ALTER TABLE public.documents_comptables
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid();

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL DEFAULT auth.uid();

ALTER TABLE public.clients
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.chantiers
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.documents_comptables
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.expenses
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;

ALTER TABLE public.chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chantiers FORCE ROW LEVEL SECURITY;

ALTER TABLE public.documents_comptables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents_comptables FORCE ROW LEVEL SECURITY;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
DROP POLICY IF EXISTS "clients_owner_only" ON public.clients;
DROP POLICY IF EXISTS "Clients owner only" ON public.clients;

DROP POLICY IF EXISTS "Admins can view all chantiers" ON public.chantiers;
DROP POLICY IF EXISTS "Users can delete their own chantiers" ON public.chantiers;
DROP POLICY IF EXISTS "Users can insert their own chantiers" ON public.chantiers;
DROP POLICY IF EXISTS "Users can update their own chantiers" ON public.chantiers;
DROP POLICY IF EXISTS "Users can view their own chantiers" ON public.chantiers;
DROP POLICY IF EXISTS "chantiers_owner_only" ON public.chantiers;
DROP POLICY IF EXISTS "Chantiers owner only" ON public.chantiers;

DROP POLICY IF EXISTS "Admins can view all documents" ON public.documents_comptables;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents_comptables;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents_comptables;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents_comptables;
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents_comptables;
DROP POLICY IF EXISTS "documents_comptables_owner_only" ON public.documents_comptables;
DROP POLICY IF EXISTS "Documents owner only" ON public.documents_comptables;

DROP POLICY IF EXISTS "Admins can view all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "expenses_owner_only" ON public.expenses;
DROP POLICY IF EXISTS "Expenses owner only" ON public.expenses;

CREATE POLICY "clients_owner_only"
ON public.clients
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chantiers_owner_only"
ON public.chantiers
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_comptables_owner_only"
ON public.documents_comptables
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "expenses_owner_only"
ON public.expenses
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_chantiers_user_id ON public.chantiers(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_comptables_user_id ON public.documents_comptables(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);