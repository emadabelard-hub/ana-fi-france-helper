
CREATE TABLE public.admin_connection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  email text NULL,
  event text NOT NULL CHECK (event IN ('login_success','login_failure','logout','blocked')),
  ip_address text NULL,
  user_agent text NULL,
  device_type text NULL CHECK (device_type IS NULL OR device_type IN ('mobile','tablet','desktop','unknown')),
  country text NULL,
  last_activity_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_connection_logs TO authenticated;
GRANT ALL ON public.admin_connection_logs TO service_role;

ALTER TABLE public.admin_connection_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read connection logs"
  ON public.admin_connection_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- No INSERT/UPDATE/DELETE policies: writes are performed by the edge function
-- using the service_role key, which bypasses RLS. Regular users cannot write.

CREATE INDEX idx_admin_connection_logs_created_at ON public.admin_connection_logs (created_at DESC);
CREATE INDEX idx_admin_connection_logs_user_id ON public.admin_connection_logs (user_id);
CREATE INDEX idx_admin_connection_logs_email ON public.admin_connection_logs (email);
CREATE INDEX idx_admin_connection_logs_event ON public.admin_connection_logs (event);
