CREATE TABLE public.creation_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, step_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creation_progress TO authenticated;
GRANT ALL ON public.creation_progress TO service_role;

ALTER TABLE public.creation_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own creation progress"
  ON public.creation_progress
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_creation_progress_updated_at
  BEFORE UPDATE ON public.creation_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();