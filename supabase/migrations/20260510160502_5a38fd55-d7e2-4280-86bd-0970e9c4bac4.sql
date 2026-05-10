-- CRITIQUE 1: Sécuriser la table realtime.messages contre l'écoute cross-user
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid()::text = (payload->>'user_id')::text
);