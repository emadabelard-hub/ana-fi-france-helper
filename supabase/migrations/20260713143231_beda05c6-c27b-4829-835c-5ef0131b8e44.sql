
-- Favorites table
CREATE TABLE IF NOT EXISTS public.opportunite_favoris (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  annonce_id uuid NOT NULL REFERENCES public.opportunite_annonces(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, annonce_id)
);

GRANT SELECT, INSERT, DELETE ON public.opportunite_favoris TO authenticated;
GRANT ALL ON public.opportunite_favoris TO service_role;

ALTER TABLE public.opportunite_favoris ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own favoris"
ON public.opportunite_favoris FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own favoris"
ON public.opportunite_favoris FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own favoris"
ON public.opportunite_favoris FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_opp_favoris_user ON public.opportunite_favoris(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opp_favoris_annonce ON public.opportunite_favoris(annonce_id);

-- Triggers to keep opportunite_annonces.favorites_count in sync
CREATE OR REPLACE FUNCTION public.opportunite_favoris_bump()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.opportunite_annonces
      SET favorites_count = COALESCE(favorites_count,0) + 1
      WHERE id = NEW.annonce_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.opportunite_annonces
      SET favorites_count = GREATEST(COALESCE(favorites_count,0) - 1, 0)
      WHERE id = OLD.annonce_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_opportunite_favoris_bump_ins ON public.opportunite_favoris;
CREATE TRIGGER trg_opportunite_favoris_bump_ins
AFTER INSERT ON public.opportunite_favoris
FOR EACH ROW EXECUTE FUNCTION public.opportunite_favoris_bump();

DROP TRIGGER IF EXISTS trg_opportunite_favoris_bump_del ON public.opportunite_favoris;
CREATE TRIGGER trg_opportunite_favoris_bump_del
AFTER DELETE ON public.opportunite_favoris
FOR EACH ROW EXECUTE FUNCTION public.opportunite_favoris_bump();

-- Shares counter on annonces
ALTER TABLE public.opportunite_annonces
  ADD COLUMN IF NOT EXISTS shares_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_annonce_shares(_annonce_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.opportunite_annonces
    SET shares_count = COALESCE(shares_count,0) + 1
    WHERE id = _annonce_id AND status = 'active';
END;
$$;
