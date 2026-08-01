CREATE TABLE public.btp_analysis_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  language text NOT NULL DEFAULT 'fr',
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_text text,
  current_step text NOT NULL DEFAULT 'queued',
  progress integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  step_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_report text,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.btp_analysis_jobs TO authenticated;
GRANT ALL ON public.btp_analysis_jobs TO service_role;

ALTER TABLE public.btp_analysis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analysis jobs"
ON public.btp_analysis_jobs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_btp_analysis_jobs_user_status
ON public.btp_analysis_jobs (user_id, status, updated_at DESC);

CREATE TRIGGER update_btp_analysis_jobs_updated_at
BEFORE UPDATE ON public.btp_analysis_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();