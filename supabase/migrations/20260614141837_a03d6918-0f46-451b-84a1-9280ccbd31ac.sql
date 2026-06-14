
CREATE POLICY "no_anonymous_sessions" ON public.chantier_invitations
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

CREATE POLICY "no_anonymous_sessions" ON public.chantier_reports
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);

CREATE POLICY "no_anonymous_sessions" ON public.chantier_team_members
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE)
  WITH CHECK ((auth.jwt() ->> 'is_anonymous')::boolean IS NOT TRUE);
