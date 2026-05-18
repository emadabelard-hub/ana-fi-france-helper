
-- Allow multiple conversations per user
ALTER TABLE public.assistant_conversations
  DROP CONSTRAINT IF EXISTS assistant_conversations_user_id_key;

ALTER TABLE public.assistant_conversations
  ADD COLUMN IF NOT EXISTS title text;

CREATE INDEX IF NOT EXISTS assistant_conversations_user_updated_idx
  ON public.assistant_conversations (user_id, updated_at DESC);
