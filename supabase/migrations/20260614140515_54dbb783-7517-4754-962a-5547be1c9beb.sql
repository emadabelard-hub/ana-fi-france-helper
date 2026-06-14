
-- 1) chantier_invitations
CREATE TABLE public.chantier_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  phone text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chantier_invitations TO authenticated;
GRANT ALL ON public.chantier_invitations TO service_role;
ALTER TABLE public.chantier_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patron manages own invitations"
  ON public.chantier_invitations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) chantier_team_members
CREATE TABLE public.chantier_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier_id uuid NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  patron_user_id uuid NOT NULL,
  member_user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'chef_equipe',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chantier_id, member_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chantier_team_members TO authenticated;
GRANT ALL ON public.chantier_team_members TO service_role;
ALTER TABLE public.chantier_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patron or member can view"
  ON public.chantier_team_members FOR SELECT
  USING (auth.uid() = patron_user_id OR auth.uid() = member_user_id);
CREATE POLICY "Patron can insert"
  ON public.chantier_team_members FOR INSERT
  WITH CHECK (auth.uid() = patron_user_id);
CREATE POLICY "Patron can delete"
  ON public.chantier_team_members FOR DELETE
  USING (auth.uid() = patron_user_id);
CREATE POLICY "Member can insert self via valid invitation"
  ON public.chantier_team_members FOR INSERT
  WITH CHECK (
    auth.uid() = member_user_id
    AND EXISTS (
      SELECT 1 FROM public.chantier_invitations inv
      WHERE inv.chantier_id = chantier_team_members.chantier_id
        AND inv.user_id = chantier_team_members.patron_user_id
        AND inv.status = 'pending'
        AND inv.expires_at > now()
    )
  );

-- 3) helper function
CREATE OR REPLACE FUNCTION public.is_chantier_team_member(_user_id uuid, _chantier_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chantier_team_members
    WHERE member_user_id = _user_id AND chantier_id = _chantier_id
  )
$$;

-- 4) submitted_by on chantier_reports
ALTER TABLE public.chantier_reports ADD COLUMN IF NOT EXISTS submitted_by uuid;
ALTER TABLE public.chantier_reports ADD COLUMN IF NOT EXISTS submitted_by_name text;

-- 5) Extend RLS for chantiers: team member can SELECT chantiers they are assigned to
CREATE POLICY "Team members can view assigned chantiers"
  ON public.chantiers FOR SELECT
  USING (public.is_chantier_team_member(auth.uid(), id));

-- 6) Extend RLS for chantier_reports: team member can SELECT and INSERT for their chantier
CREATE POLICY "Team members view chantier reports"
  ON public.chantier_reports FOR SELECT
  USING (public.is_chantier_team_member(auth.uid(), chantier_id));
CREATE POLICY "Team members insert chantier reports"
  ON public.chantier_reports FOR INSERT
  WITH CHECK (
    public.is_chantier_team_member(auth.uid(), chantier_id)
    AND submitted_by = auth.uid()
  );

-- 7) Public accessor for invitation by token (no auth required)
CREATE OR REPLACE FUNCTION public.get_chantier_invitation(_token uuid)
RETURNS TABLE(
  id uuid,
  chantier_id uuid,
  patron_user_id uuid,
  status text,
  expires_at timestamptz,
  chantier_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT inv.id, inv.chantier_id, inv.user_id AS patron_user_id, inv.status, inv.expires_at, ch.name AS chantier_name
  FROM public.chantier_invitations inv
  LEFT JOIN public.chantiers ch ON ch.id = inv.chantier_id
  WHERE inv.token = _token
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_chantier_invitation(uuid) TO anon, authenticated;

-- 8) Accept invitation: authenticated user becomes team member
CREATE OR REPLACE FUNCTION public.accept_chantier_invitation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _inv public.chantier_invitations;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _inv FROM public.chantier_invitations WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation introuvable'; END IF;
  IF _inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitation déjà utilisée ou révoquée'; END IF;
  IF _inv.expires_at < now() THEN RAISE EXCEPTION 'Invitation expirée'; END IF;

  INSERT INTO public.chantier_team_members (chantier_id, patron_user_id, member_user_id, role)
  VALUES (_inv.chantier_id, _inv.user_id, _uid, 'chef_equipe')
  ON CONFLICT (chantier_id, member_user_id) DO NOTHING;

  UPDATE public.chantier_invitations SET status = 'accepted' WHERE id = _inv.id;

  RETURN jsonb_build_object('ok', true, 'chantier_id', _inv.chantier_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_chantier_invitation(uuid) TO authenticated;
