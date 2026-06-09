
CREATE TABLE public.admin_diagnostic_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  occurrences INTEGER NOT NULL DEFAULT 1,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_diagnostic_alerts TO authenticated;
GRANT ALL ON public.admin_diagnostic_alerts TO service_role;

ALTER TABLE public.admin_diagnostic_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view diagnostic alerts"
  ON public.admin_diagnostic_alerts FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update diagnostic alerts"
  ON public.admin_diagnostic_alerts FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete diagnostic alerts"
  ON public.admin_diagnostic_alerts FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_admin_diagnostic_alerts_created_at ON public.admin_diagnostic_alerts (created_at DESC);
CREATE INDEX idx_admin_diagnostic_alerts_type_resolved ON public.admin_diagnostic_alerts (alert_type, resolved);

CREATE TRIGGER update_admin_diagnostic_alerts_updated_at
  BEFORE UPDATE ON public.admin_diagnostic_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
