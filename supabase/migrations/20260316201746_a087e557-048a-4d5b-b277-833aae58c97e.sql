
CREATE TABLE public.btp_price_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travail text NOT NULL UNIQUE,
  unite text NOT NULL DEFAULT 'm2',
  prix_moyen numeric NOT NULL DEFAULT 0,
  categorie text NOT NULL DEFAULT 'general',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Public read access (reference data, no user-specific data)
ALTER TABLE public.btp_price_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read BTP price reference"
  ON public.btp_price_reference
  FOR SELECT
  TO public
  USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage BTP price reference"
  ON public.btp_price_reference
  FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
