
CREATE OR REPLACE FUNCTION public.get_team_chantier_context(_chantier_id uuid)
RETURNS TABLE(
  chantier_id uuid,
  chantier_name text,
  site_address text,
  client_id uuid,
  client_name text,
  patron_user_id uuid,
  patron_company_name text,
  patron_siret text,
  patron_company_address text,
  patron_logo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ch.id,
    ch.name,
    ch.site_address,
    ch.client_id,
    cl.name,
    ch.user_id,
    p.company_name,
    p.siret,
    p.company_address,
    p.logo_url
  FROM public.chantiers ch
  LEFT JOIN public.clients cl ON cl.id = ch.client_id
  LEFT JOIN public.profiles p ON p.user_id = ch.user_id
  WHERE ch.id = _chantier_id
    AND (
      ch.user_id = auth.uid()
      OR public.is_chantier_team_member(auth.uid(), ch.id)
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_chantier_context(uuid) TO authenticated;
