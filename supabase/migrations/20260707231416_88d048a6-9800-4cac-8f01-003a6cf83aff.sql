
DROP POLICY IF EXISTS "Team members can view assigned chantiers" ON public.chantiers;
CREATE POLICY "Team members can view assigned chantiers" ON public.chantiers
  FOR SELECT TO authenticated
  USING (is_chantier_team_member(auth.uid(), id));

DROP POLICY IF EXISTS "Users manage their own creation progress" ON public.creation_progress;
CREATE POLICY "Users manage their own creation progress" ON public.creation_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
