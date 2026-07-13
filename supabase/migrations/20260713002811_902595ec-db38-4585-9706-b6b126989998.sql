
-- Conversations
CREATE TABLE public.opportunite_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id uuid NOT NULL REFERENCES public.opportunite_annonces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  contact_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunite_conversations_no_self CHECK (owner_id <> contact_user_id),
  CONSTRAINT opportunite_conversations_status_chk CHECK (status IN ('active','closed'))
);

CREATE UNIQUE INDEX opportunite_conversations_unique
  ON public.opportunite_conversations(annonce_id, owner_id, contact_user_id);
CREATE INDEX opportunite_conversations_owner_idx     ON public.opportunite_conversations(owner_id);
CREATE INDEX opportunite_conversations_contact_idx   ON public.opportunite_conversations(contact_user_id);
CREATE INDEX opportunite_conversations_last_msg_idx  ON public.opportunite_conversations(last_message_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.opportunite_conversations TO authenticated;
GRANT ALL ON public.opportunite_conversations TO service_role;

ALTER TABLE public.opportunite_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversations"
  ON public.opportunite_conversations FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = contact_user_id);

-- Only the contact can create a conversation, and only against an active annonce
-- whose owner matches owner_id.
CREATE POLICY "Contact can start conversation"
  ON public.opportunite_conversations FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = contact_user_id
    AND auth.uid() <> owner_id
    AND EXISTS (
      SELECT 1 FROM public.opportunite_annonces a
      WHERE a.id = annonce_id
        AND a.status = 'active'
        AND a.user_id = owner_id
    )
  );

CREATE POLICY "Participants can update conversation"
  ON public.opportunite_conversations FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = contact_user_id)
  WITH CHECK (auth.uid() = owner_id OR auth.uid() = contact_user_id);

CREATE TRIGGER trg_opportunite_conversations_updated_at
BEFORE UPDATE ON public.opportunite_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Messages
CREATE TABLE public.opportunite_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.opportunite_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunite_messages_content_len CHECK (char_length(content) BETWEEN 1 AND 4000)
);

CREATE INDEX opportunite_messages_conv_idx ON public.opportunite_messages(conversation_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.opportunite_messages TO authenticated;
GRANT ALL ON public.opportunite_messages TO service_role;

ALTER TABLE public.opportunite_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view messages"
  ON public.opportunite_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunite_conversations c
      WHERE c.id = conversation_id
        AND (auth.uid() = c.owner_id OR auth.uid() = c.contact_user_id)
    )
  );

CREATE POLICY "Participants can send messages"
  ON public.opportunite_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.opportunite_conversations c
      WHERE c.id = conversation_id
        AND c.status = 'active'
        AND (auth.uid() = c.owner_id OR auth.uid() = c.contact_user_id)
    )
  );

-- Recipients can mark messages as read; senders can soft-delete their own.
CREATE POLICY "Participants can update messages"
  ON public.opportunite_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunite_conversations c
      WHERE c.id = conversation_id
        AND (auth.uid() = c.owner_id OR auth.uid() = c.contact_user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.opportunite_conversations c
      WHERE c.id = conversation_id
        AND (auth.uid() = c.owner_id OR auth.uid() = c.contact_user_id)
    )
  );

-- Auto-bump conversation.last_message_at when a message is inserted.
CREATE OR REPLACE FUNCTION public.opportunite_bump_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.opportunite_conversations
     SET last_message_at = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opportunite_messages_bump_conv
AFTER INSERT ON public.opportunite_messages
FOR EACH ROW EXECUTE FUNCTION public.opportunite_bump_last_message();
