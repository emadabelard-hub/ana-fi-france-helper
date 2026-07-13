
-- Public read access for active annonces
GRANT SELECT ON public.opportunite_annonces TO anon;

CREATE POLICY "Anyone can view active annonces"
ON public.opportunite_annonces
FOR SELECT
TO anon, authenticated
USING (status = 'active');

-- RPC to safely increment views_count without exposing update
CREATE OR REPLACE FUNCTION public.increment_annonce_views(_annonce_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.opportunite_annonces
  SET views_count = views_count + 1
  WHERE id = _annonce_id AND status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_annonce_views(uuid) TO anon, authenticated;
