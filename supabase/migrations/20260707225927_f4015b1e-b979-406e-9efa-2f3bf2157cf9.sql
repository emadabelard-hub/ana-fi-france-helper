
-- ============================================================
-- 1) Chantier policies: rescope from `public` role to `authenticated`
-- ============================================================

-- chantier_invitations
DROP POLICY IF EXISTS "Patron manages own invitations" ON public.chantier_invitations;
CREATE POLICY "Patron manages own invitations"
  ON public.chantier_invitations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- chantier_reports
DROP POLICY IF EXISTS "Team members insert chantier reports" ON public.chantier_reports;
CREATE POLICY "Team members insert chantier reports"
  ON public.chantier_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_chantier_team_member(auth.uid(), chantier_id));

DROP POLICY IF EXISTS "Team members view chantier reports" ON public.chantier_reports;
CREATE POLICY "Team members view chantier reports"
  ON public.chantier_reports
  FOR SELECT
  TO authenticated
  USING (public.is_chantier_team_member(auth.uid(), chantier_id));

DROP POLICY IF EXISTS "Users manage own chantier reports" ON public.chantier_reports;
CREATE POLICY "Users manage own chantier reports"
  ON public.chantier_reports
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- chantier_team_members
DROP POLICY IF EXISTS "Member can insert self via valid invitation" ON public.chantier_team_members;
CREATE POLICY "Member can insert self via valid invitation"
  ON public.chantier_team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = member_user_id);

DROP POLICY IF EXISTS "Patron can delete" ON public.chantier_team_members;
CREATE POLICY "Patron can delete"
  ON public.chantier_team_members
  FOR DELETE
  TO authenticated
  USING (auth.uid() = patron_user_id);

DROP POLICY IF EXISTS "Patron can insert" ON public.chantier_team_members;
CREATE POLICY "Patron can insert"
  ON public.chantier_team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = patron_user_id);

DROP POLICY IF EXISTS "Patron or member can view" ON public.chantier_team_members;
CREATE POLICY "Patron or member can view"
  ON public.chantier_team_members
  FOR SELECT
  TO authenticated
  USING (auth.uid() = patron_user_id OR auth.uid() = member_user_id);

-- ============================================================
-- 2) lesson-images bucket: remove anonymous access, keep authenticated read
-- ============================================================
DROP POLICY IF EXISTS "Allow public read access to lesson images" ON storage.objects;
DROP POLICY IF EXISTS "lesson_images_read_by_url" ON storage.objects;

CREATE POLICY "Authenticated users read lesson images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'lesson-images');

-- ============================================================
-- 3) supplier_invoices.user_id: enforce NOT NULL
-- ============================================================
ALTER TABLE public.supplier_invoices
  ALTER COLUMN user_id SET NOT NULL;
