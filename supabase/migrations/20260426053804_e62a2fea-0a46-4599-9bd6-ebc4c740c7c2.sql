CREATE TABLE public.translation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.translation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "translation_history_owner_select"
ON public.translation_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "translation_history_owner_insert"
ON public.translation_history FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "translation_history_owner_delete"
ON public.translation_history FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_translation_history_user_created
ON public.translation_history (user_id, created_at DESC);