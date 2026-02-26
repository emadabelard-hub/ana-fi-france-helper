
-- Activity logs table for tracking user behavior
CREATE TABLE public.user_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  is_guest BOOLEAN DEFAULT false,
  page TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'page_view',
  metadata JSONB DEFAULT '{}',
  session_id TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_created_at ON public.user_activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_page ON public.user_activity_logs(page);
CREATE INDEX idx_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX idx_activity_logs_session_id ON public.user_activity_logs(session_id);

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own activity logs"
ON public.user_activity_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anon can insert guest activity logs"
ON public.user_activity_logs
FOR INSERT
TO anon
WITH CHECK (is_guest = true AND user_id IS NULL);

CREATE POLICY "Admins can read all activity logs"
ON public.user_activity_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));
