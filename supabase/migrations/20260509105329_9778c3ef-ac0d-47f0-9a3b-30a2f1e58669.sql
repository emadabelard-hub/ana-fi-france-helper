CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistant_conversations_owner_all"
  ON public.assistant_conversations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_assistant_conversations_updated_at
  BEFORE UPDATE ON public.assistant_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();