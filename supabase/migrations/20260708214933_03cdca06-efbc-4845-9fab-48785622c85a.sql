DROP POLICY IF EXISTS "Member can insert self via valid invitation" ON public.chantier_team_members;

CREATE POLICY "Member can insert self via valid invitation"
ON public.chantier_team_members
FOR INSERT
TO authenticated
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