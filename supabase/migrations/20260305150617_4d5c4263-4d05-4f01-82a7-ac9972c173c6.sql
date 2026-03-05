
-- Create clients table
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  siret text,
  address text,
  contact_name text,
  contact_phone text,
  contact_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clients" ON public.clients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clients" ON public.clients FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own clients" ON public.clients FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all clients" ON public.clients FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- Create chantiers table
CREATE TABLE public.chantiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  site_address text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chantiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chantiers" ON public.chantiers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own chantiers" ON public.chantiers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own chantiers" ON public.chantiers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chantiers" ON public.chantiers FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all chantiers" ON public.chantiers FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- Add chantier_id to documents_comptables
ALTER TABLE public.documents_comptables ADD COLUMN chantier_id uuid REFERENCES public.chantiers(id) ON DELETE SET NULL;

-- Add chantier_id to expenses
ALTER TABLE public.expenses ADD COLUMN chantier_id uuid REFERENCES public.chantiers(id) ON DELETE SET NULL;

-- Triggers for updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chantiers_updated_at BEFORE UPDATE ON public.chantiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
