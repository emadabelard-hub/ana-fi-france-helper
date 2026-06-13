CREATE TABLE public.chantier_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chantier_id uuid REFERENCES public.chantiers(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  report_number text,
  report_date date,
  worker_count integer,
  worker_names text,
  hours_worked text,
  weather text,
  work_done_fr text,
  materials_fr text,
  observations_fr text,
  supervisor_name text,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chantier_reports TO authenticated;
GRANT ALL ON public.chantier_reports TO service_role;

ALTER TABLE public.chantier_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chantier reports"
  ON public.chantier_reports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_chantier_reports_chantier_id ON public.chantier_reports(chantier_id);
CREATE INDEX idx_chantier_reports_user_id ON public.chantier_reports(user_id);