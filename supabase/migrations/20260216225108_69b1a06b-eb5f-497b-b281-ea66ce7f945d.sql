
-- Visit logs table for section tracking
CREATE TABLE public.visit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  section text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.visit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view visit logs"
ON public.visit_logs FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can log visits"
ON public.visit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE INDEX idx_visit_logs_section ON public.visit_logs(section);
CREATE INDEX idx_visit_logs_created_at ON public.visit_logs(created_at DESC);

-- Admin transactions view (joins with profiles for email)
CREATE VIEW public.admin_transactions_view
WITH (security_invoker=on) AS
SELECT t.id, t.user_id, t.service_name, t.service_key, t.price_eur, t.is_bundle, t.status, t.created_at,
       p.full_name, p.email
FROM public.transactions t
LEFT JOIN public.profiles p ON t.user_id = p.user_id;
