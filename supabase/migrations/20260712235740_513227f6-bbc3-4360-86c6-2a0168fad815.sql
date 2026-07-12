-- Table for job/service opportunity announcements (Opportunités professionnelles)
CREATE TABLE public.opportunite_annonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('emploi','recrute','services','partenaire')),
  sector text,
  title text NOT NULL,
  ville text,
  departement text,
  disponibilite text,
  description text,
  photo_url text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  views_count integer NOT NULL DEFAULT 0,
  favorites_count integer NOT NULL DEFAULT 0,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunite_annonces TO authenticated;
GRANT ALL ON public.opportunite_annonces TO service_role;

ALTER TABLE public.opportunite_annonces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own annonces"
  ON public.opportunite_annonces FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own annonces"
  ON public.opportunite_annonces FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own annonces"
  ON public.opportunite_annonces FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own annonces"
  ON public.opportunite_annonces FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_opportunite_annonces_user ON public.opportunite_annonces(user_id, created_at DESC);
CREATE INDEX idx_opportunite_annonces_type_status ON public.opportunite_annonces(type, status, published_at DESC);

CREATE TRIGGER update_opportunite_annonces_updated_at
  BEFORE UPDATE ON public.opportunite_annonces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();