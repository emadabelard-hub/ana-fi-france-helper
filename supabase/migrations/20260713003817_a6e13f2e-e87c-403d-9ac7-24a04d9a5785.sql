
-- 1. Reports table
CREATE TABLE public.opportunite_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('annonce','conversation','message')),
  annonce_id uuid REFERENCES public.opportunite_annonces(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.opportunite_conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.opportunite_messages(id) ON DELETE SET NULL,
  reported_user_id uuid,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewing','resolved','rejected')),
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_opportunite_reports_status ON public.opportunite_reports(status);
CREATE INDEX idx_opportunite_reports_reporter ON public.opportunite_reports(reporter_id);
CREATE INDEX idx_opportunite_reports_annonce ON public.opportunite_reports(annonce_id);
CREATE INDEX idx_opportunite_reports_created ON public.opportunite_reports(created_at DESC);

-- Prevent exact duplicates from the same reporter
CREATE UNIQUE INDEX uniq_opportunite_reports_dedup
  ON public.opportunite_reports(
    reporter_id,
    report_type,
    reason,
    COALESCE(annonce_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(conversation_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(message_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

GRANT SELECT, INSERT ON public.opportunite_reports TO authenticated;
GRANT ALL ON public.opportunite_reports TO service_role;

ALTER TABLE public.opportunite_reports ENABLE ROW LEVEL SECURITY;

-- Reporter can insert own report, cannot target their own annonce/message
CREATE POLICY "Reporter can create own report"
  ON public.opportunite_reports FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND (
      annonce_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.opportunite_annonces a WHERE a.id = annonce_id AND a.user_id = auth.uid())
    )
    AND (
      message_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.opportunite_messages m WHERE m.id = message_id AND m.sender_id = auth.uid())
    )
  );

CREATE POLICY "Reporter can view own reports"
  ON public.opportunite_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports"
  ON public.opportunite_reports FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update reports"
  ON public.opportunite_reports FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 2. Add moderation flags
ALTER TABLE public.opportunite_messages
  ADD COLUMN IF NOT EXISTS hidden_by_moderation boolean NOT NULL DEFAULT false;
ALTER TABLE public.opportunite_conversations
  ADD COLUMN IF NOT EXISTS closed_by_moderation boolean NOT NULL DEFAULT false;

-- 3. Tighten owner update on annonces: cannot mutate once moderated
DROP POLICY IF EXISTS "Users can update their own annonces" ON public.opportunite_annonces;
CREATE POLICY "Users can update their own annonces"
  ON public.opportunite_annonces FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status <> 'moderated')
  WITH CHECK (auth.uid() = user_id AND status <> 'moderated');

-- 4. Admin moderation policies on annonces / conversations / messages
CREATE POLICY "Admins can view all annonces"
  ON public.opportunite_annonces FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can moderate annonces"
  ON public.opportunite_annonces FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all conversations"
  ON public.opportunite_conversations FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can moderate conversations"
  ON public.opportunite_conversations FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all messages"
  ON public.opportunite_messages FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can moderate messages"
  ON public.opportunite_messages FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
