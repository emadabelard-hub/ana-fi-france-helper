
CREATE TABLE public.artisan_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  enduit_full numeric NOT NULL DEFAULT 16,
  enduit_labor numeric NOT NULL DEFAULT 8.8,
  peinture_plafond_full numeric NOT NULL DEFAULT 30,
  peinture_plafond_labor numeric NOT NULL DEFAULT 16.5,
  peinture_mur_full numeric NOT NULL DEFAULT 30,
  peinture_mur_labor numeric NOT NULL DEFAULT 16.5,
  nettoyage_forfait numeric NOT NULL DEFAULT 200,
  fenetre_full numeric NOT NULL DEFAULT 65,
  fenetre_labor numeric NOT NULL DEFAULT 40,
  sous_couche_full numeric NOT NULL DEFAULT 12,
  ponçage_full numeric NOT NULL DEFAULT 14,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.artisan_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pricing" ON public.artisan_pricing FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own pricing" ON public.artisan_pricing FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pricing" ON public.artisan_pricing FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_artisan_pricing_updated_at BEFORE UPDATE ON public.artisan_pricing FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
